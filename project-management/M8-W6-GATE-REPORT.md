# M8 Wave 6 - Security / Reliability / Performance Gate Report

**Date**: 2026-11-24  
**Status**: **PASS WITH CONDITIONS** (no critical/high unresolved; deployment/beta allowed only with documented operator conditions; no public deploy before W7 readiness complete)

## Verification evidence

- `npm run typecheck` PASS
- `npm run test:smoke` PASS
- `npm run test:http` PASS (**127/127**)
- `npm test` EXIT 0 (full cross-milestone chain)
- `npm run db:schema:verify` PASS (45/45 tables, 546 cols)
- `case:validate` PASS (25 cases, 202 evidence)
- `case:quality` PASS (avg 24.4/42, 0 leaks)
- `knowledge:validate` / `reality-map:validate` / `perspectives:validate` / `case-events:validate` / `discovery-clues:validate` PASS (via npm test chain)

## Audit inputs

- Security audit: `project-management/M8-W6-SECURITY-AUDIT.md` (security-auditor subagent)
- Reliability/regression audit: `project-management/M8-W6-RELIABILITY-AUDIT.md` (scrutinizer subagent)
- Hardening slice: W6-S1 (builder)

## Finding resolution summary

| ID | Sev | Area | Resolution | Status |
|---|---|---|---|---|
| F1 | medium | Cookie secure in prod | Cookie `secure` is NODE_ENV-based; startup warning added when NODE_ENV!=production; `.env.example` documents `NODE_ENV=production` + TLS | Resolved with operator config |
| F2 | medium | CSRF | Lightweight Origin/Referer check for mutating cookie-auth requests; missing Origin allowed for CLI/smoke; configurable via `CSRF_ORIGIN_CHECK`; allowed origins from `FRONTEND_URL`/`ALLOWED_ORIGINS` | Mitigated (defence-in-depth; token-based CSRF not yet added) |
| F3 | medium | Rate-limit defaults | Dev defaults preserved for smoke; startup warnings in non-prod/risky config; `.env.example` provides tightened production values | Resolved with operator config |
| F4 | low | Rate-limit fail-open on DB error | Logged fail-open retained to avoid availability loss; monitoring recommended | Accepted risk |
| F5 | medium | 10mb body limit | `JSON_BODY_LIMIT` env, default `1mb`; body-parser errors mapped to 413/400/415 | Resolved |
| F6 | medium->mitigated | Notification settings mass assignment | DB helper already allowlists/normalizes; verified | Mitigated |
| F7 | low | LLM failover key reuse | Startup warning when failover configured without `LLM_FAILOVER_API_KEY`; `.env.example` documented | Resolved with operator config |
| F8 | info/high-dev | Dependency audit | `npm audit` shows 8 vulns (4 moderate, 4 high, 0 critical) in deprecated/dev tooling (drizzle-kit/esbuild, Prisma 8 RC/effect). Runtime deps clean. No risky major upgrades applied. | Documented/accepted for beta; revisit before public prod |
| F9 | medium | Explicit CSP | Helmet configured with API CSP: `default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` | Resolved |
| F10 | low | Abandon confirmation UX | API requires `confirm===true`; UI has confirmation flow | Mitigated |
| R-01 | low | Structured logging | console.error functional; structured logging recommended | Open follow-up |
| R-02 | low | Rate-limit sweeper multi-instance | Process-local sweeper; DB counters shared; note for multi-instance | Documented limitation |
| R-03 | low | Scheduler durability | In-process timers; catch-up on read compensates | Accepted MVP limitation |

## Deployment conditions (must satisfy before any beta/public deploy)

1. `NODE_ENV=production` behind TLS; secure cookies active.
2. Set tight `RATE_LIMIT_*` env values; keep `RATE_LIMIT_ENABLED=true`.
3. Set `FRONTEND_URL`/`ALLOWED_ORIGINS` correctly; keep `CSRF_ORIGIN_CHECK=true`.
4. Set `JSON_BODY_LIMIT` appropriately (default 1mb ok).
5. Provide LLM keys only via env; set `LLM_FAILOVER_API_KEY` if failover configured.
6. Run `npm audit` before release; patch/accept with documented rationale.
7. Complete W7 beta-readiness (privacy/terms, data export/delete, backup/rollback, monitoring, beta access controls, runbook).
8. No public deployment before W7 complete and human/beta feedback reviewed.

## Gate decision

**W6 = PASS WITH CONDITIONS.** No critical/high unresolved security or data-integrity defects found in audited scope. Regression suite green. Proceed to W7; do not deploy publicly.