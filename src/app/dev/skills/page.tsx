'use client';
import { useMemo, useState } from 'react';
import { SKILLS } from '../../../server/engine/cards/skills';
import {
  describeActiveEffect,
  describePassive,
} from '../../../lib/skill-text';
import type { Rarity, SkillCard } from '../../../server/engine/types';

const RARITIES: Rarity[] = ['N', 'R', 'SR', 'SSR'];

type Edits = Record<string, { name?: string; rarity?: Rarity; nameTag?: string }>;

function describeCard(c: SkillCard): string {
  if (c.active) return describeActiveEffect(c.active.effect);
  if (c.passive) return `パッシブ：${describePassive(c.passive)}`;
  return '';
}

export default function DevSkillsPage() {
  const [edits, setEdits] = useState<Edits>({});
  const [filter, setFilter] = useState('');

  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return SKILLS.filter((c) => {
      if (!f) return true;
      const blob = `${c.id} ${c.name} ${c.nameTag ?? ''} ${describeCard(c)}`.toLowerCase();
      return blob.includes(f);
    });
  }, [filter]);

  const setField = (id: string, key: 'name' | 'rarity' | 'nameTag', value: string): void => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }));
  };

  const changedEntries = useMemo(() => {
    const out: Array<{ id: string; name: string; rarity: Rarity; nameTag: string | null }> = [];
    for (const c of SKILLS) {
      const e = edits[c.id];
      if (!e) continue;
      const newName = e.name ?? c.name;
      const newRarity = (e.rarity ?? c.rarity) as Rarity;
      const newTag = e.nameTag !== undefined ? e.nameTag : c.nameTag ?? '';
      if (
        newName !== c.name ||
        newRarity !== c.rarity ||
        (newTag || '') !== (c.nameTag ?? '')
      ) {
        out.push({
          id: c.id,
          name: newName,
          rarity: newRarity,
          nameTag: newTag === '' ? null : newTag,
        });
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

  const reset = (): void => {
    if (confirm('すべての編集を破棄しますか？')) setEdits({});
  };

  return (
    <main style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h1 style={{ margin: '0 0 8px' }}>スキルカード編集（開発用）</h1>
      <p style={{ fontSize: 12, opacity: 0.7, margin: '0 0 12px' }}>
        テキスト・レアリティ・タグのみ編集可能。説明文は effect から自動生成されます。
        編集はメモリ内のみ。コピーボタンで変更分のJSONを取得し、手動で <code>skills.ts</code> に反映してください。
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
              <Th>説明（自動）</Th>
              <Th>種別</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const e = edits[c.id] ?? {};
              const dirty =
                (e.name !== undefined && e.name !== c.name) ||
                (e.rarity !== undefined && e.rarity !== c.rarity) ||
                (e.nameTag !== undefined && (e.nameTag || '') !== (c.nameTag ?? ''));
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
                      onChange={(ev) => setField(c.id, 'rarity', ev.target.value)}
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
                  <Td>
                    <span style={{ fontSize: 12, opacity: 0.85 }}>{describeCard(c)}</span>
                  </Td>
                  <Td>
                    <span style={{ fontSize: 11, opacity: 0.6 }}>
                      {c.active ? 'active' : c.passive ? 'passive' : '-'}
                    </span>
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

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '4px 8px', verticalAlign: 'top' }}>{children}</td>;
}
