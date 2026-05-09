import type {
  BattleMatch,
  BattlePhaseState,
  GameState,
  Monster,
  Player,
} from '../types';
import { runBattle } from '../battle';
import { shuffle } from '../deck';
import { makeRng, saveRng } from '../state';

/**
 * Build a Monster snapshot for battle, applying and consuming any pendingBuffs
 * with `next_battle` duration.
 */
export function snapshotMonsterForBattle(player: Player): Monster {
  if (!player.monster) throw new Error(`player ${player.id} has no monster`);
  const m: Monster = {
    ...player.monster,
    stats: { ...player.monster.stats },
    passives: player.monster.passives.map((p) => ({ ...p })),
    actives: player.monster.actives.map((a) => ({ ...a })),
  };
  const remaining: typeof player.pendingBuffs = [];
  for (const buff of player.pendingBuffs) {
    if (buff.duration === 'next_battle') {
      m.stats[buff.stat] += buff.amount;
    } else {
      remaining.push(buff);
    }
  }
  player.pendingBuffs = remaining;
  return m;
}

/** Random pairing of all players with monsters into pairs. Odd one gets a bye. */
function makePairs(state: GameState): [string, string | null][] {
  const rng = makeRng(state);
  const ids = shuffle(
    state.players.filter((p) => p.monster).map((p) => p.id),
    rng,
  );
  saveRng(state, rng);
  const pairs: [string, string | null][] = [];
  for (let i = 0; i < ids.length; i += 2) {
    pairs.push([ids[i]!, ids[i + 1] ?? null]);
  }
  return pairs;
}

/**
 * Run all paired battles for the current round and transition to the reward
 * phase. The state is left in `phase: 'reward'` with a populated reward.pending list.
 */
export function runBattlePhase(state: GameState): void {
  if (state.phase !== 'battle') throw new Error('not in battle phase');
  const pairs = makePairs(state);
  const matches: BattleMatch[] = [];
  const losers: string[] = [];

  for (const [aId, bId] of pairs) {
    if (!bId) {
      // Player has a bye -- treat as automatic win, no opponent.
      matches.push({
        a: aId,
        b: aId,
        winner: 'a',
        startHpA: 0,
        startHpB: 0,
        finalHpA: 0,
        finalHpB: 0,
        log: [],
      });
      continue;
    }
    const a = state.players.find((p) => p.id === aId)!;
    const b = state.players.find((p) => p.id === bId)!;
    const monA = snapshotMonsterForBattle(a);
    const monB = snapshotMonsterForBattle(b);
    const rng = makeRng(state);
    const matchSeed = rng.int(1, 0x7fffffff);
    saveRng(state, rng);
    const result = runBattle(monA, monB, matchSeed);
    matches.push({
      a: aId,
      b: bId,
      winner: result.winner,
      startHpA: monA.stats.hp,
      startHpB: monB.stats.hp,
      finalHpA: result.finalHp.a,
      finalHpB: result.finalHp.b,
      log: result.log,
    });
    state.log.push({ kind: 'battle_match', a: aId, b: bId, winner: result.winner });
    if (result.winner === 'a') losers.push(bId);
    else if (result.winner === 'b') losers.push(aId);
    // draw -> nobody gets a reward
  }

  const battleState: BattlePhaseState = { matches };
  state.battle = battleState;
  state.reward = { pendingPlayerIds: losers, choices: {} };
  state.phase = 'reward';
  state.log.push({
    kind: 'phase_change',
    phase: 'reward',
    round: state.round,
    miniRound: state.miniRound,
  });
}
