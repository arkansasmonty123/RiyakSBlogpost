-- M7 (Milestone 7): Real-World Discovery & Knowledge Retention Engine.
--
-- ADDITIVE ONLY. Creates eight new tables and adds two nullable columns to
-- notebook_entries. No existing table, constraint, or row is modified or
-- deleted. Idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS), safe to
-- re-run.
--
-- Hard invariants:
--   * Canonical truth is NEVER stored here. No culprit, no hidden evidence,
--     no canonical solution, no secret release conditions.
--   * Discovery submissions are player-authored text; acceptance is decided by
--     a deterministic, server-authored concept evaluator (no evidence release
--     authority). Accepted unlocks are PRE-AUTHORED in discovery-clue packages.
--   * evidence_discoveries and mystery-engine.processProgression remain the
--     only evidence-release authority. Nothing in this migration or its modules
--     inserts into evidence_discoveries.
--   * Source URLs are stored only for human-verified sources; authored showcase
--     content ships with sourceUrl NULL and verificationStatus pending_review.
--   * Knowledge memory items are user-scoped retention records; DTOs must use
--     explicit allowlists and never expose answer criteria or internal terms.
--
-- Apply with:
--   psql -d investigation -f migrations/011_m7_discovery_knowledge.sql

-- ---------------------------------------------------------------------------
-- Authored discovery-clue package metadata (definitions live in code).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discovery_clue_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    package_key text NOT NULL,
    version text NOT NULL DEFAULT '1.0.0',
    package_status text NOT NULL DEFAULT 'pending_review'
        CHECK (package_status IN ('draft', 'pending_review', 'verified', 'needs_reverification')),
    summary text NOT NULL DEFAULT '',
    clue_count integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT discovery_clue_packages_pkey PRIMARY KEY (id),
    CONSTRAINT discovery_clue_packages_case_id_key UNIQUE (case_id),
    CONSTRAINT discovery_clue_packages_package_key_key UNIQUE (package_key)
);

CREATE INDEX IF NOT EXISTS idx_discovery_clue_packages_status
    ON public.discovery_clue_packages USING btree (package_status);

COMMENT ON TABLE public.discovery_clue_packages IS
    'M7. Authored discovery-clue package metadata. Definitions live in code; no canonical truth or hidden evidence.';
COMMENT ON COLUMN public.discovery_clue_packages.package_key IS
    'Stable package identifier (e.g. midnight-heist-discovery-v1). Used for provenance and idempotent seeding.';

-- ---------------------------------------------------------------------------
-- Per-investigation clue state (player-visible progress only).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investigation_discovery_clue_states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    case_id uuid NOT NULL,
    clue_key text NOT NULL,
    state text NOT NULL DEFAULT 'noticed'
        CHECK (state IN ('noticed', 'researching', 'submitted', 'accepted', 'dormant')),
    surfaced_at timestamp with time zone,
    research_started_at timestamp with time zone,
    accepted_at timestamp with time zone,
    last_submitted_at timestamp with time zone,
    attempt_count integer NOT NULL DEFAULT 0,
    source_context jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT investigation_discovery_clue_states_pkey PRIMARY KEY (id),
    CONSTRAINT idcs_inv_clue_key_uq UNIQUE (investigation_id, clue_key)
);

