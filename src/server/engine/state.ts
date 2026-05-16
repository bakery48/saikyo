import type {
  ActiveSkill,
  GameState,
  Monster,
  MonsterBase,
  MonsterPickState,
  PassiveSkill,
  Player,
  PLAYER_COLORS as PLAYER_COLORS_T,
  SkillCard,
} from './types';
import { PLAYER_COLORS } from './types';
import { RNG } from './rng';
import { shuffle, drawTop } from './deck';
import { MONSTERS, MONSTERS_BY_ID } from './cards/monsters';
import { EVENTS } from './cards/events';
import { ACTIONS } from './cards/actions';
import { SKILLS } from './cards/skills';
import { stripInvalidNameTags, getAvailableTags, composeMonsterName } from './naming';

export type PlayerSeed = { id: string; name: string; isCPU: boolean };

export const INITIAL_ACTION_HAND_SIZE = 3;

/** Clamp a configured 1-3 setting to its valid range. */
function clampRoundCount(n: number): number {
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(3, Math.floor(n)));
}

/** Default number of copies per card for the skill deck. */
function defaultSkillCount(card: import('./types').SkillCard): number {
  if (card.tag === 'sin') return 2;
  if (card.rarity === 'N') return 4;
  if (card.rarity === 'R') return 1;
  return 1; // SR, SSR
}

/** Build a fresh GameState with shuffled decks and a draft-style monster pick. */
export function createInitialState(opts: {
  roomId: string;
  seed: number;
  players: PlayerSeed[]; // 0..8 humans (CPUs fill remaining slots)
  /** How many big rounds the game runs for (1-3, default 3). */
  totalRounds?: number;
  /** How many event/action/draft cycles each round contains (1-3, default 3). */
  miniRoundsPerRound?: number;
  /** Per-card skill deck counts (cardId -> 0|1|2|3). Missing entries use rarity defaults. */
  skillCardCounts?: Record<string, number>;
}): GameState {
  if (opts.players.length < 0 || opts.players.length > 8) {
    throw new Error('players must be 0..8 (CPUs fill remaining slots)');
  }
  const totalRounds = clampRoundCount(opts.totalRounds ?? 3);
  const miniRoundsPerRound = clampRoundCount(opts.miniRoundsPerRound ?? 3);
  const rng = new RNG(opts.seed);

  // Pad with CPUs up to 8 first; colors are assigned after shuffling so that
  // the assignment is deterministic per seed but unrelated to seat order.
  const seats: Omit<Player, 'color'>[] = opts.players.map((p) => ({
    id: p.id,
    name: p.name,
    isCPU: p.isCPU,
    monster: null,
    actionHand: [],
    skillStock: [],
    skillSlots: Array(9).fill(null) as (import('./types').SkillCard | null)[],
    activeSlotCount: 9,
  }));
  let cpuIdx = 1;
  while (seats.length < 8) {
    seats.push({
      id: `cpu-${cpuIdx}`,
      name: `CPU ${cpuIdx}`,
      isCPU: true,
      monster: null,
      actionHand: [],
      skillStock: [],
      skillSlots: Array(9).fill(null) as (import('./types').SkillCard | null)[],
      activeSlotCount: 9,
    });
    cpuIdx++;
  }

  const shuffledColors = shuffle(PLAYER_COLORS, rng);
  const fullPlayers: Player[] = seats.map((p, i) => ({ ...p, color: shuffledColors[i]! }));

  const monsterPool = shuffle(MONSTERS.filter((m) => !m.hidden), rng).slice(0, 8);

  const monsterPick: MonsterPickState = {
    pool: monsterPool,
    pendingPlayerIds: fullPlayers.map((p) => p.id),
    submittedPicks: {},
    attempt: 0,
  };

  const state: GameState = {
    roomId: opts.roomId,
    rngState: rng.snapshot(),
    players: fullPlayers,
    monsterPick,
    round: 1,
    miniRound: 1,
    totalRounds,
    miniRoundsPerRound,
    phase: 'pick_monster',
    decks: {
      event: shuffle(EVENTS, rng),
      action: shuffle(ACTIONS, rng),
      skill: (() => {
        const skillDeck: SkillCard[] = [];
        for (const card of SKILLS) {
          const count = opts.skillCardCounts?.[card.id] ?? defaultSkillCount(card);
          for (let i = 0; i < count; i++) {
            // Each deck instance needs a unique id so multi-copy cards (e.g. N rarity)
            // don't collide in the draft pool / conflict resolution.
            skillDeck.push(count > 1 ? { ...card, id: `${card.id}@${i}` } : card);
          }
        }
        return shuffle(skillDeck, rng);
      })(),
      eventGrave: [],
      actionGrave: [],
      skillGrave: [],
    },
    packDraft: null,
    buildPhase: null,
    actionPhase: null,
    battle: null,
    reward: null,
    tournament: null,
    champion: null,
    nextSkillInstanceSeq: 1,
    log: [],
    eventPhaseSummary: null,
    actionPhaseSummary: null,
    nextBattleReverseActives: false,
    skipNextActionPhase: false,
    extraBattlePending: false,
    returnToBattleAfterReward: false,
  };
  // Deal the initial action card hand (4 cards each) right at game start so
  // players can see their hand from the very beginning, even during monster pick.
  for (const player of fullPlayers) {
    for (let i = 0; i < INITIAL_ACTION_HAND_SIZE; i++) {
      const card = drawTop(state.decks.action, state.decks.actionGrave, rng);
      if (!card) break;
      player.actionHand.push(card);
    }
  }
  state.rngState = rng.snapshot();
  state.log.push({ kind: 'monster_pick_revealed', baseIds: monsterPool.map((m) => m.baseId) });
  return state;
}

