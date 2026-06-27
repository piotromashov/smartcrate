import type { Db } from '../db/db';

/** A simple key→value cache used to avoid repeat Discogs network calls. */
export interface CacheStore {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
}

/** Cache backed by the `discogs_cache` SQLite table. */
export function sqliteCache(db: Db): CacheStore {
  return {
    get(key) {
      const row = db.prepare('SELECT value FROM discogs_cache WHERE key = ?').get(key) as
        | { value: string }
        | undefined;
      return row?.value;
    },
    set(key, value) {
      db.prepare(
        `INSERT INTO discogs_cache (key, value, fetched_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, fetched_at = excluded.fetched_at`,
      ).run(key, value, new Date().toISOString());
    },
  };
}

/** In-memory cache (tests). */
export function memoryCache(): CacheStore {
  const map = new Map<string, string>();
  return {
    get: (k) => map.get(k),
    set: (k, v) => void map.set(k, v),
  };
}
