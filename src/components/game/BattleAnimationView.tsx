'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClientGameState, ClientPlayer } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';
import type {
  AttackKind,
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

  // Battle-start HP is the bar's max so "current / max" never shows current > max.
  const aHpStart = match.startHpA || aMon?.stats.hp || 0;
  const bHpStart = match.startHpB || bMon?.stats.hp || 0;
  const aHp = computeHp(appliedEvents, 'a', aHpStart);
  const bHp = computeHp(appliedEvents, 'b', bHpStart);

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

  // Resolve the visual attack kind for the current attacker's skill.
  // 'passthrough' or missing → use the attacker monster's own attackKind.
  const currentAttackKind = ((): Exclude<AttackKind, 'passthrough'> => {
    const attackerMon = currentSide === 'a' ? aMon : currentSide === 'b' ? bMon : null;
    const monKind = attackerMon?.attackKind ?? 'strike';
    if (!currentSkillId || !attackerMon) return monKind;
    const skill = attackerMon.actives.find((a) => a.id === currentSkillId);
    if (!skill) return monKind;
    const e = skill.effect;
    const raw =
      e.kind === 'attack' ? e.attackKind
      : e.kind === 'multi_hit_attack' ? e.attackKind
      : e.kind === 'deja_vu_attack' ? e.attackKind
      : undefined;
    if (!raw || raw === 'passthrough') return monKind;
    return raw;
  })();

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
  const missByA = currentSkillEventRange.some(
    (e) => e.kind === 'miss' && e.to === 'a',
  );
  const missByB = currentSkillEventRange.some(
    (e) => e.kind === 'miss' && e.to === 'b',
  );
  const buffToA = currentSkillEventRange.some(
    (e) => e.kind === 'buff' && e.player === 'a',
  );
  const buffToB = currentSkillEventRange.some(
    (e) => e.kind === 'buff' && e.player === 'b',
  );
  const debuffToA = currentSkillEventRange.some(
    (e) => e.kind === 'debuff' && e.player === 'a',
  );
  const debuffToB = currentSkillEventRange.some(
    (e) => e.kind === 'debuff' && e.player === 'b',
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
          maxHp={aHpStart}
          isCurrent={currentSide === 'a'}
          currentSkillId={currentSide === 'a' ? currentSkillId : null}
          usedSkillIds={usedSkillIdsA}
          slashKey={damageToA ? `a-${stepIdx}` : null}
          missKey={missByA ? `miss-a-${stepIdx}` : null}
          buffKey={buffToA ? `buff-a-${stepIdx}` : null}
          debuffKey={debuffToA ? `debuff-a-${stepIdx}` : null}
          hitKind={currentAttackKind}
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
            maxHp={bHpStart}
            isCurrent={currentSide === 'b'}
            currentSkillId={currentSide === 'b' ? currentSkillId : null}
            usedSkillIds={usedSkillIdsB}
            slashKey={damageToB ? `b-${stepIdx}` : null}
            missKey={missByB ? `miss-b-${stepIdx}` : null}
            buffKey={buffToB ? `buff-b-${stepIdx}` : null}
            debuffKey={debuffToB ? `debuff-b-${stepIdx}` : null}
            hitKind={currentAttackKind}
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
  maxHp,
  isCurrent,
  currentSkillId,
  usedSkillIds,
  slashKey,
  missKey,
  buffKey,
  debuffKey,
  hitKind,
}: {
  player: ClientPlayer | undefined;
  mon: Monster | null;
  hp: number;
  maxHp: number;
  isCurrent: boolean;
  currentSkillId: string | null;
  usedSkillIds: Set<string>;
  /** Non-null + unique key when this side just got hit; triggers a fresh slash animation. */
  slashKey: string | null;
  /** Non-null + unique key when this side just dodged; pops a "MISS!" overlay. */
  missKey: string | null;
  /** Non-null + unique key when this side received a buff this step. */
  buffKey: string | null;
  /** Non-null + unique key when this side received a debuff this step. */
  debuffKey: string | null;
  /** Visual category of the incoming attack. */
  hitKind: Exclude<AttackKind, 'passthrough'>;
}) {
  if (!player || !mon) {
    return (
      <div style={{ minHeight: 200, opacity: 0.5 }}>
        <em>(no monster)</em>
      </div>
    );
  }
  const hpPct = Math.max(0, Math.min(100, Math.round((hp / Math.max(1, maxHp)) * 100)));
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
          {slashKey && <HitEffect key={slashKey} kind={hitKind} />}
          {buffKey && <BuffEffect key={buffKey} />}
          {debuffKey && <DebuffEffect key={debuffKey} />}
          {missKey && <MissBadge key={missKey} />}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {player.name}（{COLOR_LABEL[player.color]}）
        </div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>{mon.name}</div>
      </div>

      {/* HP bar */}
      <div>
        <div style={{ fontSize: 12, marginBottom: 2 }}>
          HP {hp} / {maxHp}
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
        <ul
          style={{
            margin: 0,
            padding: '6px 8px',
            listStyle: 'none',
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
                  <span style={{ opacity: 0.5, fontSize: 11, marginRight: 3 }}>S{a.order}</span>{a.name}
                </li>
              );
            })}
          {mon.actives.length === 0 && (
            <span style={{ fontSize: 12, opacity: 0.5 }}>(なし)</span>
          )}
        </ul>
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

