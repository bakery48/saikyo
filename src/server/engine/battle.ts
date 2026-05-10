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

/**
 * Feature flag for the SPD-based dodge mechanic. Flip to false to disable
 * with no other code changes — every miss check is gated on this.
 *
 * When enabled, before an attack lands the engine compares the defender's
 * effective SPD with the attacker's. If the defender is faster, a percentage
 * miss roll happens:
 *   diff = 1   → 10% miss
 *   diff ≥ 10  → 50% miss
 *   diff 2-9   → linear interpolation between the two
 */
export const SPD_DODGE_ENABLED = true;

type CombatStats = Stats & {
  /** Cap for hp during this battle. Frozen at the battle-start value. */
  maxHp: number;
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
  /** Number of own active skills resolved so far (referenced by atk_per_active passive). */
  activesUsedCount: number;
  /** Permanent damage reduction from passives. */
  damageReduction: number;
  /** Random damage negation chance (1 in N). 0 = none. */
  negateOneIn: number;
  /** Flat % bonus to the SPD dodge roll (added on top of SPD-diff %). */
  dodgeBonusPercent: number;
  /** First-attack damage multiplier (additive amount applied as flat amp). */
  firstAttackAmp: number;
  /** First attack treats as true damage / ignores DEF. */
  firstAttackTrue: boolean;
  /** First attack divides target's DEF by this value (1 = no effect). */
  firstAttackDefDiv: number;
  /** First attack's final damage is multiplied by this value (1 = no effect). */
  firstAttackDamageMult: number;
  /** True if this side has an unused endure_fatal passive (≤0 hp clamped to 1 once). */
  endureFatalAvailable: boolean;
  /** Pending turn skips inflicted by `pause_opponent`. Decremented when this side's turn comes up. */
  skipTurnsRemaining: number;
  /** Extra repetitions queued by `next_multi_attack` for the next own active. */
  pendingMultiAttack: number;
  /** Self-damage taken if the next skill isn't an attack while `pendingMultiAttack` > 0. */
  pendingMultiAttackPenalty: number;
  /** Number of incoming-damage instances that will be fully absorbed by `absorb_first_hit`. */
  absorbHitsRemaining: number;
  /** Skill instance IDs that have been consumed and should be skipped during forward play (rewind cards). */
  consumedSkillIds: Set<string>;
  /** Per-skill use counts for this battle (used by `deja_vu_attack`). */
  skillUseCounts: Record<string, number>;
  /**
   * Set up by `share_damage_next`: the next time this side takes attack damage,
   * reflect this percent of it back to the attacker as true damage. Then reset to 0.
   */
  shareDamageNextPercent: number;
  /** Has this side taken at least one damage instance? Used by first_received_damage_div. */
  firstDamageReceived: boolean;
  /** Stored copy of this side's most recently used skill effect, for `mimic_last`. */
  lastUsedEffect: SkillEffect | null;
  /** Most recent damage actually taken by this side. Used by `counter_strike`. */
  lastDamageTaken: number;
  /** Once true (set by `pin_attack`), this side can no longer dodge incoming attacks. */
  cannotDodge: boolean;
  passiveIds: string[];
};

function initCombat(m: Monster): CombatStats {
  const c: CombatStats = {
    hp: m.stats.hp,
    maxHp: m.stats.hp,
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
    damageReduction: 0,
    negateOneIn: 0,
    dodgeBonusPercent: 0,
    firstAttackAmp: 0,
    firstAttackTrue: false,
    firstAttackDefDiv: 1,
    firstAttackDamageMult: 1,
    endureFatalAvailable: m.passives.some((p) => p.effect.kind === 'endure_fatal'),
    skipTurnsRemaining: 0,
    pendingMultiAttack: 0,
    pendingMultiAttackPenalty: 0,
    absorbHitsRemaining: m.passives.filter((p) => p.effect.kind === 'absorb_first_hit').length,
    consumedSkillIds: new Set(),
    skillUseCounts: {},
    shareDamageNextPercent: 0,
    firstDamageReceived: false,
    lastUsedEffect: null,
    lastDamageTaken: 0,
    cannotDodge: false,
    passiveIds: [],
  };
  return c;
}

/** Flip every active skill's `order` so the highest-ordered skill goes first. */
function reverseMonsterActives(m: Monster): void {
  const max = m.actives.length;
  for (const a of m.actives) a.order = max + 1 - a.order;
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
  else if (key === 'hp') healCapped(c, amount);
}

