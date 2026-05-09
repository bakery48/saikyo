'use client';
import { useState } from 'react';
import type { ClientGameState } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';
import type { ActionCard, EventCard } from '../../server/engine/types';
import { EVENTS } from '../../server/engine/cards/events';
import { ACTIONS } from '../../server/engine/cards/actions';
import {
  describeActionEffect,
  describeEventEffect,
  describeEventTarget,
} from '../../lib/card-text';

const eventLabel = (c: EventCard): string =>
  `${c.name}（${describeEventTarget(c.target)} / ${describeEventEffect(c)}） [${c.id}]`;

const actionLabel = (c: ActionCard): string => `${c.name}（${describeActionEffect(c)}） [${c.id}]`;

/**
 * Dev-only panel: inject the next event card and rewrite the caller's action
 * hand. Useful for QA / debugging specific card interactions.
 */
export function DevTools({ state, socket }: { state: ClientGameState; socket: GameSocket }) {
  const [eventChoice, setEventChoice] = useState<string>(EVENTS[0]?.id ?? '');
  const myHand = state.myActionHand ?? [];

  return (
    <details
      style={{
        border: '1px dashed #c44',
        borderRadius: 6,
        padding: 8,
        background: '#fff5f5',
        fontSize: 12,
      }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
        🧪 開発者ツール（テスト用）
      </summary>

      <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
        <section style={{ display: 'grid', gap: 4 }}>
          <h4 style={{ margin: 0 }}>次のイベントカードを指定</h4>
          <p style={{ margin: 0, opacity: 0.7 }}>
            選んだカードをイベント山札の先頭に追加します（次のイベントフェーズで引かれる）。
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={eventChoice}
              onChange={(e) => setEventChoice(e.target.value)}
              style={{ flex: '1 1 280px', padding: '4px 6px' }}
            >
              {EVENTS.map((c) => (
                <option key={c.id} value={c.id}>
                  {eventLabel(c)}
                </option>
              ))}
            </select>
            <button
              onClick={() =>
                eventChoice && socket.send({ type: 'dev_inject_event', cardId: eventChoice })
              }
              disabled={!eventChoice}
            >
              山札の先頭へ
            </button>
          </div>
        </section>

        <section style={{ display: 'grid', gap: 4 }}>
          <h4 style={{ margin: 0 }}>自分のアクション手札を差し替え</h4>
          {myHand.length === 0 ? (
            <p style={{ margin: 0, opacity: 0.7 }}>(手札なし)</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
              {myHand.map((card) => (
                <HandReplaceRow
                  key={card.id}
                  card={card}
                  onReplace={(newId) =>
                    socket.send({
                      type: 'dev_replace_hand',
                      oldCardId: card.id,
                      newCardId: newId,
                    })
                  }
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </details>
  );
}

function HandReplaceRow({
  card,
  onReplace,
}: {
  card: ActionCard;
  onReplace: (newCardId: string) => void;
}) {
  const [choice, setChoice] = useState<string>(ACTIONS[0]?.id ?? '');
  return (
    <li
      style={{
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        flexWrap: 'wrap',
        borderBottom: '1px dotted #eee',
        paddingBottom: 4,
      }}
    >
      <span style={{ minWidth: 120, fontWeight: 600 }}>{card.name}</span>
      <span style={{ opacity: 0.7 }}>→</span>
      <select
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        style={{ flex: '1 1 240px', padding: '2px 4px' }}
      >
        {ACTIONS.map((c) => (
          <option key={c.id} value={c.id}>
            {actionLabel(c)}
          </option>
        ))}
      </select>
      <button onClick={() => choice && onReplace(choice)} disabled={!choice}>
        差し替え
      </button>
    </li>
  );
}
