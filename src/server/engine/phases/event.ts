import type { EventCard, EventTarget, GameState, Player, StatKey } from '../types';
import { drawTop } from '../deck';
import { addSkillCardToMonster, makeRng, saveRng, syncMonsterFromSlots } from '../state';
import { describeEventEffect, describeEventTarget } from '../../../lib/card-text';

/** Pick which players an event card targets. Returns alive players only. */
function selectTargets(target: EventTarget, state: GameState, rng = makeRng(state)): Player[] {
  const alive = state.players.filter((p) => p.monster);
  switch (target) {
    case 'all':
      return alive;
    case 'random': {
      if (alive.length === 0) return [];
      const idx = rng.int(0, alive.length - 1);
      return [alive[idx]!];
    }
    case 'lowestHp': {
      if (alive.length === 0) return [];
      let lowest = alive[0]!;
      for (const p of alive) {
        if (p.monster!.stats.hp < lowest.monster!.stats.hp) lowest = p;
      }
      return [lowest];
    }
    case 'highestAtk': {
      if (alive.length === 0) return [];
      let highest = alive[0]!;
      for (const p of alive) {
        if (p.monster!.stats.atk > highest.monster!.stats.atk) highest = p;
      }
      return [highest];
    }
    case 'highestHp': {
      if (alive.length === 0) return [];
      let highest = alive[0]!;
      for (const p of alive) {
        if (p.monster!.stats.hp > highest.monster!.stats.hp) highest = p;
      }
      return [highest];
    }
    case 'highestDef': {
      if (alive.length === 0) return [];
      let highest = alive[0]!;
      for (const p of alive) {
        if (p.monster!.stats.def > highest.monster!.stats.def) highest = p;
      }
      return [highest];
    }
    case 'highestSpd': {
      if (alive.length === 0) return [];
      let highest = alive[0]!;
      for (const p of alive) {
        if (p.monster!.stats.spd > highest.monster!.stats.spd) highest = p;
      }
      return [highest];
    }
  }
}

