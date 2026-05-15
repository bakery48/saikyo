'use client';
import { useState } from 'react';
import type { ClientGameState } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';
import type { StatKey } from '../../server/engine/types';
import { BattleLogView } from './BattleLogView';

const STAT_LABEL: Record<StatKey, string> = {
  hp: 'HP +2',
  atk: 'ATK +2',
  def: 'DEF +2',
  spd: 'SPD +2',
};

export function RewardView({
  state,
  socket,
}: {
  state: ClientGameState;
  socket: GameSocket;
}) {
  const reward = state.reward;
  if (!reward) return null;
  const myId = socket.playerId;
  const iAmPending = !!myId && reward.pendingPlayerIds.includes(myId);
  const myChoice = myId ? reward.choices[myId] : undefined;

  const matchInfo = state.battle?.matches ?? [];
  const myMatch = matchInfo.find((m) => m.a === myId || m.b === myId);
  const lostMessage = myMatch
    ? `${matchPartnerName(myMatch, myId, state)} に敗北しました…`
    : '';

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>鍛え直し</h2>
      {iAmPending ? (
        <>
          <p style={{ margin: 0 }}>{lostMessage} 鍛え直す内容を選んでください:</p>
          {myChoice ? (
            <p style={{ opacity: 0.7 }}>選択済み — 他のプレイヤーを待っています…</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                onClick={() =>
                  socket.send({ type: 'submit_reward', choice: { kind: 'skill_top' } })
                }
              >
                スキルカードを引く (top of deck)
              </button>
              {(['hp', 'atk', 'def', 'spd'] as StatKey[]).map((stat) => (
                <button
                  key={stat}
                  onClick={() =>
                    socket.send({
                      type: 'submit_reward',
                      choice: { kind: 'stat_up', stat },
                    })
                  }
                >
                  {STAT_LABEL[stat]}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <p style={{ margin: 0, opacity: 0.7 }}>
          このラウンドは勝利／引き分けでした。他プレイヤーの鍛え直しを待っています…
        </p>
      )}

      <SlotReorderSection state={state} socket={socket} />

      <BattleResultsSection state={state} />
    </section>
  );
}

function SlotReorderSection({
  state,
  socket,
}: {
  state: ClientGameState;
  socket: GameSocket;
}) {
  const me = state.players.find((p) => p.id === socket.playerId);
  const monster = me?.monster;
  const [order, setOrder] = useState<string[] | null>(null);
  if (!monster || monster.actives.length === 0) return null;
  const current = order ?? monster.actives.map((a) => a.id);
  const swap = (i: number, j: number): void => {
    if (j < 0 || j >= current.length) return;
    const next = current.slice();
    [next[i], next[j]] = [next[j]!, next[i]!];
    setOrder(next);
  };
  const apply = (): void => {
    if (!order) return;
    socket.send({ type: 'reorder_slots', order });
    setOrder(null);
  };
  const reset = (): void => setOrder(null);
  const dirty = order !== null;
  return (
    <div style={{ border: '1px solid #aaa', borderRadius: 8, padding: 12, background: '#fafafa' }}>
      <h4 style={{ margin: '0 0 6px' }}>スロット順を並び替え</h4>
      <p style={{ fontSize: 11, opacity: 0.7, margin: '0 0 8px' }}>
        ↑↓ で発動順を入れ替えできます。確定するとサーバーに送信されます。
      </p>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
        {current.map((id, i) => {
          const a = monster.actives.find((x) => x.id === id);
          if (!a) return null;
          return (
            <li key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span style={{ fontWeight: 600, minWidth: 24 }}>{i + 1}.</span>
              <span style={{ flex: 1 }}>
                {a.name}
                {a.rarity && <span style={{ opacity: 0.6, marginLeft: 6 }}>[{a.rarity}]</span>}
              </span>
              <button onClick={() => swap(i, i - 1)} disabled={i === 0} style={{ padding: '2px 6px' }}>↑</button>
              <button
                onClick={() => swap(i, i + 1)}
                disabled={i === current.length - 1}
                style={{ padding: '2px 6px' }}
              >
                ↓
              </button>
            </li>
          );
        })}
      </ol>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={apply} disabled={!dirty}>
          並び順を確定
        </button>
        <button onClick={reset} disabled={!dirty} type="button">
          戻す
        </button>
      </div>
    </div>
  );
}

function BattleResultsSection({ state }: { state: ClientGameState }) {
  const matchInfo = state.battle?.matches ?? [];
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div>
      <h4 style={{ marginBottom: 6 }}>このラウンドの試合結果</h4>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 4, fontSize: 13 }}>
        {matchInfo.map((m, i) => {
          const ap = state.players.find((p) => p.id === m.a)?.name ?? m.a.slice(0, 6);
          const bp = state.players.find((p) => p.id === m.b)?.name ?? m.b.slice(0, 6);
          const verdict =
            m.winner === 'a'
              ? `${ap} 勝`
              : m.winner === 'b'
                ? `${bp} 勝`
                : '引き分け';
          const isOpen = openIdx === i;
          return (
            <li key={i} style={{ display: 'grid', gap: 4 }}>
              <button
                onClick={() => setOpenIdx(isOpen ? null : i)}
                style={{
                  textAlign: 'left',
                  padding: '4px 8px',
                  background: '#fafafa',
                  border: '1px solid #eee',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {ap} (HP {m.finalHpA}) vs {bp} (HP {m.finalHpB}) → {verdict} {isOpen ? '▾' : '▸'}
              </button>
              {isOpen && <BattleLogView match={m} players={state.players} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function matchPartnerName(
  m: { a: string; b: string },
  myId: string | null,
  state: ClientGameState,
): string {
  const otherId = m.a === myId ? m.b : m.a;
  return state.players.find((p) => p.id === otherId)?.name ?? otherId.slice(0, 6);
}
