# 0003 — Discogs as sole catalog API; YouTube resolution via release `videos`

- Status: accepted
- Date: 2026-06-26

## Context

smartcrate needs (a) authoritative techno metadata (artist, label, VA, release,
track), (b) a candidate pool to recommend from, and (c) a playable/downloadable
YouTube video per track. YouTube's own metadata is messy and a YouTube Data API
key adds quota and setup. Discogs is authoritative for techno labels/VA/artists,
and Discogs release data includes a `videos` array that is usually YouTube links.

## Considered Options

- Discogs for metadata + discovery, YouTube Data API for video resolution/search.
- Discogs as the single external API, resolving YouTube via release `videos`.
- Parse YouTube titles for metadata.

## Decision

Use **Discogs as the single external catalog API** for metadata *and* candidate
discovery, and resolve each track to a YouTube video **from the parent release's
`videos` array** — no YouTube Data API key. Tracks with no resolvable video are
marked unresolved and skipped.

## Consequences

- Good: one external integration (Discogs token) plus local `yt-dlp`/`ffmpeg`; no
  second API key/quota.
- Good: authoritative, structured techno metadata as the recommender's signal.
- Bad: incomplete `videos` coverage thins the playable pool, and a release-level
  video may not map 1:1 to a specific track. Adding a YouTube-search fallback
  later is a new capability that would supersede this ADR's "single external API"
  commitment.
