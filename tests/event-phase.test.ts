import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState, pickMonster } from '../src/server/engine/state';
import { resolveEventPhase } from '../src/server/engine/phases/event';
import { greedyPolicy } from '../src/server/engine/policy';
import type { GameState } from '../src/server/engine/types';

function setupReady(seed = 1): GameState {
  const state = createInitialState({
    roomId: 'r',
    seed,
    players: [{ id: 'p1', name: 'A', isCPU: false }],
  });
  while (state.phase === 'pick_monster') {
    const playerId = state.pickOrder[state.pickIdx]!;
    const m = greedyPolicy.pickMonster(state, playerId, state.monsterPool);
    pickMonster(state, playerId, m.baseId);
  }
  return state;
}

describe('Event phase', () => {
  let state: GameState;
  beforeEach(() => {
    state = setupReady();
  });

  it('moves to action phase after resolving', () => {
    expect(state.phase).toBe('event');
    resolveEventPhase(state);
    expect(state.phase).toBe('action');
  });

  it('moves the played card to graveyard', () => {
    const beforeDeckSize = state.decks.event.length;
    resolveEventPhase(state);
    expect(state.decks.event.length).toBe(beforeDeckSize - 1);
    expect(state.decks.eventGrave.length).toBe(1);
  });

  it('logs the event with at least one target', () => {
    resolveEventPhase(state);
    const ev = state.log.find((e) => e.kind === 'event_played');
    expect(ev).toBeDefined();
    if (ev?.kind === 'event_played') {
      expect(ev.targets.length).toBeGreaterThan(0);
    }
  });

  it('"all" target affects every player', () => {
    // Force the next event card to a known "all/heal +3" by injecting the deck top.
    const allHeal = state.decks.event.find((c) => c.id === 'ev-001');
    if (allHeal) {
      state.decks.event = [allHeal, ...state.decks.event.filter((c) => c.id !== 'ev-001')];
    }
    const before = state.players.map((p) => p.monster!.stats.hp);
    resolveEventPhase(state);
    const after = state.players.map((p) => p.monster!.stats.hp);
    for (let i = 0; i < before.length; i++) {
      expect(after[i]!).toBe(before[i]! + 3);
    }
  });

  it('"lowestHp" target only affects the lowest-HP player', () => {
    // Make one player clearly lowest by mutating HP, then queue a known card.
    state.players[0]!.monster!.stats.hp = 5;
    const target = state.players[0]!.id;
    const card = state.decks.event.find((c) => c.id === 'ev-019'); // 逆転の女神 lowestHp +6
    if (card) {
      state.decks.event = [card, ...state.decks.event.filter((c) => c.id !== 'ev-019')];
    }
    resolveEventPhase(state);
    const ev = state.log.find((e) => e.kind === 'event_played');
    if (ev?.kind === 'event_played') {
      expect(ev.targets).toEqual([target]);
    }
    expect(state.players[0]!.monster!.stats.hp).toBe(11);
  });
});
