import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './db';
import {
  upsertArtist,
  upsertLabel,
  upsertRelease,
  upsertTrack,
  recordRatingEvent,
  getAllRatingEvents,
  isTrackRated,
} from './repositories';

test('migrations create the schema and entities upsert', () => {
  const db = openDb(':memory:');
  upsertArtist(db, { id: 1, name: 'Answer Code Request' });
  upsertLabel(db, { id: 10, name: 'Ostgut Ton' });
  upsertRelease(db, { id: 100, title: 'Gardena', labelIds: [10], artistIds: [1], isVa: false });
  upsertTrack(db, {
    id: 't-100-a1',
    releaseId: 100,
    title: 'Gardena',
    position: 'A1',
    artistIds: [1],
    youtubeVideoId: 'abc123',
    unresolved: false,
  });

  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get('t-100-a1') as {
    youtube_video_id: string;
    unresolved: number;
  };
  assert.equal(track.youtube_video_id, 'abc123');
  assert.equal(track.unresolved, 0);

  // upsert is idempotent
  upsertArtist(db, { id: 1, name: 'ACR' });
  const count = db.prepare('SELECT COUNT(*) AS n FROM artists').get() as { n: number };
  assert.equal(count.n, 1);
});

test('rating events are append-only and readable', () => {
  const db = openDb(':memory:');
  upsertRelease(db, { id: 100, title: 'X', labelIds: [], artistIds: [], isVa: false });
  upsertTrack(db, {
    id: 't1',
    releaseId: 100,
    title: 'X',
    position: 'A1',
    artistIds: [],
    youtubeVideoId: 'v',
    unresolved: false,
  });

  assert.equal(isTrackRated(db, 't1'), false);
  recordRatingEvent(db, 't1', 'like');
  recordRatingEvent(db, 't1', 'dislike');
  assert.equal(isTrackRated(db, 't1'), true);

  const events = getAllRatingEvents(db);
  assert.equal(events.length, 2);
  assert.equal(events[0]!.value, 'like');
  assert.equal(events[1]!.value, 'dislike');
  assert.ok(events[0]!.createdAt.includes('T'));
});
