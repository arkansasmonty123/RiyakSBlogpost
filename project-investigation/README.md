# THE INVESTIGATION

![CI](https://github.com/arkansasmonty123/RiyakSBlogpost/actions/workflows/ci.yml/badge.svg?branch=dev) ![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Frontend](https://img.shields.io/badge/frontend-React_19_%2B_Vite-blue.svg) ![Backend](https://img.shields.io/badge/backend-Express_%2B_TS-blue.svg)

Evidence-driven detective case game (alpha/beta): examine clues, interview suspects, and build a theory you can defend.

## Quick start

```bash
make install          # npm install (root workspace with frontend)

# Frontend (Vite, :5173)
make dev              # or: npm run dev:frontend

# Backend API (Express, :3000)
make dev-server       # or: npm run dev:backend

# Both in background
make dev-all
```

## Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for full setup, commands, and testing.

## Architecture

- Backend: Express + TypeScript + raw SQL (`src/`, `migrations/`, `scripts/`)
- Frontend: React 19 + Vite (`frontend/src/`)
- Canonical DB: PostgreSQL 15+ with socket auth for the current user (`psql -d investigation`)

## Tests

```bash
make ci               # backend typecheck + smoke + http, frontend build
npm run typecheck     # backend typecheck
npm run test:smoke    # DB-backed (requires Postgres)
npm run test:http     # spawns API and runs HTTP smoke
cd frontend && npm run build
```

## Migrations & validation

Migrations are raw SQL in `migrations/` (canonical). See `PROD-004-NOTES.md` in `docs/`.

## Links

- [AGENTS.md](AGENTS.md)
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- [docs/FRONTEND.md](docs/FRONTEND.md)

## License

MIT
