## 1. Schema & source tagging

- [ ] 1.1 Migration v2: `ALTER TABLE seen_tracks ADD COLUMN source TEXT` (append to `MIGRATIONS`)
- [ ] 1.2 `recommender/queue.ts`: thread a `source` through `enqueue`/`markSeen` and write it into `seen_tracks` first-touch
- [ ] 1.3 `recommender/recommend.ts`: classify each surfaced candidate as `seed` (seed-fallback branch) / `sibling` (release in positive-score set) / `discovery` (else), per the design priority, and pass it to `enqueue`

## 2. Stats aggregation module

- [ ] 2.1 New `backend/src/stats.ts`: derive-on-read aggregates — like-rate per day + rolling (from `rating_events`); per-source like share & rate (`rating_events ⋈ seen_tracks`); output counters (rated/liked/downloaded by status, today + total); taste leaderboard (top labels/artists from `entity_scores` + names); unresolved-rate (`tracks`)
- [ ] 2.2 Handle edge cases: zero ratings → like-rate not-applicable (no divide-by-zero); `source IS NULL` (pre-change rows) excluded from per-source breakdown; days with no events produce no bucket
- [ ] 2.3 Add shared types for the stats payload in `shared/src/index.ts`

## 3. API

- [ ] 3.1 `GET /api/stats` (with `?bucket=day`) in `app.ts`, returning the aggregated payload

## 4. Dashboard

- [ ] 4.1 `frontend/src/api.ts`: `getStats()`
- [ ] 4.2 A `/stats` dashboard component: like-rate sparkline + value, source mix & per-source rate (with the **contribution-not-lift** caveat label), output counters, taste leaderboard, unresolved-rate; wire it into the app (a view/tab)
- [ ] 4.3 Refresh on load and after each rating action (reuse the post-action refetch pattern); no polling timer

## 5. Tests & verify

- [ ] 5.1 Source tagging: discovery/sibling/seed classified correctly and persisted first-touch (not overwritten on re-surface)
- [ ] 5.2 Stats aggregates: like-rate (incl. zero-rating case), per-source breakdown excludes NULL source, unresolved-rate, counters
- [ ] 5.3 `npm run typecheck` + `npm test --workspace backend` pass; `frontend` builds
- [ ] 5.4 `openspec validate curation-stats --type change --strict`
