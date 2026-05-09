'use client';
import type { ClientGameState } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';

export function ChampionView({
  state,
  socket,
}: {
  state: ClientGameState;
  socket: GameSocket;
}) {
  const champ = state.champion;
  if (!champ) return <p>結果集計中...</p>;
  const player = state.players.find((p) => p.id === champ.playerId);
  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>🏆 優勝</h2>
      <div
        style={{
          background: 'linear-gradient(135deg, #fff3e0, #fef6ff)',
          border: '2px solid #d4a000',
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h3 style={{ margin: 0 }}>
          {player?.name ?? '???'} — {champ.monster.name}
        </h3>
        <p style={{ margin: '8px 0 4px' }}>
          HP{champ.monster.stats.hp} ATK{champ.monster.stats.atk} DEF{champ.monster.stats.def}{' '}
          SPD{champ.monster.stats.spd}
        </p>
        <details>
          <summary>アクティブスキル ({champ.monster.actives.length})</summary>
          <ul style={{ marginTop: 4 }}>
            {champ.monster.actives.map((a) => (
              <li key={a.id} style={{ fontSize: 13 }}>
                スロット{a.order} {a.name} {a.rarity ? `[${a.rarity}]` : ''}
              </li>
            ))}
          </ul>
        </details>
        <details>
          <summary>パッシブスキル ({champ.monster.passives.length})</summary>
          <ul style={{ marginTop: 4 }}>
            {champ.monster.passives.map((p) => (
              <li key={p.id} style={{ fontSize: 13 }}>
                {p.name}
              </li>
            ))}
          </ul>
        </details>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => socket.send({ type: 'leave_game' })}>ロビーに戻る</button>
      </div>
    </section>
  );
}
