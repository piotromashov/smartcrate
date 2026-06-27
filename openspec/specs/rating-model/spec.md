# rating-model Specification

## Purpose
TBD - created by archiving change techno-curation-engine. Update Purpose after archive.
## Requirements
### Requirement: Append-only rating events

The system SHALL store each like and dislike as an append-only rating event
capturing the track, the rating value, and a timestamp, and SHALL treat the event
log as the source of truth for scoring.

#### Scenario: Record a rating event

- **GIVEN** the user likes or dislikes a track
- **WHEN** the rating is submitted
- **THEN** a rating event with the track, value, and timestamp is appended
- **AND** existing rating events are not modified or removed

### Requirement: Derived entity scores

The system SHALL maintain a derived score for each entity — artist, label,
release (including Various Artists releases), and track — computed as a weighted
sum of like (positive) and dislike (negative) signals from rating events touching
that entity.

#### Scenario: Like increases related entity scores

- **GIVEN** a track with associated artist(s), label, and release
- **WHEN** the track is liked
- **THEN** the scores of the track and its artist(s), label, and release each
  increase by the configured like weight

#### Scenario: Dislike decreases related entity scores

- **GIVEN** a track with associated artist(s), label, and release
- **WHEN** the track is disliked
- **THEN** the scores of the track and its artist(s), label, and release each
  decrease by the configured dislike weight

#### Scenario: Various Artists release scoring

- **GIVEN** a track on a Various Artists release
- **WHEN** the track is rated
- **THEN** the release-level score reflects the rating
- **AND** the rating contributes to the track's own artist(s) independently of the
  compilation's other artists

### Requirement: Scores recomputable from events

The system SHALL be able to recompute all entity scores solely from the rating
event log, producing the same scores as the incrementally maintained values.

#### Scenario: Recompute from the event log

- **GIVEN** a rating event log and the incrementally maintained entity scores
- **WHEN** entity scores are recomputed from the full event log
- **THEN** the recomputed scores match the maintained scores

