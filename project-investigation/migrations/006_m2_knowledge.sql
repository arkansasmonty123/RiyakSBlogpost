-- M2 (Milestone 2): specialists, knowledge artifacts, disagreements and the
-- player notebook.
--
-- ADDITIVE ONLY. Creates five new tables plus indexes. No existing table,
-- column or row is modified or deleted. Idempotent (IF NOT EXISTS), so it is
-- safe to re-run against any environment.
--
-- Design notes:
--   * No foreign keys (matching the raw-SQL baseline): references between
--     these tables and cases/specialists are enforced in application code.
--   * All free-form text is authored by the server seed or the player and is
--     bounded on write by the API. Nothing here stores canonical truth.
--   * specialist/discipline records are explicitly marked fictional personas
--     grounded in a real discipline (`is_fictional`, `real_discipline_basis`).
--   * source_url is only ever exposed by the API when source_verified=true;
--     the column itself stores the raw value for admin/validation purposes.
--
-- Apply with:
--   psql -d investigation -f migrations/006_m2_knowledge.sql

-- ---------------------------------------------------------------------------
-- Specialist personas (one shared LLM, many grounded voices).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.specialists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    specialist_key text NOT NULL,
    name text,
    title text,
    specialization text,
    discipline text,
    knowledge_domains jsonb DEFAULT '[]'::jsonb,
    personality text,
    communication_style text,
    reasoning_approach text,
    expertise_summary text,
    limitations jsonb DEFAULT '[]'::jsonb,
    depth_guidance jsonb DEFAULT '{}'::jsonb,
    is_fictional boolean DEFAULT true,
    real_discipline_basis text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT specialists_pkey PRIMARY KEY (id),
    CONSTRAINT specialists_specialist_key_key UNIQUE (specialist_key)
);

COMMENT ON TABLE public.specialists IS
    'M2. Fictional specialist personas grounded in real disciplines; used as bounded responder specs for the shared chat model.';
COMMENT ON COLUMN public.specialists.limitations IS
    'Explicit list of what this specialist cannot conclude; the responder must respect these bounds.';
COMMENT ON COLUMN public.specialists.depth_guidance IS
    'Map of plain/working/technical -> guidance on how deep to go for that depth setting.';

-- ---------------------------------------------------------------------------
-- Case <-> specialist assignment.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_specialists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    specialist_id uuid NOT NULL,
    case_relevance text,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT case_specialists_pkey PRIMARY KEY (id),
    CONSTRAINT case_specialists_case_id_specialist_id_key UNIQUE (case_id, specialist_id)
);

CREATE INDEX IF NOT EXISTS idx_case_specialists_case_id
    ON public.case_specialists USING btree (case_id);

COMMENT ON TABLE public.case_specialists IS
    'M2. Assignment of specialist personas to cases with ordering and case-specific relevance.';

-- ---------------------------------------------------------------------------
-- Knowledge artifacts (safe reference material; never canonical truth).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_artifacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    artifact_key text NOT NULL,
    title text NOT NULL,
    artifact_type text,
    description text,
    content text,
    specialist_id uuid,
    case_id uuid,
    source_author text,
    source_url text,
    source_verified boolean DEFAULT false,
    bibliography_ref text,
    publication_date text,
    knowledge_class text,
    reliability text,
    related_concepts jsonb DEFAULT '[]'::jsonb,
    is_fictional boolean DEFAULT false,
    usage_note text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT knowledge_artifacts_pkey PRIMARY KEY (id),
    CONSTRAINT knowledge_artifacts_artifact_key_key UNIQUE (artifact_key)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_artifacts_case_id
    ON public.knowledge_artifacts USING btree (case_id);

COMMENT ON TABLE public.knowledge_artifacts IS
    'M2. Bounded, player-safe reference knowledge. Never stores canonical solution, culprit or hidden location.';
COMMENT ON COLUMN public.knowledge_artifacts.source_verified IS
    'When true the API exposes source_url; otherwise source_url is reported as null.';
COMMENT ON COLUMN public.knowledge_artifacts.is_fictional IS
    'True for explicitly in-world/fictional documents; such rows use knowledge_class=fictional and reliability=fiction.';

-- ---------------------------------------------------------------------------
-- Disciplined disagreements between two specialists on the same case.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_disagreements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    disagreement_key text NOT NULL,
    case_id uuid NOT NULL,
    topic text,
    specialist_a_id uuid NOT NULL,
    specialist_b_id uuid NOT NULL,
    position_a text,
    position_b text,
    disciplinary_basis text,
    uncertainty_note text,
    distinguishing_evidence text,
    related_artifact_keys jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT knowledge_disagreements_pkey PRIMARY KEY (id),
    CONSTRAINT knowledge_disagreements_disagreement_key_key UNIQUE (disagreement_key),
    CONSTRAINT knowledge_disagreements_distinct_specialists CHECK (specialist_a_id <> specialist_b_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_disagreements_case_id
    ON public.knowledge_disagreements USING btree (case_id);

COMMENT ON TABLE public.knowledge_disagreements IS
    'M2. Two specialists take contrasting, discipline-grounded positions with explicit uncertainty and distinguishing evidence.';

-- ---------------------------------------------------------------------------
-- Player notebook (per investigation, per owner).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notebook_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    entry_type text NOT NULL,
    artifact_id uuid,
    specialist_id uuid,
    concept text,
    title text,
    content text DEFAULT '',
    source_snapshot jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT notebook_entries_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_notebook_entries_investigation_created
    ON public.notebook_entries USING btree (investigation_id, created_at DESC);

COMMENT ON TABLE public.notebook_entries IS
    'M2. Player-authored notebook; source_snapshot is composed server-side from a safe artifact DTO, never from canonical data.';
