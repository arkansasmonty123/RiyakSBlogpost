# Canonical Truth Threat Model

**Date:** 2026-11-23  
**Scope:** THE BAR single-player prototype (`project-courtroom`)  
**Status:** Documented; no hidden case truth is treated as secure from a determined player.

## 1. What is exposed

`CaseFile.canonicalTruth` contains authoritative case facts that the player should discover through gameplay (actual events/timeline, responsible parties, hidden motives, evidence authenticity, unresolved ambiguities). It is defined in `src/domain/types.ts` and seeded in `src/domain/seed.ts`.

**Current exposure:**

- **Client bundle/source:** `src/domain/seed.ts` includes canonical truth; `src/storage/save.ts` imports `createInitialSave()` and rehydrates `canonicalTruth` on load. The built JS bundle contains these literals. A determined player can inspect bundled JS, memory, or devtools.
- **In-memory client state:** the active `SaveGame` holds canonical truth in memory for deterministic game logic boundaries. It is not rendered by player-facing views.
- **Not exposed by design in persistence/API:** `toPersistedSave()` strips `caseFile.canonicalTruth`; server `stripCanonicalTruth()` strips before DB write; `GET /api/saves` and audit responses do not include it. `hydrateSave()` always re-derives canonical truth from the deterministic seed, never from stored payload.

## 2. Can a normal player inspect it?

- **Casual player:** unlikely to encounter it through normal UI. Player-facing views use `toPlayerCaseView()` and do not render canonical truth.
- **Curious/technical player:** yes. Browser devtools, source maps/bundle inspection, or local code inspection can reveal canonical truth. This is trivial for anyone comfortable with web developer tools.

## 3. What existing guards actually protect

| Guard                                                 | Protects against                                       | Does not protect against                     |
| ----------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------- |
| `toPersistedSave()` allow-list                        | Canonical truth in localStorage/saved payloads         | Bundle/devtools inspection                   |
| Server `stripCanonicalTruth()` + API response shape   | Canonical truth in DB/API responses                    | Client-side exposure                         |
| `hydrateSave()` re-derives from seed                  | Tampered/stale stored canonical truth influencing load | Reading seed/bundle                          |
| `assertNoCanonicalTruthLeak()` (DEV-only marker scan) | Accidental UI rendering leaks during development       | Production bundle exposure; non-marker leaks |
| `toPlayerCaseView()`/player-safe selectors            | UI showing canonical fields                            | Direct object inspection in memory           |

## 4. What must move server-side for a genuine trust boundary

For hidden information to be genuinely secret from the player, canonical truth must not be shipped to the client. That requires:

1. **Server-authoritative case engine:** hidden outcomes, authenticity, motive, and responsibility checks executed server-side.
2. **Player-visible projection API:** server returns only player-legible state/evidence outcomes.
3. **Action validation server-side:** evidence discovery, challenge outcomes, scoring, and final judgment computed/validated on server.
4. **No canonical seed in client bundle:** remove canonical truth from client build artifacts and source shipped to browser.
5. **Auth/session boundary:** tie slots to authenticated users before public exposure.
6. **Auditability:** server logs for sensitive evaluations without exposing secrets.

This is a meaningful architecture change, not a small patch.

## 5. Acceptable for a single-player prototype

Acceptable now (with clear labeling):

- Canonical truth present in client bundle/memory for a local, single-player educational prototype.
- Guards preventing persistence/API leakage and accidental UI rendering.
- Honest documentation that hidden information is not secure against inspection.

Not acceptable to claim:

- "Hidden case truth is secure", "spoiler-proof", or "server-protected" while it ships in client code.

## 6. Must be resolved before public deployment

- Move canonical truth and outcome evaluation server-side (or redesign so no hidden authoritative truth is required).
- Add authentication/authorization and slot ownership.
- Add rate limiting, abuse monitoring, and deployment hardening.
- Remove/avoid client bundle exposure of hidden answers.
- Security review of API, auth, storage, and client/server trust boundaries.
- Legal/product review for public claims and educational disclaimers.

## 7. Recommendation

For the current prototype: keep the existing guards, keep local default, and document the limitation prominently. Do not block prototype playtesting on server-side secrecy; do block any public deployment or competitive/scored claim on this limitation.
