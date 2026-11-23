# Phase 10 — Integration, Playability & Release Readiness Audit

**Date:** 2026-11-23  
**Repository:** `/home/divyanshukumarsinha241/project-courtroom`  
**Branch / HEAD:** `main` @ `b0312be` (audit doc committed; code at `66fe524`/`b1fe959`)  
**Baseline verified:** `npm run verify` PASS — 49 files / 448 tests, lint/format/typecheck/build clean.  
**Constraint note:** `/home` has ~1.4G free (70% used), below the >2GB operating target. No large artifacts were added.

## 1. Honest implementation audit

| Area                                                     | Status                                             | Evidence / notes                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New game / boot / local save                             | **Fully implemented, playable**                    | `App.tsx` boot/session helpers; `src/storage/localStorageGameRepository.ts`; `sessionUi.ts`. Reset yields fresh in-memory save.                                                                                                                                                                                 |
| Async sqlite-api adapter + conflict guard                | **Implemented, partially integrated**              | `src/storage/sqliteApiGameRepository.ts`, `server/api.ts`, `server/db/*`; 409 `expectedSavedAt` conflict UX in `App.tsx`. Default remains `local`. Manual two-mode parity smoke still required before any default flip.                                                                                         |
| First Brief Day 1–10 progression                         | **Fully implemented, playable**                    | `src/domain/seed.ts`, `progression.ts`, `casework.ts`, `draftSubmission.ts`, `completion.ts`; covered by `day1to10.test.ts`, `chapterIntegrity.test.ts`, `completion.test.tsx`.                                                                                                                                 |
| Scene navigation / hotspots / Senior's Chamber prototype | **Implemented, playable prototype**                | `src/domain/scenes.ts`, `src/app/SceneArt.tsx`; 4 viewpoints, 21 hotspots, static SVG, character expressions for Meera. Other characters have greetings/dialogue but no scene portraits.                                                                                                                        |
| Dialogue system                                          | **Partially integrated**                           | Authored consequence scenes in `src/domain/dialogue.ts` + Dialogue panel; separate static hotspot greetings hardcoded in `App.tsx:114-124`. `flags.introSeen` exists but is unused (`seed.ts:881`).                                                                                                             |
| Evidence discovery/review/assessment/notes               | **Fully implemented, playable**                    | `src/domain/evidence.ts`, Evidence panel in `App.tsx`. Assessment blocked until reviewed; baseline labels marked non-authoritative.                                                                                                                                                                             |
| Case theory workflow                                     | **Fully implemented, playable**                    | `src/domain/theory.ts`; known/claimed/disputed claims require discovered+reviewed evidence; fault assertions rejected.                                                                                                                                                                                          |
| Research / source intake / citation guard                | **Implemented, guarded**                           | `src/domain/legalSources.ts`, `sourceValidation.ts`, Research panel. Player intake creates unverified/placeholder drafts; no auto-verification; citation guard blocks fabricated/unsafe citations.                                                                                                              |
| Drafting / versioning                                    | **Implemented, partially integrated**              | `src/domain/draft.ts`; draft panel has save/version/load. A7/A8 still submit separate summary textareas, but Phase 10 now prefills them from current draft when empty (`App.tsx` casework/assignments handlers). Draft artifact is not the canonical revision object.                                           |
| A2 draft submission path                                 | **Implemented, partially integrated**              | `submitDraftForFeedback` enforces citation guard and can review A2. Assignment panel A2 now routes to Draft panel (Phase 10 fix) instead of generic evaluate, reducing click-through. Generic evaluate remains for other assignments.                                                                           |
| Senior review / revision / final brief                   | **Fully implemented, playable**                    | `src/domain/casework.ts`; A7 requires revise/resubmit before acceptance; A8 computes deterministic tier from visible metrics and closes chapter.                                                                                                                                                                |
| Legal Mind Profile (10 dimensions)                       | **Implemented, derived**                           | `src/domain/legalMindProfile.ts`, `types.ts`; 10 qualitative dimensions, no composite score. Updated from recorded gameplay events; derived on demand, not stored as canonical truth.                                                                                                                           |
| Knowledge graph runtime flow                             | **Documented/types only; NOT runtime-implemented** | Types exist: `KnowledgeDomain`, `KnowledgeConnection`, `InterdisciplinaryNotebookEntry`, `NotebookEntry.knowledgeGraphIds` (`types.ts`). No runtime creation flow, no UI, no discovery→notebook→assignment→review wiring in `App.tsx`/domain. `docs/LEGAL_KNOWLEDGE_INFRA.md` §5.4 describes intended behavior. |
| AI senior review / AI Lab                                | **Experimental, opt-in, disabled by default**      | Feature flags + explicit opt-in; deterministic review authoritative. Local AI lab env-gated/non-authoritative. No production provider selected.                                                                                                                                                                 |
| Canonical truth isolation                                | **Implemented with documented limitation**         | `toPersistedSave` strips canonical truth; server `stripCanonicalTruth`; `hydrateSave` re-derives from seed. UI guard is DEV-only marker check. Canonical truth exists in client bundle/in-memory state by design of current architecture (see security finding).                                                |
| Persistence security hardening                           | **Partially improved in Phase 10**                 | `b1fe959`: mutating API requires local origin and JSON content type for PUT/POST; boot load failure now blocks writable session instead of failing open. Remaining gaps: no auth/ownership, reset resurrection race, client-supplied CAS token, corrupt recovery UX, audit consistency.                         |

