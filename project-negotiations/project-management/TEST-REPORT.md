# Test Report - The Negotiation Table

## Latest verification (2026-11-23, NEG-RELEASE-001)

| Check | Command | Result | Evidence |
|---|---|---|---|
| Typecheck | `npm run typecheck` | PASS | `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.server.json --noEmit` |
| Automated tests | `npm test` | PASS | **8 passed \| 1 skipped (9 files); 41 passed \| 2 skipped (43 tests)**. Opt-in `tests/llm-e2e.test.ts` skipped unless `LLM_E2E=1`. |
| Build | `npm run build` | PASS | Vite client + server tsc; `dist/client` + `dist/server` produced |
| Prod audit | `npm audit --omit=dev` | PASS | **0 vulnerabilities** after zod 3.25.76 -> 4.6.7 (GHSA-mrhx-c7xc-m3w5 resolved) |
| Size | `du -sh .` | PASS | ~100M (<500MB) |

## New/updated test coverage (release hardening)

- `tests/concurrency.test.ts` - per-session in-process turn lock rejects concurrent second turn; exactly one commit.
- `tests/release-hardening.test.ts` - dependency-free security headers + opt-in CORS allowlist/preflight behavior.
- `tests/llm-e2e.test.ts` - opt-in real LLM E2E; skipped by default; fails loudly when enabled without credentials (no fabricated pass).
- `tests/engine.test.ts` - added explicit conceptLessons/prediction-calibration assertions (present/absent paths).
- `tests/api.test.ts` - expectedStateVersion guards on mutating endpoints; idempotent finalize replay.
- `tests/hardening.test.ts` - persistence across DB reopen/restart; fixed test ID collision (randomized deps prefix) that caused cross-test event session_id conflict.

## Security/reliability evidence

- **Security audit** (security-auditor, read-only): PASS WITH CONDITIONS, no P0/P1. Zod vuln fixed; headers/CORS/rate-limit/deploy docs addressed pragmatically. In-memory rate limits and process-local turn lock remain single-instance MVP limits (documented).
- **Restart persistence**: builder executed temp file DB restart check (SIGTERM/restart, same DB path) - PASS (session status/turnCount/stateVersion/messages/preparation preserved). Documented procedure in `docs/TESTING.md`.
- **State/version guards**: `expectedStateVersion` supported on mutating endpoints; tested.

## Browser/UI evidence

- **ui-ux-frontend** audit/fixes (Playwright, 1440x900/375x812/412x915): keyboard-focusable scroll regions, draft preserved on failed send, counteroffer guard, target-name resolution, tap-target/contrast fixes, transcript/walk-away state reset. No console/page errors observed in flows. Screenshots `/tmp/opencode/neg-*.png`, `/tmp/opencode/neg-postfix-*.png`.
- Orchestrator full regression after UI+zod+docs: typecheck PASS, 41/43 PASS, build PASS.

## Real LLM E2E

- **Status: BLOCKED (external env)** - no `LLM_PROVIDER`/`LLM_API_KEY`/`LLM_MODEL`/`LLM_URL` configured; no local ollama/models in environment. 
- **Not fabricated.** Opt-in test `tests/llm-e2e.test.ts` fails loudly when `LLM_E2E=1` without creds. Repro procedure in `docs/TESTING.md`.

## Gameplay/browser E2E

- User-tester subagent (`ses_df63113f0ffeIljLKFXZr02K2I`) assigned for serious 3-case gameplay + browser E2E + persistence; results pending at time of this report update. Final verdict must include their evidence.

## Historical baseline

- 2026-11-23 NEG-011: typecheck PASS, 33/33 tests PASS, build PASS, 99M. Playwright 13/13 smoke recorded in prior pass.