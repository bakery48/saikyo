'use client';
import { useMemo, useState } from 'react';
import { MONSTERS } from '../../../server/engine/cards/monsters';
import { SKILLS } from '../../../server/engine/cards/skills';
import { describeSkillCard } from '../../../lib/skill-text';
import type { BattleEvent, BattleResult, Monster, Stats } from '../../../server/engine/types';
import type { ClientGameState, ClientPlayer } from '../../../shared/messages';
import type { BattleMatch } from '../../../server/engine/types';
import { BattleStage } from '../../../components/game/BattleAnimationView';
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
  startHpA: number;
  startHpB: number;
};

/** Reconstruct a Monster from SideState — mirrors the API route logic. */
function buildClientMonster(side: SideState, ownerId: string): Monster {
  const base = MONSTERS.find((m) => m.baseId === side.baseId)!;
  return {
    ownerId,
    baseId: base.baseId,
    name: base.name,
    stats: { ...side.stats },
    passives: base.passives.map((p) => ({ ...p })),
    attackKind: base.attackKind,
    actives: side.activeIds.map((id, idx) => {
      const card = SKILLS.find((s) => s.id === id)!;
      return {
        id: `${ownerId}-${card.id}`,
        order: idx + 1,
        name: card.name,
        nameTag: card.nameTag,
        rarity: card.rarity,
        effect: card.active!.effect,
      };
    }),
  };
}

/** Build a minimal ClientGameState + BattleMatch for BattleStage. */
function buildFakeState(
  run: RunResult,
  sideA: SideState,
  sideB: SideState,
): { state: ClientGameState; match: BattleMatch } {
  const monA = buildClientMonster(sideA, 'dev-a');
  const monB = buildClientMonster(sideB, 'dev-b');

  const playerA: ClientPlayer = {
    id: 'dev-a',
    name: run.aName,
    isCPU: false,
    color: 'red',
    monster: monA,
    actionHandCount: 0,
  };
  const playerB: ClientPlayer = {
    id: 'dev-b',
    name: run.bName,
    isCPU: false,
    color: 'blue',
    monster: monB,
    actionHandCount: 0,
  };

  const match: BattleMatch = {
    a: 'dev-a',
    b: 'dev-b',
    winner: run.result.winner,
    startHpA: run.startHpA,
    startHpB: run.startHpB,
    finalHpA: run.result.finalHp.a,
    finalHpB: run.result.finalHp.b,
    log: run.result.log,
  };

  const state = {
    roomId: 'dev',
    players: [playerA, playerB],
    monsterPick: null,
    round: 1,
    miniRound: 1,
    totalRounds: 1,
    miniRoundsPerRound: 1,
    phase: 'battle' as const,
    draft: null,
    actionPhase: null,
    myActionHand: null,
    battle: { matches: [match] },
    reward: null,
    tournament: null,
    champion: null,
    eventPhaseSummary: null,
    actionPhaseSummary: null,
    recentLog: [],
    deckCounts: { event: 0, action: 0, skill: 0, eventGrave: 0, actionGrave: 0, skillGrave: 0 },
    publicDecks: undefined,
  } as unknown as ClientGameState;

  return { state, match };
}

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
    onChange({ ...side, activeIds: side.activeIds.filter((_, i) => i !== idx) });
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

      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>モンスター</label>
        <select value={side.baseId} onChange={(e) => setMonster(e.target.value)} style={selectStyle}>
          {MONSTERS.filter((m) => !m.hidden).map((m) => (
            <option key={m.baseId} value={m.baseId}>{m.name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {STAT_KEYS.map((k) => (
          <div key={k} style={{ flex: 1 }}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>{STAT_LABEL[k]}</div>
            <input
              type="number" min={1} max={99}
              value={side.stats[k]}
              onChange={(e) => setStat(k, parseInt(e.target.value, 10))}
              style={{ ...inputStyle, textAlign: 'center' }}
            />
          </div>
        ))}
      </div>

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
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 0', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}
            >
              <span style={{ width: 18, textAlign: 'right', opacity: 0.5, flexShrink: 0 }}>{idx + 1}.</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <strong>{card?.name ?? id}</strong>
                <span style={{ marginLeft: 4, opacity: 0.55, fontSize: 11 }}>
                  {card ? describeSkillCard(card) : ''}
                </span>
              </span>
              <button type="button" onClick={() => moveSkill(idx, -1)} disabled={idx === 0} style={smallBtn} title="上へ">▲</button>
              <button type="button" onClick={() => moveSkill(idx, 1)} disabled={idx === side.activeIds.length - 1} style={smallBtn} title="下へ">▼</button>
              <button type="button" onClick={() => removeSkill(idx)} style={{ ...smallBtn, color: '#c00' }} title="削除">✕</button>
            </div>
          );
        })}
      </div>

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
    return ACTIVE_SKILLS.filter((s) =>
      `${s.id} ${s.name} ${describeSkillCard(s)}`.toLowerCase().includes(f),
    ).slice(0, 50);
  }, [filter]);

  const handleAdd = () => {
    if (selected) { onAdd(selected); setSelected(''); }
  };

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        type="text" placeholder="スキル検索" value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ ...inputStyle, flex: 1, minWidth: 100 }}
      />
      <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ ...selectStyle, flex: 2, minWidth: 120 }}>
        <option value="">（選択）</option>
        {filtered.map((s) => (
          <option key={s.id} value={s.id}>{s.name} — {describeSkillCard(s)}</option>
        ))}
      </select>
      <button type="button" onClick={handleAdd} disabled={!selected} style={addBtnStyle}>追加</button>
    </div>
  );
}

