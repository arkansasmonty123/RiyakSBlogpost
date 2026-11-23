# M8 Wave 7 — Deployment & Beta Readiness Runbook

**Status**: Beta-readiness plan and operator checklist. **No public deployment is authorized by this document.** All W6 operator conditions (see `M8-W6-GATE-REPORT.md`) plus the W7 go/no-go checklist below must be satisfied and reviewed by a human before any beta invitation or public exposure.

**Scope**: `project-investigation/` — Express/TypeScript API (`src/`), Vite/React frontend (`frontend/`), raw-SQL migrations (`migrations/`), smoke harnesses (`scripts/`).

---

## 1. What W7 added (additive, no schema changes)

| Area | Artifact | Notes |
|---|---|---|
| Health/readiness | `GET /api/health` | `{status, timestamp, version, uptimeSeconds}`; optional `db` probe via `HEALTH_DB_CHECK=true` or `?db=1` (503 + `status:'degraded'` on DB failure). No secrets. |
| Public config | `GET /api/config` | `{feedbackUrl, betaAccessRequired, version}`. No secrets. |
| Legal/privacy | `/privacy`, `/terms` frontend routes | Static, public, no trackers/embeds. Footer links on every screen. |
| Feedback | `FEEDBACK_URL` env | Any `https://…` or `mailto:` destination. No third-party integration. Placeholder default must be replaced before beta. |
| Data export | `GET /api/me/export` | Auth-required, session-scoped, explicit allowlist. Player-owned data only; no canonical truth, hidden evidence, password hash, tokens or evaluation internals. |
| Account deletion | `POST /api/me/delete` (and `DELETE /api/me`) | Auth-required, mandatory `{confirm:"DELETE"}`, transaction, removes owned rows + sessions + user. Shared content untouched. |
| Beta gate | `BETA_ACCESS_CODE` env | Optional. When set, `POST /api/register` requires `betaAccessCode`. Off by default (dev/CI unaffected). |
| Docs/config | `.env.example`, this runbook, `README.md` | Operator-facing configuration and procedures. |

---

## 2. Reproducible production configuration

1. Copy `.env.example` → `.env` on the host (never commit it). Populate **every** value marked for production below.
2. Install pinned dependencies with the lockfiles:

   ```bash
   cd project-investigation
   npm ci
   npm ci --prefix frontend
   ```

3. Environment variables (full reference in `.env.example`):

   | Variable | Production value / guidance |
   |---|---|
   | `DATABASE_URL` | `postgresql://USER:PASSWORD@HOST:5432/investigation` with TLS as available. Never reuse smoke credentials. |
   | `NODE_ENV` | `production` — enables Secure cookies and strict startup warnings. |
   | `PORT` | Internal HTTP port (e.g. `3000`); not exposed directly to the internet. |
   | `FRONTEND_URL` | Exact deployed frontend origin, e.g. `https://app.example.com`. Drives CORS + CSRF allowlist. |
   | `ALLOWED_ORIGINS` | Comma-separated extra trusted origins, if any. |
   | `CSRF_ORIGIN_CHECK` | `true` (default). Never disable in production. |
   | `JSON_BODY_LIMIT` | `1mb` (default) is ample. |
   | `RATE_LIMIT_ENABLED` | `true`. Tighten `AUTH_RATE_MAX`, `CHAT_RATE_MAX`, `WRITE_RATE_MAX` (dev defaults are intentionally generous). |
   | `USE_LLM` | `false` for deterministic local replies, or `true` with an explicitly configured provider. Keys only via env — never committed. |
   | `LLM_*` / `GEMINI_API_KEY` / `LLM_FAILOVER_*` | See `.env.example`. Set a dedicated `LLM_FAILOVER_API_KEY` when failover is configured. |
   | `APP_VERSION` | Release tag reported by `/api/health` and `/api/config`. |
   | `FEEDBACK_URL` | **Required before beta.** Real `https://` form/board or `mailto:` inbox. |
   | `BETA_ACCESS_CODE` | **Required for closed beta.** Shared invitation code; treat as a secret, rotate if leaked. Leave unset for dev/tests. |
   | `HEALTH_DB_CHECK` | Optional `true` if the platform readiness probe should fail on DB loss. |

