# DEV Status

> **Ownership**: Orchestrator maintains this file. Update after every meaningful task/milestone.  
> **Update rules**: Keep factual; include date/time context when known; do not remove history silently - summarize previous state if replaced.

## Current objective

Deliver PRD MVP for THE INVESTIGATION (`project-investigation/`) with autonomous orchestration, while maintaining persistent recovery/model policy.

## Current milestone

M8 complete (W1-W7 all delivered). All 7 waves delivered with documented conditions/gates. W1-W6 verified green with operator-required conditions; W7 beta-readiness artifacts operational. No public deployment. 133/133 test:http. See M8-COMPLETE-REPORT.md.

## Project snapshot (as inspected 2026-11-22 recovery)

- **Workspace**: `/home/divyanshukumarsinha241` (not a git repo)
- **Main project**: `project-investigation/` - "THE INVESTIGATION" (AI-powered mystery investigation platform)
- **PRD**: `project-investigation/PRD.md`
- **Prior status docs**: `project-investigation/IMPLEMENTATION_STATUS.md`, `project-investigation/PROJECT_AUDIT.md`, `project-investigation/IMPLEMENTATION_PLAN.md`, `FINAL_AUDIT.md`
- **Verification (2026-11-22 recovery, executed)**: `npm run typecheck` **PASS**; `npm run test:smoke` **FAIL** (Postgres service running, but `investigation` DB missing / connection init errors).
- **Reality vs stale docs**: `project-investigation/src/db.ts` (848 lines) contains canonical_truth evaluation wiring; `project-investigation/scripts/smoke-http.ts` exists. **Regression**: `project-investigation/src/server.ts` is a 143-line placeholder stub (global session middleware blocks auth routes; missing DB imports, real auth/ownership guards, most routes). Root `/src/server.ts` (846 lines) and `/src/db.ts` (654 lines) also exist - inspect before restoring.

## Completed

- [x] SETUP-001..008: autonomous environment, agents, config, memory, persistence/recovery/model policy, token-efficient routing.
- [x] Recovery protocol executed (2026-11-22): loaded state/log/memory, validated repo, identified discrepancies, updated state.

- [x] **M8-WAVE1 (P1)**: Onboarding/first experience. Migration 012 `user_onboarding`, GET/PATCH `/api/me/onboarding`, welcome overlay (skip/resume), case-list guidance, interactive checklist, progressive tips, replay guide. Verified: typecheck PASS, frontend build PASS, db:schema:verify PASS (45/45,546), test:http PASS (124/124), Playwright 375/1440 PASS. Human playtest still recommended.
- [x] **M8-WAVE2 (P1)**: Unified investigation UX + specialist immersion. InvestigationHQ (know/changed/attention/next actions), specialist voice/limits/bias/continuity cues, grounded disagreement framing. Verified: typecheck PASS, frontend build PASS, test:http 124/124 PASS, knowledge:validate PASS, Playwright PASS. Caveat: deeper relationship simulation/tab consolidation deferred.
- [x] **M8-WAVE3 (P1)**: Case quality audit + systemic fix. `case:quality` framework, M8-CASE-QUALITY-AUDIT.md/json, 25-case audit (avg 24.4/42), 6 refinement candidates selected, culprit-name spoiler leak fixed in 24/25 player-facing objectives (canonical truth checksum unchanged). Verified: typecheck PASS, case:validate PASS, case:quality PASS, test:http 124/124 PASS, npm test PASS. Caveat: deeper narrative refinement for candidates deferred.
- [x] **M8-WAVE4 (P1)**: AI quality/cost optimization. Shared LLM guardrails/bounds, optional one-shot failover, structured metrics logging, prompt-cap hygiene, `M8-AI-COST-NOTES.md`, `test-llm-controls`. Deterministic fallback/USE_LLM=false preserved. Verified: typecheck PASS, test:http 124/124 PASS, test:discovery PASS, test:llm-controls PASS, npm test EXIT=0.
- [x] **M8-WAVE5 (P1)**: Long-term engagement. `/api/me/progress` + `/progress` page aggregating history/knowledge/memory/milestones/7-day return summary/deterministic suggestions; no XP/streak gimmicks. Verified: typecheck PASS, frontend build PASS, test:http 127/127 PASS, npm test PASS, Playwright PASS.
- [x] **M8-WAVE6 (P1, GATE)**: Security/reliability/performance audit. Security PASS WITH CONDITIONS + reliability regression PASS. Hardening: 1mb JSON body limit, explicit Helmet CSP, lightweight Origin/Referer CSRF guard, startup env warnings, env/docs updates, npm audit documented. Verified: typecheck PASS, smoke-db PASS, test:http 127/127 PASS, npm test EXIT 0. Report: `M8-W6-GATE-REPORT.md`.

