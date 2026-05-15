export type Rarity = 'N' | 'R' | 'SR' | 'SSR';

/** Player marker color, one per seat. */
export type Color =
  | 'red'
  | 'blue'
  | 'yellow'
  | 'green'
  | 'orange'
  | 'purple'
  | 'black'
  | 'white';

export const PLAYER_COLORS: readonly Color[] = [
  'red',
  'blue',
  'yellow',
  'green',
  'orange',
  'purple',
  'black',
  'white',
];

export type Stats = {
  hp: number;
  atk: number;
  def: number;
  spd: number;
};

export type StatKey = keyof Stats;

/**
 * Visual category of an attack — determines the hit animation in the battle view.
 * 'passthrough' means: use the attacking monster's own attackKind.
 */
export type AttackKind =
  | 'strike'
  | 'sword'
  | 'claw'
  | 'magic'      // 無属性魔法
  | 'fire'       // 炎魔法
  | 'water'      // 水魔法
  | 'ice'        // 氷魔法
  | 'wind'       // 風魔法
  | 'passthrough';

/** Effects produced by active skills resolved during a battle. */
export type SkillEffect =
  /** Deal physical damage = max(1, floor(useStat * mult) - target.def). */
  | { kind: 'attack'; mult: number; useStat: 'atk' | 'def' | 'spd'; attackKind?: AttackKind }
  /** Deal damage that ignores DEF. */
  | { kind: 'true_damage'; amount: number }
  /** Buff self stat. duration 'once' = next own active only, 'battle' = rest of battle. */
  | { kind: 'buff_self'; stat: StatKey; amount: number; duration: 'once' | 'battle' }
  /** Debuff opponent stat. */
  | { kind: 'debuff_target'; stat: StatKey; amount: number; duration: 'once' | 'battle' }
  /** Multiply the damage of the next own active skill. */
  | { kind: 'next_amp'; mult: number }
  /** Nullify the next active skill the opponent uses. */
  | { kind: 'nullify_next' }
  | { kind: 'self_nullify_next' }
  /** Heal self. */
  | { kind: 'heal'; amount: number }
  /** Reduce next incoming damage by a flat amount. */
  | { kind: 'shield'; amount: number }
  /** Set up a thorn shield with `amount` total HP; while active it absorbs incoming attack damage and reflects the absorbed amount back to the attacker as true damage. */
  | { kind: 'reflect_shield'; amount: number }
  /** Set up a threshold shield; blocks ALL damage from any single hit below `threshold`. Only a hit of `threshold` or more breaks the shield (damage goes through). Blocks indefinitely until broken. */
  | { kind: 'threshold_shield'; threshold: number }
  /** Pay `hpCostFraction` of max HP as true self-damage, then set up a threshold shield. */
  | { kind: 'pay_hp_threshold_shield'; hpCostFraction: number; threshold: number }
  /**
   * Conditional attack: if the opponent has no shield, attack at `multNoShield`.
   * If the opponent has any shield (regular / reflect / threshold), destroy all shields first then attack at `multShield`.
   */
  | { kind: 'shield_break_attack'; useStat: 'atk' | 'def' | 'spd'; multNoShield: number; multShield: number; attackKind?: AttackKind }
  /** Grant the opponent a shield (cumulative absorber). Used for sin cards. */
  | { kind: 'grant_target_shield'; amount: number }
  /** Apply a positive stat mod to the opponent (buff them). Used for sin cards. */
  | { kind: 'buff_target'; stat: 'atk' | 'def' | 'spd'; amount: number; duration: 'once' | 'battle' }
  /** Deal flat true damage to self (ignores DEF/shield), clamped to leave ≥1 HP. */
  | { kind: 'self_damage'; amount: number }
  /** Deal true damage to self equal to floor(maxHp × fraction), clamped to leave ≥1 HP. */
  | { kind: 'self_damage_max_fraction'; fraction: number }
  /** Heal the opponent by `amount` (capped at their max HP). Used for sin cards. */
  | { kind: 'heal_target'; amount: number }
  | { kind: 'heal_target_max_fraction'; fraction: number }
  /** Cause the opponent to skip their next turn (no skill consumed, just delayed). */
  | { kind: 'pause_opponent' }
  /** Randomly shuffle the opponent's remaining (unused) active skills. */
  | { kind: 'shuffle_opponent_actives' }
  /**
   * Make the user's next active skill repeat. If the next skill is `attack` or
   * `true_damage`, run it `1 + extraCount` times. Otherwise the next skill
   * fizzles and the user takes `failurePenalty` self-damage.
   */
  | { kind: 'next_multi_attack'; extraCount: number; failurePenalty: number }
  /** Spend `hpCost` HP, gain `shieldAmount` shield. */
  | { kind: 'pay_hp_shield'; hpCost: number; shieldAmount: number }
  /** Spend `hpCost` HP, debuff opponent's ATK/DEF/SPD by `amount` (battle-long). */
  | { kind: 'pay_hp_debuff_all'; hpCost: number; amount: number }
  /** With `percent` chance deal `amount` true damage to the opponent; otherwise self-damage by `amount`. */
  | { kind: 'gamble_true_damage'; amount: number; percent: number }
  /** Buff own ATK/DEF/SPD all by `amount` for `duration`. */
  | { kind: 'buff_self_all'; amount: number; duration: 'once' | 'battle' }
  /** Attack `hitCount` times in a single skill use, each hit at `mult` × `useStat`. */
  | { kind: 'multi_hit_attack'; mult: number; useStat: 'atk' | 'spd'; hitCount: number; attackKind?: AttackKind }
  /** Restore floor(maxHp / denominator) HP. */
  | { kind: 'heal_max_fraction'; denominator: number }
  /**
   * Replay one of the user's earlier active skills `rewindBy` slots before this
   * one. Always self-damages by `selfDamagePercent`% of max HP. The skill is
   * single-use per battle (can't be brought back via further rewinds). Fizzles
   * harmlessly if the rewind target doesn't exist or is already consumed.
   */
  | { kind: 'rewind_skill'; rewindBy: number; selfDamagePercent: number }
  /**
   * Attack with bonus ATK = number of times this exact skill has been used in
   * the current battle (counting the current use). Damage formula otherwise
   * matches `attack` with `mult` × `useStat`.
   */
  | { kind: 'deja_vu_attack'; mult: number; useStat: 'atk' | 'spd'; attackKind?: AttackKind }
  /** Steal `amount` HP from the opponent: they lose it (true damage), you heal by the same amount. */
  | { kind: 'drain_hp'; amount: number }
  /** Steal `amount` of `stat` from the opponent (battle-long): they lose it, you gain it. */
  | { kind: 'steal_stat'; stat: StatKey; amount: number }
  /** Debuff opponent's ATK, DEF, and SPD each by `amount` (battle-long). */
  | { kind: 'debuff_all'; amount: number }
  /** Remove all positive battle-long stat modifiers from the opponent. */
  | { kind: 'dispel' }
  /** Deal true damage equal to your current shield value, then consume the shield. No-op if shield is 0. */
  | { kind: 'shield_bash' }
  /** Swap current HP values with the opponent. */
  | { kind: 'swap_hp' }
  /** Spend floor(hp × hpRatio) HP (minimum 1, self cannot die), deal that as true damage to opponent. */
  | { kind: 'sacrifice_attack'; hpRatio: number }
  /** If the opponent's current HP is ≤ `threshold`, instantly drop them to 0 HP. Otherwise no effect. */
  | { kind: 'execute'; threshold: number }
  /** Deal floor(maxHp × percent / 100) true damage to the opponent based on their max HP. */
  | { kind: 'percent_max_hp_true'; percent: number }
  /** Remove all negative battle-long stat modifiers from self. */
  | { kind: 'cleanse_self' }
  /** Swap the user's ATK and DEF (both base stats and battle-long modifiers) for the rest of the battle. */
  | { kind: 'swap_atk_def' }
  /** Swap the target's ATK and DEF (both base stats and battle-long modifiers) for the rest of the battle. */
  | { kind: 'swap_target_atk_def' }
  /** Buff own ATK by floor((maxHp - currentHp) / divisor) for the rest of the battle. */
  | { kind: 'hp_to_atk'; divisor: number }
  /** Set up: the next time this side takes attack damage, reflect `percent`% of it back to the attacker as true damage. */
  | { kind: 'share_damage_next'; percent: number }
  /** Remove the opponent's current shield (set to 0). */
  | { kind: 'break_shield' }
  /**
   * Attack at `mult` × useStat (打撃 etc), then skip the user's next active slot.
   * The skipped slot is counted as consumed.
   */
  | { kind: 'reckless_attack'; mult: number; useStat: 'atk' | 'spd'; attackKind?: AttackKind }
  /** Replay the opponent's most recent skill effect as if the user had cast it. Fizzles if the opponent hasn't acted yet. */
  | { kind: 'mimic_last' }
  /** DEF-based attack: damage = max(1, floor(DEF + flat - opponent DEF)). */
  | { kind: 'def_attack'; flat: number; attackKind?: AttackKind }
  /**
   * `mult` × useStat attack that, when the defender dodges, instead deals
   * defender.SPD as true damage (cannot itself be dodged).
   */
  | { kind: 'swat_attack'; mult: number; useStat: 'atk' | 'spd'; attackKind?: AttackKind; dodgeMult?: number }
  /** When this skill is the `threshold`-th or later active used in the battle, deal `amount` true damage. Otherwise no effect. */
  | { kind: 'coup_de_grace'; threshold: number; amount: number; attackKind?: AttackKind }
  /**
   * Guaranteed-hit attack: damage = max(1, floor(useStat × mult + flat) − DEF).
   * Cannot be dodged. After the attack lands, the target is permanently
   * marked unable to dodge for the rest of the battle.
   */
  | { kind: 'pin_attack'; mult: number; useStat: 'atk' | 'spd'; flat: number; attackKind?: AttackKind }
  /** Deal `targetStat × mult` as DEF-ignoring damage based on the opponent's current stat. */
  | { kind: 'target_stat_damage'; stat: 'atk' | 'def' | 'spd'; mult: number }
  /** If opponent's `stat` is strictly greater than user's, attack at `multIf`; otherwise `multElse`. */
  | { kind: 'conditional_attack_if_target_higher'; stat: 'atk' | 'def'; multIf: number; multElse: number; useStat: 'atk' | 'def' | 'spd'; attackKind?: AttackKind }
  /** DEF-ignoring damage equal to max(0, opponent[stat] - user[stat]) × mult. */
  | { kind: 'stat_diff_damage'; stat: 'atk' | 'def' | 'spd'; mult: number }
  /** Attack using whichever of opponent's ATK or DEF is higher, multiplied by `mult`. DEF-ignoring. */
  | { kind: 'target_higher_stat_attack'; mult: number; attackKind?: AttackKind }
  /**
   * Attack with a forced miss probability of `missPercent`% (independent of
   * SPD-based dodge). On hit, resolves like a normal `attack`.
   */
  | { kind: 'risky_attack'; mult: number; useStat: 'atk' | 'spd'; missPercent: number; attackKind?: AttackKind }
  /** Damage = max(1, floor(lastDamageTaken × mult) − DEF). Fizzles if user has not taken damage yet. */
  | { kind: 'counter_strike'; mult: number; attackKind?: AttackKind }
  /** Attack at useStat × mult + flat, then strip every positive battle-long stat mod from the target. */
  | { kind: 'attack_then_dispel'; mult: number; useStat: 'atk' | 'spd'; flat: number; attackKind?: AttackKind }
  /** Attack at useStat × mult + flat, then clear the user's negative battle-long stat mods. */
  | { kind: 'attack_then_cleanse'; mult: number; useStat: 'atk' | 'spd'; flat: number; attackKind?: AttackKind }
  /** Fixed-base attack: damage = max(1, amount − DEF). Subject to dodge / lifesteal / etc. */
  | { kind: 'fixed_damage_attack'; amount: number; attackKind?: AttackKind }
  /**
   * Append `count` 悪あがき (fixed_damage_attack 1) actives to the tail of
   * either the user's or the opponent's monster. The new slots play at the
   * end of the active queue.
   */
  | { kind: 'append_struggle'; target: 'self' | 'opponent'; count: number }
  /**
   * Multiply the damage of EVERY hit in the user's next active by `mult`, and
   * make those hits pierce damage_reduction / damage_cap / mid_damage_immune.
   * Consumed when the next active begins (one-shot).
   */
  | { kind: 'force_amp'; mult: number }
  /**
   * Sword attack repeated `max(1, opponentSPD - userSPD)` times. Each hit deals
   * max(1, floor(useStat × 1 + flatAtkMod − DEF)). The lower the user's SPD
   * relative to the opponent, the more hits.
   */
  | { kind: 'spd_diff_multi_attack'; flatAtkMod: number; useStat: 'atk' | 'spd'; attackKind?: AttackKind };

