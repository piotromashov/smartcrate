## ADDED Requirements

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
