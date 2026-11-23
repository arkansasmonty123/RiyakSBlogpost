# Tasks

> **Ownership**: Orchestrator creates/prioritizes tasks. Assigned agent updates status/evidence via Orchestrator.  
> **Update rules**: Keep tasks small and testable. Status values: `pending`, `in_progress`, `blocked`, `done`. Always include acceptance criteria and evidence when done. Do not delete completed tasks; mark done.

## Active setup tasks

| ID | Task | Owner | Status | Acceptance criteria | Evidence / Notes |
|---|---|---|---|---|---|
| SETUP-001 | Inspect repo and existing OpenCode/project state | orchestrator | done | Existing config, agents, AGENTS.md, PRD, project status inspected; no destructive overwrite | Inspected root, `.opencode/`, `project-investigation/` docs, PRD, src, package.json |
| SETUP-002 | Create specialized OpenCode agents | orchestrator | done | `.opencode/agents/` contains orchestrator, builder, scrutinizer, bug-fixer, architect, qa-engineer, security-auditor with clear responsibilities | Files created under `.opencode/agents/` |
| SETUP-003 | Configure OpenCode for autonomous orchestration | orchestrator | done | `opencode.jsonc` valid, `default_agent=orchestrator`, delegation permissions explicit, destructive ops guarded | `opencode.jsonc` created at root |
| SETUP-004 | Create project memory files | orchestrator | done | `project-management/` contains DEV-STATUS.md, TASKS.md, BUGS.md, TEST-REPORT.md, DECISIONS.md with ownership/update rules | Files created |
| SETUP-005 | Validate configuration and document setup | orchestrator | done | Config/agents discoverable, checks run/recorded, SETUP-GUIDE.md created, limitations documented | `opencode debug config/agents` PASS; delegation smoke test PASS; `npm run test:smoke` PASS; `npm run typecheck` FAIL (pre-existing server.ts TS1005 errors, recorded) |
| SETUP-006 | Add Model Manager policy, persistent orchestration, recovery controller | orchestrator | done | Policy/state/log/recovery files exist; orchestrator/config/docs updated; limitations documented; validation recorded | Added `MODEL-POLICY.md`, `ORCHESTRATION-STATE.json`, `ORCHESTRATION-LOG.md`, `RECOVERY.md`; updated `opencode.jsonc`, `orchestrator.md`, `AGENTS.md`, `SETUP-GUIDE.md`; `opencode debug config/agents` revalidated |
| SETUP-007 | Token-efficient per-agent model routing | orchestrator | done | Agents have role-based model assignments; smaller models for scrutiny/testing; config validated; docs updated | Assigned models via agent frontmatter + `opencode.jsonc` hidden agents; validated with `opencode debug agents`; documented in MODEL-POLICY/SETUP-GUIDE |
| SETUP-008 | Adjust builder/bug-fixer model defaults | orchestrator | done | Builder defaults to hy4 flash with iceman fallback; bug-fixer defaults to hy4 flash; docs/state updated; validated | builder=`hy4-flash-free#high` (fallback iceman), bug-fixer=`hy4-flash-free#high`; `opencode debug agents` PASS |
| SETUP-009 | Set all agent models to default variants | orchestrator | done | No `#high`/variant suffixes in agent model routing; validated; docs updated | Removed `#high` from builder/bug-fixer/architect; `opencode debug agents` PASS |
| SETUP-010 | Add ui-ux-frontend, devops-engineer, researcher agents | orchestrator | done | 3 new agents created, discoverable, routed, documented, orchestrator delegation updated | Created `.opencode/agents/ui-ux-frontend.md`, `devops-engineer.md`, `researcher.md`; updated orchestrator/MODEL-POLICY/SETUP-GUIDE; `opencode debug agents` PASS (10 custom agents) |
| SETUP-011 | Enable parallel subagent delegation for builder/ui-ux/bug-fixer | orchestrator | done | Agents instructed and permitted to delegate independent non-overlapping subtasks via `subagent` | Updated `builder.md`, `ui-ux-frontend.md`, `bug-fixer.md`; `opencode debug agents` PASS |
| SETUP-012 | Add human-like user-tester agent | orchestrator | done | Read-only user-tester agent created, discoverable, routed, documented, orchestrator delegation updated | Created `.opencode/agents/user-tester.md`; updated orchestrator/MODEL-POLICY/SETUP-GUIDE; `opencode debug agents` PASS (11 custom agents) |

