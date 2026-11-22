# THE BAR — Phased Implementation Plan

**Date:** 2026-11-22 (updated 2026-11-22)  
**Status:** Phase 0 complete; early P0 prototype implementation in progress (beyond Phase 0)  
**Primary reference:** [`../THE_BAR_MASTER_CONTEXT.md`](../THE_BAR_MASTER_CONTEXT.md)  
**Companion docs:** [`AUDIT.md`](./AUDIT.md), [`DECISIONS.md`](./DECISIONS.md), [`PROJECT_INFO.md`](./PROJECT_INFO.md)

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

| Work item | Deliverable | Owner (suggested) | Dependencies | Exit criteria | Status / Evidence |
|---|---|---|---|---|---|
| Commit master context in repo | `THE_BAR_MASTER_CONTEXT.md` in repo | Orchestrator/DevOps | None | Present and referenced by docs | ✅ Copied into repo; referenced by README/docs |
| Initialize git + basic hygiene | `.gitignore`, README, license decision | DevOps | None | Clean repo, no secrets tracked | ✅ Git initialized, `.gitignore`, `README.md`; license decision still open (D-018, non-blocking for Phase 0) |
| Record §22 decisions | `docs/DECISIONS.md` with owners/status/dates | Product/Architect | Stakeholder input | All blockers have status | ✅ §22 questions recorded; D-001/003/004/009/015 pragmatically resolved for P0, others explicitly Unknown/Deferred with owners/impact |
| Create ADRs | Stack, platform, runtime AI, legal provenance, art pipeline, secrets/env | Architect | Decisions | ADRs accepted/deferred explicitly | ✅ ADR-000/001/002 added; legal provenance/art pipeline/runtime AI still need dedicated ADRs before related implementation phases |
| Set up project workflow (optional but recommended) | Project memory/recovery files if autonomous workflow used | Orchestrator | Decision | Clear task/state tracking | ⚠️ Optional — not created as separate project-management system; git history + docs used as lightweight tracking |
| Define legal-source policy | Verification, provenance, citation, update workflow | Legal Research + Architect | Legal access decision | Policy documented before legal ingestion | ⚠️ Baseline guardrails documented (no fabrication, provenance/verification fields, placeholder blocking); formal ingestion/verification workflow still needed before real legal corpus ingestion (D-005/D-011) |

**Exit criteria check:** Source-of-truth docs in repo ✅; decision log present ✅; assumptions recorded as Unknown/Deferred/Accepted-pragmatic ✅. Remaining open items are tracked in `docs/DECISIONS.md` and do not block Phase 0 closure.

---

## Phase 1 — Technical Foundation (Thin Skeleton)

**Objective:** Runnable modular monolith with persistence, tests, and CI.

| Work item | Deliverable | Dependencies | Exit criteria |
|---|---|---|---|
| Scaffold selected stack | App boots locally | Phase 0 ADRs | Dev server/build pass |
| TypeScript/lint/format/test setup | Tooling configs + scripts | Scaffold | `typecheck`, `lint`, `test` pass |
| PostgreSQL + migrations/ORM | DB schema baseline, migration workflow | Stack/DB decision | Fresh DB reproducible |
| Env/secrets/config | `.env.example`, config validation | Scaffold | No secrets hardcoded; config validated |
| CI baseline | CI workflow for lint/typecheck/test | Git + scripts | CI green on clean checkout |
| Domain boundaries | Module folders/contracts for player/world/cases/legal/ai/ui | Scaffold | Clear boundaries, no premature microservices |

**Suggested candidate stack (unconfirmed):** Next.js App Router, TypeScript, Tailwind, PostgreSQL, Prisma.  
**Risks:** Picking stack before platform/AI decisions; over-engineering.  
**Verification:** CI green; fresh setup documented.

---

## Phase 2 — Core Domain Model & Persistence

**Objective:** Persist minimum vertical-slice state with strict truth boundaries.

| Work item | Deliverable | Dependencies | Exit criteria |
|---|---|---|---|
| Player profile/career state | Player, career stage, game-only progression | Phase 1 | Save/load works; tests pass |
| In-game clock | World clock, time advance, schedule hooks | Phase 1 | Deterministic time advance tests |
| Character model | Identity, role, personality, goals, schedule, knowledge boundaries | Phase 1 | CRUD + boundary tests |
| Relationship/memory model | Multidimensional relationships + event memories | Character model | Specific events remembered; no single-score shortcut |
| Case truth model | Canonical truth, character knowledge, player knowledge, allegations, admissible/reliable, unresolved ambiguity | Phase 1 | **No-leak tests** pass |
| Evidence model | Evidence type, provenance, authenticity, discoverability, chain/admissibility metadata | Case model | Evidence access/visibility tests |
| Legal source model | Source, citation, version/effective date, verification status, label type | Phase 1 | Provenance required; no fabricated seed citations |
| Transactional mutation/audit | Service layer + transactions + audit/event log | Domain models | Important state changes atomic/audited |

**Risks:** Truth leakage through API/UI; schema too rigid/too loose.  
**Verification:** Unit/integration tests for save/load, clock, truth boundaries, evidence visibility, provenance constraints.

---

## Phase 3 — Minimal Content & Verified Legal Seed

**Objective:** Author the first coherent playable content slice with verified legal grounding.

