import type { PlayableTrack, RatingValue } from '@smartcrate/shared';
import type { Db } from './db/db';
import type { Config } from './config';
import { rateTrack } from './rating/scores';
import { removeFromQueue } from './recommender/queue';
import { enqueueDownload } from './downloads/queue';
import { currentPlayable } from './playable';

export type RateAction = RatingValue | 'skip';

/**
 * Apply a like / dislike / skip to a track: record the rating (like/dislike),
 * remove it from the explore queue, and auto-enqueue a download on like. Skip
 * records no rating event. Returns the new current track.
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
  removeFromQueue(db, trackId);
  if (action === 'like') enqueueDownload(db, trackId);
  return currentPlayable(db);
}
