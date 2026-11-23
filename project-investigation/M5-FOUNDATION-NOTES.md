# M5 Foundation Notes (Perspective Engine)

> Task `M5-FOUNDATION`. Additive foundation only — no final content, no API routes, no UI.
> M5-CONTENT / M5-API / M5-UI follow. See `project-management/M5-SOURCE-NOTES.md` for
> bibliographic notes that must drive the 12 experiences.

## What landed

- **Migration `009_m5_perspective_engine.sql`** (additive, idempotent): 4 new tables
  (`perspective_frameworks`, `perspective_experiences`, `perspective_reflections`,
  `perspective_suggestion_state`) + indexes, and 3 nullable provenance columns
  (`investigation_claims.source_perspective_experience_id`,
  `investigation_claims.source_perspective_reflection_id`,
  `notebook_entries.perspective_experience_id`). No canonical truth access anywhere.
- **`src/perspectives/`** (all pure — no db/server/canonical imports):
  `types.ts` (allowlists, guards, shapes, bounded limits, fingerprint),
  `frameworks.ts` (7 lenses), `experiences/index.ts` (empty registry),
  `discovery.ts`, `case-bridges.ts`, `recommendations.ts` (advisory, no mutation),
  `dto.ts` (source URL null unless verified + verified status),
  `specialist-context.ts` (bounded, epistemic labels), `registry.ts` (public surface).
- **`src/db.ts`**: column aliases + optional provenance fields on `RealityClaim` /
  `NotebookEntry` maps; DB functions for frameworks, experiences (by key/filters),
  reflections, and advisory suggestion state (upsert/list). Scoped by user_id and
  investigation_id. No canonical reads.
- **Scripts/wiring**: `db:seed:perspectives`, `perspectives:validate` (read-only),
  wired into `npm test` and CI (migration 009 added to bootstrap loop + seed/validate steps).
  `verify-schema.ts` and `scripts/ci-schema.sql` mirror the new schema.

## The 7 frameworks (framework_key)

1. `skeptical_inquiry` — Skeptical Inquiry (epistemology / critical thinking)
2. `scientific_reasoning` — Scientific & Falsificationist Reasoning
3. `historical_analysis` — Historical & Source-Critical Analysis
4. `legal_reasoning` — Legal & Adversarial Reasoning
5. `cognitive_psychology` — Cognitive & Behavioral Lens
6. `philosophical_ethics` — Ethical & Philosophical Reflection
7. `systems_thinking` — Systems & Probabilistic Thinking

Each ships core questions, key concepts, a method of reasoning, limitations,
common misconceptions, **internal differences**, and relevant disciplines.

## Seed / validate behaviour

- `db:seed:perspectives` applies migration 009 defensively, then keyed-upserts the
  7 frameworks and 0 experiences (registry is intentionally empty). Idempotent.
- `perspectives:validate` PASSES with **2 warnings** (no experiences, 0/12) while
  `PERSPECTIVES_MIN_EXPERIENCES` defaults to 0. Set it to 12 once M5-CONTENT lands
  to make the count a hard failure. It checks schema, framework completeness,
  experience content/provenance rules, short quotes, canonical-leakage terms,
  DTO verified-URL behaviour, and static purity of the recommender + DTO modules.

## Verification executed (local, 2026-11-23)

- `npm run typecheck` — PASS
- `npm run db:seed:perspectives` — PASS (7 frameworks, 0 experiences)
- `npm run db:schema:verify` — PASS (32 tables / 371 columns, migrations 0..9)
- `npm run perspectives:validate` — PASS (2 expected warnings)
- `npm run test:smoke` — PASS
- `npm run test:http` — 88/88 PASS
- `npm run build --prefix frontend` — PASS
- `npm test` (full chain incl. new steps) — EXIT 0

## TODO for downstream tasks

- **M5-CONTENT**: author the 12 experiences into
  `src/perspectives/experiences/index.ts` using `M5-SOURCE-NOTES.md`; keep quotes
  short, `verification_status` honest (default `pending_review`), no invented URLs,
  no canonical leakage. Then set `PERSPECTIVES_MIN_EXPERIENCES=12` in CI.
- **M5-API**: add investigation-scoped, owner-guarded routes for frameworks/
  experiences/reflections/suggestion-state. Import only from `src/perspectives/registry.ts`
  and the new `src/db.ts` functions; suggestions must stay advisory and never write
  canonical/progression/evidence state.
- **M5-UI**: add a Perspectives tab using the public DTOs (summary vs detail).
  Reflections are player notes; suggestion state is dismissed/opened/saved only.

## Pre-existing risk (NOT introduced by M5)

- `scripts/ci-schema.sql` and `migrations/000_baseline.sql` create a FK
  (`sessions_user_id_fkey`) before `users_pkey`, so applying them to an empty DB with
  `psql -v ON_ERROR_STOP=1` fails at that legacy line. M5's appended schema section is
  purely additive (git diff: +139 lines at EOF) and produces the expected 32 tables /
  371 columns. Flagged for orchestrator; out of M5-FOUNDATION scope.
