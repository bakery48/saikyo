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

/** Messages the client sends to the server. */
export type ClientMessage =
  | { type: 'create_room'; playerName: string }
  | { type: 'join_room'; roomId: string; playerName: string }
  | { type: 'leave_room' }
  | { type: 'set_ready'; isReady: boolean }
  | { type: 'list_rooms' };

/** Messages the server sends to the client. */
export type ServerMessage =
  | { type: 'welcome'; playerId: string }
  | { type: 'room_state'; room: RoomView }
  | { type: 'rooms_list'; rooms: RoomSummary[] }
  | { type: 'left_room' }
  | { type: 'error'; message: string };
