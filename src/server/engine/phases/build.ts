import type { BuildPhaseState, GameState, SkillCard } from '../types';
import { TOTAL_SKILL_SLOTS } from '../types';
import { getPlayer, syncMonsterFromSlots } from '../state';

const MAX_SLOTS = TOTAL_SKILL_SLOTS;

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
 * `slots` is a 9-entry array; each entry is a card ID or null (= default attack).
 * `activeSlotCount` is how many of those 9 slots participate in battle (0-9).
 * Slots beyond activeSlotCount are inactive regardless of their content.
 */
export function submitBuild(
  state: GameState,
  playerId: string,
  config: { slots: (string | null)[]; activeSlotCount: number },
): void {
  if (state.phase !== 'build' || !state.buildPhase) throw new Error('not in build phase');
  const player = getPlayer(state, playerId);
  if (!player.monster) throw new Error('player has no monster');

  const { slots, activeSlotCount } = config;
  if (activeSlotCount < 0 || activeSlotCount > MAX_SLOTS) {
    throw new Error(`activeSlotCount must be 0-${MAX_SLOTS}`);
  }
  if (slots.length !== MAX_SLOTS) {
    throw new Error(`slots must have exactly ${MAX_SLOTS} entries`);
  }

  // Validate all non-null cardIds belong to player's total inventory
  const allCards: SkillCard[] = [
    ...player.skillStock,
    ...(player.skillSlots.filter((c) => c !== null) as SkillCard[]),
  ];
  const allCardIds = new Set(allCards.map((c) => c.id));
  const usedIds: string[] = [];
  for (const id of slots) {
    if (id !== null) {
      if (!allCardIds.has(id)) throw new Error(`card ${id} not owned by player ${playerId}`);
      usedIds.push(id);
    }
  }
  if (new Set(usedIds).size !== usedIds.length) throw new Error('duplicate card IDs in slots');

  state.buildPhase.submittedSlots[playerId] = { slots, activeSlotCount };
  state.buildPhase.pendingPlayerIds = state.buildPhase.pendingPlayerIds.filter((id) => id !== playerId);
  state.log.push({ kind: 'build_submitted', playerId, slotCount: activeSlotCount });
}

/** True once all pending players have submitted their builds. */
export function allBuildsIn(state: GameState): boolean {
  return !!state.buildPhase && state.buildPhase.pendingPlayerIds.length === 0;
}

/**
 * Apply all submitted builds and advance to event phase.
 * - skillSlots becomes the new 9-entry array (null = default attack)
 * - activeSlotCount is updated
 * - Cards not in the active slots go back to skillStock
 * - monster.actives/passives are re-derived from the new slots
 */
export function resolveBuildPhase(state: GameState): void {
  if (state.phase !== 'build' || !state.buildPhase) throw new Error('not in build phase');
  if (!allBuildsIn(state)) throw new Error('not all builds submitted');

  for (const player of state.players) {
    if (!player.monster) continue;

    const submitted = state.buildPhase.submittedSlots[player.id];
    const allCards: SkillCard[] = [
      ...player.skillStock,
      ...(player.skillSlots.filter((c) => c !== null) as SkillCard[]),
    ];
    const cardById = new Map(allCards.map((c) => [c.id, c]));

    if (!submitted) {
      // No submission: keep current arrangement, just sync monster
      syncMonsterFromSlots(state, player);
      continue;
    }

    const { slots: slotIds, activeSlotCount } = submitted;

    // Build new 9-element slot array from submitted IDs
    const newSlots: (SkillCard | null)[] = Array(MAX_SLOTS).fill(null);
    const usedIds = new Set<string>();
    for (let i = 0; i < MAX_SLOTS; i++) {
      const id = slotIds[i] ?? null;
      if (id !== null) {
        const card = cardById.get(id);
        if (card) {
          newSlots[i] = card;
          usedIds.add(id);
        }
      }
    }

    // Cards not placed in any slot go back to skillStock
    player.skillSlots = newSlots;
    player.activeSlotCount = activeSlotCount;
    player.skillStock = allCards.filter((c) => !usedIds.has(c.id));

    syncMonsterFromSlots(state, player);
  }

  state.buildPhase = null;
  state.log.push({ kind: 'build_resolved' });

  // Final round: skip battle and go directly to tournament.
  if (state.round >= state.totalRounds) {
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
  state.phase = 'battle';
  state.log.push({
    kind: 'phase_change',
    phase: 'battle',
    round: state.round,
    miniRound: state.miniRound,
  });
}
