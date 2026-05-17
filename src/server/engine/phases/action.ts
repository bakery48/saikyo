import type {
  ActionCard,
  ActionPhaseSummary,
  ActionPhaseState,
  ActionPlay,
  GameState,
  Player,
  SkillCard,
  StatKey,
} from '../types';
import { drawTop } from '../deck';
import { addSkillCardToMonster, makeRng, saveRng, syncMonsterFromSlots } from '../state';
import { describeActionEffect } from '../../../lib/card-text';
import { MONSTERS } from '../cards/monsters';

const ALL_STATS: StatKey[] = ['hp', 'atk', 'def', 'spd'];

/** Minimum allowed value for each stat. HP must stay ≥ 1; others ≥ 0. */
const STAT_MIN: Record<StatKey, number> = { hp: 1, atk: 0, def: 0, spd: 0 };

function clampStat(stat: StatKey, value: number): number {
  return Math.max(STAT_MIN[stat], value);
}

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
    case 'draw_skill_top_with_stat_loss': {
      const top = drawTop(state.decks.skill, state.decks.skillGrave, rng);
      if (top) addSkillCardToMonster(state, player, top);
      const combatStats: Array<'atk' | 'def' | 'spd'> = ['atk', 'def', 'spd'];
      const stat = combatStats[rng.int(0, 2)]!;
      if (player.monster) player.monster.stats[stat] = clampStat(stat, player.monster.stats[stat] - card.effect.amount);
      break;
    }
    case 'discard_actives_gain_stat': {
      if (!player.monster) break;
      const allCandidates: { card: SkillCard; idx: number }[] = [];
      for (let i = 0; i < player.activeSlotCount; i++) {
        const c = player.skillSlots[i] ?? null;
        if (c !== null && !c.isPassive && c.active) allCandidates.push({ card: c, idx: i });
      }
      const toDiscard = Math.min(card.effect.discardCount, allCandidates.length);
      for (let d = 0; d < toDiscard; d++) {
        const pick = rng.int(0, allCandidates.length - 1);
        const { card: discarded, idx } = allCandidates.splice(pick, 1)[0]!;
        player.skillSlots[idx] = null;
        state.decks.skillGrave.push(discarded);
      }
      syncMonsterFromSlots(state, player);
      if (chosenStat) player.monster.stats[chosenStat] += card.effect.amount;
      break;
    }
    case 'discard_random_active': {
      // Find non-null active skill cards within the active slot range
      const candidates: { card: SkillCard; idx: number }[] = [];
      for (let i = 0; i < player.activeSlotCount; i++) {
        const c = player.skillSlots[i] ?? null;
        if (c !== null && !c.isPassive && c.active) candidates.push({ card: c, idx: i });
      }
      if (candidates.length === 0) break;
      const { card: discarded, idx } = candidates[rng.int(0, candidates.length - 1)]!;
      player.skillSlots[idx] = null; // revert slot to default attack
      state.decks.skillGrave.push(discarded);
      syncMonsterFromSlots(state, player);
      break;
    }
    case 'cleanse_sin': {
      // Find sin-tagged cards in active slots
      const candidates: { card: SkillCard; idx: number }[] = [];
      for (let i = 0; i < player.activeSlotCount; i++) {
        const c = player.skillSlots[i] ?? null;
        if (c !== null && c.tag === 'sin') candidates.push({ card: c, idx: i });
      }
      if (candidates.length === 0) break;
      const { card: discarded, idx } = candidates[rng.int(0, candidates.length - 1)]!;
      player.skillSlots[idx] = null;
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
    case 'random_stat_up': {
      const stats: StatKey[] = ['hp', 'atk', 'def', 'spd'];
      const chosenStat = stats[Math.floor(rng.next() * stats.length)]!;
      player.monster.stats[chosenStat] += card.effect.amount;
      break;
    }
    case 'steal_stat': {
      const e = card.effect;
      const others = state.players.filter((p) => p.id !== player.id && p.monster);
      if (others.length > 0) {
        const target = others.reduce((best, p) =>
          p.monster!.stats[e.stat] > best.monster!.stats[e.stat] ? p : best
        );
        const available = target.monster!.stats[e.stat] - STAT_MIN[e.stat];
        const steal = Math.min(e.amount, Math.max(0, available));
        target.monster!.stats[e.stat] -= steal;
        player.monster.stats[e.stat] += steal;
      }
      break;
    }
    case 'copy_stat_from_leader': {
      const e = card.effect;
      const allWithMonster = state.players.filter((p) => p.monster);
      const max = Math.max(...allWithMonster.map((p) => p.monster!.stats[e.stat]));
      const penalty = e.penalty ?? 0;
      player.monster.stats[e.stat] = clampStat(e.stat, max - penalty);
      break;
    }
    case 'trade_stat': {
      const eff = card.effect as { kind: 'trade_stat'; from: StatKey; to: StatKey; fromAmount: number; toAmount: number };
      player.monster.stats[eff.from] = clampStat(eff.from, player.monster.stats[eff.from] - eff.fromAmount);
      player.monster.stats[eff.to] += eff.toAmount;
      break;
    }
    case 'slot_top_skill': {
      const card2 = drawTop(state.decks.skill, state.decks.skillGrave, rng);
      if (card2) {
        const slotIdx = player.skillSlots.findIndex((s, i) => s === null && i < player.activeSlotCount);
        if (slotIdx >= 0) {
          const seq = state.nextSkillInstanceSeq++;
          const slotCard = { ...card2, id: `${card2.id}#${seq}` };
          player.skillSlots[slotIdx] = slotCard;
          syncMonsterFromSlots(state, player);
        } else {
          addSkillCardToMonster(state, player, card2);
        }
      }
      break;
    }
    case 'upgrade_skill': {
      if (player.skillStock.length > 0) {
        const rarityMap: Record<string, string> = { N: 'R', R: 'SR', SR: 'SSR', SSR: 'SSR' };
        const idx = rng.int(0, player.skillStock.length - 1);
        const sc = player.skillStock[idx]!;
        const newRarity = rarityMap[sc.rarity] as typeof sc.rarity;
        player.skillStock[idx] = { ...sc, rarity: newRarity };
      }
      break;
    }
    case 'copy_skill_from_player': {
      const others = state.players.filter((p) => p.id !== player.id && p.skillStock.length > 0);
      if (others.length > 0) {
        const target = others[rng.int(0, others.length - 1)]!;
        const sc = target.skillStock[rng.int(0, target.skillStock.length - 1)]!;
        addSkillCardToMonster(state, player, sc);
      }
      break;
    }
    case 'hp_to_atk': {
      const gain = Math.floor(player.monster.stats.hp * (card.effect as { kind: 'hp_to_atk'; fraction: number }).fraction);
      player.monster.stats.atk += gain;
      break;
    }
    case 'all_stats_mod': {
      const amt = (card.effect as { kind: 'all_stats_mod'; amount: number }).amount;
      player.monster.stats.hp += amt;
      player.monster.stats.atk += amt;
      player.monster.stats.def = Math.max(0, player.monster.stats.def + amt);
      player.monster.stats.spd = Math.max(0, player.monster.stats.spd + amt);
      break;
    }
    case 'swap_all_stats': {
      const others2 = state.players.filter((p) => p.id !== player.id && p.monster);
      if (others2.length > 0) {
        const target = others2.reduce((best, p) =>
          p.monster!.stats.atk > best.monster!.stats.atk ? p : best
        );
        const myStats = { ...player.monster.stats };
        player.monster.stats = { ...target.monster!.stats };
        target.monster!.stats = myStats;
      }
      break;
    }
    case 'average_stat_with_random': {
      const e = card.effect as { kind: 'average_stat_with_random'; stat: StatKey };
      const others = state.players.filter((p) => p.id !== player.id && p.monster);
      if (others.length > 0) {
        const target = others[rng.int(0, others.length - 1)]!;
        const avg = Math.ceil((player.monster.stats[e.stat] + target.monster!.stats[e.stat]) / 2);
        player.monster.stats[e.stat] = clampStat(e.stat, avg);
        target.monster!.stats[e.stat] = clampStat(e.stat, avg);
      }
      break;
    }
    case 'round_scaled_stat_mod': {
      const eff2 = card.effect as { kind: 'round_scaled_stat_mod'; stat: StatKey; perRound: number };
      const gain2 = state.round * eff2.perRound;
      player.monster.stats[eff2.stat] += gain2;
      break;
    }
    case 'curse_player':
    case 'draw_passive_top':
      // Handled separately in resolveActionPhase via play extras.
      break;
  }
  saveRng(state, rng);
}