/** Optional metadata tag for skills. Currently only 'sin' (七つの大罪系カード) is used. */
export type SkillTag = 'sin';

export type ActiveSkill = {
  id: string;
  /** Sequence number — actives are processed top-to-bottom by `order`. */
  order: number;
  name: string;
  rarity?: Rarity;
  /** Short noun (e.g. "パワー") used to compose monster display names. */
  nameTag?: string;
  /** Optional classification tag (e.g., 'sin'). Used by passives that scale with tagged skills. */
  tag?: SkillTag;
  effect: SkillEffect;
};

/** Triggers for passives. (Battle-relevant only at this stage.) */
export type PassiveTrigger =
  | { kind: 'first_attack' }
  | { kind: 'battle_start' }
  | { kind: 'on_own_turn_start' }
  | { kind: 'on_take_damage' }
  | { kind: 'on_deal_damage' }
  | { kind: 'on_own_active_used' }
  | { kind: 'on_last_active_used' };

export type PassiveEffect =
  | { kind: 'stat_mod'; stat: StatKey; amount: number }
  | { kind: 'first_attack_amp'; amount: number }
  | { kind: 'first_attack_true'; }
  /** First attack treats target's DEF as floor(DEF / denominator). */
  | { kind: 'first_attack_def_div'; denominator: number }
  /** Final damage of the first attack (after DEF) is multiplied by `mult`. */
  | { kind: 'first_attack_damage_mult'; mult: number }
  | { kind: 'spd_roll_bonus'; amount: number }
  | { kind: 'damage_reduction'; amount: number }
  | { kind: 'turn_start_heal'; amount: number }
  | { kind: 'turn_start_heal_even'; amount: number }
  | { kind: 'damage_negate_chance'; oneIn: number }
  /** Flat % added to the SPD dodge roll on incoming attacks. */
  | { kind: 'dodge_bonus'; percent: number }
  | { kind: 'pick_higher_buff'; amount: number }
  /** At battle start, multiply the higher of ATK/DEF by `mult` (adds floor(stat * (mult-1)) as a buff). */
  | { kind: 'pick_higher_buff_mult'; mult: number }
  /**
   * Adds `amount` ATK for each `every` (default 1) actives this side has
   * already used in the battle. So `{ amount: 1, every: 1 }` is +1 ATK per
   * attack; `{ amount: 2, every: 2 }` is +2 every 2 attacks.
   */
  | { kind: 'atk_per_active'; amount: number; every?: number }
  /** Heal floor(damage / denominator) for every hit landed by this monster. */
  | { kind: 'lifesteal'; denominator: number }
  /** Each time this side takes damage, gain `amount` ATK (battle-long, accumulating). */
  | { kind: 'rage_atk'; amount: number; minDamage?: number }
  /** Each time this side deals damage, reduce target's DEF by `amount` (battle-long, accumulating). */
  | { kind: 'hex_def'; amount: number; minDamage?: number }
  /** Each active skill use has a `percent` chance to fire a second time. */
  | { kind: 'extra_attack_chance'; percent: number }
  /** When taking damage, reflect floor(damage / denominator) back to the attacker. */
  | { kind: 'counter_damage'; denominator: number }
  /** While hp ≤ maxHp/2, gain `amount` ATK on attacks (dynamic check at attack time). */
  | { kind: 'low_hp_atk_bonus'; amount: number }
  /** While at or below `thresholdFraction` of max HP, multiply ATK by `mult`. */
  | { kind: 'low_hp_atk_mult'; mult: number; thresholdFraction: number }
  /**
   * Once per battle, an attack that would drop hp to 0 instead leaves
   * floor(maxHp / reviveDenominator) (clamped to ≥1). When `reviveDenominator`
   * is omitted the survivor is left at exactly 1 HP.
   */
  | { kind: 'endure_fatal'; reviveDenominator?: number }
  /**
   * Self-inflicted decay applied each time this side resolves an active
   * skill: lose `hp` HP (true loss, ignores DEF / shields), and apply
   * battle-long −`atk` / −`def` / −`spd` stat modifiers.
   */
  | { kind: 'self_decay'; hp: number; atk: number; def: number; spd: number }
  /**
   * At battle start, reverse both sides' active-skill order. Stacking by parity:
   * if the total number of `reverse_actives_both` passives across the two
   * monsters is odd, the flip applies; even cancels out.
   */
  | { kind: 'reverse_actives_both' }
  /** While hp ≤ maxHp/2, reduce incoming damage by `amount`. */
  | { kind: 'low_hp_damage_reduction'; amount: number }
  /** First time this side would take damage, fully absorb it. */
  | { kind: 'absorb_first_hit' }
  /** At battle start, set both sides' SPD to the average of their two SPDs. */
  | { kind: 'equalize_spd' }
  /**
   * When this side deals ≤ `threshold` damage in a single hit, deal `bonus`
   * additional true damage (ignores DEF/shield) to the defender.
   */
  | { kind: 'low_damage_bonus'; threshold: number; bonus: number }
  /**
   * Nullify incoming damage if the final amount (after shield/reduction) falls
   * in the closed interval [min, max]. Damage below `min` or above `max` passes
   * through normally — high-burst attacks can still break through.
   */
  | { kind: 'mid_damage_immune'; min: number; max: number }
  /** If incoming damage falls in [min, max], divide it by `denominator` instead of nullifying. */
  | { kind: 'mid_damage_reduce'; min: number; max: number; denominator: number }
  /** Cap incoming damage per hit at `maxPerHit` (after reductions). */
  | { kind: 'damage_cap'; maxPerHit: number }
  /** When attacking and the target is at or below half HP, deal `amount` extra true damage. */
  | { kind: 'bonus_vs_low_hp'; amount: number }
  /** When this side deals damage, with `percent` chance the target loses their next turn. */
  | { kind: 'paralyze_chance'; percent: number }
  /** The first time this side takes damage in a battle, keep only `remainPercent`% of the incoming amount (floor). */
  | { kind: 'first_received_damage_reduce'; remainPercent: number }
  /** Each time this side resolves an active skill, lose `amount` ATK (battle-long, accumulating). */
  | { kind: 'decay_atk_per_active'; amount: number }
  /** Each time this side resolves an active skill, gain `amount` shield. */
  | { kind: 'shield_on_active'; amount: number }
  /** Each time this side resolves an active skill, heal `amount` HP. */
  | { kind: 'heal_on_active'; amount: number }
  /** Dynamic attack-time boost: while this side has ≤ `threshold` active slots remaining, add `amount` to attack damage. */
  | { kind: 'tail_fury'; amount: number; threshold: number }
  /** At the start of each own turn, deal `amount` true damage to the opponent. */
  | { kind: 'slow_burn'; amount: number }
  /** First time this side drops to or below half HP, deal `amount` true damage to the opponent. */
  | { kind: 'revenge_burst'; amount: number }
  /** When this side dodges an attack, deal `amount` true damage to the attacker. */
  | { kind: 'dodge_counter'; amount: number }
  /** While shield is active and this side takes damage, the attacker takes `amount` true damage. */
  | { kind: 'shield_thorns'; amount: number }
  /** When attacking, deal `amount` extra true damage if the defender has any negative battle-long stat mod. */
  | { kind: 'opportunist'; amount: number }
  /** At battle start, copy the opponent's current battle-long stat modifiers (atk/def/spd) onto self. */
  | { kind: 'mirror_stats' }
  /** At battle start, swap own ATK and DEF for the entire battle. */
  | { kind: 'stat_swap_battle_start' }
  /** At the start of each own turn, set shield to at least `amount`. */
  | { kind: 'regen_shield'; amount: number }
  /** When taking damage, convert `percent`% of the raw amount into shield gain (rounded down). */
  | { kind: 'damage_to_shield'; percent: number }
  /** After this side's first attack lands, heal `amount` HP. */
  | { kind: 'second_wind'; amount: number }
  /** After this side's first attack, swap own ATK and DEF for the rest of the battle. */
  | { kind: 'swap_atk_def_after_first_attack' }
  /** First attack steals `amount` ATK from the opponent (battle-long). */
  | { kind: 'first_strike_steal_atk'; amount: number }
  /** Dynamic: every odd-numbered own attack (1st, 3rd, 5th, …) gains `amount` damage. */
  | { kind: 'odd_turn_atk_bonus'; amount: number }
  | { kind: 'even_turn_atk_bonus'; amount: number }
  /** Dynamic: each successive own attack adds `amount` × actives-used-so-far to damage. */
  | { kind: 'chain_damage_bonus'; amount: number }
  /** At each own turn start, heal `amount` × actives-used-so-far HP. */
  | { kind: 'growth_heal'; amount: number }
  /** Dynamic: while opponent's HP < own HP, gain `amount` to attack damage. */
  | { kind: 'predator_buff'; amount: number }
  /**
   * First `breakpoint` own attacks suffer `-malus` damage; subsequent attacks
   * gain `+bonus` damage instead.
   */
  | { kind: 'slow_starter'; breakpoint: number; malus: number; bonus: number }
  /** Any shield gained by this side is multiplied (e.g., 2 = double). */
  | { kind: 'double_shield' }
  /** At battle start, gain `amount` shield. */
  | { kind: 'grant_shield'; amount: number }
  /** When the last active skill is used, grant self a reflect shield of `amount`. */
  | { kind: 'grant_reflect_shield_on_last_active'; amount: number }
  /** When the last active skill is used, grant self a ghost shield of `amount` (reflects absorbed + floor(atk*0.5)). */
  | { kind: 'grant_ghost_shield_on_last_active'; amount: number }
  /** Defender flag: incoming attacks of `attackKind` are fully nullified. */
  | { kind: 'selective_immune'; attackKind: Exclude<AttackKind, 'passthrough'> }
  /** Defender flag: incoming attacks of `attackKind` lose `amount` damage. */
  | { kind: 'attack_kind_resist'; attackKind: Exclude<AttackKind, 'passthrough'>; amount: number }
  /** When this side would drop to 0 HP for the first time, deal `amount` true damage to the opponent (the user still dies if not also revived). */
  | { kind: 'last_breath'; amount: number }
  /** While `activesUsedCount < until`, this side takes 0 damage. Wears off after the threshold. */
  | { kind: 'immortal_first_phase'; until: number }
  /** Once per battle, when reduced to ≤0 HP, restore to full instead. */
  /** At battle start, gain `+allBonus` ATK/DEF/SPD; at each own turn start, lose `hpDrain` HP. */
  | { kind: 'chronos'; allBonus: number; hpDrain: number }
  /** Dynamic: when only one own active remains, gain `amount` to ATK/DEF/SPD attack-side calculations. */
  | { kind: 'final_form'; amount: number }
  /**
   * At battle start: opponent becomes unable to dodge, and the user's attacks
   * ignore the opponent's DEF for the rest of the battle. Cost (self): SPD is
   * locked to 0 (battle-long, cannot be raised by buffs) and ATK is reduced
   * by 2.
   */
  | { kind: 'absolute_zero' }
  /** At battle start, all this side's attacks bypass the opponent's shields (regular / reflect / ghost / threshold). DEF is still applied normally. */
  | { kind: 'pierce_all_shields' }
  /** Any normal shield gained by this side is converted to reflect shield instead. */
  | { kind: 'shield_to_reflect' }
  /** Any normal shield or reflect shield gained by this side is converted to ghost shield instead. */
  | { kind: 'shield_reflect_to_ghost' };