| Work item | Deliverable | Dependencies | Exit criteria |
|---|---|---|---|
| Fictional firm/district | One firm, core locations metadata | Phase 2 | Seeded, consistent world IDs |
| Core cast | 8–12 characters (can start with 3–5 active in slice) | Phase 2 | Character sheets + relationships seeded |
| Principal case | Disputed altercation case with stable canonical truth | Phase 2 | Case coherent; truth stable after activation |
| Smaller assignments | 1–3 research/drafting assignments | Case model | Assignments playable in loop |
| Verified legal sources | Only required BNS/BNSS/BSA/Const provisions, verified/provenanced | Legal policy + access | Every citation has provenance or is blocked |
| Player notebook | Notes/provisions/case summaries/mistakes/feedback | Phase 2 | Persisted and searchable |

**Risks:** Legal sourcing/licensing delays; accidental fabrication.  
**Verification:** Content validation tests; citation/provenance checks; legal review checklist.

---

## Phase 4 — Core Gameplay Loop (Deterministic First)

**Objective:** Deliver playable end-to-end loop without requiring advanced AI.

| Work item | Deliverable | Dependencies | Exit criteria |
|---|---|---|---|
| Dialogue/interaction system | Structured choices + limited free-form input; memory-aware state updates | Phase 2/3 | Deterministic tests for state changes |
| Evidence discovery | Inspect/interview/request exam/challenge authenticity/custody (minimal) | Phase 2/3 | Discovery updates player knowledge only |
| Legal research flow | Search/browse verified sources, attach to notes/case theory | Phase 3 | No unverified authority presented as authoritative |
| Drafting workspace | Editable legal artifact with version/save | Phase 2 | Draft persisted; version history |
| Evaluation/feedback | Deterministic rubric + senior feedback; optional AI critique behind flag | Phase 3 | Feedback explains strengths/weaknesses; no fabricated citations |
| Consequences | Career/relationship/reputation updates via deterministic rules | Phase 2 | State changes transactional and tested |

**Risks:** AI-first temptation; brittle evaluation.  
**Verification:** End-to-end test for "assignment → research → evidence → draft → feedback → consequence".

---

## Phase 5 — Illustrated 2D Scene Prototype

**Objective:** Validate §17 visual interaction architecture before scaling assets.

| Work item | Deliverable | Dependencies | Exit criteria |
|---|---|---|---|
| Scene system | Viewpoint/background/hotspot/transition model | Phase 1 | Scene data-driven and persisted |
| First chamber prototype | 4 viewpoints, 5 hotspots, 1 character, multiple expressions | Art assets + Phase 4 | Playable on desktop/mobile widths |
| Hotspot interactions | Detail view/dialogue/document/navigation actions | Phase 4 | All hotspots functional and accessible |
| Art direction/asset provenance | Style guide, character refs, palette, asset licenses/origins | Phase 0 decision | Assets documented and rights clear |
| Responsive/accessibility | Keyboard/focus/labels/contrast/mobile layout | UI scaffold | Basic a11y checks pass |

**Risks:** Inconsistent art; asset rights ambiguity; scene system too coupled to one room.  
**Verification:** Manual QA + UI tests/snapshots where useful; accessibility checklist.

---

## Phase 6 — Runtime AI & Legal RAG (Guarded)

**Objective:** Add runtime intelligence safely and optionally.

| Work item | Deliverable | Dependencies | Exit criteria |
|---|---|---|---|
| AI provider abstraction | Configurable adapter (local/hosted/disabled) | Phase 0 decision | App runs with AI disabled |
| Role interfaces | Character/evaluation first; others later | Phase 4 | Clear contracts per role |
| RAG over verified corpus | Retrieval with provenance/version/effective date | Phase 3 legal corpus | Retrieved sources traceable |
| Deterministic validation | Citation/date/provision/evidence-access/schema checks | Phase 2/3 | Fabricated/invalid outputs blocked |
| Cost/latency controls | Event-driven calls, caching, summaries, routing | AI integration | No per-click LLM calls; budgets/logging |
| Safety red-team tests | Truth leakage, citation fabrication, knowledge-boundary violations | All above | Tests/guardrails catch known bad cases |

**Risks:** Hallucinated legal authority; prompt injection through user text; cost spikes.  
**Verification:** Automated guardrail tests; manual adversarial checks; logs/metrics.

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

**Name:** *The First Brief — Office Prototype*

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

| Blocker | Impact | Needed from | Phase blocked |
|---|---|---|---|
| Target platform decision | Packaging/UI/AI/runtime constraints | Product owner | 0/1/5/6 |
| Runtime AI provider/model availability | AI features, cost, latency, local inference | Product/Eng | 4(opt)/6 |
| Verified legal source access/licensing | Legal corpus, citations, RAG | Legal/content owner | 3/4/6 |
| Art style + asset rights/pipeline | Scene prototype and consistency | Product/design | 5 |
| Personal life/romance scope | Content/system scope | Product owner | 7 |
| Practice area after first case | Content roadmap | Product owner | post-P0 |

---

## Verification strategy (applies across phases)

- **Unit tests:** deterministic rules, state transitions, validators, schema parsing.
- **Integration tests:** DB persistence, transactions, save/load, API/domain boundaries.
- **E2E tests:** core gameplay loop and scene interactions.
- **Guardrail tests:** citation fabrication, truth leakage, knowledge-boundary violations, schema rejection.
- **Content validation:** provenance checks, case coherence checks, no unverified authoritative citations.
- **Accessibility checks:** keyboard/focus/labels/contrast/mobile responsiveness.
- **Release gate:** no feature marked done without implementation + tests + docs update.