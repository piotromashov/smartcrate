## Why

Discovering and curating new techno is a manual, scattered chore: searching
YouTube, remembering which labels and artists are worth following, and saving
tracks for later all happen in separate places with no memory between sessions.
We want a single local-first tool where, at the start of the day, the user hits
**Play** and curates a stream of candidate tracks — and the act of liking and
disliking *teaches the system* which artists, labels, and Various Artists (VA)
compilations to surface next, while quietly queueing the keepers for local
download. The more you curate, the better the explore queue gets.

## What Changes

- Introduce **smartcrate v1**: a local-first web app (browser frontend + small
  local backend service) for personal techno curation, built around **Discogs**
  as the single source of catalog metadata and candidate discovery.
- A **morning curation loop**: hit Play, an explore queue of candidate tracks
  plays via embedded YouTube; per track the user can **like / dislike / skip**;
  playback auto-advances on track end.
- **Like/dislike signal** accumulates onto a track's entities — artist(s),
  label, release (with a VA flag), and the track itself — producing derived
  **entity scores**.
- A **simple weighted recommender** generates candidate tracks from Discogs
  (releases on liked labels, by liked artists, related VA compilations), scores
  and ranks them by accumulated entity scores, drops disliked entities, dedupes
  already-seen tracks, and fills the **explore queue** — each candidate carrying
  a human-readable "why" reason.
- **YouTube resolution without a YouTube Data API key**: use the `videos` array
  on Discogs releases (usually YouTube links) to get a playable video ID; tracks
  with no resolvable video are flagged and skipped.
- **Liked tracks are auto-queued for local download** via `yt-dlp`, processed by
  a download-queue worker (queued → downloading → done/failed, storing the local
  file path).
- All state (ratings, entity scores, queues, cached Discogs data) persists in a
  **local SQLite database**; Discogs calls are throttled and cached to respect
  rate limits (~60 req/min authenticated).
- Establishes the **initial stack** for this greenfield repo (flagged for review
  in `design.md`): TypeScript throughout; Node 20 + Fastify + better-sqlite3
  backend; Vite + React frontend with the YouTube IFrame Player API.

## Capabilities

### New Capabilities

- `discogs-catalog`: Authenticated Discogs integration — metadata lookup for
  artists/labels/releases/tracks, candidate discovery by label/artist, resolving
  a track to a playable YouTube video ID via release `videos`, plus request
  throttling and local caching.
- `curation-player`: The playback + rating surface — embedded YouTube player,
  play/pause, like/dislike/skip controls, auto-advance on track end, and
  recording rating events.
- `rating-model`: Deriving and maintaining entity scores (artist, label,
  release/VA, track) from accumulated like/dislike rating events.
- `recommendation-queue`: Generating, scoring, ranking, and de-duplicating
  candidate tracks into the ordered explore queue, each with a "why" reason.
- `download-queue`: Auto-queueing liked tracks and processing local downloads
  via `yt-dlp` with tracked status and stored file paths.

### Modified Capabilities

<!-- None — greenfield repo, no existing specs. -->

## Impact

- **New code (greenfield):** first application code in the repo — TypeScript
  backend (Fastify HTTP API + download-queue worker + Discogs client +
  recommender + SQLite persistence) and a Vite/React frontend.
- **New runtime dependencies:** Node 20+, Fastify, better-sqlite3, a Discogs API
  client, React, Vite, the YouTube IFrame Player API (loaded client-side).
- **New external/system dependencies:** a Discogs account + **personal access
  token** (provided via env var; name only in docs, never the value), a locally
  installed **`yt-dlp`** binary, and **`ffmpeg`** (for MP3 320 kbps transcoding).
- **New config:** a seed config file listing liked labels/artists/tracks to
  bootstrap the recommender at cold start.
- **Repo housekeeping:** `.gitignore` must cover the SQLite DB file, downloaded
  audio, and `.env`; `agents/AGENTS.md` and `agents/MEMORY.md` get the stack
  decision and env-var name recorded.
- **Legal/usage note:** downloads are personal-use archiving on the user's own
  machine; no redistribution.
