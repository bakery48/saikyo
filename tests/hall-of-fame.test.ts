import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HallOfFameStore } from '../src/server/db';
import { GameRunner } from '../src/server/game-runner';

describe('HallOfFameStore', () => {
  let store: HallOfFameStore;
  beforeEach(() => {
    store = new HallOfFameStore(null);
  });
  afterEach(() => store.close());

  it('saves and retrieves a champion from a finished game', () => {
    const runner = new GameRunner({ roomId: 'r', seed: 100, humans: [] });
    runner.advance();
    expect(runner.state.champion).not.toBeNull();
    const champion = runner.state.champion!;
    const owner = runner.state.players.find((p) => p.id === champion.playerId)!;
    const saved = store.save({ champion, ownerName: owner.name, seed: 100 });
    expect(saved.id).toBeTypeOf('string');
    expect(saved.monsterName).toBe(champion.monster.name);
    expect(store.count()).toBe(1);

    const got = store.get(saved.id);
    expect(got).not.toBeNull();
    expect(got!.monster.stats).toEqual(champion.monster.stats);
    expect(got!.monster.actives).toHaveLength(champion.monster.actives.length);
  });

  it('list returns most recent first', () => {
    const runner = new GameRunner({ roomId: 'r', seed: 50, humans: [] });
    runner.advance();
    const champion = runner.state.champion!;
    const a = store.save({ champion, ownerName: 'A', seed: 50 });
    const b = store.save({ champion, ownerName: 'B', seed: 50 });
    const list = store.list();
    expect(list).toHaveLength(2);
    expect(list[0]!.id).toBe(b.id);
    expect(list[1]!.id).toBe(a.id);
  });

  it('limit is respected', () => {
    const runner = new GameRunner({ roomId: 'r', seed: 7, humans: [] });
    runner.advance();
    const champion = runner.state.champion!;
    for (let i = 0; i < 5; i++) {
      store.save({ champion, ownerName: `P${i}`, seed: i });
    }
    expect(store.list(3)).toHaveLength(3);
    expect(store.list().length).toBe(5);
  });

  it('preserves nested skill structure through JSON round-trip', () => {
    const runner = new GameRunner({ roomId: 'r', seed: 9, humans: [] });
    runner.advance();
    const champion = runner.state.champion!;
    const saved = store.save({ champion, ownerName: 'X', seed: 9 });
    const got = store.get(saved.id)!;
    expect(got.monster.actives).toEqual(champion.monster.actives);
    expect(got.monster.passives).toEqual(champion.monster.passives);
  });
});
