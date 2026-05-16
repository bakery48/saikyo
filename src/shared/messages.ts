import type {
  ActionCard,
  ActionPhaseState,
  ActionPhaseSummary,
  BattleMatch,
  BuildPhaseState,
  Champion,
  Color,
  EventCard,
  EventPhaseSummary,
  GameEvent,
  Monster,
  MonsterBoon,
  MonsterPickState,
  PackDraftState,
  Phase,
  RewardChoice,
  RewardState,
  SkillCard,
  StatKey,
  TournamentState,
} from '../server/engine/types';

/** Public view of a player inside a room. */
export type RoomPlayerView = {
  id: string;
  name: string;
  isReady: boolean;
  isHost: boolean;
};

/** Full view of a room sent to its members. */
export type RoomView = {
  id: string;
  hostId: string;
  players: RoomPlayerView[];
  inGame: boolean;
  /** Number of big rounds the game will run for (1-3). */
  totalRounds: number;
  /** Number of event/action/draft cycles per round (1-3). */
  miniRoundsPerRound: number;
  /** Per-card skill deck counts (cardId -> 0|1|2|3). Missing entries use rarity defaults. */
  skillCardCounts: Record<string, number>;
};

/** Compact view used in the lobby's room list. */
export type RoomSummary = {
  id: string;
  hostName: string;
  playerCount: number;
  inGame: boolean;
};

/** Player as seen by clients during a game. */
export type ClientPlayer = {
  id: string;
  name: string;
  isCPU: boolean;
  color: Color;
  monster: Monster | null;
  /** Number of action cards in hand (contents only visible to the owner via myActionHand). */
  actionHandCount: number;
};

/** Sanitized game state — deck contents are hidden, only counts shown. */
export type ClientGameState = {
  roomId: string;
  players: ClientPlayer[];
  monsterPick: MonsterPickState | null;
  boonPick: {
    pendingPlayerIds: string[];
    submittedCount: number;
    myBoons: MonsterBoon[] | null;
  } | null;
  round: number;
  miniRound: number;
  /** Number of big rounds for this game (1-3). */
  totalRounds: number;
  /** Mini-round cycles per round for this game (1-3). */
  miniRoundsPerRound: number;
  phase: Phase;
  /** Pack-based booster draft state (null outside of draft phase). */
  packDraft: PackDraftState | null;
  /** Build phase state (null outside of build phase). */
  buildPhase: BuildPhaseState | null;
  /** Action phase selection state — set while waiting for plays. */
  actionPhase: ActionPhaseState | null;
  /** This viewer's hand of action cards (always visible to its owner). Null for non-player viewers. */
  myActionHand: ActionCard[] | null;
  /** Monster-specific action card — always available, never consumed. Null before pick phase. */
  myUniqueActionCard: ActionCard | null;
  /** This viewer's skill stock (all owned cards not slotted). Null for non-player viewers. */
  mySkillStock: SkillCard[] | null;
  /** This viewer's skill slots (active in battle). Null for non-player viewers. */
  mySkillSlots: (SkillCard | null)[] | null;
  myActiveSlotCount: number | null;
  battle: { matches: BattleMatch[] } | null;
  reward: RewardState | null;
  tournament: TournamentState | null;
  champion: Champion | null;
  /** Snapshot of the most recently resolved event phase (set during the event display window). */
  eventPhaseSummary: EventPhaseSummary | null;
  /** Snapshot of the most recently resolved action phase. */
  actionPhaseSummary: ActionPhaseSummary | null;
  /** Last ~80 game events. */
  recentLog: GameEvent[];
  deckCounts: {
    event: number;
    action: number;
    skill: number;
    eventGrave: number;
    actionGrave: number;
    skillGrave: number;
  };
  /**
   * Full deck + grave contents for every shared deck (debug-friendly
   * inspection). Note that exposing the skill deck breaks draft secrecy —
   * keep the inspector hidden behind a clearly-labelled debug UI.
   */
  publicDecks: {
    event: EventCard[];
    eventGrave: EventCard[];
    action: ActionCard[];
    actionGrave: ActionCard[];
    skill: SkillCard[];
    skillGrave: SkillCard[];
  };
};

/** Messages the client sends to the server. */
export type ClientMessage =
  | {
      type: 'create_room';
      playerName: string;
      totalRounds?: number;
      miniRoundsPerRound?: number;
    }
  | { type: 'join_room'; roomId: string; playerName: string }
  /** Reconnect handshake: try to reclaim a seat held during the grace period. */
  | { type: 'rejoin'; playerId: string }
  | { type: 'leave_room' }
  | { type: 'set_ready'; isReady: boolean }
  | { type: 'list_rooms' }
  | { type: 'start_game' }
  | {
      type: 'set_room_settings';
      totalRounds?: number;
      miniRoundsPerRound?: number;
      skillCardCounts?: Record<string, number>;
    }
  | { type: 'submit_pick'; baseId: string }
  | { type: 'submit_draft'; skillId: string }
  | {
      type: 'play_action_card';
      cardId: string;
      /** Required when the card's effect is `stat_mod_choice`. */
      chosenStat?: StatKey;
      /** Required when the card's effect is `swap_actives`. */
      swap?: { targetPlayerId: string; skillIdA: string; skillIdB: string };
      /** Required when the card's effect is `curse_player`. */
      curseTargetPlayerId?: string;
    }
  | { type: 'submit_reward'; choice: RewardChoice }
  | { type: 'submit_build'; slots: (string | null)[]; activeSlotCount: number }
  | { type: 'reorder_slots'; order: string[] }
  | { type: 'rename_monster'; name: string }
  | { type: 'leave_game' }
  /** Dev/test only: prepend a specific event card to the top of the event deck. */
  | { type: 'submit_boon'; boonId: string }
  | { type: 'dev_inject_event'; cardId: string }
  /** Dev/test only: replace a card in the caller's action hand with a fresh copy of a chosen one. */
  | { type: 'dev_replace_hand'; oldCardId: string; newCardId: string };

/** Messages the server sends to the client. */
export type ServerMessage =
  | { type: 'welcome'; playerId: string }
  /** Rejoin succeeded — the connection now owns `playerId` again. */
  | { type: 'rejoin_ok'; playerId: string }
  /** Rejoin failed (grace period expired or unknown id) — fall back to lobby. */
  | { type: 'rejoin_failed' }
  | { type: 'room_state'; room: RoomView }
  | { type: 'rooms_list'; rooms: RoomSummary[] }
  | { type: 'left_room' }
  | { type: 'game_state'; state: ClientGameState }
  | { type: 'error'; message: string };
