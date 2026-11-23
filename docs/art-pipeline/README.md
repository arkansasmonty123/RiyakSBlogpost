# Art asset pipeline (Phase 5 — D-002 / D-012 / D-018)

> **Status (2026-11-23): SCAFFOLD + ORIGINAL-PLACEHOLDER PACK READY — OWNER SIGN-OFF PENDING.**
> Folder layout, naming rules, asset specs, the manifest template, a deterministic offline
> validator (`npm run validate:art-manifest`) and the human approval workflow below are in place
> and tested. A **real, non-template manifest** (`asset-manifest.json`) now catalogues a small set
> of **lightweight ORIGINAL in-repo SVG placeholders** in `public/assets/art/` (≈4 KiB total),
> each with an embedded provenance comment and self-attested authorship. **No external,
> third-party or AI-generated art asset has been commissioned, downloaded, imported or approved,
> and no asset is loaded at runtime.** The game still uses the vector-only stage sets in
> `src/app/SceneArt.tsx`. The `status: "approved"` on those asset records means only "approved as
> an original, project-owned placeholder by its author" — it is **not** the named human art-owner
> rights sign-off of §8. Real assets and any runtime integration remain blocked until the owners
> of [D-002 (visual style)](../DECISIONS.md), [D-012 (asset rights)](../DECISIONS.md) and
> [D-018 (content/asset licence)](../DECISIONS.md) decide, a named art owner/reviewer is assigned,
> and each asset passes the approval flow in §8. No visual style, licence or provenance claim is
> approved by this scaffold.

This directory is a **process/tooling scaffold**, not an asset pack. Nothing here is read by the
runtime. It exists so that when the decisions are resolved, a human has a deterministic,
reviewable path from "an asset exists" to "an asset is cleared, attributable and committed
without bloating the repository". The same rule applies as to legal sources: **status is a human
act, never a guess by tooling or AI.**

## 1. Non-negotiables (read first)

- **Keep the placeholders working.** The CSS/SVG stage sets in `src/app/SceneArt.tsx` remain the
  shipped visual until approved assets are integrated behind the same data-driven scene ids.
  Every interactive object is a real labelled HTML button; art is decorative and must never be
  the only way to act.
- **No heavy or unlicensed binaries.** No downloaded art packs, scraped images, photos of real
  people without consent, or generated output with unresolved rights. `.gitignore` blocks binaries
  inside the art folders by default; a final asset requires an approved manifest entry and an
  explicit `git add -f` by the art owner.
- **No fabricated provenance.** Do not write a licence name, author, source URL, checksum or
  approval date from memory or from an AI stub. Record what can be evidenced; otherwise leave it
  blank and keep the asset in `draft`.
- **Templates are not manifests.** `asset-manifest.template.json` carries `"template": true`; the
  validator **rejects** it by design (`npm run validate:art-manifest -- --template` must exit 1).
  Copying the template and filling in example values does not approve anything. The real
  `asset-manifest.json` carries `"template": false` and only self-attested original work.
- **"Approved" originals are not a rights sign-off.** The original SVG placeholders are marked
  `status: "approved"` with `origin: "original"` and CC0/project-owned provenance. This is the
  author's factual attestation that the work was created in-repo with no third-party rights to
  clear — it is **not** a fabricated human reviewer name or a claim that D-002/D-012/D-018 are
  resolved. `approvedBy` explicitly says "self-attested original work; NOT a named human
  art-owner rights sign-off". A human must still follow §8 before any of it is treated as a
  rights-cleared pack or integrated at runtime.
- **No canonical-truth leakage in art or metadata.** Filenames, asset ids, notes and embedded
  metadata must not encode case facts, hidden motives, authenticity results, "who moved first",
  or the content of privileged conversations. See `docs/ART_DIRECTION.md` §3–4 and the no-leak
  guardrails in `src/domain/`.
- **Deterministic and offline.** The pipeline uses only repo-local files and the existing
  toolchain; no download step, no network fetch, no AI call.

## 2. Folder structure

```text
project-courtroom/
├── docs/art-pipeline/
│   ├── README.md                    # this document (process + current status)
│   ├── asset-manifest.template.json # TEMPLATE / NOT AN APPROVED MANIFEST — never ingestible
│   ├── asset-manifest.json          # REAL manifest: original in-repo SVG placeholders only
│   └── intake/
│       ├── draft/     .gitkeep      # working files + provenance notes; non-authoritative
│       └── approved/  .gitkeep      # human-checked files + sign-off notes (only after §8)
└── public/assets/art/
    ├── .gitkeep                     # tracked placeholder; binaries ignored until approved
    ├── props/
    │   ├── chamber/desk-v1.svg      # original in-repo placeholder (provenance comment inside)
    │   ├── chamber/bookshelf-v1.svg
    │   ├── reception/counter-v1.svg
    │   └── consultation/table-v1.svg
    └── ui-icons/evidence-v1.svg     # currentColor placeholder icon
```

