## 1. Config & types

- [ ] 1.1 `config.ts`: add env-overridable tunables — `Q_MIN` (0.15), `Q_MAX` (0.40), `P_FULL` (12), `LABEL_CAP_FRAC` (0.4), `NEW_RELEASE_BUDGET` (8), `EXPLORE_STYLE` ('Techno')
- [ ] 1.2 `shared/src/index.ts`: `CandidateSource` += `'explore'` (keep `'seed'` as legacy)

## 2. Diversity-aware fill

- [ ] 2.1 Implement the round-robin-by-artist + per-label-cap selector: bucket scored candidates by primary artist, order buckets/within-bucket by score, iterate rounds skipping a track whose label hit the cap, until `slots` filled or buckets exhausted
- [ ] 2.2 Unit-test the selector: one dominant high-scored artist is interleaved (not monoculture); a label past the cap is excluded; higher scores preferred within the constraint

## 3. Exploit lane

- [ ] 3.1 Refactor `generateExploreQueue` into lanes; build the exploit candidate set (existing top-entity discovery + siblings) and fill `exploitSlots` via the diversity selector; tag `discovery`/`sibling`

## 4. Adaptive quota & explore lane (a + b)

- [ ] 4.1 Compute `P` (distinct positively-scored artists+labels) and the adaptive `q`; derive explore/exploit slot counts
- [ ] 4.2 Explore source (a): seeds → resolve + discover + `getRelease`
- [ ] 4.3 Explore source (b): never-rated local entities → their already-fetched releases' tracks (local DB, no Discogs call)
- [ ] 4.4 Fill `exploreSlots` from (a)+(b) via the diversity selector; tag `explore`; backfill shortfalls between lanes so the queue is full; update `seedingRequired` to mean "no signal AND nothing to explore"

## 5. Explore source (c) — genuinely new (separable slice)

- [ ] 5.1 `discogs/catalog.ts`: `discoverNewReleasesByStyle(client, style)` — Discogs `style` search, bounded + cache-aware
- [ ] 5.2 In the explore lane, add (c): fetch up to `NEW_RELEASE_BUDGET` releases whose label/artist are NOT already in the catalog, `getRelease`, feed into the explore candidates
- [ ] 5.3 Test (c) with a stubbed search: returns releases, filters out already-known entities, respects the budget

## 6. Stats

- [ ] 6.1 `stats.ts`: include `explore` in the per-source breakdown

## 7. Verify

- [ ] 7.1 `npm run typecheck` + `npm test --workspace backend` pass; `frontend` builds
- [ ] 7.2 Integration test (stubbed Discogs): with one dominant artist + seeds, the filled queue is NOT a monoculture and contains explore-tagged candidates; thin-signal run explores more than rich-signal
- [ ] 7.3 Live check against the real DB: after `recommend`, the queue is no longer all PAS/Ostgut — seeds + novelty appear; `/api/stats` shows an `explore` slice
- [ ] 7.4 `openspec validate recommender-diversity-exploration --type change --strict`
