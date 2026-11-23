# Deployment - The Negotiation Table

> **No public deployment without explicit approval.** This MVP is single-instance and has no auth layer.

## Prerequisites

- Node.js 20+ (CI uses Node 26)
- Writable filesystem for SQLite DB (`NEGOTIATION_DB_PATH`)
- TLS termination/proxy (operator-managed)
- Secrets managed outside repo

## Build & run

```bash
cd project-negotiations
npm ci
npm run build
PORT=3001 NODE_ENV=production NEGOTIATION_DB_PATH=/var/lib/negotiation/negotiation.db npm start
```

Server serves API and `dist/client` on `PORT`.

## Environment variables

See `.env.example`. Do not commit secrets.

| Var | Required | Notes |
|---|---|---|
| `PORT` | no | default 3001 |
| `NODE_ENV` | prod recommended | `production` for deployment |
| `NEGOTIATION_DB_PATH` | recommended | persistent writable path; default `data/negotiation.db` |
| `FRONTEND_URL` | if CORS needed | canonical client origin |
| `ALLOWED_ORIGINS` | optional | comma-separated exact origins; overrides `FRONTEND_URL` |
| `LLM_PROVIDER` | optional | `openai`/`gemini`/`local`/`ollama`; unset => deterministic fallback |
| `LLM_API_KEY` | provider-dependent | also accepts `OPENAI_API_KEY`/`GEMINI_API_KEY`/`GOOGLE_API_KEY`; not required for local/ollama |
| `LLM_MODEL` | optional | provider default used if unset |
| `LLM_URL` | optional | OpenAI-compatible endpoint URL |
| `MAX_LLM_CALLS_PER_SESSION` | optional | default 40 |
| `LLM_TIMEOUT_MS` | optional | default 8000; increase for local CPU models |

## Security / operations checklist

- **TLS**: terminate HTTPS at proxy/load balancer; forward `X-Forwarded-*` as needed.
- **CORS/origin**: set `FRONTEND_URL`/`ALLOWED_ORIGINS` to exact trusted origins. Do not use wildcard with credentials.
- **Auth**: MVP has no auth. Sessions are UUID route keys (capability URLs). Add authn/authz before any multi-user/public exposure.
- **Rate limits**: in-memory per-process, mutating endpoints only. Single-instance assumption. Use proxy/WAF limits for public exposure; shared limiter for multi-instance.
- **Turn lock**: in-process per-session lock. Single-instance only.
- **Secrets**: env/secret manager only. Never log or commit keys.
- **DB persistence/backups**: persist `NEGOTIATION_DB_PATH` on durable volume; back up SQLite file with WAL-aware strategy; test restore.
- **Observability**: capture stdout/stderr, request logs, health checks (`GET /api/health`), process restart policy. Monitor LLM errors/timeouts/fallback rate.
- **Dependency hygiene**: run `npm audit --omit=dev` in CI/release; review major upgrades carefully.

## Limitations

- Single-player MVP, single-instance process model.
- No public deploy/push by agent. Operator sign-off required.