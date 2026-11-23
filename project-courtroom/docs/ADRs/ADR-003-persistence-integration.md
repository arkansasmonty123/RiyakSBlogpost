# ADR-003 — Persistence Architecture and Migration Plan (ADR-001 DB work)

- **Status:** Accepted — P1 landed at `1990e73`, P2 client conflict handling landed (expectedSavedAt + 409 reload/overwrite UX); `sqlite-api` remains opt-in and not default
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

## 2. Current components (as implemented at `1990e73`)

### Client

| File                                        | Role                                                                                                                                                                                                                                                                                                                                                                                                              | Status                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `src/storage/gameRepository.ts`             | `GameRepository` interface (`loadGame`, `saveGame`, `resetGame`), `DEFAULT_GAME_SLOT = 'default'`. Slot IDs are opaque keys.                                                                                                                                                                                                                                                                                      | Implemented                           |
| `src/storage/save.ts`                       | `SAVE_KEY`/`LEGACY_KEY`, `hydrateSave` (v1→v2 merge + sanitize), `toPersistedSave` (player-safe projection), `persistSave`, `resetSave`, `loadSave`.                                                                                                                                                                                                                                                              | Implemented                           |
| `src/storage/localStorageGameRepository.ts` | localStorage adapter; sync methods + async wrappers; `hasPersistedSave(slotId)` for migration detection; named slots stored under `the-bar-save-v2:slot:<id>`.                                                                                                                                                                                                                                                    | Implemented                           |
| `src/storage/sqliteApiGameRepository.ts`    | HTTP adapter: `GET/PUT/DELETE /api/saves/:slot`; tracks last known `savedAt` per slot; sends `expectedSavedAt` when known; maps 409 to conflict result; `force` option for explicit one-shot overwrite; on `404` imports from injected `MigrationSource`; hydrates responses; sends `toPersistedSave`; fail-closed to `createInitialSave()`.                                                                      | Implemented (opt-in, unit/E2E tested) |
| `src/storage/getGameRepository.ts`          | `getGameRepository()` factory selected by `VITE_STORAGE_MODE`; module-level cache; `resetGameRepositoryCache()` test seam.                                                                                                                                                                                                                                                                                        | Implemented                           |
| `src/config/env.ts`                         | `getStorageMode()` → `'local'` (default) \| `'sqlite-api'`.                                                                                                                                                                                                                                                                                                                                                       | Implemented                           |
| `src/app/App.tsx`                           | Boots via `createSessionBoot(getGameRepository())`; capability-checks a sync adapter (`isSyncGameRepository`) for a no-flicker local fast path and renders a loading frame for async adapters; loads via `loadInitialSave` / `loadBootSave`; saves and resets via `persistSaveThrough` / `resetSaveThrough`; serializes async writes through a queue with a generation guard. Exports the boot helpers for tests. | **Implemented (P1)**                  |

### Server

| File                      | Role                                                                                                                                                                                                                     | Status                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| `server/db/database.ts`   | Singleton `DatabaseSync`; path from `THE_BAR_DB_PATH` or `./data/the-bar.sqlite`; `PRAGMA journal_mode=WAL`, `foreign_keys=ON`; idempotent `migrate()`; `withTransaction()` using `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`. | Implemented           |
| `server/db/repository.ts` | `save_slots` upsert/read/list/delete, `audit_events` append/list, `stripCanonicalTruth()` defense-in-depth, `SaveConflictError` when `expectedSavedAt` is stale.                                                         | Implemented           |
| `server/api.ts`           | `GET /api/health`, `GET /api/saves`, `GET /api/audit`, and `GET` / `PUT` / `POST` / `DELETE` on `/api/saves/:slot`; 2 MB body cap; JSON errors; binds `127.0.0.1:8787`.                                                  | Implemented (no auth) |
| `server/index.ts`         | Entry point for `npm run db:server`.                                                                                                                                                                                     | Implemented           |
| `vite.config.js`          | Dev/preview proxy `/api/saves`, `/api/health`, `/api/audit` → `127.0.0.1:8787`.                                                                                                                                          | Implemented           |

### Tests (verified locally)

