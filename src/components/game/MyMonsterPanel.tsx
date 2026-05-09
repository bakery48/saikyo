'use client';
import { useEffect, useState } from 'react';
import type { ClientGameState } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';
import {
  composeMonsterName,
  extractPrefixTags,
  getAvailableTags,
  getBaseName,
  NAME_SEPARATOR,
  validateMonsterName,
} from '../../server/engine/naming';
import { COLOR_LABEL, pieceStyle } from '../../lib/colors';
import { activeTooltip, passiveTooltip } from '../../lib/skill-text';
import { SkillNameHover } from './SkillNameHover';

const RARITY_COLOR: Record<string, string> = {
  N: '#888',
  R: '#3a78ff',
  SR: '#a050ff',
  SSR: '#ffa033',
};

export function MyMonsterPanel({
  state,
  socket,
}: {
  state: ClientGameState;
  socket: GameSocket;
}) {
  const me = state.players.find((p) => p.id === socket.playerId);
  const monster = me?.monster ?? null;
  // Editable prefix only — the base monster name is fixed and always rendered as a suffix.
  const [prefix, setPrefix] = useState('');

  // Sync the prefix from the server-side name on changes.
  useEffect(() => {
    if (!monster) return;
    setPrefix(extractPrefixTags(monster.name, monster).join(NAME_SEPARATOR));
  }, [monster?.name]);

  if (!me || !monster) {
    return (
      <details
        open
        style={{
          border: '1px solid #ccc',
          borderRadius: 8,
          padding: 12,
          background: '#f7f9fc',
        }}
      >
        <summary style={{ fontWeight: 600 }}>あなたのモンスター</summary>
        <p style={{ opacity: 0.7, marginTop: 8 }}>まだモンスターを選択していません。</p>
      </details>
    );
  }

  const tags = getAvailableTags(monster);
  const tagCounts = tagMultiset(tags);
  const baseName = getBaseName(monster);
  const prefixTags = prefix
    .split(NAME_SEPARATOR)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const composedName = composeMonsterName(prefixTags, monster);
  const isValid = validateMonsterName(composedName, monster);
  const canSubmit = isValid && composedName !== monster.name && state.phase !== 'finished';

  const appendTag = (tag: string): void => {
    setPrefix((prev) => (prev.trim().length === 0 ? tag : `${prev}${NAME_SEPARATOR}${tag}`));
  };

  return (
    <details
      open
      style={{
        border: '1px solid #aaa',
        borderRadius: 8,
        padding: 12,
        background: '#f0f8ff',
      }}
    >
      <summary style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span title={COLOR_LABEL[me.color]} style={pieceStyle(me.color, { size: 14 })} />
        あなたのモンスター: {monster.name} (HP{monster.stats.hp} ATK{monster.stats.atk} DEF
        {monster.stats.def} SPD{monster.stats.spd})
      </summary>

      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        <StatBlock monster={monster} pendingBuffsCount={me.pendingBuffsCount} />

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
          <h4 style={{ margin: '0 0 4px' }}>名前を変更</h4>
          <p style={{ fontSize: 11, opacity: 0.7, margin: '0 0 6px' }}>
            獲得済みタグを「・」で繋いで「<strong>{baseName}</strong>」の前に付けられます (例: パワー・{baseName})。
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="(タグなし)"
              maxLength={60 - baseName.length - 1}
              style={{
                flex: '1 1 200px',
                padding: '4px 8px',
                fontSize: 14,
                border: `1px solid ${isValid ? '#ccc' : '#e88'}`,
                borderRadius: 4,
              }}
            />
            <span style={{ fontSize: 14, opacity: 0.85 }}>
              {prefixTags.length > 0 ? NAME_SEPARATOR : ''}
              <strong>{baseName}</strong>
            </span>
            <button
              onClick={() => socket.send({ type: 'rename_monster', name: composedName })}
              disabled={!canSubmit}
            >
              変更
            </button>
            <button onClick={() => setPrefix('')} type="button" style={{ fontSize: 12 }}>
              クリア
            </button>
          </div>
          {!isValid && prefix.trim().length > 0 && (
            <p style={{ fontSize: 11, color: '#c44', margin: '4px 0 0' }}>
              使えないタグが含まれています。下のタグから選んでください。
            </p>
          )}
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 11, opacity: 0.7 }}>使えるタグ: </span>
            {Object.entries(tagCounts).length === 0 ? (
              <em style={{ fontSize: 11, opacity: 0.6 }}>まだタグがありません</em>
            ) : (
              Object.entries(tagCounts).map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => appendTag(tag)}
                  style={{
                    fontSize: 11,
                    padding: '2px 6px',
                    margin: '0 4px 4px 0',
                    border: '1px solid #aaa',
                    borderRadius: 12,
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                  title={`${count}枚保有`}
                >
                  {tag}
                  {count > 1 ? ` ×${count}` : ''}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </details>
  );
}

function StatBlock({
  monster,
  pendingBuffsCount,
}: {
  monster: NonNullable<ClientGameState['players'][number]['monster']>;
  pendingBuffsCount: number;
}) {
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 13, flexWrap: 'wrap' }}>
      <span>HP {monster.stats.hp}</span>
      <span>ATK {monster.stats.atk}</span>
      <span>DEF {monster.stats.def}</span>
      <span>SPD {monster.stats.spd}</span>
      {pendingBuffsCount > 0 && (
        <span style={{ opacity: 0.75 }}>次戦バフ ×{pendingBuffsCount}</span>
      )}
    </div>
  );
}

function tagMultiset(tags: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of tags) out[t] = (out[t] ?? 0) + 1;
  return out;
}
