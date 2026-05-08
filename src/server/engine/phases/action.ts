import type { ActionCard, GameState, Player } from '../types';
import { drawTop } from '../deck';
import { addSkillCardToMonster, makeRng, saveRng } from '../state';

function applyActionEffect(state: GameState, player: Player, card: ActionCard): void {
  if (!player.monster) return;
  const rng = makeRng(state);
  switch (card.effect.kind) {
    case 'stat_mod': {
      if (card.effect.duration === 'permanent') {
        player.monster.stats[card.effect.stat] += card.effect.amount;
      } else {
        // next_battle: queue as pending buff
        player.pendingBuffs.push({
          stat: card.effect.stat,
          amount: card.effect.amount,
          duration: 'next_battle',
        });
      }
      break;
    }
    case 'recover_skill_from_grave': {
      if (state.decks.skillGrave.length === 0) break;
      const idx = rng.int(0, state.decks.skillGrave.length - 1);
      const skill = state.decks.skillGrave.splice(idx, 1)[0]!;
      addSkillCardToMonster(state, player, skill);
      break;
    }
    case 'draw_skill_top': {
      const top = drawTop(state.decks.skill, state.decks.skillGrave, rng);
      if (top) addSkillCardToMonster(state, player, top);
      break;
    }
    case 'discard_random_active': {
      if (player.monster.actives.length === 0) break;
      const idx = rng.int(0, player.monster.actives.length - 1);
      player.monster.actives.splice(idx, 1);
      // Re-number orders after removal.
      player.monster.actives.forEach((s, i) => (s.order = i + 1));
      break;
    }
    case 'gain_passive': {
      player.monster.passives.push({ ...card.effect.passive });
      break;
    }
  }
  saveRng(state, rng);
}

/**
 * Resolve action phase for all players in seat order.
 * Each player draws 1 card from the common action deck and plays it.
 */
export function resolveActionPhase(state: GameState): void {
  if (state.phase !== 'action') throw new Error('not in action phase');
  for (const player of state.players) {
    if (!player.monster) continue;
    const rng = makeRng(state);
    const card = drawTop(state.decks.action, state.decks.actionGrave, rng);
    saveRng(state, rng);
    if (!card) continue;
    state.log.push({ kind: 'action_played', playerId: player.id, cardId: card.id });
    applyActionEffect(state, player, card);
    state.decks.actionGrave.push(card);
  }
  state.phase = 'draft';
  state.log.push({
    kind: 'phase_change',
    phase: 'draft',
    round: state.round,
    miniRound: state.miniRound,
  });
}
