import type { ClientGameState, ClientPlayer } from '../shared/messages';
import type { GameState, RewardChoice, StatKey } from './engine/types';
import {
  allMonsterPicksIn,
  createInitialState,
  resolveMonsterPickSubRound,
  resolveBoonPhase,
  submitBoon,
  submitMonsterPick,
  syncMonsterFromSlots,
} from './engine/state';
import { MONSTERS_BY_ID } from './engine/cards/monsters';
import { resolveEventPhase } from './engine/phases/event';
import {
  startActionPhase,
  submitActionPlay,
  resolveActionPhase,
  allActionPlaysIn,
} from './engine/phases/action';
import {
  startPackDraft,
  submitPackPick,
  resolvePackPickRound,
  allPackPicksIn,
} from './engine/phases/draft';
import {
  startBuildPhase,
  submitBuild,
  resolveBuildPhase,
  allBuildsIn,
} from './engine/phases/build';
import { runBattlePhase } from './engine/phases/battle';
import { resolveRewardPhase, submitReward } from './engine/phases/reward';
import { startTournament, stepTournamentMatch } from './engine/phases/tournament';
import { chooseStatForActionCard, greedyPolicy } from './engine/policy';
import { validateMonsterName } from './engine/naming';

/**
 * Drives a single game's state machine for a room. Humans submit actions when
 * the game is waiting on them; CPU players auto-resolve via the greedy policy.
 *
 * Call `advance()` after every state change. It will execute auto-phases and
 * CPU choices until the game either reaches a phase that needs human input or
 * the game finishes.
 */
export class GameRunner {
  state: GameState;
  /** Set of human player IDs (CPUs are everyone else). */
  private humanIds: Set<string>;
  readonly seed: number;
  /** Set once the champion has been persisted to the hall of fame. */
  private hasPersistedChampion = false;
  /**
   * When true, draft / monster-pick sub-rounds pause for an external reveal
   * (set `revealing = true` and stop) instead of auto-resolving. The ws layer
   * uses this so every sub-round — including CPU-only ones — is shown to the
   * player before being resolved. Defaults to false so unit tests still get
   * fully synchronous resolution from `advance()`.
   */
  private pauseOnReveal: boolean;
  /**
   * When true, `advance()` returns early as soon as it transitions out of the
   * 'event', 'action' or 'battle' phase. The ws layer relies on this so the
   * matching animation/summary can play before the engine continues into the
   * next phase (which would otherwise clear shared state like `state.battle`).
   * Defaults to false so unit tests still get a single-call run-to-completion.
   */
  private yieldForAnimation: boolean;
  /**
   * Set inside `advance()` whenever a step transitions out of the 'battle'
   * phase. Read and cleared by the ws layer (`consumeBattleResolved`) so it
   * can play the per-skill battle animation on the client.
   */
  private battleResolvedSinceConsume = false;
  /** Same idea for the event phase: the ws layer pauses to display the card. */
  private eventResolvedSinceConsume = false;
  /** Same idea for the action phase. */
  private actionResolvedSinceConsume = false;
  /** Set after a tournament match is run, so the ws layer can animate it. */
  private tournamentMatchResolvedSinceConsume = false;

  constructor(opts: {
    roomId: string;
    seed: number;
    humans: { id: string; name: string }[];
    pauseOnReveal?: boolean;
    yieldForAnimation?: boolean;
    totalRounds?: number;
    miniRoundsPerRound?: number;
    skillCardCounts?: Record<string, number>;
  }) {
    this.seed = opts.seed;
    this.state = createInitialState({
      roomId: opts.roomId,
      seed: opts.seed,
      players: opts.humans.map((h) => ({ id: h.id, name: h.name, isCPU: false })),
      totalRounds: opts.totalRounds,
      miniRoundsPerRound: opts.miniRoundsPerRound,
      skillCardCounts: opts.skillCardCounts,
    });
    this.humanIds = new Set(opts.humans.map((h) => h.id));
    this.pauseOnReveal = opts.pauseOnReveal ?? false;
    this.yieldForAnimation = opts.yieldForAnimation ?? false;
  }

