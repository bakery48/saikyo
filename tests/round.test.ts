import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/server/engine/state';
import { runOneRound } from '../src/server/engine/cli';
import { greedyPolicy } from '../src/server/engine/policy';
import { completeMonsterPicks } from './helpers';

describe('Full round (action → draft → build → event → battle)', () => {
  it('completes one round and ends in battle phase', () => {
    const state = createInitialState({
      roomId: 'demo',
      seed: 42,
      players: [{ id: 'p1', name: 'You', isCPU: false }],
    });
    completeMonsterPicks(state);
    runOneRound(state, greedyPolicy);
    expect(state.phase).toBe('battle');
    // After one round each player should have cards in skillSlots (from draft+build)
    for (const p of state.players) {
      // Either slots or stock will have cards after a round
      expect(p.skillSlots.length + p.skillStock.length).toBeGreaterThanOrEqual(1);
    }
    // Action grave: 8 players × 1 round = 8 cards
    expect(state.decks.actionGrave.length).toBe(8);
    // Event grave: 1 card per round
    expect(state.decks.eventGrave.length).toBe(1);
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
