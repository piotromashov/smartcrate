## Context

The recommender (`backend/src/recommender/recommend.ts`) builds a candidate pool
then fills the queue with a **greedy score-sort**, and only consults seeds in a
cold-start branch. Result (confirmed live): the single highest-scored entity owns
the queue and seeds are abandoned once any signal exists. This change makes the
recommender explore/exploit with a diversity-aware fill. In-force ADRs (0001
local-first, 0003 Discogs sole catalog, 0004 node:sqlite, 0005 derive-metrics) are
unaffected; the new architecture is recorded as ADR-0006.

## Goals / Non-Goals

**Goals:** break the monoculture (no artist/label dominates); keep producing
novelty (seeds + never-rated + genuinely-new) even after signal exists; explore
harder when the model is thin.

**Non-Goals:** MMR/soft-penalty re-ranking (we use round-robin + a hard cap);
time-decay on scores; a user-facing config UI (env constants only); changing
`rating-model` or the schema (`source` column already exists, no CHECK).

## Decisions

### D1 — Two lanes + adaptive quota
`need = targetLength − currentQueueLength`. Split into
`exploreSlots = round(q · need)` and `exploitSlots = need − exploreSlots`. `q` is
adaptive on signal strength `P` = count of distinct positively-scored
artists+labels:
`q = clamp(Q_MIN, Q_MAX, Q_MAX − (Q_MAX−Q_MIN)·min(1, P / P_FULL))`.
Defaults: `Q_MIN=0.15`, `Q_MAX=0.40`, `P_FULL=12` (explore ≈40% when P=0, floors
at ≈15% once P≥12). All env-overridable.

### D2 — Diversity-aware fill (round-robin by artist + per-label cap)
Given scored candidates for a lane: bucket by the track's primary artist, order
each bucket by score desc, order buckets by their top score. Iterate rounds — in
each round take the next track from each artist bucket (bucket-priority order),
**skipping** a track whose label has already hit the label cap; stop at the lane's
slot target or when buckets are exhausted. `labelCap = ceil(LABEL_CAP_FRAC ·
slots)`, `LABEL_CAP_FRAC=0.4`. This gives artist diversity (round-robin) and label
diversity (cap) while still preferring higher scores (bucket + within-bucket
ordering). It also caps the sibling flood for free.

### D3 — Explore-lane sources (a + b + c)
- **(a) seeds** — `resolveSeeds` (existing) → discover release ids → `getRelease`.
- **(b) never-rated local** — artists/labels in the catalog with no positive score;
  pull their already-fetched releases' tracks from the local DB ($0).
- **(c) genuinely-new** — `discoverNewReleasesByStyle(client, EXPLORE_STYLE)`
  (Discogs `style` search, default `Techno`), filter to releases whose label/artist
  are not already in the catalog, fetch up to `NEW_RELEASE_BUDGET` (default 8),
  cache-aware. The priciest source.
Explore candidates run through the same filters (resolved / unrated / unseen /
not-disliked) and the same round-robin+cap fill.

### D4 — Source taxonomy
Exploit candidates tag `discovery` (top-entity) or `sibling`; **all** explore-lane
candidates tag `explore`. `CandidateSource` gains `explore`; `seed` is kept as a
legacy value (existing rows). Stats per-source counts `explore`, making "does
exploration earn keepers?" measurable.

### D5 — Backfill & seeding-required
Fill each lane to its slot target independently; if a lane underfills, the other
backfills the remainder so the queue is always full. `seedingRequired` now means:
no positive entities **and** the explore lane produced nothing (no seeds, no
never-rated, no new) — not merely "no ratings".

### D6 — Tunables
`Q_MIN, Q_MAX, P_FULL, LABEL_CAP_FRAC, NEW_RELEASE_BUDGET, EXPLORE_STYLE` as
env-overridable constants in `config.ts`, consistent with the existing weights.

## Risks / Trade-offs

- [Source (c) is noisy — irrelevant results, frequent YouTube-resolution misses,
  may underfill] → bounded fetch + cache + lane backfill keep the queue full; (c)
  is the clearly-separable slice (ship a+b+diversity first if it gets fiddly).
- [More Discogs calls per run, throttled → slower `recommend`] → acceptable for a
  morning refill; cache amortizes; (c) budget bounds it.
- [Explore candidates are mostly score 0 → arbitrary order within] → fine; the
  point is novelty, and round-robin already spreads them by artist.
- [Round-robin "primary artist" for multi-artist tracks] → use the first artist as
  the bucket key; acceptable approximation.
