# ADR Review Manifest

- Status: completed
- Review date: 2026-06-29

## Review Summary

ADR review completed. This change makes a durable structural choice about how
recommendation works — explore/exploit with a diversity-aware fill, replacing the
greedy score-sort — which future recommender work must honor, so it is recorded as
a repository-level ADR. It is coherent with the in-force ADRs (local-first; Discogs
sole catalog; node:sqlite). The specific tunables and source mix are tactical and
do not need their own ADRs.

## In-Force ADRs Reviewed

- [ADR-0001](../../../adr/0001-local-first-single-user-architecture.md) — local-first, single-user.
- [ADR-0003](../../../adr/0003-discogs-sole-catalog-and-youtube-resolution.md) — Discogs as sole catalog (the new style-search source reuses it).
- [ADR-0004](../../../adr/0004-use-node-builtin-sqlite.md) — local node:sqlite store.
- [ADR-0005](../../../adr/0005-derive-metrics-from-event-log.md) — derive metrics on read (the `explore` source tag feeds it).

## New Durable ADRs Created

- [ADR-0006](../../../adr/0006-explore-exploit-diversity-recommender.md) — explore/exploit recommender with a diversity-aware (round-robin + per-label cap) fill.
