# PROD-013 — Suspect board depth (GAP-08)

## Problem

PRD 4.D requires suspect profiles with background, relationship to the
incident, known motive, alibi, contradictions, relevant evidence, player
suspicion and unanswered questions. The existing `GET /api/cases/:caseId/characters`
projection only exposed id/name/role/personality/background/alibi and deliberately
omitted everything else, so the board was shallow. Enriching that public route
directly would have mixed investigation-scoped data (discovered evidence,
suspicion) into a case-scoped endpoint and widened the leak surface.

## Endpoint

`GET /api/investigations/:investigationId/suspects`

Mounted on `investigationRouter`, so `authMiddleware` + `requireOwnedInvestigation`
guarantee an authenticated owner before any character/evidence data is read
(401 unauthenticated, 403 non-owner, 404 unknown id). Response shape:

```jsonc
{
  "caseId": "...",
  "openQuestions": ["..."],            // open, spoiler-free deduction prompts
  "suspects": [{
    "id", "caseId", "name", "role",
    "personality", "background", "alibi", "confirmedAlibi",
    "motive": "...",                  // apparent/public portion only
    "relationships": [{ "name": "...", "label": "sister" }],
    "linkedEvidence": [{ "id", "source", "category", "timelineReference?", "examined" }],
    "linkedEvidenceCount": 2,
    "playerSuspicion": "high" | null,
    "unansweredQuestions": ["..."]
  }]
}
```

The existing `/cases/:caseId/characters` DTO is intentionally unchanged, so the
PRD-007/007-era regression test that asserts no `relationships` key there keeps
its original meaning.

## Anti-leak design

- `toPublicSuspectBoard` uses an explicit allowlist. It never queries
  `canonical_truth` and never reads `knowledge`, `beliefs`, `secrets`,
  `hiddenInterpretation`, `supportedHypotheses`, `contradictedHypotheses` or AI
  `dialogue_constraints`.
- `toPublicMotive` strips everything from the first `Hidden:` / `; in fact`
  marker. The seed stores apparent and canonical motive in one text column
  (e.g. Victor's `Hidden: a 20 million dollar insurance payout...`), so without
  this sanitizer the board would leak the canonical motive before completion.
- `toPublicRelationships` copies only string key/value pairs (public labels).
- Linked evidence comes from `getEvidenceByCase(caseId, userId)`, which already
  returns only `playerVisible` items plus evidence discovered/released in this
  user's own owned investigations for the case; hidden evidence is excluded.
  `examined` is derived from the investigation's own `discoveredEvidenceIds`.
- `playerSuspicion` comes from `investigation_state.suspicion_levels` via a new
  `getInvestigationSuspicionLevels` db helper that keeps only scalar values;
  non-scalar entries are dropped. No client input path writes this endpoint.
- `openQuestions` reuses the already-verified spoiler-free checkpoint prompts.

## Frontend

- New **Suspect Board** tab in the investigation room.
- Per suspect: role, player suspicion, personality/background, known motive,
  alibi + alibi status, known relationship labels, linked evidence (with
  examined state and count), and generated investigation prompts.
- Board-level open questions from the deduction checkpoints.
- The board refreshes with progression state after a theory/action, so newly
  released evidence appears immediately.

## Verification

`npm run typecheck`, `npm run test:smoke`, frontend `npm run build` and
`npm run test:http` all pass. `test:http` is **45/45** (42 pre-existing + 3 new
PROD-013 tests): safe-field presence, shape, no forbidden key/value leakage,
hidden motive stripping, linked-evidence visibility/ownership, and suspicion
projection from state.

## Risks / follow-ups

- The public `background` string is authored prose that can contain soft hints
  (e.g. "shell company ... holds the insurance policy"); it was already exposed
  on `/characters` and is public character data, not canonical truth. Tightening
  it would require a content/migration change, out of scope here.
- Suspicion map keys are character names (with an id fallback). A future client
  writer that uses different keys would simply see `null` until aligned.
