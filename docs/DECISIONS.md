# THE BAR — Decisions & Open Questions

**Date:** 2026-11-22  
**Status:** Active decision log  
**Rule:** Do not silently assume answers. Record decision, owner, date, rationale, and consequences. If unknown, mark `Unknown` and define who must decide.

## Decision status legend

- `Proposed` — recommended, not approved
- `Approved` — approved for implementation
- `Deferred` — explicitly postponed
- `Unknown` — needs decision; blocks or risks scope
- `Rejected` — considered and not chosen

---

## 1. Open questions from master context (§22)

| ID | Question | Status | Owner | Target date | Impact | Notes / Recommendation |
|---|---|---|---|---|---|---|
| D-001 | Exact target platforms: mobile web first, installable PWA, native app, or desktop? | Accepted (pragmatic default) | Orchestrator/Product owner | 2026-11-22 | High — affects stack packaging, UI, storage, AI runtime | Mobile-first web, PWA-friendly later; desktop usable. Revisit if native required. |
| D-002 | Initial visual art style: realistic illustration, stylised realism, graphic novel, or another direction? | Unknown | Product/design | Before Phase 5 | Medium — affects asset pipeline and consistency | Pick one style guide before producing scene assets. Placeholder composed UI used for P0 shell. |
| D-003 | Which runtime model/provider will be available in the first playable build? | Accepted (pragmatic default) | Orchestrator/Product owner | 2026-11-22 | **High** — runtime AI features depend on it | AI-disabled deterministic stub for P0; provider abstraction required before real integration. No local model bundled (size budget). |
| D-004 | Is local on-device inference required for first release or later optimisation? | Deferred (P0) | Product/Eng | Post-P0 | High — model size, packaging, latency, battery, cost | Deferred for P0 due to capability/packaging uncertainty; prefer hosted/external model pack later. Keep >2GB available. |
| D-005 | How much real legal content can be sourced, licensed, and verified for first release? | Unknown | Legal/content owner | Before Phase 3 | **Critical** — no fabrication allowed | Start with minimal verified corpus needed for first case; document provenance. P0 provenance schema + Source Intake now exist, but **no real legal text has been ingested**; intake never verifies. Cannot resolve until the content owner supplies official text. |
| D-006 | Which practice area should follow the initial criminal case? | Unknown | Product/content | Post-P0 | Low/Medium — roadmap only | Defer until P0 validated. |
| D-007 | Should personal life and romance be included in first chapter or deferred? | Unknown | Product owner | Before Phase 7 scope lock | Medium — scope/ethics/tone risk | Recommend defer from P0/P1 unless core to chapter. |
| D-008 | What is the initial repository's actual stack and current implementation status? | Resolved (audit) | Orchestrator | 2026-11-22 | High — baseline for planning | Repo is empty/greenfield; no stack or implementation. |

---

## 2. Additional foundation decisions needed

| ID | Decision | Status | Owner | Target date | Impact | Recommendation |
|---|---|---|---|---|---|---|
| D-009 | Confirm initial tech stack (Next.js/TS/Tailwind/Postgres/Prisma candidate) | Accepted (P0 variant) | Orchestrator/Product owner | 2026-11-22 | High | P0 uses size-conscious Vite+React+TS+Tailwind with localStorage persistence and deterministic stubs (ADR-001). Postgres/Prisma/Next.js deferred/re-evaluated post-P0 or when budget allows. |
| D-010 | Git/init workflow and branching/CI policy | Unknown | DevOps/Eng | Before Phase 1 | Medium | Initialize git, protect main, CI required for typecheck/tests. |
| D-011 | Legal source verification workflow and provenance schema | Partially implemented (P0 deterministic schema/intake); owner workflow still Unknown | Legal Research + Architect | Before Phase 3 | **Critical** | Provenance fields, verification statuses (verified/unverified/placeholder), non-authoritative excerpt labeling and Source Intake validation implemented in `src/domain/legalSources.ts` + Research panel. Human verification is a separate domain step (`markSourceVerified`), not a player action; no auto-verification. Still needs a legal-owner decision on the real verification/review process and versioning policy before any real corpus is ingested. |
| D-012 | Art asset rights/licensing/originality policy | Unknown | Product/Design/Legal | Before Phase 5 | High | Use licensed/original assets only; track provenance. |
| D-013 | Runtime AI safety/validation policy | Proposed | Architect/Security | Before Phase 6 | **Critical** | Schema validation, citation validation, knowledge-boundary checks, no-fabrication guardrails, AI-disable fallback. |
| D-014 | Data persistence/save format and migration strategy | Proposed | Architect | Before Phase 2 | High | PostgreSQL as source of truth; migrations versioned; transactional state changes. |
| D-015 | Scope of first playable vertical slice | Accepted (pragmatic default) | Orchestrator/Product owner | 2026-11-22 | **Critical** | Adopt "The First Brief — Office Prototype" (ADR-002). Initial scaffold created; full slice still in progress. |
| D-016 | Personal data/privacy/logging policy (future user data) | Unknown | Product/Legal/Eng | Before any user accounts/telemetry | High | Minimize data; no secrets in logs; define retention if accounts added. |
| D-017 | Localization/language scope (English only first?) | Unknown | Product | Before UI content scale | Medium | Recommend English-first UI with content architecture allowing localization later. |
| D-018 | Licensing for game code/content/assets | Unknown | Product/Legal | Before public release | Medium | Decide repo license and content/asset licenses separately. |
| D-019 | Storage availability: keep >2 GB free in home/project environment | Accepted (user direction, corrected) | Product owner / Architect | Active now | **High** — environment/storage constraint | Corrected 2026-11-22: available storage in home/project environment should be >2 GB. Previously misrecorded as total <1.5 GB; corrected per user. Audit with `df -h /home` and `du -sh /home/divyanshukumarsinha241` at checkpoints. |

