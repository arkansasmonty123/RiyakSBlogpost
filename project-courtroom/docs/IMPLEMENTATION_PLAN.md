# THE BAR — Phased Implementation Plan

**Date:** 2026-11-22 (updated 2026-11-23, PR6 final pass)  
**Status:** Phase 0 complete; **P0 complete for the feasible local scope** (PR1–PR5 hardening at HEAD `45df4e3`; Phases 1–5 implemented under ADR-001 size-conscious deviations; Phase 6 not started). Blocked items remain owned by humans — see [`COMPLETION-REPORT.md`](./COMPLETION-REPORT.md).  
**Primary reference:** [`../THE_BAR_MASTER_CONTEXT.md`](../THE_BAR_MASTER_CONTEXT.md)  
**Companion docs:** [`AUDIT.md`](./AUDIT.md), [`DECISIONS.md`](./DECISIONS.md), [`PROJECT_INFO.md`](./PROJECT_INFO.md), [`QA_CHECKLIST.md`](./QA_CHECKLIST.md)

## Current implementation snapshot (evidence-based)

- **Stack (ADR-001 deviation):** Vite + React + TS + Tailwind, localStorage save, deterministic stubs. No Next.js/Postgres/Prisma (deferred by size/complexity; recorded).
- **Verification baseline (2026-11-23):** `npm run verify` PASS (exit 0) — runs `npm run lint` (ESLint 9 flat config), `npm run format:check` (Prettier 3), `npm run typecheck`, `npm test` PASS (**263/263, 32 files**) and `npm run build` PASS. CI workflow present (`.github/workflows/ci.yml`) runs the same checks plus deterministic template-rejection gates. No browser/axe audit is claimed.
- **Implemented:** Day 1–10 playable slice, 12-char cast, 2 locations/8 viewpoints, case truth separation + no-leak guards, evidence discovery/review/custody/challenge, assignments, drafting+version history, deterministic senior review/final brief, completion summary + Legal Mind Profile (lite), journal/timeline, theory board, source intake/provenance/validation/CLI, corpus manifest pipeline (`docs/legal-corpus/`, `validateCorpusManifest`, `npm run validate:legal-corpus`), CSS/SVG scene art, onboarding/help, save v1→v2 migration, typed env/config validation, bounded append-only audit log in save, draft art-direction/provenance doc, **art asset pipeline scaffold** (`docs/art-pipeline/`, `validateArtManifest`, `npm run validate:art-manifest`, template + intake placeholders, deterministic tests). **P0 hardening (PR1–PR5):** canonical truth stripped from persisted saves and rehydrated from seed on load; failure-safe save status; lock-reason guidance; chapter integrity; final-day warning; draft/A2 submission coherence; reset/replay and draft autosave in place; disabled empty actions; panel focus retention; career payoff on completion; capped notebook. All covered by deterministic tests; see `docs/COMPLETION-REPORT.md`.
- **Not implemented / blocked / in-progress:** real verified legal corpus remains metadata-only for official sources (no provision/judgment text; citation-specific review pending), runtime AI provider/RAG production (Phase 6 foundations only), **ADR-001 DB infra started** (SQLite node:sqlite + transactional save/audit repository + minimal API scaffold; localStorage still default client path; Postgres/Prisma/normalized schema/auth still deferred), full 30-day chapter content depth, courtroom hearings, final licensed/external art sign-off (D-002/D-012/D-018), real-browser/axe a11y matrix in CI (deterministic SSR a11y smoke added; no real-browser axe matrix).

## Planning principles

- **Inspect before changing; preserve working behavior.** Once code exists, do not regress it.
- **Incremental, testable vertical slices.** No big-bang implementation.
- **Deterministic rules separate from AI generation.** AI suggests; deterministic systems validate and commit state.
- **Canonical truth separation.** Canonical truth, character knowledge, player knowledge, allegations, admissible/reliable material, and unresolved ambiguity must be separate.
- **Verified legal sources only.** No fabricated statutes, judgments, citations, or procedural rules. Provenance/version/effective date required.
- **Schema-validated AI outputs.** All runtime AI outputs validated against schemas and game rules before use.
- **Mobile-first, accessible, transactional.** Important state changes use transactions; UI is responsive and accessible.
- **No false "done".** A feature is done only when implemented and tested.

