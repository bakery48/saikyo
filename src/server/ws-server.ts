import type { WebSocket } from 'ws';
import type { ClientMessage, ServerMessage } from '../shared/messages';
import type { Phase } from './engine/types';
import { type Room, RoomManager } from './rooms';
import { GameRunner } from './game-runner';
import { getStore } from './db';
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
        const room = this.roomManager.createRoom({
          id: playerId,
          name: msg.playerName,
          isReady: false,
        });
        this.send(ws, { type: 'room_state', room: this.roomManager.toRoomView(room) });
        this.broadcastRoomsList();
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
        if (game) this.send(ws, { type: 'game_state', state: game.toClientState() });
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
      case 'submit_reward': {
        this.runGameAction(playerId, (game) => game.submitReward(playerId, msg.choice));
        return;
      }
      case 'rename_monster': {
        this.handleRename(playerId, msg.name);
        return;
      }
    }
  }

  /** Pause after the final pick so players can see the completed board. */
  private static readonly POST_PICK_PAUSE_MS = 2200;

  private startGame(hostId: string): void {
    const room = this.roomManager.getRoomByPlayer(hostId);
    if (!room) throw new Error('not in a room');
    if (room.hostId !== hostId) throw new Error('only the host can start');
    if (room.inGame) throw new Error('game already started');
    const game = new GameRunner({
      roomId: room.id,
      seed: Date.now() & 0x7fffffff,
      humans: room.players.map((p) => ({ id: p.id, name: p.name })),
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
    if (this.maybePostPickPause(room, phaseBefore)) return;
    this.broadcastGameState(room);
    if (game.state.phase === 'finished') {
      this.handleFinished(room, game);
    }
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
    const cs = game.toClientState();
    const overridden = { ...cs, phase };
    for (const p of room.players) {
      const ws = this.connections.get(p.id);
      if (ws) this.send(ws, { type: 'game_state', state: overridden });
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
    const state = game.toClientState();
    for (const p of room.players) {
      const ws = this.connections.get(p.id);
      if (ws) this.send(ws, { type: 'game_state', state });
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
