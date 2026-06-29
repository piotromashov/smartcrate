## Context

A frontend-only aesthetic pass on the curation surface after reviewing the live
render. No behavior changes beyond two observable up-next display rules; in-force
ADRs (local-first, Discogs, node:sqlite, derive-metrics) are untouched and no new
ADR is needed.

## Goals / Non-Goals

**Goals:** make the UI read as *designed* — frame the player, give cards depth,
restrain the accent, group the up-next list, add type hierarchy, and clean up
cold-start copy.

**Non-Goals:** playback progress/equalizer, an SVG icon set, a real SVG sparkline,
background grain (deferred); a light theme / toggle; any backend/API/schema change.

## Decisions

### D1 — Player: narrow-and-center
Constrain the embedded player to ~360px max-width, centered in the card, rounded
with a subtle 1px inner border. The audio tracks' pillar-boxed square art then sits
in symmetric margins that read as a deliberate frame, not a void. Chosen over
crop-to-fill (CSS scale/overflow) which can clip the art and is fragile across
aspect ratios.

### D2 — Material elevation
Lift surfaces: panel `~#17171b`, border `~#2a2a30`, a soft drop shadow
(`0 6px 20px rgba(0,0,0,.45)`). The now-playing card is the hero — marginally more
emphasis (e.g. slightly larger padding / a faint accent top hairline). Centralize
the palette + a couple of surface styles in one constants block so it's consistent.

### D3 — Accent discipline + zero scores
Acid green (`#9fef00`) is reserved for "alive/positive": the Like action, a live
now-playing indicator, and scores `> 0`. A score of `0` renders as a muted `—`
(neutral), not a green `0.0`. Non-top scores use a neutral tone; green stops being
visual noise.

### D4 — Up-next grouping
Walk the up-next list and group **consecutive** items sharing the same artist
string into runs: render the artist once as a small heading, then each title with
its score (`—` when zero) beneath. Non-consecutive repeats start a new group (we
don't reorder). Pure view-layer transform of the existing `upNext` payload.

### D5 — Typography
Two families: monospace for track titles, scores, and tabular numbers (keeps the
techno/tracklist feel); a clean sans (`system-ui, "Inter", sans-serif`) for
labels, body, captions, and stats prose. Now-playing title ~30px/700 with more
vertical room so hierarchy is unambiguous.

### D6 — Cold-start reason
When the current track's reason is the placeholder (`seed/exploration`), hide the
reason line entirely; show real reasons (`label: …; artist: …`) when present.

## Risks / Trade-offs

- [Narrow player feels small on wide screens] → acceptable; the art is the point,
  and it keeps the page focused. Width is a one-line constant to tune later.
- [Consecutive-only grouping leaves a repeat if the same artist returns later in
  the queue] → intended (we don't reorder); in practice runs are consecutive.
- [Sans/mono split could look inconsistent if misapplied] → keep the rule simple
  (titles/numbers = mono, everything else = sans) and centralize it.
