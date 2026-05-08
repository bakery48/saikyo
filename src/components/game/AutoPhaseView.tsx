'use client';
import type { ClientGameState, ClientPlayer } from '../../shared/messages';

/**
 * Read-only view shown for phases that the client doesn't influence
 * (event/action/battle/tournament). Server will broadcast a fresh state
 * shortly after these resolve.
 */
export function AutoPhaseView({ state, label }: { state: ClientGameState; label: string }) {
  const recent = state.recentLog.slice(-12);
  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>{label}</h2>
      <p style={{ margin: 0, opacity: 0.8 }}>解決中...</p>
      <ul
        style={{
          listStyle: 'none',
          padding: 8,
          margin: 0,
          background: '#fafafa',
          border: '1px solid #ddd',
          borderRadius: 6,
          maxHeight: 240,
          overflowY: 'auto',
          fontSize: 12,
          fontFamily: 'monospace',
        }}
      >
        {recent.map((e, i) => (
          <li key={i} style={{ padding: '2px 0' }}>
            {formatEvent(e, state.players)}
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatEvent(
  e: import('../../server/engine/types').GameEvent,
  players: ClientPlayer[],
): string {
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? id.slice(0, 6);
  switch (e.kind) {
    case 'phase_change':
      return `→ ${e.phase} (R${e.round} M${e.miniRound})`;
    case 'monster_pick_revealed':
      return `monster pool: ${e.baseIds.length} revealed`;
    case 'monster_pick_submitted':
      return `${name(e.playerId)} → ${e.baseId} (placed)`;
    case 'monster_pick_resolved':
      return `monster pick resolved: ${Object.keys(e.assignments).length} unique`;
    case 'monster_pick_conflict':
      return `monster conflict: ${e.baseId} (${e.players.map(name).join(', ')})`;
    case 'monster_picked':
      return `${name(e.playerId)} → ${e.baseId}`;
    case 'event_played':
      return `event: ${e.cardId} -> ${e.targets.map(name).join(', ')}`;
    case 'event_effect_applied':
      return `  ${name(e.playerId)} ← ${e.cardId}`;
    case 'action_played':
      return `action: ${name(e.playerId)} played ${e.cardId}`;
    case 'skill_acquired':
      return `${name(e.playerId)} got skill ${e.skillId} [${e.rarity}]`;
    case 'draft_revealed':
      return `draft pool: ${e.cards.length} cards revealed`;
    case 'draft_pick_submitted':
      return `${name(e.playerId)} picked ${e.skillId}`;
    case 'draft_resolved':
      return `draft resolved: ${Object.keys(e.assignments).length} unique`;
    case 'draft_conflict':
      return `conflict: ${e.skillId} (${e.players.map(name).join(', ')})`;
    case 'draft_fallback':
      return `${name(e.playerId)} fallback ← ${e.skillId}`;
    case 'battle_match':
      return `battle: ${name(e.a)} vs ${name(e.b)} → ${e.winner}`;
    case 'reward_chosen':
      return `${name(e.playerId)} reward: ${e.choice.kind === 'stat_up' ? `+stat(${e.choice.stat})` : 'skill'}`;
    case 'tournament_match':
      return `[T${e.round}] ${name(e.a)} vs ${name(e.b)} → ${name(e.winner)}`;
    case 'champion':
      return `🏆 Champion: ${name(e.playerId)}`;
  }
}
