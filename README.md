# THE BAR

**THE BAR** is a planned immersive, persistent legal-career simulator set in India. The player begins as a newcomer/intern under a senior lawyer and builds a career through legal work, relationships, difficult cases, professional choices, and courtroom experience.

> **Status:** P0 prototype implemented — "The First Brief — Office Prototype" (ADR-002). A playable 7-day first-chapter slice runs locally; runtime AI remains stubbed/disabled.

## Primary reference

- [`THE_BAR_MASTER_CONTEXT.md`](./THE_BAR_MASTER_CONTEXT.md) — **primary product context / source of truth** for vision, architecture, gameplay systems, AI design, legal knowledge strategy, and visual direction.

## Planning documents

- [`docs/PROJECT_INFO.md`](./docs/PROJECT_INFO.md) — project overview, goals, scope, constraints, and repo status.
- [`docs/AUDIT.md`](./docs/AUDIT.md) — repository audit comparing current state against master context.
- [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) — phased implementation plan, dependencies, risks, and proposed P0 vertical slice.
- [`docs/DECISIONS.md`](./docs/DECISIONS.md) — open questions, decision log, and assumptions to avoid.

## Current repository state (2026-11-22)

- Repository: `/home/divyanshukumarsinha241/project-courtroom`
- Git: initialized (local)
- Application: **P0 prototype** (Vite + React + TypeScript + Tailwind), localStorage save (v1 saves migrate to v2)
- Gameplay: Days 1–7 progression with unlockable assignments, dialogue consequences (relationships + memories), evidence review/assessment/contradiction notes, notebook, editable draft with version history, deterministic citation guard and senior feedback
- Tests: `vitest` (22 passing tests across domain, migration, guardrails and a render smoke check)
- Runtime AI: deterministic stub only (no provider/model bundled)
- Verified legal corpus/data: minimal fictional seed only; no real legal corpus ingested
- Visual assets: placeholder/composed UI (no final art assets)

## Quick start

```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

## Continuous integration

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs `npm run typecheck`, `npm test`, and `npm run build` on every push and pull request. It uses Node 22 (LTS), `npm ci` with the npm cache enabled, and read-only permissions; there is no deploy or publish step. The workflow becomes active once this repository is connected to a GitHub remote with Actions enabled (there is currently no remote configured).

> Size note: keep >2 GB available in home/project environment (D-019). Current `/home` has sufficient free space; clean reinstallable artifacts only when needed.

## Non-negotiables / active constraints

- Never fabricate statutory provisions, judgments, citations, or procedural rules.
- Keep canonical case truth separate from character/player knowledge.
- Keep verified legal sources/versioning separate from generated explanations.
- Deterministic game rules separate from AI generation.
- Validate AI outputs against schemas/game rules; use transactions for important state changes.
- Do not claim features work until implemented and tested.
- THE BAR is an educational simulation, not legal advice or a substitute for formal legal education/professional qualification.
- **Storage budget: keep >2 GB available** in home/project environment (D-019, corrected 2026-11-22). Avoid unnecessary bloat; clean reinstallable caches when space is tight. See `docs/DECISIONS.md` and `docs/ADRs/ADR-000-project-constraints.md`.

## Next step

Broaden the first chapter beyond Day 7 (client interview, courtroom exposure), add real verified legal sources with provenance, and add accessibility/visual QA in a real browser when a browser binary is available — while maintaining >2 GB available storage.
