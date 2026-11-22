# PROD-004 — Canonical schema / migrations source of truth (BUG-003)

**Date:** 2026-11-22  
**Status:** implemented; awaits orchestrator scrutiny/closure of BUG-003.  
**Scope:** schema alignment only. No destructive DB operation was performed and
no existing test behaviour was changed.

## Decision: raw SQL is canonical

| Concern | Decision |
|---|---|
| Runtime data access | Raw SQL in `src/db.ts` (unchanged). No ORM at runtime. |
| Canonical schema | `migrations/000_baseline.sql` — full schema-only snapshot of the live `investigation` DB. |
| Changes over time | Additive, idempotent SQL migrations: `001_prod007_canonical_truth.sql`, `002_prod008_progression.sql`, `003_prod010_verdict_integrity.sql`, `004_p2_db_sessions.sql` (durable sessions table). |
| CI bootstrap | `scripts/ci-schema.sql` + `scripts/ci-seed.sql` remain CI-only snapshots of the same canonical DB; they are not a competing source of truth. |
| Drizzle | Deprecated, non-canonical. `drizzle/schema.ts` drifted (camelCase vs live snake_case) and is not imported by `src/`. See `drizzle/DEPRECATED.md`. |
| Prisma | Config/CLI helpers are non-authoritative connection tooling only; no Prisma schema defines the DB. |
| Verification | `npm run db:schema:verify` — read-only check of migration ordering + expected tables/columns. |

Why this direction: the live database and `src/db.ts` already agree (snake_case),
all existing migrations are additive and idempotent, and all tests pass against
that state. Rewriting the app around Drizzle/Prisma would be a large, risky
change with no functional benefit for the MVP. The drift is resolved by making
the already-correct path explicit and quarantining the misleading artifacts.

## Baseline provenance (safe derivation)

1. Inspected live DB read-only: `information_schema.tables` reported 17 public tables.
2. Dumped live schema read-only: `pg_dump --schema-only --no-owner --no-privileges`.
3. Diffed that dump against `scripts/ci-schema.sql`: structurally identical.
   Only differences were pg_dump-version artifacts (`\restrict` meta-commands)
   and three informational `COMMENT ON COLUMN` statements, which were copied
   into the baseline for parity.
4. Created `migrations/000_baseline.sql` from that verified snapshot, with a
   header documenting provenance and a warning not to revert it to pre-001.

No `DROP`, `TRUNCATE`, `ALTER ... DROP`, data deletion, or schema push was run
against the live DB.

The baseline already includes the effects of migrations 001–004. Those files
remain in place and are idempotent (`ADD COLUMN IF NOT EXISTS` /
`CREATE TABLE IF NOT EXISTS`), so applying `000 -> 001 -> 002 -> 003 -> 004` to a
fresh database is safe and the later steps are no-ops. Do not hand-edit the
baseline back to a pre-001 shape.

## Applying the schema to a fresh database

```bash
psql -d investigation -f migrations/000_baseline.sql
psql -d investigation -f migrations/001_prod007_canonical_truth.sql
psql -d investigation -f migrations/002_prod008_progression.sql
psql -d investigation -f migrations/003_prod010_verdict_integrity.sql
psql -d investigation -f migrations/004_p2_db_sessions.sql
npm run db:schema:verify
```

For CI, `scripts/ci-schema.sql` and `scripts/ci-seed.sql` bootstrap the same
state; they are snapshots, not the place to author new schema changes.

## Verification script

`scripts/verify-schema.ts` (npm script `db:schema:verify`):

- checks that `migrations/000_baseline.sql` exists, migration prefixes are
  numeric, unique, increasing and start at 000;
- reads `information_schema.columns` for `public` and asserts all 18 canonical
  tables and their expected columns exist (including the PROD-007/008/010
  additions and the P2-SESSIONS `sessions` table);
- reports extra DB tables as informational, never as failures;
- writes nothing. Missing DB/connection errors are reported with a hint and a
  non-zero exit code.

It is included in `npm test` after the DB smoke test.

## Drizzle drift handling (least risk)

`drizzle/schema.ts`, `drizzle.config.ts` and `drizzle/DEPRECATED.md` now carry
explicit non-canonical/deprecation notices. The generated `.js`/`.d.ts`/map
artifacts were left in place (rather than deleted) to avoid breaking unknown
local references; they are documented as stale. `prisma7.config.ts` is likewise
marked as non-authoritative connection config. Nothing at runtime imports any
of these modules, so behaviour is unchanged. Future schema changes belong in a
new numbered SQL migration plus a refresh of `000_baseline.sql` snapshot notes
— never in Drizzle/Prisma.

## Evidence for BUG-003 closure

- Canonical path declared here and in `README.md`, `drizzle/DEPRECATED.md`,
  `IMPLEMENTATION_STATUS.md`, `QA-001-NOTES.md`.
- `migrations/000_baseline.sql` derived from a read-only live dump verified
  against `scripts/ci-schema.sql`.
- `npm run db:schema:verify` passes against the live DB (see task report for
  the executed command output).
- Full verification suite (`typecheck`, `test:smoke`, frontend build,
  `test:http`) re-run after the changes; see task report for results.
