# ADR Review Manifest

- Status: completed
- Review date: 2026-06-26

## Review Summary

ADR review completed for this change. This is the first change in the repo, so
there were no pre-existing in-force ADRs to honor. Three durable architectural
commitments from `design.md` met the bar for repository-level ADRs; the rest
(linear scoring formula, recommender weights, MP3 320 audio settings) are tactical
and intentionally left out of ADRs so they can evolve without supersession.

## In-Force ADRs Reviewed

- None — `adr/` had no in-force ADRs before this change.

## New Durable ADRs Created

- [ADR-0001](../../../adr/0001-local-first-single-user-architecture.md) — local-first, single-user architecture.
- [ADR-0002](../../../adr/0002-sqlite-as-local-store.md) — SQLite as the local store. **(superseded by ADR-0004 during apply.)**
- [ADR-0003](../../../adr/0003-discogs-sole-catalog-and-youtube-resolution.md) — Discogs as sole catalog API; YouTube resolution via release `videos`.
- [ADR-0004](../../../adr/0004-use-node-builtin-sqlite.md) — use Node's built-in `node:sqlite` (supersedes ADR-0002); recorded mid-apply when better-sqlite3 wouldn't build on Node 26. Bumps min Node to ≥ 22.5.
