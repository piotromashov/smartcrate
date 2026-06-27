## 1. Download naming (download-queue)

- [ ] 1.1 Add a filename helper: build `"<artists> - <title>"` from the track's Discogs metadata; sanitize (replace `/ \ : * ? " < > |` + control chars with `-`, collapse whitespace, trim, cap ~180 chars); artist-less → title only
- [ ] 1.2 `downloads/worker.ts`: look up the track's title + artist names (tracks/track_artists/artists), build the name, and disambiguate on-disk collisions with an incrementing ` (n)` suffix; store the final path
- [ ] 1.3 Tests: name built from artist+title, illegal chars sanitized, collision disambiguation (use a fake runner that "creates" the file)

## 2. Like no longer advances (curation-player)

- [ ] 2.1 `service.ts` `applyRating`: for `like`, record rating + enqueue download but do NOT remove from queue / advance; return the still-current track. `dislike`/`skip` unchanged (advance)
- [ ] 2.2 Tests: like keeps `current` the same and does not duplicate the download on a second like; dislike and skip still advance

## 3. Up-next payload (curation-player)

- [ ] 3.1 Add an `UpNextItem` shared type (`trackId`, `title`, `artists: string[]`, `score`, `reason`)
- [ ] 3.2 `playable.ts` + `app.ts`: `GET /api/queue` returns `{ current, upNext }` where `upNext` carries display metadata for queued tracks beyond the current
- [ ] 3.3 Test: `/api/queue` returns up-next items with score + artist/title (via fastify inject)

## 4. Frontend redesign (single page, dark/Material/techno)

- [ ] 4.1 Dark/Material/techno theme: a small set of CSS variables (near-black bg, one accent, muted dividers, clean type); apply globally
- [ ] 4.2 `App.tsx`: single-page layout, remove the Curate/Stats tabs; sections in order — smaller player (~220px) → now-playing + controls → up-next → downloads → stats inline
- [ ] 4.3 Up-next list component: artist · title · score (and reason) from the new payload
- [ ] 4.4 `Stats.tsx`: restyle for the dark theme inline (keep the contribution-not-lift caveat)
- [ ] 4.5 `api.ts`: consume the `{ current, upNext }` queue payload

## 5. Verify

- [ ] 5.1 `npm run typecheck` + `npm test --workspace backend` pass; `frontend` builds
- [ ] 5.2 Live: like keeps playing; dislike/skip advance; a download lands as `Artist - Title.mp3`; up-next shows scores; stats render inline on the dark page
- [ ] 5.3 `openspec validate curation-ux-polish --type change --strict`
