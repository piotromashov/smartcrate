# download-queue Specification

## Purpose
TBD - created by archiving change techno-curation-engine. Update Purpose after archive.
## Requirements
### Requirement: Auto-queue liked tracks for download

The system SHALL automatically enqueue a track for local download when the user
likes it.

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

### Requirement: Local download processing via yt-dlp

The system SHALL process queued downloads with a background worker that invokes a
local `yt-dlp` binary on the track's resolved YouTube video, transcodes to MP3
320 kbps via `ffmpeg`, and stores the output file path on success. The output
file SHALL be named from the track's Discogs metadata as `Artist - Title`
(multiple artists joined), sanitized for the filesystem, with collisions against a
different track disambiguated.

#### Scenario: Successful download

- **GIVEN** a queued download item for a resolved track
- **AND** `yt-dlp` and `ffmpeg` are available locally
- **WHEN** the worker processes the item
- **THEN** the item transitions queued → downloading → done
- **AND** the local file path of the MP3 320 kbps audio is stored on the item

#### Scenario: File is named from artist and title

- **GIVEN** a track with a Discogs title and one or more artists
- **WHEN** the worker downloads it
- **THEN** the output file is named `Artist - Title.mp3` from that metadata
- **AND** filesystem-illegal characters are removed or replaced

#### Scenario: Colliding names are disambiguated

- **GIVEN** two different tracks whose sanitized `Artist - Title` is identical
- **WHEN** both are downloaded
- **THEN** the second file is given a distinct name rather than overwriting the first

### Requirement: Download status tracking and failure isolation

The system SHALL track each download item's status (queued, downloading, done,
failed) and SHALL record failures without crashing the application.

#### Scenario: yt-dlp or ffmpeg missing or failing

- **GIVEN** a queued download item
- **WHEN** the worker cannot run `yt-dlp`/`ffmpeg` or the download fails
- **THEN** the item transitions to failed with an error reason recorded
- **AND** the application continues running and processing other items

#### Scenario: Status is observable

- **GIVEN** a download item whose status changes
- **WHEN** its status is queried
- **THEN** the current status is returned so the user can see download progress

