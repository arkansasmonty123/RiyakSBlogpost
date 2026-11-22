# THE INVESTIGATION

Product Requirements Document (PRD)

Product type: AI-powered asynchronous mystery investigation platform
Initial platform: Responsive web application / PWA
Primary experience: Single-player investigation with an AI-powered investigator and group-chat interface
Content model: Shared canonical mysteries with individually personalized investigations
Initial content library: 100 cases
Content release cadence: New case collection every week
Document status: Product specification — initial version

---

1. Product Overview

1.1 The idea

THE INVESTIGATION is an interactive mystery-solving platform where players investigate carefully constructed cases, communicate with an AI-powered investigative team, examine evidence, question suspects, form theories, and ultimately identify the person responsible.

Unlike conventional detective games, the investigation does not happen all at once.

Cases develop over time. New evidence arrives after important deductions, investigative actions, or scheduled developments. Suspects may contact the investigator. Witnesses may reveal previously withheld information. Earlier evidence may acquire entirely different meanings as new discoveries emerge.

The player is not simply reading a mystery or answering a series of predetermined questions.

They are conducting an investigation.

1.2 Core product philosophy

A mystery should make the player think, doubt, investigate, reconsider, and occasionally question everything they previously believed.

The product should prioritize:

- Logical depth over arbitrary complexity.
- Investigation over passive storytelling.
- Evidence-based deduction over guessing.
- Consistency over unlimited AI improvisation.
- Suspense over artificial waiting.
- Meaningful discoveries over repetitive conversations.
- Long-term engagement over disposable daily puzzles.

The AI exists to bring the investigation to life, not to invent the truth as the player progresses.

1.3 Product positioning

A mystery investigation platform where every case is a carefully constructed puzzle, and AI brings the investigation to life.

THE INVESTIGATION is not intended to be:

- A conventional chatbot.
- A collection of generic AI-generated murder stories.
- A daily crossword or puzzle application.
- A visual novel with fixed dialogue choices.
- An unrestricted roleplay application.

It combines structured detective puzzles, interactive storytelling, asynchronous progression, and conversational AI.

---

2. Target Audience

Primary audience

People who enjoy:

- Detective fiction and crime mysteries.
- Psychological thrillers.
- Complex fictional investigations.
- Logical deduction and problem-solving.
- Escape rooms and mystery games.
- Interactive storytelling.
- Discussing theories and competing explanations.

Secondary audience

- Readers of crime fiction.
- Fans of investigative television and films.
- Players who enjoy social deduction.
- People interested in AI-driven interactive experiences.

Core player motivation

Players should return because:

1. They want to discover what actually happened.
2. They have developed theories that need testing.
3. New evidence might change their conclusions.
4. They want to interrogate suspects and challenge the investigator.
5. They want to know whether their deductions were correct.

---

3. Core Gameplay Loop

The central loop:

Discover → Select → Investigate → Discuss → Deduce → Receive Evidence → Reconsider → Accuse → Resolve

Step 1: Discover

The player opens the case library and explores available investigations.

Every case has:

- A title.
- A short premise.
- Genre.
- Difficulty.
- Estimated investigation duration.
- Number of suspects.
- Case status.
- Optional spoiler-free introduction.

Step 2: Select

The player selects one case.

Once selected:

- The case becomes their active investigation.
- Other cases cannot be started simultaneously.
- Their investigation state is saved.
- The case begins with its opening briefing.
- The player receives initial evidence and access to the investigation interface.

Step 3: Investigate

The player can:

- Read the case briefing.
- Examine available evidence.
- Interact with the investigator group chat.
- Question suspects when permitted.
- Inspect documents and objects.
- Review witness statements.
- Construct theories.
- Record personal observations.

Step 4: Deduce

At meaningful checkpoints, the system asks the player to make observations or submit a theory.

Examples:

- Which part of the witness statement seems inconsistent?
- What do you think happened between 10:00 and 10:30 PM?
- Which suspect currently has the strongest opportunity?
- Does the new evidence contradict your earlier theory?

Step 5: Receive new developments

New evidence and developments are released according to investigation triggers or scheduled events.

Step 6: Accuse

