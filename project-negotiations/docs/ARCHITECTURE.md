# Architecture - The Negotiation Table

> **Status**: MVP release-readiness (2026-11-23). Grounded in current code.

## Overview

Single Node/TypeScript service: Express API + SQLite persistence + deterministic negotiation engine + AI simulation layer, with a React/Vite client. In production, Express serves `dist/client`.

```
src/
  client/    React 19 + Vite UI (5-phase flow)
  server/    Express API, node:sqlite DB, engine, AI orchestration, case content
  shared/    TypeScript contracts (types.ts, ai.ts) - safe for client import
tests/       Vitest: smoke, cases, engine, api, hardening, ai-fallback, concurrency, release-hardening, llm-e2e (opt-in)
docs/        PRD, architecture, testing, deployment, release checklist, decisions
```

## Core invariant

**LLM suggests; deterministic engine validates.** The AI layer may propose text/intent/structured offer terms, but all state-changing actions (offers, accept/reject/withdraw, agreement validation, trust, walk-away, finalize, debrief) are validated/applied by the engine. Chat text like "I accept" never creates an agreement by itself.

## Shared contracts (`src/shared/`)

- `types.ts`: domain model, session/offer/event/debrief/skill DTOs, `SessionView`, `CaseBriefing`. Client-safe only.
- `ai.ts`: `AIProvider`, structured generation request/result, `ParticipantResponse` with explicit `source: 'llm' | 'deterministic_fallback'`.

**Secret boundary**: `CaseBriefing`/API DTOs exclude `participantPrivate`, hidden reveals, reservations/ideal internals, and other secret-only fields. Hidden reveals appear only in post-completion debrief.

## Deterministic engine (`src/server/engine/`)

- `index.ts`: session lifecycle, turn application, offer handling, trust adjustments, event/message recording, `stateVersion` increment, `expectedStateVersion` guard support.
- `agreement.ts`: `validateAgreement` - checks required parties, required issues, term ranges, player/opposing reservations, participant issue limits, acceptances. Engine is sole authority.
- `scoring.ts` / `debrief.ts`: outcome determination, decision-quality vs outcome-quality separation, evidence-based skill assessment, concept lessons/prediction calibration.
- `utils.ts`: term validation, intent detection, concession detection; free text never creates numeric terms.

## AI simulation (`src/server/ai/`)

- `provider.ts`: `createProvider()` from env. Supports OpenAI-compatible endpoints (`openai`, `gemini`, `local`/`ollama`). No key => `DeterministicProvider` (explicit fallback). No secrets hardcoded.
- `context.ts`: builds per-participant character context (persona, goals, secrets, constraints, relationships, known facts, BATNA/reservation, trust, transcript window, open offer). Server-only; never serialized to client DTOs.
- `orchestrator.ts`: selects meaningful responders (not all participants every turn), enforces `MAX_LLM_CALLS_PER_SESSION` budget and `LLM_TIMEOUT_MS`, parses structured JSON with Zod schema; malformed/mismatched/budget/timeout => deterministic fallback. `recordTurnMetadata` logs `turn_completed` and one-time `llm_degraded`.
- `fallback.ts`: deterministic, constraint-aware, clearly labeled responses.

## Persistence (`src/server/db/`)

- SQLite via built-in `node:sqlite` (`DatabaseSync`).
- `PRAGMA user_version` migrations in code; version 1 bootstrap. WAL attempted for file DBs.
- DB path: `NEGOTIATION_DB_PATH` (default `data/negotiation.db`, gitignored). `:memory:` supported for tests.
- Transactional snapshot save/load for sessions, messages, events, offers, preparation, debriefs, skill scores. Stable IDs enable idempotent upserts.

## API (`src/server/app.ts`)

- Express JSON API; serves built client in production.
- Guards: Zod request validation, session existence/phase checks, `expectedStateVersion` on mutating endpoints, in-process per-session turn lock, in-memory per-IP rate limits on mutating endpoints, 256kb body limit, dependency-free security headers, opt-in CORS allowlist (`FRONTEND_URL`/`ALLOWED_ORIGINS`).
- No auth layer in MVP. Session IDs are UUID route keys (treat as capability URL). No cookies/tokens.

## Frontend (`src/client/`)

- React 19, Vite, TypeScript. Views: CaseSelect, Briefing, Preparation, Room, Debrief, Skills.
- Static meeting-room composition (CSS/SVG/images; no 3D/animation stack). Group chat, target selector, structured offer builder, walk-away/finalize.
- Deterministic fallback responses visibly labeled. Responsive/a11y baseline (labels, focus, live regions, reduced motion, forced-colors considerations).

## Known MVP limits

- **No auth/multi-user identity**. UUID session route key only; do not expose publicly without auth.
- **Single-instance only**. In-memory rate limits and process-local turn lock do not coordinate across instances.
- **Live LLM E2E env-dependent**. Deterministic fallback is default and verified.
- **Zod 3->4 major upgrade** was applied to fix GHSA-mrhx-c7xc-m3w5; regression verified. Keep dependencies audited.
- **No public deployment without explicit approval**. Operator owns TLS/proxy/CORS/origins/secrets/observability/backups.