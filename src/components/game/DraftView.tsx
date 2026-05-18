'use client';
import { useEffect, useState } from 'react';
import type { ClientGameState } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';
import { COLOR_LABEL, pieceStyle } from '../../lib/colors';
import { describeSkillCard } from '../../lib/skill-text';
import { getSkillCategory, SKILL_CATEGORY_COLOR } from '../../lib/card-text';

export function DraftView({
  state,
  socket,
}: {
  state: ClientGameState;
  socket: GameSocket;
}) {
  const draft = state.packDraft;
  const myId = socket.playerId;
  const myPack = myId && draft ? (draft.packs[myId] ?? []) : [];
  const myCommitted = myId && draft ? draft.submittedPicks[myId] : undefined;
  const iAmPending = !!myId && !!draft && draft.pendingPlayerIds.includes(myId);

  const [tentative, setTentative] = useState<string | null>(null);
  useEffect(() => {
    setTentative(null);
  }, [draft?.passIndex, !!myCommitted, iAmPending]);

  if (!draft) return <p>ドラフト準備中...</p>;

  const submittedCount = Object.keys(draft.submittedPicks).length;
  const totalPending = draft.pendingPlayerIds.length;

  const placeOrCommit = (cardId: string): void => {
    if (!iAmPending || myCommitted) return;
    setTentative(cardId);
  };

  const confirm = (): void => {
    if (!tentative) return;
    socket.send({ type: 'submit_draft', skillId: tentative });
  };

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>パック・ドラフト</h2>
      <div style={{ fontSize: 13, opacity: 0.7 }}>
        パス {draft.passIndex + 1} / 5 — ドラフト順: {draft.draftOrder.map(id => {
          const p = state.players.find(pl => pl.id === id);
          return p?.name ?? id;
        }).join(' → ')}
      </div>
      {iAmPending && !myCommitted
        ? <p style={{ margin: 0, opacity: 0.8 }}>👉 あなたのパックから1枚選んでください。</p>
        : myCommitted
          ? <p style={{ margin: 0, opacity: 0.8 }}>決定済み — 待機中… ({submittedCount}/{totalPending})</p>
          : <p style={{ margin: 0, opacity: 0.8 }}>({submittedCount}/{totalPending}) 待機中…</p>}

      {iAmPending && !myCommitted && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={confirm} disabled={!tentative}>
            決定
          </button>
          <button onClick={() => setTentative(null)} disabled={!tentative} type="button">
            選択取消
          </button>
        </div>
      )}

      <PendingStrip state={state} />

      <h3 style={{ margin: 0 }}>あなたのパック</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 8,
        }}
      >
        {myPack.map((c) => {
          const isSelected = tentative === c.id || myCommitted === c.id;
          const canClick = iAmPending && !myCommitted;
          return (
            <button
              key={c.id}
              disabled={!canClick}
              onClick={() => placeOrCommit(c.id)}
              style={{
                border: `2px solid ${isSelected ? '#0066cc' : SKILL_CATEGORY_COLOR[getSkillCategory(c)]}`,
                borderRadius: 8,
                padding: 12,
                background: isSelected ? '#e6f0ff' : '#fff',
                cursor: canClick ? 'pointer' : 'default',
                textAlign: 'left',
                minHeight: 110,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ fontSize: 11, color: SKILL_CATEGORY_COLOR[getSkillCategory(c)] }}>{c.rarity}</div>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>
                {describeSkillCard(c)}
              </div>
              {c.nameTag && (
                <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6 }}>tag: {c.nameTag}</div>
              )}
            </button>
          );
        })}
        {myPack.length === 0 && <p style={{ opacity: 0.5 }}>（パックは空です）</p>}
      </div>

      <h3 style={{ margin: 0 }}>獲得済みカード</h3>
      <AcquiredStrip state={state} myId={myId} />
    </section>
  );
}

function PendingStrip({ state }: { state: ClientGameState }) {
  const draft = state.packDraft;
  if (!draft) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 12, alignItems: 'center' }}>
      {state.players.map((p) => {
        const pending = draft.pendingPlayerIds.includes(p.id);
        const submitted = !!draft.submittedPicks[p.id];
        const acquired = (draft.acquired[p.id] ?? []).length;
        return (
          <span
            key={p.id}
            title={`${p.name}（${COLOR_LABEL[p.color]}） 獲得済 ${acquired}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 6px',
              borderRadius: 12,
              background: !pending ? '#bbb' : submitted ? '#0066cc' : '#eee',
              color: !pending || submitted ? '#fff' : '#333',
            }}
          >
            <span style={pieceStyle(p.color, { size: 10 })} />
            {p.name}
            {!pending ? ' ✔' : submitted ? ' ●' : ''}
          </span>
        );
      })}
    </div>
  );
}

function AcquiredStrip({
  state,
  myId,
}: {
  state: ClientGameState;
  myId: string | null;
}) {
  const draft = state.packDraft;
  if (!draft || !myId) return null;
  const acquired = draft.acquired[myId] ?? [];
  if (acquired.length === 0) return <p style={{ opacity: 0.5, fontSize: 12 }}>（まだ獲得していません）</p>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {acquired.map((c) => (
        <span
          key={c.id}
          style={{
            padding: '2px 8px',
            background: SKILL_CATEGORY_COLOR[getSkillCategory(c)],
            color: '#fff',
            borderRadius: 12,
            fontSize: 12,
          }}
        >
          {c.rarity} {c.name}
        </span>
      ))}
    </div>
  );
}
