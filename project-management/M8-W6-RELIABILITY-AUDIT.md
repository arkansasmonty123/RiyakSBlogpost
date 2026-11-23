# M8 Wave 6 - Reliability / Performance / Regression Audit

**Date**: 2026-11-24  
**Scope**: `project-investigation/` (read-only audit by scrutinizer subagent)  
**Baseline**: `typecheck` PASS, `test:smoke` PASS, `test:http` 127/127 PASS, `npm test` PASS, `db:schema:verify` PASS (45/45,546), `case:validate` PASS, `case:quality` PASS, `reality-map:validate` PASS, `knowledge:validate` PASS.

## Summary

Scrutinizer reported **APPROVED** for deployment gate at regression level. However, this is a regression/audit signal, not a full M8 W6 closure: security audit returned **PASS WITH CONDITIONS**, and several medium hardening items remain open. W7 deployment/beta readiness is not complete.

## Findings (from scrutinizer)

| ID | Severity | Area | Detail | Resolution status |
|---|---|---|---|---|
| F-01 | low | Error logging | 11 `console.error` calls functional; consider structured logging for prod observability | Open (post-beta hardening) |
| F-02 | low | Rate-limit scalability | Sweeper is process-local; note for multi-instance deployments | Open (documented limitation) |
| F-03 | low | Scheduler durability | Not durable across restarts; catch-up on read compensates (M6 MVP limitation) | Open/accepted (documented) |

## Positive controls observed

- Auth/ownership guards on investigation routes.
- Rate-limit DB persistence with atomic counters.
- Session token hash durability (SHA-256 digests).
- Progression engine idempotency (ON CONFLICT DO NOTHING).
- Three-check accusation integrity (readiness + integrity + cooldown).
- Canonical truth server-only, never leaked.
- Discovery hidden-evidence blocking.
- M8 onboarding safety (allowlist-validated DTOs).
- Progress/profile ownership scoping.

## Gate recommendation

**Regression gate: PASS.** **Overall W6 gate: PASS WITH CONDITIONS** pending resolution/documentation of security medium findings (see `M8-W6-SECURITY-AUDIT.md`) and W7 deployment/beta readiness deliverables. No public deployment before conditions resolved/documented.