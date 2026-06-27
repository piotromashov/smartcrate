# 0004 — Use Node's built-in `node:sqlite` (supersedes ADR-0002)

- Status: accepted, supersedes ADR-0002
- Date: 2026-06-27
- Supersedes: ADR-0002

## Context

[ADR-0002](0002-sqlite-as-local-store.md) chose SQLite via the native
**better-sqlite3** module. In practice the dev/runtime environment is **Node 26**,
for which `better-sqlite3@11` ships no prebuilt binary; it falls back to compiling
against Node 26's V8 API and fails to build. Chasing native-build fixes for a
bleeding-edge Node is fragile. Node ≥ 22.5 ships a built-in **`node:sqlite`**
(`DatabaseSync`) with a synchronous, prepare/run/get/all API very close to
better-sqlite3.

## Decision

Use the built-in **`node:sqlite`** (`DatabaseSync`) as the SQLite access layer
instead of better-sqlite3. The store is still a single local SQLite file; only the
client library changes. Bumps the minimum Node version to **≥ 22.5**.

The SQLite-as-single-local-store decision from ADR-0002 stands — this ADR only
changes *how* SQLite is accessed.

## Consequences

- Good: **zero native dependencies** — no node-gyp/compile step, no prebuilt-binary
  mismatch; install is pure-JS and fast.
- Good: synchronous API keeps the single-user data layer simple (same shape as the
  superseded choice).
- Bad: requires Node ≥ 22.5 (was Node 20); `node:sqlite` may still emit an
  "experimental" warning on some Node versions.
- Bad: a smaller ecosystem/feature surface than better-sqlite3 (acceptable for this
  app's plain SQL needs).
