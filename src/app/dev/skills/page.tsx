'use client';
import { useMemo, useState } from 'react';
import { SKILLS } from '../../../server/engine/cards/skills';
import { MONSTERS } from '../../../server/engine/cards/monsters';
import { EVENTS } from '../../../server/engine/cards/events';
import { ACTIONS } from '../../../server/engine/cards/actions';
import { describePassive, describeSkillCard, effectCategory, type EffectCategory } from '../../../lib/skill-text';
import { describeEventEffect, describeActionEffect } from '../../../lib/card-text';
import type { AttackKind, Rarity, SkillCard, SkillEffect } from '../../../server/engine/types';

type SortCol = 'id' | 'rarity' | 'name' | 'tag' | 'category';
type SortDir = 'asc' | 'desc';

const RARITY_ORDER: Record<string, number> = { N: 0, R: 1, SR: 2, SSR: 3 };

const RARITIES: Rarity[] = ['N', 'R', 'SR', 'SSR'];
const ATTACK_KINDS: AttackKind[] = ['strike', 'sword', 'claw', 'magic', 'fire', 'water', 'ice', 'wind', 'passthrough'];
const ATTACK_KIND_LABEL: Record<AttackKind, string> = {
  strike: '打撃',
  sword: '剣',
  claw: '爪',
  magic: '無属性魔法',
  fire: '炎魔法',
  water: '水魔法',
  ice: '氷魔法',
  wind: '風魔法',
  passthrough: 'スルー',
};

type Edits = Record<
  string,
  { name?: string; rarity?: Rarity; nameTag?: string; attackKind?: AttackKind; description?: string }
>;

function effectAttackKind(e: SkillEffect | undefined): AttackKind | null {
  if (!e) return null;
  if (e.kind === 'attack' || e.kind === 'multi_hit_attack' || e.kind === 'deja_vu_attack') {
    return e.attackKind ?? null;
  }
  return null;
}

function hasAttackKindSlot(c: SkillCard): boolean {
  const e = c.active?.effect;
  return (
    !!e && (e.kind === 'attack' || e.kind === 'multi_hit_attack' || e.kind === 'deja_vu_attack')
  );
}

function cardEffectKind(c: SkillCard): string {
  return c.active?.effect.kind ?? c.passive?.effect.kind ?? '';
}

