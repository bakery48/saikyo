import type { ClientGameState, ClientPlayer } from '../shared/messages';
import type { GameState, RewardChoice } from './engine/types';
import { createInitialState, pickMonster } from './engine/state';
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

  constructor(opts: {
    roomId: string;
    seed: number;
    humans: { id: string; name: string }[];
  }) {
    this.seed = opts.seed;
    this.state = createInitialState({
      roomId: opts.roomId,
      seed: opts.seed,
      players: opts.humans.map((h) => ({ id: h.id, name: h.name, isCPU: false })),
    });
    this.humanIds = new Set(opts.humans.map((h) => h.id));
  }

  isHuman(playerId: string): boolean {
    return this.humanIds.has(playerId);
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
      case 'pick_monster': {
        const currentId = this.state.pickOrder[this.state.pickIdx]!;
        if (this.isHuman(currentId)) return true;
        const m = greedyPolicy.pickMonster(this.state, currentId, this.state.monsterPool);
        pickMonster(this.state, currentId, m.baseId);
        return false;
      }
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

  private stepDraft(): boolean {
    if (!this.state.draft) {
      startDraft(this.state);
      // startDraft may end the phase entirely if pool is empty.
      return false;
    }
    const draft = this.state.draft;
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

  // ─── Human-driven actions ──────────────────────────────────────────────────

  submitPick(playerId: string, baseId: string): void {
    if (this.state.phase !== 'pick_monster') {
      throw new Error('not in monster pick phase');
    }
    const expected = this.state.pickOrder[this.state.pickIdx];
    if (expected !== playerId) throw new Error('not your turn');
    pickMonster(this.state, playerId, baseId);
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
      monster: p.monster,
      pendingBuffsCount: p.pendingBuffs.length,
    }));
    return {
      roomId: s.roomId,
      players,
      monsterPool: s.monsterPool,
      pickOrder: s.pickOrder,
      pickIdx: s.pickIdx,
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
      s.pickIdx,
      s.draft ? `${s.draft.pool.length}/${Object.keys(s.draft.submittedPicks).length}` : '-',
      s.reward ? Object.keys(s.reward.choices).length : '-',
    ].join('|');
  }
}