  isHuman(playerId: string): boolean {
    return this.humanIds.has(playerId);
  }

  /**
   * Hand a (disconnected) human's seat to the CPU: the engine stops waiting on
   * them and the greedy policy makes their choices from here on. No-op if the
   * player isn't a human in this game.
   */
  convertToCpu(playerId: string): void {
    if (!this.humanIds.has(playerId)) return;
    this.humanIds.delete(playerId);
    const p = this.state.players.find((pl) => pl.id === playerId);
    if (p) p.isCPU = true;
  }

  /** Take a CPU-controlled seat back over with a human player. */
  reclaimSeat(playerId: string): boolean {
    const p = this.state.players.find((pl) => pl.id === playerId);
    if (!p) return false;
    p.isCPU = false;
    this.humanIds.add(playerId);
    return true;
  }

  /** True if the given player id has a seat in this game (human or CPU-converted). */
  hasSeat(playerId: string): boolean {
    return this.state.players.some((pl) => pl.id === playerId);
  }

  /**
   * Returns true exactly once after the game enters the 'finished' phase
   * with a champion. Used by the WS layer so the champion is saved to the
   * hall of fame at most once per game.
   */
  shouldPersistChampion(): boolean {
    if (this.state.phase !== 'finished') return false;
    if (!this.state.champion) return false;
    if (this.hasPersistedChampion) return false;
    this.hasPersistedChampion = true;
    return true;
  }

  /** Run all auto/CPU steps until the game waits for human input or finishes. */
  advance(): void {
    // Iteration limit guards against runaway state.
    for (let i = 0; i < 1000; i++) {
      const before = this.snapshotKey();
      const phaseBefore = this.state.phase;
      const waiting = this.step();
      const battleResolvedNow = phaseBefore === 'battle' && this.state.phase !== 'battle';
      const eventResolvedNow = phaseBefore === 'event' && this.state.phase !== 'event';
      const actionResolvedNow = phaseBefore === 'action' && this.state.phase !== 'action';
      const tournamentMatchResolvedNow =
        phaseBefore === 'tournament' && this.tournamentMatchResolvedSinceConsume;
      if (battleResolvedNow) this.battleResolvedSinceConsume = true;
      if (eventResolvedNow) this.eventResolvedSinceConsume = true;
      if (actionResolvedNow) this.actionResolvedSinceConsume = true;
      if (waiting || this.state.phase === 'finished') return;
      // Yield to the ws layer right after a phase that needs an animation —
      // otherwise the next step (e.g. resolveRewardPhase) clears state.battle
      // before the client gets a chance to render the battle log.
      if (
        this.yieldForAnimation &&
        (battleResolvedNow || eventResolvedNow || actionResolvedNow || tournamentMatchResolvedNow)
      ) {
        return;
      }
      if (this.snapshotKey() === before) {
        // No progress made; bail to avoid infinite loop.
        return;
      }
    }
  }

  /**
   * Returns true if a battle phase was resolved since the last call (and
   * clears the flag). Used by the ws layer to drive the per-skill animation.
   */
  consumeBattleResolved(): boolean {
    const v = this.battleResolvedSinceConsume;
    this.battleResolvedSinceConsume = false;
    return v;
  }

  consumeEventResolved(): boolean {
    const v = this.eventResolvedSinceConsume;
    this.eventResolvedSinceConsume = false;
    return v;
  }

  consumeActionResolved(): boolean {
    const v = this.actionResolvedSinceConsume;
    this.actionResolvedSinceConsume = false;
    return v;
  }

  consumeTournamentMatchResolved(): boolean {
    const v = this.tournamentMatchResolvedSinceConsume;
    this.tournamentMatchResolvedSinceConsume = false;
    return v;
  }

  private stepTournament(): boolean {
    if (!this.state.tournament) startTournament(this.state);
    const finished = stepTournamentMatch(this.state);
    // Mark the match as resolved so the ws layer can pause for animation
    // before the next step runs.
    this.tournamentMatchResolvedSinceConsume = true;
    return finished ? false : false;
  }