function applySwapActives(state: GameState, swap: NonNullable<ActionPlay['swap']>): void {
  const target = state.players.find((p) => p.id === swap.targetPlayerId);
  if (!target?.monster) return;
  const slots = target.skillSlots;
  // Only non-null cards have skill IDs; default_attack slots are skipped
  const idxA = slots.findIndex((c) => c !== null && c.id === swap.skillIdA);
  const idxB = slots.findIndex((c) => c !== null && c.id === swap.skillIdB);
  if (idxA < 0 || idxB < 0 || idxA === idxB) return;
  const tmp = slots[idxA]!;
  slots[idxA] = slots[idxB]!;
  slots[idxB] = tmp;
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
  extras?: { chosenStat?: StatKey; swap?: ActionPlay['swap']; curseTargetPlayerId?: string },
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
  const card =
    player.actionHand.find((c) => c.id === cardId) ??
    (player.uniqueActionCard?.id === cardId ? player.uniqueActionCard : undefined);
  if (!card) throw new Error(`card ${cardId} not in player's hand`);
  const chosenStat = extras?.chosenStat;
  const swap = extras?.swap;
  if (card.effect.kind === 'stat_mod_choice' || card.effect.kind === 'discard_actives_gain_stat') {
    const allowed = card.effect.stats ?? ALL_STATS;
    if (!chosenStat || !allowed.includes(chosenStat)) {
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
    const hasA = target.skillSlots.some((s) => s?.id === swap.skillIdA) ||
                 target.monster.actives.some((s) => s.id === swap.skillIdA);
    const hasB = target.skillSlots.some((s) => s?.id === swap.skillIdB) ||
                 target.monster.actives.some((s) => s.id === swap.skillIdB);
    if (!hasA || !hasB) throw new Error('swap skills not found on target');
  }
  const curseTargetPlayerId = extras?.curseTargetPlayerId;
  phase.submittedPlays[playerId] = { cardId, chosenStat, swap, curseTargetPlayerId };
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
    const isUnique = player.uniqueActionCard?.id === play.cardId;
    const handIdx = player.actionHand.findIndex((c) => c.id === play.cardId);
    if (!isUnique && handIdx < 0) continue;
    const card = isUnique
      ? player.uniqueActionCard!
      : player.actionHand.splice(handIdx, 1)[0]!;
    state.log.push({ kind: 'action_played', playerId: player.id, cardId: card.id });
    if (card.effect.kind === 'swap_actives' && play.swap) {
      applySwapActives(state, play.swap);
    } else if (card.effect.kind === 'curse_player') {
      const targetId = play.curseTargetPlayerId;
      const target = targetId ? state.players.find((p) => p.id === targetId) : null;
      if (target?.monster) {
        target.monster.stats.atk = Math.max(0, target.monster.stats.atk - card.effect.amount);
        target.monster.stats.def = Math.max(0, target.monster.stats.def - card.effect.amount);
      }
    } else if (card.effect.kind === 'draw_passive_top') {
      const rng = makeRng(state);
      let found = false;
      for (let i = 0; i < card.effect.maxDraws && !found; i++) {
        const drawn = drawTop(state.decks.skill, state.decks.skillGrave, rng);
        if (!drawn) break;
        if (drawn.isPassive) {
          addSkillCardToMonster(state, player, drawn);
          found = true;
        } else {
          state.decks.skillGrave.push(drawn);
        }
      }
      saveRng(state, rng);
    } else {
      applyActionEffect(state, player, card, play.chosenStat);
    }
    // Unique card stays in hand forever; regular cards go to the graveyard.
    if (!isUnique) state.decks.actionGrave.push(card);
    // Build a summary string with the swap-target info if applicable.
    let effectDesc: string;
    if (card.effect.kind === 'swap_actives' && play.swap) {
      const target = state.players.find((p) => p.id === play.swap!.targetPlayerId);
      const aSkill = target?.monster?.actives.find((s) => s.id === play.swap!.skillIdA);
      const bSkill = target?.monster?.actives.find((s) => s.id === play.swap!.skillIdB);
      effectDesc = `${target?.name ?? '?'}: ${aSkill?.name ?? '?'} ↔ ${bSkill?.name ?? '?'} の順序入れ替え`;
    } else if (card.effect.kind === 'curse_player') {
      const target = play.curseTargetPlayerId
        ? state.players.find((p) => p.id === play.curseTargetPlayerId)
        : null;
      effectDesc = target?.monster
        ? `${target.monster.name}にATK-${card.effect.amount}/DEF-${card.effect.amount}の呪い`
        : '（対象なし）';
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