- `intake/draft/` — working assets and their source/licence notes. Nothing here is authoritative
  or referenced by the app. Text notes and manifests are tracked; binaries are ignored.
- `intake/approved/` — exact files the named reviewer checked, plus the sign-off note and the
  manifest entry. Only material that passes §8 may be promoted here.
- `public/assets/art/` — Vite serves this folder at `/assets/art/`. It now holds only tiny
  **original SVG placeholders** (`*.svg` is allowed by `.gitignore`); binaries remain ignored
  until approved. Category subfolders for viewpoints/portraits are created on first approved import.
- `asset-manifest.json` (at `docs/art-pipeline/`) **is shipped** for these original placeholders.
  It is a real manifest (`"template": false`), not a licence claim or a rights sign-off. Add any
  third-party/generated asset only by following §8; do not fill fields from memory or AI output.

## 3. Naming conventions

Use lowercase ASCII, hyphens between words, no spaces, no case-only distinctions, and a version
suffix. The asset `id` in the manifest must equal the file path without extension, prefixed by
its category (see examples below).

| Thing       | Pattern                                  | Example                              |
| ----------- | ---------------------------------------- | ------------------------------------ |
| Viewpoint   | `view-<location>-<viewpoint>-v<n>`       | `view-chamber-entrance-v1`           |
| Portrait    | `portrait-<character>-<expression>-v<n>` | `portrait-meera-neutral-v1`          |
| Prop        | `prop-<location>-<object>-v<n>`          | `prop-chamber-desk-lamp-v1`          |
| UI icon     | `icon-<purpose>-v<n>`                    | `icon-evidence-v1`                   |
| File        | `<category>/<subfolder>/<id>.<ext>`      | `viewpoints/chamber/entrance-v1.svg` |
| Manifest id | `<category>-<subject>-<variant>-v<n>`    | `portrait-meera-thinking-v2`         |

- Character ids and expression names come from the domain model (`src/domain/types.ts`:
  `neutral`, `thinking`, `smiling`, `disappointed`, `angry`, `surprised`). Never rename an
  expression silently; save files persist expression ids.
- Viewpoint and location ids come from `src/domain/scenes.ts`. Adding art must not change
  hotspot ids or action strings without updating the scene data and its tests.
- **Never** put a case-truth label, character "secret", authenticity result or reviewer name in a
  filename or asset id.

## 4. Asset specifications

Geometry below follows the current placeholder stage: `SceneArt.tsx` draws an `800 × 450`
viewBox with `preserveAspectRatio="xMidYMid slice"` (safe margins ≈ outermost 5% of the frame).
Confirm/adjust these specs once D-002 is decided.

### 4.1 Viewpoints (scene backgrounds)

- One image per viewpoint id in `scenes.ts`; 2 locations / 8 viewpoints in the current prototype.
- Deliver at a 16:9 base of `1600 × 900` (2× the `800 × 450` viewBox) with a transparent or
  flat-colour safe area; keep the vanishing line and eye level consistent within a location.
- Keep the outermost 5% clear of important detail or hotspot art; the interactive controls are
  separate HTML buttons and must remain visible at desktop and mobile widths.
- Non-readable documents only: no legible text asserting a case fact. Case material belongs in
  the player-facing UI panels.
- Decorative only: `aria-hidden`, `focusable="false"`; no motion unless a reduced-motion fallback
  exists.

### 4.2 Portraits

- One reference sheet per character before variants; keep silhouette, hair, clothing palette and
  a distinctive prop consistent across expressions.
- Deliver a transparent-background bust at `512 × 512` (square) plus a small `96 × 96` avatar
  crop where needed.
- One file per expression from the fixed set in §3; expressions convey **mood only** and must not
  reveal what the character knows or did.
- No real identifiable person without documented consent and a recorded licence; prefer
  original fictional designs.

### 4.3 Props

- Generic office items only (desk, files, books, window, door, corridor, waiting-area furniture,
  consultation table). Deterministic, reusable, transparent background.
- Deliver at a base of `512 × 512` and document the anchor point in the manifest `notes`.
- No readable document, clip, report or message that asserts a case fact.

