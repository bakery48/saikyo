'use client';
import type { BattleEvent, BattleMatch, BattleMonsterSnapshot } from '../../server/engine/types';
import type { ClientPlayer } from '../../shared/messages';

export function BattleLogView({
  match,
  players,
}: {
  match: BattleMatch;
  players: ClientPlayer[];
}) {
  const aName = players.find((p) => p.id === match.a)?.name ?? match.a.slice(0, 6);
  const bName = match.b === match.a ? '(bye)' : players.find((p) => p.id === match.b)?.name ?? match.b.slice(0, 6);
  const verdict =
    match.winner === 'a' ? `${aName} 勝` : match.winner === 'b' ? `${bName} 勝` : '引き分け';
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: 8, fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        {aName} (HP {match.finalHpA}) vs {bName} (HP {match.finalHpB}) — {verdict}
      </div>
      <ul
        style={{
          listStyle: 'none',
          padding: 4,
          margin: 0,
          background: '#fafafa',
          maxHeight: 220,
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: 11,
        }}
      >
        {match.log.map((e, i) => (
          <li key={i} style={{ padding: '2px 0' }}>
            {formatBattleEvent(e, aName, bName)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function durLabel(d: 'once' | 'battle'): string {
  return d === 'battle' ? 'バトル中' : '次の1回';
}

function reasonLabel(r: 'hp_zero' | 'tiebreak_hp' | 'tiebreak_spd' | 'draw'): string {
  switch (r) {
    case 'hp_zero': return 'HP0';
    case 'tiebreak_hp': return 'HP差で決着';
    case 'tiebreak_spd': return 'SPD差で決着';
    case 'draw': return '引き分け';
  }
}

function formatBattleEvent(e: BattleEvent, aName: string, bName: string): string {
  const who = (s: 'a' | 'b') => (s === 'a' ? aName : bName);
  switch (e.kind) {
    case 'battle_start': {
      const fmt = (m: BattleMonsterSnapshot) => {
        const st = m.stats;
        const passives = m.passives.map((p) => p.name).join('、') || 'なし';
        const actives =
          m.actives
            .slice()
            .sort((x, y) => x.order - y.order)
            .map((x) => x.name)
            .join('、') || 'なし';
        return `${m.name}（${m.baseId}） HP${st.hp} ATK${st.atk} DEF${st.def} SPD${st.spd} / パッシブ: ${passives} / スロット: ${actives}`;
      };
      return `[開始] ${fmt(e.a)}  VS  ${fmt(e.b)}`;
    }
    case 'roll':
      return `${who(e.player)} SPD${e.spd}+ダイス${e.die}=${e.total}`;
    case 'first':
      return `→ ${who(e.player)} が先攻`;
    case 'skill_use':
      return `${who(e.player)} が「${e.name}」を使用`;
    case 'damage':
      return `  ${who(e.from)} → ${who(e.to)} に ${e.amount} ダメージ（HP ${e.hpAfter}）`;
    case 'miss':
      return `  ${who(e.from)} の攻撃をかわした（MISS）`;
    case 'heal':
      return `  ${who(e.player)} HP+${e.amount} → ${e.hpAfter}`;
    case 'shield':
      return `  ${who(e.player)} シールド+${e.amount}`;
    case 'shield_absorb':
      return `  ${who(e.player)} シールドが${e.absorbed}ダメージを吸収`;
    case 'buff':
      return `  ${who(e.player)} ${e.stat.toUpperCase()}+${e.amount}（${durLabel(e.duration)}）`;
    case 'debuff':
      return `  ${who(e.player)} ${e.stat.toUpperCase()}-${e.amount}（${durLabel(e.duration)}）`;
    case 'nullified':
      return `  ${who(e.player)} のスキルが無効化`;
    case 'amp_set':
      return `  ${who(e.player)} 次ダメージ×${e.mult}`;
    case 'passive':
      return `  ${who(e.player)} パッシブ発動（${e.passiveId}）`;
    case 'paralysis_applied':
      return `  ${who(e.player)} に麻痺[${e.stacks}]付与`;
    case 'turn_skipped':
      return `  ${who(e.player)} のターンをスキップ（麻痺）`;
    case 'actives_shuffled':
      return `  ${who(e.player)} の残りスロット順をシャッフル`;
    case 'skill_fizzle':
      return e.selfDamage > 0
        ? `  ${who(e.player)} のスキルが不発（自分に ${e.selfDamage} ダメージ）`
        : `  ${who(e.player)} のスキルが不発`;
    case 'hp_swap':
      return `  ${who(e.playerA)} と ${who(e.playerB)} がHPを交換（${e.hpA} ↔ ${e.hpB}）`;
    case 'sin_bonus': {
      const parts: string[] = [`ATK+${e.atk}`];
      if (e.def > 0) parts.push(`DEF+${e.def}`);
      if (e.spd > 0) parts.push(`SPD+${e.spd}`);
      return `  ${who(e.player)} 罪の力が覚醒（罪${e.sinCount}個 → ${parts.join('/')}）`;
    }
    case 'end':
      return e.reason === 'draw'
        ? `=== 引き分け`
        : `=== ${who(e.winner as 'a' | 'b')} 勝利（${reasonLabel(e.reason)}）`;
  }
}
