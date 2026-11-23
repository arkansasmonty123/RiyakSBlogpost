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

## Security / deployment hardening (M8-W6)

Before any public deployment, copy `.env.example` to `.env` and review the
**M8-W6 production hardening** section:

- Set `NODE_ENV=production` (enables Secure session cookies and startup warnings)
  and terminate TLS at the ingress proxy.
- Set `FRONTEND_URL` (and optional `ALLOWED_ORIGINS`) to the exact deployed
  frontend origin(s). The server enforces a lightweight Origin/Referer check on
  mutating requests; requests with no Origin/Referer (CLI/services) are allowed
  by design. Disable only in isolated test harnesses with `CSRF_ORIGIN_CHECK=false`.
- Tighten `AUTH_RATE_MAX` / `CHAT_RATE_MAX` / `WRITE_RATE_MAX` (the dev defaults
  are deliberately generous), keep `RATE_LIMIT_ENABLED=true`, and set
  `JSON_BODY_LIMIT` (default `1mb`).
- If using LLM failover, set a dedicated `LLM_FAILOVER_API_KEY` so the primary
  provider key is not reused.

The server logs explicit warnings for unsafe production configuration at
startup. Finding-by-finding resolutions and the `npm audit` summary are in
`project-management/M8-W6-SECURITY-AUDIT.md`.

## Beta readiness (M8-W7)

`project-management/M8-DEPLOYMENT-RUNBOOK.md` is the operator runbook for a
**controlled beta only** — it is not authorization for a public deploy. It
covers reproducible config, migrations/seeds, backups/restore, rollback,
monitoring, beta access and the go/no-go checklist.

New optional env settings (see `.env.example`): `APP_VERSION`, `FEEDBACK_URL`,
`BETA_ACCESS_CODE` (closed-beta register gate, off by default) and
`HEALTH_DB_CHECK`. Public endpoints: `GET /api/health` (liveness/readiness) and
`GET /api/config` (safe feedback/beta metadata). Authenticated,
session-scoped self-service endpoints: `GET /api/me/export` (player-data JSON,
no canonical/hidden content) and `POST /api/me/delete` (requires
`{ confirm: "DELETE" }`). The frontend exposes `/privacy`, `/terms` and a
footer feedback link; the Progress page offers export and account deletion.
