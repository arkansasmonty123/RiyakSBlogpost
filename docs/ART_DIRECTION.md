# THE BAR — Art Direction & Asset Provenance (DRAFT)

**Status:** 🟡 **DRAFT — pending owner decisions. Not an approved art direction.**  
**Date:** 2026-11-22  
**Owner (to assign):** Product / Design, with Legal for asset rights  
**Related decisions:** D-002 (visual style — Unknown), D-012 (asset rights/licensing — Unknown), D-018 (content/asset licence — Unknown) in [`DECISIONS.md`](./DECISIONS.md).  
**Scope:** Placeholder guidance for the P0 illustrated 2D scene prototype. Nothing here authorises production art or the introduction of third-party assets.

---

## 1. Current state (evidence-based)

- The prototype uses **only in-repo CSS/SVG placeholder art** (`src/app/SceneArt.tsx`, `src/styles/index.css`). There are **no external image assets, no downloaded art pack and no final style guide**.
- Scene data is declarative in `src/domain/scenes.ts`: **2 locations** (Senior Chamber, Office Reception) and **8 static viewpoints**, each with labelled hotspots. `SaveGame.selectedViewpoint` persists only a viewpoint id.
- The illustrations are decorative. Every interactive object is rendered as a real, labelled HTML button in `App.tsx`; art must never be the only way to act.
- Therefore this document is a **placeholder style guide and a checklist to be completed**, not a record of cleared rights.

## 2. Candidate style direction (for review — NOT approved)

A single coherent direction must be chosen before any final asset is produced. The current prototype leans toward a restrained, editorial 2D look:

- **Candidate:** flat, layered 2D interiors with graphic-novel clarity; architectural silhouettes, warm brass accents on cool slate, muted paper tones. No photorealism, no anime exaggeration, no 3D render unless a future owner decision explicitly changes direction.
- **Rationale (candidate only):** supports read-at-a-glance hotspots, stays cheap to author, and avoids depicting facts that could be mistaken for evidence.
- **Alternatives still open:** stylised realism, full graphic novel, painted realism. No choice is approved until D-002 is resolved and recorded.

### Composition rules (apply to any chosen direction)

- One location per viewpoint; a consistent vanishing line and eye level across viewpoints in the same location.
- Keep **equal edges / safe margins**: never place important detail or a hotspot in the outermost 5% of the frame; support desktop and mobile widths.
- Reserve a clear text/button zone beneath the artwork; the illustration is decorative and must not carry essential information by itself.
- Lighting is architectural and consistent (desk lamp, window, corridor); do not use lighting or symbols to hint at guilt, authenticity or hidden events.
- Respect `prefers-reduced-motion`: the current prototype is static; any future motion must have a reduced-motion fallback.

### Palette (current prototype values — provisional)

| Role                          | Hex                                           | Source                               |
| ----------------------------- | --------------------------------------------- | ------------------------------------ |
| UI background                 | `#0f1115`                                     | `tailwind.config.js` → `bar.bg`      |
| UI panel                      | `#171a21`                                     | `tailwind.config.js` → `bar.panel`   |
| Panel inset                   | `#1e2430`                                     | `tailwind.config.js` → `bar.panel2`  |
| Accent / brass                | `#c8a75a`                                     | `tailwind.config.js` → `bar.gold`    |
| Body text                     | `#e8e2d5`                                     | `tailwind.config.js` → `bar.text`    |
| Muted text                    | `#a8a195`                                     | `tailwind.config.js` → `bar.muted`   |
| Wood / paper / teal / oxblood | `#6b5138` / `#ddd5c3` / `#456267` / `#63393b` | `src/app/SceneArt.tsx` local palette |

Any final direction may revise these values, but contrast for text and controls must meet WCAG AA and be re-checked after a palette change. Keep the distinction between _decorative_ art colours and _functional_ UI colours documented.

## 3. Character reference rules

- Portraits use the fixed expression set in `src/domain/types.ts`: `neutral`, `thinking`, `smiling`, `disappointed`, `angry`, `surprised`. Any new expression requires a save-compatible addition, not a silent rename.
- Each character keeps a consistent identity across viewpoints and expressions (silhouette, hair, clothing palette, distinctive prop). Build one reference sheet per character before producing variants.
- **Knowledge boundaries are a content rule, not an art trick.** A character's image and expression must not reveal what they know, what they did, or any canonical case truth. Expressions convey mood only.
- Do not depict a real, identifiable person without their consent and a recorded licence. Prefer fictional, original designs.
- No character art may encode canonical authenticity, responsibility, or the content of privileged conversations.

## 4. Environment reference rules

- Maintain one reference sheet per location (chamber, reception) covering floor plan, sightlines, fixed furniture and light sources, so the 8 viewpoints remain recognisably the same place.
- Depict only generic office props (desk, files, books, window, corridor, waiting area, consultation room). Do **not** draw a readable document, clip, report or message that asserts a case fact; anything case-related stays in the player-facing UI panels.
- Hotspots are data in `scenes.ts`. Adding art must not change hotspot ids or action strings without updating the data and tests.
- Keep the no-leak guardrails intact: art assets and their filenames/metadata must not contain canonical-truth labels (e.g. hidden motives, authenticity results, "who moved first").

## 5. Asset licensing & provenance checklist (to complete before any asset is added)

For **every** image, portrait, texture, sound or font introduced, record an entry in an asset manifest (create `docs/ASSET_MANIFEST.md` when the first external asset is added) with:

- [ ] Asset id, filename, and where it is used (location/viewpoint/character).
- [ ] Origin: **original in-repo**, **licensed third-party**, or **AI/generative output**. State which; do not leave blank.
- [ ] Author / publisher name and a stable source URL (if third-party).
- [ ] Licence name and a saved copy or link to the licence text; confirm it permits the intended use (including modification and redistribution with the game).
- [ ] Date acquired, version/revision, and any modifications made (list them).
- [ ] Attribution text to display if the licence requires it.
- [ ] Confirmation that no personal data, secret, credential or canonical-truth information appears in the file, filename or embedded metadata.
- [ ] Reviewer name and date (a human sign-off; the game never infers clearance).
- [ ] `npm run typecheck`, `npm test` and a visual check at desktop and mobile widths after integration.

**Prohibited until cleared:** unlicensed scraped images, photos of real people without consent, assets whose licence forbids redistribution, and generated assets whose output rights are unresolved. No asset may be described as "verified" or "licensed" without the recorded evidence above. This mirrors the legal-source rule: status is a human act, not a guess.

## 6. Open decisions / follow-up

| Item                                          | Status       | Owner            | Needed before                                |
| --------------------------------------------- | ------------ | ---------------- | -------------------------------------------- |
| Choose final visual style (D-002)             | Unknown      | Product / Design | Any final scene/character asset              |
| Approve asset rights + licence policy (D-012) | Unknown      | Design / Legal   | Importing any third-party or generated asset |
| Decide repo/content/asset licence (D-018)     | Unknown      | Product / Legal  | Public release                               |
| Assign named art owner and reviewer           | Not assigned | Product          | Asset sign-off                               |
| Create asset manifest and style sheets        | Not started  | Art owner        | First external asset                         |

**Verification note:** As of this draft, no external assets exist, so there are no licences to verify and no rights have been claimed. This document will be revised when D-002/D-012/D-018 are resolved; until then it is guidance only.
