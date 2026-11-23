# DEV Status

> **Ownership**: Orchestrator maintains this file. Update after every meaningful task/milestone.  
> **Update rules**: Keep factual; include date/time context when known; do not remove history silently - summarize previous state if replaced.

## Current objective

Take **"The Negotiation Table"** (`project-negotiations/`) from "MVP COMPLETE WITH CONDITIONS" to an independently verified, playable, release-ready MVP. Autonomous orchestration/recovery/model policy remain active.

## Current milestone

**NEG-RELEASE: Final completion and release readiness** (2026-11-23)

## Project snapshot

- **Workspace**: `/home/divyanshukumarsinha241` (git repo)
- **Active project**: `project-negotiations/` - MVP release-readiness hardening in progress.
- **Paused/complete project**: `project-investigation/` - M8 complete, 133/133 test:http, W6 PASS WITH CONDITIONS, W7 beta-readiness artifacts operational, no public deployment.
- **Other project**: `project-courtroom/`

## Completed

- [x] **NEG-001..017**: MVP baseline complete (5-phase flow, 3 cases, deterministic engine, AI fallback, debrief/skills, CI, docs, audits). 33/33 tests PASS at baseline.
- [x] **NEG-RELEASE-001-AUDIT** (security-auditor, `ses_df64120b3ffecuHh3Xk5i8yaU8`): PASS WITH CONDITIONS. No P0/P1. P2: zod GHSA-mrhx-c7xc-m3w5 (major 3->4 upgrade risk; mitigated by body cap/max bounds, documented), pragmatic hardening/CORS/deploy docs. P3: in-memory rate limits single-instance, operator env/TLS/CORS.
- [x] **NEG-RELEASE-001-BUILD** (builder, `ses_df64120aeffe8PrILIv3NHtNWt`, orchestrator-verified): server/test/docs hardening. expectedStateVersion guards on mutating endpoints, mutation rate limits, dependency-free security headers, opt-in CORS allowlist, OPENAI_API_KEY support, concurrency/release-hardening/llm-e2e(opt-in skipped) tests, conceptLessons/prediction-calibration assertions, restart-persistence check, release docs (ARCHITECTURE/TESTING/DEPLOYMENT/RELEASE-CHECKLIST), ARCHITECT-PLAN token-claim fix. **Verified: typecheck PASS, 41 passed/2 skipped (9 files), build PASS, ~100M.**
- [x] **Real LLM E2E status**: **BLOCKED in this env** (no LLM env vars, no ollama/models). Repro procedure documented in `docs/TESTING.md` + `tests/llm-e2e.test.ts`; opt-in test fails loudly without creds (no fabricated pass).

## Pending

- [ ] **NEG-RELEASE-001-FINAL**: Independent final audit, commit intended `project-negotiations/` changes (gitignore-respecting, no unrelated files), deliver final verdict report.

## Completed (this mission)

- [x] **NEG-RELEASE-001-AUDIT** (security-auditor, `ses_df64120b3ffecuHh3Xk5i8yaU8`): PASS WITH CONDITIONS. No P0/P1.
- [x] **NEG-RELEASE-001-BUILD** (builder, `ses_df64120aeffe8PrILIv3NHtNWt`, orchestrator-verified): server/test/docs hardening, release docs, restart persistence evidence.
- [x] **NEG-RELEASE-001-UI** (ui-ux-frontend, `ses_df64120afffewyX5gkv1NVQn5T`, orchestrator-verified): browser UI audit/fixes.
- [x] **NEG-RELEASE-001-GAMEPLAY** (user-tester, `ses_df63113f0ffeIljLKFXZr02K2I`): all 3 cases played, 1440/375/412, 0 console/page errors, persistence restart PASS. Found P1/P2/P3.
- [x] **NEG-RELEASE-001-FIXES** (orchestrator): Fixed P1 question/challenge intent detection (engine+RoomView), P2 no-agreement outcome (all 3 cases), P3 scroll reset. Added regression tests. API smoke verified.
- [x] **Zod GHSA-mrhx-c7xc-m3w5**: upgraded to 4.6.7, `npm audit --omit=dev` 0 vulnerabilities.
- [x] **Real LLM E2E**: **BLOCKED in env** (no creds/ollama). Repro procedure in `docs/TESTING.md`, opt-in test fails loudly without creds.

## Blockers / risks

- **External blocker**: Real LLM E2E requires provider credentials/runtime not present. Deterministic fallback verified; reproducible procedure prepared.
- **Single-instance MVP limits**: in-memory rate limits, process-local turn lock (documented).
- **Deterministic fallback feel**: structurally distinct participants; templated dialogue/no memory in fallback mode. Real LLM distinctness untested.

## Next action

Independent final audit, git commit intended `project-negotiations/` files, deliver final release verdict report. No deploy/push without explicit approval.
