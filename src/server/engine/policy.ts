import type { GameState, MonsterBase, RewardChoice, SkillCard, StatKey } from './types';

/**
 * A pluggable policy decides what a player does when input is required.
 * Used for both CPUs and (during tests) deterministic stand-ins for humans.
 */
export type Policy = {
  pickMonster(state: GameState, playerId: string, available: MonsterBase[]): MonsterBase;
  pickDraftCard(state: GameState, playerId: string, pool: SkillCard[]): SkillCard;
  chooseReward(state: GameState, playerId: string): RewardChoice;
};

/** Score a monster by total of its base stats — simple heuristic. */
function monsterScore(m: MonsterBase): number {
  return m.stats.hp + m.stats.atk * 3 + m.stats.def * 2 + m.stats.spd * 2;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

const RARITY_RANK: Record<string, number> = { N: 1, R: 2, SR: 3, SSR: 4 };

/** Default CPU policy: greedy by simple heuristics. */
export const greedyPolicy: Policy = {
  pickMonster(state, playerId, available) {
    // Score-rank, then pick from the top-3 using a hash that mixes the player
    // ID, the seed, and the current pick attempt. The attempt term is what
    // breaks deadlocks when multiple CPUs initially collide on the same
    // top-rated monster — they all rotate to different choices on the next
    // sub-round.
    const sorted = available
      .slice()
      .sort((a, b) => monsterScore(b) - monsterScore(a));
    const top = sorted.slice(0, Math.min(3, sorted.length));
    if (top.length === 0) return available[0]!;
    const attempt = state.monsterPick?.attempt ?? 0;
    const idx =
      Math.abs(hashCode(playerId) ^ state.rngState ^ (attempt * 1000003)) % top.length;
    return top[idx]!;
  },
  pickDraftCard(_state, _playerId, pool) {
    let best = pool[0]!;
    for (const c of pool) {
      if (RARITY_RANK[c.rarity]! > RARITY_RANK[best.rarity]!) best = c;
    }
    return best;
  },
  chooseReward(state, playerId) {
    const player = state.players.find((p) => p.id === playerId)!;
    const monster = player.monster!;
    // If the monster is light on actives, take a skill. Otherwise bump the lowest stat.
    if (monster.actives.length < 6) return { kind: 'skill_top' };
    return { kind: 'stat_up', stat: weakestStat(monster.stats) };
  },
};

function weakestStat(stats: { hp: number; atk: number; def: number; spd: number }): StatKey {
  // Compare HP at /5 scale since its bumps are larger.
  const scaled: Record<StatKey, number> = {
    hp: stats.hp / 5,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
  };
  let lowestKey: StatKey = 'atk';
  for (const k of ['hp', 'atk', 'def', 'spd'] as StatKey[]) {
    if (scaled[k] < scaled[lowestKey]) lowestKey = k;
  }
  return lowestKey;
}

/** Always pick the first option. Useful for deterministic tests. */
export const firstOptionPolicy: Policy = {
  pickMonster: (_s, _p, avail) => avail[0]!,
  pickDraftCard: (_s, _p, pool) => pool[0]!,
  chooseReward: () => ({ kind: 'skill_top' }),
};
