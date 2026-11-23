# ADR-003 — Persistence Architecture and Migration Plan (ADR-001 DB work)

- **Status:** Proposed (implementation partially landed; App not yet wired)
- **Date:** 2026-11-23
- **Owners:** Architect / Builder (implementation), Product owner (rollout approval)
- **Related decisions:** ADR-001 (stack; deferred server DB), ADR-002 (P0 slice), D-009, D-019
- **Scope:** This ADR records the persistence boundary introduced by the ADR-001 DB work and the plan to make SQLite a supported (then default) store. It does **not** change gameplay, save content, or the save schema version (still `version: 2`).

> Naming note: this file is numbered **ADR-003** to avoid colliding with the existing [ADR-001](./ADR-001-stack-and-size-conscious-foundation.md) (stack) and [ADR-002](./ADR-002-p0-vertical-slice.md) (slice scope). It is the ADR-001 _persistence/DB follow-up_.

## 1. Objective

Give the game one persistence seam with two interchangeable backends:

1. `local` (localStorage) — current default, stable, zero-infrastructure.
2. `sqlite-api` (HTTP + `node:sqlite`) — opt-in, server-authoritative, transactional, auditable.

Success means: same `GameRepository` contract, identical player-visible behavior, canonical truth never leaves the server in a payload, and a safe, explicit path for existing localStorage saves into SQLite.

## 2. Current components (as implemented at `2593687`)

### Client

| File                                        | Role                                                                                                                                                                                              | Status                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `src/storage/gameRepository.ts`             | `GameRepository` interface (`loadGame`, `saveGame`, `resetGame`), `DEFAULT_GAME_SLOT = 'default'`. Slot IDs are opaque keys.                                                                      | Implemented                                   |
| `src/storage/save.ts`                       | `SAVE_KEY`/`LEGACY_KEY`, `hydrateSave` (v1→v2 merge + sanitize), `toPersistedSave` (player-safe projection), `persistSave`, `resetSave`, `loadSave`.                                              | Implemented                                   |
| `src/storage/localStorageGameRepository.ts` | localStorage adapter; sync methods + async wrappers; `hasPersistedSave(slotId)` for migration detection; named slots stored under `the-bar-save-v2:slot:<id>`.                                    | Implemented                                   |
| `src/storage/sqliteApiGameRepository.ts`    | HTTP adapter: `GET/PUT/DELETE /api/saves/:slot`; hydrates responses; sends `toPersistedSave` payload; on `404` imports from an injected `MigrationSource`; fails closed to `createInitialSave()`. | Implemented (unit-tested with mocked `fetch`) |
| `src/storage/getGameRepository.ts`          | `getGameRepository()` factory selected by `VITE_STORAGE_MODE`; module-level cache; `resetGameRepositoryCache()` test seam.                                                                        | Implemented                                   |
| `src/config/env.ts`                         | `getStorageMode()` → `'local'` (default) \| `'sqlite-api'`.                                                                                                                                       | Implemented                                   |
| `src/app/App.tsx`                           | **Still imports `localStorageGameRepository` directly** and calls `loadGameSync` / `saveGameSync` / `resetGameSync`.                                                                              | **Not wired to the factory/async API**        |

### Server

| File                      | Role                                                                                                                                                                                                                     | Status                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| `server/db/database.ts`   | Singleton `DatabaseSync`; path from `THE_BAR_DB_PATH` or `./data/the-bar.sqlite`; `PRAGMA journal_mode=WAL`, `foreign_keys=ON`; idempotent `migrate()`; `withTransaction()` using `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`. | Implemented           |
| `server/db/repository.ts` | `save_slots` upsert/read/list/delete, `audit_events` append/list, `stripCanonicalTruth()` defense-in-depth, `SaveConflictError` when `expectedSavedAt` is stale.                                                         | Implemented           |
| `server/api.ts`           | `GET /api/health`, `GET /api/saves`, `GET /api/audit`, and `GET` / `PUT` / `POST` / `DELETE` on `/api/saves/:slot`; 2 MB body cap; JSON errors; binds `127.0.0.1:8787`.                                                  | Implemented (no auth) |
| `server/index.ts`         | Entry point for `npm run db:server`.                                                                                                                                                                                     | Implemented           |
| `vite.config.js`          | Dev/preview proxy `/api/saves`, `/api/health`, `/api/audit` → `127.0.0.1:8787`.                                                                                                                                          | Implemented           |

### Tests (verified locally)

`src/tests/gameRepository.test.ts` (6), `src/tests/sqliteApiGameRepository.test.ts` (7), `src/tests/saveMigration.test.ts` (5), `server/db/repository.test.ts` (4) — 22 tests, all passing. They cover slot isolation, canonical-truth exclusion, v1→v2 merge, import-on-404, HTTP failure handling, transactional upsert/audit, stale-write conflict, and restart/reopen persistence.

