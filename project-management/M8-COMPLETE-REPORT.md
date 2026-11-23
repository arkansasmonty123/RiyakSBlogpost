# M8 Complete Report — THE INVESTIGATION

**Date**: 2026-11-24  
**Milestone**: M8 — Product Completion, Immersion & Release Readiness  
**Status**: **COMPLETE** — all 7 waves delivered, audit/gate reports produced, beta-readiness artifacts operational.

## Waves overview

| Wave | Focus | Gate result |
|---|---|---|
| **W1 — Onboarding / First Experience** | Welcome overlay, skip/resume persistent progress, case-list guidance, interactive 6-step checklist with realistic examples, progressive contextual tips (evidence/suspects/chat/RM/Perspectives/Field Research), replay guide, research/memory clarity | **Pass** — 124/124 test:http after S1; 127/127 after W3 | 
| **W2 — Unified Investigation UX + Character Immersion** | InvestigationHQ status/attention/next-actions panel above tabs; specialist stronger persona/voice/limits/bias/continuity cues; grounded disagreement framing | **Pass** — 124/124 test:http | 
| **W3 — Case Quality Audit / Systemic Fix** | 25-case read-only audit framework (25 dimensions); avg 24.4/42; culprit-name leakage fixed in 24/25 player-facing objectives; 6 refinement candidates selected; Midnight Heist benchmark 41/42 | **Pass with conditions** — avg 24.4/42, 0/25 leaks, typecheck/case:validate/case:quality PASS | 
| **W4 — AI Quality & Cost Optimization** | Shared LLM guardrails/bounds/failover/validation/metrics logging, prompt-cap hygiene, cost notes; deterministic fallback/`USE_LLM=false` preserved | **Pass** — 124/124 test:http, test:llm-controls PASS | 
| **W5 — Long-Term Engagement / Personal Progression** | `/api/me/progress` + `/progress` page; investigation history, knowledge/memory/recall/cross-case milestones/7-day return summary/deterministic suggestions; no XP/streak/gimmicks | **Pass** — 127/127 test:http | 
| **W6 — Security / Reliability / Performance Gate** | Security audit PASS WITH CONDITIONS: no critical/high. Medium conditions documented: TLS/production env, tight rate limits, correct origins/CSRF, JSON body limit, CSP, dependency audit. Reliability/regression audit PASS: 127/127, npm test, schema verify. Gate: **PASS WITH CONDITIONS** — operator config required before any beta/public deploy. Reports: M8-W6-SECURITY-AUDIT.md, M8-W6-RELIABILITY-AUDIT.md, M8-W6-GATE-REPORT.md | **Pass with conditions** — operator config required |
| **W7 — Deployment / Beta Readiness** | Deployment/runbook docs, health/readiness endpoint `/api/health`, privacy/terms/feedback pages (`/privacy`, `/terms`), auth-scoped user data export/delete (two-step confirm), optional beta-access-code gate default-off, smoke tests (133 total) | **Operational** — artifacts live, no public deploy authorized; beta readiness for operator sign-off | |

## Summary of all M8 deliverables

### Onboarding & Immersion
- **M8-W1**: Welcome/onboarding overlay with skip/resume, case-library "How to begin", interactive 6-step first-investigation checklist with realistic examples, progressive contextual tab tips (reality/map/perspectives/field research), research/memory clarification. Additive migration 012, GET/PATCH `/api/me/onboarding`, `user_onboarding` table. (124/124 test:http at S1; 127/127 after W5)
- **M8-W2**: InvestigationHQ panel above tabs (progress counts, changed/needs-attention cues, deterministic next actions with tab-jump links). Old StatsPanel replaced. Specialist identity cues strengthened in prompts and UI (persona/voice/limits/bias/continuity). (124/124 test:http)
- **M8-W3**: 25-case read-only quality audit framework; per-case 14-dimension scoring 0-3; avg 24.4/42 after culprit-name leak fix. 6 publication-quality refinement candidates selected. Systemic fairness defect (24/25 leaked culprit names in player-facing objectives/briefing) fully fixed via seed source update. Midnight Heist benchmark 41/42. (typecheck/case:validate/case:quality PASS)

### AI Quality
- **M8-W4**: Shared LLM guardrails (`llm-guardrails.ts`), configurable bounds (`LLM_TIMEOUT_MS`, `LLM_MAX_TOKENS`, `LLM_TEMPERATURE`), response validation with deterministic fallback, optional one-shot provider failover, structured `[LLM-METRICS]` logging (no secrets/prompt bodies), prompt-cap hygiene, `.env.example`/`M8-AI-COST-NOTES.md`, `test-llm-controls` (6 scenarios). (124/124 test:http, test:llm-controls PASS)

