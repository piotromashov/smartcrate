import type { Artist, Label, Release, Track, RatingEvent, RatingValue } from '@smartcrate/shared';
import type { Db } from './db';

// ── Entity upserts ───────────────────────────────────────────────────────────

export function upsertArtist(db: Db, artist: Artist): void {
  db.prepare(
    `INSERT INTO artists (id, name) VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
  ).run(artist.id, artist.name);
}

export function upsertLabel(db: Db, label: Label): void {
  db.prepare(
    `INSERT INTO labels (id, name) VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
  ).run(label.id, label.name);
}

export function upsertRelease(db: Db, release: Release): void {
  db.prepare(
    `INSERT INTO releases (id, title, is_va) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, is_va = excluded.is_va`,
  ).run(release.id, release.title, release.isVa ? 1 : 0);

  const linkLabel = db.prepare(
    `INSERT OR IGNORE INTO release_labels (release_id, label_id) VALUES (?, ?)`,
  );
  for (const labelId of release.labelIds) linkLabel.run(release.id, labelId);

  const linkArtist = db.prepare(
    `INSERT OR IGNORE INTO release_artists (release_id, artist_id) VALUES (?, ?)`,
  );
  for (const artistId of release.artistIds) linkArtist.run(release.id, artistId);
}

export function upsertTrack(db: Db, track: Track): void {
  db.prepare(
    `INSERT INTO tracks (id, release_id, title, position, youtube_video_id, unresolved)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       position = excluded.position,
       youtube_video_id = excluded.youtube_video_id,
       unresolved = excluded.unresolved`,
  ).run(
    track.id,
    track.releaseId,
    track.title,
    track.position,
    track.youtubeVideoId,
    track.unresolved ? 1 : 0,
  );

  const linkArtist = db.prepare(
    `INSERT OR IGNORE INTO track_artists (track_id, artist_id) VALUES (?, ?)`,
  );
  for (const artistId of track.artistIds) linkArtist.run(track.id, artistId);
}

// ── Rating events (append-only) ──────────────────────────────────────────────

interface RatingEventRow {
  id: number;
  track_id: string;
  value: RatingValue;
  created_at: string;
}

function toRatingEvent(row: RatingEventRow): RatingEvent {
  return { id: row.id, trackId: row.track_id, value: row.value, createdAt: row.created_at };
}

/** Append a rating event. Never updates or deletes existing events. */
export function recordRatingEvent(db: Db, trackId: string, value: RatingValue): RatingEvent {
  const createdAt = new Date().toISOString();
  const info = db
    .prepare(`INSERT INTO rating_events (track_id, value, created_at) VALUES (?, ?, ?)`)
    .run(trackId, value, createdAt);
  return {
    id: Number(info.lastInsertRowid),
    trackId,
    value,
    createdAt,
  };
}

export function getAllRatingEvents(db: Db): RatingEvent[] {
  const rows = db
    .prepare(`SELECT id, track_id, value, created_at FROM rating_events ORDER BY id`)
    .all() as unknown as RatingEventRow[];
  return rows.map(toRatingEvent);
}

export function getRatingEventsForTrack(db: Db, trackId: string): RatingEvent[] {
  const rows = db
    .prepare(
      `SELECT id, track_id, value, created_at FROM rating_events WHERE track_id = ? ORDER BY id`,
    )
    .all(trackId) as unknown as RatingEventRow[];
  return rows.map(toRatingEvent);
}

/** True when the track has any rating event (used to exclude already-rated candidates). */
export function isTrackRated(db: Db, trackId: string): boolean {
  const row = db
    .prepare(`SELECT 1 FROM rating_events WHERE track_id = ? LIMIT 1`)
    .get(trackId);
  return row !== undefined;
}

/**
 * Delete a track's most recent rating event (single-level undo) and return its
 * value, or null if there was none. The only sanctioned removal from the
 * otherwise append-only log; scores are recomputed by the caller.
 */
export function deleteLastRatingEvent(db: Db, trackId: string): RatingValue | null {
  const row = db
    .prepare(`SELECT id, value FROM rating_events WHERE track_id = ? ORDER BY id DESC LIMIT 1`)
    .get(trackId) as { id: number; value: RatingValue } | undefined;
  if (!row) return null;
  db.prepare(`DELETE FROM rating_events WHERE id = ?`).run(row.id);
  return row.value;
}
