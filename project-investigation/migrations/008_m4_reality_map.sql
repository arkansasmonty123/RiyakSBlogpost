-- M4 (Milestone 4): player-owned Reality Map - claims, hypotheses and their
-- links to case material.
--
-- ADDITIVE ONLY. Creates three new tables plus indexes. No existing table,
-- column, constraint or row is modified or deleted. Idempotent (IF NOT EXISTS),
-- so it is safe to re-run against any environment.
--
-- Design notes (hard invariants):
--   * These rows are PLAYER NOTES. Nothing here feeds verdict evaluation,
--     progression or evidence release. No foreign keys are used (matching the
--     raw-SQL baseline); ids are validated in application code.
--   * No canonical truth, hidden-evidence content, culprit, or hidden character
--     field is stored here. Only ids that reference already player-visible
--     material may be written, and that is enforced by the API on write AND on
--     read (links whose target no longer resolves are filtered from snapshots).
--   * Confidence is a four-value SUBJECTIVE enum. No numeric probabilities are
--     stored or implied anywhere in this schema.
--   * Specialists / the AI never write to these tables. Only the owning player
--     (via the authenticated API) may create/update/delete their own rows.
--
-- Apply with:
--   psql -d investigation -f migrations/008_m4_reality_map.sql

-- ---------------------------------------------------------------------------
-- Player claims (an observation, interpretation, assumption, ...).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investigation_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    claim_category text NOT NULL
        CHECK (claim_category IN (
            'factual_observation', 'interpretation', 'assumption',
            'causal_explanation', 'motive', 'timeline_assertion', 'unresolved_question'
        )),
    confidence text NOT NULL DEFAULT 'insufficient_information'
        CHECK (confidence IN (
            'high_confidence', 'moderate_confidence', 'low_confidence', 'insufficient_information'
        )),
    notes text NOT NULL DEFAULT '',
    source_journal_entry_id uuid,
    source_notebook_entry_id uuid,
    is_tutorial boolean NOT NULL DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT investigation_claims_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_investigation_claims_investigation_created
    ON public.investigation_claims USING btree (investigation_id, created_at DESC);

COMMENT ON TABLE public.investigation_claims IS
    'M4. Player-authored Reality Map claims. Player notes only; never used by verdict evaluation, progression or evidence release.';
COMMENT ON COLUMN public.investigation_claims.confidence IS
    'M4. Subjective four-value enum (high/moderate/low/insufficient). Not a probability; no numeric confidence exists.';
COMMENT ON COLUMN public.investigation_claims.is_tutorial IS
    'M4. True for server-created labelled tutorial scaffolding; removable in bulk by the owner.';

-- ---------------------------------------------------------------------------
-- Player hypotheses (a competing explanation the player is weighing).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investigation_hypotheses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    explanation text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'weakened', 'strengthened', 'archived')),
    confidence text NOT NULL DEFAULT 'insufficient_information'
        CHECK (confidence IN (
            'high_confidence', 'moderate_confidence', 'low_confidence', 'insufficient_information'
        )),
    missing_information text NOT NULL DEFAULT '',
    alternative_explanations text NOT NULL DEFAULT '',
    player_notes text NOT NULL DEFAULT '',
    is_tutorial boolean NOT NULL DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT investigation_hypotheses_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_investigation_hypotheses_investigation_created
    ON public.investigation_hypotheses USING btree (investigation_id, created_at ASC);

COMMENT ON TABLE public.investigation_hypotheses IS
    'M4. Player-authored hypotheses. Player notes only; never used by verdict evaluation, progression or evidence release.';
COMMENT ON COLUMN public.investigation_hypotheses.status IS
    'M4. Player-controlled lifecycle (active/weakened/strengthened/archived). Archiving never completes or scores a case.';

-- ---------------------------------------------------------------------------
-- Links between a claim/hypothesis and case material or (for hypotheses) a claim.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reality_map_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    owner_type text NOT NULL CHECK (owner_type IN ('claim', 'hypothesis')),
    owner_id uuid NOT NULL,
    target_type text NOT NULL CHECK (target_type IN (
        'evidence', 'artifact', 'journal_entry', 'notebook_entry',
        'specialist', 'character', 'claim', 'hypothesis'
    )),
    target_id uuid NOT NULL,
    relationship text NOT NULL CHECK (relationship IN (
        'supports', 'contradicts', 'contextualizes', 'weakens',
        'unrelated_inconclusive', 'included'
    )),
    rationale text NOT NULL DEFAULT '',
    is_tutorial boolean NOT NULL DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT reality_map_links_pkey PRIMARY KEY (id),
    CONSTRAINT reality_map_links_owner_target_key UNIQUE (owner_type, owner_id, target_type, target_id),
    CONSTRAINT reality_map_links_shape_check CHECK (
        (owner_type = 'claim'
            AND target_type IN ('evidence', 'artifact', 'journal_entry', 'notebook_entry', 'specialist', 'character')
            AND relationship <> 'included')
        OR
        (owner_type = 'hypothesis' AND target_type = 'claim' AND relationship = 'included')
        OR
        (owner_type = 'hypothesis'
            AND target_type IN ('evidence', 'artifact', 'journal_entry', 'notebook_entry', 'specialist', 'character')
            AND relationship <> 'included')
    )
);

CREATE INDEX IF NOT EXISTS idx_reality_map_links_investigation
    ON public.reality_map_links USING btree (investigation_id);
CREATE INDEX IF NOT EXISTS idx_reality_map_links_owner
    ON public.reality_map_links USING btree (owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_reality_map_links_target
    ON public.reality_map_links USING btree (target_type, target_id);

COMMENT ON TABLE public.reality_map_links IS
    'M4. Player-authored links from claims/hypotheses to visible material. Player notes only; never used by verdict, progression or evidence release.';
COMMENT ON COLUMN public.reality_map_links.relationship IS
    'M4. Subjective link semantics. "included" is only legal for hypothesis -> claim membership; it never asserts canonical correctness.';
