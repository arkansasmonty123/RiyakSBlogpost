# P2-RATE-LIMITS — Durable DB-backed rate limiting

**Date:** 2026-11-23  
**Scope:** replace the process-local in-memory `Map` rate-limit store with a
durable, shared PostgreSQL-backed fixed-window counter without changing the
externally observable rate-limiting behavior.

## What changed

- **Migration `migrations/005_p2_db_rate_limits.sql`** (additive, idempotent):
  creates `public.rate_limits` (`key_hash` PK, `window_start`, `reset_at`,
  `count`, `created_at`) and an index on `reset_at`. No existing table, column
  or row is modified or deleted.
- **Schema snapshots:** the table + index are baked into
  `migrations/000_baseline.sql` and `scripts/ci-schema.sql` so fresh DBs and CI
  get it from the schema snapshot; migration 005 is also applied explicitly in
  `.github/workflows/ci.yml` (idempotent) for defence in depth.
- **`scripts/verify-schema.ts`:** `rate_limits` added to `EXPECTED_TABLES`
  (5 columns). Expected totals are now 19 tables / 171 columns.
- **`src/db.ts`:** new `hashRateLimitKey()`, `RateLimitState`,
  `consumeRateLimit()` and `deleteExpiredRateLimits()`.
- **`src/server.ts`:** the limiter middleware now calls `consumeRateLimit()`
  instead of mutating a `Map`; the periodic sweeper calls
  `deleteExpiredRateLimits()`. All route coverage and headers are unchanged.

## Behavior preserved

- Same env knobs and defaults: `RATE_LIMIT_ENABLED`, `AUTH_RATE_WINDOW_MS`/
  `AUTH_RATE_MAX`, `CHAT_RATE_WINDOW_MS`/`CHAT_RATE_MAX`,
  `WRITE_RATE_WINDOW_MS`/`WRITE_RATE_MAX`.
- Same protected routes: `POST /api/register`, `POST /api/login`,
  `POST /api/investigations/:id/chat`, `POST /api/investigations/:id/messages`,
  `POST /api/investigations/:id/journal`.
- Same response contract: `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
  `429` + `Retry-After` + `{ error: 'Too many requests. Please try again later.' }`
  on over-limit; `RATE_LIMIT_ENABLED=false` bypasses limiting entirely.
- Same per-`<limiter>:<client-ip>` fixed-window semantics and reset math.

## Behavior improved / notes

- Counters survive process restarts and are shared across instances (the old
  `Map` was process-local).
- A single atomic `INSERT ... ON CONFLICT (key_hash) DO UPDATE ... RETURNING`
  advances the counter, so concurrent requests cannot race on read-modify-write.
- Only `SHA-256("<limiter>:<client-ip>")` is persisted — no raw client IP is
  stored. The digest is the PK, so lookup stays O(1).
- If the rate-limit store errors, the middleware **fails open** (allows the
  request) and logs the error, so a limiter DB hiccup cannot take down the API.
- Expired windows are pruned by an unref'd periodic sweeper using the indexed
  `reset_at` column; cleanup is opportunistic and never destructive to live
  data.
- Deployment note: configure Express `trust proxy` so `req.ip` is the real
  client IP behind a proxy/load balancer; otherwise all clients share one
  bucket. A Redis store would reduce DB write load at very high throughput.

## Tests added

- `scripts/smoke-db.ts`: uses a unique hashed key to assert the counter starts
  at 1, increments persistently to 2 in the same window, keeps stable window
  bounds, resets to 1 in a new window with a later reset, and cleans up its row.
  Deterministic (no wall-clock sleeps / timing sensitivity).
- The existing HTTP test "Auth responses expose rate-limit headers" still
  covers the middleware path end-to-end.

## Verification (executed)

All from `project-investigation/` (frontend build from `frontend/`):

- `npm run typecheck` — PASS
- `npm run db:schema:verify` — PASS (19/19 tables, 171/171 columns; migrations 0→5)
- `npm run test:smoke` — PASS (`smoke-db: ok`)
- `cd frontend && npm run build` — PASS
- `npm run test:http` — PASS (56/56)
- `npm run case:validate` — PASS

Live-DB sanity check after `test:http`: 3 `rate_limits` rows, all 64-char
SHA-256 hex digests (no raw IPs), with non-zero counts — confirming the
DB-backed limiter is active and privacy-preserving.
