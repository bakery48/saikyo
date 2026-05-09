'use client';
import type { ClientGameState } from '../../shared/messages';
import { describeActionEffect } from '../../lib/card-text';

/**
 * Always-visible panel showing the viewer's personal action card hand.
 * Hidden if the viewer has no hand (e.g. spectator) or hand is empty.
 */
export function ActionHandPanel({ state }: { state: ClientGameState }) {
  const hand = state.myActionHand ?? [];
  if (!state.myActionHand) return null;

  return (
    <details
      open={false}
      style={{
        border: '1px solid #aaa',
        borderRadius: 8,
        padding: 10,
        background: '#fff8e1',
      }}
    >
      <summary style={{ fontWeight: 600, cursor: 'pointer' }}>
        🃏 アクションカード手札 ({hand.length})
      </summary>
      {hand.length === 0 ? (
        <p style={{ marginTop: 8, opacity: 0.7, fontSize: 13 }}>(手札なし)</p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '8px 0 0',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 6,
          }}
        >
          {hand.map((card) => (
            <li
              key={card.id}
              style={{
                border: '1px solid #d4a000',
                borderRadius: 6,
                padding: '6px 8px',
                background: '#fff',
                fontSize: 12,
                display: 'grid',
                gap: 2,
              }}
            >
              <div style={{ fontWeight: 600 }}>{card.name}</div>
              <div style={{ opacity: 0.85 }}>{describeActionEffect(card)}</div>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
