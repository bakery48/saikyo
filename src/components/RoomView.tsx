'use client';
import type { GameSocket } from '../lib/useGameSocket';

export function RoomView({ socket }: { socket: GameSocket }) {
  const room = socket.room;
  if (!room) return null;
  const me = room.players.find((p) => p.id === socket.playerId);
  const isReady = me?.isReady ?? false;

  return (
    <section style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
      <header>
        <h2 style={{ margin: 0 }}>Room {room.id}</h2>
        <p style={{ margin: '4px 0', opacity: 0.7 }}>
          {room.players.length}/8 プレイヤー
          {room.players.length < 8 ? ` (残り ${8 - room.players.length} はCPUで補充)` : ''}
        </p>
      </header>

      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
        {room.players.map((p) => (
          <li
            key={p.id}
            style={{
              border: '1px solid #ccc',
              padding: '8px 12px',
              borderRadius: 6,
              display: 'flex',
              justifyContent: 'space-between',
              background: p.id === socket.playerId ? '#f0f8ff' : 'white',
            }}
          >
            <span>
              {p.name}
              {p.isHost ? ' 👑' : ''}
              {p.id === socket.playerId ? ' (you)' : ''}
            </span>
            <span style={{ opacity: 0.7 }}>{p.isReady ? '✅ Ready' : '… 待機中'}</span>
          </li>
        ))}
      </ul>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => socket.send({ type: 'set_ready', isReady: !isReady })}
        >
          {isReady ? 'Cancel Ready' : 'Ready'}
        </button>
        <button onClick={() => socket.send({ type: 'leave_room' })}>退出</button>
      </div>
    </section>
  );
}
