## MODIFIED Requirements

### Requirement: Rate the current track

The system SHALL allow the user to like, dislike, or skip the current track, and
SHALL record like and dislike actions as rating events. A like SHALL keep the
current track playing; a dislike or skip SHALL advance to the next track.

#### Scenario: Like the current track

- **GIVEN** a track is the current track
- **WHEN** the user likes it
- **THEN** a like rating event is recorded for that track
- **AND** playback continues on the current track (it does not advance)

#### Scenario: Dislike the current track

- **GIVEN** a track is the current track
- **WHEN** the user dislikes it
- **THEN** a dislike rating event is recorded for that track
- **AND** playback advances to the next track

#### Scenario: Skip the current track

- **GIVEN** a track is the current track
- **WHEN** the user skips it
- **THEN** no like or dislike rating event is recorded
- **AND** playback advances to the next track

#### Scenario: Like is not duplicated

- **GIVEN** a track the user already liked and is still playing
- **WHEN** the user likes it again
- **THEN** no duplicate download is created for that track

## ADDED Requirements

### Requirement: Up-next preview

The system SHALL show the upcoming tracks in the explore queue with their
candidate scores, so the user can see what is coming.

#### Scenario: Upcoming tracks are shown with scores

- **GIVEN** the explore queue has tracks beyond the current one
- **WHEN** the user views the curation surface
- **THEN** the upcoming tracks are listed with their candidate scores and enough
  metadata to identify each (artist and title)

#### Scenario: Empty up-next

- **GIVEN** the explore queue has no tracks beyond the current one
- **WHEN** the user views the curation surface
- **THEN** the up-next list is shown as empty rather than erroring
