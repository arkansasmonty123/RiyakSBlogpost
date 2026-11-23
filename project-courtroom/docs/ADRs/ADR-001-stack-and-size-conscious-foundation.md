# ADR-001 — Size-Conscious Foundation Stack (P0)

- **Status:** Accepted (pragmatic default; revisit post-P0)
- **Date:** 2026-11-22
- **Owners:** Orchestrator (under user-granted autonomy)
- **Related decisions:** D-001, D-003, D-004, D-009, D-015, D-019

## Context

Master context §20 suggests Next.js App Router, TypeScript, Tailwind, PostgreSQL, Prisma. D-019 requires keeping >2 GB available in the home/project environment. The P0 stack should remain size-conscious and avoid unnecessary bloat.

## Decision

For P0 prototype, use a **size-conscious web stack**:

- **App:** Vite + React + TypeScript (lighter dev footprint than full Next.js for P0)
- **Styling:** Tailwind CSS (utility-first, small source footprint)
- **Persistence (P0):** SQLite via lightweight driver/ORM or direct SQL; file-based, no separate DB server. Design data access behind interfaces so Postgres/Prisma can be adopted later.
- **Runtime AI:** Provider abstraction with **AI-disabled deterministic stub** default; no local model bundled.
- **Platform target:** Mobile-first web (PWA-friendly later), desktop usable.
- **Assets:** Optimized WebP/PNG placeholders; no audio/video; no bundled large model packs.

## Alternatives considered

- Next.js + Postgres + Prisma now — deferred for P0 to keep setup lightweight; revisit when justified by requirements.
- No build tool/plain HTML — rejected; too limiting for scene state/component architecture.
- Native app first — rejected; higher packaging complexity, unclear requirement.

## Consequences

- Faster, smaller P0 iteration; size-conscious by default while maintaining >2 GB available storage.
- Migration path needed if/when moving to Next.js/Postgres/Prisma.
- Must keep domain boundaries clean so persistence/UI stack can evolve.
- After `npm install`/build verification, heavy reinstallable dirs may be cleaned to preserve budget; record restore commands.

## Verification / follow-up

- Track `du -sh /home/divyanshukumarsinha241` before/after install.
- Keep dependencies minimal; avoid heavy UI/AI packages in P0.
- Re-evaluate stack at Phase 1/2 boundary.

## 2026-11-23 infra start (implemented)

- **Started:** SQLite persistence scaffold using Node built-in `node:sqlite` (zero extra runtime deps), file-based DB at `data/the-bar.sqlite` (configurable by `THE_BAR_DB_PATH`).
- **Added:** `server/db/database.ts` (migrations/WAL/transactions), `server/db/repository.ts` (save slot upsert/get/list/delete + audit events, canonicalTruth stripped defensively), `server/api.ts` minimal HTTP API (`/api/health`, `/api/saves`, `/api/audit`), `server/index.ts`.
- **Dev wiring:** Vite proxy for `/api/saves|/api/health|/api/audit` to `127.0.0.1:8787`; `npm run db:server`.
- **Tests:** `server/db/repository.test.ts` (2 tests) passing under full verify.
- **Still deferred:** Postgres/Prisma migration, normalized schema for all entities, auth/multi-user, client-side API storage adapter default switch, production deployment. localStorage remains the active client persistence path until adapter migration is completed and verified.
