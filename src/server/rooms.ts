import type { RoomPlayerView, RoomSummary, RoomView } from '../shared/messages';

function clampSetting(n: number): number {
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(3, Math.floor(n)));
}

function clampHandSize(n: number): number {
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(9, Math.floor(n)));
}

export type RoomPlayer = {
  id: string; // session/player id
  name: string;
  isReady: boolean;
};

export type Room = {
  id: string;
  hostId: string;
  players: RoomPlayer[];
  createdAt: number;
  inGame: boolean;
  /** How many big rounds the game runs for (1-3). */
  totalRounds: number;
  /** How many event/action/draft cycles per round (1-3). */
  miniRoundsPerRound: number;
  /** Per-card skill deck counts (cardId -> 0|1|2|3). Missing entries use rarity defaults. */
  skillCardCounts: Record<string, number>;
  /** Event deck size multiplier (1-3). */
  eventCardCount: number;
  /** Maximum player slots (4 or 8). */
  maxPlayers: 4 | 8;
  /** Initial action hand size per player (1-9). */
  initialActionHandSize: number;
};

export class RoomManager {
  private rooms = new Map<string, Room>();
  private playerToRoom = new Map<string, string>();

  createRoom(
    player: RoomPlayer,
    settings?: { totalRounds?: number; miniRoundsPerRound?: number; eventCardCount?: number; maxPlayers?: 4 | 8; initialActionHandSize?: number },
  ): Room {
    if (this.playerToRoom.has(player.id)) {
      throw new Error('player already in a room');
    }
    const id = this.generateRoomId();
    const room: Room = {
      id,
      hostId: player.id,
      players: [{ ...player }],
      createdAt: Date.now(),
      inGame: false,
      totalRounds: clampSetting(settings?.totalRounds ?? 3),
      miniRoundsPerRound: clampSetting(settings?.miniRoundsPerRound ?? 3),
      eventCardCount: clampSetting(settings?.eventCardCount ?? 1),
      skillCardCounts: {},
      maxPlayers: settings?.maxPlayers === 4 ? 4 : 8,
      initialActionHandSize: clampHandSize(settings?.initialActionHandSize ?? 3),
    };
    this.rooms.set(id, room);
    this.playerToRoom.set(player.id, id);
    return room;
  }

  joinRoom(roomId: string, player: RoomPlayer, opts: { allowInGame?: boolean } = {}): Room {
    if (this.playerToRoom.has(player.id)) {
      throw new Error('player already in a room');
    }
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('room not found');
    if (room.inGame && !opts.allowInGame) throw new Error('game already started');
    if (room.players.length >= room.maxPlayers) throw new Error('room is full');
    if (room.players.some((p) => p.id === player.id)) {
      throw new Error('already in room');
    }
    room.players.push({ ...player });
    this.playerToRoom.set(player.id, roomId);
    return room;
  }

  /** Remove a player from whatever room they're in. Returns the room (or null) and whether it was destroyed. */
  leavePlayer(playerId: string): { room: Room | null; destroyed: boolean } {
    const roomId = this.playerToRoom.get(playerId);
    if (!roomId) return { room: null, destroyed: false };
    const room = this.rooms.get(roomId);
    this.playerToRoom.delete(playerId);
    if (!room) return { room: null, destroyed: false };
    room.players = room.players.filter((p) => p.id !== playerId);
    if (room.players.length === 0) {
      this.rooms.delete(room.id);
      return { room: null, destroyed: true };
    }
    if (room.hostId === playerId) {
      room.hostId = room.players[0]!.id;
    }
    return { room, destroyed: false };
  }

  setReady(playerId: string, isReady: boolean): Room | null {
    const roomId = this.playerToRoom.get(playerId);
    if (!roomId) return null;
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return null;
    player.isReady = isReady;
    return room;
  }

  getRoomByPlayer(playerId: string): Room | null {
    const roomId = this.playerToRoom.get(playerId);
    if (!roomId) return null;
    return this.rooms.get(roomId) ?? null;
  }

  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) ?? null;
  }

  listSummaries(): RoomSummary[] {
    return Array.from(this.rooms.values()).map((r) => ({
      id: r.id,
      hostName: r.players.find((p) => p.id === r.hostId)?.name ?? '???',
      playerCount: r.players.length,
      inGame: r.inGame,
      maxPlayers: r.maxPlayers,
    }));
  }

  toRoomView(room: Room): RoomView {
    const players: RoomPlayerView[] = room.players.map((p) => ({
      id: p.id,
      name: p.name,
      isReady: p.isReady,
      isHost: p.id === room.hostId,
    }));
    return {
      id: room.id,
      hostId: room.hostId,
      players,
      inGame: room.inGame,
      totalRounds: room.totalRounds,
      miniRoundsPerRound: room.miniRoundsPerRound,
      eventCardCount: room.eventCardCount,
      skillCardCounts: room.skillCardCounts,
      maxPlayers: room.maxPlayers,
      initialActionHandSize: room.initialActionHandSize,
    };
  }

  /**
   * Host-only: update the round-count settings before the game starts.
   * Throws if the caller isn't the host or the room is already in-game.
   */
  setSettings(
    hostId: string,
    settings: { totalRounds?: number; miniRoundsPerRound?: number; eventCardCount?: number; maxPlayers?: 4 | 8; initialActionHandSize?: number; skillCardCounts?: Record<string, number> },
  ): Room {
    const room = this.getRoomByPlayer(hostId);
    if (!room) throw new Error('not in a room');
    if (room.hostId !== hostId) throw new Error('only the host can change settings');
    if (room.inGame) throw new Error('game already started');
    if (settings.totalRounds !== undefined) {
      room.totalRounds = clampSetting(settings.totalRounds);
    }
    if (settings.miniRoundsPerRound !== undefined) {
      room.miniRoundsPerRound = clampSetting(settings.miniRoundsPerRound);
    }
    if (settings.eventCardCount !== undefined) {
      room.eventCardCount = clampSetting(settings.eventCardCount);
    }
    if (settings.maxPlayers !== undefined) {
      room.maxPlayers = settings.maxPlayers === 4 ? 4 : 8;
    }
    if (settings.initialActionHandSize !== undefined) {
      room.initialActionHandSize = clampHandSize(settings.initialActionHandSize);
    }
    if (settings.skillCardCounts !== undefined) {
      room.skillCardCounts = settings.skillCardCounts;
    }
    return room;
  }

  private generateRoomId(): string {
    // 4-char base36, retry on collision.
    for (let i = 0; i < 5; i++) {
      const id = Math.floor(Math.random() * 36 ** 4)
        .toString(36)
        .padStart(4, '0')
        .toUpperCase();
      if (!this.rooms.has(id)) return id;
    }
    // Fallback to longer id.
    return Math.random().toString(36).slice(2, 10).toUpperCase();
  }
}
