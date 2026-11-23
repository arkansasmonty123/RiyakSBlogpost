# Testing - The Negotiation Table

## Automated checks

Run from `project-negotiations/`:

```bash
npm run typecheck   # tsc client + server noEmit
npm test            # Vitest (9 files, 41 pass / 2 skip by default)
npm run build       # Vite client + server tsc
npm audit --omit=dev
```

### Test suites

| File | Focus |
|---|---|
| `tests/smoke.test.ts` | Basic smoke |
| `tests/cases.test.ts` | 3 cases, 4-5 participants, ZOPA/outcomes, briefing secret safety |
| `tests/engine.test.ts` | Engine authority, agreement validation, walk-away/finalize, debrief quality separation, concept lessons/prediction calibration |
| `tests/api.test.ts` | HTTP journey, validation, version guards, agreement/debrief/skills, walk-away |
| `tests/hardening.test.ts` | Migrations, counters/persistence/restart, state guards, idempotent skill IDs |
| `tests/ai-fallback.test.ts` | Deterministic fallback, malformed/timeout/budget resilience, labeling |
| `tests/concurrency.test.ts` | Per-session turn lock rejects concurrent turn; one commit |
| `tests/release-hardening.test.ts` | Security headers, CORS allowlist/preflight behavior |
| `tests/llm-e2e.test.ts` | **Opt-in real LLM E2E** - skipped unless `LLM_E2E=1` and provider configured; fails loudly if enabled without creds |

## Manual smoke / browser E2E

1. Build/start: `npm run build && npm start` (or dev servers).
2. Play through Case Select -> Briefing -> Preparation -> Room -> Debrief -> Skills.
3. Check desktop 1440x900, mobile 375x812, Android ~412x915.
4. Confirm no console/page errors, fallback labeling visible when no LLM, offers/counteroffers/walk-away/finalize work.

## Persistence/restart check

```bash
NEGOTIATION_DB_PATH=/tmp/neg-test.db npm run build && PORT=3199 NEGOTIATION_DB_PATH=/tmp/neg-test.db npm start
# create session, make progress, stop server (SIGTERM), restart with same env, GET /api/sessions/:id
# verify status/turnCount/stateVersion/messages/preparation preserved
```

## Real LLM E2E (opt-in, env-dependent)

**Current env status (2026-11-23): BLOCKED** - no `LLM_*`/provider env vars set, no local ollama/models. Do not fabricate a pass.

### Repro procedure (when credentials/runtime available)

```bash
# Example: OpenAI-compatible
LLM_E2E=1 LLM_PROVIDER=openai LLM_MODEL=gpt-4o-mini LLM_API_KEY=... \
  npx vitest run tests/llm-e2e.test.ts

# Example: local ollama
LLM_E2E=1 LLM_PROVIDER=local LLM_MODEL=qwen3.5:2b \
  LLM_URL=http://127.0.0.1:11434/v1/chat/completions LLM_TIMEOUT_MS=120000 \
  npx vitest run tests/llm-e2e.test.ts
```

The opt-in test asserts: distinct participants, LLM-sourced messages, source labeling, engine authority, fallback on malformed/timeout, and debrief lessons. It **fails loudly** if `LLM_E2E=1` but credentials/provider are missing.

### Manual real-LLM gameplay check

1. Configure env vars in `.env` (never commit secrets).
2. Start app, confirm `/api/health` reports `llm: true` or provider active.
3. Play at least one full case to completion.
4. Verify: participants respond in distinct voices; offers/questions/concessions/challenges handled coherently; AI cannot bypass engine agreement validation; UI labels AI vs deterministic fallback; debrief reflects actual decisions. Capture screenshots/logs.