Persistence/API suites: `src/tests/gameRepository.test.ts`, `src/tests/sqliteApiGameRepository.test.ts`, `src/tests/saveMigration.test.ts`, `server/db/repository.test.ts`, `src/tests/appRepositoryIntegration.test.tsx`, `server/api.test.ts`, `src/tests/sqliteApiE2E.test.ts`, `src/tests/adversarialPersistence.test.ts` — **63 tests across 8 files** (current). They cover slot isolation, canonical-truth exclusion, v1→v2 merge, import-on-404, HTTP failure handling, transactional upsert/audit, stale-write conflict, restart/reopen persistence, App↔repository boot contract, async save serialization, conflict reload/overwrite UX, handler-level HTTP behavior, real-server `SqliteApiGameRepository` E2E flows, and adversarial malformed/pollution/tampering cases.

`server/api.test.ts` and `src/tests/sqliteApiE2E.test.ts` exercise real HTTP+SQLite (ephemeral port/temp DB). Some App integration tests still mock `fetch`; full Vite-proxy/manual two-mode smoke remains pending.

Full gate at `1990e73`: `npm run verify` PASS — 44 files / 367 tests. Note the App integration suite mocks `fetch`; the real-server adapter path is still deferred (Section 9, P3).

## 3. Data flow

### local (default)

```
App.tsx ──sync fast path──> localStorageGameRepository ──> save.ts ──> window.localStorage
                                                        hydrateSave on read
                                                        toPersistedSave on write
```

### sqlite-api (opt-in via `VITE_STORAGE_MODE=sqlite-api`; still not the default)

