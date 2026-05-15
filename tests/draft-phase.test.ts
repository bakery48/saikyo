import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../src/server/engine/state';
import {
  startDraft,
  submitDraftPick,
  resolveDraftSubRound,
  allDraftPicksIn,
} from '../src/server/engine/phases/draft';
import type { GameState, Monster } from '../src/server/engine/types';
import { completeMonsterPicks } from './helpers';

function setupAtDraft(seed = 30): GameState {
  const state = createInitialState({
    roomId: 'r',
    seed,
    players: [{ id: 'p1', name: 'A', isCPU: false }],
  });
  completeMonsterPicks(state);
  state.phase = 'draft';
  return state;
}

const totalSkills = (m: Monster): number => m.actives.length + m.passives.length;

function snapshotSkillCounts(state: GameState): Record<string, number> {
  return Object.fromEntries(state.players.map((p) => [p.id, totalSkills(p.monster!)]));
}

describe('Draft phase', () => {
  let state: GameState;
  beforeEach(() => {
    state = setupAtDraft();
  });

  it('reveals 8 cards into pool', () => {
    startDraft(state);
    expect(state.draft).not.toBeNull();
    expect(state.draft!.pool).toHaveLength(8);
    expect(state.draft!.pendingPlayerIds).toHaveLength(8);
  });

  it('happy path: each player picks a unique card and all are resolved in one round', () => {
    const before = snapshotSkillCounts(state);
    startDraft(state);
    const players = state.draft!.pendingPlayerIds.slice();
    const pool = state.draft!.pool;
    players.forEach((pid, i) => submitDraftPick(state, pid, pool[i]!.id));
    expect(allDraftPicksIn(state)).toBe(true);
    const finished = resolveDraftSubRound(state);
    expect(finished).toBe(true);
    expect(state.draft).toBeNull();
    expect(['action', 'battle']).toContain(state.phase);
    // Each player gained exactly 1 skill (active or passive).
    for (const p of state.players) {
      expect(totalSkills(p.monster!)).toBe(before[p.id]! + 1);
    }
  });

  it('conflict: two players picking the same card go to a re-draft', () => {
    const before = snapshotSkillCounts(state);
    startDraft(state);
    const draft = state.draft!;
    const players = draft.pendingPlayerIds.slice();
    const pool = draft.pool;
    submitDraftPick(state, players[0]!, pool[0]!.id);
    submitDraftPick(state, players[1]!, pool[0]!.id);
    for (let i = 2; i < players.length; i++) {
      submitDraftPick(state, players[i]!, pool[i]!.id);
    }
    expect(resolveDraftSubRound(state)).toBe(false);
    expect(state.draft!.pendingPlayerIds.sort()).toEqual([players[0], players[1]].sort());
    const nonConflict = players.filter((p) => p !== players[0] && p !== players[1]);
    for (const pid of nonConflict) {
      const p = state.players.find((x) => x.id === pid)!;
      expect(totalSkills(p.monster!)).toBe(before[pid]! + 1);
    }
    // Conflicting players have not received yet.
    for (const pid of [players[0]!, players[1]!]) {
      const p = state.players.find((x) => x.id === pid)!;
      expect(totalSkills(p.monster!)).toBe(before[pid]!);
    }
  });

  it('after a conflict, the colliding card stays in the pool for the re-pick', () => {
    const before = snapshotSkillCounts(state);
    startDraft(state);
    const draft = state.draft!;
    const players = draft.pendingPlayerIds.slice();
    const pool = draft.pool;
    const conflictCardId = pool[0]!.id;
    submitDraftPick(state, players[0]!, conflictCardId);
    submitDraftPick(state, players[1]!, conflictCardId);
    for (let i = 2; i < players.length; i++) {
      submitDraftPick(state, players[i]!, pool[i]!.id);
    }
    expect(resolveDraftSubRound(state)).toBe(false);
    expect(state.draft!.pendingPlayerIds).toHaveLength(2);
    // Conflict card stays available; the only untouched card (pool[1]) also stays.
    expect(state.draft!.pool.some((c) => c.id === conflictCardId)).toBe(true);
    expect(state.draft!.pool.length).toBe(2);
    // p0 takes the previously-conflicted card alone, p1 takes the other.
    const otherCard = state.draft!.pool.find((c) => c.id !== conflictCardId)!.id;
    submitDraftPick(state, players[0]!, conflictCardId);
    submitDraftPick(state, players[1]!, otherCard);
    expect(resolveDraftSubRound(state)).toBe(true);
    expect(state.draft).toBeNull();
    for (const pid of [players[0]!, players[1]!]) {
      const p = state.players.find((x) => x.id === pid)!;
      expect(totalSkills(p.monster!)).toBe(before[pid]! + 1);
    }
  });

  it('all players collide every round: eventually terminates with everyone holding a card', () => {
    const before = snapshotSkillCounts(state);
    startDraft(state);
    let iterations = 0;
    while (state.draft) {
      for (const pid of state.draft.pendingPlayerIds) {
        submitDraftPick(state, pid, state.draft.pool[0]!.id);
      }
      resolveDraftSubRound(state);
      iterations++;
      if (iterations > 20) throw new Error('draft did not terminate');
    }
    for (const p of state.players) {
      expect(totalSkills(p.monster!)).toBeGreaterThanOrEqual(before[p.id]! + 1);
    }
  });
});