/** "MISS!" overlay popping over the dodging side's avatar. */
function MissBadge() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.animate(
      [
        { opacity: 0, transform: 'translate(-50%, -50%) scale(0.6) rotate(-8deg)' },
        { opacity: 1, transform: 'translate(-50%, -55%) scale(1.15) rotate(-4deg)', offset: 0.3 },
        { opacity: 1, transform: 'translate(-50%, -60%) scale(1.0) rotate(-2deg)', offset: 0.7 },
        { opacity: 0, transform: 'translate(-50%, -70%) scale(0.95) rotate(0deg)' },
      ],
      { duration: 900, fill: 'forwards', easing: 'ease-out' },
    );
  }, []);
  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        opacity: 0,
        pointerEvents: 'none',
        fontWeight: 800,
        fontSize: 22,
        color: '#ffd000',
        textShadow: '0 0 4px #000, 0 0 2px #000, 1px 1px 0 #000',
        letterSpacing: 1,
      }}
    >
      MISS!
    </div>
  );
}

/**
 * Dispatches to the right hit-effect component based on `kind`.
 * Remount via a new `key` to replay.
 */
function HitEffect({ kind }: { kind: Exclude<AttackKind, 'passthrough'> }) {
  switch (kind) {
    case 'strike':  return <StrikeEffect />;
    case 'sword':   return <SwordEffect />;
    case 'claw':    return <ClawEffect />;
    case 'magic':   return <MagicEffect />;
    case 'fire':    return <FireEffect />;
    case 'water':   return <WaterEffect />;
    case 'ice':     return <IceEffect />;
    case 'wind':    return <WindEffect />;
  }
}

/** 打撃: orange/yellow impact burst — concentric rings + starburst lines. */
function StrikeEffect() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    svg.animate(
      [
        { opacity: 0, transform: 'scale(0.5)' },
        { opacity: 1, transform: 'scale(1.1)', offset: 0.2 },
        { opacity: 1, transform: 'scale(1.15)', offset: 0.55 },
        { opacity: 0, transform: 'scale(1.4)' },
      ],
      { duration: 750, fill: 'forwards', easing: 'ease-out' },
    );
  }, []);
  return (
    <svg ref={ref} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', inset: -8, pointerEvents: 'none', opacity: 0,
               filter: 'drop-shadow(0 0 6px rgba(255,160,0,0.9))' }}>
      {/* Starburst lines */}
      {[0,45,90,135].map((deg) => (
        <line key={deg}
          x1={50 + 10 * Math.cos(deg * Math.PI / 180)} y1={50 + 10 * Math.sin(deg * Math.PI / 180)}
          x2={50 + 46 * Math.cos(deg * Math.PI / 180)} y2={50 + 46 * Math.sin(deg * Math.PI / 180)}
          stroke="#ffcc00" strokeWidth="5" strokeLinecap="round" />
      ))}
      {[22.5,67.5,112.5,157.5].map((deg) => (
        <line key={deg}
          x1={50 + 10 * Math.cos(deg * Math.PI / 180)} y1={50 + 10 * Math.sin(deg * Math.PI / 180)}
          x2={50 + 36 * Math.cos(deg * Math.PI / 180)} y2={50 + 36 * Math.sin(deg * Math.PI / 180)}
          stroke="#ff9900" strokeWidth="3.5" strokeLinecap="round" />
      ))}
      {/* Core */}
      <circle cx="50" cy="50" r="12" fill="#fff7aa" stroke="#ffcc00" strokeWidth="3" />
      {/* Outer ring */}
      <circle cx="50" cy="50" r="30" fill="none" stroke="#ff9900" strokeWidth="2.5" strokeDasharray="6 4" />
    </svg>
  );
}

