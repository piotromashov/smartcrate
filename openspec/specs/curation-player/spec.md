# curation-player Specification

## Purpose
TBD - created by archiving change techno-curation-engine. Update Purpose after archive.
## Requirements
### Requirement: Start the curation session

The system SHALL let the user start a curation session with a single Play action
that begins playback of the explore queue.

#### Scenario: Hit play with a non-empty queue

- **GIVEN** the explore queue contains resolved tracks
- **WHEN** the user clicks Play
- **THEN** the first track begins playing in the embedded YouTube player

#### Scenario: Hit play with an empty queue

- **GIVEN** the explore queue is empty
- **WHEN** the user clicks Play
- **THEN** the system indicates there is nothing to play
- **AND** it prompts to seed or refill the queue rather than failing

### Requirement: Embedded YouTube playback

The system SHALL play each track via an embedded YouTube player using the track's
resolved YouTube video identifier.

#### Scenario: Track plays embedded

- **GIVEN** a resolved track with a YouTube video identifier
- **WHEN** it becomes the current track
- **THEN** its YouTube video is loaded and played inside the app's embedded player

### Requirement: Playback controls

The system SHALL provide play/pause control over the current track.

#### Scenario: Pause and resume

- **GIVEN** a track is playing
- **WHEN** the user pauses and later resumes
- **THEN** playback stops at the paused position
- **AND** continues from that position on resume

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

### Requirement: Auto-advance on track end

The system SHALL automatically advance to the next track in the explore queue
when the current track finishes playing.

#### Scenario: Track finishes with more in queue

- **GIVEN** the current track is playing and the explore queue has further tracks
- **WHEN** the current track reaches its end
- **THEN** the next track in the explore queue begins playing automatically

#### Scenario: Queue exhausted

- **GIVEN** the current track is the last in the explore queue
- **WHEN** it reaches its end
- **THEN** playback stops
- **AND** the system indicates the queue is exhausted

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

