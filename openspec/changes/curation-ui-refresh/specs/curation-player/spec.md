## MODIFIED Requirements

### Requirement: Up-next preview

The system SHALL show the upcoming tracks in the explore queue with their
candidate scores, so the user can see what is coming. Consecutive upcoming tracks
by the same artist SHALL be grouped under a single artist heading, and a candidate
score of zero SHALL be shown as a neutral placeholder rather than a highlighted
value.

#### Scenario: Upcoming tracks are shown with scores

- **GIVEN** the explore queue has tracks beyond the current one
- **WHEN** the user views the curation surface
- **THEN** the upcoming tracks are listed with their candidate scores and enough
  metadata to identify each (artist and title)

#### Scenario: Consecutive same-artist tracks are grouped

- **GIVEN** several consecutive upcoming tracks by the same artist
- **WHEN** the up-next list is shown
- **THEN** the artist is shown once as a heading for that run
- **AND** the run's track titles are listed beneath it (each with its score)

#### Scenario: Zero score is shown as a neutral placeholder

- **GIVEN** an upcoming track whose candidate score is zero (e.g. cold-start)
- **WHEN** it is shown in the up-next list
- **THEN** its score is rendered as a neutral placeholder (`—`)
- **AND** it is not rendered as a highlighted/accented zero

#### Scenario: Empty up-next

- **GIVEN** the explore queue has no tracks beyond the current one
- **WHEN** the user views the curation surface
- **THEN** the up-next list is shown as empty rather than erroring