## Blockers / recovery tasks (2026-11-22)

| ID | Task | Owner | Status | Acceptance criteria | Evidence / Notes |
|---|---|---|---|---|---|
| PROD-BLOCKER-001 | Restore regressed `project-investigation/src/server.ts` with real DB-backed auth/session, ownership guards, and full API routes | builder | done | server.ts implements real register/login/logout/me, session cookie auth, ownership checks on all investigation-scoped routes, DB-backed handlers; `npm run typecheck` PASS; routes match PRD/API expectations | 2026-11-22: server.ts restored (551L). db.ts minimal fix (3 snake_case columns). smoke-http harness fixed. Verified: typecheck PASS, test:smoke PASS, smoke-http 9/9 PASS, builder 27-check PASS. Scrutiny recommended. |
| PROD-BLOCKER-002 | Recreate/seed `investigation` PostgreSQL DB for local smoke verification | orchestrator | done | `investigation` DB exists with required tables/seed; `npm run test:smoke` PASS; smoke-http runnable against server | 2026-11-22 recovery: created DB role, created `investigation` DB, applied schema, seeded case/characters/evidence/canonical_truth. `npm run test:smoke` PASS. |

## Product backlog (seeded from prior project audits - re-scope after blockers)

| ID | Task | Owner | Status | Acceptance criteria | Evidence / Notes |
|---|---|---|---|---|---|
| PROD-001 | Add auth/session middleware and ownership guards on investigation-scoped routes | builder | done | Endpoints require authenticated/authorized user context; IDOR checks covered by tests | 2026-11-22: Implemented in restored server.ts (551L). Scrutinizer verified: auth derived server-side, ownership guards on investigation-scoped routes, smoke-http 9/9 PASS, 27-check PASS. |
| PROD-002 | Wire canonical truth to real case IDs and deterministic verdict evaluation | builder | done | Correct verdict only when canonical truth matches; no solution leakage | 2026-11-22: db.ts canonical_truth wiring verified. BUG-005 fixed seed alignment. evaluateAccusation returns `correct` only on canonical match; `canonicalTruthConfigured=true`. No leakage in APIs (scrutinizer verified). |
| PROD-003 | Add HTTP integration tests for authz, evidence leakage, accusation behavior | qa-engineer | done | Automated tests cover key security/logic paths; CI-runnable command documented | 2026-11-22: `scripts/smoke-http.ts` (9 tests) passes. Covers register/login, auth guard, evidence hidden-field leakage, case evidence filtering, accusation evaluation flow. Command: `npx tsx scripts/smoke-http.ts` (server must be running). |
| PROD-004 | Align schema/migrations/source of truth (Drizzle/raw SQL/live DB) | builder | done | Single clear schema path; migration strategy documented and validated | 2026-11-22: raw SQL migrations canonical, 000_baseline.sql added, Drizzle artifacts deprecated, db:schema:verify added/wired into npm test, docs updated. Verified: typecheck PASS, db:schema:verify PASS, smoke-db PASS, frontend build PASS, test:http 49/49 PASS. BUG-003 verified. |
| PROD-005 | Build PRD MVP features (UI, AI chat with boundaries, progression engine) | builder/ui-ux-frontend | in_progress | MVP playable: case list, investigation room, chat, evidence/suspects, accusation/verdict/archive, progression; smoke/typecheck/build pass | Slice 1, FIX-1, SLICE-2 done (2026-11-22). Verified: typecheck PASS, smoke-db PASS, frontend build PASS, smoke-http 11/11 PASS. Scrutinizer: SLICE-2 APPROVED. Remaining: P2 naming clarity, PRD gap audit, QA/security hardening, PROD-004 schema alignment. |
| PROD-005-FIX-1 | Fix frontend investigation creation + chat wiring (scrutinizer P1) | builder | done | Investigation room creates/loads investigation, loads conversation, sends chat, renders AI response; auth flow functional | 2026-11-22: Verified by orchestrator - typecheck PASS, smoke-db PASS, frontend build PASS, smoke-http 9/9 PASS. |
| PROD-005-SLICE-2 | Accusation/Verdict/Archive UI, case-switch, discovery, journal/timeline, chat smoke | builder | done | Core MVP gameplay flows functional; smoke/typecheck/build pass; no canonical leakage | 2026-11-22: Verified by orchestrator - typecheck PASS, smoke-db PASS, frontend build PASS, smoke-http 11/11 PASS. Scrutinizer APPROVED. |
| PROD-GAP-AUDIT | PRD MVP gap audit | architect | done | Prioritized gap report with evidence and next tasks | 2026-11-22: ~35-40% MVP readiness. Critical: GAP-04 hidden evidence client-revealable (P1), GAP-05 client can self-complete/spoof state (P1), GAP-01 progression engine unwired (P0), GAP-02 case content thin (P0), GAP-03 no solution explanation (P0). |
| PROD-006 | Fix GAP-04/GAP-05 discovery authz and state/PATCH hardening | builder | done | Hidden evidence cannot be discovered by client; client cannot self-complete/spoof status/progress/achievements; retry flow preserved; smoke tests added | 2026-11-22: discover-evidence rejects hidden; PATCH limited to currentTheory/suspicionLevel; achievements 403 client-unlock; non-correct verdict stays active; completed locked. Verified: typecheck PASS, smoke-db PASS, frontend build PASS, smoke-http 17/17 PASS. Scrutinizer APPROVED. |
| PROD-007 | Upgrade case content to MVP bar (GAP-02/03 data) | builder | done | 5+ suspects with knowledge/beliefs/secrets; 8-10 evidence with conditions/timeline; canonical truth enriched with solution explanation/red herrings/alternative theories | 2026-11-22: 6 chars, 10 evidence, enriched canonical_truth. Verified: typecheck PASS, smoke-db PASS, frontend build PASS, smoke-http 19/19 PASS. |
| PROD-009 | Verdict + complete solution explanation (GAP-03, MVP 16) | builder | done | Completed cases expose solution explanation/red herrings/clue resolution/timeline safely; UI shows verdict+resolution; no pre-completion leakage | 2026-11-22: GET /api/investigations/:id/solution gated by owner+completed, safe DTO excludes hidden_events. SolutionPanel in verdict/archive. Verified: typecheck PASS, smoke-db PASS, frontend build PASS, smoke-http 22/22 PASS. Scrutinizer APPROVED. |
| PROD-008 | Async progression engine wiring (GAP-01, MVP 11-13) | builder | done | Deduction checkpoints, deduction/time-triggered release, offline catch-up; mystery-engine wired; smoke tests | 2026-11-22: mystery-engine wired, checkpoints/theory/action endpoints, scheduler+catch-up, developments UI, 5 new smoke tests. Verified: typecheck PASS, smoke-db PASS, frontend build PASS, smoke-http 27/27 PASS. Scrutinizer APPROVED. |
| PROD-FINAL-AUDIT | Final PRD MVP gap reassessment | architect | done | Updated gap map and prioritized next tasks | 2026-11-22: ~85% functional, ~78% quality bar. Key remaining: GAP-06 verdict integrity (P1), GAP-07 completed-case evidence disappears (P1), GAP-10 abandon (P1), GAP-11 security/CI hardening (P1), GAP-08 suspect depth (P1), GAP-09 AI grounding (P1). |
| PROD-011 | Fix completed/archive evidence visibility (GAP-07/BUG-008) | bug-fixer | done | Released evidence remains visible for completed owned investigations; regression smoke test added; no hidden leakage | 2026-11-22: db.ts unions discovered ids across owned investigations for user+case (any status). smoke-http 29/29 PASS. Scrutinizer APPROVED. |
| QA-001 | Security + regression harness hardening (GAP-11/17) | builder | done | Rate limits, input validation, message role restriction, test:http/CI workflow, smoke baseline locked | 2026-11-22: env-configurable in-memory rate limits, email/password/length validation, messages restricted to player, test:http + CI workflow added. Verified: typecheck PASS, smoke-db PASS, frontend build PASS, test:http 34/34 PASS. Scrutinizer APPROVED. |
| PROD-010 | Verdict integrity v2 (GAP-06) | builder | done | Final-stage gating, motive/method/evidence scoring, server-side cooldown/attempts, no name-only brute force | 2026-11-22: readiness gate, canonical motive/method scoring, supporting evidence requirement, attempt counter + escalating cooldown, 429/Retry-After, frontend feedback, migration 003. Verified: typecheck PASS, smoke-db PASS, frontend build PASS, test:http 37/37 PASS. Scrutinizer APPROVED. |
| PROD-012 | Abandon/reset investigation flow (GAP-10) | builder | done | Owned user can abandon active investigation with confirmation; lock released safely; smoke tests | 2026-11-22: POST /abandon confirm:true, owner-only, completed/abandoned guarded, lock released, frontend dialog, archive visible. Verified: typecheck PASS, smoke-db PASS, frontend build PASS, test:http 42/42 PASS. Scrutinizer APPROVED. |
| PROD-013 | Suspect board depth (GAP-08) | builder | done | Safe suspect DTO adds public motive/relationships/linked evidence/suspicion/unanswered questions; no secret leakage | 2026-11-22: GET /api/investigations/:id/suspects, sanitized public motive/relationships, linked discovered evidence, suspicion, unanswered questions. Verified: typecheck PASS, smoke-db PASS, frontend build PASS, test:http 45/45 PASS. Scrutinizer APPROVED. |
| PROD-014 | AI grounding & context discipline (GAP-09) | builder | done | Role-aware context, suspect knowledge projection, rolling summary/retrieval, token/length controls, leakage tests | 2026-11-22: role-aware grounding, safe suspect projection, rolling summary, bounded retrieval, deterministic fallback. Verified: typecheck PASS, smoke-db PASS, frontend build PASS, test:http 49/49 PASS. Scrutinizer APPROVED. |

