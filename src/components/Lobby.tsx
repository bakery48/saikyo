'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { GameSocket } from '../lib/useGameSocket';

const SETTINGS_KEY = 'saikyo-lobby-settings';

function loadSettings() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSettings(s: { totalRounds: number; miniRoundsPerRound: number; eventCardCount: number; maxPlayers: number }) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {}
}

export function Lobby({ socket }: { socket: GameSocket }) {
  const [name, setName] = useState('Player');
  const [joinId, setJoinId] = useState('');
  const [totalRounds, setTotalRounds] = useState(3);
  const [miniRoundsPerRound, setMiniRoundsPerRound] = useState(3);
  const [eventCardCount, setEventCardCount] = useState(1);
  const [maxPlayers, setMaxPlayers] = useState<4 | 8>(8);
  const trimmed = name.trim();

  useEffect(() => {
    const s = loadSettings();
    if (!s) return;
    if (s.totalRounds) setTotalRounds(s.totalRounds);
    if (s.miniRoundsPerRound) setMiniRoundsPerRound(s.miniRoundsPerRound);
    if (s.eventCardCount) setEventCardCount(s.eventCardCount);
    if (s.maxPlayers === 4 || s.maxPlayers === 8) setMaxPlayers(s.maxPlayers);
  }, []);

  function handleChange(setter: (v: number) => void, key: string) {
    return (v: number) => {
      setter(v);
      const current = loadSettings() ?? {};
      saveSettings({ totalRounds, miniRoundsPerRound, eventCardCount, maxPlayers, ...current, [key]: v });
    };
  }

  function handleMaxPlayersChange(v: 4 | 8) {
    setMaxPlayers(v);
    const current = loadSettings() ?? {};
    saveSettings({ totalRounds, miniRoundsPerRound, eventCardCount, ...current, maxPlayers: v });
  }

  return (
    <section style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label>
          Name:{' '}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
            style={{ padding: '4px 8px' }}
          />
        </label>
        <Link href="/hall-of-fame" style={{ fontSize: 14 }}>🏆 殿堂</Link>
      </div>

      <fieldset
        style={{
          border: '1px solid #ccc',
          borderRadius: 6,
          padding: '8px 12px',
          display: 'grid',
          gap: 6,
        }}
      >
        <legend style={{ padding: '0 4px', fontSize: 13, fontWeight: 600 }}>
          ゲーム設定（ルーム作成時のみ）
        </legend>
        <SliderRow
          label="ラウンド数"
          value={totalRounds}
          onChange={handleChange(setTotalRounds, 'totalRounds')}
        />
        <SliderRow
          label="ミニラウンド数 (I・A・D / round)"
          value={miniRoundsPerRound}
          onChange={handleChange(setMiniRoundsPerRound, 'miniRoundsPerRound')}
        />
        <SliderRow
          label="イベントカード枚数（倍率）"
          value={eventCardCount}
          onChange={handleChange(setEventCardCount, 'eventCardCount')}
        />
        <label style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}>
          <span style={{ minWidth: 220 }}>プレイヤー人数</span>
          <span style={{ display: 'flex', gap: 6 }}>
            {([4, 8] as const).map((n) => (
              <button
                key={n}
                onClick={() => handleMaxPlayersChange(n)}
                style={{
                  padding: '2px 12px',
                  fontWeight: maxPlayers === n ? 700 : 400,
                  background: maxPlayers === n ? '#2980b9' : '#eee',
                  color: maxPlayers === n ? '#fff' : '#333',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {n}人
              </button>
            ))}
          </span>
        </label>
      </fieldset>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() =>
            socket.send({
              type: 'create_room',
              playerName: trimmed || 'Player',
              totalRounds,
              miniRoundsPerRound,
              eventCardCount,
              maxPlayers,
            })
          }
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
                  <strong>{r.id}</strong> · host: {r.hostName} · {r.playerCount}/{r.maxPlayers ?? 8}{' '}
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
                  disabled={r.playerCount >= (r.maxPlayers ?? 8) || !socket.connected}
                >
                  {r.inGame ? '復帰' : 'Join'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SliderRow({
  label,
  value,
  min = 1,
  max = 3,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        fontSize: 13,
      }}
    >
      <span style={{ minWidth: 220 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1 }}
      />
      <span style={{ minWidth: 16, textAlign: 'right', fontWeight: 600 }}>{value}</span>
    </label>
  );
}
