## Context

smartcrate is a greenfield repo — no application code or stack chosen yet. This
change introduces v1: a **local-first** personal techno curation engine. It runs
entirely on the user's own machine because (a) the download queue shells out to a
local `yt-dlp` binary and (b) all state (ratings, scores, queues, cached catalog
data) is private and persists locally.

The whole system is built around **Discogs** as the single catalog authority:
metadata, candidate discovery, *and* — via the `videos` array on releases — the
YouTube video IDs used to play and download tracks. This deliberately avoids a
second external integration (no YouTube Data API key) for v1.

Constraints:
- Discogs authenticated rate limit ≈ 60 requests/min → must throttle and cache.
- Single user, single machine, no auth, no cloud.
- `yt-dlp` is an external binary the user installs; it can fail or be missing.

## Goals / Non-Goals

**Goals:**
- A working morning-curation loop end-to-end: Play → embedded YouTube playback →
  like/dislike/skip → entity scoring → recommender refills the explore queue →
  liked tracks auto-download locally.
- Discogs is the only external API; YouTube playback uses release `videos`.
- Durable local state in a single SQLite file; resilient to restarts.
- Respect Discogs rate limits via throttling + caching.
- Establish a clean, reviewable initial stack for the repo.

**Non-Goals (v1):**
- Multi-user, auth, cloud hosting, remote sync.
- A separate YouTube Data API integration / YouTube-native search.
- Audio fingerprinting, ML/embedding-based recommendation.
- Time-decay or recency weighting on scores (linear sums only for now).
- Mobile/native apps.
- Robust handling of every Discogs edge case (regional pressings, dupes) beyond
  basic dedupe.

## Decisions

### D1 — Stack: TypeScript, Node 20 + Fastify backend, Vite + React frontend
A small local HTTP backend serves a REST API to a React SPA and owns SQLite +
the download worker + the Discogs client. TypeScript end-to-end with shared types.
- **Why Fastify over Express:** first-class TypeScript types, schema validation,
  good performance, minimal boilerplate.
- **Why a SPA + local server (not Electron, not pure static):** we need a
  long-lived local process for the download queue and persistent state; a browser
  SPA keeps the YouTube IFrame embed trivial. Electron adds packaging weight we
  don't need for a personal tool.
- **Alternative considered:** Next.js full-stack — heavier than needed; the
  background download worker fits awkwardly in its model.

### D2 — Persistence: single SQLite file via better-sqlite3
- **Why:** zero-setup, file-based, synchronous API (simpler than async pools for
  a single-user app), trivially backed up. Holds entities, rating events, derived
  scores, queues, and a Discogs response cache.
- **Alternative:** Postgres — operational overhead unjustified for one local user.

### D3 — YouTube resolution via Discogs release `videos` (no YT Data API)
Each candidate track resolves to a YouTube video ID by reading the parent
release's `videos` array (Discogs commonly stores YouTube URLs there). A track
with no resolvable video is marked `unresolved` and skipped by the player.
- **Why:** keeps v1 to a single external API; no extra key/quota.
- **Trade-off:** coverage gaps — not every release has videos, and a release-level
  video may not map 1:1 to a specific track. v1 accepts this and skips unresolved
  tracks; per-track matching heuristics can come later.

### D4 — Discogs access: throttle + cache layer
All Discogs calls go through one client that (a) caps to a safe rate (≈1 req/sec)
with a queue, and (b) caches responses in SQLite keyed by resource. Reads prefer
cache; the recommender works against cached catalog data where possible.
- **Why:** stay under the ~60/min limit and keep curation responsive.

### D5 — Rating model: linear weighted entity scores, recomputable from events
Rating **events** (track, like|dislike, timestamp) are the source of truth and
are append-only. Entity scores (artist/label/release/track) are **derived** —
`score = Σ(+w_like) + Σ(−w_dislike)` over events touching that entity — and can
be fully recomputed from the event log. v1 stores materialized scores updated on
each rating for speed, but they are never authoritative over the event log.
- **Why append-only events:** auditable, lets us change the scoring formula later
  (e.g. add time-decay) without losing history.
- **VA handling:** a release flagged `is_va` contributes a release-level score
  shared by its tracks; individual track artists still score independently.

