'use client';
import type { Monster } from '../../server/engine/types';
import { activeTooltip, passiveTooltip } from '../../lib/skill-text';
import { SkillNameHover } from './SkillNameHover';

const RARITY_COLOR: Record<string, string> = {
  N: '#888',
  R: '#3a78ff',
  SR: '#a050ff',
  SSR: '#ffa033',
};

/**
 * Read-only details view of a monster: stats + actives + passives.
 * Shared between MyMonsterPanel (for self) and PlayerPanel (for others).
 */
export function MonsterDetails({ monster }: { monster: Monster }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, fontSize: 13, flexWrap: 'wrap' }}>
        <span>HP {monster.stats.hp}</span>
        <span>ATK {monster.stats.atk}</span>
        <span>DEF {monster.stats.def}</span>
        <span>SPD {monster.stats.spd}</span>
      </div>

      <div>
        <h4 style={{ margin: '0 0 4px' }}>パッシブ ({monster.passives.length})</h4>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
          {monster.passives.map((p) => (
            <li
              key={p.id}
              style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}
            >
              <SkillNameHover label={p.name} tooltip={passiveTooltip(p)}>
                {p.rarity && (
                  <span style={{ color: RARITY_COLOR[p.rarity] ?? '#888', marginLeft: 4 }}>
                    [{p.rarity}]
                  </span>
                )}
              </SkillNameHover>
              {p.nameTag && <em style={{ opacity: 0.65 }}>→ {p.nameTag}</em>}
            </li>
          ))}
          {monster.passives.length === 0 && (
            <li style={{ fontSize: 12, opacity: 0.6 }}>パッシブなし</li>
          )}
        </ul>
      </div>

      <div>
        <h4 style={{ margin: '0 0 4px' }}>アクティブ ({monster.actives.length})</h4>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
          {monster.actives.map((a) => (
            <li
              key={a.id}
              style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}
            >
              <SkillNameHover label={`${a.order}. ${a.name}`} tooltip={activeTooltip(a)}>
                {a.rarity && (
                  <span style={{ color: RARITY_COLOR[a.rarity] ?? '#888', marginLeft: 4 }}>
                    [{a.rarity}]
                  </span>
                )}
              </SkillNameHover>
              {a.nameTag && <em style={{ opacity: 0.65 }}>→ {a.nameTag}</em>}
            </li>
          ))}
          {monster.actives.length === 0 && (
            <li style={{ fontSize: 12, opacity: 0.6 }}>まだアクティブスキルがありません</li>
          )}
        </ul>
      </div>
    </div>
  );
}
