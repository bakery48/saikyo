import type {
  ActiveSkill,
  GameState,
  Monster,
  MonsterBase,
  PassiveSkill,
  Player,
  SkillCard,
} from './types';
import { RNG } from './rng';
import { shuffle } from './deck';
import { MONSTERS } from './cards/monsters';
import { EVENTS } from './cards/events';
import { ACTIONS } from './cards/actions';
import { SKILLS } from './cards/skills';

export type PlayerSeed = { id: string; name: string; isCPU: boolean };

/** Build a fresh GameState with shuffled decks and a seeded pick order. */
export function createInitialState(opts: {
  roomId: string;
  seed: number;
  players: PlayerSeed[]; // 1..8 humans
}): GameState {
  if (opts.players.length < 0 || opts.players.length > 8) {
    throw new Error('players must be 0..8 (CPUs fill remaining slots)');
  }
  const rng = new RNG(opts.seed);

  // Pad with CPUs up to 8.
  const fullPlayers: Player[] = opts.players.map((p) => ({
    id: p.id,
    name: p.name,
    isCPU: p.isCPU,
    monster: null,
    pendingBuffs: [],
  }));
  let cpuIdx = 1;
  while (fullPlayers.length < 8) {
    fullPlayers.push({
      id: `cpu-${cpuIdx}`,
      name: `CPU ${cpuIdx}`,
      isCPU: true,
      monster: null,
      pendingBuffs: [],
    });
    cpuIdx++;
  }

  const monsterPool = shuffle(MONSTERS, rng);
  const pickOrder = shuffle(
    fullPlayers.map((p) => p.id),
    rng,
  );

  const state: GameState = {
    roomId: opts.roomId,
    rngState: rng.snapshot(),
    players: fullPlayers,
    monsterPool,
    pickOrder,
    pickIdx: 0,
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
  return state;
}

export function getPlayer(state: GameState, id: string): Player {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`player not found: ${id}`);
  return p;
}

/** Pick a monster for a player and advance the pick index. */
export function pickMonster(state: GameState, playerId: string, baseId: string): void {
  if (state.phase !== 'pick_monster') throw new Error('not in pick phase');
  const expected = state.pickOrder[state.pickIdx];
  if (expected !== playerId) {
    throw new Error(`not your turn (expected ${expected}, got ${playerId})`);
  }
  const idx = state.monsterPool.findIndex((m) => m.baseId === baseId);
  if (idx < 0) throw new Error(`monster not in pool: ${baseId}`);
  const base = state.monsterPool.splice(idx, 1)[0]!;
  const player = getPlayer(state, playerId);
  player.monster = monsterFromBase(base, playerId);
  state.log.push({ kind: 'monster_picked', playerId, baseId });
  state.pickIdx++;
  if (state.pickIdx >= state.pickOrder.length) {
    state.phase = 'event';
    state.log.push({ kind: 'phase_change', phase: 'event', round: state.round, miniRound: state.miniRound });
  }
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
