import type { GameState, MonsterBase, SkillCard } from './types';

/**
 * A pluggable policy decides what a player does when input is required.
 * Used for both CPUs and (during tests) deterministic stand-ins for humans.
 */
export type Policy = {
  pickMonster(state: GameState, playerId: string, available: MonsterBase[]): MonsterBase;
  pickDraftCard(state: GameState, playerId: string, pool: SkillCard[]): SkillCard;
};

/** Score a monster by total of its base stats — simple heuristic. */
function monsterScore(m: MonsterBase): number {
  return m.stats.hp + m.stats.atk * 3 + m.stats.def * 2 + m.stats.spd * 2;
}

const RARITY_RANK: Record<string, number> = { N: 1, R: 2, SR: 3, SSR: 4 };

/** Default CPU policy: greedy by simple heuristics. */
export const greedyPolicy: Policy = {
  pickMonster(_state, _playerId, available) {
    let best = available[0]!;
    for (const m of available) {
      if (monsterScore(m) > monsterScore(best)) best = m;
    }
    return best;
  },
  pickDraftCard(_state, _playerId, pool) {
    let best = pool[0]!;
    for (const c of pool) {
      if (RARITY_RANK[c.rarity]! > RARITY_RANK[best.rarity]!) best = c;
    }
    return best;
  },
};

/** Always pick the first option. Useful for deterministic tests. */
export const firstOptionPolicy: Policy = {
  pickMonster: (_s, _p, avail) => avail[0]!,
  pickDraftCard: (_s, _p, pool) => pool[0]!,
};
