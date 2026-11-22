# PROD-008 — Async progression engine (MVP 11-13 / GAP-01)

Wires the deterministic progression engine described in PRD §§8, 9 and 17.
Evidence is never invented: the engine only authorizes releases that are already
authored into each case's `discovery_conditions` / `release_conditions`. It never
reads `canonical_truth`, and no API response contains hidden evidence fields.

## Apply migration

```bash
psql -d investigation -f migrations/002_prod008_progression.sql
```

Idempotent and additive. Tables: `evidence_discoveries` (release timestamps +
UNIQUE idempotency guard), `deduction_checkpoints` (completed theories),
`investigation_actions` (performed investigative actions), `development_log`
(player-safe catch-up feed). All rows cascade on investigation deletion.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/investigations/:id/checkpoints` | Spoiler-free checkpoint prompts, authored investigative actions, completion count. |
| `POST` | `/api/investigations/:id/theory` | `{checkpointId, theory, supportingEvidence[], confidence?}`. Evaluates against player-visible evidence only, stores the checkpoint, runs releases, returns safe feedback + newly released evidence. |
| `POST` | `/api/investigations/:id/investigate` | `{action}`. Records an authored action and runs releases. |
| `GET` | `/api/investigations/:id/developments` | Chronological, player-safe development feed (offline catch-up). |
| `GET` | `/api/investigations/:id/scheduled-events` | Now projects only safe fields (`associatedEvidence` / `triggerCondition` are removed). |

Hardening: clients cannot attach evidence or author narrative text on
`POST /events`, and cannot set `releaseStatus` to `released`/`processed`; those
transitions are engine-owned. `discover-evidence` still refuses hidden items.

## Release model

For each not-yet-available evidence item the engine checks (in a single
transaction, fixed-point loop):

1. **Trigger**: a completed checkpoint id from `discovery_conditions.requires`
   (deduction), a recorded `discovery_conditions.action` (investigation), an
   elapsed `discovery_conditions.after_minutes` (time), or a due scheduled event
   whose `associated_evidence` is this item.
2. **Prerequisites**: every `release_conditions.after` entry (evidence source or
   id) must be available (briefing-visible or previously discovered/released).
3. **Delays**: `release_conditions.min_minutes` (and `after_minutes` for time
   items) must have elapsed since the latest prerequisite became available, or
   since investigation start when there is no prerequisite.

On success it inserts an `evidence_discoveries` row (`ON CONFLICT DO NOTHING`),
appends the id to `investigations.discovered_evidence_ids`, appends a development
entry, and marks the associated event `released`. Re-running is idempotent and
cannot duplicate an item. Release DTOs use the existing safe projection only.

## Scheduler and catch-up

- `initializeProgression` seeds one persisted scheduled event per time-based
  evidence item when an investigation is created.
- `processProgression(id)` runs (a) on every owned-investigation request via the
  ownership middleware, (b) on `GET /investigations/active`, and (c) from the
  in-process `setInterval` sweep (`PROGRESSION_INTERVAL_MS`, default 60s).
- This makes offline progress apply on the player's next read even after a
  server restart: events and delays live in Postgres, not in process memory.

**MVP limits:** the timer is single-process and best-effort; there is no
distributed worker/queue, no push notifications, and no per-user notification
preferences yet. Catch-up on read is the durability mechanism.

## UI

Investigation Room gains a **Deductions** tab (checkpoint prompts, theory form
with supporting-evidence picker, investigative action buttons) and a **Recent
developments** panel above the tabs. After a release the client re-reads
investigation/evidence/checkpoints/developments from the server; it never
computes progression locally.

## Verification (executed 2026-11-22)

- `npm run typecheck` — PASS
- `npm run test:smoke` — PASS
- `cd frontend && npm run build` — PASS
- HTTP smoke with dedicated server on port 3100 (`SMOKE_BASE_URL`) —
  **27 passed, 0 failed** (22 pre-existing + 5 new PROD-008 tests covering
  checkpoint safety, deterministic deduction release + idempotency, no canonical
  leak in theory responses, due-event catch-up with development log, and client
  event-status spoofing).
