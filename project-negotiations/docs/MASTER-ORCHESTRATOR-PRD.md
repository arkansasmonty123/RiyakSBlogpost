MASTER ORCHESTRATOR PROMPT — THE NEGOTIATION TABLE

You are the lead orchestrator responsible for turning The Negotiation Table into a functional, polished, genuinely engaging application.

Your responsibility is not merely to plan or discuss the product. You must coordinate specialist agents, inspect the existing project, make architectural decisions, implement the application, test it, identify weaknesses and continuously improve it.

Operate autonomously wherever possible. Delegate parallelizable tasks, coordinate dependencies, review agent outputs and resolve integration problems.

1. PRODUCT VISION

The Negotiation Table is an AI-powered negotiation, strategy and human-intelligence simulation.

Its purpose is to help players become better at:

- Negotiation and persuasion.
- Critical thinking and skepticism.
- Detecting deception and bluffs.
- Strategic bluffing and information management.
- Understanding incentives and human behaviour.
- Reading group dynamics and power structures.
- Making calculated concessions.
- Managing uncertainty and pressure.
- Recognising when to compromise and when to walk away.

The player should feel like they are negotiating with actual people, not selecting dialogue options in a conventional game.

The central experience is a realistic-looking, static meeting room with participant portraits and a group-chat-style negotiation interface.

The room does not need 3D graphics or animation.

2. CORE GAMEPLAY LOOP

Build the experience around five phases.

Phase A — Assignment and Case Selection

The player receives negotiation cases.

Each case must have:

- A realistic context.
- A defined player role.
- Stakes and objectives.
- Multiple participants.
- A meaningful conflict of interests.
- Possible outcomes beyond simple victory or defeat.

Phase B — Two-Sided Briefing

Before entering the negotiation, the player must understand BOTH sides.

Player briefing:

- Their role.
- Their objectives.
- Their constraints.
- Their resources and leverage.
- Their priorities.
- Their private information.
- Their minimum acceptable outcome.

Opposing briefing:

- The other side's stated demands.
- Known interests.
- Available intelligence.
- Apparent constraints.
- Relevant participants.
- Known relationships and power structures.

Information must be distinguished as:

- Verified.
- Reported.
- Unknown.

Do not reveal every secret or hidden motivation. Participants may have incomplete information, mistaken assumptions and private incentives.

Phase C — Preparation

Allow the player to define:

- Objectives.
- BATNA.
- Reservation point.
- Opening position.
- Leverage.
- Potential concessions.
- Questions to investigate.
- Predictions about the opposing side.
- Initial negotiation strategy.

Store the player's assumptions so that the debrief can evaluate them.

Phase D — The Negotiation Table

This is the most important part of the product.

Interface requirements:

- Realistic static meeting room.
- Participant portraits, names and roles.
- Group-chat-style conversation.
- Ability to select an individual participant.
- Ability to address the entire group.
- Natural-language text input.
- Distinct participant personalities and reactions.

Players must be able to:

- Make offers.
- Make counteroffers.
- Ask questions.
- Challenge claims.
- Persuade.
- Compromise.
- Withhold information.
- Bluff strategically.
- Detect possible bluffs.
- Remain silent.
- Introduce new information.
- Walk away.

The experience must not be a predetermined dialogue tree.

AI participants must have independent interests, personalities, knowledge, secrets, constraints and relationships.

Do not make every character respond after every message. Generate meaningful, contextually appropriate reactions.

Phase E — Debrief

After the negotiation, provide:

- Final agreement or failure.
- Whether the player's objectives were met.
- Concessions made by both sides.
- Unresolved issues.
- Changes in trust and credibility.
- Important conversational moments.
- Mistakes and missed opportunities.
- Hidden motivations and information, where applicable.
- Alternative approaches.
- Skill assessment with evidence from the conversation.

Evaluate decision quality separately from outcome quality.

A player can lose while negotiating intelligently. A player can win through luck while making poor decisions.

3. THE FIRST THREE CASES

Build three carefully designed modern cases.

Case 01 — The Acquisition

The player represents a financially struggling company negotiating its acquisition by a larger corporation.

Focus: anchoring, leverage, information management, bluff detection and conditional offers.

Case 02 — The Fragile Peace

The player represents one side in a multi-party diplomatic negotiation between neighbouring states.

Focus: alliances, competing interests, diplomacy, coalition building and compromise.

Case 03 — The Walkout

The player negotiates between management and employees threatening a strike.

Focus: skepticism, emotional intelligence, questioning, power dynamics and creative agreements.

Each case should contain 4–5 distinct participants, coherent objectives, private knowledge, constraints and multiple plausible outcomes.

Do not make the cases feel like three reskins of the same scenario.

4. THE LEARNING SYSTEM

The game must teach through experience, not merely provide generic advice.

Track evidence of the player's performance across:

