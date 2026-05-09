import type { Monster } from './types';
import { MONSTERS_BY_ID } from './cards/monsters';

export const NAME_SEPARATOR = '・';
export const MAX_NAME_LENGTH = 60;

/** The fixed base monster name (e.g. "アクアリス"). Cannot be edited away. */
export function getBaseName(monster: Monster): string {
  return MONSTERS_BY_ID[monster.baseId]?.name ?? monster.name;
}

/** Tags available to a monster (one per skill instance carrying a nameTag). */
export function getAvailableTags(monster: Monster): string[] {
  const tags: string[] = [];
  for (const a of monster.actives) if (a.nameTag) tags.push(a.nameTag);
  for (const p of monster.passives) if (p.nameTag) tags.push(p.nameTag);
  return tags;
}

/** Compose a final monster name from prefix tags and the base monster name. */
export function composeMonsterName(prefixTags: string[], monster: Monster): string {
  const cleaned = prefixTags.map((t) => t.trim()).filter((t) => t.length > 0);
  const baseName = getBaseName(monster);
  if (cleaned.length === 0) return baseName;
  return cleaned.join(NAME_SEPARATOR) + NAME_SEPARATOR + baseName;
}

/**
 * Validate a candidate monster name. The name must end with the base monster
 * name (the unmodifiable suffix); any prefix parts before it must come from
 * the monster's available tag multiset.
 */
export function validateMonsterName(name: string, monster: Monster): boolean {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) return false;
  const baseName = getBaseName(monster);
  if (trimmed === baseName) return true;
  const suffix = NAME_SEPARATOR + baseName;
  if (!trimmed.endsWith(suffix)) return false;
  const prefix = trimmed.slice(0, trimmed.length - suffix.length);
  const parts = prefix
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

/** Extract the editable prefix tags from a current monster name. */
export function extractPrefixTags(name: string, monster: Monster): string[] {
  const baseName = getBaseName(monster);
  if (name === baseName) return [];
  const suffix = NAME_SEPARATOR + baseName;
  if (!name.endsWith(suffix)) return [];
  const prefix = name.slice(0, name.length - suffix.length);
  return prefix
    .split(NAME_SEPARATOR)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
