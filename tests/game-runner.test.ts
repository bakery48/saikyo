import { describe, expect, it } from 'vitest';
import { GameRunner } from '../src/server/game-runner';

const human = { id: 'h1', name: 'Human' };

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

  it('with 1 human, pauses on monster pick waiting for them', () => {
    const runner = new GameRunner({ roomId: 'r1', seed: 42, humans: [human] });
    runner.advance();
    expect(runner.state.phase).toBe('pick_monster');
    const currentId = runner.state.pickOrder[runner.state.pickIdx];
    expect(currentId).toBe(human.id);
    // CPUs before us should already have picked.
    const beforeMe = runner.state.players.filter((p) => p.monster);
    expect(beforeMe.length).toBe(runner.state.pickIdx);
  });

  it('after human pick, advances through cpu picks and pauses on draft for human', () => {
    const runner = new GameRunner({ roomId: 'r1', seed: 42, humans: [human] });
    runner.advance();
    const baseId = runner.state.monsterPool[0]!.baseId;
    runner.submitPick(human.id, baseId);
    runner.advance();
    expect(runner.state.phase).toBe('draft');
    expect(runner.state.draft).not.toBeNull();
    expect(runner.state.draft!.pendingPlayerIds).toContain(human.id);
    // The CPUs should have already submitted their picks.
    const submitted = Object.keys(runner.state.draft!.submittedPicks);
    expect(submitted.length).toBe(7);
    expect(submitted).not.toContain(human.id);
  });

  it('after human draft pick, advances through resolution and into next phase', () => {
    const runner = new GameRunner({ roomId: 'r1', seed: 42, humans: [human] });
    runner.advance();
    runner.submitPick(human.id, runner.state.monsterPool[0]!.baseId);
    runner.advance();
    // Pick a card the CPUs have not picked (look for one in pool not in submittedPicks).
    const used = new Set(Object.values(runner.state.draft!.submittedPicks));
    const unused = runner.state.draft!.pool.find((c) => !used.has(c.id))!;
    runner.submitDraft(human.id, unused.id);
    runner.advance();
    // Either we advanced past draft, or we're on a later mini-round/phase.
    expect(runner.state.phase).not.toBe('pick_monster');
  });

  it('full game with 1 human (auto-picks first option each time) completes', () => {
    const runner = new GameRunner({ roomId: 'r1', seed: 1234, humans: [human] });
    runner.advance();
    let safety = 200;
    while (runner.state.phase !== 'finished' && safety-- > 0) {
      switch (runner.state.phase) {
        case 'pick_monster':
          runner.submitPick(human.id, runner.state.monsterPool[0]!.baseId);
          break;
        case 'draft': {
          const used = new Set(Object.values(runner.state.draft!.submittedPicks));
          const unused = runner.state.draft!.pool.find((c) => !used.has(c.id))
            ?? runner.state.draft!.pool[0]!;
          runner.submitDraft(human.id, unused.id);
          break;
        }
        case 'reward':
          runner.submitReward(human.id, { kind: 'skill_top' });
          break;
      }
      runner.advance();
    }
    expect(runner.state.phase).toBe('finished');
    expect(runner.state.champion).not.toBeNull();
  });

  it('toClientState hides skill deck contents (counts only)', () => {
    const runner = new GameRunner({ roomId: 'r1', seed: 1, humans: [] });
    const cs = runner.toClientState();
    expect(typeof cs.deckCounts.skill).toBe('number');
    expect(cs).not.toHaveProperty('decks');
  });
});
