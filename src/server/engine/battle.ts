import type {
  ActiveSkill,
  BattleEvent,
  BattleResult,
  Monster,
  PassiveSkill,
  SkillEffect,
  StatKey,
  Stats,
} from './types';
import { RNG } from './rng';

type Side = 'a' | 'b';
const other = (s: Side): Side => (s === 'a' ? 'b' : 'a');

type CombatStats = Stats & {
  /** Battle-long stat modifiers — added on top of base. */
  atkMod: number;
  defMod: number;
  spdMod: number;
  /** Single-use buff that applies to the next own active. */
  onceBuffs: Partial<Stats>;
  /** Pending damage multiplier for next own active. */
  nextAmp: number;
  /** Pending shield (flat damage reduction on next incoming attack). */
  shield: number;
  /** Whether the next opponent active will be nullified. */
  nullifyOpponentNext: boolean;
  /** Active skill index (next to use). */
  skillIdx: number;
  /** Have we made our first attack yet? */
  firstAttackMade: boolean;
  /** Number of own active skills resolved so far (used by chronoa-style passives). */
  activesUsedCount: number;
  /** Stacked amp accumulated each active (chronoa). */
  perActiveAmp: number;
  /** Permanent damage reduction from passives. */
  damageReduction: number;
  /** Random damage negation chance (1 in N). 0 = none. */
  negateOneIn: number;
  /** First-attack damage multiplier (additive amount applied as flat amp). */
  firstAttackAmp: number;
  /** First attack treats as true damage / ignores DEF. */
  firstAttackTrue: boolean;
  passiveIds: string[];
};

function initCombat(m: Monster): CombatStats {
  const c: CombatStats = {
    hp: m.stats.hp,
    atk: m.stats.atk,
    def: m.stats.def,
    spd: m.stats.spd,
    atkMod: 0,
    defMod: 0,
    spdMod: 0,
    onceBuffs: {},
    nextAmp: 1,
    shield: 0,
    nullifyOpponentNext: false,
    skillIdx: 0,
    firstAttackMade: false,
    activesUsedCount: 0,
    perActiveAmp: 0,
    damageReduction: 0,
    negateOneIn: 0,
    firstAttackAmp: 0,
    firstAttackTrue: false,
    passiveIds: [],
  };
  return c;
}

function effStat(c: CombatStats, key: StatKey): number {
  if (key === 'hp') return c.hp;
  if (key === 'atk') return c.atk + c.atkMod + (c.onceBuffs.atk ?? 0);
  if (key === 'def') return c.def + c.defMod + (c.onceBuffs.def ?? 0);
  return c.spd + c.spdMod + (c.onceBuffs.spd ?? 0);
}

function applyStatMod(c: CombatStats, key: StatKey, amount: number, duration: 'once' | 'battle'): void {
  if (duration === 'once') {
    c.onceBuffs[key] = (c.onceBuffs[key] ?? 0) + amount;
    return;
  }
  if (key === 'atk') c.atkMod += amount;
  else if (key === 'def') c.defMod += amount;
  else if (key === 'spd') c.spdMod += amount;
  else if (key === 'hp') c.hp += amount;
}

function consumeOnceBuffs(c: CombatStats): void {
  c.onceBuffs = {};
}

/** Apply battle-start passives (mutates combat state and returns log entries). */
function applyBattleStartPassives(
  passives: PassiveSkill[],
  self: CombatStats,
  side: Side,
  rng: RNG,
  log: BattleEvent[],
): { spdRollBonus: number } {
  let spdRollBonus = 0;
  for (const p of passives) {
    self.passiveIds.push(p.id);
    switch (p.effect.kind) {
      case 'spd_roll_bonus':
        if (p.trigger.kind === 'battle_start') {
          spdRollBonus += p.effect.amount;
          log.push({ kind: 'passive', player: side, passiveId: p.id });
        }
        break;
      case 'pick_higher_buff':
        if (p.trigger.kind === 'battle_start') {
          if (effStat(self, 'atk') >= effStat(self, 'def')) self.atkMod += p.effect.amount;
          else self.defMod += p.effect.amount;
          log.push({ kind: 'passive', player: side, passiveId: p.id });
        }
        break;
      case 'damage_reduction':
        self.damageReduction += p.effect.amount;
        break;
      case 'damage_negate_chance':
        self.negateOneIn = Math.max(self.negateOneIn, p.effect.oneIn);
        break;
      case 'first_attack_amp':
        self.firstAttackAmp += p.effect.amount;
        break;
      case 'first_attack_true':
        self.firstAttackTrue = true;
        break;
      case 'amp_each_active':
        self.perActiveAmp += p.effect.amount;
        break;
      case 'turn_start_heal':
        // handled per-turn
        break;
      case 'stat_mod':
        applyStatMod(self, p.effect.stat, p.effect.amount, 'battle');
        break;
    }
  }
  return { spdRollBonus };
}