export type PassiveSkill = {
  id: string;
  name: string;
  trigger: PassiveTrigger;
  effect: PassiveEffect;
  /** Rarity, when the passive came from a SkillCard (base-monster passives have none). */
  rarity?: Rarity;
  /** Short noun (e.g. "ガード") used to compose monster display names. */
  nameTag?: string;
  /** Optional classification tag (e.g., 'sin'). */
  tag?: SkillTag;
  /** Manual override for the passive's description text (used by monster-base passives via the dev editor). Falls back to auto-generated text if absent. */
  description?: string;
};

export type MonsterBase = {
  baseId: string;
  name: string;
  stats: Stats;
  passives: PassiveSkill[];
  /** Visual attack category used when the monster's own attack kind is referenced. */
  attackKind: Exclude<AttackKind, 'passthrough'>;
  /** If true, excluded from the initial monster pick pool. */
  hidden?: boolean;
};

export type Monster = {
  ownerId: string;
  baseId: string;
  name: string;
  stats: Stats;
  passives: PassiveSkill[];
  actives: ActiveSkill[];
  attackKind: Exclude<AttackKind, 'passthrough'>;
};

/** Event card target selectors. */
export type EventTarget = 'all' | 'random' | 'lowestHp' | 'highestAtk';

export type EventEffect =
  | { kind: 'stat_mod'; stat: StatKey; amount: number }
  | { kind: 'swap_stat'; stat: StatKey }
  | { kind: 'heal'; amount: number }
  | { kind: 'damage'; amount: number }
  | { kind: 'add_skill_top' }
  /** Reverse every monster's active-skill order for the next battle. */
  | { kind: 'reverse_actives_next_battle' }
  /** Skip the upcoming action phase of this mini-round. */
  | { kind: 'skip_action_phase' }
  /** Skip the upcoming draft phase of this mini-round. */
  | { kind: 'skip_draft_phase' }
  /** Run a one-off battle now, then resume with action → draft of this mini-round. */
  | { kind: 'extra_battle' };

