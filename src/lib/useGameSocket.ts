'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  ClientGameState,
  ClientMessage,
  RoomSummary,
  RoomView,
  ServerMessage,
} from '../shared/messages';

export type GameSocket = {
  connected: boolean;
  playerId: string | null;
  room: RoomView | null;
  rooms: RoomSummary[];
  game: ClientGameState | null;
  error: string | null;
  send: (msg: ClientMessage) => void;
};

const RECONNECT_DELAY_MS = 1500;

export function useGameSocket(): GameSocket {
  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [game, setGame] = useState<ClientGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const closedByCleanup = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    closedByCleanup.current = false;

    const connect = (): void => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
      };
      ws.onclose = () => {
        setConnected(false);
        // Drop any stale per-session state — on reconnect the server will
        // assign a brand-new playerId and the previous game (with the old
        // playerId) is no longer reachable.
        setPlayerId(null);
        setRoom(null);
        setGame(null);
        if (!closedByCleanup.current) {
          setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };
      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        switch (msg.type) {
          case 'welcome':
            setPlayerId(msg.playerId);
            break;
          case 'room_state':
            setRoom(msg.room);
            break;
          case 'rooms_list':
            setRooms(msg.rooms);
            break;
          case 'left_room':
            setRoom(null);
            setGame(null);
            break;
          case 'game_state':
            setGame(msg.state);
            break;
          case 'error':
            setError(msg.message);
            setTimeout(() => setError(null), 4000);
            break;
        }
      };
    };
    connect();

    return () => {
      closedByCleanup.current = true;
      wsRef.current?.close();
    };
  }, []);

  const send = (msg: ClientMessage): void => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  return { connected, playerId, room, rooms, game, error, send };
}
