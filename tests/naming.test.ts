import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState, addSkillCardToMonster } from '../src/server/engine/state';
import { GameRunner } from '../src/server/game-runner';
import {
  composeMonsterName,
  getAvailableTags,
  getBaseName,
  NAME_SEPARATOR,
  validateMonsterName,
} from '../src/server/engine/naming';
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
  it('every R/SR/SSR card has a non-empty nameTag (N cards have none)', () => {
    for (const c of SKILLS) {
      if (c.rarity === 'N') {
        expect(c.nameTag).toBeUndefined();
      } else {
        expect(c.nameTag).toBeTypeOf('string');
        expect((c.nameTag ?? '').length).toBeGreaterThan(0);
      }
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

  it('accepts the bare base monster name (no prefix)', () => {
    const monster = state.players[0]!.monster!;
    expect(validateMonsterName(getBaseName(monster), monster)).toBe(true);
  });

  it('accepts a name composed of all available tags + base name', () => {
    const monster = state.players[0]!.monster!;
    const base = getBaseName(monster);
    expect(validateMonsterName(`パワー・ウィザード・ドラゴン・${base}`, monster)).toBe(true);
    expect(validateMonsterName(`ウィザード・パワー・ドラゴン・${base}`, monster)).toBe(true);
  });

  it('accepts a subset of tags + base name', () => {
    const monster = state.players[0]!.monster!;
    const base = getBaseName(monster);
    expect(validateMonsterName(`パワー・ドラゴン・${base}`, monster)).toBe(true);
    expect(validateMonsterName(`パワー・${base}`, monster)).toBe(true);
  });

  it('rejects a name that does not end with the base monster name', () => {
    const monster = state.players[0]!.monster!;
    expect(validateMonsterName('パワー・ウィザード・ドラゴン', monster)).toBe(false);
    expect(validateMonsterName('パワー', monster)).toBe(false);
  });

  it('rejects a tag the monster does not have', () => {
    const monster = state.players[0]!.monster!;
    const base = getBaseName(monster);
    expect(validateMonsterName(`セイント・${base}`, monster)).toBe(false);
    expect(validateMonsterName(`パワー・セイント・${base}`, monster)).toBe(false);
  });

  it('rejects empty / whitespace-only name', () => {
    const monster = state.players[0]!.monster!;
    expect(validateMonsterName('', monster)).toBe(false);
    expect(validateMonsterName('   ', monster)).toBe(false);
    expect(validateMonsterName('・・', monster)).toBe(false);
  });

  it('cannot reuse a tag more times than the monster has acquired it', () => {
    const monster = state.players[0]!.monster!;
    const base = getBaseName(monster);
    expect(validateMonsterName(`パワー・パワー・${base}`, monster)).toBe(false);
  });

  it('allows duplicate tags up to multiplicity', () => {
    const monster = state.players[0]!.monster!;
    const base = getBaseName(monster);
    addSkillCardToMonster(state, state.players[0]!, findCard('sk-r-001')); // 2nd パワー
    expect(validateMonsterName(`パワー・パワー・${base}`, monster)).toBe(true);
  });
});

describe('composeMonsterName', () => {
  it('returns the bare base name when no prefix tags are given', () => {
    const state = setupReady();
    const monster = state.players[0]!.monster!;
    expect(composeMonsterName([], monster)).toBe(getBaseName(monster));
  });

  it('joins prefix tags with the base name', () => {
    const state = setupReady();
    const monster = state.players[0]!.monster!;
    const base = getBaseName(monster);
    expect(composeMonsterName(['パワー', 'ガード'], monster)).toBe(
      `パワー${NAME_SEPARATOR}ガード${NAME_SEPARATOR}${base}`,
    );
  });
});

describe('GameRunner.renameMonster', () => {
  it('updates monster name when valid', () => {
    const runner = new GameRunner({ roomId: 'r', seed: 5, humans: [{ id: 'h1', name: 'Hero' }] });
    runner.advance();
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
    // Now in either action (selecting from hand) or draft. Step until in draft.
    safety = 32;
    while (runner.state.phase !== 'draft' && safety-- > 0) {
      if (runner.state.phase === 'action' && runner.state.actionPhase) {
        const phase = runner.state.actionPhase;
        if (phase.pendingPlayerIds.includes('h1') && !phase.submittedPlays['h1']) {
          const player = runner.state.players.find((p) => p.id === 'h1')!;
          runner.submitAction('h1', player.actionHand[0]!.id);
          runner.advance();
          continue;
        }
      }
      runner.advance();
      if (runner.state.phase === 'pick_monster') break;
    }
    if (runner.state.phase !== 'draft') return; // Game flow drifted; skip body.
    const draft = runner.state.draft!;
    const used = new Set(Object.values(draft.submittedPicks));
    const taggedCards = draft.pool.filter((c) => !!c.nameTag);
    const card = taggedCards.find((c) => !used.has(c.id)) ?? draft.pool.find((c) => !used.has(c.id))!;
    runner.submitDraft('h1', card.id);
    runner.advance();
    const player = runner.state.players.find((p) => p.id === 'h1')!;
    const tag =
      player.monster!.actives.find((a) => a.nameTag)?.nameTag ??
      player.monster!.passives.find((p) => p.nameTag)?.nameTag;
    if (!tag) return; // Drew an N-rarity skill (no tag); nothing to rename with.
    const newName = composeMonsterName([tag], player.monster!);
    runner.renameMonster('h1', newName);
    expect(player.monster!.name).toBe(newName);
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