  /** Returns true if the runner is now waiting on a human action. */
  private step(): boolean {
    switch (this.state.phase) {
      case 'pick_monster':
        return this.stepMonsterPick();
      case 'pick_boon':
        return this.stepBoonPick();
      case 'event':
        resolveEventPhase(this.state);
        return false;
      case 'action':
        return this.stepAction();
      case 'draft':
        return this.stepDraft();
      case 'build':
        return this.stepBuild();
      case 'battle':
        runBattlePhase(this.state);
        return false;
      case 'reward':
        return this.stepReward();
      case 'tournament':
        return this.stepTournament();
      case 'finished':
        return true;
      case 'setup':
        return true;
    }
  }

  private stepBoonPick(): boolean {
    const bp = this.state.boonPick;
    if (!bp) return true;
    let waiting = false;
    for (const pid of bp.pendingPlayerIds) {
      if (bp.submittedChoices[pid]) continue;
      if (this.isHuman(pid)) {
        waiting = true;
      } else {
        const player = this.state.players.find((p) => p.id === pid);
        if (!player?.monster) continue;
        const base = MONSTERS_BY_ID[player.monster.baseId];
        if (base?.boons?.[0]) {
          submitBoon(this.state, pid, greedyPolicy.chooseBoon(this.state, pid, Array.from(base.boons)).id);
        }
      }
    }
    if (waiting) return true;
    if (bp.pendingPlayerIds.every((id) => !!bp.submittedChoices[id])) {
      resolveBoonPhase(this.state);
    }
    return false;
  }

  private stepMonsterPick(): boolean {
    const draft = this.state.monsterPick;
    if (!draft) return true;
    if (draft.revealing) return true; // ws layer is showing the reveal
    let waiting = false;
    for (const pid of draft.pendingPlayerIds) {
      if (draft.submittedPicks[pid]) continue;
      if (this.isHuman(pid)) {
        waiting = true;
      } else {
        const m = greedyPolicy.pickMonster(this.state, pid, draft.pool);
        submitMonsterPick(this.state, pid, m.baseId);
      }
    }
    if (waiting) return true;
    if (this.pauseOnReveal && draft.pendingPlayerIds.length > 0) {
      draft.revealing = true;
      return true;
    }
    resolveMonsterPickSubRound(this.state);
    return false;
  }

  private stepDraft(): boolean {
    if (!this.state.packDraft) {
      startPackDraft(this.state);
      return false;
    }
    const draft = this.state.packDraft;
    if (draft.revealing) return true; // ws layer is showing the reveal
    let waiting = false;
    for (const pid of draft.pendingPlayerIds) {
      if (draft.submittedPicks[pid]) continue;
      const pack = draft.packs[pid] ?? [];
      if (pack.length === 0) continue;
      if (this.isHuman(pid)) {
        waiting = true;
      } else {
        const card = greedyPolicy.pickDraftCard(this.state, pid, pack);
        submitPackPick(this.state, pid, card.id);
      }
    }
    if (waiting) return true;
    if (this.pauseOnReveal && draft.pendingPlayerIds.length > 0) {
      draft.revealing = true;
      return true;
    }
    resolvePackPickRound(this.state);
    return false;
  }

  private stepBuild(): boolean {
    if (!this.state.buildPhase) {
      startBuildPhase(this.state);
      return false;
    }
    const build = this.state.buildPhase;
    let waiting = false;
    for (const pid of build.pendingPlayerIds) {
      if (build.submittedSlots[pid]) continue;
      if (this.isHuman(pid)) {
        waiting = true;
      } else {
        const config = greedyPolicy.buildSlots(this.state, pid);
        submitBuild(this.state, pid, config);
      }
    }
    if (waiting) return true;
    if (!allBuildsIn(this.state)) return false;
    resolveBuildPhase(this.state);
    return false;
  }

