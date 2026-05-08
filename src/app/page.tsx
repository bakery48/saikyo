'use client';
import { useGameSocket } from '../lib/useGameSocket';
import { Lobby } from '../components/Lobby';
import { RoomView } from '../components/RoomView';
import { Game } from '../components/Game';

export default function HomePage() {
  const socket = useGameSocket();
  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', display: 'grid', gap: 24, maxWidth: 1100, margin: '0 auto' }}>
      <header>
        <h1 style={{ margin: 0 }}>Saikyo Monster Battle</h1>
        <p style={{ margin: '4px 0', opacity: 0.7 }}>
          {socket.connected ? '接続中' : '接続待ち...'}
          {socket.playerId ? ` · player ${socket.playerId.slice(0, 8)}` : ''}
        </p>
      </header>
      {socket.error && (
        <div style={{ background: '#fee', padding: 8, borderRadius: 6 }}>{socket.error}</div>
      )}
      {socket.game ? (
        <Game socket={socket} />
      ) : socket.room ? (
        <RoomView socket={socket} />
      ) : (
        <Lobby socket={socket} />
      )}
    </main>
  );
}
