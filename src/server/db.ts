import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
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

export class HallOfFameStore {
  private db: Database.Database;

  constructor(dbPath: string = ':memory:') {
    if (dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hall_of_fame (
        id          TEXT PRIMARY KEY,
        owner_name  TEXT NOT NULL,
        base_id     TEXT NOT NULL,
        monster_name TEXT NOT NULL,
        monster_json TEXT NOT NULL,
        seed        INTEGER NOT NULL,
        created_at  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_hof_created_at ON hall_of_fame (created_at DESC);
    `);
  }

  save(args: { champion: Champion; ownerName: string; seed: number }): StoredChampion {
    const entry: StoredChampion = {
      id: cryptoId(),
      ownerName: args.ownerName,
      baseId: args.champion.monster.baseId,
      monsterName: args.champion.monster.name,
      monster: args.champion.monster,
      seed: args.seed,
      createdAt: Date.now(),
    };
    this.db
      .prepare(
        `INSERT INTO hall_of_fame (id, owner_name, base_id, monster_name, monster_json, seed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.ownerName,
        entry.baseId,
        entry.monsterName,
        JSON.stringify(entry.monster),
        entry.seed,
        entry.createdAt,
      );
    return entry;
  }

  list(limit = 100): StoredChampion[] {
    const rows = this.db
      .prepare<unknown[], StoredRow>(
        `SELECT id, owner_name, base_id, monster_name, monster_json, seed, created_at
         FROM hall_of_fame
         ORDER BY created_at DESC, rowid DESC
         LIMIT ?`,
      )
      .all(limit);
    return rows.map(rowToChampion);
  }

  get(id: string): StoredChampion | null {
    const row = this.db
      .prepare<[string], StoredRow>(
        `SELECT id, owner_name, base_id, monster_name, monster_json, seed, created_at
         FROM hall_of_fame WHERE id = ?`,
      )
      .get(id);
    return row ? rowToChampion(row) : null;
  }

  count(): number {
    const row = this.db.prepare<[], { c: number }>(`SELECT COUNT(*) AS c FROM hall_of_fame`).get();
    return row?.c ?? 0;
  }

  close(): void {
    this.db.close();
  }
}

type StoredRow = {
  id: string;
  owner_name: string;
  base_id: string;
  monster_name: string;
  monster_json: string;
  seed: number;
  created_at: number;
};

function rowToChampion(r: StoredRow): StoredChampion {
  return {
    id: r.id,
    ownerName: r.owner_name,
    baseId: r.base_id,
    monsterName: r.monster_name,
    monster: JSON.parse(r.monster_json) as Monster,
    seed: r.seed,
    createdAt: r.created_at,
  };
}

function cryptoId(): string {
  // Browser/Node both have crypto.randomUUID since Node 19.
  return globalThis.crypto.randomUUID();
}

let singleton: HallOfFameStore | null = null;

/** Lazily-initialized process-wide store. Used by API routes and the WS server. */
export function getStore(): HallOfFameStore {
  if (singleton) return singleton;
  const path = process.env.SAIKYO_DB ?? join(process.cwd(), 'data', 'saikyo.db');
  singleton = new HallOfFameStore(path);
  return singleton;
}
