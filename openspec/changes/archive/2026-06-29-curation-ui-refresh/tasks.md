## 1. Theme foundation

- [x] 1.1 Centralize the palette + surface tokens and the two font families (mono for titles/data, sans for labels/body)
- [x] 1.2 `index.html`: sans font stack + dark bg globally (+ a live-pulse keyframe)

## 2. Player & layout

- [x] 2.1 Narrow-and-center the player (~360px max-width), rounded with a subtle border
- [x] 2.2 Lift the cards (panel/border/shadow); now-playing as the hero; tighter spacing

## 3. Now-playing & accent

- [x] 3.1 Now-playing hierarchy: title ~30px/700 mono with a live dot; artist/label secondary (sans)
- [x] 3.2 Hide the reason line when it's the `seed/exploration` cold-start placeholder
- [x] 3.3 Accent discipline: green only on Like / live / positive scores

## 4. Up-next (spec rules)

- [x] 4.1 Group consecutive same-artist upcoming tracks under a single artist heading
- [x] 4.2 Render a score of 0 as a neutral `—` (not a green 0.0)

## 5. Stats restyle

- [x] 5.1 `Stats.tsx`: sans body (inherited), mono/tabular headline number, restrained accent (caveat kept)

## 6. Verify

- [x] 6.1 `npm run typecheck` + `frontend` build pass; `npm test --workspace backend` still green (29)
- [x] 6.2 Live via HMR in the running app for visual confirmation (framed player, lifted cards, grouped up-next with `—`, hero title, no debug reason) — user to eyeball
- [x] 6.3 `openspec validate curation-ui-refresh --type change --strict`