export type EventCard = {
  id: string;
  name: string;
  target: EventTarget;
  effect: EventEffect;
};

export type ActionEffect =
  | { kind: 'stat_mod'; stat: StatKey; amount: number }
  /** Player picks one of HP/ATK/DEF/SPD to bump. Requires `chosenStat` on submission. */
  | { kind: 'stat_mod_choice'; amount: number }
  | { kind: 'recover_skill_from_grave' }
  | { kind: 'draw_skill_top' }
  | { kind: 'discard_random_active' }
  /** Discard one random sin-tagged skill from the user's monster. No-op if none. */
  | { kind: 'cleanse_sin' }
  | { kind: 'gain_passive'; passive: PassiveSkill }
  /** Swap the order of two active skills on any player's monster (target chosen at play time). */
  | { kind: 'swap_actives' }
  /**
   * Transform the user's monster into バグ. Stats become バグ's base + the
   * monster's current stats (sum). Base passives are replaced with バグ's;
   * passives gained from skill cards are preserved.
   */
  | { kind: 'become_bug' };

export type ActionCard = {
  id: string;
  name: string;
  effect: ActionEffect;
};

export type SkillCard = {
  id: string;
  name: string;
  rarity: Rarity;
  /** Noun used to compose monster names (e.g. "パワー"). Absent on N-rarity cards. */
  nameTag?: string;
  /** Optional classification tag (e.g., 'sin'). Propagated to the resulting ActiveSkill/PassiveSkill on acquisition. */
  tag?: SkillTag;
  /** If undefined this skill becomes an active skill (default). */
  isPassive?: boolean;
  active?: Omit<ActiveSkill, 'id' | 'order' | 'name' | 'nameTag'>;
  passive?: Omit<PassiveSkill, 'id' | 'name' | 'nameTag'>;
  /** Manual override for the card's description text shown to players. Falls back to auto-generated text if absent. */
  description?: string;
};

