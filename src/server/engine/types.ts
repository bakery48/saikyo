export type Rarity = 'N' | 'R' | 'SR' | 'SSR';

export type Stats = {
  hp: number;
  atk: number;
  def: number;
  spd: number;
};

export type StatKey = keyof Stats;

/** Effects produced by active skills resolved during a battle. */
export type SkillEffect =
  /** Deal physical damage = max(1, floor(useStat * mult) - target.def). */
  | { kind: 'attack'; mult: number; useStat: 'atk' | 'spd' }
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
  /** Heal self. */
  | { kind: 'heal'; amount: number }
  /** Reduce next incoming damage by a flat amount. */
  | { kind: 'shield'; amount: number };

export type ActiveSkill = {
  id: string;
  /** Sequence number — actives are processed top-to-bottom by `order`. */
  order: number;
  name: string;
  rarity?: Rarity;
  effect: SkillEffect;
};

/** Triggers for passives. (Battle-relevant only at this stage.) */
export type PassiveTrigger =
  | { kind: 'first_attack' }
  | { kind: 'battle_start' }
  | { kind: 'on_own_turn_start' }
  | { kind: 'on_take_damage' };

export type PassiveEffect =
  | { kind: 'stat_mod'; stat: StatKey; amount: number }
  | { kind: 'first_attack_amp'; amount: number }
  | { kind: 'first_attack_true'; }
  | { kind: 'spd_roll_bonus'; amount: number }
  | { kind: 'damage_reduction'; amount: number }
  | { kind: 'turn_start_heal'; amount: number }
  | { kind: 'damage_negate_chance'; oneIn: number }
  | { kind: 'pick_higher_buff'; amount: number }
  | { kind: 'amp_each_active'; amount: number };

export type PassiveSkill = {
  id: string;
  name: string;
  trigger: PassiveTrigger;
  effect: PassiveEffect;
};

export type MonsterBase = {
  baseId: string;
  name: string;
  stats: Stats;
  passives: PassiveSkill[];
};

export type Monster = {
  ownerId: string;
  baseId: string;
  name: string;
  stats: Stats;
  passives: PassiveSkill[];
  actives: ActiveSkill[];
};

/** Event card target selectors. */
export type EventTarget = 'all' | 'random' | 'lowestHp' | 'highestAtk';

export type EventEffect =
  | { kind: 'stat_mod'; stat: StatKey; amount: number }
  | { kind: 'swap_stat'; stat: StatKey }
  | { kind: 'heal'; amount: number }
  | { kind: 'damage'; amount: number }
  | { kind: 'add_skill_top' };

export type EventCard = {
  id: string;
  name: string;
  target: EventTarget;
  effect: EventEffect;
};

export type ActionEffect =
  | { kind: 'stat_mod'; stat: StatKey; amount: number; duration: 'next_battle' | 'permanent' }
  | { kind: 'recover_skill_from_grave' }
  | { kind: 'draw_skill_top' }
  | { kind: 'discard_random_active' }
  | { kind: 'gain_passive'; passive: PassiveSkill };

export type ActionCard = {
  id: string;
  name: string;
  effect: ActionEffect;
};

export type SkillCard = {
  id: string;
  name: string;
  rarity: Rarity;
  /** If undefined this skill becomes an active skill (default). */
  isPassive?: boolean;
  active?: Omit<ActiveSkill, 'id' | 'order' | 'name'>;
  passive?: Omit<PassiveSkill, 'id' | 'name'>;
};

export type BattleEvent =
  | { kind: 'roll'; player: 'a' | 'b'; spd: number; die: number; total: number }
  | { kind: 'first'; player: 'a' | 'b' }
  | { kind: 'skill_use'; player: 'a' | 'b'; skillId: string; name: string }
  | { kind: 'damage'; from: 'a' | 'b'; to: 'a' | 'b'; amount: number; hpAfter: number }
  | { kind: 'heal'; player: 'a' | 'b'; amount: number; hpAfter: number }
  | { kind: 'buff'; player: 'a' | 'b'; stat: StatKey; amount: number; duration: 'once' | 'battle' }
  | { kind: 'debuff'; player: 'a' | 'b'; stat: StatKey; amount: number; duration: 'once' | 'battle' }
  | { kind: 'nullified'; player: 'a' | 'b'; skillId: string }
  | { kind: 'amp_set'; player: 'a' | 'b'; mult: number }
  | { kind: 'shield'; player: 'a' | 'b'; amount: number }
  | { kind: 'passive'; player: 'a' | 'b'; passiveId: string }
  | { kind: 'end'; winner: 'a' | 'b' | 'draw'; reason: 'hp_zero' | 'tiebreak_hp' | 'tiebreak_spd' | 'draw' };

export type BattleResult = {
  winner: 'a' | 'b' | 'draw';
  log: BattleEvent[];
  finalHp: { a: number; b: number };
};
