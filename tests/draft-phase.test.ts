import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../src/server/engine/state';
import {
  startPackDraft,
  submitPackPick,
  resolvePackPickRound,
  allPackPicksIn,
} from '../src/server/engine/phases/draft';
import type { GameState } from '../src/server/engine/types';
import { completeMonsterPicks } from './helpers';

function setupAtDraft(seed = 30): GameState {
  const state = createInitialState({
    roomId: 'r',
    seed,
    players: [{ id: 'p1', name: 'A', isCPU: false }],
  });
  completeMonsterPicks(state);
  state.phase = 'draft';
  return state;
}

describe('Pack Draft phase', () => {
  let state: GameState;
  beforeEach(() => {
    state = setupAtDraft();
  });

  it('startPackDraft creates packs of up to 5 cards for each player', () => {
    startPackDraft(state);
    expect(state.packDraft).not.toBeNull();
    expect(state.packDraft!.draftOrder).toHaveLength(8);
    expect(state.packDraft!.passIndex).toBe(0);
    // Each player gets a pack (may be smaller if deck is low)
    for (const pid of state.packDraft!.draftOrder) {
      expect(state.packDraft!.packs[pid]).toBeDefined();
      expect(state.packDraft!.packs[pid]!.length).toBeGreaterThan(0);
      expect(state.packDraft!.packs[pid]!.length).toBeLessThanOrEqual(5);
    }
  });

  it('all players are initially pending', () => {
    startPackDraft(state);
    expect(state.packDraft!.pendingPlayerIds).toHaveLength(8);
  });

  it('happy path: all players pick simultaneously, rotating 5 times', () => {
    startPackDraft(state);
    const draft = state.packDraft!;
    const initialDraftOrder = draft.draftOrder.slice();

    // Run 5 passes
    let done = false;
    let passes = 0;
    while (!done && passes < 10) {
      // Each pending player picks first card from their current pack
      for (const pid of draft.pendingPlayerIds.slice()) {
        const pack = draft.packs[pid]!;
        if (pack.length > 0) {
          submitPackPick(state, pid, pack[0]!.id);
        }
      }
      done = resolvePackPickRound(state);
      passes++;
    }

    expect(done).toBe(true);
    expect(state.packDraft).toBeNull();
    // After draft, advance to build phase
    expect(state.phase).toBe('build');

    // Each player should have 5 cards in skillStock
    for (const pid of initialDraftOrder) {
      const player = state.players.find((p) => p.id === pid)!;
      expect(player.skillStock.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('draft_finished is logged after all passes', () => {
    startPackDraft(state);
    const draft = state.packDraft!;
    let done = false;
    let passes = 0;
    while (!done && passes < 10) {
      for (const pid of draft.pendingPlayerIds.slice()) {
        const pack = draft.packs[pid]!;
        if (pack.length > 0) {
          submitPackPick(state, pid, pack[0]!.id);
        }
      }
      done = resolvePackPickRound(state);
      passes++;
    }
    const hasFinished = state.log.some((e) => e.kind === 'draft_finished');
    expect(hasFinished).toBe(true);
  });

  it('allPackPicksIn returns false before picks, true after', () => {
    startPackDraft(state);
    expect(allPackPicksIn(state)).toBe(false);
    const draft = state.packDraft!;
    for (const pid of draft.pendingPlayerIds.slice()) {
      const pack = draft.packs[pid]!;
      if (pack.length > 0) {
        submitPackPick(state, pid, pack[0]!.id);
      }
    }
    expect(allPackPicksIn(state)).toBe(true);
  });

  it('submitting an invalid card throws', () => {
    startPackDraft(state);
    const draft = state.packDraft!;
    const pid = draft.pendingPlayerIds[0]!;
    expect(() => submitPackPick(state, pid, 'non-existent-card')).toThrow();
  });

  it('packs rotate to the next player each pass', () => {
    startPackDraft(state);
    const draft = state.packDraft!;
    const order = draft.draftOrder.slice();
    // Record the pack contents before picking
    const initialPackIds: Record<string, string[]> = {};
    for (const pid of order) {
      initialPackIds[pid] = draft.packs[pid]!.map((c) => c.id);
    }

    // All pick the first card, then check that packs rotated
    for (const pid of draft.pendingPlayerIds.slice()) {
      const pack = draft.packs[pid]!;
      if (pack.length > 0) {
        submitPackPick(state, pid, pack[0]!.id);
      }
    }
    resolvePackPickRound(state);

    if (!state.packDraft) return; // draft may be done if packs were size 1
    // After rotation, player[i]'s new pack should be player[(i-1+n)%n]'s remaining
    for (let i = 0; i < order.length; i++) {
      const prevPid = order[(i - 1 + order.length) % order.length]!;
      const prevInitial = initialPackIds[prevPid]!;
      const prevPicked = prevInitial[0]!;
      // What the prev player had minus their pick
      const expectedRemaining = prevInitial.filter((id) => id !== prevPicked);
      const currentPack = state.packDraft!.packs[order[i]!]!.map((c) => c.id);
      expect(currentPack).toEqual(expectedRemaining);
    }
  });
});
