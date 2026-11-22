-- P2-SESSIONS: durable, DB-backed auth sessions.
--
-- ADDITIVE ONLY. Creates one new table plus two indexes. No existing table,
-- column or row is modified or deleted. Idempotent (IF NOT EXISTS), so it is
-- safe to re-run against any environment.
--
-- Design:
--   * token_hash is the PRIMARY KEY and stores SHA-256(raw cookie token), never
--     the raw token itself. The raw 32-byte token only exists in the client's
--     httpOnly `session_token` cookie.
--   * user_id references users(id) with ON DELETE CASCADE so sessions cannot
--     outlive their user and are cleaned up automatically.
--   * expires_at is the server-authoritative expiry (24h from issue). The app
--     also lazily deletes expired rows on presentation and via a periodic sweep.
--
-- Apply with:
--   psql -d investigation -f migrations/004_p2_db_sessions.sql

CREATE TABLE IF NOT EXISTS public.sessions (
    token_hash text NOT NULL,
    user_id uuid NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT sessions_pkey PRIMARY KEY (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
    ON public.sessions USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
    ON public.sessions USING btree (expires_at);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sessions_user_id_fkey'
    ) THEN
        ALTER TABLE ONLY public.sessions
            ADD CONSTRAINT sessions_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END
$$;

COMMENT ON TABLE public.sessions IS
    'P2-SESSIONS. Durable auth sessions; token_hash is SHA-256 of the raw httpOnly cookie token.';
COMMENT ON COLUMN public.sessions.token_hash IS
    'Primary key. SHA-256 digest of the random session token; the raw token is only in the client cookie.';
COMMENT ON COLUMN public.sessions.expires_at IS
    'Server-authoritative session expiry. Expired rows are ignored and cleaned up lazily.';