/** Full snapshot of a monster as it entered battle — included in the log so a
 * battle can be fully reconstructed/analysed from its log alone. */
export type BattleMonsterSnapshot = {
  ownerId: string;
  baseId: string;
  name: string;
  attackKind: Exclude<AttackKind, 'passthrough'>;
  stats: Stats;
  passives: PassiveSkill[];
  actives: ActiveSkill[];
};

export type BattleEvent =
  | { kind: 'battle_start'; a: BattleMonsterSnapshot; b: BattleMonsterSnapshot }
  | { kind: 'roll'; player: 'a' | 'b'; spd: number; die: number; total: number }
  | { kind: 'first'; player: 'a' | 'b' }
  | { kind: 'skill_use'; player: 'a' | 'b'; skillId: string; name: string }
  | { kind: 'damage'; from: 'a' | 'b'; to: 'a' | 'b'; amount: number; hpAfter: number }
  | { kind: 'miss'; from: 'a' | 'b'; to: 'a' | 'b' }
  | { kind: 'heal'; player: 'a' | 'b'; amount: number; hpAfter: number }
  | { kind: 'buff'; player: 'a' | 'b'; stat: StatKey; amount: number; duration: 'once' | 'battle' }
  | { kind: 'debuff'; player: 'a' | 'b'; stat: StatKey; amount: number; duration: 'once' | 'battle' }
  | { kind: 'nullified'; player: 'a' | 'b'; skillId: string }
  | { kind: 'amp_set'; player: 'a' | 'b'; mult: number }
  | { kind: 'shield'; player: 'a' | 'b'; amount: number }
  | { kind: 'passive'; player: 'a' | 'b'; passiveId: string }
  /** A side's turn was skipped (consumed a pending pause flag). */
  | { kind: 'turn_skipped'; player: 'a' | 'b' }
  /** A side's remaining actives were shuffled. */
  | { kind: 'actives_shuffled'; player: 'a' | 'b' }
  /** A skill fizzled (e.g. multi-attack pending but the next skill wasn't an attack). */
  | { kind: 'skill_fizzle'; player: 'a' | 'b'; skillId: string; selfDamage: number }
  | { kind: 'hp_swap'; playerA: 'a' | 'b'; playerB: 'a' | 'b'; hpA: number; hpB: number }
  | { kind: 'sin_bonus'; player: 'a' | 'b'; sinCount: number; atk: number; def: number; spd: number }
  | { kind: 'end'; winner: 'a' | 'b' | 'draw'; reason: 'hp_zero' | 'tiebreak_hp' | 'tiebreak_spd' | 'draw' };