function applyEventEffect(state: GameState, card: EventCard, targets: Player[]): void {
  // Global effects (no per-player loop). They flip a flag that's consumed
  // by the corresponding phase transition or by the next battle.
  switch (card.effect.kind) {
    case 'reverse_actives_next_battle':
      state.nextBattleReverseActives = true;
      return;
    case 'skip_action_phase':
      state.skipNextActionPhase = true;
      return;
    case 'extra_battle':
      state.extraBattlePending = true;
      return;
  }

  // Special case: average_hp / average_stat need all targets at once, not per-player
  if (card.effect.kind === 'average_hp' || card.effect.kind === 'average_stat') {
    const stat = card.effect.kind === 'average_stat' ? card.effect.stat : 'hp';
    const playersWithMonster = targets.filter(p => p.monster);
    if (playersWithMonster.length === 0) return;
    const total = playersWithMonster.reduce((sum, p) => sum + p.monster!.stats[stat], 0);
    const avg = Math.ceil(total / playersWithMonster.length);
    for (const p of playersWithMonster) {
      state.log.push({ kind: 'event_effect_applied', cardId: card.id, playerId: p.id });
      p.monster!.stats[stat] = avg;
    }
    return;
  }

  const rng = makeRng(state);

  // Special case: rotate_skill — everyone gives 1 random slot skill, receives 1 via circular shift
  if (card.effect.kind === 'rotate_skill') {
    const participants = targets.filter(p => p.monster);
    if (participants.length < 2) return;
    type Pick = { player: Player; card: import('../types').SkillCard; idx: number };
    const picks: Pick[] = [];
    for (const p of participants) {
      const candidates: { card: import('../types').SkillCard; idx: number }[] = [];
      for (let i = 0; i < p.activeSlotCount; i++) {
        const s = p.skillSlots[i];
        if (s) candidates.push({ card: s, idx: i });
      }
      if (candidates.length === 0) continue;
      const pick = candidates[rng.int(0, candidates.length - 1)]!;
      picks.push({ player: p, card: pick.card, idx: pick.idx });
    }
    if (picks.length < 2) return;
    const n = picks.length;
    const offset = rng.int(1, n - 1);
    // Remove all picked skills from their slots first (simultaneous)
    for (const pick of picks) pick.player.skillSlots[pick.idx] = null;
    // Distribute: player[i] receives skill from player[(i + offset) % n]
    for (let i = 0; i < n; i++) {
      const recipient = picks[i]!.player;
      const donor = picks[(i + offset) % n]!;
      recipient.skillStock.push(donor.card);
      state.log.push({ kind: 'event_effect_applied', cardId: card.id, playerId: recipient.id });
    }
    for (const { player } of picks) syncMonsterFromSlots(state, player);
    saveRng(state, rng);
    return;
  }

  // Special case: pool_and_redistribute_skills — everyone contributes from stock, pool is reshuffled and dealt back
  if (card.effect.kind === 'pool_and_redistribute_skills') {
    const participants = targets.filter(p => p.monster && p.skillStock.length > 0);
    if (participants.length < 2) return;
    const contribute = (card.effect as { kind: 'pool_and_redistribute_skills'; count: number }).count;
    const pool: import('../types').SkillCard[] = [];
    for (const p of participants) {
      const take = Math.min(contribute, p.skillStock.length);
      for (let i = 0; i < take; i++) {
        const idx = rng.int(0, p.skillStock.length - 1);
        pool.push(p.skillStock.splice(idx, 1)[0]!);
      }
      state.log.push({ kind: 'event_effect_applied', cardId: card.id, playerId: p.id });
    }
    // Shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    // Deal round-robin
    pool.forEach((skill, i) => {
      participants[i % participants.length]!.skillStock.push(skill);
    });
    saveRng(state, rng);
    return;
  }

  for (const t of targets) {
    if (!t.monster) continue;
    state.log.push({ kind: 'event_effect_applied', cardId: card.id, playerId: t.id });
    switch (card.effect.kind) {
      case 'stat_mod':
        t.monster.stats[card.effect.stat] += card.effect.amount;
        break;
      case 'heal':
        t.monster.stats.hp += card.effect.amount;
        break;
      case 'damage':
        t.monster.stats.hp = Math.max(1, t.monster.stats.hp - card.effect.amount);
        break;
      case 'swap_stat': {
        // Swap a stat between target and a random other player. Niche, mostly flavor.
        const others = state.players.filter((p) => p !== t && p.monster);
        if (others.length === 0) break;
        const partner = others[rng.int(0, others.length - 1)]!;
        const a = t.monster.stats[card.effect.stat];
        const b = partner.monster!.stats[card.effect.stat];
        t.monster.stats[card.effect.stat] = b;
        partner.monster!.stats[card.effect.stat] = a;
        break;
      }
      case 'add_skill_top': {
        const top = drawTop(state.decks.skill, state.decks.skillGrave, rng);
        if (top) {
          addSkillCardToMonster(state, t, top);
        }
        break;
      }
      case 'swap_atk_def': {
        const atk = t.monster.stats.atk;
        t.monster.stats.atk = t.monster.stats.def;
        t.monster.stats.def = atk;
        break;
      }
      case 'swap_two_stats': {
        const sa = (card.effect as { kind: 'swap_two_stats'; statA: StatKey; statB: StatKey }).statA;
        const sb = (card.effect as { kind: 'swap_two_stats'; statA: StatKey; statB: StatKey }).statB;
        const tmp = t.monster.stats[sa];
        t.monster.stats[sa] = t.monster.stats[sb];
        t.monster.stats[sb] = tmp;
        break;
      }
      case 'shuffle_actives': {
        // Deferred: apply just before the next battle starts
        if (!state.nextBattleShufflePlayerIds.includes(t.id)) {
          state.nextBattleShufflePlayerIds.push(t.id);
        }
        break;
      }
      case 'discard_action_card': {
        if (t.actionHand.length === 0) break;
        const idx = rng.int(0, t.actionHand.length - 1);
        const discarded = t.actionHand.splice(idx, 1)[0]!;
        state.decks.actionGrave.push(discarded);
        break;
      }
      case 'draw_action_card': {
        const actionCard = drawTop(state.decks.action, state.decks.actionGrave, rng);
        if (actionCard) t.actionHand.push(actionCard);
        break;
      }
      case 'all_stats_mod': {
        t.monster.stats.hp += card.effect.amount;
        t.monster.stats.atk += card.effect.amount;
        t.monster.stats.def = Math.max(0, t.monster.stats.def + card.effect.amount);
        t.monster.stats.spd = Math.max(0, t.monster.stats.spd + card.effect.amount);
        break;
      }
      case 'set_stat': {
        t.monster.stats[card.effect.stat] = card.effect.value;
        break;
      }
      case 'pay_hp_draw_skill': {
        t.monster.stats.hp = Math.max(1, t.monster.stats.hp - card.effect.hpCost);
        const skillCard = drawTop(state.decks.skill, state.decks.skillGrave, rng);
        if (skillCard) addSkillCardToMonster(state, t, skillCard);
        break;
      }
      case 'steal_skill': {
        if (t.skillStock.length === 0) break;
        const others = state.players.filter((p) => p !== t && p.monster);
        if (others.length === 0) break;
        const cardIdx = rng.int(0, t.skillStock.length - 1);
        const stolen = t.skillStock.splice(cardIdx, 1)[0]!;
        const recipient = others[rng.int(0, others.length - 1)]!;
        recipient.skillStock.push(stolen);
        break;
      }
      case 'discard_skills': {
        const candidates: { card: import('../types').SkillCard; idx: number }[] = [];
        for (let i = 0; i < t.activeSlotCount; i++) {
          const s = t.skillSlots[i];
          if (s) candidates.push({ card: s, idx: i });
        }
        const toDiscard = Math.min(card.effect.count, candidates.length);
        for (let d = 0; d < toDiscard; d++) {
          const pick = rng.int(0, candidates.length - 1);
          const { card: discarded, idx } = candidates.splice(pick, 1)[0]!;
          t.skillSlots[idx] = null;
          state.decks.skillGrave.push(discarded);
        }
        if (toDiscard > 0) syncMonsterFromSlots(state, t);
        break;
      }
    }
  }
  saveRng(state, rng);
}

