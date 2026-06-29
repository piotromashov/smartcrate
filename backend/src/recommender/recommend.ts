import type { RecommendResult, CandidateSource } from '@smartcrate/shared';
import type { Db } from '../db/db';
import type { Config } from '../config';
import type { DiscogsClient } from '../discogs/client';
import {
  getRelease,
  discoverReleaseIdsByLabel,
  discoverReleaseIdsByArtist,
  discoverNewReleaseIdsByStyle,
} from '../discogs/catalog';
import { getScore } from '../rating/scores';
import { isTrackRated } from '../db/repositories';
import { enqueue, isSeen, queueLength } from './queue';
import type { SeedConfig } from '@smartcrate/shared';

const TOP_N = 10;
const MAX_RELEASES_PER_ENTITY = 5;
const MAX_RELEASES = 40;

interface Candidate {
  trackId: string;
  releaseId: number;
  score: number;
  reason: string;
  source: CandidateSource;
  /** Primary artist id (bucket key for round-robin), or null. */
  artistId: number | null;
  labelIds: number[];
}

// ── Signal / quota ───────────────────────────────────────────────────────────

function positiveEntityCount(db: Db): number {
  return (
    db
      .prepare(`SELECT COUNT(*) AS n FROM entity_scores WHERE kind IN ('artist','label') AND score > 0`)
      .get() as { n: number }
  ).n;
}

/** Adaptive explore share: large when the taste model is thin, shrinking as signal grows. */
function exploreFraction(db: Db, config: Config): number {
  const { qMin, qMax, pFull } = config.exploration;
  const p = positiveEntityCount(db);
  return Math.max(qMin, Math.min(qMax, qMax - (qMax - qMin) * Math.min(1, p / Math.max(1, pFull))));
}

function topPositiveEntities(db: Db): { labelIds: number[]; artistIds: number[] } {
  const pick = (kind: 'label' | 'artist') =>
    (
      db
        .prepare(`SELECT entity_id FROM entity_scores WHERE kind = ? AND score > 0 ORDER BY score DESC LIMIT ?`)
        .all(kind, TOP_N) as Array<{ entity_id: string }>
    ).map((r) => Number(r.entity_id));
  return { labelIds: pick('label'), artistIds: pick('artist') };
}

function positiveScoreReleaseIds(db: Db): number[] {
  return (
    db
      .prepare(`SELECT entity_id FROM entity_scores WHERE kind = 'release' AND score > 0`)
      .all() as Array<{ entity_id: string }>
  ).map((r) => Number(r.entity_id));
}

function allLocalReleaseIds(db: Db): number[] {
  return (db.prepare(`SELECT id FROM releases`).all() as Array<{ id: number }>).map((r) => r.id);
}

// ── Discovery ────────────────────────────────────────────────────────────────

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
      /* skip */
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

async function fetchReleases(client: DiscogsClient, db: Db, ids: number[]): Promise<void> {
  for (const id of [...new Set(ids)].slice(0, MAX_RELEASES)) {
    try {
      await getRelease(client, db, id);
    } catch {
      /* skip a release that fails to fetch */
    }
  }
}

/** Explore source (c): fetch a bounded set of genuinely-new releases not yet in the catalog. */
async function fetchNewReleases(client: DiscogsClient, db: Db, config: Config): Promise<void> {
  let ids: number[];
  try {
    ids = await discoverNewReleaseIdsByStyle(client, config.exploration.style);
  } catch {
    return;
  }
  const known = new Set(allLocalReleaseIds(db));
  const fresh = ids.filter((id) => !known.has(id)).slice(0, config.exploration.newReleaseBudget);
  for (const id of fresh) {
    try {
      await getRelease(client, db, id);
    } catch {
      /* skip */
    }
  }
}

// ── Scoring & candidates ─────────────────────────────────────────────────────

function nameOf(db: Db, table: 'artists' | 'labels', id: number): string | undefined {
  return (db.prepare(`SELECT name FROM ${table} WHERE id = ?`).get(id) as { name: string } | undefined)?.name;
}