// ─── Text log (collapsible) ───────────────────────────────────────────────────

function formatEvent(e: BattleEvent, aName: string, bName: string): string {
  const name = (p: 'a' | 'b') => (p === 'a' ? aName : bName);
  switch (e.kind) {
    case 'roll': return `🎲 ${name(e.player)} SPD判定: SPD${e.spd} + d6(${e.die}) = ${e.total}`;
    case 'first': return `⚡ ${name(e.player)} が先攻`;
    case 'skill_use': return `▶ ${name(e.player)} が「${e.name}」を使用`;
    case 'damage': return `💥 ${name(e.from)}→${name(e.to)}: ${e.amount}ダメージ (残HP ${e.hpAfter})`;
    case 'miss': return `💨 ${name(e.from)}→${name(e.to)}: MISS`;
    case 'heal': return `💚 ${name(e.player)} 回復 +${e.amount} (残HP ${e.hpAfter})`;
    case 'buff': return `⬆ ${name(e.player)} ${e.stat.toUpperCase()} +${e.amount} (${e.duration})`;
    case 'debuff': return `⬇ ${name(e.player)} ${e.stat.toUpperCase()} −${e.amount} (${e.duration})`;
    case 'nullified': return `🚫 ${name(e.player)} のスキルが無効化`;
    case 'amp_set': return `🔥 ${name(e.player)} 次の攻撃倍率: ×${e.mult}`;
    case 'shield': return `🛡 ${name(e.player)} シールド +${e.amount}`;
    case 'passive': return `✨ ${name(e.player)} パッシブ発動 (${e.passiveId})`;
    case 'turn_skipped': return `⏭ ${name(e.player)} のターンがスキップ`;
    case 'actives_shuffled': return `🔀 ${name(e.player)} のアクティブがシャッフル`;
    case 'skill_fizzle': return `❌ ${name(e.player)} のスキルが空振り（自傷 ${e.selfDamage}）`;
    case 'hp_swap': return `🔄 HP交換: ${name(e.playerA)} ${e.hpA} / ${name(e.playerB)} ${e.hpB}`;
    case 'end': {
      const r: Record<string, string> = { hp_zero: 'HP0', tiebreak_hp: 'HP差', tiebreak_spd: 'SPD差', draw: '引き分け' };
      return e.winner === 'draw' ? `🏁 引き分け (${r[e.reason]})` : `🏆 ${name(e.winner)} の勝利！ (${r[e.reason]})`;
    }
    default: return JSON.stringify(e);
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DevBattlePage() {
  const firstMonster = MONSTERS.find((m) => !m.hidden)?.baseId ?? MONSTERS[0]!.baseId;
  const secondMonster = MONSTERS.filter((m) => !m.hidden)[1]?.baseId ?? firstMonster;

  const [sideA, setSideA] = useState<SideState>(() => initSide(firstMonster));
  const [sideB, setSideB] = useState<SideState>(() => initSide(secondMonster));
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  // Keep a snapshot of the sides that produced the last run (for monster reconstruction)
  const [runSides, setRunSides] = useState<{ a: SideState; b: SideState } | null>(null);
  // Bumped on every successful run so BattleStage remounts and replays from the top.
  const [runKey, setRunKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState('');

  const doRun = async (overrideSeed?: number) => {
    setLoading(true);
    setError(null);
    try {
      const body: DevBattleRequest = {
        a: sideA as DevBattleSideInput,
        b: sideB as DevBattleSideInput,
        seed: overrideSeed ?? (seed ? parseInt(seed, 10) : undefined),
      };
      const res = await fetch('/api/dev/run-battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as RunResult;
      setRunResult(data);
      setRunSides({ a: { ...sideA }, b: { ...sideB } });
      setRunKey((k) => k + 1);
      if (overrideSeed === undefined && !seed) setSeed(String(data.seed));
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const fakeData = useMemo(() => {
    if (!runResult || !runSides) return null;
    return buildFakeState(runResult, runSides.a, runSides.b);
  }, [runResult, runSides]);

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

      <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button" onClick={() => void doRun()} disabled={loading}
          style={{ background: '#2a6', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 20px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
        >
          {loading ? '…' : 'バトル開始'}
        </button>
        {runResult && (
          <button type="button" onClick={() => void doRun(undefined)} disabled={loading} style={{ padding: '6px 12px' }}>
            再実行（同設定）
          </button>
        )}
        {runResult && (
          <button
            type="button"
            onClick={() => { setSeed(''); void doRun(Math.floor(Math.random() * 0xffffffff)); }}
            disabled={loading}
            style={{ padding: '6px 12px' }}
          >
            別シードで再実行
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <label>シード</label>
          <input
            type="number" value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="ランダム"
            style={{ ...inputStyle, width: 100 }}
          />
        </div>
        {error && <span style={{ color: '#c00', fontSize: 13 }}>{error}</span>}
      </div>

      {fakeData && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 8 }}>seed: {runResult!.seed}</div>
          {/* Game-identical battle animation */}
          <BattleStage key={runKey} state={fakeData.state} match={fakeData.match} />

          {/* Collapsible raw log */}
          <details style={{ marginTop: 16 }}>
            <summary style={{ fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
              生ログ（{runResult!.result.log.length} イベント）
            </summary>
            <div
              style={{ fontFamily: 'monospace', fontSize: 12, maxHeight: 320, overflow: 'auto', background: '#fafafa', border: '1px solid #eee', borderRadius: 4, padding: 8, marginTop: 6 }}
            >
              {runResult!.result.log.map((e, i) => (
                <div
                  key={i}
                  style={{
                    padding: '1px 0',
                    color: e.kind === 'end' ? '#2a6' : e.kind === 'skill_use' ? '#333' : e.kind === 'damage' || e.kind === 'skill_fizzle' ? '#b00' : e.kind === 'heal' ? '#080' : e.kind === 'miss' ? '#888' : '#555',
                  }}
                >
                  {formatEvent(e, runResult!.aName, runResult!.bName)}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </main>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, opacity: 0.7, marginBottom: 3 };

const inputStyle: React.CSSProperties = {
  padding: '3px 6px', border: '1px solid #ddd', borderRadius: 3, fontSize: 13, width: '100%', boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  padding: '3px 4px', border: '1px solid #ddd', borderRadius: 3, fontSize: 13, width: '100%', boxSizing: 'border-box',
};

const smallBtn: React.CSSProperties = {
  padding: '1px 5px', fontSize: 11, border: '1px solid #ddd', borderRadius: 3, cursor: 'pointer', background: '#fff', flexShrink: 0,
};

const addBtnStyle: React.CSSProperties = {
  padding: '4px 10px', background: '#446', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 13, flexShrink: 0,
};
