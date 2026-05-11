'use client';
import { useMemo, useState } from 'react';
import { SKILLS } from '../../../server/engine/cards/skills';
import { describeSkillCard } from '../../../lib/skill-text';
import type { AttackKind, Rarity, SkillCard, SkillEffect } from '../../../server/engine/types';

const RARITIES: Rarity[] = ['N', 'R', 'SR', 'SSR'];
const ATTACK_KINDS: AttackKind[] = ['strike', 'sword', 'claw', 'magic', 'passthrough'];
const ATTACK_KIND_LABEL: Record<AttackKind, string> = {
  strike: '打撃',
  sword: '剣',
  claw: '爪',
  magic: '魔法',
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

export default function DevSkillsPage() {
  const [edits, setEdits] = useState<Edits>({});
  const [filter, setFilter] = useState('');

  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return SKILLS.filter((c) => {
      if (!f) return true;
      const blob = `${c.id} ${c.name} ${c.nameTag ?? ''} ${describeSkillCard(c)}`.toLowerCase();
      return blob.includes(f);
    });
  }, [filter]);

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
          placeholder="検索（名前・タグ・説明・ID）"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ padding: '4px 8px', minWidth: 240 }}
        />
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
              <Th>ID</Th>
              <Th>レアリティ</Th>
              <Th>カード名</Th>
              <Th>タグ</Th>
              <Th>説明文（空=自動生成）</Th>
              <Th>種別</Th>
              <Th>攻撃属性</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
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
                  key={c.id}
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
                    <span style={{ fontSize: 11, opacity: 0.6 }}>
                      {c.active ? 'active' : c.passive ? 'passive' : '-'}
                    </span>
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
    </main>
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

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '4px 8px', verticalAlign: 'top', ...style }}>{children}</td>;
}
