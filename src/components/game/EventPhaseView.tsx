'use client';
import { useEffect, useState } from 'react';
import type { ClientGameState } from '../../shared/messages';
import { COLOR_LABEL, pieceStyle } from '../../lib/colors';

export function EventPhaseView({ state }: { state: ClientGameState }) {
  const ev = state.eventPhaseSummary;
  const [flipped, setFlipped] = useState(false);
  const [flipKey, setFlipKey] = useState(0);

  useEffect(() => {
    setFlipped(false);
    setFlipKey((k) => k + 1);
    const t = setTimeout(() => setFlipped(true), 120);
    return () => clearTimeout(t);
  }, [ev?.cardName]);

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>イベントフェーズ</h2>

      {!ev ? (
        <p style={{ opacity: 0.7 }}>(イベントカードなし)</p>
      ) : (
        <>
          <div
            key={flipKey}
            className={flipped ? 'card-flip-in' : undefined}
            style={{
              border: '2px solid #6c8',
              background: 'linear-gradient(160deg, #f0fbe9, #e9f8f3)',
              borderRadius: 10,
              padding: 14,
              display: 'grid',
              gap: 6,
              opacity: flipped ? 1 : 0,
            }}
          >
            <div style={{ fontSize: 11, color: '#587', letterSpacing: 1 }}>EVENT CARD</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{ev.cardName}</div>
            <div style={{ fontSize: 13 }}>
              対象: <strong>{ev.targetLabel}</strong> ／ 効果: <strong>{ev.effectDesc}</strong>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>影響を受けたプレイヤー</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ev.targetIds.length === 0 ? (
                <em style={{ fontSize: 12, opacity: 0.6 }}>(なし)</em>
              ) : (
                ev.targetIds.map((id) => {
                  const p = state.players.find((pp) => pp.id === id);
                  if (!p) return null;
                  return (
                    <span
                      key={id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 8px',
                        borderRadius: 14,
                        background: '#fff',
                        border: '1px solid #ccc',
                        fontSize: 12,
                      }}
                    >
                      <span style={pieceStyle(p.color, { size: 12 })} />
                      {p.name}（{COLOR_LABEL[p.color]}）
                    </span>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
