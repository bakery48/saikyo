import type { EventCard, EventTarget, GameState, Player } from '../types';
import { drawTop } from '../deck';
import { addSkillCardToMonster, makeRng, saveRng } from '../state';

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
    advanceFromEvent(state);
    return;
  }
  const targets = selectTargets(card.target, state);
  state.log.push({ kind: 'event_played', cardId: card.id, targets: targets.map((t) => t.id) });
  applyEventEffect(state, card, targets);
  state.decks.eventGrave.push(card);
  advanceFromEvent(state);
}

function advanceFromEvent(state: GameState): void {
  state.phase = 'action';
  state.log.push({
    kind: 'phase_change',
    phase: 'action',
    round: state.round,
    miniRound: state.miniRound,
  });
}
