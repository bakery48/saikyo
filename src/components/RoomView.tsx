'use client';
import type { GameSocket } from '../lib/useGameSocket';
import type { Rarity } from '../server/engine/types';
import { SKILLS } from '../server/engine/cards/skills';

const RARITY_COLORS: Record<Rarity, string> = {
  N: '#888',
  R: '#27ae60',
  SR: '#2980b9',
  SSR: '#8e44ad',
};

const RARITIES: Rarity[] = ['N', 'R', 'SR', 'SSR'];

function defaultSkillCount(rarity: Rarity): number {
  if (rarity === 'N') return 3;
  if (rarity === 'R') return 2;
  return 1; // SR, SSR
}

export function RoomView({ socket }: { socket: GameSocket }) {
  const room = socket.room;
  if (!room) return null;
  const me = room.players.find((p) => p.id === socket.playerId);
  const isReady = me?.isReady ?? false;
  const isHost = !!me?.isHost;
  const canEdit = isHost && !room.inGame;

  const skillCardCounts: Record<string, number> = room.skillCardCounts ?? {};

  function getCount(cardId: string, rarity: Rarity): number {
    return skillCardCounts[cardId] ?? defaultSkillCount(rarity);
  }

  function setCardCount(cardId: string, count: number) {
    const newCounts = { ...skillCardCounts, [cardId]: count };
    socket.send({ type: 'set_room_settings', skillCardCounts: newCounts });
  }

  function setRarityCount(rarity: Rarity, count: number) {
    const newCounts = { ...skillCardCounts };
    for (const card of SKILLS) {
      if (card.rarity === rarity) {
        newCounts[card.id] = count;
      }
    }
    socket.send({ type: 'set_room_settings', skillCardCounts: newCounts });
  }

  const skillsByRarity: Record<Rarity, typeof SKILLS> = { N: [], R: [], SR: [], SSR: [] };
  for (const card of SKILLS) {
    skillsByRarity[card.rarity].push(card);
  }

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

      <fieldset
        style={{
          border: '1px solid #ccc',
          borderRadius: 6,
          padding: '8px 12px',
          display: 'grid',
          gap: 8,
        }}
      >
        <legend style={{ padding: '0 4px', fontSize: 13, fontWeight: 600 }}>
          スキルデッキ設定 {canEdit ? '(ホストのみ編集可)' : '(読み取り専用)'}
        </legend>

        {/* Rarity bulk controls */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
          <span style={{ fontWeight: 600, fontSize: 12 }}>レアリティ一括:</span>
          {RARITIES.map((rarity) => (
            <span key={rarity} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: RARITY_COLORS[rarity], fontWeight: 700 }}>{rarity}:</span>
              {[0, 1, 2, 3].map((n) => (
                <button
                  key={n}
                  disabled={!canEdit}
                  onClick={() => setRarityCount(rarity, n)}
                  style={{
                    fontSize: 11,
                    padding: '2px 6px',
                    cursor: canEdit ? 'pointer' : 'default',
                    background: skillsByRarity[rarity].every((c) => getCount(c.id, rarity) === n)
                      ? RARITY_COLORS[rarity]
                      : '#eee',
                    color: skillsByRarity[rarity].every((c) => getCount(c.id, rarity) === n) ? '#fff' : '#333',
                    border: '1px solid #ccc',
                    borderRadius: 3,
                  }}
                >
                  {n}
                </button>
              ))}
            </span>
          ))}
        </div>

        <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #eee' }} />

        {/* Per-card controls grouped by rarity */}
        {RARITIES.map((rarity) => (
          <div key={rarity}>
            <div style={{ fontSize: 12, fontWeight: 700, color: RARITY_COLORS[rarity], marginBottom: 4 }}>
              {rarity}
            </div>
            <div style={{ display: 'grid', gap: 3 }}>
              {skillsByRarity[rarity].map((card) => {
                const current = getCount(card.id, card.rarity);
                return (
                  <div
                    key={card.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ minWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {card.name}
                    </span>
                    {[0, 1, 2, 3].map((n) => (
                      <button
                        key={n}
                        disabled={!canEdit}
                        onClick={() => setCardCount(card.id, n)}
                        style={{
                          fontSize: 11,
                          padding: '2px 6px',
                          cursor: canEdit ? 'pointer' : 'default',
                          background: current === n ? RARITY_COLORS[rarity] : '#eee',
                          color: current === n ? '#fff' : '#333',
                          border: '1px solid #ccc',
                          borderRadius: 3,
                          minWidth: 22,
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
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
