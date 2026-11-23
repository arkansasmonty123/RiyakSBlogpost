# THE BAR

**THE BAR** is a planned immersive, persistent legal-career simulator set in India. The player begins as a newcomer/intern under a senior lawyer and builds a career through legal work, relationships, difficult cases, professional choices, and courtroom experience.

> **Status:** P0 complete **for the feasible local scope** — "The First Brief — Office Prototype" (ADR-002). A playable 10-day first-chapter slice runs locally with deterministic guardrails and a one-command verification gate. Local AI integration is **experimental/local-only** (guarded llama-server in `/tmp`, no RAG, not authoritative). Real verified legal corpus / licensed external art remain blocked on named human owners. See [`docs/COMPLETION-REPORT.md`](./docs/COMPLETION-REPORT.md) for the exact meaning, evidence and handoff.

## Primary reference

- [`THE_BAR_MASTER_CONTEXT.md`](./THE_BAR_MASTER_CONTEXT.md) — **primary product context / source of truth** for vision, architecture, gameplay systems, AI design, legal knowledge strategy, and visual direction.

## Planning documents

- [`docs/PROJECT_INFO.md`](./docs/PROJECT_INFO.md) — project overview, goals, scope, constraints, and repo status.
- [`docs/AUDIT.md`](./docs/AUDIT.md) — repository audit comparing current state against master context.
- [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) — phased implementation plan, dependencies, risks, and proposed P0 vertical slice.
- [`docs/DECISIONS.md`](./docs/DECISIONS.md) — open questions, decision log, and assumptions to avoid.
- [`docs/LEGAL_SOURCE_VERIFICATION.md`](./docs/LEGAL_SOURCE_VERIFICATION.md) — D-005/D-011 content-owner checklist: required fields, acceptable official sources, validator usage, sign-off log, and the no-fabrication rule.
- [`docs/COMPLETION-REPORT.md`](./docs/COMPLETION-REPORT.md) — P0 completion report: feasible-scope definition, must/should/blocked evidence, actual verification results, residual risks and blocked-item handoff.
- [`docs/legal-corpus/README.md`](./docs/legal-corpus/README.md) — corpus intake pipeline: folder layout, manifest format, verification workflow, and blocked status (no real corpus shipped).
- [`docs/art-pipeline/README.md`](./docs/art-pipeline/README.md) — Phase 5 art asset pipeline: folder layout, naming/specs, formats, size budgets, provenance/licensing checklist, approval flow, and blocked status (D-002/D-012/D-018; no real assets shipped).
- [`docs/ART_DIRECTION.md`](./docs/ART_DIRECTION.md) — provisional art direction, palette and character/environment rules (draft, pending owner decisions).

## Current repository state (2026-11-23, HEAD `45df4e3`)

