import type { DraftState, GameState, SkillCard } from '../types';
import type { RNG } from '../rng';
import { drawTop } from '../deck';
import { addSkillCardToMonster, getPlayer, makeRng, saveRng } from '../state';

const DRAFT_POOL_SIZE = 8;

/** Pull one sin-tagged card out of the deck (or grave as fallback). */
function pullSinCard(deck: SkillCard[], grave: SkillCard[]): SkillCard | undefined {
  let idx = deck.findIndex((c) => c.tag === 'sin');
  if (idx >= 0) return deck.splice(idx, 1)[0];
  idx = grave.findIndex((c) => c.tag === 'sin');
  if (idx >= 0) return grave.splice(idx, 1)[0];
  return undefined;
}

/**
 * Build the draft pool: exactly one sin card (if any remain) plus non-sin
 * cards filling the rest. Sins drawn while filling are diverted to the grave
 * so the pool never holds more than the single guaranteed one.
 */
function buildDraftPool(deck: SkillCard[], grave: SkillCard[], rng: RNG): SkillCard[] {
  const sinCard = pullSinCard(deck, grave);
  const target = sinCard ? DRAFT_POOL_SIZE - 1 : DRAFT_POOL_SIZE;
  const rest: SkillCard[] = [];
  let safety = 0;
  while (rest.length < target && safety < 500) {
    safety++;
    const card = drawTop(deck, grave, rng);
    if (!card) break;
    if (card.tag === 'sin') {
      grave.push(card);
      continue;
    }
    rest.push(card);
  }
  return sinCard ? [sinCard, ...rest] : rest;
}

/** Open a draft phase: reveal up to 8 skill cards. */
export function startDraft(state: GameState): void {
  if (state.phase !== 'draft') throw new Error('not in draft phase');
  if (state.draft) throw new Error('draft already started');
  // An event card may have flagged this draft to be skipped — advance straight away.
  if (state.skipNextDraftPhase) {
    state.skipNextDraftPhase = false;
    advanceAfterDraft(state);
    return;
  }
  const rng = makeRng(state);
  const pool = buildDraftPool(state.decks.skill, state.decks.skillGrave, rng);
  saveRng(state, rng);
  if (pool.length === 0) {
    // Skill deck is fully exhausted — skip drafting and advance to next phase.
    advanceAfterDraft(state);
    return;
  }
  const draft: DraftState = {
    pool,
    pendingPlayerIds: state.players.filter((p) => p.monster).map((p) => p.id),
    submittedPicks: {},
    acquired: Object.fromEntries(state.players.map((p) => [p.id, [] as string[]])),
    setAside: [],
    attempt: 0,
  };
  state.draft = draft;
  state.log.push({ kind: 'draft_revealed', cards: pool.map((c) => c.id) });
}

/** Submit one player's pick. */
export function submitDraftPick(state: GameState, playerId: string, skillCardId: string): void {
  if (state.phase !== 'draft' || !state.draft) throw new Error('not in draft phase');
  const draft = state.draft;
  if (!draft.pendingPlayerIds.includes(playerId)) {
    throw new Error(`player ${playerId} is not pending`);
  }
  if (!draft.pool.some((c) => c.id === skillCardId)) {
    throw new Error(`card ${skillCardId} not in current pool`);
  }
  draft.submittedPicks[playerId] = skillCardId;
  state.log.push({ kind: 'draft_pick_submitted', playerId, skillId: skillCardId });
}

/** True once every pending player has submitted a pick. */
export function allDraftPicksIn(state: GameState): boolean {
  if (!state.draft) return false;
  return state.draft.pendingPlayerIds.every((id) => state.draft!.submittedPicks[id]);
}

/**
 * Resolve a draft sub-round.
 * Players who picked uniquely take their card. Conflicting players must re-pick
 * from cards no one selected at all.
 *
 * Returns true when the entire draft phase is complete (and advances state).
 */
