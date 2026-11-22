-- PROD-008 / GAP-01 / MVP 11-13: async progression engine.
-- Additive + idempotent. All rows are owned by an investigation and are removed
-- automatically if that investigation is deleted (e.g. test cleanup).
--
-- Apply with:
--   psql -d investigation -f migrations/002_prod008_progression.sql
--
-- SECURITY: none of these tables is ever returned raw to a client. The API
-- projects only safe fields (messages, timestamps, checkpoint prompts).

-- Timestamps for every evidence discovery/release. UNIQUE makes release
-- idempotent (no duplicate evidence) and provides the clock needed for
-- min_minutes release delays and offline catch-up.
CREATE TABLE IF NOT EXISTS evidence_discoveries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  evidence_id      uuid NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  trigger          text NOT NULL DEFAULT 'manual',
  discovered_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (investigation_id, evidence_id)
);

-- Deduction checkpoints the player has reasoned through. Upserted on revision;
-- presence of a row means the checkpoint is completed.
CREATE TABLE IF NOT EXISTS deduction_checkpoints (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id   uuid NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  checkpoint_id      text NOT NULL,
  submitted_theory   text NOT NULL,
  supporting_evidence uuid[] NOT NULL DEFAULT '{}'::uuid[],
  result             text NOT NULL DEFAULT 'plausible',
  created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (investigation_id, checkpoint_id)
);

-- Investigation actions the player performed (investigation-triggered release).
CREATE TABLE IF NOT EXISTS investigation_actions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  action           text NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (investigation_id, action)
);

-- Player-safe development feed (catch-up / notifications). Messages are generic
-- and authored server-side; hidden interpretations and canonical truth never
-- appear here.
CREATE TABLE IF NOT EXISTS development_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  kind             text NOT NULL,
  message          text NOT NULL,
  evidence_id      uuid REFERENCES evidence(id) ON DELETE SET NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_discoveries_inv
  ON evidence_discoveries(investigation_id);
CREATE INDEX IF NOT EXISTS idx_deduction_checkpoints_inv
  ON deduction_checkpoints(investigation_id);
CREATE INDEX IF NOT EXISTS idx_investigation_actions_inv
  ON investigation_actions(investigation_id);
CREATE INDEX IF NOT EXISTS idx_development_log_inv
  ON development_log(investigation_id, created_at DESC);
