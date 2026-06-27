import type { ExploreQueueItem } from '@smartcrate/shared';
import type { Db } from '../db/db';

interface ExploreRow {
  track_id: string;
  score: number;
  reason: string;
  position: number;
}

const toItem = (r: ExploreRow): ExploreQueueItem => ({
  trackId: r.track_id,
  score: r.score,
  reason: r.reason,
});

export function queueLength(db: Db): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM explore_queue').get() as { n: number };
  return row.n;
}

function nextPosition(db: Db): number {
  const row = db.prepare('SELECT MAX(position) AS m FROM explore_queue').get() as { m: number | null };
  return (row.m ?? -1) + 1;
}

export function isSeen(db: Db, trackId: string): boolean {
  return db.prepare('SELECT 1 FROM seen_tracks WHERE track_id = ?').get(trackId) !== undefined;
}

export function markSeen(db: Db, trackId: string): void {
  db.prepare(
    'INSERT OR IGNORE INTO seen_tracks (track_id, seen_at) VALUES (?, ?)',
  ).run(trackId, new Date().toISOString());
}

/** Append a candidate to the explore queue (and mark it seen). */
export function enqueue(db: Db, item: ExploreQueueItem): void {
  db.prepare(
    `INSERT OR IGNORE INTO explore_queue (track_id, score, reason, position) VALUES (?, ?, ?, ?)`,
  ).run(item.trackId, item.score, item.reason, nextPosition(db));
  markSeen(db, item.trackId);
}

/** The current (front) item in the queue, or undefined when empty. */
export function currentItem(db: Db): ExploreQueueItem | undefined {
  const row = db
    .prepare('SELECT track_id, score, reason, position FROM explore_queue ORDER BY position LIMIT 1')
    .get() as ExploreRow | undefined;
  return row ? toItem(row) : undefined;
}

/** Remove a track from the queue (on like/dislike/skip); stays in seen_tracks. */
export function removeFromQueue(db: Db, trackId: string): void {
  db.prepare('DELETE FROM explore_queue WHERE track_id = ?').run(trackId);
}

export function getQueue(db: Db): ExploreQueueItem[] {
  const rows = db
    .prepare('SELECT track_id, score, reason, position FROM explore_queue ORDER BY position')
    .all() as unknown as ExploreRow[];
  return rows.map(toItem);
}
