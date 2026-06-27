## 1. Sibling candidate source

- [x] 1.1 Add a local query that returns the ids of releases whose entity score is `> 0` (from `entity_scores`, kind `release`)
- [x] 1.2 In `generateExploreQueue` (`backend/src/recommender/recommend.ts`), union those positive-score release ids into the `releaseIds` passed to `candidateTracks` (so siblings flow through the existing score/filter/dedupe/rank/fill path)
- [x] 1.3 Confirm no `DiscogsClient` call is made for the sibling source (local DB only) and that `candidateTracks`' existing filters (rated / seen / unresolved / disliked artist|label) and `trackId` dedupe apply unchanged

## 2. Tests

- [x] 2.1 Sibling of a positive-score release is surfaced as a candidate with no network call (asserts no `/releases/<id>` re-fetch)
- [x] 2.2 Release at score `≤ 0` (dislike outweighs like) does not surface siblings; skip records no event so the score and surfacing are unchanged
- [x] 2.3 Surfaced siblings respect filters (already-rated track excluded) and flow through the existing dedupe against discovery candidates

## 3. Verify

- [x] 3.1 `npm run typecheck` and `npm test --workspace backend` pass (22 tests)
- [x] 3.2 Run `openspec validate surface-release-siblings --type change --strict`
