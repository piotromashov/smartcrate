## Context

Player UX polish (share, feedback, transport, undo). Frontend-heavy with one small
backend undo path. In-force ADRs are unaffected: undo hard-deletes the most recent
rating but the event log is still the source of truth and scores stay recomputable
(ADR-0005 derive-on-read still holds — we remove one event, not snapshot anything).
No new ADR.

## Goals / Non-Goals

**Goals:** share a timestamped link; visible control feedback; Back/Next transport;
a trustworthy single-level undo of the last like/dislike.

**Non-Goals:** an append-only retraction model (we hard-delete); multi-level undo;
persistent play-history across reloads; the side info panel; artist/label photos;
any schema/migration.

## Decisions

### D1 — Undo: hard-delete the most recent rating (like/dislike only)
`POST /api/tracks/:id/undo` → `undoRating(db, config, trackId)`: find the track's
most recent `rating_event`, delete it, then `recomputeScores` (existing) so scores
are correct from the remaining events. By value:
- **like** → cancel its pending download (delete the `download_queue` item if
  `queued`/`downloading`; leave `done`); the track is still current (like never
  advanced), so nothing to re-surface.
- **dislike** → re-surface the track to the **front** of the explore queue so it
  becomes current again.
Returns the new current track. No-op if the track has no rating event. Single-level
(the frontend offers undo only for the action just taken).

### D2 — Re-surface to front
A queue helper re-enqueues a track at a position **below the current minimum**
(`min(position) − 1`), so it sorts to the front and becomes current. Reason is a
neutral "resumed"; score 0 (it's navigational, not a fresh recommendation).

### D3 — Back / Next transport (frontend, session-only)
The frontend keeps `history: PlayableTrack[]` (shown order) and a `cursor`. **Back**
moves the cursor back and reloads that track's video (each `PlayableTrack` already
carries `youtubeVideoId`) — no backend call, no rating. **Next** moves the cursor
forward through history, then pulls the next track from the queue when past the end.
New tracks (from the queue) and skipped tracks are pushed to `history`. Rating acts
on the currently-shown track by id; the backend queue is untouched by Back/Next.

### D4 — Share
Expose `getCurrentTime()` on the player hook. Build
`https://www.youtube.com/watch?v=<id>&t=<floor(seconds)>s`, `navigator.clipboard
.writeText`, and show a transient "copied" confirmation (~1.5s). Clipboard works in
the secure localhost context.

### D5 — Control feedback
CSS transitions for press/active states plus a brief transient flash class on like
(green) / dislike (red); play/pause already reflects `paused`.

## Risks / Trade-offs

- [Rating a track reached via Back (already advanced past)] → the backend records it
  fine (the track exists); the live queue is unaffected. Acceptable.
- [Re-surface position goes negative when the front is at 0] → fine; ordering by
  position sorts negatives first, which is the intent (front).
- [History lost on page reload] → accepted (session-only Back), per scope.
- [Undo with no rating event present] → no-op, returns current unchanged.
