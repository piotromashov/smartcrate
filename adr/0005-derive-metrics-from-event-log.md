# 0005 — Derive metrics from the event log (no snapshots)

- Status: accepted
- Date: 2026-06-27

## Context

smartcrate needs analytics/benchmarks with trends over time. The state is
append-only and timestamped (`rating_events`) and scores are deterministically
replayable, so any metric's value at any past moment is reconstructable from the
log. The app is also **local and intermittently run** — it isn't a service that's
always on.

## Considered Options

- Periodically snapshot computed metric values into a time-series table.
- Lazy per-day rollup table recomputed from the log.
- Derive every metric on read by aggregating the event log; store no metric values.

## Decision

**Derive all metrics on read** by windowed SQL aggregation over the event log and
current-state tables. Do **not** store metric snapshots or maintain a time-series,
and do **not** add a scheduler. State that is genuinely needed for attribution but
not otherwise recorded (e.g. a candidate's `source`) is persisted as normal data,
not as a metric snapshot.

## Consequences

- Good: a single source of truth (the log) — metric values never drift from it, and
  metric definitions can change retroactively without migrating stored numbers.
- Good: no false history holes from a snapshot scheduler missing days the app wasn't
  run; "no events" reads as absence, not bad data. No scheduler to operate.
- Bad: metrics cost on-read compute. Acceptable at single-user scale; if it ever
  bites, the escape hatch is a **lazy rollup cache** recomputed from the log (still
  no scheduler, still consistent) — not scheduled snapshots.
- Future analytics work is expected to follow derive-on-read.
