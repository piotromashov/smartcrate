## Why

Right now there's no way to tell whether smartcrate is actually *working* — whether
the recommender is learning your taste and getting better, or just spinning. The
core promise is "the more you curate, the less effort it takes to find good music,"
and that's a measurable claim. We want benchmarks plus a live dashboard that shows
the trend (growing or shrinking), so each feature has to earn its place against data.

The append-only, timestamped `rating_events` log already *is* a history — any
metric's value at any past moment is derivable by aggregating events up to that
time. So we get trends without storing snapshots (which would drift from the
recomputable truth and leave false holes on a local app that isn't always running).

## What Changes

- Add a **`curation-stats`** capability: a read-only **`GET /api/stats?bucket=day`**
  endpoint computing metrics as **windowed SQL aggregates over the event log** — no
  snapshots, no scheduler, no new time-series storage — and a **`/stats` dashboard**
  in the frontend that consumes it (sparklines + numbers), refetched after each
  rating and on load.
- **v1 metrics:**
  1. **Like-rate trend** — `likes/(likes+dislikes)` per day + a rolling value (the
     North Star: is it growing?).
  2. **Source mix + per-source like-rate** — share of likes and like-rate by
     candidate source (`discovery | sibling | seed`). Surfaced **as a contribution/
     descriptive view, explicitly NOT causal lift** (siblings are drawn from
     already-liked releases, so a higher rate doesn't prove the feature *causes*
     better curation).
  3. **Output counters** — tracks rated / liked / downloaded (done|failed),
     today + total.
  4. **Taste leaderboard** — top labels & artists by current entity score.
  5. **Unresolved-rate** — % of fetched tracks with no resolved YouTube video, a
     catalog-coverage guardrail.
- Record candidate **source** first-touch on `seen_tracks` (the one new column) so
  per-source metrics are possible after `explore_queue` rows are deleted on rate.

## Capabilities

### New Capabilities

- `curation-stats`: read-only aggregated metrics over the event log
  (`GET /api/stats`) and the dashboard contract, including the explicit
  contribution-not-lift framing for per-source numbers.

### Modified Capabilities

- `recommendation-queue`: surfaced candidates are tagged with the source that
  produced them (`discovery | sibling | seed`), persisted first-touch, so they can
  be attributed later.

## Impact

- **Schema:** migration v2 — `ALTER TABLE seen_tracks ADD COLUMN source`.
- **Code:** `recommender/queue.ts` (enqueue records source) + `recommend.ts`
  (classify discovery/sibling/seed); new `backend/src/stats.ts` (aggregation);
  `GET /api/stats` in `app.ts`; frontend `api.ts` `getStats()` + a `/stats`
  dashboard component wired into the app.
- **No new env vars. `rating-model` untouched. No snapshot table, no scheduler.**
- **Out of scope (explored, deferred):** causal-lift / holdout / counterfactual
  instrumentation; a per-session concept (history is per-day); metric snapshot or
  rollup tables.
