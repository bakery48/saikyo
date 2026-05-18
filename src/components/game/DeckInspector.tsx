'use client';
import type { ClientGameState } from '../../shared/messages';
import type { ActionCard, EventCard, SkillCard } from '../../server/engine/types';
import { describeActionEffect, describeEventEffect, describeEventTarget, getSkillCategory, SKILL_CATEGORY_COLOR } from '../../lib/card-text';
import { activeTooltip, passiveTooltip } from '../../lib/skill-text';

/**
 * Debug panel that lists every card still in each shared deck and graveyard.
 * Includes the skill deck — this leaks draft information, so only enable
 * during testing.
 */
export function DeckInspector({ state }: { state: ClientGameState }) {
  const { event, eventGrave, action, actionGrave, skill, skillGrave } = state.publicDecks;

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
        <DeckColumn title={`スキル山札 (${skill.length})`}>
          {skill.length === 0 ? (
            <Empty />
          ) : (
            skill.map((c, i) => <SkillRow key={`${c.id}-${i}`} card={c} index={i} />)
          )}
        </DeckColumn>
        <DeckColumn title={`スキル墓地 (${skillGrave.length})`} dim>
          {skillGrave.length === 0 ? (
            <Empty />
          ) : (
            skillGrave.map((c, i) => <SkillRow key={`${c.id}-g-${i}`} card={c} index={i} />)
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

function SkillRow({ card, index }: { card: SkillCard; index: number }) {
  const kindLabel = card.isPassive ? 'P' : 'A';
  const tooltip = card.isPassive
    ? passiveTooltip({
        id: card.id,
        name: card.name,
        trigger: card.passive!.trigger,
        effect: card.passive!.effect,
        rarity: card.rarity,
        nameTag: card.nameTag,
      })
    : activeTooltip({
        id: card.id,
        order: 0,
        name: card.name,
        rarity: card.rarity,
        nameTag: card.nameTag,
        effect: card.active!.effect,
      });
  return (
    <li
      style={{ padding: '2px 4px', borderBottom: '1px dotted #eee' }}
      title={tooltip}
    >
      <span style={{ opacity: 0.5, marginRight: 4 }}>{index + 1}.</span>
      <span style={{ color: SKILL_CATEGORY_COLOR[getSkillCategory(card)], marginRight: 4 }}>
        [{card.rarity}{kindLabel}]
      </span>
      <strong>{card.name}</strong>
      {card.nameTag && (
        <em style={{ opacity: 0.65, marginLeft: 4 }}>→ {card.nameTag}</em>
      )}
    </li>
  );
}