```
App (opt-in) ──async──> getGameRepository() ──> SqliteApiGameRepository
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

| Phase        | State                                                                                                                                                                                                                                 | Gate                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| P0 (landed)  | `local` is default; `sqlite-api` selectable only via `VITE_STORAGE_MODE=sqlite-api`; App boots through the factory with a sync fast path and a loading frame for async adapters; async writes are serialized with a generation guard. | `npm run verify` PASS — 45 files / 387 tests at current HEAD.                           |
| P1 (landed)  | `App.tsx` wired to `getGameRepository()` with async load/save/reset; `local` stays default; in-flight async saves queued and stale results discarded.                                                                                 | `appRepositoryIntegration.test.tsx` green; manual two-mode smoke outstanding.           |
| P2 (landed)  | Client tracks last known `savedAt`, sends `expectedSavedAt` on PUT when known, maps 409 to conflict result; App shows reload/overwrite conflict UX (no auto-overwrite). Force overwrite sends one unguarded write.                    | Unit + real-server E2E + App integration tests green; manual browser smoke outstanding. |
| P3 (partial) | Real-server adapter E2E exists (`src/tests/sqliteApiE2E.test.ts`); still need full Vite-proxy/app-mode smoke, restart-through-UI, and multi-tab/import race hardening.                                                                | Manual two-mode smoke + any remaining gap tests green.                                  |
| P4 (pending) | Opt-in default flip in a preview environment; keep a documented env switch back to `local`.                                                                                                                                           | Parity checklist + rollback verified.                                                   |
| P5 (pending) | Make `sqlite-api` the default only after P1–P4 pass and auth/ownership (or an explicit single-user decision) is recorded.                                                                                                             | Product owner sign-off.                                                                 |

Rollback at every phase: set `VITE_STORAGE_MODE=local`; local saves were never deleted.

## 10. Known gaps / risks

| #   | Gap / risk                                                                                                                                                                                                                                                        | Impact                                                                               | Mitigation                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 1   | ~~`App.tsx` uses `localStorageGameRepository` directly.~~ **Resolved at `1990e73`** — App boots through `getGameRepository()`; `sqlite-api` is no longer inert.                                                                                                   | None (closed).                                                                       | —                                                                                                  |
| 2   | ~~Client never sends `expectedSavedAt`.~~ **Resolved (P2)** — client tracks/sends `expectedSavedAt`; 409 surfaced as conflict; App offers reload/overwrite. Manual browser smoke still pending.                                                                   | Low residual (UX polish/manual verification).                                        | Verify in real sqlite-api dev session.                                                             |
| 3   | Adapter tests and `appRepositoryIntegration.test.tsx` mock `fetch`; HTTP tests cover the handler, not the adapter/proxy path.                                                                                                                                     | Client↔server contract regressions (URL shape, JSON envelope, hydration) undetected. | P3 (real-server adapter tests).                                                                    |
| 4   | Import-on-404 is a read-then-write race.                                                                                                                                                                                                                          | Two tabs could both import; last write wins.                                         | P2 conflict token + idempotent import marker.                                                      |
| 5   | `slotIdFromPath` regex is `[a-zA-Z0-9_-]{1,64}` but the client `encodeURIComponent`s arbitrary IDs.                                                                                                                                                               | Non-matching slot IDs 404 unexpectedly.                                              | Constrain/validate slot IDs on the client.                                                         |
| 6   | No auth/ownership. **Phase 10 hardening (b1fe959):** mutating endpoints now reject non-local `Origin` and require `Content-Type: application/json` for PUT/POST; POST alias retained but guarded. This mitigates browser cross-origin write CSRF; it is not auth. | Any local caller/process can still read/write all slots; no user identity.           | Section 8; keep loopback-only binding; add owner auth before public exposure.                      |
| 7   | Server ignores stored `schema_version` on read.                                                                                                                                                                                                                   | Older payloads are only fixed client-side by `hydrateSave`.                          | Document `hydrateSave` as the single upgrade point; add server-side version check later.           |
| 8   | `getGameRepository()` caches the adapter at module scope.                                                                                                                                                                                                         | Changing `VITE_STORAGE_MODE` requires a reload.                                      | Acceptable (build-time env); `resetGameRepositoryCache()` exists for tests.                        |
| 9   | ~~Async saves introduce ordering hazards in `update()`.~~ **Resolved at `1990e73`** — async writes go through a serialized queue and a generation guard drops stale results; resets invalidate in-flight saves.                                                   | None (closed).                                                                       | —                                                                                                  |
| 10  | ~~Async load failure could fail open into fresh-save overwrite.~~ **Resolved Phase 10 (b1fe959)** — `SqliteApiGameRepository.loadGame` throws on non-404 load errors; `App` shows blocking retry UI and does not mount writable session.                          | None (closed for this path).                                                         | —                                                                                                  |
| 11  | Reset can be resurrected by another tab re-importing local migration source after server delete.                                                                                                                                                                  | Deleted/reset save can reappear.                                                     | Add import tombstone/marker server-side; clear/mark local migration source after confirmed import. |
| 12  | `savedAt` is client-supplied, millisecond-resolution CAS token; not server-authoritative.                                                                                                                                                                         | Concurrent same-ms or predicted-stamp writes can bypass guard.                       | Server-generated monotonic revision/ETag with `If-Match`.                                          |
| 13  | Corrupt save recovery discards progress silently; server read can 500 on malformed payload JSON.                                                                                                                                                                  | Data loss/recovery UX gap.                                                           | Quarantine corrupt payload, surface recovery choice, guard server parse.                           |

## 11. Acceptance criteria for "ADR-001 persistence complete"

Status legend: `[x]` implemented and verified · `[~]` partially landed · `[ ]` deferred.

1. [x] `App.tsx` obtains its repository from `getGameRepository()` and uses the async contract; no direct `localStorageGameRepository` import in app code. _(landed `1990e73`)_
2. [~] `local` remains the default; `VITE_STORAGE_MODE=sqlite-api` works end-to-end through the Vite proxy with the real server. _(default confirmed; real-server smoke still outstanding — current coverage mocks `fetch`)_
3. [ ] Load, save, reset, and first-run import behave identically in both modes for the same slot. _(unit-level only; no end-to-end parity run)_
4. [x] Canonical truth is absent from every stored payload (localStorage and `save_slots.payload_json`) and re-derived on load — asserted by tests.
5. [~] Client sends `expectedSavedAt`; a stale write yields a handled `409` with a defined recovery path (no silent data loss). _(implemented: repo sends token, conflict result surfaced, App reload/overwrite UX; manual browser smoke pending)_
6. [~] `npm test` includes real-server integration tests (no mocked `fetch`) covering the adapter path: import-on-404, `409` conflict/recovery, restart recovery, and payload stripping. _(handler-level `server/api.test.ts` and `src/tests/sqliteApiE2E.test.ts` cover real HTTP+SQLite; full Vite-proxy/app-mode smoke still pending)_
7. [~] v1→v2 and localStorage→SQLite migrations are covered by automated tests, and local data is retained (rollback works). _(migration/import units and E2E covered; app-level migration UX not yet exercised)_
8. [x] `npm run verify` passes (lint, format, typecheck, tests, build). _(PASS — 45 files / 387 tests at current HEAD)_
9. [ ] Auth/ownership is either implemented or explicitly recorded as a deferred, documented single-user limitation with loopback-only binding. _(deferred; see Section 8)_
10. [ ] Rollout/rollback steps in Section 9 are executed and recorded in `docs/DECISIONS.md`.
