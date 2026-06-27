## ADDED Requirements

### Requirement: Surface siblings of positively-scored releases

The system SHALL include, as explore-queue candidates, the unrated, unseen, and
resolved sibling tracks of every release whose derived entity score is greater
than zero, sourced from the local store without any Discogs network request, and
merged and de-duplicated with the discovery candidates.

#### Scenario: Siblings of a liked release are surfaced

- **GIVEN** a release whose entity score is greater than zero (e.g. you liked one
  of its tracks)
- **AND** that release has other tracks that are resolved, unrated, and unseen
- **WHEN** the recommender fills the explore queue
- **THEN** those sibling tracks are included as candidates
- **AND** no Discogs network request is made to obtain them

#### Scenario: Dislike closes a release once its score is not positive

- **GIVEN** a release whose entity score has dropped to zero or below (e.g. a
  dislike outweighed a like)
- **WHEN** the recommender fills the explore queue
- **THEN** that release's sibling tracks are not surfaced as candidates

#### Scenario: Skipped tracks do not change surfacing

- **GIVEN** a release with a positive entity score
- **WHEN** one of its tracks is skipped
- **THEN** the release's entity score is unchanged
- **AND** its remaining siblings are still surfaced as candidates

#### Scenario: Surfaced siblings respect existing filters

- **GIVEN** a release with a positive entity score
- **WHEN** its siblings are surfaced as candidates
- **THEN** any sibling that is already rated, already seen, or unresolved is
  excluded
- **AND** a sibling whose artist or label is disliked is excluded

#### Scenario: Siblings merge and de-duplicate with discovery candidates

- **GIVEN** a sibling track that is also produced by top-label/artist discovery
  in the same run
- **WHEN** the explore queue is filled
- **THEN** the track appears at most once in the queue
