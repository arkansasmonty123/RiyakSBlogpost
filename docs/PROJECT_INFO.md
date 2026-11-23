# THE BAR — Project Information

## Summary

| Field                    | Value                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Project name**         | THE BAR                                                                                                                                                                                                                                                                                                                                                                     |
| **Type**                 | Immersive, persistent legal-career simulator (educational simulation)                                                                                                                                                                                                                                                                                                       |
| **Primary jurisdiction** | India (fictional firm/district/court environment initially)                                                                                                                                                                                                                                                                                                                 |
| **Repository**           | `/home/divyanshukumarsinha241/project-courtroom`                                                                                                                                                                                                                                                                                                                            |
| **Status**               | Phase 0 complete (2026-11-22). P0 prototype: "The First Brief — Office Prototype" (Vite + React + TS + Tailwind, localStorage), Day 1–10 playable slice, provenance/source-intake + deterministic corpus-validation workflow and corpus manifest pipeline with no auto-verification, CI workflow added. Real corpus still blocked on the legal content owner (D-005/D-011). |
| **Primary reference**    | [`../THE_BAR_MASTER_CONTEXT.md`](../THE_BAR_MASTER_CONTEXT.md)                                                                                                                                                                                                                                                                                                              |
| **Audit date**           | 2026-11-22                                                                                                                                                                                                                                                                                                                                                                  |

## Product vision

THE BAR combines five connected experiences:

1. **Career simulation** — employment, mentorship, reputation, finances, specialisation, promotion, independent practice, firm ownership, mentoring others.
2. **Legal academy** — learn actual Indian law through cases, assignments, research, drafting, and feedback.
3. **Case laboratory** — investigate incidents, examine evidence, interview witnesses, identify legal issues, construct theories.
4. **Courtroom simulation** — hearings, advocacy, objections, judicial questions, opposing counsel, litigation strategy.
5. **Living world** — persistent characters, institutions, relationships, schedules, goals, and events that continue independently of the player.

**Core design principle:** The player does not study law separately from the game. The player learns law because their career demands it.

## Disclaimer / boundary

THE BAR is an educational simulation, not legal advice and not a substitute for formal legal education, professional qualification, or supervised practice. Game progression must never imply that a player has become legally qualified in real life.

## Initial legal foundation (planned)

- Constitution of India
- Bharatiya Nyaya Sanhita (BNS)
- Bharatiya Nagarik Suraksha Sanhita (BNSS)
- Bharatiya Sakshya Adhiniyam (BSA)
- Later expansion: other central/state legislation and case law

All legal content must be verified, sourced, versioned, and dated. No fabricated statutory provisions, judgments, citations, or procedural rules.

## Implemented: provenance and source intake (P0)

- `LegalSource` records carry `sourceName`, `citation` (identifier), `sourceType`, `jurisdiction`, `verificationStatus`, a non-authoritative `provenance` note, and optional `sourceUrl`, `verificationDate`, `verifiedBy`, `effectiveDate`, `excerpt` and `notes`.
- Verification statuses are distinct: `verified` (traceable provenance plus a named human reviewer), `unverified` (drafted but not confirmed) and `placeholder` (explicit stand-in). Only `verified` sources with intact provenance can be cited as authoritative.
- The Research panel's **Source Intake / Add Source** flow creates only `unverified` or `placeholder` records. Deterministic validation blocks empty required fields, invalid enums/effective dates, self-verification requests, and forces citation-like strings (section numbers, `X v. Y`, reporter citations) into `placeholder` status with a non-authoritative warning.
- `markSourceVerified` is a separate human/content-owner step (named reviewer and traceable provenance required); it is not a player-facing auto-verify action. `checkDraftCitations` uses `canCiteAsAuthoritative`, so a forged `verified` flag without provenance is ignored. Save loading demotes such records.
- No real legal corpus has been ingested. The only verified seed record is an internal educational summary explicitly labeled non-statutory; statutory entries remain placeholders. No provision, judgment or citation has been fabricated or presented as verified.

## Implemented: source verification workflow / tooling (D-005/D-011)

