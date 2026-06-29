## ADDED Requirements

### Requirement: Track info panel

The system SHALL provide an info panel for the current track, shown on demand, that
presents the track's release tracklist with the current track highlighted, and the
biography and links for the track's artist(s) and label.

#### Scenario: Open the info panel

- **GIVEN** a track is playing
- **WHEN** the user opens the info panel
- **THEN** the panel shows the release's tracklist with the current track highlighted
- **AND** it shows the artist(s) and label with their biography and links

#### Scenario: Missing details degrade gracefully

- **GIVEN** an artist or label has no biography or links available
- **WHEN** the info panel is shown
- **THEN** that section is shown without its missing parts rather than erroring
