## Context

The player shows only names. This adds a context panel (tracklist + artist/label
bios). The tracklist is already local (releases/tracks). Artist/label *profiles*
aren't stored (`getArtist`/`getLabel` keep id+name only), so they're fetched on
demand. In-force ADRs unaffected; ADR-0003 (minimize Discogs calls) is honored via
cache-first fetching, and ADR-0004 (local store) is untouched (no schema change).
No new ADR.

## Goals / Non-Goals

**Goals:** show the disc tracklist (current highlighted) and artist/label bios +
links for the current track, fetched cheaply and cached, no migration.

**Non-Goals:** photos (image proxy — deferred); a slide-in drawer; persisting
profiles in the DB; members/related-artist expansion.

## Decisions

### D1 — Fetch-on-demand, cache-first (no migration)
`getArtistDetail`/`getLabelDetail` fetch the full Discogs `/artists/{id}` /
`/labels/{id}` through the existing cached client and return `{ id, name, profile,
urls }`. First open for an entity is one throttled call; cached thereafter. We do
**not** add profile columns — the `discogs_cache` already persists the raw
responses, which is the right place for verbose, rarely-changing prose.

### D2 — Markup strip
Discogs `profile` text carries markup (`[b]…[/b]`, `[i]`, `[u]`, inline refs like
`[a123]`/`[l123]`/`[r123]`, and `[url=…]text[/url]`). A small util renders it to
plain text: `[url=…]text[/url]` → `text`; bold/italic/underline tags removed;
inline numeric refs removed; whitespace collapsed. Links come from the response's
separate `urls` array (already clean), not from inline refs.

### D3 — Track-context assembler + endpoint
`GET /api/tracks/:id/context` → `TrackContext`:
- `release`: the track's release id+title and its tracks (`position`, `title`,
  `isCurrent`) from the **local** DB.
- `artists`: the track's artists, each `getArtistDetail` → `{ id, name, bio, urls }`.
- `labels`: the release's labels, each `getLabelDetail`.
Missing bios/urls are simply empty (graceful). Shared `TrackContext` type.

### D4 — Inline info panel
An **ⓘ Info** toggle in the controls reveals an inline info card (dark/techno
theme): tracklist (current highlighted) → artist bios + links → label bio + links.
Fetched when opened for the current track; shows a loading state, then content; no
images. A true side drawer is a later layout refinement.

## Risks / Trade-offs

- [First open is slow — a throttled Discogs call per artist/label] → acceptable
  (~1–2s, then cached); show a loading state. Bios change rarely so the cache is
  effectively permanent.
- [Markup strip won't perfectly resolve inline `[a123]` refs to names] → we drop
  them rather than do extra lookups; the `urls` array covers the useful links.
- [Some artists/labels have empty profiles] → the panel degrades to just the
  tracklist + names, which is still useful.