- **Workflow complete, corpus blocked.** The content-owner checklist, sign-off log, required-field contract and acceptable-source rules are documented in [`LEGAL_SOURCE_VERIFICATION.md`](./LEGAL_SOURCE_VERIFICATION.md). No official text has been supplied or ingested; the reviewed-identifier allowlist is empty.
- `src/domain/sourceValidation.ts` provides deterministic `validateSourceRecord` / `validateSourceRecords`: required provenance fields, valid enums/dates/URLs, and a strict verified gate (named reviewer, review date, provenance, identifier, official URL for real-world authority). Specific-looking citations (`Section …`, `AIR …`, `<year> SCC`, `X v. Y`) are rejected as verified unless their identifier is in the human-reviewed allowlist. Placeholders can never be verified.
- `npm run validate:sources -- <corpus.json>` (or `-- --seed`) runs the same validator as an offline CLI with clear error codes and non-zero exit on failure. A safe shape template is at [`docs/examples/legal-sources.example.json`](./examples/legal-sources.example.json).
- **Corpus manifest pipeline ready, corpus blocked.** [`docs/legal-corpus/README.md`](./legal-corpus/README.md) defines the intake folder layout, manifest format and verification handoff. `validateCorpusManifest` (`src/domain/sourceValidation.ts`) plus `npm run validate:legal-corpus` validate manifest metadata and every source record with clear, position-labelled reporting. The shipped [`manifest.template.json`](./legal-corpus/manifest.template.json) is marked `template: true` and is **rejected by design** (`--template` exits 1); no real `manifest.json` exists and no official source has been ingested.
- `markSourceVerified` now applies this same strict gate as a separate human/content-owner step; the game and AI stubs never verify or fabricate sources.
- **Blocked follow-up:** assign the legal content owner (D-011), obtain official text and rights, and sign off real records before any verified real citation exists.

## Target first playable release (from master context)

- One fictional Indian law firm
- One fictional district
- 8–12 important characters
- One substantial principal case
- A few smaller assignments
- Approximately 30 in-game days
- Persistent player profile and career
- Dialogue, memory, and relationship systems
- Evidence discovery
- Legal research using verified material
- Drafting and evaluation
- Senior feedback
- Save/load and world clock
- One illustrated office location prototype

## Stack (P0 per ADR-001)

Implemented: **Vite + React + TypeScript + Tailwind**, localStorage persistence with v1→v2 migration, deterministic stubs (AI disabled). Next.js/Postgres/Prisma from the master context remain deferred pending a post-P0 re-evaluation.

## Repository layout (current)

```text
project-courtroom/
├── src/
│   ├── app/App.tsx              # UI shell + panels
│   ├── domain/                  # types, seed, guards, legalSources (provenance
│   │                            # + intake), sourceValidation (corpus gate),
│   │                            # access projection, progression, dialogue,
│   │                            # evidence, draft
│   ├── storage/save.ts          # localStorage load/persist + v1→v2 migration
│   └── tests/                   # vitest guardrail + smoke tests
├── scripts/
│   ├── validate-sources.ts      # offline corpus validator CLI
│   ├── validate-legal-corpus.ts # offline manifest validator CLI
│   └── node-shims.d.ts          # minimal Node ambient types (no @types/node)
├── README.md
├── THE_BAR_MASTER_CONTEXT.md
└── docs/
    ├── ADRs/
    │   ├── ADR-000-project-constraints.md
    │   ├── ADR-001-stack-and-size-conscious-foundation.md
    │   └── ADR-002-p0-vertical-slice.md
    ├── examples/
    │   └── legal-sources.example.json  # fictional shape template (not real law)
    ├── legal-corpus/
    │   ├── README.md            # intake pipeline docs + blocked status
    │   ├── manifest.template.json # TEMPLATE / NOT LEGAL AUTHORITY (rejected by CLI)
    │   └── intake/{unverified,reviewed}/.gitkeep
    ├── AUDIT.md
    ├── DECISIONS.md
    ├── IMPLEMENTATION_PLAN.md
    ├── LEGAL_SOURCE_VERIFICATION.md # D-005/D-011 checklist + sign-off log
    └── PROJECT_INFO.md
```

## Known constraints / non-negotiables

- Modular monolith first; no premature microservices.
- Deterministic game rules separate from AI generation.
- Canonical case truth separate from discovered player knowledge.
- Legal sources/versioning separate from generated explanations.
- Validate AI output schemas; persist structured state; transactions for important state changes.
- Mobile-first and accessible interface.
- Fiction and real-world legal information clearly labelled.
- No feature claimed working until implemented and tested.
- **Storage availability: keep >2 GB free** in home/project environment (D-019, corrected 2026-11-22). Avoid unnecessary bloat; clean reinstallable artifacts only when space is tight.

## Open questions

See [`DECISIONS.md`](./DECISIONS.md) for §22 open questions and decision tracking.
