## ADDED Requirements

### Requirement: Candidates are tagged with their source

When a candidate track is surfaced into the explore queue, the system SHALL record
the source that produced it — one of `discovery`, `sibling`, or `seed` — persisted
first-touch so it survives after the queue entry is removed on rating.

#### Scenario: Discovery candidate is tagged

- **GIVEN** a candidate produced from a top-scored label or artist
- **WHEN** it is surfaced into the explore queue
- **THEN** its recorded source is `discovery`

#### Scenario: Sibling candidate is tagged

- **GIVEN** a candidate that is a sibling track of a positively-scored release
- **WHEN** it is surfaced into the explore queue
- **THEN** its recorded source is `sibling`

#### Scenario: Seed candidate is tagged

- **GIVEN** the recommender ran via the seed fallback because there was no rating
  signal
- **WHEN** a candidate is surfaced
- **THEN** its recorded source is `seed`

#### Scenario: Source is first-touch and survives rating

- **GIVEN** a track that has been surfaced and tagged with a source
- **WHEN** the track is later rated and removed from the explore queue
- **THEN** its recorded source is retained
- **AND** it is not overwritten if the track is surfaced again