Handler-level HTTP integration tests also exist: `server/api.test.ts` (11 tests, passing, added in the same working tree at drafting time and picked up by `npm test`). They spawn `createServer()` on an ephemeral port against a temporary SQLite file and cover health, PUT/POST/GET round-trip, canonical-truth stripping in responses, DELETE + 404, slot listing without payloads, audit rows, stale `expectedSavedAt` → `409`, malformed JSON → `400`, oversized body → `413`, and unknown routes → `404`.

## 3. Data flow

### local (default)

```
App.tsx ──sync──> localStorageGameRepository ──> save.ts ──> window.localStorage
                                                 hydrateSave on read
                                                 toPersistedSave on write
```

### sqlite-api (opt-in, not used by App yet)

```
App (future) ──async──> getGameRepository() ──> SqliteApiGameRepository
                                                   │  GET/PUT/DELETE /api/saves/:slot
                                                   ▼
                                         Vite proxy → server/api.ts
                                                   ▼
                                      server/db/repository.ts (transaction)
                                                   ▼
                                        node:sqlite (WAL) + audit_events
```

Load path: `GET` → `hydrateSave(data.slot.payload)` (client re-applies defaults and a fresh seed `canonicalTruth`). On `404`, if a migration source reports a local save, the adapter imports it via `PUT` and returns it; otherwise it returns `createInitialSave()`. Any thrown error → fresh save (fail closed).

Save path: `toPersistedSave(state)` → `PUT { payload }` → server strips `canonicalTruth` again → upsert → `audit_events` row.

## 4. Canonical-truth boundary

Three independent layers, all already implemented:

1. **Type boundary:** `PersistedSave` omits `caseFile.canonicalTruth`; `toPersistedSave` builds an explicit allow-listed `caseFile`.
2. **Server boundary:** `stripCanonicalTruth()` removes the field before serialization, so a hand-crafted or future client bug cannot store it.
3. **Hydration boundary:** `hydrateSave()` ignores stored `canonicalTruth` and injects `structuredClone(createInitialSave().caseFile.canonicalTruth)`.

Rule: canonical truth is **derived from the deterministic seed at load time**, never transported, never stored, never accepted from a client. Any new persistence backend must preserve this invariant.

## 5. Migration / import strategy

Implemented:

- **v1 → v2 (in-place, client):** `loadSave` reads `SAVE_KEY` then `LEGACY_KEY`; `hydrateSave` merges defaults, backfills missing arrays/fields, trims notebooks/draft versions, sanitizes audit log and legal-source provenance; `persistSave` writes v2 and removes the legacy key.
- **localStorage → SQLite (lazy, per slot):** only on `404` from `GET /api/saves/:slot`, and only if `MigrationSource.hasLocalSave(slotId)` is true. Import is best-effort: a failed import write still returns the local save in memory.
- **Slots:** legacy key migration applies to the default slot only; named slots use `the-bar-save-v2:slot:<id>` and never read `LEGACY_KEY`.

Deferred:

- No explicit "migrate now" UI/command, no import marker/checksum, no post-import deletion of the local copy (local data is retained, so a later switch back to `local` still works).
- No server-side schema migration beyond the idempotent `001_initial_schema`; `save_slots.schema_version` is stored but not enforced on read.

## 6. Conflict / recovery model

Implemented:

- **Stale-write guard (server):** `upsertSaveSlot(..., { expectedSavedAt })` compares the stored `saved_at` inside the transaction and throws `SaveConflictError` → HTTP `409 SAVE_CONFLICT`.
- **Fail-closed client:** transport/HTTP errors on load return a fresh in-memory save; failed saves return `{ ok: false, reason }` and never throw.
- **Crash safety:** WAL + `BEGIN IMMEDIATE` transactions; `closeDb()` on SIGINT/SIGTERM; restart/reopen covered by tests.
- **Reset:** server `DELETE` is idempotent (`404` tolerated); client always returns a fresh save even if the delete fails.

Gaps:

- **The client never sends `expectedSavedAt`**, so the 409 path is currently unreachable from the app; last-write-wins is the effective behavior.
- No client retry/rebase/conflict UI; a `409` would surface as a generic `HTTP_409` failure.
- No optimistic version token on the response (client would need `slot.savedAt` threaded back into the next write).

## 7. Audit model

Two distinct, deliberately separate logs:

- **In-save player audit log** (`src/domain/audit.ts`): bounded (100 events), sanitized, player-safe, migrated on load. This is the player-visible record and is part of the save payload.
- **Server `audit_events` table:** append-only rows `(slot_id, event_type, day, actor, detail_json, created_at)` written transactionally with `save.upsert` and `save.delete`; queryable via `GET /api/audit`. Currently written only by the repository, not by the game domain.

Deferred: no request/user identity in `actor`, no audit retention policy, no tamper-evident hash chain, no UI to view server audit events.

## 8. Slot ownership / auth boundary (future)

Current state: **no authentication, no authorization, no tenancy.** Any caller that can reach `127.0.0.1:8787` can read/write/delete any slot ID. Slot IDs are opaque strings, not secrets.

Planned boundary (not implemented):

