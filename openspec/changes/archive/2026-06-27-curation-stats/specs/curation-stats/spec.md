## ADDED Requirements

### Requirement: Read-only metrics derived from the event log

The system SHALL expose a read-only metrics endpoint that computes all values by
aggregating the existing event log and current state on read, and SHALL NOT store
metric snapshots or maintain a separate time-series.

#### Scenario: Metrics are computed on read

- **GIVEN** a history of rating, download, and surfacing events
- **WHEN** the metrics endpoint is requested
- **THEN** the returned values are computed by aggregating that history at request
  time
- **AND** no metric snapshot is written

#### Scenario: History is windowed without snapshots

- **GIVEN** events spanning multiple days
- **WHEN** the endpoint is requested with a day bucket
- **THEN** values are returned bucketed per day from the event log
- **AND** days with no events simply have no bucket (no fabricated zero rows)

### Requirement: Like-rate trend

The system SHALL report the like-rate (`likes ÷ (likes + dislikes)`) as a
per-bucket series and a rolling overall value, so the trend over time is visible.

#### Scenario: Like-rate trend is reported

- **GIVEN** like and dislike events across several days
- **WHEN** the metrics endpoint is requested
- **THEN** a per-day like-rate series and an overall rolling like-rate are returned

#### Scenario: No ratings yet

- **GIVEN** no like or dislike events
- **WHEN** the metrics endpoint is requested
- **THEN** the like-rate is reported as not-applicable rather than dividing by zero

### Requirement: Per-source contribution

The system SHALL report, by candidate source (`discovery`, `sibling`, `seed`), the
share of likes and the like-rate, and SHALL present these as a descriptive
contribution view, not as proof of causal lift.

#### Scenario: Likes are attributed by source

- **GIVEN** rated tracks whose first-touch source is recorded
- **WHEN** the metrics endpoint is requested
- **THEN** the like share and like-rate are broken down by source

#### Scenario: Contribution is not presented as causal lift

- **WHEN** per-source numbers are shown on the dashboard
- **THEN** they are labelled as contribution/mix, with a note that sources are not
  randomly assigned (e.g. siblings come from already-liked releases)

### Requirement: Output and catalog metrics

The system SHALL report curation output counters (tracks rated, liked, and
downloaded by status) and the unresolved-rate (share of fetched tracks with no
resolved YouTube video).

#### Scenario: Output counters

- **WHEN** the metrics endpoint is requested
- **THEN** counts of rated, liked, and downloaded (done/failed) tracks are returned
  for today and overall

#### Scenario: Unresolved-rate

- **GIVEN** fetched tracks, some without a resolved YouTube video
- **WHEN** the metrics endpoint is requested
- **THEN** the unresolved-rate is returned as the fraction of tracks marked unresolved

### Requirement: Taste leaderboard

The system SHALL report the top-scoring labels and artists by current entity score.

#### Scenario: Top entities

- **GIVEN** accumulated entity scores
- **WHEN** the metrics endpoint is requested
- **THEN** the highest-scoring labels and artists are returned with their scores

### Requirement: Live stats dashboard

The system SHALL present the metrics in a dashboard that reflects current values
without a manual reload, refreshing on load and after each rating action.

#### Scenario: Dashboard updates after curating

- **GIVEN** the dashboard is open
- **WHEN** the user likes, dislikes, or skips a track
- **THEN** the displayed metrics refresh to reflect the new event
