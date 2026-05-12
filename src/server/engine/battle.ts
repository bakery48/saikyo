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
  /** Thorn-shield HP; absorbs incoming attack damage and reflects the absorbed amount as true damage to the attacker. Depletes until 0. */
  reflectShield: number;
  /** Ghost-shield HP; absorbs incoming attack damage and reflects (absorbed + floor(attacker.atk * 0.5)) as true damage. Depletes until 0. */
  ghostShield: number;
  /** Threshold shield; blocks all damage from hits below this value. A hit >= threshold breaks the shield and damage passes through fully. 0 = inactive. */
  thresholdShield: number;
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
  /** Total active slots (kept in sync with append_struggle). */
  totalActives: number;
  /** Multiplier applied to every shield gain (1 = normal, 2 = double_shield). */
  shieldMultiplier: number;
  /** False once revenge_burst has fired this battle. */
  revengeBurstAvailable: boolean;
  /** False once last_breath has fired this battle. */
  lastBreathAvailable: boolean;
  /** False once rebirth has fired this battle. */
  rebirthAvailable: boolean;
  /** Defender flag: incoming attacks treat DEF as 0 (set by absolute_zero on opponent). */
  incomingIgnoresDef: boolean;
  /** Self flag: SPD reads as 0 regardless of mods/buffs (set by absolute_zero). */
  spdLockedZero: boolean;
  /** Pending damage multiplier for the NEXT own active (set by force_amp). */
  forceAmpNext: number;
  /** Pending pierce flag for the NEXT own active (skips reductions/caps in takeDamage). */
  forcePierceNext: boolean;
  /** Set by pierce_all_shields: every attack from this side bypasses all defender shields. */
  alwaysPierceShield: boolean;
  /** Active multiplier currently in effect for the in-progress active. */
  forceAmpActive: number;
  /** Active pierce flag currently in effect for the in-progress active. */
  forcePierceActive: boolean;
  passiveIds: string[];
  /** Number of sin-tagged skills this side owns (computed at battle start). */
  sinCount: number;
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
    reflectShield: 0,
    ghostShield: 0,
    thresholdShield: 0,
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
    totalActives: m.actives.length,
    shieldMultiplier: m.passives.some((p) => p.effect.kind === 'double_shield') ? 2 : 1,
    revengeBurstAvailable: m.passives.some((p) => p.effect.kind === 'revenge_burst'),
    lastBreathAvailable: m.passives.some((p) => p.effect.kind === 'last_breath'),
    rebirthAvailable: m.passives.some((p) => p.effect.kind === 'rebirth'),
    incomingIgnoresDef: false,
    spdLockedZero: false,
    forceAmpNext: 1,
    forcePierceNext: false,
    alwaysPierceShield: m.passives.some((p) => p.effect.kind === 'pierce_all_shields'),
    forceAmpActive: 1,
    forcePierceActive: false,
    passiveIds: [],
    sinCount: 0,
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
  if (c.spdLockedZero) return 0;
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
  actives: ActiveSkill[],
  self: CombatStats,
  opponent: CombatStats,
  side: Side,
  rng: RNG,
  log: BattleEvent[],
): { spdRollBonus: number } {
  let spdRollBonus = 0;
  const sinCount =
    actives.filter((a) => a.tag === 'sin').length +
    passives.filter((p) => p.tag === 'sin').length;
  for (const p of passives) {
    self.passiveIds.push(p.id);
    switch (p.effect.kind) {
      case 'spd_roll_bonus':
        if (p.trigger.kind === 'battle_start') {
          spdRollBonus += p.effect.amount;
          log.push({ kind: 'passive', player: side, passiveId: p.id });
        }
        break;
      case 'grant_shield':
        if (p.trigger.kind === 'battle_start') {
          const gain = p.effect.amount * self.shieldMultiplier;
          self.shield += gain;
          log.push({ kind: 'shield', player: side, amount: gain });
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
      case 'pick_higher_buff_mult':
        if (p.trigger.kind === 'battle_start') {
          const atk = effStat(self, 'atk');
          const def = effStat(self, 'def');
          if (atk >= def) self.atkMod += Math.floor(atk * (p.effect.mult - 1));
          else self.defMod += Math.floor(def * (p.effect.mult - 1));
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
      case 'mirror_stats':
        if (p.trigger.kind === 'battle_start') {
          self.atkMod += opponent.atkMod;
          self.defMod += opponent.defMod;
          self.spdMod += opponent.spdMod;
          log.push({ kind: 'passive', player: side, passiveId: p.id });
        }
        break;
      case 'stat_swap_battle_start':
        if (p.trigger.kind === 'battle_start') {
          const tmp = self.atk;
          self.atk = self.def;
          self.def = tmp;
          const tmpMod = self.atkMod;
          self.atkMod = self.defMod;
          self.defMod = tmpMod;
          log.push({ kind: 'passive', player: side, passiveId: p.id });
        }
        break;
      case 'chronos':
        if (p.trigger.kind === 'battle_start') {
          self.atkMod += p.effect.allBonus;
          self.defMod += p.effect.allBonus;
          self.spdMod += p.effect.allBonus;
          log.push({ kind: 'passive', player: side, passiveId: p.id });
        }
        break;
      case 'absolute_zero':
        if (p.trigger.kind === 'battle_start') {
          opponent.cannotDodge = true;
          opponent.incomingIgnoresDef = true;
          self.spdLockedZero = true;
          self.atkMod -= 2;
          log.push({ kind: 'passive', player: side, passiveId: p.id });
        }
        break;
      case 'pierce_all_shields':
        if (p.trigger.kind === 'battle_start') {
          self.alwaysPierceShield = true;
          log.push({ kind: 'passive', player: side, passiveId: p.id });
        }
        break;
    }
  }

  self.sinCount = sinCount;

  // Automatic sin bonus — no passive card required; scales with tier.
  if (sinCount > 0) {
    const atkPerSin = sinCount >= 7 ? 4 : sinCount >= 3 ? 3 : 2;
    const defPerSin = sinCount >= 7 ? 3 : sinCount >= 5 ? 2 : sinCount >= 3 ? 1 : 0;
    const spdPerSin = sinCount >= 7 ? 2 : sinCount >= 5 ? 1 : 0;
    const atkBonus = atkPerSin * sinCount;
    const defBonus = defPerSin * sinCount;
    const spdBonus = spdPerSin * sinCount;
    self.atkMod += atkBonus;
    if (defBonus > 0) self.defMod += defBonus;
    if (spdBonus > 0) self.spdMod += spdBonus;
    log.push({ kind: 'sin_bonus', player: side, sinCount, atk: atkBonus, def: defBonus, spd: spdBonus });
  }

  return { spdRollBonus };
}

function applyTurnStartPassives(
  passives: PassiveSkill[],
  self: CombatStats,
  opponent: CombatStats,
  side: Side,
  oppSide: Side,
  log: BattleEvent[],
): void {
  for (const p of passives) {
    if (p.trigger.kind !== 'on_own_turn_start') continue;
    switch (p.effect.kind) {
      case 'turn_start_heal': {
        const applied = healCapped(self, p.effect.amount);
        if (applied > 0) {
          log.push({ kind: 'heal', player: side, amount: applied, hpAfter: self.hp });
          log.push({ kind: 'passive', player: side, passiveId: p.id });
        }
        break;
      }
      case 'turn_start_heal_even': {
        // activesUsedCount is the number of turns completed; fire on 2nd, 4th... turns (count is odd).
        if (self.activesUsedCount % 2 === 1) {
          const applied = healCapped(self, p.effect.amount);
          if (applied > 0) {
            log.push({ kind: 'heal', player: side, amount: applied, hpAfter: self.hp });
            log.push({ kind: 'passive', player: side, passiveId: p.id });
          }
        }
        break;
      }
      case 'regen_shield': {
        const goal = p.effect.amount * self.shieldMultiplier;
        if (self.shield < goal) {
          const delta = goal - self.shield;
          self.shield = goal;
          log.push({ kind: 'shield', player: side, amount: delta });
          log.push({ kind: 'passive', player: side, passiveId: p.id });
        }
        break;
      }
      case 'growth_heal': {
        const heal = p.effect.amount * self.activesUsedCount;
        if (heal > 0) {
          const applied = healCapped(self, heal);
          if (applied > 0) {
            log.push({ kind: 'heal', player: side, amount: applied, hpAfter: self.hp });
            log.push({ kind: 'passive', player: side, passiveId: p.id });
          }
        }
        break;
      }
      case 'slow_burn': {
        opponent.hp -= p.effect.amount;
        log.push({ kind: 'damage', from: side, to: oppSide, amount: p.effect.amount, hpAfter: opponent.hp });
        log.push({ kind: 'passive', player: side, passiveId: p.id });
        break;
      }
      case 'chronos': {
        if (p.effect.hpDrain > 0) {
          self.hp -= p.effect.hpDrain;
          log.push({ kind: 'damage', from: side, to: side, amount: p.effect.hpDrain, hpAfter: self.hp });
          log.push({ kind: 'passive', player: side, passiveId: p.id });
        }
        break;
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
  pierceReductions = false,
): number {
  if (rawDamage <= 0) return 0;
  // immortal_first_phase: full immunity while activesUsedCount < until.
  if (!pierceReductions) {
    for (const p of passives) {
      if (p.effect.kind === 'immortal_first_phase' && target.activesUsedCount < p.effect.until) {
        log.push({ kind: 'passive', player: side, passiveId: p.id });
        return 0;
      }
    }
  }
  // 影武者 absorb_first_hit: fully eat the first incoming damage instance.
  if (!pierceReductions && target.absorbHitsRemaining > 0) {
    target.absorbHitsRemaining -= 1;
    const passive = passives.find((p) => p.effect.kind === 'absorb_first_hit');
    if (passive) log.push({ kind: 'passive', player: side, passiveId: passive.id });
    return 0;
  }
  // Random negation passive (e.g., voltank 1/6 chance).
  if (!pierceReductions && target.negateOneIn > 0 && rng.int(1, target.negateOneIn) === 1) {
    const passive = passives.find(
      (p) => p.effect.kind === 'damage_negate_chance' && p.trigger.kind === 'on_take_damage',
    );
    if (passive) log.push({ kind: 'passive', player: side, passiveId: passive.id });
    return 0;
  }
  let dmg = rawDamage;
  // damage_to_shield: convert percent% of incoming dmg into shield gain (rounded).
  for (const p of passives) {
    if (p.effect.kind === 'damage_to_shield' && dmg > 0) {
      const converted = Math.floor((dmg * p.effect.percent) / 100);
      if (converted > 0) {
        const gain = converted * target.shieldMultiplier;
        target.shield += gain;
        dmg = Math.max(0, dmg - converted);
        log.push({ kind: 'shield', player: side, amount: gain });
        log.push({ kind: 'passive', player: side, passiveId: p.id });
      }
    }
  }
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
  if (!ignoreShield && target.reflectShield > 0) {
    const absorbed = Math.min(target.reflectShield, dmg);
    target.reflectShield -= absorbed;
    dmg -= absorbed;
  }
  if (!ignoreShield && target.ghostShield > 0) {
    const absorbed = Math.min(target.ghostShield, dmg);
    target.ghostShield -= absorbed;
    dmg -= absorbed;
  }
  if (!ignoreShield && target.thresholdShield > 0) {
    if (dmg < target.thresholdShield) {
      dmg = 0; // hit too small — fully blocked, shield stays
    } else {
      target.thresholdShield = 0; // shield broken by a large hit
    }
  }
  if (!pierceReductions && target.damageReduction > 0) {
    const passive = passives.find(
      (p) => p.effect.kind === 'damage_reduction' && p.trigger.kind === 'on_take_damage',
    );
    if (passive && dmg > 0) log.push({ kind: 'passive', player: side, passiveId: passive.id });
    dmg = Math.max(0, dmg - target.damageReduction);
  }
  // 逆境 low_hp_damage_reduction: extra reduction while at or below half HP.
  if (!pierceReductions && target.maxHp > 0 && target.hp * 2 <= target.maxHp) {
    for (const p of passives) {
      if (p.effect.kind === 'low_hp_damage_reduction' && dmg > 0) {
        const reduce = p.effect.amount;
        dmg = Math.max(0, dmg - reduce);
        log.push({ kind: 'passive', player: side, passiveId: p.id });
      }
    }
  }
  // damage_cap: clamp final damage per hit.
  if (!pierceReductions) {
    for (const p of passives) {
      if (p.effect.kind === 'damage_cap' && dmg > p.effect.maxPerHit) {
        dmg = p.effect.maxPerHit;
        log.push({ kind: 'passive', player: side, passiveId: p.id });
      }
    }
  }
  // mid_damage_immune: nullify if final dmg falls in [min, max].
  if (!pierceReductions) {
    for (const p of passives) {
      if (p.effect.kind === 'mid_damage_immune' && dmg >= p.effect.min && dmg <= p.effect.max) {
        log.push({ kind: 'passive', player: side, passiveId: p.id });
        return 0;
      }
    }
  }
  // mid_damage_reduce: divide damage in [min, max] by denominator.
  if (!pierceReductions) {
    for (const p of passives) {
      if (p.effect.kind === 'mid_damage_reduce' && dmg >= p.effect.min && dmg <= p.effect.max) {
        const denom = Math.max(1, p.effect.denominator);
        dmg = Math.floor(dmg / denom);
        log.push({ kind: 'passive', player: side, passiveId: p.id });
      }
    }
  }
  // rage_atk: gain ATK every time this side actually takes damage (optionally only above minDamage).
  if (dmg > 0) {
    for (const p of passives) {
      if (p.effect.kind === 'rage_atk' && dmg >= (p.effect.minDamage ?? 1)) {
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
  const wasFirstAttack = !attacker.firstAttackMade;
  // first_strike_steal_atk: on the user's first attack, swing ATK from defender to attacker.
  if (wasFirstAttack) {
    for (const p of attackerPassives) {
      if (p.effect.kind === 'first_strike_steal_atk') {
        const amt = p.effect.amount;
        defender.atkMod -= amt;
        attacker.atkMod += amt;
        log.push({ kind: 'debuff', player: defenderSide, stat: 'atk', amount: amt, duration: 'battle' });
        log.push({ kind: 'buff', player: attackerSide, stat: 'atk', amount: amt, duration: 'battle' });
        log.push({ kind: 'passive', player: attackerSide, passiveId: p.id });
      }
    }
  }
  // Dodge: SPD-diff + passive bonuses can fully evade the attack.
  if (rollDodge(attacker, defender, rng)) {
    log.push({ kind: 'miss', from: attackerSide, to: defenderSide });
    // dodge_counter: defender hits back with true damage on a successful dodge.
    for (const p of defenderPassives) {
      if (p.effect.kind === 'dodge_counter') {
        const amt = p.effect.amount;
        let r = takeDamage(attacker, amt, rng, attackerPassives, attackerSide, log, true);
        r = clampWithEndure(attacker, r, attackerPassives, attackerSide, log);
        attacker.hp -= r;
        log.push({ kind: 'passive', player: defenderSide, passiveId: p.id });
        log.push({ kind: 'damage', from: defenderSide, to: attackerSide, amount: r, hpAfter: attacker.hp });
      }
    }
    return;
  }
  let atkBoost = 0;
  // low_hp_atk_bonus: dynamic — only counts while at or below half HP.
  const isLowHp = attacker.maxHp > 0 && attacker.hp * 2 <= attacker.maxHp;
  if (isLowHp) {
    for (const p of attackerPassives) {
      if (p.effect.kind === 'low_hp_atk_bonus') {
        atkBoost += p.effect.amount;
      }
    }
  }
  // low_hp_atk_mult: while at or below thresholdFraction of max HP, multiply ATK.
  for (const p of attackerPassives) {
    if (p.effect.kind === 'low_hp_atk_mult' && attacker.maxHp > 0) {
      const threshold = attacker.maxHp * p.effect.thresholdFraction;
      if (attacker.hp <= threshold) {
        const baseAtk = effStat(attacker, 'atk');
        atkBoost += Math.floor(baseAtk * (p.effect.mult - 1));
      }
    }
  }
  // tail_fury: bonus while remaining own slots <= threshold.
  const remainingSlots = Math.max(0, attacker.totalActives - attacker.activesUsedCount - 1);
  for (const p of attackerPassives) {
    if (p.effect.kind === 'tail_fury' && remainingSlots <= p.effect.threshold) {
      atkBoost += p.effect.amount;
    }
  }
  // odd_turn_atk_bonus: bonus on every odd-numbered own attack (1st, 3rd, ...).
  if (attacker.activesUsedCount % 2 === 0) {
    for (const p of attackerPassives) {
      if (p.effect.kind === 'odd_turn_atk_bonus') atkBoost += p.effect.amount;
    }
  }
  // even_turn_atk_bonus: bonus on every even-numbered own attack (2nd, 4th, ...).
  if (attacker.activesUsedCount % 2 === 1) {
    for (const p of attackerPassives) {
      if (p.effect.kind === 'even_turn_atk_bonus') atkBoost += p.effect.amount;
    }
  }
  // chain_damage_bonus: each subsequent own attack scales linearly.
  for (const p of attackerPassives) {
    if (p.effect.kind === 'chain_damage_bonus') {
      atkBoost += p.effect.amount * attacker.activesUsedCount;
    }
  }
  // predator_buff: while opponent HP < own HP.
  if (defender.hp < attacker.hp) {
    for (const p of attackerPassives) {
      if (p.effect.kind === 'predator_buff') atkBoost += p.effect.amount;
    }
  }
  // slow_starter: malus before breakpoint, bonus after.
  for (const p of attackerPassives) {
    if (p.effect.kind === 'slow_starter') {
      if (attacker.activesUsedCount < p.effect.breakpoint) atkBoost -= p.effect.malus;
      else atkBoost += p.effect.bonus;
    }
  }
  // final_form: only one own slot remaining (this attack is the last).
  if (remainingSlots === 0) {
    for (const p of attackerPassives) {
      if (p.effect.kind === 'final_form') atkBoost += p.effect.amount;
    }
  }
  const stat =
    effect.useStat === 'atk'
      ? effStat(attacker, 'atk') + atkBoost
      : effect.useStat === 'def'
        ? effStat(attacker, 'def')
        : effStat(attacker, 'spd');
  const mult = effect.mult * attacker.nextAmp;
  let baseDamage = stat * mult;
  const isFirstAttack = !attacker.firstAttackMade;
  const ignoreDef = (isFirstAttack && attacker.firstAttackTrue) || defender.incomingIgnoresDef;

  if (isFirstAttack && attacker.firstAttackAmp > 0) {
    baseDamage += attacker.firstAttackAmp * stat;
  }
  let def = ignoreDef ? 0 : effStat(defender, 'def');
  if (!ignoreDef && isFirstAttack && attacker.firstAttackDefDiv > 1) {
    def = Math.floor(def / attacker.firstAttackDefDiv);
  }
  let raw = Math.max(1, Math.floor(baseDamage - def));
  if (attacker.forceAmpActive > 1) {
    raw = Math.max(1, Math.floor(raw * attacker.forceAmpActive));
  }
  if (isFirstAttack && attacker.firstAttackDamageMult > 1) {
    raw = Math.max(1, Math.floor(raw * attacker.firstAttackDamageMult));
  }
  // クリティカル crit_chance: roll once per attack; on proc, multiply post-DEF damage.
  // opp_crit_block on the defender nullifies the crit roll entirely.
  const critBlocked = defenderPassives.some((p) => p.effect.kind === 'opp_crit_block');
  if (!critBlocked) {
    for (const p of attackerPassives) {
      if (p.effect.kind === 'crit_chance' && rng.next() < p.effect.percent / 100) {
        raw = Math.max(1, Math.floor(raw * p.effect.mult));
        log.push({ kind: 'passive', player: attackerSide, passiveId: p.id });
        break;
      }
    }
  }
  // selective_immune / attack_kind_resist: defender reactions tied to the attack's kind.
  const incomingKind = effect.attackKind;
  if (incomingKind && incomingKind !== 'passthrough') {
    for (const p of defenderPassives) {
      if (p.effect.kind === 'selective_immune' && p.effect.attackKind === incomingKind) {
        raw = 0;
        log.push({ kind: 'passive', player: defenderSide, passiveId: p.id });
        break;
      }
    }
    if (raw > 0) {
      for (const p of defenderPassives) {
        if (p.effect.kind === 'attack_kind_resist' && p.effect.attackKind === incomingKind) {
          raw = Math.max(0, raw - p.effect.amount);
          log.push({ kind: 'passive', player: defenderSide, passiveId: p.id });
        }
      }
    }
  }
  // Capture state needed for post-damage triggers.
  const defenderHadShield = defender.shield > 0;
  const defenderReflectShieldBefore = defender.reflectShield;
  const defenderGhostShieldBefore = defender.ghostShield;
  let actual = takeDamage(defender, raw, rng, defenderPassives, defenderSide, log, ignoreDef || attacker.alwaysPierceShield, attacker.forcePierceActive);
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
  // opportunist: extra true damage when defender has any negative battle-long stat mod.
  if (actual > 0 && (defender.atkMod < 0 || defender.defMod < 0 || defender.spdMod < 0)) {
    for (const p of attackerPassives) {
      if (p.effect.kind === 'opportunist') {
        const bonus = p.effect.amount;
        defender.hp -= bonus;
        log.push({ kind: 'passive', player: attackerSide, passiveId: p.id });
        log.push({ kind: 'damage', from: attackerSide, to: defenderSide, amount: bonus, hpAfter: defender.hp });
      }
    }
  }
  // shield_thorns: defender retaliates while shield was up at hit time.
  if (actual > 0 && defenderHadShield) {
    for (const p of defenderPassives) {
      if (p.effect.kind === 'shield_thorns') {
        const amt = p.effect.amount;
        let r = takeDamage(attacker, amt, rng, attackerPassives, attackerSide, log, true);
        r = clampWithEndure(attacker, r, attackerPassives, attackerSide, log);
        attacker.hp -= r;
        log.push({ kind: 'passive', player: defenderSide, passiveId: p.id });
        log.push({ kind: 'damage', from: defenderSide, to: attackerSide, amount: r, hpAfter: attacker.hp });
      }
    }
  }
  // revenge_burst: first time the defender drops to or below half HP, hit attacker.
  if (
    defender.revengeBurstAvailable &&
    defender.maxHp > 0 &&
    defender.hp * 2 <= defender.maxHp
  ) {
    defender.revengeBurstAvailable = false;
    const passive = defenderPassives.find((p) => p.effect.kind === 'revenge_burst');
    if (passive && passive.effect.kind === 'revenge_burst') {
      const amt = passive.effect.amount;
      let r = takeDamage(attacker, amt, rng, attackerPassives, attackerSide, log, true);
      r = clampWithEndure(attacker, r, attackerPassives, attackerSide, log);
      attacker.hp -= r;
      log.push({ kind: 'passive', player: defenderSide, passiveId: passive.id });
      log.push({ kind: 'damage', from: defenderSide, to: attackerSide, amount: r, hpAfter: attacker.hp });
    }
  }
  // last_breath: when defender drops to <= 0 (post-clamp), retaliate once.
  if (defender.hp <= 0 && defender.lastBreathAvailable) {
    defender.lastBreathAvailable = false;
    const passive = defenderPassives.find((p) => p.effect.kind === 'last_breath');
    if (passive && passive.effect.kind === 'last_breath') {
      const amt = passive.effect.amount;
      let r = takeDamage(attacker, amt, rng, attackerPassives, attackerSide, log, true);
      r = clampWithEndure(attacker, r, attackerPassives, attackerSide, log);
      attacker.hp -= r;
      log.push({ kind: 'passive', player: defenderSide, passiveId: passive.id });
      log.push({ kind: 'damage', from: defenderSide, to: attackerSide, amount: r, hpAfter: attacker.hp });
    }
  }
  // First-attack post-effects.
  if (wasFirstAttack && actual > 0) {
    for (const p of attackerPassives) {
      if (p.effect.kind === 'second_wind') {
        const applied = healCapped(attacker, p.effect.amount);
        if (applied > 0) {
          log.push({ kind: 'heal', player: attackerSide, amount: applied, hpAfter: attacker.hp });
          log.push({ kind: 'passive', player: attackerSide, passiveId: p.id });
        }
      }
    }
  }
  if (wasFirstAttack) {
    for (const p of attackerPassives) {
      if (p.effect.kind === 'swap_atk_def_after_first_attack') {
        const tmp = attacker.atk;
        attacker.atk = attacker.def;
        attacker.def = tmp;
        const tmpMod = attacker.atkMod;
        attacker.atkMod = attacker.defMod;
        attacker.defMod = tmpMod;
        log.push({ kind: 'passive', player: attackerSide, passiveId: p.id });
      }
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
  // reflect_shield: reflect absorbed damage back to the attacker as true damage.
  const reflectShieldAbsorbed = defenderReflectShieldBefore - defender.reflectShield;
  if (reflectShieldAbsorbed > 0) {
    let r = takeDamage(attacker, reflectShieldAbsorbed, rng, attackerPassives, attackerSide, log, true);
    r = clampWithEndure(attacker, r, attackerPassives, attackerSide, log);
    attacker.hp -= r;
    log.push({ kind: 'damage', from: defenderSide, to: attackerSide, amount: r, hpAfter: attacker.hp });
  }
  // ghost_shield: reflect absorbed + floor(attacker.atk * 0.5) as true damage to the attacker.
  const ghostShieldAbsorbed = defenderGhostShieldBefore - defender.ghostShield;
  if (ghostShieldAbsorbed > 0) {
    const bonus = Math.floor(effStat(attacker, 'atk') * 0.5);
    const r = ghostShieldAbsorbed + bonus;
    let rd = takeDamage(attacker, r, rng, attackerPassives, attackerSide, log, true);
    rd = clampWithEndure(attacker, rd, attackerPassives, attackerSide, log);
    attacker.hp -= rd;
    log.push({ kind: 'damage', from: defenderSide, to: attackerSide, amount: rd, hpAfter: attacker.hp });
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
    if (p.effect.kind === 'hex_def' && damageDealt >= (p.effect.minDamage ?? 1)) {
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
  if (defender.hp - damage > 0) return damage;
  // rebirth: when reduced to ≤0 HP, fully restore once.
  if (defender.rebirthAvailable) {
    defender.rebirthAvailable = false;
    const passive = passives.find((p) => p.effect.kind === 'rebirth');
    if (passive) log.push({ kind: 'passive', player: side, passiveId: passive.id });
    const heal = defender.maxHp - defender.hp;
    if (heal > 0) {
      defender.hp = defender.maxHp;
      log.push({ kind: 'heal', player: side, amount: heal, hpAfter: defender.hp });
    }
    return 0;
  }
  if (!defender.endureFatalAvailable) return damage;
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
  // Transfer any pending force_amp into the in-progress active (consumed unconditionally,
  // matching nextAmp semantics on nullify/fizzle).
  user.forceAmpActive = user.forceAmpNext;
  user.forcePierceActive = user.forcePierceNext;
  user.forceAmpNext = 1;
  user.forcePierceNext = false;
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
  // Sin card override: if the user holds enough sins, replace the sin effect with a scaling attack.
  const rawEffect = skill.effect;
  const sinMult =
    skill.tag === 'sin' && user.sinCount >= 7 ? 5.0
    : skill.tag === 'sin' && user.sinCount >= 5 ? 2.5
    : skill.tag === 'sin' && user.sinCount >= 3 ? 1.5
    : null;
  const e: typeof rawEffect = sinMult !== null
    ? { kind: 'attack', mult: sinMult, useStat: 'atk', attackKind: 'passthrough' }
    : rawEffect;
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
    case 'grant_target_shield': {
      target.shield += e.amount;
      log.push({ kind: 'shield', player: targetSide, amount: e.amount });
      break;
    }
    case 'buff_target': {
      applyStatMod(target, e.stat, e.amount, e.duration);
      log.push({ kind: 'buff', player: targetSide, stat: e.stat, amount: e.amount, duration: e.duration });
      break;
    }
    case 'self_damage': {
      const dmg = Math.max(0, Math.min(e.amount, user.hp - 1));
      user.hp -= dmg;
      log.push({ kind: 'damage', from: userSide, to: userSide, amount: dmg, hpAfter: user.hp });
      break;
    }
    case 'self_damage_max_fraction': {
      const raw = Math.max(1, Math.floor(user.maxHp * e.fraction));
      const dmg = Math.max(0, Math.min(raw, user.hp - 1));
      user.hp -= dmg;
      log.push({ kind: 'damage', from: userSide, to: userSide, amount: dmg, hpAfter: user.hp });
      break;
    }
    case 'heal_target': {
      const applied = healCapped(target, e.amount);
      if (applied > 0) {
        log.push({ kind: 'heal', player: targetSide, amount: applied, hpAfter: target.hp });
      }
      break;
    }
    case 'heal_target_max_fraction': {
      const amt = Math.max(1, Math.floor(target.maxHp * e.fraction));
      const applied = healCapped(target, amt);
      if (applied > 0) {
        log.push({ kind: 'heal', player: targetSide, amount: applied, hpAfter: target.hp });
      }
      break;
    }
    case 'shield_break_attack': {
      const hasShield = target.shield > 0 || target.reflectShield > 0 || target.thresholdShield > 0 || target.ghostShield > 0;
      const mult = hasShield ? e.multShield : e.multNoShield;
      if (hasShield) {
        target.shield = 0;
        target.reflectShield = 0;
        target.thresholdShield = 0;
        target.ghostShield = 0;
      }
      resolveAttack({
        attacker: user,
        defender: target,
        attackerPassives: userPassives,
        defenderPassives: targetPassives,
        effect: { kind: 'attack', mult, useStat: e.useStat, attackKind: e.attackKind },
        attackerSide: userSide,
        defenderSide: targetSide,
        rng,
        log,
      });
      user.firstAttackMade = true;
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
    case 'target_stat_damage': {
      if (rollDodge(user, target, rng)) {
        log.push({ kind: 'miss', from: userSide, to: targetSide });
        break;
      }
      const stat = effStat(target, e.stat);
      const dmg = Math.max(1, Math.floor(stat * e.mult * user.nextAmp));
      let actual = takeDamage(target, dmg, rng, targetPassives, targetSide, log, true);
      actual = clampWithEndure(target, actual, targetPassives, targetSide, log);
      target.hp -= actual;
      log.push({ kind: 'damage', from: userSide, to: targetSide, amount: actual, hpAfter: target.hp });
      applyLifesteal(user, userPassives, actual, userSide, log);
      applyHexDef(user, userPassives, target, userSide, targetSide, actual, log);
      applyCounterDamage(target, targetPassives, user, userPassives, userSide, targetSide, actual, log);
      user.firstAttackMade = true;
      break;
    }
    case 'stat_diff_damage': {
      if (rollDodge(user, target, rng)) {
        log.push({ kind: 'miss', from: userSide, to: targetSide });
        break;
      }
      const diff = Math.abs(effStat(target, e.stat) - effStat(user, e.stat));
      const dmg = Math.max(1, Math.floor(diff * e.mult * user.nextAmp));
      let actual = takeDamage(target, dmg, rng, targetPassives, targetSide, log, true);
      actual = clampWithEndure(target, actual, targetPassives, targetSide, log);
      target.hp -= actual;
      log.push({ kind: 'damage', from: userSide, to: targetSide, amount: actual, hpAfter: target.hp });
      applyLifesteal(user, userPassives, actual, userSide, log);
      applyHexDef(user, userPassives, target, userSide, targetSide, actual, log);
      applyCounterDamage(target, targetPassives, user, userPassives, userSide, targetSide, actual, log);
      user.firstAttackMade = true;
      break;
    }
    case 'target_higher_stat_attack': {
      if (rollDodge(user, target, rng)) {
        log.push({ kind: 'miss', from: userSide, to: targetSide });
        break;
      }
      const stat = Math.max(effStat(target, 'atk'), effStat(target, 'def'));
      const dmg = Math.max(1, Math.floor(stat * e.mult * user.nextAmp));
      let actual = takeDamage(target, dmg, rng, targetPassives, targetSide, log, true);
      actual = clampWithEndure(target, actual, targetPassives, targetSide, log);
      target.hp -= actual;
      log.push({ kind: 'damage', from: userSide, to: targetSide, amount: actual, hpAfter: target.hp });
      applyLifesteal(user, userPassives, actual, userSide, log);
      applyHexDef(user, userPassives, target, userSide, targetSide, actual, log);
      applyCounterDamage(target, targetPassives, user, userPassives, userSide, targetSide, actual, log);
      user.firstAttackMade = true;
      break;
    }
    case 'conditional_attack_if_target_higher': {
      const mult = effStat(target, e.stat) > effStat(user, e.stat) ? e.multIf : e.multElse;
      resolveAttack({
        attacker: user,
        defender: target,
        attackerPassives: userPassives,
        defenderPassives: targetPassives,
        attackerSide: userSide,
        defenderSide: targetSide,
        effect: { kind: 'attack', mult, useStat: e.useStat, attackKind: e.attackKind },
        log,
        rng,
      });
      user.firstAttackMade = true;
      break;
    }
    case 'heal': {
      const applied = healCapped(user, e.amount);
      log.push({ kind: 'heal', player: userSide, amount: applied, hpAfter: user.hp });
      break;
    }
    case 'shield': {
      const gain = e.amount * user.shieldMultiplier;
      user.shield += gain;
      log.push({ kind: 'shield', player: userSide, amount: gain });
      break;
    }
    case 'reflect_shield': {
      user.reflectShield += e.amount;
      log.push({ kind: 'shield', player: userSide, amount: e.amount });
      break;
    }
    case 'threshold_shield': {
      user.thresholdShield = e.threshold;
      log.push({ kind: 'shield', player: userSide, amount: e.threshold });
      break;
    }
    case 'pay_hp_threshold_shield': {
      const cost = Math.max(1, Math.floor(user.maxHp * e.hpCostFraction));
      user.hp = Math.max(1, user.hp - cost);
      log.push({ kind: 'damage', from: userSide, to: userSide, amount: cost, hpAfter: user.hp });
      user.thresholdShield = e.threshold;
      log.push({ kind: 'shield', player: userSide, amount: e.threshold });
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
    case 'self_nullify_next': {
      user.nullifyOpponentNext = true;
      log.push({ kind: 'nullified', player: userSide, skillId: 'pending' });
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
      const gain = e.shieldAmount * user.shieldMultiplier;
      user.shield += gain;
      log.push({ kind: 'shield', player: userSide, amount: gain });
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
      if (rollDodge(user, target, rng)) {
        log.push({ kind: 'miss', from: userSide, to: targetSide });
        break;
      }
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
      if (rollDodge(user, target, rng)) {
        log.push({ kind: 'miss', from: userSide, to: targetSide });
        break;
      }
      let actual = takeDamage(target, e.amount, rng, targetPassives, targetSide, log, true);
      actual = clampWithEndure(target, actual, targetPassives, targetSide, log);
      target.hp -= actual;
      log.push({ kind: 'damage', from: userSide, to: targetSide, amount: actual, hpAfter: target.hp });
      const healed = healCapped(user, actual);
      if (healed > 0) log.push({ kind: 'heal', player: userSide, amount: healed, hpAfter: user.hp });
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
      if (rollDodge(user, target, rng)) {
        log.push({ kind: 'miss', from: userSide, to: targetSide });
        break;
      }
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
      if (rollDodge(user, target, rng)) {
        log.push({ kind: 'miss', from: userSide, to: targetSide });
        break;
      }
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
      if (rollDodge(user, target, rng)) {
        log.push({ kind: 'miss', from: userSide, to: targetSide });
        break;
      }
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
    case 'fixed_damage_attack': {
      if (rollDodge(user, target, rng)) {
        log.push({ kind: 'miss', from: userSide, to: targetSide });
      } else {
        const def = effStat(target, 'def');
        const raw = Math.max(1, e.amount - def);
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
    case 'append_struggle': {
      const targetMonRef = e.target === 'self' ? userMon : targetMon;
      const targetState = e.target === 'self' ? user : target;
      const baseMaxOrder = targetMonRef.actives.reduce((m, a) => Math.max(m, a.order), 0);
      for (let i = 0; i < e.count; i++) {
        targetMonRef.actives.push({
          id: `struggle-${e.target}-${rng.int(0, 999999999)}-${i}`,
          order: baseMaxOrder + i + 1,
          name: '悪あがき',
          effect: { kind: 'fixed_damage_attack', amount: 1, attackKind: 'passthrough' },
        });
      }
      targetState.totalActives += e.count;
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
    case 'force_amp': {
      user.forceAmpNext = e.mult;
      user.forcePierceNext = true;
      log.push({ kind: 'buff', player: userSide, stat: 'atk', amount: e.mult, duration: 'once' });
      break;
    }
    case 'spd_diff_multi_attack': {
      const userSpd = effStat(user, 'spd');
      const oppSpd = effStat(target, 'spd');
      const hits = Math.max(1, oppSpd - userSpd);
      for (let i = 0; i < hits; i++) {
        if (rollDodge(user, target, rng)) {
          log.push({ kind: 'miss', from: userSide, to: targetSide });
          continue;
        }
        const myStat = e.useStat === 'atk' ? effStat(user, 'atk') : effStat(user, 'spd');
        const def = target.incomingIgnoresDef ? 0 : effStat(target, 'def');
        let raw = Math.max(1, Math.floor(myStat + e.flatAtkMod - def));
        if (user.forceAmpActive > 1) raw = Math.max(1, Math.floor(raw * user.forceAmpActive));
        let actual = takeDamage(target, raw, rng, targetPassives, targetSide, log, target.incomingIgnoresDef, user.forcePierceActive);
        actual = clampWithEndure(target, actual, targetPassives, targetSide, log);
        target.hp -= actual;
        log.push({ kind: 'damage', from: userSide, to: targetSide, amount: actual, hpAfter: target.hp });
        if (target.hp <= 0) break;
      }
      user.firstAttackMade = true;
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
  applyOnActiveUsedPassives(user, userPassives, userSide, log);
}

function applyOnActiveUsedPassives(
  user: CombatStats,
  passives: PassiveSkill[],
  side: Side,
  log: BattleEvent[],
): void {
  for (const p of passives) {
    if (p.trigger.kind !== 'on_own_active_used') continue;
    switch (p.effect.kind) {
      case 'atk_per_active':
        user.atkMod += p.effect.amount;
        log.push({ kind: 'buff', player: side, stat: 'atk', amount: p.effect.amount, duration: 'battle' });
        log.push({ kind: 'passive', player: side, passiveId: p.id });
        break;
      case 'decay_atk_per_active':
        user.atkMod -= p.effect.amount;
        log.push({ kind: 'debuff', player: side, stat: 'atk', amount: p.effect.amount, duration: 'battle' });
        log.push({ kind: 'passive', player: side, passiveId: p.id });
        break;
      case 'shield_on_active': {
        const gain = p.effect.amount * user.shieldMultiplier;
        user.shield += gain;
        log.push({ kind: 'shield', player: side, amount: gain });
        log.push({ kind: 'passive', player: side, passiveId: p.id });
        break;
      }
      case 'heal_on_active': {
        const applied = healCapped(user, p.effect.amount);
        if (applied > 0) {
          log.push({ kind: 'heal', player: side, amount: applied, hpAfter: user.hp });
          log.push({ kind: 'passive', player: side, passiveId: p.id });
        }
        break;
      }
    }
  }
  // on_last_active_used: fires once when activesUsedCount reaches totalActives.
  if (user.activesUsedCount === user.totalActives) {
    for (const p of passives) {
      if (p.trigger.kind !== 'on_last_active_used') continue;
      switch (p.effect.kind) {
        case 'grant_reflect_shield_on_last_active': {
          user.reflectShield += p.effect.amount;
          log.push({ kind: 'shield', player: side, amount: p.effect.amount });
          log.push({ kind: 'passive', player: side, passiveId: p.id });
          break;
        }
        case 'grant_ghost_shield_on_last_active': {
          user.ghostShield += p.effect.amount;
          log.push({ kind: 'shield', player: side, amount: p.effect.amount });
          log.push({ kind: 'passive', player: side, passiveId: p.id });
          break;
        }
      }
    }
  }
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

  const { spdRollBonus: aBonus } = applyBattleStartPassives(a.passives, a.actives, sa, sb, 'a', rng, log);
  const { spdRollBonus: bBonus } = applyBattleStartPassives(b.passives, b.actives, sb, sa, 'b', rng, log);

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
        applyTurnStartPassives(cur.mon.passives, cur.state, opp.state, current, other(current), log);
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