4. Hosting expectations:
   - Run the API behind a reverse proxy/ingress that terminates **TLS** and forwards to the internal HTTP port. Set `NODE_ENV=production` so session cookies carry `Secure`.
   - Serve the built frontend (`npm run build --prefix frontend` → `frontend/dist/`) as static files on the `FRONTEND_URL` origin. Proxy `/api/*` to the API service so the browser uses same-origin cookies, or configure CORS + `SameSite` explicitly if split across origins.
   - Configure the platform to trust the ingress proxy for client IPs if relying on DB-backed rate limits (`req.ip`); otherwise all clients may share one bucket.
   - Do not expose the database port publicly. Use a private network and a least-privilege DB role.

---

## 3. Database provisioning and migrations

PostgreSQL >= 15 (CI uses 16). The canonical schema is **raw SQL** — see `README.md`; Drizzle/Prisma artifacts are deprecated and must not be used to push schema.

From an empty database, apply in order (idempotent additive migrations; `000_baseline.sql` includes effects of 001–004, 012 effects are separate):

```bash
export DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/investigation"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/000_baseline.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/001_prod007_canonical_truth.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/002_prod008_progression.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/003_prod010_verdict_integrity.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/004_p2_db_sessions.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/005_p2_db_rate_limits.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/006_m2_knowledge.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/007_m3_knowledge_quality.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/008_m4_reality_map.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/009_m5_perspective_engine.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/010_m6_living_investigations.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/011_m7_discovery_knowledge.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/012_m8_onboarding.sql
```

Seed shared content (idempotent; safe to re-run):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f seed.sql
npx tsx scripts/seed-extra-cases.ts
npx tsx scripts/seed-knowledge.ts
npx tsx scripts/seed-perspectives.ts
npx tsx scripts/seed-case-events.ts
npx tsx scripts/seed-discovery-clues.ts
```

Verify before go-live:

```bash
npm run db:schema:verify   # canonical table/column check
npm run case:validate      # 25 cases / 202 evidence
npm run knowledge:validate && npm run reality-map:validate \
  && npm run perspectives:validate && npm run case-events:validate \
  && npm run discovery-clues:validate
```

> **Known pre-existing note**: a fresh-bootstrap FK ordering issue in the CI snapshot (`sessions` FK before `users` PK) was worked around locally; the CI bootstrap applies `scripts/ci-schema.sql` first. Validate the exact bootstrap path used in production on an empty DB before relying on it.

---

## 4. Secrets handling

- All secrets (`DATABASE_URL`, LLM keys, `BETA_ACCESS_CODE`) come from environment variables injected by the platform's secret manager. None are hardcoded; none are returned by any endpoint (verified by smoke tests for `/api/health` and `/api/config`).
- Session tokens are random 32-byte values stored only as SHA-256 hashes in `sessions`; the raw token lives solely in the httpOnly cookie.
- Rotate `BETA_ACCESS_CODE` by changing the env var and restarting the API. Already-registered users are unaffected (the gate applies only at registration).
- Never paste real credentials into issue reports, logs, or this runbook.

---

## 5. Health checks and monitoring

- Liveness: `GET /api/health` → `200 {status:'ok', timestamp, version, uptimeSeconds}`. Use this for process restarts.
- Readiness: `GET /api/health?db=1` (or set `HEALTH_DB_CHECK=true`) → adds `db:'ok'`; returns `503` with `db:'unavailable'` when the database is unreachable.
- Logs: Morgan combined HTTP log lines plus structured app logs. Alert on:
  - repeated `[security] Production configuration warnings` at startup,
  - `[rate-limit] store error (failing open)` (DB-backed limiter degraded),
  - `LLM-METRICS` lines with elevated fallback/failover rates or latency,
  - spikes in 401/403/429/5xx,
  - any `sweep failed` / `scheduler` errors.
- Metrics are not exported as a Prometheus endpoint in this MVP; use ingress/container metrics plus log-based alerts. Structured logging is an accepted follow-up (W6 R-01).

---

## 6. Backup, restore, and rollback

**Backup (before every deploy and at least daily during beta):**

```bash
pg_dump --format=custom --no-owner --no-privileges \
  "$DATABASE_URL" -f "backup-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Store backups off-host with restricted access; verify restore on a staging DB regularly:

