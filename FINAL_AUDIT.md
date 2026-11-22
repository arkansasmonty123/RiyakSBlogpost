# FINAL AUDIT (Factual)

**Date:** 2026-11-22  
**Project:** `/home/divyanshukumarsinha241/project-investigation`  
**Status:** NOT MVP-COMPLETE / PARTIAL STABILIZATION

## Executed checks

| Check | Result | Notes |
|---|---:|---|
| `npm run typecheck` | PASS | `tsc --noEmit` completed with no errors in project. |
| `npm run test:smoke` | PASS | `tsx scripts/smoke-db.ts` passed against local Postgres (`/var/run/postgresql`, DB `investigation`). |

## Verified fixes present

- TypeScript build is clean after typing Express handlers (pragmatic `any` typing for stabilization).
- Smoke script is runnable via `tsx` after restoring project `node_modules`.
- DB access layer maps snake_case DB columns to camelCase and uses safe evidence DTOs excluding hidden interpretation/hypothesis fields.
- `GET /api/evidence/:evidenceId` requires `userId` and checks active investigation/case/visibility before returning safe DTO.
- Accusation evaluation resolves investigation→case and does not return `correct` without configured canonical truth.

## Claims corrected / not verified

- **No frontend present** in `project-investigation/src/frontend`.
- **No session auth middleware / complete authz** across routes; most endpoints trust client-supplied IDs.
- **No 7-case HTTP integration smoke suite** verified in this pass; only minimal DB smoke script exists.
- **Canonical verdict not complete.** `canonical_truth` table exists but is not wired to the real playable case for deterministic correct verdicts.
- **MVP not playable end-to-end.** Missing UI, AI chat, progression engine, offline catch-up/notifications, full tests.

## Remaining priorities

1. Add real auth/session/token middleware and ownership guards on all investigation-scoped routes.
2. Wire canonical truth to real case IDs and implement deterministic verdict evaluation without leaking solution.
3. Add HTTP integration tests for authz, evidence leakage, and accusation behavior.
4. Align schema/migrations/source-of-truth (Drizzle/raw SQL/live DB).
5. Build PRD MVP features (UI, AI chat with boundaries, progression engine).