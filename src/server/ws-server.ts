import type { WebSocket } from 'ws';
import type { ClientMessage, ServerMessage } from '../shared/messages';
import type { Phase } from './engine/types';
import { type Room, RoomManager } from './rooms';
import { GameRunner } from './game-runner';
import { getStore } from './db';
import { EVENTS } from './engine/cards/events';
import { ACTIONS } from './engine/cards/actions';
import { randomUUID } from 'node:crypto';

export class GameWsServer {
  private connections = new Map<string, WebSocket>(); // playerId -> ws
  private playerNames = new Map<string, string>(); // playerId -> name
  private roomManager = new RoomManager();
  /** Active games keyed by roomId. */
  private games = new Map<string, GameRunner>();

  /** Called by the HTTP server on every accepted ws upgrade. */
  handleConnection(ws: WebSocket): void {
    const playerId = randomUUID();
    this.connections.set(playerId, ws);
    this.send(ws, { type: 'welcome', playerId });

    ws.on('message', (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        this.send(ws, { type: 'error', message: 'invalid json' });
        return;
      }
      try {
        this.handleMessage(playerId, msg);
      } catch (err) {
        this.send(ws, { type: 'error', message: String((err as Error).message ?? err) });
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(playerId);
    });

    this.sendRoomsList(ws);
  }

  private handleMessage(playerId: string, msg: ClientMessage): void {
    const ws = this.connections.get(playerId);
    if (!ws) return;
    switch (msg.type) {
      case 'create_room': {
        this.playerNames.set(playerId, msg.playerName);
        const room = this.roomManager.createRoom(
          {
            id: playerId,
            name: msg.playerName,
            isReady: false,
          },
          {
            totalRounds: msg.totalRounds,
            miniRoundsPerRound: msg.miniRoundsPerRound,
          },
        );
        this.send(ws, { type: 'room_state', room: this.roomManager.toRoomView(room) });
        this.broadcastRoomsList();
        return;
      }
      case 'set_room_settings': {
        const room = this.roomManager.setSettings(playerId, {
          totalRounds: msg.totalRounds,
          miniRoundsPerRound: msg.miniRoundsPerRound,
        });
        this.broadcastRoomState(room.id);
        return;
      }
      case 'join_room': {
        this.playerNames.set(playerId, msg.playerName);
        const room = this.roomManager.joinRoom(msg.roomId, {
          id: playerId,
          name: msg.playerName,
          isReady: false,
        });
        this.broadcastRoomState(room.id);
        this.broadcastRoomsList();
        // If a game is already running in this room (rejoiner), send state.
        const game = this.games.get(room.id);
        if (game) this.send(ws, { type: 'game_state', state: game.toClientState(playerId) });
        return;
      }
      case 'leave_room':
      case 'leave_game': {
        const { room, destroyed } = this.roomManager.leavePlayer(playerId);
        this.send(ws, { type: 'left_room' });
        if (room && !destroyed) {
          this.broadcastRoomState(room.id);
          // If everyone left, drop the game.
          if (room.players.length === 0) this.games.delete(room.id);
        }
        if (destroyed) {
          // Was the only player; drop game if any.
          // Find the destroyed room id by iterating games.
          for (const [rid] of this.games) {
            if (this.roomManager.getRoom(rid) === null) this.games.delete(rid);
          }
        }
        this.broadcastRoomsList();
        return;
      }
      case 'set_ready': {
        const room = this.roomManager.setReady(playerId, msg.isReady);
        if (room) this.broadcastRoomState(room.id);
        return;
      }
      case 'list_rooms': {
        this.sendRoomsList(ws);
        return;
      }
      case 'start_game': {
        this.startGame(playerId);
        return;
      }
      case 'submit_pick': {
        this.runGameAction(playerId, (game) => game.submitPick(playerId, msg.baseId));
        return;
      }
      case 'submit_draft': {
        this.runGameAction(playerId, (game) => game.submitDraft(playerId, msg.skillId));
        return;
      }
      case 'play_action_card': {
        this.runGameAction(playerId, (game) =>
          game.submitAction(playerId, msg.cardId, {
            chosenStat: msg.chosenStat,
            swap: msg.swap,
          }),
        );
        return;
      }
      case 'submit_reward': {
        this.runGameAction(playerId, (game) => game.submitReward(playerId, msg.choice));
        return;
      }
      case 'rename_monster': {
        this.handleRename(playerId, msg.name);
        return;
      }
      case 'dev_inject_event': {
        this.runGameAction(playerId, (game) => {
          const card = EVENTS.find((c) => c.id === msg.cardId);
          if (!card) throw new Error('unknown event card');
          game.state.decks.event.unshift({ ...card });
        });
        return;
      }
      case 'dev_replace_hand': {
        this.runGameAction(playerId, (game) => {
          const card = ACTIONS.find((c) => c.id === msg.newCardId);
          if (!card) throw new Error('unknown action card');
          const player = game.state.players.find((p) => p.id === playerId);
          if (!player) throw new Error('not in game');
          const idx = player.actionHand.findIndex((c) => c.id === msg.oldCardId);
          if (idx < 0) throw new Error('card not in hand');
          player.actionHand[idx] = { ...card };
        });
        return;
      }
    }
  }

