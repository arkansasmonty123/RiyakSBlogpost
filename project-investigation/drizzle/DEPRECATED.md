# Drizzle artifacts are deprecated / non-canonical (PROD-004, BUG-003)

The files in this directory (`schema.ts` and its stale generated `schema.js`,
`schema.d.ts` and source maps) **do not describe the live database**. They use
camelCase identifiers, while the real PostgreSQL schema uses snake_case, and
they are missing later additive migrations. Nothing in `src/` imports Drizzle.

**Do not** use these files to generate migrations or to run `drizzle-kit push`.
Generated drizzle-kit output from this directory would be incorrect and could
damage the database if applied.

## Canonical source of truth

- `migrations/000_baseline.sql` — full, schema-only snapshot of the canonical
  `investigation` database (verified identical to `scripts/ci-schema.sql`).
- `migrations/001_prod007_canonical_truth.sql`,
  `migrations/002_prod008_progression.sql`,
  `migrations/003_prod010_verdict_integrity.sql`,
  `migrations/004_p2_db_sessions.sql` — idempotent additive changes
  already reflected in the baseline.
- Runtime access is raw SQL in `src/db.ts`.
- Read-only verification: `npm run db:schema:verify`.

The artifacts are kept in place (rather than deleted) to avoid breaking any
external references or local tooling. New work must not extend them. See
`PROD-004-NOTES.md` for the full policy.
