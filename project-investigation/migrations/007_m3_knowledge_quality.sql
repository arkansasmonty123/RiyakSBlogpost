-- M3 (Milestone 3): knowledge quality, provenance and case knowledge packs.
--
-- ADDITIVE ONLY. Adds columns to the existing M2 knowledge_artifacts table and
-- one new case_knowledge_packs table. Existing columns/rows are never dropped.
-- Idempotent (IF NOT EXISTS), so it is safe to re-run against any environment.
--
-- Design notes:
--   * verification_status is server-controlled. Nothing in this migration
--     automatically verifies a real-world source: existing unverified real
--     references move to `pending_review`, and the one explicitly fictional
--     in-world prop is marked `verified` with an explanatory note.
--   * related_evidence_refs stores stable, human-readable refs (evidence
--     source/title snippets), never volatile evidence UUIDs.
--   * Old knowledge_class values (established, methodology-caution, fictional)
--     are backfilled to the M3 allowlist. Validators and DTOs still accept the
--     legacy aliases so historical rows remain readable.
--
-- Apply with:
--   psql -d investigation -f migrations/007_m3_knowledge_quality.sql

-- ---------------------------------------------------------------------------
-- Provenance / pedagogy metadata on knowledge artifacts.
-- ---------------------------------------------------------------------------
ALTER TABLE public.knowledge_artifacts
    ADD COLUMN IF NOT EXISTS source_type text,
    ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS verification_notes text DEFAULT '',
    ADD COLUMN IF NOT EXISTS last_verified_at text,
    ADD COLUMN IF NOT EXISTS claims_supported jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS learning_objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS related_evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS suggested_conversations jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS depth_content jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.knowledge_artifacts.verification_status IS
    'M3. draft|pending_review|verified|rejected|needs_reverification. Server-controlled; real sources are never auto-verified.';
COMMENT ON COLUMN public.knowledge_artifacts.source_type IS
    'M3. Source category: government_guidance, standards_body, peer_reviewed, reputable_org, textbook, news, legal_reference, in_world_document, other.';
COMMENT ON COLUMN public.knowledge_artifacts.related_evidence_refs IS
    'M3. Stable human-readable evidence refs (source/title snippets), never volatile evidence UUIDs.';
COMMENT ON COLUMN public.knowledge_artifacts.depth_content IS
    'M3. Optional plain/working/technical explanation keys.';

-- ---------------------------------------------------------------------------
-- Per-case knowledge pack (versioned authoring metadata).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_knowledge_packs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    version text DEFAULT '1.0.0',
    pack_status text NOT NULL DEFAULT 'draft',
    learning_objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
    summary text DEFAULT '',
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT case_knowledge_packs_pkey PRIMARY KEY (id),
    CONSTRAINT case_knowledge_packs_case_id_key UNIQUE (case_id)
);

-- The UNIQUE(case_id) constraint already provides the lookup index.

COMMENT ON TABLE public.case_knowledge_packs IS
    'M3. Versioned, case-scoped knowledge-pack metadata (learning objectives, review status). No canonical truth.';
COMMENT ON COLUMN public.case_knowledge_packs.pack_status IS
    'M3. draft|pending_review|verified|needs_reverification.';
COMMENT ON COLUMN public.case_knowledge_packs.learning_objectives IS
    'M3. What a player should learn from this case knowledge pack; safe, non-canonical text.';

-- ---------------------------------------------------------------------------
-- Backfill existing M2 rows. No real source is auto-verified.
-- ---------------------------------------------------------------------------

-- Unverified real-world references: explicitly pending review.
UPDATE public.knowledge_artifacts
   SET verification_status = 'pending_review',
       verification_notes = CASE
         WHEN verification_notes IS NULL OR verification_notes = ''
           THEN 'General reference summary authored for this case; bibliography provided, no verified external link. Pending source verification.'
         ELSE verification_notes
       END
 WHERE source_verified = false
   AND is_fictional = false
   AND verification_status = 'draft';

-- Explicitly fictional in-world documents: verified as props, not as sources.
UPDATE public.knowledge_artifacts
   SET verification_status = 'verified',
       source_type = 'in_world_document',
       verification_notes = 'Fictional in-world prop created for this investigation; not an external source and not evidence of any outcome.'
 WHERE is_fictional = true
   AND verification_status = 'draft';

-- M3 knowledge_class allowlist migration (legacy values stay readable).
UPDATE public.knowledge_artifacts SET knowledge_class = 'established_scientific' WHERE knowledge_class = 'established';
UPDATE public.knowledge_artifacts SET knowledge_class = 'contested_scientific' WHERE knowledge_class = 'methodology-caution';
UPDATE public.knowledge_artifacts SET knowledge_class = 'fictional_in_world' WHERE knowledge_class = 'fictional';