export type BattleResult = {
  winner: 'a' | 'b' | 'draw';
  log: BattleEvent[];
  finalHp: { a: number; b: number };
};

// ─── Game (multi-phase) state ────────────────────────────────────────────────

/** Number of skill slots per player (fixed). */
export const TOTAL_SKILL_SLOTS = 9;

export type Player = {
  id: string;
  name: string;
  isCPU: boolean;
  monster: Monster | null;
  /** The player's seat color used for draft pieces. */
  color: Color;
  /**
   * Personal hand of action cards. Filled to 4 right after monster pick,
   * grows by 1 each action phase, shrinks by 1 each time the player plays.
   * Visible only to the owner over the wire.
   */
  actionHand: ActionCard[];
  /** All skill cards the player owns but hasn't slotted. */
  skillStock: SkillCard[];
  /**
   * Exactly TOTAL_SKILL_SLOTS (9) entries. null = default attack (ATK×1.0).
   * Only indices 0..activeSlotCount-1 are active in battle; the rest are inactive.
   */
  skillSlots: (SkillCard | null)[];
  /**
   * How many of the 9 slots participate in battle (0-TOTAL_SKILL_SLOTS).
   * Removing slot N sets activeSlotCount = N-1, making slots N..8 inactive.
   */
  activeSlotCount: number;
};

