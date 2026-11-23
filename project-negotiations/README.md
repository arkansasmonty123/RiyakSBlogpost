# The Negotiation Table

AI-powered negotiation simulation where players negotiate with distinct AI participants in a realistic static meeting room. Built as an MVP focused on real negotiation behavior, deterministic game-state authority, and evidence-based debriefs.

## Status

**Release-readiness hardening in progress** (2026-11-23)
- `npm run typecheck` PASS
- `npm test` PASS (41 passed, 2 skipped opt-in LLM E2E, 9 files)
- `npm run build` PASS
- `npm audit --omit=dev` 0 vulnerabilities
- Project size: ~100M (<500MB constraint)

## Quick start

```bash
cd project-negotiations
npm install

# Terminal 1: API (http://localhost:3001)
npm run dev

# Terminal 2: Client (http://localhost:5173, /api proxied)
npm run dev:client
```

Production build:

```bash
npm run build
npm start   # serves API + dist/client on PORT (default 3001)
```

## Environment

Copy `.env.example` to `.env` as needed.

| Var | Default | Purpose |
|---|---:|---|
| `PORT` | `3001` | Server port |
| `NEGOTIATION_DB_PATH` | `data/negotiation.db` | SQLite DB path (gitignored) |
| `LLM_PROVIDER` | unset | `openai` / `gemini` / `local` / OpenAI-compatible; unset = deterministic fallback |
| `LLM_API_KEY` | unset | Provider API key (also supports `OPENAI_API_KEY`/`GEMINI_API_KEY`) |
| `LLM_MODEL` | provider default | Model name |
| `LLM_URL` | provider default | Base URL for OpenAI-compatible/local endpoints |
| `MAX_LLM_CALLS_PER_SESSION` | `40` | LLM budget guard |
| `LLM_TIMEOUT_MS` | `8000` | LLM timeout |

If no LLM key/provider is configured, the app uses a **deterministic fallback** that is explicitly labeled in the UI and never presented as LLM output.

## What’s included (MVP)

- **3 cases**: The Acquisition, The Fragile Peace, The Walkout (4-5 participants each, distinct contexts/interests/outcomes).
- **5-phase flow**: Case Select → Two-Sided Briefing → Preparation → Negotiation Room → Debrief.
- **Two-sided briefing** with `verified/reported/unknown` info classification; no hidden secrets leaked before debrief.
- **Preparation**: objectives, BATNA, reservation point, opening position, leverage, concessions, questions, predictions, strategy.
- **Negotiation room**: static realistic meeting room, participant portraits, group/targeted chat, natural-language messages, structured offer/counteroffer/accept/reject/withdraw, walk-away.
- **Deterministic game engine**: authoritative over offers, agreements, commitments, trust/credibility, outcomes, debrief. LLM is never sole authority.
- **Debrief**: outcome, objectives met, concessions, unresolved issues, trust changes, key moments, mistakes/missed opportunities, hidden reveals (post-completion), alternative approaches, skill assessment with evidence. Decision quality separated from outcome quality.
- **Cross-case skills**: basic skill tracking endpoint/view.

## Architecture

- `src/client/` - React + Vite UI
- `src/server/` - Express API, SQLite persistence, deterministic engine, AI orchestration
- `src/shared/` - shared types/contracts
- `tests/` - vitest unit/integration/API/hardening tests
- `docs/` - PRD, design, architect plan, decisions, conversation history

Key rule: **LLM suggests; engine validates.** Structured offer terms are engine-validated; free text never creates numeric terms.

## Scripts

```bash
npm run dev          # server watch (tsx)
npm run dev:client   # vite dev server
npm run typecheck    # client + server TS
npm test             # vitest
npm run build        # vite build + server tsc
npm start            # run compiled server
```

## Constraints / notes

- Project kept under **500MB** (node_modules dominate; no browser binaries in repo).
- SQLite via built-in `node:sqlite`.
- Deterministic fallback is first-class; live LLM E2E depends on env credentials.
- Local Ollama (Cloud Shell/CPU): set `LLM_PROVIDER=local`, `LLM_URL=http://127.0.0.1:11434/v1/chat/completions`, `LLM_MODEL=qwen3.5:0.8b` (or 2b), `LLM_TIMEOUT_MS=120000`. On 2-core CPU expect slow inference; keep fallback as reliable baseline.
- Single-process in-flight lock for MVP; multi-instance would need shared locking.

## Docs

- `PRD.md` - product requirements
- `ROADMAP.md` - execution roadmap
- `docs/ARCHITECTURE.md` - accurate architecture and limits
- `docs/ARCHITECT-PLAN.md` - implementation plan (historical/baseline)
- `docs/DESIGN.md` - design contract
- `docs/TESTING.md` - test commands and real LLM E2E procedure
- `docs/DEPLOYMENT.md` - deployment/operator hardening
- `docs/RELEASE-CHECKLIST.md` - reproducible release checklist
- `DECISIONS.md` - key decisions
