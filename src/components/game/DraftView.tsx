'use client';
import type { ClientGameState } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';

const RARITY_COLOR: Record<string, string> = {
  N: '#888',
  R: '#3a78ff',
  SR: '#a050ff',
  SSR: '#ffa033',
};

export function DraftView({
  state,
  socket,
}: {
  state: ClientGameState;
  socket: GameSocket;
}) {
  const draft = state.draft;
  if (!draft) return <p>ドラフト準備中...</p>;
  const myPick = socket.playerId ? draft.submittedPicks[socket.playerId] : undefined;
  const iAmPending = draft.pendingPlayerIds.includes(socket.playerId ?? '');
  const submittedCount = Object.keys(draft.submittedPicks).length;

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>ドラフト (R{state.round} M{state.miniRound})</h2>
      <p style={{ margin: 0, opacity: 0.8 }}>
        {iAmPending && !myPick
          ? '👉 1枚選んでください。被ったら不選択カードから再ドラフトです。'
          : `${submittedCount}/${draft.pendingPlayerIds.length} が選択済み — 待機中…`}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
        {draft.pool.map((c) => {
          const picked = myPick === c.id;
          return (
            <button
              key={c.id}
              disabled={!iAmPending || !!myPick}
              onClick={() => socket.send({ type: 'submit_draft', skillId: c.id })}
              style={{
                border: `2px solid ${picked ? '#0066cc' : RARITY_COLOR[c.rarity] ?? '#aaa'}`,
                borderRadius: 8,
                padding: 12,
                background: picked ? '#e6f0ff' : '#fff',
                cursor: iAmPending && !myPick ? 'pointer' : 'default',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 11, color: RARITY_COLOR[c.rarity] ?? '#888' }}>{c.rarity}</div>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>
                {describeSkill(c)}
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>試行: {draft.attempt + 1} 回目</div>
    </section>
  );
}

function describeSkill(c: import('../../server/engine/types').SkillCard): string {
  if (c.active) {
    const e = c.active.effect;
    switch (e.kind) {
      case 'attack':
        return `${e.useStat.toUpperCase()}×${e.mult} 攻撃`;
      case 'true_damage':
        return `DEF無視 ${e.amount} ダメージ`;
      case 'heal':
        return `HP+${e.amount} 回復`;
      case 'shield':
        return `次の被ダメ−${e.amount}`;
      case 'buff_self':
        return `自身${e.stat.toUpperCase()}+${e.amount}(${e.duration})`;
      case 'debuff_target':
        return `相手${e.stat.toUpperCase()}−${e.amount}(${e.duration})`;
      case 'next_amp':
        return `次の自分の攻撃×${e.mult}`;
      case 'nullify_next':
        return `相手の次のスキルを無効`;
    }
  }
  return '';
}
