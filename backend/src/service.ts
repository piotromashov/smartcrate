import type { PlayableTrack, RatingValue } from '@smartcrate/shared';
import type { Db } from './db/db';
import type { Config } from './config';
import { rateTrack } from './rating/scores';
import { removeFromQueue } from './recommender/queue';
import { enqueueDownload } from './downloads/queue';
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