## Pending

- [x] **PROD-BLOCKER-001 (P0)**: Restored `project-investigation/src/server.ts` (551L). Verified: typecheck PASS, smoke-db PASS, smoke-http 9/9 PASS, scrutinizer approved. (2026-11-22)
- [x] **PROD-BLOCKER-002 (P0)**: Recreated/seeded `investigation` PostgreSQL DB; smoke-db PASS. (2026-11-22)
- [x] **PROD-001**: Auth/session middleware and ownership guards - done with evidence.
- [x] **PROD-002**: Canonical truth wired to deterministic verdict evaluation - done; BUG-005 seed gap fixed; `correct` verdict verified.
- [x] **PROD-003**: HTTP integration smoke tests - done (9/9 PASS).
- [x] **PROD-005-SLICE-1 (P1)**: Frontend scaffold (Vite+React+TS), case library/investigation room UI, API client, AI chat endpoint, progression basics. typecheck PASS, smoke-db PASS, smoke-http 9/9 PASS, frontend build PASS. (2026-11-22)
- [x] **PROD-005-FIX-1 (P1)**: Wired InvestigationRoom investigation create/load/reuse, conversation load, chat send via `/api/investigations/:id/chat`, auth login/register/logout flow, Vite `/api` proxy. Verified: typecheck PASS, smoke-db PASS, frontend build PASS, smoke-http 9/9 PASS. (2026-11-22)
- [x] **PROD-005-SLICE-2 (P1)**: Accusation/Verdict/Archive UI, case-switch UX, evidence discovery, journal/timeline, archive/GET-investigation endpoints, chat smoke coverage. Verified: typecheck PASS, smoke-db PASS, frontend build PASS, smoke-http 11/11 PASS; scrutinizer APPROVED. (2026-11-22)
- [x] **PROD-GAP-AUDIT**: PRD MVP gap audit complete (~35-40% MVP readiness; critical GAP-04/05, P0 GAP-01/02/03). (2026-11-22)
- [x] **PROD-006 (P1)**: Fixed GAP-04/GAP-05 - hidden evidence discover blocked, PATCH state-machine hardened, achievements server-side, retry preserved. Verified: typecheck PASS, smoke-db PASS, frontend build PASS, smoke-http 17/17 PASS. Scrutinizer APPROVED. (2026-11-22)
- [x] **PROD-007 (P0)**: Case content upgraded - 6 chars (5 suspects+witness) with full knowledge/beliefs/secrets/motive, 10 evidence with conditions/timeline, canonical truth enriched (solution explanation, red herrings, alternative theories, clue resolutions, actual timeline). Verified: typecheck PASS, smoke-db PASS, frontend build PASS, smoke-http 19/19 PASS. (2026-11-22)
- [x] **PROD-009 (P0)**: Solution reveal endpoint + Verdict/Archive resolution UI. Gated owner+completed; safe DTO excludes hidden_events. Verified: typecheck PASS, smoke-db PASS, frontend build PASS, smoke-http 22/22 PASS. Scrutinizer APPROVED. (2026-11-22)
- [x] **PROD-008 (P0)**: Progression engine wired - deduction checkpoints, deduction/time-triggered release, in-process scheduler + offline catch-up, developments UI. Verified: typecheck PASS, smoke-db PASS, frontend build PASS, smoke-http 27/27 PASS. Scrutinizer APPROVED. (2026-11-22)
- [x] **PROD-011 (P1)**: Fixed GAP-07/BUG-008 completed-case evidence visibility. Verified: typecheck PASS, smoke-db PASS, frontend build PASS, smoke-http 29/29 PASS. Scrutinizer APPROVED. (2026-11-22)
- [x] **QA-001 (P1)**: Security + regression harness hardening - rate limits, input validation, message role restriction, test:http, CI workflow. Verified: typecheck PASS, smoke-db PASS, frontend build PASS, test:http 34/34 PASS. Scrutinizer APPROVED. (2026-11-22)
- [x] **PROD-010 (P1)**: Verdict integrity v2 - readiness gating, motive/method/evidence scoring, attempt counter + escalating cooldown, no name-only completion. Verified: typecheck PASS, smoke-db PASS, frontend build PASS, test:http 37/37 PASS. Scrutinizer APPROVED. (2026-11-22)
- [x] **PROD-012 (P1)**: Abandon/reset investigation flow - confirm:true, ownership, completed guarded, lock released, frontend dialog. Verified: typecheck PASS, smoke-db PASS, frontend build PASS, test:http 42/42 PASS. Scrutinizer APPROVED. (2026-11-22)
- [x] **PROD-013 (P1)**: Suspect board depth - safe DTO/UI with public motive, relationships, linked discovered evidence, suspicion, unanswered questions. Verified: typecheck PASS, smoke-db PASS, frontend build PASS, test:http 45/45 PASS. Scrutinizer APPROVED. (2026-11-22)
- [x] **PROD-014 (P1)**: AI grounding/context discipline - role-aware chat, safe addressed-suspect projection, rolling summary, bounded retrieval, deterministic fallback preserved. Verified: typecheck PASS, smoke-db PASS, frontend build PASS, test:http 49/49 PASS. Scrutinizer APPROVED. (2026-11-22)
- [x] **PROD-004 (P2)**: Schema aligned - raw SQL migrations canonical, 000_baseline.sql, Drizzle deprecated, db:schema:verify (17/17 tables, 162/162 cols) wired into npm test. Verified: typecheck PASS, db:schema:verify PASS, smoke-db PASS, frontend build PASS, test:http 49/49 PASS. BUG-003 verified. (2026-11-22)

