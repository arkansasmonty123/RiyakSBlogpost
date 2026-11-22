-- PROD-010 (GAP-06): verdict integrity v2.
--
-- ADDITIVE ONLY. Adds server-owned accusation attempt/cooldown bookkeeping to
-- investigations. No existing column is modified or dropped, and no data is
-- deleted. Existing rows default to 0 attempts / no active cooldown, so legacy
-- investigations remain immediately usable.
--
-- Apply with:
--   psql -d investigation -f migrations/003_prod010_verdict_integrity.sql

ALTER TABLE public.investigations
  ADD COLUMN IF NOT EXISTS accusation_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_accusation_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS accusation_cooldown_until timestamp without time zone;

COMMENT ON COLUMN public.investigations.accusation_attempts IS
  'PROD-010. Server-owned count of non-correct final accusations. Never client-writable.';
COMMENT ON COLUMN public.investigations.last_accusation_at IS
  'PROD-010. Timestamp of the most recent evaluated accusation attempt.';
COMMENT ON COLUMN public.investigations.accusation_cooldown_until IS
  'PROD-010. Failed accusations are blocked until this time. Escalating but capped; never a permanent lockout.';
