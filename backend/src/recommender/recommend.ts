import type { RecommendResult, SeedConfig } from '@smartcrate/shared';
import type { Db } from '../db/db';
import type { Config } from '../config';
import type { DiscogsClient } from '../discogs/client';
import {
  getRelease,
  discoverReleaseIdsByLabel,
  discoverReleaseIdsByArtist,
} from '../discogs/catalog';
import { getScore } from '../rating/scores';
import { isTrackRated } from '../db/repositories';
import { enqueue, isSeen, queueLength } from './queue';

const TOP_N = 10;
const MAX_RELEASES_PER_ENTITY = 5;
const MAX_RELEASES = 40;

interface Candidate {
  trackId: string;
  score: number;
  reason: string;
}

/** Top positively-scored label and artist ids. */
function topPositiveEntities(db: Db): { labelIds: number[]; artistIds: number[] } {
  const pick = (kind: 'label' | 'artist') =>
    (
      db
        .prepare(
          `SELECT entity_id FROM entity_scores WHERE kind = ? AND score > 0 ORDER BY score DESC LIMIT ?`,
        )
        .all(kind, TOP_N) as Array<{ entity_id: string }>
    ).map((r) => Number(r.entity_id));
  return { labelIds: pick('label'), artistIds: pick('artist') };
}

async function gatherFromEntities(
  client: DiscogsClient,
  labelIds: number[],
  artistIds: number[],
): Promise<number[]> {
  const ids: number[] = [];
  for (const labelId of labelIds) {
    try {
      ids.push(...(await discoverReleaseIdsByLabel(client, labelId)).slice(0, MAX_RELEASES_PER_ENTITY));
    } catch {
      /* skip a failing entity */
    }
  }
  for (const artistId of artistIds) {
    try {
      ids.push(...(await discoverReleaseIdsByArtist(client, artistId)).slice(0, MAX_RELEASES_PER_ENTITY));
    } catch {
      /* skip */
    }
  }
  return ids;
}

/** Resolve seed labels/artists (ids or names) and release ids. */
async function resolveSeeds(
  client: DiscogsClient,
  seeds: SeedConfig,
): Promise<{ labelIds: number[]; artistIds: number[]; releaseIds: number[] }> {
  const resolve = async (entries: Array<number | string> | undefined, type: 'label' | 'artist') => {
    const out: number[] = [];
    for (const entry of entries ?? []) {
      if (typeof entry === 'number') {
        out.push(entry);
        continue;
      }
      try {
        const res = await client.get<{ results?: Array<{ id: number }> }>('/database/search', {
          type,
          q: entry,
          per_page: 1,
        });
        const id = res.results?.[0]?.id;
        if (id !== undefined) out.push(id);
      } catch {
        /* unresolved seed name — skip */
      }
    }
    return out;
  };
  return {
    labelIds: await resolve(seeds.labels, 'label'),
    artistIds: await resolve(seeds.artists, 'artist'),
    releaseIds: seeds.releases ?? [],
  };
}

function nameOf(db: Db, table: 'artists' | 'labels', id: number): string | undefined {
  const row = db.prepare(`SELECT name FROM ${table} WHERE id = ?`).get(id) as
    | { name: string }
    | undefined;
  return row?.name;
}

/** Score a resolved, unrated, unseen track; returns null if it should be filtered out. */
function scoreCandidate(db: Db, config: Config, trackId: string): Candidate | null {
  const trackRow = db.prepare('SELECT release_id FROM tracks WHERE id = ?').get(trackId) as
    | { release_id: number }
    | undefined;
  if (!trackRow) return null;
  const releaseId = trackRow.release_id;
  const artistIds = (
    db.prepare('SELECT artist_id FROM track_artists WHERE track_id = ?').all(trackId) as Array<{
      artist_id: number;
    }>
  ).map((r) => r.artist_id);
  const labelIds = (
    db.prepare('SELECT label_id FROM release_labels WHERE release_id = ?').all(releaseId) as Array<{
      label_id: number;
    }>
  ).map((r) => r.label_id);

  const { weights } = config;
  const artistScores = artistIds.map((id) => getScore(db, 'artist', String(id)));
  const labelScores = labelIds.map((id) => getScore(db, 'label', String(id)));
  // Drop if any contributing artist or label is disliked (below threshold).
  if ([...artistScores, ...labelScores].some((s) => s < config.dislikeThreshold)) return null;

  const artistScore = artistScores.length ? Math.max(...artistScores) : 0;
  const labelScore = labelScores.length ? Math.max(...labelScores) : 0;
  const releaseScore = getScore(db, 'release', String(releaseId));
  const score =
    weights.artist * artistScore + weights.label * labelScore + weights.release * releaseScore;

  const parts: string[] = [];
  const bestLabel = labelIds.find((id) => getScore(db, 'label', String(id)) === labelScore && labelScore > 0);
  if (bestLabel !== undefined) parts.push(`label: ${nameOf(db, 'labels', bestLabel) ?? bestLabel}`);
  const bestArtist = artistIds.find((id) => getScore(db, 'artist', String(id)) === artistScore && artistScore > 0);
  if (bestArtist !== undefined) parts.push(`artist: ${nameOf(db, 'artists', bestArtist) ?? bestArtist}`);
  const reason = parts.length ? parts.join('; ') : 'seed/exploration';

  return { trackId, score, reason };
}

function candidateTracks(db: Db, releaseIds: number[], config: Config): Candidate[] {
  if (releaseIds.length === 0) return [];
  const placeholders = releaseIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT id FROM tracks WHERE release_id IN (${placeholders}) AND unresolved = 0`,
    )
    .all(...releaseIds) as Array<{ id: string }>;

  const out: Candidate[] = [];
  for (const { id } of rows) {
    if (isTrackRated(db, id) || isSeen(db, id)) continue; // already-rated / already-seen
    const scored = scoreCandidate(db, config, id);
    if (scored) out.push(scored);
  }
  return out;
}

/**
 * Generate candidates from Discogs (top-scored labels/artists, else config seeds),
 * score/filter/dedupe them, and fill the explore queue to the target length.
 */
export async function generateExploreQueue(
  db: Db,
  client: DiscogsClient,
  config: Config,
): Promise<RecommendResult> {
  const need = config.exploreQueueTargetLength - queueLength(db);
  if (need <= 0) return { added: 0, queueLength: queueLength(db) };

  const top = topPositiveEntities(db);
  let releaseIds: number[];
  if (top.labelIds.length || top.artistIds.length) {
    releaseIds = await gatherFromEntities(client, top.labelIds, top.artistIds);
  } else {
    const seeds = await resolveSeeds(client, config.seeds);
    if (!seeds.labelIds.length && !seeds.artistIds.length && !seeds.releaseIds.length) {
      return { added: 0, queueLength: queueLength(db), seedingRequired: true };
    }
    releaseIds = [
      ...seeds.releaseIds,
      ...(await gatherFromEntities(client, seeds.labelIds, seeds.artistIds)),
    ];
  }

  releaseIds = [...new Set(releaseIds)].slice(0, MAX_RELEASES);
  for (const id of releaseIds) {
    try {
      await getRelease(client, db, id);
    } catch {
      /* skip a release that fails to fetch */
    }
  }

  const candidates = candidateTracks(db, releaseIds, config).sort((a, b) => b.score - a.score);

  let added = 0;
  for (const candidate of candidates) {
    if (added >= need) break;
    enqueue(db, candidate);
    added += 1;
  }
  return { added, queueLength: queueLength(db) };
}
