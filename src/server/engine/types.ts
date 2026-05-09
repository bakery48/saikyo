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
  /** Short noun (e.g. "パワー") used to compose monster display names. */
  nameTag?: string;
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

// ─── Game (multi-phase) state ────────────────────────────────────────────────

export type PendingStatBuff = {
  stat: StatKey;
  amount: number;
  duration: 'next_battle' | 'permanent';
};

export type Player = {
  id: string;
  name: string;
  isCPU: boolean;
  monster: Monster | null;
  /** Stat buffs queued by action cards that take effect on the next battle. */
  pendingBuffs: PendingStatBuff[];
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
  /** playerId → cardId chosen this phase (must be in the player's hand). */
  submittedPlays: Record<string, string>;
};

export type BattleMatch = {
  a: string; // playerId
  b: string;
  winner: 'a' | 'b' | 'draw' | null;
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
  round: number; // 1..3 (big rounds)
  miniRound: number; // 1..3 (event/action/draft cycles within a round)
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
};
