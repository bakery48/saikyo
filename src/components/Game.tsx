'use client';
import type { GameSocket } from '../lib/useGameSocket';
import type { ClientGameState } from '../shared/messages';
import { MonsterPickView } from './game/MonsterPickView';
import { DraftView } from './game/DraftView';
import { AutoPhaseView } from './game/AutoPhaseView';
import { BattleAnimationView } from './game/BattleAnimationView';
import { EventPhaseView } from './game/EventPhaseView';
import { ActionPhaseView } from './game/ActionPhaseView';
import { RewardView } from './game/RewardView';
import { ChampionView } from './game/ChampionView';
import { PlayerPanel } from './game/PlayerPanel';
import { MyMonsterPanel } from './game/MyMonsterPanel';
import { ActionHandPanel } from './game/ActionHandPanel';
import { DeckInspector } from './game/DeckInspector';
import { DevTools } from './game/DevTools';
import { PhaseProgress } from './game/PhaseProgress';
import { RulesButton } from './game/RulesModal';
import { BgmPlayer } from './BgmPlayer';

const PHASE_LABEL: Record<string, string> = {
  setup: 'セットアップ',
  pick_monster: 'モンスター選択',
  event: 'イベントフェーズ',
  action: 'アクションフェーズ',
  draft: 'ドラフトフェーズ',
  battle: '戦闘フェーズ',
  reward: '鍛え直し',
  tournament: '最終トーナメント',
  finished: '終了',
};

/**
 * Verbose phase title:
 *   pick_monster      → "モンスター選択"
 *   event/action/draft → "ラウンド1 ドラフトフェーズ2"
 *   battle/reward     → "ラウンド1 戦闘フェーズ"
 *   tournament/finished → label only
 */
function formatPhaseTitle(state: ClientGameState): string {
  const label = PHASE_LABEL[state.phase] ?? state.phase;
  switch (state.phase) {
    case 'event':
    case 'action':
    case 'draft':
      return `ラウンド${state.round} ${label}${state.miniRound}`;
    case 'battle':
    case 'reward':
      return `ラウンド${state.round} ${label}`;
    default:
      return label;
  }
}

export function Game({ socket }: { socket: GameSocket }) {
  const state = socket.game;
  if (!state) return <p>ゲームデータを待機中...</p>;

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <header
        style={{
          borderBottom: '1px solid #ddd',
          paddingBottom: 8,
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>{formatPhaseTitle(state)}</strong>
          <RulesButton />
          <BgmPlayer />
          <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.6 }}>
            deck: event {state.deckCounts.event} · action {state.deckCounts.action} · skill{' '}
            {state.deckCounts.skill}
          </span>
          <button
            onClick={() => {
              if (window.confirm('ゲームから退出しますか？')) {
                socket.send({ type: 'leave_game' });
              }
            }}
            style={{
              fontSize: 12,
              padding: '2px 8px',
              cursor: 'pointer',
              border: '1px solid #c44',
              borderRadius: 4,
              background: '#fff',
              color: '#c44',
            }}
          >
            退出
          </button>
        </div>
        <PhaseProgress state={state} />
      </header>

      <MyMonsterPanel state={state} socket={socket} />

      <ActionHandPanel state={state} />

      {renderPhase(state.phase, state, socket)}

      <div>
        <h4 style={{ marginBottom: 6 }}>プレイヤー</h4>
        <PlayerPanel players={state.players} selfId={socket.playerId} />
      </div>

      <DeckInspector state={state} />

      <DevTools state={state} socket={socket} />

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
    case 'event':
      return <EventPhaseView state={state} />;
    case 'action':
      return <ActionPhaseView state={state} socket={socket} />;
    case 'draft':
      return <DraftView state={state} socket={socket} />;
    case 'battle':
      return <BattleAnimationView state={state} socket={socket} />;
    case 'reward':
      return <RewardView state={state} socket={socket} />;
    case 'finished':
      return <ChampionView state={state} socket={socket} />;
    default:
      return <AutoPhaseView state={state} label={PHASE_LABEL[phase] ?? phase} />;
  }
}
