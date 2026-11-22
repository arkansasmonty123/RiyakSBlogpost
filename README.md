# THE BAR

**THE BAR** is a planned immersive, persistent legal-career simulator set in India. The player begins as a newcomer/intern under a senior lawyer and builds a career through legal work, relationships, difficult cases, professional choices, and courtroom experience.

> **Status:** Documentation/planning phase. No application implementation exists yet in this repository. This repo currently contains product context and planning artifacts only.

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
- Application scaffold: **P0 prototype shell** (Vite + React + TypeScript + Tailwind)
- Tests: `vitest` (2 passing case-truth separation tests)
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

> Size note: under hard <1.5 GB home budget (D-019). If needed, clear reinstallable `node_modules` after verification and reinstall on demand.

## Non-negotiables / active constraints

- Never fabricate statutory provisions, judgments, citations, or procedural rules.
- Keep canonical case truth separate from character/player knowledge.
- Keep verified legal sources/versioning separate from generated explanations.
- Deterministic game rules separate from AI generation.
- Validate AI outputs against schemas/game rules; use transactions for important state changes.
- Do not claim features work until implemented and tested.
- THE BAR is an educational simulation, not legal advice or a substitute for formal legal education/professional qualification.
- **Hard size budget: total project/folder/home < 1.5 GB** (D-019). Large model weights/raw media/DB dumps/build caches must not bloat home; prefer optimized assets and external/hosted large artifacts. See `docs/DECISIONS.md` and `docs/ADRs/ADR-000-project-constraints.md`.

## Next step

Continue P0 "The First Brief — Office Prototype" (ADR-002): deepen scene interactions, evidence discovery, notebook/drafting loop, save/load polish, and add guardrail tests — while keeping footprint under 1.5 GB.