### D6 — Recommender: candidate generation + linear ranking + dedupe
1. **Generate:** from top positively-scored labels and artists, pull their
   releases/tracks from Discogs (cache-first), excluding entities the user has
   disliked below a threshold.
2. **Score:** `track_score = w_a·artistScore + w_l·labelScore + w_r·releaseScore`.
3. **Filter/rank:** drop tracks whose artist or label is disliked; drop
   already-rated and already-seen tracks; rank descending.
4. **Explain:** attach a "why" string (e.g. `label: Ostgut Ton; artist: ACR`).
5. Fill the explore queue to a target length; only `resolved` tracks (D3) enter.
- **Why linear/simple:** transparent, debuggable, good enough to validate the
  loop; weights are tunable constants.

### D7 — Download queue: worker shelling out to `yt-dlp`
Liking a track enqueues a download item (status `queued`). A background worker in
the backend processes the queue serially, invoking `yt-dlp` on the resolved
YouTube URL, transitioning `queued → downloading → done|failed`, and storing the
output file path. Missing/failing `yt-dlp` surfaces as `failed` with an error,
never crashes the server.

**Audio format (decided):** extract best audio and transcode to **MP3 320 kbps**
(`yt-dlp -x --audio-format mp3 --audio-quality 0`), which requires **`ffmpeg`**
installed locally. Like `yt-dlp`, a missing `ffmpeg` marks the item `failed` with
a clear error rather than crashing.

### D8 — Secrets & config
Discogs personal access token and the download output directory come from
environment variables (e.g. `DISCOGS_TOKEN`, `SMARTCRATE_DOWNLOAD_DIR`) — names
documented, values never committed. `.gitignore` covers `.env`, the SQLite file,
and the downloads directory.

### D9 — Cold-start seeding via a config file (decided)
Seed entities for the cold-start recommender are read from a **config file**
(checked in or user-edited, not a secret) listing **labels, artists, and tracks**
the user already likes. On empty rating signal the recommender bootstraps from
these seeds; editing the file changes the seeds. No in-app seeding UI in v1.
- **Why config file:** fastest path to a working loop; seeds are stable
  preferences, not per-session input. An in-app add-seed control can come later.
- **Seed tracks:** a seeded track resolves through Discogs like any other and can
  enter the explore queue directly, in addition to contributing its artist/label
  as discovery anchors.

## Risks / Trade-offs

- **Discogs `videos` coverage is incomplete** → many tracks may be `unresolved`
  and skipped, thinning the explore queue. *Mitigation:* skip gracefully, log
  coverage; a later change can add YouTube search as a fallback.
- **Release-level video ≠ exact track** → the played/downloaded audio may be the
  release's lead video, not the specific track. *Mitigation:* accept for v1,
  store the resolution source so it can be corrected later.
- **Discogs rate limits throttle discovery** → slow candidate generation on cold
  cache. *Mitigation:* cache aggressively; pre-warm from liked entities; keep the
  explore queue topped up ahead of playback.
- **`yt-dlp` breakage / ToS** → downloads can fail when YouTube changes or the
  binary is outdated. *Mitigation:* isolate in the worker, mark `failed` with the
  error, keep the app usable; personal-use archiving only, no redistribution.
- **Cold-start with no ratings** → the recommender has nothing to rank.
  *Mitigation:* allow seeding from a few liked artists/labels; on empty signal,
  fall back to a small set of user-provided seed entities.
- **Score inflation from one dominant label/artist** → queue monotony.
  *Mitigation:* simple per-entity caps/diversity in ranking; revisit if needed.

## Resolved Decisions (from review)

- **Stack:** locked — Node 20 + Fastify + better-sqlite3, Vite + React, all
  TypeScript (D1, D2).
- **Cold-start seeding:** config file listing seed labels, artists, and tracks;
  no in-app seeding UI in v1 (D9).
- **Audio format:** MP3 320 kbps via `yt-dlp` + `ffmpeg` (D7).

## Open Questions

- Exact default weights (`w_like`, `w_dislike`, `w_a`, `w_l`, `w_r`) and explore
  queue target length — start with sane constants, tune during use.