### 4.4 UI icons

- Monochrome, current-colour (`currentColor`) where possible so the existing Tailwind theme
  (`bar.gold`, `bar.text`, `bar.muted`) controls colour and contrast.
- Deliver a `24 × 24` SVG grid with a `2 px` padding; provide filled and outlined variants only if
  both are used by the UI.
- Icons must never be the sole label for a control — every button keeps an accessible text name
  (see `src/tests/a11ySmoke.test.tsx`).

## 5. Formats and optimisation

| Format | Use                                                                                                | Guideline                                                                                                                                                         |
| ------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SVG    | UI icons, simple flat shapes, line art, current examples in `SceneArt.tsx`                         | Preferred for crisp scaling and tiny size. Strip editor metadata/comments; inline gradients sparingly; avoid embedded raster images and external font references. |
| WebP   | Portraits, complex scenes, props with soft shading                                                 | Preferred raster format. Lossy quality ~80 or lossless for flat art; no EXIF, GPS, ICC bloat or author metadata that could leak information.                      |
| PNG    | Transparent sprites/icons where lossless alpha is required                                         | Use only when WebP alpha is unsuitable; run `pngquant`/`oxipng`-style lossless reduction before import. Avoid PNG for large photographs-like art.                 |
| Avoid  | PSD/AI/XCF/KRA/BLEND source files; WAV/MP3/OGG audio; GIF/APNG animation; JPEG for transparent art | Heavy, difficult to review, or not needed by the P0 prototype. Kept out of the repo by `.gitignore`.                                                              |

- **No font binaries and no audio assets** in Phase 5; the prototype is silent and uses system
  fonts. Any future addition needs its own licence entry and D-012/D-018 sign-off.
- Strip all embedded metadata; prefer original vector sources stored outside `$HOME` (ephemeral
  storage) and commit only the optimised output.

## 6. Optimization budget (soft warnings, not hard failures)

Budgets are recorded in the manifest (`perAssetBudgetBytes`, `totalBudgetBytes`) and checked by
the validator. Defaults are **1 MiB per asset** and **5 MiB for the whole manifest**.

- Target roughly ≤ 200 KiB for a viewpoint, ≤ 80 KiB for a portrait, ≤ 30 KiB for a prop and
  ≤ 4 KiB for an icon at the stated dimensions.
- Exceeding a budget produces a `WARN` (`ASSET_OVER_SIZE_BUDGET` / `TOTAL_OVER_SIZE_BUDGET`);
  the manifest can still be valid, but the warning must be understood and dismissed in the
  sign-off note before approval.
- Keep the whole `public/assets/art/` tree well under the 5 MiB soft total; the game must remain
  mobile-friendly and load quickly on a PWA connection.
- Record the real committed file size in `sizeBytes` and its `sha256:<hex>` checksum in the
  manifest after the final optimised file is written (the checksum must match the committed file).

## 7. Provenance & licensing checklist (per asset)

Every entry in the manifest must answer all of the following. A blank answer keeps the asset in
`draft`; only a named human reviewer may mark it `approved`.

- [ ] `id`, `kind`, `file` and `usedAt` — stable identity, correct category, relative path,
      and where it appears in the game.
- [ ] `origin` — `original`, `licensed-third-party` or `ai-generated`. State it; never leave blank.
- [ ] `license` — exact licence name (or `Original - author-owned` for in-repo original work).
      A saved copy/link of the licence text must exist in the intake notes and permit modification
      and redistribution with the game.
- [ ] `source` — traceable provenance: vendor/pack and stable URL (third-party), the tool and
      prompt/output record (generative), or the source file (original). No fabricated URLs.
- [ ] `author` — author/publisher name as evidenced; use `Unknown` only with an explicit note.
- [ ] `createdDate`, `approvedDate` — `YYYY-MM-DD`; `approvedBy` — a named human reviewer.
- [ ] `checksum` (`sha256:<64 hex>`) and `sizeBytes` of the **final committed file**.
- [ ] `rightsNote` required for `ai-generated` output: confirmation that output rights were
      reviewed (D-012). The validator warns when this is missing.
- [ ] Attribution text recorded if the licence requires it, and reproduced in-game where needed.
- [ ] Confirmation that no personal data, secret, credential or canonical-truth information
      appears in the file, filename, path or embedded metadata.
- [ ] Confirmation that the art carries no authenticity/guilt/hidden-knowledge signal and works
      at desktop and mobile widths with `prefers-reduced-motion`.
