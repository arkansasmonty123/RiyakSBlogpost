# THE BAR

**THE BAR** is a planned immersive, persistent legal-career simulator set in India. The player begins as a newcomer/intern under a senior lawyer and builds a career through legal work, relationships, difficult cases, professional choices, and courtroom experience.

> **Status:** P0 prototype implemented — "The First Brief — Office Prototype" (ADR-002). A playable 10-day first-chapter slice runs locally; runtime AI remains stubbed/disabled.

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
- Gameplay: Days 1–10 progression with unlockable assignments, dialogue consequences (relationships + bounded reputation changes + memories), six-character cast and six evidence items for the fictional canteen matter, witness/specialist/peer interactions that add player knowledge only, evidence review/assessment/contradiction notes, evidence-linked case theory, notebook with kind filters, editable draft with version history, deterministic citation guard and senior feedback
- Legal provenance: the Research panel shows each source's name, citation/identifier, type, jurisdiction, verification badge, effective date and clearly labeled non-authoritative provenance/excerpt. **Source Intake** drafts records as `unverified` or `placeholder` with deterministic validation (required fields, no self-verification, citation-like strings forced to placeholder). The game never auto-verifies a source; only traceable, verified sources can be cited as authoritative.
- Tests: `vitest` (68 passing tests across domain, provenance/intake validation, case depth/knowledge boundaries, save migration, guardrails and SSR smoke checks)
- Runtime AI: deterministic stub only (no provider/model bundled)
- Verified legal corpus/data: minimal fictional seed only (one internal educational summary is marked verified; statutory entries are explicit placeholders). No real legal corpus ingested; no statutory provision, judgment or citation has been fabricated or presented as verified.
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

Add real, human-verified legal sources with official provenance (D-005/D-011 — content owner must supply and review exact text; intake alone never verifies), broaden the first chapter (courtroom exposure), and add accessibility/visual QA in a real browser when one is available — while maintaining >2 GB available storage.
