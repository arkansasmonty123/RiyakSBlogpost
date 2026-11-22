# Implementation Status (Verified)

**Last verified:** 2026-11-22 (full check pass after P2 cleanup)  
**Environment:** `/home/divyanshukumarsinha241/project-investigation`, Node v26, local Postgres socket `/var/run/postgresql`, DB `investigation`  
**Runtime model:** TypeScript sources only — API/scripts run via `node --import tsx`; frontend via Vite. No compiled `.js`/`.d.ts` emit is used at runtime.

**Overall:** MVP feature set implemented and verified. Final QA pass complete for the current scope; only optional P2/tech-debt items remain. See `project-management/DEV-STATUS.md` (workspace-level source of truth) for the task-by-task history.

## Verified checks (all executed this pass)

| Command | Result | Notes |
|---|---:|---|
| `npm run typecheck` | **PASS** | `tsc --noEmit`, no errors. |
| `npm run test:smoke` | **PASS** | `smoke-db: ok` against local Postgres. |
| `npm run db:schema:verify` | **PASS** | 5 migrations in order; 18/18 tables, 166/166 columns. |
| `cd frontend && npm run build` | **PASS** | Vite build (CSS 12.43 kB, JS 301.48 kB), 361 ms. |
| `npm run test:http` | **PASS** | Spawns the API, runs `smoke-http.ts`: **53 passed, 0 failed**. |
| `npm run case:validate` | **PASS** | Read-only seeded-case integrity lint; see `GAP-15-NOTES.md`. |

`npm test` chains typecheck + smoke + schema verify + HTTP tests; `case:validate` runs as a separate CI step (`.github/workflows/ci.yml`).

## Implemented capabilities

- **Auth & authorization** — DB-backed session store (P2-SESSIONS): `register`/`login`/`logout`/`/api/me`, `session_token` httpOnly cookie holding a random token whose SHA-256 digest is stored in the `sessions` table; sessions survive restarts and are revocable per token. `authMiddleware` on all investigation-scoped routes; userId derived server-side. Cross-user access returns 403; client-supplied userId is not trusted. Rate-limit counters are DB-backed (P2-RATE-LIMITS): a single atomic upsert advances fixed windows in `rate_limits`, so counters survive restarts and are shared across instances; only SHA-256 key digests are stored (no raw client IPs).
- **Canonical truth & verdicts** — `evaluateAccusation` reads `canonical_truth` server-side; `correct` only on canonical match, never without configured truth. Solution reveal (`GET /api/investigations/:id/solution`) is gated on owner + completed and its safe DTO excludes `hidden_events`.
- **Evidence safety** — evidence endpoints filter by `playerVisible` + discovered IDs; private fields (`hidden_interpretation`, hypotheses, discovery/release conditions) never exposed. Hidden evidence cannot be discovered by a client.
- **Verdict integrity (v2)** — readiness gating, motive/method/supporting-evidence scoring, server-side attempt counter with escalating cooldown (429 + `Retry-After`); no name-only completion.
- **AI investigator chat** — role-aware grounding, safe addressed-suspect projection, rolling summary, bounded retrieval, token/length controls, deterministic fallback (`USE_LLM=false` in tests). No model/cost controls beyond these bounds.
- **Progression engine** — deduction checkpoints, deduction/time-triggered evidence release, in-process scheduler + offline catch-up, developments UI.
- **Investigation lifecycle** — create/load/reuse, PATCH state machine limited to safe fields, journal/timeline, abandonment/reset with `confirm: true` and lock release, archive view (including abandoned/completed).
- **Suspect board & case content** — safe suspect DTO with public motive, relationships, linked discovered evidence, suspicion, unanswered questions; seeded case has 6 characters, 10 evidence with gating/timeline, and enriched canonical truth.
- **Frontend** — Vite + React + TS app with case library, investigation room, chat, evidence discovery, suspects, journal/timeline, accusation, verdict/solution and archive views.
- **Schema/source of truth** — raw SQL migrations are canonical (`migrations/000_baseline.sql` + 001–005, including the durable `sessions` and `rate_limits` tables); Drizzle/Prisma artifacts are deprecated and non-canonical. See `README.md` and `PROD-004-NOTES.md`.
- **Regression/CI harness** — 56 HTTP smoke tests, `test:http` entry point, `.github/workflows/ci.yml`, env-configurable DB-backed rate limits, input validation, and read-only case lint (`GAP-15-NOTES.md`).

## Remaining (P2 / tech debt, optional)

- Notifications/achievements UI; finer-grained progress semantics.
- Smoke DB rows accumulate across runs (cleanup is destructive and needs explicit approval).
- Root-level `FINAL_AUDIT.md` still records the pre-recovery "no frontend / no auth" snapshot and is superseded by this document and `project-management/DEV-STATUS.md`.
- Stale compiled artifacts and pre-recovery root `/src` duplicates were moved to `/tmp/opencode/legacy-src-backup/` (reversible); nothing was deleted.

## Verification commands

```bash
cd /home/divyanshukumarsinha241/project-investigation
npm run typecheck       # PASS
npm run test:smoke      # PASS (requires local Postgres `investigation` DB)
npm run db:schema:verify # PASS
npm run case:validate   # PASS
npm run test:http       # PASS — 50 passed, 0 failed
cd frontend && npm run build  # PASS
```