function scoreCandidate(db: Db, config: Config, trackId: string, source: CandidateSource): Candidate | null {
  const trackRow = db.prepare('SELECT release_id FROM tracks WHERE id = ?').get(trackId) as
    | { release_id: number }
    | undefined;
  if (!trackRow) return null;
  const releaseId = trackRow.release_id;
  const artistIds = (
    db.prepare('SELECT artist_id FROM track_artists WHERE track_id = ?').all(trackId) as Array<{ artist_id: number }>
  ).map((r) => r.artist_id);
  const labelIds = (
    db.prepare('SELECT label_id FROM release_labels WHERE release_id = ?').all(releaseId) as Array<{ label_id: number }>
  ).map((r) => r.label_id);

  const { weights } = config;
  const artistScores = artistIds.map((id) => getScore(db, 'artist', String(id)));
  const labelScores = labelIds.map((id) => getScore(db, 'label', String(id)));
  if ([...artistScores, ...labelScores].some((s) => s < config.dislikeThreshold)) return null; // disliked

  const artistScore = artistScores.length ? Math.max(...artistScores) : 0;
  const labelScore = labelScores.length ? Math.max(...labelScores) : 0;
  const releaseScore = getScore(db, 'release', String(releaseId));
  const score = weights.artist * artistScore + weights.label * labelScore + weights.release * releaseScore;

  const parts: string[] = [];
  const bestLabel = labelIds.find((id) => getScore(db, 'label', String(id)) === labelScore && labelScore > 0);
  if (bestLabel !== undefined) parts.push(`label: ${nameOf(db, 'labels', bestLabel) ?? bestLabel}`);
  const bestArtist = artistIds.find((id) => getScore(db, 'artist', String(id)) === artistScore && artistScore > 0);
  if (bestArtist !== undefined) parts.push(`artist: ${nameOf(db, 'artists', bestArtist) ?? bestArtist}`);
  const reason = parts.length ? parts.join('; ') : 'seed/exploration';

  return { trackId, releaseId, score, reason, source, artistId: artistIds[0] ?? null, labelIds };
}

