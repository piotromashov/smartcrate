# 0002 — SQLite (better-sqlite3) as the local store

- Status: accepted
- Date: 2026-06-26

## Context

Per [ADR-0001](0001-local-first-single-user-architecture.md) smartcrate is a
single-user local app. It must persist entities (artist/label/release/track),
append-only rating events, derived entity scores, the explore and download
queues, and a Discogs response cache — durably across restarts, with no server to
operate.

## Decision

Use a single **SQLite** database file accessed via **better-sqlite3** as the sole
persistence layer. Rating events are append-only and are the source of truth;
entity scores are derived and fully recomputable from the event log.

## Consequences

- Good: zero-setup, file-based, trivially backed up; synchronous API suits a
  single-user app and avoids async connection-pool complexity.
- Good: one file holds all state including the Discogs cache.
- Bad: not suited to concurrent multi-user write loads; a future multi-user or
  hosted direction (which would already require superseding ADR-0001) would also
  revisit this store choice.
