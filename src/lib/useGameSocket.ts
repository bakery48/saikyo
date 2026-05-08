'use client';
import { useEffect, useRef, useState } from 'react';
import type { ClientMessage, RoomSummary, RoomView, ServerMessage } from '../shared/messages';

export type GameSocket = {
  connected: boolean;
  playerId: string | null;
  room: RoomView | null;
  rooms: RoomSummary[];
  error: string | null;
  send: (msg: ClientMessage) => void;
};

export function useGameSocket(): GameSocket {
  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
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
          break;
        case 'error':
          setError(msg.message);
          setTimeout(() => setError(null), 4000);
          break;
      }
    };
    return () => {
      ws.close();
    };
  }, []);

  const send = (msg: ClientMessage): void => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  return { connected, playerId, room, rooms, error, send };
}