When the investigation reaches its final stage, the player submits an accusation.

The accusation should require more than a name. The player should explain the reasoning behind their conclusion.

Step 7: Resolution

The system evaluates the accusation against the canonical solution.

The player receives:

- Verdict.
- Explanation of the actual events.
- Evidence supporting the conclusion.
- Explanation of misleading clues.
- Explanation of alternative suspects.
- Investigation performance summary.

The completed case moves to the archive.

---

4. Case Library and Content Model

4.1 Initial library

The platform launches with approximately 100 pre-generated and validated cases.

Players choose which investigation they want to experience.

The library should contain variety rather than 100 variations of the same murder mystery.

Suggested genres:

Genre| Examples
Murder mystery| Locked-room murders, suspicious deaths
Psychological| False memories, manipulation, unreliable witnesses
Conspiracy| Hidden organizations, political or corporate secrets
Historical| Disappearances, disputed historical events
Cybercrime| Digital identities, data theft, digital deception
Missing persons| Disappearances, false identities, hidden histories
Heist| Impossible thefts, insider involvement
Unexplained events| Strange incidents with rational or unexpected explanations

Cases should vary in narrative style, difficulty, length, and investigative mechanics.

4.2 Case duration

Cases should support different durations.

- Short: approximately 1–3 days.
- Standard: approximately 4–7 days.
- Deep: approximately 1–3 weeks.

These are design targets, not mandatory timers.

A player who investigates quickly should not be forced to wait unnecessarily for every development.

4.3 Weekly content releases

After launch, introduce a new collection of cases every week.

The weekly release should:

- Add new cases to the library.
- Include a variety of genres and difficulty levels.
- Feature a highlighted investigation.
- Provide spoiler-free previews.
- Allow players to start newly released cases.

Players already investigating a case can continue uninterrupted.

Weekly releases should not reset existing progress or force players to abandon an active investigation.

4.4 Case locking

A player can have only one active investigation.

Once a case is selected, other cases remain unavailable until the active case is completed or deliberately abandoned.

The player should always be able to:

- Read the active case.
- Continue investigating.
- Access their journal.
- Review discovered evidence.
- Return to previous conversations.

Completed cases remain accessible through the archive.

Abandoning a case should be possible, but should require confirmation and clearly explain that its investigation progress will be archived or reset according to the product's abandonment policy.

Do not make ordinary inactivity equivalent to abandonment.

---

5. Mystery Construction System

This is one of the most important components of the entire platform.

The quality of the mysteries determines the quality of the product.

The platform must not simply ask an LLM to write a complicated detective story.

It must construct a structured, logically consistent mystery first and generate the narrative around it.

5.1 Canonical truth

Every case must have one authoritative underlying truth.

It should define:

- What actually happened.
- Who was responsible.
- Why it happened.
- How it happened.
- When it happened.
- Where it happened.
- Who participated.
- What each participant knew.
- What each participant concealed.
- What each participant falsely believed.

The canonical truth must not change according to the player's conversation or theories.

5.2 Case construction pipeline

Every case should pass through the following stages.

Stage A — Mystery architecture

Define the central incident, culprit, motive, method, timeline, opportunity, and hidden circumstances.

Stage B — World construction

Create the setting, suspects, relationships, histories, secrets, conflicts, and relevant background.

Stage C — Character knowledge

For every character, define:

- What they know.
- What they do not know.
- What they believe.
- What they misunderstand.
- What they witnessed.
- What they are hiding.
- Why they lie.
- Under what conditions they reveal information.

Characters must not possess information they could not reasonably know.

Stage D — Evidence construction

Every evidence item must have:

- A unique identifier.
- Origin and source.
- Discovery method.
- Timestamp or relevant period.
- Reliability.
- Description.
- Hidden interpretation.
- Associated characters.
- Supported hypotheses.
- Contradicted hypotheses.
- Prerequisites for discovery.
- Scheduled or conditional release rules.

Stage E — Alternative explanations

Construct plausible competing theories.

The system must establish why each alternative initially appears reasonable and which evidence eventually disproves it.

Stage F — Investigation design

Define how the player can discover the evidence, which investigative actions are available, and which deductions are required.