CREATE INDEX IF NOT EXISTS idx_discovery_clue_state_investigation
    ON public.investigation_discovery_clue_states USING btree (investigation_id, state, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_clue_state_user
    ON public.investigation_discovery_clue_states USING btree (user_id, state);

COMMENT ON TABLE public.investigation_discovery_clue_states IS
    'M7. Investigation-scoped discovery-clue state. No answer criteria, no canonical truth, no evidence-release authority.';
COMMENT ON COLUMN public.investigation_discovery_clue_states.source_context IS
    'Server-authored snapshot of visible evidence/checkpoints/actions that surfaced the clue; never canonical data.';

-- ---------------------------------------------------------------------------
-- Player submissions and deterministic evaluation results.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discovery_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    clue_key text NOT NULL,
    memory_item_id uuid,
    explanation text NOT NULL,
    subject_identification text NOT NULL DEFAULT '',
    connection_explanation text NOT NULL DEFAULT '',
    uncertainty text NOT NULL DEFAULT '',
    source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
    confidence text CHECK (confidence IN ('low', 'medium', 'high') OR confidence IS NULL),
    evaluation jsonb NOT NULL DEFAULT '{}'::jsonb,
    classification text NOT NULL,
    accepted boolean NOT NULL DEFAULT false,
    score numeric(5,4) NOT NULL DEFAULT 0,
    llm_used boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT discovery_submissions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_discovery_submissions_investigation
    ON public.discovery_submissions USING btree (investigation_id, clue_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_submissions_user
    ON public.discovery_submissions USING btree (user_id, created_at DESC);

COMMENT ON TABLE public.discovery_submissions IS
    'M7. Player-authored research explanations with server-side deterministic evaluation. Evaluation JSON is internal; public DTOs strip reason codes and aliases.';
COMMENT ON COLUMN public.discovery_submissions.accepted IS
    'Set only by the deterministic server evaluator (LLM advisory output can never set this true). Acceptance never releases evidence directly.';

-- ---------------------------------------------------------------------------
-- Cross-case knowledge memory (user-scoped retention records).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_memory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    subject_key text NOT NULL,
    subject_label text NOT NULL,
    reference_category text NOT NULL,
    knowledge_status text NOT NULL DEFAULT 'established'
        CHECK (knowledge_status IN ('established', 'contested', 'debated', 'uncertain')),
    concepts jsonb NOT NULL DEFAULT '[]'::jsonb,
    corrected_understanding text NOT NULL,
    original_explanation text NOT NULL,
    latest_explanation text NOT NULL,
    authored_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
    player_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
    first_case_id uuid,
    first_investigation_id uuid,
    first_clue_key text,
    first_discovered_at timestamp with time zone DEFAULT now() NOT NULL,
    last_recall_at timestamp with time zone,
    last_successful_recall_at timestamp with time zone,
    next_due_at timestamp with time zone,
    mastery_status text NOT NULL DEFAULT 'new'
        CHECK (mastery_status IN ('new', 'developing', 'proficient', 'mastered')),
    successful_recalls integer NOT NULL DEFAULT 0,
    failed_recalls integer NOT NULL DEFAULT 0,
    unresolved_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
    follow_up_applications jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_memory_items_pkey PRIMARY KEY (id),
    CONSTRAINT knowledge_memory_items_user_id_subject_key_key UNIQUE (user_id, subject_key)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_memory_user
    ON public.knowledge_memory_items USING btree (user_id, subject_key);
CREATE INDEX IF NOT EXISTS idx_knowledge_memory_due
    ON public.knowledge_memory_items USING btree (user_id, next_due_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_memory_mastery
    ON public.knowledge_memory_items USING btree (user_id, mastery_status);

COMMENT ON TABLE public.knowledge_memory_items IS
    'M7. User-scoped knowledge retention records built from ACCEPTED discovery submissions. No canonical truth; corrected_understanding is authored pedagogic text, never a case solution.';

CREATE TABLE IF NOT EXISTS public.knowledge_memory_cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    memory_item_id uuid NOT NULL,
    user_id uuid NOT NULL,
    investigation_id uuid NOT NULL,
    case_id uuid NOT NULL,
    clue_key text NOT NULL,
    application_context text NOT NULL DEFAULT '',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_memory_cases_pkey PRIMARY KEY (id),
    CONSTRAINT knowledge_memory_cases_user_investigation_clue_key_key
        UNIQUE (user_id, investigation_id, clue_key)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_memory_cases_item
    ON public.knowledge_memory_cases USING btree (memory_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_memory_cases_user_case
    ON public.knowledge_memory_cases USING btree (user_id, case_id);

COMMENT ON TABLE public.knowledge_memory_cases IS
    'M7. Distinct application contexts for a memory item (cross-case usage drives mastery). No canonical truth.';

CREATE TABLE IF NOT EXISTS public.knowledge_memory_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    from_memory_id uuid NOT NULL,
    to_memory_id uuid NOT NULL,
    from_subject_key text NOT NULL,
    to_subject_key text NOT NULL,
    pair_key text NOT NULL,
    relationship text NOT NULL DEFAULT 'related',
    rationale text NOT NULL DEFAULT '',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_memory_links_pkey PRIMARY KEY (id),
    CONSTRAINT knowledge_memory_links_user_id_pair_key_key UNIQUE (user_id, pair_key)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_memory_links_user
    ON public.knowledge_memory_links USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_memory_links_pair
    ON public.knowledge_memory_links USING btree (user_id, pair_key);

COMMENT ON TABLE public.knowledge_memory_links IS
    'M7. User-scoped links between knowledge memory subjects. Rationale is pedagogic, never canonical.';

CREATE TABLE IF NOT EXISTS public.knowledge_recall_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    memory_item_id uuid NOT NULL,
    investigation_id uuid,
    clue_key text,
    recall_kind text NOT NULL
        CHECK (recall_kind IN ('initial_check', 'delayed_recall', 'cross_case_application', 'reinforcement')),
    prompt text NOT NULL DEFAULT '',
    response text NOT NULL DEFAULT '',
    outcome text NOT NULL CHECK (outcome IN ('success', 'partial', 'missed')),
    scheduled_for timestamp with time zone,
    answered_at timestamp with time zone,
    interval_days integer,
    next_due_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_recall_events_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_recall_events_user_due
    ON public.knowledge_recall_events USING btree (user_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_knowledge_recall_events_memory
    ON public.knowledge_recall_events USING btree (memory_item_id, created_at DESC);

COMMENT ON TABLE public.knowledge_recall_events IS
    'M7. Spaced-recall attempts and outcomes. Deterministic scheduling helpers only; no canonical truth.';

-- ---------------------------------------------------------------------------
-- Pre-authored unlocks applied after an accepted discovery submission.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investigation_discovery_unlocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    clue_key text NOT NULL,
    unlock_key text NOT NULL,
    kind text NOT NULL
        CHECK (kind IN ('insight', 'question', 'specialist_response', 'reinterpretation', 'reality_map_seed', 'action')),
    target_ref text NOT NULL DEFAULT '',
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    applied_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT investigation_discovery_unlocks_pkey PRIMARY KEY (id),
    CONSTRAINT idu_inv_clue_unlock_uq UNIQUE (investigation_id, clue_key, unlock_key)
);

CREATE INDEX IF NOT EXISTS idx_discovery_unlocks_investigation
    ON public.investigation_discovery_unlocks USING btree (investigation_id, clue_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_unlocks_user
    ON public.investigation_discovery_unlocks USING btree (user_id, applied_at);

COMMENT ON TABLE public.investigation_discovery_unlocks IS
    'M7. Pre-authored, investigation-scoped unlocks. Never contains canonical truth and never releases evidence directly.';
COMMENT ON COLUMN public.investigation_discovery_unlocks.target_ref IS
    'Stable authored reference (evidence source, specialist key, or existing case action). Never an evidence UUID.';

-- ---------------------------------------------------------------------------
-- Additive columns on notebook_entries (nullable, no backfill required).
-- ---------------------------------------------------------------------------
ALTER TABLE public.notebook_entries
    ADD COLUMN IF NOT EXISTS discovery_memory_id uuid,
    ADD COLUMN IF NOT EXISTS discovery_clue_key text;

COMMENT ON COLUMN public.notebook_entries.discovery_memory_id IS
    'M7. Optional link from a research-journal notebook entry to a knowledge memory item. NULL for legacy entries.';
COMMENT ON COLUMN public.notebook_entries.discovery_clue_key IS
    'M7. Optional stable clue key that inspired the notebook entry. NULL for legacy entries.';
