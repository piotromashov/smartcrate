## Why

The recommender collapses into a filter bubble. Confirmed from the live DB: 7
likes all on one Planetary Assault Systems release made PAS (artist) and Ostgut
Ton (label) the only positive entities, and now every candidate is PAS/Ostgut —
the four other declared seeds never appear. Two root flaws compound: (1) the fill
is a **pure greedy score-sort**, so the highest-scored entity owns the whole queue
(seeds at score 0 can never be reached even if added to the pool); and (2) seeds
are **cold-start-only**, so once any signal exists the recommender exploits and
never explores. The just-shipped sibling feature poured fuel on it. The fix is a
genuine **explore/exploit** split with a diversity-aware fill.

## What Changes

- **Diversity-aware fill** — replace the greedy score-sort with **round-robin by
  artist** plus a **hard per-label cap**, so no single artist (or label via its
  roster) can own the queue. This also tames the sibling flood.
- **Adaptive explore/exploit quota** — the queue is split into an **exploit** lane
  (your top-scored artists/labels + siblings) and an **explore** lane (novelty).
  The explore fraction `q` is **adaptive**: large when your taste model is thin,
  shrinking as it gains signal.
- **Explore lane sources** — (a) your config **seeds**, (b) **never-rated**
  entities already in the local catalog ($0), and (c) **genuinely new** releases
  via a Discogs style search filtered to labels/artists not yet in your catalog.
- **Shortfall backfill** — if either lane can't fill its slots, the other backfills
  so the queue is always full.
- **Source tagging** — explore-lane candidates are tagged `explore` (alongside the
  existing `discovery`/`sibling`), so the stats can show whether exploration earns
  keepers. (`seed` stays as a legacy value.)
- New tunables (explore-quota curve, label cap, new-source budget) as
  env-overridable constants, like the existing weights.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `recommendation-queue`: candidate generation splits into an exploit lane and an
  adaptive explore lane (seeds + never-rated + genuinely-new); the queue is filled
  by round-robin diversity with a per-label cap instead of a greedy score-sort;
  explore-lane candidates are tagged `explore`.
- `discogs-catalog`: add discovery of new releases by style (the genuinely-new
  explore source).

## Impact

- **Code:** `backend/src/recommender/recommend.ts` (the bulk — lanes, adaptive
  quota, round-robin+cap fill, source tagging, backfill); `discogs/catalog.ts`
  (style search for source (c)); `shared/src/index.ts` (`CandidateSource` += 
  `explore`); `stats.ts` (count `explore` in per-source); `config.ts` (new
  constants). No schema change (the `source` column already exists; no CHECK).
- **More Discogs calls per run** (the explore lane, esp. source (c)), throttled —
  `recommend` gets somewhat slower; acceptable for a morning refill.
- **Out of scope / deferred:** MMR-style soft penalties (we use round-robin +
  hard cap); time-decay on scores; making the q-curve user-configurable beyond
  env constants.
