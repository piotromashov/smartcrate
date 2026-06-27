## 1. Schema & source tagging

- [x] 1.1 Migration v2: `ALTER TABLE seen_tracks ADD COLUMN source TEXT` (append to `MIGRATIONS`)
- [x] 1.2 `recommender/queue.ts`: thread a `source` through `enqueue`/`markSeen` and write it into `seen_tracks` first-touch
- [x] 1.3 `recommender/recommend.ts`: classify each surfaced candidate as `seed` (seed-fallback branch) / `sibling` (release in positive-score set) / `discovery` (else), per the design priority, and pass it to `enqueue`

## 2. Stats aggregation module

- [x] 2.1 New `backend/src/stats.ts`: derive-on-read aggregates — like-rate per day + rolling; per-source like share & rate (`rating_events ⋈ seen_tracks`); output counters (rated/liked/downloaded by status, today + total); taste leaderboard (top labels/artists); unresolved-rate (`tracks`)
- [x] 2.2 Handle edge cases: zero ratings → like-rate null; `source IS NULL` (pre-change rows) excluded from per-source breakdown; days with no events produce no bucket
- [x] 2.3 Add shared types for the stats payload in `shared/src/index.ts`

## 3. API

- [x] 3.1 `GET /api/stats` in `app.ts`, returning the aggregated payload

## 4. Dashboard

- [x] 4.1 `frontend/src/api.ts`: `getStats()`
- [x] 4.2 A `/stats` dashboard component: like-rate sparkline + value, source mix & per-source rate (with the **contribution-not-lift** caveat label), output counters, taste leaderboard, unresolved-rate; wired into the app as a Curate/Stats tab
- [x] 4.3 Refresh on load and after each rating action (reuse the post-action refetch pattern); no polling timer

## 5. Tests & verify

- [x] 5.1 Source tagging: discovery/sibling/seed classified correctly and persisted first-touch (recommender tests)
- [x] 5.2 Stats aggregates: like-rate (incl. zero-rating case), per-source breakdown excludes NULL source, unresolved-rate, counters (stats tests)
- [x] 5.3 `npm run typecheck` + `npm test --workspace backend` pass (25 tests); `frontend` builds; `/api/stats` smoke-tested live (migration v2 applied to existing db)
- [x] 5.4 `openspec validate curation-stats --type change --strict`
