/**
 * CLI demo: run a full 8-CPU game from setup through tournament and print
 * the champion. Useful smoke test for the entire phase machine.
 *
 * Usage: npx tsx src/server/engine/cli.ts [seed]
 */
import {
  createInitialState,
  resolveMonsterPickSubRound,
  submitMonsterPick,
} from './state';
import { resolveEventPhase } from './phases/event';
import {
  startActionPhase,
  submitActionPlay,
  resolveActionPhase,
} from './phases/action';
import {
  startDraft,
  submitDraftPick,
  resolveDraftSubRound,
} from './phases/draft';
import { runBattlePhase } from './phases/battle';
import { resolveRewardPhase, submitReward } from './phases/reward';
import { runTournament } from './phases/tournament';
import { greedyPolicy, type Policy } from './policy';
import type { GameState } from './types';

function expectPhase(state: GameState, expected: GameState['phase']): void {
  if (state.phase !== expected) {
    throw new Error(`expected ${expected}, got ${state.phase}`);
  }
}

function runDraftPhase(state: GameState, policy: Policy): void {
  startDraft(state);
  while (state.draft) {
    const draft = state.draft;
    for (const playerId of draft.pendingPlayerIds) {
      const card = policy.pickDraftCard(state, playerId, draft.pool);
      submitDraftPick(state, playerId, card.id);
    }
    if (resolveDraftSubRound(state)) break;
  }
}

export function runMiniRound(state: GameState, policy: Policy): void {
  expectPhase(state, 'event');
  resolveEventPhase(state);
  expectPhase(state, 'action');
  startActionPhase(state);
  for (const player of state.players) {
    if (!player.monster || player.actionHand.length === 0) continue;
    const card = policy.pickActionCard(state, player.id, player.actionHand);
    submitActionPlay(state, player.id, card.id);
  }
  resolveActionPhase(state);
  expectPhase(state, 'draft');
  runDraftPhase(state, policy);
}

/** Run all 3 mini-rounds (event/action/draft) of a single big round. */
export function runOneRound(state: GameState, policy: Policy = greedyPolicy): void {
  for (let i = 0; i < 3; i++) {
    runMiniRound(state, policy);
  }
}

export function runMonsterPickPhase(state: GameState, policy: Policy): void {
  while (state.phase === 'pick_monster' && state.monsterPick) {
    const draft = state.monsterPick;
    for (const pid of draft.pendingPlayerIds) {
      const m = policy.pickMonster(state, pid, draft.pool);
      submitMonsterPick(state, pid, m.baseId);
    }
    if (resolveMonsterPickSubRound(state)) break;
  }
}

export function runFullGame(state: GameState, policy: Policy = greedyPolicy): void {
  runMonsterPickPhase(state, policy);

  while (state.phase !== 'finished') {
    if (state.phase === 'event') {
      runMiniRound(state, policy);
    } else if (state.phase === 'battle') {
      runBattlePhase(state);
    } else if (state.phase === 'reward') {
      for (const pid of state.reward!.pendingPlayerIds) {
        submitReward(state, pid, policy.chooseReward(state, pid));
      }
      resolveRewardPhase(state);
    } else if (state.phase === 'tournament') {
      runTournament(state);
    } else {
      throw new Error(`unexpected phase: ${state.phase}`);
    }
  }
}

function main(): void {
  const seed = Number(process.argv[2] ?? 1);
  const state = createInitialState({
    roomId: 'demo',
    seed,
    players: [{ id: 'p1', name: 'You', isCPU: false }],
  });
  runFullGame(state, greedyPolicy);

  console.log(`\n=== Game finished (seed ${seed}) ===`);
  if (state.champion) {
    const c = state.champion;
    const player = state.players.find((p) => p.id === c.playerId)!;
    console.log(`Champion: ${player.name} (${c.monster.name})`);
    console.log(
      `  HP${c.monster.stats.hp} ATK${c.monster.stats.atk} DEF${c.monster.stats.def} SPD${c.monster.stats.spd}`,
    );
    console.log(`  actives=${c.monster.actives.length}, passives=${c.monster.passives.length}`);
  } else {
    console.log('No champion (something went wrong).');
  }
  console.log('\nFinal standings:');
  for (const p of state.players) {
    if (!p.monster) continue;
    console.log(
      `  ${p.name}\t${p.monster.name}\tHP${p.monster.stats.hp} ATK${p.monster.stats.atk} ` +
        `DEF${p.monster.stats.def} SPD${p.monster.stats.spd}\tactives=${p.monster.actives.length}`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
