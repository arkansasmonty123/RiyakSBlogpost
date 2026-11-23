# Architecture Plan - The Negotiation Table

> **Status**: Implemented MVP baseline (2026-11-23).  
> **Sources**: `PRD.md`, `ROADMAP.md`, `DECISIONS.md`, implemented code.

## 1. Goals / boundaries

- Deliver PRD MVP: case select, two-sided briefing, preparation, static negotiation room, debrief, basic cross-case skills.
- Keep project < 500MB including node_modules. No 3D/animation/browser binaries in repo.
- LLM never sole authority over game state. Deterministic engine validates all state transitions.
- Deterministic fallbacks are first-class and explicitly labeled.

## 2. System shape

Single Node/TypeScript service with Vite React client.

```
src/
  client/    React UI (Vite)
  server/    Express API, SQLite persistence, engine, AI orchestration
  shared/    TypeScript domain contracts (types.ts, ai.ts)
tests/       Vitest unit/integration/API/hardening
data/        negotiation.db (gitignored)
```

## 3. Shared contracts (`src/shared/`)

- `types.ts`: case/participant/briefing/preparation, session/message/offer, agreement/outcome, debrief/skill summaries, session counters (`turnCount`, `llmCalls`, `stateVersion`).
- `ai.ts`: structured AI response schema (intent, text, optional offer terms, target, metadata).

All API DTOs are derived from shared types. Briefing DTOs exclude `participantPrivate`, hidden reveals, and secret-only fields.

## 4. Deterministic engine (`src/server/engine/`)

Authority over:
- Offer/counteroffer/accept/reject/withdraw validation and tracking.
- Agreement validation: terms must be engine-validated; chat "I accept" text alone cannot create agreement.
- Commitment/concession/trust/credibility updates.
- Walk-away/finalize/outcome determination.
- Debrief facts: objectives met, concessions, unresolved issues, key moments, mistakes/opportunities, hidden reveals, decision quality vs outcome quality, evidence-based skill assessment.

Engine exposes pure/controlled functions; API route handlers call engine and persist resulting state.

## 5. AI simulation layer (`src/server/ai/`)

- `provider.ts`: provider abstraction (OpenAI/Gemini/local OpenAI-compatible) from env; no keys hardcoded.
- `context.ts`: builds character context (persona, goals, constraints, knowledge boundaries, relationship/power info, visible transcript/state summary).
- `orchestrator.ts`: selects responders, requests structured output, maps intents to engine events.
- `fallback.ts`: deterministic fallback when LLM unavailable/fails/malformed/over budget/timeout. Labeled as deterministic in API/UI.

Guards: `MAX_LLM_CALLS_PER_SESSION`, `LLM_TIMEOUT_MS`, structured-output parsing/coercion, malformed-output recovery. LLM may suggest intent/text; engine validates any state-changing action.

## 6. Persistence (`src/server/db/`)

- SQLite via `node:sqlite`.
- `PRAGMA user_version` migrations in code.
- Tables cover cases/sessions/messages/preparation/offers/agreements/skill-tracking as needed by MVP.
- DB path configurable by `NEGOTIATION_DB_PATH`; default `data/negotiation.db` gitignored.

## 7. API (`src/server/app.ts`)

Key endpoints:
- `GET /api/cases`, `GET /api/cases/:id/briefing`
- `POST /api/sessions`, `GET /api/sessions/:id`, `POST /api/sessions/:id/activate`
- `PUT /api/sessions/:id/preparation`
- `POST /api/sessions/:id/messages` (player message -> AI orchestration -> engine events)
- `POST /api/sessions/:id/offers`, `POST /api/sessions/:id/walk-away`, `POST /api/sessions/:id/finalize`
- `GET /api/sessions/:id/debrief`, `GET /api/skills`

Safety: no auth layer (MVP) - sessions are accessed by UUID route key (treat as capability URL; do not share). State/version guards (`expectedStateVersion` on mutating endpoints), idempotency where appropriate, in-process per-session turn lock, in-memory per-IP rate limits on mutating endpoints, structured validation, dependency-free security headers, opt-in CORS allowlist, no secret leakage in briefing DTOs. Single-instance MVP only.

## 8. Frontend (`src/client/`)

- React 19 + Vite + TypeScript.
- Views: CaseSelect, Briefing, Preparation, Room, Debrief, Skills.
- Static room: CSS-composed meeting table, participant portraits/cards, group chat, target selector, structured offer builder, walk-away/finalize controls.
- Responsive mobile/desktop; basic a11y (labels, focus, live regions/status where appropriate, reduced-motion friendly).
- Fallback responses visibly labeled "Deterministic fallback".

## 9. Case content (`src/server/cases/`)

Three distinct MVP cases:
- **The Acquisition** - startup acquisition; anchoring, leverage, info management, bluff detection, conditional offers.
- **The Fragile Peace** - multi-party diplomatic negotiation; alliances, coalition, competing interests.
- **The Walkout** - management/labor strike negotiation; skepticism, emotional intelligence, power dynamics, creative agreements.

Each has 4-5 participants with distinct persona, objectives, constraints, private knowledge, relationships/power structure, and multiple plausible outcomes.

## 10. Verification

- `npm run typecheck` - client+server TS.
- `npm test` - Vitest (engine, cases, AI fallback, API, hardening, smoke).
- `npm run build` - Vite client + server TS build.
- CI: `.github/workflows/ci.yml` (Node 26, typecheck/test/build).
- Manual smoke/E2E: Playwright browser smoke previously captured (13/13 pass, 1440x900 + 375x812) during MVP audit pass. Live LLM E2E requires provider credentials.

## 11. Known MVP limits

- Live LLM end-to-end depends on env credentials; deterministic fallback is default/verified.
- In-memory rate limit and in-process turn lock are single-instance only.
- No bearer/capability token auth implemented. Session IDs are UUID route keys; suitable for local single-player MVP but not hardened multi-user identity. Production would need authn/authz and shared rate-limit/lock infrastructure.
- No deployment/push performed by agent. Operator handles env/TLS/hosting decisions.