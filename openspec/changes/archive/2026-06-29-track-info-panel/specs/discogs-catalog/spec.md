## ADDED Requirements

### Requirement: Fetch artist and label profile details

The system SHALL resolve an artist's or label's profile detail — its biography
text and its links — from Discogs, cache-aware, with the biography readable as
plain text (Discogs profile markup removed).

#### Scenario: Resolve an artist profile

- **WHEN** an artist's profile detail is requested
- **THEN** the system returns the artist's name, biography text, and links

#### Scenario: Resolve a label profile

- **WHEN** a label's profile detail is requested
- **THEN** the system returns the label's name, biography text, and links

#### Scenario: Cache-aware and markup-stripped

- **GIVEN** a profile previously fetched for an artist or label
- **WHEN** its detail is requested again
- **THEN** it is served from the cache without a new Discogs network request
- **AND** the biography text is returned without Discogs markup tags
