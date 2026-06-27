import { execFile } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { Db } from '../db/db';
import type { Config } from '../config';
import { claimNext, markDone, markFailed } from './queue';

const execFileAsync = promisify(execFile);

export interface DownloadJob {
  videoId: string;
  outTemplate: string;
  format: string;
  quality: string;
}

/** Performs the actual download; injectable so tests don't shell out. */
export type DownloadRunner = (job: DownloadJob) => Promise<void>;

/** Default runner: invokes local `yt-dlp` to extract MP3 320 (requires ffmpeg). */
export function ytDlpRunner(): DownloadRunner {
  return async ({ videoId, outTemplate, format, quality }) => {
    await execFileAsync('yt-dlp', [
      '-x',
      '--audio-format',
      format,
      '--audio-quality',
      quality,
      '--no-playlist',
      '-o',
      outTemplate,
      `https://www.youtube.com/watch?v=${videoId}`,
    ]);
  };
}

function videoIdFor(db: Db, trackId: string): string | null {
  const row = db.prepare('SELECT youtube_video_id FROM tracks WHERE id = ?').get(trackId) as
    | { youtube_video_id: string | null }
    | undefined;
  return row?.youtube_video_id ?? null;
}

/** Replace filesystem-illegal characters and tidy whitespace; cap length. */
export function sanitizeFilename(name: string): string {
  return (
    name
      // eslint-disable-next-line no-control-regex
      .replace(/[\/\\:*?"<>|\x00-\x1f]/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/-{2,}/g, '-')
      .trim()
      .slice(0, 180) || 'track'
  );
}

/** Build "Artist, Artist - Title" (or just the title) from the track's Discogs metadata. */
function buildBaseName(db: Db, trackId: string): string {
  const track = db.prepare('SELECT title FROM tracks WHERE id = ?').get(trackId) as
    | { title: string }
    | undefined;
  const title = track?.title ?? trackId;
  const artists = (
    db
      .prepare(
        `SELECT a.name FROM track_artists ta JOIN artists a ON a.id = ta.artist_id
          WHERE ta.track_id = ? ORDER BY a.id`,
      )
      .all(trackId) as Array<{ name: string }>
  ).map((r) => r.name);
  return sanitizeFilename(artists.length ? `${artists.join(', ')} - ${title}` : title);
}

/** Pick a path that doesn't collide with a different track's file. */
function uniquePath(dir: string, base: string, ext: string): string {
  let candidate = join(dir, `${base}.${ext}`);
  for (let n = 2; existsSync(candidate); n++) candidate = join(dir, `${base} (${n}).${ext}`);
  return candidate;
}

/**
 * Process one queued download. Returns false when the queue is empty. Failures
 * (missing/erroring yt-dlp or ffmpeg, unresolved track) are recorded on the item
 * and never thrown — the worker keeps running.
 */
export async function processNext(db: Db, config: Config, runner: DownloadRunner): Promise<boolean> {
  const item = claimNext(db);
  if (!item) return false;

  const videoId = videoIdFor(db, item.trackId);
  if (!videoId) {
    markFailed(db, item.id, 'Track has no resolved YouTube video');
    return true;
  }

  try {
    mkdirSync(config.downloadDir, { recursive: true });
    const filePath = uniquePath(config.downloadDir, buildBaseName(db, item.trackId), config.audioFormat);
    // yt-dlp output template: same base, its own extension.
    const outTemplate = filePath.replace(new RegExp(`\\.${config.audioFormat}$`), '.%(ext)s');
    await runner({ videoId, outTemplate, format: config.audioFormat, quality: config.audioQuality });
    markDone(db, item.id, filePath);
  } catch (err) {
    const reason = (err as NodeJS.ErrnoException).code === 'ENOENT'
      ? 'yt-dlp not found on PATH (install yt-dlp and ffmpeg)'
      : (err as Error).message;
    markFailed(db, item.id, reason);
  }
  return true;
}

/** Background poller that drains the download queue on an interval. */
export class DownloadWorker {
  private timer: ReturnType<typeof setInterval> | undefined;
  private draining = false;

  constructor(
    private readonly db: Db,
    private readonly config: Config,
    private readonly runner: DownloadRunner = ytDlpRunner(),
  ) {}

  start(pollMs = 2000): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.drain(), pollMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (await processNext(this.db, this.config, this.runner)) {
        /* keep draining until empty */
      }
    } finally {
      this.draining = false;
    }
  }
}