export default function DevSkillsPage() {
  const [edits, setEdits] = useState<Edits>({});
  const [filter, setFilter] = useState('');
  const [sortCol, setSortCol] = useState<SortCol>('id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const effectKindOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of SKILLS) {
      const k = cardEffectKind(c);
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, []);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const filtered = SKILLS.filter((c) => {
      if (!f) return true;
      // exact effect kind match (e.g. user picked from datalist)
      if (cardEffectKind(c) === f) return true;
      const blob = `${c.id} ${c.name} ${c.nameTag ?? ''} ${cardEffectKind(c)} ${describeSkillCard(c)}`.toLowerCase();
      return blob.includes(f);
    });
    const sign = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let va: string | number;
      let vb: string | number;
      switch (sortCol) {
        case 'id':   va = a.id;   vb = b.id;   break;
        case 'rarity': va = RARITY_ORDER[a.rarity] ?? 0; vb = RARITY_ORDER[b.rarity] ?? 0; break;
        case 'name': va = a.name; vb = b.name; break;
        case 'tag':  va = a.nameTag ?? ''; vb = b.nameTag ?? ''; break;
        case 'category': {
          // Sort by category, then group same effect kinds together.
          const ca = a.passive ? 'passive' : a.active ? effectCategory(a.active.effect) : '';
          const cb = b.passive ? 'passive' : b.active ? effectCategory(b.active.effect) : '';
          va = `${ca} ${cardEffectKind(a)}`;
          vb = `${cb} ${cardEffectKind(b)}`;
          break;
        }
      }
      if (va < vb) return -sign;
      if (va > vb) return sign;
      return 0;
    });
  }, [filter, sortCol, sortDir]);

  const setField = <K extends keyof Edits[string]>(
    id: string,
    key: K,
    value: Edits[string][K],
  ): void => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }));
  };

  const changedEntries = useMemo(() => {
    const out: Array<{
      id: string;
      name: string;
      rarity: Rarity;
      nameTag: string | null;
      attackKind?: AttackKind | null;
      description?: string;
    }> = [];
    for (const c of SKILLS) {
      const e = edits[c.id];
      if (!e) continue;
      const newName = e.name ?? c.name;
      const newRarity = (e.rarity ?? c.rarity) as Rarity;
      const newTag = e.nameTag !== undefined ? e.nameTag : c.nameTag ?? '';
      const origAtk = effectAttackKind(c.active?.effect);
      const newAtk = e.attackKind ?? origAtk;
      const newDesc = e.description !== undefined ? e.description : c.description ?? '';
      const changed =
        newName !== c.name ||
        newRarity !== c.rarity ||
        (newTag || '') !== (c.nameTag ?? '') ||
        (hasAttackKindSlot(c) && newAtk !== origAtk) ||
        newDesc !== (c.description ?? '');
      if (changed) {
        const entry: (typeof out)[number] = {
          id: c.id,
          name: newName,
          rarity: newRarity,
          nameTag: newTag === '' ? null : newTag,
        };
        if (hasAttackKindSlot(c)) entry.attackKind = newAtk;
        if (newDesc) entry.description = newDesc;
        out.push(entry);
      }
    }
    return out;
  }, [edits]);

  const exportJson = JSON.stringify(changedEntries, null, 2);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(exportJson);
      alert(`${changedEntries.length} 件をJSONとしてクリップボードにコピーしました`);
    } catch {
      alert('クリップボードに書き込めませんでした。手動でコピーしてください。');
    }
  };

  const apply = async (): Promise<void> => {
    if (changedEntries.length === 0) return;
    try {
      const res = await fetch('/api/dev/apply-skill-edits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changedEntries),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json() as { count: number };
      alert(`${data.count} 件を skills.overrides.json に反映しました。Next.js がホットリロードします。`);
      setEdits({});
    } catch (err) {
      alert(`反映に失敗しました: ${String(err)}`);
    }
  };

  const reset = (): void => {
    if (confirm('すべての編集を破棄しますか？')) setEdits({});
  };

  return (
    <main style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h1 style={{ margin: '0 0 8px' }}>スキルカード編集（開発用）</h1>
      <p style={{ fontSize: 12, opacity: 0.7, margin: '0 0 12px' }}>
        テキスト・レアリティ・タグ・攻撃属性・説明文を編集可能。編集はメモリ内のみ。
        コピーボタンで変更分のJSONを取得し、手動で <code>skills.ts</code> に反映してください。
        説明文を空にすると effect から自動生成に戻ります。
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input
          type="text"
          list="effect-kind-list"
          placeholder="検索（名前・タグ・説明・効果ID） — 効果種別はサジェストから選択可"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ padding: '4px 8px', minWidth: 320 }}
        />
        <datalist id="effect-kind-list">
          {effectKindOptions.map(([kind, count]) => (
            <option key={kind} value={kind}>{kind} ({count}件)</option>
          ))}
        </datalist>
        {filter && (
          <button type="button" onClick={() => setFilter('')} style={{ padding: '4px 8px', cursor: 'pointer' }}>
            ✕ クリア
          </button>
        )}
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          {rows.length} / {SKILLS.length} 件 — 変更 {changedEntries.length} 件
        </span>
        <button type="button" onClick={apply} disabled={changedEntries.length === 0}
          style={{ background: '#2a6', color: '#fff', border: 'none', borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>
          反映（overrides.json に書き込み）
        </button>
        <button type="button" onClick={copy} disabled={changedEntries.length === 0}>
          変更分をJSONコピー
        </button>
        <button type="button" onClick={reset} disabled={Object.keys(edits).length === 0}>
          編集を破棄
        </button>
      </div>

      <div style={{ overflow: 'auto', border: '1px solid #ccc', borderRadius: 4 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#eef', position: 'sticky', top: 0 }}>
              <SortTh col="id" cur={sortCol} dir={sortDir} onClick={toggleSort}>ID</SortTh>
              <SortTh col="rarity" cur={sortCol} dir={sortDir} onClick={toggleSort}>レアリティ</SortTh>
              <SortTh col="name" cur={sortCol} dir={sortDir} onClick={toggleSort}>カード名</SortTh>
              <SortTh col="tag" cur={sortCol} dir={sortDir} onClick={toggleSort}>タグ</SortTh>
              <Th>説明文（空=自動生成）</Th>
              <SortTh col="category" cur={sortCol} dir={sortDir} onClick={toggleSort}>カテゴリ</SortTh>
              <Th>攻撃属性</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, rowIdx) => {
              const e = edits[c.id] ?? {};
              const origAtk = effectAttackKind(c.active?.effect);
              const curAtk = e.attackKind ?? origAtk;
              const currentDesc = e.description !== undefined ? e.description : c.description ?? '';
              const autoDesc = describeSkillCard({ ...c, description: undefined });
              const dirty =
                (e.name !== undefined && e.name !== c.name) ||
                (e.rarity !== undefined && e.rarity !== c.rarity) ||
                (e.nameTag !== undefined && (e.nameTag || '') !== (c.nameTag ?? '')) ||
                (hasAttackKindSlot(c) && e.attackKind !== undefined && e.attackKind !== origAtk) ||
                (e.description !== undefined && e.description !== (c.description ?? ''));
              return (
                <tr
                  key={`${rowIdx}-${c.id}`}
                  style={{
                    background: dirty ? '#fffbe6' : 'transparent',
                    borderBottom: '1px solid #eee',
                  }}
                >
                  <Td>
                    <code style={{ fontSize: 11 }}>{c.id}</code>
                  </Td>
                  <Td>
                    <select
                      value={(e.rarity ?? c.rarity) as string}
                      onChange={(ev) => setField(c.id, 'rarity', ev.target.value as Rarity)}
                      style={cellInputStyle}
                    >
                      {RARITIES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </Td>
                  <Td>
                    <input
                      type="text"
                      value={e.name ?? c.name}
                      onChange={(ev) => setField(c.id, 'name', ev.target.value)}
                      style={cellInputStyle}
                    />
                  </Td>
                  <Td>
                    <input
                      type="text"
                      value={e.nameTag !== undefined ? e.nameTag : c.nameTag ?? ''}
                      onChange={(ev) => setField(c.id, 'nameTag', ev.target.value)}
                      style={cellInputStyle}
                      placeholder="(なし)"
                    />
                  </Td>
                  <Td style={{ minWidth: 280 }}>
                    <input
                      type="text"
                      value={currentDesc}
                      onChange={(ev) => setField(c.id, 'description', ev.target.value)}
                      style={{ ...cellInputStyle, color: currentDesc ? '#000' : '#999' }}
                      placeholder={autoDesc}
                    />
                  </Td>
                  <Td>
                    {c.passive ? (
                      <span style={{ fontSize: 11, opacity: 0.6 }}>passive</span>
                    ) : c.active ? (
                      <CategoryBadge cat={effectCategory(c.active.effect)} />
                    ) : (
                      <span style={{ fontSize: 11, opacity: 0.4 }}>—</span>
                    )}
                  </Td>
                  <Td>
                    {hasAttackKindSlot(c) ? (
                      <select
                        value={curAtk ?? ''}
                        onChange={(ev) =>
                          setField(c.id, 'attackKind', (ev.target.value || undefined) as AttackKind | undefined)
                        }
                        style={cellInputStyle}
                      >
                        <option value="">(未設定)</option>
                        {ATTACK_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {ATTACK_KIND_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ fontSize: 11, opacity: 0.4 }}>—</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {changedEntries.length > 0 && (
        <details open style={{ marginTop: 12 }}>
          <summary>変更分プレビュー（{changedEntries.length} 件）</summary>
          <pre
            style={{
              background: '#fafafa',
              padding: 8,
              fontSize: 11,
              overflow: 'auto',
              maxHeight: 300,
            }}
          >
            {exportJson}
          </pre>
        </details>
      )}

      <MonsterPassiveEditor />
      <EventCardEditor />
      <ActionCardEditor />
    </main>
  );
}

type MonsterPassiveEdits = Record<string, { description?: string }>;

function MonsterPassiveEditor() {
  const [edits, setEdits] = useState<MonsterPassiveEdits>({});

  const rows = useMemo(
    () =>
      MONSTERS.flatMap((m) =>
        m.passives.map((p) => ({ monsterName: m.name, baseId: m.baseId, passive: p })),
      ),
    [],
  );

  const setDesc = (passiveId: string, value: string): void => {
    setEdits((prev) => ({ ...prev, [passiveId]: { description: value } }));
  };

  const changedEntries = useMemo(() => {
    const out: Array<{ passiveId: string; description: string }> = [];
    for (const r of rows) {
      const e = edits[r.passive.id];
      if (e?.description === undefined) continue;
      const orig = r.passive.description ?? '';
      if (e.description !== orig) {
        out.push({ passiveId: r.passive.id, description: e.description });
      }
    }
    return out;
  }, [edits, rows]);

  const apply = async (): Promise<void> => {
    if (changedEntries.length === 0) return;
    try {
      const res = await fetch('/api/dev/apply-monster-edits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changedEntries),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { count: number };
      alert(`${data.count} 件を monsters.overrides.json に反映しました。Next.js がホットリロードします。`);
      setEdits({});
    } catch (err) {
      alert(`反映に失敗しました: ${String(err)}`);
    }
  };

  const reset = (): void => {
    if (confirm('モンスターパッシブの編集を破棄しますか？')) setEdits({});
  };

  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>モンスター固有スキル説明文</h2>
      <p style={{ fontSize: 12, opacity: 0.7, margin: '0 0 8px' }}>
        各モンスター固有パッシブの説明文を編集可能。空にすると effect から自動生成に戻ります。
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, opacity: 0.7 }}>変更 {changedEntries.length} 件</span>
        <button
          type="button"
          onClick={apply}
          disabled={changedEntries.length === 0}
          style={{
            background: '#2a6',
            color: '#fff',
            border: 'none',
            borderRadius: 3,
            padding: '4px 10px',
            cursor: 'pointer',
          }}
        >
          反映（overrides.json に書き込み）
        </button>
        <button type="button" onClick={reset} disabled={Object.keys(edits).length === 0}>
          編集を破棄
        </button>
      </div>
      <div style={{ overflow: 'auto', border: '1px solid #ccc', borderRadius: 4 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#eef', position: 'sticky', top: 0 }}>
              <Th>モンスター</Th>
              <Th>パッシブ名</Th>
              <Th>パッシブID</Th>
              <Th>説明文（空=自動生成）</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const currentDesc =
                edits[r.passive.id]?.description !== undefined
                  ? edits[r.passive.id]!.description!
                  : r.passive.description ?? '';
              const autoDesc = describePassive(r.passive);
              const dirty =
                edits[r.passive.id]?.description !== undefined &&
                edits[r.passive.id]!.description !== (r.passive.description ?? '');
              return (
                <tr
                  key={r.passive.id}
                  style={{
                    background: dirty ? '#fffbe6' : 'transparent',
                    borderBottom: '1px solid #eee',
                  }}
                >
                  <Td>{r.monsterName}</Td>
                  <Td>{r.passive.name}</Td>
                  <Td>
                    <code style={{ fontSize: 11 }}>{r.passive.id}</code>
                  </Td>
                  <Td style={{ minWidth: 320 }}>
                    <input
                      type="text"
                      value={currentDesc}
                      onChange={(ev) => setDesc(r.passive.id, ev.target.value)}
                      style={{ ...cellInputStyle, color: currentDesc ? '#000' : '#999' }}
                      placeholder={autoDesc}
                    />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type SimpleDescEdits = Record<string, string>;

function EventCardEditor() {
  const [edits, setEdits] = useState<SimpleDescEdits>({});

  const changedEntries = useMemo(() => {
    const out: Array<{ id: string; description: string }> = [];
    for (const c of EVENTS) {
      const val = edits[c.id];
      if (val === undefined) continue;
      if (val !== (c.description ?? '')) out.push({ id: c.id, description: val });
    }
    return out;
  }, [edits]);

  const apply = async (): Promise<void> => {
    if (changedEntries.length === 0) return;
    try {
      const res = await fetch('/api/dev/apply-event-edits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changedEntries),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { count: number };
      alert(`${data.count} 件を events.overrides.json に反映しました。Next.js がホットリロードします。`);
      setEdits({});
    } catch (err) {
      alert(`反映に失敗しました: ${String(err)}`);
    }
  };

  const reset = (): void => {
    if (confirm('イベントカードの編集を破棄しますか？')) setEdits({});
  };

  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>イベントカード説明文</h2>
      <p style={{ fontSize: 12, opacity: 0.7, margin: '0 0 8px' }}>
        各イベントカードの説明文を編集可能。空にすると effect から自動生成に戻ります。
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, opacity: 0.7 }}>変更 {changedEntries.length} 件</span>
        <button
          type="button"
          onClick={apply}
          disabled={changedEntries.length === 0}
          style={{ background: '#2a6', color: '#fff', border: 'none', borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}
        >
          反映（overrides.json に書き込み）
        </button>
        <button type="button" onClick={reset} disabled={Object.keys(edits).length === 0}>
          編集を破棄
        </button>
      </div>
      <div style={{ overflow: 'auto', border: '1px solid #ccc', borderRadius: 4 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#eef', position: 'sticky', top: 0 }}>
              <Th>ID</Th>
              <Th>カード名</Th>
              <Th>ターゲット</Th>
              <Th>説明文（空=自動生成）</Th>
            </tr>
          </thead>
          <tbody>
            {EVENTS.map((c) => {
              const currentDesc = edits[c.id] !== undefined ? edits[c.id]! : c.description ?? '';
              const autoDesc = describeEventEffect({ ...c, description: undefined });
              const dirty = edits[c.id] !== undefined && edits[c.id] !== (c.description ?? '');
              return (
                <tr key={c.id} style={{ background: dirty ? '#fffbe6' : 'transparent', borderBottom: '1px solid #eee' }}>
                  <Td><code style={{ fontSize: 11 }}>{c.id}</code></Td>
                  <Td>{c.name}</Td>
                  <Td><span style={{ fontSize: 11, opacity: 0.7 }}>{c.target}</span></Td>
                  <Td style={{ minWidth: 320 }}>
                    <input
                      type="text"
                      value={currentDesc}
                      onChange={(ev) => setEdits((prev) => ({ ...prev, [c.id]: ev.target.value }))}
                      style={{ ...cellInputStyle, color: currentDesc ? '#000' : '#999' }}
                      placeholder={autoDesc}
                    />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActionCardEditor() {
  const [edits, setEdits] = useState<SimpleDescEdits>({});

  const changedEntries = useMemo(() => {
    const out: Array<{ id: string; description: string }> = [];
    for (const c of ACTIONS) {
      const val = edits[c.id];
      if (val === undefined) continue;
      if (val !== (c.description ?? '')) out.push({ id: c.id, description: val });
    }
    return out;
  }, [edits]);

  const apply = async (): Promise<void> => {
    if (changedEntries.length === 0) return;
    try {
      const res = await fetch('/api/dev/apply-action-edits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changedEntries),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { count: number };
      alert(`${data.count} 件を actions.overrides.json に反映しました。Next.js がホットリロードします。`);
      setEdits({});
    } catch (err) {
      alert(`反映に失敗しました: ${String(err)}`);
    }
  };

  const reset = (): void => {
    if (confirm('アクションカードの編集を破棄しますか？')) setEdits({});
  };

  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>アクションカード説明文</h2>
      <p style={{ fontSize: 12, opacity: 0.7, margin: '0 0 8px' }}>
        各アクションカードの説明文を編集可能。空にすると effect から自動生成に戻ります。
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, opacity: 0.7 }}>変更 {changedEntries.length} 件</span>
        <button
          type="button"
          onClick={apply}
          disabled={changedEntries.length === 0}
          style={{ background: '#2a6', color: '#fff', border: 'none', borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}
        >
          反映（overrides.json に書き込み）
        </button>
        <button type="button" onClick={reset} disabled={Object.keys(edits).length === 0}>
          編集を破棄
        </button>
      </div>
      <div style={{ overflow: 'auto', border: '1px solid #ccc', borderRadius: 4 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#eef', position: 'sticky', top: 0 }}>
              <Th>ID</Th>
              <Th>カード名</Th>
              <Th>説明文（空=自動生成）</Th>
            </tr>
          </thead>
          <tbody>
            {ACTIONS.map((c) => {
              const currentDesc = edits[c.id] !== undefined ? edits[c.id]! : c.description ?? '';
              const autoDesc = describeActionEffect({ ...c, description: undefined });
              const dirty = edits[c.id] !== undefined && edits[c.id] !== (c.description ?? '');
              return (
                <tr key={c.id} style={{ background: dirty ? '#fffbe6' : 'transparent', borderBottom: '1px solid #eee' }}>
                  <Td><code style={{ fontSize: 11 }}>{c.id}</code></Td>
                  <Td>{c.name}</Td>
                  <Td style={{ minWidth: 320 }}>
                    <input
                      type="text"
                      value={currentDesc}
                      onChange={(ev) => setEdits((prev) => ({ ...prev, [c.id]: ev.target.value }))}
                      style={{ ...cellInputStyle, color: currentDesc ? '#000' : '#999' }}
                      placeholder={autoDesc}
                    />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const cellInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '2px 4px',
  border: '1px solid #ddd',
  borderRadius: 2,
  fontSize: 13,
  background: '#fff',
};

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: '6px 8px',
        borderBottom: '2px solid #aac',
        fontWeight: 600,
        fontSize: 12,
      }}
    >
      {children}
    </th>
  );
}

function SortTh({
  col, cur, dir, onClick, children,
}: {
  col: SortCol; cur: SortCol; dir: SortDir; onClick: (col: SortCol) => void; children: React.ReactNode;
}) {
  const active = cur === col;
  return (
    <th
      onClick={() => onClick(col)}
      style={{
        textAlign: 'left',
        padding: '6px 8px',
        borderBottom: '2px solid #aac',
        fontWeight: 600,
        fontSize: 12,
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        background: active ? '#dde' : undefined,
      }}
    >
      {children}
      <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3 }}>
        {active ? (dir === 'asc' ? '▲' : '▼') : '▲'}
      </span>
    </th>
  );
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '4px 8px', verticalAlign: 'top', ...style }}>{children}</td>;
}

const CATEGORY_COLOR: Record<EffectCategory, string> = {
  '攻撃': '#e74c3c',
  'バフ': '#d4a017',
  'デバフ': '#8e44ad',
  '回復/防御': '#27ae60',
  '罪': '#7a2e2e',
  'その他': '#888',
};

function CategoryBadge({ cat }: { cat: EffectCategory }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      borderRadius: 10,
      fontSize: 11,
      fontWeight: 600,
      background: CATEGORY_COLOR[cat] + '22',
      color: CATEGORY_COLOR[cat],
      border: `1px solid ${CATEGORY_COLOR[cat]}55`,
    }}>
      {cat}
    </span>
  );
}
