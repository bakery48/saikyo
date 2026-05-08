import { RNG } from './rng';

/** Fisher-Yates shuffle. Returns a new array; original is not mutated. */
export function shuffle<T>(arr: readonly T[], rng: RNG): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** Draw the top card. Mutates deck. If deck is empty, reshuffles graveyard into it. */
export function drawTop<T>(deck: T[], graveyard: T[], rng: RNG): T | undefined {
  if (deck.length === 0) {
    if (graveyard.length === 0) return undefined;
    const reshuffled = shuffle(graveyard, rng);
    deck.push(...reshuffled);
    graveyard.length = 0;
  }
  return deck.shift();
}

/** Draw N cards from the top. Returns however many were available. */
export function drawN<T>(deck: T[], graveyard: T[], n: number, rng: RNG): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    const card = drawTop(deck, graveyard, rng);
    if (!card) break;
    out.push(card);
  }
  return out;
}