/** 剣攻撃: bright diagonal sword slash — two crossing cuts in blue-white. */
function SwordEffect() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    svg.animate(
      [
        { opacity: 0, transform: 'scale(0.8) rotate(-4deg)' },
        { opacity: 1, transform: 'scale(1.05) rotate(0deg)', offset: 0.2 },
        { opacity: 1, transform: 'scale(1.08) rotate(1deg)', offset: 0.6 },
        { opacity: 0, transform: 'scale(1.2) rotate(3deg)' },
      ],
      { duration: 700, fill: 'forwards', easing: 'ease-out' },
    );
    svg.querySelectorAll('line').forEach((line, i) => {
      const length = 140;
      (line as SVGLineElement).style.strokeDasharray = String(length);
      (line as SVGLineElement).style.strokeDashoffset = String(length);
      line.animate(
        [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
        { duration: 180, delay: i * 50, fill: 'forwards', easing: 'ease-out' },
      );
    });
  }, []);
  return (
    <svg ref={ref} viewBox="0 0 100 100" preserveAspectRatio="none"
      style={{ position: 'absolute', inset: -8, pointerEvents: 'none', opacity: 0,
               filter: 'drop-shadow(0 0 5px rgba(100,200,255,0.9))' }}>
      {/* White glow core */}
      <line x1="5" y1="10" x2="95" y2="90" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" />
      <line x1="5" y1="10" x2="95" y2="90" stroke="#88ddff" strokeWidth="3" strokeLinecap="round" />
      {/* Second slash */}
      <line x1="20" y1="2"  x2="100" y2="80" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
      <line x1="20" y1="2"  x2="100" y2="80" stroke="#aaeeff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** 爪: three diagonal red claw streaks — the original ClawSlash. */
function ClawEffect() {
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
    svg.querySelectorAll('line').forEach((line, i) => {
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
    <svg ref={ref} viewBox="0 0 100 100" preserveAspectRatio="none"
      style={{ position: 'absolute', inset: -8, pointerEvents: 'none', opacity: 0,
               filter: 'drop-shadow(0 0 4px rgba(255,80,80,0.7))' }}>
      <line x1="10" y1="20" x2="92" y2="78" stroke="#ffeaea" strokeWidth="6" strokeLinecap="round" />
      <line x1="22" y1="8"  x2="100" y2="68" stroke="#ffeaea" strokeWidth="6" strokeLinecap="round" />
      <line x1="0"  y1="34" x2="80"  y2="96" stroke="#ffeaea" strokeWidth="6" strokeLinecap="round" />
      <line x1="10" y1="20" x2="92"  y2="78" stroke="#e74c3c" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="22" y1="8"  x2="100" y2="68" stroke="#e74c3c" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="0"  y1="34" x2="80"  y2="96" stroke="#e74c3c" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** 魔法: purple/blue sparkles — glowing orbs that burst outward. */
/** 炎魔法：炎が下から吹き上がり広がる。 */
function FireEffect() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    svg.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }],
      { duration: 950, fill: 'forwards' },
    );
    // 各炎舌をランダムなタイミングで上昇させる
    const flames = svg.querySelectorAll<SVGElement>('.flame');
    flames.forEach((el, i) => {
      el.animate(
        [
          { transform: 'translateY(0px) scaleX(1)',   opacity: 0.9 },
          { transform: `translateY(-${14 + i * 4}px) scaleX(${0.6 + i * 0.1})`, opacity: 1,   offset: 0.4 },
          { transform: `translateY(-${22 + i * 6}px) scaleX(${0.3 + i * 0.05})`, opacity: 0 },
        ],
        { duration: 700 + i * 80, delay: i * 60, fill: 'forwards', easing: 'ease-out' },
      );
    });
  }, []);
  // 炎舌: [cx, baseY, rx, ry, color]
  const tongues: [number, number, number, number, string][] = [
    [50, 72, 10, 20, '#ff4400'],
    [38, 76, 7,  15, '#ff6600'],
    [62, 76, 7,  15, '#ff6600'],
    [50, 68, 6,  24, '#ffaa00'],
    [44, 74, 4,  12, '#ffcc00'],
    [56, 74, 4,  12, '#ffcc00'],
  ];
  return (
    <svg ref={ref} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', inset: -8, pointerEvents: 'none', opacity: 0,
               filter: 'drop-shadow(0 0 10px rgba(255,80,0,0.95))' }}>
      {tongues.map(([cx, cy, rx, ry, fill], i) => (
        <ellipse key={i} className="flame" cx={cx} cy={cy} rx={rx} ry={ry}
          fill={fill} opacity={0.92} style={{ transformOrigin: `${cx}px ${cy}px` }} />
      ))}
      {/* 爆心 */}
      <circle cx="50" cy="76" r="9" fill="#fff0aa" opacity={0.95} />
    </svg>
  );
}

