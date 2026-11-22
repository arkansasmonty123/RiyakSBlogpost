# PROD-010 — Verdict integrity v2 (GAP-06)

Server-authoritative final-accusation integrity for THE INVESTIGATION. The goal
is that a correct **name** alone can never solve a case, that wrong accusations
have escalating-but-fair consequences, and that no canonical truth leaks through
verdict feedback.

## Rules implemented

1. **Readiness gate** — before any evaluation is performed, the server requires
   at least `ACCUSATION_REQUIRED_CHECKPOINTS` (default **1**) *plausible*
   deduction checkpoint recorded by the progression engine
   (`deduction_checkpoints.result = 'plausible'`). A premature submission gets
   HTTP **409** `{ status: 'not_ready', readiness, attempts }` and consumes no
   attempt.

2. **Full-reasoning evaluation** (`src/db.ts::evaluateAccusation`) — a verdict is
   `correct` **only when all of the following hold**:
   - normalized culprit matches `canonical_truth.culprit`;
   - motive free-text has keyword coverage ≥ `ACCUSATION_MOTIVE_THRESHOLD`
     (0.18) and ≥ `ACCUSATION_MIN_KEYWORD_OVERLAP` (4) canonical content words;
   - method free-text meets the same thresholds;
   - at least `ACCUSATION_MIN_SUPPORTING_EVIDENCE` (1) cited id belongs to the
     case **and** is player-visible or already discovered/released.
   Matching is a deterministic normalized keyword/prefix match (stopwords
   removed, ≥4-char tokens). The canonical solution is never echoed back.
   - Name-only, wrong-name, weak-reasoning and out-of-case-evidence accusations
     all return the **same generic** `incorrect` feedback, so brute-forcing the
     name reveals nothing. `partial` is reserved for the legacy "canonical
     truth not configured" case.

3. **Attempts + cooldown** — stored on `investigations`
   (`accusation_attempts`, `last_accusation_at`, `accusation_cooldown_until`).
   Every evaluated non-correct verdict increments the counter and sets
   `cooldown_until = now + BASE * 2^(attempts-1)`, capped at `MAX`
   (defaults **2s → 4s → 8s … 60s**; never a permanent lockout). A correct
   verdict resets the counter and clears the cooldown. Check + record run in one
   transaction with `SELECT … FOR UPDATE`, so concurrent requests cannot bypass
   the cooldown. HTTP **429** includes `Retry-After`, `retryAfterSeconds`,
   `cooldownUntil` and `attempts`; rejection during cooldown does not consume an
   attempt.

4. **State machine** — only a fully verified verdict sets `status='completed'`
   and awards `case_solved`. Failed verdicts stay `active` and retryable;
   completed cases cannot be reopened (HTTP 409). Attempt/cooldown/status are
   never client-writable (PATCH still only accepts `currentTheory` /
   `suspicionLevel`).

5. **Frontend** — the accusation tab shows readiness, attempts used and a live
   cooldown countdown; submit is disabled until ready and while cooling down.
   The verdict panel shows the attempt count. `ApiError` now exposes structured
   error details so 409/429 feedback is rendered instead of treating it as a
   crash.

## DB changes (additive only)

- `migrations/003_prod010_verdict_integrity.sql` — `ALTER TABLE … ADD COLUMN IF
  NOT EXISTS` for the three columns above (plus comments). Applied to the local
  `investigation` DB.
- `scripts/ci-schema.sql` — same columns added to the fresh-CI schema.
- No destructive changes; existing rows default to 0 attempts / no cooldown.

## Configuration (optional env vars)

See `.env.example`. All have safe dev defaults; tighten in production. The
accusation cooldown is DB-backed and survives restarts. The session store
(P2-SESSIONS) and rate-limit counters (P2-RATE-LIMITS) are now also DB-backed
and shared across replicas; configure Express `trust proxy` so rate-limit keys
use the real client IP behind a proxy.

## Verification (executed 2026-11-22)

- `npm run typecheck` — PASS
- `npm run test:smoke` — PASS (`smoke-db: ok`)
- `frontend && npm run build` — PASS
- `npm run test:http` — PASS (**37/37**; 34 previous + 3 new PROD-010 tests)
  covering: readiness gate, name-only rejection with non-leaking feedback,
  partial-reasoning/out-of-case-evidence rejection, cooldown enforcement +
  Retry-After + escalation + non-permanent retry, and full valid verdict
  completion with achievement + lock.