/** Increase hp without exceeding maxHp. Returns the actual amount applied. */
function healCapped(c: CombatStats, amount: number): number {
  if (amount <= 0) {
    c.hp += amount;
    return amount;
  }
  const applied = Math.max(0, Math.min(amount, c.maxHp - c.hp));
  c.hp += applied;
  return applied;
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
      case 'dodge_bonus':
        self.dodgeBonusPercent += p.effect.percent;
        break;
      case 'first_attack_amp':
        self.firstAttackAmp += p.effect.amount;
        break;
      case 'first_attack_true':
        self.firstAttackTrue = true;
        break;
      case 'first_attack_def_div':
        // Larger divisors override smaller ones if multiple stack.
        self.firstAttackDefDiv = Math.max(self.firstAttackDefDiv, p.effect.denominator);
        break;
      case 'first_attack_damage_mult':
        // Multiplicative stacking when several effects layer.
        self.firstAttackDamageMult *= p.effect.mult;
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
      const applied = healCapped(self, p.effect.amount);
      if (applied > 0) {
        log.push({ kind: 'heal', player: side, amount: applied, hpAfter: self.hp });
        log.push({ kind: 'passive', player: side, passiveId: p.id });
      }
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
  // 影武者 absorb_first_hit: fully eat the first incoming damage instance.
  if (target.absorbHitsRemaining > 0) {
    target.absorbHitsRemaining -= 1;
    const passive = passives.find((p) => p.effect.kind === 'absorb_first_hit');
    if (passive) log.push({ kind: 'passive', player: side, passiveId: passive.id });
    return 0;
  }
  // Random negation passive (e.g., voltank 1/6 chance).
  if (target.negateOneIn > 0 && rng.int(1, target.negateOneIn) === 1) {
    const passive = passives.find(
      (p) => p.effect.kind === 'damage_negate_chance' && p.trigger.kind === 'on_take_damage',
    );
    if (passive) log.push({ kind: 'passive', player: side, passiveId: passive.id });
    return 0;
  }
  let dmg = rawDamage;
  // 慎重派 first_received_damage_div: first damage instance per battle is divided.
  if (!target.firstDamageReceived) {
    for (const p of passives) {
      if (p.effect.kind === 'first_received_damage_div') {
        const denom = Math.max(1, p.effect.denominator);
        dmg = Math.floor(dmg / denom);
        log.push({ kind: 'passive', player: side, passiveId: p.id });
      }
    }
    target.firstDamageReceived = true;
  }
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
  // 逆境 low_hp_damage_reduction: extra reduction while at or below half HP.
  if (target.maxHp > 0 && target.hp * 2 <= target.maxHp) {
    for (const p of passives) {
      if (p.effect.kind === 'low_hp_damage_reduction' && dmg > 0) {
        const reduce = p.effect.amount;
        dmg = Math.max(0, dmg - reduce);
        log.push({ kind: 'passive', player: side, passiveId: p.id });
      }
    }
  }
  // damage_cap: clamp final damage per hit.
  for (const p of passives) {
    if (p.effect.kind === 'damage_cap' && dmg > p.effect.maxPerHit) {
      dmg = p.effect.maxPerHit;
      log.push({ kind: 'passive', player: side, passiveId: p.id });
    }
  }
  // mid_damage_immune: nullify if final dmg falls in [min, max].
  for (const p of passives) {
    if (p.effect.kind === 'mid_damage_immune' && dmg >= p.effect.min && dmg <= p.effect.max) {
      log.push({ kind: 'passive', player: side, passiveId: p.id });
      return 0;
    }
  }
  // rage_atk: gain ATK every time this side actually takes damage.
  if (dmg > 0) {
    for (const p of passives) {
      if (p.effect.kind === 'rage_atk') {
        target.atkMod += p.effect.amount;
        log.push({
          kind: 'buff',
          player: side,
          stat: 'atk',
          amount: p.effect.amount,
          duration: 'battle',
        });
        log.push({ kind: 'passive', player: side, passiveId: p.id });
      }
    }
  }
  if (dmg > 0) target.lastDamageTaken = dmg;
  return dmg;
}

function resolveAttack(args: {
  attacker: CombatStats;
  defender: CombatStats;
  attackerPassives: PassiveSkill[];
  defenderPassives: PassiveSkill[];
  effect: Extract<SkillEffect, { kind: 'attack' }>;
  attackerSide: Side;
  defenderSide: Side;
  rng: RNG;
  log: BattleEvent[];
}): void {
  const {
    attacker,
    defender,
    attackerPassives,
    defenderPassives,
    effect,
    attackerSide,
    defenderSide,
    rng,
    log,
  } = args;
  // Dodge: SPD-diff + passive bonuses can fully evade the attack.
  if (rollDodge(attacker, defender, rng)) {
    log.push({ kind: 'miss', from: attackerSide, to: defenderSide });
    return;
  }
  // atk_per_active passives (potentially multiple, each with its own
  // amount/every) contribute to ATK based on how many actives are used so far.
  let atkBoost = 0;
  for (const p of attackerPassives) {
    if (p.effect.kind === 'atk_per_active') {
      const every = p.effect.every ?? 1;
      atkBoost += p.effect.amount * Math.floor(attacker.activesUsedCount / every);
    }
  }
  // low_hp_atk_bonus: dynamic — only counts while at or below half HP.
  const isLowHp = attacker.maxHp > 0 && attacker.hp * 2 <= attacker.maxHp;
  if (isLowHp) {
    for (const p of attackerPassives) {
      if (p.effect.kind === 'low_hp_atk_bonus') {
        atkBoost += p.effect.amount;
      }
    }
  }
  const stat =
    effect.useStat === 'atk'
      ? effStat(attacker, 'atk') + atkBoost
      : effStat(attacker, 'spd');
  const mult = effect.mult * attacker.nextAmp;
  let baseDamage = stat * mult;
  const isFirstAttack = !attacker.firstAttackMade;
  const ignoreDef = isFirstAttack && attacker.firstAttackTrue;

  if (isFirstAttack && attacker.firstAttackAmp > 0) {
    baseDamage += attacker.firstAttackAmp * stat;
  }
  let def = ignoreDef ? 0 : effStat(defender, 'def');
  if (!ignoreDef && isFirstAttack && attacker.firstAttackDefDiv > 1) {
    def = Math.floor(def / attacker.firstAttackDefDiv);
  }
  let raw = Math.max(1, Math.floor(baseDamage - def));
  if (isFirstAttack && attacker.firstAttackDamageMult > 1) {
    raw = Math.max(1, Math.floor(raw * attacker.firstAttackDamageMult));
  }
  // クリティカル crit_chance: roll once per attack; on proc, multiply post-DEF damage.
  for (const p of attackerPassives) {
    if (p.effect.kind === 'crit_chance' && rng.next() < p.effect.percent / 100) {
      raw = Math.max(1, Math.floor(raw * p.effect.mult));
      log.push({ kind: 'passive', player: attackerSide, passiveId: p.id });
      break;
    }
  }
  let actual = takeDamage(defender, raw, rng, defenderPassives, defenderSide, log, ignoreDef);
  actual = clampWithEndure(defender, actual, defenderPassives, defenderSide, log);
  defender.hp -= actual;
  log.push({
    kind: 'damage',
    from: attackerSide,
    to: defenderSide,
    amount: actual,
    hpAfter: defender.hp,
  });
  // low_damage_bonus: if the hit dealt ≤ threshold, add bonus true damage.
  for (const p of attackerPassives) {
    if (p.effect.kind === 'low_damage_bonus' && actual <= p.effect.threshold) {
      const bonus = p.effect.bonus;
      defender.hp -= bonus;
      log.push({ kind: 'passive', player: attackerSide, passiveId: p.id });
      log.push({ kind: 'damage', from: attackerSide, to: defenderSide, amount: bonus, hpAfter: defender.hp });
      break;
    }
  }
  // bonus_vs_low_hp: extra true damage when the defender is below half HP.
  if (actual > 0 && defender.maxHp > 0 && defender.hp * 2 <= defender.maxHp) {
    for (const p of attackerPassives) {
      if (p.effect.kind === 'bonus_vs_low_hp') {
        const bonus = p.effect.amount;
        defender.hp -= bonus;
        log.push({ kind: 'passive', player: attackerSide, passiveId: p.id });
        log.push({ kind: 'damage', from: attackerSide, to: defenderSide, amount: bonus, hpAfter: defender.hp });
      }
    }
  }
  // share_damage_next: reflect a portion of the dealt damage back to the attacker.
  if (actual > 0 && defender.shareDamageNextPercent > 0) {
    const reflectPct = defender.shareDamageNextPercent;
    defender.shareDamageNextPercent = 0;
    const reflect = Math.max(1, Math.floor((actual * reflectPct) / 100));
    let r = takeDamage(attacker, reflect, rng, attackerPassives, attackerSide, log, true);
    r = clampWithEndure(attacker, r, attackerPassives, attackerSide, log);
    attacker.hp -= r;
    log.push({ kind: 'damage', from: defenderSide, to: attackerSide, amount: r, hpAfter: attacker.hp });
  }
  // paralyze_chance: roll on every successful hit; on proc the defender skips a turn.
  if (actual > 0) {
    for (const p of attackerPassives) {
      if (p.effect.kind === 'paralyze_chance' && rng.next() < p.effect.percent / 100) {
        defender.skipTurnsRemaining += 1;
        log.push({ kind: 'passive', player: attackerSide, passiveId: p.id });
      }
    }
  }
  applyLifesteal(attacker, attackerPassives, actual, attackerSide, log);
  applyHexDef(attacker, attackerPassives, defender, attackerSide, defenderSide, actual, log);
  applyCounterDamage(
    defender,
    defenderPassives,
    attacker,
    attackerPassives,
    attackerSide,
    defenderSide,
    actual,
    log,
  );
}

