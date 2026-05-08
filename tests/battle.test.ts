import { describe, expect, it } from 'vitest';
import { runBattle } from '../src/server/engine/battle';
import type { ActiveSkill, Monster, PassiveSkill, SkillEffect } from '../src/server/engine/types';
import { RNG } from '../src/server/engine/rng';

let nextSkillCounter = 0;
function mkActive(effect: SkillEffect, name = 'sk'): ActiveSkill {
  nextSkillCounter += 1;
  return { id: `t${nextSkillCounter}`, order: nextSkillCounter, name, effect };
}

function mkMonster(opts: {
  ownerId?: string;
  baseId?: string;
  name?: string;
  hp?: number;
  atk?: number;
  def?: number;
  spd?: number;
  passives?: PassiveSkill[];
  actives?: ActiveSkill[];
}): Monster {
  return {
    ownerId: opts.ownerId ?? 'p',
    baseId: opts.baseId ?? 'test',
    name: opts.name ?? 'Tester',
    stats: {
      hp: opts.hp ?? 20,
      atk: opts.atk ?? 5,
      def: opts.def ?? 2,
      spd: opts.spd ?? 5,
    },
    passives: opts.passives ?? [],
    actives: opts.actives ?? [],
  };
}

describe('RNG', () => {
  it('is deterministic given the same seed', () => {
    const r1 = new RNG(42);
    const r2 = new RNG(42);
    const a = Array.from({ length: 10 }, () => r1.d6());
    const b = Array.from({ length: 10 }, () => r2.d6());
    expect(a).toEqual(b);
  });

  it('d6 always in [1,6]', () => {
    const r = new RNG(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.d6();
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
});

describe('Battle engine — first attack determination', () => {
  it('picks side with higher SPD+d6 to go first', () => {
    // Heavily skewed SPD ensures side b wins almost always; pick a seed and verify.
    const a = mkMonster({ spd: 1, atk: 1, hp: 30, actives: [mkActive({ kind: 'attack', mult: 1, useStat: 'atk' })] });
    const b = mkMonster({ spd: 20, atk: 1, hp: 30, actives: [mkActive({ kind: 'attack', mult: 1, useStat: 'atk' })] });
    const result = runBattle(a, b, 1234);
    const firstEvent = result.log.find((e) => e.kind === 'first');
    expect(firstEvent?.kind === 'first' && firstEvent.player).toBe('b');
  });
});

describe('Battle engine — basic damage', () => {
  it('applies damage = max(1, ATK*mult - DEF)', () => {
    const a = mkMonster({
      hp: 100, atk: 10, def: 0, spd: 10,
      actives: [mkActive({ kind: 'attack', mult: 1, useStat: 'atk' })],
    });
    const b = mkMonster({ hp: 100, atk: 0, def: 3, spd: 1, actives: [] });
    const result = runBattle(a, b, 1);
    // a should hit b once for 10-3 = 7 damage.
    const dmg = result.log.find((e) => e.kind === 'damage' && e.from === 'a');
    expect(dmg?.kind === 'damage' && dmg.amount).toBe(7);
    expect(result.finalHp.b).toBe(93);
  });

  it('damage floors to minimum 1', () => {
    const a = mkMonster({
      atk: 1, def: 0, hp: 100, spd: 10,
      actives: [mkActive({ kind: 'attack', mult: 1, useStat: 'atk' })],
    });
    const b = mkMonster({ atk: 0, def: 100, hp: 100, spd: 1, actives: [] });
    const result = runBattle(a, b, 1);
    const dmg = result.log.find((e) => e.kind === 'damage' && e.from === 'a');
    expect(dmg?.kind === 'damage' && dmg.amount).toBe(1);
  });
});

describe('Battle engine — HP=0 continuation', () => {
  it('continues processing after defender HP hits 0 until both actives exhausted', () => {
    const a = mkMonster({
      atk: 100, def: 0, hp: 100, spd: 10,
      actives: [
        mkActive({ kind: 'attack', mult: 1, useStat: 'atk' }, 'kill'),
        mkActive({ kind: 'attack', mult: 1, useStat: 'atk' }, 'overkill'),
      ],
    });
    const b = mkMonster({
      atk: 1, def: 0, hp: 5, spd: 1,
      actives: [mkActive({ kind: 'attack', mult: 1, useStat: 'atk' }, 'b1')],
    });
    const result = runBattle(a, b, 1);
    expect(result.winner).toBe('a');
    // Both sides used all actives.
    const aSkills = result.log.filter((e) => e.kind === 'skill_use' && e.player === 'a').length;
    const bSkills = result.log.filter((e) => e.kind === 'skill_use' && e.player === 'b').length;
    expect(aSkills).toBe(2);
    expect(bSkills).toBe(1);
    // b's HP went negative.
    expect(result.finalHp.b).toBeLessThanOrEqual(0);
  });
});

describe('Battle engine — nullify_next', () => {
  it("nullifies the opponent's next active", () => {
    const a = mkMonster({
      hp: 100, spd: 10, atk: 0, def: 0,
      actives: [mkActive({ kind: 'nullify_next' }, 'block')],
    });
    const b = mkMonster({
      hp: 100, spd: 1, atk: 50, def: 0,
      actives: [mkActive({ kind: 'attack', mult: 1, useStat: 'atk' }, 'big')],
    });
    const result = runBattle(a, b, 1);
    const nullified = result.log.find((e) => e.kind === 'nullified' && e.player === 'b');
    expect(nullified).toBeDefined();
    // a should be unhurt by b's attack.
    expect(result.finalHp.a).toBe(100);
  });
});

describe('Battle engine — next_amp', () => {
  it("doubles damage of attacker's next active when next_amp 2", () => {
    const a = mkMonster({
      hp: 100, atk: 5, def: 0, spd: 10,
      actives: [
        mkActive({ kind: 'next_amp', mult: 2 }, 'amp'),
        mkActive({ kind: 'attack', mult: 1, useStat: 'atk' }, 'hit'),
      ],
    });
    const b = mkMonster({ hp: 100, atk: 0, def: 0, spd: 1, actives: [] });
    const result = runBattle(a, b, 1);
    // Without amp, damage would be 5. With amp x2 expect 10.
    const dmg = result.log.find((e) => e.kind === 'damage' && e.from === 'a');
    expect(dmg?.kind === 'damage' && dmg.amount).toBe(10);
  });

  it('amp does not persist beyond the next active', () => {
    const a = mkMonster({
      hp: 100, atk: 5, def: 0, spd: 10,
      actives: [
        mkActive({ kind: 'next_amp', mult: 2 }, 'amp'),
        mkActive({ kind: 'attack', mult: 1, useStat: 'atk' }, 'hit1'),
        mkActive({ kind: 'attack', mult: 1, useStat: 'atk' }, 'hit2'),
      ],
    });
    const b = mkMonster({ hp: 100, atk: 0, def: 0, spd: 1, actives: [] });
    const result = runBattle(a, b, 1);
    const dmgs = result.log.filter((e) => e.kind === 'damage' && e.from === 'a');
    expect(dmgs.length).toBe(2);
    expect(dmgs[0]!.kind === 'damage' && dmgs[0]!.amount).toBe(10);
    expect(dmgs[1]!.kind === 'damage' && dmgs[1]!.amount).toBe(5);
  });
});

describe('Battle engine — true damage ignores DEF', () => {
  it('true damage bypasses DEF', () => {
    const a = mkMonster({
      hp: 100, atk: 5, def: 0, spd: 10,
      actives: [mkActive({ kind: 'true_damage', amount: 7 })],
    });
    const b = mkMonster({ hp: 100, atk: 0, def: 999, spd: 1, actives: [] });
    const result = runBattle(a, b, 1);
    expect(result.finalHp.b).toBe(93);
  });
});

describe('Battle engine — tiebreak by HP', () => {
  it('when both exhaust without HP=0, higher HP wins', () => {
    const a = mkMonster({
      hp: 50, atk: 5, def: 0, spd: 10,
      actives: [mkActive({ kind: 'attack', mult: 1, useStat: 'atk' })],
    });
    const b = mkMonster({
      hp: 50, atk: 3, def: 0, spd: 1,
      actives: [mkActive({ kind: 'attack', mult: 1, useStat: 'atk' })],
    });
    const result = runBattle(a, b, 1);
    expect(result.finalHp.a).toBe(47);
    expect(result.finalHp.b).toBe(45);
    expect(result.winner).toBe('a');
    const end = result.log[result.log.length - 1];
    expect(end?.kind === 'end' && end.reason).toBe('tiebreak_hp');
  });
});

describe('Battle engine — draw on equal HP/SPD', () => {
  it('returns draw when no actives and equal stats', () => {
    const a = mkMonster({ hp: 30, atk: 0, def: 0, spd: 5, actives: [] });
    const b = mkMonster({ hp: 30, atk: 0, def: 0, spd: 5, actives: [] });
    const result = runBattle(a, b, 7);
    expect(result.winner).toBe('draw');
  });
});

describe('Battle engine — passives', () => {
  it('first_attack_amp passive boosts only the first attack', () => {
    const passive: PassiveSkill = {
      id: 'p1',
      name: 'First strike',
      trigger: { kind: 'first_attack' },
      effect: { kind: 'first_attack_amp', amount: 1 }, // adds +1*stat to first hit
    };
    const a = mkMonster({
      hp: 100, atk: 5, def: 0, spd: 10, passives: [passive],
      actives: [
        mkActive({ kind: 'attack', mult: 1, useStat: 'atk' }, 'hit1'),
        mkActive({ kind: 'attack', mult: 1, useStat: 'atk' }, 'hit2'),
      ],
    });
    const b = mkMonster({ hp: 100, atk: 0, def: 0, spd: 1, actives: [] });
    const result = runBattle(a, b, 1);
    const dmgs = result.log.filter((e) => e.kind === 'damage' && e.from === 'a');
    // First attack: base 5 + (1*5) = 10. Second: 5.
    expect(dmgs[0]!.kind === 'damage' && dmgs[0]!.amount).toBe(10);
    expect(dmgs[1]!.kind === 'damage' && dmgs[1]!.amount).toBe(5);
  });

  it('first_attack_true bypasses DEF on first attack only', () => {
    const passive: PassiveSkill = {
      id: 'p1',
      name: 'Shadow strike',
      trigger: { kind: 'first_attack' },
      effect: { kind: 'first_attack_true' },
    };
    const a = mkMonster({
      hp: 100, atk: 5, def: 0, spd: 10, passives: [passive],
      actives: [
        mkActive({ kind: 'attack', mult: 1, useStat: 'atk' }, 'hit1'),
        mkActive({ kind: 'attack', mult: 1, useStat: 'atk' }, 'hit2'),
      ],
    });
    const b = mkMonster({ hp: 100, atk: 0, def: 100, spd: 1, actives: [] });
    const result = runBattle(a, b, 1);
    const dmgs = result.log.filter((e) => e.kind === 'damage' && e.from === 'a');
    // First attack ignores DEF -> 5. Second attack vs DEF=100 -> floor min 1.
    expect(dmgs[0]!.kind === 'damage' && dmgs[0]!.amount).toBe(5);
    expect(dmgs[1]!.kind === 'damage' && dmgs[1]!.amount).toBe(1);
  });
});

describe('Battle engine — determinism', () => {
  it('same seed produces same outcome', () => {
    const a = mkMonster({
      hp: 30, atk: 5, def: 2, spd: 4,
      actives: [
        mkActive({ kind: 'attack', mult: 1.0, useStat: 'atk' }, 'hit'),
        mkActive({ kind: 'attack', mult: 1.5, useStat: 'atk' }, 'big'),
      ],
    });
    const b = mkMonster({
      hp: 30, atk: 5, def: 2, spd: 4,
      actives: [
        mkActive({ kind: 'attack', mult: 1.0, useStat: 'atk' }, 'hit'),
        mkActive({ kind: 'attack', mult: 1.5, useStat: 'atk' }, 'big'),
      ],
    });
    const r1 = runBattle(a, b, 9999);
    const r2 = runBattle(a, b, 9999);
    expect(r1.winner).toBe(r2.winner);
    expect(r1.finalHp).toEqual(r2.finalHp);
    expect(r1.log.length).toBe(r2.log.length);
  });
});

describe('Battle engine — heal & shield', () => {
  it('heal increases HP', () => {
    const a = mkMonster({
      hp: 10, atk: 0, def: 0, spd: 10,
      actives: [mkActive({ kind: 'heal', amount: 5 })],
    });
    const b = mkMonster({ hp: 50, atk: 0, def: 0, spd: 1, actives: [] });
    const result = runBattle(a, b, 1);
    expect(result.finalHp.a).toBe(15);
  });

  it('shield absorbs incoming damage', () => {
    const a = mkMonster({
      hp: 30, atk: 0, def: 0, spd: 10,
      actives: [mkActive({ kind: 'shield', amount: 5 })],
    });
    const b = mkMonster({
      hp: 30, atk: 4, def: 0, spd: 1,
      actives: [mkActive({ kind: 'attack', mult: 1, useStat: 'atk' })],
    });
    const result = runBattle(a, b, 1);
    // a shields 5; b deals 4 ATK, fully absorbed -> dmg event amount=0
    const dmg = result.log.find((e) => e.kind === 'damage' && e.from === 'b');
    expect(dmg?.kind === 'damage' && dmg.amount).toBe(0);
    expect(result.finalHp.a).toBe(30);
  });
});
