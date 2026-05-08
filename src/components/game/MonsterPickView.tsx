'use client';
import type { ClientGameState } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';

export function MonsterPickView({
  state,
  socket,
}: {
  state: ClientGameState;
  socket: GameSocket;
}) {
  const currentId = state.pickOrder[state.pickIdx];
  const currentPlayer = state.players.find((p) => p.id === currentId);
  const isMyTurn = currentId === socket.playerId;

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>モンスター選択 ({state.pickIdx + 1}/8)</h2>
      <p style={{ margin: 0, opacity: 0.8 }}>
        {isMyTurn ? '👉 あなたの番です。モンスターを選んでください。' : `${currentPlayer?.name ?? '???'} の番です…`}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
        {state.monsterPool.map((m) => (
          <button
            key={m.baseId}
            disabled={!isMyTurn}
            onClick={() => socket.send({ type: 'submit_pick', baseId: m.baseId })}
            style={{
              border: '1px solid #aaa',
              borderRadius: 8,
              padding: 12,
              background: isMyTurn ? '#fff' : '#f7f7f7',
              cursor: isMyTurn ? 'pointer' : 'not-allowed',
              textAlign: 'left',
            }}
          >
            <div style={{ fontWeight: 600 }}>{m.name}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              HP{m.stats.hp} ATK{m.stats.atk} DEF{m.stats.def} SPD{m.stats.spd}
            </div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
              {m.passives.map((p) => p.name).join(', ')}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
