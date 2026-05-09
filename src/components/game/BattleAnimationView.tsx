'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClientGameState, ClientPlayer } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';
import type {
  BattleEvent,
  BattleMatch,
  Monster,
} from '../../server/engine/types';
import { COLOR_HEX, COLOR_LABEL, pieceStyle } from '../../lib/colors';

const STEP_MS = 2000;
const PREROLL_MS = 3000;

/**
 * Animated battle view: shows the player's match with two monsters facing
 * each other and steps through their active skills top-to-bottom.
 *   - Skills not yet processed: gray
 *   - Currently-processing skill: black + highlighted
 *   - Already-processed skill: black, normal weight
 * One step = one `skill_use` event = STEP_MS milliseconds.
 */
export function BattleAnimationView({
  state,
  socket,
}: {
  state: ClientGameState;
  socket: GameSocket;
}) {
  const myId = socket.playerId;
  const matches = state.battle?.matches ?? [];
  const myMatch =
    matches.find((m) => m.a === myId || m.b === myId) ?? matches[0];

  if (!myMatch) {
    return (
      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>戦闘</h2>
        <p>準備中...</p>
      </section>
    );
  }

  return <BattleStage state={state} match={myMatch} />;
}

function BattleStage({ state, match }: { state: ClientGameState; match: BattleMatch }) {
  // Indices in the log of every skill_use event (one per "action" the user
  // wants to see step through at STEP_MS).
  const stepLogIndices = useMemo(() => {
    const ids: number[] = [];
    match.log.forEach((e, i) => {
      if (e.kind === 'skill_use') ids.push(i);
    });
    return ids;
  }, [match.log]);

  // Index into stepLogIndices. Each tick advances one skill_use.
  const [stepIdx, setStepIdx] = useState(0);
  // Whether we're still showing the pre-battle dice roll display.
  const [preroll, setPreroll] = useState(true);

  useEffect(() => {
    setStepIdx(0);
    setPreroll(true);
    const t = setTimeout(() => setPreroll(false), PREROLL_MS);
    return () => clearTimeout(t);
  }, [match.a, match.b]);

  useEffect(() => {
    if (preroll) return;
    if (stepIdx >= stepLogIndices.length) return;
    const t = setTimeout(() => setStepIdx((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [preroll, stepIdx, stepLogIndices.length]);

  const aPlayer = state.players.find((p) => p.id === match.a);
  const bPlayer = state.players.find((p) => p.id === match.b);
  const aMon = aPlayer?.monster ?? null;
  const bMon = bPlayer?.monster ?? null;

  const isBye = match.a === match.b;

  // Range of log events that have been "applied". During preroll, nothing has
  // happened yet (HP at base). Otherwise everything up to (but not including)
  // the NEXT skill_use.
  const upToLogIdx = preroll
    ? 0
    : stepIdx + 1 < stepLogIndices.length
      ? stepLogIndices[stepIdx + 1]!
      : match.log.length;
  const appliedEvents = match.log.slice(0, upToLogIdx);

  const aHpBase = aMon?.stats.hp ?? 0;
  const bHpBase = bMon?.stats.hp ?? 0;
  const aHp = computeHp(appliedEvents, 'a', aHpBase);
  const bHp = computeHp(appliedEvents, 'b', bHpBase);

  const currentEvent =
    !preroll && stepIdx < stepLogIndices.length
      ? match.log[stepLogIndices[stepIdx]!]
      : null;
  const currentSide =
    currentEvent && currentEvent.kind === 'skill_use' ? currentEvent.player : null;
  const currentSkillId =
    currentEvent && currentEvent.kind === 'skill_use' ? currentEvent.skillId : null;

  const usedSkillIdsA = preroll
    ? new Set<string>()
    : collectUsedSkillIds(match.log, stepLogIndices, stepIdx, 'a');
  const usedSkillIdsB = preroll
    ? new Set<string>()
    : collectUsedSkillIds(match.log, stepLogIndices, stepIdx, 'b');

  // Was the side hit by a damage event during the current skill_use?
  const currentSkillEventRange =
    !preroll && stepIdx < stepLogIndices.length
      ? match.log.slice(stepLogIndices[stepIdx]!, upToLogIdx)
      : [];
  const damageToA = currentSkillEventRange.some(
    (e) => e.kind === 'damage' && e.to === 'a' && e.amount > 0,
  );
  const damageToB = currentSkillEventRange.some(
    (e) => e.kind === 'damage' && e.to === 'b' && e.amount > 0,
  );

  // Pre-battle dice information (the LAST pair of rolls is the deciding one).
  const rolls = match.log.filter(
    (e): e is Extract<BattleEvent, { kind: 'roll' }> => e.kind === 'roll',
  );
  const lastARoll = [...rolls].reverse().find((r) => r.player === 'a') ?? null;
  const lastBRoll = [...rolls].reverse().find((r) => r.player === 'b') ?? null;
  const firstEvent = match.log.find((e) => e.kind === 'first');
  const firstSide =
    firstEvent && firstEvent.kind === 'first' ? firstEvent.player : null;

  const battleDone = !preroll && stepIdx >= stepLogIndices.length;
  const finalEvent = match.log.find((e) => e.kind === 'end');
  const verdict =
    !battleDone || !finalEvent
      ? null
      : finalEvent.kind === 'end'
        ? finalEvent.winner === 'a'
          ? `${aPlayer?.name ?? 'A'} の勝利`
          : finalEvent.winner === 'b'
            ? `${bPlayer?.name ?? 'B'} の勝利`
            : '引き分け'
        : null;

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>戦闘</h2>
      <p style={{ margin: 0, opacity: 0.8 }}>
        {preroll
          ? '🎲 ダイスロール…'
          : battleDone
            ? verdict
              ? `決着: ${verdict}`
              : '決着'
            : `行動 ${stepIdx + 1} / ${stepLogIndices.length}`}
      </p>

      {preroll && !isBye && (
        <DiceRollBanner
          aPlayer={aPlayer}
          bPlayer={bPlayer}
          aRoll={lastARoll}
          bRoll={lastBRoll}
          firstSide={firstSide}
          rerolls={rolls.length / 2 - 1}
        />
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: 12,
          alignItems: 'flex-start',
        }}
      >
        <MonsterColumn
          player={aPlayer}
          mon={aMon}
          hp={aHp}
          isCurrent={currentSide === 'a'}
          currentSkillId={currentSide === 'a' ? currentSkillId : null}
          usedSkillIds={usedSkillIdsA}
          slashKey={damageToA ? `a-${stepIdx}` : null}
        />
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            fontSize: 32,
            fontWeight: 700,
            color: '#aaa',
            paddingTop: 64,
          }}
        >
          VS
        </div>
        {isBye ? (
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              minHeight: 200,
              border: '1px dashed #ccc',
              borderRadius: 8,
              padding: 16,
              opacity: 0.6,
            }}
          >
            (不戦勝)
          </div>
        ) : (
          <MonsterColumn
            player={bPlayer}
            mon={bMon}
            hp={bHp}
            isCurrent={currentSide === 'b'}
            currentSkillId={currentSide === 'b' ? currentSkillId : null}
            usedSkillIds={usedSkillIdsB}
            slashKey={damageToB ? `b-${stepIdx}` : null}
          />
        )}
      </div>
    </section>
  );
}