export function getPlayer(state: GameState, id: string): Player {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`player not found: ${id}`);
  return p;
}

/** Submit one player's pick during the monster-pick draft. */
export function submitMonsterPick(state: GameState, playerId: string, baseId: string): void {
  if (state.phase !== 'pick_monster' || !state.monsterPick) {
    throw new Error('not in monster-pick phase');
  }
  const draft = state.monsterPick;
  if (!draft.pendingPlayerIds.includes(playerId)) {
    throw new Error(`player ${playerId} is not pending`);
  }
  if (!draft.pool.some((m) => m.baseId === baseId)) {
    throw new Error(`monster ${baseId} not in pool`);
  }
  draft.submittedPicks[playerId] = baseId;
  state.log.push({ kind: 'monster_pick_submitted', playerId, baseId });
}

/** True once every pending player has submitted a monster pick. */
export function allMonsterPicksIn(state: GameState): boolean {
  if (!state.monsterPick) return false;
  return state.monsterPick.pendingPlayerIds.every((id) => state.monsterPick!.submittedPicks[id]);
}

/**
 * Resolve a monster-pick sub-round.
 *
 * Players who picked uniquely take their monster. Players who collided with
 * another picker stay pending and re-pick from the remaining (unselected)
 * monsters next round. Returns true when the entire pick phase is complete.
 */
export function resolveMonsterPickSubRound(state: GameState): boolean {
  if (state.phase !== 'pick_monster' || !state.monsterPick) {
    throw new Error('not in monster-pick phase');
  }
  const draft = state.monsterPick;
  if (!allMonsterPicksIn(state)) throw new Error('not all picks submitted');

  // Group submissions by base id.
  const groups = new Map<string, string[]>();
  for (const [pid, baseId] of Object.entries(draft.submittedPicks)) {
    const arr = groups.get(baseId) ?? [];
    arr.push(pid);
    groups.set(baseId, arr);
  }

  const assignments: Record<string, string> = {};
  const conflictPlayers: string[] = [];

  for (const [baseId, players] of groups) {
    if (players.length === 1) {
      assignments[players[0]!] = baseId;
    } else {
      conflictPlayers.push(...players);
      state.log.push({ kind: 'monster_pick_conflict', baseId, players });
    }
  }

  // Award unique winners.
  for (const [pid, baseId] of Object.entries(assignments)) {
    const idx = draft.pool.findIndex((m) => m.baseId === baseId);
    if (idx < 0) continue;
    const base = draft.pool.splice(idx, 1)[0]!;
    const player = getPlayer(state, pid);
    player.monster = monsterFromBase(base, pid);
    state.log.push({ kind: 'monster_picked', playerId: pid, baseId });
  }
  state.log.push({ kind: 'monster_pick_resolved', assignments });

  draft.pendingPlayerIds = conflictPlayers;
  draft.submittedPicks = {};
  draft.attempt += 1;

  if (draft.pendingPlayerIds.length === 0) {
    finalizeMonsterPick(state);
    return true;
  }
  // Stuck: pool can't satisfy all pending. Raffle the remainder.
  if (draft.pool.length < draft.pendingPlayerIds.length || draft.attempt >= 1) {
    fallbackMonsterDistribute(state);
    return true;
  }
  return false;
}

