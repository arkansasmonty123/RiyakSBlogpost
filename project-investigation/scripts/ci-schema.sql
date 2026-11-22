-- CI-only schema bootstrap snapshot (PROD-004).
-- Canonical source of truth is migrations/000_baseline.sql + 001..003_*.sql;
-- this file is the CI snapshot of that same schema, not a place to author changes.
-- Verify read-only with `npm run db:schema:verify` (see PROD-004-NOTES.md).

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15 (Ubuntu 16.15-1.pgdg24.04+2)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-1.pgdg24.04+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accusations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accusations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_id uuid,
    submitted_culprit text NOT NULL,
    motive text NOT NULL,
    method text NOT NULL,
    supporting_evidence uuid[] DEFAULT '{}'::uuid[],
    evaluation_result text,
    submission_timestamp timestamp without time zone DEFAULT now(),
    resolved_at timestamp without time zone
);


--
-- Name: canonical_truth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.canonical_truth (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    culprit text NOT NULL,
    motive text NOT NULL,
    method text NOT NULL,
    timeline jsonb DEFAULT '[]'::jsonb,
    hidden_events jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    solution_explanation text,
    red_herrings jsonb DEFAULT '[]'::jsonb NOT NULL,
    alternative_theories jsonb DEFAULT '[]'::jsonb NOT NULL,
    clue_resolutions jsonb DEFAULT '{}'::jsonb NOT NULL,
    actual_timeline jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: COLUMN canonical_truth.solution_explanation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.canonical_truth.solution_explanation IS 'PRIVATE. Full narrative explanation of what actually happened; reveal only after a correct verdict (PROD-009).';


--
-- Name: COLUMN canonical_truth.red_herrings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.canonical_truth.red_herrings IS 'PRIVATE. Misleading clues with their apparent meaning and true explanation.';


--
-- Name: COLUMN canonical_truth.alternative_theories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.canonical_truth.alternative_theories IS 'PRIVATE. Plausible competing theories and the evidence that eliminates each.';


--
-- Name: COLUMN canonical_truth.clue_resolutions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.canonical_truth.clue_resolutions IS 'PRIVATE. Map of evidence label -> how that clue is finally resolved.';


--
-- Name: COLUMN canonical_truth.actual_timeline; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.canonical_truth.actual_timeline IS 'PRIVATE. Authoritative event sequence used by the solution reveal.';


--
-- Name: case_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_achievements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_id uuid,
    achievement_type text,
    unlocked_at timestamp without time zone DEFAULT now()
);


--
-- Name: cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    genre text,
    difficulty text,
    duration text,
    publication_status text DEFAULT 'published'::text,
    case_version text DEFAULT '1.0'::text,
    canonical_package_reference text,
    briefing text,
    initial_characters jsonb DEFAULT '[]'::jsonb,
    initial_facts jsonb DEFAULT '[]'::jsonb,
    objectives text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: characters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.characters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid,
    name text NOT NULL,
    role text,
    personality text,
    background text,
    knowledge jsonb DEFAULT '{}'::jsonb,
    beliefs jsonb DEFAULT '{}'::jsonb,
    secrets jsonb DEFAULT '{}'::jsonb,
    dialogue_constraints text,
    alibi text,
    confirmed_alibi text,
    relationships jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    motive text
);


--
-- Name: COLUMN characters.motive; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.characters.motive IS 'Apparent/known motive shown on a suspect profile. Not canonical truth.';


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_id uuid,
    participants text[] DEFAULT '{}'::text[],
    message_history jsonb DEFAULT '[]'::jsonb,
    summary text DEFAULT ''::text,
    context_references jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: deduction_checkpoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deduction_checkpoints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_id uuid NOT NULL,
    checkpoint_id text NOT NULL,
    submitted_theory text NOT NULL,
    supporting_evidence uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    result text DEFAULT 'plausible'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: development_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.development_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_id uuid NOT NULL,
    kind text NOT NULL,
    message text NOT NULL,
    evidence_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evidence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid,
    category text,
    source text,
    description text NOT NULL,
    hidden_interpretation text,
    discovery_conditions jsonb DEFAULT '{}'::jsonb,
    release_conditions jsonb DEFAULT '{}'::jsonb,
    timeline_reference text,
    reliability text,
    associated_characters text,
    supported_hypotheses jsonb DEFAULT '[]'::jsonb,
    contradicted_hypotheses jsonb DEFAULT '[]'::jsonb,
    player_visible boolean DEFAULT true,
    discovery_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: evidence_discoveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evidence_discoveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_id uuid NOT NULL,
    evidence_id uuid NOT NULL,
    trigger text DEFAULT 'manual'::text NOT NULL,
    discovered_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: investigation_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investigation_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_id uuid NOT NULL,
    action text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: investigation_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investigation_state (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_id uuid,
    discovered_evidence_ids uuid[] DEFAULT '{}'::uuid[],
    current_theories jsonb DEFAULT '{}'::jsonb,
    suspicion_levels jsonb DEFAULT '{}'::jsonb,
    completed_checkpoints text[] DEFAULT '{}'::text[],
    investigation_stage text DEFAULT 'available'::text,
    last_updated timestamp without time zone DEFAULT now()
);


