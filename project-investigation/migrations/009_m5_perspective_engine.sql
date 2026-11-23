-- M5 (Milestone 5): Perspective Engine — intellectual frameworks, perspective
-- experiences, player reflections and advisory suggestion state.
--
-- ADDITIVE ONLY. Creates four new tables plus indexes and adds four nullable
-- provenance columns to two existing tables. No existing table, constraint or
-- row is modified or deleted. Idempotent (IF NOT EXISTS), so it is safe to
-- re-run against any environment.
--
-- Design notes (hard invariants, matching M2/M3/M4):
--   * PURELY EDUCATIONAL / ADVISORY. Nothing in these tables feeds verdict
--     evaluation, progression, evidence release or canonical truth. No
--     canonical_truth, culprit, hidden location or evidence UUID is stored.
--   * Framework/experience rows are authored server-side content. Source URLs
--     are only ever exposed by the API when source_verified=true AND the
--     server-controlled verification_status='verified' (see src/perspectives/dto.ts).
--   * Reflection and suggestion rows are PLAYER state. They are scoped by
--     user_id (and investigation_id where applicable) and are validated in
--     application code. No foreign keys, matching the raw-SQL baseline.
--   * Recommendations are advisory only: they never mutate state and never
--     assert that a theory is correct (see src/perspectives/recommendations.ts).
--
-- Apply with:
--   psql -d investigation -f migrations/009_m5_perspective_engine.sql

-- ---------------------------------------------------------------------------
-- Intellectual frameworks (the 7 reasoning lenses).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.perspective_frameworks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    framework_key text NOT NULL,
    name text NOT NULL,
    intellectual_domain text NOT NULL DEFAULT '',
    summary text NOT NULL DEFAULT '',
    core_questions jsonb DEFAULT '[]'::jsonb,
    key_concepts jsonb DEFAULT '[]'::jsonb,
    method_of_reasoning text NOT NULL DEFAULT '',
    limitations jsonb DEFAULT '[]'::jsonb,
    common_misconceptions jsonb DEFAULT '[]'::jsonb,
    internal_differences jsonb DEFAULT '[]'::jsonb,
    relevant_disciplines jsonb DEFAULT '[]'::jsonb,
    display_order integer DEFAULT 0,
    status text NOT NULL DEFAULT 'published'
        CHECK (status IN ('draft', 'published', 'retired')),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT perspective_frameworks_pkey PRIMARY KEY (id),
    CONSTRAINT perspective_frameworks_framework_key_key UNIQUE (framework_key)
);

CREATE INDEX IF NOT EXISTS idx_perspective_frameworks_status_order
    ON public.perspective_frameworks USING btree (status, display_order);

COMMENT ON TABLE public.perspective_frameworks IS
    'M5. Authored intellectual lenses. Educational content only; never canonical truth, verdict or progression input.';
COMMENT ON COLUMN public.perspective_frameworks.internal_differences IS
    'M5. Recognised disagreements WITHIN a framework (e.g. naive vs refined falsificationism); surfaced to avoid a single-voice presentation.';

-- ---------------------------------------------------------------------------
-- Perspective experiences (the authored teaching modules).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.perspective_experiences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    experience_key text NOT NULL,
    title text NOT NULL DEFAULT '',
    framework_key text NOT NULL,
    format text NOT NULL
        CHECK (format IN (
            'philosophical_parable', 'thought_experiment', 'ethical_dilemma',
            'psychological_demonstration', 'historical_episode', 'scientific_controversy',
            'spiritual_teaching', 'competing_arguments', 'mistaken_assumption', 'real_world_case'
        )),
    knowledge_class text NOT NULL
        CHECK (knowledge_class IN (
            'established_scientific', 'contested_scientific', 'historical', 'legal',
            'philosophical', 'religious_spiritual', 'fictional_in_world'
        )),
    perspective_class text NOT NULL DEFAULT 'framework_primer',
    scope_note text NOT NULL DEFAULT '',
    tradition_scope text NOT NULL DEFAULT '',
    intellectual_purpose text NOT NULL DEFAULT '',
    primary_question text NOT NULL DEFAULT '',
    introduction text NOT NULL DEFAULT '',
    intellectual_background text NOT NULL DEFAULT '',
    main_idea text NOT NULL DEFAULT '',
    detailed_explanation text NOT NULL DEFAULT '',
    sections jsonb DEFAULT '[]'::jsonb,
    historical_context text NOT NULL DEFAULT '',
    epistemic_breakdown jsonb DEFAULT '{}'::jsonb,
    key_concepts jsonb DEFAULT '[]'::jsonb,
    supporting_sources jsonb DEFAULT '[]'::jsonb,
    limitations jsonb DEFAULT '[]'::jsonb,
    counterarguments jsonb DEFAULT '[]'::jsonb,
    common_misconceptions jsonb DEFAULT '[]'::jsonb,
    reflection_questions jsonb DEFAULT '[]'::jsonb,
    activities jsonb DEFAULT '[]'::jsonb,
    recommendation_tags jsonb DEFAULT '[]'::jsonb,
    related_experience_keys jsonb DEFAULT '[]'::jsonb,
    related_specialist_keys jsonb DEFAULT '[]'::jsonb,
    related_artifact_keys jsonb DEFAULT '[]'::jsonb,
    related_case_titles jsonb DEFAULT '[]'::jsonb,
    estimated_minutes integer DEFAULT 10,
    difficulty text NOT NULL DEFAULT 'introductory'
        CHECK (difficulty IN ('introductory', 'intermediate', 'advanced')),
    display_order integer DEFAULT 0,
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'retired')),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT perspective_experiences_pkey PRIMARY KEY (id),
    CONSTRAINT perspective_experiences_experience_key_key UNIQUE (experience_key)
);

