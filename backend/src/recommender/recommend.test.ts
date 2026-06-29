import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../db/db';
import { upsertArtist, upsertLabel, upsertRelease, upsertTrack } from '../db/repositories';
import { rateTrack } from '../rating/scores';
import { DiscogsClient } from '../discogs/client';
import { memoryCache } from '../discogs/cache';
import type { Config } from '../config';
import { generateExploreQueue } from './recommend';
import { getQueue } from './queue';

function makeConfig(over: Partial<Config> = {}): Config {
  return {
    port: 0,
    dbPath: ':memory:',
    downloadDir: '',
    discogsToken: 't',
    audioFormat: 'mp3',
    audioQuality: '0',
    weights: { like: 1, dislike: 1.5, artist: 1, label: 0.8, release: 0.6 },
    exploreQueueTargetLength: 25,
    dislikeThreshold: 0,
    seeds: {},
    exploration: { qMin: 0.15, qMax: 0.4, pFull: 12, labelCapFrac: 0.4, newReleaseBudget: 8, style: 'Techno' },
    ...over,
  };
}

function stubFetch(bodyByPath: Record<string, unknown>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    const body = bodyByPath[path];
    if (body === undefined) return { ok: false, status: 404, statusText: 'NF', text: async () => '' } as Response;
    return { ok: true, status: 200, statusText: 'OK', text: async () => JSON.stringify(body) } as Response;
  }) as typeof fetch;
}

const RELEASES = {
  '/labels/10/releases': { releases: [{ id: 100 }, { id: 101 }] },
  '/releases/100': {
    id: 100,
    title: 'R100',
    labels: [{ id: 10, name: 'Token' }],
    artists: [{ id: 1, name: 'Surgeon' }],
    tracklist: [
      { position: 'A1', title: 'T0', type_: 'track' },
      { position: 'A2', title: 'T1', type_: 'track' },
    ],
    videos: [{ uri: 'https://youtu.be/v0' }, { uri: 'https://youtu.be/v1' }],
  },
  '/releases/101': {
    id: 101,
    title: 'R101',
    labels: [{ id: 10, name: 'Token' }],
    artists: [{ id: 2, name: 'ACR' }],
    tracklist: [{ position: 'A1', title: 'X', type_: 'track' }],
    videos: [{ uri: 'https://youtu.be/v2' }],
  },
};

function client(bodies: Record<string, unknown>): DiscogsClient {
  return new DiscogsClient({ token: 't', cache: memoryCache(), intervalMs: 0, fetchImpl: stubFetch(bodies) });
}

test('reports seedingRequired with no signal and no seeds', async () => {
  const db = openDb(':memory:');
  const res = await generateExploreQueue(db, client({}), makeConfig());
  assert.equal(res.seedingRequired, true);
  assert.equal(res.added, 0);
});

test('generates from positive entity scores, ranked with reasons', async () => {
  const db = openDb(':memory:');
  // Pre-seed and like one track so label 10 / artist 1 are positive.
  upsertLabel(db, { id: 10, name: 'Token' });
  upsertArtist(db, { id: 1, name: 'Surgeon' });
  upsertRelease(db, { id: 100, title: 'R100', labelIds: [10], artistIds: [1], isVa: false });
  upsertTrack(db, { id: 'r100-0', releaseId: 100, title: 'T0', position: 'A1', artistIds: [1], youtubeVideoId: 'v0', unresolved: false });
  rateTrack(db, makeConfig().weights, 'r100-0', 'like');

  const res = await generateExploreQueue(db, client(RELEASES), makeConfig());
  assert.equal(res.added, 2); // r100-1 and r101-0 (r100-0 already rated → excluded)

  const queue = getQueue(db);
  assert.equal(queue.length, 2);
  // r100-1 scores highest (artist+label+release all positive)
  assert.equal(queue[0]!.trackId, 'r100-1');
  assert.match(queue[0]!.reason, /label: Token/);
  assert.match(queue[0]!.reason, /artist: Surgeon/);
  assert.ok(queue[0]!.score > queue[1]!.score);
  assert.equal(queue[1]!.trackId, 'r101-0');

  // source tagging: release 100 is positively scored (sibling), release 101 isn't (discovery)
  const src = (id: string) =>
    (db.prepare('SELECT source FROM seen_tracks WHERE track_id = ?').get(id) as { source: string } | undefined)?.source;
  assert.equal(src('r100-1'), 'sibling');
  assert.equal(src('r101-0'), 'discovery');
});

test('with no signal the queue fills from the explore lane (seeds), tagged explore', async () => {
  const db = openDb(':memory:');
  const res = await generateExploreQueue(db, client(RELEASES), makeConfig({ seeds: { labels: [10] } }));
  assert.equal(res.seedingRequired, undefined);
  assert.equal(res.added, 3); // r100-0, r100-1, r101-0 — all unrated/unseen/resolved
  // explore-lane candidates are tagged 'explore'
  const exploreCount = db.prepare("SELECT COUNT(*) AS n FROM seen_tracks WHERE source = 'explore'").get() as { n: number };
  assert.equal(exploreCount.n, 3);
});

