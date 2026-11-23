# Design Contract - The Negotiation Table

> **Status**: MVP baseline implemented; UI polish pass applied (2026-11-23).  
> **Goal**: Realistic-feeling negotiation table without 3D/animation bloat.

## 1. Design principles

- **Clarity before spectacle**: players must understand role, stakes, who is speaking, and what changed.
- **Static realism**: meeting-room feel through composition, lighting, portraits, materials, and typography - no 3D engine.
- **Trustworthy simulation cues**: clearly distinguish verified/reported/unknown intelligence and deterministic fallback vs LLM-generated content.
- **Evidence over vibes**: debrief and skills show concrete evidence; decision quality separated from outcome quality.
- **Responsive and accessible**: usable at 375px width and desktop; keyboard/focus/labels/live status.

## 2. Visual direction

- Tone: tense, professional, human; "serious strategy room", not gamified arcade.
- Palette: dark room base with warm table/spotlight accents; high-contrast text; semantic badge colors for verified/reported/unknown/fallback.
- Typography: readable UI sans for controls/body; distinctive but legible display treatment for headings/case titles.
- Surfaces: cards/panels with subtle depth; clear separation between briefing, chat, offer controls, and debrief evidence.

## 3. Core screens

### Case Select
- Case cards with title, context, difficulty/time/participant metadata, skills focus, start CTA.
- Short product framing: negotiate with real people, not dialogue trees.

### Two-Sided Briefing
- Split/structured view: **Your Side** and **Opposing/Intelligence**.
- Info badges: `verified`, `reported`, `unknown`.
- Explicit boundary note: no hidden secrets/private motivations revealed before debrief.

### Preparation
- 9 structured fields: objectives, BATNA, reservation point, opening position, leverage, concessions, questions to investigate, predictions, initial strategy.
- Save and enter room; values persist in session.

### Negotiation Room
- Top/side participant strip: portraits, name, role, short presence cue.
- Transcript: group chat style; speaker identity clear; targeted messages visible.
- Composer: natural-language input, target selector (group/individual), send.
- Structured controls: offer/counteroffer builder, accept/reject/withdraw where valid, walk away.
- Status: phase, turn/connection indicators as needed, deterministic fallback badge when applicable.

### Debrief
- Outcome summary and agreement/failure state.
- Decision quality and outcome quality shown separately.
- Sections: objectives met, concessions, unresolved issues, trust/credibility changes, key moments, mistakes/missed opportunities, hidden reveals (post-completion), alternative approaches, skill assessment with evidence.

### Skills
- Cross-case skill summary with evidence counts/labels; no arbitrary unexplained scores.

## 4. Interaction & motion

- Subtle transitions only (panel/tab/message entry, button feedback). No heavy animation dependency.
- Reduced-motion: respect `prefers-reduced-motion`.
- Loading/error/empty states for case load, session create, message send, LLM fallback, finalize/debrief.

## 5. Accessibility

- Semantic landmarks/headings/labels.
- Visible focus states; keyboard-operable controls.
- Live region/status for async send/processing where appropriate.
- Color not sole meaning carrier (badges include text).
- Touch targets and mobile layout at 375px width.

## 6. Content/style rules

- No "AI slop" filler or fake certainty. Copy should be direct and situational.
- Never present deterministic fallback as LLM output.
- Never leak hidden motivations/private info in briefing/room UI; hidden reveals only in debrief as engine-provided.
- Assessment language must cite observed actions/evidence.

## 7. UI polish pass (2026-11-23)

- **Visual system**: Refined dark strategy-room palette (warm charcoal/wood/amber), stronger surface hierarchy, consistent radius/shadow tokens, and loaded typography (Newsreader display, IBM Plex Sans UI) with system fallbacks.
- **Room realism**: Static meeting-room composition enhanced with ambient lamp glows, wood-grain/felt table treatment, oval table surface, seat placards with trust chips, and clear transcript/composer separation. No 3D or animation libraries.
- **Clarity preserved**: Deterministic fallback/LLM source badges, verified/reported/unknown info badges, decision vs. outcome quality cards, hidden-reveals boundary, and concept lessons remain prominent.
- **Responsiveness/a11y**: Layout verified at 375px and 1440px with no horizontal overflow. Visible `:focus-visible` outlines, 44px-min touch targets for primary controls, labels/aria-live status, semantic landmarks, and `prefers-reduced-motion` support retained. Forced-colors border fallback added.
- **Contracts**: No backend/shared API or data-shape changes; no dependency additions.