  private stepAction(): boolean {
    if (!this.state.actionPhase) {
      startActionPhase(this.state);
      return false;
    }
    const phase = this.state.actionPhase;
    let waiting = false;
    for (const pid of phase.pendingPlayerIds) {
      if (phase.submittedPlays[pid]) continue;
      if (this.isHuman(pid)) {
        waiting = true;
      } else {
        const player = this.state.players.find((p) => p.id === pid);
        if (!player) {
          phase.pendingPlayerIds = phase.pendingPlayerIds.filter((x) => x !== pid);
          continue;
        }
        const allCards = player.uniqueActionCard
          ? [...player.actionHand, player.uniqueActionCard]
          : player.actionHand;
        if (allCards.length === 0) {
          phase.pendingPlayerIds = phase.pendingPlayerIds.filter((x) => x !== pid);
          continue;
        }
        const card = greedyPolicy.pickActionCard(this.state, pid, allCards);
        const chosenStat =
          card.effect.kind === 'stat_mod_choice' && player.monster
            ? chooseStatForActionCard(player.monster.stats)
            : undefined;
        const swap =
          card.effect.kind === 'swap_actives'
            ? cpuPickSwapTarget(this.state, pid)
            : undefined;
        const curseTargetPlayerId =
          card.effect.kind === 'curse_player'
            ? cpuPickCurseTarget(this.state, pid)
            : undefined;
        if (card.effect.kind === 'swap_actives' && !swap) {
          // No valid target with ≥2 actives — replace with the next-best card if any.
          const fallback = player.actionHand.find((c) => c.effect.kind !== 'swap_actives');
          if (fallback) {
            const fallbackStat =
              fallback.effect.kind === 'stat_mod_choice' && player.monster
                ? chooseStatForActionCard(player.monster.stats)
                : undefined;
            submitActionPlay(this.state, pid, fallback.id, { chosenStat: fallbackStat });
            continue;
          }
        }
        submitActionPlay(this.state, pid, card.id, { chosenStat, swap, curseTargetPlayerId });
      }
    }
    if (waiting) return true;
    if (!allActionPlaysIn(this.state)) return false;
    resolveActionPhase(this.state);
    return false;
  }

  private stepReward(): boolean {
    if (!this.state.reward) return false;
    const reward = this.state.reward;
    let waiting = false;
    for (const pid of reward.pendingPlayerIds) {
      if (reward.choices[pid]) continue;
      if (this.isHuman(pid)) {
        waiting = true;
      } else {
        const choice = greedyPolicy.chooseReward(this.state, pid);
        submitReward(this.state, pid, choice);
      }
    }
    if (waiting) return true;
    resolveRewardPhase(this.state);
    return false;
  }

  // ─── Reveal-driven sub-round resolution ───────────────────────────────────
  // Used by the ws layer after the open-reveal pause to actually resolve the
  // sub-round. Safe no-ops if not in the matching phase / picks not all in.

  resolveDraftSubRoundNow(): void {
    if (this.state.phase !== 'draft' || !this.state.packDraft) return;
    const draft = this.state.packDraft;
    if (!draft.pendingPlayerIds.every((id) => !!draft.submittedPicks[id])) return;
    resolvePackPickRound(this.state);
  }

  resolveMonsterPickSubRoundNow(): void {
    if (this.state.phase !== 'pick_monster' || !this.state.monsterPick) return;
    const pick = this.state.monsterPick;
    if (!pick.pendingPlayerIds.every((id) => !!pick.submittedPicks[id])) return;
    resolveMonsterPickSubRound(this.state);
  }

  // ─── Human-driven actions ──────────────────────────────────────────────────

  submitPick(playerId: string, baseId: string): void {
    submitMonsterPick(this.state, playerId, baseId);
  }

  submitDraft(playerId: string, cardId: string): void {
    if (this.state.phase !== 'draft' || !this.state.packDraft) {
      throw new Error('not in draft phase');
    }
    submitPackPick(this.state, playerId, cardId);
  }

  submitBuild(playerId: string, config: { slots: (string | null)[]; activeSlotCount: number }): void {
    if (this.state.phase !== 'build' || !this.state.buildPhase) {
      throw new Error('not in build phase');
    }
    submitBuild(this.state, playerId, config);
  }

