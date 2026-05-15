import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../src/server/engine/state';
import { runBattlePhase } from '../src/server/engine/phases/battle';
import {
  resolveRewardPhase,
  STAT_UP_AMOUNT,
  submitReward,
} from '../src/server/engine/phases/reward';
import type { GameState } from '../src/server/engine/types';
import { completeMonsterPicks } from './helpers';

function setupAtReward(seed = 13): GameState {
  const state = createInitialState({
    roomId: 'r',
    seed,
    players: [{ id: 'p1', name: 'A', isCPU: false }],
  });
  completeMonsterPicks(state);
  state.phase = 'battle';
  runBattlePhase(state);
  return state;
}

describe('Reward phase', () => {
  let state: GameState;
  beforeEach(() => {
    state = setupAtReward();
  });

  it('applies stat_up reward by the configured amount', () => {
    const losers = state.reward!.pendingPlayerIds.slice();
    if (losers.length === 0) return; // skip if no losers
    const target = state.players.find((p) => p.id === losers[0])!;
    const beforeAtk = target.monster!.stats.atk;
    submitReward(state, target.id, { kind: 'stat_up', stat: 'atk' });
    for (const pid of losers.slice(1)) {
      submitReward(state, pid, { kind: 'skill_top' });
    }
    resolveRewardPhase(state);
    expect(target.monster!.stats.atk).toBe(beforeAtk + STAT_UP_AMOUNT.atk);
  });

  it('skill_top reward draws a card from the skill deck and adds to monster', () => {
    const losers = state.reward!.pendingPlayerIds.slice();
    if (losers.length === 0) return;
    const target = state.players.find((p) => p.id === losers[0])!;
    const before = target.monster!.actives.length + target.monster!.passives.length;
    const deckBefore = state.decks.skill.length;
    for (const pid of losers) {
      submitReward(state, pid, { kind: 'skill_top' });
    }
    resolveRewardPhase(state);
    const after = target.monster!.actives.length + target.monster!.passives.length;
    expect(after).toBe(before + 1);
    expect(state.decks.skill.length).toBeLessThanOrEqual(deckBefore);
  });

  it('advances round and resets miniRound after resolution', () => {
    const losers = state.reward!.pendingPlayerIds.slice();
    for (const pid of losers) submitReward(state, pid, { kind: 'skill_top' });
    const beforeRound = state.round;
    resolveRewardPhase(state);
    expect(state.round).toBe(beforeRound + 1);
    expect(state.miniRound).toBe(1);
    expect(state.phase).toBe('action');
    expect(state.battle).toBeNull();
    expect(state.reward).toBeNull();
  });

  it('rejects unsubmitted resolution', () => {
    const losers = state.reward!.pendingPlayerIds.slice();
    if (losers.length === 0) return;
    expect(() => resolveRewardPhase(state)).toThrow();
  });
});