function MonsterColumn({
  player,
  mon,
  hp,
  isCurrent,
  currentSkillId,
  usedSkillIds,
  slashKey,
}: {
  player: ClientPlayer | undefined;
  mon: Monster | null;
  hp: number;
  isCurrent: boolean;
  currentSkillId: string | null;
  usedSkillIds: Set<string>;
  /** Non-null + unique key when this side just got hit; triggers a fresh slash animation. */
  slashKey: string | null;
}) {
  if (!player || !mon) {
    return (
      <div style={{ minHeight: 200, opacity: 0.5 }}>
        <em>(no monster)</em>
      </div>
    );
  }
  const baseHp = mon.stats.hp;
  const hpPct = Math.max(0, Math.min(100, Math.round((hp / Math.max(1, baseHp)) * 100)));
  const colorHex = COLOR_HEX[player.color] ?? '#888';

  // Shake on hit. Re-runs whenever slashKey changes (i.e. a new damage event
  // landed on this side).
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!slashKey) return;
    const el = wrapperRef.current;
    if (!el) return;
    el.animate(
      [
        { transform: 'translateX(0) translateY(0) rotate(0deg)' },
        { transform: 'translateX(-8px) translateY(2px) rotate(-1.5deg)' },
        { transform: 'translateX(7px) translateY(-2px) rotate(1.5deg)' },
        { transform: 'translateX(-6px) translateY(1px) rotate(-1deg)' },
        { transform: 'translateX(5px) translateY(-1px) rotate(1deg)' },
        { transform: 'translateX(-3px) translateY(1px) rotate(-0.5deg)' },
        { transform: 'translateX(2px) translateY(0) rotate(0.5deg)' },
        { transform: 'translateX(0) translateY(0) rotate(0deg)' },
      ],
      { duration: 520, easing: 'ease-out' },
    );
  }, [slashKey]);

  return (
    <div
      ref={wrapperRef}
      style={{
        display: 'grid',
        gap: 8,
        padding: 8,
        border: isCurrent ? `2px solid ${colorHex}` : '2px solid transparent',
        borderRadius: 8,
        transition: 'border-color 200ms',
      }}
    >
      {/* Avatar (slash effect overlays here when hit) */}
      <div
        style={{
          display: 'grid',
          justifyItems: 'center',
          gap: 4,
          position: 'relative',
        }}
      >
        <div style={{ position: 'relative', width: 80, height: 80 }}>
          <span style={{ ...pieceStyle(player.color, { size: 80 }), position: 'absolute', inset: 0 }} />
          {slashKey && <ClawSlash key={slashKey} />}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {player.name}（{COLOR_LABEL[player.color]}）
        </div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>{mon.name}</div>
      </div>

      {/* HP bar */}
      <div>
        <div style={{ fontSize: 12, marginBottom: 2 }}>
          HP {hp} / {baseHp}
        </div>
        <div
          style={{
            height: 10,
            background: '#eee',
            borderRadius: 5,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${hpPct}%`,
              height: '100%',
              background: hpPct > 30 ? '#3c3' : '#c44',
              transition: 'width 400ms',
            }}
          />
        </div>
      </div>

      {/* Passive card */}
      <div
        style={{
          border: '1px solid #999',
          borderRadius: 6,
          background: '#fff',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: '#f3f3f3',
            borderBottom: '1px solid #ddd',
            padding: '4px 8px',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          パッシブ
        </div>
        <div style={{ padding: '6px 8px', display: 'grid', gap: 2 }}>
          {mon.passives.length === 0 ? (
            <span style={{ fontSize: 12, opacity: 0.5 }}>(なし)</span>
          ) : (
            mon.passives.map((p, i) => (
              <div key={p.id ?? i} style={{ fontSize: 12 }}>
                {p.name}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Active skills card */}
      <div
        style={{
          border: '1px solid #999',
          borderRadius: 6,
          background: '#fff',
          overflow: 'hidden',
          minHeight: 120,
        }}
      >
        <div
          style={{
            background: '#f3f3f3',
            borderBottom: '1px solid #ddd',
            padding: '4px 8px',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          アクティブスキル
        </div>
        <ol
          style={{
            margin: 0,
            padding: '6px 8px 6px 24px',
            display: 'grid',
            gap: 2,
          }}
        >
          {mon.actives
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((a) => {
              const isCur = a.id === currentSkillId;
              const isUsed = usedSkillIds.has(a.id);
              return (
                <li
                  key={a.id}
                  style={{
                    fontSize: 13,
                    color: isCur ? '#000' : isUsed ? '#444' : '#bbb',
                    fontWeight: isCur ? 700 : 400,
                    background: isCur ? '#fff7b3' : 'transparent',
                    padding: '1px 4px',
                    borderRadius: 3,
                    transition: 'background 200ms, color 200ms',
                  }}
                >
                  {a.name}
                </li>
              );
            })}
          {mon.actives.length === 0 && (
            <span style={{ fontSize: 12, opacity: 0.5 }}>(なし)</span>
          )}
        </ol>
      </div>
    </div>
  );
}

/**
 * Pre-battle banner showing the dice roll for initiative — both sides' SPD
 * + die = total, with the winning side flagged as "先攻". Held on screen for
 * PREROLL_MS before the skill animation kicks in.
 */
function DiceRollBanner({
  aPlayer,
  bPlayer,
  aRoll,
  bRoll,
  firstSide,
  rerolls,
}: {
  aPlayer: ClientPlayer | undefined;
  bPlayer: ClientPlayer | undefined;
  aRoll: Extract<BattleEvent, { kind: 'roll' }> | null;
  bRoll: Extract<BattleEvent, { kind: 'roll' }> | null;
  firstSide: 'a' | 'b' | null;
  rerolls: number;
}) {
  if (!aRoll || !bRoll) return null;
  const winnerName =
    firstSide === 'a' ? aPlayer?.name ?? 'A' : firstSide === 'b' ? bPlayer?.name ?? 'B' : '?';
  return (
    <div
      style={{
        background: '#fff8d6',
        border: '2px solid #d4a000',
        borderRadius: 8,
        padding: '10px 14px',
        display: 'grid',
        gap: 6,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <RollSide
          label={aPlayer?.name ?? 'A'}
          roll={aRoll}
          isFirst={firstSide === 'a'}
        />
        <span style={{ fontSize: 20, fontWeight: 700, color: '#aaa' }}>VS</span>
        <RollSide
          label={bPlayer?.name ?? 'B'}
          roll={bRoll}
          isFirst={firstSide === 'b'}
          align="right"
        />
      </div>
      <div style={{ textAlign: 'center', fontSize: 13 }}>
        先攻 → <strong>{winnerName}</strong>
        {rerolls > 0 && (
          <span style={{ marginLeft: 8, opacity: 0.65 }}>(同値で {rerolls} 回振り直し)</span>
        )}
      </div>
    </div>
  );
}

function RollSide({
  label,
  roll,
  isFirst,
  align,
}: {
  label: string;
  roll: Extract<BattleEvent, { kind: 'roll' }>;
  isFirst: boolean;
  align?: 'right';
}) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 2,
        textAlign: align === 'right' ? 'right' : 'left',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14 }}>
        {label}
        {isFirst && <span style={{ color: '#d4a000', marginLeft: 4 }}>（先攻）</span>}
      </div>
      <div style={{ fontSize: 13 }}>
        SPD {roll.spd} + 🎲{roll.die} = <strong>{roll.total}</strong>
      </div>
    </div>
  );
}

/**
 * Three diagonal claw streaks that draw across the target then fade — used
 * when the current skill_use deals damage. Each instance animates once on
 * mount; remount via a new `key` to replay.
 */
function ClawSlash() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    svg.animate(
      [
        { opacity: 0, transform: 'scale(0.7) rotate(-6deg)' },
        { opacity: 1, transform: 'scale(1.05) rotate(0deg)', offset: 0.25 },
        { opacity: 1, transform: 'scale(1.1) rotate(2deg)', offset: 0.6 },
        { opacity: 0, transform: 'scale(1.25) rotate(6deg)' },
      ],
      { duration: 900, fill: 'forwards', easing: 'ease-out' },
    );
    const lines = svg.querySelectorAll('line');
    lines.forEach((line, i) => {
      const length = (line as SVGLineElement).getTotalLength?.() ?? 120;
      (line as SVGLineElement).style.strokeDasharray = String(length);
      (line as SVGLineElement).style.strokeDashoffset = String(length);
      line.animate(
        [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
        { duration: 220, delay: i * 70, fill: 'forwards', easing: 'ease-out' },
      );
    });
  }, []);
  return (
    <svg
      ref={ref}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        inset: -8,
        pointerEvents: 'none',
        opacity: 0,
        filter: 'drop-shadow(0 0 4px rgba(255,80,80,0.7))',
      }}
    >
      <line
        x1="10" y1="20" x2="92" y2="78"
        stroke="#ffeaea" strokeWidth="6" strokeLinecap="round"
      />
      <line
        x1="22" y1="8" x2="100" y2="68"
        stroke="#ffeaea" strokeWidth="6" strokeLinecap="round"
      />
      <line
        x1="0" y1="34" x2="80" y2="96"
        stroke="#ffeaea" strokeWidth="6" strokeLinecap="round"
      />
      <line
        x1="10" y1="20" x2="92" y2="78"
        stroke="#e74c3c" strokeWidth="2.5" strokeLinecap="round"
      />
      <line
        x1="22" y1="8" x2="100" y2="68"
        stroke="#e74c3c" strokeWidth="2.5" strokeLinecap="round"
      />
      <line
        x1="0" y1="34" x2="80" y2="96"
        stroke="#e74c3c" strokeWidth="2.5" strokeLinecap="round"
      />
    </svg>
  );
}

/** Walk the events and return the latest reported HP for the given side. */
function computeHp(events: BattleEvent[], side: 'a' | 'b', baseHp: number): number {
  let hp = baseHp;
  for (const e of events) {
    if (e.kind === 'damage' && e.to === side) hp = e.hpAfter;
    else if (e.kind === 'heal' && e.player === side) hp = e.hpAfter;
  }
  return hp;
}

/** Skill ids that have already been used by the given side up to and including the current step. */
function collectUsedSkillIds(
  log: BattleEvent[],
  stepLogIndices: number[],
  stepIdx: number,
  side: 'a' | 'b',
): Set<string> {
  const set = new Set<string>();
  const limit = Math.min(stepIdx + 1, stepLogIndices.length);
  for (let i = 0; i < limit; i++) {
    const e = log[stepLogIndices[i]!];
    if (e && e.kind === 'skill_use' && e.player === side) set.add(e.skillId);
  }
  return set;
}
