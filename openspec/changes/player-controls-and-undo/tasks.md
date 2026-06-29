## 1. Backend — undo

- [ ] 1.1 `db/repositories.ts`: add a delete for a track's most-recent rating event (and a getter for its value), and a "re-enqueue at front" helper in `recommender/queue.ts` (`min(position) − 1`)
- [ ] 1.2 `downloads/queue.ts`: add a cancel that removes a track's `queued`/`downloading` item (leaves `done`)
- [ ] 1.3 `service.ts`: `undoRating(db, config, trackId)` — find + delete the most recent rating event, `recomputeScores`; like → cancel download; dislike → re-surface to front; return the new current
- [ ] 1.4 `app.ts`: `POST /api/tracks/:id/undo` → `undoRating`, returning `{ current }`
- [ ] 1.5 Tests: undo-like removes the like, recomputes scores, cancels the pending download, track stays; undo-dislike removes the dislike and re-surfaces; undo with no rating is a no-op

## 2. Frontend — share + feedback

- [ ] 2.1 `youtube.ts`: expose `getCurrentTime()` on the player hook
- [ ] 2.2 Share button: build `watch?v=<id>&t=<floor(s)>s`, `navigator.clipboard.writeText`, transient "copied" confirmation
- [ ] 2.3 Control feedback: active/pressed states + a brief flash on like (green) / dislike (red); play/pause reflects state

## 3. Frontend — transport + undo

- [ ] 3.1 In-memory `history: PlayableTrack[]` + cursor; push queue/skip tracks onto it
- [ ] 3.2 Back (⏮): move cursor back, reload the previous track's video (no backend, no rating)
- [ ] 3.3 Next (⏭): move cursor forward through history, then advance from the queue past the end
- [ ] 3.4 Undo affordance: after a like/dislike, show Undo → `api.undo(trackId)`; reconcile current + refresh downloads/stats
- [ ] 3.5 `api.ts`: `undo(trackId)` call

## 4. Verify

- [ ] 4.1 `npm run typecheck` + `npm test --workspace backend` pass; `frontend` builds
- [ ] 4.2 Live in the browser: share copies a timestamped link; like/dislike flash; Back replays the previous track; undo-like un-likes + cancels download; undo-dislike brings the track back
- [ ] 4.3 `openspec validate player-controls-and-undo --type change --strict`
