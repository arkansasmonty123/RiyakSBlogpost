# ADR-000 — Project Constraints and Phase 0 Baseline

- **Status:** Accepted
- **Date:** 2026-11-22
- **Owners:** Product owner (direction), Orchestrator (documentation)
- **Related decisions:** D-008, D-009, D-015, D-019

## Context

THE BAR is a greenfield project in `/home/divyanshukumarsinha241/project-courtroom`. The master context defines an ambitious product; repository audit found no implementation. The user requested Phase 0 begin and set an explicit size constraint: **keep the project size under 1.5 GB**.

"Project size" is ambiguous (repo-only vs dev workspace with dependencies vs installed artifact vs local AI models). Until clarified, the constraint is interpreted conservatively.

## Decision

1. **Phase 0 bootstrap begins** with documentation/source-of-truth, git hygiene, and decision records. No application scaffold added in this pass.
2. **Size budget: < 1.5 GB total home/workspace footprint** is a hard active constraint (clarified by user 2026-11-22).
   - Total space of project/folder/home must not exceed 1.5 GB.
   - Large/reinstallable artifacts (node_modules, browser binaries, pip/prisma caches, model weights, raw media, DB dumps, bulky build caches) must be cleaned or kept external/download-on-demand.
   - Any decision that risks exceeding 1.5 GB (local model bundle, large corpus/index, high-res asset pack, heavy deps) requires explicit review.
3. **Master context remains source of truth** (`THE_BAR_MASTER_CONTEXT.md`).
4. **No fabrication / no truth leakage / deterministic-vs-AI separation** remain non-negotiable per master context.

## Alternatives considered

- Ignore size constraint until implementation — rejected; early dependency/asset/model choices can lock in bloat.
- Treat 1.5 GB as repo-only (excluding node_modules) — possible, but ambiguous; recorded as clarification needed.
- Treat 1.5 GB as installed user artifact including local model — strict; likely incompatible with bundled 3B+ local models.

## Consequences

- Prefer server-hosted/runtime AI or external downloadable model packs over bundling large models into repo/install.
- Prefer optimized WebP/static assets; avoid audio/video/4K asset packs in P0.
- Keep legal corpus scoped and indexed efficiently; avoid committing large raw corpora unless necessary.
- Use lightweight dependencies; audit `node_modules` and build outputs.
- Document actual size at each phase checkpoint.

## Verification / follow-up

- Add size check to Phase 1 CI/dev docs (e.g., `du -sh` workspace, artifact size budget).
- Clarify D-019: does 1.5 GB mean repo, dev workspace, or installed app?
- Revisit when selecting runtime AI strategy (D-003/D-004) and art pipeline (D-002/D-012).