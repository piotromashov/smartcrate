// Ordered DDL migrations. The runner applies any not yet reflected in
// `PRAGMA user_version`, so appending a migration is the way to evolve the schema.
export const MIGRATIONS: string[] = [
  // v1 — initial schema
  `
  CREATE TABLE artists (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE labels (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE releases (
    id    INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    is_va INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE tracks (
    id               TEXT PRIMARY KEY,
    release_id       INTEGER NOT NULL REFERENCES releases(id),
    title            TEXT NOT NULL,
    position         TEXT NOT NULL DEFAULT '',
    youtube_video_id TEXT,
    unresolved       INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE release_labels (
    release_id INTEGER NOT NULL REFERENCES releases(id),
    label_id   INTEGER NOT NULL REFERENCES labels(id),
    PRIMARY KEY (release_id, label_id)
  );

  CREATE TABLE release_artists (
    release_id INTEGER NOT NULL REFERENCES releases(id),
    artist_id  INTEGER NOT NULL REFERENCES artists(id),
    PRIMARY KEY (release_id, artist_id)
  );

  CREATE TABLE track_artists (
    track_id  TEXT NOT NULL REFERENCES tracks(id),
    artist_id INTEGER NOT NULL REFERENCES artists(id),
    PRIMARY KEY (track_id, artist_id)
  );

  -- Append-only rating event log (source of truth for scoring).
  CREATE TABLE rating_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id   TEXT NOT NULL REFERENCES tracks(id),
    value      TEXT NOT NULL CHECK (value IN ('like','dislike')),
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_rating_events_track ON rating_events(track_id);

  -- Derived entity scores (recomputable from rating_events).
  CREATE TABLE entity_scores (
    kind      TEXT NOT NULL CHECK (kind IN ('artist','label','release','track')),
    entity_id TEXT NOT NULL,
    score     REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (kind, entity_id)
  );

  -- Ordered explore queue (only resolved tracks).
  CREATE TABLE explore_queue (
    track_id TEXT PRIMARY KEY REFERENCES tracks(id),
    score    REAL NOT NULL,
    reason   TEXT NOT NULL,
    position INTEGER NOT NULL
  );
  CREATE INDEX idx_explore_queue_position ON explore_queue(position);

  -- Tracks that have ever entered the queue (for de-duplication).
  CREATE TABLE seen_tracks (
    track_id TEXT PRIMARY KEY REFERENCES tracks(id),
    seen_at  TEXT NOT NULL
  );

  -- Download queue processed by the yt-dlp worker.
  CREATE TABLE download_queue (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id   TEXT NOT NULL REFERENCES tracks(id),
    status     TEXT NOT NULL CHECK (status IN ('queued','downloading','done','failed')),
    file_path  TEXT,
    error      TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX idx_download_queue_status ON download_queue(status);
  CREATE INDEX idx_download_queue_track ON download_queue(track_id);

  -- Cache of Discogs API responses, keyed by resource.
  CREATE TABLE discogs_cache (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  );
  `,
];
