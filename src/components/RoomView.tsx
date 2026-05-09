'use client';
import type { GameSocket } from '../lib/useGameSocket';

export function RoomView({ socket }: { socket: GameSocket }) {
  const room = socket.room;
  if (!room) return null;
  const me = room.players.find((p) => p.id === socket.playerId);
  const isReady = me?.isReady ?? false;
  const isHost = !!me?.isHost;

  return (
    <section style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
      <header>
        <h2 style={{ margin: 0 }}>Room {room.id}</h2>
        <p style={{ margin: '4px 0', opacity: 0.7 }}>
          {room.players.length}/8 プレイヤー
          {room.players.length < 8 ? ` (残り ${8 - room.players.length} はCPUで補充)` : ''}
        </p>
      </header>

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
          ゲーム設定 {isHost && !room.inGame ? '(ホストのみ編集可)' : '(読み取り専用)'}
        </legend>
        <SettingRow
          label="ラウンド数"
          value={room.totalRounds}
          editable={isHost && !room.inGame}
          onChange={(v) =>
            socket.send({ type: 'set_room_settings', totalRounds: v })
          }
        />
        <SettingRow
          label="ミニラウンド数 (I・A・D / round)"
          value={room.miniRoundsPerRound}
          editable={isHost && !room.inGame}
          onChange={(v) =>
            socket.send({ type: 'set_room_settings', miniRoundsPerRound: v })
          }
        />
      </fieldset>

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
        {me?.isHost && !room.inGame && (
          <button onClick={() => socket.send({ type: 'start_game' })}>ゲーム開始</button>
        )}
        <button onClick={() => socket.send({ type: 'leave_room' })}>退出</button>
      </div>
    </section>
  );
}

function SettingRow({
  label,
  value,
  editable,
  onChange,
}: {
  label: string;
  value: number;
  editable: boolean;
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
        min={1}
        max={3}
        step={1}
        value={value}
        disabled={!editable}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1 }}
      />
      <span style={{ minWidth: 16, textAlign: 'right', fontWeight: 600 }}>{value}</span>
    </label>
  );
}