---

## Phase 0 — Decisions, Repo Bootstrap, Source of Truth

**Status:** ✅ **COMPLETE (2026-11-22)** — bootstrap/docs/decision baseline established. Early P0 prototype work has also started under recorded pragmatic defaults; that does not invalidate Phase 0 completion.

**Objective:** Establish a safe, reviewable foundation and resolve blocking unknowns.

| Work item                                          | Deliverable                                                              | Owner (suggested)          | Dependencies          | Exit criteria                            | Status / Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------- | --------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commit master context in repo                      | `THE_BAR_MASTER_CONTEXT.md` in repo                                      | Orchestrator/DevOps        | None                  | Present and referenced by docs           | ✅ Copied into repo; referenced by README/docs                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Initialize git + basic hygiene                     | `.gitignore`, README, license decision                                   | DevOps                     | None                  | Clean repo, no secrets tracked           | ✅ Git initialized, `.gitignore`, `README.md`; license decision still open (D-018, non-blocking for Phase 0)                                                                                                                                                                                                                                                                                                                                                                        |
| Record §22 decisions                               | `docs/DECISIONS.md` with owners/status/dates                             | Product/Architect          | Stakeholder input     | All blockers have status                 | ✅ §22 questions recorded; D-001/003/004/009/015 pragmatically resolved for P0, others explicitly Unknown/Deferred with owners/impact                                                                                                                                                                                                                                                                                                                                               |
| Create ADRs                                        | Stack, platform, runtime AI, legal provenance, art pipeline, secrets/env | Architect                  | Decisions             | ADRs accepted/deferred explicitly        | ✅ ADR-000/001/002 added; legal provenance/art pipeline/runtime AI still need dedicated ADRs before related implementation phases                                                                                                                                                                                                                                                                                                                                                   |
| Set up project workflow (optional but recommended) | Project memory/recovery files if autonomous workflow used                | Orchestrator               | Decision              | Clear task/state tracking                | ⚠️ Optional — not created as separate project-management system; git history + docs used as lightweight tracking                                                                                                                                                                                                                                                                                                                                                                    |
| Define legal-source policy                         | Verification, provenance, citation, update workflow                      | Legal Research + Architect | Legal access decision | Policy documented before legal ingestion | ⚠️ Baseline guardrails documented and P0 deterministic provenance + Source Intake workflow implemented (placeholder/unverified drafts, no auto-verification, citation guard, forged-flag demotion). Corpus manifest pipeline/tooling added (`docs/legal-corpus/`, `validateCorpusManifest`, `npm run validate:legal-corpus`); only a rejected template shipped. Formal human verification authority/versioning policy for a real corpus still needed before ingestion (D-005/D-011) |

**Exit criteria check:** Source-of-truth docs in repo ✅; decision log present ✅; assumptions recorded as Unknown/Deferred/Accepted-pragmatic ✅. Remaining open items are tracked in `docs/DECISIONS.md` and do not block Phase 0 closure.

---

## Phase 1 — Technical Foundation (Thin Skeleton)

**Status:** ⚠️ **Mostly complete (ADR-001 deviation)** — runnable prototype foundation exists; DB/ORM deferred; Prettier formatting and a minimal ESLint flat config now in place.