function fallbackMonsterDistribute(state: GameState): void {
  const draft = state.monsterPick!;
  const rng = new RNG(state.rngState);
  // Random shuffle of pool, give one to each remaining player; if pool runs
  // out (shouldn't, but be defensive), reuse base data so every player gets
  // something playable.
  const pool = shuffle(draft.pool, rng);
  state.rngState = rng.snapshot();
  const remaining = draft.pendingPlayerIds.slice();
  while (remaining.length > 0) {
    const pid = remaining.shift()!;
    const base = pool.shift() ?? MONSTERS[0]!;
    const player = getPlayer(state, pid);
    player.monster = monsterFromBase(base, pid);
    state.log.push({ kind: 'monster_picked', playerId: pid, baseId: base.baseId });
  }
  draft.pool = pool;
  draft.pendingPlayerIds = [];
  finalizeMonsterPick(state);
}

function finalizeMonsterPick(state: GameState): void {
  state.monsterPick = null;
  state.phase = 'action';
  state.log.push({
    kind: 'phase_change',
    phase: 'action',
    round: state.round,
    miniRound: state.miniRound,
  });
}

export function monsterFromBase(base: MonsterBase, ownerId: string): Monster {
  return {
    ownerId,
    baseId: base.baseId,
    name: base.name,
    stats: { ...base.stats },
    passives: base.passives.map((p) => ({ ...p })),
    actives: [],
    attackKind: base.attackKind,
  };
}

/**
 * Add a SkillCard to a player's skillStock (total inventory).
 * The card will be available to slot during the build phase.
 * Also logs the acquisition event.
 */
export function addSkillCardToMonster(
  state: GameState,
  player: Player,
  card: SkillCard,
): SkillCard {
  if (!player.monster) throw new Error('player has no monster');
  // Give the card a unique copy ID so multiple instances don't collide.
  const seq = state.nextSkillInstanceSeq++;
  const stockCard: SkillCard = { ...card, id: `${card.id}#${seq}` };
  player.skillStock.push(stockCard);
  state.log.push({ kind: 'skill_acquired', playerId: player.id, skillId: stockCard.id, rarity: card.rarity });
  return stockCard;
}

/**
 * Derive monster.actives and monster.passives from player.skillSlots.
 * Slots 0..activeSlotCount-1 are active; null slots become default attacks.
 * Base monster passives are always preserved.
 */
export function syncMonsterFromSlots(state: GameState, player: Player): void {
  if (!player.monster) return;

  const base = MONSTERS_BY_ID[player.monster.baseId];
  const basePassives: PassiveSkill[] = base ? base.passives.map((p) => ({ ...p })) : [];

  const actives: ActiveSkill[] = [];
  const acquiredPassives: PassiveSkill[] = [];

  for (let idx = 0; idx < player.activeSlotCount; idx++) {
    const card = player.skillSlots[idx] ?? null;
    if (card === null) {
      // Default attack slot
      actives.push({
        id: `default_attack@${idx}`,
        name: 'アタック',
        order: idx + 1,
        effect: { kind: 'attack', mult: 1.0, useStat: 'atk', attackKind: 'strike' },
      });
    } else if (card.isPassive && card.passive) {
      acquiredPassives.push({
        id: card.id,
        name: card.name,
        trigger: card.passive.trigger,
        effect: card.passive.effect,
        rarity: card.rarity,
        nameTag: card.rarity === 'N' ? undefined : card.nameTag,
        tag: card.tag,
      });
    } else if (card.active) {
      actives.push({
        id: card.id,
        name: card.name,
        order: idx + 1,
        rarity: card.rarity,
        nameTag: card.rarity === 'N' ? undefined : card.nameTag,
        tag: card.tag,
        effect: card.active.effect,
      });
    }
  }

  player.monster.actives = actives;
  player.monster.passives = [...basePassives, ...acquiredPassives];

  stripInvalidNameTags(player.monster);
}

/** Helper: re-create RNG from state's snapshot, returns it; caller should write back. */
export function makeRng(state: GameState): RNG {
  return new RNG(state.rngState);
}

export function saveRng(state: GameState, rng: RNG): void {
  state.rngState = rng.snapshot();
}
