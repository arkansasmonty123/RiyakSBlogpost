// =============================================================================
// DEPRECATED / NON-AUTHORITATIVE — PROD-004 (BUG-003)
// -----------------------------------------------------------------------------
// Do NOT run `drizzle-kit generate`, `migrate` or `push` with this config.
// It points at drizzle/schema.ts, which is camelCase and drifted from the
// canonical snake_case schema. Drizzle is not used at runtime and drizzle-kit
// output produced from here would be WRONG.
//
// Canonical source of truth (raw SQL only):
//   migrations/000_baseline.sql  (full current schema snapshot)
//   migrations/001..003_*.sql    (idempotent additive migrations)
// Read-only verification: npm run db:schema:verify
// See PROD-004-NOTES.md and drizzle/DEPRECATED.md before changing this file.
// =============================================================================
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './drizzle/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/investigation',
  },
});
