## Why

When you like one track on a Various Artists compilation or a label disc, the
natural next move is "show me the rest of that release" — but the recommender
rarely does. Candidate generation only pulls tracks from releases *discovered
this run* via your top-scored labels/artists (Discogs discovery), so a release
resurfaces only if it happens to land in that discovery window. Meanwhile **the
entire release was already fetched and persisted in local SQLite** the moment its
first track entered the queue. The siblings are sitting right there, unused.

## What Changes

- Add a **second candidate source** to the recommender: for every release whose
  derived entity score is **> 0**, include its **unrated / unseen / resolved**
  sibling tracks as candidates.
- Source these **from the local DB — zero Discogs API calls** (the siblings were
  already fetched and stored). No rate-limit cost.
- **Union** with the existing top-label/artist discovery candidates and **dedupe
  by `trackId`** (the existing dedupe already covers this).
- Score siblings with the **existing** formula
  (`w_artist·artistScore + w_label·labelScore + w_release·releaseScore`) —
  **no new weight variables are introduced.**
- Sentiment handling is **emergent, not special-cased**: because dislike is
  heavier than like (`1.5 > 1.0`), enough dislikes drop a release's score to
  `≤ 0`, which stops surfacing its siblings ("the comp closes"); skip stays
  neutral (no rating event, no score change) and never affects surfacing.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `recommendation-queue`: adds a requirement that candidate generation also
  surfaces the unrated/unseen/resolved sibling tracks of any release with a
  positive entity score, sourced locally (no Discogs call), unioned and
  de-duplicated with discovery candidates.

## Impact

- **Code:** `backend/src/recommender/recommend.ts` — add a local-DB sibling
  source alongside the existing discovery gathering, before scoring/filtering.
- **No schema change, no `rating-model` change, no new env vars.**
- **Accepted trade-off (documented):** with no per-release cap, one beloved
  compilation can dominate a single session's queue. Mitigated by ranking and by
  natural self-correction (surfaced siblings get marked seen/rated and drop out
  across sessions). A cap/decay is a deferred follow-up if monotony shows up.
- **Out of scope (explored, deferred):** VA-specific weight variables (the EP vs
  VA sibling asymmetry is already emergent via the artist term); per-release caps
  or score decay; time-decay on scores.