| Work item                          | Deliverable                                                 | Dependencies      | Exit criteria                                    | Status / Evidence                                                                                                                                                                                                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------- | ----------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scaffold selected stack            | App boots locally                                           | Phase 0 ADRs      | Dev server/build pass                            | ✅ Vite+React+TS+Tailwind scaffold; `build`/`dev`/`preview` scripts pass                                                                                                                                                                                                                                   |
| TypeScript/lint/format/test setup  | Tooling configs + scripts                                   | Scaffold          | `typecheck`, `lint`, `test`, `format:check` pass | ✅ `typecheck` PASS, `lint` PASS (ESLint 9 flat config `eslint.config.js`: `@eslint/js` + `typescript-eslint` recommended + `react-hooks`/`react-refresh`; `lint:fix` available), `test` PASS (263), `format:check` PASS (Prettier 3 via `.prettierrc`/`.prettierignore`; `npm run format`/`format:check`) |
| SQLite/DB persistence + migrations | DB schema baseline, migration workflow                      | Stack/DB decision | Fresh DB reproducible                            | ⚠️ Started (ADR-001): Node built-in `node:sqlite`, `server/db/*` schema/migrations/transactional repository + audit events + minimal HTTP API, `npm run db:server`. localStorage remains default client path; Postgres/Prisma/normalized schema/auth/client adapter migration still pending.               |
| Env/secrets/config                 | `.env.example`, config validation                           | Scaffold          | No secrets hardcoded; config validated           | ✅ `src/config/env.ts` reads optional `VITE_*` values with safe defaults, validates known values (AI stays disabled), never exposes the API key; `.env.example` aligned; 5 tests                                                                                                                           |
| CI baseline                        | CI workflow for lint/typecheck/format/test                  | Git + scripts     | CI green on clean checkout                       | ✅ `.github/workflows/ci.yml` runs npm ci/typecheck/lint/format:check/test/build on push/PR (Node 22). No remote run verified yet                                                                                                                                                                          |
| Domain boundaries                  | Module folders/contracts for player/world/cases/legal/ai/ui | Scaffold          | Clear boundaries, no premature microservices     | ✅ `src/domain/*`, `src/storage/*`, `src/app/*` modular separation; deterministic domain modules present                                                                                                                                                                                                   |

**Deviation note:** ADR-001 chose Vite+React+TS+Tailwind+localStorage for P0 size-consciousness; Next.js/Postgres/Prisma remain future candidates.

---

## Phase 2 — Core Domain Model & Persistence

**Status:** ⚠️ **Mostly complete for P0 prototype (localStorage model)** — core models/boundaries/tests exist; DB transactions/audit log deferred.

| Work item                    | Deliverable                                                                                                    | Dependencies    | Exit criteria                                        | Status / Evidence                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Player profile/career state  | Player, career stage, game-only progression                                                                    | Phase 1         | Save/load works; tests pass                          | ✅ `PlayerProfile`, career stage, reputation; save/load in localStorage with migration                                                                                                                                                                                                                                                                                             |
| In-game clock                | World clock, time advance, schedule hooks                                                                      | Phase 1         | Deterministic time advance tests                     | ✅ Day/slot clock, advanceTime, Day 1–10 cap, deterministic tests                                                                                                                                                                                                                                                                                                                  |
| Character model              | Identity, role, personality, goals, schedule, knowledge boundaries                                             | Phase 1         | CRUD + boundary tests                                | ✅ 12 characters with role/goals/knowledge boundaries/portraits; boundary-respecting dialogue tests                                                                                                                                                                                                                                                                                |
| Relationship/memory model    | Multidimensional relationships + event memories                                                                | Character model | Specific events remembered; no single-score shortcut | ✅ Multidimensional relationships, clamped updates, memory events in save/tests                                                                                                                                                                                                                                                                                                    |
| Case truth model             | Canonical truth, character knowledge, player knowledge, allegations, admissible/reliable, unresolved ambiguity | Phase 1         | **No-leak tests** pass                               | ✅ `CaseFile` separation; `toPlayerCaseView`/`assertNoCanonicalTruthLeak`; SSR smoke/no-leak tests                                                                                                                                                                                                                                                                                 |
| Evidence model               | Evidence type, provenance, authenticity, discoverability, chain/admissibility metadata                         | Case model      | Evidence access/visibility tests                     | ✅ Evidence types/provenance/discovery/review/assessment/challenge/custody; authenticity hidden                                                                                                                                                                                                                                                                                    |
| Legal source model           | Source, citation, version/effective date, verification status, label type                                      | Phase 1         | Provenance required; no fabricated seed citations    | ✅ `LegalSource` provenance/verification model, intake workflow, validation/CLI, no fabricated verified citations                                                                                                                                                                                                                                                                  |
| Transactional mutation/audit | Service layer + transactions + audit/event log                                                                 | Domain models   | Important state changes atomic/audited               | ⚠️ Partial: deterministic state updates + bounded append-only audit log in save (`src/domain/audit.ts`, player-safe, capped at 100, migrated/sanitized on load) covering save, draft submit, assignment/senior review, evidence discover/review/challenge/custody, source intake and final brief; 6 tests. **Remaining:** formal DB transactions (deferred with ADR-001 DB choice) |