CREATE INDEX IF NOT EXISTS idx_perspective_experiences_framework
    ON public.perspective_experiences USING btree (framework_key);
CREATE INDEX IF NOT EXISTS idx_perspective_experiences_status_order
    ON public.perspective_experiences USING btree (status, display_order);

COMMENT ON TABLE public.perspective_experiences IS
    'M5. Authored teaching modules across 10 formats. Educational/advisory only; never stores canonical truth or case solution.';
COMMENT ON COLUMN public.perspective_experiences.knowledge_class IS
    'M5. Reuses the M3 knowledge classification allowlist (established_scientific .. fictional_in_world).';
COMMENT ON COLUMN public.perspective_experiences.supporting_sources IS
    'M5. JSON array of source objects. URL is exposed by the API only when source_verified=true and verification_status=verified.';

-- ---------------------------------------------------------------------------
-- Player reflections (journaling tied to an experience).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.perspective_reflections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    experience_id uuid NOT NULL,
    experience_key text NOT NULL DEFAULT '',
    user_id uuid NOT NULL,
    investigation_id uuid,
    prompt_index integer DEFAULT 0,
    prompt text NOT NULL DEFAULT '',
    reflection_kind text NOT NULL DEFAULT 'reflection'
        CHECK (reflection_kind IN (
            'reflection', 'argument_for', 'argument_against', 'assumption',
            'open_question', 'alternative_interpretation', 'disagreement',
            'hypothesis_reconsideration'
        )),
    response text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT perspective_reflections_pkey PRIMARY KEY (id),
    CONSTRAINT perspective_reflections_response_nonempty CHECK (length(btrim(response)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_perspective_reflections_user_experience
    ON public.perspective_reflections USING btree (user_id, experience_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_perspective_reflections_investigation_user
    ON public.perspective_reflections USING btree (investigation_id, user_id, created_at DESC);

COMMENT ON TABLE public.perspective_reflections IS
    'M5. Player-authored reflections. Player notes only; never read by verdict, progression or evidence release.';

-- ---------------------------------------------------------------------------
-- Advisory suggestion state (dismissed / opened / saved per investigation).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.perspective_suggestion_state (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    experience_key text NOT NULL,
    reason_code text NOT NULL DEFAULT '',
    state_fingerprint text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'opened'
        CHECK (status IN ('dismissed', 'opened', 'saved')),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT perspective_suggestion_state_pkey PRIMARY KEY (id),
    CONSTRAINT perspective_suggestion_state_investigation_user_experience_key
        UNIQUE (investigation_id, user_id, experience_key)
);

CREATE INDEX IF NOT EXISTS idx_perspective_suggestion_state_user
    ON public.perspective_suggestion_state USING btree (user_id, investigation_id);

COMMENT ON TABLE public.perspective_suggestion_state IS
    'M5. Advisory suggestion UI state only. Never influences verdict, progression or evidence release.';

-- ---------------------------------------------------------------------------
-- Additive provenance columns (nullable; existing rows are unaffected).
-- ---------------------------------------------------------------------------
ALTER TABLE public.investigation_claims
    ADD COLUMN IF NOT EXISTS source_perspective_experience_id uuid,
    ADD COLUMN IF NOT EXISTS source_perspective_reflection_id uuid;

ALTER TABLE public.notebook_entries
    ADD COLUMN IF NOT EXISTS perspective_experience_id uuid;

COMMENT ON COLUMN public.investigation_claims.source_perspective_experience_id IS
    'M5. Optional provenance: the perspective experience that inspired this player claim. Player note only.';
COMMENT ON COLUMN public.notebook_entries.perspective_experience_id IS
    'M5. Optional provenance: the perspective experience a notebook entry was captured from. Player note only.';
