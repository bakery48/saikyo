import {
  resolveMonsterPickSubRound,
  submitMonsterPick,
} from '../src/server/engine/state';
import { greedyPolicy, type Policy } from '../src/server/engine/policy';
import type { GameState } from '../src/server/engine/types';

/**
 * Drive the monster-pick draft to completion using the given policy.
 * Mirrors what the GameRunner does for tests that bypass the runner.
 */
export function completeMonsterPicks(
  state: GameState,
  policy: Policy = greedyPolicy,
): void {
  let safety = 32;
  while (state.phase === 'pick_monster' && state.monsterPick && safety-- > 0) {
    const draft = state.monsterPick;
    for (const pid of draft.pendingPlayerIds) {
      const m = policy.pickMonster(state, pid, draft.pool);
      submitMonsterPick(state, pid, m.baseId);
    }
    if (resolveMonsterPickSubRound(state)) break;
  }
}
