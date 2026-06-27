## 1. Project scaffolding & stack setup

- [ ] 1.1 Initialize a TypeScript monorepo layout (`backend/`, `frontend/`, `shared/`) with root tooling (package manager workspaces, tsconfig base)
- [ ] 1.2 Add backend deps: Fastify, better-sqlite3, a Discogs HTTP client (or fetch wrapper), dotenv; set up `tsconfig`, build, and dev scripts
- [ ] 1.3 Add frontend deps: Vite + React + TypeScript; scaffold app shell
- [ ] 1.4 Create `shared/` package for TS types reused by backend and frontend
- [ ] 1.5 Update `.gitignore` to cover `.env`, the SQLite DB file, and the downloads directory
- [ ] 1.6 Document env vars by NAME only (`DISCOGS_TOKEN`, `SMARTCRATE_DOWNLOAD_DIR`, etc.) in a `.env.example`
- [ ] 1.7a Add a seed config file (labels/artists/tracks) with an example, loaded by the backend on startup
- [ ] 1.7 Fill in `agents/AGENTS.md` "What/Stack" and Build/run/test sections; record the stack decision and env-var names in `agents/MEMORY.md`

## 2. Persistence layer (SQLite)

- [ ] 2.1 Define the schema/migrations: entities (artist, label, release w/ `is_va`, track), rating events, derived entity scores, explore-queue items, download-queue items, Discogs response cache
- [ ] 2.2 Implement a SQLite access module (connection, migration runner, typed query helpers) via better-sqlite3
- [ ] 2.3 Add repository functions for upserting entities and recording/reading rating events

## 3. Discogs catalog integration (`discogs-catalog`)

- [ ] 3.1 Implement the authenticated Discogs client; fail fast with a clear error when the token env var is missing
- [ ] 3.2 Add a request throttle (queue/pacer) keeping calls within ~60/min
- [ ] 3.3 Add a SQLite-backed response cache; serve cached resources before hitting the network
- [ ] 3.4 Implement metadata lookup for artists, labels, releases (with VA flag), and tracks
- [ ] 3.5 Implement candidate discovery by label and by artist
- [ ] 3.6 Implement YouTube video resolution from a release's `videos` array; mark tracks with no video as `unresolved`

## 4. Rating model (`rating-model`)

- [ ] 4.1 Implement append-only rating-event recording (track, value, timestamp)
- [ ] 4.2 Implement incremental entity-score updates on like/dislike (artist, label, release/VA, track) with configurable like/dislike weights
- [ ] 4.3 Implement full recompute-from-events and verify it matches maintained scores

## 5. Recommender & explore queue (`recommendation-queue`)

- [ ] 5.1 Implement candidate generation from top positively-scored labels/artists (cache-first), with config-file seed fallback (labels/artists/tracks) and an explicit "seeding required" signal when neither exists
- [ ] 5.2 Implement candidate scoring (weighted artist + label + release scores)
- [ ] 5.3 Implement filtering/dedupe: drop disliked artist/label, already-rated, already-seen, and unresolved tracks
- [ ] 5.4 Rank by score and attach a human-readable "why" reason; fill the explore queue to the target length

## 6. Download queue (`download-queue`)

- [ ] 6.1 Auto-enqueue a download item when a track is liked; prevent duplicate items for the same track
- [ ] 6.2 Implement the background worker invoking local `yt-dlp` on the resolved video (MP3 320 kbps via `-x --audio-format mp3 --audio-quality 0`, requires `ffmpeg`); transition queued → downloading → done and store the file path
- [ ] 6.3 Isolate failures: missing/failing `yt-dlp` or `ffmpeg` marks the item `failed` with an error reason and does not crash the server
- [ ] 6.4 Expose download status for observability

## 7. Backend HTTP API

- [ ] 7.1 Endpoints to fetch the current explore queue / current track
- [ ] 7.2 Endpoints to record like / dislike / skip on a track
- [ ] 7.3 Endpoint to trigger/refresh recommendation generation
- [ ] 7.4 Endpoints to read download-queue status and (optionally) seed entities

## 8. Frontend curation player (`curation-player`)

- [ ] 8.1 Integrate the YouTube IFrame Player API and an embedded player component
- [ ] 8.2 Implement Play to start the session; handle empty-queue state with a seed/refill prompt
- [ ] 8.3 Implement play/pause and like / dislike / skip controls wired to the API
- [ ] 8.4 Implement auto-advance on track end and the queue-exhausted state
- [ ] 8.5 Show current track metadata, its "why" reason, and basic download-queue status

## 9. End-to-end verification

- [ ] 9.1 Seed a few liked labels/artists and confirm the recommender fills the explore queue with resolved tracks and reasons
- [ ] 9.2 Run the full loop: Play → playback → like/dislike/skip → scores update → queue refills → liked track downloads locally via `yt-dlp`
- [ ] 9.3 Verify failure paths: missing Discogs token, unresolved tracks skipped, `yt-dlp` missing → item `failed`, app stays up
- [ ] 9.4 Run `openspec validate techno-curation-engine --type change --strict` (specs changed) and update `agents/MEMORY.md` with any gotchas discovered
