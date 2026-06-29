import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import type { SeedConfig } from '@smartcrate/shared';

// Repo root, so default data/seed/download paths are stable regardless of the
// working directory the backend is launched from (npm workspace scripts run with
// CWD = backend/). config.ts lives at <root>/backend/src/config.ts.
const REPO_ROOT = resolve(import.meta.dirname, '../..');

loadDotenv({ path: join(REPO_ROOT, '.env') });

/** Recommender / scoring weights — sane defaults, tune during use (design open question). */
export interface Weights {
  like: number;
  dislike: number;
  artist: number;
  label: number;
  release: number;
}

export interface Config {
  port: number;
  dbPath: string;
  downloadDir: string;
  /** Discogs personal access token; may be empty (catalog features fail fast at use). */
  discogsToken: string;
  /** yt-dlp output template / audio settings. */
  audioFormat: string;
  audioQuality: string;
  weights: Weights;
  /** Target number of items to keep in the explore queue. */
  exploreQueueTargetLength: number;
  /** An entity is treated as "disliked" when its score is at or below this. */
  dislikeThreshold: number;
  seeds: SeedConfig;
  exploration: Exploration;
}

/** Explore/exploit + diversity tunables (ADR-0006). */
export interface Exploration {
  /** Explore-share floor / ceiling. */
  qMin: number;
  qMax: number;
  /** Number of distinct positive entities at which explore reaches its floor. */
  pFull: number;
  /** Max fraction of a lane any single label may fill. */
  labelCapFrac: number;
  /** Max genuinely-new releases fetched from Discogs per run. */
  newReleaseBudget: number;
  /** Discogs style searched for genuinely-new releases. */
  style: string;
}

function loadSeeds(path: string): SeedConfig {
  const abs = resolve(path);
  if (!existsSync(abs)) return {};
  try {
    const parsed = JSON.parse(readFileSync(abs, 'utf8')) as SeedConfig;
    return parsed ?? {};
  } catch (err) {
    throw new Error(`Failed to parse seed config at ${abs}: ${(err as Error).message}`);
  }
}

/** Treat empty/whitespace env values (e.g. from copying .env.example) as unset. */
function str(v: string | undefined): string | undefined {
  return v && v.trim() !== '' ? v : undefined;
}
function num(v: string | undefined, fallback: number): number {
  const s = str(v);
  if (s === undefined) return fallback;
  const n = Number(s);
  return Number.isNaN(n) ? fallback : n;
}

export function loadConfig(): Config {
  const env = process.env;
  return {
    port: num(env.PORT, 4321),
    dbPath: str(env.SMARTCRATE_DB_PATH) ?? join(REPO_ROOT, 'data/smartcrate.db'),
    downloadDir: str(env.SMARTCRATE_DOWNLOAD_DIR) ?? join(REPO_ROOT, 'downloads'),
    discogsToken: str(env.DISCOGS_TOKEN) ?? '',
    audioFormat: str(env.SMARTCRATE_AUDIO_FORMAT) ?? 'mp3',
    audioQuality: str(env.SMARTCRATE_AUDIO_QUALITY) ?? '0',
    weights: {
      like: num(env.SMARTCRATE_WEIGHT_LIKE, 1),
      dislike: num(env.SMARTCRATE_WEIGHT_DISLIKE, 1.5),
      artist: num(env.SMARTCRATE_WEIGHT_ARTIST, 1),
      label: num(env.SMARTCRATE_WEIGHT_LABEL, 0.8),
      release: num(env.SMARTCRATE_WEIGHT_RELEASE, 0.6),
    },
    exploreQueueTargetLength: num(env.SMARTCRATE_EXPLORE_QUEUE_LENGTH, 25),
    dislikeThreshold: num(env.SMARTCRATE_DISLIKE_THRESHOLD, 0),
    seeds: loadSeeds(str(env.SMARTCRATE_SEED_CONFIG) ?? join(REPO_ROOT, 'config/seeds.json')),
    exploration: {
      qMin: num(env.SMARTCRATE_EXPLORE_Q_MIN, 0.15),
      qMax: num(env.SMARTCRATE_EXPLORE_Q_MAX, 0.4),
      pFull: num(env.SMARTCRATE_EXPLORE_P_FULL, 12),
      labelCapFrac: num(env.SMARTCRATE_LABEL_CAP_FRAC, 0.4),
      newReleaseBudget: num(env.SMARTCRATE_NEW_RELEASE_BUDGET, 8),
      style: str(env.SMARTCRATE_EXPLORE_STYLE) ?? 'Techno',
    },
  };
}

/** Returns the Discogs token or throws a clear configuration error (fail fast). */
export function requireDiscogsToken(config: Config): string {
  if (!config.discogsToken) {
    throw new Error(
      'DISCOGS_TOKEN is not set. Create a Discogs personal access token and set ' +
        'the DISCOGS_TOKEN environment variable (see .env.example).',
    );
  }
  return config.discogsToken;
}