function applyTurnStartPassives(
  passives: PassiveSkill[],
  self: CombatStats,
  side: Side,
  log: BattleEvent[],
): void {
  for (const p of passives) {
    if (p.trigger.kind !== 'on_own_turn_start') continue;
    if (p.effect.kind === 'turn_start_heal') {
      self.hp += p.effect.amount;
      log.push({ kind: 'heal', player: side, amount: p.effect.amount, hpAfter: self.hp });
      log.push({ kind: 'passive', player: side, passiveId: p.id });
    }
  }
}

/**
 * Resolve incoming damage on a side. Returns actual damage dealt (after
 * passives/shield). Handles random negation and damage reduction passives.
 */
function takeDamage(
  target: CombatStats,
  rawDamage: number,
  rng: RNG,
  passives: PassiveSkill[],
  side: Side,
  log: BattleEvent[],
  ignoreShield = false,
): number {
  if (rawDamage <= 0) return 0;
  // Random negation passive (e.g., voltank 1/6 chance).
  if (target.negateOneIn > 0 && rng.int(1, target.negateOneIn) === 1) {
    const passive = passives.find(
      (p) => p.effect.kind === 'damage_negate_chance' && p.trigger.kind === 'on_take_damage',
    );
    if (passive) log.push({ kind: 'passive', player: side, passiveId: passive.id });
    return 0;
  }
  let dmg = rawDamage;
  if (!ignoreShield && target.shield > 0) {
    const absorbed = Math.min(target.shield, dmg);
    target.shield -= absorbed;
    dmg -= absorbed;
  }
  if (target.damageReduction > 0) {
    const passive = passives.find(
      (p) => p.effect.kind === 'damage_reduction' && p.trigger.kind === 'on_take_damage',
    );
    if (passive && dmg > 0) log.push({ kind: 'passive', player: side, passiveId: passive.id });
    dmg = Math.max(0, dmg - target.damageReduction);
  }
  return dmg;
}

function resolveAttack(args: {
  attacker: CombatStats;
  defender: CombatStats;
  defenderPassives: PassiveSkill[];
  effect: Extract<SkillEffect, { kind: 'attack' }>;
  attackerSide: Side;
  defenderSide: Side;
  rng: RNG;
  log: BattleEvent[];
}): void {
  const { attacker, defender, defenderPassives, effect, attackerSide, defenderSide, rng, log } = args;
  const stat = effect.useStat === 'atk' ? effStat(attacker, 'atk') : effStat(attacker, 'spd');
  let mult = effect.mult * attacker.nextAmp;
  // Per-active stacking amp (e.g., chronoa).
  if (attacker.perActiveAmp > 0) {
    mult += attacker.perActiveAmp * attacker.activesUsedCount;
  }
  let baseDamage = stat * mult;
  const isFirstAttack = !attacker.firstAttackMade;
  const ignoreDef = isFirstAttack && attacker.firstAttackTrue;

  if (isFirstAttack && attacker.firstAttackAmp > 0) {
    baseDamage += attacker.firstAttackAmp * stat;
  }
  const def = ignoreDef ? 0 : effStat(defender, 'def');
  const raw = Math.max(1, Math.floor(baseDamage - def));
  const actual = takeDamage(defender, raw, rng, defenderPassives, defenderSide, log, ignoreDef);
  defender.hp -= actual;
  log.push({
    kind: 'damage',
    from: attackerSide,
    to: defenderSide,
    amount: actual,
    hpAfter: defender.hp,
  });
}

