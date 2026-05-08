import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState, pickMonster } from '../src/server/engine/state';
import { resolveActionPhase } from '../src/server/engine/phases/action';
import { greedyPolicy } from '../src/server/engine/policy';
import type { GameState } from '../src/server/engine/types';

function setupAtAction(seed = 2): GameState {
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
  // Skip event by switching directly.
  state.phase = 'action';
  return state;
}

describe('Action phase', () => {
  let state: GameState;
  beforeEach(() => {
    state = setupAtAction();
  });

  it('every player draws and plays one card, then advances to draft', () => {
    const beforeDeck = state.decks.action.length;
    resolveActionPhase(state);
    expect(state.phase).toBe('draft');
    // 8 players draw 1 each.
    expect(beforeDeck - state.decks.action.length).toBe(8);
    expect(state.decks.actionGrave.length).toBe(8);
    const playedCount = state.log.filter((e) => e.kind === 'action_played').length;
    expect(playedCount).toBe(8);
  });

  it('permanent stat_mod modifies the monster base stats immediately', () => {
    const target = state.players[0]!;
    // Force ac-005 (permanent ATK +1) to top of action deck.
    const card = state.decks.action.find((c) => c.id === 'ac-005');
    if (card) {
      state.decks.action = [card, ...state.decks.action.filter((c) => c.id !== 'ac-005')];
    }
    // Make our target the first to act by reshuffling pickOrder.
    state.pickOrder = [target.id, ...state.pickOrder.filter((id) => id !== target.id)];
    const beforeAtk = target.monster!.stats.atk;
    resolveActionPhase(state);
    expect(target.monster!.stats.atk).toBe(beforeAtk + 1);
  });

  it('next_battle stat_mod queues a pending buff', () => {
    const target = state.players[0]!;
    const card = state.decks.action.find((c) => c.id === 'ac-001'); // ATK +2 next_battle
    if (card) {
      state.decks.action = [card, ...state.decks.action.filter((c) => c.id !== 'ac-001')];
    }
    state.pickOrder = [target.id, ...state.pickOrder.filter((id) => id !== target.id)];
    resolveActionPhase(state);
    expect(target.pendingBuffs.length).toBeGreaterThan(0);
    const buff = target.pendingBuffs[0]!;
    expect(buff.stat).toBe('atk');
    expect(buff.amount).toBe(2);
    expect(buff.duration).toBe('next_battle');
  });

  it('draw_skill_top adds a skill to the player monster', () => {
    const target = state.players[0]!;
    const card = state.decks.action.find((c) => c.id === 'ac-010'); // 探索 = draw skill top
    if (card) {
      state.decks.action = [card, ...state.decks.action.filter((c) => c.id !== 'ac-010')];
    }
    state.pickOrder = [target.id, ...state.pickOrder.filter((id) => id !== target.id)];
    const before = target.monster!.actives.length + target.monster!.passives.length;
    resolveActionPhase(state);
    const after = target.monster!.actives.length + target.monster!.passives.length;
    expect(after).toBe(before + 1);
  });
});