---

## Phase 3 — Minimal Content & Verified Legal Seed

**Status:** ⚠️ **Partially complete** — playable fictional content exists; real verified legal corpus blocked.

| Work item               | Deliverable                                                       | Dependencies          | Exit criteria                                | Status / Evidence                                                                                                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------- | --------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fictional firm/district | One firm, core locations metadata                                 | Phase 2               | Seeded, consistent world IDs                 | ⚠️ Partial: fictional firm/chamber/reception/consultation context exists in scenes/seed; formal district/firm metadata model still light                                                                                         |
| Core cast               | 8–12 characters (can start with 3–5 active in slice)              | Phase 2               | Character sheets + relationships seeded      | ✅ 12 characters with roles/goals/boundaries/relationships/interactions                                                                                                                                                          |
| Principal case          | Disputed altercation case with stable canonical truth             | Phase 2               | Case coherent; truth stable after activation | ✅ "The Canteen Altercation" with append-only canonical truth, evidence, allegations, ambiguities                                                                                                                                |
| Smaller assignments     | 1–3 research/drafting assignments                                 | Case model            | Assignments playable in loop                 | ✅ 8 assignments across Day 1–10 flow (fact matrix through final brief/review)                                                                                                                                                   |
| Verified legal sources  | Only required BNS/BNSS/BSA/Const provisions, verified/provenanced | Legal policy + access | Every citation has provenance or is blocked  | ❌ Blocked (D-005/D-011): no official verifiable corpus ingested. Placeholder/unverified records + validation workflow and corpus manifest pipeline exist (template rejected by design); no fabricated citations marked verified |
| Player notebook         | Notes/provisions/case summaries/mistakes/feedback                 | Phase 2               | Persisted and searchable                     | ✅ Notebook entries (note/fact/research/feedback/theory-related flows), filters, evidence/journal linkage                                                                                                                        |

---

## Phase 4 — Core Gameplay Loop (Deterministic First)

**Status:** ✅ **Mostly complete for P0 prototype** — core loop playable end-to-end; AI critique still stubbed.

| Work item                   | Deliverable                                                              | Dependencies | Exit criteria                                                   | Status / Evidence                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------ | ------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Dialogue/interaction system | Structured choices + limited free-form input; memory-aware state updates | Phase 2/3    | Deterministic tests for state changes                           | ✅ Day-gated dialogues/events, choice effects, memory/relationship/reputation updates, knowledge-boundary tests              |
| Evidence discovery          | Inspect/interview/request exam/challenge authenticity/custody (minimal)  | Phase 2/3    | Discovery updates player knowledge only                         | ✅ Discover/review, custody log, admissibility/reliability challenge, contradiction/corroboration notes; authenticity hidden |
| Legal research flow         | Search/browse verified sources, attach to notes/case theory              | Phase 3      | No unverified authority presented as authoritative              | ✅ Research panel, source intake, provenance badges, notebook add, citation guard; real verified corpus still blocked        |
| Drafting workspace          | Editable legal artifact with version/save                                | Phase 2      | Draft persisted; version history                                | ✅ Draft textarea, version snapshots with day/slot/timestamp, load prior version, capped history                             |
| Evaluation/feedback         | Deterministic rubric + senior feedback; optional AI critique behind flag | Phase 3      | Feedback explains strengths/weaknesses; no fabricated citations | ✅ Deterministic senior review/final brief feedback, citation guard blocking; **AI critique stubbed/not integrated**         |
| Consequences                | Career/relationship/reputation updates via deterministic rules           | Phase 2      | State changes transactional and tested                          | ✅ Reputation/relationship/memory/assignment progression consequences; completion profile                                    |

