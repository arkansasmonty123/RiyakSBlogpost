-- M8 Wave 1: Player onboarding and first-experience foundation.
--
-- ADDITIVE ONLY. Creates one new user-scoped table. No existing table,
-- constraint, index or row is modified or deleted. Idempotent
-- (IF NOT EXISTS / IF NOT EXISTS index), safe to re-run.
--
-- Hard invariants:
--   * No canonical truth. This table stores only the player's own onboarding
--     progress (welcome seen, intro completed, skip flag, last step reached and
--     a small set of dismissed contextual-tip flags). No culprit, no hidden
--     evidence, no solution, no scoring data.
--   * One row per user. Access is always gated by the authenticated session
--     user id; the client never supplies a user id.
--   * tutorial_state is a bounded jsonb object whose keys are allowlisted in
--     src/db.ts. The database stores only what the allowlist normalizer emits.
--
-- Apply with:
--   psql -d investigation -f migrations/012_m8_onboarding.sql

CREATE TABLE IF NOT EXISTS public.user_onboarding (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    welcome_seen boolean NOT NULL DEFAULT false,
    intro_completed boolean NOT NULL DEFAULT false,
    tutorial_state jsonb NOT NULL DEFAULT '{}'::jsonb,
    skipped boolean NOT NULL DEFAULT false,
    last_step text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_onboarding_pkey PRIMARY KEY (id),
    CONSTRAINT user_onboarding_user_id_key UNIQUE (user_id)
);

-- Explicit index on user_id as required by the M8 onboarding spec (the UNIQUE
-- constraint above also maintains a btree index; both are harmless).
CREATE INDEX IF NOT EXISTS idx_user_onboarding_user_id
    ON public.user_onboarding USING btree (user_id);

COMMENT ON TABLE public.user_onboarding IS
    'M8. Per-user onboarding/first-experience progress. Player-owned UI state only; never canonical truth or hidden evidence.';
COMMENT ON COLUMN public.user_onboarding.user_id IS
    'Authenticated user id from the session. One onboarding record per user.';
COMMENT ON COLUMN public.user_onboarding.tutorial_state IS
    'Bounded jsonb of dismissed contextual intro tips. Keys and values are allowlisted/normalized in src/db.ts.';
COMMENT ON COLUMN public.user_onboarding.last_step IS
    'Last onboarding step reached, so an interrupted intro can be resumed. Opaque UI label, never canonical data.';
