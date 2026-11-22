# QA Checklist — THE BAR (P0 prototype)

**Last run:** 2026-11-22 · **Repo:** `project-courtroom` · **Branch:** `main` @ `c4f15a1`

This checklist records the storage-safe QA matrix for the local P0 prototype. It
separates what is enforced by deterministic tests in CI from what needs a browser,
and documents the guardrails that must never regress. No real legal corpus, no
runtime AI, no canonical-truth projection and no fabricated citations are part of
the acceptance surface.

## 1. Storage-safe QA matrix

All commands run from the repository root. No command below installs browsers or
downloads large artifacts into `$HOME`.

| # | Area | Check | Command / method | Type | Gate |
|---|------|-------|------------------|------|------|
| 1 | Types | TypeScript project builds clean | `npm run typecheck` | Deterministic | Blocking |
| 2 | Tests | Full suite green | `npm test` | Deterministic | Blocking |
| 3 | Build | Production bundle builds | `npm run build` | Deterministic | Blocking |
| 4 | Render smoke | App tree renders without crash / no canonical truth in SSR HTML | `npm test` → `src/tests/uiSmoke.test.tsx` | Deterministic (SSR) | Blocking |
| 5 | A11y structure | Skip link, `<main>`/`<header>`/`<nav>`, single `h1`, ARIA reference targets resolve, all controls/form fields/links/buttons have accessible names, feedback is a polite live region | `npm test` → `src/tests/a11ySmoke.test.tsx` | Deterministic (SSR) | Blocking |
| 6 | Guardrails | No canonical-truth leak, no fabricated provisions/judgments, citation guard, knowledge boundaries, save v1→v2 migration, audit log cap | `npm test` (domain + guard tests) | Deterministic | Blocking |
| 7 | Legal sources | Provenance/verification gate on seed + example records | `npm run validate:sources -- --seed` | Deterministic | Non-blocking (corpus blocked by D-005/D-011) |
| 8 | Layout / visual | Mobile 390×844 and desktop 1440×900; no console errors; skip link, `<main>` and `h1` present | Manual/Playwright browser smoke (see §4) | Browser | Previously observed; re-run when browser available |
| 9 | Keyboard / screen reader | Tab order, focus-visible, SR announcements, real axe scan | Manual / axe | Browser + human | Not in CI — known gap (§5) |

Notes:
- **SSR a11y checks are structural only.** They verify markup, not computed
  contrast, focus order or screen-reader behaviour. Dynamic interaction states
  (Source Intake form, expanded help/challenge panels) are internal React state
  and are not reachable via `renderToString`; they need a real browser.
- **Guardrail invariants are non-negotiable:** no fabricated statutes/judgments/
  citations, canonical truth/character knowledge/player knowledge stay separate,
  authenticity is never resolved for the player, and AI stays stubbed/disabled.

## 2. Commands run for this hardening pass (actual results)

Run from `project-courtroom` with `node_modules` symlinked to
`/tmp/opencode/project-courtroom/node_modules`.

| Command | Result |
|---------|--------|
| `npx vitest run src/tests/a11ySmoke.test.tsx` | PASS — 5/5 tests |
| `npm run typecheck` | PASS (no output, exit 0) |
| `npm test` | PASS — **182/182 tests, 22 files** (up from 177/177, 21 files) |
| `npm run build` | PASS — `dist/index.html` 0.42 kB, CSS 15.98 kB, JS 409.79 kB (gzip 115.12 kB) |
| `df -h /home` | **2.8 G available** of 4.8 G (39% used) — above the >2 GB budget (D-019) |

A11y changes made in this pass (all minimal, no UI churn):
- `aria-controls` on the "How to play" and "Add Source / Source Intake" toggles
  is only emitted while the controlled panel is expanded, so it never points at
  an element that is not in the DOM.
- The action-feedback block in the Conversations panel is now a polite
  `role="status"` live region so senior/system messages are announced.
- Added `src/tests/a11ySmoke.test.tsx` (5 deterministic SSR tests) and this doc.

## 3. Previously observed browser smoke (recorded, not re-run here)

Performed earlier on a machine with browser binaries available:

- **Viewports:** mobile **390×844** and desktop **1440×900**.
- **Console:** no errors reported.
- **Structure:** skip link, `main` landmark and a single `h1` present in the
  rendered page.
- **Layout:** two-column workspace collapses to a single column on mobile;
  scene frame keeps a 16:9 aspect ratio with labelled hotspot buttons below the
  decorative SVG.

These results are historical observations, not part of the current CI gate. This
environment has **no browser binaries installed**; do not install Chromium or
Playwright browsers here just to re-check. Re-run §4 in an environment that
already has them, or follow the safe Cloud Shell flow in §6.

## 4. How to re-run browser smoke when a browser is available

1. Start the preview server: `npm run build && npm run preview -- --host 127.0.0.1`.
2. Open `http://127.0.0.1:4173` at **390×844** and **1440×900**.
3. Confirm: no console errors; skip link focuses and jumps to `#main-content`;
   `main`, `header`, `nav` and one `h1` are present; panel tabs are reachable by
   keyboard with visible focus; source intake labels are announced.
4. Walk one loop: inspect/review evidence → add a note → open Case Theory →
   source intake (draft only) → draft → advance time. Confirm feedback appears
   in the polite live region and no canonical truth/citation appears anywhere.
5. Stop the preview server when done.

## 5. Known gaps (honest status)

- **No axe-core or real screen-reader audit in CI.** SSR structural checks cannot
  catch computed contrast, focus order, landmark misuse in context or SR output.
- **Dynamic states not SSR-covered:** the Source Intake form, expanded help and
  in-panel editors are React state and are only verifiable in a browser.
- **Full manual matrix not re-run this pass** because no browser binaries are
  installed here (§3 records the earlier observation).
- **Legal corpus blocked (D-005/D-011):** no real verified sources; `validate:sources`
  is a provenance gate, not content approval.
- **Runtime AI / RAG not implemented (Phase 6):** everything is deterministic/stubbed.

## 6. Cloud Shell storage-safe workflow (keep >2 GB on `/home`)

Follow ADR-000 / DECISIONS D-019: persistent source/config/docs live in `$HOME`;
re-downloadable heavy artifacts live under `/tmp` and are symlinked or configured.

```bash
# Keep caches and browsers off /home.
mkdir -p /tmp/opencode/project-courtroom/node_modules
npm config set cache /tmp/opencode/npm-cache

# If node_modules lives in /tmp, link it from the repo (do not copy).
ln -s /tmp/opencode/project-courtroom/node_modules ./node_modules  # only if absent

# Browser binaries (only when a browser check is actually needed):
export PLAYWRIGHT_BROWSERS_PATH=/tmp/opencode/pw-browsers
npx playwright install chromium --with-deps   # only in a browser-enabled env

# Run the deterministic gate first (cheap, storage-safe).
npm run typecheck && npm test && npm run build

# Always confirm the budget before and after.
df -h /home
```

Cleanup when a browser session is finished:

```bash
rm -rf /tmp/opencode/pw-browsers        # re-downloadable; frees the most space
# Leave /tmp/opencode/project-courtroom/node_modules if still in use; otherwise remove.
df -h /home                              # confirm >2 GB available
```

Never push to a remote or deploy as part of QA. Never commit secrets or API keys.
If free space drops near the 2 GB floor, remove re-downloadable caches only and
log the action in the orchestration state before continuing.
