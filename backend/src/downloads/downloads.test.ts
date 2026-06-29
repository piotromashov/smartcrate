import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { openDb } from '../db/db';
import { upsertArtist, upsertRelease, upsertTrack } from '../db/repositories';
import type { Config } from '../config';
import { enqueueDownload, listDownloads, getDownload } from './queue';
import { processNext, sanitizeFilename, type DownloadRunner } from './worker';

function makeConfig(): Config {
  return {
    port: 0,
    dbPath: ':memory:',
    downloadDir: join(tmpdir(), 'smartcrate-test-downloads'),
    discogsToken: 't',
    audioFormat: 'mp3',
    audioQuality: '0',
    weights: { like: 1, dislike: 1.5, artist: 1, label: 0.8, release: 0.6 },
    exploreQueueTargetLength: 25,
    dislikeThreshold: 0,
    seeds: {},
    exploration: { qMin: 0.15, qMax: 0.4, pFull: 12, labelCapFrac: 0.4, newReleaseBudget: 8, style: 'Techno' },
  };
}

function track(db: ReturnType<typeof openDb>, id: string, videoId: string | null): void {
  upsertRelease(db, { id: 1, title: 'R', labelIds: [], artistIds: [], isVa: false });
  upsertTrack(db, {
    id,
    releaseId: 1,
    title: id,
    position: 'A1',
    artistIds: [],
    youtubeVideoId: videoId,
    unresolved: videoId === null,
  });
}

const ok: DownloadRunner = async () => {};
const enoent: DownloadRunner = async () => {
  const e = new Error('spawn yt-dlp ENOENT') as NodeJS.ErrnoException;
  e.code = 'ENOENT';
  throw e;
};

test('like enqueues once; no duplicate download item', () => {
  const db = openDb(':memory:');
  track(db, 't1', 'vid');
  assert.ok(enqueueDownload(db, 't1'));
  assert.equal(enqueueDownload(db, 't1'), undefined); // duplicate suppressed
  assert.equal(listDownloads(db).length, 1);
});

test('successful download → done with file path', async () => {
  const db = openDb(':memory:');
  track(db, 't1', 'vid');
  const item = enqueueDownload(db, 't1')!;
  const processed = await processNext(db, makeConfig(), ok);
  assert.equal(processed, true);
  const done = getDownload(db, item.id)!;
  assert.equal(done.status, 'done');
  assert.match(done.filePath!, /t1\.mp3$/);
});

test('missing yt-dlp → failed with reason, no crash', async () => {
  const db = openDb(':memory:');
  track(db, 't2', 'vid');
  const item = enqueueDownload(db, 't2')!;
  await processNext(db, makeConfig(), enoent); // does not throw
  const failed = getDownload(db, item.id)!;
  assert.equal(failed.status, 'failed');
  assert.match(failed.error!, /yt-dlp not found/);
});

test('unresolved track → failed without running the downloader', async () => {
  const db = openDb(':memory:');
  track(db, 't3', null);
  const item = enqueueDownload(db, 't3')!;
  let ran = false;
  await processNext(db, makeConfig(), async () => void (ran = true));
  const failed = getDownload(db, item.id)!;
  assert.equal(failed.status, 'failed');
  assert.equal(ran, false);
  assert.match(failed.error!, /no resolved YouTube video/);
});

test('empty queue → processNext returns false', async () => {
  const db = openDb(':memory:');
  assert.equal(await processNext(db, makeConfig(), ok), false);
});

test('sanitizeFilename strips path-illegal characters', () => {
  assert.equal(sanitizeFilename('Surgeon / Regis: A*B?'), 'Surgeon - Regis- A-B-');
  assert.equal(sanitizeFilename('   '), 'track');
});

// A runner that actually writes the output file, so collision detection can see it.
const writingRunner: DownloadRunner = async ({ outTemplate }) => {
  writeFileSync(outTemplate.replace('.%(ext)s', '.mp3'), 'audio');
};

test('downloads are named "Artist - Title" and collisions disambiguate', async () => {
  const db = openDb(':memory:');
  const dir = mkdtempSync(join(tmpdir(), 'sc-dl-'));
  const config: Config = { ...makeConfig(), downloadDir: dir };

  upsertArtist(db, { id: 1, name: 'Surgeon' });
  upsertRelease(db, { id: 1, title: 'R', labelIds: [], artistIds: [], isVa: false });
  const mk = (id: string) =>
    upsertTrack(db, { id, releaseId: 1, title: 'Badger (Remix)', position: 'A1', artistIds: [1], youtubeVideoId: 'v', unresolved: false });
  mk('t1');
  mk('t2'); // same artist+title → name collision

  const d1 = enqueueDownload(db, 't1')!;
  await processNext(db, config, writingRunner);
  assert.equal(basename(getDownload(db, d1.id)!.filePath!), 'Surgeon - Badger (Remix).mp3');

  const d2 = enqueueDownload(db, 't2')!;
  await processNext(db, config, writingRunner);
  assert.equal(basename(getDownload(db, d2.id)!.filePath!), 'Surgeon - Badger (Remix) (2).mp3');
});
