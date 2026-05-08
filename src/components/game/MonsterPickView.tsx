'use client';
import { useEffect, useState } from 'react';
import type { ClientGameState } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';
import { COLOR_HEX, COLOR_LABEL, pieceStyle } from '../../lib/colors';
import { MONSTERS } from '../../server/engine/cards/monsters';

export function MonsterPickView({
  state,
  socket,
}: {
  state: ClientGameState;
  socket: GameSocket;
}) {
  const draft = state.monsterPick;
  const me = state.players.find((p) => p.id === socket.playerId);
  const myId = socket.playerId;
  const iAmPending = !!myId && !!draft && draft.pendingPlayerIds.includes(myId);
  const myCommittedPick = myId && draft ? draft.submittedPicks[myId] : undefined;

  // Local "tentative" placement before pressing 決定. Cleared once a new draft
  // sub-round opens (e.g. after a conflict).
  const [tentative, setTentative] = useState<string | null>(null);
  useEffect(() => {
    setTentative(null);
  }, [draft?.attempt, !!myCommittedPick, iAmPending]);

  const submittedCount = draft ? Object.keys(draft.submittedPicks).length : 0;
  const totalPending = draft ? draft.pendingPlayerIds.length : 0;

  // Build maps: which players have already claimed a monster (resolved), and
  // which players have a pending tentative/committed piece on each base.
  const claimedBy = new Map<string, ClientGameState['players'][number]>();
  for (const p of state.players) if (p.monster) claimedBy.set(p.monster.baseId, p);

  const pieces: Record<string, { committed: typeof state.players; tentative?: typeof state.players[number] }> = {};
  if (draft) {
    for (const [pid, baseId] of Object.entries(draft.submittedPicks)) {
      const player = state.players.find((p) => p.id === pid);
      if (!player) continue;
      pieces[baseId] = pieces[baseId] ?? { committed: [] };
      pieces[baseId]!.committed = [...pieces[baseId]!.committed, player];
    }
  }
  if (tentative && me && !myCommittedPick) {
    pieces[tentative] = pieces[tentative] ?? { committed: [] };
    pieces[tentative]!.tentative = me;
  }

  const placeOrCommit = (baseId: string): void => {
    if (!iAmPending || myCommittedPick) return;
    setTentative(baseId);
  };

  const confirm = (): void => {
    if (!tentative) return;
    socket.send({ type: 'submit_pick', baseId: tentative });
  };

  const isPoolMonster = (baseId: string): boolean => !!draft && draft.pool.some((m) => m.baseId === baseId);

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>モンスター選択 (ドラフト)</h2>
      <p style={{ margin: 0, opacity: 0.8 }}>
        {!draft
          ? '完了'
          : iAmPending && !myCommittedPick
            ? '👉 取りたいモンスターに駒を置いて「決定」を押してください。被ったら不選択モンスターから再ドラフトです。'
            : myCommittedPick
              ? `決定済み — 待機中… (${submittedCount}/${totalPending})`
              : `(${submittedCount}/${totalPending}) 待機中…`}
      </p>

      {iAmPending && !myCommittedPick && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={confirm} disabled={!tentative}>
            決定 {tentative ? `(${MONSTERS.find((m) => m.baseId === tentative)?.name})` : ''}
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
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 8,
        }}
      >
        {MONSTERS.map((m) => {
          const claimed = claimedBy.get(m.baseId);
          const inPool = isPoolMonster(m.baseId);
          const onCard = pieces[m.baseId];
          const conflict = (onCard?.committed.length ?? 0) > 1;
          const canClick = iAmPending && !myCommittedPick && inPool;
          const myPieceHere =
            myCommittedPick === m.baseId ||
            tentative === m.baseId ||
            (claimed && claimed.id === socket.playerId);
          return (
            <button
              key={m.baseId}
              disabled={!canClick}
              onClick={() => placeOrCommit(m.baseId)}
              style={{
                position: 'relative',
                border: `2px solid ${
                  myPieceHere ? '#0066cc' : conflict ? '#c44' : claimed ? '#aaa' : canClick ? '#0a8' : '#ccc'
                }`,
                borderRadius: 8,
                padding: 12,
                paddingTop: 28,
                background: claimed ? '#f0f0f0' : !inPool ? '#f6f6f6' : '#fff',
                color: claimed ? '#666' : 'inherit',
                cursor: canClick ? 'pointer' : 'default',
                textAlign: 'left',
                opacity: claimed ? 0.78 : 1,
                minHeight: 110,
              }}
            >
              {/* Pieces row */}
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
                {claimed && (
                  <span
                    title={`${claimed.name} が獲得`}
                    style={{
                      ...pieceStyle(claimed.color, { size: 14 }),
                      outline: '2px solid #333',
                    }}
                  />
                )}
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
              <div style={{ fontWeight: 600 }}>{m.name}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                HP{m.stats.hp} ATK{m.stats.atk} DEF{m.stats.def} SPD{m.stats.spd}
              </div>
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
                {m.passives.map((p) => p.name).join(', ')}
              </div>
              {claimed && (
                <div style={{ fontSize: 11, marginTop: 6, fontWeight: 600 }}>
                  → {claimed.name}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PendingStrip({ state }: { state: ClientGameState }) {
  const draft = state.monsterPick;
  if (!draft) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 12, alignItems: 'center' }}>
      <span style={{ opacity: 0.7 }}>進行: 試行 {draft.attempt + 1} 回目 ·</span>
      {state.players.map((p) => {
        const pending = draft.pendingPlayerIds.includes(p.id);
        const submitted = !!draft.submittedPicks[p.id];
        return (
          <span
            key={p.id}
            title={`${p.name}（${COLOR_LABEL[p.color]}）`}
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