## 2. Integration gaps discovered

| Gap                                                                                       |                     Severity | Evidence                                                                                    | Status                                                                                                                                   |
| ----------------------------------------------------------------------------------------- | ---------------------------: | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Journal → Evidence cross-link lost context                                                |                    Medium UX | `App.tsx` previously set panel only; no target focus                                        | **Fixed** in `66fe524` (scroll/highlight `focusEvidenceId`, timed clear).                                                                |
| Evidence note form appeared without focus move                                            |               Medium a11y/UX | Inline note form rendered below; focus stayed on trigger                                    | **Fixed** in `66fe524` (`noteTextRef.focus()` on `noteTarget`).                                                                          |
| Notebook list not keyboard-scrollable                                                     |                  Medium a11y | `max-h-[60vh] overflow-auto` had no tab stop/region role                                    | **Fixed** in `66fe524` (`tabIndex=0 role="region" aria-label="Notebook entries"`).                                                       |
| A2 generic evaluate bypassed draft feedback path                                          |              Medium gameplay | Assignments panel allowed direct A2 evaluate                                                | **Fixed** in `66fe524` (A2 routes to Draft panel).                                                                                       |
| A7/A8 disconnected from draft artifact                                                    |              Medium gameplay | Casework used separate summary textareas, no draft prefill                                  | **Partially fixed** in `66fe524` (prefill from current draft when summary empty). Full draft-version revision flow still not integrated. |
| Async load failure could overwrite server save                                            |          High data integrity | `SqliteApiGameRepository.loadGame` failed closed to fresh save; App booted writable session | **Fixed** in `b1fe959` (throw on load failure; App blocking retry UI).                                                                   |
| Cross-origin save overwrite (CSRF) on sqlite-api                                          | High security (local server) | `POST`/`PUT` accepted text/plain; no Origin check                                           | **Fixed** in `b1fe959` (local Origin check; JSON content-type required for mutating PUT/POST). Not auth.                                 |
| `introSeen` flag never used                                                               |                          Low | `seed.ts:881`; no runtime consumer                                                          | Open.                                                                                                                                    |
| Draft submission sets `assignment2Submitted` before review outcome known                  |                 Low/semantic | `draftSubmission.ts:103`                                                                    | Open; tests rely on current behavior.                                                                                                    |
| Character interaction fragmentation                                                       |            Medium engagement | Hotspot greetings in `App.tsx` vs authored dialogue scenes in `dialogue.ts`                 | Open.                                                                                                                                    |
| Knowledge graph has no runtime flow                                                       |           Medium product gap | Types/docs only; no UI/domain wiring                                                        | Open; documented-only.                                                                                                                   |
| Reset can be resurrected by another tab re-importing local migration source               |           Medium persistence | `sqliteApiGameRepository.ts` 404 import path; ADR-003 gap 11                                | Open.                                                                                                                                    |
| `savedAt` client-supplied CAS token                                                       |  Medium persistence/security | `save.ts`/server compare client timestamp                                                   | Open; ADR-003 gap 12.                                                                                                                    |
| Corrupt save recovery discards progress silently                                          |           Medium reliability | `save.ts` returns fresh save; server parse can 500                                          | Open; ADR-003 gap 13.                                                                                                                    |
| Canonical truth present in client bundle                                                  |             Known limitation | `save.ts` rehydrates from seed; `dist` contains literals; DEV-only UI guard                 | Open by architecture; threat model is casual leakage/tamper, not secrecy.                                                                |
| Small touch targets / missing form metadata / 10 buttons missing explicit `type="button"` |              Low a11y/polish | UI audit findings                                                                           | Open.                                                                                                                                    |
| Unsaved draft may be lost on tab close before blur                                        |                       Low UX | No `beforeunload` guard                                                                     | Open.                                                                                                                                    |

## 3. Changes actually implemented (Phase 10)

