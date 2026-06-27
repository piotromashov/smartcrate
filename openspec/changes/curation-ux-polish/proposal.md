## Why

First real use surfaced a batch of rough edges in the curation experience:
downloads land with cryptic synthetic names (`r37373064-3.mp3`), liking a track
yanks it away before you can enjoy it, there's no visibility into what's coming
next, and the UI is a plain light-mode two-tab layout that doesn't fit a
techno-curation session. These are small individually but together they're the
difference between "a tech demo" and "something I actually want to open every
morning."

## What Changes

- **Downloads named `Artist - Title.mp3`** from Discogs's structured metadata
  (sanitized for the filesystem; multiple artists joined; remix/variant text
  rides along in the title), instead of the synthetic track id.
- **A like no longer advances** — liking records the rating and queues the
  download but **keeps the current track playing**. Dislike and skip advance;
  track-end still auto-advances.
- **"Up next" preview** — the UI shows the upcoming queued tracks with their
  candidate scores (and artist · title · reason).
- **UI redesign:** a single-page layout (no tabs) with the player, controls,
  now-playing, up-next, downloads, **and the stats dashboard all on the main
  page**; a **smaller video frame**; and a minimalist **Material / dark-mode /
  techno** aesthetic.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `curation-player`: a like keeps playing the current track (no longer advances);
  the upcoming queue is shown with scores.
- `download-queue`: downloaded files are named from Discogs `Artist - Title`,
  sanitized, with collision disambiguation.

## Impact

- **Backend:** `downloads/worker.ts` (build filename from track title + artists,
  sanitize, disambiguate collisions); `service.ts` (like no longer advances);
  `playable.ts` / `app.ts` (extend `GET /api/queue` so upcoming items carry
  title + artists + score for the up-next list).
- **Frontend:** `App.tsx` redesign (single page, dark/Material/techno theme,
  smaller player, inline stats, up-next list); `Stats.tsx` restyled for the dark
  theme inline; `api.ts` consumes the richer queue payload.
- **No schema change, no new env vars.**
- **Out of scope:** renaming already-downloaded files (only new ones get clean
  names); configurable filename templates; a light/dark theme toggle (dark only).
