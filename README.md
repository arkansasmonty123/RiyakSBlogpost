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
- [`docs/LEGAL_SOURCE_VERIFICATION.md`](./docs/LEGAL_SOURCE_VERIFICATION.md) — D-005/D-011 content-owner checklist: required fields, acceptable official sources, validator usage, sign-off log, and the no-fabrication rule.
- [`docs/legal-corpus/README.md`](./docs/legal-corpus/README.md) — corpus intake pipeline: folder layout, manifest format, verification workflow, and blocked status (no real corpus shipped).
- [`docs/art-pipeline/README.md`](./docs/art-pipeline/README.md) — Phase 5 art asset pipeline: folder layout, naming/specs, formats, size budgets, provenance/licensing checklist, approval flow, and blocked status (D-002/D-012/D-018; no real assets shipped).
- [`docs/ART_DIRECTION.md`](./docs/ART_DIRECTION.md) — provisional art direction, palette and character/environment rules (draft, pending owner decisions).

## Current repository state (2026-11-22)

- Repository: `/home/divyanshukumarsinha241/project-courtroom`
- Git: initialized (local)
- Application: **P0 prototype** (Vite + React + TypeScript + Tailwind), localStorage save (v1 saves migrate to v2)
- Gameplay: Days 1–10 progression with unlockable assignments, dialogue consequences (relationships + bounded reputation changes + memories), a twelve-character cast (including a junior advocate colleague, a visiting medical consultant, a professional rival and a canteen supervisor, each with day-gated, boundary-respecting conversations) and six evidence items for the fictional canteen matter, witness/specialist/peer interactions that add player knowledge only, evidence review/assessment/contradiction notes, evidence-linked case theory, notebook with kind filters, editable draft with version history, deterministic citation guard and senior feedback
- Legal provenance: the Research panel shows each source's name, citation/identifier, type, jurisdiction, verification badge, effective date and clearly labeled non-authoritative provenance/excerpt. **Source Intake** drafts records as `unverified` or `placeholder` with deterministic validation (required fields, no self-verification, citation-like strings forced to placeholder). The game never auto-verifies a source; only traceable, verified sources can be cited as authoritative.
- Tests: `vitest` (200 passing tests across 23 files: domain/provenance/validation, case depth/knowledge boundaries, cast/scenes, save migration, audit/env config, guardrails, completion/onboarding/endgame synthesis/a11y smoke and SSR checks)
- Runtime AI: deterministic stub only (no provider/model bundled)
- Verified legal corpus/data: minimal fictional seed only (one internal educational summary is marked verified; statutory entries are explicit placeholders). No real legal corpus ingested; no statutory provision, judgment or citation has been fabricated or presented as verified.
- Legal source verification workflow: **complete, but corpus-blocked.** `docs/LEGAL_SOURCE_VERIFICATION.md` defines the content-owner checklist and sign-off process; `src/domain/sourceValidation.ts` + `npm run validate:sources` deterministically gate records (required provenance, named reviewer/date, official URL and reviewed allowlist for specific citations). No real corpus exists yet; the allowlist is empty and D-005/D-011 remain blocked on a legal content owner.
- Legal corpus manifest pipeline: **ready, but corpus-blocked.** `docs/legal-corpus/` documents the intake folder layout, manifest format and human handoff; `validateCorpusManifest` + `npm run validate:legal-corpus` validate manifest metadata and every record with clear reporting. The only shipped manifest is `manifest.template.json`, which is flagged `template: true` and rejected by the validator by design (`--template` exits 1). No official source has been ingested.
- Visual assets: placeholder/composed UI only (`src/app/SceneArt.tsx`; no final art assets). The Phase 5 art pipeline scaffold is ready (`docs/art-pipeline/`, `npm run validate:art-manifest`), but its only manifest is a rejected template and the intake folders contain only `.gitkeep` placeholders — real assets remain blocked on D-002/D-012/D-018 plus named owner approval.

## Quick start

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run dev

# Validate source records against the D-005/D-011 provenance gate (offline, no ingestion):
npm run validate:sources -- --seed
npm run validate:sources -- docs/examples/legal-sources.example.json

# Validate a corpus manifest (not shipped while the corpus is blocked):
npm run validate:legal-corpus -- docs/legal-corpus/manifest.json
# Prove the shipped template is NOT ingestible (expected exit code 1):
npm run validate:legal-corpus -- --template

# Validate the Phase 5 art manifest (not shipped while assets are blocked):
npm run validate:art-manifest -- docs/art-pipeline/asset-manifest.json
# Prove the shipped art template is NOT an approved manifest (expected exit code 1):
npm run validate:art-manifest -- --template
```

## Continuous integration

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, the deterministic offline corpus gate (`npm run validate:sources -- --seed` and a check that the corpus template is rejected with exit 1), a check that the Phase 5 art manifest template is rejected with exit 1, and `npm run build` on every push and pull request. It uses Node 22 (LTS), `npm ci` with the npm cache enabled, and read-only permissions; there is no deploy or publish step. The workflow becomes active once this repository is connected to a GitHub remote with Actions enabled (there is currently no remote configured).

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

Assign the legal content owner and add real, human-verified legal sources with official provenance (D-005/D-011 — the workflow/tooling and checklist are ready, but the owner must supply and sign off exact text; intake and the validator never verify on their own), broaden the first chapter (courtroom exposure), and add accessibility/visual QA in a real browser when one is available — while maintaining >2 GB available storage.