- Repository: `/home/divyanshukumarsinha241/project-courtroom`
- Git: initialized (local)
- Application: **P0 prototype — feasible scope complete** (Vite + React + TypeScript + Tailwind), localStorage save (v1 saves migrate to v2)
- Gameplay: Days 1–10 progression with unlockable assignments, dialogue consequences (relationships + bounded reputation changes + memories), a twelve-character cast (including a junior advocate colleague, a visiting medical consultant, a professional rival and a canteen supervisor, each with day-gated, boundary-respecting conversations) and six evidence items for the fictional canteen matter, witness/specialist/peer interactions that add player knowledge only, evidence review/assessment/contradiction notes, evidence-linked case theory, notebook with kind filters, editable draft with version history, deterministic citation guard and senior feedback
- Legal provenance: the Research panel shows each source's name, citation/identifier, type, jurisdiction, verification badge, effective date and clearly labeled non-authoritative provenance/excerpt. **Source Intake** drafts records as `unverified` or `placeholder` with deterministic validation (required fields, no self-verification, citation-like strings forced to placeholder). The game never auto-verifies a source; only traceable, verified sources can be cited as authoritative.
- Tests: `vitest` (**331 passing tests across 39 files**: domain/provenance/validation, case depth/knowledge boundaries, cast/scenes, save migration/privacy/failure status/status UX, audit/env config, guardrails, completion/onboarding/endgame synthesis, draft submission coherence, chapter integrity, reset/replay, notebook cap, panel polish, local AI guards/service/panel, art pipeline, a11y smoke and SSR checks). `npm run verify` is the one-command local gate: lint → format check → typecheck → test → production build.
- Runtime AI: **experimental local-only integration** available (Local AI Lab panel, Vite proxy to local llama-server, provider abstraction, prompt/response guards, citation/canonical-truth red-team checks, optional RAG-lite over approved internal educational summaries only). No verified official-corpus grounding, no production provider; output is non-authoritative and not legal advice. Deterministic gameplay remains independent of AI.
- Verified legal corpus/data: minimal fictional seed only (one internal educational summary is marked verified; statutory entries are explicit placeholders). No real legal corpus ingested; no statutory provision, judgment or citation has been fabricated or presented as verified.
- Legal source verification workflow: **complete, but corpus-blocked.** `docs/LEGAL_SOURCE_VERIFICATION.md` defines the content-owner checklist and sign-off process; `src/domain/sourceValidation.ts` + `npm run validate:sources` deterministically gate records (required provenance, named reviewer/date, official URL and reviewed allowlist for specific citations). No real corpus exists yet; the allowlist is empty and D-005/D-011 remain blocked on a legal content owner.
- Legal corpus manifest pipeline: **ready with internal educational corpus; official external corpus still blocked.** `docs/legal-corpus/manifest.json` contains 4 original internal educational summaries (non-authoritative, no fabricated real statutes/judgments/citations/procedural rules). `ACQUISITION_CHECKLIST.md` and hardened validation/CLI remain in place. Template remains rejected by design (`--template` exits 1). No real/official legal source ingested.
- Visual assets: CSS/SVG placeholder compositions plus **13 original in-repo SVG assets** under `public/assets/art/` with explicit provenance comments and a real non-template `docs/art-pipeline/asset-manifest.json` (self-attested, no third-party assets). `npm run validate:art-manifest` passes for the real manifest; template still rejected. No licensed/external art imported; D-002/D-012/D-018 human owner approval still required before treating art as final signed-off production assets.
- P0 hardening (PR1–PR5, commits `58f1118`→`45df4e3`): canonical case truth is **stripped from persisted saves** and rehydrated from the seed on load; save failures surface explicit status instead of silently "saving"; locked assignments show **why they are locked**; chapter integrity prevents contradictory progression; the final in-game day shows a warning; drafted briefs and A2 auto-review stay coherent; reset/replay and draft autosave work in place; empty/disabled actions cannot be fired; panels keep keyboard focus; the completion screen shows the career payoff; notebook entries are capped. All of this is covered by deterministic tests — no browser or screen-reader audit is claimed.

## Quick start

```bash
npm install

# One-command local gate (lint, format, types, 301 tests, production build):
npm run verify

# Or run the steps individually:
npm run typecheck
npm run lint
npm run format:check
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

# Validate the Phase 5 art manifest (real in-repo original manifest + template rejection):
npm run validate:art-manifest -- docs/art-pipeline/asset-manifest.json
# Prove the shipped art template is NOT an approved manifest (expected exit code 1):
npm run validate:art-manifest -- --template
```

## Continuous integration

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, the deterministic offline corpus gate (`npm run validate:sources -- --seed` and a check that the corpus template is rejected with exit 1), a check that the Phase 5 art manifest template is rejected with exit 1, and `npm run build` on every push and pull request. This is the same set of checks as the local `npm run verify` script plus the two template-rejection gates, kept as separate CI steps so each gate is individually visible; CI was deliberately left unchanged when `verify` was added. It uses Node 22 (LTS), `npm ci` with the npm cache enabled, and read-only permissions; there is no deploy or publish step. The workflow becomes active once this repository is connected to a GitHub remote with Actions enabled (there is currently no remote configured).

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

The feasible P0 scope is complete; see [`docs/COMPLETION-REPORT.md`](./docs/COMPLETION-REPORT.md) for evidence and handoff. Next external steps: assign the legal content owner and add real, human-verified legal sources with official provenance (D-005/D-011 — the workflow/tooling and checklist are ready, but the owner must supply and sign off exact text; intake and the validator never verify on their own), decide art style/rights/licence and approve assets (D-002/D-012/D-018), broaden the first chapter (courtroom procedure / 30-day expansion), revisit runtime AI (Phase 6) and the ADR-001 DB deviation, and add accessibility/visual QA in a real browser when one is available — while maintaining >2 GB available storage.