  submitAction(
    playerId: string,
    cardId: string,
    extras?: { chosenStat?: StatKey; swap?: { targetPlayerId: string; skillIdA: string; skillIdB: string }; curseTargetPlayerId?: string },
  ): void {
    if (this.state.phase !== 'action' || !this.state.actionPhase) {
      throw new Error('not in action phase');
    }
    submitActionPlay(this.state, playerId, cardId, extras);
  }

  submitReward(playerId: string, choice: RewardChoice): void {
    if (this.state.phase !== 'reward' || !this.state.reward) {
      throw new Error('not in reward phase');
    }
    submitReward(this.state, playerId, choice);
  }

  submitBoonChoice(playerId: string, boonId: string): void {
    submitBoon(this.state, playerId, boonId);
  }

  /**
   * Reorder the player's skill slots. The `order` array should contain all
   * current skillSlot card IDs in the desired new order. Allowed in reward phase.
   * Note: the build phase is the primary way to manage slots; this is a shortcut
   * for quick reordering without a full rebuild.
   */
  reorderSlots(playerId: string, order: string[]): void {
    if (this.state.phase !== 'reward') {
      throw new Error('slot reorder only available in reward phase');
    }
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player || !player.monster) throw new Error('player has no monster');
    // Build a map from card ID to slot position for non-null cards
    const nonNullSlots = player.skillSlots
      .map((c, i) => ({ c, i }))
      .filter((x): x is { c: import('./engine/types').SkillCard; i: number } => x.c !== null);
    const idToCard = new Map(nonNullSlots.map(({ c }) => [c.id, c]));
    if (order.length !== nonNullSlots.length) throw new Error('order length mismatch');
    const seen = new Set<string>();
    for (const id of order) {
      if (!idToCard.has(id) || seen.has(id)) throw new Error('invalid order');
      seen.add(id);
    }
    // Place reordered cards back into the same indices
    const positions = nonNullSlots.map(({ i }) => i);
    for (let k = 0; k < order.length; k++) {
      player.skillSlots[positions[k]!] = idToCard.get(order[k]!)!;
    }
    syncMonsterFromSlots(this.state, player);
  }

  /**
   * Rename the player's monster. Allowed any time the player has a monster and
   * the game is still running. The new name must be composed of the monster's
   * own acquired skill tags joined by `・`.
   */
  renameMonster(playerId: string, newName: string): void {
    if (this.state.phase === 'finished') {
      throw new Error('game has finished');
    }
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player?.monster) throw new Error('no monster yet');
    if (!validateMonsterName(newName, player.monster)) {
      throw new Error('name must use this monster\'s acquired skill tags');
    }
    player.monster.name = newName.trim();
  }

  // ─── Serialization ─────────────────────────────────────────────────────────

  toClientState(viewerId?: string): ClientGameState {
    const s = this.state;
    const players: ClientPlayer[] = s.players.map((p) => ({
      id: p.id,
      name: p.name,
      isCPU: p.isCPU,
      color: p.color,
      monster: p.monster,
      actionHandCount: p.actionHand.length,
    }));
    const me = viewerId ? s.players.find((p) => p.id === viewerId) : null;
    const myBoonPick = s.boonPick ? (() => {
      const myBoons = me?.monster
        ? (MONSTERS_BY_ID[me.monster.baseId]?.boons ?? null)
        : null;
      return {
        pendingPlayerIds: s.boonPick.pendingPlayerIds,
        submittedCount: Object.keys(s.boonPick.submittedChoices).length,
        myBoons: myBoons ? Array.from(myBoons) : null,
      };
    })() : null;
    return {
      roomId: s.roomId,
      players,
      monsterPick: s.monsterPick,
      boonPick: myBoonPick,
      round: s.round,
      miniRound: s.miniRound,
      totalRounds: s.totalRounds,
      miniRoundsPerRound: s.miniRoundsPerRound,
      phase: s.phase,
      packDraft: s.packDraft,
      buildPhase: s.buildPhase,
      actionPhase: s.actionPhase,
      battle: s.battle ? { matches: s.battle.matches } : null,
      reward: s.reward,
      tournament: s.tournament,
      champion: s.champion,
      eventPhaseSummary: s.eventPhaseSummary,
      actionPhaseSummary: s.actionPhaseSummary,
      myActionHand: me ? me.actionHand : null,
      myUniqueActionCard: me ? me.uniqueActionCard : null,
      mySkillStock: me ? me.skillStock : null,
      mySkillSlots: me ? me.skillSlots : null,
      myActiveSlotCount: me ? me.activeSlotCount : null,
      recentLog: s.log.slice(-80),
      deckCounts: {
        event: s.decks.event.length,
        action: s.decks.action.length,
        skill: s.decks.skill.length,
        eventGrave: s.decks.eventGrave.length,
        actionGrave: s.decks.actionGrave.length,
        skillGrave: s.decks.skillGrave.length,
      },
      publicDecks: {
        event: s.decks.event,
        eventGrave: s.decks.eventGrave,
        action: s.decks.action,
        actionGrave: s.decks.actionGrave,
        skill: s.decks.skill,
        skillGrave: s.decks.skillGrave,
      },
    };
  }

  /** Cheap key to detect "no progress" loops. */
  private snapshotKey(): string {
    const s = this.state;
    return [
      s.phase,
      s.round,
      s.miniRound,
      s.boonPick
        ? `bp:${s.boonPick.pendingPlayerIds.length}/${Object.keys(s.boonPick.submittedChoices).length}`
        : '-',
      s.monsterPick
        ? `mp:${s.monsterPick.pool.length}/${Object.keys(s.monsterPick.submittedPicks).length}/${s.monsterPick.pendingPlayerIds.length}/a${s.monsterPick.attempt}`
        : '-',
      s.packDraft
        ? `pd:${s.packDraft.passIndex}/${Object.keys(s.packDraft.submittedPicks).length}/${s.packDraft.pendingPlayerIds.length}`
        : '-',
      s.buildPhase
        ? `bp:${s.buildPhase.pendingPlayerIds.length}/${Object.keys(s.buildPhase.submittedSlots).length}`
        : '-',
      s.actionPhase
        ? `ac:${s.actionPhase.pendingPlayerIds.length}/${Object.keys(s.actionPhase.submittedPlays).length}`
        : '-',
      s.reward ? Object.keys(s.reward.choices).length : '-',
      s.tournament
        ? `tn:r${s.tournament.currentRound}/p${s.tournament.pairIdx}/b${s.tournament.bracket.length}`
        : '-',
    ].join('|');
  }
}

