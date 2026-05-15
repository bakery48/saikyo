import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/server/engine/state';
import { runOneRound } from '../src/server/engine/cli';
import { greedyPolicy } from '../src/server/engine/policy';
import { completeMonsterPicks } from './helpers';

describe('Full round (3 × action/event/draft)', () => {
  it('completes one round and ends in battle phase', () => {
    const state = createInitialState({
      roomId: 'demo',
      seed: 42,
      players: [{ id: 'p1', name: 'You', isCPU: false }],
    });
    completeMonsterPicks(state);
    runOneRound(state, greedyPolicy);
    expect(state.phase).toBe('battle');
    expect(state.miniRound).toBe(3);
    // Each player should have gained 3 skills (active or passive) across 3 mini-rounds.
    for (const p of state.players) {
      const acquired = p.monster!.actives.length + p.monster!.passives.length;
      expect(acquired).toBeGreaterThanOrEqual(3);
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
      completeMonsterPicks(s);
      runOneRound(s, greedyPolicy);
    }
    expect(a.players.map((p) => ({ id: p.id, stats: p.monster!.stats, actives: p.monster!.actives.length })))
      .toEqual(
        b.players.map((p) => ({ id: p.id, stats: p.monster!.stats, actives: p.monster!.actives.length })),
      );
  });
});
