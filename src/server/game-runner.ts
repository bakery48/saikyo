import type { ClientGameState, ClientPlayer } from '../shared/messages';
import type { GameState, RewardChoice, StatKey } from './engine/types';
import {
  allMonsterPicksIn,
  createInitialState,
  resolveMonsterPickSubRound,
  submitMonsterPick,
} from './engine/state';
import { resolveEventPhase } from './engine/phases/event';
import {
  startActionPhase,
  submitActionPlay,
  resolveActionPhase,
  allActionPlaysIn,
} from './engine/phases/action';
import {
  startDraft,
  submitDraftPick,
  resolveDraftSubRound,
} from './engine/phases/draft';
import { runBattlePhase } from './engine/phases/battle';
import { resolveRewardPhase, submitReward } from './engine/phases/reward';
import { runTournament } from './engine/phases/tournament';
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

  constructor(opts: {
    roomId: string;
    seed: number;
    humans: { id: string; name: string }[];
    pauseOnReveal?: boolean;
    yieldForAnimation?: boolean;
    totalRounds?: number;
    miniRoundsPerRound?: number;
  }) {
    this.seed = opts.seed;
    this.state = createInitialState({
      roomId: opts.roomId,
      seed: opts.seed,
      players: opts.humans.map((h) => ({ id: h.id, name: h.name, isCPU: false })),
      totalRounds: opts.totalRounds,
      miniRoundsPerRound: opts.miniRoundsPerRound,
    });
    this.humanIds = new Set(opts.humans.map((h) => h.id));
    this.pauseOnReveal = opts.pauseOnReveal ?? false;
    this.yieldForAnimation = opts.yieldForAnimation ?? false;
  }

  isHuman(playerId: string): boolean {
    return this.humanIds.has(playerId);
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
      if (battleResolvedNow) this.battleResolvedSinceConsume = true;
      if (eventResolvedNow) this.eventResolvedSinceConsume = true;
      if (actionResolvedNow) this.actionResolvedSinceConsume = true;
      if (waiting || this.state.phase === 'finished') return;
      // Yield to the ws layer right after a phase that needs an animation —
      // otherwise the next step (e.g. resolveRewardPhase) clears state.battle
      // before the client gets a chance to render the battle log.
      if (this.yieldForAnimation && (battleResolvedNow || eventResolvedNow || actionResolvedNow)) {
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

  /** Returns true if the runner is now waiting on a human action. */
  private step(): boolean {
    switch (this.state.phase) {
      case 'pick_monster':
        return this.stepMonsterPick();
      case 'event':
        resolveEventPhase(this.state);
        return false;
      case 'action':
        return this.stepAction();
      case 'draft':
        return this.stepDraft();
      case 'battle':
        runBattlePhase(this.state);
        return false;
      case 'reward':
        return this.stepReward();
      case 'tournament':
        runTournament(this.state);
        return false;
      case 'finished':
        return true;
      case 'setup':
        return true;
    }
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
    if (!this.state.draft) {
      startDraft(this.state);
      // startDraft may end the phase entirely if pool is empty.
      return false;
    }
    const draft = this.state.draft;
    if (draft.revealing) return true; // ws layer is showing the reveal
    let waiting = false;
    for (const pid of draft.pendingPlayerIds) {
      if (draft.submittedPicks[pid]) continue;
      if (this.isHuman(pid)) {
        waiting = true;
      } else {
        const card = greedyPolicy.pickDraftCard(this.state, pid, draft.pool);
        submitDraftPick(this.state, pid, card.id);
      }
    }
    if (waiting) return true;
    if (this.pauseOnReveal && draft.pendingPlayerIds.length > 0) {
      draft.revealing = true;
      return true;
    }
    resolveDraftSubRound(this.state);
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
        if (!player || player.actionHand.length === 0) {
          // No card to play (shouldn't happen) — skip the player.
          phase.pendingPlayerIds = phase.pendingPlayerIds.filter((x) => x !== pid);
          continue;
        }
        const card = greedyPolicy.pickActionCard(this.state, pid, player.actionHand);
        const chosenStat =
          card.effect.kind === 'stat_mod_choice' && player.monster
            ? chooseStatForActionCard(player.monster.stats)
            : undefined;
        const swap =
          card.effect.kind === 'swap_actives'
            ? cpuPickSwapTarget(this.state, pid)
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
        submitActionPlay(this.state, pid, card.id, { chosenStat, swap });
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
    if (this.state.phase !== 'draft' || !this.state.draft) return;
    const draft = this.state.draft;
    if (!draft.pendingPlayerIds.every((id) => !!draft.submittedPicks[id])) return;
    resolveDraftSubRound(this.state);
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

  submitDraft(playerId: string, skillId: string): void {
    if (this.state.phase !== 'draft' || !this.state.draft) {
      throw new Error('not in draft phase');
    }
    submitDraftPick(this.state, playerId, skillId);
  }

  submitAction(
    playerId: string,
    cardId: string,
    extras?: { chosenStat?: StatKey; swap?: { targetPlayerId: string; skillIdA: string; skillIdB: string } },
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
    return {
      roomId: s.roomId,
      players,
      monsterPick: s.monsterPick,
      round: s.round,
      miniRound: s.miniRound,
      totalRounds: s.totalRounds,
      miniRoundsPerRound: s.miniRoundsPerRound,
      phase: s.phase,
      draft: s.draft,
      actionPhase: s.actionPhase,
      battle: s.battle ? { matches: s.battle.matches } : null,
      reward: s.reward,
      tournament: s.tournament,
      champion: s.champion,
      eventPhaseSummary: s.eventPhaseSummary,
      actionPhaseSummary: s.actionPhaseSummary,
      myActionHand: me ? me.actionHand : null,
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
      s.monsterPick
        ? `mp:${s.monsterPick.pool.length}/${Object.keys(s.monsterPick.submittedPicks).length}/${s.monsterPick.pendingPlayerIds.length}/a${s.monsterPick.attempt}`
        : '-',
      s.draft
        ? `dr:${s.draft.pool.length}/${Object.keys(s.draft.submittedPicks).length}/a${s.draft.attempt}`
        : '-',
      s.actionPhase
        ? `ap:${s.actionPhase.pendingPlayerIds.length}/${Object.keys(s.actionPhase.submittedPlays).length}`
        : '-',
      s.reward ? Object.keys(s.reward.choices).length : '-',
    ].join('|');
  }
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
