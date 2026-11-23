# The Negotiation Table - PRD

> **Status**: Active MVP definition  
> **Last updated**: 2026-11-23  
> **Constraint**: Keep project directory under **500 MB** total (including node_modules).

## 1. Product vision

The Negotiation Table is an AI-powered negotiation, strategy, and human-intelligence simulation. Players negotiate with AI participants who feel like actual people, not dialogue-tree NPCs.

**Skills trained**: negotiation/persuasion, critical thinking/skepticism, deception/bluff detection, strategic bluffing/information management, incentives/human behavior, group dynamics/power structures, calculated concessions, uncertainty/pressure, compromise vs walk-away judgment.

**Core experience**: realistic-looking static meeting room with participant portraits and group-chat-style negotiation interface. No 3D/animation required.

## 2. Core gameplay loop

### Phase A - Assignment & Case Selection
- Player receives negotiation cases.
- Each case: realistic context, defined player role, stakes/objectives, multiple participants, meaningful conflict of interests, possible outcomes beyond simple win/loss.

### Phase B - Two-Sided Briefing
- Player understands BOTH sides before entering negotiation.
- **Player briefing**: role, objectives, constraints, resources/leverage, priorities, private information, minimum acceptable outcome.
- **Opposing briefing**: stated demands, known interests, available intelligence, apparent constraints, relevant participants, known relationships/power structures.
- **Information classification**: `verified`, `reported`, `unknown`. Do not reveal every secret/hidden motivation.

### Phase C - Preparation
- Player defines: objectives, BATNA, reservation point, opening position, leverage, potential concessions, questions to investigate, predictions about opposing side, initial strategy.
- Store assumptions for debrief evaluation.

### Phase D - Negotiation Table (core)
- Static meeting room, participant portraits/names/roles.
- Group-chat conversation; select individual participant or address whole group.
- Natural-language text input. Distinct personalities/reactions.
- Player can: make offers/counteroffers, ask questions, challenge claims, persuade, compromise, withhold information, bluff strategically, detect possible bluffs, remain silent, introduce new information, walk away.
- **Not a predetermined dialogue tree**.
- AI participants have independent interests, personalities, knowledge, secrets, constraints, relationships.
- Not every character responds to every message; generate meaningful, contextually appropriate reactions.

### Phase E - Debrief
- Final agreement/failure; objectives met? concessions by both sides; unresolved issues; trust/credibility changes; important moments; mistakes/missed opportunities; hidden motivations/information where applicable; alternative approaches; skill assessment with evidence.
- **Evaluate decision quality separately from outcome quality**.

## 3. First three cases (MVP)

### Case 01 - The Acquisition
- Player represents financially struggling company negotiating acquisition by larger corporation.
- Focus: anchoring, leverage, information management, bluff detection, conditional offers.
- 4-5 distinct participants, coherent objectives, private knowledge, constraints, multiple plausible outcomes.

### Case 02 - The Fragile Peace
- Player represents one side in multi-party diplomatic negotiation between neighbouring states.
- Focus: alliances, competing interests, diplomacy, coalition building, compromise.

### Case 03 - The Walkout
- Player negotiates between management and employees threatening a strike.
- Focus: skepticism, emotional intelligence, questioning, power dynamics, creative agreements.

Cases must not feel like reskins.

## 4. Learning system

- Track evidence across: negotiation, questioning/skepticism, bluff detection, strategic communication, information management, reading incentives, emotional control, strategic concessions, critical thinking, decision-making under uncertainty.
- Teach contextually: BATNA, ZOPA, anchoring, reservation prices, information asymmetry, signalling, game theory, cognitive biases, prisoner's dilemma.
- Do not reward lying indiscriminately. Distinguish concealment, strategic ambiguity, credible signalling, bluffing.
- Every assessment grounded in actual player actions; no arbitrary unexplained scores.

## 5. Technical architecture (critical)

### Two cooperating systems
1. **AI simulation layer**: character dialogue, personality/behavior consistency, intent interpretation, persuasion/pressure reactions, private knowledge/interpersonal dynamics.
2. **Deterministic game engine**: offer/counteroffer tracking, agreement validation, commitments/concessions, trust/credibility, objectives/constraints, outcome determination, debrief data.

**LLM is NOT sole authority over game state.** "I accept" in chat does not automatically create agreement; engine validates terms and required-party agreement.

- Structured scenario state, structured offers, explicit negotiation events.
- Consistency between transcript and game state.
- Shared model infrastructure with separate character context; generate only meaningful reactions.

## 6. MVP boundaries

### Prioritize
1. Complete case selection
2. Two-sided briefing
3. Preparation
4. Static negotiation room
5. Distinct AI participants
6. Natural-language group chat
7. Offers and counteroffers
8. Structured negotiation state
9. Agreement and consequence handling
10. Detailed debrief
11. Basic cross-case skill tracking

### Defer
Multiplayer, elaborate career progression, complex campaigns, 3D rooms, animated characters, medieval settings, complicated reputation systems, excessive gamification, unnecessary social features. Design architecture so these can be added later.

## 7. Quality requirements

- Actually playable, persistent where required.
- Consistent across conversation and game state.
- Responsive on mobile.
- Understandable to first-time players.
- Cost-conscious in AI usage.
- Testable.
- Reliable when LLM call fails or returns malformed data.
- No fake hardcoded responses presented as AI simulation; deterministic fallbacks clearly separated.
- Test complete player journey, not just isolated functions.

## 8. Definition of success

A new player can: open app -> select case -> read both briefings -> prepare strategy -> enter realistic negotiation room -> talk naturally with multiple distinct AI participants -> make offers/counteroffers/strategic decisions -> reach agreement/fail/walk away -> receive meaningful evidence-based debrief -> understand what to improve. Experience should make player want to try another negotiation with different strategy.
