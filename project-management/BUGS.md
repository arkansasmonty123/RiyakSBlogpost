# Bugs

> **Ownership**: Orchestrator/Scrutinizer/QA log bugs. Bug Fixer updates investigation/fix/verification.  
> **Update rules**: Include reproduction, severity, status, root cause, fix, verification evidence. Do not close without evidence.

## Status values

`open` | `in_progress` | `fixed` | `verified` | `wont_fix` | `blocked`

## Open bugs

| ID | Severity | Status | Title | Reproduction / Evidence | Owner | Notes |
|---|---|---|---|---|---|---|
| BUG-001 | high | verified | Auth/session middleware and ownership guards regressed/missing in active server | 2026-11-22 recovery: server.ts stub. 2026-11-22 fix: restored server.ts (551L) with session auth, ownership guards. Scrutinizer approved. | builder | Evidence: typecheck PASS, smoke-db PASS, smoke-http 9/9 PASS, scrutinizer independent verification PASS. |
| BUG-002 | high | verified | Canonical truth wiring unverified end-to-end; DB missing | db.ts had wiring; DB missing + server stubbed. 2026-11-22: DB recreated/seeded, server restored. BUG-005 fixed (added Victor Sterling character). Deterministic correct verdict verified: `correct`, `canonicalTruthConfigured=true`. | builder/orchestrator | Evidence: smoke-db PASS, smoke-http 9/9 PASS, ad-hoc evaluateAccusation check returned correct. |
| BUG-003 | medium | verified | Schema drift between live DB, Drizzle schema, and raw SQL assumptions | Drifted Drizzle camelCase schema vs snake_case live DB/raw SQL. PROD-004: declared raw SQL migrations canonical, added 000_baseline.sql, deprecated Drizzle artifacts, added db:schema:verify (17/17 tables, 162/162 cols), docs updated. | builder | 2026-11-22: db:schema:verify PASS, smoke-db PASS, test:http 49/49 PASS. No destructive DB ops. |
| BUG-004 | high | verified | `project-investigation/src/server.ts` regressed to placeholder stub | 2026-11-22 recovery: 143-line stub. 2026-11-22 fix: restored full DB-backed server.ts (551L). Scrutinizer approved. | builder | Evidence: typecheck PASS, smoke-db PASS, smoke-http 9/9 PASS, scrutinizer 27-check approval. |
| BUG-005 | medium | verified | Seed data gap: canonical_truth culprit not matching any character | canonical_truth.culprit="Victor Sterling" had no matching character. Added Victor Sterling suspect to case fba51632... | orchestrator | Verified: evaluateAccusation returned `{"eval":"correct","configured":true,"msg":"Correct verdict. The investigation is complete."}`. |
| BUG-006 | critical | verified | GAP-04: client can reveal hidden evidence via discover-evidence | Audit probe: POST /api/investigations/:id/discover-evidence with hidden evidenceId returned 200 and made it visible. Server only checked case ownership, not playerVisible/release authorization. | builder | 2026-11-22 PROD-006: discover-evidence rejects non-playerVisible evidence (404). Smoke-http 17/17 PASS. Scrutinizer APPROVED. |
| BUG-007 | critical | verified | GAP-05: client can self-complete/spoof investigation state and achievements | Audit probe: PATCH {status:'completed',progress:100} returned 200; POST achievements accepted arbitrary type. | builder | 2026-11-22 PROD-006: PATCH limited to currentTheory/suspicionLevel; achievements 403; server-side awards; non-correct verdict stays active; completed locked. Smoke-http 17/17 PASS. Scrutinizer APPROVED. |
| BUG-008 | high | verified | GAP-07: released evidence disappears for completed investigations | Final audit probe: evidence released during active investigation is visible, but absent when investigation status becomes completed. getEvidenceByCase/getCaseById scope discovered_evidence_ids to status='active' only. | bug-fixer | 2026-11-22 PROD-011: removed `status='active'` filter in db.ts evidence lookups; unions discovered ids across owned investigations for user+case (any status). Safe DTO unchanged. Smoke-http 29/29 PASS. Scrutinizer APPROVED. |

## Fixed / verified

_None recorded yet._
