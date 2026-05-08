'use client';
import { useState } from 'react';
import type { GameSocket } from '../lib/useGameSocket';

export function Lobby({ socket }: { socket: GameSocket }) {
  const [name, setName] = useState('Player');
  const [joinId, setJoinId] = useState('');
  const trimmed = name.trim();

  return (
    <section style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
      <div>
        <label>
          Name:{' '}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
            style={{ padding: '4px 8px' }}
          />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => socket.send({ type: 'create_room', playerName: trimmed || 'Player' })}
          disabled={!socket.connected}
        >
          ルームを作成
        </button>
        <input
          placeholder="ROOM ID"
          value={joinId}
          onChange={(e) => setJoinId(e.target.value.toUpperCase())}
          maxLength={8}
          style={{ padding: '4px 8px', textTransform: 'uppercase' }}
        />
        <button
          onClick={() =>
            socket.send({
              type: 'join_room',
              roomId: joinId.trim().toUpperCase(),
              playerName: trimmed || 'Player',
            })
          }
          disabled={!socket.connected || !joinId.trim()}
        >
          参加
        </button>
      </div>

      <div>
        <h3 style={{ marginBottom: 8 }}>公開ルーム</h3>
        {socket.rooms.length === 0 ? (
          <p style={{ opacity: 0.6 }}>まだルームがありません。</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
            {socket.rooms.map((r) => (
              <li
                key={r.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid #ccc',
                  padding: '8px 12px',
                  borderRadius: 6,
                }}
              >
                <div>
                  <strong>{r.id}</strong> · host: {r.hostName} · {r.playerCount}/8{' '}
                  {r.inGame ? '(in game)' : ''}
                </div>
                <button
                  onClick={() =>
                    socket.send({
                      type: 'join_room',
                      roomId: r.id,
                      playerName: trimmed || 'Player',
                    })
                  }
                  disabled={r.inGame || r.playerCount >= 8 || !socket.connected}
                >
                  Join
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
