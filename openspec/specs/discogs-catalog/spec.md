# discogs-catalog Specification

## Purpose
TBD - created by archiving change techno-curation-engine. Update Purpose after archive.
## Requirements
### Requirement: Authenticated Discogs access

The system SHALL access the Discogs API using a personal access token supplied
via environment variable, and SHALL NOT make catalog requests without it.

#### Scenario: Token present

- **GIVEN** a valid Discogs personal access token is configured in the environment
- **WHEN** the backend starts
- **THEN** Discogs requests are authenticated
- **AND** the catalog features are available

#### Scenario: Token missing

- **GIVEN** no Discogs token is configured in the environment
- **WHEN** the backend starts
- **THEN** the system reports a clear configuration error naming the required
  environment variable
- **AND** it does not attempt any unauthenticated catalog request

### Requirement: Rate-limit throttling

The system SHALL throttle outbound Discogs requests so they stay within the
authenticated rate limit (~60 requests/minute).

#### Scenario: Burst of requests is throttled

- **GIVEN** the Discogs client is configured with the authenticated rate limit
- **WHEN** more catalog requests are issued than the allowed rate
- **THEN** the system queues and paces them so the rate limit is not exceeded
- **AND** no request is dropped solely due to local pacing

### Requirement: Catalog response caching

The system SHALL cache Discogs responses locally and serve cached data for
repeated lookups of the same resource before making a new network request.

#### Scenario: Repeated lookup served from cache

- **GIVEN** a resource (artist, label, release, or track) was previously fetched
  and cached
- **WHEN** the same resource is requested again
- **THEN** the cached copy is returned
- **AND** no new Discogs network request is made

### Requirement: Metadata lookup for catalog entities

The system SHALL resolve Discogs metadata for artists, labels, releases (including
a Various Artists flag), and tracks.

#### Scenario: Resolve a release and its entities

- **GIVEN** a Discogs release identifier
- **WHEN** the release is looked up
- **THEN** the system returns the release's title, label(s), artist(s), and track
  list
- **AND** it indicates whether the release is a Various Artists compilation

### Requirement: Candidate discovery by label and artist

The system SHALL discover candidate releases and tracks from Discogs by a given
label or artist, for use by the recommender.

#### Scenario: Discover releases for a label

- **GIVEN** a label the user has positively scored
- **WHEN** candidate discovery is requested for that label
- **THEN** the system returns releases associated with that label from Discogs

#### Scenario: Discover releases for an artist

- **GIVEN** an artist the user has positively scored
- **WHEN** candidate discovery is requested for that artist
- **THEN** the system returns releases associated with that artist from Discogs

### Requirement: YouTube video resolution from release videos

The system SHALL resolve a track to a playable YouTube video identifier using the
`videos` array of its parent Discogs release, and SHALL mark a track as
unresolved when no YouTube video is available.

#### Scenario: Release has a YouTube video

- **GIVEN** a track whose parent release contains a YouTube link in its `videos`
  array
- **WHEN** the track is resolved for playback
- **THEN** the system stores a YouTube video identifier for that track

#### Scenario: No video available

- **GIVEN** a track whose parent release has no YouTube video
- **WHEN** the track is resolved for playback
- **THEN** the track is marked as unresolved
- **AND** it is excluded from playback

