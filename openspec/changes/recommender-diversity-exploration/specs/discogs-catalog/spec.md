## ADDED Requirements

### Requirement: Discover new releases by style

The system SHALL discover candidate releases from Discogs by musical style (e.g.
techno), so the recommender's explore lane can surface labels and artists not yet
in the user's catalog. Results SHALL be filterable to entities the user has not
already encountered, and the number fetched SHALL be bounded.

#### Scenario: Discover techno releases by style

- **WHEN** new-release discovery is requested for a style
- **THEN** the system returns releases of that style from Discogs

#### Scenario: Bounded and cache-aware

- **WHEN** new-release discovery runs
- **THEN** it fetches at most a bounded number of releases
- **AND** repeated discovery of the same query is served from the response cache
