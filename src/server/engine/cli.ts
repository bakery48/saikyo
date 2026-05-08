/**
 * Tiny CLI demo: run setup -> pick -> 3 mini-rounds of (event/action/draft)
 * for 8 CPU players. Useful as a smoke test that the phase machine wires up.
 *
 * Usage: npx tsx src/server/engine/cli.ts [seed]
 */
import { createInitialState, pickMonster } from './state';
import { resolveEventPhase } from './phases/event';
import { resolveActionPhase } from './phases/action';
import {
  startDraft,
  submitDraftPick,
  resolveDraftSubRound,
} from './phases/draft';
import { greedyPolicy, type Policy } from './policy';
import type { GameState } from './types';

function runDraftPhase(state: GameState, policy: Policy): void {
  startDraft(state);
  while (state.draft) {
    const draft = state.draft;
    for (const playerId of draft.pendingPlayerIds) {
      const card = policy.pickDraftCard(state, playerId, draft.pool);
      submitDraftPick(state, playerId, card.id);
    }
    const finished = resolveDraftSubRound(state);
    if (finished) break;
  }
}

export function runOneRound(state: GameState, policy: Policy = greedyPolicy): void {
  // 3 mini-rounds of event/action/draft.
  for (let i = 0; i < 3; i++) {
    expectPhase(state, 'event');
    resolveEventPhase(state);
    expectPhase(state, 'action');
    resolveActionPhase(state);
    expectPhase(state, 'draft');
    runDraftPhase(state, policy);
  }
}

function expectPhase(state: GameState, expected: GameState['phase']): void {
  if (state.phase !== expected) {
    throw new Error(`expected ${expected}, got ${state.phase}`);
  }
}

function main(): void {
  const seed = Number(process.argv[2] ?? 1);
  const state = createInitialState({
    roomId: 'demo',
    seed,
    players: [{ id: 'p1', name: 'You', isCPU: false }],
  });
  // Auto-pick monsters for everyone using the greedy policy.
  while (state.phase === 'pick_monster') {
    const playerId = state.pickOrder[state.pickIdx]!;
    const baseMon = greedyPolicy.pickMonster(state, playerId, state.monsterPool);
    pickMonster(state, playerId, baseMon.baseId);
  }
  runOneRound(state, greedyPolicy);
  console.log('phase=', state.phase, 'round=', state.round, 'mini=', state.miniRound);
  for (const p of state.players) {
    if (!p.monster) continue;
    console.log(
      `${p.name}\t${p.monster.name}\tHP${p.monster.stats.hp} ATK${p.monster.stats.atk} ` +
        `DEF${p.monster.stats.def} SPD${p.monster.stats.spd}\tactives=${p.monster.actives.length}`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
