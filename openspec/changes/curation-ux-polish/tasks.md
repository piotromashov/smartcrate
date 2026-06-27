## 1. Download naming (download-queue)

- [x] 1.1 Add a filename helper: build `"<artists> - <title>"` from the track's Discogs metadata; sanitize (replace `/ \ : * ? " < > |` + control chars with `-`, collapse whitespace, trim, cap ~180 chars); artist-less → title only
- [x] 1.2 `downloads/worker.ts`: look up the track's title + artist names, build the name, disambiguate on-disk collisions with an incrementing ` (n)` suffix; store the final path
- [x] 1.3 Tests: `sanitizeFilename` strips illegal chars; download named `Artist - Title.mp3`; collision → `(2)`

## 2. Like no longer advances (curation-player)

- [x] 2.1 `service.ts` `applyRating`: `like` records + enqueues download but keeps the current track; `dislike`/`skip` advance
- [x] 2.2 Tests: like keeps `current` and doesn't duplicate the download on re-like; dislike advances

## 3. Up-next payload (curation-player)

- [x] 3.1 `UpNextItem` shared type (`trackId`, `title`, `artists[]`, `score`, `reason`)
- [x] 3.2 `playable.ts` + `app.ts`: `GET /api/queue` returns `{ current, upNext }`
- [x] 3.3 Test: `/api/queue` returns up-next items with score + artist/title (fastify inject)

## 4. Frontend redesign (single page, dark/Material/techno)

- [x] 4.1 Dark/Material/techno theme (near-black bg, acid-green accent, muted dividers, mono type); global in index.html + component palette
- [x] 4.2 `App.tsx`: single page, tabs removed; smaller player (~220px) → now-playing + controls → up-next → downloads → stats inline
- [x] 4.3 Up-next list: artist · title · score from the new payload
- [x] 4.4 `Stats.tsx` restyled for the dark theme inline (caveat kept)
- [x] 4.5 `api.ts`: consume the `{ current, upNext }` queue payload

## 5. Verify

- [x] 5.1 `npm run typecheck` + `npm test --workspace backend` (29 tests) pass; `frontend` builds
- [x] 5.2 Live: `/api/queue` new shape served by the running dev server with up-next + scores; player hot-reloaded
- [x] 5.3 `openspec validate curation-ux-polish --type change --strict`
