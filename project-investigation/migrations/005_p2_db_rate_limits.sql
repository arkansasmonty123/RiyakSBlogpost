-- P2-RATE-LIMITS: durable, DB-backed fixed-window rate-limit counters.
--
-- ADDITIVE ONLY. Creates one new table plus one index. No existing table,
-- column or row is modified or deleted. Idempotent (IF NOT EXISTS), so it is
-- safe to re-run against any environment.
--
-- Design:
--   * key_hash is the PRIMARY KEY. It is SHA-256 of "<limiter>:<client-ip>",
--     never the raw key/IP, so no client identifier is persisted in plaintext.
--   * window_start / reset_at bound the current fixed window. The application
--     performs a single atomic INSERT ... ON CONFLICT DO UPDATE (RETURNING) so
--     concurrent requests share one authoritative counter without a race.
--   * count is the number of requests already consumed in the current window.
--   * reset_at is indexed so the periodic sweeper can cheaply prune expired
--     windows (DELETE WHERE reset_at <= now()).
--
-- Apply with:
--   psql -d investigation -f migrations/005_p2_db_rate_limits.sql

CREATE TABLE IF NOT EXISTS public.rate_limits (
    key_hash text NOT NULL,
    window_start timestamp without time zone NOT NULL,
    reset_at timestamp without time zone NOT NULL,
    count bigint NOT NULL DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT rate_limits_pkey PRIMARY KEY (key_hash)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at
    ON public.rate_limits USING btree (reset_at);

COMMENT ON TABLE public.rate_limits IS
    'P2-RATE-LIMITS. Durable fixed-window rate counters; key_hash is SHA-256 of "<limiter>:<client-ip>".';
COMMENT ON COLUMN public.rate_limits.key_hash IS
    'Primary key. SHA-256 digest of the rate-limit bucket key; the raw client IP is never stored.';
COMMENT ON COLUMN public.rate_limits.reset_at IS
    'End of the current fixed window. Rows at or before now() are expired and pruned by the sweeper.';
COMMENT ON COLUMN public.rate_limits.count IS
    'Requests consumed in the current window; incremented atomically by the API.';