## M3 - Knowledge Quality & Case Expansion (active)

- [x] **M3-AUDIT**: Audit complete; gaps identified; cases selected.
- [x] **M3-RESEARCH**: 8 real-source candidates verified (4 Code Blue, 4 Blaze); conservative citations/URLs/notes.
- [x] **M3-FOUNDATION**: Migration 007, pack framework, provenance DTO/DB/server/validator/UI/export, Midnight Heist upgraded.
- [x] **M3-CONTENT**: Code Blue at the Clinic and Blaze at Dawn Bakery packs authored and seeded.
- [x] **M3-VERIFY**: typecheck PASS, db:schema:verify PASS (25/25,258), smoke-db PASS, knowledge:validate PASS, case:validate PASS, frontend build PASS, test:http 73/73 PASS.

## M4 - Reality Map & Investigative Reasoning Engine (complete)

- [x] **M4-AUDIT**: Inspected schema/routes/UI/tests; M4 scope additive.
- [x] **M4-PLAN**: Architect contract frozen (migration 008, pure module, routes, prompts/tutorial, tests, UI).
- [x] **M4-BACKEND**: Migration 008, db/server/reality-map modules, validator, smoke+CI updates. 88/88.
- [x] **M4-UI**: Reality Map tab/components, API wiring, journal/notebook claim affordances.
- [x] **M4-VERIFY**: Full verification PASS (88/88).

