import type { ActionCard, GameState, MonsterBase, RewardChoice, SkillCard, StatKey } from './types';

/**
 * A pluggable policy decides what a player does when input is required.
 * Used for both CPUs and (during tests) deterministic stand-ins for humans.
 */
export type Policy = {
  pickMonster(state: GameState, playerId: string, available: MonsterBase[]): MonsterBase;
  pickDraftCard(state: GameState, playerId: string, pool: SkillCard[]): SkillCard;
  pickActionCard(state: GameState, playerId: string, hand: ActionCard[]): ActionCard;
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

/**
 * FNV-1a-style mixing of several integers — strong enough to make the picked
 * index differ between players even when the pool only has 2 entries (plain
 * XOR + modulo collapses to a single LSB and locks two CPUs into perpetual
 * conflict every sub-round).
 */
function mixHash(...nums: number[]): number {
  let h = 0x811c9dc5 | 0;
  for (const n of nums) {
    h ^= n | 0;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
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
    const idx = mixHash(hashCode(playerId), state.rngState, attempt) % top.length;
    return top[idx]!;
  },
  pickDraftCard(state, playerId, pool) {
    if (pool.length === 0) return pool[0]!;
    const maxRank = pool.reduce(
      (m, c) => Math.max(m, RARITY_RANK[c.rarity] ?? 0),
      0,
    );
    const best = pool.filter((c) => (RARITY_RANK[c.rarity] ?? 0) === maxRank);
    if (best.length === 1) return best[0]!;
    const attempt = state.draft?.attempt ?? 0;
    const idx = mixHash(hashCode(playerId), state.rngState, attempt) % best.length;
    return best[idx]!;
  },
  pickActionCard(_state, _playerId, hand) {
    let best = hand[0]!;
    let bestScore = scoreActionCard(best);
    for (const c of hand) {
      const s = scoreActionCard(c);
      if (s > bestScore) {
        best = c;
        bestScore = s;
      }
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

function scoreActionCard(card: ActionCard): number {
  switch (card.effect.kind) {
    case 'stat_mod':
      // Permanent buffs are worth more than next-battle ones.
      return card.effect.amount * (card.effect.duration === 'permanent' ? 4 : 2);
    case 'stat_mod_choice':
      // Same as a permanent stat_mod; the chosen stat is decided when played.
      return card.effect.amount * (card.effect.duration === 'permanent' ? 4 : 2);
    case 'draw_skill_top':
      return 5;
    case 'recover_skill_from_grave':
      return 4;
    case 'gain_passive':
      return 6;
    case 'discard_random_active':
      return -1;
  }
}

/** Pick the stat a CPU should bump for a stat_mod_choice card. */
export function chooseStatForActionCard(stats: {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}): StatKey {
  return weakestStat(stats);
}

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
  pickActionCard: (_s, _p, hand) => hand[0]!,
  chooseReward: () => ({ kind: 'skill_top' }),
};