```bash
createdb investigation_restore_test
pg_restore --clean --if-exists --no-owner --no-privileges \
  -d "postgresql://…/investigation_restore_test" backup-<timestamp>.dump
npm run db:schema:verify   # point DATABASE_URL at the restored DB
```

**Rollback (application):** redeploy the previous image/build tag and restart. Migrations are additive and idempotent, so rolling back code does not require reverting the schema. If a migration introduced incompatible data, restore the last known-good backup into a new database and repoint `DATABASE_URL`. Never run destructive SQL against the live beta DB without explicit approval and a verified backup.

**Data deletion caveat:** account deletion is irreversible by design (`POST /api/me/delete`). Backups taken before deletion will still contain the deleted rows until they age out; document retention windows to beta users if required.

---

## 7. Beta access controls

- Closed beta: set `BETA_ACCESS_CODE` on the API. The registration form shows an access-code field (driven by public `GET /api/config`), and `POST /api/register` rejects missing/incorrect codes with `403`. Login and existing sessions are unaffected.
- Distribute the code only to invited testers. Treat it as a shared secret; rotate on suspected leakage.
- Keep `FEEDBACK_URL` pointed at a monitored inbox/board. Collect feedback through it; no third-party analytics are included.
- Rate limits and the CSRF origin check remain enabled during beta. Do not relax them to "fix" tester friction without a documented decision.

---

## 8. Verification before go-live (run from `project-investigation/`)

```bash
npm run typecheck
npm run build --prefix frontend
npm run test:http          # 133 tests (127 baseline + 6 W7)
npm run db:schema:verify
npm run case:validate
npm run knowledge:validate && npm run reality-map:validate \
  && npm run perspectives:validate && npm run case-events:validate \
  && npm run discovery-clues:validate
npm audit                  # document any accepted findings (W6 F8)
```

In a browser at desktop and mobile widths, confirm: `/privacy` and `/terms` render while signed out, the footer links work, the registration form shows/hides the beta code field according to `BETA_ACCESS_CODE`, export downloads JSON, and the delete confirmation cannot be triggered by a wrong phrase.

---

## 9. Go / No-Go checklist

**No-go until every item is checked by an operator:**

- [ ] W6 conditions satisfied: `NODE_ENV=production` + TLS, tightened rate limits, correct `FRONTEND_URL`/`ALLOWED_ORIGINS`, CSRF on, dedicated LLM failover key (if used), `npm audit` reviewed.
- [ ] Fresh-DB bootstrap dry run completed: all migrations + seeds + `db:schema:verify` pass on an empty database.
- [ ] `FEEDBACK_URL` set to a real, monitored destination (placeholder default removed).
- [ ] `BETA_ACCESS_CODE` set and distributed only to invited testers (closed beta), or an explicit decision recorded to run an open beta.
- [ ] `APP_VERSION` set; `/api/health` and `/api/health?db=1` verified through the ingress.
- [ ] `/privacy` and `/terms` reviewed by a human for accuracy; footer links reachable while signed out.
- [ ] Export verified to contain only the tester's own data (spot-check a seeded account; confirm no canonical/hidden fields).
- [ ] Delete verified in staging: confirmation guard, session revocation, scoped removal, shared case content preserved.
- [ ] Backup created and restore tested; rollback image/build tag identified.
- [ ] Monitoring/alerts for the signals in §5 configured and tested.
- [ ] Full verification suite (§8) green.
- [ ] Human go/no-go decision recorded in `project-management/ORCHESTRATION-LOG.md`.

**Public deployment remains explicitly out of scope.** This runbook enables a controlled, limited beta only after the checklist is complete; it is not authorization for a public launch.