--
-- Name: investigations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investigations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    case_id uuid,
    status text DEFAULT 'active'::text,
    start_timestamp timestamp without time zone DEFAULT now(),
    current_stage text,
    progress integer DEFAULT 0,
    completion_timestamp timestamp without time zone,
    current_theory text,
    suspicion_level text,
    discovered_evidence_ids uuid[] DEFAULT '{}'::uuid[],
    pending_events jsonb DEFAULT '{}'::jsonb,
    theory_history jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    accusation_attempts integer DEFAULT 0 NOT NULL,
    last_accusation_at timestamp without time zone,
    accusation_cooldown_until timestamp without time zone
);


--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_id uuid,
    entry_type text,
    content text NOT NULL,
    related_evidence_ids uuid[] DEFAULT '{}'::uuid[],
    is_confirmed boolean DEFAULT false,
    creation_timestamp timestamp without time zone DEFAULT now()
);


--
-- Name: scheduled_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investigation_id uuid,
    event_type text,
    trigger_condition jsonb DEFAULT '{}'::jsonb,
    scheduled_timestamp timestamp without time zone,
    release_status text DEFAULT 'pending'::text,
    associated_evidence uuid,
    narrative_payload jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text,
    password_hash text,
    preferences jsonb,
    notification_settings jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


-- =============================================================================
-- P2-SESSIONS — durable auth sessions (effects of migration 004).
-- token_hash stores SHA-256 of the raw httpOnly cookie token, never the token.
-- =============================================================================

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    token_hash text NOT NULL,
    user_id uuid NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT sessions_pkey PRIMARY KEY (token_hash)
);

COMMENT ON TABLE public.sessions IS 'P2-SESSIONS. Durable auth sessions; token_hash is SHA-256 of the raw httpOnly cookie token.';
COMMENT ON COLUMN public.sessions.token_hash IS 'Primary key. SHA-256 digest of the random session token; the raw token is only in the client cookie.';
COMMENT ON COLUMN public.sessions.expires_at IS 'Server-authoritative session expiry. Expired rows are ignored and cleaned up lazily.';

--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);

--
-- Name: idx_sessions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_expires_at ON public.sessions USING btree (expires_at);

--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- =============================================================================
-- P2-RATE-LIMITS — durable fixed-window rate counters (effects of migration 005).
-- key_hash stores SHA-256 of "<limiter>:<client-ip>"; no raw IP is persisted.
-- =============================================================================

--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limits (
    key_hash text NOT NULL,
    window_start timestamp without time zone NOT NULL,
    reset_at timestamp without time zone NOT NULL,
    count bigint DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT rate_limits_pkey PRIMARY KEY (key_hash)
);

COMMENT ON TABLE public.rate_limits IS 'P2-RATE-LIMITS. Durable fixed-window rate counters; key_hash is SHA-256 of "<limiter>:<client-ip>".';
COMMENT ON COLUMN public.rate_limits.key_hash IS 'Primary key. SHA-256 digest of the rate-limit bucket key; the raw client IP is never stored.';
COMMENT ON COLUMN public.rate_limits.reset_at IS 'End of the current fixed window. Rows at or before now() are expired and pruned by the sweeper.';
COMMENT ON COLUMN public.rate_limits.count IS 'Requests consumed in the current window; incremented atomically by the API.';

--
-- Name: idx_rate_limits_reset_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limits_reset_at ON public.rate_limits USING btree (reset_at);


--
-- Name: weekly_collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    release_date timestamp without time zone,
    included_case_ids uuid[] DEFAULT '{}'::uuid[],
    featured_case_id uuid,
    publication_status text DEFAULT 'upcoming'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: accusations accusations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accusations
    ADD CONSTRAINT accusations_pkey PRIMARY KEY (id);


--
-- Name: canonical_truth canonical_truth_case_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canonical_truth
    ADD CONSTRAINT canonical_truth_case_id_key UNIQUE (case_id);


--
-- Name: canonical_truth canonical_truth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.canonical_truth
    ADD CONSTRAINT canonical_truth_pkey PRIMARY KEY (id);


--
-- Name: case_achievements case_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_achievements
    ADD CONSTRAINT case_achievements_pkey PRIMARY KEY (id);


--
-- Name: cases cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_pkey PRIMARY KEY (id);


--
-- Name: characters characters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: deduction_checkpoints deduction_checkpoints_investigation_id_checkpoint_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deduction_checkpoints
    ADD CONSTRAINT deduction_checkpoints_investigation_id_checkpoint_id_key UNIQUE (investigation_id, checkpoint_id);


--
-- Name: deduction_checkpoints deduction_checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deduction_checkpoints
    ADD CONSTRAINT deduction_checkpoints_pkey PRIMARY KEY (id);