function applySkill(args: {
  user: CombatStats;
  target: CombatStats;
  userPassives: PassiveSkill[];
  targetPassives: PassiveSkill[];
  skill: ActiveSkill;
  userSide: Side;
  targetSide: Side;
  rng: RNG;
  log: BattleEvent[];
}): void {
  const { user, target, targetPassives, skill, userSide, targetSide, rng, log } = args;
  // Nullification check: opponent flagged nullify on us.
  if (user.nullifyOpponentNext) {
    user.nullifyOpponentNext = false;
    log.push({ kind: 'nullified', player: userSide, skillId: skill.id });
    consumeOnceBuffs(user);
    user.nextAmp = 1;
    user.activesUsedCount += 1;
    return;
  }
  log.push({ kind: 'skill_use', player: userSide, skillId: skill.id, name: skill.name });
  const e = skill.effect;
  switch (e.kind) {
    case 'attack': {
      resolveAttack({
        attacker: user,
        defender: target,
        defenderPassives: targetPassives,
        effect: e,
        attackerSide: userSide,
        defenderSide: targetSide,
        rng,
        log,
      });
      user.firstAttackMade = true;
      break;
    }
    case 'true_damage': {
      let dmg = Math.floor(e.amount * user.nextAmp);
      const actual = takeDamage(target, dmg, rng, targetPassives, targetSide, log, true);
      target.hp -= actual;
      log.push({ kind: 'damage', from: userSide, to: targetSide, amount: actual, hpAfter: target.hp });
      user.firstAttackMade = true;
      break;
    }
    case 'heal': {
      user.hp += e.amount;
      log.push({ kind: 'heal', player: userSide, amount: e.amount, hpAfter: user.hp });
      break;
    }
    case 'shield': {
      user.shield += e.amount;
      log.push({ kind: 'shield', player: userSide, amount: e.amount });
      break;
    }
    case 'buff_self': {
      applyStatMod(user, e.stat, e.amount, e.duration);
      log.push({ kind: 'buff', player: userSide, stat: e.stat, amount: e.amount, duration: e.duration });
      break;
    }
    case 'debuff_target': {
      applyStatMod(target, e.stat, -e.amount, e.duration);
      log.push({ kind: 'debuff', player: targetSide, stat: e.stat, amount: e.amount, duration: e.duration });
      break;
    }
    case 'next_amp': {
      user.nextAmp = e.mult;
      log.push({ kind: 'amp_set', player: userSide, mult: e.mult });
      // next_amp itself does NOT consume the once buffs / nextAmp value (it sets it).
      user.activesUsedCount += 1;
      return;
    }
    case 'nullify_next': {
      target.nullifyOpponentNext = true;
      log.push({ kind: 'nullified', player: targetSide, skillId: 'pending' });
      break;
    }
  }
  // After applying, per-active counters update and once-buffs/amp consume.
  consumeOnceBuffs(user);
  user.nextAmp = 1;
  user.activesUsedCount += 1;
}

function rollFirst(
  a: CombatStats,
  b: CombatStats,
  aBonus: number,
  bBonus: number,
  rng: RNG,
  log: BattleEvent[],
): Side {
  while (true) {
    const dieA = rng.d6();
    const dieB = rng.d6();
    const totalA = effStat(a, 'spd') + dieA + aBonus;
    const totalB = effStat(b, 'spd') + dieB + bBonus;
    log.push({ kind: 'roll', player: 'a', spd: effStat(a, 'spd') + aBonus, die: dieA, total: totalA });
    log.push({ kind: 'roll', player: 'b', spd: effStat(b, 'spd') + bBonus, die: dieB, total: totalB });
    if (totalA > totalB) return 'a';
    if (totalB > totalA) return 'b';
    // tie: re-roll
  }
}

