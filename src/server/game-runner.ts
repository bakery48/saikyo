import type { ClientGameState, ClientPlayer } from '../shared/messages';
import type { GameState, RewardChoice } from './engine/types';
import {
  allMonsterPicksIn,
  createInitialState,
  resolveMonsterPickSubRound,
  submitMonsterPick,
} from './engine/state';
import { resolveEventPhase } from './engine/phases/event';
import { resolveActionPhase } from './engine/phases/action';
import {
  startDraft,
  submitDraftPick,
  resolveDraftSubRound,
} from './engine/phases/draft';
import { runBattlePhase } from './engine/phases/battle';
import { resolveRewardPhase, submitReward } from './engine/phases/reward';
import { runTournament } from './engine/phases/tournament';
import { greedyPolicy } from './engine/policy';
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

  constructor(opts: {
    roomId: string;
    seed: number;
    humans: { id: string; name: string }[];
    pauseOnReveal?: boolean;
  }) {
    this.seed = opts.seed;
    this.state = createInitialState({
      roomId: opts.roomId,
      seed: opts.seed,
      players: opts.humans.map((h) => ({ id: h.id, name: h.name, isCPU: false })),
    });
    this.humanIds = new Set(opts.humans.map((h) => h.id));
    this.pauseOnReveal = opts.pauseOnReveal ?? false;
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
      const waiting = this.step();
      if (waiting || this.state.phase === 'finished') return;
      if (this.snapshotKey() === before) {
        // No progress made; bail to avoid infinite loop.
        return;
      }
    }
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
        resolveActionPhase(this.state);
        return false;
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

  toClientState(): ClientGameState {
    const s = this.state;
    const players: ClientPlayer[] = s.players.map((p) => ({
      id: p.id,
      name: p.name,
      isCPU: p.isCPU,
      color: p.color,
      monster: p.monster,
      pendingBuffsCount: p.pendingBuffs.length,
    }));
    return {
      roomId: s.roomId,
      players,
      monsterPick: s.monsterPick,
      round: s.round,
      miniRound: s.miniRound,
      phase: s.phase,
      draft: s.draft,
      battle: s.battle ? { matches: s.battle.matches } : null,
      reward: s.reward,
      tournament: s.tournament,
      champion: s.champion,
      recentLog: s.log.slice(-80),
      deckCounts: {
        event: s.decks.event.length,
        action: s.decks.action.length,
        skill: s.decks.skill.length,
        eventGrave: s.decks.eventGrave.length,
        actionGrave: s.decks.actionGrave.length,
        skillGrave: s.decks.skillGrave.length,
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
      s.reward ? Object.keys(s.reward.choices).length : '-',
    ].join('|');
  }
}
