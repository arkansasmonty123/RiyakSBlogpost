# DEV Status - The Negotiation Table

> **Owner**: Orchestrator. Update after meaningful milestones/blocks.

## Current objective
Complete and maintain **The Negotiation Table** MVP in `project-negotiations/` per `PRD.md`, `ROADMAP.md`, and `docs/ARCHITECT-PLAN.md`.

## Current milestone
**NEG-M5: MVP complete and verified** (2026-11-23)

## Completed
- [x] NEG-001..011 MVP complete (scaffold, PRD, engine, 3 cases, AI hardening, frontend, CI, recovery, QA/scrutiny, docs reconciliation).
- [x] NEG-012 Local LLM Cloud Shell wiring: ollama installed; `qwen3.5:2b` + `qwen3.5:0.8b` pulled to `/tmp/ollama-models`; provider allows local/ollama without API key; orchestrator respects `LLM_TIMEOUT_MS`; `.env.example` updated. Verification: typecheck PASS, 33/33 tests PASS.

- [x] NEG-013 Master PRD saved (`docs/MASTER-ORCHESTRATOR-PRD.md`), gap audit (`docs/PRD-GAP-AUDIT.md`), evidence-based concept lessons added to debrief. Verification: typecheck PASS, 33/33 tests PASS.

- [x] NEG-014 UI polish + visual QA pass (ui-ux-frontend): realistic static room feel, responsive 375/1440, a11y/reduced-motion/forced-colors. Independent verification: typecheck PASS, 33/33 PASS, build PASS. Screenshots: `/tmp/opencode/neg-*.png`.

- [x] NEG-015 Prediction calibration reflection added to deterministic debrief (evidence-based). typecheck PASS, 33/33 PASS.

- [x] NEG-016 Self-hosted fonts (IBM Plex Sans, Newsreader latin woff2) for offline determinism. typecheck PASS, 33/33 PASS, build PASS.

- [x] NEG-017 First-run onboarding cue (case select) + explicit prediction-vs-outcome calibration panel in debrief; PRD gap audit updated. typecheck PASS, 33/33 PASS, build PASS.

## Blockers / risks
- No critical blockers.
- Live LLM E2E env-dependent; deterministic fallback verified/default.
- In-memory rate limit and per-process turn lock are single-instance MVP limits.

## Next action
Implementation plan MVP scope complete and verified. Optional operator/user actions only: (1) live LLM playtest on faster/API machine (`LLM_PROVIDER/LLM_API_KEY/LLM_MODEL/LLM_URL`), (2) operator deploy hardening/TLS. No deploy/push without explicit approval.