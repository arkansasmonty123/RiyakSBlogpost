# Design Expectations — THE BAR (First Brief prototype)

> **Status**: repo-grounded design reference. Derived from `THE_BAR_MASTER_CONTEXT.md`, `src/app/App.tsx`, `src/styles/index.css`, `tailwind.config.js`, `src/app/SceneArt.tsx`, and the Phase 10.6 UI audit artifacts. External "design expectation" drafts that cited files absent from this repository and proposed motion contradicting the static-scene spec were **not adopted**; see "Not adopted" below.

## 1. Product frame

- Single-player legal-career simulation. The player works case files, reviews evidence, drafts, takes notes, and gets deterministic senior feedback.
- Central experience: **legal work as artifacts**. Screens should read like an office/workstation, not a generic dashboard or marketing page.
- Trust is paramount: never fabricate legal content, citations, or verification. The canonical truth lives in the client bundle (documented in `docs/CANONICAL_TRUTH_THREAT_MODEL.md`) and is guarded but **not** secure against inspection.

## 2. Scene principle (from master context §17)

- Viewpoints are **static illustrated backgrounds** with clickable hotspots. The master context explicitly says the visual approach is "not 3D and does not require animated frames" and that portraits with expression variants are sufficient — **no animation is required**.
- Current implementation: decorative SVG stage set in a 16:9 frame (`src/app/SceneArt.tsx`, `aria-hidden`), with real labelled hotspot buttons rendered below it in the DOM. Preserve this accessible pattern.
- Brass/gold tags, soft vignette, and hotspot hover accents are appropriate; camera pans, warps, spirals, auto-rotating rooms, or particle effects are **not** part of the agreed product.

## 3. Work surfaces

The workspace has 11 selectable work panels plus a completion view (`PANELS` / `PANEL_LABELS` in `src/app/App.tsx`):

| Panel         | Plain-language label | Purpose                                                         |
| ------------- | -------------------- | --------------------------------------------------------------- |
| `case`        | case file            | Case overview, facts, parties, known/player knowledge           |
| `assignments` | assignments          | Objectives, status, deadlines, progression                      |
| `evidence`    | evidence board       | Discover/review evidence, add contradiction/corroboration notes |
| `casework`    | casework             | Custody observations, admissibility challenges                  |
| `theory`      | case theory          | Theory claims and supporting evidence                           |
| `research`    | research             | Source intake and verification, citation handling               |
| `draft`       | draft editor         | Draft text, versions, feedback submission                       |
| `notebook`    | notebook             | Player-authored notes, connections, filtered list               |
| `journal`     | timeline             | Chronological record of actions                                 |
| `dialogue`    | conversations        | Mentor/character conversations                                  |
| `ai`          | local AI lab         | Optional local AI tooling (hidden when disabled)                |
| `completion`  | chapter summary      | End-of-chapter summary and final brief                          |

Each panel should be scannable in one pass: a clear heading, a short helper line, and primary actions visible without hidden state. Recommended-next-panel guidance is shown in the panel nav with a gold dot.

## 4. Visual language

- **Palette** (`tailwind.config.js`): `bar.bg #0f1115`, `bar.panel #171a21`, `bar.panel2 #1e2430`, `bar.gold #c8a75a`, `bar.goldSoft #d8bd7a`, `bar.text #e8e2d5`, `bar.muted #a8a195`, `bar.danger #d66`, `bar.line rgba(200,167,90,0.18)`.
  - Gold = authority, active state, final action. Amber = caution. Green = verified. Red = danger. Never encode meaning by colour alone — pair with text/icons.
- **Typography**: Cormorant Garamond for display headings (`font-display`), Source Sans 3 for body (`font-body`), with system fallbacks. Keep legal terms plain; avoid whimsical copy ("Kudos!", "Let's go!").
- **Surfaces**: panels use a subtle shadow (`shadow.panel`) and 1px low-contrast borders; selected/recommended states use gold ring/left border rather than large colour blocks.
- **Spacing**: Tailwind 4px baseline / 8px rhythm is sufficient. Keep panel padding at 16px, gaps at 8–24px; avoid new spacing tokens unless a real need appears.
- **Density**: this is a text-heavy professional tool. Prefer readable hierarchy over packed data walls; keep critical status visible on mobile.

## 5. Accessibility & interaction (existing baseline to preserve)

- Visible 2px gold `:focus-visible` outline on buttons, links, inputs, selects, textareas, and `[role="button"]` (`src/styles/index.css:38-46`).
- Skip link becomes visible on focus (`:48-61`); main content has `tabIndex={-1}` focus management.
- `aria-current="true"` marks the active in-page panel — not `aria-current="page"` (panels are workspaces, not routes).
- Async feedback (save status, notices, dialogue) uses `role="status"` / `aria-live="polite"`; conflicts use `role="alert"`.
- All interactive affordances are real `<button>`/`<a>`/form controls with explicit `type="button"` where appropriate; decorative SVG is `aria-hidden`.
- Touch targets: coarse-pointer min-height 44px rule is present.
- Long unbroken content (URLs, citations, provenance) must use `overflow-wrap:anywhere` + `min-w-0` to avoid mobile horizontal overflow (Phase 10.6 fix).

## 6. Motion boundaries

- The global `prefers-reduced-motion: reduce` guard disables animations/transitions and smooth scrolling (`src/styles/index.css:148-156`). Any new JS movement (e.g. `scrollIntoView`) must check `matchMedia` and use `behavior: 'auto'` under reduced motion.
- Acceptable, restrained motion: short (100–200ms) colour/transform transitions on hover/focus, one-shot gold emphasis on a newly saved artifact, subtle card entrance on first panel render.
- Not acceptable: autoplay tails, warp/spiral transitions, timed ambient loops, auto-rotating viewpoints, or any motion implying player agency that the game does not provide.

## 7. Voice & tone

- Strict professional register: short sentences, plain legal terms, explicit "verify before relying on this" framing.
- Buttons use verbs: _submit, re-file, challenge, record, review, save_. Labels name the artifact, not an abstract action.
- Never imply that player notes or AI output are authoritative legal knowledge.

## 8. Verification expectations

Any UI change must preserve:

- `npm run verify` green (currently 51 files / 467 tests, lint 0 errors / 7 pre-existing fast-refresh warnings, format/typecheck/build clean).
- Desktop 1440×900 and mobile 390×844 with no horizontal overflow and no console/page errors.
- Keyboard focus order, skip link, panel nav, save/status live regions, and reduced-motion behaviour.

## 9. Not adopted

An external draft proposed design/animation specs citing `ApplicationChannel.tsx`, `_ApplicationChannel_ChatContainer.tsx`, `_SectionLockstep.tsx`, `GlobalContinuousAnimation.tsx`, `usePreventBounce.ts`, and `_GamePrototype5GenerateWorld.tsx`. None of these files exist anywhere in this repository. That draft also contained garbled tokens and proposed warp tails, jump spirals, mesh-gradient ambiance, and auto-rotating rooms, which conflict with master context §17 (static scenes, no animation required) and the prototype-stabilization constraint. No code or docs from that draft were implemented; only the repo-grounded sections above were retained.