---

## Phase 5 — Illustrated 2D Scene Prototype

**Status:** ⚠️ **Prototype complete, art pipeline scaffold ready** — scene architecture validated; a11y basics hardened with a deterministic SSR smoke gate and a documented QA matrix; the process/tooling scaffold (`docs/art-pipeline/`, manifest template, offline validator, intake placeholders) is implemented and tested, but **no asset has been imported or approved** — final art/assets/style guide and real-browser/axe audit still pending on D-002/D-012/D-018 and named owner sign-off.

| Work item                      | Deliverable                                                  | Dependencies         | Exit criteria                          | Status / Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------ | -------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scene system                   | Viewpoint/background/hotspot/transition model                | Phase 1              | Scene data-driven and persisted        | ✅ `src/domain/scenes.ts` data-driven locations/viewpoints/hotspots; selected viewpoint persisted in save                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| First chamber prototype        | 4 viewpoints, 5 hotspots, 1 character, multiple expressions  | Art assets + Phase 4 | Playable on desktop/mobile widths      | ✅ Exceeded minimum: 2 locations, 8 viewpoints, many hotspots, 12 characters with portrait states; CSS/SVG placeholder art (no external image assets)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Hotspot interactions           | Detail view/dialogue/document/navigation actions             | Phase 4              | All hotspots functional and accessible | ✅ Hotspots trigger navigation/dialogue/panel/time actions; accessible buttons/labels                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Art direction/asset provenance | Style guide, character refs, palette, asset licenses/origins | Phase 0 decision     | Assets documented and rights clear     | ⚠️ Draft `docs/ART_DIRECTION.md` (placeholder style guide, character/environment rules, palette, provenance checklist) plus **art pipeline scaffold ready (2026-11-23)**: `docs/art-pipeline/README.md` (naming/specs/formats/budgets/approval flow), `asset-manifest.template.json` (rejected by design), `validateArtManifest` + `npm run validate:art-manifest` with deterministic tests, `public/assets/art/.gitkeep` + `intake/{draft,approved}/.gitkeep`, `.gitignore` binary gating, CI template-rejection check. **Remaining/blocked:** approved final style (D-002), rights/originality policy (D-012), content/asset licence (D-018), named owner/reviewer, real manifest, reference sheets and any licensed/original asset pack — no assets imported or approved |     |
| Responsive/accessibility       | Keyboard/focus/labels/contrast/mobile layout                 | UI scaffold          | Basic a11y checks pass                 | ✅ Deterministic gate added: semantic landmarks, single `h1`, skip link, focus-visible, labelled controls/forms, `aria-pressed/expanded/current`, polite live feedback, reduced motion, mobile layouts; `src/tests/a11ySmoke.test.tsx` (5 SSR tests) checks accessible names + resolving ARIA targets across every panel, and `docs/QA_CHECKLIST.md` records the QA matrix. Browser matrix smoke (390×844 / 1440×900, no console errors) previously observed; full axe/screen-reader audit still not in CI (known gap)                                                                                                                                                                                                                                                      |

---

## Phase 6 — Runtime AI & Legal RAG (Guarded)

**Status:** ⏸️ **Not started** — deterministic guardrail foundations exist; runtime AI intentionally stubbed/disabled.

| Work item                | Deliverable                                                        | Dependencies         | Exit criteria                           | Status / Evidence                                                                                                                |
| ------------------------ | ------------------------------------------------------------------ | -------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| AI provider abstraction  | Configurable adapter (local/hosted/disabled)                       | Phase 0 decision     | App runs with AI disabled               | ⚠️ Partial: app runs with AI disabled/stubbed; no formal provider adapter interface yet                                          |
| Role interfaces          | Character/evaluation first; others later                           | Phase 4              | Clear contracts per role                | ❌ Not started                                                                                                                   |
| RAG over verified corpus | Retrieval with provenance/version/effective date                   | Phase 3 legal corpus | Retrieved sources traceable             | ❌ Blocked by D-005/D-011 (no verified corpus)                                                                                   |
| Deterministic validation | Citation/date/provision/evidence-access/schema checks              | Phase 2/3            | Fabricated/invalid outputs blocked      | ⚠️ Partial foundations: citation guard, source validation, no-leak guards, deterministic rules; no AI output schema pipeline yet |
| Cost/latency controls    | Event-driven calls, caching, summaries, routing                    | AI integration       | No per-click LLM calls; budgets/logging | ❌ Not started                                                                                                                   |
| Safety red-team tests    | Truth leakage, citation fabrication, knowledge-boundary violations | All above            | Tests/guardrails catch known bad cases  | ⚠️ Partial: truth-leak/citation/knowledge-boundary tests exist for deterministic flows; AI red-team tests not started            |

