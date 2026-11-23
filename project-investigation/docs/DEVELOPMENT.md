# Development guide

## Setup

```bash
npm install
```

## Run the frontend

```bash
npm run dev
# http://localhost:5173
```

## Run the backend

The backend uses local socket auth for the current user. Make sure PostgreSQL is running.

```bash
npm run dev-server
# http://localhost:3000
```

## Test the backend

```bash
npm run typecheck
npm run test:smoke     # DB-backed (needs Postgres)
npm run test:http      # spawns API and runs HTTP smoke
```

## Test the frontend

```bash
cd frontend
npm run build
npm run lint
npm run dev
```

## Database (local dev)

Connect via socket using your current OS user:

```bash
psql -d investigation
```

See `scripts/seed-extra-cases.ts` and `scripts/seed-knowledge.ts` for seeding helpers.
