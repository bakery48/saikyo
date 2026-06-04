'use client';
import type { ClientPlayer } from '../../shared/messages';
import { COLOR_HEX, COLOR_LABEL, pieceStyle } from '../../lib/colors';
import { MonsterDetails } from './MonsterDetails';

const STAT_MAX = { hp: 24, atk: 12, def: 10, spd: 10 };

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
      <span style={{ width: 28, opacity: 0.65, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: '#e8e8e8', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ width: 20, textAlign: 'right', opacity: 0.8 }}>{value}</span>
    </div>
  );
}

export function PlayerPanel({
  players,
  selfId,
}: {
  players: ClientPlayer[];
  selfId: string | null;
}) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
      {players.map((p) => {
        const isSelf = p.id === selfId;
        return (
          <li
            key={p.id}
            style={{
              border: '1px solid #ccc',
              borderLeft: `4px solid ${COLOR_HEX[p.color] ?? '#ccc'}`,
              borderRadius: 6,
              background: isSelf ? '#f0f8ff' : 'white',
            }}
          >
            {p.monster ? (
              <details>
                <summary
                  style={{
                    cursor: 'pointer',
                    padding: '6px 10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 14,
                    gap: 8,
                    listStyle: 'revert',
                  }}
                >
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <span title={COLOR_LABEL[p.color]} style={pieceStyle(p.color, { size: 12 })} />
                    {p.name}
                    {p.isCPU ? ' 🤖' : ''}
                    {isSelf ? ' (you)' : ''}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 110 }}>
                    <StatBar label="HP" value={p.monster.stats.hp} max={STAT_MAX.hp} color="#4caf50" />
                    <StatBar label="ATK" value={p.monster.stats.atk} max={STAT_MAX.atk} color="#f44336" />
                    <StatBar label="DEF" value={p.monster.stats.def} max={STAT_MAX.def} color="#2196f3" />
                    <StatBar label="SPD" value={p.monster.stats.spd} max={STAT_MAX.spd} color="#ff9800" />
                  </span>
                </summary>
                <div style={{ padding: '8px 12px 12px', borderTop: '1px dashed #ddd' }}>
                  <MonsterDetails monster={p.monster} />
                </div>
              </details>
            ) : (
              <div
                style={{
                  padding: '6px 10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 14,
                  gap: 8,
                }}
              >
                <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <span title={COLOR_LABEL[p.color]} style={pieceStyle(p.color, { size: 12 })} />
                  {p.name}
                  {p.isCPU ? ' 🤖' : ''}
                  {isSelf ? ' (you)' : ''}
                </span>
                <span style={{ opacity: 0.5 }}>未選択</span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