export function resolveDraftSubRound(state: GameState): boolean {
  if (state.phase !== 'draft' || !state.draft) throw new Error('not in draft phase');
  const draft = state.draft;
  if (!allDraftPicksIn(state)) throw new Error('not all picks submitted');

  // Group submissions by skill id.
  const groups = new Map<string, string[]>();
  for (const [playerId, skillId] of Object.entries(draft.submittedPicks)) {
    const arr = groups.get(skillId) ?? [];
    arr.push(playerId);
    groups.set(skillId, arr);
  }

  const assignments: Record<string, string> = {};
  const conflictPlayers: string[] = [];

  for (const [skillId, players] of groups) {
    if (players.length === 1) {
      assignments[players[0]!] = skillId;
    } else {
      // Conflict: card stays in the pool so the colliding players can re-pick
      // it (or anything else) on the next sub-round.
      conflictPlayers.push(...players);
      state.log.push({ kind: 'draft_conflict', skillId, players });
    }
  }

  // Apply unique winners: hand them the card and remove from pool.
  for (const [playerId, skillId] of Object.entries(assignments)) {
    const card = draft.pool.find((c) => c.id === skillId);
    if (!card) continue;
    draft.pool = draft.pool.filter((c) => c.id !== skillId);
    const player = getPlayer(state, playerId);
    addSkillCardToMonster(state, player, card);
    draft.acquired[playerId]!.push(skillId);
  }
  state.log.push({ kind: 'draft_resolved', assignments });

  // Update pending pickers and clear submissions.
  draft.pendingPlayerIds = conflictPlayers;
  draft.submittedPicks = {};
  draft.attempt += 1;

  // Check termination conditions.
  if (draft.pendingPlayerIds.length === 0) {
    finishDraft(state);
    return true;
  }
  // No more cards to re-draft from -> fallback to top of skill deck.
  if (draft.pool.length === 0) {
    fallbackDistribute(state);
    return true;
  }
  // Safety net: if too many iterations without progress, fall back.
  if (draft.attempt >= 4) {
    fallbackDistribute(state);
    return true;
  }
  return false;
}

function fallbackDistribute(state: GameState): void {
  const draft = state.draft!;
  const rng = makeRng(state);

  // First, give one card from the pool to each pending player at random (if any).
  const pool = draft.pool.slice();
  const remaining = draft.pendingPlayerIds.slice();
  while (pool.length > 0 && remaining.length > 0) {
    const playerId = remaining.shift()!;
    const idx = rng.int(0, pool.length - 1);
    const card = pool.splice(idx, 1)[0]!;
    const player = getPlayer(state, playerId);
    addSkillCardToMonster(state, player, card);
    draft.acquired[playerId]!.push(card.id);
    state.log.push({ kind: 'draft_fallback', playerId, skillId: card.id });
  }
  draft.pool = pool;
  // Anyone still left gets the top of skill deck as consolation.
  for (const playerId of remaining) {
    const top = drawTop(state.decks.skill, state.decks.skillGrave, rng);
    if (!top) break;
    const player = getPlayer(state, playerId);
    addSkillCardToMonster(state, player, top);
    draft.acquired[playerId]!.push(top.id);
    state.log.push({ kind: 'draft_fallback', playerId, skillId: top.id });
  }
  saveRng(state, rng);
  draft.pendingPlayerIds = [];
  finishDraft(state);
}

function finishDraft(state: GameState): void {
  const draft = state.draft!;
  // Discard remaining pool and set-aside cards into graveyard.
  state.decks.skillGrave.push(...draft.pool, ...draft.setAside);
  state.draft = null;
  advanceAfterDraft(state);
}

function advanceAfterDraft(state: GameState): void {
  // Advance to the next mini-round, or to battle/tournament if the last mini-round just ended.
  if (state.miniRound < state.miniRoundsPerRound) {
    state.miniRound += 1;
    state.phase = 'action';
  } else {
    state.phase = state.round >= state.totalRounds ? 'tournament' : 'battle';
  }
  state.log.push({
    kind: 'phase_change',
    phase: state.phase,
    round: state.round,
    miniRound: state.miniRound,
  });
}