Stage G — Adversarial validation

Attempt to solve the mystery using only player-visible information.

Search for:

- Contradictions.
- Missing evidence.
- Impossible timelines.
- Unjustified conclusions.
- Alternative solutions that fit all known evidence.
- Accidental revelations.
- Shortcuts that bypass the intended investigation.

A case should not be published merely because its prose is convincing.

5.3 Mystery quality requirements

Each published case should have:

- A coherent canonical solution.
- Multiple meaningful suspects.
- Distinct character motivations.
- A consistent timeline.
- Evidence that supports or eliminates hypotheses.
- At least some misleading but fair clues.
- Multiple investigative opportunities.
- A satisfying final explanation.
- A solution that can be inferred from available evidence.

Difficulty must come from the relationships between clues, not from withholding arbitrary information or inventing a surprise fact at the end.

---

6. Investigation Interface

The investigation interface is the primary player workspace.

It should feel like a detective's digital investigation room.

6.1 Main interface sections

A. Case Overview

Displays:

- Case title.
- Current investigation stage.
- Case briefing.
- Current objectives.
- Important characters.
- Recent developments.
- Next scheduled event, where appropriate.

B. Group Chat

The primary conversational interface.

The player interacts with an investigative team through one group-chat experience.

The group may contain:

- Lead investigator.
- Forensic specialist.
- Field investigator.
- Digital investigation specialist.
- Other case-specific characters.

These are conversational roles, not separate AI systems.

One shared LLM orchestration system should power the experience.

The AI should portray the appropriate participants using role definitions, character knowledge, and conversation context.

C. Evidence Room

A dedicated collection of discovered evidence.

Evidence categories may include:

- Physical evidence.
- Digital evidence.
- Documents.
- Witness statements.
- Forensic reports.
- Photographs.
- Recordings.
- Financial records.
- Historical information.

D. Suspect Board

Each suspect has a profile containing:

- Background.
- Relationship to the victim or incident.
- Known motive.
- Confirmed alibi.
- Contradictions.
- Relevant evidence.
- Player's current suspicion.
- Unanswered questions.

The player can compare suspects without being told who is responsible.

E. Timeline

An interactive chronological view of relevant events.

Players should be able to:

- Inspect known events.
- Compare statements.
- Identify time inconsistencies.
- Add personal notes.
- Reconstruct possible sequences.

F. Detective's Journal

The player's personal investigation notebook.

It should contain:

- Discovered facts.
- Personal observations.
- Suspicions.
- Theories.
- Unanswered questions.
- Rejected hypotheses.
- Important contradictions.
- Player-created notes.

The journal must distinguish between confirmed facts and the player's assumptions.

---

7. AI Investigator and Group Chat

7.1 Core functionality

The AI investigator should:

- Understand player questions.
- Respond using the current investigation context.
- Explain evidence without revealing hidden information.
- Remember previous conversations.
- Discuss theories.
- Challenge weak deductions.
- Recognize contradictions.
- Suggest investigative directions without automatically solving everything.
- Portray different investigative roles.
- Maintain consistent character personalities.

7.2 One model, multiple roles

Do not deploy a separate LLM for every investigative team member.

Use one shared inference architecture with role-specific instructions.

For example:

- The lead investigator focuses on case strategy.
- The forensic specialist discusses physical evidence.
- The field investigator discusses witnesses and locations.
- The digital specialist interprets digital traces.

The system should select the appropriate role or roles based on the conversation.

7.3 Conversation boundaries

The AI must never:

- Change the culprit.
- Invent new canonical evidence.
- Contradict established facts.
- Reveal unreleased evidence.
- Reveal the hidden solution.
- Claim an investigation action occurred when it did not.
- Treat an unsupported player theory as confirmed truth.

If the player proposes an incorrect theory, the AI should engage with it intelligently rather than immediately rejecting it.

7.4 Context management

Do not send the entire conversation history to the model for every interaction.

Use:

- Recent message windows.
- Rolling conversation summaries.
- Relevant evidence retrieval.
- Character knowledge retrieval.
- Player theory summaries.
- Investigation state.

