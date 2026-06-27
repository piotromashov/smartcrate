## MODIFIED Requirements

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