- [x] **P2-VALIDATION (GAP-15)**: Read-only case validation script (`case:validate`) wired into CI/docs. (2026-11-22)
- [x] **P2-ACHIEVEMENTS-UI (GAP-13)**: Read-only achievements panel/tab/resolution display; smoke coverage added. (2026-11-22)
- [x] **P2-PROGRESS (GAP-12)**: Centralized `computeEvidenceProgress` using actual case evidence count. (2026-11-23)
- [x] **P2-CLEANUP (GAP-18)**: Stale compiled artifacts/legacy root `/src` duplicates moved to `/tmp/opencode/legacy-src-backup`; docs refreshed. (2026-11-23)
- [x] **P2-SESSIONS**: DB-backed session persistence (hashed tokens, sweeper, migration 004). (2026-11-23)
- [x] **P2-NOTIFICATIONS (GAP-14)**: In-app developments unread badge/mark-seen + notification settings endpoint/UI; 56/56 PASS at completion. (2026-11-23)
- [x] **DB-CLEANUP**: Smoke/test DB rows removed with explicit user approval; case seed preserved. (2026-11-23)
- [x] **P2-RATE-LIMITS**: DB-backed rate limits (migration 005, atomic hashed counters, sweeper, schema/docs/CI). (2026-11-23)
- [x] **P2-POLISH**: Investigation stats endpoint/UI, smoke coverage, final QA. (2026-11-23)
- [x] **PROD-CONTENT-25**: Seeded 24 additional playable cases (total **25 published cases**). Added `scripts/seed-extra-cases.ts` + `npm run db:seed:cases`; CI bootstrap seeds them; validator/engine checkpoint fallback made case-generic; smoke-http fixture made case-robust. Verified: `case:validate` PASS (25 cases, 202 evidence, 25 canonical truth rows), `test:http` 57/57 PASS. (2026-11-23)
- [x] **PROD-AI-INFRA**: Pluggable AI provider infra. Supports `USE_LLM`, `LLM_PROVIDER=auto|local|openai|gemini`, `LLM_URL`, `LLM_MODEL`, `LLM_API_KEY`/`GEMINI_API_KEY`/`GOOGLE_API_KEY`; Gemini defaults to OpenAI-compatible endpoint; deterministic fallback preserved. `.env.example` documented. (2026-11-23)


