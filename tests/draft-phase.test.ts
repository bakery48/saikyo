import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState, pickMonster } from '../src/server/engine/state';
import {
  startDraft,
  submitDraftPick,
  resolveDraftSubRound,
  allDraftPicksIn,
} from '../src/server/engine/phases/draft';
import { greedyPolicy } from '../src/server/engine/policy';
import type { GameState } from '../src/server/engine/types';

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
    startDraft(state);
    const players = state.draft!.pendingPlayerIds.slice();
    const pool = state.draft!.pool;
    players.forEach((pid, i) => submitDraftPick(state, pid, pool[i]!.id));
    expect(allDraftPicksIn(state)).toBe(true);
    const finished = resolveDraftSubRound(state);
    expect(finished).toBe(true);
    expect(state.draft).toBeNull();
    // Phase should advance to event (next mini-round) or battle when miniRound = 3.
    expect(['event', 'battle']).toContain(state.phase);
    // Each player got exactly 1 active skill.
    for (const p of state.players) {
      expect(p.monster!.actives.length).toBe(1);
    }
  });

  it('conflict: two players picking the same card go to a re-draft', () => {
    startDraft(state);
    const draft = state.draft!;
    const players = draft.pendingPlayerIds.slice();
    const pool = draft.pool;
    // First two players pick the same card, others all unique.
    submitDraftPick(state, players[0]!, pool[0]!.id);
    submitDraftPick(state, players[1]!, pool[0]!.id); // conflict
    for (let i = 2; i < players.length; i++) {
      submitDraftPick(state, players[i]!, pool[i]!.id);
    }
    const finished = resolveDraftSubRound(state);
    expect(finished).toBe(false);
    // The two conflicting players are now pending.
    expect(state.draft!.pendingPlayerIds.sort()).toEqual([players[0], players[1]].sort());
    // Other 6 players got their cards.
    const nonConflict = players.filter((p) => p !== players[0] && p !== players[1]);
    for (const pid of nonConflict) {
      const p = state.players.find((x) => x.id === pid)!;
      expect(p.monster!.actives.length).toBe(1);
    }
    // Conflicting players have not received yet.
    expect(
      state.players.find((p) => p.id === players[0])!.monster!.actives.length,
    ).toBe(0);
  });

  it('after a conflict, re-pick continues; fallback ensures everyone gets a card', () => {
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
    // Now have 2 pending players and a 1-card re-draft pool.
    expect(state.draft!.pendingPlayerIds).toHaveLength(2);
    expect(state.draft!.pool.length).toBe(1);
    const remaining = state.draft!.pool[0]!.id;
    // Both must pick the only available card -> they conflict again -> fallback.
    submitDraftPick(state, players[0]!, remaining);
    submitDraftPick(state, players[1]!, remaining);
    expect(resolveDraftSubRound(state)).toBe(true);
    expect(state.draft).toBeNull();
    expect(state.players.find((p) => p.id === players[0])!.monster!.actives.length).toBe(1);
    expect(state.players.find((p) => p.id === players[1])!.monster!.actives.length).toBe(1);
  });

  it('all players collide every round: eventually terminates with everyone holding a card', () => {
    startDraft(state);
    // Repeatedly have everyone pick the same card -> conflict every round.
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
      expect(p.monster!.actives.length).toBeGreaterThanOrEqual(1);
    }
  });
});