- [ ] `npm run typecheck`, `npm test`, `npm run validate:art-manifest -- <manifest>` and a visual
      check pass after integration.

**Prohibited:** unlicensed scraped images, photos of real people without consent, assets whose
licence forbids redistribution, generated output with unresolved rights, and any asset described
as "licensed" or "verified" without the recorded evidence above.

## 8. Review / approval flow

1. **Decide first.** Resolve D-002 (style), D-012 (rights/originality policy) and D-018
   (content/asset licence); record the decision ids/dates in the real manifest's `styleDecision`,
   `rightsDecision` and `licenseDecision` fields. Assign a named art owner and reviewer.
2. **Create reference sheets** (per character and per location) per `docs/ART_DIRECTION.md` §3–4.
3. **Draft** the asset in `intake/draft/` with a `status: "draft"` manifest entry and its
   licence/source notes. Never fill approval fields at this stage.
4. **Optimise** to §5/§6 budgets, strip metadata, compute the final `sha256` and `sizeBytes`.
5. **Validate:** `npm run validate:art-manifest -- docs/art-pipeline/asset-manifest.json` must exit
   `0` (exit `1` = validation failure, `2` = usage/IO error). Understand every `WARN`.
6. **Human review** by the named reviewer: licence text, rights, author/source, no-leak check,
   visual check at desktop and mobile widths, reduced-motion, and a11y (art stays decorative).
7. **Sign off:** set the asset to `status: "approved"` with `approvedDate`/`approvedBy`, move the
   exact file and sign-off note to `intake/approved/`, set the manifest `status` to `in-review`
   then `approved`, and append the sign-off note with reviewer name and date.
8. **Commit** the optimised file (`git add -f` for ignored binaries), the manifest, the licence
   copy/link note and the sign-off note **together**. Re-run the validator; it must still exit `0`.
9. **Integrate** behind the existing scene ids in `src/domain/scenes.ts`; keep hotspot ids and
   action strings unchanged unless the scene data and tests are updated too.

## 9. Cloud Shell / storage constraints (D-019)

- `$HOME` is a **5 GB persistent disk**; we must keep **>2 GB available** (`df -h /home`). The VM
  filesystem outside `/home` (including `/tmp`) is ephemeral and discarded at session end.
- Keep source, docs, manifests and the _final optimised output_ in `$HOME`. Keep heavy authoring
  sources, caches, and re-downloadable tooling outside `/home` (e.g. `/tmp/opencode/...`) with
  symlinks where needed. `node_modules` is already symlinked this way.
- Do not generate, unpack or preview large art/audio batches in the repo. The `.gitignore` rules
  and the soft budgets in §6 exist to prevent accidental growth of the persistent disk.
- Check `df -h /home` and `npm run size:home` before and after any import.

## 10. Commands & validator contract

```bash
# Prove the shipped template is NOT an approved manifest (expected exit code 1):
npm run validate:art-manifest -- --template

# Validate the real manifest of original in-repo SVG placeholders (expected exit code 0):
npm run validate:art-manifest -- docs/art-pipeline/asset-manifest.json
# With no path, that same real manifest is the default:
npm run validate:art-manifest

# Help / usage:
npm run validate:art-manifest -- --help
```

The validator (`src/domain/artManifestValidation.ts`, CLI in `scripts/validate-art-manifest.ts`)
checks manifest shape, required fields, enum/date/checksum/size/path formats, and — for
`status: "approved"` assets — the full provenance set (§7). It **accepts** legitimate in-repo
original records with `origin: "original"` and real checksum/size provenance, and it **rejects** a
template, an approved record missing provenance fields, and duplicate ids/files. It **warns** on
soft size-budget overruns, incomplete drafts, unconfirmed generative rights, an unassigned owner
and unresolved decisions. It never downloads, imports, verifies or approves anything, and it does
not check that a named human actually reviewed a licence — that remains a human act. Key error
codes: `MANIFEST_IS_TEMPLATE`, `MISSING_SCHEMA_VERSION`, `UNSUPPORTED_SCHEMA_VERSION`,
`MISSING_MANIFEST_ID`, `MISSING_ASSETS`, `INVALID_MANIFEST_STATUS`, `APPROVED_MISSING_LICENSE`,
`APPROVED_MISSING_SOURCE`, `APPROVED_MISSING_AUTHOR`, `APPROVED_MISSING_ORIGIN`,
`APPROVED_MISSING_CREATED_DATE`, `APPROVED_MISSING_DATE`, `APPROVED_WITHOUT_REVIEWER`,
`APPROVED_MISSING_CHECKSUM`, `APPROVED_MISSING_SIZE`, `UNSAFE_ASSET_PATH`,
`DUPLICATE_ASSET_ID`, `DUPLICATE_ASSET_FILE`.