---

## Phase 7 — P1 First Chapter Expansion

**Objective:** Expand stable P0 into richer first chapter.

**Candidates:** Courtroom system, opposing counsel, client management, multiple cases, ethics, reputation, personal life (if decided), specialisations, Legal Mind Profile.

**Exit criteria:** Each feature behind flag/incremental PR, tested, no P0 regression, no legal-fabrication/truth-leakage regressions.

---

## Phase 8 — P2/P3 Long Horizon

**Objective:** Full legal world and experiments after P1 maturity.

**Candidates:** Firm ownership/finances depth, advanced litigation/appeals, higher courts, rival firms, larger verified corpus, evolving legal events; experiments (multiplayer, player firms, moot court, UGC, more jurisdictions).

**Gate:** Separate ADR/go-no-go, legal/compliance review, content ops capacity, and performance/cost review.

---

## Proposed P0 vertical slice (first build target)

**Name:** _The First Brief — Office Prototype_

**Included:**

- One fictional firm, one senior chamber + adjacent transition.
- 3–5 active characters from planned 8–12 cast.
- 7–10 in-game days playable (subset of 30-day chapter).
- One small research assignment + one principal criminal case introduction.
- Canonical truth boundaries enforced.
- 3–5 evidence interactions; player notebook.
- One editable draft artifact + deterministic feedback; optional AI critique behind flag.
- Save/load + in-game clock + basic relationship/memory updates.
- 1 illustrated scene: 4 viewpoints, 5 hotspots, 1 character with expression variants.

**Excluded from first slice:** full courtroom hearings, firm economy, advanced litigation, large legal corpus, multiplayer, romance/personal life (unless explicitly decided), local on-device model optimization.

**Success criteria:**

- Fresh setup runs locally.
- End-to-end slice playable.
- Save/load and clock deterministic.
- No canonical truth leakage in tests.
- No fabricated legal citations displayed.
- AI can be disabled without breaking core loop.

---

## Dependencies & blockers

| Blocker                                                                                                            | Impact                                      | Needed from         | Phase blocked |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ------------------- | ------------- |
| Target platform decision                                                                                           | Packaging/UI/AI/runtime constraints         | Product owner       | 0/1/5/6       |
| Runtime AI provider/model availability                                                                             | AI features, cost, latency, local inference | Product/Eng         | 4(opt)/6      |
| Verified legal source access/licensing                                                                             | Legal corpus, citations, RAG                | Legal/content owner | 3/4/6         |
| Art style + asset rights/pipeline (D-002/D-012/D-018; pipeline scaffold ready, decisions + owner sign-off pending) | Scene prototype and consistency             | Product/design      | 5             |
| Personal life/romance scope                                                                                        | Content/system scope                        | Product owner       | 7             |
| Practice area after first case                                                                                     | Content roadmap                             | Product owner       | post-P0       |

---

## Verification strategy (applies across phases)

- **Unit tests:** deterministic rules, state transitions, validators, schema parsing.
- **Integration tests:** DB persistence, transactions, save/load, API/domain boundaries.
- **E2E tests:** core gameplay loop and scene interactions.
- **Guardrail tests:** citation fabrication, truth leakage, knowledge-boundary violations, schema rejection.
- **Content validation:** provenance checks, case coherence checks, no unverified authoritative citations.
- **Accessibility checks:** keyboard/focus/labels/contrast/mobile responsiveness.
- **Release gate:** no feature marked done without implementation + tests + docs update.
