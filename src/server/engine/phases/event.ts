import type { EventCard, EventTarget, GameState, Player } from '../types';
import { drawTop } from '../deck';
import { addSkillCardToMonster, makeRng, saveRng } from '../state';
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

  // Special case: average_hp needs all targets at once, not per-player
  if (card.effect.kind === 'average_hp') {
    const playersWithMonster = targets.filter(p => p.monster);
    if (playersWithMonster.length === 0) return;
    const total = playersWithMonster.reduce((sum, p) => sum + p.monster!.stats.hp, 0);
    const avg = Math.ceil(total / playersWithMonster.length);
    for (const p of playersWithMonster) {
      state.log.push({ kind: 'event_effect_applied', cardId: card.id, playerId: p.id });
      p.monster!.stats.hp = avg;
    }
    return;
  }

  const rng = makeRng(state);
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
      case 'shuffle_actives': {
        const actives = t.monster.actives;
        for (let i = actives.length - 1; i > 0; i--) {
          const j = rng.int(0, i);
          const tmp = actives[i]!;
          actives[i] = actives[j]!;
          actives[j] = tmp;
        }
        // Re-assign order values after shuffle
        actives.forEach((a, i) => { a.order = i + 1; });
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