### Personal Progression
- **M8-W5**: `/api/me/progress` aggregating investigation status counts, knowledge/memory stats (discoveries, mastery distribution, due recalls, cross-case applications, 7 derived milestones, honest 7-day activity window), deterministic unplayed-case suggestions; `/progress` page reusing existing systems. No XP/streaks/gimmicks. (127/127 test:http)

### Security & Gate
- **M8-W6**: Security audit PASS WITH CONDITIONS — no critical/high. Conditions before beta/public deploy: `NODE_ENV=production`+TLS, tight `RATE_LIMIT_*`, correct `FRONTEND_URL/ALLOWED_ORIGINS` with `CSRF_ORIGIN_CHECK=true`, `JSON_BODY_LIMIT` (default 1mb), explicit Helmet API CSP, dependency audit review, W7 readiness. Reliability/regression audit PASS (127/127, npm test, typecheck, schema verify). Reports: M8-W6-SECURITY-AUDIT.md, M8-W6-RELIABILITY-AUDIT.md, M8-W6-GATE-REPORT.md.

### Beta Readiness
- **M8-W7**: Deployment/runbook docs (`project-management/M8-DEPLOYMENT-RUNBOOK.md`); health endpoint (`GET /api/health`); privacy/terms/feedback (`/privacy`, `/terms`, feedback URL config); auth-scoped user data export (`GET /api/me/export`, two-step typed confirm) and account deletion (`POST /api/me/delete`/`DELETE /api/me` with `{confirm:"DELETE"}`); optional beta-access-code gate on register (default off); smoke coverage updated to 133 tests. (.env.example/`README.md` documented; 133/133 test:http PASS).

## All automated test suites passing

- `npm run typecheck` PASS
- `npm run test:smoke` PASS
- `npm run test:http` PASS (**133/133**, from 119 baseline + M7 M8 additions)
- `npm run db:schema:verify` PASS (45/45 tables, 546/546 cols)
- `npm test` EXIT 0 (full cross-milestone chain)
- `npm run case:validate` PASS (25 cases, 202 evidence)
- `npm run case:quality` PASS
- `knowledge:validate` / `reality-map:validate` / `perspectives:validate` / `case-events:validate` / `discovery-clues:validate` PASS

## Security/gate conditions (must satisfy before any beta/public deploy)

1. `NODE_ENV=production` behind TLS; session cookies `Secure` active.
2. Tight production `RATE_LIMIT_*` env values; `RATE_LIMIT_ENABLED=true`.
3. Correct `FRONTEND_URL`/`ALLOWED_ORIGINS`; `CSRF_ORIGIN_CHECK=true` (lightweight Origin/Referer guard on mutating cookie-auth requests; missing Origin allowed for CLI/smoke).
4. `JSON_BODY_LIMIT` env, default `1mb`.
5. LLM keys via env only; `LLM_FAILOVER_API_KEY` configured if failover desired; startup warnings when misconfigured.
6. `npm audit` run before release; report remediations in gate doc.
7. **W7 beta-readiness fully operational** (docs/endpoints checked by operator).
8. No public deployment before W7 complete and operator signs off on W6 conditions and W7 beta review.

## Beta readiness operational status

- Runbook `M8-DEPLOYMENT-RUNBOOK.md` complete with operator go/no-go checklist.
- Health/readiness `/api/health` and config `/api/config` endpoints live.
- Privacy `/privacy` and terms `/terms` static pages live; feedback URL env-configurable.
- User export (`GET /api/me/export`, JSON allowlist, no canonical truth/hidden leakage) and deletion (`POST /api/me/delete`/`DELETE /api/me` with `{confirm:"DELETE"}`, auth-scoped, child data scoped) live and smoke-tested.
- Optional beta-access-code gate on register live (default off in dev/tests).
- **No public deployment has been authorized.** Beta readiness is for operator sign-off only.

## Residual risks / out-of-scope items (documented, not blockers)

- F4 rate-limit fail-open on DB error: accepted risk to avoid availability loss; monitoring recommended.
- F8 dependency audit: 8 npm vulnerabilities in deprecated/dev tooling only (drizzle-kit→esbuild, Prisma 8 RC→effect); runtime deps clean; no risky upgrades applied.
- R-01 structured logging: `console.error` functional; structured logging recommended post-beta.
- R-02 rate-limit sweeper multi-instance: process-local sweeper; DB counters shared; noted for multi-instance deployments.
- R-03 scheduler durability: in-process timers; catch-up on read compensates (M6 MVP limitation); documented limitation.

