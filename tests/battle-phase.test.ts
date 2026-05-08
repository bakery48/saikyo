import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState, pickMonster } from '../src/server/engine/state';
import { runBattlePhase, snapshotMonsterForBattle } from '../src/server/engine/phases/battle';
import { greedyPolicy } from '../src/server/engine/policy';
import type { GameState } from '../src/server/engine/types';

function setupAtBattle(seed = 11): GameState {
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
  // Skip directly to battle phase for unit testing.
  state.phase = 'battle';
  return state;
}

describe('Battle phase', () => {
  let state: GameState;
  beforeEach(() => {
    state = setupAtBattle();
  });

  it('produces 4 matches for 8 players and transitions to reward', () => {
    runBattlePhase(state);
    expect(state.battle).not.toBeNull();
    expect(state.battle!.matches).toHaveLength(4);
    expect(state.phase).toBe('reward');
    // Every player should appear in exactly one match.
    const seen = new Set<string>();
    for (const m of state.battle!.matches) {
      seen.add(m.a);
      seen.add(m.b);
    }
    expect(seen.size).toBe(8);
  });

  it('losers are added to reward.pendingPlayerIds (or fewer on draws)', () => {
    runBattlePhase(state);
    const matches = state.battle!.matches;
    const expectedLosers = matches.filter((m) => m.winner !== 'draw').length;
    expect(state.reward!.pendingPlayerIds.length).toBe(expectedLosers);
  });

  it('snapshotMonsterForBattle consumes next_battle pendingBuffs', () => {
    const player = state.players[0]!;
    player.pendingBuffs.push({ stat: 'atk', amount: 3, duration: 'next_battle' });
    const original = player.monster!.stats.atk;
    const snap = snapshotMonsterForBattle(player);
    expect(snap.stats.atk).toBe(original + 3);
    // Original monster stats untouched.
    expect(player.monster!.stats.atk).toBe(original);
    // Pending buff consumed.
    expect(player.pendingBuffs).toHaveLength(0);
  });
});