function candidateTracks(db: Db, releaseIds: number[], config: Config, source: CandidateSource): Candidate[] {
  if (releaseIds.length === 0) return [];
  const placeholders = releaseIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT id FROM tracks WHERE release_id IN (${placeholders}) AND unresolved = 0`)
    .all(...releaseIds) as Array<{ id: string }>;
  const out: Candidate[] = [];
  for (const { id } of rows) {
    if (isTrackRated(db, id) || isSeen(db, id)) continue; // already-rated / already-seen
    const scored = scoreCandidate(db, config, id, source);
    if (scored) out.push(scored);
  }
  return out;
}

// ── Diversity-aware fill (ADR-0006) ──────────────────────────────────────────

/**
 * Round-robin by artist with a shared per-label cap. Buckets candidates by primary
 * artist, takes one per artist per round (best-scored first), skipping any whose
 * label has hit the cap. Mutates `labelCount` so the cap is shared across lanes.
 */
function selectDiverse(
  candidates: Candidate[],
  slots: number,
  labelCap: number,
  labelCount: Map<number, number>,
): Candidate[] {
  if (slots <= 0 || candidates.length === 0) return [];
  const buckets = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const key = c.artistId != null ? `a${c.artistId}` : `t${c.trackId}`;
    const b = buckets.get(key);
    if (b) b.push(c);
    else buckets.set(key, [c]);
  }
  const ordered = [...buckets.values()];
  for (const b of ordered) b.sort((x, y) => y.score - x.score);
  ordered.sort((a, b) => (b[0]?.score ?? 0) - (a[0]?.score ?? 0));

  const cursors: number[] = new Array(ordered.length).fill(0);
  const picked: Candidate[] = [];
  let progressed = true;
  while (picked.length < slots && progressed) {
    progressed = false;
    for (let i = 0; i < ordered.length && picked.length < slots; i++) {
      const bucket = ordered[i]!;
      while (cursors[i]! < bucket.length) {
        const cand = bucket[cursors[i]!++]!;
        if (cand.labelIds.some((l) => (labelCount.get(l) ?? 0) >= labelCap)) continue; // label cap
        picked.push(cand);
        for (const l of cand.labelIds) labelCount.set(l, (labelCount.get(l) ?? 0) + 1);
        progressed = true;
        break; // one per bucket per round
      }
    }
  }
  return picked;
}

// ── Orchestration ────────────────────────────────────────────────────────────

/**
 * Fill the explore queue with an exploit lane (top entities + siblings) and an
 * adaptive explore lane (seeds + never-rated local + genuinely-new), selected by a
 * diversity-aware round-robin + per-label cap (ADR-0006).
 */
export async function generateExploreQueue(
  db: Db,
  client: DiscogsClient,
  config: Config,
): Promise<RecommendResult> {
  const need = config.exploreQueueTargetLength - queueLength(db);
  if (need <= 0) return { added: 0, queueLength: queueLength(db) };

  const exploitSlots = need - Math.round(exploreFraction(db, config) * need);

  // EXPLOIT: discover from top entities (fetch), plus already-local siblings.
  const top = topPositiveEntities(db);
  let exploitDiscoveryIds: number[] = [];
  if (top.labelIds.length || top.artistIds.length) {
    exploitDiscoveryIds = [...new Set(await gatherFromEntities(client, top.labelIds, top.artistIds))].slice(0, MAX_RELEASES);
    await fetchReleases(client, db, exploitDiscoveryIds);
  }
  const siblingSet = new Set(positiveScoreReleaseIds(db));
  const exploitReleaseIds = [...new Set([...exploitDiscoveryIds, ...siblingSet])];
  const exploitCandidates = candidateTracks(db, exploitReleaseIds, config, 'discovery');
  for (const c of exploitCandidates) if (siblingSet.has(c.releaseId)) c.source = 'sibling';

  // EXPLORE: fetch seeds (a) and genuinely-new (c) into the local catalog, then draw
  // every local release NOT in the exploit set (b, which subsumes a + c once fetched).
  const seeds = await resolveSeeds(client, config.seeds);
  await fetchReleases(client, db, [...seeds.releaseIds, ...(await gatherFromEntities(client, seeds.labelIds, seeds.artistIds))]);
  await fetchNewReleases(client, db, config);
  const exploitReleaseSet = new Set(exploitReleaseIds);
  const exploreReleaseIds = allLocalReleaseIds(db).filter((id) => !exploitReleaseSet.has(id));
  const exploreCandidates = candidateTracks(db, exploreReleaseIds, config, 'explore');

  // Diversity fill: exploit up to its share, explore takes the remainder, then a
  // final mixed backfill so the queue is full — all under one shared label cap.
  const labelCap = Math.max(1, Math.ceil(config.exploration.labelCapFrac * need));
  const labelCount = new Map<number, number>();
  const exploitPicks = selectDiverse(exploitCandidates, exploitSlots, labelCap, labelCount);
  const explorePicks = selectDiverse(exploreCandidates, need - exploitPicks.length, labelCap, labelCount);
  let picks = [...exploitPicks, ...explorePicks];
  if (picks.length < need) {
    const pickedIds = new Set(picks.map((c) => c.trackId));
    const leftover = [...exploitCandidates, ...exploreCandidates].filter((c) => !pickedIds.has(c.trackId));
    picks = picks.concat(selectDiverse(leftover, need - picks.length, labelCap, labelCount));
  }

  if (picks.length === 0) {
    const noSignal = positiveEntityCount(db) === 0;
    return { added: 0, queueLength: queueLength(db), ...(noSignal ? { seedingRequired: true } : {}) };
  }

  for (const c of picks) enqueue(db, c, c.source);
  return { added: picks.length, queueLength: queueLength(db) };
}
