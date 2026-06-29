import type {
  PlayableTrack,
  UpNextItem,
  DownloadItem,
  RecommendResult,
  RatingValue,
  Stats,
  TrackContext,
} from '@smartcrate/shared';

export type RateAction = RatingValue | 'skip';

export interface QueueState {
  current: PlayableTrack | null;
  upNext: UpNextItem[];
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function getQueue(): Promise<QueueState> {
  return fetch('/api/queue').then((r) => json<QueueState>(r));
}

export function rate(trackId: string, value: RateAction): Promise<{ current: PlayableTrack | null }> {
  return fetch(`/api/tracks/${encodeURIComponent(trackId)}/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  }).then((r) => json<{ current: PlayableTrack | null }>(r));
}

export function undo(trackId: string): Promise<{ current: PlayableTrack | null }> {
  return fetch(`/api/tracks/${encodeURIComponent(trackId)}/undo`, { method: 'POST' }).then((r) =>
    json<{ current: PlayableTrack | null }>(r),
  );
}

export function recommend(): Promise<RecommendResult> {
  return fetch('/api/recommend', { method: 'POST' }).then((r) => json<RecommendResult>(r));
}

export function getDownloads(): Promise<DownloadItem[]> {
  return fetch('/api/downloads').then((r) => json<DownloadItem[]>(r));
}

export function getStats(): Promise<Stats> {
  return fetch('/api/stats').then((r) => json<Stats>(r));
}

export function getTrackContext(trackId: string): Promise<TrackContext> {
  return fetch(`/api/tracks/${encodeURIComponent(trackId)}/context`).then((r) => json<TrackContext>(r));
}
