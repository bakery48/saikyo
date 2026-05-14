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
/** localStorage key holding our playerId across reloads so we can rejoin. */
const PLAYER_ID_KEY = 'saikyo.playerId';

export function useGameSocket(): GameSocket {
  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [game, setGame] = useState<ClientGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const closedByCleanup = useRef(false);
  // Holds the fresh id from `welcome` while a rejoin is in flight; committed
  // only if the rejoin fails.
  const pendingNewId = useRef<string | null>(null);

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
        // Keep playerId / room / game in place: on reconnect we attempt a
        // rejoin to reclaim the seat, and the server replays room/game state.
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
          case 'welcome': {
            const saved =
              typeof window !== 'undefined'
                ? window.localStorage.getItem(PLAYER_ID_KEY)
                : null;
            if (saved) {
              // Try to reclaim the previous seat; hold the fresh id until we
              // hear back whether the rejoin succeeded.
              pendingNewId.current = msg.playerId;
              ws.send(JSON.stringify({ type: 'rejoin', playerId: saved }));
            } else {
              setPlayerId(msg.playerId);
              window.localStorage?.setItem(PLAYER_ID_KEY, msg.playerId);
            }
            break;
          }
          case 'rejoin_ok':
            setPlayerId(msg.playerId);
            window.localStorage?.setItem(PLAYER_ID_KEY, msg.playerId);
            pendingNewId.current = null;
            break;
          case 'rejoin_failed': {
            const fresh = pendingNewId.current;
            pendingNewId.current = null;
            if (fresh) {
              setPlayerId(fresh);
              window.localStorage?.setItem(PLAYER_ID_KEY, fresh);
            }
            // The held seat is gone — fall back to the lobby.
            setRoom(null);
            setGame(null);
            break;
          }
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
