'use client';
import { useState, useEffect, useRef } from 'react';
import type { ClientGameState } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';
import type { SkillCard } from '../../server/engine/types';
import { describeSkillCard } from '../../lib/skill-text';
import { getSkillCategory, SKILL_CATEGORY_COLOR } from '../../lib/card-text';

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

  // Local slot state: 9-element array of SkillCard | null (passives excluded)
  const [slots, setSlots] = useState<(SkillCard | null)[]>(() =>
    (state.mySkillSlots ?? Array(TOTAL_SLOTS).fill(null))
      .slice(0, TOTAL_SLOTS)
      .map((c) => (c && c.active ? c : null)),
  );
  const [activeSlotCount, setActiveSlotCount] = useState<number>(
    state.myActiveSlotCount ?? TOTAL_SLOTS,
  );

  // Reset local state when build phase starts fresh or player changes
  useEffect(() => {
    setSlots(
      (state.mySkillSlots ?? Array(TOTAL_SLOTS).fill(null))
        .slice(0, TOTAL_SLOTS)
        .map((c) => (c && c.active ? c : null)),
    );
    setActiveSlotCount(state.myActiveSlotCount ?? TOTAL_SLOTS);
  }, [state.buildPhase !== null]);

  // Derive stock: cards not currently in any slot
  const slottedIds = new Set(slots.filter(Boolean).map((c) => c!.id));
  const stock: SkillCard[] = (state.mySkillStock ?? []).filter((c) => !slottedIds.has(c.id));

  // Also include cards that were in mySkillSlots initially but moved to stock in local state
  const originalSlots = state.mySkillSlots ?? [];
  const originalInSlots = originalSlots.filter((c): c is SkillCard => c !== null && !slottedIds.has(c.id));
  const allStock = [...stock, ...originalInSlots];

  // Separate passives (no active effect) — they cannot be slotted
  const isPassive = (c: SkillCard) => !c.active;
  const activeStock = allStock.filter((c) => !isPassive(c));
  const passiveStock = allStock.filter(isPassive);

  const removeFromSlot = (idx: number): void => {
    if (!iAmPending || submitted) return;
    const next = slots.slice();
    next[idx] = null;
    setSlots(next);
  };

  const addToSlot = (card: SkillCard): void => {
    if (!iAmPending || submitted) return;
    if (isPassive(card)) return;
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

  const dragFromRef = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

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
            const canDrag = iAmPending && !submitted && isActive;
            const isDragOver = dragOverIdx === idx;
            return (
              <div
                key={idx}
                className={card?.rarity === 'SSR' ? 'ssr-card' : undefined}
                draggable={canDrag}
                onDragStart={canDrag ? () => { dragFromRef.current = idx; } : undefined}
                onDragOver={canDrag ? (e) => { e.preventDefault(); setDragOverIdx(idx); } : undefined}
                onDrop={canDrag ? (e) => { e.preventDefault(); if (dragFromRef.current !== null && dragFromRef.current !== idx) moveSlot(dragFromRef.current, idx); dragFromRef.current = null; setDragOverIdx(null); } : undefined}
                onDragEnd={() => { dragFromRef.current = null; setDragOverIdx(null); }}
                style={{
                  border: `2px solid ${isDragOver ? '#0066cc' : isActive ? (card ? SKILL_CATEGORY_COLOR[getSkillCategory(card)] : '#bbb') : '#ddd'}`,
                  borderRadius: 8,
                  padding: 8,
                  background: isDragOver ? '#e8f0ff' : !isActive ? '#f5f5f5' : isDefault ? '#fafafa' : '#fff',
                  opacity: !isActive ? 0.45 : 1,
                  minHeight: 72,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  position: 'relative',
                  cursor: canDrag ? 'grab' : 'default',
                  transition: 'border-color 100ms, background 100ms',
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
                    <div style={{ fontSize: 10, color: SKILL_CATEGORY_COLOR[getSkillCategory(card)] }}>{card.rarity}</div>
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

      {/* Active skill stock */}
      <div>
        <h3 style={{ margin: '0 0 8px' }}>スキルストック（クリックでスロットに追加）</h3>
        {activeStock.length === 0 ? (
          <p style={{ opacity: 0.5, fontSize: 13 }}>（スロットに追加できるカードがありません）</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
            {activeStock.map((card) => {
              const canAdd = iAmPending && !submitted && slots.some((s, i) => s === null && i < activeSlotCount);
              return (
                <button
                  key={card.id}
                  onClick={() => addToSlot(card)}
                  disabled={!canAdd}
                  className={card.rarity === 'SSR' ? 'ssr-card' : undefined}
                  style={{
                    border: `2px solid ${SKILL_CATEGORY_COLOR[getSkillCategory(card)]}`,
                    borderRadius: 8,
                    padding: 10,
                    background: '#fff',
                    cursor: canAdd ? 'pointer' : 'default',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    position: 'relative',
                  }}
                >
                  <div style={{ fontSize: 10, color: SKILL_CATEGORY_COLOR[getSkillCategory(card)] }}>{card.rarity}</div>
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

      {/* Passive stock — display only, cannot be slotted */}
      {passiveStock.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 8px' }}>パッシブスキル（常時発動・スロット不要）</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
            {passiveStock.map((card) => (
              <div
                key={card.id}
                style={{
                  border: `2px solid ${SKILL_CATEGORY_COLOR['passive']}`,
                  borderRadius: 8,
                  padding: 10,
                  background: '#f9f9f9',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <div style={{ fontSize: 10, color: SKILL_CATEGORY_COLOR['passive'] }}>{card.rarity} passive</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{card.name}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{describeSkillCard(card)}</div>
                {card.nameTag && (
                  <div style={{ fontSize: 10, opacity: 0.5 }}>tag: {card.nameTag}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
