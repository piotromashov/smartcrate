## Context

smartcrate has no visibility into whether the recommender is working. The data to
answer that already exists: `rating_events` is append-only and timestamped,
`download_queue` carries status + timestamps, `entity_scores` holds the live taste
model, and `tracks.unresolved` marks video coverage. The only missing piece for
per-source metrics is *which source surfaced a track* — `explore_queue` knows it at
surface time but is deleted on rating, whereas `seen_tracks` persists forever.
In-force ADRs to honor: 0001 (local-first, single-user), 0004 (`node:sqlite`).

## Goals / Non-Goals

**Goals:**
- A read-only metrics endpoint + dashboard that shows whether curation is improving.
- Trends over time with **zero new time-series storage** — derive from the log.
- Per-source attribution via exactly one new column.

**Non-Goals:**
- Metric snapshots, rollup tables, or any scheduler.
- Causal-lift / holdout / counterfactual experiment instrumentation.
- A per-session concept; `rating-model` changes; new env vars.

## Decisions

### D1 — Derive-on-read; the log is the history
All metrics are computed at request time by windowed SQL aggregation over the event
log and current-state tables. No snapshots. Rationale: the log is append-only and
scores are deterministically replayable, so any past value is reconstructable;
snapshots would (a) drift from that recomputable truth and (b) leave false holes on
a local app that isn't always running (a "daily snapshot" misses days you don't open
it, which reads as data rather than absence). History buckets are per-day
(`date(created_at)`); days with no events have no bucket.

### D2 — Source attribution: one column on `seen_tracks`, first-touch
Add `seen_tracks.source` (`'discovery' | 'sibling' | 'seed'`). `seen_tracks` is
written once per track via `INSERT OR IGNORE` and never deleted, so first-touch
semantics fall out naturally and the source survives the queue row's deletion on
rate. Per-source like-rate = `rating_events ⋈ seen_tracks ON track_id GROUP BY
source`.

**Classification at enqueue (in the recommender):**
- The run used the **seed fallback** (no rating signal) → `seed`.
- Else the track's release is in the **positive-score release set** (the sibling
  source) → `sibling`.
- Else (top label/artist discovery) → `discovery`.

The order matters because the candidate sets can overlap; `sibling` (a release you
engaged with) takes precedence over `discovery`.

### D3 — Per-source numbers are contribution, not lift
Sources are not randomly assigned: siblings are drawn from already-liked releases,
discovery is cooler, seed is coldest. So a higher sibling like-rate reflects
selection bias, not proof the feature *causes* better curation. The endpoint and
dashboard label these as a contribution/mix view with that caveat. True causal lift
would need counterfactual logging — explicitly out of scope.

### D4 — Read-only endpoint + reactive dashboard
`GET /api/stats?bucket=day` returns a single aggregated payload (trend series +
current rollups). The `/stats` dashboard refetches on load and after each rating
action (reusing the existing post-action refetch pattern) — no polling timer.

## Risks / Trade-offs

- [Derive-on-read gets slow on a huge log] → Not a concern at single-user scale
  (thousands of events). If it ever bites, add a lazy per-day rollup *cache* over
  the same queries — still no scheduler, still consistent with the log.
- [Per-source numbers get over-read as "siblings are better"] → Mitigation: the
  contribution-not-lift caveat is a requirement (spec + dashboard label), not just
  a note.
- [Backfill: tracks seen before this change have `source = NULL`] → Treat NULL as
  `unknown`/excluded from per-source breakdowns; totals and trends are unaffected.
