# THE INVESTIGATION — API & database notes

This repository contains the Express/TypeScript API (`src/`), a Vite/React
frontend (`frontend/`), raw-SQL migrations (`migrations/`) and smoke/regression
harnesses (`scripts/`).

## Database schema — canonical source of truth (PROD-004 / BUG-003)

The authoritative schema is **raw SQL**, not an ORM definition:

- `migrations/000_baseline.sql` — full schema-only snapshot of the canonical
  `investigation` PostgreSQL database (snake_case identifiers).
- `migrations/001_prod007_canonical_truth.sql`,
  `migrations/002_prod008_progression.sql`,
  `migrations/003_prod010_verdict_integrity.sql`,
  `migrations/004_p2_db_sessions.sql` — idempotent additive changes,
  already reflected in the baseline. 004 adds the durable `sessions` table
  (SHA-256 token hash, never the raw cookie token) for DB-backed auth sessions.
- `src/db.ts` — the only runtime data-access layer; it issues raw SQL against
  those snake_case tables/columns.
- `scripts/ci-schema.sql` / `scripts/ci-seed.sql` — CI-only bootstrap snapshots.

**Drizzle and Prisma artifacts are non-canonical and deprecated.** In particular
`drizzle/schema.ts` is camelCase and drifted; do not run `drizzle-kit generate`
or `push` from it. See `drizzle/DEPRECATED.md` and `PROD-004-NOTES.md`.

Read-only verification of migration ordering and live tables/columns:

```bash
npm run db:schema:verify
```

Apply the canonical schema to a fresh DB (additive; see PROD-004-NOTES.md):

```bash
psql -d investigation -f migrations/000_baseline.sql
psql -d investigation -f migrations/001_prod007_canonical_truth.sql
psql -d investigation -f migrations/002_prod008_progression.sql
psql -d investigation -f migrations/003_prod010_verdict_integrity.sql
psql -d investigation -f migrations/004_p2_db_sessions.sql
```

## Common commands

```bash
npm run typecheck
npm run test:smoke      # requires local Postgres `investigation` DB
npm run test:http       # spawns API, runs HTTP smoke tests
npm run case:validate   # read-only lint of seeded case content (GAP-15)
npm test                # all of the above plus db:schema:verify
cd frontend && npm run build
```

Seeded case data (solvability, reference integrity, safe-DTO allowlists) is
linted read-only by `npm run case:validate`; see `GAP-15-NOTES.md`. The check is
also wired as a separate step in `.github/workflows/ci.yml`.
