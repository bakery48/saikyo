import type { GameState, Player, RewardChoice, StatKey } from '../types';
import { drawTop } from '../deck';
import { addSkillCardToMonster, getPlayer, makeRng, saveRng } from '../state';

/** Magnitude of each stat-up reward. */
export const STAT_UP_AMOUNT: Record<StatKey, number> = {
  hp: 24,
  atk: 2,
  def: 2,
  spd: 2,
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
  // After an extra-battle (triggered by an event card), return to the
  // regular end-of-round battle instead of advancing the round.
  if (state.returnToBattleAfterReward) {
    state.returnToBattleAfterReward = false;
    state.phase = 'battle';
    state.log.push({
      kind: 'phase_change',
      phase: 'battle',
      round: state.round,
      miniRound: state.miniRound,
    });
    return;
  }
  if (state.round >= state.totalRounds) {
    // All rounds complete — proceed to tournament without incrementing round.
    state.miniRound = 1;
    state.phase = 'tournament';
    state.log.push({
      kind: 'phase_change',
      phase: 'tournament',
      round: state.round,
      miniRound: state.miniRound,
    });
    return;
  }
  state.round += 1;
  state.miniRound = 1;
  state.phase = 'action';
  state.log.push({
    kind: 'phase_change',
    phase: 'action',
    round: state.round,
    miniRound: state.miniRound,
  });
}
