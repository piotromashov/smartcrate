# recommendation-queue Specification

## Purpose
TBD - created by archiving change techno-curation-engine. Update Purpose after archive.
## Requirements
### Requirement: Candidate generation from positive signal

The system SHALL generate candidate tracks from Discogs based on the user's
positively-scored labels and artists, falling back to config-file seed entities
when there is no rating signal yet.

#### Scenario: Generate from top entities

- **GIVEN** the user has positively-scored labels or artists
- **WHEN** the recommender runs
- **THEN** candidate tracks are gathered from those labels' and artists' Discogs
  releases

#### Scenario: Cold start falls back to seeds

- **GIVEN** there is no positive rating signal yet
- **AND** the config file lists seed labels, artists, or tracks
- **WHEN** the recommender runs
- **THEN** candidates are generated from the seed entities

#### Scenario: Cold start with no seeds

- **GIVEN** there is no positive rating signal and no seed entities configured
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

The system SHALL produce an ordered explore queue ranked by candidate score and
SHALL attach a human-readable reason to each queued track explaining why it was
suggested.

#### Scenario: Queue ordered by score

- **GIVEN** a set of scored, eligible candidates
- **WHEN** the explore queue is filled
- **THEN** tracks are ordered from highest to lowest candidate score

#### Scenario: Reason attached

- **GIVEN** a candidate track being added to the explore queue
- **WHEN** it is queued
- **THEN** it carries a human-readable reason referencing the contributing label
  and/or artist

