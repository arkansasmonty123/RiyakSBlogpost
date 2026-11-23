# AGENTS.md — THE INVESTIGATION

Autonomous agent instructions and architecture entry points for this repository.

## Project type
- Backend: Express + TypeScript + raw SQL (`src/`, `migrations/`, `scripts/`).
- Frontend: React 19 + Vite (`frontend/src/`).

## Canonical stack
- Backend port: `3000` (`npm run dev-server`)
- Frontend port: `5173` (`npm run dev`)

## Development workflow
```bash
# Install (root monorepo with frontend workspace)
npm install

# Frontend dev (HMR on 5173)
npm run dev

# Backend dev (API on 3000)
npm run dev-server

# Backend build
npm run build

# Backend tests
npm run typecheck
npm run test:smoke     # DB-backed, requires local Postgres
npm run test:http      # spawns API, runs HTTP smoke

# Frontend build
cd frontend && npm run build
```

## Canonical schema / DB notes
- Migrations are raw SQL in `migrations/` and are canonical. Do not use Drizzle/Prisma artifacts.
- `scripts/ci-schema.sql` / `scripts/ci-seed.sql` are CI-only bootstrap snapshots.
- Local dev DB: PostgreSQL 15+ socket-based auth for the CLI user.

## Key files
- `src/server.ts` — API entry point
- `src/app.ts` — backend app factory (preferred for tests)
- `src/db.ts` — DB pool + raw-SQL data layer
- `frontend/src/App.tsx` — routes
- `frontend/src/api.ts` — API client
- `PRD.md` / `PROD-*.md` — product docs (kept as historical records)

## Rules for agents
- No destructive operations without approval.
- Keep API contracts (`frontend/src/api.ts`) stable unless the user explicitly asks.
- Do not hardcode secrets; use `.env.example`.
- CI should pass before merging to `dev` or `main`.

## Git workflow
- `main` — production/stable (protected)
- `dev` — development branch (base for PRs)
- Branches should be created from `dev`
