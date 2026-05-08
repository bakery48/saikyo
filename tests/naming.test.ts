import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState, addSkillCardToMonster } from '../src/server/engine/state';
import { GameRunner } from '../src/server/game-runner';
import { getAvailableTags, validateMonsterName } from '../src/server/engine/naming';
import { SKILLS } from '../src/server/engine/cards/skills';
import type { GameState, SkillCard } from '../src/server/engine/types';
import { completeMonsterPicks } from './helpers';

function setupReady(): GameState {
  const state = createInitialState({
    roomId: 'r',
    seed: 1,
    players: [{ id: 'p1', name: 'A', isCPU: false }],
  });
  completeMonsterPicks(state);
  return state;
}

const findCard = (id: string): SkillCard => {
  const c = SKILLS.find((s) => s.id === id);
  if (!c) throw new Error(`unknown card ${id}`);
  return c;
};

describe('Skill name tags', () => {
  it('every card has a non-empty nameTag', () => {
    for (const c of SKILLS) {
      expect(c.nameTag).toBeTypeOf('string');
      expect(c.nameTag.length).toBeGreaterThan(0);
    }
  });

  it('addSkillCardToMonster propagates nameTag onto active and passive instances', () => {
    const state = setupReady();
    const player = state.players.find((p) => p.id === 'p1')!;
    const active = addSkillCardToMonster(state, player, findCard('sk-r-001')); // パワー
    const passive = addSkillCardToMonster(state, player, findCard('sk-rp-001')); // リーダー
    expect(active.nameTag).toBe('パワー');
    expect(passive.nameTag).toBe('リーダー');
  });

  it('getAvailableTags reflects all nameTag-bearing skills', () => {
    const state = setupReady();
    const player = state.players.find((p) => p.id === 'p1')!;
    addSkillCardToMonster(state, player, findCard('sk-r-001')); // パワー
    addSkillCardToMonster(state, player, findCard('sk-r-012')); // ウィザード
    addSkillCardToMonster(state, player, findCard('sk-ssr-001')); // ドラゴン
    const tags = getAvailableTags(player.monster!);
    expect(tags.sort()).toEqual(['ウィザード', 'ドラゴン', 'パワー'].sort());
  });
});

describe('validateMonsterName', () => {
  let state: GameState;
  beforeEach(() => {
    state = setupReady();
    const p = state.players.find((p) => p.id === 'p1')!;
    addSkillCardToMonster(state, p, findCard('sk-r-001')); // パワー
    addSkillCardToMonster(state, p, findCard('sk-r-012')); // ウィザード
    addSkillCardToMonster(state, p, findCard('sk-ssr-001')); // ドラゴン
  });

  it('accepts a name composed of all available tags', () => {
    const monster = state.players[0]!.monster!;
    expect(validateMonsterName('パワー・ウィザード・ドラゴン', monster)).toBe(true);
    expect(validateMonsterName('ウィザード・パワー・ドラゴン', monster)).toBe(true);
  });

  it('accepts a subset of tags', () => {
    const monster = state.players[0]!.monster!;
    expect(validateMonsterName('パワー・ドラゴン', monster)).toBe(true);
    expect(validateMonsterName('パワー', monster)).toBe(true);
  });

  it('rejects a tag the monster does not have', () => {
    const monster = state.players[0]!.monster!;
    expect(validateMonsterName('セイント', monster)).toBe(false);
    expect(validateMonsterName('パワー・セイント', monster)).toBe(false);
  });

  it('rejects empty / whitespace-only name', () => {
    const monster = state.players[0]!.monster!;
    expect(validateMonsterName('', monster)).toBe(false);
    expect(validateMonsterName('   ', monster)).toBe(false);
    expect(validateMonsterName('・・', monster)).toBe(false);
  });

  it('cannot reuse a tag more times than the monster has acquired it', () => {
    const monster = state.players[0]!.monster!;
    expect(validateMonsterName('パワー・パワー', monster)).toBe(false);
  });

  it('allows duplicate tags up to multiplicity', () => {
    const monster = state.players[0]!.monster!;
    addSkillCardToMonster(state, state.players[0]!, findCard('sk-r-001')); // 2nd パワー
    expect(validateMonsterName('パワー・パワー', monster)).toBe(true);
  });
});

describe('GameRunner.renameMonster', () => {
  it('updates monster name when valid', () => {
    const runner = new GameRunner({ roomId: 'r', seed: 5, humans: [{ id: 'h1', name: 'Hero' }] });
    runner.advance();
    // Resolve any remaining pick conflicts: keep picking from the pool until
    // the human is no longer pending.
    let safety = 16;
    while (
      runner.state.phase === 'pick_monster' &&
      runner.state.monsterPick?.pendingPlayerIds.includes('h1') &&
      safety-- > 0
    ) {
      const draft = runner.state.monsterPick!;
      const used = new Set(Object.values(draft.submittedPicks));
      const choice =
        draft.pool.find((m) => !used.has(m.baseId)) ?? draft.pool[0]!;
      runner.submitPick('h1', choice.baseId);
      runner.advance();
    }
    // Now in draft; submit a single skill so we have a tag.
    const draft = runner.state.draft!;
    const used = new Set(Object.values(draft.submittedPicks));
    const card = draft.pool.find((c) => !used.has(c.id))!;
    runner.submitDraft('h1', card.id);
    runner.advance();
    const player = runner.state.players.find((p) => p.id === 'h1')!;
    const tag = player.monster!.actives[0]!.nameTag ?? player.monster!.passives.at(-1)!.nameTag!;
    runner.renameMonster('h1', tag);
    expect(player.monster!.name).toBe(tag);
  });

  it('throws when the name uses unknown tags', () => {
    const runner = new GameRunner({ roomId: 'r', seed: 5, humans: [{ id: 'h1', name: 'Hero' }] });
    runner.advance();
    runner.submitPick('h1', runner.state.monsterPick!.pool[0]!.baseId);
    expect(() => runner.renameMonster('h1', 'ノットアタグ')).toThrow();
  });

  it('throws after the game is finished', () => {
    const runner = new GameRunner({ roomId: 'r', seed: 5, humans: [] });
    runner.advance();
    expect(runner.state.phase).toBe('finished');
    expect(() => runner.renameMonster('cpu-1', 'パワー')).toThrow(/finished/);
  });
});
