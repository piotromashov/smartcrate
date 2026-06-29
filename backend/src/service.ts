import type { PlayableTrack, RatingValue } from '@smartcrate/shared';
import type { Db } from './db/db';
import type { Config } from './config';
import { rateTrack, recomputeScores } from './rating/scores';
import { removeFromQueue, enqueueFront } from './recommender/queue';
import { enqueueDownload, cancelDownload } from './downloads/queue';
import { deleteLastRatingEvent } from './db/repositories';
import { currentPlayable } from './playable';

export type RateAction = RatingValue | 'skip';

/**
 * Apply a like / dislike / skip to a track.
 * - like: record the rating + auto-enqueue the download, but KEEP the current
 *   track playing (does not advance). The download dedupe prevents duplicates if
 *   the user likes again.
 * - dislike: record the rating and advance to the next track.
 * - skip: record no rating event and advance.
 * Returns the (possibly unchanged) current track.
 */
export function applyRating(
  db: Db,
  config: Config,
  trackId: string,
  action: RateAction,
): PlayableTrack | null {
  if (action === 'skip') {
    removeFromQueue(db, trackId);
    return currentPlayable(db);
  }
  rateTrack(db, config.weights, trackId, action);
  if (action === 'like') {
    enqueueDownload(db, trackId);
    return currentPlayable(db); // stays on the current track
  }
  removeFromQueue(db, trackId); // dislike advances
  return currentPlayable(db);
}

/**
 * Undo a track's most recent like/dislike (single-level): delete the event,
 * recompute scores, and reverse the side-effect — a like's pending download is
 * cancelled (the track is still current), a dislike's track is re-surfaced as
 * current. No-op when the track has no rating event.
 */
export function undoRating(db: Db, config: Config, trackId: string): PlayableTrack | null {
  const value = deleteLastRatingEvent(db, trackId);
  if (!value) return currentPlayable(db);
  recomputeScores(db, config.weights);
  if (value === 'like') {
    cancelDownload(db, trackId);
  } else {
    enqueueFront(db, { trackId, score: 0, reason: 'resumed' }); // dislike → resume the track
  }
  return currentPlayable(db);
}