/**
 * Run a battle between two monsters. Battle is deterministic given the seed.
 *
 * Spec:
 *  - First attacker decided by d6 + SPD; reroll on tie.
 *  - Sides alternate; on each turn the current side uses its NEXT active skill (top-down).
 *  - Damage = max(1, floor(damageExpr) - DEF), unless true_damage which ignores DEF.
 *  - HP can go negative; processing continues until BOTH sides have used all actives.
 *  - Winner: whoever reduced opponent HP to <= 0 first. If neither, higher remaining HP.
 *  - Ties broken by SPD, then 'draw'.
 */
export function runBattle(a: Monster, b: Monster, seed: number): BattleResult {
  const rng = new RNG(seed);
  const log: BattleEvent[] = [];
  const sa = initCombat(a);
  const sb = initCombat(b);

  const { spdRollBonus: aBonus } = applyBattleStartPassives(a.passives, sa, 'a', rng, log);
  const { spdRollBonus: bBonus } = applyBattleStartPassives(b.passives, sb, 'b', rng, log);

  const first = rollFirst(sa, sb, aBonus, bBonus, rng, log);
  log.push({ kind: 'first', player: first });
  const second = other(first);

  const sides: Record<Side, { state: CombatStats; mon: Monster }> = {
    a: { state: sa, mon: a },
    b: { state: sb, mon: b },
  };

  // Track whether the side with HP<=0 already exists, but per spec we keep going
  // until both sides have exhausted actives.
  let current: Side = first;
  while (sides.a.state.skillIdx < sides.a.mon.actives.length || sides.b.state.skillIdx < sides.b.mon.actives.length) {
    const cur = sides[current];
    const opp = sides[other(current)];
    if (cur.state.skillIdx < cur.mon.actives.length) {
      applyTurnStartPassives(cur.mon.passives, cur.state, current, log);
      const skill = cur.mon.actives
        .slice()
        .sort((x, y) => x.order - y.order)[cur.state.skillIdx]!;
      cur.state.skillIdx += 1;
      applySkill({
        user: cur.state,
        target: opp.state,
        userPassives: cur.mon.passives,
        targetPassives: opp.mon.passives,
        skill,
        userSide: current,
        targetSide: other(current),
        rng,
        log,
      });
    }
    current = current === first ? second : first;
  }

  // Decide winner.
  const aDead = sides.a.state.hp <= 0;
  const bDead = sides.b.state.hp <= 0;
  let winner: 'a' | 'b' | 'draw';
  let reason: 'hp_zero' | 'tiebreak_hp' | 'tiebreak_spd' | 'draw';
  if (aDead && bDead) {
    if (sides.a.state.hp > sides.b.state.hp) { winner = 'a'; reason = 'hp_zero'; }
    else if (sides.b.state.hp > sides.a.state.hp) { winner = 'b'; reason = 'hp_zero'; }
    else if (effStat(sides.a.state, 'spd') > effStat(sides.b.state, 'spd')) { winner = 'a'; reason = 'tiebreak_spd'; }
    else if (effStat(sides.b.state, 'spd') > effStat(sides.a.state, 'spd')) { winner = 'b'; reason = 'tiebreak_spd'; }
    else { winner = 'draw'; reason = 'draw'; }
  } else if (aDead) {
    winner = 'b'; reason = 'hp_zero';
  } else if (bDead) {
    winner = 'a'; reason = 'hp_zero';
  } else {
    if (sides.a.state.hp > sides.b.state.hp) { winner = 'a'; reason = 'tiebreak_hp'; }
    else if (sides.b.state.hp > sides.a.state.hp) { winner = 'b'; reason = 'tiebreak_hp'; }
    else if (effStat(sides.a.state, 'spd') > effStat(sides.b.state, 'spd')) { winner = 'a'; reason = 'tiebreak_spd'; }
    else if (effStat(sides.b.state, 'spd') > effStat(sides.a.state, 'spd')) { winner = 'b'; reason = 'tiebreak_spd'; }
    else { winner = 'draw'; reason = 'draw'; }
  }
  log.push({ kind: 'end', winner, reason });
  return { winner, log, finalHp: { a: sides.a.state.hp, b: sides.b.state.hp } };
}
