-- PROD-007 / GAP-02+03: enrich canonical_truth with server-only solution data.
-- Additive + idempotent. Every column is private server-side data; no API route
-- may return these fields until PROD-009 wires a post-correct-verdict reveal.
--
-- Apply with: psql -d investigation -f migrations/001_prod007_canonical_truth.sql

ALTER TABLE canonical_truth
  ADD COLUMN IF NOT EXISTS solution_explanation TEXT,
  ADD COLUMN IF NOT EXISTS red_herrings        JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS alternative_theories JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS clue_resolutions     JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS actual_timeline      JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN canonical_truth.solution_explanation IS
  'PRIVATE. Full narrative explanation of what actually happened; reveal only after a correct verdict (PROD-009).';
COMMENT ON COLUMN canonical_truth.red_herrings IS
  'PRIVATE. Misleading clues with their apparent meaning and true explanation.';
COMMENT ON COLUMN canonical_truth.alternative_theories IS
  'PRIVATE. Plausible competing theories and the evidence that eliminates each.';
COMMENT ON COLUMN canonical_truth.clue_resolutions IS
  'PRIVATE. Map of evidence label -> how that clue is finally resolved.';
COMMENT ON COLUMN canonical_truth.actual_timeline IS
  'PRIVATE. Authoritative event sequence used by the solution reveal.';

-- Explicit apparent-motive field for suspect profiles (PRD 4.x / Stage B).
-- This is the *publicly inferable* motive, not the canonical truth.
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS motive TEXT;

COMMENT ON COLUMN characters.motive IS
  'Apparent/known motive shown on a suspect profile. Not canonical truth.';