  /** Pause after the final pick so players can see the completed board. */
  private static readonly POST_PICK_PAUSE_MS = 2200;
  /** How long to show the open reveal (all picks visible) before resolving. */
  private static readonly DRAFT_REVEAL_MS = 3000;
  /** Per-skill animation step the client uses for the battle view. */
  private static readonly BATTLE_STEP_MS = 2000;
  /** Pre-battle dice-roll banner duration — must match BattleAnimationView. */
  private static readonly BATTLE_PREROLL_MS = 3000;
  /** Buffer added to the battle animation duration so the result is briefly visible. */
  private static readonly BATTLE_TAIL_MS = 1500;
  /** How long the event-phase card+effect stays on screen before advancing. */
  private static readonly EVENT_PHASE_MS = 3000;
  /** How long the action-phase summary stays on screen before advancing. */
  private static readonly ACTION_PHASE_MS = 6000;

  private startGame(hostId: string): void {
    const room = this.roomManager.getRoomByPlayer(hostId);
    if (!room) throw new Error('not in a room');
    if (room.hostId !== hostId) throw new Error('only the host can start');
    if (room.inGame) throw new Error('game already started');
    const game = new GameRunner({
      roomId: room.id,
      seed: Date.now() & 0x7fffffff,
      humans: room.players.map((p) => ({ id: p.id, name: p.name })),
      pauseOnReveal: true,
      yieldForAnimation: true,
      totalRounds: room.totalRounds,
      miniRoundsPerRound: room.miniRoundsPerRound,
    });
    this.games.set(room.id, game);
    room.inGame = true;
    // Broadcast the empty initial state so clients see all 8 monsters
    // before any picks happen, then start driving the game forward.
    this.broadcastGameState(room);
    this.broadcastRoomState(room.id);
    this.broadcastRoomsList();
    this.driveGame(room);
  }

  private runGameAction(playerId: string, fn: (game: GameRunner) => void): void {
    const room = this.roomManager.getRoomByPlayer(playerId);
    if (!room) throw new Error('not in a room');
    const game = this.games.get(room.id);
    if (!game) throw new Error('no game in this room');
    fn(game);
    this.driveGame(room);
  }

