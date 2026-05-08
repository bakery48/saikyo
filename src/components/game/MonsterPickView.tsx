'use client';
import type { ClientGameState } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';
import { MONSTERS } from '../../server/engine/cards/monsters';

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

  // Build the picked map from players' chosen monsters: baseId -> player.
  const pickedBy = new Map<string, { id: string; name: string; isCPU: boolean; order: number }>();
  state.players.forEach((p) => {
    if (p.monster) {
      const order = state.pickOrder.indexOf(p.id);
      pickedBy.set(p.monster.baseId, { id: p.id, name: p.name, isCPU: p.isCPU, order });
    }
  });

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>モンスター選択 ({state.pickIdx}/8)</h2>
      <p style={{ margin: 0, opacity: 0.8 }}>
        {state.pickIdx >= state.pickOrder.length
          ? 'モンスター選択完了'
          : isMyTurn
            ? '👉 あなたの番です。モンスターを選んでください。'
            : `${currentPlayer?.name ?? '???'} の番です…`}
      </p>

      <PickOrderStrip state={state} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 8,
        }}
      >
        {MONSTERS.map((m) => {
          const taken = pickedBy.get(m.baseId);
          const isMe = taken?.id === socket.playerId;
          const canPick = isMyTurn && !taken;
          return (
            <button
              key={m.baseId}
              disabled={!canPick}
              onClick={() => canPick && socket.send({ type: 'submit_pick', baseId: m.baseId })}
              style={{
                position: 'relative',
                border: `2px solid ${
                  isMe ? '#0066cc' : taken ? '#aaa' : canPick ? '#0a8' : '#ccc'
                }`,
                borderRadius: 8,
                padding: 12,
                background: taken ? '#f0f0f0' : canPick ? '#fff' : '#fafafa',
                color: taken ? '#666' : 'inherit',
                cursor: canPick ? 'pointer' : 'not-allowed',
                textAlign: 'left',
                opacity: taken ? 0.7 : 1,
              }}
            >
              {taken && (
                <div
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 6,
                    fontSize: 10,
                    background: isMe ? '#0066cc' : '#666',
                    color: '#fff',
                    borderRadius: 4,
                    padding: '1px 6px',
                  }}
                >
                  {taken.order + 1}番目: {taken.name}
                  {taken.isCPU ? ' 🤖' : ''}
                </div>
              )}
              <div style={{ fontWeight: 600, marginTop: taken ? 14 : 0 }}>{m.name}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                HP{m.stats.hp} ATK{m.stats.atk} DEF{m.stats.def} SPD{m.stats.spd}
              </div>
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
                {m.passives.map((p) => p.name).join(', ')}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Visual strip showing the pick order with current pointer. */
function PickOrderStrip({ state }: { state: ClientGameState }) {
  return (
    <ol
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        fontSize: 12,
      }}
    >
      {state.pickOrder.map((pid, i) => {
        const player = state.players.find((p) => p.id === pid);
        const done = i < state.pickIdx;
        const current = i === state.pickIdx;
        return (
          <li
            key={pid}
            style={{
              padding: '3px 8px',
              borderRadius: 12,
              background: current ? '#0066cc' : done ? '#bbb' : '#eee',
              color: current ? '#fff' : done ? '#fff' : '#333',
              fontWeight: current ? 600 : 400,
            }}
          >
            {i + 1}. {player?.name ?? pid.slice(0, 6)}
            {player?.monster ? ` → ${player.monster.name}` : ''}
          </li>
        );
      })}
    </ol>
  );
}