## 11. Current status / what is still blocked

- A real manifest, `asset-manifest.json`, **exists and validates** (`npm run validate:art-manifest`
  exits 0). It is `"template": false` and lists only original in-repo SVG placeholders.
- `asset-manifest.template.json` is still a **template**, rejected by the validator by design.
- `public/assets/art/` holds five tiny original SVG placeholders (~4 KiB total), each with an
  embedded provenance comment; `intake/` still holds only `.gitkeep` placeholders. No binary or
  third-party asset is committed, and nothing is loaded at runtime.
- The `status: "approved"` on those assets is a **self-attestation of original authorship**, not a
  named human art-owner rights sign-off. The manifest owner is `null` (the validator emits the
  truthful `NO_ART_OWNER` warning).
- D-002, D-012 and D-018 remain `Unknown`, and no art owner/reviewer is assigned
  ([`../DECISIONS.md`](../DECISIONS.md)). The shipped visuals remain the CSS/SVG placeholders in
  `src/app/SceneArt.tsx`.
- Unblocks full integration only when the owners decide the three items, supply rights-cleared
  original/licensed assets, and sign off using the §8 workflow. See
  [`../ART_DIRECTION.md`](../ART_DIRECTION.md) for the provisional style direction, palette and
  character/environment rules.

## 12. Original in-repo placeholder pack (2026-11-23)

A small set of **original**, lightweight SVG placeholders was drawn in-repo for THE BAR prototype
to demonstrate the §1–§11 pipeline end to end with real (non-template) records. They are decorative
shapes mirroring the existing `SceneArt.tsx` geometry (desk, bookshelf, counter, table) plus one
`currentColor` UI icon. They are **not** a visual-style decision (D-002), **not** a rights policy
decision (D-012), and **not** a repo/content licence decision (D-018).

| id                           | kind    | file                              | bytes | sha256 (prefix) |
| ---------------------------- | ------- | --------------------------------- | ----: | --------------- |
| `prop-chamber-desk-v1`       | prop    | `props/chamber/desk-v1.svg`       |   864 | `6fe71b2e…`     |
| `prop-chamber-bookshelf-v1`  | prop    | `props/chamber/bookshelf-v1.svg`  |  1020 | `da1c47de…`     |
| `prop-reception-counter-v1`  | prop    | `props/reception/counter-v1.svg`  |   817 | `f3f9b701…`     |
| `prop-consultation-table-v1` | prop    | `props/consultation/table-v1.svg` |   815 | `87a59c47…`     |
| `icon-evidence-v1`           | ui-icon | `ui-icons/evidence-v1.svg`        |   537 | `ef68e7e5…`     |

Total: **4 053 bytes** — comfortably inside the §6 soft budgets (well under 1 KiB each, ≪ 5 MiB
total). Full `sha256:<64 hex>` values and `sizeBytes` are recorded in `asset-manifest.json` and were
computed from the committed files.

Provenance policy for these files:

- Each SVG embeds the comment: _"Original in-repo placeholder created for THE BAR prototype; no
  third-party asset; CC0/project-owned by default for this repo"_.
- `origin: "original"`, `license: "CC0-1.0 (original in-repo work, project-owned; no third-party
rights)"`, author = "THE BAR prototype (in-repo author)".
- **No third-party artwork, no downloaded pack, no scraped image, no real identifiable person and
  no generative/AI output** is involved. No licence or reviewer name is claimed from memory.
- `approvedDate` is the creation date; `approvedBy` is an explicit self-attestation that names no
  human reviewer and states that the §8 sign-off is still pending. The manifest owner is `null`.
- No legible case text, no canonical-truth/authenticity/guilt signal, no personal data, no motion
  and no remote references are embedded; files are `aria-hidden` and `focusable="false"`.
- They are **not wired into the app at runtime** (`SceneArt.tsx` remains the shipped, inline-vector
  stage). Integrating them later must follow §8 and keep hotspot ids/action strings unchanged.

Verify with:

```bash
npm run validate:art-manifest                                      # default real manifest → exit 0
npm run validate:art-manifest -- docs/art-pipeline/asset-manifest.json
npm run validate:art-manifest -- --template                        # rejected → exit 1
grep -c "Original in-repo placeholder created for THE BAR" public/assets/art/**/*.svg
```
