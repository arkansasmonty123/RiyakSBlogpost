# Tasks - The Negotiation Table

> Status: `pending` | `in_progress` | `blocked` | `done`

| ID | Task | Owner | Status | Acceptance criteria | Evidence |
|---|---|---|---|---|---|
| NEG-001 | Scaffold project | orchestrator | done | Project structure, package, configs | Scaffold present; build/typecheck/test pass |
| NEG-002 | Define product/PRD | orchestrator+user | done | PRD captures MVP | `PRD.md` |
| NEG-003 | Roadmap/decisions/docs | orchestrator | done | Roadmap/decisions documented | `ROADMAP.md`, `DECISIONS.md`, `docs/*` |
| NEG-004 | Runnable skeleton | builder+orchestrator | done | dev/build/test baseline | package scripts; build/typecheck/test pass |
| NEG-005 | Core backend/engine/cases | builder | done | 3 cases, SQLite, deterministic engine, API | 33/33 tests; typecheck/build pass |
| NEG-006 | AI hardening | builder | done | fallback, structured intents, guards, budgets | AI fallback tests; labeled fallback in UI |
| NEG-007 | Frontend MVP | ui-ux-frontend | done | 5-phase UI responsive/a11y | Components present; build pass; E2E smoke 13/13 recorded |
| NEG-008 | CI workflow | orchestrator | done | typecheck/test/build in CI | `.github/workflows/ci.yml` |
| NEG-009 | Recovery + hardening | builder | done | restored backend, migrations/guards/counters | 33/33 tests pass after recovery |
| NEG-010 | QA/scrutiny audit | qa-engineer+scrutinizer | done | No P0/P1; evidence-based | Audit PASS/APPROVED recorded |
| NEG-011 | Final completion pass | orchestrator | done | Docs reconciled; verification rerun | typecheck PASS, 33/33 PASS, build PASS, 99M; docs/ROADMAP reconciled |
| NEG-012 | Local LLM Cloud Shell wiring | orchestrator | done | Local model in /tmp; provider supports local/ollama; tests still pass | Ollama installed; qwen3.5:2b+0.8b in `/tmp/ollama-models`; provider keyless-local+LLM_TIMEOUT_MS fix; `.env.example` updated; typecheck PASS, 33/33 PASS. Live CPU E2E too slow on 2-core Cloud Shell. |
| NEG-013 | PRD gap audit + concept lessons | orchestrator | done | Save master PRD; audit gaps; close high-value gap | MASTER-ORCHESTRATOR-PRD.md saved; PRD-GAP-AUDIT.md created; conceptLessons added to types/engine/UI; typecheck PASS, 33/33 PASS. |
| NEG-015 | Prediction-vs-outcome debrief reflection | orchestrator | done | Evidence-based prediction calibration in debrief; no contract break | Engine-only; typecheck PASS, 33/33 PASS. |
| NEG-016 | Self-host fonts | orchestrator | done | Remove external Google Fonts; include local woff2; build passes | public/fonts + index.html updated; dist includes fonts; typecheck PASS, 33/33 PASS, build PASS. |
| NEG-014 | UI polish + visual QA pass | ui-ux-frontend | done | Responsive/a11y room/briefing/prep/debrief/skills polish; no contract breaks | typecheck PASS, 33/33 PASS, build PASS; screenshots /tmp/opencode/neg-*.png. |
| NEG-017 | Onboarding + explicit prediction reflection | orchestrator | done | First-run how-it-works cue; explicit prediction-vs-outcome debrief panel; gap audit updated | typecheck PASS, 33/33 PASS, build PASS. |