/** 水魔法：中心から波紋が広がり水滴が飛び散る。 */
function WaterEffect() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    svg.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }],
      { duration: 900, fill: 'forwards' },
    );
    // 波紋リング
    svg.querySelectorAll<SVGElement>('.ripple').forEach((el, i) => {
      el.animate(
        [
          { r: '4', opacity: 0.9, strokeWidth: '3' },
          { r: `${22 + i * 14}`, opacity: 0, strokeWidth: '0.5' },
        ],
        { duration: 750, delay: i * 140, fill: 'forwards', easing: 'ease-out' },
      );
    });
    // 水滴
    svg.querySelectorAll<SVGElement>('.drop').forEach((el, i) => {
      const angle = (i / 6) * Math.PI * 2;
      const dx = Math.cos(angle) * 30;
      const dy = Math.sin(angle) * 30;
      el.animate(
        [
          { transform: 'translate(0,0)', opacity: 1 },
          { transform: `translate(${dx}px,${dy}px)`, opacity: 0 },
        ],
        { duration: 600, delay: 80, fill: 'forwards', easing: 'ease-out' },
      );
    });
  }, []);
  return (
    <svg ref={ref} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', inset: -8, pointerEvents: 'none', opacity: 0,
               filter: 'drop-shadow(0 0 8px rgba(0,140,255,0.9))' }}>
      {[0, 1, 2].map((i) => (
        <circle key={i} className="ripple" cx="50" cy="50" r="4"
          fill="none" stroke={i === 0 ? '#aaddff' : i === 1 ? '#55aaff' : '#0077cc'} strokeWidth="3" />
      ))}
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <ellipse key={i} className="drop"
            cx={50 + Math.cos(a) * 6} cy={50 + Math.sin(a) * 6}
            rx="3" ry="5"
            fill="#66ccff" opacity={0.9}
            style={{ transformOrigin: '50px 50px' }} />
        );
      })}
      <circle cx="50" cy="50" r="7" fill="#ffffff" opacity={0.95} />
    </svg>
  );
}

/** 氷魔法：中心から結晶の欠片が放射状に飛び出す。 */
function IceEffect() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    svg.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.65 }, { opacity: 0 }],
      { duration: 850, fill: 'forwards' },
    );
    svg.querySelectorAll<SVGElement>('.shard').forEach((el, i) => {
      const angle = (i / 8) * Math.PI * 2;
      const dist = 30 + (i % 2) * 8;
      el.animate(
        [
          { transform: 'translate(0,0) scale(0.2)', opacity: 1 },
          { transform: `translate(${Math.cos(angle) * dist}px,${Math.sin(angle) * dist}px) scale(1)`, opacity: 0.9, offset: 0.5 },
          { transform: `translate(${Math.cos(angle) * dist * 1.3}px,${Math.sin(angle) * dist * 1.3}px) scale(0.6)`, opacity: 0 },
        ],
        { duration: 650, delay: i * 30, fill: 'forwards', easing: 'ease-out' },
      );
    });
  }, []);
  const shardColor = (i: number) => i % 3 === 0 ? '#ddfaff' : i % 3 === 1 ? '#88eeff' : '#aaddff';
  return (
    <svg ref={ref} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', inset: -8, pointerEvents: 'none', opacity: 0,
               filter: 'drop-shadow(0 0 10px rgba(120,230,255,0.95))' }}>
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const len = 10 + (i % 2) * 4;
        const px = 50 + Math.cos(angle) * 5;
        const py = 50 + Math.sin(angle) * 5;
        return (
          <polygon key={i} className="shard"
            points={`${px},${py - len} ${px + len * 0.3},${py} ${px},${py + len * 0.4} ${px - len * 0.3},${py}`}
            fill={shardColor(i)}
            style={{ transformOrigin: '50px 50px' }} />
        );
      })}
      <circle cx="50" cy="50" r="6" fill="#ffffff" opacity={0.98} />
    </svg>
  );
}