- [x] **M3-KNOWLEDGE (M3)**: Knowledge quality/provenance/case expansion. Migration 007 (provenance fields, case_knowledge_packs). Pack authoring framework (`src/knowledge-packs/`). Midnight Heist upgraded; Code Blue at the Clinic and Blaze at Dawn Bakery packs authored (3 specialists, 5 artifacts, 1 disagreement, learning objectives, evidence refs, suggested conversations, depth content each). Research-verified citations used; no fabricated URLs; verification statuses explicit. Case-aware knowledge:validate, notebook export JSON/Markdown, frontend provenance UI. Verified: typecheck PASS, db:schema:verify PASS (25/25 tables, 258 cols), smoke-db PASS, knowledge:validate PASS, case:validate PASS, frontend build PASS, test:http 73/73 PASS. (2026-11-23)


- [x] **M4-REALITY-MAP (M4)**: Reality Map & Investigative Reasoning Engine. Additive migration 008 (`investigation_claims`, `investigation_hypotheses`, `reality_map_links`). Pure `src/reality-map.ts` + `reality-map-prompts.ts`. Investigation-scoped routes for snapshot/CRUD/compare/reasoning-review/specialist-review/tutorial; hidden-evidence and ownership enforced; no canonical truth reads; no verdict/progression/evidence-release coupling. Frontend Reality Map tab with hypotheses/claims/links/tensions/assumptions/open questions/reasoning assistant/specialist review/tutorial; journal/notebook turn-into-claim. Verified: typecheck PASS, db:schema:verify PASS (28/28 tables,296 cols), smoke-db PASS, reality-map:validate PASS, knowledge:validate PASS, case:validate PASS, frontend build PASS, test:http 88/88 PASS. (2026-11-23)

- [x] **M5-FOUNDATION (M5)**: Migration 009, 7 framework scaffolds, pure perspective modules, DB helpers, seed/validate/CI/schema wiring. (2026-11-23)
- [x] **M5-CONTENT (M5)**: 7 spec frameworks aligned; 12 substantive experiences authored (Plato cave, Ship of Theseus, induction, confirmation bias, trolley, blind men/elephant, Stoic dichotomy of control, dependent origination, falsifiability, historical source reliability, moral responsibility, collective memory). Conservative pending_review provenance, no fabricated URLs/quotes. (2026-11-23)
- [x] **M5-API (M5)**: Global/investigation perspective routes, reflections CRUD, advisory suggestions (max 2, read-only), chat perspectiveKey epistemic context, notebook/claim bridges, smoke tests +14 (102/102). (2026-11-23)
- [x] **M5-UI (M5)**: Independent exploration + investigation integration frontend. `/perspectives` library/detail, nav, investigation Perspectives tab, suggestions/reflections, RM/notebook/specialist bridges, a11y/responsive. (2026-11-23)
- [x] **M5-VERIFY (M5)**: Full verification PASS. (2026-11-23)

## Blockers / risks

- **No critical blockers open.** Audited P0/P1 gaps, feasible P2 items, 25-case seed, and pluggable AI infra completed with verification.
- **Remaining external/infra gaps:**
  - **AI quality:** infra is pluggable and works with fallback; set `GEMINI_API_KEY` (or other provider key/model) to improve generation quality. No keys hardcoded.
  - **Production hardening/deploy:** no production deployment/push notification infrastructure; rate limits DB-backed but simple/single-DB.
  - **Case polish:** 24 generated cases are structurally valid/playable and pass validation, but can be further hand-authored for richer narrative depth.

## Next action

M8 complete. All waves delivered. Beta readiness artifacts operational for operator sign-off. No public deployment until operator signs off on W6 conditions and W7 beta review.
