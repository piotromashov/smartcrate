## MODIFIED Requirements

### Requirement: Append-only rating events

The system SHALL store each like and dislike as an append-only rating event
capturing the track, the rating value, and a timestamp, and SHALL treat the event
log as the source of truth for scoring. Events SHALL NOT be modified, and SHALL NOT
be removed except by a single-level **undo** that deletes the user's most recent
rating; after such an undo, scores SHALL remain recomputable from the remaining
events.

#### Scenario: Record a rating event

- **GIVEN** the user likes or dislikes a track
- **WHEN** the rating is submitted
- **THEN** a rating event with the track, value, and timestamp is appended
- **AND** earlier rating events are not modified or removed

#### Scenario: Undo removes only the most recent rating

- **GIVEN** a sequence of rating events
- **WHEN** the user undoes their most recent rating
- **THEN** only that most recent event is removed
- **AND** the scores recomputed from the remaining events are correct
