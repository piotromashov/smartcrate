# 0001 — Local-first, single-user architecture

- Status: accepted
- Date: 2026-06-26

## Context

smartcrate curates techno by playing embedded YouTube, rating tracks, and
queueing liked tracks for **local download**. Downloads shell out to a local
`yt-dlp`/`ffmpeg` binary, and all state (ratings, scores, queues, cached catalog
data) is private to the user. There is no multi-user or cloud requirement for v1.

## Decision

Build smartcrate as a **local-first, single-user** application: a small local
backend service (TypeScript, Node 20, Fastify) that owns persistence, the Discogs
client, the recommender, and the download-queue worker, plus a browser SPA
(Vite + React) that embeds the YouTube IFrame player. Both run on the user's own
machine. No authentication, no multi-tenancy, no hosted backend.

## Consequences

- Good: the download worker and long-lived state have a natural home; the browser
  handles the YouTube embed trivially; zero hosting/ops burden.
- Good: a clear front/back boundary with shared TypeScript types.
- Bad: no remote access or cross-device sync; reaching multi-user later would
  require revisiting this decision via a superseding ADR (auth, hosting, data
  isolation).
