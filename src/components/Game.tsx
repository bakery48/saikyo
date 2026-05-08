'use client';
import type { GameSocket } from '../lib/useGameSocket';
import { MonsterPickView } from './game/MonsterPickView';
import { DraftView } from './game/DraftView';
import { AutoPhaseView } from './game/AutoPhaseView';
import { RewardView } from './game/RewardView';
import { ChampionView } from './game/ChampionView';
import { PlayerPanel } from './game/PlayerPanel';

const PHASE_LABEL: Record<string, string> = {
  setup: 'セットアップ',
  pick_monster: 'モンスター選択',
  event: 'イベントフェーズ',
  action: 'アクションフェーズ',
  draft: 'ドラフトフェーズ',
  battle: '戦闘フェーズ',
  reward: '報酬選択',
  tournament: '最終トーナメント',
  finished: '終了',
};

export function Game({ socket }: { socket: GameSocket }) {
  const state = socket.game;
  if (!state) return <p>ゲームデータを待機中...</p>;
  const currentPickerId = state.phase === 'pick_monster' ? state.pickOrder[state.pickIdx] : null;

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <header
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'baseline',
          borderBottom: '1px solid #ddd',
          paddingBottom: 8,
        }}
      >
        <strong>{PHASE_LABEL[state.phase] ?? state.phase}</strong>
        <span style={{ opacity: 0.7, fontSize: 13 }}>
          R{state.round} / mini {state.miniRound}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.6 }}>
          deck: event {state.deckCounts.event} · action {state.deckCounts.action} · skill{' '}
          {state.deckCounts.skill}
        </span>
      </header>

      {renderPhase(state.phase, state, socket)}

      <div>
        <h4 style={{ marginBottom: 6 }}>プレイヤー</h4>
        <PlayerPanel
          players={state.players}
          selfId={socket.playerId}
          highlight={currentPickerId ?? null}
        />
      </div>

      {state.recentLog.length > 0 && state.phase !== 'finished' && (
        <details>
          <summary>ログ ({state.recentLog.length})</summary>
          <pre
            style={{
              maxHeight: 200,
              overflow: 'auto',
              background: '#fafafa',
              padding: 8,
              fontSize: 11,
            }}
          >
            {state.recentLog.map((e) => JSON.stringify(e)).join('\n')}
          </pre>
        </details>
      )}
    </section>
  );
}

function renderPhase(
  phase: string,
  state: NonNullable<GameSocket['game']>,
  socket: GameSocket,
): JSX.Element {
  switch (phase) {
    case 'pick_monster':
      return <MonsterPickView state={state} socket={socket} />;
    case 'draft':
      return <DraftView state={state} socket={socket} />;
    case 'reward':
      return <RewardView state={state} socket={socket} />;
    case 'finished':
      return <ChampionView state={state} socket={socket} />;
    default:
      return <AutoPhaseView state={state} label={PHASE_LABEL[phase] ?? phase} />;
  }
}
