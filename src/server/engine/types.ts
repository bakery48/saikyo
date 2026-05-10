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
export type AttackKind = 'strike' | 'sword' | 'claw' | 'magic' | 'passthrough';

/** Effects produced by active skills resolved during a battle. */
export type SkillEffect =
  /** Deal physical damage = max(1, floor(useStat * mult) - target.def). */
  | { kind: 'attack'; mult: number; useStat: 'atk' | 'spd'; attackKind?: AttackKind }
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
  | { kind: 'shield'; amount: number }
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
   * one. Always self-damages by `selfDamage`. The skill is single-use per
   * battle (can't be brought back via further rewinds). Fizzles harmlessly if
   * the rewind target doesn't exist or is already consumed.
   */
  | { kind: 'rewind_skill'; rewindBy: number; selfDamage: number }
  /**
   * Attack with bonus ATK = number of times this exact skill has been used in
   * the current battle (counting the current use). Damage formula otherwise
   * matches `attack` with `mult` × `useStat`.
   */
  | { kind: 'deja_vu_attack'; mult: number; useStat: 'atk' | 'spd'; attackKind?: AttackKind };

export type ActiveSkill = {
  id: string;
  /** Sequence number — actives are processed top-to-bottom by `order`. */
  order: number;
  name: string;
  rarity?: Rarity;
  /** Short noun (e.g. "パワー") used to compose monster display names. */
  nameTag?: string;
  effect: SkillEffect;
};

/** Triggers for passives. (Battle-relevant only at this stage.) */
export type PassiveTrigger =
  | { kind: 'first_attack' }
  | { kind: 'battle_start' }
  | { kind: 'on_own_turn_start' }
  | { kind: 'on_take_damage' }
  | { kind: 'on_deal_damage' }
  | { kind: 'on_own_active_used' };

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
  | { kind: 'damage_negate_chance'; oneIn: number }
  /** Flat % added to the SPD dodge roll on incoming attacks. */
  | { kind: 'dodge_bonus'; percent: number }
  | { kind: 'pick_higher_buff'; amount: number }
  /**
   * Adds `amount` ATK for each `every` (default 1) actives this side has
   * already used in the battle. So `{ amount: 1, every: 1 }` is +1 ATK per
   * attack; `{ amount: 2, every: 2 }` is +2 every 2 attacks.
   */
  | { kind: 'atk_per_active'; amount: number; every?: number }
  /** Heal floor(damage / denominator) for every hit landed by this monster. */
  | { kind: 'lifesteal'; denominator: number }
  /** Each time this side takes damage, gain `amount` ATK (battle-long, accumulating). */
  | { kind: 'rage_atk'; amount: number }
  /** Each time this side deals damage, reduce target's DEF by `amount` (battle-long, accumulating). */
  | { kind: 'hex_def'; amount: number }
  /** Each active skill use has a `percent` chance to fire a second time. */
  | { kind: 'extra_attack_chance'; percent: number }
  /** When taking damage, reflect floor(damage / denominator) back to the attacker. */
  | { kind: 'counter_damage'; denominator: number }
  /** While hp ≤ maxHp/2, gain `amount` ATK on attacks (dynamic check at attack time). */
  | { kind: 'low_hp_atk_bonus'; amount: number }
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
  /** When attacking, with `percent` chance multiply post-DEF damage by `mult`. */
  | { kind: 'crit_chance'; percent: number; mult: number }
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
  | { kind: 'mid_damage_immune'; min: number; max: number };

export type PassiveSkill = {
  id: string;
  name: string;
  trigger: PassiveTrigger;
  effect: PassiveEffect;
  /** Rarity, when the passive came from a SkillCard (base-monster passives have none). */
  rarity?: Rarity;
  /** Short noun (e.g. "ガード") used to compose monster display names. */
  nameTag?: string;
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
  | { kind: 'gain_passive'; passive: PassiveSkill }
  /** Swap the order of two active skills on any player's monster (target chosen at play time). */
  | { kind: 'swap_actives' };

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
  /** If undefined this skill becomes an active skill (default). */
  isPassive?: boolean;
  active?: Omit<ActiveSkill, 'id' | 'order' | 'name' | 'nameTag'>;
  passive?: Omit<PassiveSkill, 'id' | 'name' | 'nameTag'>;
};

export type BattleEvent =
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
  | { kind: 'end'; winner: 'a' | 'b' | 'draw'; reason: 'hp_zero' | 'tiebreak_hp' | 'tiebreak_spd' | 'draw' };

export type BattleResult = {
  winner: 'a' | 'b' | 'draw';
  log: BattleEvent[];
  finalHp: { a: number; b: number };
};

// ─── Game (multi-phase) state ────────────────────────────────────────────────

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
};

export type Phase =
  | 'setup'
  | 'pick_monster'
  | 'event'
  | 'action'
  | 'draft'
  | 'battle'
  | 'reward'
  | 'tournament'
  | 'finished';

export type DraftState = {
  /** Cards currently revealed and available for picking. */
  pool: SkillCard[];
  /** Player IDs that still need to make a pick. */
  pendingPlayerIds: string[];
  /** Submitted picks for the current draft sub-round. */
  submittedPicks: Record<string, string>; // playerId -> skillCardId
  /** Cards each player has acquired during this draft phase. */
  acquired: Record<string, string[]>; // playerId -> skillCardIds
  /** Cards removed from the pool because of conflicts. */
  setAside: SkillCard[];
  /** Number of resolution attempts so far (used to break ties). */
  attempt: number;
  /** True for ~2s after all picks are submitted so clients can show everyone's choices. */
  revealing?: boolean;
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
  log: BattleEvent[];
};

export type TournamentState = {
  bracket: TournamentMatch[];
  currentMatchIdx: number;
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
  | { kind: 'draft_resolved'; assignments: Record<string, string> } // playerId -> skillId
  | { kind: 'draft_conflict'; skillId: string; players: string[] }
  | { kind: 'draft_fallback'; playerId: string; skillId: string }
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
  miniRound: number; // 1..miniRoundsPerRound (event/action/draft cycles within a round)
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
  draft: DraftState | null;
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
  /** When true, the upcoming `startDraft` call skips drafting and advances to the next phase. Cleared on use. */
  skipNextDraftPhase: boolean;
  /** When true, the upcoming `advanceFromEvent` transitions to battle (extra battle). Cleared on use. */
  extraBattlePending: boolean;
  /** Set when an extra battle starts so the following reward returns to action instead of advancing the round. */
  returnToActionAfterReward: boolean;
};