| Commit            | Change                                                                                                                                                                                                                                                                                       | Files                                                                                                                                             | Verification                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `b1fe959`         | Harden sqlite-api mutating endpoints: reject non-local `Origin`, require `application/json` for PUT/POST; added CSRF regression test. Changed async load failure behavior: repository throws on non-404 load errors; App shows blocking retry alert instead of mounting writable fresh save. | `server/api.ts`, `server/api.test.ts`, `src/storage/sqliteApiGameRepository.ts`, `src/app/App.tsx`, `src/tests/appRepositoryIntegration.test.tsx` | Targeted tests pass (47 tests across 4 files); full verify PASS.  |
| `66fe524`         | UX/a11y/gameplay integration: journal "In evidence board" scrolls/highlights evidence card; note form receives focus; notebook list keyboard-scrollable region; A7/A8 buttons prefill summary from current draft when empty; A2 assignment routes to Draft panel.                            | `src/app/App.tsx`                                                                                                                                 | UI/a11y/panel smoke tests pass; full verify PASS.                 |
| docs (this audit) | Added `docs/PHASE10_AUDIT.md`; updated `docs/ADRs/ADR-003-persistence-integration.md` gaps/hardening notes.                                                                                                                                                                                  | docs                                                                                                                                              | `npm run typecheck` PASS after edits; no runtime behavior change. |

## 4. Playtest reports

### Playthrough A — Careful learner (simulated/code-traced + limited browser smoke)

- **Intent:** Read instructions, examine info, reason, use feedback, revise.
- **Observed (code/UI):** Help panel explains core loop and guardrails; objective panel gives next step; evidence board requires discover→review before assessment; casework A7 enforces revision before acceptance; completion screen includes synthesis and Legal Mind Profile.
- **Friction:** A7/A8 revision is text-summary based, not draft-version based; prefill helps but does not create a true draft revision workflow. Knowledge graph has no playable connection flow despite types/docs.
- **Result:** **Partially satisfying.** Core loop is understandable and deterministic; writing/revision craft loop is thinner than state-machine loop.

### Playthrough B — Impatient player (simulated/code-traced)

- **Intent:** Skip optional info, make weak assumptions, submit imperfect work.
- **Observed:** Many assignments gate on prerequisites/requirements; weak A2 submissions get deterministic feedback and can be blocked by citation guard/missing structure. A7 rejects fault assertions and first-round acceptance. Skipping evidence review blocks assessment/note quality signals. However, several non-A2/A7/A8 assignments still use generic "Submit / Evaluate" once requirements met, which can feel checklist-driven.
- **Friction:** Consequences are mostly local (standing/reputation/feedback text), not branching narrative fallout. Draft feedback is better than assignment-only evaluation.
- **Result:** **Mixed.** Guardrails prevent obvious bad outcomes, but impatient path can still feel procedural.

### Playthrough C — Strategic player (simulated/code-traced)

- **Intent:** Challenge evidence, find contradictions, develop theory, use research/counterarguments.
- **Observed:** Evidence contradiction/corroboration notes, case theory claims linked to reviewed evidence, legal source intake with verification/citation guards, senior review checks evidence/sources/milestones. Strategic actions are recorded in journal/audit/profile signals.
- **Friction:** No knowledge-graph UI to connect interdisciplinary insights; theory/research links are functional but not visually rich. No deep case branching from strategic choices; ambiguity remains by design.
- **Result:** **Playable but limited depth.** Strategy is rewarded through structured feedback/profile, not dramatic narrative branching.

**Evidence note:** Earlier browser smoke (Playwright Chromium, temp dev server) captured desktop/mobile screenshots under `/tmp/opencode/courtroom-audit/*` during subagent/UI audit; artifacts are ephemeral and were not committed. Automated UI/a11y smoke tests pass (33 tests in 4 files). No full 10-day automated browser playthrough was completed in this session.

## 5. Documentation updates

- Added: `docs/PHASE10_AUDIT.md` (this report).
- Updated: `docs/ADRs/ADR-003-persistence-integration.md` — recorded Phase 10 CSRF hardening, boot-load fail-closed fix, and remaining persistence gaps (11–13).
- Not updated: `docs/PRODUCT_POSSIBILITIES.md` — no deferred item changed status to implemented; knowledge graph runtime flow remains not implemented.

## 6. Remaining human decisions

1. **Legal text/citation/procedure corpus** — human legal owner/reviewer, rights/licensing, official text, amendment/version policy before authoritative legal content expansion.
2. **Licensed/final art sign-off** (D-002/D-012/D-018) — style/asset ownership/licensing.
3. **Production AI provider/model/budget/privacy** — AI remains opt-in/disabled by default; no keys spent.
4. **SQLite default flip** — only after manual two-mode parity smoke in target deployment, rollback recorded, and security gaps addressed (at minimum CSRF/auth posture for exposure model, reset resurrection, CAS token).
5. **Auth/multi-user/remote push/deploy** — explicit product/security/approval decisions.
6. **Canonical-truth threat model** — decide whether client-bundle canonical truth is acceptable for single-player prototype or must move server-side for secrecy.

