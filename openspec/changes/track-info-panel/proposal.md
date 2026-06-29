## Why

When a track is playing you often want context — what else is on this disc, who
the artist is, what the label is about. Right now the player shows only the title,
artist, and label *names*. A side info panel gives you the release's tracklist and
the artist/label bios at a glance, without leaving the session.

## What Changes

- Add a **track info panel** for the current track, opened by an **ⓘ Info** toggle,
  showing:
  - the **release/disc tracklist** with the current track highlighted (already
    local — no fetch),
  - each **artist's bio + links** and the **label's bio + links** (Discogs profile
    text, markup stripped to readable text).
- Add a **`GET /api/tracks/:id/context`** endpoint that assembles this.
- Fetch artist/label bios **on demand, cache-first** (the existing
  `discogs_cache`): the first open for an artist/label is one throttled Discogs
  call, instant thereafter. **No schema change, no stored profiles.**
- **No photos** in this version (the Discogs image-hotlink proxy is deferred).

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `discogs-catalog`: fetch artist/label **profile details** (bio + links),
  cache-aware.
- `curation-player`: a **track info panel** showing the current track's disc
  tracklist (current highlighted) and the artist/label bios + links.

## Impact

- **Backend:** `discogs/catalog.ts` — `getArtistDetail`/`getLabelDetail`
  (cache-first full fetch → `{ id, name, profile, urls }`) + a markup-strip util;
  a track-context assembler (local tracklist + artist/label details); `app.ts` —
  `GET /api/tracks/:id/context`.
- **Frontend:** `api.ts` `getTrackContext(trackId)`; an **ⓘ Info** toggle + an
  inline info panel in `App.tsx` (dark/techno theme; loading/empty states; no
  images).
- **No schema change, no migration, no new env vars.**
- **Out of scope (deferred):** artist/label **photos** (image proxy); a true
  slide-in side drawer; storing profiles in the DB; members/related expansion.
