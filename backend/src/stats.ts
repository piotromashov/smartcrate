import type {
  Stats,
  LikeRatePoint,
  SourceStat,
  LeaderEntry,
  CandidateSource,
} from '@smartcrate/shared';
import type { Db } from './db/db';

const rate = (likes: number, dislikes: number): number | null =>
  likes + dislikes === 0 ? null : likes / (likes + dislikes);

function dailyLikeRate(db: Db): LikeRatePoint[] {
  const rows = db
    .prepare(
      `SELECT date(created_at) AS d,
              SUM(CASE WHEN value = 'like' THEN 1 ELSE 0 END) AS likes,
              SUM(CASE WHEN value = 'dislike' THEN 1 ELSE 0 END) AS dislikes
         FROM rating_events
        GROUP BY d
        ORDER BY d`,
    )
    .all() as Array<{ d: string; likes: number; dislikes: number }>;
  return rows.map((r) => ({ date: r.d, likes: r.likes, dislikes: r.dislikes, rate: rate(r.likes, r.dislikes) }));
}

function overallLikeRate(db: Db): number | null {
  const r = db
    .prepare(
      `SELECT SUM(CASE WHEN value='like' THEN 1 ELSE 0 END) AS likes,
              SUM(CASE WHEN value='dislike' THEN 1 ELSE 0 END) AS dislikes
         FROM rating_events`,
    )
    .get() as { likes: number | null; dislikes: number | null };
  return rate(r.likes ?? 0, r.dislikes ?? 0);
}

function bySource(db: Db): SourceStat[] {
  // Surfaced counts per source (NULL = seen before this feature; excluded).
  const surfaced = db
    .prepare(`SELECT source, COUNT(*) AS n FROM seen_tracks WHERE source IS NOT NULL GROUP BY source`)
    .all() as Array<{ source: CandidateSource; n: number }>;
  // Ratings joined back to the source that first surfaced the track.
  const rated = db
    .prepare(
      `SELECT s.source AS source,
              COUNT(*) AS rated,
              SUM(CASE WHEN r.value='like' THEN 1 ELSE 0 END) AS likes,
              SUM(CASE WHEN r.value='dislike' THEN 1 ELSE 0 END) AS dislikes
         FROM rating_events r
         JOIN seen_tracks s ON s.track_id = r.track_id
        WHERE s.source IS NOT NULL
        GROUP BY s.source`,
    )
    .all() as Array<{ source: CandidateSource; rated: number; likes: number; dislikes: number }>;

  const totalLikes = rated.reduce((a, r) => a + r.likes, 0);
  const surfacedBy = new Map(surfaced.map((s) => [s.source, s.n]));
  const sources: CandidateSource[] = ['discovery', 'sibling', 'seed'];

  return sources
    .map((source): SourceStat => {
      const r = rated.find((x) => x.source === source);
      const likes = r?.likes ?? 0;
      const dislikes = r?.dislikes ?? 0;
      return {
        source,
        surfaced: surfacedBy.get(source) ?? 0,
        rated: r?.rated ?? 0,
        likes,
        likeShare: totalLikes === 0 ? 0 : likes / totalLikes,
        likeRate: rate(likes, dislikes),
      };
    })
    .filter((s) => s.surfaced > 0 || s.rated > 0);
}

function counters(db: Db): Stats['counters'] {
  const one = (sql: string, ...args: Array<string | number>) =>
    (db.prepare(sql).get(...args) as { n: number }).n;

  return {
    today: {
      rated: one(`SELECT COUNT(*) AS n FROM rating_events WHERE date(created_at) = date('now')`),
      liked: one(`SELECT COUNT(*) AS n FROM rating_events WHERE value='like' AND date(created_at) = date('now')`),
      downloaded: one(`SELECT COUNT(*) AS n FROM download_queue WHERE status='done' AND date(updated_at) = date('now')`),
    },
    total: {
      rated: one(`SELECT COUNT(*) AS n FROM rating_events`),
      liked: one(`SELECT COUNT(*) AS n FROM rating_events WHERE value='like'`),
      downloaded: one(`SELECT COUNT(*) AS n FROM download_queue WHERE status='done'`),
      downloadFailed: one(`SELECT COUNT(*) AS n FROM download_queue WHERE status='failed'`),
    },
  };
}

function leaderboard(db: Db, kind: 'label' | 'artist'): LeaderEntry[] {
  const table = kind === 'label' ? 'labels' : 'artists';
  return db
    .prepare(
      `SELECT CAST(e.entity_id AS INTEGER) AS id, t.name AS name, e.score AS score
         FROM entity_scores e
         JOIN ${table} t ON t.id = CAST(e.entity_id AS INTEGER)
        WHERE e.kind = ? AND e.score > 0
        ORDER BY e.score DESC
        LIMIT 8`,
    )
    .all(kind) as unknown as LeaderEntry[];
}

function unresolvedRate(db: Db): number {
  const r = db.prepare(`SELECT AVG(unresolved) AS frac FROM tracks`).get() as { frac: number | null };
  return r.frac ?? 0;
}

/** Compute all dashboard metrics on read by aggregating the event log + current state. */
export function getStats(db: Db): Stats {
  return {
    likeRate: { overall: overallLikeRate(db), daily: dailyLikeRate(db) },
    bySource: bySource(db),
    counters: counters(db),
    taste: { labels: leaderboard(db, 'label'), artists: leaderboard(db, 'artist') },
    unresolvedRate: unresolvedRate(db),
    generatedAt: new Date().toISOString(),
  };
}
