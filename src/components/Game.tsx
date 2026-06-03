'use client';
import { useEffect, useRef, useState } from 'react';
import type { GameSocket } from '../lib/useGameSocket';
import type { ClientGameState } from '../shared/messages';
import { MonsterPickView } from './game/MonsterPickView';
import { BoonPickView } from './game/BoonPickView';
import { DraftView } from './game/DraftView';
import { AutoPhaseView } from './game/AutoPhaseView';
import { BattleAnimationView } from './game/BattleAnimationView';
import { EventPhaseView } from './game/EventPhaseView';
import { ActionPhaseView } from './game/ActionPhaseView';
import { RewardView } from './game/RewardView';
import { BuildPhaseView } from './game/BuildPhaseView';
import { ChampionView } from './game/ChampionView';
import { PlayerPanel } from './game/PlayerPanel';
import { MyMonsterPanel } from './game/MyMonsterPanel';
import { ActionHandPanel } from './game/ActionHandPanel';
import { DeckInspector } from './game/DeckInspector';
import { DevTools } from './game/DevTools';
import { PhaseProgress } from './game/PhaseProgress';
import { RulesButton } from './game/RulesModal';
import { MonsterCodexButton } from './game/MonsterCodexModal';
import { BgmPlayer } from './BgmPlayer';

const PHASE_LABEL: Record<string, string> = {
  setup: 'セットアップ',
  pick_monster: 'モンスター選択',
  pick_boon: '恩恵選択',
  event: 'イベントフェーズ',
  action: 'アクションフェーズ',
  draft: 'ドラフトフェーズ',
  build: 'ビルドフェーズ',
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
    case 'build':
      return `ラウンド${state.round} ${label}`;
    case 'battle':
    case 'reward':
      return `ラウンド${state.round} ${label}`;
    default:
      return label;
  }
}

function RoundBadge({ state }: { state: ClientGameState }) {
  const inRound = ['event', 'action', 'draft', 'build', 'battle', 'reward'].includes(state.phase);
  if (!inRound) return null;
  const showMini = ['event', 'action', 'draft', 'build'].includes(state.phase);
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        background: '#e8f0ff',
        color: '#2255aa',
        whiteSpace: 'nowrap',
      }}
    >
      R{state.round}/{state.totalRounds}
      {showMini && <> · M{state.miniRound}/{state.miniRoundsPerRound}</>}
    </span>
  );
}

function PhaseTransitionBanner({ state }: { state: ClientGameState }) {
  const phaseKey = `${state.phase}-${state.round}-${state.miniRound}`;
  const [bannerKey, setBannerKey] = useState<string | null>(null);
  const [bannerLabel, setBannerLabel] = useState('');
  const prevKey = useRef(phaseKey);

  useEffect(() => {
    if (phaseKey === prevKey.current) return;
    prevKey.current = phaseKey;
    const label = PHASE_LABEL[state.phase] ?? state.phase;
    setBannerLabel(label);
    setBannerKey(phaseKey);
    const t = setTimeout(() => setBannerKey(null), 850);
    return () => clearTimeout(t);
  }, [phaseKey, state.phase]);

  if (!bannerKey) return null;
  return (
    <div
      key={bannerKey}
      className="phase-banner"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(90deg, #0a1a3a, #0066cc, #0a1a3a)',
          color: '#fff',
          fontWeight: 800,
          fontSize: 18,
          letterSpacing: '0.12em',
          padding: '10px 32px',
          borderRadius: '0 0 12px 12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        }}
      >
        {bannerLabel}
      </div>
    </div>
  );
}

export function Game({ socket }: { socket: GameSocket }) {
  const state = socket.game;
  if (!state) return <p>ゲームデータを待機中...</p>;

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <PhaseTransitionBanner state={state} />
      <header
        style={{
          borderBottom: '1px solid #ddd',
          paddingBottom: 8,
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (window.confirm('ゲームから退出しますか？')) {
                socket.send({ type: 'leave_game' });
              }
            }}
            style={{
              fontSize: 12,
              padding: '4px 10px',
              cursor: 'pointer',
              border: '1px solid #c44',
              borderRadius: 4,
              background: '#fff',
              color: '#c44',
              fontWeight: 600,
            }}
          >
            退出
          </button>
          <strong>{formatPhaseTitle(state)}</strong>
          <RoundBadge state={state} />
          <RulesButton />
          <MonsterCodexButton />
          <BgmPlayer />
          <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.6 }}>
            deck: event {state.deckCounts.event} · action {state.deckCounts.action} · skill{' '}
            {state.deckCounts.skill}
          </span>
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
    case 'pick_boon':
      return <BoonPickView state={state} socket={socket} />;
    case 'event':
      return <EventPhaseView state={state} />;
    case 'action':
      return <ActionPhaseView state={state} socket={socket} />;
    case 'draft':
      return <DraftView state={state} socket={socket} />;
    case 'build':
      return <BuildPhaseView state={state} socket={socket} />;
    case 'battle':
      return <BattleAnimationView state={state} socket={socket} />;
    case 'tournament':
      return <BattleAnimationView state={state} socket={socket} />;
    case 'reward':
      return <RewardView state={state} socket={socket} />;
    case 'finished':
      return <ChampionView state={state} socket={socket} />;
    default:
      return <AutoPhaseView state={state} label={PHASE_LABEL[phase] ?? phase} />;
  }
}
