import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../db/db';
import { upsertArtist, upsertLabel, upsertRelease, upsertTrack } from '../db/repositories';
import type { Weights } from '../config';
import { rateTrack, getScore, getAllScores, recomputeScores } from './scores';

const WEIGHTS: Weights = { like: 1, dislike: 1.5, artist: 1, label: 0.8, release: 0.6 };

function seed(db: ReturnType<typeof openDb>): void {
  upsertArtist(db, { id: 1, name: 'Surgeon' });
  upsertArtist(db, { id: 2, name: 'ACR' });
  upsertLabel(db, { id: 10, name: 'Token' });
  upsertRelease(db, { id: 100, title: 'Comp', labelIds: [10], artistIds: [1, 2], isVa: true });
  upsertTrack(db, { id: 't1', releaseId: 100, title: 'One', position: 'A1', artistIds: [1], youtubeVideoId: 'a', unresolved: false });
  upsertTrack(db, { id: 't2', releaseId: 100, title: 'Two', position: 'A2', artistIds: [2], youtubeVideoId: 'b', unresolved: false });
}

test('like and dislike accumulate onto the right entities (VA-independent artists)', () => {
  const db = openDb(':memory:');
  seed(db);

  rateTrack(db, WEIGHTS, 't1', 'like'); // +1 to t1, release 100, artist 1, label 10
  rateTrack(db, WEIGHTS, 't2', 'dislike'); // -1.5 to t2, release 100, artist 2, label 10

  assert.equal(getScore(db, 'track', 't1'), 1);
  assert.equal(getScore(db, 'track', 't2'), -1.5);
  assert.equal(getScore(db, 'artist', '1'), 1);
  assert.equal(getScore(db, 'artist', '2'), -1.5); // independent of t1's like
  assert.equal(getScore(db, 'label', '10'), -0.5); // 1 - 1.5
  assert.equal(getScore(db, 'release', '100'), -0.5); // shared VA release score
});

test('recompute from the event log matches incremental scores', () => {
  const db = openDb(':memory:');
  seed(db);
  rateTrack(db, WEIGHTS, 't1', 'like');
  rateTrack(db, WEIGHTS, 't1', 'like');
  rateTrack(db, WEIGHTS, 't2', 'dislike');

  const incremental = getAllScores(db);
  recomputeScores(db, WEIGHTS);
  const recomputed = getAllScores(db);

  assert.deepEqual(recomputed, incremental);
});
