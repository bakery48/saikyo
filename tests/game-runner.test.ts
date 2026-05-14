import { describe, expect, it } from 'vitest';
import { GameRunner } from '../src/server/game-runner';

const human = { id: 'h1', name: 'Human' };

/**
 * Submit a choice for the human in whatever phase the runner is paused on,
 * then advance. Returns false once the human is no longer being waited on in
 * that phase (or the game finished), so callers can drive to a target phase.
 */
function actForHuman(runner: GameRunner): void {
  const s = runner.state;
  switch (s.phase) {
    case 'pick_monster': {
      if (!s.monsterPick || s.monsterPick.submittedPicks[human.id]) break;
      if (!s.monsterPick.pendingPlayerIds.includes(human.id)) break;
      runner.submitPick(human.id, s.monsterPick.pool[0]!.baseId);
      break;
    }
    case 'draft': {
      if (!s.draft || s.draft.submittedPicks[human.id]) break;
      if (!s.draft.pendingPlayerIds.includes(human.id)) break;
      const used = new Set(Object.values(s.draft.submittedPicks));
      const unused = s.draft.pool.find((c) => !used.has(c.id)) ?? s.draft.pool[0]!;
      runner.submitDraft(human.id, unused.id);
      break;
    }
    case 'action': {
      if (!s.actionPhase || s.actionPhase.submittedPlays[human.id]) break;
      if (!s.actionPhase.pendingPlayerIds.includes(human.id)) break;
      const me = s.players.find((p) => p.id === human.id)!;
      const card = me.actionHand[0]!;
      const extras =
        card.effect.kind === 'stat_mod_choice'
          ? { chosenStat: 'atk' as const }
          : card.effect.kind === 'swap_actives'
            ? { swap: { targetPlayerId: human.id, skillIdA: '', skillIdB: '' } }
            : undefined;
      // swap_actives with no valid target would throw; fall back to another card.
      if (card.effect.kind === 'swap_actives') {
        const alt = me.actionHand.find((c) => c.effect.kind !== 'swap_actives');
        if (alt) {
          runner.submitAction(human.id, alt.id);
          break;
        }
      }
      runner.submitAction(human.id, card.id, extras);
      break;
    }
    case 'reward':
      if (!s.reward || s.reward.choices[human.id]) break;
      if (!s.reward.pendingPlayerIds.includes(human.id)) break;
      runner.submitReward(human.id, { kind: 'skill_top' });
      break;
  }
}

/** Drive the runner until it reaches `target` phase or finishes. */
function driveToPhase(runner: GameRunner, target: GameRunner['state']['phase']): void {
  let safety = 300;
  while (runner.state.phase !== target && runner.state.phase !== 'finished' && safety-- > 0) {
    actForHuman(runner);
    runner.advance();
  }
}

describe('GameRunner', () => {
  it('with all-CPU room runs to finished after a single advance call', () => {
    const runner = new GameRunner({
      roomId: 'r1',
      seed: 42,
      humans: [], // 0 humans -> 8 CPUs
    });
    runner.advance();
    expect(runner.state.phase).toBe('finished');
    expect(runner.state.champion).not.toBeNull();
  });

  it('with 1 human, pauses in pick_monster waiting for them', () => {
    const runner = new GameRunner({ roomId: 'r1', seed: 42, humans: [human] });
    runner.advance();
    expect(runner.state.phase).toBe('pick_monster');
    expect(runner.state.monsterPick).not.toBeNull();
    expect(runner.state.monsterPick!.pendingPlayerIds).toContain(human.id);
    // CPUs should have already submitted their picks.
    const submitted = Object.keys(runner.state.monsterPick!.submittedPicks);
    expect(submitted.length).toBeGreaterThanOrEqual(1);
    expect(submitted).not.toContain(human.id);
  });

  it('after human pick, advances through cpu picks and pauses on draft for human', () => {
    const runner = new GameRunner({ roomId: 'r1', seed: 42, humans: [human] });
    runner.advance();
    driveToPhase(runner, 'draft');
    expect(runner.state.phase).toBe('draft');
    expect(runner.state.draft).not.toBeNull();
    expect(runner.state.draft!.pendingPlayerIds).toContain(human.id);
    // The CPUs should have already submitted their draft picks.
    const submitted = Object.keys(runner.state.draft!.submittedPicks);
    expect(submitted.length).toBe(7);
    expect(submitted).not.toContain(human.id);
  });

  it('after human draft pick, advances through resolution and into next phase', () => {
    const runner = new GameRunner({ roomId: 'r1', seed: 42, humans: [human] });
    runner.advance();
    driveToPhase(runner, 'draft');
    const used = new Set(Object.values(runner.state.draft!.submittedPicks));
    const unused = runner.state.draft!.pool.find((c) => !used.has(c.id))!;
    runner.submitDraft(human.id, unused.id);
    runner.advance();
    expect(runner.state.phase).not.toBe('pick_monster');
  });

  it('full game with 1 human (auto-picks first option each time) completes', () => {
    const runner = new GameRunner({ roomId: 'r1', seed: 1234, humans: [human] });
    runner.advance();
    driveToPhase(runner, 'finished');
    expect(runner.state.phase).toBe('finished');
    expect(runner.state.champion).not.toBeNull();
  });

  it('toClientState hides skill deck contents (counts only)', () => {
    const runner = new GameRunner({ roomId: 'r1', seed: 1, humans: [] });
    const cs = runner.toClientState();
    expect(typeof cs.deckCounts.skill).toBe('number');
    expect(cs).not.toHaveProperty('decks');
  });

  it('every player has a color in the client state', () => {
    const runner = new GameRunner({ roomId: 'r1', seed: 1, humans: [] });
    const cs = runner.toClientState();
    for (const p of cs.players) expect(p.color).toBeTypeOf('string');
    expect(new Set(cs.players.map((p) => p.color)).size).toBe(8);
  });
});