/**
 * For CPU-played curse_player cards: pick the opponent with the highest ATK
 * as the curse target. Returns undefined if no valid target exists.
 */
function cpuPickCurseTarget(state: GameState, selfId: string): string | undefined {
  const others = state.players.filter((p) => p.id !== selfId && p.monster);
  if (others.length === 0) return undefined;
  const target = others.sort((a, b) => (b.monster!.stats.atk) - (a.monster!.stats.atk))[0]!;
  return target.id;
}

/**
 * For CPU-played swap_actives cards: pick a random alive player with at least
 * 2 active skills as the target, then pick 2 distinct skills to swap. Returns
 * undefined if no valid target exists.
 */
function cpuPickSwapTarget(
  state: GameState,
  selfId: string,
): { targetPlayerId: string; skillIdA: string; skillIdB: string } | undefined {
  const candidates = state.players.filter(
    (p) => p.monster && p.monster.actives.length >= 2,
  );
  if (candidates.length === 0) return undefined;
  // Prefer self if eligible (predictable, no griefing); otherwise first candidate.
  const target = candidates.find((p) => p.id === selfId) ?? candidates[0]!;
  const actives = target.monster!.actives;
  return {
    targetPlayerId: target.id,
    skillIdA: actives[0]!.id,
    skillIdB: actives[1]!.id,
  };
}
