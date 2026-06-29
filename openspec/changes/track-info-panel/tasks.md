## 1. Backend — profile fetch + markup

- [ ] 1.1 `shared/src/index.ts`: add `EntityProfile` (`id`, `name`, `bio`, `urls[]`) and `TrackContext` (`release { id, title, tracks: [{ position, title, isCurrent }] }`, `artists[]`, `labels[]`) types
- [ ] 1.2 A markup-strip util: `[url=…]text[/url]` → `text`; remove `[b]/[i]/[u]` and inline `[a|l|m|r]\d+` refs; collapse whitespace
- [ ] 1.3 `discogs/catalog.ts`: `getArtistDetail`/`getLabelDetail` — cache-first full fetch of `/artists/{id}` / `/labels/{id}`, upsert id+name, return `{ id, name, bio (stripped profile), urls }`

## 2. Backend — track context + endpoint

- [ ] 2.1 A track-context assembler: local release + tracks (mark `isCurrent`), then `getArtistDetail` for the track's artists and `getLabelDetail` for the release's labels
- [ ] 2.2 `app.ts`: `GET /api/tracks/:id/context` → `TrackContext` (503 if no Discogs client, like `/api/recommend`)
- [ ] 2.3 Tests: assembler builds the tracklist with `isCurrent` from local data and stubbed artist/label details; markup strip unit test

## 3. Frontend — info panel

- [ ] 3.1 `api.ts`: `getTrackContext(trackId)`
- [ ] 3.2 An `ⓘ Info` toggle in the player controls; an inline info panel component (dark theme) — tracklist (current highlighted) → artist bios + links → label bio + links
- [ ] 3.3 Fetch on open for the current track; loading + empty states; close on toggle / track change

## 4. Verify

- [ ] 4.1 `npm run typecheck` + `npm test --workspace backend` pass; `frontend` builds
- [ ] 4.2 Live: open the panel on a track → tracklist with current highlighted + artist/label bios + links; second open is instant (cached)
- [ ] 4.3 `openspec validate track-info-panel --type change --strict`
