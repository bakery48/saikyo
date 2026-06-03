'use client';
import type { ClientGameState } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';

const CONFETTI_COLORS = ['#ffd700','#ff6b6b','#4ecdc4','#a29bfe','#fd79a8','#55efc4','#fdcb6e','#e17055'];
const CONFETTI_COUNT = 28;

function Confetti() {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998, overflow: 'hidden' }}>
      {Array.from({ length: CONFETTI_COUNT }, (_, i) => {
        const left = `${(i / CONFETTI_COUNT) * 100 + (Math.sin(i * 2.3) * 6)}%`;
        const delay = `${(i % 7) * 0.18}s`;
        const duration = `${2.2 + (i % 5) * 0.3}s`;
        const size = 7 + (i % 5) * 2;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]!;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: `-${10 + (i % 4) * 5}px`,
              left,
              width: size,
              height: size * 0.6,
              borderRadius: 2,
              background: color,
              animation: `confetti-fall ${duration} ${delay} ease-in forwards`,
            }}
          />
        );
      })}
    </div>
  );
}

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
    <section style={{ display: 'grid', gap: 20 }}>
      <Confetti />
      <div
        style={{
          textAlign: 'center',
          animation: 'champion-pop 0.6s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 8 }}>🏆</div>
        <h2
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 900,
            color: '#d4a000',
            animation: 'champion-glow 2s ease-in-out infinite',
            letterSpacing: '0.04em',
          }}
        >
          {player?.name ?? '???'}
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 16, opacity: 0.75 }}>
          {champ.monster.name}
        </p>
      </div>

      <div
        style={{
          background: 'linear-gradient(135deg, #fffbe6, #fef6ff)',
          border: '2px solid #d4a000',
          borderRadius: 14,
          padding: 20,
          animation: 'champion-pop 0.7s 0.15s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          {(['hp','atk','def','spd'] as const).map((s) => (
            <div key={s} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#999', letterSpacing: '0.08em' }}>{s.toUpperCase()}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#333' }}>{champ.monster.stats[s]}</div>
            </div>
          ))}
        </div>
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 13, opacity: 0.7 }}>
            アクティブスキル ({champ.monster.actives.length})
          </summary>
          <ul style={{ marginTop: 4 }}>
            {champ.monster.actives.map((a) => (
              <li key={a.id} style={{ fontSize: 13 }}>
                スロット{a.order} {a.name} {a.rarity ? `[${a.rarity}]` : ''}
              </li>
            ))}
          </ul>
        </details>
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 13, opacity: 0.7 }}>
            パッシブスキル ({champ.monster.passives.length})
          </summary>
          <ul style={{ marginTop: 4 }}>
            {champ.monster.passives.map((p) => (
              <li key={p.id} style={{ fontSize: 13 }}>{p.name}</li>
            ))}
          </ul>
        </details>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button onClick={() => socket.send({ type: 'leave_game' })}>ロビーに戻る</button>
      </div>
    </section>
  );
}
