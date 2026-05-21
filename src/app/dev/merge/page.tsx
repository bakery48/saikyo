'use client';
import { useMemo, useState } from 'react';
import { SKILLS } from '../../../server/engine/cards/skills';
import rawOverrides from '../../../server/engine/cards/skills.overrides.json';

type OvEntry = {
  name?: string;
  nameTag?: string;
  rarity?: string;
  description?: string;
  attackKind?: string;
};
const overrides = rawOverrides as Record<string, OvEntry>;

const FIELDS = ['name', 'nameTag', 'rarity', 'description', 'attackKind'] as const;
type Field = (typeof FIELDS)[number];

interface Conflict {
  id: string;
  cardNameInSkills: string;
  field: Field;
  skillsValue: string;
  overridesValue: string;
}

const skillMap = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

function getSkillField(id: string, field: Field): string {
  const s = skillMap[id];
  if (!s) return '';
  if (field === 'attackKind') return (s.active?.effect as any)?.attackKind ?? '';
  return (s as any)[field] ?? '';
}

export default function MergePage() {
  const { conflicts, unknownIds } = useMemo(() => {
    const conflicts: Conflict[] = [];
    const unknownIds: string[] = [];
    for (const [id, ov] of Object.entries(overrides)) {
      if (!skillMap[id]) {
        unknownIds.push(id);
        continue;
      }
      for (const field of FIELDS) {
        const ovVal = (ov as any)[field];
        if (ovVal === undefined) continue;
        const skillVal = getSkillField(id, field);
        if (String(ovVal) !== String(skillVal)) {
          conflicts.push({
            id,
            cardNameInSkills: skillMap[id].name,
            field,
            skillsValue: skillVal,
            overridesValue: String(ovVal),
          });
        }
      }
    }
    return { conflicts, unknownIds };
  }, []);

  const [choices, setChoices] = useState<Record<string, 'skills' | 'overrides'>>(() =>
    Object.fromEntries(conflicts.map((c) => [`${c.id}:${c.field}`, 'skills']))
  );

  const setChoice = (id: string, field: string, val: 'skills' | 'overrides') =>
    setChoices((prev) => ({ ...prev, [`${id}:${field}`]: val }));

  const selectAllField = (field: Field, val: 'skills' | 'overrides') =>
    setChoices((prev) => {
      const next = { ...prev };
      for (const c of conflicts) if (c.field === field) next[`${c.id}:${c.field}`] = val;
      return next;
    });

  const selectAll = (val: 'skills' | 'overrides') =>
    setChoices(Object.fromEntries(conflicts.map((c) => [`${c.id}:${c.field}`, val])));

  // Group conflicts by card ID
  const grouped = useMemo(() => {
    const map = new Map<string, Conflict[]>();
    for (const c of conflicts) {
      if (!map.has(c.id)) map.set(c.id, []);
      map.get(c.id)!.push(c);
    }
    return map;
  }, [conflicts]);

  // Text output: show cards where at least one "overrides" was chosen
  const output = useMemo(() => {
    const lines: string[] = [];
    lines.push('=== overrides 採用分（skills.ts への反映候補） ===\n');
    for (const [id, cs] of grouped) {
      const overrideWins = cs.filter((c) => (choices[`${c.id}:${c.field}`] ?? 'skills') === 'overrides');
      if (overrideWins.length === 0) continue;
      lines.push(`[${id}] ${skillMap[id]?.name ?? '?'}`);
      for (const c of overrideWins) {
        lines.push(`  ${c.field}: "${c.skillsValue || '(なし)'}" → "${c.overridesValue}"`);
      }
    }
    if (lines.length === 1) lines.push('（なし）');

    lines.push('\n=== skills.ts 維持分 ===\n');
    for (const [id, cs] of grouped) {
      const skillsWins = cs.filter((c) => (choices[`${c.id}:${c.field}`] ?? 'skills') === 'skills');
      if (skillsWins.length === 0) continue;
      lines.push(`[${id}] ${skillMap[id]?.name ?? '?'}`);
      for (const c of skillsWins) {
        lines.push(`  ${c.field}: "${c.skillsValue || '(なし)'}" を維持（overrides: "${c.overridesValue}"）`);
      }
    }

    if (unknownIds.length > 0) {
      lines.push('\n=== overrides にあるが skills.ts に存在しない ID（スキップ） ===\n');
      for (const id of unknownIds) {
        const ov = overrides[id];
        lines.push(`[${id}] name=${ov?.name ?? '?'} nameTag=${ov?.nameTag ?? '?'}`);
      }
    }

    return lines.join('\n');
  }, [grouped, choices, unknownIds]);

  const fieldBgSkills = '#e8f5e9';
  const fieldBgOverrides = '#fff3e0';

  const th: React.CSSProperties = {
    padding: '6px 10px',
    textAlign: 'left',
    borderBottom: '2px solid #ccc',
    background: '#eef',
    position: 'sticky',
    top: 0,
  };
  const td: React.CSSProperties = { padding: '4px 8px', verticalAlign: 'middle' };

  return (
    <div style={{ padding: 16, fontFamily: 'monospace', fontSize: 13 }}>
      <h2 style={{ marginTop: 0 }}>skills.ts vs overrides.json 競合解決</h2>
      <p style={{ color: '#666', marginTop: 0 }}>
        競合 {conflicts.length} 件 / 不明ID {unknownIds.length} 件
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={() => selectAll('skills')}>全部 skills.ts</button>
        <button onClick={() => selectAll('overrides')}>全部 overrides</button>
        {FIELDS.map((f) => (
          <span key={f} style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => selectAllField(f, 'skills')}>{f}: skills.ts</button>
            <button onClick={() => selectAllField(f, 'overrides')}>{f}: overrides</button>
          </span>
        ))}
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #ccc', borderRadius: 4, maxHeight: '55vh', overflowY: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>skills.ts カード名</th>
              <th style={th}>フィールド</th>
              <th style={{ ...th, background: fieldBgSkills }}>skills.ts 値</th>
              <th style={{ ...th, background: fieldBgOverrides }}>overrides 値</th>
              <th style={th}>採用</th>
            </tr>
          </thead>
          <tbody>
            {conflicts.map((c) => {
              const key = `${c.id}:${c.field}`;
              const choice = choices[key] ?? 'skills';
              return (
                <tr
                  key={key}
                  style={{
                    borderBottom: '1px solid #eee',
                    background: choice === 'overrides' ? '#fffbe6' : 'transparent',
                  }}
                >
                  <td style={td}>
                    <code style={{ fontSize: 11 }}>{c.id}</code>
                  </td>
                  <td style={td}>{c.cardNameInSkills}</td>
                  <td style={td}>
                    <span
                      style={{
                        background: '#e0e0e0',
                        borderRadius: 3,
                        padding: '1px 5px',
                        fontSize: 11,
                      }}
                    >
                      {c.field}
                    </span>
                  </td>
                  <td
                    style={{
                      ...td,
                      background: choice === 'skills' ? fieldBgSkills : undefined,
                      fontWeight: choice === 'skills' ? 'bold' : undefined,
                    }}
                  >
                    {c.skillsValue || <em style={{ color: '#bbb' }}>(なし)</em>}
                  </td>
                  <td
                    style={{
                      ...td,
                      background: choice === 'overrides' ? fieldBgOverrides : undefined,
                      fontWeight: choice === 'overrides' ? 'bold' : undefined,
                    }}
                  >
                    {c.overridesValue || <em style={{ color: '#bbb' }}>(なし)</em>}
                  </td>
                  <td style={td}>
                    <label style={{ marginRight: 10, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name={key}
                        checked={choice === 'skills'}
                        onChange={() => setChoice(c.id, c.field, 'skills')}
                      />
                      {' '}skills
                    </label>
                    <label style={{ cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name={key}
                        checked={choice === 'overrides'}
                        onChange={() => setChoice(c.id, c.field, 'overrides')}
                      />
                      {' '}overrides
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>テキスト出力</h3>
          <button onClick={() => navigator.clipboard.writeText(output)}>📋 コピー</button>
        </div>
        <textarea
          value={output}
          readOnly
          style={{
            width: '100%',
            height: 280,
            fontFamily: 'monospace',
            fontSize: 12,
            boxSizing: 'border-box',
            border: '1px solid #ccc',
            borderRadius: 4,
            padding: 8,
          }}
        />
      </div>
    </div>
  );
}
