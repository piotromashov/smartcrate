import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './db/db';
import { upsertArtist, upsertLabel, upsertRelease, upsertTrack } from './db/repositories';
import { DiscogsClient } from './discogs/client';
import { memoryCache } from './discogs/cache';
import { stripDiscogsMarkup } from './discogs/catalog';
import { trackContext } from './track-context';

test('stripDiscogsMarkup renders profile markup to plain text', () => {
  assert.equal(
    stripDiscogsMarkup('[b]Founded by [a=Luke Slater][/b]. [url=http://x]site[/url] [a123] now'),
    'Founded by Luke Slater. site now',
  );
});

function stubFetch(bodyByPath: Record<string, unknown>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    const body = bodyByPath[path];
    if (body === undefined) return { ok: false, status: 404, statusText: 'NF', text: async () => '' } as Response;
    return { ok: true, status: 200, statusText: 'OK', text: async () => JSON.stringify(body) } as Response;
  }) as typeof fetch;
}

test('trackContext assembles local tracklist (current highlighted) + bios', async () => {
  const db = openDb(':memory:');
  upsertArtist(db, { id: 1, name: 'Surgeon' });
  upsertLabel(db, { id: 10, name: 'Token' });
  upsertRelease(db, { id: 100, title: 'Comp', labelIds: [10], artistIds: [1], isVa: false });
  upsertTrack(db, { id: 't1', releaseId: 100, title: 'One', position: 'A1', artistIds: [1], youtubeVideoId: 'v1', unresolved: false });
  upsertTrack(db, { id: 't2', releaseId: 100, title: 'Two', position: 'A2', artistIds: [1], youtubeVideoId: 'v2', unresolved: false });

  const client = new DiscogsClient({
    token: 't',
    cache: memoryCache(),
    intervalMs: 0,
    fetchImpl: stubFetch({
      '/artists/1': { id: 1, name: 'Surgeon', profile: '[b]Anthony Child[/b]', urls: ['http://surgeon.com'] },
      '/labels/10': { id: 10, name: 'Token', profile: 'Belgian label', urls: ['http://token.be'] },
    }),
  });

  const ctx = (await trackContext(db, client, 't1'))!;
  assert.equal(ctx.release.title, 'Comp');
  assert.deepEqual(
    ctx.release.tracks.map((t) => [t.title, t.isCurrent]),
    [['One', true], ['Two', false]],
  );
  assert.equal(ctx.artists[0]!.name, 'Surgeon');
  assert.equal(ctx.artists[0]!.bio, 'Anthony Child');
  assert.deepEqual(ctx.artists[0]!.urls, ['http://surgeon.com']);
  assert.equal(ctx.labels[0]!.name, 'Token');
  assert.equal(ctx.labels[0]!.bio, 'Belgian label');
});
