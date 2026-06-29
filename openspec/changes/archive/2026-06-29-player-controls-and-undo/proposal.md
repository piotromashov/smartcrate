## Why

Using the player surfaced rough edges: there's no way to **share** a track at the
moment you're hearing, the control buttons give **no feedback** that a click
registered, there's no way to **go back** to the track you just heard, and a
**mis-click on like/dislike can't be undone**. These are small frictions that make
a curation session feel less trustworthy.

## What Changes

- **Share** — a button copies the YouTube link to the **exact current moment**
  (`watch?v=<id>&t=<seconds>s`) to the clipboard, with a brief "copied"
  confirmation.
- **Button feedback** — play/pause, like, dislike, next, back show **active/pressed
  states** and a quick flash (green like / red dislike) so an action visibly lands.
- **Back / Next transport** — Back (⏮) replays the **previously-shown track** and
  Next (⏭) moves forward, via a session-only in-memory history (Back just reloads a
  previous video). These are **navigation, not rating**; Skip is unchanged.
- **Undo** — a single-level undo of the **last like/dislike only** (skip/back are
  recovered with Back, not undo). Undo **deletes the most recent rating event** and
  recomputes scores; undoing a *like* also **cancels its pending download**;
  undoing a *dislike* **re-surfaces the track** so it plays again.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `curation-player`: adds share-at-timestamp, visible control feedback, Back/Next
  transport, and undo of the last like/dislike.
- `rating-model`: the append-only rule loosens to allow undoing the single most
  recent rating (delete + recompute); scores stay recomputable from the log.
- `download-queue`: undoing a like cancels its not-yet-completed download.

## Impact

- **Frontend:** `youtube.ts` (expose `getCurrentTime`); `App.tsx` (Share + clipboard
  + confirmation; control feedback states; Back/Next with an in-memory played-history
  + forward stack; an Undo affordance after a like/dislike); `api.ts` (undo call).
- **Backend:** a new undo endpoint + `service.undoRating` (delete last event,
  `recomputeScores`, cancel a like's pending download, re-surface a disliked track
  to the queue front); a queue helper to enqueue at the front.
- **No schema change, no migration, no new env vars.**
- **Out of scope (deferred):** the side info panel (tracklist + bios, later);
  an append-only retraction model; a multi-level undo stack; persistent
  play-history across reloads; artist/label photos.
