# PRD Gap Audit - The Negotiation Table

**Date**: 2026-11-23  
**Source**: `docs/MASTER-ORCHESTRATOR-PRD.md`, `PRD.md`, `ROADMAP.md`, code/tests

## Summary
MVP is implemented and verified. Most PRD requirements are met. Remaining items are polish/operator-dependent.

## Met (evidence)
- **5-phase flow**: Case Select, Two-Sided Briefing, Preparation, Negotiation Room, Debrief — `src/client/components/*`, `App.tsx`.
- **3 distinct cases, 4-5 participants**: `src/server/cases/acquisition.ts`, `fragile-peace.ts`, `walkout.ts`.
- **Two-sided briefing, info classification verified/reported/unknown, no hidden secrets pre-debrief**: `CaseBriefing`, `BriefingView.tsx`, briefing DTO excludes private fields.
- **Preparation fields stored**: objectives, BATNA, reservation point, opening position, leverage, concessions, questions, predictions, strategy — `PreparationView.tsx`, session persistence.
- **Static negotiation room**: portraits/seats, group/individual target, chat transcript, structured offer builder, accept/reject/withdraw, walk away/finalize — `RoomView.tsx`.
- **Deterministic engine authority**: offers/agreements/trust/outcomes/debrief computed by engine; chat "I accept" not sufficient alone — `src/server/engine/*`, tests.
- **AI simulation layer + fallback**: provider abstraction, structured intents, deterministic fallback labeled — `src/server/ai/*`, `RoomView` badge.
- **Debrief**: agreement/failure, objectives met, concessions, unresolved issues, trust changes, key moments, mistakes/missed opportunities, hidden reveals, alternatives, skill assessment with evidence — `debrief.ts`, `DebriefView.tsx`.
- **Decision quality separated from outcome quality** — `debrief.ts`, `DebriefView.tsx`.
- **Contextual concept teaching** (NEG-013): BATNA/reservation, anchoring, ZOPA/information asymmetry, signalling/bluff detection, strategic concessions/game theory, cognitive biases/pressure — evidence-based in debrief.
- **Persistence**: SQLite `node:sqlite`, migrations, session resume.
- **Tests/CI**: typecheck PASS, 33/33 vitest PASS, build PASS, CI workflow present.

## Partial / polish opportunities
- **Realistic room polish**: functional static room exists and has been polished (NEG-014). Further immersion is subjective polish, not an MVP blocker.
- **Live LLM E2E**: env-dependent; local Cloud Shell CPU too slow for reliable live inference. Deterministic fallback verified; provider supports local/ollama without API key.

## Closed in this pass
- **Prediction evaluation (NEG-015/NEG-017)**: prep predictions stored; debrief now includes explicit "Your predictions vs. what happened" calibration panel plus evidence-based concept lesson.
- **First-time onboarding (NEG-017)**: dismissible "How a negotiation works" cue on case select clarifies the full flow for first-time players.

## Not in MVP (by design)
Multiplayer, career progression, campaigns, 3D/animated characters, medieval settings, complex reputation, excessive gamification, unnecessary social features.

## Next recommended work
1. Operator live LLM playtest on faster machine/API key (configure `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_URL`).
2. Optional operator deployment hardening/TLS; no deploy/push without explicit approval.