// Records every fetched path; returns 404 for everything (no discovery, no re-fetch).
function recordingClient(calls: string[]): DiscogsClient {
  const fetchImpl = (async (input: string | URL | Request) => {
    calls.push(new URL(String(input)).pathname);
    return { ok: false, status: 404, statusText: 'NF', text: async () => '' } as Response;
  }) as typeof fetch;
  return new DiscogsClient({ token: 't', cache: memoryCache(), intervalMs: 0, fetchImpl });
}

function seedReleaseInDb(db: ReturnType<typeof openDb>, releaseId: number, label: number, artist: number): void {
  upsertLabel(db, { id: label, name: `L${label}` });
  upsertArtist(db, { id: artist, name: `A${artist}` });
  upsertRelease(db, { id: releaseId, title: `R${releaseId}`, labelIds: [label], artistIds: [artist], isVa: false });
  for (let i = 0; i < 3; i++) {
    upsertTrack(db, {
      id: `r${releaseId}-${i}`,
      releaseId,
      title: `T${i}`,
      position: `A${i}`,
      artistIds: [artist],
      youtubeVideoId: `v${releaseId}-${i}`,
      unresolved: false,
    });
  }
}

test('surfaces siblings of a positively-scored release without re-fetching it', async () => {
  const db = openDb(':memory:');
  seedReleaseInDb(db, 200, 20, 5);
  rateTrack(db, makeConfig().weights, 'r200-0', 'like'); // release 200 score = +1

  const calls: string[] = [];
  await generateExploreQueue(db, recordingClient(calls), makeConfig());

  const ids = getQueue(db).map((it) => it.trackId);
  assert.ok(ids.includes('r200-1') && ids.includes('r200-2')); // siblings surfaced
  assert.ok(!ids.includes('r200-0')); // the rated track is excluded
  assert.ok(!calls.some((p) => p.includes('/releases/200'))); // sourced from DB, not re-fetched
});

test('diversity fill + explore lane break the single-artist monoculture', async () => {
  const db = openDb(':memory:');
  // Dominant: 10 PAS tracks on Ostgut, all positively scored (the filter-bubble setup).
  upsertArtist(db, { id: 1, name: 'PAS' });
  upsertLabel(db, { id: 10, name: 'Ostgut' });
  upsertRelease(db, { id: 100, title: 'R100', labelIds: [10], artistIds: [1], isVa: false });
  for (let i = 0; i < 10; i++) {
    upsertTrack(db, { id: `r100-${i}`, releaseId: 100, title: `T${i}`, position: `A${i}`, artistIds: [1], youtubeVideoId: `v${i}`, unresolved: false });
  }
  db.exec("INSERT INTO entity_scores (kind, entity_id, score) VALUES ('artist','1',7),('label','10',7),('release','100',7)");

  // Explore content: a seed label (Token) with a 5-track release, no signal.
  const bodies = {
    '/labels/20/releases': { releases: [{ id: 200 }] },
    '/releases/200': {
      id: 200,
      title: 'R200',
      labels: [{ id: 20, name: 'Token' }],
      artists: [{ id: 2, name: 'Other' }],
      tracklist: Array.from({ length: 5 }, (_, i) => ({ position: `A${i}`, title: `S${i}`, type_: 'track' })),
      videos: Array.from({ length: 5 }, (_, i) => ({ uri: `https://youtu.be/s${i}` })),
    },
    '/database/search': { results: [] },
  };
  await generateExploreQueue(db, client(bodies), makeConfig({ seeds: { labels: [20] } }));

  const ids = getQueue(db).map((it) => it.trackId);
  const pas = ids.filter((id) => id.startsWith('r100-')).length;
  const explore = ids.filter((id) => id.startsWith('r200-')).length;
  assert.ok(pas > 0 && explore > 0, 'queue mixes exploit and explore (not a monoculture)');
  assert.ok(pas <= 10, 'Ostgut is held under the per-label cap');
  const exploreTagged = db.prepare("SELECT COUNT(*) AS n FROM seen_tracks WHERE source = 'explore'").get() as { n: number };
  assert.ok(exploreTagged.n >= 1, 'explore-lane tracks are tagged explore');
});

test('a release whose score dropped to <= 0 does not surface siblings', async () => {
  const db = openDb(':memory:');
  const w = makeConfig().weights;
  seedReleaseInDb(db, 200, 20, 5); // will be tipped negative
  seedReleaseInDb(db, 300, 30, 6); // stays positive
  rateTrack(db, w, 'r300-0', 'like'); // release 300 = +1
  rateTrack(db, w, 'r200-0', 'like'); // release 200 = +1
  rateTrack(db, w, 'r200-1', 'dislike'); // release 200 = +1 - 1.5 = -0.5  ≤ 0

  const calls: string[] = [];
  await generateExploreQueue(db, recordingClient(calls), makeConfig());

  const ids = getQueue(db).map((it) => it.trackId);
  assert.ok(ids.includes('r300-1') && ids.includes('r300-2')); // positive release surfaces
  assert.ok(!ids.some((id) => id.startsWith('r200-'))); // closed release surfaces nothing
});
