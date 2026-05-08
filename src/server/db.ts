import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Champion, Monster } from './engine/types';

export type StoredChampion = {
  id: string;
  ownerName: string;
  baseId: string;
  monsterName: string;
  monster: Monster;
  seed: number;
  createdAt: number;
};

/**
 * Tiny JSON-file backed store for hall-of-fame entries. Pure JS so it works
 * on any Node version / OS without a native build step. Suitable for the
 * small dataset this project produces.
 *
 * Pass `null` (or no path) for an in-memory store — useful for tests.
 */
export class HallOfFameStore {
  private entries: StoredChampion[] = [];
  private writeSeq = 0;

  constructor(private readonly path: string | null = null) {
    if (path && existsSync(path)) {
      try {
        const raw = readFileSync(path, 'utf8');
        const parsed: unknown = raw.trim() ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
          this.entries = parsed as StoredChampion[];
        }
      } catch (err) {
        console.error(`hall-of-fame: failed to load ${path}, starting fresh:`, err);
        this.entries = [];
      }
    }
    if (path) mkdirSync(dirname(path), { recursive: true });
  }

  save(args: { champion: Champion; ownerName: string; seed: number }): StoredChampion {
    this.writeSeq += 1;
    const entry: StoredChampion = {
      id: cryptoId(),
      ownerName: args.ownerName,
      baseId: args.champion.monster.baseId,
      monsterName: args.champion.monster.name,
      monster: args.champion.monster,
      seed: args.seed,
      createdAt: Date.now() * 1000 + this.writeSeq, // monotonic for ordering
    };
    this.entries.push(entry);
    this.persist();
    return entry;
  }

  list(limit = 100): StoredChampion[] {
    return this.entries
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  get(id: string): StoredChampion | null {
    return this.entries.find((e) => e.id === id) ?? null;
  }

  count(): number {
    return this.entries.length;
  }

  close(): void {
    // No-op for the JSON store; persist is synchronous on each save.
  }

  private persist(): void {
    if (!this.path) return;
    try {
      writeFileSync(this.path, JSON.stringify(this.entries, null, 2));
    } catch (err) {
      console.error('hall-of-fame: persist failed:', err);
    }
  }
}

function cryptoId(): string {
  return globalThis.crypto.randomUUID();
}

let singleton: HallOfFameStore | null = null;

/** Lazily-initialized process-wide store. Used by API routes and the WS server. */
export function getStore(): HallOfFameStore {
  if (singleton) return singleton;
  const path = process.env.SAIKYO_DB ?? join(process.cwd(), 'data', 'saikyo.json');
  singleton = new HallOfFameStore(path);
  return singleton;
}
