import type { BuildPhaseState, GameState, SkillCard } from '../types';
import { getPlayer, syncMonsterFromSlots } from '../state';

const MAX_SLOTS = 9;

/** Start the build phase — create pending state for all players with monsters. */
export function startBuildPhase(state: GameState): void {
  if (state.phase !== 'build') throw new Error('not in build phase');
  if (state.buildPhase) return; // already started

  const pending = state.players.filter((p) => p.monster).map((p) => p.id);
  state.buildPhase = {
    pendingPlayerIds: pending,
    submittedSlots: {},
  };
}

/**
 * Submit a player's slot configuration.
 * `slotCardIds` is an ordered list of card IDs (from the player's total inventory)
 * to place in skillSlots. Max 9 cards.
 */
export function submitBuild(state: GameState, playerId: string, slotCardIds: string[]): void {
  if (state.phase !== 'build' || !state.buildPhase) throw new Error('not in build phase');
  const player = getPlayer(state, playerId);
  if (!player.monster) throw new Error('player has no monster');
  if (slotCardIds.length > MAX_SLOTS) throw new Error(`max ${MAX_SLOTS} slots`);

  // Validate all cardIds belong to player's total inventory (stock + current slots)
  const allCards = [...player.skillStock, ...player.skillSlots];
  const allCardIds = new Set(allCards.map((c) => c.id));
  for (const id of slotCardIds) {
    if (!allCardIds.has(id)) throw new Error(`card ${id} not owned by player ${playerId}`);
  }
  // Ensure no duplicates in slotCardIds
  if (new Set(slotCardIds).size !== slotCardIds.length) {
    throw new Error('duplicate card IDs in slotCardIds');
  }

  state.buildPhase.submittedSlots[playerId] = slotCardIds;
  state.buildPhase.pendingPlayerIds = state.buildPhase.pendingPlayerIds.filter((id) => id !== playerId);
  state.log.push({ kind: 'build_submitted', playerId, slotCount: slotCardIds.length });
}

/** True once all pending players have submitted their builds. */
export function allBuildsIn(state: GameState): boolean {
  return !!state.buildPhase && state.buildPhase.pendingPlayerIds.length === 0;
}

/**
 * Apply all submitted builds and advance to event phase.
 * Each player's skillSlots and skillStock are updated, and monster stats
 * are derived from slots.
 */
export function resolveBuildPhase(state: GameState): void {
  if (state.phase !== 'build' || !state.buildPhase) throw new Error('not in build phase');
  if (!allBuildsIn(state)) throw new Error('not all builds submitted');

  for (const player of state.players) {
    if (!player.monster) continue;
    const slotIds = state.buildPhase.submittedSlots[player.id] ?? player.skillSlots.map((c) => c.id);
    const allCards = [...player.skillStock, ...player.skillSlots];
    const cardById = new Map(allCards.map((c) => [c.id, c]));

    // Build new slots (in order)
    const newSlots: SkillCard[] = [];
    for (const id of slotIds) {
      const card = cardById.get(id);
      if (card) newSlots.push(card);
    }

    // New stock = all cards not in slots
    const slotIdSet = new Set(slotIds);
    const newStock = allCards.filter((c) => !slotIdSet.has(c.id));

    player.skillSlots = newSlots;
    player.skillStock = newStock;

    // Sync monster.actives and monster.passives from slots
    syncMonsterFromSlots(state, player);
  }

  state.buildPhase = null;
  state.log.push({ kind: 'build_resolved' });

  // Advance to event phase
  state.phase = 'event';
  state.log.push({
    kind: 'phase_change',
    phase: 'event',
    round: state.round,
    miniRound: state.miniRound,
  });
}
