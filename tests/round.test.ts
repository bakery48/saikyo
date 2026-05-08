import { describe, expect, it } from 'vitest';
import { createInitialState, pickMonster } from '../src/server/engine/state';
import { runOneRound } from '../src/server/engine/cli';
import { greedyPolicy } from '../src/server/engine/policy';

describe('Full round (3 × event/action/draft)', () => {
  it('completes one round and ends in battle phase', () => {
    const state = createInitialState({
      roomId: 'demo',
      seed: 42,
      players: [{ id: 'p1', name: 'You', isCPU: false }],
    });
    while (state.phase === 'pick_monster') {
      const id = state.pickOrder[state.pickIdx]!;
      const m = greedyPolicy.pickMonster(state, id, state.monsterPool);
      pickMonster(state, id, m.baseId);
    }
    runOneRound(state, greedyPolicy);
    expect(state.phase).toBe('battle');
    expect(state.miniRound).toBe(3);
    // Each player should have at least 3 active skills (one from each draft).
    for (const p of state.players) {
      expect(p.monster!.actives.length).toBeGreaterThanOrEqual(3);
    }
    // Some action grave should have entries (8 players * 3 mini-rounds).
    expect(state.decks.actionGrave.length).toBe(24);
    // Event grave: 3 cards.
    expect(state.decks.eventGrave.length).toBe(3);
  });

  it('is deterministic with the same seed', () => {
    const a = createInitialState({
      roomId: 'd',
      seed: 7,
      players: [{ id: 'p1', name: 'A', isCPU: false }],
    });
    const b = createInitialState({
      roomId: 'd',
      seed: 7,
      players: [{ id: 'p1', name: 'A', isCPU: false }],
    });
    for (const s of [a, b]) {
      while (s.phase === 'pick_monster') {
        const id = s.pickOrder[s.pickIdx]!;
        const m = greedyPolicy.pickMonster(s, id, s.monsterPool);
        pickMonster(s, id, m.baseId);
      }
      runOneRound(s, greedyPolicy);
    }
    expect(a.players.map((p) => ({ id: p.id, stats: p.monster!.stats, actives: p.monster!.actives.length })))
      .toEqual(
        b.players.map((p) => ({ id: p.id, stats: p.monster!.stats, actives: p.monster!.actives.length })),
      );
  });
});
