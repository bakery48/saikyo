'use client';
import { useMemo, useState } from 'react';
import { MONSTERS } from '../../../server/engine/cards/monsters';
import { SKILLS } from '../../../server/engine/cards/skills';
import { describeSkillCard } from '../../../lib/skill-text';
import type { BattleEvent, BattleResult, Stats } from '../../../server/engine/types';
import type { DevBattleRequest, DevBattleSideInput } from '../../api/dev/run-battle/route';

const ACTIVE_SKILLS = SKILLS.filter((s) => s.active);
const STAT_KEYS: (keyof Stats)[] = ['hp', 'atk', 'def', 'spd'];
const STAT_LABEL: Record<keyof Stats, string> = { hp: 'HP', atk: 'ATK', def: 'DEF', spd: 'SPD' };

function defaultStats(baseId: string): Stats {
  const base = MONSTERS.find((m) => m.baseId === baseId);
  return base ? { ...base.stats } : { hp: 12, atk: 5, def: 4, spd: 5 };
}

type SideState = {
  baseId: string;
  stats: Stats;
  activeIds: string[];
};

function initSide(baseId: string): SideState {
  return { baseId, stats: defaultStats(baseId), activeIds: [] };
}

type RunResult = {
  result: BattleResult;
  aName: string;
  bName: string;
  seed: number;
};

// ─── Side editor ─────────────────────────────────────────────────────────────

