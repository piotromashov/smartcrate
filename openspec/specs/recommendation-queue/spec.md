# recommendation-queue Specification

## Purpose
TBD - created by archiving change techno-curation-engine. Update Purpose after archive.
## Requirements
### Requirement: Candidate generation from positive signal

The system SHALL generate candidates in two lanes — an **exploit** lane drawn from
the user's positively-scored labels and artists (and their release siblings), and
an **explore** lane drawn from novelty: the config seeds, never-rated entities
already in the local catalog, and genuinely-new releases discovered from Discogs.
The explore lane SHALL be available regardless of how much signal exists, so the
user keeps discovering even after they have ratings.

#### Scenario: Exploit lane from top entities

- **GIVEN** the user has positively-scored labels or artists
- **WHEN** the recommender runs
- **THEN** exploit-lane candidates are gathered from those labels' and artists'
  Discogs releases and their siblings

#### Scenario: Explore lane keeps producing novelty after signal exists

- **GIVEN** the user already has positively-scored entities
- **WHEN** the recommender runs
- **THEN** explore-lane candidates are still produced from seeds, never-rated
  catalog entities, and genuinely-new releases
- **AND** they are not crowded out solely because the exploit entities score higher

#### Scenario: No signal yet

- **GIVEN** there is no positive rating signal
- **WHEN** the recommender runs
- **THEN** the queue is filled entirely from the explore lane (seeds + novelty)

#### Scenario: Nothing to explore or exploit

- **GIVEN** there is no positive signal, no seeds, and no novelty available
- **WHEN** the recommender runs
- **THEN** the system reports that seeding is required
- **BUT** it does not silently produce an empty result

### Requirement: Candidate scoring

The system SHALL score each candidate track as a weighted combination of its
artist, label, and release entity scores.

#### Scenario: Score a candidate

- **GIVEN** a candidate track with associated artist, label, and release scores
- **WHEN** the candidate is evaluated
- **THEN** its score is computed from the weighted artist, label, and release
  scores

### Requirement: Filtering and de-duplication

The system SHALL exclude from the explore queue any candidate that the user has
already rated, that has already been seen, or whose artist or label is disliked,
and SHALL only include tracks resolved to a playable YouTube video.

#### Scenario: Exclude disliked entity

- **GIVEN** a candidate whose artist or label has a disliked score
- **WHEN** the explore queue is filled
- **THEN** the candidate is excluded from the queue

#### Scenario: Exclude already-rated or already-seen track

- **GIVEN** a candidate track that has already been rated or already appeared in
  the queue
- **WHEN** the explore queue is filled
- **THEN** the track is not added to the queue again

#### Scenario: Exclude unresolved track

- **GIVEN** a candidate track with no resolved YouTube video
- **WHEN** the explore queue is filled
- **THEN** the track is excluded from the queue

### Requirement: Ranked explore queue with reasons

The system SHALL fill the explore queue with a **diversity-aware** selection rather
than a pure score-sort: candidates SHALL be chosen **round-robin by artist** so no
one artist dominates, subject to a **per-label cap** so no one label dominates via
its roster; within those constraints higher-scored candidates are preferred. Each
queued track SHALL carry a human-readable reason.

#### Scenario: No single artist dominates the queue

- **GIVEN** one artist has far more (and higher-scored) eligible candidates than others
- **WHEN** the explore queue is filled
- **THEN** that artist's tracks are interleaved with other artists' rather than
  filling the queue
- **AND** higher-scored candidates are still preferred within the round-robin

#### Scenario: Per-label cap

- **GIVEN** one label hosts many of the eligible candidates (across its artists)
- **WHEN** the explore queue is filled
- **THEN** that label contributes no more than the configured cap of the queue

#### Scenario: Reason attached

- **GIVEN** a candidate track being added to the explore queue
- **WHEN** it is queued
- **THEN** it carries a human-readable reason referencing the contributing label
  and/or artist

