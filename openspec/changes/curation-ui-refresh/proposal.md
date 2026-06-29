## Why

A screenshot review of the live app showed the dark/techno direction is right but
reads "default dark mode," not designed: the player is a black 16:9 void around
small pillar-boxed album art; the cards barely separate from the background; the
acid-green accent is overused and — worst — highlights a column of meaningless
cold-start `0.0` scores; the up-next list is twelve identical `Planetary Assault
Systems · …` rows; everything is monospace so the now-playing title has no
hierarchy; and `seed/exploration` reads like a debug string.

## What Changes

- **Player framing** — narrow and center the embedded player (~360px) so the
  black bars become intentional margins; rounded with a subtle inner border so it
  reads as framed cover art, not a void.
- **Card elevation** — lift panels off the background (slightly lighter surface,
  clearer border, soft shadow) so now-playing / up-next / downloads / stats read
  as distinct Material surfaces, with now-playing as the visual hero.
- **Accent discipline + zero scores** — reserve acid green for "alive" things
  (Like, now-playing, positive scores); render a **score of 0 as a muted `—`**
  instead of a highlighted `0.0`.
- **Up-next artist grouping** — collapse **consecutive same-artist** rows under a
  single artist heading, listing just the track titles + scores beneath.
- **Typography & hierarchy** — keep monospace for titles + data/numbers; use a
  clean **sans** (system-ui) for labels, body, and stats prose; make the
  now-playing title the clear hero (~30px bold, more room).
- **Cold-start copy** — hide the reason line when it's the `seed/exploration`
  placeholder; keep real reasons.
- Tighten spacing into a denser tracklist rhythm.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `curation-player`: the up-next preview groups consecutive same-artist tracks
  and shows a zero candidate score as a neutral placeholder rather than a
  highlighted zero. (Two display rules; the rest of this change is pure styling.)

## Impact

- **Frontend only:** `App.tsx` (layout, player framing, up-next grouping,
  now-playing hierarchy, reason hiding, palette/elevation, type), `Stats.tsx`
  (sans body, restrained accent), `index.html` (font stack/bg). No backend, no
  API, no schema, no env vars.
- **Out of scope (deferred follow-up):** the "bigger moves" — a playback
  progress bar/equalizer, an SVG icon set replacing the emoji, a real SVG
  sparkline, and background grain. Theme stays dark-only (no toggle).
