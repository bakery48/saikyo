import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/server/engine/state';
import { runFullGame } from '../src/server/engine/cli';
import { greedyPolicy } from '../src/server/engine/policy';

describe('Full game (8 CPUs)', () => {
  it('completes from setup to finished with a champion', () => {
    const state = createInitialState({
      roomId: 'demo',
      seed: 100,
      players: [{ id: 'p1', name: 'You', isCPU: false }],
    });
    runFullGame(state, greedyPolicy);
    expect(state.phase).toBe('finished');
    expect(state.champion).not.toBeNull();
    // Round counter advances to 3 (final big round).
    expect(state.round).toBe(3);
    // Bracket fully resolved.
    expect(state.tournament!.bracket).toHaveLength(7);
  });

  it('is deterministic given a seed', () => {
    const a = createInitialState({
      roomId: 'd',
      seed: 999,
      players: [{ id: 'p1', name: 'A', isCPU: false }],
    });
    const b = createInitialState({
      roomId: 'd',
      seed: 999,
      players: [{ id: 'p1', name: 'A', isCPU: false }],
    });
    runFullGame(a, greedyPolicy);
    runFullGame(b, greedyPolicy);
    expect(a.champion!.playerId).toBe(b.champion!.playerId);
    expect(a.champion!.monster.baseId).toBe(b.champion!.monster.baseId);
  });

  it('different seeds produce varied champions', () => {
    const champions = new Set<string>();
    for (const seed of [1, 2, 3, 5, 7, 11, 13, 17]) {
      const state = createInitialState({
        roomId: 'd',
        seed,
        players: [{ id: 'p1', name: 'A', isCPU: false }],
      });
      runFullGame(state, greedyPolicy);
      champions.add(state.champion!.monster.baseId);
    }
    // With 8 different seeds we should see at least two distinct champion species.
    expect(champions.size).toBeGreaterThan(1);
  });
});
