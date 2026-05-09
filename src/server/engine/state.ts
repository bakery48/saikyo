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
import { shuffle } from './deck';
import { MONSTERS } from './cards/monsters';
import { EVENTS } from './cards/events';
import { ACTIONS } from './cards/actions';
import { SKILLS } from './cards/skills';

export type PlayerSeed = { id: string; name: string; isCPU: boolean };

/** Build a fresh GameState with shuffled decks and a draft-style monster pick. */
export function createInitialState(opts: {
  roomId: string;
  seed: number;
  players: PlayerSeed[]; // 0..8 humans (CPUs fill remaining slots)
}): GameState {
  if (opts.players.length < 0 || opts.players.length > 8) {
    throw new Error('players must be 0..8 (CPUs fill remaining slots)');
  }
  const rng = new RNG(opts.seed);

  // Pad with CPUs up to 8 first; colors are assigned after shuffling so that
  // the assignment is deterministic per seed but unrelated to seat order.
  const seats: Omit<Player, 'color'>[] = opts.players.map((p) => ({
    id: p.id,
    name: p.name,
    isCPU: p.isCPU,
    monster: null,
    pendingBuffs: [],
  }));
  let cpuIdx = 1;
  while (seats.length < 8) {
    seats.push({
      id: `cpu-${cpuIdx}`,
      name: `CPU ${cpuIdx}`,
      isCPU: true,
      monster: null,
      pendingBuffs: [],
    });
    cpuIdx++;
  }

  const shuffledColors = shuffle(PLAYER_COLORS, rng);
  const fullPlayers: Player[] = seats.map((p, i) => ({ ...p, color: shuffledColors[i]! }));

  const monsterPool = shuffle(MONSTERS, rng);

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
    phase: 'pick_monster',
    decks: {
      event: shuffle(EVENTS, rng),
      action: shuffle(ACTIONS, rng),
      skill: shuffle(SKILLS, rng),
      eventGrave: [],
      actionGrave: [],
      skillGrave: [],
    },
    draft: null,
    battle: null,
    reward: null,
    tournament: null,
    champion: null,
    nextSkillInstanceSeq: 1,
    log: [],
  };
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
  if (draft.pool.length < draft.pendingPlayerIds.length || draft.attempt >= 8) {
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
  state.phase = 'event';
  state.log.push({
    kind: 'phase_change',
    phase: 'event',
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
  };
}

/** Add a SkillCard to a player's monster as either an active or passive skill. */
export function addSkillCardToMonster(
  state: GameState,
  player: Player,
  card: SkillCard,
): ActiveSkill | PassiveSkill {
  if (!player.monster) throw new Error('player has no monster');
  const seq = state.nextSkillInstanceSeq++;
  if (card.isPassive && card.passive) {
    const passive: PassiveSkill = {
      id: `${card.id}#${seq}`,
      name: card.name,
      trigger: card.passive.trigger,
      effect: card.passive.effect,
      rarity: card.rarity,
      nameTag: card.nameTag,
    };
    player.monster.passives.push(passive);
    state.log.push({ kind: 'skill_acquired', playerId: player.id, skillId: passive.id, rarity: card.rarity });
    return passive;
  }
  if (!card.active) throw new Error(`skill card ${card.id} has no active or passive payload`);
  const order = player.monster.actives.length + 1;
  const active: ActiveSkill = {
    id: `${card.id}#${seq}`,
    name: card.name,
    order,
    rarity: card.rarity,
    nameTag: card.nameTag,
    effect: card.active.effect,
  };
  player.monster.actives.push(active);
  state.log.push({ kind: 'skill_acquired', playerId: player.id, skillId: active.id, rarity: card.rarity });
  return active;
}

/** Helper: re-create RNG from state's snapshot, returns it; caller should write back. */
export function makeRng(state: GameState): RNG {
  return new RNG(state.rngState);
}

export function saveRng(state: GameState, rng: RNG): void {
  state.rngState = rng.snapshot();
}