The model should receive only the context relevant to the current interaction.

---

8. Evidence Release and Asynchronous Progression

This is a defining product feature.

The investigation should progress over time without becoming a conventional timed puzzle.

8.1 Evidence release philosophy

New evidence may arrive:

1. After an important deduction.
2. After a valid investigative action.
3. After a scheduled interval.
4. After an external character initiates contact.
5. After a combination of investigation and time conditions.

The AI may recommend or schedule developments, but the deterministic progression engine must authorize releases.

8.2 Three release mechanisms

Deduction-triggered release

Example:

The player identifies that a witness's statement conflicts with the security footage.

The system evaluates the theory.

If the relevant conditions are satisfied, the next evidence item becomes eligible for release.

The player may immediately receive:

- A new report.
- A witness correction.
- A forensic development.
- A new investigative lead.

Investigation-triggered release

Example:

The player asks to examine a particular object.

If the action is valid and the necessary prerequisites are met, an additional observation or evidence item is revealed.

Time-triggered release

Some developments should arrive independently of player activity.

Examples:

- A laboratory report.
- A scheduled interview.
- A witness contacting the investigator.
- A recovered document.
- A new development at the crime scene.

The target delay should generally be a few hours, with a maximum of 24 hours for ordinary scheduled developments.

8.3 Adaptive scheduling

The AI may recommend when the next development should occur based on:

- Case pacing.
- Current investigation stage.
- Player activity.
- Narrative tension.
- Previous discoveries.
- Pending investigative actions.

The progression engine should enforce:

- Valid release prerequisites.
- Minimum and maximum delays.
- No duplicate releases.
- No premature revelations.
- Correct ordering of dependent evidence.

The system must never delay an eligible, important development indefinitely.

8.4 Offline progression

The investigation must continue to advance when the player is offline.

When the player returns:

- Show missed developments.
- Display relevant timestamps.
- Present pending evidence.
- Summarize significant events.
- Allow the player to catch up.

Do not punish players for failing to open the application at a specific time.

8.5 Event notifications

Notifications should be used for meaningful developments.

Examples:

- "The forensic report has arrived."
- "A witness has requested another interview."
- "We found something unusual in the security footage."
- "Your earlier theory might need reconsideration."

Avoid repetitive notifications that create artificial engagement.

Notifications should be configurable.

---

9. Deduction and Suspicion System

The player should actively reason rather than simply wait for evidence.

9.1 Theory submission

Players can submit theories at checkpoints or voluntarily through the investigation interface.

A theory may contain:

- Suspected person.
- Suspected motive.
- Possible method.
- Relevant timeline.
- Supporting evidence.
- Contradictory evidence.
- Confidence level.

The player should be able to revise theories as the investigation develops.

9.2 Theory evaluation

The system evaluates theories against:

- Canonical truth.
- Available evidence.
- Character knowledge.
- Timeline.
- Logical implications.

Evaluation should distinguish:

- Correct observations.
- Plausible but unproven conclusions.
- Incorrect assumptions.
- Contradictions.
- Unsupported speculation.

A theory can be partially correct without being the final solution.

9.3 Suspicion is not guilt

The player's suspicion score is a personal investigation variable.

It must never determine the actual culprit.

The system should avoid artificially encouraging players to suspect a particular person.

---

10. Final Accusation and Verdict

The final accusation is the climax of the case.

10.1 Accusation requirements

The player should identify:

1. Who is responsible?
2. What was the motive?
3. How was the incident carried out?
4. Which evidence supports the conclusion?
5. What evidence rules out the strongest alternative?

The exact requirements may vary by case.

10.2 Verdict evaluation

The verdict should be evaluated against the structured canonical solution, not through unrestricted LLM judgment.

The system should evaluate:

- Culprit identification.
- Method.
- Motive.
- Critical timeline.
- Evidence supporting the conclusion.
- Required deductions.

The LLM may generate a natural-language explanation of the verdict, but the underlying evaluation should be deterministic and case-specific.

10.3 Wrong accusations

A wrong accusation should have consequences.

Suggested initial policy:

