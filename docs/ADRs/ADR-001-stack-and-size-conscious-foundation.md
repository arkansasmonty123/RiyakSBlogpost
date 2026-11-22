# ADR-001 — Size-Conscious Foundation Stack (P0)

- **Status:** Accepted (pragmatic default; revisit post-P0)
- **Date:** 2026-11-22
- **Owners:** Orchestrator (under user-granted autonomy)
- **Related decisions:** D-001, D-003, D-004, D-009, D-015, D-019

## Context

Master context §20 suggests Next.js App Router, TypeScript, Tailwind, PostgreSQL, Prisma. The home/project has a hard <1.5 GB total footprint limit (D-019). Current home usage after cleanup is ~915M; a typical Next.js+Prisma+Postgres local setup plus deps can exceed the remaining budget.

## Decision

For P0 prototype, use a **size-conscious web stack**:

- **App:** Vite + React + TypeScript (lighter dev footprint than full Next.js for P0)
- **Styling:** Tailwind CSS (utility-first, small source footprint)
- **Persistence (P0):** SQLite via lightweight driver/ORM or direct SQL; file-based, no separate DB server. Design data access behind interfaces so Postgres/Prisma can be adopted later.
- **Runtime AI:** Provider abstraction with **AI-disabled deterministic stub** default; no local model bundled.
- **Platform target:** Mobile-first web (PWA-friendly later), desktop usable.
- **Assets:** Optimized WebP/PNG placeholders; no audio/video; no bundled large model packs.

## Alternatives considered

- Next.js + Postgres + Prisma now — rejected for P0 due to footprint/ops overhead under 1.5GB; revisit in Phase 1+ if budget allows or deps cleaned after install.
- No build tool/plain HTML — rejected; too limiting for scene state/component architecture.
- Native app first — rejected; higher packaging complexity, unclear requirement.

## Consequences

- Faster, smaller P0 iteration; easier to stay under 1.5GB.
- Migration path needed if/when moving to Next.js/Postgres/Prisma.
- Must keep domain boundaries clean so persistence/UI stack can evolve.
- After `npm install`/build verification, heavy reinstallable dirs may be cleaned to preserve budget; record restore commands.

## Verification / follow-up

- Track `du -sh /home/divyanshukumarsinha241` before/after install.
- Keep dependencies minimal; avoid heavy UI/AI packages in P0.
- Re-evaluate stack at Phase 1/2 boundary.