import type { CacheStore } from './cache';

const DISCOGS_BASE = 'https://api.discogs.com';
const USER_AGENT = 'smartcrate/0.1 (+https://github.com/piotromashov/smartcrate)';

export interface DiscogsClientOptions {
  /** Discogs personal access token. Required — constructor throws if empty (fail fast). */
  token: string;
  cache: CacheStore;
  /** Minimum ms between network requests (default 1000 ≈ 60/min). Set 0 in tests. */
  intervalMs?: number;
  /** Injectable fetch + clock for testing. */
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Authenticated, throttled, cached Discogs HTTP client. Reads are served from
 * cache before hitting the network; network calls are paced to stay within the
 * authenticated rate limit (~60/min).
 */
export class DiscogsClient {
  private readonly token: string;
  private readonly cache: CacheStore;
  private readonly intervalMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private gate: Promise<unknown> = Promise.resolve();
  private lastAt = -Infinity;

  constructor(opts: DiscogsClientOptions) {
    if (!opts.token) {
      throw new Error(
        'DISCOGS_TOKEN is not set. Create a Discogs personal access token and set ' +
          'the DISCOGS_TOKEN environment variable (see .env.example).',
      );
    }
    this.token = opts.token;
    this.cache = opts.cache;
    this.intervalMs = opts.intervalMs ?? 1000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? defaultSleep;
  }

  /** GET a Discogs resource as parsed JSON, cache-first. */
  async get<T = unknown>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const key = buildKey(path, params);
    const cached = this.cache.get(key);
    if (cached !== undefined) return JSON.parse(cached) as T;

    const text = await this.paced(() => this.fetchText(path, params));
    this.cache.set(key, text);
    return JSON.parse(text) as T;
  }

  private async fetchText(path: string, params: Record<string, string | number>): Promise<string> {
    const url = new URL(path, DISCOGS_BASE);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const res = await this.fetchImpl(url.toString(), {
      headers: {
        Authorization: `Discogs token=${this.token}`,
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Discogs request failed: ${res.status} ${res.statusText} for ${path}`);
    }
    return res.text();
  }

  /** Serialize requests and space them by at least `intervalMs`. */
  private async paced<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.gate.then(async () => {
      const wait = this.intervalMs - (this.now() - this.lastAt);
      if (wait > 0) await this.sleep(wait);
      this.lastAt = this.now();
      return fn();
    });
    // Keep the gate chained even if this call rejects, so pacing is preserved.
    this.gate = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

function buildKey(path: string, params: Record<string, string | number>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return sorted ? `GET ${path}?${sorted}` : `GET ${path}`;
}