- A failed accusation triggers a cooldown.
- The player receives limited feedback.
- The investigation remains available.
- Additional attempts become available according to case rules.
- Repeated attempts may have longer cooldowns.

The platform should not permanently lock players out of every other feature.

The purpose is to make the accusation meaningful, not frustrating.

10.4 Successful completion

After completion:

- Reveal the canonical truth.
- Explain the complete timeline.
- Explain the culprit's actions.
- Resolve every important clue.
- Explain the red herrings.
- Show how the player's theories evolved.
- Award case achievements.
- Move the case to the completed archive.

The player should feel that the entire mystery has been explained.

---

11. Personalization and Shared Canonical Cases

All players investigating the same case share the same fundamental mystery.

The following must remain identical:

- Culprit.
- Motive.
- Method.
- Core timeline.
- Important events.
- Canonical evidence.
- Final solution.

However, individual investigations may differ in:

- Conversation history.
- Optional dialogue.
- Order of certain nonessential discoveries.
- Hints.
- Character responses.
- Additional contextual details.
- Pacing within established boundaries.

For example, two players may interrogate different suspects first.

Their conversations can differ, but neither player should receive a fundamentally different culprit or solution.

Personalization should enhance the experience without compromising fairness.

---

12. AI Architecture and Cost Optimization

AI inference is a major operational expense.

The platform must be designed to minimize unnecessary model calls.

12.1 Shared case generation

Do not generate a complete mystery separately for every player.

Generate and validate each case once.

Store:

- Canonical solution.
- Characters.
- Evidence.
- Timeline.
- Dialogue knowledge.
- Release rules.
- Alternative hypotheses.
- Final verdict criteria.

All players reuse this content.

12.2 Layered inference

Use different processing levels.

Level 1 — Deterministic processing

No LLM required.

Examples:

- Loading evidence.
- Showing case details.
- Displaying the timeline.
- Checking case status.
- Updating progress.
- Scheduling events.
- Validating simple game actions.

Level 2 — Lightweight AI

Use a small, inexpensive model for:

- Intent classification.
- Theory extraction.
- Conversation summarization.
- Evidence retrieval assistance.
- Basic dialogue.
- Identifying relevant investigation context.

Level 3 — Stronger AI

Use more capable inference selectively for:

- Complex interrogations.
- Difficult deduction discussions.
- Multi-step theory analysis.
- Character conversations requiring nuanced reasoning.
- Complex narrative explanations.

Do not call the strongest model for every message.

12.3 Context optimization

Implement:

- Rolling conversation summaries.
- Evidence-based retrieval.
- Character-specific memory.
- Player theory summaries.
- Duplicate question caching.
- Reusable narrative templates.
- Strict response-length controls where appropriate.

Avoid repeatedly sending the complete case and conversation history.

12.4 Client-side computation

Use player devices wherever reasonable.

Potential client-side responsibilities:

- Rendering the investigation interface.
- Evidence board interactions.
- Timeline reconstruction.
- Local evidence indexing.
- Local search.
- Personal notes.
- Chat history caching.
- Lightweight NLP.
- Optional local model inference.

Potential technologies:

- IndexedDB.
- Web Workers.
- WebAssembly.
- WebGPU.
- ONNX Runtime Web.
- Service Workers.
- PWA capabilities.

Local inference should be optional, not a requirement.

Device capabilities vary considerably, especially across mobile browsers.

12.5 Server responsibilities

The server must remain authoritative for:

- Canonical case truth.
- User accounts.
- Active case ownership.
- Evidence authorization.
- Scheduled event execution.
- Progression state.
- Accusation evaluation.
- Case completion.
- Weekly content releases.

Never trust a client device to determine the culprit, unlock secret evidence, or validate a verdict.

12.6 Cost principle

The platform should spend money on meaningful AI interactions, not routine application operations.

The goal is to make one case playable by a large number of users without multiplying the full story-generation expense for every new player.

---

13. Data Architecture

The system should be built around structured, versioned case packages.

13.1 Core entities

User

- User ID.
- Account details.
- Preferences.
- Notification settings.
- Created timestamp.

Case

- Case ID.
- Title.
- Description.
- Genre.
- Difficulty.
- Estimated duration.
- Publication status.
- Case version.
- Canonical package reference.

