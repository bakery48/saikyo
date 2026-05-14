'use client';
import { useEffect, useState } from 'react';
import type { ClientGameState } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';
import { COLOR_LABEL, pieceStyle } from '../../lib/colors';
import { MONSTERS } from '../../server/engine/cards/monsters';
import { passiveTooltip, describePassive } from '../../lib/skill-text';
import { SkillNameHover } from './SkillNameHover';

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

  // During reveal: show all picks. During normal picking: show only own pick.
  const pieces: Record<
    string,
    { committed: ClientGameState['players']; tentative?: ClientGameState['players'][number] }
  > = {};
  if (draft?.revealing) {
    for (const [pid, baseId] of Object.entries(draft.submittedPicks)) {
      const player = state.players.find((p) => p.id === pid);
      if (!player) continue;
      pieces[baseId] = pieces[baseId] ?? { committed: [] };
      pieces[baseId]!.committed = [...pieces[baseId]!.committed, player];
    }
  } else {
    if (me && myCommittedPick) {
      pieces[myCommittedPick] = { committed: [me] };
    }
    if (tentative && me && !myCommittedPick) {
      pieces[tentative] = { committed: [], tentative: me };
    }
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

      {draft?.revealing ? (
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
      )}

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
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
        }}
      >
        {MONSTERS.filter((m) => !m.hidden).map((m) => {
          const claimed = claimedBy.get(m.baseId);
          const inPool = isPoolMonster(m.baseId);
          const onCard = pieces[m.baseId];
          const conflict = !!draft?.revealing && (onCard?.committed.length ?? 0) > 1;
          const canClick = iAmPending && !myCommittedPick && inPool && !draft?.revealing;
          const myPieceHere =
            myCommittedPick === m.baseId ||
            tentative === m.baseId ||
            (claimed && claimed.id === socket.playerId);
          const borderColor = myPieceHere
            ? '#0066cc'
            : conflict
              ? '#c44'
              : claimed
                ? '#aaa'
                : canClick
                  ? '#0a8'
                  : '#ccc';
          return (
            <button
              key={m.baseId}
              disabled={!canClick}
              onClick={() => placeOrCommit(m.baseId)}
              style={{
                border: `3px solid ${borderColor}`,
                borderRadius: 8,
                padding: 0,
                background: claimed ? '#f0f0f0' : !inPool ? '#f6f6f6' : '#fff',
                color: claimed ? '#666' : 'inherit',
                cursor: canClick ? 'pointer' : 'default',
                textAlign: 'left',
                opacity: claimed ? 0.78 : 1,
                display: 'flex',
                flexDirection: 'row',
                overflow: 'hidden',
              }}
            >
              {/* Left: monster image */}
              <div
                style={{
                  flexShrink: 0,
                  width: 72,
                  margin: 6,
                  borderRadius: 4,
                  background: '#4a7a9b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  color: '#fff',
                  border: '2px solid #333',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={`/monsters/${m.baseId}.png`}
                  alt={m.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              {/* Right: info */}
              <div style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</div>
                <div style={{ fontSize: 11, opacity: 0.75 }}>
                  HP{m.stats.hp} ATK{m.stats.atk} DEF{m.stats.def} SPD{m.stats.spd}
                </div>
                {m.passives.length > 0 && (
                  <div style={{ fontSize: 11, marginTop: 2 }}>
                    {m.passives.map((p, i) => (
                      <div key={p.id ?? `${m.baseId}-${i}`}>
                        <SkillNameHover label={p.name} tooltip={passiveTooltip(p)} />
                        <span style={{ opacity: 0.7, marginLeft: 4 }}>
                          {p.description ?? describePassive(p)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Pieces row */}
                {(claimed || onCard?.committed.length || onCard?.tentative || conflict) && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
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
                    {conflict && (
                      <span
                        style={{
                          fontSize: 11,
                          background: '#c44',
                          color: '#fff',
                          borderRadius: 4,
                          padding: '1px 6px',
                          fontWeight: 600,
                        }}
                      >
                        かぶり
                      </span>
                    )}
                  </div>
                )}
              </div>
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
