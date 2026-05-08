import type { Monster } from './types';

export const NAME_SEPARATOR = '・';
export const MAX_NAME_LENGTH = 60;

/** Tags available to a monster (one per skill instance carrying a nameTag). */
export function getAvailableTags(monster: Monster): string[] {
  const tags: string[] = [];
  for (const a of monster.actives) if (a.nameTag) tags.push(a.nameTag);
  for (const p of monster.passives) if (p.nameTag) tags.push(p.nameTag);
  return tags;
}

/**
 * Validate a candidate monster name. Names are formed from the monster's
 * available tags joined with `・`. Each tag occurrence consumes one available
 * tag from the multiset; tags can repeat only as many times as the monster has
 * acquired them.
 */
export function validateMonsterName(name: string, monster: Monster): boolean {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) return false;
  const parts = trimmed
    .split(NAME_SEPARATOR)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) return false;
  const available = getAvailableTags(monster);
  for (const part of parts) {
    const idx = available.indexOf(part);
    if (idx < 0) return false;
    available.splice(idx, 1);
  }
  return true;
}
