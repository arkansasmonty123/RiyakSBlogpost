# RiyakSBlogpost

A monorepo of AI-powered training simulations and the tooling that supports them. Each `project-*` directory is an independent application with its own dependencies, documentation and checks.

> The original blog concept that gave the repository its name is retained in the legacy `backend/`, `Frontend/` and `src/` directories. Active development happens in the `project-*` directories below.

## Projects

| Project | What it is | Status | Key entry points |
|---|---|---|---|
| [`project-investigation/`](project-investigation/README.md) | AI investigation / human-intelligence training simulation with knowledge, reality-map, perspective and living-world systems | Complete (M8), maintenance mode | `PRD.md`, `IMPLEMENTATION_STATUS.md`, `src/server.ts`, `frontend/` |
| [`project-negotiations/`](project-negotiations/README.md) | **The Negotiation Table** — negotiation practice with a deterministic, authoritative game engine and labeled AI fallback | Release-ready MVP (deterministic mode); real-LLM E2E is an external blocker | `PRD.md`, `docs/`, `src/server/`, `src/client/` |
| [`project-courtroom/`](project-courtroom/README.md) | Courtroom / legal reasoning simulation | In development | `THE_BAR_MASTER_CONTEXT.md`, `server/`, `src/` |
| [`project-management/`](project-management/DEV-STATUS.md) | Orchestration state, delivery status, decisions and recovery procedures (not an application) | Active process docs | `DEV-STATUS.md`, `TASKS.md`, `ORCHESTRATION-STATE.json` |

## Prerequisites

- Node.js 20+ and npm (CI currently uses Node 26)
- A local PostgreSQL instance is required only by `project-investigation` for its smoke tests (see that project's README)

## Quick start

Each project manages its own dependencies. Install per project before running commands.

### The Negotiation Table

```bash
cd project-negotiations
npm install
npm run dev           # API on :3001
npm run dev:client    # client on :5173

# Production-style single process
npm run build && npm start
```

Checks: `npm run typecheck`, `npm test`, `npm run build`.

### Investigation simulation

```bash
cd project-investigation
npm install
npm run dev:backend   # API
npm run dev:frontend  # client
```

Checks: `npm run ci` (typecheck, DB smoke, HTTP tests, frontend build). The full `npm test` runs the complete validator and smoke suite and expects a seeded local database.

### Courtroom simulation

```bash
cd project-courtroom
npm install
npm run dev           # Vite client
npm run db:server     # API server
```

Checks: `npm run verify` (lint, format check, typecheck, tests, build).

## Repository layout

```
.
├── project-investigation/   # Investigation training simulation
├── project-negotiations/    # Negotiation Table simulation
├── project-courtroom/       # Courtroom simulation (in progress)
├── project-management/      # Delivery status, decisions, recovery
├── backend/ Frontend/ src/  # Legacy blog scaffold
├── .github/workflows/       # Repository-level CI
├── AGENTS.md                # Repository working rules
├── SETUP-GUIDE.md           # Environment and autonomous setup guide
└── CONTRIBUTING.md          # Contribution conventions
```

## Tooling

`project-courtroom/` is integrated via a `git subtree` merge, so its original commit history is preserved in this repository. The nested working copy keeps its own `.git` directory locally; changes made there must be committed and re-merged into this repository to appear here.

This workspace uses local agent and tooling configuration that is intentionally versioned so the setup is reproducible:

- `AGENTS.md` — repository working rules (read before making changes)
- `opencode.jsonc` — agent/MCP configuration
- `.opencode/agents/`, `.opencode/skills/` — specialist agent definitions and skills
- `SETUP-GUIDE.md` — full environment and recovery instructions
- `project-management/RECOVERY.md` — session recovery protocol

Files under `.cache/`, `.cce/`, `.gemini/`, `.serena/`, `.planning/` and similar directories are local tool state and should never be treated as project source.

## Continuous integration

- `.github/workflows/ci.yml` — repository-level workflow, currently verifies `project-investigation`
- Each active project also carries its own workflow under `<project>/.github/workflows/`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: keep changes scoped to one project, never commit secrets or runtime artifacts, and run that project's checks before submitting changes.

## License

License is not yet declared for this repository. Confirm the intended license before publishing or sharing publicly.
