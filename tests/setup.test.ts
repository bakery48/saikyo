import { describe, expect, it } from 'vitest';
import { createInitialState, pickMonster } from '../src/server/engine/state';
import { greedyPolicy } from '../src/server/engine/policy';

describe('Game setup', () => {
  it('pads to 8 players with CPUs', () => {
    const state = createInitialState({
      roomId: 'r1',
      seed: 1,
      players: [
        { id: 'p1', name: 'A', isCPU: false },
        { id: 'p2', name: 'B', isCPU: false },
      ],
    });
    expect(state.players).toHaveLength(8);
    expect(state.players.filter((p) => p.isCPU)).toHaveLength(6);
  });

  it('shuffles 8 monsters into the pool', () => {
    const state = createInitialState({
      roomId: 'r1',
      seed: 1,
      players: [{ id: 'p1', name: 'A', isCPU: false }],
    });
    expect(state.monsterPool).toHaveLength(8);
    const ids = new Set(state.monsterPool.map((m) => m.baseId));
    expect(ids.size).toBe(8);
  });

  it('rejects 0 or 9+ humans', () => {
    expect(() =>
      createInitialState({ roomId: 'r1', seed: 1, players: [] }),
    ).toThrow();
    expect(() =>
      createInitialState({
        roomId: 'r1',
        seed: 1,
        players: Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isCPU: false })),
      }),
    ).toThrow();
  });

  it('progresses to event phase after all monsters picked', () => {
    const state = createInitialState({
      roomId: 'r1',
      seed: 1,
      players: [{ id: 'p1', name: 'A', isCPU: false }],
    });
    expect(state.phase).toBe('pick_monster');
    while (state.phase === 'pick_monster') {
      const playerId = state.pickOrder[state.pickIdx]!;
      const baseMon = greedyPolicy.pickMonster(state, playerId, state.monsterPool);
      pickMonster(state, playerId, baseMon.baseId);
    }
    expect(state.phase).toBe('event');
    expect(state.players.every((p) => p.monster)).toBe(true);
    expect(state.monsterPool).toHaveLength(0);
  });

  it('rejects out-of-turn picks', () => {
    const state = createInitialState({
      roomId: 'r1',
      seed: 1,
      players: [{ id: 'p1', name: 'A', isCPU: false }],
    });
    const wrongPlayer = state.pickOrder[1]!; // not first in order
    expect(() =>
      pickMonster(state, wrongPlayer, state.monsterPool[0]!.baseId),
    ).toThrow(/your turn/);
  });
});