## M5 - Perspective Engine (complete)

- [x] **M5-AUDIT**: PRD/repo/knowledge/Reality Map/specialists inspected; M5 additive scope confirmed.
- [x] **M5-PLAN**: Architect plan produced (migration 009, frameworks/experiences, advisory suggestions, RM/notebook/specialist integration, tests).
- [x] **M5-FOUNDATION**: Migration 009, pure modules, DB/seed/validate/CI wiring. Baseline green.
- [x] **M5-CONTENT**: 7 spec frameworks + 12 substantive experiences authored with conservative provenance.
- [x] **M5-API**: Routes/reflections/suggestions/chat/notebook/claim bridges; smoke +14 (102/102).
- [x] **M5-UI**: `/perspectives` library/detail, nav entry, investigation Perspectives tab, reflection/RM/notebook/specialist bridges.
- [x] **M5-VERIFY**: Full verification PASS (102/102 test:http) and M5 report delivered.


## M6 - Living Investigations Engine (complete)

- [x] **M6-AUDIT**: Inspected progression/events/notifications; architect plan delivered.
- [x] **M6-BUILD-CORE**: Living-world engine, case-event framework, 3 showcase packages, seed/validate/test scripts.
- [x] **M6-INTEGRATE**: Server routes, catch-up wiring, notifications inbox, scheduler integration.
- [x] **M6-UI**: Activity tab/panel, catch-up summary, disagreements/upcoming, notification bell/inbox.
- [x] **M6-TEST**: smoke-http M6 block (+8), stale M5 reflection test contract fixed, full verification green (110/110).
- [x] **M6-DOCS**: M6 notes/report, state/log/dev-status/tasks updated; M7 not started.