export type Phase =
  | 'setup'
  | 'pick_monster'
  | 'event'
  | 'action'
  | 'draft'
  | 'build'
  | 'battle'
  | 'reward'
  | 'tournament'
  | 'finished';

/** Pack-based booster draft state. */
export type PackDraftState = {
  /** Fixed player order for this draft (randomized at draft start). */
  draftOrder: string[];
  /** Which pass we're on (0-4, one per card in each pack). */
  passIndex: number;
  /** Each player's current pack of cards to pick from. */
  packs: Record<string, SkillCard[]>;
  /** Player IDs that still need to make a pick this pass. */
  pendingPlayerIds: string[];
  /** Submitted picks for the current pass: playerId -> cardId. */
  submittedPicks: Record<string, string>;
  /** Cards each player has acquired so far (actual card objects). */
  acquired: Record<string, SkillCard[]>;
  /** True for ~2s after all picks are submitted so clients can show everyone's choices. */
  revealing?: boolean;
};

/** Build phase state: players arrange their skillStock into skillSlots. */
export type BuildPhaseState = {
  /** Player IDs that still need to submit their build. */
  pendingPlayerIds: string[];
  /**
   * Submitted build configs per player.
   * slots: 9-entry array, each is a card ID or null (= default attack).
   * activeSlotCount: how many of those 9 slots are active in battle.
   */
  submittedSlots: Record<string, { slots: (string | null)[]; activeSlotCount: number }>;
};

/** Monster pick draft — analogous to skill DraftState but for monsters. */
export type MonsterPickState = {
  /** Monsters currently revealed and available for claiming. */
  pool: MonsterBase[];
  /** Players still without a monster, who must submit a pick. */
  pendingPlayerIds: string[];
  /** Submitted picks this sub-round. */
  submittedPicks: Record<string, string>; // playerId -> baseId
  /** Number of resolution attempts so far. */
  attempt: number;
  /** True for ~2s after all picks are submitted so clients can show everyone's choices. */
  revealing?: boolean;
};

/** Selection state during an action phase: each pending player must play one card from their hand. */
export type ActionPhaseState = {
  pendingPlayerIds: string[];
  /** playerId → submitted play (cardId + any required choice payload). */
  submittedPlays: Record<string, ActionPlay>;
};

export type ActionPlay = {
  cardId: string;
  /** Required for stat_mod_choice cards; ignored otherwise. */
  chosenStat?: StatKey;
  /** Required for swap_actives cards; ignored otherwise. */
  swap?: {
    targetPlayerId: string;
    skillIdA: string;
    skillIdB: string;
  };
};

export type BattleMatch = {
  a: string; // playerId
  b: string;
  winner: 'a' | 'b' | 'draw' | null;
  /** HP at the start of battle. Used as the bar's max. */
  startHpA: number;
  startHpB: number;
  finalHpA: number;
  finalHpB: number;
  log: BattleEvent[];
};

export type BattlePhaseState = {
  matches: BattleMatch[];
};

export type RewardChoice =
  | { kind: 'stat_up'; stat: StatKey }
  | { kind: 'skill_top' };

export type RewardState = {
  pendingPlayerIds: string[];
  choices: Record<string, RewardChoice>;
};

