import type { GameState, PackDraftState, Rarity, SkillCard } from '../types';
import { getPlayer, makeRng, saveRng } from '../state';
import { shuffle } from '../deck';

const PACK_SIZE = 5; // each pack has 5 cards
const PASSES = 5;   // 5 picks per draft (= pack size)

/** Draw one card of the given rarity from skill deck, falling back to grave. */
function drawByRarity(
  deck: SkillCard[],
  grave: SkillCard[],
  rarity: Rarity,
): SkillCard | null {
  let idx = deck.findIndex((c) => c.rarity === rarity);
  if (idx >= 0) return deck.splice(idx, 1)[0]!;
  idx = grave.findIndex((c) => c.rarity === rarity);
  if (idx >= 0) return grave.splice(idx, 1)[0]!;
  return null;
}

/**
 * Build a 5-card pack: 1 SSR, 2 SR/R (random mix), 2 N.
 * Falls back gracefully if specific rarities are unavailable.
 */
function buildPack(deck: SkillCard[], grave: SkillCard[], rng: ReturnType<typeof makeRng>): SkillCard[] {
  const pack: SkillCard[] = [];

  // 1 SSR
  const ssr = drawByRarity(deck, grave, 'SSR');
  if (ssr) pack.push(ssr);

  // 2 SR/R (50/50 split per slot)
  for (let i = 0; i < 2; i++) {
    const preferSR = rng.int(0, 1) === 0;
    const card =
      drawByRarity(deck, grave, preferSR ? 'SR' : 'R') ??
      drawByRarity(deck, grave, preferSR ? 'R' : 'SR');
    if (card) pack.push(card);
  }

  // 2 N
  for (let i = 0; i < 2; i++) {
    const card = drawByRarity(deck, grave, 'N');
    if (card) pack.push(card);
  }

  return pack;
}

/** Open the pack-based booster draft. Call when entering draft phase. */
export function startPackDraft(state: GameState): void {
  if (state.phase !== 'draft') throw new Error('not in draft phase');
  if (state.packDraft) return; // already started

  const rng = makeRng(state);

  // Randomize draft order
  const activePlayers = state.players.filter((p) => p.monster);
  const draftOrder = shuffle(activePlayers.map((p) => p.id), rng);

  // Deal a pack to each player
  const packs: Record<string, SkillCard[]> = {};
  for (const pid of draftOrder) {
    packs[pid] = buildPack(state.decks.skill, state.decks.skillGrave, rng);
  }

  saveRng(state, rng);

  state.packDraft = {
    draftOrder,
    passIndex: 0,
    packs,
    pendingPlayerIds: [...draftOrder],
    submittedPicks: {},
    acquired: Object.fromEntries(draftOrder.map((id) => [id, [] as SkillCard[]])),
  };

  // Log revealed cards (all pack cards combined for visibility)
  const allCards = Object.values(packs).flat().map((c) => c.id);
  state.log.push({ kind: 'draft_revealed', cards: allCards });
}

/** Submit one player's pick for the current pass. */
export function submitPackPick(state: GameState, playerId: string, cardId: string): void {
  if (state.phase !== 'draft' || !state.packDraft) throw new Error('not in draft phase');
  const draft = state.packDraft;
  if (!draft.pendingPlayerIds.includes(playerId)) {
    throw new Error(`player ${playerId} is not pending`);
  }
  const pack = draft.packs[playerId];
  if (!pack || !pack.some((c) => c.id === cardId)) {
    throw new Error(`card ${cardId} not in player ${playerId}'s pack`);
  }
  draft.submittedPicks[playerId] = cardId;
  state.log.push({ kind: 'draft_pick_submitted', playerId, skillId: cardId });
}

/** True once every pending player has submitted a pick for this pass. */
export function allPackPicksIn(state: GameState): boolean {
  if (!state.packDraft) return false;
  return state.packDraft.pendingPlayerIds.every((id) => !!state.packDraft!.submittedPicks[id]);
}

/**
 * Resolve one pass of the pack draft.
 * Each player picks their chosen card, then packs rotate.
 * Returns true when all 5 passes are complete.
 */
export function resolvePackPickRound(state: GameState): boolean {
  if (state.phase !== 'draft' || !state.packDraft) throw new Error('not in draft phase');
  const draft = state.packDraft;
  if (!allPackPicksIn(state)) throw new Error('not all picks submitted');

  const remaining: Record<string, SkillCard[]> = {};

  // Remove picked cards from each player's pack
  for (const pid of draft.draftOrder) {
    const cardId = draft.submittedPicks[pid]!;
    const pack = draft.packs[pid]!;
    const cardIdx = pack.findIndex((c) => c.id === cardId);
    const card = pack.splice(cardIdx, 1)[0]!;
    draft.acquired[pid]!.push(card);
    remaining[pid] = pack; // remaining cards after pick
  }

  // Rotate packs: player[i]'s remaining pack goes to player[(i+1) % n]
  const n = draft.draftOrder.length;
  const newPacks: Record<string, SkillCard[]> = {};
  for (let i = 0; i < n; i++) {
    const fromPid = draft.draftOrder[i]!;
    const toPid = draft.draftOrder[(i + 1) % n]!;
    newPacks[toPid] = remaining[fromPid]!;
  }

  draft.passIndex += 1;
  draft.packs = newPacks;
  draft.submittedPicks = {};

  state.log.push({ kind: 'draft_pass_resolved', passIndex: draft.passIndex });

  // Check termination: all passes done or all packs empty
  const allEmpty = draft.draftOrder.every((pid) => (newPacks[pid]?.length ?? 0) === 0);
  if (draft.passIndex >= PASSES || allEmpty) {
    finishPackDraft(state);
    return true;
  }

  // Update pending: only players with non-empty packs
  draft.pendingPlayerIds = draft.draftOrder.filter((pid) => (newPacks[pid]?.length ?? 0) > 0);
  return false;
}

function finishPackDraft(state: GameState): void {
  const draft = state.packDraft!;

  // Add all acquired cards to each player's skillStock
  for (const pid of draft.draftOrder) {
    const player = state.players.find((p) => p.id === pid);
    if (!player) continue;
    for (const card of draft.acquired[pid] ?? []) {
      player.skillStock.push(card);
      state.log.push({ kind: 'skill_acquired', playerId: pid, skillId: card.id, rarity: card.rarity });
    }
  }

  // Discard any remaining cards in packs into the skill graveyard
  for (const pid of draft.draftOrder) {
    const leftover = draft.packs[pid] ?? [];
    state.decks.skillGrave.push(...leftover);
  }

  state.packDraft = null;
  state.log.push({ kind: 'draft_finished' });

  // Advance to build phase
  state.phase = 'build';
  state.log.push({
    kind: 'phase_change',
    phase: 'build',
    round: state.round,
    miniRound: state.miniRound,
  });
}

// ─── Legacy aliases (kept for backward-compatibility with tests and cli.ts) ────

/** @deprecated Use startPackDraft. */
export const startDraft = startPackDraft;

/** @deprecated Use submitPackPick. */
export const submitDraftPick = submitPackPick;

/** @deprecated Use allPackPicksIn. */
export const allDraftPicksIn = allPackPicksIn;

/**
 * @deprecated Use resolvePackPickRound.
 * Legacy wrapper that loops until all passes are done (old behavior: resolves entire draft).
 */
export function resolveDraftSubRound(state: GameState): boolean {
  return resolvePackPickRound(state);
}