Case Truth

- Culprit.
- Motive.
- Method.
- Actual timeline.
- Hidden events.
- Solution explanation.

This must be private server-side data.

Character

- Character ID.
- Case ID.
- Name.
- Role.
- Personality.
- Background.
- Knowledge.
- Beliefs.
- Secrets.
- Dialogue constraints.

Evidence

- Evidence ID.
- Case ID.
- Category.
- Source.
- Description.
- Discovery conditions.
- Release conditions.
- Timeline reference.
- Related characters.
- Logical implications.
- Visibility state.

Investigation

- Investigation ID.
- User ID.
- Case ID.
- Status.
- Start timestamp.
- Current stage.
- Progress.
- Completion timestamp.

Investigation State

- Discovered evidence IDs.
- Current theories.
- Suspicion levels.
- Completed checkpoints.
- Pending events.
- Current investigation stage.

Conversation

- Conversation ID.
- Investigation ID.
- Participants.
- Message history.
- Summary.
- Context references.

Journal Entry

- Entry ID.
- Investigation ID.
- Entry type.
- Content.
- Related evidence.
- Creation timestamp.

Scheduled Event

- Event ID.
- Investigation ID.
- Event type.
- Trigger condition.
- Scheduled timestamp.
- Release status.
- Associated evidence or narrative payload.

Accusation

- Accusation ID.
- Investigation ID.
- Submitted culprit.
- Motive.
- Method.
- Supporting evidence.
- Evaluation result.
- Submission timestamp.

Weekly Collection

- Collection ID.
- Release date.
- Included case IDs.
- Featured case.
- Publication status.

13.2 Security requirements

The canonical solution and unreleased evidence must never be exposed through ordinary client API responses.

Use server-side authorization to determine which evidence a player is allowed to see.

Case packages should be separated into:

- Public case content.
- Player-visible evidence.
- Private canonical truth.
- Hidden evidence.
- Internal validation metadata.

---

14. Main Application Screens

14.1 Home

Displays:

- Active investigation.
- Latest developments.
- Weekly case collection.
- Featured cases.
- Completed case count.
- Recent achievements.

14.2 Case Library

Displays the 100 initial cases and subsequent weekly additions.

Features:

- Genre filtering.
- Difficulty filtering.
- Duration filtering.
- Search.
- Spoiler-free previews.
- Locked/unlocked/completed states.

14.3 Case Briefing

Displays:

- Opening premise.
- Incident details.
- Initial characters.
- Initial known facts.
- Investigation objectives.
- Start investigation action.

14.4 Investigation Room

The primary gameplay screen.

Contains:

- Group chat.
- Evidence access.
- Suspect access.
- Timeline.
- Journal.
- Progression status.
- Pending developments.

14.5 Evidence Viewer

Displays individual evidence items with:

- Original description.
- Source.
- Discovery timestamp.
- Relevant metadata.
- Related characters.
- Player notes.

Do not automatically expose the hidden interpretation.

14.6 Detective Journal

A structured workspace for player reasoning.

14.7 Accusation Screen

Collects the final accusation and supporting reasoning.

14.8 Verdict Screen

Reveals the canonical solution and provides a detailed case breakdown.

14.9 Archive

Allows players to revisit completed cases, evidence, and final explanations.

---

15. Engagement and Progression

The game should reward investigation quality rather than message volume.

15.1 Achievements

Possible achievements:

- Detail Oriented — noticed a subtle contradiction.
- Pattern Hunter — connected multiple independent clues.
- Skeptic — challenged an unreliable witness.
- Cold Reader — identified a misleading statement.
- Timeline Architect — reconstructed a complicated sequence.
- Master Detective — completed a difficult investigation.

15.2 Investigation statistics

Track:

- Cases completed.
- Successful first accusations.
- Evidence discovered.
- Optional evidence found.
- Major deductions made.
- Investigative actions performed.
- Average case completion duration.

Do not present these as scientifically valid measures of intelligence.

15.3 Community features — later phase

Potential features:

- Spoiler-protected theory discussions.
- Community suspect statistics.
- Weekly investigation challenges.
- Shared case discussions after completion.
- Leaderboards based on reasoning performance.
- Community-generated cases.