/** 風魔法：弧を描く旋風が中心から広がる。 */
function WindEffect() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    svg.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }],
      { duration: 900, fill: 'forwards' },
    );
    svg.querySelectorAll<SVGElement>('.arc').forEach((el, i) => {
      const len = (el as SVGPathElement).getTotalLength?.() ?? 100;
      (el as SVGPathElement).style.strokeDasharray = String(len);
      (el as SVGPathElement).style.strokeDashoffset = String(len);
      el.animate(
        [{ strokeDashoffset: len, opacity: 0.9 }, { strokeDashoffset: 0, opacity: 1 }],
        { duration: 350, delay: i * 100, fill: 'forwards', easing: 'ease-out' },
      );
      el.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: 300, delay: 350 + i * 100 + 200, fill: 'forwards' },
      );
    });
    svg.animate(
      [
        { transform: 'rotate(0deg)',  opacity: 0 },
        { transform: 'rotate(0deg)',  opacity: 1,  offset: 0.08 },
        { transform: 'rotate(30deg)', opacity: 1,  offset: 0.7 },
        { transform: 'rotate(45deg)', opacity: 0 },
      ],
      { duration: 900, fill: 'forwards', easing: 'ease-out' },
    );
  }, []);
  return (
    <svg ref={ref} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', inset: -8, pointerEvents: 'none', opacity: 0,
               filter: 'drop-shadow(0 0 8px rgba(100,220,60,0.9))',
               transformOrigin: 'center' }}>
      {/* 3本の旋風弧 */}
      <path className="arc" d="M50,50 Q70,20 90,40" fill="none" stroke="#88dd44" strokeWidth="4" strokeLinecap="round" />
      <path className="arc" d="M50,50 Q20,30 15,60" fill="none" stroke="#aaee66" strokeWidth="4" strokeLinecap="round" />
      <path className="arc" d="M50,50 Q65,75 40,88" fill="none" stroke="#66cc33" strokeWidth="4" strokeLinecap="round" />
      {/* 細めの補助弧 */}
      <path className="arc" d="M50,50 Q76,30 92,56" fill="none" stroke="#ccee88" strokeWidth="2" strokeLinecap="round" />
      <path className="arc" d="M50,50 Q22,22 10,50" fill="none" stroke="#ccee88" strokeWidth="2" strokeLinecap="round" />
      <path className="arc" d="M50,50 Q58,80 34,92" fill="none" stroke="#ccee88" strokeWidth="2" strokeLinecap="round" />
      <circle cx="50" cy="50" r="6" fill="#eeffcc" opacity={0.95} />
    </svg>
  );
}

/** バフ：金色の星とスパークが下から上へ上昇する。 */
function BuffEffect() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    svg.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }],
      { duration: 900, fill: 'forwards' },
    );
    svg.querySelectorAll<SVGElement>('.spark').forEach((el, i) => {
      const startX = 30 + (i % 5) * 10;
      const rise = 25 + (i % 3) * 8;
      el.animate(
        [
          { transform: `translate(${startX - 50}px, 20px) scale(0.5)`, opacity: 0 },
          { transform: `translate(${startX - 50 + (i % 2 === 0 ? 5 : -5)}px, ${-rise}px) scale(1)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${startX - 50 + (i % 2 === 0 ? 8 : -8)}px, ${-rise - 10}px) scale(0.3)`, opacity: 0 },
        ],
        { duration: 600 + i * 50, delay: i * 60, fill: 'forwards', easing: 'ease-out' },
      );
    });
  }, []);
  const stars = [
    [50, 60], [38, 70], [62, 68], [45, 80], [55, 75], [42, 58], [58, 62], [50, 85],
  ];
  return (
    <svg ref={ref} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', inset: -8, pointerEvents: 'none', opacity: 0,
               filter: 'drop-shadow(0 0 6px rgba(255,210,0,0.95))' }}>
      {stars.map(([cx, cy], i) => (
        <polygon key={i} className="spark"
          points={`${cx},${cy! - 6} ${cx! + 2},${cy! - 2} ${cx! + 6},${cy! - 2} ${cx! + 3},${cy! + 1} ${cx! + 4},${cy! + 6} ${cx},${cy! + 3} ${cx! - 4},${cy! + 6} ${cx! - 3},${cy! + 1} ${cx! - 6},${cy! - 2} ${cx! - 2},${cy! - 2}`}
          fill={i % 2 === 0 ? '#ffd700' : '#fffaaa'}
          style={{ transformOrigin: '50px 70px' }} />
      ))}
    </svg>
  );
}

