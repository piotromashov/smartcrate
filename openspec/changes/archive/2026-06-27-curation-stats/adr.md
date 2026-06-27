# ADR Review Manifest

- Status: completed
- Review date: 2026-06-27

## Review Summary

ADR review completed for this change. It introduces one durable architectural
commitment — metrics are derived on read from the event log rather than snapshotted
— which will constrain how all future analytics work is built, so it is recorded as
a repository-level ADR. It is coherent with the in-force ADRs (local-first; local
`node:sqlite` store). The per-source attribution column and the dashboard are
tactical and do not warrant their own ADRs.

## In-Force ADRs Reviewed

- [ADR-0001](../../../adr/0001-local-first-single-user-architecture.md) — local-first, single-user architecture.
- [ADR-0004](../../../adr/0004-use-node-builtin-sqlite.md) — local store via `node:sqlite` (supersedes ADR-0002).
- (ADR-0003 — Discogs as sole catalog API — unaffected; no Discogs interaction here.)

## New Durable ADRs Created

- [ADR-0005](../../../adr/0005-derive-metrics-from-event-log.md) — derive metrics from the event log; no snapshots, no scheduler.
