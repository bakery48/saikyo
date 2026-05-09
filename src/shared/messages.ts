import type {
  ActionCard,
  ActionPhaseState,
  ActionPhaseSummary,
  BattleMatch,
  Champion,
  Color,
  DraftState,
  EventCard,
  EventPhaseSummary,
  GameEvent,
  Monster,
  MonsterPickState,
  Phase,
  RewardChoice,
  RewardState,
  SkillCard,
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
  pendingBuffsCount: number;
  /** Number of action cards in hand (contents only visible to the owner via myActionHand). */
  actionHandCount: number;
};

/** Sanitized game state — deck contents are hidden, only counts shown. */
export type ClientGameState = {
  roomId: string;
  players: ClientPlayer[];
  monsterPick: MonsterPickState | null;
  round: number;
  miniRound: number;
  /** Number of big rounds for this game (1-3). */
  totalRounds: number;
  /** Mini-round cycles per round for this game (1-3). */
  miniRoundsPerRound: number;
  phase: Phase;
  draft: DraftState | null;
  /** Action phase selection state — set while waiting for plays. */
  actionPhase: ActionPhaseState | null;
  /** This viewer's hand of action cards (always visible to its owner). Null for non-player viewers. */
  myActionHand: ActionCard[] | null;
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
  | { type: 'leave_room' }
  | { type: 'set_ready'; isReady: boolean }
  | { type: 'list_rooms' }
  | { type: 'start_game' }
  | {
      type: 'set_room_settings';
      totalRounds?: number;
      miniRoundsPerRound?: number;
    }
  | { type: 'submit_pick'; baseId: string }
  | { type: 'submit_draft'; skillId: string }
  | { type: 'play_action_card'; cardId: string }
  | { type: 'submit_reward'; choice: RewardChoice }
  | { type: 'rename_monster'; name: string }
  | { type: 'leave_game' };

/** Messages the server sends to the client. */
export type ServerMessage =
  | { type: 'welcome'; playerId: string }
  | { type: 'room_state'; room: RoomView }
  | { type: 'rooms_list'; rooms: RoomSummary[] }
  | { type: 'left_room' }
  | { type: 'game_state'; state: ClientGameState }
  | { type: 'error'; message: string };
