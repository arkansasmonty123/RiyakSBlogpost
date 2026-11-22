# GAP-15 — Seeded case validation (P2)

**Status:** implemented 2026-11-22 · read-only, no DB writes · PASS on seeded data.

## What was added

- `scripts/validate-case.ts` — a content linter for the seeded case data. It is
  strictly read-only: it issues `SELECT`s against the same DB configuration as
  `src/db.ts` (`DATABASE_URL`, else local socket / `investigation`) and reads
  `src/server.ts` / `src/db.ts` from disk. It never writes to the DB or a file.
- `npm run case:validate` in `package.json`.
- A separate `Seeded case content validation` step in
  `.github/workflows/ci.yml` (after DB smoke, before frontend build), so a
  content regression fails CI independently of schema/runtime tests.
- `README.md` command list updated.

## Checks implemented (per seeded case)

| # | Check | Rule |
|---|---|---|
| 1 | Evidence shape & gating | non-empty source/description; `discovery_conditions.type` is one of `initial`/`deduction`/`investigation_action`/`time`; deduction has `requires`; action has `action`; time has a positive `after_minutes`; `release_conditions.after` is an array whose entries resolve to a real evidence **id or source** in the same case (no unknown or self prereq); `min_minutes` numeric; `timeline_reference` contains a year. Duplicate source labels are flagged as ambiguous references. |
| 2 | Checkpoints & actions | every checkpoint id referenced from either condition object has an authored prompt in `mystery-engine.ts` `KNOWN_CHECKPOINTS`; a checkpoint referenced from `release_conditions` must actually be authored by some deduction condition. |
| 3 | Gated evidence reachability | fixed-point walk from the initially-visible briefing evidence; a gated item is reachable only if its trigger is satisfiable (checkpoint completable using at least one available relevant source, action performable, or time event authorable) **and** all `after` prerequisites are already reachable. Unreachable gated items fail. |
| 4 | Culprit | canonical `culprit` resolves to a character in the case whose role is `suspect` (not the witness). |
| 5 | Canonical truth fields | `culprit`, `motive`, `method`, `solution_explanation` non-empty; `timeline`, `red_herrings`, `alternative_theories`, `actual_timeline` arrays; `clue_resolutions` an object. Published case must have a canonical truth row. |
| 6 | Timeline sanity | narrative `timeline[]` and `actual_timeline[]` entries have `time` + `event`; `actual_timeline.seq` values unique. |
| 7 | Solution references | every `clue_resolutions` key and every evidence label cited in `actual_timeline[].evidence` / `alternative_theories[].disproven_by` resolves to a case evidence source; `hidden_events[].known_by` resolves to an authored character; herrings/theories have labels and non-empty resolutions. |
| 8 | Orphan rows | evidence/canonical rows referencing a missing case id fail. |
| 9 | Static DTO allowlists (source inspection) | `toSafeEvidence` (db.ts), `toPublicCharacter` (server.ts), the solution reveal DTO/route, and the player-facing evidence `SELECT`s must not mention private fields (`hidden_interpretation`, discovery/release conditions, hypotheses, `secrets`, `knowledge`, `beliefs`, `relationships`, `hidden_events`). Missing source markers are treated as failures so a refactor cannot silently disable the check. |

## Output / exit code

Clear per-section `PASS` / `FAIL` lines with issue details on failure and a final
`CASE VALIDATION: PASS | FAIL (n issue(s))` summary. Exit code `1` on any issue
(including DB connection failure), `0` only on a clean pass.

## Verification executed

- `npm run typecheck` — PASS.
- `npm run case:validate` — PASS (10 evidence / 6 gated, 6/6 reachable; 3 checkpoints, 2 actions; 10 clue keys resolved).
- Negative tests (tampered *copies* only, real project and DB untouched):
  - leaked `hiddenInterpretation` / `secrets` in copied DTOs → 2 static failures, exit code 1.
  - synthetic bad case (unknown culprit, unknown prereq/checkpoint, unreachable gated item, empty truth fields, malformed timelines, unresolved clue/evidence refs) → 11 data failures detected.

## Notes / non-goals

- The linter validates *data integrity*, not gameplay balance; it does not
  simulate a full playthrough or evaluate accusation scoring.
- Unknown checkpoint ids are intentionally treated as content errors even
  though `mystery-engine.ts` has a generic-prompt fallback — this catches typos
  and keeps authored prompts meaningful. New cases must add their checkpoint
  ids to `KNOWN_CHECKPOINTS`.
- `case:validate` was deliberately **not** added to `npm test` to avoid
  changing the existing test pipeline; CI runs it as a separate named step.
