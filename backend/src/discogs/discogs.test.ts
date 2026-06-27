import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../db/db';
import { DiscogsClient } from './client';
import { memoryCache } from './cache';
import {
  getRelease,
  youtubeIdFromUri,
  discoverReleaseIdsByLabel,
} from './catalog';

function stubFetch(bodyByPath: Record<string, unknown>, calls: string[]): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const path = new URL(url).pathname;
    const body = bodyByPath[path];
    if (body === undefined) {
      return { ok: false, status: 404, statusText: 'Not Found', text: async () => '' } as Response;
    }
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify(body),
    } as Response;
  }) as typeof fetch;
}

const VA_RELEASE = {
  id: 100,
  title: 'VA - Comp',
  artists: [{ id: 194, name: 'Various' }],
  labels: [{ id: 10, name: 'Token' }],
  tracklist: [
    { position: 'A1', title: 'Track One', type_: 'track', artists: [{ id: 1, name: 'Surgeon' }] },
    { position: 'A2', title: 'Track Two', type_: 'track', artists: [{ id: 2, name: 'ACR' }] },
    { position: 'B1', title: 'Track Three', type_: 'track' },
  ],
  videos: [
    { uri: 'https://www.youtube.com/watch?v=AAA' },
    { uri: 'https://youtu.be/BBB' },
  ],
};

test('client fails fast when token is missing', () => {
  assert.throws(() => new DiscogsClient({ token: '', cache: memoryCache() }), /DISCOGS_TOKEN/);
});

test('youtubeIdFromUri parses watch and short links', () => {
  assert.equal(youtubeIdFromUri('https://www.youtube.com/watch?v=AAA'), 'AAA');
  assert.equal(youtubeIdFromUri('https://youtu.be/BBB'), 'BBB');
  assert.equal(youtubeIdFromUri('https://example.com/x'), null);
});

test('getRelease maps VA + resolves videos by index, and caches', async () => {
  const calls: string[] = [];
  const client = new DiscogsClient({
    token: 't',
    cache: memoryCache(),
    intervalMs: 0,
    fetchImpl: stubFetch({ '/releases/100': VA_RELEASE }, calls),
  });
  const db = openDb(':memory:');

  const mapped = await getRelease(client, db, 100);
  assert.equal(mapped.release.isVa, true);
  assert.equal(mapped.tracks.length, 3);
  assert.equal(mapped.tracks[0]!.youtubeVideoId, 'AAA');
  assert.equal(mapped.tracks[0]!.unresolved, false);
  assert.equal(mapped.tracks[1]!.youtubeVideoId, 'BBB');
  assert.equal(mapped.tracks[2]!.youtubeVideoId, null);
  assert.equal(mapped.tracks[2]!.unresolved, true);
  assert.deepEqual(mapped.tracks[0]!.artistIds, [1]);

  // persisted
  const n = db.prepare('SELECT COUNT(*) AS n FROM tracks').get() as { n: number };
  assert.equal(n.n, 3);

  // second call served from cache (no extra network)
  await getRelease(client, db, 100);
  assert.equal(calls.length, 1);
});

test('discovery returns release ids', async () => {
  const calls: string[] = [];
  const client = new DiscogsClient({
    token: 't',
    cache: memoryCache(),
    intervalMs: 0,
    fetchImpl: stubFetch(
      { '/labels/10/releases': { releases: [{ id: 100 }, { id: 101 }] } },
      calls,
    ),
  });
  const ids = await discoverReleaseIdsByLabel(client, 10);
  assert.deepEqual(ids, [100, 101]);
});
