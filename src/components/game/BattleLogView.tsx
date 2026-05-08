'use client';
import type { BattleEvent, BattleMatch } from '../../server/engine/types';
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

function formatBattleEvent(e: BattleEvent, aName: string, bName: string): string {
  const who = (s: 'a' | 'b') => (s === 'a' ? aName : bName);
  switch (e.kind) {
    case 'roll':
      return `${who(e.player)} rolls SPD${e.spd}+d${e.die}=${e.total}`;
    case 'first':
      return `→ ${who(e.player)} goes first`;
    case 'skill_use':
      return `${who(e.player)} uses ${e.name}`;
    case 'damage':
      return `  ${who(e.from)} → ${who(e.to)} dmg ${e.amount} (HP ${e.hpAfter})`;
    case 'heal':
      return `  ${who(e.player)} +HP ${e.amount} → ${e.hpAfter}`;
    case 'shield':
      return `  ${who(e.player)} shield +${e.amount}`;
    case 'buff':
      return `  ${who(e.player)} ${e.stat}+${e.amount} (${e.duration})`;
    case 'debuff':
      return `  ${who(e.player)} ${e.stat}-${e.amount} (${e.duration})`;
    case 'nullified':
      return `  ${who(e.player)} skill nullified`;
    case 'amp_set':
      return `  ${who(e.player)} amp x${e.mult}`;
    case 'passive':
      return `  ${who(e.player)} passive ${e.passiveId}`;
    case 'end':
      return `=== ${e.winner} (${e.reason})`;
  }
}
