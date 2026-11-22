# PROD-012 — Abandon / reset investigation flow (GAP-10)

## Problem

The one-active-investigation rule (`getActiveInvestigation` matches `status = 'active'`)
meant a player who got stuck, lost interest, or had a failed accusation could be
permanently locked to a single case with no product-supported way out.

## Endpoint

`POST /api/investigations/:investigationId/abandon`

Mounted on `investigationRouter`, so `authMiddleware` + `requireOwnedInvestigation`
guarantee an authenticated owner before the handler runs (401 unauthenticated,
403 non-owner, 404 unknown id). The offline progression catch-up in the ownership
guard is a no-op for a non-active case.

| Condition | Result |
|---|---|
| Missing/invalid `confirm` (body must be exactly `{ "confirm": true }`) | 400, no state change |
| `status === 'completed'` | 409 — resolution/solution/archive semantics are final |
| `status === 'abandoned'` | 409 — already abandoned (no repeated writes) |
| `status` is `active`, `accusationFailed`, `null`, or other legacy value | 200 with safe investigation DTO, status becomes `abandoned` |

The DB update is conditional (`status IS DISTINCT FROM 'completed'` and
`'abandoned'`) so a correct verdict landing between the HTTP guard and the write
cannot corrupt a completed case; that race returns 409.

## Status semantics

`abandoned` is terminal and **additive** — no schema change was required because
`investigations.status` is free-form `text` with no check constraint. A migration
is therefore intentionally not included.

- `getActiveInvestigation` only matches `active`, so abandoning immediately
  releases the lock and the player can create a fresh investigation.
- `getInvestigationsArchive` now includes `abandoned`; the archive labels it
  **Abandoned** and does not offer a "Reopen" action. Case history stays visible.
- Progression helpers (`mystery-engine.ts`) all require `status === 'active'`, so
  an abandoned investigation is inert — no events, releases, or deductions run.
- Completed cases can never be abandoned; the solution reveal endpoint keeps
  working normally on them.

## Data integrity / anti-leak

Nothing is deleted. Discovered evidence ids, journal entries, conversations,
scheduled events and accusations remain attached to the original investigation
and stay owner-readable. The response is the ordinary investigation DTO (no
canonical truth fields). `canonical_truth` is never read by the abandon path.
Existing evidence visibility is cumulative per user+case by prior design; only
evidence that was legitimately visible/server-released during play is involved,
so abandoning does not reveal hidden evidence.

## Frontend

- Investigation room header: **Abandon case** button (hidden for completed /
  already-abandoned cases).
- "Another case is already active" conflict panel: **Abandon that case** action,
  so a blocked player can resolve the lock without hunting for the other case.
- Both open the same accessible confirmation dialog (`role="dialog"`,
  `aria-modal`) with explicit destructive wording; cancellation/overlay click
  closes it. The API independently requires `confirm: true`.
- On success the client navigates to the case library (`/?abandoned=1`) and shows
  a one-time success banner.

## Verification

Covered by `scripts/smoke-http.ts` (see `npm run test:http`): confirmation
required, auth + ownership, lock release + new-case creation, history/data
preservation + no canonical leak, completed-case guard, archive visibility.
