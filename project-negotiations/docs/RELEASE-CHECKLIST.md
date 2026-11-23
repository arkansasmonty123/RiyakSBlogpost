# Release Checklist - The Negotiation Table

Use this checklist before declaring release readiness. Mark items with evidence.

## Code & verification

- [ ] `npm run typecheck` PASS
- [ ] `npm test` PASS (all non-opt-in tests; record counts)
- [ ] `npm run build` PASS
- [ ] `npm audit --omit=dev` reviewed; high/critical prod vulns addressed or explicitly accepted with mitigation
- [ ] Git working tree reviewed; intended changes committed; unrelated dirty files not staged

## Product / PRD

- [ ] 3 cases playable: Acquisition, Fragile Peace, Walkout
- [ ] 5-phase flow works: Case Select, Briefing, Preparation, Room, Debrief, Skills
- [ ] Two-sided briefing shows verified/reported/unknown; no hidden secrets/private knowledge leaked pre-debrief
- [ ] Preparation fields persist and appear in debrief evidence where relevant
- [ ] Room supports group/targeted chat, natural language, structured offers/counteroffers/accept/reject/withdraw, walk-away, finalize
- [ ] Deterministic engine authoritative; chat "I accept" does not auto-create agreement
- [ ] Debrief includes outcomes, objectives, concessions, unresolved, trust changes, key moments, mistakes/missed opportunities, hidden reveals post-completion, alternatives, evidence-based skills, decision vs outcome quality
- [ ] Cross-case skill tracking visible

## AI / fallback

- [ ] Deterministic fallback works with no LLM configured and is clearly labeled
- [ ] Malformed LLM output / timeout / budget exhaustion degrade safely
- [ ] Real LLM E2E executed, OR explicitly documented as external blocker with reproducible procedure (`docs/TESTING.md`)

## Browser / gameplay

- [ ] Desktop, narrow mobile, Android-typical viewport smoke checked
- [ ] All 3 cases played with varied strategies (anchor, cooperative, questioning/silence, bluff/challenge, concession, coalition, walk-away, poor decisions)
- [ ] No blocking console/page errors
- [ ] Persistence across server restart verified

## Security / reliability

- [ ] Request validation, phase guards, version guards, turn lock verified
- [ ] No secret leakage in briefing/session DTOs
- [ ] Rate limiting / body limits / CORS / security headers reviewed for deployment target
- [ ] SQLite DB path persistent and backupable

## Docs / operator readiness

- [ ] `README.md` accurate
- [ ] `.env.example` complete, no secrets
- [ ] `docs/ARCHITECTURE.md` accurate
- [ ] `docs/TESTING.md` includes commands and real LLM procedure
- [ ] `docs/DEPLOYMENT.md` includes TLS/proxy/CORS/secrets/DB/observability/limits
- [ ] `docs/RELEASE-CHECKLIST.md` (this file) completed with evidence

## Release verdict

- [ ] **RELEASE READY** / **RELEASE READY WITH EXTERNAL BLOCKERS** / **NOT READY**
- [ ] Independent final audit recorded
- [ ] Final report includes commands/results, evidence, blockers, git hash, launch steps