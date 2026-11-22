# THE BAR — Project Information

## Summary

| Field | Value |
|---|---|
| **Project name** | THE BAR |
| **Type** | Immersive, persistent legal-career simulator (educational simulation) |
| **Primary jurisdiction** | India (fictional firm/district/court environment initially) |
| **Repository** | `/home/divyanshukumarsinha241/project-courtroom` |
| **Status** | Phase 0 complete (2026-11-22). P0 prototype in progress: "The First Brief — Office Prototype" (Vite + React + TS + Tailwind, localStorage), Day 1–10 playable slice, 35/35 tests passing, CI workflow added. |
| **Primary reference** | [`../THE_BAR_MASTER_CONTEXT.md`](../THE_BAR_MASTER_CONTEXT.md) |
| **Audit date** | 2026-11-22 |

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
│   ├── domain/                  # types, seed, guards, access projection,
│   │                            # progression, dialogue, evidence, draft
│   ├── storage/save.ts          # localStorage load/persist + v1→v2 migration
│   └── tests/                   # vitest guardrail + smoke tests
├── README.md
├── THE_BAR_MASTER_CONTEXT.md
└── docs/
    ├── ADRs/
    │   ├── ADR-000-project-constraints.md
    │   ├── ADR-001-stack-and-size-conscious-foundation.md
    │   └── ADR-002-p0-vertical-slice.md
    ├── AUDIT.md
    ├── DECISIONS.md
    ├── IMPLEMENTATION_PLAN.md
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
