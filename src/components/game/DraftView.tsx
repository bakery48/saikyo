'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [packOpened, setPackOpened] = useState(false);

  useEffect(() => {
    setTentative(null);
  }, [draft?.passIndex, !!myCommitted, iAmPending]);

  // Reset pack-opened state when a new draft session begins
  useEffect(() => {
    if (!draft) return;
    setPackOpened(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.draftOrder.join(',')]);

  if (!draft) return <p>ドラフト準備中...</p>;

  const submittedCount = Object.keys(draft.submittedPicks).length;
  const totalPending = draft.pendingPlayerIds.length;

  const showPackReveal = draft.passIndex === 0 && iAmPending && !myCommitted && !packOpened;

  const placeOrCommit = (cardId: string): void => {
    if (!iAmPending || myCommitted) return;
    setTentative(cardId);
  };

  const confirm = (): void => {
    if (!tentative) return;
    socket.send({ type: 'submit_draft', skillId: tentative });
  };

  if (showPackReveal) {
    return (
      <section style={{ display: 'grid', gap: 16 }}>
        <h2 style={{ margin: 0 }}>パック・ドラフト</h2>
        <PackReveal cardCount={myPack.length} onOpened={() => setPackOpened(true)} />
        <PendingStrip state={state} />
      </section>
    );
  }

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
              className={c.rarity === 'SSR' ? 'ssr-card' : undefined}
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
                position: 'relative',
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

// ─── PackReveal ───────────────────────────────────────────────────────────────

const DRAG_THRESHOLD = 110; // px right-drag to trigger open
const FLAP_HEIGHT = 80; // px height of tear-off flap

function PackReveal({
  cardCount,
  onOpened,
}: {
  cardCount: number;
  onOpened: () => void;
}) {
  const [dragX, setDragX] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'flying' | 'done'>('idle');

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const dragXRef = useRef(0);

  const triggerOpen = useCallback(() => {
    setPhase('flying');
    // wait for fly-off animation, then reveal cards
    setTimeout(onOpened, 480);
  }, [onOpened]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = Math.max(0, e.clientX - startXRef.current);
      dragXRef.current = delta;
      setDragX(delta);
      if (delta >= DRAG_THRESHOLD) {
        isDraggingRef.current = false;
        triggerOpen();
      }
    };
    const onUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      if (dragXRef.current < DRAG_THRESHOLD) {
        dragXRef.current = 0;
        setDragX(0);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [triggerOpen]);

  const progress = Math.min(1, dragX / DRAG_THRESHOLD);
  const isFlying = phase === 'flying';

  const flapTranslateX = isFlying ? 420 : dragX;
  const flapRotate = isFlying ? 22 : progress * 14;
  const flapTransition = isFlying
    ? 'transform 0.46s cubic-bezier(0.4, 0, 0.8, 0.6)'
    : dragX === 0
    ? 'transform 0.22s ease-out'
    : 'none';

  // gap that appears between flap and body as you drag
  const gapHeight = progress * 18;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        padding: '32px 0',
        userSelect: 'none',
      }}
    >
      <div style={{ position: 'relative', width: 190, height: 300 }}>
        {/* Pack body (stays put) */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: FLAP_HEIGHT,
            width: 190,
            height: 300 - FLAP_HEIGHT,
            borderRadius: '0 0 16px 16px',
            border: '2px solid #5b6cf0',
            borderTop: 'none',
            background: 'linear-gradient(160deg, #1a1a3e 0%, #0d1f3a 55%, #0a0a20 100%)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: '#fff',
          }}
        >
          {/* Perforated top edge */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background:
                'repeating-linear-gradient(90deg, #5b6cf0 0px, #5b6cf0 7px, transparent 7px, transparent 14px)',
              opacity: 0.7,
            }}
          />
          {/* Shimmer */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.055) 50%, transparent 65%)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ fontSize: 36, filter: 'drop-shadow(0 0 10px #7788ff)', lineHeight: 1 }}>✦</div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: '#8899ff' }}>
            SKILL PACK
          </div>
          <div style={{ fontSize: 11, color: '#778', marginTop: 2 }}>{cardCount}枚入り</div>
        </div>

        {/* Gap between flap and body (cards peeking out) */}
        {gapHeight > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 6,
              top: FLAP_HEIGHT,
              width: 178,
              height: gapHeight,
              background: 'linear-gradient(to bottom, #e8eaff, #ccd)',
              borderRadius: 2,
              opacity: 0.9,
              overflow: 'hidden',
            }}
          >
            {/* card edge lines */}
            <div style={{ position: 'absolute', top: 4, left: 8, right: 8, height: 1, background: '#aab', opacity: 0.6 }} />
            <div style={{ position: 'absolute', top: 8, left: 12, right: 12, height: 1, background: '#aab', opacity: 0.4 }} />
          </div>
        )}

        {/* Flap (tears off to the right) */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            if (phase !== 'idle') return;
            isDraggingRef.current = true;
            startXRef.current = e.clientX;
            dragXRef.current = 0;
          }}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 190,
            height: FLAP_HEIGHT + 2, // +2 to overlap body border
            borderRadius: '16px 16px 0 0',
            border: '2px solid #5b6cf0',
            borderBottom: 'none',
            background: 'linear-gradient(150deg, #3a44cc 0%, #2a34bb 50%, #1e28a8 100%)',
            cursor: phase === 'idle' ? 'grab' : 'default',
            transform: `translateX(${flapTranslateX}px) rotate(${flapRotate}deg)`,
            transformOrigin: '0% 50%',
            transition: flapTransition,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Shimmer */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.1) 50%, transparent 65%)',
              pointerEvents: 'none',
            }}
          />
          {/* Notch on right side */}
          <div
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.25)',
              border: '1.5px solid rgba(255,255,255,0.2)',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'rgba(255,255,255,0.85)',
              fontSize: 13,
              fontWeight: 600,
              opacity: Math.max(0, 1 - progress * 1.5),
              pointerEvents: 'none',
            }}
          >
            <span style={{ fontSize: 20 }}>→</span>
            スライドして開ける
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={triggerOpen}
        style={{
          fontSize: 11,
          opacity: 0.45,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textDecoration: 'underline',
          padding: 4,
        }}
      >
        スキップ
      </button>
    </div>
  );
}

// ─── Supporting strips ────────────────────────────────────────────────────────

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
