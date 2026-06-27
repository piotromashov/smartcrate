# smartcrate

A **local-first personal techno curation engine**. At the start of the day you
hit **Play**; smartcrate streams candidate tracks via embedded YouTube and you
**like / dislike / skip** them. That signal scores the tracks' **artists,
labels, and releases** (Discogs is the catalog authority), a simple recommender
ranks new Discogs-sourced candidates into an **explore queue**, and every track
you like is queued for **local download** via `yt-dlp`. The more you curate, the
better the queue gets.

Single user, runs entirely on your own machine. Downloads are personal-use
archiving — no redistribution.

---

## How it works

```
hit Play ──▶ explore queue (embedded YouTube) ──▶ like / dislike / skip
                  ▲                                      │
                  │                                      ▼
          recommender ranks            rating scores artists / labels / releases
        Discogs candidates  ◀───────────────  (likes also queue a download)
```

- **Discogs** is the only external API — metadata, candidate discovery, *and*
  YouTube resolution (release `videos`), so there's no separate YouTube API key.
- **Scores** accumulate from your like/dislike signal onto each track's artists,
  label(s), and release (VA compilations share a release score; each track's own
  artists score independently).
- **Recommender** pulls releases on your top-scored labels/artists, scores each
  candidate track (weighted artist + label + release), drops disliked / already-
  rated / already-seen / unresolved tracks, and fills the queue with a "why".
- **Downloads** run in a background worker that extracts **MP3 320** with
  `yt-dlp` + `ffmpeg`.

---

## Prerequisites

- **Node.js ≥ 22.5** (uses the built-in `node:sqlite`)
- A **Discogs personal access token** — create one at
  <https://www.discogs.com/settings/developers>
- **`yt-dlp`** and **`ffmpeg`** on your PATH (for downloads):
  `brew install yt-dlp ffmpeg`

---

## Setup & run

```bash
# 1. install workspaces
npm install

# 2. configure secrets — copy and put your token in .env
cp .env.example .env
#    edit .env → DISCOGS_TOKEN=your_token_here

# 3. add cold-start seeds (labels/artists you already like)
cp config/seeds.example.json config/seeds.json
#    edit config/seeds.json (see "Seeding" below)

# 4. run backend (:4321) + frontend (:5173)
npm run dev
#    then open http://localhost:5173 and hit Play
```

Other scripts:

```bash
npm run dev:backend     # backend only
npm run dev:frontend    # frontend only
npm run typecheck       # tsc across backend + frontend
npm test                # backend unit tests (node:test)
npm run build           # frontend production build
```

---

## Seeding (cold start)

With no ratings yet, the recommender needs a few seeds to start from. Put them in
`config/seeds.json` (git-ignored; copy from `config/seeds.example.json`):

```json
{
  "labels":  ["Ostgut Ton", "Token"],
  "artists": ["Answer Code Request", "Surgeon"],
  "releases": [123456]
}
```

- **`labels` / `artists`** accept either a **Discogs id** (number) or a **name**
  (string — resolved via Discogs search; the most relevant match wins).
- **`releases`** are **Discogs release ids** (numbers) whose tracks seed the
  explore queue directly.

Once you've rated some tracks, your own signal takes over and seeds become the
fallback.

---

## Configuration

All via environment variables in `.env` (names only — see `.env.example`):

| Var | Purpose | Default |
|---|---|---|
| `DISCOGS_TOKEN` | Discogs personal access token (required) | — |
| `PORT` | backend port | `4321` |
| `SMARTCRATE_DB_PATH` | SQLite file | `./data/smartcrate.db` |
| `SMARTCRATE_DOWNLOAD_DIR` | audio output dir | `./downloads` |
| `SMARTCRATE_SEED_CONFIG` | seed file path | `./config/seeds.json` |
| `SMARTCRATE_AUDIO_FORMAT` / `_QUALITY` | yt-dlp audio | `mp3` / `0` (320k) |
| `SMARTCRATE_WEIGHT_*`, `_EXPLORE_QUEUE_LENGTH`, `_DISLIKE_THRESHOLD` | recommender tunables | sane defaults |

---

## API (local)

| Method & path | Purpose |
|---|---|
| `GET /api/queue` | current track + explore queue |
| `GET /api/current` | current playable track |
| `POST /api/tracks/:id/rate` | body `{ "value": "like"\|"dislike"\|"skip" }` |
| `POST /api/recommend` | (re)fill the explore queue (503 without a token) |
| `GET /api/downloads` | download-queue status |
| `GET /api/seeds` | configured seeds |

---

## Project structure

```
smartcrate/
├── backend/          ← Fastify API + node:sqlite + Discogs client + recommender + yt-dlp worker
│   └── src/{db,discogs,rating,recommender,downloads}/ , app.ts, service.ts, index.ts
├── frontend/         ← Vite + React curation player (YouTube IFrame API)
├── shared/           ← TypeScript types shared by both (types-only)
├── config/           ← seeds.example.json (copy to seeds.json)
├── adr/              ← Architecture Decision Records (immutable)
├── openspec/         ← specs + changes (how the project is built; see below)
└── agents/           ← AGENTS.md (rules) + MEMORY.md (facts/decisions)
```

---

## How this project is built

smartcrate is built **spec-first** with [OpenSpec](https://openspec.dev) (the
`intent-driven` schema). Each unit of work is a *change*: a reviewable proposal →
specs → design → ADR → tasks, *before* code. See
[`agents/AGENTS.md`](agents/AGENTS.md) for the workflow, conventions, and git
discipline.

---

## License

_TODO — add a LICENSE file._
