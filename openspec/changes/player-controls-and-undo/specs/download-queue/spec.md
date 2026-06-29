## MODIFIED Requirements

### Requirement: Auto-queue liked tracks for download

The system SHALL automatically enqueue a track for local download when the user
likes it, and SHALL cancel that download if the like is undone before it completes.

#### Scenario: Like enqueues a download

- **GIVEN** a track with no active download item
- **WHEN** the user likes it
- **THEN** a download item for that track is added to the download queue with
  status queued

#### Scenario: No duplicate download item

- **GIVEN** a track that already has a download item that is queued, downloading,
  or done
- **WHEN** the user likes it again
- **THEN** no duplicate download item is created

#### Scenario: Undoing a like cancels its pending download

- **GIVEN** a liked track whose download is queued or downloading (not yet done)
- **WHEN** the user undoes the like
- **THEN** that download item is removed
- **AND** an already-completed download is left untouched
