import type { WebSocket } from 'ws';
import type { ClientMessage, ServerMessage } from '../shared/messages';
import { RoomManager } from './rooms';
import { randomUUID } from 'node:crypto';

export class GameWsServer {
  private connections = new Map<string, WebSocket>(); // playerId -> ws
  private playerNames = new Map<string, string>(); // playerId -> name
  private roomManager = new RoomManager();

  /** Called by the HTTP server on every accepted ws upgrade. */
  handleConnection(ws: WebSocket): void {
    const playerId = randomUUID();
    this.connections.set(playerId, ws);
    this.send(ws, { type: 'welcome', playerId });

    ws.on('message', (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        this.send(ws, { type: 'error', message: 'invalid json' });
        return;
      }
      try {
        this.handleMessage(playerId, msg);
      } catch (err) {
        this.send(ws, { type: 'error', message: String((err as Error).message ?? err) });
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(playerId);
    });

    // Send initial room list.
    this.sendRoomsList(ws);
  }

  private handleMessage(playerId: string, msg: ClientMessage): void {
    const ws = this.connections.get(playerId);
    if (!ws) return;
    switch (msg.type) {
      case 'create_room': {
        this.playerNames.set(playerId, msg.playerName);
        const room = this.roomManager.createRoom({
          id: playerId,
          name: msg.playerName,
          isReady: false,
        });
        this.send(ws, { type: 'room_state', room: this.roomManager.toRoomView(room) });
        this.broadcastRoomsList();
        return;
      }
      case 'join_room': {
        this.playerNames.set(playerId, msg.playerName);
        const room = this.roomManager.joinRoom(msg.roomId, {
          id: playerId,
          name: msg.playerName,
          isReady: false,
        });
        this.broadcastRoomState(room.id);
        this.broadcastRoomsList();
        return;
      }
      case 'leave_room': {
        const { room, destroyed } = this.roomManager.leavePlayer(playerId);
        this.send(ws, { type: 'left_room' });
        if (room && !destroyed) this.broadcastRoomState(room.id);
        this.broadcastRoomsList();
        return;
      }
      case 'set_ready': {
        const room = this.roomManager.setReady(playerId, msg.isReady);
        if (room) this.broadcastRoomState(room.id);
        return;
      }
      case 'list_rooms': {
        this.sendRoomsList(ws);
        return;
      }
    }
  }

  private handleDisconnect(playerId: string): void {
    const { room, destroyed } = this.roomManager.leavePlayer(playerId);
    this.connections.delete(playerId);
    this.playerNames.delete(playerId);
    if (room && !destroyed) this.broadcastRoomState(room.id);
    this.broadcastRoomsList();
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify(msg));
  }

  private broadcastRoomState(roomId: string): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return;
    const view = this.roomManager.toRoomView(room);
    for (const p of room.players) {
      const ws = this.connections.get(p.id);
      if (ws) this.send(ws, { type: 'room_state', room: view });
    }
  }

  private sendRoomsList(ws: WebSocket): void {
    this.send(ws, { type: 'rooms_list', rooms: this.roomManager.listSummaries() });
  }

  private broadcastRoomsList(): void {
    const summaries = this.roomManager.listSummaries();
    for (const [playerId, ws] of this.connections) {
      // Only send to clients not currently in a room (lobby clients).
      if (!this.roomManager.getRoomByPlayer(playerId)) {
        this.send(ws, { type: 'rooms_list', rooms: summaries });
      }
    }
  }
}