  /**
   * Drive the game forward. Runs all auto / CPU steps until the game waits
   * on a human or finishes, then broadcasts the resulting state. When the
   * monster pick phase has just completed, the pick board is held on screen
   * briefly before the post-pick state is broadcast so players can absorb
   * the final selections.
   */
  private driveGame(room: Room): void {
    const game = this.games.get(room.id);
    if (!game) return;
    const phaseBefore = game.state.phase;
    game.advance();
    // Battle animation comes first — state.battle is cleared once the
    // following reward phase resolves, so we have to render it before the
    // engine progresses any further.
    if (this.maybeBattleAnimationPause(room)) return;
    if (this.maybeEventPhasePause(room)) return;
    if (this.maybeActionPhasePause(room)) return;
    if (this.maybeAutoReveal(room)) return;
    if (this.maybePostPickPause(room, phaseBefore)) return;
    this.broadcastGameState(room);
    if (game.state.phase === 'finished') {
      this.handleFinished(room, game);
    }
  }

  /**
   * Hold the client on a forced 'event' phase view for EVENT_PHASE_MS
   * after the engine resolved an event card, so players can see what
   * happened. After the timeout, drives the game forward.
   */
  private maybeEventPhasePause(room: Room): boolean {
    const game = this.games.get(room.id);
    if (!game) return false;
    if (!game.consumeEventResolved()) return false;
    if (!game.state.eventPhaseSummary) return false;
    this.broadcastGameStateWithPhase(room, 'event');
    setTimeout(() => {
      this.driveGame(room);
    }, GameWsServer.EVENT_PHASE_MS);
    return true;
  }

  /**
   * Hold the client on a forced 'action' phase view for ACTION_PHASE_MS
   * after the engine resolved every player's action card.
   */
  private maybeActionPhasePause(room: Room): boolean {
    const game = this.games.get(room.id);
    if (!game) return false;
    if (!game.consumeActionResolved()) return false;
    if (!game.state.actionPhaseSummary) return false;
    this.broadcastGameStateWithPhase(room, 'action');
    setTimeout(() => {
      this.driveGame(room);
    }, GameWsServer.ACTION_PHASE_MS);
    return true;
  }

  /**
   * If the engine just resolved the 'battle' phase during this advance(),
   * hold the client on a synthesized battle state long enough to play through
   * every skill_use event at BATTLE_STEP_MS, then broadcast the real
   * (post-battle) state.
   */
  private maybeBattleAnimationPause(room: Room): boolean {
    const game = this.games.get(room.id);
    if (!game) return false;
    if (!game.consumeBattleResolved()) return false;
    const matches = game.state.battle?.matches ?? [];
    let maxSkillUses = 0;
    for (const m of matches) {
      let count = 0;
      for (const e of m.log) if (e.kind === 'skill_use') count++;
      if (count > maxSkillUses) maxSkillUses = count;
    }
    if (maxSkillUses === 0) return false; // nothing to animate (e.g. all byes)
    const durationMs =
      GameWsServer.BATTLE_PREROLL_MS +
      maxSkillUses * GameWsServer.BATTLE_STEP_MS +
      GameWsServer.BATTLE_TAIL_MS;
    this.broadcastGameStateWithPhase(room, 'battle');
    setTimeout(() => {
      // Continue driving the game so the (auto-resolving) reward phase and
      // anything past it actually advance for everyone — without this the
      // engine sits at phase=reward and human winners just see the round-
      // results screen forever waiting on CPU rewards that never submit.
      this.driveGame(room);
    }, durationMs);
    return true;
  }

  /**
   * If the engine has paused for an open-reveal (every pending player in the
   * current draft / monster-pick sub-round has submitted), broadcast the full
   * picks for ~3 seconds, then clear `revealing`, resolve the sub-round and
   * continue driving the game. Returns true when a reveal was scheduled so the
   * normal post-advance broadcast is skipped.
   */
  private maybeAutoReveal(room: Room): boolean {
    const game = this.games.get(room.id);
    if (!game) return false;
    const draft = game.state.draft;
    if (draft?.revealing) {
      this.broadcastGameState(room);
      setTimeout(() => {
        const d = game.state.draft;
        if (d) d.revealing = false;
        game.resolveDraftSubRoundNow();
        this.driveGame(room);
      }, GameWsServer.DRAFT_REVEAL_MS);
      return true;
    }
    const pick = game.state.monsterPick;
    if (pick?.revealing) {
      this.broadcastGameState(room);
      setTimeout(() => {
        const p = game.state.monsterPick;
        if (p) p.revealing = false;
        game.resolveMonsterPickSubRoundNow();
        this.driveGame(room);
      }, GameWsServer.DRAFT_REVEAL_MS);
      return true;
    }
    return false;
  }

