'use client';
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
  if (!bp) return null;

  const iAmPending = !!selfId && bp.pendingPlayerIds.includes(selfId);
  const myBoons = bp.myBoons;

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>恩恵を選択</h2>
      <p style={{ margin: 0, opacity: 0.85 }}>
        モンスター固有の恩恵を1つ選んでください。({bp.submittedCount}/{bp.pendingPlayerIds.length} 確定済み)
      </p>

      {iAmPending && myBoons && myBoons.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {myBoons.map((boon) => (
            <button
              key={boon.id}
              type="button"
              onClick={() => socket.send({ type: 'submit_boon', boonId: boon.id })}
              style={{
                padding: 14,
                borderRadius: 8,
                border: '2px solid #d4a000',
                background: '#fffbf0',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'grid',
                gap: 6,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>{boon.name}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{describeBoon(boon)}</div>
            </button>
          ))}
        </div>
      )}

      {!iAmPending && (
        <p style={{ opacity: 0.7 }}>待機中… ({bp.submittedCount}/{bp.pendingPlayerIds.length})</p>
      )}
    </section>
  );
}
