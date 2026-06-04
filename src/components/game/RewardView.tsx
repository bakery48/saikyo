'use client';
import { useState } from 'react';
import type { ClientGameState } from '../../shared/messages';
import type { GameSocket } from '../../lib/useGameSocket';
import type { StatKey } from '../../server/engine/types';
import { BattleLogView } from './BattleLogView';

const STAT_LABEL: Record<StatKey, string> = {
  hp: 'HP +24',
  atk: 'ATK +2',
  def: 'DEF +2',
  spd: 'SPD +2',
};

const STAT_POP_COLOR: Record<StatKey, string> = {
  hp: '#4caf50',
  atk: '#f44336',
  def: '#2196f3',
  spd: '#ff9800',
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

  const [popAnim, setPopAnim] = useState<{ key: number; label: string; color: string } | null>(null);

  const matchInfo = state.battle?.matches ?? [];
  const myMatch = matchInfo.find((m) => m.a === myId || m.b === myId);
  const lostMessage = myMatch
    ? `${matchPartnerName(myMatch, myId, state)} に敗北しました…`
    : '';

  const handleStatUp = (stat: StatKey) => {
    setPopAnim({ key: Date.now(), label: STAT_LABEL[stat], color: STAT_POP_COLOR[stat] });
    socket.send({ type: 'submit_reward', choice: { kind: 'stat_up', stat } });
  };

  const handleSkillTop = () => {
    setPopAnim({ key: Date.now(), label: 'スキル獲得！', color: '#9c27b0' });
    socket.send({ type: 'submit_reward', choice: { kind: 'skill_top' } });
  };

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>鍛え直し</h2>
      {iAmPending ? (
        <>
          <p style={{ margin: 0 }}>{lostMessage} 鍛え直す内容を選んでください:</p>
          {myChoice ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <p style={{ opacity: 0.7, margin: 0 }}>選択済み — 他のプレイヤーを待っています…</p>
              {popAnim && (
                <span
                  key={popAnim.key}
                  className="reward-pop"
                  style={{ color: popAnim.color, top: 0, left: 0 }}
                >
                  {popAnim.label}
                </span>
              )}
            </div>
          ) : (
            <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button onClick={handleSkillTop}>
                スキルカードを引く
              </button>
              {(['hp', 'atk', 'def', 'spd'] as StatKey[]).map((stat) => (
                <button
                  key={stat}
                  onClick={() => handleStatUp(stat)}
                >
                  {STAT_LABEL[stat]}
                </button>
              ))}
              {popAnim && (
                <span
                  key={popAnim.key}
                  className="reward-pop"
                  style={{ color: popAnim.color, top: -8, left: 0 }}
                >
                  {popAnim.label}
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <p style={{ margin: 0, opacity: 0.7 }}>
          このラウンドは勝利／引き分けでした。他プレイヤーの鍛え直しを待っています…
        </p>
      )}

      <BattleResultsSection state={state} />
    </section>
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
