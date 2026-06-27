## Context

Refinements driven by first real use. Behavior touches two capabilities
(`download-queue` naming, `curation-player` like-no-advance + up-next) and the
rest is a frontend redesign. In-force ADRs (0001 local-first, 0003 Discogs sole
catalog, 0004 node:sqlite, 0005 derive-metrics) are all unaffected; no new ADR.

## Goals / Non-Goals

**Goals:** human-readable downloads; liking keeps playing; visible up-next with
scores; a single-page dark/Material/techno UI with a smaller player and inline stats.

**Non-Goals:** renaming existing downloads; configurable filename templates; a
theme toggle (dark only); any schema change or new env var.

## Decisions

### D1 — Download filename from Discogs metadata
The worker builds `"<artists> - <title>"` where `<artists>` joins the track's
artist names with `, ` and `<title>` is the Discogs track title (remix/variant
text already lives there). **Sanitize:** replace filesystem-illegal characters
(`/ \ : * ? " < > |` and control chars) with `-`, collapse whitespace, trim, and
cap length (~180 chars) to stay under path limits. Empty/unknown artist → title
only. **Collision:** if the target `.mp3` already exists on disk, append
` (n)` with an incrementing `n` until free — deterministic, needs no filename↔track
map, and a track re-downloading itself simply overwrites its own file.

The worker already has the `trackId`; it queries `tracks` + `track_artists` +
`artists` for title/artists. The download item still stores the final path.

### D2 — Like no longer advances
`applyRating(db, config, trackId, 'like')` records the rating, enqueues the
download (existing dedupe prevents duplicates), and returns the **current**
playable track **without** `removeFromQueue` — so the track stays at the front and
keeps playing. `dislike` and `skip` are unchanged (record/none + advance). Because
the frontend reloads the embedded video only when the current track *id* changes,
a like leaves playback untouched.

### D3 — Up-next payload
`GET /api/queue` returns `{ current, upNext }` where `upNext` is the queue beyond
the current item, each entry carrying display metadata: `{ trackId, title,
artists: string[], score, reason }`. Built in `playable.ts` from the queue rows +
track/artist lookups. (`current` stays the full `PlayableTrack`.)

### D4 — Single-page dark UI
One scrolling page, no tabs: player (smaller, ~220px) → now-playing + controls →
up-next list (artist · title · score) → downloads → stats (inline, same component
restyled). A small set of CSS variables drives the dark/Material/techno theme
(near-black background, one restrained accent, muted dividers, system/mono type).
Stats still refresh after each rating (the existing post-action refetch).

## Risks / Trade-offs

- [Collision counter under concurrency] → the download worker is serial
  (single-user), so the `(n)` scan has no race in practice.
- [Very long or non-Latin titles] → length cap handles long names; non-Latin
  characters are preserved (fine on modern filesystems).
- [`/api/queue` shape changes] → it's an internal API consumed only by this
  frontend; update both sides together. The `current` field is unchanged.
- [Liked track lingers at the queue front] → intended; the user advances via
  skip/dislike or lets it end. It stays `seen`, so it won't be re-surfaced later.
