import type { DownloadItem, DownloadStatus } from '@smartcrate/shared';
import type { Db } from '../db/db';

interface DownloadRow {
  id: number;
  track_id: string;
  status: DownloadStatus;
  file_path: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

const toItem = (r: DownloadRow): DownloadItem => ({
  id: r.id,
  trackId: r.track_id,
  status: r.status,
  filePath: r.file_path,
  error: r.error,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/**
 * Enqueue a download for a track unless it already has a queued/downloading/done
 * item (prevents duplicates; a previously-failed item may be re-enqueued).
 */
export function enqueueDownload(db: Db, trackId: string): DownloadItem | undefined {
  const existing = db
    .prepare(
      `SELECT * FROM download_queue WHERE track_id = ? AND status IN ('queued','downloading','done') ORDER BY id DESC LIMIT 1`,
    )
    .get(trackId) as DownloadRow | undefined;
  if (existing) return undefined;

  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO download_queue (track_id, status, created_at, updated_at) VALUES (?, 'queued', ?, ?)`,
    )
    .run(trackId, now, now);
  return getDownload(db, Number(info.lastInsertRowid));
}

export function getDownload(db: Db, id: number): DownloadItem | undefined {
  const row = db.prepare('SELECT * FROM download_queue WHERE id = ?').get(id) as
    | DownloadRow
    | undefined;
  return row ? toItem(row) : undefined;
}

/** Claim the oldest queued item, transitioning it to 'downloading'. */
export function claimNext(db: Db): DownloadItem | undefined {
  const row = db
    .prepare(`SELECT * FROM download_queue WHERE status = 'queued' ORDER BY id LIMIT 1`)
    .get() as DownloadRow | undefined;
  if (!row) return undefined;
  setStatus(db, row.id, 'downloading');
  return getDownload(db, row.id);
}

function setStatus(
  db: Db,
  id: number,
  status: DownloadStatus,
  fields: { filePath?: string | null; error?: string | null } = {},
): void {
  db.prepare(
    `UPDATE download_queue
       SET status = ?, updated_at = ?,
           file_path = COALESCE(?, file_path),
           error = ?
     WHERE id = ?`,
  ).run(status, new Date().toISOString(), fields.filePath ?? null, fields.error ?? null, id);
}

export function markDone(db: Db, id: number, filePath: string): void {
  setStatus(db, id, 'done', { filePath, error: null });
}

export function markFailed(db: Db, id: number, error: string): void {
  setStatus(db, id, 'failed', { error });
}

export function listDownloads(db: Db): DownloadItem[] {
  const rows = db
    .prepare('SELECT * FROM download_queue ORDER BY id DESC')
    .all() as unknown as DownloadRow[];
  return rows.map(toItem);
}
