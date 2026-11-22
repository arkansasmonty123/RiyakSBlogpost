# M4 Backend — Reality Map (player-owned reasoning notes)

Status: **complete** (backend + validators + smoke; no frontend UI in this pass).

## Files changed / created

| File | Summary |
|---|---|
| `migrations/008_m4_reality_map.sql` | NEW, additive, idempotent: `investigation_claims`, `investigation_hypotheses`, `reality_map_links` (3 tables, indexes, CHECKs, comments). No FKs. Player notes only. |
| `scripts/ci-schema.sql` | Mirrored 008 DDL (CI snapshot). |
| `scripts/verify-schema.ts` | Added the 3 tables to `EXPECTED_TABLES`. |
| `.github/workflows/ci.yml` (workspace root) | Bootstrap loop applies `migrations/008_*`; added `reality-map:validate` CI step. |
| `src/reality-map.ts` | NEW pure module: limits/guards, DTO allowlists, `buildMaterialIndex`, `deriveTensions`, `buildReasoningAudit`, `buildHypothesisReviewContext`, `deterministicHypothesisReview`, `buildHypothesisComparison`. No db/canonical imports. |
| `src/reality-map-prompts.ts` | NEW: question-only prompt packs for the 3 showcase cases + labelled tutorial scaffolding. |
| `src/db.ts` | COLUMN_ALIASES + scoped CRUD for claims/hypotheses/links, `deleteClaim`/`deleteHypothesis` tx cleanup, `resolveLinkTarget` (visible-only), `countRealityRows`, `deleteTutorialRealityExamples`. |
| `src/server.ts` | 15 investigation-scoped Reality Map endpoints (see below). |
| `scripts/validate-reality-map.ts` | NEW read-only validator; `reality-map:validate` npm script added to `npm test`. |
| `scripts/smoke-http.ts` | 15 new M4 HTTP tests (88/88 total). |
| `package.json` | `reality-map:validate` script + wired into `npm test`. |

## Migration summary (008)

- `investigation_claims`: id, investigation_id, user_id, title, description, claim_category (7-value CHECK), confidence (4-value CHECK), notes, source_journal_entry_id, source_notebook_entry_id, is_tutorial, created_at, updated_at; index `(investigation_id, created_at DESC)`.
- `investigation_hypotheses`: id, investigation_id, user_id, name, explanation, status (4-value CHECK), confidence (4-value CHECK), missing_information, alternative_explanations, player_notes, is_tutorial, timestamps; index `(investigation_id, created_at ASC)`.
- `reality_map_links`: id, investigation_id, user_id, owner_type, owner_id, target_type, target_id, relationship (6-value CHECK), rationale, is_tutorial, timestamps; UNIQUE(owner_type, owner_id, target_type, target_id); shape CHECK enforcing the 3 legal shapes; indexes on investigation_id, (owner_type, owner_id), (target_type, target_id).
- Comments state player-owned, never used by verdict/progression. No canonical data stored anywhere.

## Endpoint contracts (all under `/api/investigations/:investigationId`, auth + ownership + progression inherited)

