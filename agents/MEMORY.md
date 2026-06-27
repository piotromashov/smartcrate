# MEMORY.md — smartcrate facts & decisions

> Durable *facts and decisions* for this repo: operational/infra facts, a
> decision log, and project state. The **rules** live in [`AGENTS.md`](AGENTS.md);
> the **requirements** (what the system does and why) live in `openspec/specs/`.
> Don't duplicate either here — this file is the log, not the law or the spec.
>
> Keep entries dated. Convert relative dates to absolute. Append; don't rewrite
> history.

---

## Project state

- **Status:** greenfield. OpenSpec initialized; no application code yet.
- **Source of truth for requirements:** `openspec/specs/` (currently empty —
  fills as changes are proposed and archived).

---

## Decision log

Newest first. One entry per decision: date, what was decided, why.

- **2026-06-26 — Adopted the `intent-driven` OpenSpec framework (Claude Code
  port).** Switched the project default schema from `spec-driven` to
  `intent-driven` (`openspec/config.yaml`): artifact chain **proposal → specs →
  design → adr → tasks**, with skills bound per artifact (proposal→grill-me,
  specs→gherkin-authoring, design→c4-diagrams, adr→architectural-decision-records).
  Ported from the OpenCode-targeted `intent-driven-dev/intent-driven-template` +
  `openspec-schemas`. Adaptations: skills live in `.claude/skills/`, agents in
  `.claude/agents/`; `openspec update` migrated to a custom profile with 8
  workflows (added `new`/`continue`/`verify`); `bulk-apply` command hand-authored;
  the `adversarial-author`/`-reviewer` agents use two Claude models (opus/sonnet)
  in place of the upstream cross-provider models; `bulk-apply` uses Claude Code
  worktree subagents instead of Obra's Superpowers. Git-discipline gates ("cross
  `main` between phases") added to `AGENTS.md` + the `openspec-git-discipline`
  skill. **Fix:** upstream `config.yaml` keyed the spec rule as `spec:` but the
  schema artifact id is `specs` — corrected to `specs:` so gherkin-authoring binds.
  ADRs persist in top-level `adr/` (immutable, supersession-linked), not archived.
- **2026-06-26 — (superseded) Adopted OpenSpec for spec-driven development.**
  Original `spec-driven` workflow, initialized with
  `openspec init --tools claude,cursor`. Superseded by the intent-driven adoption
  above; the in-flight `techno-curation-engine` change was re-scaffolded onto
  intent-driven.
- **2026-06-26 — Agent docs centralized under `agents/`.** `AGENTS.md` (rules)
  and `MEMORY.md` (this file) live in `agents/`; root `CLAUDE.md` is a thin
  pointer. Requirements deliberately kept out of these files — they belong in
  `openspec/specs/` to avoid a second, drifting source of truth.

---

## Operational / infra facts

<!-- FILL IN as they appear. Examples to add later:
- Deploy targets and how to deploy
- Environment variable NAMES (never values)
- CI/CD pipeline notes
- Non-obvious gotchas discovered while building -->

- **Stack (2026-06-27):** TypeScript monorepo via **npm workspaces** —
  `shared/` (types-only, consumed via `import type` so no build step),
  `backend/` (Node ≥ 22.5 ESM, Fastify, built-in `node:sqlite`, run with `tsx`),
  `frontend/` (Vite + React). Module setup: `moduleResolution: "Bundler"`,
  extensionless relative imports. Shared base config in `tsconfig.base.json`.
  **Gotcha:** better-sqlite3 (ADR-0002) wouldn't build on Node 26 → switched to
  built-in `node:sqlite` ([ADR-0004]); requires Node ≥ 22.5.
- **Env var NAMES (values live only in `.env`, never committed):**
  `DISCOGS_TOKEN` (required for catalog), `PORT`, `SMARTCRATE_DB_PATH`,
  `SMARTCRATE_DOWNLOAD_DIR`, `SMARTCRATE_SEED_CONFIG`,
  `SMARTCRATE_AUDIO_FORMAT`/`SMARTCRATE_AUDIO_QUALITY`, and the
  `SMARTCRATE_WEIGHT_*` / `SMARTCRATE_EXPLORE_QUEUE_LENGTH` /
  `SMARTCRATE_DISLIKE_THRESHOLD` recommender tunables. See `.env.example`.
- **Local data (gitignored):** SQLite at `data/smartcrate.db`, audio in
  `downloads/`, personal seeds in `config/seeds.json`.
- **External binaries:** downloads need `yt-dlp` + `ffmpeg` on PATH (MP3 320k).
- **`node:sqlite` typing gotcha:** `stmt.all()` returns `Record<string, SQLOutputValue>[]`;
  casting straight to a row type fails `tsc` (TS2352) — bridge via `as unknown as Row[]`.
  (`.get()` casts are usually fine.)
- **Test glob gotcha:** the backend test script quotes the pattern
  (`tsx --test "src/**/*.test.ts"`) so Node's runner does the recursive glob —
  unquoted, the shell expands `**` as `*` and skips root-level `*.test.ts`.
- **Relative `dbPath`/`downloadDir`** resolve against the process CWD, which is the
  workspace dir (`backend/`) when launched via the npm workspace script — set
  `SMARTCRATE_DB_PATH` to pin it elsewhere.
- **Verification status:** backend has 20 passing `node:test` unit tests
  (persistence, Discogs w/ stubbed fetch, scoring, recommender, downloads w/ fake
  runner, API via fastify inject); frontend typechecks + builds. **Live e2e
  (real Discogs token + `yt-dlp`/`ffmpeg`) is the remaining manual step** —
  tasks 9.1/9.2.

---

## Maintenance

- After completing a significant task, append the decision or operational fact
  here (dated). Track: stack decisions, env var names, deploy/infra changes,
  gotchas. Don't record requirements (those go in specs) or restate rules
  (those go in `AGENTS.md`).
