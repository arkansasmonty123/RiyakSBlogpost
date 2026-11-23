-- M6 (Milestone 6): Living Investigations Engine — additive event engine,
-- autonomous team activity state, asynchronous catch-up metadata, notification
-- inbox, and player-facing activity read state.
--
-- ADDITIVE ONLY. Creates four new tables and adds four nullable columns to two
-- existing tables. No existing table, constraint, or row is modified or deleted.
-- Idempotent (IF NOT EXISTS), safe to re-run.
--
-- Hard invariants:
--   * Canonical truth is NEVER stored here. No culprit, no hidden evidence,
--     no canonical solution, no secret event conditions.
--   * Event instances are investigation-scoped and ownership-validated in app.
--   * LLM output never mutates investigation state; narration is not persisted.
--   * scheduled_events / development_log / processProgression remain the only
--     evidence-release authority. M6 consequences may request progression reruns
--     but never insert evidence_discoveries directly.
--
-- Apply with:
--   psql -d investigation -f migrations/010_m6_living_investigations.sql

-- ---------------------------------------------------------------------------
-- Case-authored event packages (server-authored metadata, seeded from code).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_event_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    package_key text NOT NULL,
    version text NOT NULL DEFAULT '1.0.0',
    package_status text NOT NULL DEFAULT 'draft'
        CHECK (package_status IN ('draft', 'pending_review', 'verified', 'needs_reverification')),
    summary text NOT NULL DEFAULT '',
    event_count integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT case_event_packages_pkey PRIMARY KEY (id),
    CONSTRAINT case_event_packages_case_id_key UNIQUE (case_id),
    CONSTRAINT case_event_packages_package_key_key UNIQUE (package_key)
);

CREATE INDEX IF NOT EXISTS idx_case_event_packages_status
    ON public.case_event_packages USING btree (package_status);

COMMENT ON TABLE public.case_event_packages IS
    'M6. Authored case event package metadata. No hidden evidence/canonical truth; definitions live in code and are seeded/validated.';
COMMENT ON COLUMN public.case_event_packages.package_key IS
    'Stable package identifier (e.g. midnight-heist-v1). Used in event provenance and idempotency keys.';

-- ---------------------------------------------------------------------------
-- Investigation event instances (materialized from authored packages).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investigation_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_id uuid NOT NULL,
    case_id uuid NOT NULL,
    event_key text NOT NULL,
    event_type text NOT NULL,
    idempotency_key text NOT NULL,
    status text NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'eligible', 'resolved', 'expired', 'superseded', 'cancelled')),
    significance text NOT NULL DEFAULT 'normal'
        CHECK (significance IN ('high', 'normal', 'low')),
    group_key text,
    actor_kind text NOT NULL DEFAULT 'team'
        CHECK (actor_kind IN ('specialist', 'team', 'witness', 'external', 'system')),
    actor_key text,
    eligible_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone,
    resolved_at timestamp with time zone,
    supersedes_event_id uuid,
    superseded_by_event_id uuid,
    eligibility_conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
    required_state jsonb NOT NULL DEFAULT '{}'::jsonb,
    consequence_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
    presentation jsonb NOT NULL DEFAULT '{}'::jsonb,
    outcome jsonb NOT NULL DEFAULT '{}'::jsonb,
    provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT investigation_events_pkey PRIMARY KEY (id),
    CONSTRAINT investigation_events_investigation_id_idempotency_key_key
        UNIQUE (investigation_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_investigation_events_due
    ON public.investigation_events USING btree (investigation_id, status, eligible_at);
CREATE INDEX IF NOT EXISTS idx_investigation_events_created
    ON public.investigation_events USING btree (investigation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investigation_events_case
    ON public.investigation_events USING btree (case_id, event_key);

COMMENT ON TABLE public.investigation_events IS
    'M6. Materialized investigation event instances. Eligibility/consequence JSON is server-authored/internal; player DTOs must use explicit allowlists.';
COMMENT ON COLUMN public.investigation_events.idempotency_key IS
    'Stable per-investigation key preventing duplicate materialization/application. Format: evt:<package>:<event>:<anchor>.';
COMMENT ON COLUMN public.investigation_events.consequence_definition IS
    'Server-authored closed-union consequence definition. Never exposed to clients. Never contains canonical truth.';

-- ---------------------------------------------------------------------------
-- Investigation flags (player-visible consequence state; no canonical truth).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investigation_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_id uuid NOT NULL,
    flag text NOT NULL,
    value jsonb NOT NULL DEFAULT '{}'::jsonb,
    source_event_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT investigation_flags_pkey PRIMARY KEY (id),
    CONSTRAINT investigation_flags_investigation_id_flag_key UNIQUE (investigation_id, flag)
);

CREATE INDEX IF NOT EXISTS idx_investigation_flags_investigation
    ON public.investigation_flags USING btree (investigation_id, created_at DESC);

COMMENT ON TABLE public.investigation_flags IS
    'M6. Investigation-scoped consequence flags (missed opportunity, lead requested, etc.). No canonical truth.';

-- ---------------------------------------------------------------------------
-- Notification inbox (user-scoped, push-ready, deduped).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    investigation_id uuid,
    event_id uuid,
    category text NOT NULL DEFAULT 'development',
    priority text NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('high', 'normal', 'low')),
    group_key text,
    title text NOT NULL,
    body text NOT NULL,
    dedupe_key text NOT NULL,
    status text NOT NULL DEFAULT 'unread'
        CHECK (status IN ('unread', 'read', 'archived')),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone,
    CONSTRAINT notifications_pkey PRIMARY KEY (id),
    CONSTRAINT notifications_user_id_dedupe_key_key UNIQUE (user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_notifications_inbox
    ON public.notifications USING btree (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_investigation
    ON public.notifications USING btree (investigation_id, created_at DESC);

COMMENT ON TABLE public.notifications IS
    'M6. Internal notification inbox. User-scoped, deduped, read/unread; push delivery is out of scope.';
COMMENT ON COLUMN public.notifications.dedupe_key IS
    'Stable dedupe key per user (e.g. inv:<id>:event:<eventId>). Prevents duplicate inbox rows on repeated catch-up.';

-- ---------------------------------------------------------------------------
-- Additive columns on existing tables (nullable, no backfill required).
-- ---------------------------------------------------------------------------
ALTER TABLE public.investigations
    ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS last_event_tick_at timestamp with time zone;

COMMENT ON COLUMN public.investigations.last_seen_at IS
    'M6. Server-side timestamp when the player last viewed activity for this investigation. NULL means never viewed.';
COMMENT ON COLUMN public.investigations.last_event_tick_at IS
    'M6. Server-side timestamp of the last living-world catch-up tick. Used for throttling and summary; never client-authorized.';

ALTER TABLE public.development_log
    ADD COLUMN IF NOT EXISTS source_event_id uuid,
    ADD COLUMN IF NOT EXISTS actor_key text;

COMMENT ON COLUMN public.development_log.source_event_id IS
    'M6. Optional investigation_events.id that produced this development. NULL for legacy/progression rows.';
COMMENT ON COLUMN public.development_log.actor_key IS
    'M6. Optional actor/specialist key for player-facing attribution. No secrets/canonical truth.';
