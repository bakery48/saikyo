import type {
  Champion,
  DraftState,
  Monster,
  MonsterBase,
  Phase,
  RewardChoice,
  TournamentState,
  GameEvent,
  BattleMatch,
  RewardState,
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
  monster: Monster | null;
  pendingBuffsCount: number;
};

/** Sanitized game state — deck contents are hidden, only counts shown. */
export type ClientGameState = {
  roomId: string;
  players: ClientPlayer[];
  monsterPool: MonsterBase[];
  pickOrder: string[];
  pickIdx: number;
  round: number;
  miniRound: number;
  phase: Phase;
  draft: DraftState | null;
  battle: { matches: BattleMatch[] } | null;
  reward: RewardState | null;
  tournament: TournamentState | null;
  champion: Champion | null;
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
};

/** Messages the client sends to the server. */
export type ClientMessage =
  | { type: 'create_room'; playerName: string }
  | { type: 'join_room'; roomId: string; playerName: string }
  | { type: 'leave_room' }
  | { type: 'set_ready'; isReady: boolean }
  | { type: 'list_rooms' }
  | { type: 'start_game' }
  | { type: 'submit_pick'; baseId: string }
  | { type: 'submit_draft'; skillId: string }
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
