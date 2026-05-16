/**
 * CLI demo: run a full 8-CPU game from setup through tournament and print
 * the champion. Useful smoke test for the entire phase machine.
 *
 * Usage: npx tsx src/server/engine/cli.ts [seed]
 */
import {
  createInitialState,
  resolveMonsterPickSubRound,
  resolveBoonPhase,
  submitBoon,
  submitMonsterPick,
  syncMonsterFromSlots,
} from './state';
import { MONSTERS_BY_ID } from './cards/monsters';
import type { MonsterBoon } from './types';
import { resolveEventPhase } from './phases/event';
import {
  startActionPhase,
  submitActionPlay,
  resolveActionPhase,
} from './phases/action';
import {
  startPackDraft,
  submitPackPick,
  resolvePackPickRound,
} from './phases/draft';
import {
  startBuildPhase,
  submitBuild,
  resolveBuildPhase,
} from './phases/build';
import { runBattlePhase } from './phases/battle';
import { resolveRewardPhase, submitReward } from './phases/reward';
import { runTournament } from './phases/tournament';
import { chooseStatForActionCard, greedyPolicy, type Policy } from './policy';
import type { ActionCard, GameState } from './types';

/** Build the `extras` arg for submitActionPlay based on the card's effect. */
function actionExtras(state: GameState, playerId: string, card: ActionCard) {
  const player = state.players.find((p) => p.id === playerId)!;
  if (card.effect.kind === 'stat_mod_choice' && player.monster) {
    return { chosenStat: chooseStatForActionCard(player.monster.stats) };
  }
  if (card.effect.kind === 'swap_actives') {
    const target = state.players.find((p) => p.monster && p.monster.actives.length >= 2);
    if (target) {
      const actives = target.monster!.actives;
      return { swap: { targetPlayerId: target.id, skillIdA: actives[0]!.id, skillIdB: actives[1]!.id } };
    }
  }
  return undefined;
}

function expectPhase(state: GameState, expected: GameState['phase']): void {
  if (state.phase !== expected) {
    throw new Error(`expected ${expected}, got ${state.phase}`);
  }
}

function runPackDraftPhase(state: GameState, policy: Policy): void {
  startPackDraft(state);
  let safety = 20;
  while (state.packDraft && safety-- > 0) {
    const draft = state.packDraft;
    for (const playerId of draft.pendingPlayerIds) {
      const pack = draft.packs[playerId] ?? [];
      if (pack.length === 0) continue;
      const card = policy.pickDraftCard(state, playerId, pack);
      submitPackPick(state, playerId, card.id);
    }
    resolvePackPickRound(state);
  }
}

function runBuildPhaseAll(state: GameState, policy: Policy): void {
  startBuildPhase(state);
  if (!state.buildPhase) return;
  for (const player of state.players) {
    if (!player.monster) continue;
    if (!state.buildPhase.pendingPlayerIds.includes(player.id)) continue;
    const config = policy.buildSlots(state, player.id);
    submitBuild(state, player.id, config);
  }
  resolveBuildPhase(state);
}

/** Resolve a reward phase by letting the policy choose for every pending player. */
function runRewardPhase(state: GameState, policy: Policy): void {
  for (const pid of state.reward!.pendingPlayerIds) {
    submitReward(state, pid, policy.chooseReward(state, pid));
  }
  resolveRewardPhase(state);
}

/**
 * Run one round: action → draft → build → event → battle.
 * An `extra_battle` event card may insert an extra battle+reward cycle
 * before the main end-of-round battle.
 */
export function runOneRound(state: GameState, policy: Policy): void {
  expectPhase(state, 'action');
  startActionPhase(state);
  for (const player of state.players) {
    if (!player.monster) continue;
    const allCards = player.uniqueActionCard
      ? [...player.actionHand, player.uniqueActionCard]
      : player.actionHand;
    if (allCards.length === 0) continue;
    const card = policy.pickActionCard(state, player.id, allCards);
    submitActionPlay(state, player.id, card.id, actionExtras(state, player.id, card));
  }
  resolveActionPhase(state);

  expectPhase(state, 'draft');
  runPackDraftPhase(state, policy);

  expectPhase(state, 'build');
  runBuildPhaseAll(state, policy);

  expectPhase(state, 'event');
  resolveEventPhase(state);

  // An `extra_battle` event card detours through battle + reward before
  // returning to the main end-of-round battle.
  if (state.phase === 'battle' && state.returnToBattleAfterReward) {
    runBattlePhase(state);
    expectPhase(state, 'reward');
    runRewardPhase(state, policy);
  }

  expectPhase(state, 'battle');
}

export function runBoonPickPhase(state: GameState, policy: Policy): void {
  if (state.phase !== 'pick_boon' || !state.boonPick) return;
  const bp = state.boonPick;
  for (const player of state.players) {
    if (!bp.pendingPlayerIds.includes(player.id) || !player.monster) continue;
    const base = MONSTERS_BY_ID[player.monster.baseId];
    if (!base) continue;
    const boon = policy.chooseBoon(state, player.id, base.boons as MonsterBoon[]);
    bp.submittedChoices[player.id] = boon.id;
  }
  resolveBoonPhase(state);
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
  runBoonPickPhase(state, policy);

  while (state.phase !== 'finished') {
    if (state.phase === 'action') {
      runOneRound(state, policy);
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
