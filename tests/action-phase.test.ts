import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../src/server/engine/state';
import {
  startActionPhase,
  submitActionPlay,
  resolveActionPhase,
} from '../src/server/engine/phases/action';
import type { ActionCard, GameState, Player } from '../src/server/engine/types';
import { ACTIONS } from '../src/server/engine/cards/actions';
import { completeMonsterPicks } from './helpers';

function setupAtAction(seed = 2): GameState {
  const state = createInitialState({
    roomId: 'r',
    seed,
    players: [{ id: 'p1', name: 'A', isCPU: false }],
  });
  completeMonsterPicks(state);
  state.phase = 'action';
  return state;
}

/** Force a specific card into a player's hand (replaces hand[0]). */
function forceCardInHand(state: GameState, player: Player, cardId: string): ActionCard {
  const card = ACTIONS.find((c) => c.id === cardId);
  if (!card) throw new Error(`unknown card ${cardId}`);
  const replacement = { ...card };
  if (player.actionHand.length === 0) player.actionHand.push(replacement);
  else player.actionHand[0] = replacement;
  return replacement;
}

/** Submit player[0]'s chosen card and submit the rest's first hand card. */
function playAll(state: GameState, targetPlayerId: string, targetCardId: string): void {
  submitActionPlay(state, targetPlayerId, targetCardId);
  for (const p of state.players) {
    if (p.id === targetPlayerId) continue;
    if (p.actionHand.length === 0) continue;
    submitActionPlay(state, p.id, p.actionHand[0]!.id);
  }
  resolveActionPhase(state);
}

describe('Action phase', () => {
  let state: GameState;
  beforeEach(() => {
    state = setupAtAction();
  });

  it('every player draws one and then plays one card, advancing to draft', () => {
    const beforeDeckPlusGrave = state.decks.action.length + state.decks.actionGrave.length;
    startActionPhase(state);
    for (const p of state.players) {
      if (p.actionHand.length === 0) continue;
      submitActionPlay(state, p.id, p.actionHand[0]!.id);
    }
    resolveActionPhase(state);
    expect(state.phase).toBe('draft');
    // Action card pool size (deck + grave + hands) is conserved.
    const handsAfter = state.players.reduce((n, p) => n + p.actionHand.length, 0);
    expect(state.decks.action.length + state.decks.actionGrave.length + handsAfter).toBe(
      beforeDeckPlusGrave + handsAfter,
    );
    const playedCount = state.log.filter((e) => e.kind === 'action_played').length;
    expect(playedCount).toBe(8);
  });

  it('permanent stat_mod modifies the monster base stats immediately', () => {
    const target = state.players[0]!;
    startActionPhase(state);
    forceCardInHand(state, target, 'ac-005'); // permanent ATK +1
    const beforeAtk = target.monster!.stats.atk;
    playAll(state, target.id, 'ac-005');
    expect(target.monster!.stats.atk).toBe(beforeAtk + 1);
  });

  it('draw_skill_top adds a skill to the player monster', () => {
    const target = state.players[0]!;
    startActionPhase(state);
    forceCardInHand(state, target, 'ac-010'); // 探索 = draw skill top
    const before = target.monster!.actives.length + target.monster!.passives.length;
    playAll(state, target.id, 'ac-010');
    const after = target.monster!.actives.length + target.monster!.passives.length;
    expect(after).toBe(before + 1);
  });

  it('initial action hand of 3 is dealt at game start (before monster pick)', () => {
    const fresh = createInitialState({
      roomId: 'r',
      seed: 7,
      players: [{ id: 'p1', name: 'A', isCPU: false }],
    });
    // Hands are filled before monster pick is resolved.
    expect(fresh.phase).toBe('pick_monster');
    for (const p of fresh.players) {
      expect(p.actionHand.length).toBe(3);
    }
  });

  it('startActionPhase grows every player hand by exactly 1 (3 → 4)', () => {
    const fresh = createInitialState({
      roomId: 'r',
      seed: 9,
      players: [{ id: 'p1', name: 'A', isCPU: false }],
    });
    completeMonsterPicks(fresh);
    fresh.phase = 'action';
    for (const p of fresh.players) expect(p.actionHand.length).toBe(3);
    startActionPhase(fresh);
    for (const p of fresh.players) {
      if (!p.monster) continue;
      expect(p.actionHand.length).toBe(4);
    }
  });
});
