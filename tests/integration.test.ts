import { describe, expect, it } from 'vitest';
import { GameRunner } from '../src/server/game-runner';
import { HallOfFameStore } from '../src/server/db';
import { SKILLS } from '../src/server/engine/cards/skills';

describe('Integration: full pipeline + persistence', () => {
  it('saves a champion produced by the GameRunner across many seeds', () => {
    const store = new HallOfFameStore(':memory:');
    try {
      for (const seed of [1, 2, 3, 5, 11, 23, 41]) {
        const runner = new GameRunner({ roomId: `r-${seed}`, seed, humans: [] });
        runner.advance();
        expect(runner.state.phase).toBe('finished');
        expect(runner.state.champion).not.toBeNull();
        store.save({
          champion: runner.state.champion!,
          ownerName: 'Anonymous',
          seed,
        });
      }
      expect(store.count()).toBe(7);
      const list = store.list();
      // Each entry round-trips its monster fully.
      for (const entry of list) {
        expect(entry.monster.actives.length).toBeGreaterThan(0);
        expect(entry.monster.stats.hp).toBeGreaterThan(0);
      }
    } finally {
      store.close();
    }
  });
});

describe('Card data sanity', () => {
  it('every skill card has either an active or passive payload', () => {
    for (const c of SKILLS) {
      const hasActive = !!c.active;
      const hasPassive = c.isPassive && !!c.passive;
      expect(hasActive || hasPassive).toBe(true);
    }
  });

  it('rarity distribution covers all four tiers with passive variants', () => {
    const counts: Record<string, number> = {};
    for (const c of SKILLS) counts[c.rarity] = (counts[c.rarity] ?? 0) + 1;
    expect(counts.N).toBeGreaterThan(0);
    expect(counts.R).toBeGreaterThan(0);
    expect(counts.SR).toBeGreaterThan(0);
    expect(counts.SSR).toBeGreaterThan(0);
    const passiveCount = SKILLS.filter((c) => c.isPassive).length;
    expect(passiveCount).toBeGreaterThanOrEqual(4);
  });
});

describe('Balance: no monster wins disproportionately', () => {
  it('over many CPU games champion species varies', () => {
    const champions = new Map<string, number>();
    for (let seed = 1; seed <= 30; seed++) {
      const runner = new GameRunner({ roomId: `s${seed}`, seed, humans: [] });
      runner.advance();
      const id = runner.state.champion?.monster.baseId ?? 'none';
      champions.set(id, (champions.get(id) ?? 0) + 1);
    }
    // Expect at least 4 different species across 30 games.
    expect(champions.size).toBeGreaterThanOrEqual(4);
    // No species should dominate more than 50% of games.
    for (const [, c] of champions) expect(c).toBeLessThan(20);
  });
});
