'use client';
import { useEffect, useMemo, useState } from 'react';
import type { ClientGameState, ClientPlayer } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';
import type {
  BattleEvent,
  BattleMatch,
  Monster,
} from '../../server/engine/types';
import { COLOR_HEX, COLOR_LABEL, pieceStyle } from '../../lib/colors';

const STEP_MS = 2000;

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

  useEffect(() => {
    setStepIdx(0);
  }, [match.a, match.b]);

  useEffect(() => {
    if (stepIdx >= stepLogIndices.length) return;
    const t = setTimeout(() => setStepIdx((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [stepIdx, stepLogIndices.length]);

  const aPlayer = state.players.find((p) => p.id === match.a);
  const bPlayer = state.players.find((p) => p.id === match.b);
  const aMon = aPlayer?.monster ?? null;
  const bMon = bPlayer?.monster ?? null;

  const isBye = match.a === match.b;

  // Range of log events that have been "applied" up to and including the
  // current skill's effects (everything until the NEXT skill_use, exclusive).
  const upToLogIdx =
    stepIdx + 1 < stepLogIndices.length
      ? stepLogIndices[stepIdx + 1]!
      : match.log.length;
  const appliedEvents = match.log.slice(0, upToLogIdx);

  const aHpBase = aMon?.stats.hp ?? 0;
  const bHpBase = bMon?.stats.hp ?? 0;
  const aHp = computeHp(appliedEvents, 'a', aHpBase);
  const bHp = computeHp(appliedEvents, 'b', bHpBase);

  const currentEvent =
    stepIdx < stepLogIndices.length ? match.log[stepLogIndices[stepIdx]!] : null;
  const currentSide =
    currentEvent && currentEvent.kind === 'skill_use' ? currentEvent.player : null;
  const currentSkillId =
    currentEvent && currentEvent.kind === 'skill_use' ? currentEvent.skillId : null;

  const usedSkillIdsA = collectUsedSkillIds(match.log, stepLogIndices, stepIdx, 'a');
  const usedSkillIdsB = collectUsedSkillIds(match.log, stepLogIndices, stepIdx, 'b');

  const battleDone = stepIdx >= stepLogIndices.length;
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
        {battleDone
          ? verdict
            ? `決着: ${verdict}`
            : '決着'
          : `行動 ${stepIdx + 1} / ${stepLogIndices.length}`}
      </p>

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
}: {
  player: ClientPlayer | undefined;
  mon: Monster | null;
  hp: number;
  isCurrent: boolean;
  currentSkillId: string | null;
  usedSkillIds: Set<string>;
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

  return (
    <div
      style={{
        display: 'grid',
        gap: 8,
        padding: 8,
        border: isCurrent ? `2px solid ${colorHex}` : '2px solid transparent',
        borderRadius: 8,
        transition: 'border-color 200ms',
      }}
    >
      {/* Avatar */}
      <div style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
        <span style={pieceStyle(player.color, { size: 80 })} />
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
