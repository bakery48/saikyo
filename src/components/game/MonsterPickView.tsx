'use client';
import { useEffect, useState } from 'react';
import type { ClientGameState } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';
import { COLOR_LABEL, pieceStyle } from '../../lib/colors';
import { MONSTERS } from '../../server/engine/cards/monsters';

const PIECE_SIZE_CARD = 22;
const PIECE_SIZE_LEGEND = 16;

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

  // Show only own pick (committed or tentative) — hide other players' in-progress picks.
  const pieces: Record<
    string,
    { committed: ClientGameState['players']; tentative?: ClientGameState['players'][number] }
  > = {};
  if (me && myCommittedPick) {
    pieces[myCommittedPick] = { committed: [me] };
  }
  if (tentative && me && !myCommittedPick) {
    pieces[tentative] = { committed: [], tentative: me };
  }

  const placeOrCommit = (baseId: string): void => {
    if (!iAmPending || myCommittedPick) return;
    setTentative(baseId);
  };

  const confirm = (): void => {
    if (!tentative) return;
    socket.send({ type: 'submit_pick', baseId: tentative });
  };

  const isPoolMonster = (baseId: string): boolean =>
    !!draft && draft.pool.some((m) => m.baseId === baseId);

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>モンスター選択 (ドラフト)</h2>

      {/* Always-visible color legend so you know who's who. */}
      <PlayerLegend state={state} selfId={myId ?? null} />

      <p style={{ margin: 0, opacity: 0.85 }}>
        {!draft ? (
          '完了'
        ) : iAmPending && !myCommittedPick ? (
          <>
            {me && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  marginRight: 6,
                }}
              >
                <span style={pieceStyle(me.color, { size: 14 })} />
                <strong>あなた（{COLOR_LABEL[me.color]}）の番</strong>
              </span>
            )}
            👉 取りたいモンスターをクリックして駒を置き、「決定」を押してください。
          </>
        ) : myCommittedPick ? (
          `決定済み — 待機中… (${submittedCount}/${totalPending})`
        ) : (
          `(${submittedCount}/${totalPending}) 待機中…`
        )}
      </p>

      {iAmPending && !myCommittedPick && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={confirm} disabled={!tentative}>
            決定 {tentative ? `(${MONSTERS.find((m) => m.baseId === tentative)?.name})` : ''}
          </button>
          <button onClick={() => setTentative(null)} disabled={!tentative} type="button">
            駒を戻す
          </button>
          {!tentative && (
            <span style={{ fontSize: 12, opacity: 0.6 }}>↑ まずモンスターをクリック</span>
          )}
        </div>
      )}

      {draft && (
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          試行 {draft.attempt + 1} 回目 · 提出 {submittedCount}/{totalPending}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 8,
        }}
      >
        {MONSTERS.map((m) => {
          const claimed = claimedBy.get(m.baseId);
          const inPool = isPoolMonster(m.baseId);
          const onCard = pieces[m.baseId];
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
                border: `3px solid ${
                  myPieceHere
                    ? '#0066cc'
                    : claimed
                      ? '#aaa'
                      : canClick
                        ? '#0a8'
                        : '#ccc'
                }`,
                borderRadius: 8,
                padding: 12,
                background: claimed ? '#f0f0f0' : !inPool ? '#f6f6f6' : '#fff',
                color: claimed ? '#666' : 'inherit',
                cursor: canClick ? 'pointer' : 'default',
                textAlign: 'left',
                opacity: claimed ? 0.78 : 1,
                minHeight: 140,
                display: 'grid',
                gap: 6,
              }}
            >
              {/* Pieces row — pieces with player name labels. */}
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  minHeight: PIECE_SIZE_CARD + 4,
                }}
              >
                {claimed && (
                  <PieceLabel
                    player={claimed}
                    note="獲得"
                    extraStyle={{ outline: '2px solid #d4a000', outlineOffset: 2 }}
                  />
                )}
                {onCard?.committed.map((p) => (
                  <PieceLabel key={p.id} player={p} note="決定" />
                ))}
                {onCard?.tentative && (
                  <PieceLabel
                    player={onCard.tentative}
                    note="未確定"
                    extraStyle={{ opacity: 0.55, borderStyle: 'dashed' }}
                  />
                )}
              </div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{m.name}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                HP{m.stats.hp} ATK{m.stats.atk} DEF{m.stats.def} SPD{m.stats.spd}
              </div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>
                {m.passives.map((p) => p.name).join(', ')}
              </div>
              {claimed && (
                <div style={{ fontSize: 11, fontWeight: 600 }}>→ {claimed.name} の獲得</div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Single piece + name chip so each color is unambiguous. */
function PieceLabel({
  player,
  note,
  extraStyle,
}: {
  player: ClientGameState['players'][number];
  note?: string;
  extraStyle?: React.CSSProperties;
}) {
  return (
    <span
      title={`${player.name}（${COLOR_LABEL[player.color]}）${note ? ` — ${note}` : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 6px 2px 2px',
        background: '#fff',
        border: '1px solid #ccc',
        borderRadius: 999,
        fontSize: 11,
        lineHeight: 1,
      }}
    >
      <span style={{ ...pieceStyle(player.color, { size: PIECE_SIZE_CARD }), ...extraStyle }} />
      <span style={{ fontWeight: 600 }}>{player.name}</span>
    </span>
  );
}

/** Always-visible strip showing every player's color, name and current pick state. */
function PlayerLegend({
  state,
  selfId,
}: {
  state: ClientGameState;
  selfId: string | null;
}) {
  const draft = state.monsterPick;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        padding: 8,
        background: '#fafafa',
        border: '1px solid #ddd',
        borderRadius: 6,
        alignItems: 'center',
      }}
    >
      {state.players.map((p) => {
        const isSelf = p.id === selfId;
        const submitted = !!(draft && draft.submittedPicks[p.id]);
        const pending = !!(draft && draft.pendingPlayerIds.includes(p.id));
        const done = !!p.monster;
        const status = done
          ? '獲得済'
          : submitted
            ? '決定'
            : pending
              ? '選択中'
              : '待機';
        const bg = done
          ? '#bbb'
          : submitted
            ? '#0066cc'
            : pending
              ? '#fff'
              : '#eee';
        const fg = submitted || done ? '#fff' : '#333';
        return (
          <span
            key={p.id}
            title={`${p.name}（${COLOR_LABEL[p.color]}）${status}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              background: bg,
              color: fg,
              border: isSelf ? '2px solid #0066cc' : '1px solid #ccc',
              fontSize: 12,
            }}
          >
            <span style={pieceStyle(p.color, { size: PIECE_SIZE_LEGEND })} />
            <strong>{p.name}</strong>
            {isSelf && <span>(you)</span>}
            {p.isCPU && <span>🤖</span>}
            {done && p.monster && <span>· {p.monster.name}</span>}
            {!done && submitted && <span>· ●</span>}
          </span>
        );
      })}
    </div>
  );
}
