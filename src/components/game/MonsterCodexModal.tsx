'use client';
import { useState } from 'react';
import { MONSTERS } from '../../server/engine/cards/monsters';
import { describeActionEffect } from '../../lib/card-text';
import { describePassive, describePassiveEffect } from '../../lib/skill-text';
import type { MonsterBoon, MonsterBase } from '../../server/engine/types';

const STAT_LABELS = ['HP', 'ATK', 'DEF', 'SPD'] as const;

function BoonTag({ boon }: { boon: MonsterBoon }) {
  const label =
    boon.effect.kind === 'stat_up'
      ? `${boon.effect.stat.toUpperCase()}+${boon.effect.amount}`
      : 'スキルカード獲得';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 99,
        background: '#fff8e1',
        border: '1px solid #d4a000',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {boon.name}（{label}）
    </span>
  );
}

function MonsterCard({ m }: { m: MonsterBase }) {
  return (
    <div
      style={{
        border: '1px solid #ccc',
        borderRadius: 8,
        padding: 12,
        background: '#fff',
        display: 'grid',
        gap: 8,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <strong style={{ fontSize: 16 }}>{m.name}</strong>
        <span style={{ fontSize: 11, opacity: 0.6 }}>{m.baseId}</span>
        {m.hidden && (
          <span style={{ fontSize: 11, color: '#888', border: '1px solid #ccc', borderRadius: 4, padding: '1px 5px' }}>
            隠し
          </span>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10 }}>
        {STAT_LABELS.map((s) => (
          <div key={s} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, opacity: 0.6, fontWeight: 600 }}>{s}</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{m.stats[s.toLowerCase() as 'hp' | 'atk' | 'def' | 'spd']}</div>
          </div>
        ))}
      </div>

      {/* Base passive */}
      {m.passives.length > 0 && (
        <div style={{ fontSize: 12 }}>
          <span style={{ fontWeight: 600, opacity: 0.7 }}>固有パッシブ：</span>
          {m.passives.map((p) => (
            <span key={p.id}>
              {p.name}（{describePassive(p)}）
            </span>
          ))}
        </div>
      )}

      {/* Unique action card */}
      <div
        style={{
          padding: '5px 8px',
          background: '#fffbf0',
          border: '1px solid #f0a000',
          borderRadius: 6,
          fontSize: 12,
        }}
      >
        <span style={{ fontSize: 10, color: '#cc8800', fontWeight: 700 }}>固有アクション </span>
        <span style={{ fontWeight: 600 }}>{m.uniqueActionCard.name}</span>
        <span style={{ opacity: 0.8 }}>：{describeActionEffect(m.uniqueActionCard)}</span>
      </div>

      {/* Boons */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.6, marginBottom: 4 }}>恩恵（3択）</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {m.boons.map((b) => (
            <BoonTag key={b.id} boon={b} />
          ))}
        </div>
      </div>

      {/* Initial deck note */}
      <div style={{ fontSize: 11, opacity: 0.55 }}>初期デッキ：攻撃×9</div>
    </div>
  );
}

export function MonsterCodexButton() {
  const [open, setOpen] = useState(false);
  const visible = MONSTERS.filter((m) => !m.hidden);
  const hidden = MONSTERS.filter((m) => m.hidden);
  const [showHidden, setShowHidden] = useState(false);
  const list = showHidden ? MONSTERS : visible;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          fontSize: 12,
          padding: '4px 10px',
          cursor: 'pointer',
          border: '1px solid #888',
          borderRadius: 4,
          background: '#fff',
          fontWeight: 600,
        }}
      >
        図鑑
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '24px 16px',
            overflowY: 'auto',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            style={{
              background: '#f5f5f5',
              borderRadius: 10,
              padding: 20,
              width: '100%',
              maxWidth: 960,
              display: 'grid',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h2 style={{ margin: 0 }}>モンスター図鑑</h2>
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 'auto' }}>
                <input
                  type="checkbox"
                  checked={showHidden}
                  onChange={(e) => setShowHidden(e.target.checked)}
                />
                隠しモンスターを表示
              </label>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ padding: '4px 12px', cursor: 'pointer', borderRadius: 4, border: '1px solid #aaa', background: '#fff' }}
              >
                閉じる
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 12,
              }}
            >
              {list.map((m) => (
                <MonsterCard key={m.baseId} m={m} />
              ))}
            </div>

            {!showHidden && hidden.length > 0 && (
              <p style={{ margin: 0, fontSize: 12, opacity: 0.5, textAlign: 'center' }}>
                ＋{hidden.length}体の隠しモンスター（チェックボックスで表示）
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
