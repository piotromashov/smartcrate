## Context

The recommender (`backend/src/recommender/recommend.ts`) generates candidates by
discovering releases from the user's top-scored labels/artists via Discogs, then
scoring/filtering their tracks. Sibling tracks of a release the user already
engaged with are already persisted locally (the whole release is fetched when its
first track surfaces) but only re-enter the candidate pool if their release lands
in a fresh discovery window. In-force ADRs this must stay coherent with: 0001
(local-first, single-user), 0003 (Discogs as sole external API; minimize calls),
0004 (`node:sqlite` local store). This change reads only from that local store.

## Goals / Non-Goals

**Goals:**
- Reliably surface the unrated/unseen/resolved siblings of any positively-scored
  release as candidates, with no Discogs network cost.
- Reuse the existing scoring and filtering — no new weights, no new env vars.

**Non-Goals:**
- New VA-specific weight variables (the EP vs VA sibling asymmetry is already
  emergent — an EP sibling gets the artist term, a VA sibling only label+release).
- Per-release caps or score decay; time-decay on scores. Deferred.
- Any change to `rating-model` or the DB schema.

## Decisions

### D1 — Trigger: release entity score > 0
Surface siblings for releases where `entity_scores(kind='release') > 0`. Chosen
over "liked ≥ 1 track" or "any rating" because it reuses the maintained score and
degrades gracefully on mixed comps (liked 2, disliked 1 → still positive). It also
makes sentiment **emergent**: dislike (weight 1.5 > like 1.0) can tip a release to
`≤ 0` and stop surfacing; skip records no event and never changes the trigger.

### D2 — Local sourcing, unioned with discovery
Add a sibling source that queries tracks of positive-score releases directly from
SQLite (no `DiscogsClient` call), then unions the release-id set / candidate set
with the existing discovery path and lets the current dedupe-by-`trackId` and the
existing `candidateTracks` filters (rated / seen / unresolved / disliked
artist|label) apply unchanged. Concretely: gather positive-score release ids, add
them to the `releaseIds` list already passed to `candidateTracks`, so scoring,
filtering, ranking, and fill stay in one place.

### D3 — No volume cap (trust the ranking)
No per-release sibling cap or decay for v1. Ranking plus natural self-correction
(surfaced siblings get marked seen/rated and drop out across sessions) bound the
effect. Accepted, documented trade-off: a beloved comp can dominate one session.

## Risks / Trade-offs

- [One compilation floods a session's queue] → Mitigation: ranking + seen/rated
  drop-out; a per-release cap is a cheap follow-up if it actually bites.
- [Exploit crowds out explore — siblings of known-good releases outrank fresh
  discovery] → Accepted for now; revisit if discovery feels starved. The fill is
  still bounded by the queue target length, leaving room for both.
- [A positively-scored release with many unresolved tracks yields few usable
  siblings] → Fine; the unresolved filter already excludes them, no error path.
