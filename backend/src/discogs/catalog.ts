import type { Artist, Label, Release, Track, EntityProfile } from '@smartcrate/shared';
import type { Db } from '../db/db';
import { upsertArtist, upsertLabel, upsertRelease, upsertTrack } from '../db/repositories';
import type { DiscogsClient } from './client';

/** Discogs "Various" artist id — marks a Various Artists compilation. */
const VARIOUS_ARTIST_ID = 194;

// ── Partial Discogs response shapes (only fields we use) ──────────────────────

interface DiscogsArtistRef {
  id: number;
  name: string;
}
interface DiscogsLabelRef {
  id: number;
  name: string;
}
interface DiscogsVideo {
  uri: string;
  title?: string;
}
interface DiscogsTrack {
  position: string;
  title: string;
  type_?: string;
  artists?: DiscogsArtistRef[];
}
interface DiscogsRelease {
  id: number;
  title: string;
  artists?: DiscogsArtistRef[];
  labels?: DiscogsLabelRef[];
  tracklist?: DiscogsTrack[];
  videos?: DiscogsVideo[];
}
interface DiscogsReleasesPage {
  releases?: Array<{ id: number; type?: string }>;
}

export interface MappedRelease {
  release: Release;
  artists: Artist[];
  labels: Label[];
  tracks: Track[];
}

/** Extract a YouTube video id from a URL, or null if it isn't a YouTube link. */
export function youtubeIdFromUri(uri: string): string | null {
  try {
    const u = new URL(uri);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1) || null;
    if (host === 'youtube.com' || host === 'm.youtube.com') return u.searchParams.get('v');
    return null;
  } catch {
    return null;
  }
}

/**
 * Map a Discogs release to our entities. YouTube resolution (ADR-0003): the
 * release's `videos` are matched to tracks by index — track i gets the i-th
 * YouTube video; tracks beyond the available videos are marked unresolved.
 */
export function mapRelease(json: DiscogsRelease): MappedRelease {
  const releaseArtists = (json.artists ?? []).filter((a) => a.id !== VARIOUS_ARTIST_ID);
  const labels = dedupeById(json.labels ?? []).map((l) => ({ id: l.id, name: l.name }));
  const artistMap = new Map<number, Artist>();
  for (const a of releaseArtists) artistMap.set(a.id, { id: a.id, name: a.name });

  const isVa =
    (json.artists ?? []).some((a) => a.id === VARIOUS_ARTIST_ID || /various/i.test(a.name)) ||
    releaseArtists.length === 0;

  const videoIds = (json.videos ?? [])
    .map((v) => youtubeIdFromUri(v.uri))
    .filter((id): id is string => id !== null);

  const trackItems = (json.tracklist ?? []).filter(
    (t) => (t.type_ ?? 'track') === 'track' && t.title.trim() !== '',
  );

  const tracks: Track[] = trackItems.map((t, i) => {
    const trackArtistRefs = (t.artists ?? releaseArtists).filter(
      (a) => a.id !== VARIOUS_ARTIST_ID,
    );
    for (const a of trackArtistRefs) artistMap.set(a.id, { id: a.id, name: a.name });
    const youtubeVideoId = videoIds[i] ?? null;
    return {
      id: `r${json.id}-${i}`,
      releaseId: json.id,
      title: t.title,
      position: t.position,
      artistIds: trackArtistRefs.map((a) => a.id),
      youtubeVideoId,
      unresolved: youtubeVideoId === null,
    };
  });

  const release: Release = {
    id: json.id,
    title: json.title,
    labelIds: labels.map((l) => l.id),
    artistIds: releaseArtists.map((a) => a.id),
    isVa,
  };

  return { release, artists: [...artistMap.values()], labels, tracks };
}

/** Fetch a release, map it, and persist all entities. */
export async function getRelease(
  client: DiscogsClient,
  db: Db,
  releaseId: number,
): Promise<MappedRelease> {
  const json = await client.get<DiscogsRelease>(`/releases/${releaseId}`);
  const mapped = mapRelease(json);
  persist(db, mapped);
  return mapped;
}

