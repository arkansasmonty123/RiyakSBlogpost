# ADR-004: Courtroom Simulation Framework (Planning)

## 1. Objective

Plan a future courtroom subsystem for THE BAR that gives the player structured, deterministic interactions with the judicial system — filing, hearings, arguments, objections, judicial questions, final arguments, judgments — without implementing real procedural claims without verified legal sources and human review.

The framework gives the player meaningful choices, strategy adaptation, and feedback — all player-legible and clearly separated from any real-world legal authority.

## 2. Non-negotiable constraints (from ADR-001/PRD)

- **Never fabricate legal provisions, judgments, quotations or procedural rules.**
- **Never present internal summaries as official legal authority.**
- **Canonical truth remains separate from player knowledge** — the court subsystem must not expose hidden events, motives, or authenticity findings.
- **AI may assist language/reasoning but never controls outcomes, deadlines, verdicts, or state changes.**
- **Deterministic code controls:** career progression, money, deadlines, time advancement, evidence unlocking, case state, relationship state persistence, save operations, source validation, legal citation verification.
- **AI is disabled by default** until safety/gate checks pass; experience must work through deterministic fallback.

## 2. Planned interactions (future implementation, not this ADR)

### Filing and preliminary hearings

- Filing a case with a complaint/summary.
- Preliminary/ bail hearings where the player presents core facts.
- Judicial questions that test the player's core claims.

### Examination and cross-examination

- Examination-in-chief: player presents witnesses/evidence.
- Cross-examination: opposing counsel tests the player's case.
- Re-examination: player rehabiltates their own witnesses.
- Objections (sustained/overruled) with rationale.

### Written and oral submissions

- Written submissions: player drafts legal memos (player-legible only).
- Oral arguments: player makes opening/closing statements.
- Judicial questions during argument.

### Judgments and appeals

- Judgment: player receives a structured feedback narrative (no raw procedural text).
- Appeal: player can identify grounds and submit a brief (again, player-legible).

## 3. Player-legible mechanics (deterministic, AI-assisted only)

### Case strength assessment

- The player receives structured feedback on their case after court interactions.
- Strengths are labeled (e.g. "strong witness credibility", "clear documentary evidence") — never "you will win".
- Gaps are labeled (e.g. "missing corroborating witness", "uncertain timeline").

### Strategic approach selection

- Before key hearings, the player selects a strategic approach from available options:
  - `confrontational`, `diplomatic`, `technical`, `investigative`, `negotiatorial`
- The approach chosen affects the feedback received and the consequences flagged.
- Approaches are linked to the `StrategicApproach` type already defined in `src/domain/types.ts`.

### Consequence flags

- After a court interaction, certain `ConsequenceRecord` entries may be triggered based on:
  - The player's approach.
  - The strength/fit of their evidence.
  - Hidden motive considerations (from the Phase 5 intelligence layers).
- Consequences are player-legible outcomes (e.g. "reputation gain", "client loss", "professional discipline") — not verdicts.

## 4. AI roles (optional, opt-in behind flags)

- **Judge simulation**: provides structured feedback on the player's submissions, never cites real law, always defers to verified source provenance when mentioning legal concepts.
- **Opposing counsel**: has an independent case theory accessible only to information legitimately available to them (player-discovered evidence, no canonical truth leakage).
- **Legal researcher**: retrieves only approved internal summaries (from the legal knowledge infra); never fabricates citations.

## 5. What this ADR does NOT do

- ❌ Implement real procedural claims (filing rules, evidence admissibility standards, judgment forms).
- ❌ Cite real statutory provisions or case law as authoritative.
- ❌ Expose canonical truth through the court UI.
- ❌ Make AI-generated verdicts or case outcomes authoritative.
- ❌ Skip the human legal review gate for any real procedural text.

## 6. Implementation roadmap (future ADRs)

- **F1**: Define the court interaction DTO/schema (filing, hearing transcript, judgment summary).
- **F2**: Build the court UI component (modals, transcript panel, judgment display).
- **F3**: Wire the court subsystem into the assignment/review loop (a case reaches court after assignment completion).
- **F4**: Add structured post-court feedback (strengths/gaps/strategic recommendations).
- **F5**: After verified legal corpus is ready (Track D/E complete), add optional AI-assisted argument drafting with full provenance gates.

## 7. Current state

- All prior ADRs (001–003) and supporting docs (AI gateway, legal knowledge infra) are implemented.
- Phase 5 intelligence layers (authenticity, hidden motives, ambiguities, consequences) are in `src/domain/types.ts` and ready to be referenced by the court framework.
- No courtroom code or UI exists yet; this ADR serves as the planning/design artifact.

## 8. Acceptance criteria (for when implementation begins)

- Court interaction DTO is defined with pure player-legible fields.
- UI renders court modals with accessible markup; no legal text is hardcoded or authoritative.
- AI roles (if enabled) pass all provenance/citation/canonical-truth gates.
- Consequence flags reference the `ConsequenceRecord` type from Phase 5.
- Judgment summary never contains raw procedural text or real-case citations.
- Player can select a strategic approach and receive structured feedback tied to that choice.
- Save/load roundtrip preserves court interaction state.
