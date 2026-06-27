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

export function loadConfig(): Config {
  const env = process.env;
  return {
    port: Number(env.PORT ?? 4321),
    dbPath: env.SMARTCRATE_DB_PATH ?? join(REPO_ROOT, 'data/smartcrate.db'),
    downloadDir: env.SMARTCRATE_DOWNLOAD_DIR ?? join(REPO_ROOT, 'downloads'),
    discogsToken: env.DISCOGS_TOKEN ?? '',
    audioFormat: env.SMARTCRATE_AUDIO_FORMAT ?? 'mp3',
    audioQuality: env.SMARTCRATE_AUDIO_QUALITY ?? '0',
    weights: {
      like: Number(env.SMARTCRATE_WEIGHT_LIKE ?? 1),
      dislike: Number(env.SMARTCRATE_WEIGHT_DISLIKE ?? 1.5),
      artist: Number(env.SMARTCRATE_WEIGHT_ARTIST ?? 1),
      label: Number(env.SMARTCRATE_WEIGHT_LABEL ?? 0.8),
      release: Number(env.SMARTCRATE_WEIGHT_RELEASE ?? 0.6),
    },
    exploreQueueTargetLength: Number(env.SMARTCRATE_EXPLORE_QUEUE_LENGTH ?? 25),
    dislikeThreshold: Number(env.SMARTCRATE_DISLIKE_THRESHOLD ?? 0),
    seeds: loadSeeds(env.SMARTCRATE_SEED_CONFIG ?? join(REPO_ROOT, 'config/seeds.json')),
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
