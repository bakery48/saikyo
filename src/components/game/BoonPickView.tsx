'use client';
import { useState } from 'react';
import type { ClientGameState } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';
import type { MonsterBoon } from '../../server/engine/types';

function describeBoon(boon: MonsterBoon): string {
  if (boon.effect.kind === 'stat_up') {
    return `${boon.effect.stat.toUpperCase()}+${boon.effect.amount}`;
  }
  return 'スキルカードを1枚獲得';
}

export function BoonPickView({ state, socket }: { state: ClientGameState; socket: GameSocket }) {
  const selfId = socket.playerId;
  const bp = state.boonPick;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedBoons, setSavedBoons] = useState<MonsterBoon[] | null>(null);
  if (!bp) return null;

  const iAmPending = !!selfId && bp.pendingPlayerIds.includes(selfId);
  const myBoons = bp.myBoons ?? savedBoons;

  function handleSelect(boon: MonsterBoon) {
    setSelectedId(boon.id);
    setSavedBoons(bp!.myBoons);
    socket.send({ type: 'submit_boon', boonId: boon.id });
  }

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>恩恵を選択</h2>
      <p style={{ margin: 0, opacity: 0.85 }}>
        モンスター固有の恩恵を1つ選んでください。({bp.submittedCount}/{bp.pendingPlayerIds.length} 確定済み)
      </p>

      {myBoons && myBoons.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {myBoons.map((boon) => {
            const isSelected = selectedId === boon.id;
            return (
              <button
                key={boon.id}
                type="button"
                onClick={() => iAmPending && handleSelect(boon)}
                disabled={!iAmPending}
                style={{
                  padding: 14,
                  borderRadius: 8,
                  border: isSelected ? '3px solid #27ae60' : '2px solid #d4a000',
                  background: isSelected ? '#eafaf1' : '#fffbf0',
                  cursor: iAmPending ? 'pointer' : 'default',
                  textAlign: 'left',
                  display: 'grid',
                  gap: 6,
                  opacity: !iAmPending && !isSelected ? 0.45 : 1,
                  outline: isSelected ? '2px solid #27ae60' : 'none',
                  outlineOffset: 2,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{boon.name}</span>
                  {isSelected && <span style={{ color: '#27ae60', fontSize: 13 }}>✓ 選択済み</span>}
                </div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>{describeBoon(boon)}</div>
              </button>
            );
          })}
        </div>
      )}

      {!iAmPending && (
        <p style={{ opacity: 0.7 }}>
          {selectedId ? '確定済み — 他のプレイヤーを待っています…' : '待機中…'}
          　({bp.submittedCount}/{bp.pendingPlayerIds.length})
        </p>
      )}
    </section>
  );
}
