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

### Requirement: Share the current track at the current moment

The system SHALL let the user copy a shareable YouTube link to the current track at
its current playback position.

#### Scenario: Copy a timestamped link

- **GIVEN** a track is playing at some position
- **WHEN** the user activates Share
- **THEN** a YouTube link to that track including the current timestamp is copied to
  the clipboard
- **AND** a brief confirmation is shown

### Requirement: Visible feedback on control actions

The system SHALL give visible feedback when a control (play/pause, like, dislike,
next, back) is activated, so the user can see the action registered.

#### Scenario: A rating action flashes

- **WHEN** the user likes or dislikes the current track
- **THEN** the corresponding control briefly shows a visible confirmation state

#### Scenario: Play/pause reflects state

- **WHEN** playback is paused or resumed
- **THEN** the play/pause control reflects the current state

### Requirement: Back and Next transport

The system SHALL provide Back and Next transport controls that navigate the
recently-played tracks without recording any rating. Back SHALL replay the
previously-shown track; Next SHALL move forward to the next track (forward through
recently-played history, then from the explore queue).

#### Scenario: Back replays the previous track

- **GIVEN** the user has already heard one or more tracks this session
- **WHEN** the user activates Back
- **THEN** the previously-shown track plays again
- **AND** no rating event is recorded

#### Scenario: Next after Back returns forward

- **GIVEN** the user went Back to an earlier track
- **WHEN** the user activates Next
- **THEN** playback moves forward again (toward where they were, then the queue)

### Requirement: Undo the last like or dislike

The system SHALL let the user undo their most recent like or dislike. Undo SHALL
remove that rating and recompute scores; undoing a like SHALL also cancel its
pending download; undoing a dislike SHALL re-surface the track so it plays again.
Undo SHALL apply only to like/dislike, not to skip or back.

#### Scenario: Undo a like

- **GIVEN** the user just liked the current track
- **WHEN** they undo
- **THEN** the like is removed and scores are recomputed
- **AND** the track's pending download is cancelled

#### Scenario: Undo a dislike

- **GIVEN** the user just disliked a track and advanced
- **WHEN** they undo
- **THEN** the dislike is removed and scores are recomputed
- **AND** the track is re-surfaced as the current track

