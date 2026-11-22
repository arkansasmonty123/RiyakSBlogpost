# ADR-002 — P0 Vertical Slice Scope

- **Status:** Accepted (pragmatic default)
- **Date:** 2026-11-22
- **Owners:** Orchestrator (under user-granted autonomy)
- **Related decisions:** D-015, D-019, ADR-001

## Context

Master context defines a large product. We need a small, testable first slice while maintaining >2 GB available storage in the home/project environment.

## Decision

Build **"The First Brief — Office Prototype"** as P0:

### In scope

- Mobile-first web UI with one illustrated-style scene prototype (can start with placeholder/static composed backgrounds).
- 1 senior chamber location, 4 viewpoints, 5 hotspots, 1 character with expression variants.
- In-game clock + save/load (SQLite/file-backed).
- 3–5 active characters with basic identity, role, knowledge boundaries, relationship dimensions, event memories.
- 1 small research assignment + 1 principal criminal case intro (first 7-10 in-game days playable).
- Canonical truth separation: canonical truth / character knowledge / player knowledge / allegations / admissible material / unresolved ambiguity.
- 3–5 evidence interactions; player notebook.
- One editable draft artifact + deterministic rubric feedback.
- Runtime AI interface stubbed/disabled by default; no fabricated legal citations.
- Verified legal source model with provenance fields; seed only minimal required references, marked verified/unverified appropriately.

### Out of scope (P0)

- Full courtroom hearings, opposing counsel AI, firm economy, advanced litigation.
- Local/bundled AI models, large RAG corpus.
- Audio/video/animation.
- Multiplayer/accounts/cloud sync.
- Personal life/romance.

## Consequences

- Validates core architecture seams early.
- Requires disciplined stubs and clear "not implemented" labeling.
- Content must be fictional and legally careful; no fabricated citations.

## Verification

- End-to-end playable loop.
- Save/load and clock tests.
- Canonical truth no-leak tests.
- No fabricated citation display.
- Home/project environment keeps >2 GB available storage.