## M7 - Real-World Discovery & Knowledge Retention Engine (complete)

- [x] **M7-AUDIT**: Architecture plan delivered (additive, reuse existing systems).
- [x] **M7-1-FOUNDATION**: Migration 011, schema verify 44/44 537 cols, discovery-clues pure modules, scripts, CI wiring.
- [x] **M7-2-CONTENT**: 3 showcase packages / 6 clues (Midnight Heist, Code Blue, Blaze), citations pending_review, no fabricated URLs.
- [x] **M7-3-BACKEND**: Discovery service, DB helpers, 8 routes, llm-provider extraction, notebook provenance, action unlock apply, M7 smoke tests.
- [x] **M7-4-FRONTEND**: Field Research tab, submission/evaluation/recall UI, /knowledge journal, notebook provenance, a11y/responsive.
- [x] **M7-5-VERIFY**: Full npm test PASS (119/119 test:http), frontend build PASS, all validators PASS. M8 not started.

## M8 - Product Completion, Immersion & Release Readiness (in progress)

- [x] **M8-AUDIT**: Repo-grounded 7-wave plan produced. No deploy before W6 security/reliability gates pass.
- [x] **M8-WAVE1**: Onboarding/first experience complete (human-playtest caveat). S1 foundation + S2 interactive checklist/replay/progressive tips. 124/124 test:http.
- [ ] **M8-WAVE2**: Unified investigation UX + character immersion (M8-2/M8-3). Audit in progress.
- [x] **M8-WAVE3**: Case quality audit + scoring framework; 25-case audit; systemic spoiler leak fixed (0/25). 6 candidates identified for deeper refinement. 124/124 test:http.
- [x] **M8-WAVE4**: AI quality/cost optimization. Guardrails/bounds/failover/metrics/cost notes; deterministic fallback preserved. 124/124.
- [x] **M8-WAVE5**: Long-term engagement/personal progression. /api/me/progress + /progress page; no XP/streak gimmicks. 127/127.
- [x] **M8-WAVE6**: Production hardening/security/reliability/perf gate. PASS WITH CONDITIONS. 127/127, npm test PASS. Reports: M8-W6-*-AUDIT/GATE.
- [ ] **M8-WAVE7**: Deployment/beta readiness (M8-8). In progress (post-W6). No public deploy.