/** バグ self_decay: applied after each own active skill resolves. */
function applySelfDecay(
  user: CombatStats,
  userPassives: PassiveSkill[],
  userSide: Side,
  log: BattleEvent[],
): void {
  for (const p of userPassives) {
    if (p.effect.kind !== 'self_decay') continue;
    if (p.trigger.kind !== 'on_own_active_used') continue;
    const e = p.effect;
    if (e.hp > 0) {
      user.hp -= e.hp;
      log.push({ kind: 'damage', from: userSide, to: userSide, amount: e.hp, hpAfter: user.hp });
    }
    if (e.atk > 0) {
      user.atkMod -= e.atk;
      log.push({ kind: 'debuff', player: userSide, stat: 'atk', amount: e.atk, duration: 'battle' });
    }
    if (e.def > 0) {
      user.defMod -= e.def;
      log.push({ kind: 'debuff', player: userSide, stat: 'def', amount: e.def, duration: 'battle' });
    }
    if (e.spd > 0) {
      user.spdMod -= e.spd;
      log.push({ kind: 'debuff', player: userSide, stat: 'spd', amount: e.spd, duration: 'battle' });
    }
    log.push({ kind: 'passive', player: userSide, passiveId: p.id });
  }
}

/** ケルベロス extra_attack_chance: returns true if any proc fires (only one per skill use). */
function rollExtraAttack(
  user: CombatStats,
  userPassives: PassiveSkill[],
  userSide: Side,
  rng: RNG,
  log: BattleEvent[],
): boolean {
  for (const p of userPassives) {
    if (p.effect.kind === 'extra_attack_chance') {
      if (rng.next() < p.effect.percent / 100) {
        log.push({ kind: 'passive', player: userSide, passiveId: p.id });
        return true;
      }
      // Only one such passive should attempt to proc per skill use.
      break;
    }
  }
  return false;
}

/** ウィザード hex_def: each successful hit shaves DEF off the target permanently (battle-only). */
function applyHexDef(
  attacker: CombatStats,
  attackerPassives: PassiveSkill[],
  defender: CombatStats,
  attackerSide: Side,
  defenderSide: Side,
  damageDealt: number,
  log: BattleEvent[],
): void {
  if (damageDealt <= 0) return;
  for (const p of attackerPassives) {
    if (p.effect.kind === 'hex_def') {
      defender.defMod -= p.effect.amount;
      log.push({
        kind: 'debuff',
        player: defenderSide,
        stat: 'def',
        amount: p.effect.amount,
        duration: 'battle',
      });
      log.push({ kind: 'passive', player: attackerSide, passiveId: p.id });
    }
  }
}

/** カーバンクル counter_damage: reflect a fraction of incoming damage back to the attacker. */
function applyCounterDamage(
  defender: CombatStats,
  defenderPassives: PassiveSkill[],
  attacker: CombatStats,
  attackerPassives: PassiveSkill[],
  attackerSide: Side,
  defenderSide: Side,
  damageDealt: number,
  log: BattleEvent[],
): void {
  if (damageDealt <= 0) return;
  for (const p of defenderPassives) {
    if (p.effect.kind === 'counter_damage') {
      const denom = Math.max(1, p.effect.denominator);
      let counter = Math.floor(damageDealt / denom);
      if (counter <= 0) continue;
      counter = clampWithEndure(attacker, counter, attackerPassives, attackerSide, log);
      attacker.hp -= counter;
      log.push({
        kind: 'damage',
        from: defenderSide,
        to: attackerSide,
        amount: counter,
        hpAfter: attacker.hp,
      });
      log.push({ kind: 'passive', player: defenderSide, passiveId: p.id });
    }
  }
}

/**
 * Total dodge percentage = SPD-diff curve (gated on SPD_DODGE_ENABLED) +
 * any dodge_bonus passive on the defender. Returns true if the attack misses.
 */
