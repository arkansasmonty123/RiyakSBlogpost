# ADR-000 — Project Constraints and Phase 0 Baseline

- **Status:** Accepted
- **Date:** 2026-11-22
- **Owners:** Product owner (direction), Orchestrator (documentation)
- **Related decisions:** D-008, D-009, D-015, D-019

## Context

THE BAR is a greenfield project in `/home/divyanshukumarsinha241/project-courtroom`. The master context defines an ambitious product; repository audit found no implementation. The user set a storage constraint; it was initially misrecorded and corrected on 2026-11-22: **available storage in home/project environment must remain >2 GB**.

## Decision

1. **Phase 0 bootstrap begins** with documentation/source-of-truth, git hygiene, and decision records. No application scaffold added in this pass.
2. **Storage availability budget: >2 GB available** in home/project environment (corrected by user 2026-11-22).
   - Available storage should remain greater than 2 GB. Check with `df -h /home`.
   - Avoid unnecessary bloat; clean reinstallable caches/artifacts when availability is at risk.
   - Large model weights/raw media/DB dumps should not be committed by default; prefer external/hosted/download-on-demand where practical.
3. **Master context remains source of truth** (`THE_BAR_MASTER_CONTEXT.md`).
4. **No fabrication / no truth leakage / deterministic-vs-AI separation** remain non-negotiable per master context.

## Alternatives considered

- Ignore size constraint until implementation — rejected; early dependency/asset/model choices can lock in bloat.
- Strict total <1.5 GB cap — rejected after user correction; replaced by >2 GB available storage rule.
- No storage rule — rejected; environment has finite disk and large artifacts can accumulate.

## Consequences

- Prefer server-hosted/runtime AI or external downloadable model packs over bundling large models into repo/install.
- Prefer optimized WebP/static assets; avoid audio/video/4K asset packs in P0.
- Keep legal corpus scoped and indexed efficiently; avoid committing large raw corpora unless necessary.
- Use lightweight dependencies; audit `node_modules` and build outputs.
- Document actual size at each phase checkpoint.

## Verification / follow-up

- Add size check to Phase 1 CI/dev docs (e.g., `du -sh` workspace, artifact size budget).
- Keep D-019 enforced as >2 GB available; monitor with `df -h /home`.
- Revisit when selecting runtime AI strategy (D-003/D-004) and art pipeline (D-002/D-012).