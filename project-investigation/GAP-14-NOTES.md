# GAP-14 — Basic in-app notifications / developments polish (P2)

**Status:** implemented 2026-11-22 · additive, no schema change · all checks PASS.

## What was added

- **Unread indicator + mark-seen (client-side, MVP):** the Investigation Room's
  "Recent developments" panel now shows an `N new` badge, highlights unread
  entries and offers a "Mark all as read" button. Seen state is stored per
  investigation in `localStorage` (`investigation:seen-developments:<id>`) as a
  list of opaque development ids — never message bodies or canonical data.
  Storage errors degrade to an in-memory empty set so private browsing/full
  quota cannot break the room.
- **Notification preferences UI (MVP, no push):** a "Notification settings"
  disclosure in the same panel with a `Highlight new developments` checkbox.
  When disabled, the badge/highlights are suppressed (the underlying safe feed
  is still available). Saves optimistically and rolls back on failure.
- **Server persistence using the existing column:** `users.notification_settings`
  (already in `000_baseline.sql`) is read/written through new
  `GET`/`PATCH /api/me/notification-settings` endpoints. Identity comes from
  the session; the DTO is a strict boolean allowlist
  (`{ developments: boolean }`, default `true`), so unknown keys, non-boolean
  values and canonical/hidden fields are ignored. No migration was needed.
- **3 HTTP smoke tests** for auth gating, safe defaults/no-leak DTO, and
  persistence + unknown-key rejection.

## Security / leakage notes

- Development entries are the pre-existing player-safe, server-authored
  messages from `development_log`; nothing new is exposed. `canonical_truth`,
  hidden interpretations and suspect internals remain server-only.
- The settings DTO exposes exactly one boolean and is asserted free of
  canonical/hidden field names in the HTTP smoke suite.

## Verification executed

- `npm run typecheck` — PASS.
- `npm run db:schema:verify` — PASS (18/18 tables, 166/166 columns; no schema change).
- `npm run test:smoke` — PASS.
- `cd frontend && npm run build` — PASS.
- `npm run test:http` — PASS: **56 passed, 0 failed** (53 pre-existing + 3 new).
- `npm run case:validate` — PASS (static DTO allowlists unchanged).

## Non-goals / follow-ups

- No email/push delivery, per-entry server-side read receipts, or global
  cross-device read sync (read state is per browser). A `development_log.seen_at`
  column plus an authenticated mark-seen route would be the durable upgrade.
- The `N new` count covers the 30 most recent server-feed entries (the existing
  `getDevelopments` limit); the panel renders the newest 5 as before.
