'use client';
import { useState, useEffect } from 'react';
import type { ClientGameState } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';
import type { SkillCard } from '../../server/engine/types';
import { describeSkillCard } from '../../lib/skill-text';

const RARITY_COLOR: Record<string, string> = {
  N: '#888',
  R: '#3a78ff',
  SR: '#a050ff',
  SSR: '#ffa033',
};

const TOTAL_SLOTS = 9;

export function BuildPhaseView({
  state,
  socket,
}: {
  state: ClientGameState;
  socket: GameSocket;
}) {
  const myId = socket.playerId;
  const buildPhase = state.buildPhase;
  const iAmPending = !!myId && !!buildPhase && buildPhase.pendingPlayerIds.includes(myId);
  const submitted = !!myId && !!buildPhase && !buildPhase.pendingPlayerIds.includes(myId);

  // Local slot state: 9-element array of SkillCard | null
  const [slots, setSlots] = useState<(SkillCard | null)[]>(() =>
    (state.mySkillSlots ?? Array(TOTAL_SLOTS).fill(null)).slice(0, TOTAL_SLOTS),
  );
  const [activeSlotCount, setActiveSlotCount] = useState<number>(
    state.myActiveSlotCount ?? TOTAL_SLOTS,
  );

  // Reset local state when build phase starts fresh or player changes
  useEffect(() => {
    setSlots((state.mySkillSlots ?? Array(TOTAL_SLOTS).fill(null)).slice(0, TOTAL_SLOTS));
    setActiveSlotCount(state.myActiveSlotCount ?? TOTAL_SLOTS);
  }, [state.buildPhase !== null]);

  // Derive stock: cards not currently in any slot
  const slottedIds = new Set(slots.filter(Boolean).map((c) => c!.id));
  const stock: SkillCard[] = (state.mySkillStock ?? []).filter((c) => !slottedIds.has(c.id));

  // Also include cards that were in mySkillSlots initially but moved to stock in local state
  const originalSlots = state.mySkillSlots ?? [];
  const originalInSlots = originalSlots.filter((c): c is SkillCard => c !== null && !slottedIds.has(c.id));
  const allStock = [...stock, ...originalInSlots];

  const removeFromSlot = (idx: number): void => {
    if (!iAmPending || submitted) return;
    const next = slots.slice();
    next[idx] = null;
    setSlots(next);
  };

  const addToSlot = (card: SkillCard): void => {
    if (!iAmPending || submitted) return;
    // Find first null slot within activeSlotCount
    const targetIdx = slots.findIndex((s, i) => s === null && i < activeSlotCount);
    if (targetIdx < 0) return;
    const next = slots.slice();
    next[targetIdx] = card;
    setSlots(next);
  };

  const moveSlot = (fromIdx: number, toIdx: number): void => {
    if (!iAmPending || submitted) return;
    if (toIdx < 0 || toIdx >= TOTAL_SLOTS) return;
    const next = slots.slice();
    [next[fromIdx], next[toIdx]] = [next[toIdx]!, next[fromIdx]!];
    setSlots(next);
  };

  const changeActiveCount = (delta: number): void => {
    const next = Math.max(0, Math.min(TOTAL_SLOTS, activeSlotCount + delta));
    setActiveSlotCount(next);
    // Clear slots beyond the new active count
    if (delta < 0) {
      setSlots((prev) => {
        const updated = prev.slice();
        for (let i = next; i < TOTAL_SLOTS; i++) {
          updated[i] = null;
        }
        return updated;
      });
    }
  };

  const handleSubmit = (): void => {
    if (!iAmPending || submitted) return;
    socket.send({
      type: 'submit_build',
      slots: slots.map((c) => c?.id ?? null),
      activeSlotCount,
    });
  };

  if (!buildPhase) return <p>ビルドフェーズ準備中...</p>;

  const pendingCount = buildPhase.pendingPlayerIds.length;
  const totalCount = state.players.filter((p) => p.monster).length;

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>ビルドフェーズ</h2>
      <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>
        スキルをスロットに配置して「確定」を押してください。スロット数はアクティブスキルの数を決めます（未設定スロットはアタックになります）。
      </p>

      {submitted ? (
        <p style={{ margin: 0, opacity: 0.7 }}>
          送信済み — 他プレイヤーを待機中… ({totalCount - pendingCount}/{totalCount})
        </p>
      ) : !iAmPending ? (
        <p style={{ margin: 0, opacity: 0.7 }}>
          待機中… ({totalCount - pendingCount}/{totalCount})
        </p>
      ) : null}

      {/* Active slot count indicator */}
      <div style={{ fontSize: 13, opacity: 0.7 }}>
        有効スロット: <strong>{activeSlotCount}</strong> / {TOTAL_SLOTS}　—　アタック枠の「ここで止める」で以降を不活性化できます。
      </div>

      {/* Slot grid */}
      <div>
        <h3 style={{ margin: '0 0 8px' }}>スロット（{activeSlotCount}スロット有効）</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {slots.map((card, idx) => {
            const isActive = idx < activeSlotCount;
            const isDefault = isActive && card === null;
            return (
              <div
                key={idx}
                style={{
                  border: `2px solid ${isActive ? (card ? (RARITY_COLOR[card.rarity] ?? '#aaa') : '#bbb') : '#ddd'}`,
                  borderRadius: 8,
                  padding: 8,
                  background: !isActive ? '#f5f5f5' : isDefault ? '#fafafa' : '#fff',
                  opacity: !isActive ? 0.45 : 1,
                  minHeight: 72,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  position: 'relative',
                }}
              >
                <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 2 }}>スロット {idx + 1}{!isActive ? ' （不活性）' : ''}</div>
                {!isActive ? (
                  <>
                    <span style={{ fontSize: 12, opacity: 0.4 }}>—</span>
                    {iAmPending && !submitted && (
                      <button
                        onClick={() => setActiveSlotCount(idx + 1)}
                        style={{ fontSize: 11, padding: '2px 6px', marginTop: 4, alignSelf: 'flex-start', cursor: 'pointer' }}
                        title="このスロットまで有効にする"
                      >
                        ここまで有効化
                      </button>
                    )}
                  </>
                ) : card ? (
                  <>
                    <div style={{ fontSize: 10, color: RARITY_COLOR[card.rarity] ?? '#888' }}>{card.rarity}</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{card.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>{describeSkillCard(card)}</div>
                    {iAmPending && !submitted && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        <button onClick={() => moveSlot(idx, idx - 1)} disabled={idx === 0} style={{ fontSize: 11, padding: '1px 5px' }}>↑</button>
                        <button onClick={() => moveSlot(idx, idx + 1)} disabled={idx >= activeSlotCount - 1} style={{ fontSize: 11, padding: '1px 5px' }}>↓</button>
                        <button onClick={() => removeFromSlot(idx)} style={{ fontSize: 11, padding: '1px 5px', color: '#c44', marginLeft: 'auto' }}>外す</button>
                      </div>
                    )}
                  </>
                ) : (
                  // Default attack slot (null within active range)
                  <>
                    <span style={{ fontSize: 12, opacity: 0.5, fontStyle: 'italic' }}>アタック（デフォルト）</span>
                    {iAmPending && !submitted && (
                      <button
                        onClick={() => changeActiveCount(idx - activeSlotCount)}
                        style={{ fontSize: 11, padding: '2px 6px', marginTop: 4, alignSelf: 'flex-start', color: '#c44', cursor: 'pointer' }}
                        title="このスロット以降を不活性にする"
                      >
                        ここで止める
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Submit button */}
      {iAmPending && !submitted && (
        <button
          onClick={handleSubmit}
          style={{
            padding: '10px 24px',
            fontSize: 15,
            fontWeight: 700,
            background: '#0066cc',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          このビルドで確定
        </button>
      )}

      {/* Skill stock */}
      <div>
        <h3 style={{ margin: '0 0 8px' }}>スキルストック（クリックでスロットに追加）</h3>
        {allStock.length === 0 ? (
          <p style={{ opacity: 0.5, fontSize: 13 }}>（ストックにカードがありません）</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
            {allStock.map((card) => {
              const canAdd = iAmPending && !submitted && slots.some((s, i) => s === null && i < activeSlotCount);
              return (
                <button
                  key={card.id}
                  onClick={() => addToSlot(card)}
                  disabled={!canAdd}
                  style={{
                    border: `2px solid ${RARITY_COLOR[card.rarity] ?? '#aaa'}`,
                    borderRadius: 8,
                    padding: 10,
                    background: '#fff',
                    cursor: canAdd ? 'pointer' : 'default',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <div style={{ fontSize: 10, color: RARITY_COLOR[card.rarity] ?? '#888' }}>{card.rarity}</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{card.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{describeSkillCard(card)}</div>
                  {card.nameTag && (
                    <div style={{ fontSize: 10, opacity: 0.5 }}>tag: {card.nameTag}</div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
