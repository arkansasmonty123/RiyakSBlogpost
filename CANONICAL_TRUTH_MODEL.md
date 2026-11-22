# Canonical Truth Data Model

## Purpose
Structured representation of the authoritative underlying truth for each case. This model enables deterministic verdict evaluation against the canonical solution, as required by PRD §10.2 and PRD §22.1.

## Model Structure

### `canonical_truth` Table (Server-Side Only)
This table must NEVER be exposed through ordinary client API responses. Access is restricted to server-side validation functions only.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `case_id` | UUID | Foreign key referencing `cases(id)` on DELETE CASCADE |
| `culprit` | TEXT | The actual person responsible for the incident |
| `motive` | TEXT | Why the incident happened |
| `method` | TEXT | How the incident was carried out |
| `timeline` | JSONB | Structured array of events with timestamps and participants |
| `hidden_events` | JSONB | Events not initially visible to players; reveal Conditions |
| `participant_knowledge` | JSONB | Per-participant knowledge boundaries (what each character knows/believes/hides) |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

### `participant_knowledge` JSONB Structure
```json
{
  "character_id": {
    "known": ["fact1", "fact2", ...],          // What this character definitely knows
    "believed": ["factA", "factB", ...],        // What this character believes (possibly misconceptions)
    "hidden": ["secret1", "secret2", ...],      // What this character is concealing
    "witnessed": ["event1", "event2", ...]      // What this character witnessed
  }
```

## Migration Script (Example)

```sql
CREATE TABLE canonical_truth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  culprit TEXT NOT NULL,
  motive TEXT NOT NULL,
  method TEXT NOT NULL,
  timeline JSONB NOT NULL DEFAULT '[]',
  hidden_events JSONB NOT NULL DEFAULT '[]',
  participant_knowledge JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast case lookups
CREATE INDEX idx_canonical_truth_case_id ON canonical_truth(case_id);
```

## Integration with Accusation Evaluation

### Workflow
1. Player submits accusation via `POST /api/investigations/:id/accusation`
2. Server resolves `investigation_id → case_id` from the `investigations` table
3. Server queries `canonical_truth` for the corresponding `case_id`
4. Server runs deterministic evaluation comparing accusation against canonical truth
5. Returns verdict: `correct`/`incorrect`/`partial`

### Deterministic Evaluation Rules

| Condition | Verdict | Notes |
|-----------|---------|-------|
| `submittedCulprit === canonical_culprit` | `correct` | Only when canonical truth model is populated |
| `suspectNames.includes(submittedCulprit)` | `partial` | Suspect is involved but not the primary culprit |
| `!suspectNames.includes(submittedCulprit)` | `incorrect` | Investigation continues |
| No canonical truth populated | `incorrect` (default) | Prevents false-positive verdicts |

### Example Evaluation Function (SQL/PSQL)

```sql
CREATE OR REPLACE FUNCTION evaluate_accusation(
  p_investigation_id UUID,
  p_submitted_culprit TEXT
) RETURNS TABLE (
  verdict TEXT,
  message TEXT
) AS $$
DECLARE
  v_case_id UUID;
  v_culprit TEXT;
  v_motive TEXT;
  v_method TEXT;
BEGIN
  -- Resolve case from investigation
  SELECT case_id INTO v_case_id FROM investigations WHERE id = p_investigation_id;
  
  -- Pull canonical truth
  SELECT culprit, motive, method INTO v_culprit, v_motive, v_method
  FROM canonical_truth WHERE case_id = v_case_id;
  
  -- Default if no canonical truth populated
  IF v_culprit IS NULL THEN
    RETURN QUERY SELECT 'incorrect', 'Investigation continues - canonical truth not yet populated';
  END IF;
  
  -- Deterministic evaluation
  IF v_culprit = p_submitted_culprit THEN
    RETURN QUERY SELECT 'correct', 'Your accusation is correct!';
  ELSE
    RETURN QUERY SELECT 'incorrect', 'Your accusation is incorrect. The investigation continues.';
  END IF;
END;
$$ LANGUAGE plpgsql;
```

## Security & Privacy

### Strict Access Controls
1. **Table never exposed** through ordinary client API responses
2. **Row-level security** policies prevent direct queries from application code
3. **All evaluation is server-side** - client never sees canonical culprit, motive, or method
4. **Audit trail** - all verdict evaluations logged with investigation ID and timestamp

### PRD Compliance
- **PRD §1**: "The AI exists to bring the investigation to life, not to invent the truth as the player progresses."
- **PRD §22.1**: "The final solution must be logically supported by discovered evidence."
- **PRD §22.9**: "The client must never be trusted with authoritative hidden information."
- **PRD §13.2**: "The canonical solution and unreleased evidence must never be exposed through ordinary client API responses."