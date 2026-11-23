# Execution Roadmap - The Negotiation Table MVP

## Constraints
- Project dir < 500 MB including node_modules. Prefer lightweight deps; SQLite; no browser downloads in project.

## Milestone 0 - Foundation ✅
- [x] Scaffold: `src/client/` (Vite React TS), `src/server/` (Express TS), `src/shared/` types.
- [x] SQLite persistence (`node:sqlite`), `PRAGMA user_version` migrations/bootstrap, 3 case seeds.
- [x] Env/config, scripts, typecheck/test/build baseline.
- [x] AI provider abstraction + deterministic fallback + structured event parsing.

## Milestone 1 - Deterministic engine ✅
- [x] Case schema (participants, objectives, constraints, info classification, private knowledge).
- [x] Negotiation state: offers/counteroffers, commitments, concessions, trust/credibility, walk-away, agreement validation.
- [x] Outcome evaluator: objective completion, decision-quality signals, debrief facts.

## Milestone 2 - AI simulation ✅
- [x] Character context builder (persona, goals, secrets, relationships, knowledge boundaries).
- [x] Turn orchestrator: decide who responds, generate structured responses, map to events.
- [x] Safety/robustness: malformed output recovery, timeout/fallback, transcript-state consistency, LLM budget.

## Milestone 3 - API & persistence ✅
- [x] Case list/detail, briefing, preparation save, session create/resume.
- [x] Message/send endpoint with engine+AI orchestration.
- [x] Debrief endpoint, cross-case skill tracking.

## Milestone 4 - Frontend MVP ✅
- [x] Case selection screen.
- [x] Two-sided briefing view (verified/reported/unknown).
- [x] Preparation room.
- [x] Static negotiation room: portraits, participant selector, group chat, composer, offer/walk-away controls.
- [x] Debrief screen with evidence-based assessment.

## Milestone 5 - Hardening & verification ✅ (MVP baseline)
- [x] Unit tests: engine, agreement validation, scoring, fallbacks.
- [x] Integration/API tests: session flow, hardening, rate-limit/guards.
- [x] E2E smoke: full player journey smoke run via Playwright (13/13 pass, 1440x900 + 375x812, 2026-11-23). No browser binaries in project.
- [x] Mobile/responsive/a11y baseline pass, error/loading states, deterministic-fallback labeling.
- [x] Size audit (<500MB), README/run instructions.

## Agent delegation used
- **architect** - implementation plan/contract.
- **builder** - backend engine/API/persistence/AI orchestration, recovery/hardening.
- **ui-ux-frontend** - room/briefing/prep/debrief UI, responsive/a11y.
- **qa-engineer** - test/regression audit.
- **scrutinizer** - evidence-based audit before milestone completion.

## Risks / residual notes
- Live LLM E2E depends on provider credentials; deterministic fallback is verified default.
- In-memory rate limit and per-process turn lock are single-instance MVP limits.
- No public deploy/push performed. Operator handles hosting/TLS/env hardening.