## M8 acceptance criteria checklist

- [x] New player can understand and start investigating without assistance (W1)
- [x] Complete intellectual loop works coherently (W1-W2; verified via 133/133 test:http)
- [x] Specialists feel distinct and contextually useful (W2; persona/voice/limits/bias cues)
- [x] Existing cases meet documented quality standard (W3; avg 24.4/42, 0 leaks, 6 candidates)
- [x] AI grounded/bounded/cost-aware (W4; deterministic fallback/USE_LLM=false preserved)
- [x] Knowledge retention meaningful/persistent (W5; `/api/me/progress`, memory mastery states)
- [x] Existing milestone functionality intact (all waves: 133/133 test:http PASS, typecheck PASS, frontend build PASS)
- [x] Security/regression suites pass (W6: PASS WITH CONDITIONS; all reports produced)
- [x] Mobile/desktop usable (W2 responsive; W7 screenshots 375/1440 PASS)
- [x] Production deployment reproducible (W6 conditions + W7 docs; no public deploy without operator sign-off)
- [x] Limited beta can be conducted safely (W7 artifacts operational; operator sign-off required)

## M8 notes / cost / limitations

- **AI quality**: deterministic fallback always available (`USE_LLM=false`). Optional LLM evaluation bounded, advisory-only, cannot set `accepted=true`. No per-page LLM calls, no scraping/search APIs. Cost notes in `M8-AI-COST-NOTES.md` (~$0.017/investigation on cheap model; $0 deterministic).
- **Case quality**: 25 seeded cases audited; The Midnight Heist benchmark 41/42; 6 candidates selected for deeper narrative refinement (deferred post-beta). Systemic culprit-name leak fixed in player-facing objectives/briefing.
- **Known limitations**: no public deployment without operator conditions; deeper narrative refinement for 6 candidates deferred; repetition/contradiction/dedupe detection in LLM paths remains light follow-up; physical server hardening outside code scope; third-party push notification infrastructure not implemented.

## Reports / artifacts produced

- `project-management/M8-W6-SECURITY-AUDIT.md`
- `project-management/M8-W6-RELIABILITY-AUDIT.md`
- `project-management/M8-W6-GATE-REPORT.md`
- `project-management/M8-CASE-QUALITY-AUDIT.md` + `.json`
- `project-management/M8-AI-COST-NOTES.md`
- `project-management/M8-DEPLOYMENT-RUNBOOK.md`
- `project-management/M8-COMPLETE-REPORT.md` (this file)

## Files modified / created during M8

- 7 migration files (`011_m7_discovery_knowledge.sql`, `012_m8_onboarding.sql`)
- `src/discovery-clues/` modules (types, eligibility, evaluation, memory, dto, safety, registry, index, 3 case packages)
- `src/discovery-service.ts`, `src/llm-provider.ts`
- `src/personal-progress.ts`
- `src/account-data.ts`
- `src/llm-guardrails.ts`
- `src/ai-grounding.ts` updates
- InvestigationHQ component, OnboardingChecklist, TabIntroTip, OnboardingOverlay
- `scripts/audit-case-quality.ts`, `scripts/test-llm-controls.ts`
- `scripts/smoke-http.ts` (extended M7 + M8 blocks)
- `project-management/M8-CASE-QUALITY-AUDIT.md`, `.json`
- `project-management/M8-W6-*` reports
- `project-management/M8-DEPLOYMENT-RUNBOOK.md`
- `project-management/M8-COMPLETE-REPORT.md`
- Frontend: InvestigationRoomPage changes, ProgressPage, LegalPage, App changes, api.ts, api module, index.css
- `frontend/src/components/discovery/`: DiscoveryPanel, DiscoveryClueCard, DiscoverySubmissionForm, DiscoveryEvaluationResult, RecallCard, KnowledgeJournalPanel, KnowledgeGraphView
- `frontend/src/pages/`: CaseListPage, KnowledgeJournalPage, ProgressPage
- `frontend/src/App.tsx`, `frontend/src/api.ts`
- `.env.example`, `README.md` updates
- No public deployment performed.

## Final declaration

M8 is **complete**. All seven waves delivered with documented conditions/gates. The investigation platform is verified green across all automated test suites (133/133 test:http). Beta-readiness artifacts are operational for operator sign-off. No public deployment is authorized until operator conditions are satisfied and beta review is complete.

**Next step**: Await operator sign-off on W6 conditions and W7 beta review. Then either proceed to a limited internal beta or transition to the next product milestone direction.