/** デバフ：紫の暗いもやが上から降りてくる。 */
function DebuffEffect() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    svg.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }],
      { duration: 850, fill: 'forwards' },
    );
    svg.querySelectorAll<SVGElement>('.wisp').forEach((el, i) => {
      const startX = 28 + (i % 5) * 11;
      const drop = 22 + (i % 3) * 7;
      el.animate(
        [
          { transform: `translate(${startX - 50}px, -30px) scale(0.4)`, opacity: 0 },
          { transform: `translate(${startX - 50 + (i % 2 === 0 ? 4 : -4)}px, ${drop - 30}px) scale(1)`, opacity: 0.85, offset: 0.5 },
          { transform: `translate(${startX - 50 + (i % 2 === 0 ? 7 : -7)}px, ${drop}px) scale(0.2)`, opacity: 0 },
        ],
        { duration: 650 + i * 40, delay: i * 55, fill: 'forwards', easing: 'ease-in' },
      );
    });
  }, []);
  const wisps = [
    [50, 25], [38, 20], [62, 22], [44, 30], [56, 18], [48, 35], [52, 12], [40, 28],
  ];
  return (
    <svg ref={ref} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', inset: -8, pointerEvents: 'none', opacity: 0,
               filter: 'drop-shadow(0 0 8px rgba(120,0,180,0.9))' }}>
      {wisps.map(([cx, cy], i) => (
        <ellipse key={i} className="wisp"
          cx={cx} cy={cy} rx={5 + (i % 3)} ry={8 + (i % 2) * 3}
          fill={i % 3 === 0 ? '#8800cc' : i % 3 === 1 ? '#aa44dd' : '#660099'}
          opacity={0.8}
          style={{ transformOrigin: '50px 25px' }} />
      ))}
    </svg>
  );
}

function MagicEffect() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    svg.animate(
      [
        { opacity: 0, transform: 'scale(0.6)' },
        { opacity: 1, transform: 'scale(1.1)', offset: 0.25 },
        { opacity: 1, transform: 'scale(1.15)', offset: 0.6 },
        { opacity: 0, transform: 'scale(1.5)' },
      ],
      { duration: 900, fill: 'forwards', easing: 'ease-out' },
    );
  }, []);
  const orbs: [number, number, number, string][] = [
    [50, 18, 9,  '#cc88ff'],
    [78, 38, 7,  '#aa55ee'],
    [68, 72, 8,  '#bb66ff'],
    [30, 68, 7,  '#9944dd'],
    [22, 36, 6,  '#cc99ff'],
    [50, 50, 13, '#ffffff'],
  ];
  return (
    <svg ref={ref} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', inset: -8, pointerEvents: 'none', opacity: 0,
               filter: 'drop-shadow(0 0 8px rgba(160,80,255,0.9))' }}>
      {orbs.map(([cx, cy, r, fill], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill={fill} opacity={i === 5 ? 0.9 : 0.85} />
      ))}
      {/* Connecting sparkle lines */}
      <line x1="50" y1="18" x2="50" y2="50" stroke="#cc88ff" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="78" y1="38" x2="50" y2="50" stroke="#aa55ee" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="68" y1="72" x2="50" y2="50" stroke="#bb66ff" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="30" y1="68" x2="50" y2="50" stroke="#9944dd" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="22" y1="36" x2="50" y2="50" stroke="#cc99ff" strokeWidth="1.5" strokeDasharray="3 3" />
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
