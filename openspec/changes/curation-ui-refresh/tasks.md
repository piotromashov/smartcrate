## 1. Theme foundation

- [ ] 1.1 Centralize the palette + surface tokens (bg, panel, border, text, muted, accent, red, shadow) and the two font families (mono for titles/data, sans for labels/body) in one constants block
- [ ] 1.2 `index.html`: set the sans font stack + dark bg globally

## 2. Player & layout

- [ ] 2.1 Narrow-and-center the player (~360px max-width, centered), rounded with a subtle inner border
- [ ] 2.2 Lift the cards (panel/border/shadow per design); give the now-playing card hero emphasis; tighten overall spacing into a tracklist rhythm

## 3. Now-playing & accent

- [ ] 3.1 Now-playing hierarchy: title ~30px/700 mono with breathing room; artist/label secondary (sans)
- [ ] 3.2 Hide the reason line when it's the `seed/exploration` cold-start placeholder; show real reasons otherwise
- [ ] 3.3 Accent discipline: green only on Like / live / positive; restyle controls accordingly

## 4. Up-next (spec rules)

- [ ] 4.1 Group consecutive same-artist upcoming tracks under a single artist heading; titles + scores beneath
- [ ] 4.2 Render a score of 0 as a neutral `—` (not a green 0.0); dim non-top scores

## 5. Stats restyle

- [ ] 5.1 `Stats.tsx`: sans body/labels, restrained accent (keep the contribution-not-lift caveat); fit the lifted-card look inline

## 6. Verify

- [ ] 6.1 `npm run typecheck` + `frontend` build pass; `npm test --workspace backend` unaffected (still green)
- [ ] 6.2 Visual check in the running app: framed player (no void), distinct cards, grouped up-next with `—` zeros, hero title, no debug reason string
- [ ] 6.3 `openspec validate curation-ui-refresh --type change --strict`