export type TournamentMatch = {
  round: number; // 1=quarter, 2=semi, 3=final
  matchIdx: number;
  a: string;
  b: string;
  winner: string | null;
  startHpA: number;
  startHpB: number;
  finalHpA: number;
  finalHpB: number;
  log: BattleEvent[];
};

export type TournamentState = {
  bracket: TournamentMatch[];
  /** Players still alive at the start of each round; rounds[0] is round 1. */
  rounds: string[][];
  /** 1-indexed current round; matches in this round consume rounds[currentRound-1] in pairs. */
  currentRound: number;
  /** Pair index (0-based) into rounds[currentRound-1] for the next match to run. */
  pairIdx: number;
  /** Total number of rounds (log2 of bracket size). */
  totalRounds: number;
  champion: string | null;
};

export type Champion = {
  playerId: string;
  monster: Monster;
};

/** Snapshot of the most recent event phase, used for the client-side display. */
export type EventPhaseSummary = {
  cardId: string;
  cardName: string;
  /** Selector label, e.g. "全員" / "HP最少". */
  targetLabel: string;
  /** Effect description, e.g. "HP-3". */
  effectDesc: string;
  /** Players actually targeted after selection. */
  targetIds: string[];
};

/** Snapshot of the most recent action phase, used for the client-side display. */
export type ActionPhaseSummary = {
  plays: {
    playerId: string;
    cardId: string;
    cardName: string;
    /** Effect description, e.g. "ATK+1 (永続)". */
    effectDesc: string;
  }[];
};

export type GameEvent =
  | { kind: 'phase_change'; phase: Phase; round: number; miniRound: number }
  | { kind: 'monster_pick_revealed'; baseIds: string[] }
  | { kind: 'monster_pick_submitted'; playerId: string; baseId: string }
  | { kind: 'monster_pick_resolved'; assignments: Record<string, string> }
  | { kind: 'monster_pick_conflict'; baseId: string; players: string[] }
  | { kind: 'monster_picked'; playerId: string; baseId: string }
  | { kind: 'event_played'; cardId: string; targets: string[] }
  | { kind: 'event_effect_applied'; cardId: string; playerId: string }
  | { kind: 'action_played'; playerId: string; cardId: string }
  | { kind: 'skill_acquired'; playerId: string; skillId: string; rarity: Rarity }
  | { kind: 'draft_revealed'; cards: string[] }
  | { kind: 'draft_pick_submitted'; playerId: string; skillId: string }
  | { kind: 'draft_pass_resolved'; passIndex: number }
  | { kind: 'draft_finished' }
  | { kind: 'build_submitted'; playerId: string; slotCount: number }
  | { kind: 'build_resolved' }
  | { kind: 'battle_match'; a: string; b: string; winner: 'a' | 'b' | 'draw' }
  | { kind: 'reward_chosen'; playerId: string; choice: RewardChoice }
  | { kind: 'tournament_match'; round: number; a: string; b: string; winner: string }
  | { kind: 'champion'; playerId: string };

export type GameState = {
  roomId: string;
  rngState: number;
  players: Player[];
  /** Monster pick draft state (null outside of pick_monster phase). */
  monsterPick: MonsterPickState | null;
  round: number; // 1..totalRounds
  miniRound: number; // 1..miniRoundsPerRound (kept for compatibility, not used in main flow)
  /** Configurable: how many big rounds the game runs for (default 3). */
  totalRounds: number;
  /** Configurable: how many event/action/draft cycles each round contains (default 3). */
  miniRoundsPerRound: number;
  phase: Phase;
  decks: {
    event: EventCard[];
    action: ActionCard[];
    skill: SkillCard[];
    eventGrave: EventCard[];
    actionGrave: ActionCard[];
    skillGrave: SkillCard[];
  };
  /** Pack-based booster draft state (null outside of draft phase). */
  packDraft: PackDraftState | null;
  /** Build phase state (null outside of build phase). */
  buildPhase: BuildPhaseState | null;
  /** Active during action phase while waiting for plays. Null otherwise. */
  actionPhase: ActionPhaseState | null;
  battle: BattlePhaseState | null;
  reward: RewardState | null;
  tournament: TournamentState | null;
  champion: Champion | null;
  /** Counter for generating unique skill instance IDs when adding to monsters. */
  nextSkillInstanceSeq: number;
  log: GameEvent[];
  /** Snapshot of the most recently resolved event phase (server populates, ws layer displays). */
  eventPhaseSummary: EventPhaseSummary | null;
  /** Snapshot of the most recently resolved action phase. */
  actionPhaseSummary: ActionPhaseSummary | null;
  /** When true, the next battle reverses every monster's active-skill order. Cleared after the battle phase resolves. */
  nextBattleReverseActives: boolean;
  /** When true, the upcoming `advanceFromEvent` skips action and goes straight to draft. Cleared on use. */
  skipNextActionPhase: boolean;
  /** When true, the upcoming `advanceFromEvent` transitions to battle (extra battle). Cleared on use. */
  extraBattlePending: boolean;
  /** Set when an extra battle starts so the following reward returns to battle instead of advancing the round. */
  returnToBattleAfterReward: boolean;
};
