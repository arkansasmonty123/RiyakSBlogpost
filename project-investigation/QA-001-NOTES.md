# QA-001 — Security & regression harness hardening (GAP-11/17)

**Date:** 2026-11-22  
**Scope:** rate limiting, input validation, client message-role restriction, repeatable HTTP test harness, CI workflow.

## Rate limiting

A dependency-free fixed-window limiter protects (counters are now durable in the `rate_limits` table — P2-RATE-LIMITS):

| Endpoints | Env knobs | Dev default |
|---|---|---|
| `POST /api/register`, `POST /api/login` | `AUTH_RATE_WINDOW_MS`, `AUTH_RATE_MAX` | 500 / 15 min per IP |
| `POST /api/investigations/:id/chat` | `CHAT_RATE_WINDOW_MS`, `CHAT_RATE_MAX` | 120 / min per IP |
| `POST /api/investigations/:id/messages`, `/journal` | `WRITE_RATE_WINDOW_MS`, `WRITE_RATE_MAX` | 600 / min per IP |

Responses include `X-RateLimit-Limit` / `X-RateLimit-Remaining`; over-limit requests get `429` plus `Retry-After`. `RATE_LIMIT_ENABLED=false` disables limiting (e.g. for load tests). Defaults are intentionally generous for local smoke runs from one IP; tighten them for a public deployment.

Counters are persisted via a single atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` in `consumeRateLimit()` (migration `005_p2_db_rate_limits.sql`), so they survive process restarts and are shared across replicas. Only SHA-256 digests of the `<limiter>:<client-ip>` key are stored — no raw client IP is written. Expired windows are pruned by a periodic sweeper (`reset_at` indexed). A store error fails open (request allowed) with a log so a rate-limit DB hiccup cannot take down the API.

**Deployment note:** configure Express `trust proxy` so `req.ip` is the real client IP behind a proxy/load balancer; otherwise all clients share one bucket. For very high-throughput deployments, a Redis-backed store would reduce DB write load.

## Input validation (400 on invalid input)

- `register`: valid email syntax (≤254 chars) and password length `MIN_PASSWORD_LENGTH`–128 (default min 8; env-configurable).
- `messages`: `role` must be exactly `'player'`; content 1–10,000 chars. `investigator`/`system`/arbitrary roles are rejected — AI replies remain server-owned via `/chat`.
- `journal`: `entryType` 1–100 chars, `content` 1–10,000 chars, `relatedEvidenceIds` ≤100 string ids.
- `chat`: `message` 1–4,000 chars.

## Sessions (superseded by P2-SESSIONS)

Originally an in-memory `Map` with a 24h TTL (lost on restart, not shared, not revocable). Sessions are now durable in the `sessions` table (migration `004_p2_db_sessions.sql`): only a SHA-256 digest of the random `session_token` is stored, sessions survive restarts, are shared across instances, and are revocable per token. Refresh tokens remain out of scope.

## Regression harness / CI

- `npm run test:http` → `scripts/run-http-tests.ts` spawns the API on an ephemeral port, waits for `/api/health`, runs `scripts/smoke-http.ts` with `SMOKE_BASE_URL`, then always tears the server down. Optional `HTTP_TEST_PORT` pins a port.
- `npm test` now runs typecheck + DB smoke + HTTP smoke.
- `.github/workflows/ci.yml` (workspace root): Postgres 16 service, `npm ci` (API + frontend), DB bootstrap, typecheck, `test:smoke`, frontend build, `test:http`.
- `scripts/ci-schema.sql` + `scripts/ci-seed.sql` are CI-only bootstrap snapshots captured from the canonical local seed DB. They let CI reproduce the seeded state before `seed.sql` is applied. **Canonical source of truth is now declared in `PROD-004-NOTES.md` / `README.md`:** raw SQL `migrations/000_baseline.sql` + 001–004, verified read-only via `npm run db:schema:verify` (included in `npm test`). Drizzle/Prisma artifacts are deprecated and non-authoritative.