| Method | Path | Notes |
|---|---|---|
| GET | `/reality-map` | Snapshot: caseId, investigationId, investigationStatus, claims, hypotheses, links (resolved labels; stale/invisible links filtered), tensions, materials (visible evidence only, safe artifacts/specialists/character names/journal/notebook), reasoningPrompts, tutorialAvailable/Present, limits used/max. |
| POST | `/reality-map/claims` | 201. Allowlisted/bounded; source journal/notebook ids verified same investigation (+ notebook same user). 409 at cap. |
| PATCH | `/reality-map/claims/:claimId` | 200; allowlist `{title,description,claimCategory,confidence,notes}`; empty 400; 404 if not found in investigation. |
| DELETE | `/reality-map/claims/:claimId` | 200 `{deleted, removedLinks}`; tx removes owner+target links. |
| POST/PATCH/DELETE | `/reality-map/hypotheses[/:hypothesisId]` | Same pattern; PATCH also accepts `status` (active/weakened/strengthened/archived) and `confidence`. DELETE supported with link cleanup. |
| POST | `/reality-map/links` | 201. Shape-validated; owner in investigation; target via `resolveLinkTarget` (hidden/other-case → 404). Duplicate 23505 → 409 `{error:'Relationship already exists', linkId}`. |
| PATCH/DELETE | `/reality-map/links/:linkId` | PATCH `{relationship?,rationale?}` re-checks shape legality; DELETE 200 `{deleted}`. |
| GET | `/reality-map/compare?hypothesisIds=a,b[,c,d]` | 2–4 owned ids; 400/404; structured comparison + questions + disclaimer. |
| POST | `/reality-map/reasoning-review` | 6-section audit, provenance per item, provenanceLegend, disclaimer, deterministic `aiSummary` (USE_LLM=false; optional grounded LLM enhancement with deterministic fallback). NO writes. |
| POST | `/reality-map/hypotheses/:hypothesisId/specialist-review` | `{specialistKey,focus,compareWithHypothesisId?,targetSpecialistKey?}`; focus in assumptions/discriminate/alternatives/falsify/critique (critique requires target). Bounded grounded context, specialist voice, provenance/disclaimer. NO writes (no messages persisted). |
| POST | `/reality-map/tutorial-examples` | `confirm:true` required (else 400). 409 if unavailable/already present. Labelled blank scaffolding, zero links. |
| DELETE | `/reality-map/tutorial-examples` | Removes only `is_tutorial` rows (tx); 200 with counts. |

Writes use `writeLimiter`; AI review endpoints use `chatLimiter`.

## Safety invariants (verified)

- No module in this feature imports/reads `canonical_truth` (validator static guard + code review).
- Hidden evidence unreachable at link-create (`resolveLinkTarget` → `getEvidenceByCase`) and snapshot-read (materials from same vetted source + link resolution filter).
- Confidence is the 4-value subjective enum only; no numeric probabilities in schema, DTOs, audit or context.
- Tensions/audits/reviews surface questions and never resolve disputes or pick a correct hypothesis.
- Specialist/AI paths are read-only: no claims/hypotheses/links/messages written (smoke test compares state before/after).
- Character names are intentionally public (existing PROD-013 suspect-board behaviour); hidden solution facts are not.

## Verification (executed in `project-investigation/`)

- `npm run typecheck` — PASS
- `npm run db:schema:verify` — PASS (9 migrations, 28/28 tables, 296 columns)
- `npm run test:smoke` — PASS
- `npm run db:seed:knowledge` — PASS (10 specialists, 17 artifacts, 4 disagreements)
- `npm run knowledge:validate` — PASS
- `npm run case:validate` — PASS (25 cases, 202 evidence, 25 canonical rows)
- `npm run reality-map:validate` — PASS
- `npm run test:http` — PASS (88/88; 73 pre-existing + 15 M4)
- `npm test` — PASS (all of the above in sequence)
- `cd frontend && npm run build` — PASS

Note: repeated local `test:http` runs accumulate DB-backed rate-limit counters (AUTH_MAX=500/15min per IP); ephemeral `rate_limits` rows were cleared between local verification runs. CI starts with a fresh DB, so no issue there.

## Known TODOs for the frontend wave (M4-6)

- Build the Reality Map tab/UI in `InvestigationRoomPage` using `GET /reality-map` snapshot (`claims`, `hypotheses`, `links`, `tensions`, `materials`, `reasoningPrompts`, `tutorialAvailable/Present`, `limits`).
- Wire claim/hypothesis create/edit/delete, link builder with legal shapes, compare view, reasoning-review panel (render 6 sections + provenanceLegend + disclaimer), specialist-review controls, and tutorial add/remove with `confirm:true`.
- Use `api.ts` patterns already used for notebook/knowledge; render enums as human labels (no numeric confidence).
- Respect existing detective-theme tokens and reduced-motion; visual verification via Playwright.
