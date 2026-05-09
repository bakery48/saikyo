'use client';
import type { ClientGameState } from '../../shared/messages';
import type { ActionCard, EventCard } from '../../server/engine/types';
import { describeActionEffect, describeEventEffect, describeEventTarget } from '../../lib/card-text';

/**
 * Debug panel that lists every card still in the event/action decks and
 * their graveyards. Skill deck contents are intentionally hidden so drafts
 * remain fair.
 */
export function DeckInspector({ state }: { state: ClientGameState }) {
  const { event, eventGrave, action, actionGrave } = state.publicDecks;

  return (
    <details
      style={{
        border: '1px dashed #999',
        borderRadius: 6,
        padding: 8,
        background: '#fbfbfb',
        fontSize: 12,
      }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
        🛠 デッキ中身（テスト用）
      </summary>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 12,
          marginTop: 8,
        }}
      >
        <DeckColumn title={`イベント山札 (${event.length})`}>
          {event.length === 0 ? (
            <Empty />
          ) : (
            event.map((c, i) => <EventRow key={`${c.id}-${i}`} card={c} index={i} />)
          )}
        </DeckColumn>
        <DeckColumn title={`イベント墓地 (${eventGrave.length})`} dim>
          {eventGrave.length === 0 ? (
            <Empty />
          ) : (
            eventGrave.map((c, i) => <EventRow key={`${c.id}-g-${i}`} card={c} index={i} />)
          )}
        </DeckColumn>
        <DeckColumn title={`アクション山札 (${action.length})`}>
          {action.length === 0 ? (
            <Empty />
          ) : (
            action.map((c, i) => <ActionRow key={`${c.id}-${i}`} card={c} index={i} />)
          )}
        </DeckColumn>
        <DeckColumn title={`アクション墓地 (${actionGrave.length})`} dim>
          {actionGrave.length === 0 ? (
            <Empty />
          ) : (
            actionGrave.map((c, i) => <ActionRow key={`${c.id}-g-${i}`} card={c} index={i} />)
          )}
        </DeckColumn>
      </div>
    </details>
  );
}

function DeckColumn({
  title,
  dim,
  children,
}: {
  title: string;
  dim?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: 4,
        padding: 6,
        background: dim ? '#f4f4f4' : '#fff',
        opacity: dim ? 0.85 : 1,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'grid',
          gap: 2,
          maxHeight: 220,
          overflowY: 'auto',
        }}
      >
        {children}
      </ul>
    </div>
  );
}

function Empty() {
  return <li style={{ opacity: 0.5, fontStyle: 'italic' }}>(空)</li>;
}

function EventRow({ card, index }: { card: EventCard; index: number }) {
  return (
    <li style={{ padding: '2px 4px', borderBottom: '1px dotted #eee' }}>
      <span style={{ opacity: 0.5, marginRight: 4 }}>{index + 1}.</span>
      <strong>{card.name}</strong>{' '}
      <span style={{ opacity: 0.7 }}>
        ({describeEventTarget(card.target)} / {describeEventEffect(card)})
      </span>
    </li>
  );
}

function ActionRow({ card, index }: { card: ActionCard; index: number }) {
  return (
    <li style={{ padding: '2px 4px', borderBottom: '1px dotted #eee' }}>
      <span style={{ opacity: 0.5, marginRight: 4 }}>{index + 1}.</span>
      <strong>{card.name}</strong>{' '}
      <span style={{ opacity: 0.7 }}>({describeActionEffect(card)})</span>
    </li>
  );
}
