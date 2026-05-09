import type {
  ActionCard,
  ActionPhaseSummary,
  ActionPhaseState,
  GameState,
  Player,
  StatKey,
} from '../types';
import { drawTop } from '../deck';
import { addSkillCardToMonster, makeRng, saveRng } from '../state';
import { describeActionEffect } from '../../../lib/card-text';

const VALID_STATS: StatKey[] = ['hp', 'atk', 'def', 'spd'];

function applyActionEffect(
  state: GameState,
  player: Player,
  card: ActionCard,
  chosenStat?: StatKey,
): void {
  if (!player.monster) return;
  const rng = makeRng(state);
  switch (card.effect.kind) {
    case 'stat_mod': {
      if (card.effect.duration === 'permanent') {
        player.monster.stats[card.effect.stat] += card.effect.amount;
      } else {
        player.pendingBuffs.push({
          stat: card.effect.stat,
          amount: card.effect.amount,
          duration: 'next_battle',
        });
      }
      break;
    }
    case 'stat_mod_choice': {
      if (!chosenStat) break;
      if (card.effect.duration === 'permanent') {
        player.monster.stats[chosenStat] += card.effect.amount;
      } else {
        player.pendingBuffs.push({
          stat: chosenStat,
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
 * Begin the action phase: every player with a monster draws one action card
 * into their personal hand and is added to the pending list. Players then
 * pick one card from their hand to play.
 */
export function startActionPhase(state: GameState): void {
  if (state.phase !== 'action') throw new Error('not in action phase');
  if (state.actionPhase) return; // already started

  const rng = makeRng(state);
  const pending: string[] = [];
  for (const player of state.players) {
    if (!player.monster) continue;
    const card = drawTop(state.decks.action, state.decks.actionGrave, rng);
    if (card) player.actionHand.push(card);
    pending.push(player.id);
  }
  saveRng(state, rng);

  const phaseState: ActionPhaseState = {
    pendingPlayerIds: pending,
    submittedPlays: {},
  };
  state.actionPhase = phaseState;
}

/**
 * Submit a player's chosen card (must be present in their hand). For cards
 * whose effect is `stat_mod_choice`, `chosenStat` must also be supplied.
 */
export function submitActionPlay(
  state: GameState,
  playerId: string,
  cardId: string,
  chosenStat?: StatKey,
): void {
  if (state.phase !== 'action' || !state.actionPhase) {
    throw new Error('not in action phase');
  }
  const phase = state.actionPhase;
  if (!phase.pendingPlayerIds.includes(playerId)) {
    throw new Error(`player ${playerId} is not pending`);
  }
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`player not found: ${playerId}`);
  const card = player.actionHand.find((c) => c.id === cardId);
  if (!card) throw new Error(`card ${cardId} not in player's hand`);
  if (card.effect.kind === 'stat_mod_choice') {
    if (!chosenStat || !VALID_STATS.includes(chosenStat)) {
      throw new Error('chosenStat is required for this card');
    }
  }
  phase.submittedPlays[playerId] = { cardId, chosenStat };
}

export function allActionPlaysIn(state: GameState): boolean {
  const phase = state.actionPhase;
  if (!phase) return false;
  return phase.pendingPlayerIds.every((id) => !!phase.submittedPlays[id]);
}

/**
 * Apply every submitted play, move used cards to the graveyard, fill the
 * action-phase summary, and advance to the draft phase.
 */
export function resolveActionPhase(state: GameState): void {
  if (state.phase !== 'action') throw new Error('not in action phase');
  if (!state.actionPhase) throw new Error('action phase not started');
  if (!allActionPlaysIn(state)) throw new Error('not all plays submitted');

  const summary: ActionPhaseSummary = { plays: [] };
  for (const player of state.players) {
    const play = state.actionPhase.submittedPlays[player.id];
    if (!play) continue;
    const idx = player.actionHand.findIndex((c) => c.id === play.cardId);
    if (idx < 0) continue;
    const card = player.actionHand.splice(idx, 1)[0]!;
    state.log.push({ kind: 'action_played', playerId: player.id, cardId: card.id });
    applyActionEffect(state, player, card, play.chosenStat);
    state.decks.actionGrave.push(card);
    summary.plays.push({
      playerId: player.id,
      cardId: card.id,
      cardName: card.name,
      effectDesc: describeActionEffect(card, play.chosenStat),
    });
  }
  state.actionPhase = null;
  state.actionPhaseSummary = summary.plays.length > 0 ? summary : null;
  state.phase = 'draft';
  state.log.push({
    kind: 'phase_change',
    phase: 'draft',
    round: state.round,
    miniRound: state.miniRound,
  });
}
