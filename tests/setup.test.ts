import { describe, expect, it } from 'vitest';
import { createInitialState, submitMonsterPick } from '../src/server/engine/state';
import { PLAYER_COLORS } from '../src/server/engine/types';
import { completeMonsterPicks } from './helpers';

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

  it('reveals 8 unique monsters in the initial pick draft', () => {
    const state = createInitialState({
      roomId: 'r1',
      seed: 1,
      players: [{ id: 'p1', name: 'A', isCPU: false }],
    });
    expect(state.monsterPick).not.toBeNull();
    expect(state.monsterPick!.pool).toHaveLength(8);
    const ids = new Set(state.monsterPick!.pool.map((m) => m.baseId));
    expect(ids.size).toBe(8);
  });

  it('assigns each player a distinct color from PLAYER_COLORS', () => {
    const state = createInitialState({
      roomId: 'r1',
      seed: 7,
      players: [{ id: 'p1', name: 'A', isCPU: false }],
    });
    const colors = state.players.map((p) => p.color);
    expect(new Set(colors).size).toBe(8);
    for (const c of colors) expect(PLAYER_COLORS).toContain(c);
  });

  it('rejects 9+ humans', () => {
    expect(() =>
      createInitialState({
        roomId: 'r1',
        seed: 1,
        players: Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isCPU: false })),
      }),
    ).toThrow();
  });

  it('allows 0 humans (all CPU room) for testing', () => {
    const state = createInitialState({ roomId: 'r1', seed: 1, players: [] });
    expect(state.players).toHaveLength(8);
    expect(state.players.every((p) => p.isCPU)).toBe(true);
  });

  it('progresses to event phase once every player has a monster', () => {
    const state = createInitialState({
      roomId: 'r1',
      seed: 1,
      players: [{ id: 'p1', name: 'A', isCPU: false }],
    });
    expect(state.phase).toBe('pick_monster');
    completeMonsterPicks(state);
    expect(state.phase).toBe('event');
    expect(state.players.every((p) => p.monster)).toBe(true);
    expect(state.monsterPick).toBeNull();
  });

  it('rejects picks from a player who is not pending', () => {
    const state = createInitialState({
      roomId: 'r1',
      seed: 1,
      players: [{ id: 'p1', name: 'A', isCPU: false }],
    });
    submitMonsterPick(state, 'p1', state.monsterPick!.pool[0]!.baseId);
    // Resubmitting throws since the pick is already recorded — pendingPlayerIds
    // still includes p1 here but we reject duplicates? Actually, the engine
    // overwrites the pick. To exercise the rejection path, try a non-existent
    // player.
    expect(() => submitMonsterPick(state, 'unknown-player', state.monsterPick!.pool[0]!.baseId)).toThrow(/pending/);
  });
});
