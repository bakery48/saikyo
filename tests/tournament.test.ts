import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState, pickMonster } from '../src/server/engine/state';
import { runTournament } from '../src/server/engine/phases/tournament';
import { greedyPolicy } from '../src/server/engine/policy';
import type { GameState } from '../src/server/engine/types';

function setupAtTournament(seed = 17): GameState {
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
  state.phase = 'tournament';
  state.round = 3;
  return state;
}

describe('Tournament', () => {
  let state: GameState;
  beforeEach(() => {
    state = setupAtTournament();
  });

  it('produces a single champion and finishes the game', () => {
    runTournament(state);
    expect(state.phase).toBe('finished');
    expect(state.champion).not.toBeNull();
    expect(state.champion!.playerId).toBeTypeOf('string');
  });

  it('records 7 matches for an 8-player single-elim bracket', () => {
    runTournament(state);
    expect(state.tournament!.bracket).toHaveLength(7);
    // 4 quarter, 2 semi, 1 final
    const byRound = new Map<number, number>();
    for (const m of state.tournament!.bracket) {
      byRound.set(m.round, (byRound.get(m.round) ?? 0) + 1);
    }
    expect(byRound.get(1)).toBe(4);
    expect(byRound.get(2)).toBe(2);
    expect(byRound.get(3)).toBe(1);
  });

  it('saves the champion monster as a deep copy', () => {
    runTournament(state);
    const champion = state.champion!;
    const player = state.players.find((p) => p.id === champion.playerId)!;
    // Mutate the live monster — saved champion should not change.
    const originalAtk = champion.monster.stats.atk;
    player.monster!.stats.atk += 10;
    expect(champion.monster.stats.atk).toBe(originalAtk);
  });
});