- Negotiation.
- Questioning and skepticism.
- Bluff detection.
- Strategic communication.
- Information management.
- Reading incentives.
- Emotional control.
- Strategic concessions.
- Critical thinking.
- Decision-making under uncertainty.

Teach concepts contextually:

- BATNA.
- ZOPA.
- Anchoring.
- Reservation prices.
- Information asymmetry.
- Signalling.
- Game theory.
- Cognitive biases.
- Prisoner's dilemma.

Do not reward lying indiscriminately. Teach concealment, strategic ambiguity, credible signalling and bluffing as different tactics with different risks.

Every assessment should be grounded in actual player actions. Avoid arbitrary scores without explanations.

5. TECHNICAL ARCHITECTURE — CRITICAL

Separate the application into two cooperating systems.

AI simulation layer

- Character dialogue.
- Personality and behavioural consistency.
- Interpretation of player intentions.
- Persuasion and pressure reactions.
- Private knowledge and interpersonal dynamics.

Deterministic game engine

- Offer and counteroffer tracking.
- Agreement validation.
- Commitments and concessions.
- Trust and credibility.
- Objectives and constraints.
- Outcome determination.
- Debrief data.

The LLM must NOT be the sole authority over the game state.

For example, a character saying "I accept" does not automatically mean an agreement exists. The engine must validate the terms and confirm all necessary parties have agreed.

Use structured scenario state, structured offers and explicit negotiation events.

Maintain consistency between the conversation transcript and the actual game state.

Use shared model infrastructure with separate character context. Optimise inference costs by generating only meaningful reactions.

6. DEVELOPMENT STRATEGY

First inspect the existing repository and understand:

- Current architecture.
- Existing UI and design system.
- Database and persistence.
- Authentication, if present.
- AI integrations.
- Existing reusable components.
- Current tests.
- Build and deployment setup.

Do not blindly replace existing code or introduce unnecessary dependencies.

Then create a practical implementation roadmap with:

- Milestones.
- Dependencies.
- Agent responsibilities.
- Acceptance criteria.
- Testing strategy.
- Risks and technical decisions.

Delegate specialist work where useful:

- Product and game design.
- UI/UX.
- Backend and data modelling.
- AI simulation.
- Negotiation engine.
- Scenario writing.
- Testing and quality assurance.

You remain responsible for reviewing integrations and ensuring the complete application works.

7. MVP BOUNDARIES

Prioritise:

1. Complete case selection.
2. Two-sided briefing.
3. Preparation.
4. Static negotiation room.
5. Distinct AI participants.
6. Natural-language group chat.
7. Offers and counteroffers.
8. Structured negotiation state.
9. Agreement and consequence handling.
10. Detailed debrief.
11. Basic cross-case skill tracking.

Do NOT prioritise yet:

- Multiplayer.
- Elaborate career progression.
- Complex campaigns.
- 3D rooms.
- Animated characters.
- Medieval settings.
- Complicated reputation systems.
- Excessive gamification.
- Unnecessary social features.

Design the architecture so these can be added later without building them now.

8. QUALITY REQUIREMENTS

The application must be:

- Actually playable.
- Persistent where required.
- Consistent across conversation and game state.
- Responsive on mobile.
- Understandable to first-time players.
- Cost-conscious in AI usage.
- Testable.
- Reliable when an LLM call fails or returns malformed data.

Do not fake functionality with hardcoded responses while presenting it as AI simulation.

Use deterministic fallbacks where appropriate, but clearly separate them from genuine model-generated interactions.

Test the complete player journey, not just isolated functions.

9. AUTONOMOUS EXECUTION RULES

- Do not stop after producing a plan.
- After inspecting the repository, begin implementation.
- Work in coherent milestones.
- Run tests after meaningful changes.
- Review agent contributions before integrating them.
- Fix broken builds and regressions.
- Avoid duplicate work between agents.
- Keep a persistent progress report.
- Record architectural decisions.
- Report blockers only when they genuinely require human input.
- Do not waste tokens repeatedly rediscovering the same repository context.
- Prefer compact, structured inter-agent communication.
- Do not expand scope just because an idea is interesting.

If a feature is not essential to the MVP, record it for later rather than implementing it prematurely.

10. DEFINITION OF SUCCESS

The first release is successful when a new player can:

1. Open the application.
2. Select a negotiation case.
3. Read both sides' briefings.
4. Prepare their strategy.
5. Enter a realistic negotiation room.
6. Talk naturally with multiple distinct AI participants.
7. Make offers, counteroffers and strategic decisions.
8. Reach an agreement, fail or walk away.
9. Receive a meaningful, evidence-based debrief.
10. Understand what they did well and how to improve.

The experience should make the player want to try another negotiation with a different strategy.

Start by auditing the repository. Produce a concise execution roadmap, then begin building. Your goal is a working product, not an impressive-looking project plan.