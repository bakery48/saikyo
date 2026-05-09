import type { GameState, Player, RewardChoice, StatKey } from '../types';
import { drawTop } from '../deck';
import { addSkillCardToMonster, getPlayer, makeRng, saveRng } from '../state';

/** Magnitude of each stat-up reward. HP gets a larger bump because its scale is bigger. */
export const STAT_UP_AMOUNT: Record<StatKey, number> = {
  hp: 5,
  atk: 1,
  def: 1,
  spd: 1,
};

/** Submit one player's reward choice. */
export function submitReward(state: GameState, playerId: string, choice: RewardChoice): void {
  if (state.phase !== 'reward' || !state.reward) throw new Error('not in reward phase');
  if (!state.reward.pendingPlayerIds.includes(playerId)) {
    throw new Error(`player ${playerId} is not pending reward`);
  }
  state.reward.choices[playerId] = choice;
}

export function allRewardsIn(state: GameState): boolean {
  if (!state.reward) return false;
  return state.reward.pendingPlayerIds.every((id) => state.reward!.choices[id]);
}

/** Apply all queued reward choices and advance to the next round (or tournament). */
export function resolveRewardPhase(state: GameState): void {
  if (state.phase !== 'reward' || !state.reward) throw new Error('not in reward phase');
  if (!allRewardsIn(state)) throw new Error('not all reward choices submitted');
  for (const playerId of state.reward.pendingPlayerIds) {
    const player = getPlayer(state, playerId);
    const choice = state.reward.choices[playerId]!;
    applyReward(state, player, choice);
    state.log.push({ kind: 'reward_chosen', playerId, choice });
  }
  state.battle = null;
  state.reward = null;
  advanceFromReward(state);
}

function applyReward(state: GameState, player: Player, choice: RewardChoice): void {
  if (!player.monster) return;
  if (choice.kind === 'stat_up') {
    player.monster.stats[choice.stat] += STAT_UP_AMOUNT[choice.stat];
  } else {
    const rng = makeRng(state);
    const top = drawTop(state.decks.skill, state.decks.skillGrave, rng);
    saveRng(state, rng);
    if (top) addSkillCardToMonster(state, player, top);
  }
}

function advanceFromReward(state: GameState): void {
  state.round += 1;
  state.miniRound = 1;
  if (state.round > state.totalRounds) {
    // Should not happen — the last round ends with tournament, not reward.
    state.phase = 'finished';
    return;
  }
  state.phase = 'event';
  state.log.push({
    kind: 'phase_change',
    phase: 'event',
    round: state.round,
    miniRound: state.miniRound,
  });
}
