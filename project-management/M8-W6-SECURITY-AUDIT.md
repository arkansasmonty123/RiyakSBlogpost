# M8 Wave 6 - Security Audit

**Date**: 2026-11-24 (initial audit); 2026-11-24 (W6-S1 hardening resolutions)  
**Scope**: `project-investigation/` (read-only audit by security-auditor subagent; fixes by builder)  
**Baseline**: `npm test` PASS, `test:http` 127/127 PASS  
**Gate result**: **PASS WITH CONDITIONS** (no critical/high runtime issues; code-level conditions resolved by W6-S1. Remaining conditions are operator deploy-configuration responsibilities, documented below. No public deploy before W7 readiness.)

## Findings and resolutions

| ID | Severity | Area | Evidence | Impact | Resolution (W6-S1) | Status |
|---|---|---|---|---|---|---|
| F1 | medium | Cookie secure flag | `src/server.ts` session cookie uses `secure: process.env.NODE_ENV==='production'` | Cookie may be sent over HTTP if NODE_ENV misconfigured | Startup warning when NODE_ENV is not `production` (cookies not Secure); production startup log confirms Secure cookies. `.env.example` documents `NODE_ENV=production` + TLS termination requirement. | Resolved in code; deploy config is operator responsibility |
| F2 | medium | CSRF exposure | `sameSite:'lax'`, CORS credentials true | Cross-site POSTs may include cookie in some cases | Added lightweight `csrfOriginGuard` on POST/PATCH/PUT/DELETE: when Origin (or Referer fallback) is present it must match `FRONTEND_URL`, `ALLOWED_ORIGINS`, or the request's own Host; **requests with no Origin/Referer are allowed** (CLI/smoke/service clients). `sameSite:'lax'` retained. Toggle: `CSRF_ORIGIN_CHECK=false`. | Mitigated (defence in depth; not a full CSRF token) |
| F3 | medium | Rate-limit defaults generous | `AUTH_RATE_MAX=500`, `CHAT_RATE_MAX=120`, `WRITE_RATE_MAX=600`, dev-friendly | Weak protection if env not tightened | Production startup warnings for all three dev-friendly maxima and for `RATE_LIMIT_ENABLED=false`; `.env.example` gives strict suggested values. Dev defaults unchanged so smoke tests keep passing. | Resolved in code/docs; operator must tighten env values |
| F4 | low | Rate-limit fail-open on DB error | limiter catch logs and calls next() | Temporary burst during DB hiccup | No code change (fail-open is deliberate for availability). Requires production monitoring/alerting on `[rate-limit] store error` logs. | Open (accepted risk for beta; monitoring recommended) |
| F5 | medium | 10mb JSON body limit | `bodyParser.json({limit:'10mb'})` | Large payload DoS risk | Default lowered to **1mb** via `JSON_BODY_LIMIT` env (also applied to urlencoded). Body-parser errors now mapped to 413 / 400 / 415 instead of a generic 500. Verified: >1mb body rejected, normal payloads pass 127/127. | Resolved |
| F6 | medium (downgraded after verification) | Notification settings mass assignment claim | `updateNotificationSettings` normalizes allowlist (`developments` boolean only) | DB helper already allowlists; route forwards body but helper ignores unknown keys | No change needed; allowlist confirmed. Optional route-level key rejection remains a low-priority polish item. | Mitigated in code |
| F7 | low | LLM failover key reuse | failover apiKey falls back to primary if not set | May defeat separate-provider failover intent | Production startup warning when failover is configured without `LLM_FAILOVER_API_KEY`; `.env.example` documents setting a dedicated key. | Resolved in code/docs |
| F8 | info | Dependency pinning/audit | mixed stable/rc deps | Potential CVEs | `npm audit` run 2026-11-24: 8 findings (4 moderate, 4 high, 0 critical), **all in dev/deprecated tooling only** — no runtime dependency affected. No upgrades applied (available "fixes" are semver-major downgrades to an ancient drizzle-kit, or unavailable Prisma RC transitives). Re-audit at release; see detail below. | Documented; no unsafe upgrades applied |
| F9 | medium | CSP not explicit | `helmet()` default used, no explicit CSP policy | XSS defense-in-depth weaker | Explicit API-appropriate CSP via `helmet({ contentSecurityPolicy: { useDefaults: false, directives: { 'default-src': ["'none'"], 'frame-ancestors': ["'none'"], 'base-uri': ["'none'"], 'form-action': ["'none'"] } } })`. All other Helmet protections kept at defaults. Verified header present; CORS preflight still 204. | Resolved |
| F10 | low | Abandon confirmation UX | API requires `confirm===true`; UI should always confirm | Accidental abandon | No change; API guard confirmed and UI modal verified in earlier waves. | Mitigated |

