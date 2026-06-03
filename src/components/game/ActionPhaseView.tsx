'use client';
import { useEffect, useState } from 'react';
import type { ClientGameState } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';
import type { StatKey } from '../../server/engine/types';
import { COLOR_LABEL, pieceStyle } from '../../lib/colors';
import { describeActionEffect } from '../../lib/card-text';

const DEFAULT_CHOICE_STATS: StatKey[] = ['hp', 'atk', 'def', 'spd'];

export function ActionPhaseView({
  state,
  socket,
}: {
  state: ClientGameState;
  socket: GameSocket;
}) {
  const selfId = socket.playerId;
  const phase = state.actionPhase;
  const summary = state.actionPhaseSummary;
  const myHand = state.myActionHand ?? [];
  const uniqueCard = state.myUniqueActionCard ?? null;
  const iAmPending = !!phase && !!selfId && phase.pendingPlayerIds.includes(selfId);
  const myCommitted = phase && selfId ? phase.submittedPlays[selfId] : undefined;
  const submittedCount = phase ? Object.keys(phase.submittedPlays).length : 0;
  const totalPending = phase ? phase.pendingPlayerIds.length : 0;

  // Local tentative selection before pressing 決定.
  const [tentative, setTentative] = useState<string | null>(null);
  const [tentativeStat, setTentativeStat] = useState<StatKey | null>(null);
  const [swapTarget, setSwapTarget] = useState<string | null>(null);
  const [swapSkills, setSwapSkills] = useState<string[]>([]);
  const [curseTarget, setCurseTarget] = useState<string | null>(null);
  const [mutateSkillId, setMutateSkillId] = useState<string | null>(null);
  const [replayGraveCardId, setReplayGraveCardId] = useState<string | null>(null);
  const [replayChosenStat, setReplayChosenStat] = useState<StatKey | null>(null);
  useEffect(() => {
    setTentative(null);
    setTentativeStat(null);
    setSwapTarget(null);
    setSwapSkills([]);
    setCurseTarget(null);
    setMutateSkillId(null);
    setReplayGraveCardId(null);
    setReplayChosenStat(null);
  }, [!!myCommitted, iAmPending, !!phase]);
  // Reset all extras whenever the picked card changes.
  useEffect(() => {
    setTentativeStat(null);
    setSwapTarget(null);
    setSwapSkills([]);
    setCurseTarget(null);
    setMutateSkillId(null);
    setReplayGraveCardId(null);
    setReplayChosenStat(null);
  }, [tentative]);
  // Reset skill picks if target changes.
  useEffect(() => {
    setSwapSkills([]);
  }, [swapTarget]);

  const tentativeCard = tentative
    ? (myHand.find((c) => c.id === tentative) ?? (uniqueCard?.id === tentative ? uniqueCard : undefined))
    : undefined;
  const isChoiceCard = tentativeCard?.effect.kind === 'stat_mod_choice' || tentativeCard?.effect.kind === 'discard_actives_gain_stat';
  const isSwapCard = tentativeCard?.effect.kind === 'swap_actives';
  const isCurseCard = tentativeCard?.effect.kind === 'curse_player';
  const isMutateCard = tentativeCard?.effect.kind === 'mutate_skill';
  const isReplayCard = tentativeCard?.effect.kind === 'replay_from_grave';
  const REPLAY_EXCLUDED = new Set(['replay_from_grave', 'swap_actives', 'curse_player', 'draw_passive_top', 'mutate_skill']);
  const replayableGrave = (state.publicDecks?.actionGrave ?? []).filter((c) => !REPLAY_EXCLUDED.has(c.effect.kind));
  const selectedGraveCard = replayGraveCardId ? replayableGrave.find((c) => c.id === replayGraveCardId) : undefined;
  const replayNeedsStat = selectedGraveCard?.effect.kind === 'stat_mod_choice' || selectedGraveCard?.effect.kind === 'discard_actives_gain_stat';
  const swapTargetPlayer = swapTarget
    ? state.players.find((p) => p.id === swapTarget)
    : null;
  const canConfirm =
    !!tentative &&
    (!isChoiceCard || !!tentativeStat) &&
    (!isSwapCard || (!!swapTarget && swapSkills.length === 2)) &&
    (!isCurseCard || !!curseTarget) &&
    (!isMutateCard || !!mutateSkillId) &&
    (!isReplayCard || (!!replayGraveCardId && (!replayNeedsStat || !!replayChosenStat)));

  const toggleSwapSkill = (skillId: string): void => {
    setSwapSkills((prev) => {
      if (prev.includes(skillId)) return prev.filter((s) => s !== skillId);
      if (prev.length >= 2) return [prev[1]!, skillId];
      return [...prev, skillId];
    });
  };

  // Selection mode: action phase is active and accepting plays.
  if (phase) {
    const confirm = (): void => {
      if (!tentative) return;
      if (isChoiceCard && !tentativeStat) return;
      if (isSwapCard && (!swapTarget || swapSkills.length !== 2)) return;
      socket.send({
        type: 'play_action_card',
        cardId: tentative,
        chosenStat: isChoiceCard ? tentativeStat ?? undefined : undefined,
        swap:
          isSwapCard && swapTarget && swapSkills.length === 2
            ? {
                targetPlayerId: swapTarget,
                skillIdA: swapSkills[0]!,
                skillIdB: swapSkills[1]!,
              }
            : undefined,
        curseTargetPlayerId: isCurseCard ? curseTarget ?? undefined : undefined,
        mutateSkillId: isMutateCard ? mutateSkillId ?? undefined : undefined,
        replayGraveCardId: isReplayCard ? replayGraveCardId ?? undefined : undefined,
        replayChosenStat: isReplayCard && replayNeedsStat ? replayChosenStat ?? undefined : undefined,
      });
    };

    return (
      <section style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>アクションフェーズ</h2>
        <p style={{ margin: 0, opacity: 0.85 }}>
          {iAmPending && !myCommitted
            ? '👉 手札から1枚を選んで「確定」を押してください。'
            : myCommitted
              ? `決定済み — 待機中… (${submittedCount}/${totalPending})`
              : `(${submittedCount}/${totalPending}) 待機中…`}
        </p>

        <PlayerLegend state={state} selfId={selfId ?? null} phase={phase} />

        {iAmPending && !myCommitted && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={confirm} disabled={!canConfirm}>
                確定 {tentative ? `(${tentativeCard?.name})` : ''}
                {isChoiceCard && tentativeStat ? ` → ${tentativeStat.toUpperCase()}` : ''}
              </button>
              <button onClick={() => setTentative(null)} disabled={!tentative} type="button">
                取消
              </button>
            </div>
            {isChoiceCard && (
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  padding: 8,
                  background: '#fff8e1',
                  border: '1px solid #d4a000',
                  borderRadius: 6,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  どのステータスを上げる？
                </span>
                {(tentativeCard?.effect.kind === 'stat_mod_choice' || tentativeCard?.effect.kind === 'discard_actives_gain_stat' ? ((tentativeCard.effect as { stats?: StatKey[] }).stats ?? DEFAULT_CHOICE_STATS) : DEFAULT_CHOICE_STATS).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTentativeStat(s)}
                    style={{
                      padding: '4px 10px',
                      border: `2px solid ${tentativeStat === s ? '#0066cc' : '#aaa'}`,
                      borderRadius: 4,
                      background: tentativeStat === s ? '#eef5ff' : '#fff',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
            {isSwapCard && (
              <div
                style={{
                  padding: 8,
                  background: '#fff8e1',
                  border: '1px solid #d4a000',
                  borderRadius: 6,
                  display: 'grid',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>誰のスキルを入れ替える？</span>
                  {state.players
                    .filter((p) => p.monster && p.monster.actives.length >= 2)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSwapTarget(p.id)}
                        style={{
                          padding: '4px 10px',
                          border: `2px solid ${swapTarget === p.id ? '#0066cc' : '#aaa'}`,
                          borderRadius: 4,
                          background: swapTarget === p.id ? '#eef5ff' : '#fff',
                          cursor: 'pointer',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span style={pieceStyle(p.color, { size: 12 })} />
                        {p.name}
                        {p.id === selfId ? ' (自分)' : ''}
                      </button>
                    ))}
                </div>
                {swapTargetPlayer?.monster && (
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>
                      入れ替えるアクティブスキルを2つ選ぶ ({swapSkills.length}/2)
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {swapTargetPlayer.monster.actives
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((a) => {
                          const picked = swapSkills.includes(a.id);
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => toggleSwapSkill(a.id)}
                              style={{
                                padding: '4px 8px',
                                border: `2px solid ${picked ? '#0066cc' : '#aaa'}`,
                                borderRadius: 4,
                                background: picked ? '#eef5ff' : '#fff',
                                cursor: 'pointer',
                                fontSize: 12,
                              }}
                            >
                              スロット{a.order} {a.name}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
            {isCurseCard && (
              <div
                style={{
                  padding: 8,
                  background: '#fff0f0',
                  border: '1px solid #cc0000',
                  borderRadius: 6,
                  display: 'grid',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>呪い対象を選ぶ</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {state.players.filter((p) => p.monster && p.id !== selfId).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setCurseTarget(p.id)}
                      style={{
                        padding: '4px 10px',
                        border: `2px solid ${curseTarget === p.id ? '#cc0000' : '#aaa'}`,
                        borderRadius: 4,
                        background: curseTarget === p.id ? '#fff0f0' : '#fff',
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span style={pieceStyle(p.color, { size: 12 })} />
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {isReplayCard && (
              <div style={{ padding: 8, background: '#fff0f8', border: '1px solid #cc44aa', borderRadius: 6, display: 'grid', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>アクション墓地から1枚選ぶ</span>
                {replayableGrave.length === 0 ? (
                  <span style={{ fontSize: 12, opacity: 0.7 }}>（墓地にカードなし）</span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {replayableGrave.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setReplayGraveCardId(c.id); setReplayChosenStat(null); }}
                        style={{
                          padding: '4px 8px',
                          border: `2px solid ${replayGraveCardId === c.id ? '#cc44aa' : '#aaa'}`,
                          borderRadius: 4,
                          background: replayGraveCardId === c.id ? '#fff0f8' : '#fff',
                          cursor: 'pointer',
                          fontSize: 12,
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        <div style={{ opacity: 0.75 }}>{describeActionEffect(c)}</div>
                      </button>
                    ))}
                  </div>
                )}
                {replayNeedsStat && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>どのステータスを選ぶ？</span>
                    {(['atk', 'def', 'spd'] as StatKey[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setReplayChosenStat(s)}
                        style={{
                          padding: '4px 10px',
                          border: `2px solid ${replayChosenStat === s ? '#cc44aa' : '#aaa'}`,
                          borderRadius: 4,
                          background: replayChosenStat === s ? '#fff0f8' : '#fff',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        {s.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {isMutateCard && (() => {
              const self = state.players.find((p) => p.id === selfId);
              const actives = self?.monster?.actives.slice().sort((a, b) => a.order - b.order) ?? [];
              return (
                <div
                  style={{
                    padding: 8,
                    background: '#f0fff4',
                    border: '1px solid #00aa44',
                    borderRadius: 6,
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>変異させるスキルを1つ選ぶ</span>
                  {actives.length === 0 ? (
                    <span style={{ fontSize: 12, opacity: 0.7 }}>（盛っているスキルなし）</span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {actives.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setMutateSkillId(a.id)}
                          style={{
                            padding: '4px 8px',
                            border: `2px solid ${mutateSkillId === a.id ? '#00aa44' : '#aaa'}`,
                            borderRadius: 4,
                            background: mutateSkillId === a.id ? '#e6ffed' : '#fff',
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          スロット{a.order} {a.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 8,
              }}
            >
              {myHand.map((card) => {
                const selected = tentative === card.id;
                return (
                  <button
                    key={card.id}
                    onClick={() => setTentative(card.id)}
                    style={{
                      border: `3px solid ${selected ? '#0066cc' : '#ccc'}`,
                      borderRadius: 8,
                      padding: 10,
                      background: selected ? '#eef5ff' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'grid',
                      gap: 4,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{card.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>
                      {describeActionEffect(card)}
                    </div>
                  </button>
                );
              })}
              {myHand.length === 0 && (
                <p style={{ opacity: 0.7 }}>(手札なし)</p>
              )}
            </div>

            {uniqueCard && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 4 }}>
                  ★ 固有アクションカード（何度でも使える）
                </div>
                <button
                  onClick={() => setTentative(uniqueCard.id)}
                  style={{
                    border: `3px solid ${tentative === uniqueCard.id ? '#cc8800' : '#f0a000'}`,
                    borderRadius: 8,
                    padding: 10,
                    background: tentative === uniqueCard.id ? '#fff8e1' : '#fffbf0',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'grid',
                    gap: 4,
                    width: '100%',
                    maxWidth: 300,
                  }}
                >
                  <div style={{ fontSize: 11, color: '#cc8800', fontWeight: 700 }}>固有</div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{uniqueCard.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    {describeActionEffect(uniqueCard)}
                  </div>
                </button>
              </div>
            )}
          </>
        )}
      </section>
    );
  }

  // Summary mode (post-resolve hold): show what every player played.
  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>アクションフェーズ</h2>
      <p style={{ margin: 0, opacity: 0.75, fontSize: 13 }}>
        各プレイヤーが手札から1枚を選んで発動しました。
      </p>

      {!summary || summary.plays.length === 0 ? (
        <p style={{ opacity: 0.7 }}>(該当するアクションなし)</p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 8,
          }}
        >
          {summary.plays.map((play) => {
            const p = state.players.find((pp) => pp.id === play.playerId);
            const isSelf = play.playerId === selfId;
            return (
              <li
                key={`${play.playerId}-${play.cardId}`}
                style={{
                  border: `1px solid ${isSelf ? '#0066cc' : '#bbb'}`,
                  borderRadius: 8,
                  padding: 10,
                  background: isSelf ? '#f0f8ff' : '#fff',
                  display: 'grid',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {p && <span style={pieceStyle(p.color, { size: 14 })} />}
                  <strong style={{ fontSize: 13 }}>
                    {p?.name ?? play.playerId.slice(0, 6)}
                    {isSelf ? ' (you)' : ''}
                  </strong>
                  {p && (
                    <span style={{ fontSize: 11, opacity: 0.7 }}>
                      （{COLOR_LABEL[p.color]}）
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{play.cardName}</span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>{play.effectDesc}</div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PlayerLegend({
  state,
  selfId,
  phase,
}: {
  state: ClientGameState;
  selfId: string | null;
  phase: NonNullable<ClientGameState['actionPhase']>;
}) {
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
        const submitted = !!phase.submittedPlays[p.id];
        const pending = phase.pendingPlayerIds.includes(p.id);
        const status = submitted ? '決定' : pending ? '選択中' : '待機';
        const bg = submitted ? '#0066cc' : pending ? '#fff' : '#eee';
        const fg = submitted ? '#fff' : '#333';
        return (
          <span
            key={p.id}
            className={pending && !submitted ? 'badge-pending' : undefined}
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
            <span style={pieceStyle(p.color, { size: 14 })} />
            <strong>{p.name}</strong>
            {isSelf && <span>(you)</span>}
            {p.isCPU && <span>🤖</span>}
            {submitted && <span>· ●</span>}
          </span>
        );
      })}
    </div>
  );
}
