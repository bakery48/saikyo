'use client';
import { Fragment } from 'react';
import type { ClientGameState } from '../../shared/messages';

type Step = {
  key: string;
  label: string;
  /** Mini-round separator after this step (within a round). */
  endsMini?: boolean;
  /** Big-round separator after this step. */
  endsRound?: boolean;
};

const PHASE_TO_KEY: Record<string, (round: number, miniRound: number) => string | null> = {
  pick_monster: () => 'pick',
  event: (r, m) => `r${r}m${m}-event`,
  action: (r, m) => `r${r}m${m}-action`,
  draft: (r, m) => `r${r}m${m}-draft`,
  battle: (r) => `r${r}-battle`,
  reward: (r) => `r${r}-reward`,
  tournament: () => 'tournament',
  finished: () => 'tournament', // keep T highlighted on finished screen
};

function buildSteps(): Step[] {
  const steps: Step[] = [{ key: 'pick', label: 'M', endsRound: true }];
  for (let r = 1; r <= 3; r++) {
    for (let m = 1; m <= 3; m++) {
      steps.push({ key: `r${r}m${m}-event`, label: 'I' });
      steps.push({ key: `r${r}m${m}-action`, label: 'A' });
      steps.push({
        key: `r${r}m${m}-draft`,
        label: 'D',
        endsMini: m < 3,
      });
    }
    steps.push({ key: `r${r}-battle`, label: 'B' });
    steps.push({ key: `r${r}-reward`, label: 'R', endsRound: true });
  }
  steps.push({ key: 'tournament', label: 'T' });
  return steps;
}

const STEPS = buildSteps();

const LABELS: Record<string, string> = {
  M: 'モンスター選択',
  I: 'イベント',
  A: 'アクション',
  D: 'ドラフト',
  B: 'バトル',
  R: '報酬',
  T: 'トーナメント',
};

export function PhaseProgress({ state }: { state: ClientGameState }) {
  const keyer = PHASE_TO_KEY[state.phase];
  const currentKey = keyer ? keyer(state.round, state.miniRound) : null;
  const currentIdx = currentKey ? STEPS.findIndex((s) => s.key === currentKey) : -1;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 1,
        fontSize: 11,
        marginTop: 4,
      }}
    >
      {STEPS.map((step, i) => {
        const done = currentIdx >= 0 && i < currentIdx;
        const current = i === currentIdx;
        const bg = current ? '#0066cc' : done ? '#bbb' : '#eee';
        const fg = current ? '#fff' : done ? '#fff' : '#666';
        const round = step.key.startsWith('r')
          ? Number(step.key[1])
          : null;
        const mini = /m(\d)/.exec(step.key)?.[1];
        const tooltip = `${round ? `R${round}` : ''}${mini ? ` mini ${mini}` : ''}${
          round ? ' · ' : ''
        }${LABELS[step.label] ?? step.label}`;
        return (
          <Fragment key={step.key}>
            <span
              title={tooltip}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 16,
                height: 16,
                padding: '0 4px',
                borderRadius: 3,
                background: bg,
                color: fg,
                fontWeight: current ? 700 : 500,
                lineHeight: 1,
              }}
            >
              {step.label}
            </span>
            {step.endsMini && <span style={{ opacity: 0.4, margin: '0 2px' }}>·</span>}
            {step.endsRound && <span style={{ opacity: 0.5, margin: '0 4px' }}>|</span>}
          </Fragment>
        );
      })}
    </div>
  );
}