## npm audit detail (2026-11-24)

Command: `npm audit` (exit 1 because findings exist). Summary:

```
info 0, low 0, moderate 4, high 4, critical 0, total 8
```

| Package | Severity | Direct? | Advisory / note | Fix available |
|---|---|---|---|---|
| `effect` | high | no | ReDoS in Schema.TemplateLiteral compiled regex (GHSA-7589-6fvf-x4pw), via Prisma 8 RC `@prisma/config` | No fix available |
| `prisma` / `@prisma/prisma7` / `@prisma/config` | high | prisma7 direct | Prisma 8 RC toolchain; Prisma artifacts are **deprecated/non-canonical** here (see README / PROD-004-NOTES) | No fix available (RC) |
| `esbuild` | moderate | no | Dev-server request/response exposure (GHSA-67mh-4wv8-2f99), via `@esbuild-kit/*` | Would require downgrading `drizzle-kit` to 0.18.1 (semver-major) — rejected |
| `drizzle-kit`, `@esbuild-kit/core-utils`, `@esbuild-kit/esm-loader` | moderate | drizzle-kit direct | Drizzle is deprecated/non-canonical in this repo | Same risky downgrade only |

**Decision**: Do not apply blind major/RC upgrades. Runtime dependencies (express 5, helmet 8, cors, body-parser, pg, dotenv) have **no** audit findings. Add `npm audit` to the release checklist; re-evaluate when Prisma/Drizzle are removed from the dependency tree entirely (both are deprecated here).

## Positive controls observed

- Auth middleware derives identity from server-side session store only.
- Session tokens SHA-256 hashed in DB; raw token only in HttpOnly cookie.
- Ownership guards on investigation-scoped routes.
- LLM output validation blocks internal marker leaks.
- DB-backed rate limits, hashed keys.
- Solution endpoint gated to completed owned investigations; DTO allowlist excludes hidden_events.
- Progress DTO explicit allowlist; ownership-safe aggregates.
- Notification settings DB helper allowlists/normalizes untrusted input.

## Residual risks / deploy conditions

1. **Operator config (not code)**: `NODE_ENV=production`, TLS termination, tight `AUTH_RATE_MAX` / `CHAT_RATE_MAX` / `WRITE_RATE_MAX`, `FRONTEND_URL`/`ALLOWED_ORIGINS` set correctly, `CSRF_ORIGIN_CHECK=true`, optional `LLM_FAILOVER_API_KEY`. Startup warnings now surface violations but cannot enforce them.
2. **CSRF**: Origin/Referer check is defence in depth, not a token-based CSRF solution. Requests without either header are intentionally allowed for non-browser clients; browsers normally always send Origin on cross-site mutations, and `SameSite=Lax` remains the primary guard.
3. **Rate-limit fail-open (F4)**: monitor `[rate-limit] store error` logs.
4. **Dependency tooling (F8)**: deprecated Prisma/Drizzle RC packages carry the only audit findings; no runtime exposure. Remove/replace at release.

## Deployment gate recommendation

**Pass with conditions for limited beta**: all code-level conditions are resolved by W6-S1 and verified (typecheck, smoke-db, 127/127 test:http, targeted Origin/CSP/body-limit checks). Remaining conditions are deployment-configuration responsibilities listed above. **No public deploy before W6 is formally closed and W7 deployment/beta readiness is complete.**