  /**
   * If the most recent state change pushed us out of the pick_monster phase,
   * broadcast the completed pick board (with phase forced back to
   * 'pick_monster') for a moment so clients can see the assignments, then
   * resume the real game state.
   */
  private maybePostPickPause(room: Room, phaseBefore: Phase): boolean {
    const game = this.games.get(room.id);
    if (!game) return false;
    if (phaseBefore !== 'pick_monster') return false;
    if (game.state.phase === 'pick_monster') return false;
    this.broadcastGameStateWithPhase(room, 'pick_monster');
    setTimeout(() => {
      this.broadcastGameState(room);
      if (game.state.phase === 'finished') {
        this.handleFinished(room, game);
      }
    }, GameWsServer.POST_PICK_PAUSE_MS);
    return true;
  }

  private broadcastGameStateWithPhase(room: Room, phase: Phase): void {
    const game = this.games.get(room.id);
    if (!game) return;
    for (const p of room.players) {
      const ws = this.connections.get(p.id);
      if (!ws) continue;
      const cs = game.toClientState(p.id);
      this.send(ws, { type: 'game_state', state: { ...cs, phase } });
    }
  }

  private handleFinished(room: Room, game: GameRunner): void {
    if (game.shouldPersistChampion()) this.persistChampion(game);
    room.inGame = false;
    this.broadcastRoomState(room.id);
    this.broadcastRoomsList();
  }

  /** Renames don't progress the game state — just apply and broadcast. */
  private handleRename(playerId: string, name: string): void {
    const room = this.roomManager.getRoomByPlayer(playerId);
    if (!room) throw new Error('not in a room');
    const game = this.games.get(room.id);
    if (!game) throw new Error('no game in this room');
    game.renameMonster(playerId, name);
    this.broadcastGameState(room);
  }

  private persistChampion(game: GameRunner): void {
    const champion = game.state.champion;
    if (!champion) return;
    const player = game.state.players.find((p) => p.id === champion.playerId);
    try {
      getStore().save({
        champion,
        ownerName: player?.name ?? 'Anonymous',
        seed: game.seed,
      });
    } catch (err) {
      console.error('hall-of-fame save failed:', err);
    }
  }

  private broadcastGameState(room: Room): void {
    const game = this.games.get(room.id);
    if (!game) return;
    for (const p of room.players) {
      const ws = this.connections.get(p.id);
      if (!ws) continue;
      this.send(ws, { type: 'game_state', state: game.toClientState(p.id) });
    }
  }

  private handleDisconnect(playerId: string): void {
    const { room, destroyed } = this.roomManager.leavePlayer(playerId);
    this.connections.delete(playerId);
    this.playerNames.delete(playerId);
    if (room && !destroyed) {
      this.broadcastRoomState(room.id);
      if (room.players.length === 0) this.games.delete(room.id);
    }
    this.broadcastRoomsList();
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify(msg));
  }

  private broadcastRoomState(roomId: string): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return;
    const view = this.roomManager.toRoomView(room);
    for (const p of room.players) {
      const ws = this.connections.get(p.id);
      if (ws) this.send(ws, { type: 'room_state', room: view });
    }
  }

  private sendRoomsList(ws: WebSocket): void {
    this.send(ws, { type: 'rooms_list', rooms: this.roomManager.listSummaries() });
  }

  private broadcastRoomsList(): void {
    const summaries = this.roomManager.listSummaries();
    for (const [playerId, ws] of this.connections) {
      if (!this.roomManager.getRoomByPlayer(playerId)) {
        this.send(ws, { type: 'rooms_list', rooms: summaries });
      }
    }
  }
}