---

## 3. Assumptions to avoid (explicit)

- Do **not** assume runtime AI/provider is available.
- Do **not** assume legal sources are freely usable without verification/licensing.
- Do **not** assume master context features exist in code.
- Do **not** assume local on-device inference is required for v1.
- Do **not** assume art can be generated without rights/style review.
- Do **not** assume personal-life/romance is in scope for P0.
- Do **not** assume stack is final until ADR approved.

---

## 4. Decision record template

Use this for future entries:

```md
### D-XXX — Title
- **Date:** YYYY-MM-DD
- **Status:** Proposed | Approved | Deferred | Unknown | Rejected
- **Owner:** 
- **Context:** 
- **Decision:** 
- **Rationale:** 
- **Alternatives considered:** 
- **Consequences / follow-up:** 
- **Verification:** 
```

## 5. Initial decision log

### D-008 — Initial repository baseline
- **Date:** 2026-11-22
- **Status:** Approved (audit fact)
- **Owner:** Orchestrator
- **Context:** Master context §21 required repository audit before implementation.
- **Decision:** Treat `project-courtroom` as an empty greenfield repository; no existing features to preserve.
- **Rationale:** `ls/find/git status` showed no files, no git repo, no tooling, no implementation.
- **Alternatives considered:** Assume prior prototype exists — rejected due to no evidence.
- **Consequences / follow-up:** All product capabilities are missing; start with Phase 0 decisions and foundation.
- **Verification:** Evidence captured in `docs/AUDIT.md`.

### D-019 — Storage availability > 2 GB (Cloud Shell aware)
- **Date:** 2026-11-22 (corrected; Cloud Shell strategy added 2026-11-22)
- **Status:** Accepted (user direction)
- **Owner:** Product owner / Orchestrator
- **Context:** User corrected constraint to "available storage should be greater than 2 gb". Environment is Google Cloud Shell: `$HOME` is a 5 GB persistent disk; VM filesystem outside `/home` (including `/tmp`) is ephemeral overlay and discarded on session end (verified via `df -h`/`mount` and Google Cloud docs).
- **Decision:** Maintain >2 GB available on `/home`. Keep persistent source/config/docs in `$HOME`; place re-downloadable/heavy artifacts outside `$HOME` on ephemeral storage (e.g. `/tmp/opencode/...`) with symlinks/config: `node_modules`, npm cache, Playwright browsers, pip/build caches, model weights.
- **Rationale:** Preserves persistent 5 GB home disk while allowing large re-downloadable tooling.
- **Alternatives considered:** Keep everything in `$HOME` — rejected (hits 5GB limit). Strict total <1.5 GB — rejected after correction.
- **Consequences / follow-up:** After session restart, re-install/re-symlink ephemeral artifacts. Monitor `df -h /home`. Configure `npm config set cache /tmp/opencode/npm-cache`; set `PLAYWRIGHT_BROWSERS_PATH` when needed.
- **Verification:** `df -h /home /`; `mount`; ADR-000.