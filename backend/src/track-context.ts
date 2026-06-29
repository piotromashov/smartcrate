import type { TrackContext, EntityProfile } from '@smartcrate/shared';
import type { Db } from './db/db';
import type { DiscogsClient } from './discogs/client';
import { getArtistDetail, getLabelDetail } from './discogs/catalog';

/** Assemble the info-panel context for a track: local tracklist + artist/label bios. */
export async function trackContext(
  db: Db,
  client: DiscogsClient,
  trackId: string,
): Promise<TrackContext | null> {
  const track = db.prepare('SELECT release_id FROM tracks WHERE id = ?').get(trackId) as
    | { release_id: number }
    | undefined;
  if (!track) return null;
  const releaseId = track.release_id;
  const release = db.prepare('SELECT id, title FROM releases WHERE id = ?').get(releaseId) as
    | { id: number; title: string }
    | undefined;
  if (!release) return null;

  const trackRows = db
    .prepare('SELECT id, position, title FROM tracks WHERE release_id = ? ORDER BY position')
    .all(releaseId) as Array<{ id: string; position: string; title: string }>;
  const tracks = trackRows.map((t) => ({ position: t.position, title: t.title, isCurrent: t.id === trackId }));

  const artistIds = (
    db.prepare('SELECT artist_id FROM track_artists WHERE track_id = ?').all(trackId) as Array<{ artist_id: number }>
  ).map((r) => r.artist_id);
  const labelIds = (
    db.prepare('SELECT label_id FROM release_labels WHERE release_id = ?').all(releaseId) as Array<{ label_id: number }>
  ).map((r) => r.label_id);

  const detail = async (fetch: () => Promise<EntityProfile>): Promise<EntityProfile | null> => {
    try {
      return await fetch();
    } catch {
      return null; // a missing detail shouldn't break the panel
    }
  };
  const artists = (await Promise.all(artistIds.map((id) => detail(() => getArtistDetail(client, db, id))))).filter(
    (a): a is EntityProfile => a !== null,
  );
  const labels = (await Promise.all(labelIds.map((id) => detail(() => getLabelDetail(client, db, id))))).filter(
    (l): l is EntityProfile => l !== null,
  );

  return { release: { id: release.id, title: release.title, tracks }, artists, labels };
}