## 7. Known bugs and limitations

- Knowledge graph flow is type/doc-only; no player-driven UI/runtime creation.
- `introSeen` flag unused; onboarding is functional but not stateful beyond helpSeen.
- A7/A8 use summary textareas (prefilled from draft) rather than true draft artifact revision workflow.
- `assignment2Submitted` flag semantics are early/muddy.
- Character interactions split between hotspot greetings and dialogue scenes; portrait consistency limited to Meera.
- Reset resurrection/import race in sqlite-api migration path (ADR-003 gap 11).
- Client-supplied `savedAt` used as CAS token (ADR-003 gap 12).
- Corrupt save recovery silently resets client-side; server malformed payload can 500.
- No auth/ownership on sqlite-api; local-origin/content-type checks are hardening, not auth.
- Canonical truth is present in client JS bundle/in-memory state; DEV-only UI leak guard.
- UI polish gaps: small touch targets, 10 buttons missing explicit `type="button"` (57 total `<button>` elements), form metadata/autocomplete/spellcheck gaps, dense live-status region, no beforeunload draft guard.
- Disk: `/home` ~1.4G free, below >2GB target.

## 8. Test, lint, typecheck, build results

Commands run from `/home/divyanshukumarsinha241/project-courtroom`:

| Command                                                                                                                                                                                  | Result                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                                                                                                                                      | PASS                                                                                                                                                              |
| `npx vitest run server/api.test.ts server/db/repository.test.ts`                                                                                                                         | PASS (2 files, 17 tests)                                                                                                                                          |
| `npx vitest run src/tests/appRepositoryIntegration.test.tsx src/tests/sqliteApiGameRepository.test.ts src/tests/sqliteApiE2E.test.ts server/api.test.ts`                                 | PASS (4 files, 47 tests)                                                                                                                                          |
| `npx vitest run src/tests/uiSmoke.test.tsx src/tests/a11ySmoke.test.tsx src/tests/panelPolish.test.tsx src/tests/scenePresentation.test.tsx src/tests/appRepositoryIntegration.test.tsx` | PASS (5 files, 42 tests)                                                                                                                                          |
| `npm run verify`                                                                                                                                                                         | PASS — 49 files, 448 tests; lint 0 errors/7 warnings (pre-existing fast-refresh warnings in `src/app/App.tsx`), format check clean, typecheck clean, build clean. |

## 9. External playtest readiness

**Assessment: Near-ready for controlled external playtesting (prototype), with caveats.**

The First Brief Day 1–10 flow is playable end-to-end, deterministic, save/load safe in local mode, and guarded against major fabrication/canonical-truth persistence leaks in tested paths. Phase 10 fixed two meaningful risks (sqlite-api CSRF hardening; boot load failure no longer overwrites) and several UX/a11y integration gaps.

**Before wider external playtesting, I recommend:**

1. Run the manual two-mode parity smoke (local vs sqlite-api) in a real browser with Vite proxy; do not flip default.
2. Fix or explicitly accept reset-resurrection/CAS-token/corrupt-recovery gaps for sqlite-api mode.
3. Add a simple knowledge-graph playable slice or clearly label it "not yet playable" in UI/docs.
4. Do one full 10-day automated browser playthrough (Playwright) with screenshots and console capture.
5. Address small a11y polish (touch targets, button types, draft beforeunload warning) for mobile testers.

**Not ready for:** public deployment, multi-user, authoritative legal advice, production AI claims, or default sqlite-api rollout.

## 10. Post-audit fixes (independent scrutinizer follow-up)

Applied after the independent scrutinizer review (read-only, approved):

- `server/api.ts`: sanitize `/api/audit?limit=` (NaN/non-finite/invalid values now default to 100, clamped 1–500) to prevent 500 from `LIMIT NaN`; regression test added in `server/api.test.ts`.
- `src/domain/progression.ts` + `types.ts` + `audit.ts`: added `day-advanced` audit event type and record it on day rollover (minor consistency gap).
- Docs staleness fixed: `README.md`, `docs/COMPLETION-REPORT.md`, `docs/PRODUCT_POSSIBILITIES.md` (#17 implemented, #22 partial, #24 partially implemented/blocked on text), and this audit's minor HEAD/button-count notes.

Verification after fixes: `npm run verify` PASS (49 files, 448 tests; lint/format/typecheck/build clean).
