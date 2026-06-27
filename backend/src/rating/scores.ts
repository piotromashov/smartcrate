import type { EntityKind, RatingEvent, RatingValue, EntityScore } from '@smartcrate/shared';
import type { Db } from '../db/db';
import type { Weights } from '../config';
import { recordRatingEvent, getAllRatingEvents } from '../db/repositories';

interface TrackEntities {
  releaseId: number;
  artistIds: number[];
  labelIds: number[];
}

/** The entities a rating on this track touches: the track, its artists, its release, and the release's labels. */
function getTrackEntities(db: Db, trackId: string): TrackEntities | undefined {
  const trackRow = db.prepare('SELECT release_id FROM tracks WHERE id = ?').get(trackId) as
    | { release_id: number }
    | undefined;
  if (!trackRow) return undefined;
  const releaseId = trackRow.release_id;
  const artistIds = (
    db.prepare('SELECT artist_id FROM track_artists WHERE track_id = ?').all(trackId) as Array<{
      artist_id: number;
    }>
  ).map((r) => r.artist_id);
  const labelIds = (
    db.prepare('SELECT label_id FROM release_labels WHERE release_id = ?').all(releaseId) as Array<{
      label_id: number;
    }>
  ).map((r) => r.label_id);
  return { releaseId, artistIds, labelIds };
}

/** The signed weight a rating contributes to each touched entity's score. */
function ratingDelta(weights: Weights, value: RatingValue): number {
  return value === 'like' ? weights.like : -weights.dislike;
}

function addToScore(db: Db, kind: EntityKind, entityId: string, delta: number): void {
  db.prepare(
    `INSERT INTO entity_scores (kind, entity_id, score) VALUES (?, ?, ?)
     ON CONFLICT(kind, entity_id) DO UPDATE SET score = score + excluded.score`,
  ).run(kind, entityId, delta);
}

/** Apply a rating's delta to the track and all of its associated entities. */
function applyDelta(db: Db, trackId: string, entities: TrackEntities, delta: number): void {
  addToScore(db, 'track', trackId, delta);
  addToScore(db, 'release', String(entities.releaseId), delta);
  for (const artistId of entities.artistIds) addToScore(db, 'artist', String(artistId), delta);
  for (const labelId of entities.labelIds) addToScore(db, 'label', String(labelId), delta);
}

/**
 * Record a like/dislike (append-only) and incrementally update the derived
 * scores of the track and its artists, label(s), and release.
 */
export function rateTrack(
  db: Db,
  weights: Weights,
  trackId: string,
  value: RatingValue,
): RatingEvent {
  const entities = getTrackEntities(db, trackId);
  if (!entities) throw new Error(`Unknown track: ${trackId}`);
  const event = recordRatingEvent(db, trackId, value);
  applyDelta(db, trackId, entities, ratingDelta(weights, value));
  return event;
}

export function getScore(db: Db, kind: EntityKind, entityId: string): number {
  const row = db
    .prepare('SELECT score FROM entity_scores WHERE kind = ? AND entity_id = ?')
    .get(kind, entityId) as { score: number } | undefined;
  return row?.score ?? 0;
}

export function getAllScores(db: Db): EntityScore[] {
  const rows = db.prepare('SELECT kind, entity_id, score FROM entity_scores ORDER BY kind, entity_id').all() as Array<{
    kind: EntityKind;
    entity_id: string;
    score: number;
  }>;
  return rows.map((r) => ({ kind: r.kind, entityId: r.entity_id, score: r.score }));
}

/**
 * Recompute every entity score from scratch by replaying the full rating event
 * log. The event log is the source of truth; this must reproduce the
 * incrementally-maintained scores exactly.
 */
export function recomputeScores(db: Db, weights: Weights): void {
  db.exec('DELETE FROM entity_scores');
  for (const event of getAllRatingEvents(db)) {
    const entities = getTrackEntities(db, event.trackId);
    if (!entities) continue;
    applyDelta(db, event.trackId, entities, ratingDelta(weights, event.value));
  }
}