Community activity must never alter a published case's canonical truth.

---

16. Non-Functional Requirements

Performance

- Fast initial application load.
- Responsive investigation interface.
- Chat messages should stream where supported.
- Evidence navigation should not require an AI call.
- Investigation progress should persist reliably.

Reliability

- No duplicate evidence releases.
- No lost investigation progress.
- Scheduled events must survive server restarts.
- Case state transitions must be transactional.
- Failed AI calls must not corrupt progression.
- Players must be able to resume interrupted sessions.

Security

- Authentication and authorization.
- Server-side case state validation.
- Protection against hidden-solution leakage.
- Rate limiting.
- Abuse prevention.
- Secure API access.
- Input validation.

Accessibility

- Mobile-first design.
- Readable text.
- Keyboard-accessible controls.
- Appropriate contrast.
- Adjustable notification settings.
- Clear distinction between confirmed facts and theories.

Scalability

- Many users sharing the same case package.
- Independent player investigation states.
- Background event scheduling.
- Cached static case content.
- Model-provider abstraction.
- Independent scaling of inference and application services.

---

17. MVP Definition

The first prototype should not attempt to build the entire platform.

It should prove that one genuinely compelling investigation can sustain player interest.

MVP features

1. One fully constructed mystery.
2. Five or more meaningful suspects.
3. One canonical solution.
4. Structured evidence database.
5. Consistent character knowledge.
6. AI-powered investigator group chat.
7. Evidence viewer.
8. Suspect profiles.
9. Detective journal.
10. Basic timeline.
11. Deduction checkpoints.
12. Deduction-triggered evidence release.
13. Time-triggered evidence release.
14. Persistent investigation state.
15. Final accusation.
16. Verdict and complete solution explanation.

The prototype should use a small number of carefully designed events rather than hundreds of generated interactions.

MVP exclusions

Do not initially build:

- 100 production-ready cases.
- Community discussion.
- User-generated cases.
- Competitive leaderboards.
- Native Android application.
- Distributed user-device computation.
- Complex social systems.
- Multiplayer investigations.
- Multiple simultaneous active cases.
- Advanced local LLM execution.

These are future expansion possibilities.

---

18. Development Roadmap

Phase 1 — Mystery Engine

Build the foundation.

- Define the case schema.
- Create canonical truth representation.
- Create character knowledge models.
- Create evidence relationships.
- Create investigation progression rules.
- Create case validation checks.
- Construct one complete mystery.

Exit condition: One mystery can be played without contradictions or solution leakage.

Phase 2 — Playable Investigation

Build the player-facing experience.

- Case briefing.
- Investigation room.
- Group chat.
- Evidence viewer.
- Suspect profiles.
- Journal.
- Timeline.
- Theory submission.
- Final accusation.

Exit condition: A player can complete the entire investigation.

Phase 3 — Asynchronous Progression

Implement:

- Scheduled evidence releases.
- Deduction-based triggers.
- Background event scheduler.
- Notifications.
- Offline progression.
- Catch-up summaries.
- Persistent player states.

Exit condition: The investigation progresses correctly even when the player is offline.

Phase 4 — AI Optimization

Implement:

- Context compression.
- Retrieval-based memory.
- Model routing.
- Response caching.
- Token usage tracking.
- Optional client-side inference.
- Usage limits and cost monitoring.

Exit condition: The experience operates within a defined inference budget.

Phase 5 — Content Platform

Implement:

- Case library.
- Weekly releases.
- Multiple genres.
- Case difficulty and duration.
- Completed archive.
- Case versioning.
- Administrative publishing tools.

Exit condition: The platform can manage and distribute a growing library of cases.

Phase 6 — Advanced Platform

Potential additions:

- Community theories.
- Competitive investigations.
- User-created cases.
- Advanced evidence board.
- Voice interrogation.
- Image and document examination.
- More elaborate narrative mechanics.
- Optional native mobile application.

---

19. Case Validation and Quality Assurance

This must be treated as a core production pipeline, not an optional final check.

Every case should pass several independent tests.

