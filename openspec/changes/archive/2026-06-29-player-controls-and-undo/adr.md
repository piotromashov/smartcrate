# ADR Review Manifest

- Status: completed
- Review date: 2026-06-29

## Review Summary

ADR review completed. This is player UX (share, control feedback, Back/Next
transport, single-level undo). The only architectural-adjacent choice — allowing a
single-level hard-delete undo of the most recent rating — was deliberated in
explore and is a contained spec loosening, not a durable architectural commitment:
the event log remains the source of truth and scores stay recomputable, so ADR-0005
(derive-on-read) still holds. No new ADR is warranted.

## In-Force ADRs Reviewed

- [ADR-0001](../../../adr/0001-local-first-single-user-architecture.md) — local-first, single-user.
- [ADR-0005](../../../adr/0005-derive-metrics-from-event-log.md) — derive on read (undo removes one event; the log is still the truth).
- [ADR-0006](../../../adr/0006-explore-exploit-diversity-recommender.md) — recommender (undoing a rating frees the track to be recommended again).

## New Durable ADRs Created

- None — no major durable architectural decisions were introduced.
