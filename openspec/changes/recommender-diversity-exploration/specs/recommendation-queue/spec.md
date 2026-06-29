## MODIFIED Requirements

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

## ADDED Requirements

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
