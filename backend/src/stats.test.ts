import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './db/db';
import { upsertRelease, upsertTrack, recordRatingEvent } from './db/repositories';
import { markSeen } from './recommender/queue';
import { getStats } from './stats';

function track(db: ReturnType<typeof openDb>, id: string, resolved = true): void {
  upsertTrack(db, {
    id,
    releaseId: 1,
    title: id,
    position: 'A1',
    artistIds: [],
    youtubeVideoId: resolved ? 'v' : null,
    unresolved: !resolved,
  });
}

test('like-rate (overall + per-source) and counters aggregate from the log', () => {
  const db = openDb(':memory:');
  upsertRelease(db, { id: 1, title: 'R', labelIds: [], artistIds: [], isVa: false });
  track(db, 't1');
  track(db, 't2');
  track(db, 't3');
  track(db, 't4');
  markSeen(db, 't1', 'discovery');
  markSeen(db, 't2', 'sibling');
  markSeen(db, 't3', 'discovery');
  markSeen(db, 't4', null); // pre-feature row → excluded from per-source

  recordRatingEvent(db, 't1', 'like');
  recordRatingEvent(db, 't2', 'like');
  recordRatingEvent(db, 't3', 'dislike');

  const s = getStats(db);
  assert.equal(s.likeRate.overall, 2 / 3); // 2 likes, 1 dislike

  const discovery = s.bySource.find((x) => x.source === 'discovery')!;
  const sibling = s.bySource.find((x) => x.source === 'sibling')!;
  assert.equal(discovery.rated, 2);
  assert.equal(discovery.likeRate, 0.5); // 1 like, 1 dislike
  assert.equal(sibling.likeRate, 1); // 1 like
  assert.equal(sibling.likeShare, 0.5); // 1 of 2 total likes
  // NULL-source row never appears as a source bucket
  assert.ok(!s.bySource.some((x) => (x.source as unknown) === null));

  assert.equal(s.counters.total.rated, 3);
  assert.equal(s.counters.total.liked, 2);
});

test('unresolved-rate is the fraction of tracks with no video', () => {
  const db = openDb(':memory:');
  upsertRelease(db, { id: 1, title: 'R', labelIds: [], artistIds: [], isVa: false });
  track(db, 't1', true);
  track(db, 't2', true);
  track(db, 't3', false); // unresolved
  assert.equal(getStats(db).unresolvedRate, 1 / 3);
});

test('no ratings yet → like-rate is null, not a divide-by-zero', () => {
  const db = openDb(':memory:');
  const s = getStats(db);
  assert.equal(s.likeRate.overall, null);
  assert.deepEqual(s.likeRate.daily, []);
  assert.equal(s.counters.total.rated, 0);
});