/** Render Discogs profile markup to plain text. */
export function stripDiscogsMarkup(profile: string): string {
  return profile
    .replace(/\[url=[^\]]*\]([\s\S]*?)\[\/url\]/gi, '$1') // [url=x]text[/url] → text
    .replace(/\[[almr]=([^\]]+)\]/gi, '$1') // named refs [a=Luke Slater] → Luke Slater
    .replace(/\[\/?(?:b|i|u)\]/gi, '') // bold/italic/underline tags
    .replace(/\[[almr]\d+\]/gi, '') // numeric refs [a123]/[l123]/…
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface DiscogsEntityDetail {
  id: number;
  name: string;
  profile?: string;
  urls?: string[];
}

/** Fetch an entity's profile detail (bio + links), cache-first; also upsert id+name. */
async function entityDetail(
  client: DiscogsClient,
  path: string,
  upsert: (d: { id: number; name: string }) => void,
): Promise<EntityProfile> {
  const json = await client.get<DiscogsEntityDetail>(path);
  upsert({ id: json.id, name: json.name });
  return {
    id: json.id,
    name: json.name,
    bio: json.profile ? stripDiscogsMarkup(json.profile) : '',
    urls: json.urls ?? [],
  };
}

export function getArtistDetail(client: DiscogsClient, db: Db, artistId: number): Promise<EntityProfile> {
  return entityDetail(client, `/artists/${artistId}`, (d) => upsertArtist(db, d));
}

export function getLabelDetail(client: DiscogsClient, db: Db, labelId: number): Promise<EntityProfile> {
  return entityDetail(client, `/labels/${labelId}`, (d) => upsertLabel(db, d));
}

export async function getArtist(client: DiscogsClient, db: Db, artistId: number): Promise<Artist> {
  const json = await client.get<{ id: number; name: string }>(`/artists/${artistId}`);
  const artist = { id: json.id, name: json.name };
  upsertArtist(db, artist);
  return artist;
}

export async function getLabel(client: DiscogsClient, db: Db, labelId: number): Promise<Label> {
  const json = await client.get<{ id: number; name: string }>(`/labels/${labelId}`);
  const label = { id: json.id, name: json.name };
  upsertLabel(db, label);
  return label;
}

/** Discover release ids associated with a label (newest first). */
export async function discoverReleaseIdsByLabel(
  client: DiscogsClient,
  labelId: number,
): Promise<number[]> {
  const page = await client.get<DiscogsReleasesPage>(`/labels/${labelId}/releases`, {
    sort: 'year',
    sort_order: 'desc',
    per_page: 50,
  });
  return (page.releases ?? []).map((r) => r.id);
}

/** Discover release ids associated with an artist. */
export async function discoverReleaseIdsByArtist(
  client: DiscogsClient,
  artistId: number,
): Promise<number[]> {
  const page = await client.get<DiscogsReleasesPage>(`/artists/${artistId}/releases`, {
    sort: 'year',
    sort_order: 'desc',
    per_page: 50,
  });
  return (page.releases ?? []).filter((r) => (r.type ?? 'release') === 'release').map((r) => r.id);
}

/** Discover release ids by musical style (e.g. 'Techno') for explore-lane novelty. */
export async function discoverNewReleaseIdsByStyle(
  client: DiscogsClient,
  style: string,
): Promise<number[]> {
  const res = await client.get<{ results?: Array<{ id: number; type?: string }> }>(
    '/database/search',
    { type: 'release', style, per_page: 50 },
  );
  return (res.results ?? []).filter((r) => (r.type ?? 'release') === 'release').map((r) => r.id);
}

function persist(db: Db, mapped: MappedRelease): void {
  for (const a of mapped.artists) upsertArtist(db, a);
  for (const l of mapped.labels) upsertLabel(db, l);
  upsertRelease(db, mapped.release);
  for (const t of mapped.tracks) upsertTrack(db, t);
}

function dedupeById<T extends { id: number }>(items: T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}
