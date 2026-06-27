import type { Artist, Label, Release, Track, PlayableTrack } from '@smartcrate/shared';
import type { Db } from './db/db';
import { currentItem } from './recommender/queue';

function getTrack(db: Db, trackId: string): Track | undefined {
  const row = db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId) as
    | { id: string; release_id: number; title: string; position: string; youtube_video_id: string | null; unresolved: number }
    | undefined;
  if (!row) return undefined;
  const artistIds = (
    db.prepare('SELECT artist_id FROM track_artists WHERE track_id = ?').all(trackId) as Array<{ artist_id: number }>
  ).map((r) => r.artist_id);
  return {
    id: row.id,
    releaseId: row.release_id,
    title: row.title,
    position: row.position,
    artistIds,
    youtubeVideoId: row.youtube_video_id,
    unresolved: row.unresolved === 1,
  };
}

function getRelease(db: Db, releaseId: number): Release | undefined {
  const row = db.prepare('SELECT * FROM releases WHERE id = ?').get(releaseId) as
    | { id: number; title: string; is_va: number }
    | undefined;
  if (!row) return undefined;
  const labelIds = (
    db.prepare('SELECT label_id FROM release_labels WHERE release_id = ?').all(releaseId) as Array<{ label_id: number }>
  ).map((r) => r.label_id);
  const artistIds = (
    db.prepare('SELECT artist_id FROM release_artists WHERE release_id = ?').all(releaseId) as Array<{ artist_id: number }>
  ).map((r) => r.artist_id);
  return { id: row.id, title: row.title, labelIds, artistIds, isVa: row.is_va === 1 };
}

function getArtists(db: Db, ids: number[]): Artist[] {
  return ids
    .map((id) => db.prepare('SELECT id, name FROM artists WHERE id = ?').get(id) as Artist | undefined)
    .filter((a): a is Artist => a !== undefined);
}

function getLabels(db: Db, ids: number[]): Label[] {
  return ids
    .map((id) => db.prepare('SELECT id, name FROM labels WHERE id = ?').get(id) as Label | undefined)
    .filter((l): l is Label => l !== undefined);
}

/** Build the full playable view (track + release + artists + labels + reason) for a queue item. */
export function toPlayable(db: Db, trackId: string, reason: string): PlayableTrack | undefined {
  const track = getTrack(db, trackId);
  if (!track) return undefined;
  const release = getRelease(db, track.releaseId);
  if (!release) return undefined;
  return {
    track,
    release,
    artists: getArtists(db, track.artistIds),
    labels: getLabels(db, release.labelIds),
    reason,
  };
}

/** The current front-of-queue track as a playable view, or null when the queue is empty. */
export function currentPlayable(db: Db): PlayableTrack | null {
  const item = currentItem(db);
  if (!item) return null;
  return toPlayable(db, item.trackId, item.reason) ?? null;
}
