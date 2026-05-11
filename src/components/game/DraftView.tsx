'use client';
import { useEffect, useState } from 'react';
import type { ClientGameState } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';
import { COLOR_LABEL, pieceStyle } from '../../lib/colors';
import { describeSkillCard } from '../../lib/skill-text';

const RARITY_COLOR: Record<string, string> = {
  N: '#888',
  R: '#3a78ff',
  SR: '#a050ff',
  SSR: '#ffa033',
};

export function DraftView({
  state,
  socket,
}: {
  state: ClientGameState;
  socket: GameSocket;
}) {
  const draft = state.draft;
  const me = state.players.find((p) => p.id === socket.playerId);
  const myId = socket.playerId;
  const myCommitted = myId && draft ? draft.submittedPicks[myId] : undefined;
  const iAmPending = !!myId && !!draft && draft.pendingPlayerIds.includes(myId);

  const [tentative, setTentative] = useState<string | null>(null);
  useEffect(() => {
    setTentative(null);
  }, [draft?.attempt, !!myCommitted, iAmPending]);

  if (!draft) return <p>ドラフト準備中...</p>;

  const submittedCount = Object.keys(draft.submittedPicks).length;
  const totalPending = draft.pendingPlayerIds.length;

  // Map cardId -> pieces on it.
  // During reveal (after all picks submitted): show everyone's pick.
  // During normal picking: show only own pick.
  const pieces: Record<
    string,
    { committed: typeof state.players; tentative?: typeof state.players[number] }
  > = {};
  if (draft.revealing) {
    for (const [pid, cid] of Object.entries(draft.submittedPicks)) {
      const player = state.players.find((p) => p.id === pid);
      if (!player) continue;
      pieces[cid] = pieces[cid] ?? { committed: [] };
      pieces[cid]!.committed = [...pieces[cid]!.committed, player];
    }
  } else {
    if (me && myCommitted) {
      pieces[myCommitted] = { committed: [me] };
    }
    if (tentative && me && !myCommitted) {
      pieces[tentative] = { committed: [], tentative: me };
    }
  }

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
      <h2 style={{ margin: 0 }}>ドラフト</h2>
      {draft.revealing ? (
        <div
          style={{
            background: '#fff3cd',
            border: '2px solid #ffc107',
            borderRadius: 8,
            padding: '10px 14px',
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          🃏 オープン！ — 全員のピックを確認中…
        </div>
      ) : (
        <p style={{ margin: 0, opacity: 0.8 }}>
          {iAmPending && !myCommitted
            ? '👉 取りたいカードに駒を置いて「決定」を押してください。被ったら不選択カードから再ドラフトです。'
            : myCommitted
              ? `決定済み — 待機中… (${submittedCount}/${totalPending})`
              : `(${submittedCount}/${totalPending}) 待機中…`}
        </p>
      )}

      {iAmPending && !myCommitted && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={confirm} disabled={!tentative}>
            決定
          </button>
          <button onClick={() => setTentative(null)} disabled={!tentative} type="button">
            駒を戻す
          </button>
        </div>
      )}

      <PendingStrip state={state} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 8,
        }}
      >
        {draft.pool.map((c) => {
          const onCard = pieces[c.id];
          const conflict = draft.revealing && (onCard?.committed.length ?? 0) > 1;
          const myPieceHere = myCommitted === c.id || tentative === c.id;
          const canClick = iAmPending && !myCommitted && !draft.revealing;
          return (
            <button
              key={c.id}
              disabled={!canClick}
              onClick={() => placeOrCommit(c.id)}
              style={{
                position: 'relative',
                border: `2px solid ${
                  myPieceHere
                    ? '#0066cc'
                    : conflict
                      ? '#c44'
                      : RARITY_COLOR[c.rarity] ?? '#aaa'
                }`,
                borderRadius: 8,
                padding: 12,
                paddingTop: 28,
                background: myPieceHere ? '#e6f0ff' : '#fff',
                cursor: canClick ? 'pointer' : 'default',
                textAlign: 'left',
                minHeight: 110,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 6,
                  left: 6,
                  right: 6,
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                {onCard?.committed.map((p) => (
                  <span
                    key={p.id}
                    title={`${p.name} が決定`}
                    style={pieceStyle(p.color, { size: 14 })}
                  />
                ))}
                {onCard?.tentative && (
                  <span
                    title="未確定（あなた）"
                    style={{
                      ...pieceStyle(onCard.tentative.color, { size: 14 }),
                      opacity: 0.5,
                      borderStyle: 'dashed',
                    }}
                  />
                )}
                {conflict && (
                  <span
                    style={{
                      fontSize: 10,
                      background: '#c44',
                      color: '#fff',
                      borderRadius: 4,
                      padding: '1px 4px',
                    }}
                  >
                    かぶり
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: RARITY_COLOR[c.rarity] ?? '#888' }}>{c.rarity}</div>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>
                {describeSkill(c)}
              </div>
              {c.nameTag && (
                <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6 }}>tag: {c.nameTag}</div>
              )}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>試行: {draft.attempt + 1} 回目</div>
    </section>
  );
}

function PendingStrip({ state }: { state: ClientGameState }) {
  const draft = state.draft;
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

function describeSkill(c: import('../../server/engine/types').SkillCard): string {
  return describeSkillCard(c);
}