### Requirement: Surface siblings of positively-scored releases

The system SHALL include, as explore-queue candidates, the unrated, unseen, and
resolved sibling tracks of every release whose derived entity score is greater
than zero, sourced from the local store without any Discogs network request, and
merged and de-duplicated with the discovery candidates.

#### Scenario: Siblings of a liked release are surfaced

- **GIVEN** a release whose entity score is greater than zero (e.g. you liked one
  of its tracks)
- **AND** that release has other tracks that are resolved, unrated, and unseen
- **WHEN** the recommender fills the explore queue
- **THEN** those sibling tracks are included as candidates
- **AND** no Discogs network request is made to obtain them

#### Scenario: Dislike closes a release once its score is not positive

- **GIVEN** a release whose entity score has dropped to zero or below (e.g. a
  dislike outweighed a like)
- **WHEN** the recommender fills the explore queue
- **THEN** that release's sibling tracks are not surfaced as candidates

#### Scenario: Skipped tracks do not change surfacing

- **GIVEN** a release with a positive entity score
- **WHEN** one of its tracks is skipped
- **THEN** the release's entity score is unchanged
- **AND** its remaining siblings are still surfaced as candidates

#### Scenario: Surfaced siblings respect existing filters

- **GIVEN** a release with a positive entity score
- **WHEN** its siblings are surfaced as candidates
- **THEN** any sibling that is already rated, already seen, or unresolved is
  excluded
- **AND** a sibling whose artist or label is disliked is excluded

#### Scenario: Siblings merge and de-duplicate with discovery candidates

- **GIVEN** a sibling track that is also produced by top-label/artist discovery
  in the same run
- **WHEN** the explore queue is filled
- **THEN** the track appears at most once in the queue

### Requirement: Candidates are tagged with their source

When a candidate track is surfaced into the explore queue, the system SHALL record
the source that produced it — one of `discovery`, `sibling`, or `explore` —
persisted first-touch so it survives after the queue entry is removed on rating.
(The legacy `seed` value may remain on tracks surfaced before this change.)

#### Scenario: Discovery candidate is tagged

- **GIVEN** an exploit-lane candidate produced from a top-scored label or artist
- **WHEN** it is surfaced into the explore queue
- **THEN** its recorded source is `discovery`

#### Scenario: Sibling candidate is tagged

- **GIVEN** an exploit-lane candidate that is a sibling track of a positively-scored release
- **WHEN** it is surfaced into the explore queue
- **THEN** its recorded source is `sibling`

#### Scenario: Explore candidate is tagged

- **GIVEN** an explore-lane candidate (seed, never-rated, or genuinely-new)
- **WHEN** it is surfaced into the explore queue
- **THEN** its recorded source is `explore`

#### Scenario: Source is first-touch and survives rating

- **GIVEN** a track that has been surfaced and tagged with a source
- **WHEN** the track is later rated and removed from the explore queue
- **THEN** its recorded source is retained
- **AND** it is not overwritten if the track is surfaced again

### Requirement: Adaptive exploration quota

The system SHALL reserve a fraction of the explore queue for the explore lane, and
that fraction SHALL be **adaptive** — larger when the user's taste model is thin
(few positively-scored entities) and smaller as it gains signal. If one lane cannot
fill its allotted slots, the other lane SHALL backfill so the queue stays full.

#### Scenario: More exploration when the model is thin

- **GIVEN** the user has few positively-scored entities
- **WHEN** the recommender fills the queue
- **THEN** a larger share of the queue comes from the explore lane

#### Scenario: Less exploration as signal grows

- **GIVEN** the user has many positively-scored entities
- **WHEN** the recommender fills the queue
- **THEN** a smaller share of the queue comes from the explore lane

#### Scenario: A lane shortfall is backfilled

- **GIVEN** the explore lane cannot produce enough candidates for its share
- **WHEN** the recommender fills the queue
- **THEN** the exploit lane backfills the remaining slots so the queue is full

