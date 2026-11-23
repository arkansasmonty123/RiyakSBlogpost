# PROD-007 — Case content upgrade ("The Midnight Heist")

Additive data/schema upgrade for PRD MVP gaps GAP-02 (thin case content) and the
data half of GAP-03 (no solution explanation). No progression engine or verdict
reveal UI was wired — those are PROD-008 / PROD-009.

## Files changed

| File | Change |
|---|---|
| `migrations/001_prod007_canonical_truth.sql` | New idempotent `ALTER TABLE` migration. Adds `solution_explanation`, `red_herrings`, `alternative_theories`, `clue_resolutions`, `actual_timeline` to `canonical_truth`; adds `motive` to `characters`. All columns nullable/defaulted or documented PRIVATE. |
| `seed.sql` | Replaced the thin incremental seed with the canonical, idempotent case seed (case/characters/evidence/canonical truth). Preserves case id `fba51632-6d0d-4736-8200-2fd6df5ba1cc`. Updates existing rows in place; inserts missing rows via `WHERE NOT EXISTS`. |
| `update_case.sql` | Kept as a compatibility helper; now consistent with `seed.sql` (old "Midnight Star" briefing removed). |
| `src/db.ts` | Added `CanonicalTruth` interface and server-only `getCanonicalTruth(caseId)` accessor using explicit camelCase aliases. `evaluateAccusation` still reads only culprit/motive/method and remains deterministic. |
| `drizzle/schema.ts` | Documented `canonical_truth` (missing before) and the new `characters.motive` column — reduces BUG-003 drift. |
| `scripts/smoke-db.ts` | Added PROD-007 data-quality assertions (5+ profiled suspects, enriched canonical truth, 8-10 evidence items with conditions/timeline, 4/6 visible/gated split) and extra non-leakage checks for discovery/release rules. |
| `scripts/smoke-http.ts` | Added two PROD-007 API tests (character knowledge/beliefs/secrets never exposed; case response never contains canonical-truth fields) and a `SMOKE_BASE_URL` override so the harness can target a dedicated server without stopping an existing dev server on port 3000. |

Apply order for a fresh environment:

```bash
psql -d investigation -f migrations/001_prod007_canonical_truth.sql
psql -d investigation -f seed.sql
```

## Story summary (canonical, private)

Victor Sterling — bankrupt lead sponsor — stole the Star of the North during a
12-minute scheduled sensor blackout he had secretly arranged, using a spare
keycard from his sister Martha, a laser cutter from his own sponsor gift, and a
concealed service passage into his adjacent building. The guard attack was a
diversion; Martha's fingerprint and Jasper's coat were planted. The insurance
policy held by Victor's shell company supplies the motive. The diamond is in a
hollow trophy in his office.

## Content now present

- **6 characters**: 5 suspects (Victor, Martha, Jasper, Guard Mills, Daphne Chen)
  + 1 witness (Dr. Elena Rhodes). Every character has non-empty `knowledge`,
  `beliefs`, `secrets`, `background`, `alibi` and an explicit `motive`; canonical
  culprit Victor Sterling is fully profiled.
- **10 evidence items**: 4 initially visible, 6 gated (`player_visible = false`).
  All have `discovery_conditions` and `timeline_reference`; gated items also have
  `release_conditions` and `hidden_interpretation` with supported/contradicted
  hypotheses for the future release engine.
- **Canonical truth enrichment**: full `solution_explanation`, 4 `red_herrings`,
  2 eliminated `alternative_theories` (curator inside job; Jasper returns), a
  `clue_resolutions` map, and an 8-step `actual_timeline`.

## Leakage boundary

`toSafeEvidence` (db.ts) and `toPublicCharacter` (server.ts) still project only
public fields. `hidden_interpretation`, `discovery_conditions`,
`release_conditions`, `supported_hypotheses`, `contradicted_hypotheses`,
`knowledge`, `beliefs`, `secrets` and all new canonical-truth columns are never
selected by an API route. `getCanonicalTruth` is marked SERVER-ONLY.

## Remaining for PROD-008 / PROD-009

- **PROD-008 (progression engine)**: consume `discovery_conditions` /
  `release_conditions` on gated evidence; flip `player_visible` server-side (or
  write discovered ids) on valid deduction/action/time triggers; no duplicate or
  premature releases. `discover-evidence` must continue rejecting hidden items.
- **PROD-009 (solution reveal)**: after a server-side `correct` verdict, expose a
  deliberately narrowed DTO built from `getCanonicalTruth` —
  `solution_explanation`, `red_herrings`, `alternative_theories` (with their
  eliminations), `clue_resolutions` and `actual_timeline`. Do **not** return
  `hidden_events`, the raw culprit/motive/method fields, or internal metadata
  before that verdict.