--
-- Name: development_log development_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.development_log
    ADD CONSTRAINT development_log_pkey PRIMARY KEY (id);


--
-- Name: evidence_discoveries evidence_discoveries_investigation_id_evidence_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence_discoveries
    ADD CONSTRAINT evidence_discoveries_investigation_id_evidence_id_key UNIQUE (investigation_id, evidence_id);


--
-- Name: evidence_discoveries evidence_discoveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence_discoveries
    ADD CONSTRAINT evidence_discoveries_pkey PRIMARY KEY (id);


--
-- Name: evidence evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT evidence_pkey PRIMARY KEY (id);


--
-- Name: investigation_actions investigation_actions_investigation_id_action_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investigation_actions
    ADD CONSTRAINT investigation_actions_investigation_id_action_key UNIQUE (investigation_id, action);


--
-- Name: investigation_actions investigation_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investigation_actions
    ADD CONSTRAINT investigation_actions_pkey PRIMARY KEY (id);


--
-- Name: investigation_state investigation_state_investigation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investigation_state
    ADD CONSTRAINT investigation_state_investigation_id_key UNIQUE (investigation_id);


--
-- Name: investigation_state investigation_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investigation_state
    ADD CONSTRAINT investigation_state_pkey PRIMARY KEY (id);


--
-- Name: investigations investigations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investigations
    ADD CONSTRAINT investigations_pkey PRIMARY KEY (id);


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);


--
-- Name: scheduled_events scheduled_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_events
    ADD CONSTRAINT scheduled_events_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: weekly_collections weekly_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_collections
    ADD CONSTRAINT weekly_collections_pkey PRIMARY KEY (id);


--
-- Name: idx_deduction_checkpoints_inv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deduction_checkpoints_inv ON public.deduction_checkpoints USING btree (investigation_id);


--
-- Name: idx_development_log_inv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_development_log_inv ON public.development_log USING btree (investigation_id, created_at DESC);


--
-- Name: idx_evidence_discoveries_inv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evidence_discoveries_inv ON public.evidence_discoveries USING btree (investigation_id);


--
-- Name: idx_investigation_actions_inv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_investigation_actions_inv ON public.investigation_actions USING btree (investigation_id);


--
-- Name: characters characters_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: deduction_checkpoints deduction_checkpoints_investigation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deduction_checkpoints
    ADD CONSTRAINT deduction_checkpoints_investigation_id_fkey FOREIGN KEY (investigation_id) REFERENCES public.investigations(id) ON DELETE CASCADE;


--
-- Name: development_log development_log_evidence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.development_log
    ADD CONSTRAINT development_log_evidence_id_fkey FOREIGN KEY (evidence_id) REFERENCES public.evidence(id) ON DELETE SET NULL;


--
-- Name: development_log development_log_investigation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.development_log
    ADD CONSTRAINT development_log_investigation_id_fkey FOREIGN KEY (investigation_id) REFERENCES public.investigations(id) ON DELETE CASCADE;


--
-- Name: evidence evidence_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT evidence_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: evidence_discoveries evidence_discoveries_evidence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence_discoveries
    ADD CONSTRAINT evidence_discoveries_evidence_id_fkey FOREIGN KEY (evidence_id) REFERENCES public.evidence(id) ON DELETE CASCADE;


--
-- Name: evidence_discoveries evidence_discoveries_investigation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence_discoveries
    ADD CONSTRAINT evidence_discoveries_investigation_id_fkey FOREIGN KEY (investigation_id) REFERENCES public.investigations(id) ON DELETE CASCADE;


--
-- Name: investigation_actions investigation_actions_investigation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investigation_actions
    ADD CONSTRAINT investigation_actions_investigation_id_fkey FOREIGN KEY (investigation_id) REFERENCES public.investigations(id) ON DELETE CASCADE;


--
-- Name: investigations investigations_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investigations
    ADD CONSTRAINT investigations_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id);


--
-- PostgreSQL database dump complete
--



-- =============================================================================
-- M2 knowledge system (migration 006) - additive tables.
-- Mirrors migrations/006_m2_knowledge.sql so ci-schema.sql remains a complete
-- schema snapshot. No FKs; references are enforced in application code.
-- =============================================================================

CREATE TABLE public.specialists (
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

CREATE TABLE public.case_specialists (
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

CREATE INDEX idx_case_specialists_case_id ON public.case_specialists USING btree (case_id);

CREATE TABLE public.knowledge_artifacts (
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

CREATE INDEX idx_knowledge_artifacts_case_id ON public.knowledge_artifacts USING btree (case_id);

CREATE TABLE public.knowledge_disagreements (
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

CREATE INDEX idx_knowledge_disagreements_case_id ON public.knowledge_disagreements USING btree (case_id);

CREATE TABLE public.notebook_entries (
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

CREATE INDEX idx_notebook_entries_investigation_created ON public.notebook_entries USING btree (investigation_id, created_at DESC);
