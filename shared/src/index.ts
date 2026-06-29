// Shared domain types for smartcrate. Types only — no runtime exports — so this
// package can be imported via `import type` from both the backend and the
// Vite/React frontend without a build step.

// ── Catalog entities ────────────────────────────────────────────────────────

export type EntityKind = 'artist' | 'label' | 'release' | 'track';

export interface Artist {
  /** Discogs artist id. */
  id: number;
  name: string;
}

export interface Label {
  /** Discogs label id. */
  id: number;
  name: string;
}

export interface Release {
  /** Discogs release id. */
  id: number;
  title: string;
  labelIds: number[];
  artistIds: number[];
  /** True when this is a Various Artists compilation. */
  isVa: boolean;
}

export interface Track {
  /** Stable local id (Discogs has no global track id). */
  id: string;
  releaseId: number;
  title: string;
  position: string;
  artistIds: number[];
  /** Resolved YouTube video id, or null when unresolved. */
  youtubeVideoId: string | null;
  /** True when no playable YouTube video could be resolved. */
  unresolved: boolean;
}

// ── Ratings & scores ─────────────────────────────────────────────────────────

export type RatingValue = 'like' | 'dislike';

export interface RatingEvent {
  id: number;
  trackId: string;
  value: RatingValue;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

export interface EntityScore {
  kind: EntityKind;
  /** Entity id as string (Discogs numeric id or track id). */
  entityId: string;
  score: number;
}

// ── Explore queue ────────────────────────────────────────────────────────────

export interface ExploreQueueItem {
  trackId: string;
  /** Candidate score used for ranking. */
  score: number;
  /** Human-readable explanation, e.g. "label: Ostgut Ton; artist: ACR". */
  reason: string;
}

/**
 * Which path first surfaced a track into the explore queue (recorded first-touch).
 * `seed` is legacy (cold-start fallback before the explore lane existed).
 */
export type CandidateSource = 'discovery' | 'sibling' | 'explore' | 'seed';

/** Lightweight display info for an upcoming queued track (the up-next list). */
export interface UpNextItem {
  trackId: string;
  title: string;
  artists: string[];
  score: number;
  reason: string;
}

/** A track plus the metadata the player/UI needs to render and play it. */
export interface PlayableTrack {
  track: Track;
  release: Release;
  artists: Artist[];
  labels: Label[];
  reason: string;
}

// ── Download queue ───────────────────────────────────────────────────────────

export type DownloadStatus = 'queued' | 'downloading' | 'done' | 'failed';

export interface DownloadItem {
  id: number;
  trackId: string;
  status: DownloadStatus;
  /** Local filesystem path once downloaded, else null. */
  filePath: string | null;
  /** Error reason when status is 'failed'. */
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Seed config (cold-start) ─────────────────────────────────────────────────

export interface SeedConfig {
  /** Discogs label ids or names to seed the recommender. */
  labels?: Array<number | string>;
  /** Discogs artist ids or names. */
  artists?: Array<number | string>;
  /** Discogs release ids whose tracks seed the explore queue directly. */
  releases?: number[];
}

// ── API payloads ─────────────────────────────────────────────────────────────

export interface RateRequest {
  value: RatingValue | 'skip';
}

export interface RecommendResult {
  added: number;
  queueLength: number;
  /** Present when there is no signal and no seeds configured. */
  seedingRequired?: boolean;
}

// ── Stats (derived on read from the event log — see ADR-0005) ─────────────────

export interface LikeRatePoint {
  /** YYYY-MM-DD */
  date: string;
  likes: number;
  dislikes: number;
  /** likes / (likes+dislikes), or null when there are no verdicts that day. */
  rate: number | null;
}

/** Per-source contribution. Descriptive only — NOT causal lift (sources aren't randomly assigned). */
export interface SourceStat {
  source: CandidateSource;
  surfaced: number;
  rated: number;
  likes: number;
  /** likes from this source ÷ total likes. */
  likeShare: number;
  /** likes ÷ (likes+dislikes) within this source, or null. */
  likeRate: number | null;
}

export interface LeaderEntry {
  id: number;
  name: string;
  score: number;
}

export interface Stats {
  likeRate: {
    overall: number | null;
    daily: LikeRatePoint[];
  };
  /** Contribution by source — present the contribution-not-lift caveat in any UI. */
  bySource: SourceStat[];
  counters: {
    today: { rated: number; liked: number; downloaded: number };
    total: { rated: number; liked: number; downloaded: number; downloadFailed: number };
  };
  taste: { labels: LeaderEntry[]; artists: LeaderEntry[] };
  /** Fraction of fetched tracks with no resolved YouTube video (0..1). */
  unresolvedRate: number;
  generatedAt: string;
}
