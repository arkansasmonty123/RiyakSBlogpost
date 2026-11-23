# Decisions - The Negotiation Table

## D-001 - Project scope and constraints (2026-11-23)
- **Decision**: Build "The Negotiation Table" as a new project in `project-negotiations/`, active workspace focus.
- **Constraints**: Project directory must stay under **500 MB** (including node_modules). No unnecessary deps, no heavy browsers/assets, no 3D/animation stacks.
- **Rationale**: User explicit constraint; MVP must be lightweight and deployable.

## D-002 - Architecture direction (2026-11-23, proposed)
- **Frontend**: Vite + React + TypeScript. Static realistic room via composed CSS/SVG/images (no 3D). Group-chat UI.
- **Backend**: Node + Express + TypeScript. Single service serving API; Vite dev proxy; production can serve built frontend.
- **Persistence**: SQLite (better-sqlite3 or libsql) for local/lightweight persistence; schema/migrations in repo. Avoids Postgres dependency and keeps footprint small.
- **AI**: Provider abstraction with structured outputs; deterministic fallback when LLM unavailable/fails/malformed. LLM is never sole authority over game state.
- **Game engine**: Deterministic TypeScript module for offers, commitments, agreement validation, trust/credibility, objectives, outcome scoring.
- **Testing**: Vitest for unit/integration; Playwright only if already available/system-installed - avoid downloading browsers into project.

## D-003 - MVP boundaries (2026-11-23)
- Include: case selection, two-sided briefing, preparation, static negotiation room, distinct AI participants, natural-language group chat, offers/counteroffers, structured negotiation state, agreement/consequence handling, detailed debrief, basic cross-case skill tracking.
- Exclude for now: multiplayer, elaborate career progression, complex campaigns, 3D rooms, animated characters, medieval settings, complicated reputation systems, excessive gamification, unnecessary social features.

## D-004 - Rate limiting (2026-11-23)
- **Decision**: Added simple in-memory per-IP/per-session rate limits for session creation and message endpoints.
- **Rationale**: Basic abuse/cost guard for MVP; no new deps.
- **Limitation**: In-memory only, resets on restart; single-instance assumption.

## D-005 - Recovery incident (2026-11-23)
- **Decision**: Restored wiped backend from builder context and hardened with M0 guards/migrations.
- **Rationale**: Concurrent subagent work wiped backend files; recovery preserved contracts and added hardening.
