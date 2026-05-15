import type {
  ActionCard,
  ActionPhaseSummary,
  ActionPhaseState,
  ActionPlay,
  GameState,
  Player,
  StatKey,
} from '../types';
import { drawTop } from '../deck';
import { addSkillCardToMonster, makeRng, saveRng, syncMonsterFromSlots } from '../state';
import { describeActionEffect } from '../../../lib/card-text';
import { MONSTERS } from '../cards/monsters';

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
      player.monster.stats[card.effect.stat] += card.effect.amount;
      break;
    }
    case 'stat_mod_choice': {
      if (!chosenStat) break;
      player.monster.stats[chosenStat] += card.effect.amount;
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
      // Remove a random active skill from skillSlots (only slotted active cards)
      const activeSlots = player.skillSlots
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => !c.isPassive && c.active);
      if (activeSlots.length === 0) break;
      const pick = rng.int(0, activeSlots.length - 1);
      const { c: discarded, i: slotIdx } = activeSlots[pick]!;
      player.skillSlots.splice(slotIdx, 1);
      // Discarded card goes to skill graveyard
      state.decks.skillGrave.push(discarded);
      syncMonsterFromSlots(state, player);
      break;
    }
    case 'cleanse_sin': {
      // Remove a random sin-tagged skill from skillSlots
      const sinSlots = player.skillSlots
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => c.tag === 'sin');
      if (sinSlots.length === 0) break;
      const pick = rng.int(0, sinSlots.length - 1);
      const { c: discarded, i: slotIdx } = sinSlots[pick]!;
      player.skillSlots.splice(slotIdx, 1);
      state.decks.skillGrave.push(discarded);
      syncMonsterFromSlots(state, player);
      break;
    }
    case 'gain_passive': {
      player.monster.passives.push({ ...card.effect.passive });
      break;
    }
    case 'become_bug': {
      const bug = MONSTERS.find((m) => m.baseId === 'bug');
      if (!bug) break;
      const cur = player.monster.stats;
      player.monster.stats = {
        hp: bug.stats.hp + cur.hp,
        atk: bug.stats.atk + cur.atk,
        def: bug.stats.def + cur.def,
        spd: bug.stats.spd + cur.spd,
      };
      // Replace base passives (those without a `rarity` — skill-card passives
      // always carry rarity) with バグ's base passives. Keep acquired ones.
      const acquiredPassives = player.monster.passives.filter((p) => p.rarity !== undefined);
      player.monster.passives = [...bug.passives.map((p) => ({ ...p })), ...acquiredPassives];
      player.monster.baseId = bug.baseId;
      player.monster.name = bug.name;
      player.monster.attackKind = bug.attackKind;
      break;
    }
  }
  saveRng(state, rng);
}

function applySwapActives(state: GameState, swap: NonNullable<ActionPlay['swap']>): void {
  const target = state.players.find((p) => p.id === swap.targetPlayerId);
  if (!target?.monster) return;
  // Swap is based on monster.actives IDs; map back to skillSlots positions.
  // skillSlot cards have the same id as monster.actives (set by syncMonsterFromSlots).
  const slots = target.skillSlots;
  const idxA = slots.findIndex((c) => c.id === swap.skillIdA);
  const idxB = slots.findIndex((c) => c.id === swap.skillIdB);
  if (idxA < 0 || idxB < 0 || idxA === idxB) return;
  // Swap the two slots
  const tmp = slots[idxA]!;
  slots[idxA] = slots[idxB]!;
  slots[idxB] = tmp;
  // Re-sync monster from slots after the swap
  syncMonsterFromSlots(state, target);
}

/**
 * Begin the action phase: every player with a monster draws one action card
 * into their personal hand and is added to the pending list. Players then
 * pick one card from their hand to play.
 */
export function startActionPhase(state: GameState): void {
  if (state.phase !== 'action') throw new Error('not in action phase');
  if (state.actionPhase) return; // already started

  if (state.skipNextActionPhase) {
    state.skipNextActionPhase = false;
    state.phase = 'draft';
    state.log.push({
      kind: 'phase_change',
      phase: 'draft',
      round: state.round,
      miniRound: state.miniRound,
    });
    return;
  }

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
 * Submit a player's chosen card (must be present in their hand). Card-specific
 * extras: stat_mod_choice needs `chosenStat`; swap_actives needs `swap` with
 * a target player and the two distinct active-skill IDs to exchange.
 */
export function submitActionPlay(
  state: GameState,
  playerId: string,
  cardId: string,
  extras?: { chosenStat?: StatKey; swap?: ActionPlay['swap'] },
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
  const chosenStat = extras?.chosenStat;
  const swap = extras?.swap;
  if (card.effect.kind === 'stat_mod_choice') {
    if (!chosenStat || !VALID_STATS.includes(chosenStat)) {
      throw new Error('chosenStat is required for this card');
    }
  }
  if (card.effect.kind === 'swap_actives') {
    if (!swap) throw new Error('swap target/skill ids are required for this card');
    if (swap.skillIdA === swap.skillIdB) {
      throw new Error('swap requires two different skills');
    }
    const target = state.players.find((p) => p.id === swap.targetPlayerId);
    if (!target?.monster) throw new Error('swap target has no monster');
    // Validate against skillSlots (which are reflected in monster.actives after sync)
    const hasA = target.skillSlots.some((s) => s.id === swap.skillIdA) ||
                 target.monster.actives.some((s) => s.id === swap.skillIdA);
    const hasB = target.skillSlots.some((s) => s.id === swap.skillIdB) ||
                 target.monster.actives.some((s) => s.id === swap.skillIdB);
    if (!hasA || !hasB) throw new Error('swap skills not found on target');
  }
  phase.submittedPlays[playerId] = { cardId, chosenStat, swap };
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
    if (card.effect.kind === 'swap_actives' && play.swap) {
      applySwapActives(state, play.swap);
    } else {
      applyActionEffect(state, player, card, play.chosenStat);
    }
    state.decks.actionGrave.push(card);
    // Build a summary string with the swap-target info if applicable.
    let effectDesc: string;
    if (card.effect.kind === 'swap_actives' && play.swap) {
      const target = state.players.find((p) => p.id === play.swap!.targetPlayerId);
      const aSkill = target?.monster?.actives.find((s) => s.id === play.swap!.skillIdA);
      const bSkill = target?.monster?.actives.find((s) => s.id === play.swap!.skillIdB);
      effectDesc = `${target?.name ?? '?'}: ${aSkill?.name ?? '?'} ↔ ${bSkill?.name ?? '?'} の順序入れ替え`;
    } else {
      effectDesc = describeActionEffect(card, play.chosenStat);
    }
    summary.plays.push({
      playerId: player.id,
      cardId: card.id,
      cardName: card.name,
      effectDesc,
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
