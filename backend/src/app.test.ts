import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './db/db';
import { upsertArtist, upsertLabel, upsertRelease, upsertTrack } from './db/repositories';
import { enqueue } from './recommender/queue';
import type { Config } from './config';
import { buildApp } from './app';

function makeConfig(): Config {
  return {
    port: 0,
    dbPath: ':memory:',
    downloadDir: '/tmp/sc-test',
    discogsToken: '',
    audioFormat: 'mp3',
    audioQuality: '0',
    weights: { like: 1, dislike: 1.5, artist: 1, label: 0.8, release: 0.6 },
    exploreQueueTargetLength: 25,
    dislikeThreshold: 0,
    seeds: {},
    exploration: { qMin: 0.15, qMax: 0.4, pFull: 12, labelCapFrac: 0.4, newReleaseBudget: 8, style: 'Techno' },
  };
}

function seedQueue(db: ReturnType<typeof openDb>): void {
  upsertLabel(db, { id: 10, name: 'Token' });
  upsertArtist(db, { id: 1, name: 'Surgeon' });
  upsertRelease(db, { id: 1, title: 'R', labelIds: [10], artistIds: [1], isVa: false });
  upsertTrack(db, { id: 't1', releaseId: 1, title: 'One', position: 'A1', artistIds: [1], youtubeVideoId: 'v1', unresolved: false });
  enqueue(db, { trackId: 't1', score: 2.4, reason: 'label: Token; artist: Surgeon' });
}

test('GET /api/current returns the front playable track', async () => {
  const db = openDb(':memory:');
  seedQueue(db);
  const app = buildApp({ db, config: makeConfig(), client: null });

  const res = await app.inject({ method: 'GET', url: '/api/current' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.track.id, 't1');
  assert.equal(body.track.youtubeVideoId, 'v1');
  assert.equal(body.artists[0].name, 'Surgeon');
  assert.match(body.reason, /Token/);
  await app.close();
});

test('POST rate like keeps the current track and enqueues a download (no advance)', async () => {
  const db = openDb(':memory:');
  seedQueue(db);
  const app = buildApp({ db, config: makeConfig(), client: null });

  const rated = await app.inject({ method: 'POST', url: '/api/tracks/t1/rate', payload: { value: 'like' } });
  assert.equal(rated.statusCode, 200);
  assert.equal(rated.json().current.track.id, 't1'); // still playing t1

  // liking again does not duplicate the download
  await app.inject({ method: 'POST', url: '/api/tracks/t1/rate', payload: { value: 'like' } });
  const downloads = await app.inject({ method: 'GET', url: '/api/downloads' });
  assert.equal(downloads.json().length, 1);
  assert.equal(downloads.json()[0].trackId, 't1');
  await app.close();
});

test('POST rate dislike advances past the track', async () => {
  const db = openDb(':memory:');
  seedQueue(db);
  const app = buildApp({ db, config: makeConfig(), client: null });
  const rated = await app.inject({ method: 'POST', url: '/api/tracks/t1/rate', payload: { value: 'dislike' } });
  assert.equal(rated.json().current, null); // queue had only t1 → now empty
  await app.close();
});

test('GET /api/queue returns up-next items with score + artist/title', async () => {
  const db = openDb(':memory:');
  seedQueue(db);
  upsertTrack(db, { id: 't2', releaseId: 1, title: 'Two', position: 'A2', artistIds: [1], youtubeVideoId: 'v2', unresolved: false });
  enqueue(db, { trackId: 't2', score: 1.2, reason: 'label: Token' });
  const app = buildApp({ db, config: makeConfig(), client: null });
  const res = await app.inject({ method: 'GET', url: '/api/queue' });
  const body = res.json();
  assert.equal(body.current.track.id, 't1');
  assert.equal(body.upNext.length, 1);
  assert.equal(body.upNext[0].trackId, 't2');
  assert.equal(body.upNext[0].score, 1.2);
  assert.deepEqual(body.upNext[0].artists, ['Surgeon']);
  await app.close();
});

test('invalid rate value → 400', async () => {
  const db = openDb(':memory:');
  const app = buildApp({ db, config: makeConfig(), client: null });
  const res = await app.inject({ method: 'POST', url: '/api/tracks/x/rate', payload: { value: 'nope' } });
  assert.equal(res.statusCode, 400);
  await app.close();
});

test('recommend without a Discogs token → 503', async () => {
  const db = openDb(':memory:');
  const app = buildApp({ db, config: makeConfig(), client: null });
  const res = await app.inject({ method: 'POST', url: '/api/recommend' });
  assert.equal(res.statusCode, 503);
  await app.close();
});