/** Resolve the event phase: top of event deck applies, then to graveyard. */
export function resolveEventPhase(state: GameState): void {
  if (state.phase !== 'event') throw new Error('not in event phase');
  const rng = makeRng(state);
  const card = drawTop(state.decks.event, state.decks.eventGrave, rng);
  saveRng(state, rng);
  if (!card) {
    state.eventPhaseSummary = null;
    advanceFromEvent(state);
    return;
  }
  const targets = selectTargets(card.target, state);
  state.log.push({ kind: 'event_played', cardId: card.id, targets: targets.map((t) => t.id) });
  applyEventEffect(state, card, targets);
  state.decks.eventGrave.push(card);
  state.eventPhaseSummary = {
    cardId: card.id,
    cardName: card.name,
    targetLabel: describeEventTarget(card.target),
    effectDesc: describeEventEffect(card),
    targetIds: targets.map((t) => t.id),
  };
  advanceFromEvent(state);
}

function advanceFromEvent(state: GameState): void {
  if (state.extraBattlePending) {
    // Flag tells reward phase to return here (extra battle) instead of advancing the round.
    state.extraBattlePending = false;
    state.returnToBattleAfterReward = true;
  }
  state.phase = 'battle';
  state.log.push({
    kind: 'phase_change',
    phase: state.phase,
    round: state.round,
    miniRound: state.miniRound,
  });
}
