'use client';
import type { ClientPlayer } from '../../shared/messages';
import { COLOR_HEX, COLOR_LABEL, pieceStyle } from '../../lib/colors';
import { MonsterDetails } from './MonsterDetails';

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
                  <span style={{ opacity: 0.85 }}>
                    {p.monster.name} HP{p.monster.stats.hp} ATK{p.monster.stats.atk} DEF
                    {p.monster.stats.def} SPD{p.monster.stats.spd} · {p.monster.actives.length}
                    skills
                  </span>
                </summary>
                <div style={{ padding: '8px 12px 12px', borderTop: '1px dashed #ddd' }}>
                  <MonsterDetails
                    monster={p.monster}
                    pendingBuffsCount={p.pendingBuffsCount}
                  />
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