function rollDodge(attacker: CombatStats, defender: CombatStats, rng: RNG): boolean {
  if (defender.cannotDodge) return false;
  let pct = 0;
  if (SPD_DODGE_ENABLED) {
    const diff = effStat(defender, 'spd') - effStat(attacker, 'spd');
    if (diff > 0) {
      const clamped = Math.min(10, diff);
      // 10% at diff=1, 50% at diff=10, linear in between.
      pct = 10 + ((clamped - 1) * 40) / 9;
    }
  }
  pct += defender.dodgeBonusPercent;
  if (pct <= 0) return false;
  return rng.next() < pct / 100;
}

/**
 * If the incoming damage would drop hp to ≤ 0 and the side still has an
 * unused endure_fatal passive, clamp the damage so the defender survives.
 * Revival HP defaults to 1; if `reviveDenominator` is set on the passive,
 * leave floor(maxHp / N) (clamped to ≥1) instead.
 */
function clampWithEndure(
  defender: CombatStats,
  damage: number,
  passives: PassiveSkill[],
  side: Side,
  log: BattleEvent[],
): number {
  if (damage <= 0) return damage;
  if (!defender.endureFatalAvailable) return damage;
  if (defender.hp - damage > 0) return damage;
  defender.endureFatalAvailable = false;
  const passive = passives.find((p) => p.effect.kind === 'endure_fatal');
  if (passive) log.push({ kind: 'passive', player: side, passiveId: passive.id });
  let reviveHp = 1;
  if (passive && passive.effect.kind === 'endure_fatal' && passive.effect.reviveDenominator) {
    reviveHp = Math.max(1, Math.floor(defender.maxHp / passive.effect.reviveDenominator));
  }
  return Math.max(0, defender.hp - reviveHp);
}

/** Heal the attacker by floor(damage / denominator) per the lifesteal passive, if present. */
function applyLifesteal(
  attacker: CombatStats,
  passives: PassiveSkill[],
  damageDealt: number,
  side: Side,
  log: BattleEvent[],
): void {
  if (damageDealt <= 0) return;
  const passive = passives.find((p) => p.effect.kind === 'lifesteal');
  if (!passive || passive.effect.kind !== 'lifesteal') return;
  const denom = Math.max(1, passive.effect.denominator);
  const heal = Math.floor(damageDealt / denom);
  if (heal <= 0) return;
  const applied = healCapped(attacker, heal);
  if (applied > 0) {
    log.push({ kind: 'heal', player: side, amount: applied, hpAfter: attacker.hp });
    log.push({ kind: 'passive', player: side, passiveId: passive.id });
  }
}