Logical consistency

- Are all events chronologically possible?
- Are alibis consistent with travel and access?
- Are statements consistent with what characters know?
- Does every important event have a plausible cause?

Evidence integrity

- Does every important deduction have supporting evidence?
- Is evidence discoverable through valid actions?
- Are red herrings explainable?
- Does evidence contradict itself accidentally?

Solvability

- Can the correct culprit be identified using player-visible evidence?
- Can alternative suspects be eliminated?
- Is the final explanation supported by the investigation?
- Can the mystery be solved without relying on undisclosed information?

Fairness

- Are important clues discoverable?
- Are deductions reasonable?
- Are the intended twists supported by earlier information?
- Does the system avoid arbitrary reveals?

Adversarial testing

Use separate AI evaluation roles:

1. Architect — constructs the mystery.
2. Storyteller — writes the narrative.
3. Detective — attempts to solve the case using only available information.
4. Adversary — searches for loopholes and alternative solutions.
5. Judge — evaluates consistency, fairness, and solvability.

Different prompts or model calls can simulate these roles, but their agreement is not proof of correctness.

Human playtesting remains necessary before publication.

---

20. Success Metrics

The platform should measure whether players genuinely enjoy investigating.

Engagement

- Case selection rate.
- Investigation completion rate.
- Average active investigation duration.
- Return rate after evidence notifications.
- Conversations per completed case.
- Evidence inspection frequency.

Mystery quality

- Successful first-accusation rate.
- Number of alternative theories considered.
- Player-reported fairness.
- Player-reported difficulty.
- Contradictions discovered during playtesting.
- Case abandonment rate.

Retention

- Day 1, Day 7 and Day 30 retention.
- Weekly case collection engagement.
- Completed cases per player.
- Return rate after case completion.

AI efficiency

- Average input tokens per interaction.
- Average output tokens per interaction.
- Cost per active investigation.
- Cost per completed case.
- Cache hit rate.
- Model routing distribution.
- Failed inference rate.

Primary success indicator

Players should regularly form theories, revise them after new evidence, return to investigate further, and feel that the final solution was both surprising and logically justified.

Message volume alone is not a meaningful success metric.

---

21. Major Product Risks

Risk| Mitigation
AI invents contradictory information| Structured canonical truth and restricted model access
Mysteries are too easy| Better evidence networks and adversarial testing
Mysteries are impossible| Solvability validation and human playtesting
Players get bored waiting| Hybrid time and investigation triggers
AI costs become excessive| Model routing, caching and context compression
Players guess randomly| Evidence-based accusation requirements
Players abandon difficult cases| Optional hints and fair abandonment
Hidden solutions leak| Server-side secret data and strict API authorization
Local inference excludes weak devices| Optional client-side inference only
Weekly content becomes expensive| Shared pre-generated case packages

---

22. Product Rules That Must Never Be Violated

1. Every published case has a fixed canonical truth.
1. The AI cannot change the underlying solution.
1. Players investigating the same case share the same fundamental mystery.
1. Personalization must not compromise fairness.
1. Unreleased evidence must remain hidden.
1. Time-based progression must continue offline.
1. Important developments should not be blocked indefinitely.
1. A player should never need to spam messages to progress.
1. The final solution must be logically supported by discovered evidence.
1. The client must never be trusted with authoritative hidden information.
1. AI-generated cases must pass validation before publication.
1. The product must remain enjoyable even when the AI is temporarily unavailable.

---

23. Final Product Vision

THE INVESTIGATION should feel like having an actual ongoing case on your desk.

You select a mystery. You study the evidence. You question people. You argue with your investigative team. You form theories.

Then, hours later, something changes.

A report arrives. A witness contradicts an earlier statement. A suspect contacts you. An old piece of evidence suddenly becomes important.

You return to your investigation because you genuinely want to know what happened.

The experience should make players revisit their own assumptions, challenge their conclusions, and construct explanations from incomplete information.

The ultimate goal is not to generate an unlimited number of stories. It is to create investigations so compelling that players become genuinely invested in solving them.

THE INVESTIGATION — Every clue has a story. Every suspect has a secret. Every theory can be wrong.