- Treat `slotId` as a _storage key_, not an identity; add an owner column (`owner_id`) and scope all queries by it.
- Authenticate before the router; derive `owner_id` server-side; never trust a client-supplied owner.
- Keep `127.0.0.1`-only binding as the interim containment; do not expose the API publicly before auth lands.
- Rate-limit and validate slot IDs; keep the existing body-size cap.

## 9. Rollout plan

| Phase        | State                                                                                                                                                                                        | Gate                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| P0 (current) | `local` is default; `sqlite-api` selectable only via `VITE_STORAGE_MODE=sqlite-api`. App ignores the factory and always uses localStorage.                                                   | Existing suites + `npm run verify` green.                           |
| P1           | Wire `App.tsx` to `getGameRepository()` with async load/save/reset; keep `local` default; handle in-flight saves (queue/debounce) and surface failures.                                      | Manual smoke on both modes; no save-loss on rapid actions.          |
| P2           | Thread `savedAt` from responses into the next `PUT` as `expectedSavedAt`; map `409` to a defined recovery path (reload latest + notify).                                                     | Conflict test against a real server.                                |
| P3           | Extend the existing handler-level HTTP tests (`server/api.test.ts`) to drive `SqliteApiGameRepository` against a real server: import-on-404, `409` recovery, restart, and payload stripping. | No mocked `fetch` on the integration path; tests run in `npm test`. |
| P4           | Opt-in default flip in a preview environment; keep a documented env switch back to `local`.                                                                                                  | Parity checklist + rollback verified.                               |
| P5           | Make `sqlite-api` the default only after P1–P4 pass and auth/ownership (or an explicit single-user decision) is recorded.                                                                    | Product owner sign-off.                                             |

Rollback at every phase: set `VITE_STORAGE_MODE=local`; local saves were never deleted.

## 10. Known gaps / risks

| #   | Gap / risk                                                                                                   | Impact                                                                               | Mitigation                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 1   | `App.tsx` uses `localStorageGameRepository` directly (`src/app/App.tsx:7,207,385,405`).                      | `sqlite-api` mode is inert in the running app.                                       | P1 wiring task.                                                                          |
| 2   | Client never sends `expectedSavedAt`.                                                                        | Server conflict guard unusable; silent last-write-wins.                              | P2.                                                                                      |
| 3   | Adapter tests mock `fetch`; HTTP tests cover the handler, not the adapter/proxy path.                        | Client↔server contract regressions (URL shape, JSON envelope, hydration) undetected. | P3.                                                                                      |
| 4   | Import-on-404 is a read-then-write race.                                                                     | Two tabs could both import; last write wins.                                         | P2 conflict token + idempotent import marker.                                            |
| 5   | `slotIdFromPath` regex is `[a-zA-Z0-9_-]{1,64}` but the client `encodeURIComponent`s arbitrary IDs.          | Non-matching slot IDs 404 unexpectedly.                                              | Constrain/validate slot IDs on the client.                                               |
| 6   | No auth/ownership.                                                                                           | Any local caller can read/write all slots.                                           | Section 8; keep loopback-only binding.                                                   |
| 7   | Server ignores stored `schema_version` on read.                                                              | Older payloads are only fixed client-side by `hydrateSave`.                          | Document `hydrateSave` as the single upgrade point; add server-side version check later. |
| 8   | `getGameRepository()` caches the adapter at module scope.                                                    | Changing `VITE_STORAGE_MODE` requires a reload.                                      | Acceptable (build-time env); `resetGameRepositoryCache()` exists for tests.              |
| 9   | Async saves introduce ordering hazards in `update()`, which currently saves synchronously on every mutation. | Out-of-order writes could persist stale state.                                       | P1: single-flight queue / latest-wins sequence number.                                   |

## 11. Acceptance criteria for "ADR-001 persistence complete"

1. `App.tsx` obtains its repository from `getGameRepository()` and uses the async contract; no direct `localStorageGameRepository` import in app code.
2. `local` remains the default; `VITE_STORAGE_MODE=sqlite-api` works end-to-end through the Vite proxy with the real server.
3. Load, save, reset, and first-run import behave identically in both modes for the same slot.
4. Canonical truth is absent from every stored payload (localStorage and `save_slots.payload_json`) and re-derived on load — asserted by tests.
5. Client sends `expectedSavedAt`; a stale write yields a handled `409` with a defined recovery path (no silent data loss).
6. `npm test` includes real-server integration tests (no mocked `fetch`) covering the adapter path: import-on-404, `409` conflict/recovery, restart recovery, and payload stripping. Handler-level coverage in `server/api.test.ts` is the starting point, not the finish line.
7. v1→v2 and localStorage→SQLite migrations are covered by automated tests, and local data is retained (rollback works).
8. `npm run verify` passes (lint, format, typecheck, tests, build).
9. Auth/ownership is either implemented or explicitly recorded as a deferred, documented single-user limitation with loopback-only binding.
10. Rollout/rollback steps in Section 9 are executed and recorded in `docs/DECISIONS.md`.