function applySkill(args: {
  user: CombatStats;
  target: CombatStats;
  userPassives: PassiveSkill[];
  targetPassives: PassiveSkill[];
  /** User's monster — needed for rewind/replay lookups in the actives list. */
  userMon: Monster;
  /** Target's monster — needed by effects that mutate the opponent's actives (e.g. shuffle). */
  targetMon: Monster;
  skill: ActiveSkill;
  userSide: Side;
  targetSide: Side;
  rng: RNG;
  log: BattleEvent[];
}): void {
  const { user, target, userPassives, targetPassives, userMon, targetMon, skill, userSide, targetSide, rng, log } = args;
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
  // Multi-attack pending: only attack/true_damage qualify; otherwise fizzle and self-damage.
  if (user.pendingMultiAttack > 0 && e.kind !== 'attack' && e.kind !== 'true_damage') {
    const penalty = user.pendingMultiAttackPenalty;
    user.pendingMultiAttack = 0;
    user.pendingMultiAttackPenalty = 0;
    if (penalty > 0) {
      user.hp -= penalty;
      log.push({ kind: 'damage', from: userSide, to: userSide, amount: penalty, hpAfter: user.hp });
    }
    log.push({ kind: 'skill_fizzle', player: userSide, skillId: skill.id, selfDamage: penalty });
    consumeOnceBuffs(user);
    user.nextAmp = 1;
    user.activesUsedCount += 1;
    applySelfDecay(user, userPassives, userSide, log);
    return;
  }
  switch (e.kind) {
    case 'attack': {
      const runAttack = (): void => {
        resolveAttack({
          attacker: user,
          defender: target,
          attackerPassives: userPassives,
          defenderPassives: targetPassives,
          effect: e,
          attackerSide: userSide,
          defenderSide: targetSide,
          rng,
          log,
        });
      };
      const repeats = 1 + user.pendingMultiAttack;
      user.pendingMultiAttack = 0;
      user.pendingMultiAttackPenalty = 0;
      for (let i = 0; i < repeats; i++) runAttack();
      user.firstAttackMade = true;
      // ケルベロス extra_attack_chance: 一度だけ proc を試行して再発動。
      if (rollExtraAttack(user, userPassives, userSide, rng, log)) {
        runAttack();
      }
      break;
    }
    case 'true_damage': {
      const runTrueDamage = (): void => {
        if (rollDodge(user, target, rng)) {
          log.push({ kind: 'miss', from: userSide, to: targetSide });
          return;
        }
        const dmg = Math.floor(e.amount * user.nextAmp);
        let actual = takeDamage(target, dmg, rng, targetPassives, targetSide, log, true);
        actual = clampWithEndure(target, actual, targetPassives, targetSide, log);
        target.hp -= actual;
        log.push({ kind: 'damage', from: userSide, to: targetSide, amount: actual, hpAfter: target.hp });
        applyLifesteal(user, userPassives, actual, userSide, log);
        applyHexDef(user, userPassives, target, userSide, targetSide, actual, log);
        applyCounterDamage(
          target,
          targetPassives,
          user,
          userPassives,
          userSide,
          targetSide,
          actual,
          log,
        );
      };
      const repeats = 1 + user.pendingMultiAttack;
      user.pendingMultiAttack = 0;
      user.pendingMultiAttackPenalty = 0;
      for (let i = 0; i < repeats; i++) runTrueDamage();
      user.firstAttackMade = true;
      if (rollExtraAttack(user, userPassives, userSide, rng, log)) {
        runTrueDamage();
      }
      break;
    }
    case 'heal': {
      const applied = healCapped(user, e.amount);
      log.push({ kind: 'heal', player: userSide, amount: applied, hpAfter: user.hp });
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
      applySelfDecay(user, userPassives, userSide, log);
      return;
    }
    case 'nullify_next': {
      target.nullifyOpponentNext = true;
      log.push({ kind: 'nullified', player: targetSide, skillId: 'pending' });
      break;
    }
    case 'pause_opponent': {
      target.skipTurnsRemaining += 1;
      // The actual skip is logged later when the opponent's turn is consumed.
      break;
    }
    case 'shuffle_opponent_actives': {
      const sorted = targetMon.actives.slice().sort((x, y) => x.order - y.order);
      const remaining = sorted.slice(target.skillIdx);
      if (remaining.length > 1) {
        const orders = remaining.map((a) => a.order);
        const shuffled = remaining.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = rng.int(0, i);
          [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
        }
        for (let i = 0; i < shuffled.length; i++) {
          shuffled[i]!.order = orders[i]!;
        }
      }
      log.push({ kind: 'actives_shuffled', player: targetSide });
      break;
    }
    case 'next_multi_attack': {
      user.pendingMultiAttack = e.extraCount;
      user.pendingMultiAttackPenalty = e.failurePenalty;
      // Mirror next_amp's bookkeeping: don't consume once-buffs/amp here, just
      // count the active and return so the next skill carries the flag.
      user.activesUsedCount += 1;
      applySelfDecay(user, userPassives, userSide, log);
      return;
    }
    case 'pay_hp_shield': {
      user.hp -= e.hpCost;
      log.push({ kind: 'damage', from: userSide, to: userSide, amount: e.hpCost, hpAfter: user.hp });
      user.shield += e.shieldAmount;
      log.push({ kind: 'shield', player: userSide, amount: e.shieldAmount });
      break;
    }
    case 'pay_hp_debuff_all': {
      user.hp -= e.hpCost;
      log.push({ kind: 'damage', from: userSide, to: userSide, amount: e.hpCost, hpAfter: user.hp });
      for (const stat of ['atk', 'def', 'spd'] as const) {
        applyStatMod(target, stat, -e.amount, 'battle');
        log.push({ kind: 'debuff', player: targetSide, stat, amount: e.amount, duration: 'battle' });
      }
      break;
    }
    case 'gamble_true_damage': {
      const win = rng.next() < e.percent / 100;
      if (win) {
        let actual = takeDamage(target, e.amount, rng, targetPassives, targetSide, log, true);
        actual = clampWithEndure(target, actual, targetPassives, targetSide, log);
        target.hp -= actual;
        log.push({ kind: 'damage', from: userSide, to: targetSide, amount: actual, hpAfter: target.hp });
      } else {
        user.hp -= e.amount;
        log.push({ kind: 'damage', from: userSide, to: userSide, amount: e.amount, hpAfter: user.hp });
      }
      break;
    }
    case 'buff_self_all': {
      for (const stat of ['atk', 'def', 'spd'] as const) {
        applyStatMod(user, stat, e.amount, e.duration);
        log.push({ kind: 'buff', player: userSide, stat, amount: e.amount, duration: e.duration });
      }
      break;
    }
    case 'multi_hit_attack': {
      const attackEffect: Extract<typeof e, { kind: 'multi_hit_attack' }> = e;
      const runHit = (): void => {
        resolveAttack({
          attacker: user,
          defender: target,
          attackerPassives: userPassives,
          defenderPassives: targetPassives,
          effect: { kind: 'attack', mult: attackEffect.mult, useStat: attackEffect.useStat },
          attackerSide: userSide,
          defenderSide: targetSide,
          rng,
          log,
        });
      };
      for (let i = 0; i < e.hitCount; i++) runHit();
      user.firstAttackMade = true;
      if (rollExtraAttack(user, userPassives, userSide, rng, log)) runHit();
      break;
    }
    case 'heal_max_fraction': {
      const denom = Math.max(1, e.denominator);
      const amount = Math.max(0, Math.floor(user.maxHp / denom));
      const applied = healCapped(user, amount);
      log.push({ kind: 'heal', player: userSide, amount: applied, hpAfter: user.hp });
      break;
    }
    case 'rewind_skill': {
      // Self-damage always applies, even if the rewind itself fizzles.
      if (e.selfDamage > 0) {
        user.hp -= e.selfDamage;
        log.push({ kind: 'damage', from: userSide, to: userSide, amount: e.selfDamage, hpAfter: user.hp });
      }
      // Mark this rewind card as consumed so it's skipped on forward replay.
      user.consumedSkillIds.add(skill.id);
      const sorted = userMon.actives.slice().sort((x, y) => x.order - y.order);
      const thisIdx = sorted.findIndex((a) => a.id === skill.id);
      const targetIdx = thisIdx - e.rewindBy;
      if (targetIdx < 0) {
        // Not enough prior skills to rewind to — fizzle (self-damage already applied).
        log.push({ kind: 'skill_fizzle', player: userSide, skillId: skill.id, selfDamage: 0 });
        break;
      }
      // Rewind: next forward fetch will start at targetIdx (or skip past consumed slots).
      user.skillIdx = targetIdx;
      break;
    }
    case 'drain_hp': {
      const amount = Math.min(e.amount, Math.max(0, target.hp));
      if (amount > 0) {
        target.hp -= amount;
        log.push({ kind: 'damage', from: userSide, to: targetSide, amount, hpAfter: target.hp });
        const healed = healCapped(user, amount);
        if (healed > 0) log.push({ kind: 'heal', player: userSide, amount: healed, hpAfter: user.hp });
      }
      break;
    }
    case 'steal_stat': {
      const amt = e.amount;
      const statKey = e.stat;
      // Debuff target
      applyStatMod(target, statKey, -amt, 'battle');
      log.push({ kind: 'debuff', player: targetSide, stat: statKey, amount: amt, duration: 'battle' });
      // Buff user
      applyStatMod(user, statKey, amt, 'battle');
      log.push({ kind: 'buff', player: userSide, stat: statKey, amount: amt, duration: 'battle' });
      break;
    }
    case 'debuff_all': {
      for (const stat of ['atk', 'def', 'spd'] as const) {
        applyStatMod(target, stat, -e.amount, 'battle');
        log.push({ kind: 'debuff', player: targetSide, stat, amount: e.amount, duration: 'battle' });
      }
      break;
    }
    case 'dispel': {
      // Remove positive battle-long modifiers from the opponent.
      const mods = { atk: target.atkMod, def: target.defMod, spd: target.spdMod };
      for (const [stat, mod] of Object.entries(mods) as [('atk'|'def'|'spd'), number][]) {
        if (mod > 0) {
          const removed = mod;
          applyStatMod(target, stat, -removed, 'battle');
          log.push({ kind: 'debuff', player: targetSide, stat, amount: removed, duration: 'battle' });
        }
      }
      break;
    }
    case 'shield_bash': {
      const shieldVal = user.shield;
      if (shieldVal > 0) {
        user.shield = 0;
        let actual = takeDamage(target, shieldVal, rng, targetPassives, targetSide, log, true);
        actual = clampWithEndure(target, actual, targetPassives, targetSide, log);
        target.hp -= actual;
        log.push({ kind: 'damage', from: userSide, to: targetSide, amount: actual, hpAfter: target.hp });
      }
      break;
    }
    case 'swap_hp': {
      const tmpA = user.hp;
      const tmpB = target.hp;
      user.hp = tmpB;
      target.hp = tmpA;
      log.push({ kind: 'hp_swap', playerA: userSide, playerB: targetSide, hpA: user.hp, hpB: target.hp });
      break;
    }
    case 'sacrifice_attack': {
      const cost = Math.max(1, Math.floor(user.hp * e.hpRatio));
      const actualCost = Math.min(cost, user.hp - 1); // can't die from sacrifice
      user.hp -= actualCost;
      if (actualCost > 0) {
        log.push({ kind: 'damage', from: userSide, to: userSide, amount: actualCost, hpAfter: user.hp });
      }
      if (actualCost > 0) {
        let dmg = actualCost;
        dmg = takeDamage(target, dmg, rng, targetPassives, targetSide, log, true);
        dmg = clampWithEndure(target, dmg, targetPassives, targetSide, log);
        target.hp -= dmg;
        log.push({ kind: 'damage', from: userSide, to: targetSide, amount: dmg, hpAfter: target.hp });
      }
      break;
    }
    case 'execute': {
      if (target.hp > 0 && target.hp <= e.threshold) {
        const lethal = target.hp;
        // endure_fatal can still save them once.
        let dmg = takeDamage(target, lethal, rng, targetPassives, targetSide, log, true);
        dmg = clampWithEndure(target, dmg, targetPassives, targetSide, log);
        target.hp -= dmg;
        log.push({ kind: 'damage', from: userSide, to: targetSide, amount: dmg, hpAfter: target.hp });
      }
      break;
    }
    case 'percent_max_hp_true': {
      const dmgRaw = Math.max(1, Math.floor((target.maxHp * e.percent) / 100));
      let dmg = takeDamage(target, dmgRaw, rng, targetPassives, targetSide, log, true);
      dmg = clampWithEndure(target, dmg, targetPassives, targetSide, log);
      target.hp -= dmg;
      log.push({ kind: 'damage', from: userSide, to: targetSide, amount: dmg, hpAfter: target.hp });
      break;
    }
    case 'cleanse_self': {
      if (user.atkMod < 0) {
        log.push({ kind: 'buff', player: userSide, stat: 'atk', amount: -user.atkMod, duration: 'battle' });
        user.atkMod = 0;
      }
      if (user.defMod < 0) {
        log.push({ kind: 'buff', player: userSide, stat: 'def', amount: -user.defMod, duration: 'battle' });
        user.defMod = 0;
      }
      if (user.spdMod < 0) {
        log.push({ kind: 'buff', player: userSide, stat: 'spd', amount: -user.spdMod, duration: 'battle' });
        user.spdMod = 0;
      }
      break;
    }
    case 'swap_atk_def': {
      const tmpBase = user.atk;
      user.atk = user.def;
      user.def = tmpBase;
      const tmpMod = user.atkMod;
      user.atkMod = user.defMod;
      user.defMod = tmpMod;
      break;
    }
    case 'hp_to_atk': {
      const missing = Math.max(0, user.maxHp - user.hp);
      const bonus = Math.floor(missing / e.divisor);
      if (bonus > 0) {
        user.atkMod += bonus;
        log.push({ kind: 'buff', player: userSide, stat: 'atk', amount: bonus, duration: 'battle' });
      }
      break;
    }
    case 'share_damage_next': {
      user.shareDamageNextPercent = e.percent;
      break;
    }
    case 'break_shield': {
      target.shield = 0;
      break;
    }
    case 'reckless_attack': {
      resolveAttack({
        attacker: user,
        defender: target,
        attackerPassives: userPassives,
        defenderPassives: targetPassives,
        effect: { kind: 'attack', mult: e.mult, useStat: e.useStat },
        attackerSide: userSide,
        defenderSide: targetSide,
        rng,
        log,
      });
      user.firstAttackMade = true;
      // Skip the next own slot: advance skillIdx past it. The main loop
      // already advances by one when consuming a card, so we add one more.
      // We log it as a self turn_skipped so the user can see the cost.
      user.skillIdx += 1;
      log.push({ kind: 'turn_skipped', player: userSide });
      break;
    }
    case 'mimic_last': {
      const last = target.lastUsedEffect;
      if (!last || last.kind === 'mimic_last') {
        log.push({ kind: 'skill_fizzle', player: userSide, skillId: skill.id, selfDamage: 0 });
        break;
      }
      applySkill({
        user,
        target,
        userPassives,
        targetPassives,
        userMon,
        targetMon,
        skill: { ...skill, effect: last },
        userSide,
        targetSide,
        rng,
        log,
      });
      // The recursive applySkill already handles consumeOnceBuffs/nextAmp/
      // activesUsedCount/self_decay for this active. Skip the trailing
      // bookkeeping at the end of the outer call.
      return;
    }
    case 'def_attack': {
      // DEF-based strike. We borrow resolveAttack's flow by stuffing the
      // current DEF stat into a once-buff for ATK and running an attack
      // with mult=1; then the once-buff clears as usual.
      const defStat = effStat(user, 'def') + e.flat;
      const oldOnceAtk = user.onceBuffs.atk ?? 0;
      // Substitute attacker's effective ATK with defStat by using a once buff
      // equal to (defStat - baseAtk). Computing post-mod stat:
      const baseAtk = user.atk + user.atkMod;
      user.onceBuffs.atk = oldOnceAtk + (defStat - baseAtk);
      resolveAttack({
        attacker: user,
        defender: target,
        attackerPassives: userPassives,
        defenderPassives: targetPassives,
        effect: { kind: 'attack', mult: 1, useStat: 'atk', attackKind: e.attackKind },
        attackerSide: userSide,
        defenderSide: targetSide,
        rng,
        log,
      });
      user.firstAttackMade = true;
      break;
    }
    case 'coup_de_grace': {
      // activesUsedCount is incremented at the end of applySkill; the
      // current call is the (activesUsedCount + 1)-th active.
      const slot = user.activesUsedCount + 1;
      if (slot >= e.threshold) {
        let dmg = takeDamage(target, e.amount, rng, targetPassives, targetSide, log, true);
        dmg = clampWithEndure(target, dmg, targetPassives, targetSide, log);
        target.hp -= dmg;
        log.push({ kind: 'damage', from: userSide, to: targetSide, amount: dmg, hpAfter: target.hp });
      } else {
        log.push({ kind: 'skill_fizzle', player: userSide, skillId: skill.id, selfDamage: 0 });
      }
      break;
    }
    case 'pin_attack': {
      const stat = effStat(user, e.useStat);
      const baseDamage = stat * e.mult + e.flat;
      const def = effStat(target, 'def');
      const raw = Math.max(1, Math.floor(baseDamage - def));
      let actual = takeDamage(target, raw, rng, targetPassives, targetSide, log, false);
      actual = clampWithEndure(target, actual, targetPassives, targetSide, log);
      target.hp -= actual;
      log.push({ kind: 'damage', from: userSide, to: targetSide, amount: actual, hpAfter: target.hp });
      target.cannotDodge = true;
      applyLifesteal(user, userPassives, actual, userSide, log);
      applyHexDef(user, userPassives, target, userSide, targetSide, actual, log);
      applyCounterDamage(target, targetPassives, user, userPassives, userSide, targetSide, actual, log);
      user.firstAttackMade = true;
      break;
    }
    case 'risky_attack': {
      if (rng.next() < e.missPercent / 100) {
        log.push({ kind: 'miss', from: userSide, to: targetSide });
      } else {
        resolveAttack({
          attacker: user,
          defender: target,
          attackerPassives: userPassives,
          defenderPassives: targetPassives,
          effect: { kind: 'attack', mult: e.mult, useStat: e.useStat },
          attackerSide: userSide,
          defenderSide: targetSide,
          rng,
          log,
        });
      }
      user.firstAttackMade = true;
      break;
    }
    case 'counter_strike': {
      if (user.lastDamageTaken <= 0) {
        log.push({ kind: 'skill_fizzle', player: userSide, skillId: skill.id, selfDamage: 0 });
        break;
      }
      if (rollDodge(user, target, rng)) {
        log.push({ kind: 'miss', from: userSide, to: targetSide });
      } else {
        const baseDamage = user.lastDamageTaken * e.mult;
        const def = effStat(target, 'def');
        const raw = Math.max(1, Math.floor(baseDamage - def));
        let actual = takeDamage(target, raw, rng, targetPassives, targetSide, log, false);
        actual = clampWithEndure(target, actual, targetPassives, targetSide, log);
        target.hp -= actual;
        log.push({ kind: 'damage', from: userSide, to: targetSide, amount: actual, hpAfter: target.hp });
        applyLifesteal(user, userPassives, actual, userSide, log);
        applyHexDef(user, userPassives, target, userSide, targetSide, actual, log);
        applyCounterDamage(target, targetPassives, user, userPassives, userSide, targetSide, actual, log);
      }
      user.firstAttackMade = true;
      break;
    }
    case 'attack_then_dispel': {
      const stat = effStat(user, e.useStat);
      const baseDamage = stat * e.mult + e.flat;
      if (rollDodge(user, target, rng)) {
        log.push({ kind: 'miss', from: userSide, to: targetSide });
      } else {
        const def = effStat(target, 'def');
        const raw = Math.max(1, Math.floor(baseDamage - def));
        let actual = takeDamage(target, raw, rng, targetPassives, targetSide, log, false);
        actual = clampWithEndure(target, actual, targetPassives, targetSide, log);
        target.hp -= actual;
        log.push({ kind: 'damage', from: userSide, to: targetSide, amount: actual, hpAfter: target.hp });
        applyLifesteal(user, userPassives, actual, userSide, log);
        applyHexDef(user, userPassives, target, userSide, targetSide, actual, log);
        applyCounterDamage(target, targetPassives, user, userPassives, userSide, targetSide, actual, log);
      }
      if (target.atkMod > 0) {
        log.push({ kind: 'debuff', player: targetSide, stat: 'atk', amount: target.atkMod, duration: 'battle' });
        target.atkMod = 0;
      }
      if (target.defMod > 0) {
        log.push({ kind: 'debuff', player: targetSide, stat: 'def', amount: target.defMod, duration: 'battle' });
        target.defMod = 0;
      }
      if (target.spdMod > 0) {
        log.push({ kind: 'debuff', player: targetSide, stat: 'spd', amount: target.spdMod, duration: 'battle' });
        target.spdMod = 0;
      }
      user.firstAttackMade = true;
      break;
    }
    case 'attack_then_cleanse': {
      const stat = effStat(user, e.useStat);
      const baseDamage = stat * e.mult + e.flat;
      if (rollDodge(user, target, rng)) {
        log.push({ kind: 'miss', from: userSide, to: targetSide });
      } else {
        const def = effStat(target, 'def');
        const raw = Math.max(1, Math.floor(baseDamage - def));
        let actual = takeDamage(target, raw, rng, targetPassives, targetSide, log, false);
        actual = clampWithEndure(target, actual, targetPassives, targetSide, log);
        target.hp -= actual;
        log.push({ kind: 'damage', from: userSide, to: targetSide, amount: actual, hpAfter: target.hp });
        applyLifesteal(user, userPassives, actual, userSide, log);
        applyHexDef(user, userPassives, target, userSide, targetSide, actual, log);
        applyCounterDamage(target, targetPassives, user, userPassives, userSide, targetSide, actual, log);
      }
      if (user.atkMod < 0) {
        log.push({ kind: 'buff', player: userSide, stat: 'atk', amount: -user.atkMod, duration: 'battle' });
        user.atkMod = 0;
      }
      if (user.defMod < 0) {
        log.push({ kind: 'buff', player: userSide, stat: 'def', amount: -user.defMod, duration: 'battle' });
        user.defMod = 0;
      }
      if (user.spdMod < 0) {
        log.push({ kind: 'buff', player: userSide, stat: 'spd', amount: -user.spdMod, duration: 'battle' });
        user.spdMod = 0;
      }
      user.firstAttackMade = true;
      break;
    }
    case 'swat_attack': {
      // Manual attack flow so we can react on dodge.
      const dodged = rollDodge(user, target, rng);
      if (dodged) {
        log.push({ kind: 'miss', from: userSide, to: targetSide });
        const swatDmg = Math.max(1, effStat(target, 'spd'));
        let actual = takeDamage(target, swatDmg, rng, targetPassives, targetSide, log, true);
        actual = clampWithEndure(target, actual, targetPassives, targetSide, log);
        target.hp -= actual;
        log.push({ kind: 'damage', from: userSide, to: targetSide, amount: actual, hpAfter: target.hp });
      } else {
        resolveAttack({
          attacker: user,
          defender: target,
          attackerPassives: userPassives,
          defenderPassives: targetPassives,
          effect: { kind: 'attack', mult: e.mult, useStat: e.useStat },
          attackerSide: userSide,
          defenderSide: targetSide,
          rng,
          log,
        });
      }
      user.firstAttackMade = true;
      break;
    }
    case 'deja_vu_attack': {
      const count = (user.skillUseCounts[skill.id] ?? 0) + 1;
      user.skillUseCounts[skill.id] = count;
      // Fold the bonus into the once-buff so resolveAttack picks it up; it will be cleared by consumeOnceBuffs.
      user.onceBuffs.atk = (user.onceBuffs.atk ?? 0) + count;
      log.push({ kind: 'buff', player: userSide, stat: 'atk', amount: count, duration: 'once' });
      resolveAttack({
        attacker: user,
        defender: target,
        attackerPassives: userPassives,
        defenderPassives: targetPassives,
        effect: { kind: 'attack', mult: e.mult, useStat: e.useStat },
        attackerSide: userSide,
        defenderSide: targetSide,
        rng,
        log,
      });
      user.firstAttackMade = true;
      if (rollExtraAttack(user, userPassives, userSide, rng, log)) {
        resolveAttack({
          attacker: user,
          defender: target,
          attackerPassives: userPassives,
          defenderPassives: targetPassives,
          effect: { kind: 'attack', mult: e.mult, useStat: e.useStat },
          attackerSide: userSide,
          defenderSide: targetSide,
          rng,
          log,
        });
      }
      break;
    }
  }
  // After applying, per-active counters update and once-buffs/amp consume.
  consumeOnceBuffs(user);
  user.nextAmp = 1;
  user.activesUsedCount += 1;
  // Remember this effect so the opponent's `mimic_last` can replay it.
  // mimic_last itself doesn't update the slot — we shouldn't mimic a mimic.
  if (e.kind !== 'mimic_last') user.lastUsedEffect = e;
  applySelfDecay(user, userPassives, userSide, log);
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

  // 同調 equalize_spd: average both sides' SPD when either side has the passive.
  const equalizers = [
    ...a.passives.filter((p) => p.effect.kind === 'equalize_spd'),
    ...b.passives.filter((p) => p.effect.kind === 'equalize_spd'),
  ];
  if (equalizers.length > 0) {
    const avg = Math.floor((sa.spd + sb.spd) / 2);
    sa.spd = avg;
    sb.spd = avg;
    const owner: Side = a.passives.includes(equalizers[0]!) ? 'a' : 'b';
    log.push({ kind: 'passive', player: owner, passiveId: equalizers[0]!.id });
  }

  // 逆転する世界: any `reverse_actives_both` battle_start passive flips both
  // sides' active orders. Stacks by parity (odd=flip, even=cancel).
  const reverseCount =
    a.passives.filter((p) => p.effect.kind === 'reverse_actives_both' && p.trigger.kind === 'battle_start').length +
    b.passives.filter((p) => p.effect.kind === 'reverse_actives_both' && p.trigger.kind === 'battle_start').length;
  if (reverseCount % 2 === 1) {
    reverseMonsterActives(a);
    reverseMonsterActives(b);
    const passive =
      a.passives.find((p) => p.effect.kind === 'reverse_actives_both') ??
      b.passives.find((p) => p.effect.kind === 'reverse_actives_both');
    if (passive) {
      const owner: Side = a.passives.includes(passive) ? 'a' : 'b';
      log.push({ kind: 'passive', player: owner, passiveId: passive.id });
    }
  }

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
  /** Advance skillIdx past any rewind-consumed slots so the next fetch lands on a playable card. */
  const advancePastConsumed = (s: Side): void => {
    const sorted = sides[s].mon.actives.slice().sort((x, y) => x.order - y.order);
    while (
      sides[s].state.skillIdx < sorted.length &&
      sides[s].state.consumedSkillIds.has(sorted[sides[s].state.skillIdx]!.id)
    ) {
      sides[s].state.skillIdx += 1;
    }
  };
  const hasWork = (s: Side): boolean => {
    advancePastConsumed(s);
    return sides[s].state.skillIdx < sides[s].mon.actives.length;
  };
  let current: Side = first;
  while (hasWork('a') || hasWork('b')) {
    const cur = sides[current];
    const opp = sides[other(current)];
    // 一時停止: opponent imposed a skip on us — consume it instead of using a skill.
    if (cur.state.skipTurnsRemaining > 0) {
      cur.state.skipTurnsRemaining -= 1;
      log.push({ kind: 'turn_skipped', player: current });
    } else {
      advancePastConsumed(current);
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
          userMon: cur.mon,
          targetMon: opp.mon,
          skill,
          userSide: current,
          targetSide: other(current),
          rng,
          log,
        });
      }
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
