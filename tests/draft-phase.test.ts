import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState, pickMonster } from '../src/server/engine/state';
import {
  startDraft,
  submitDraftPick,
  resolveDraftSubRound,
  allDraftPicksIn,
} from '../src/server/engine/phases/draft';
import { greedyPolicy } from '../src/server/engine/policy';
import type { GameState, Monster } from '../src/server/engine/types';

function setupAtDraft(seed = 3): GameState {
  const state = createInitialState({
    roomId: 'r',
    seed,
    players: [{ id: 'p1', name: 'A', isCPU: false }],
  });
  while (state.phase === 'pick_monster') {
    const id = state.pickOrder[state.pickIdx]!;
    const m = greedyPolicy.pickMonster(state, id, state.monsterPool);
    pickMonster(state, id, m.baseId);
  }
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
    expect(['event', 'battle']).toContain(state.phase);
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

  it('after a conflict, re-pick continues; fallback ensures everyone gets a card', () => {
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
    expect(state.draft!.pendingPlayerIds).toHaveLength(2);
    expect(state.draft!.pool.length).toBe(1);
    const remaining = state.draft!.pool[0]!.id;
    submitDraftPick(state, players[0]!, remaining);
    submitDraftPick(state, players[1]!, remaining);
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