function SideEditor({
  side,
  label,
  onChange,
}: {
  side: SideState;
  label: string;
  onChange: (s: SideState) => void;
}) {
  const setStat = (key: keyof Stats, val: number) => {
    if (isNaN(val)) return;
    onChange({ ...side, stats: { ...side.stats, [key]: val } });
  };

  const setMonster = (baseId: string) => {
    onChange({ ...side, baseId, stats: defaultStats(baseId) });
  };

  const addSkill = (id: string) => {
    if (!id) return;
    onChange({ ...side, activeIds: [...side.activeIds, id] });
  };

  const removeSkill = (idx: number) => {
    const ids = side.activeIds.filter((_, i) => i !== idx);
    onChange({ ...side, activeIds: ids });
  };

  const moveSkill = (idx: number, dir: -1 | 1) => {
    const ids = [...side.activeIds];
    const target = idx + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[idx], ids[target]] = [ids[target]!, ids[idx]!];
    onChange({ ...side, activeIds: ids });
  };

  return (
    <div style={{ flex: 1, minWidth: 280, border: '1px solid #ccc', borderRadius: 6, padding: 12 }}>
      <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>{label}</h2>

      {/* Monster select */}
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>モンスター</label>
        <select
          value={side.baseId}
          onChange={(e) => setMonster(e.target.value)}
          style={selectStyle}
        >
          {MONSTERS.filter((m) => !m.hidden).map((m) => (
            <option key={m.baseId} value={m.baseId}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {STAT_KEYS.map((k) => (
          <div key={k} style={{ flex: 1 }}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>{STAT_LABEL[k]}</div>
            <input
              type="number"
              min={1}
              max={99}
              value={side.stats[k]}
              onChange={(e) => setStat(k, parseInt(e.target.value, 10))}
              style={{ ...inputStyle, textAlign: 'center' }}
            />
          </div>
        ))}
      </div>

      {/* Active skill list */}
      <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 600 }}>
        アクティブスキル ({side.activeIds.length})
      </div>
      <div style={{ marginBottom: 8 }}>
        {side.activeIds.length === 0 && (
          <div style={{ fontSize: 12, opacity: 0.5, padding: '4px 0' }}>（スキルなし）</div>
        )}
        {side.activeIds.map((id, idx) => {
          const card = SKILLS.find((s) => s.id === id);
          return (
            <div
              key={`${id}-${idx}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 0',
                borderBottom: '1px solid #f0f0f0',
                fontSize: 12,
              }}
            >
              <span style={{ width: 18, textAlign: 'right', opacity: 0.5, flexShrink: 0 }}>
                {idx + 1}.
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <strong>{card?.name ?? id}</strong>
                <span style={{ marginLeft: 4, opacity: 0.55, fontSize: 11 }}>
                  {card ? describeSkillCard(card) : ''}
                </span>
              </span>
              <button
                type="button"
                onClick={() => moveSkill(idx, -1)}
                disabled={idx === 0}
                style={smallBtn}
                title="上へ"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => moveSkill(idx, 1)}
                disabled={idx === side.activeIds.length - 1}
                style={smallBtn}
                title="下へ"
              >
                ▼
              </button>
              <button
                type="button"
                onClick={() => removeSkill(idx)}
                style={{ ...smallBtn, color: '#c00' }}
                title="削除"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Add skill */}
      <SkillAdder onAdd={addSkill} />
    </div>
  );
}

function SkillAdder({ onAdd }: { onAdd: (id: string) => void }) {
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState('');

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return ACTIVE_SKILLS.slice(0, 50);
    return ACTIVE_SKILLS.filter((s) => {
      const blob = `${s.id} ${s.name} ${describeSkillCard(s)}`.toLowerCase();
      return blob.includes(f);
    }).slice(0, 50);
  }, [filter]);

  const handleAdd = () => {
    if (selected) {
      onAdd(selected);
      setSelected('');
    }
  };

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        type="text"
        placeholder="スキル検索"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ ...inputStyle, flex: 1, minWidth: 100 }}
      />
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        style={{ ...selectStyle, flex: 2, minWidth: 120 }}
      >
        <option value="">（選択）</option>
        {filtered.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} — {describeSkillCard(s)}
          </option>
        ))}
      </select>
      <button type="button" onClick={handleAdd} disabled={!selected} style={addBtnStyle}>
        追加
      </button>
    </div>
  );
}

// ─── Log viewer ──────────────────────────────────────────────────────────────

function formatEvent(e: BattleEvent, aName: string, bName: string): string {
  const name = (p: 'a' | 'b') => (p === 'a' ? aName : bName);
  switch (e.kind) {
    case 'roll':
      return `🎲 ${name(e.player)} SPD判定: SPD${e.spd} + d6(${e.die}) = ${e.total}`;
    case 'first':
      return `⚡ ${name(e.player)} が先攻`;
    case 'skill_use':
      return `▶ ${name(e.player)} が「${e.name}」を使用`;
    case 'damage':
      return `💥 ${name(e.from)}→${name(e.to)}: ${e.amount}ダメージ (残HP ${e.hpAfter})`;
    case 'miss':
      return `💨 ${name(e.from)}→${name(e.to)}: MISS`;
    case 'heal':
      return `💚 ${name(e.player)} 回復 +${e.amount} (残HP ${e.hpAfter})`;
    case 'buff':
      return `⬆ ${name(e.player)} ${e.stat.toUpperCase()} +${e.amount} (${e.duration})`;
    case 'debuff':
      return `⬇ ${name(e.player)} ${e.stat.toUpperCase()} −${e.amount} (${e.duration})`;
    case 'nullified':
      return `🚫 ${name(e.player)} のスキル「${e.skillId}」が無効化`;
    case 'amp_set':
      return `🔥 ${name(e.player)} 次の攻撃倍率: ×${e.mult}`;
    case 'shield':
      return `🛡 ${name(e.player)} シールド +${e.amount}`;
    case 'passive':
      return `✨ ${name(e.player)} パッシブ発動 (${e.passiveId})`;
    case 'turn_skipped':
      return `⏭ ${name(e.player)} のターンがスキップ`;
    case 'actives_shuffled':
      return `🔀 ${name(e.player)} のアクティブがシャッフル`;
    case 'skill_fizzle':
      return `❌ ${name(e.player)} のスキルが空振り（自傷 ${e.selfDamage}）`;
    case 'hp_swap':
      return `🔄 HP交換: ${name(e.playerA)} ${e.hpA} / ${name(e.playerB)} ${e.hpB}`;
    case 'end': {
      const reasonLabel: Record<string, string> = {
        hp_zero: 'HP0',
        tiebreak_hp: 'HP差',
        tiebreak_spd: 'SPD差',
        draw: '引き分け',
      };
      if (e.winner === 'draw') return `🏁 引き分け (${reasonLabel[e.reason]})`;
      return `🏆 ${name(e.winner)} の勝利！ (${reasonLabel[e.reason]})`;
    }
    default:
      return JSON.stringify(e);
  }
}

function BattleLog({
  run,
}: {
  run: RunResult;
}) {
  const { result, aName, bName } = run;
  const winLabel =
    result.winner === 'draw'
      ? '引き分け'
      : result.winner === 'a'
        ? `${aName} の勝利`
        : `${bName} の勝利`;

  return (
    <div style={{ marginTop: 16, border: '1px solid #ccc', borderRadius: 6, padding: 12 }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>結果: {winLabel}</span>
        <span style={{ fontSize: 13, opacity: 0.7 }}>
          最終HP — {aName}: {result.finalHp.a} / {bName}: {result.finalHp.b}
        </span>
        <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 'auto' }}>seed: {run.seed}</span>
      </div>
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: 12,
          maxHeight: 400,
          overflow: 'auto',
          background: '#fafafa',
          border: '1px solid #eee',
          borderRadius: 4,
          padding: 8,
        }}
      >
        {result.log.map((e, i) => (
          <div
            key={i}
            style={{
              padding: '1px 0',
              color:
                e.kind === 'end'
                  ? '#2a6'
                  : e.kind === 'skill_use'
                    ? '#333'
                    : e.kind === 'damage' || e.kind === 'skill_fizzle'
                      ? '#b00'
                      : e.kind === 'heal'
                        ? '#080'
                        : e.kind === 'miss'
                          ? '#888'
                          : '#555',
            }}
          >
            {formatEvent(e, aName, bName)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DevBattlePage() {
  const firstMonster = MONSTERS.find((m) => !m.hidden)?.baseId ?? MONSTERS[0]!.baseId;
  const secondMonster = MONSTERS.filter((m) => !m.hidden)[1]?.baseId ?? firstMonster;

  const [sideA, setSideA] = useState<SideState>(() => initSide(firstMonster));
  const [sideB, setSideB] = useState<SideState>(() => initSide(secondMonster));
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState('');

  const runBattle = async () => {
    setLoading(true);
    setError(null);
    try {
      const body: DevBattleRequest = {
        a: sideA as DevBattleSideInput,
        b: sideB as DevBattleSideInput,
        seed: seed ? parseInt(seed, 10) : undefined,
      };
      const res = await fetch('/api/dev/run-battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as RunResult;
      setRunResult(data);
      if (!seed) setSeed(String(data.seed));
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const rerun = () => {
    setSeed('');
    void runBattle();
  };

  return (
    <main style={{ padding: 16, fontFamily: 'sans-serif', maxWidth: 1100 }}>
      <h1 style={{ margin: '0 0 6px' }}>バトルサンドボックス（開発用）</h1>
      <p style={{ fontSize: 12, opacity: 0.7, margin: '0 0 14px' }}>
        モンスターとスキルを設定してバトルをシミュレートします。パッシブはモンスター固有のものを使用。
      </p>

      <div style={{ display: 'flex', gap: 12 }}>
        <SideEditor side={sideA} label="Aサイド" onChange={setSideA} />
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 24, fontWeight: 700, opacity: 0.4 }}>VS</div>
        <SideEditor side={sideB} label="Bサイド" onChange={setSideB} />
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={runBattle}
          disabled={loading}
          style={{
            background: '#2a6',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '8px 20px',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {loading ? '…' : 'バトル開始'}
        </button>
        {runResult && (
          <button type="button" onClick={rerun} disabled={loading} style={{ padding: '6px 12px' }}>
            別シードで再実行
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <label>シード</label>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="ランダム"
            style={{ ...inputStyle, width: 100 }}
          />
        </div>
        {error && <span style={{ color: '#c00', fontSize: 13 }}>{error}</span>}
      </div>

      {runResult && <BattleLog run={runResult} />}
    </main>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  opacity: 0.7,
  marginBottom: 3,
};

const inputStyle: React.CSSProperties = {
  padding: '3px 6px',
  border: '1px solid #ddd',
  borderRadius: 3,
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  padding: '3px 4px',
  border: '1px solid #ddd',
  borderRadius: 3,
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
};

const smallBtn: React.CSSProperties = {
  padding: '1px 5px',
  fontSize: 11,
  border: '1px solid #ddd',
  borderRadius: 3,
  cursor: 'pointer',
  background: '#fff',
  flexShrink: 0,
};

const addBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  background: '#446',
  color: '#fff',
  border: 'none',
  borderRadius: 3,
  cursor: 'pointer',
  fontSize: 13,
  flexShrink: 0,
};
