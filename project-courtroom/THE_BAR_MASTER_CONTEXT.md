# THE BAR — Master Project Context

**Purpose:** Handoff document for OpenCode and its development agents  
**Status:** Product vision and architecture brief; not a claim that these features are already implemented.

---

## 1. Product vision

THE BAR is an immersive, persistent legal-career simulator set in India. The player begins as a newcomer/intern working under a senior lawyer and gradually builds a legal career through real legal work, relationships, difficult cases, professional choices and courtroom experience.

It combines five connected experiences:

1. **Career simulation:** employment, mentorship, reputation, finances, specialisation, promotion, independent practice, firm ownership and mentoring others.
2. **Legal academy:** learn actual Indian law through cases, assignments, research, drafting and feedback rather than detached lessons.
3. **Case laboratory:** investigate incidents, examine evidence, interview witnesses, identify legal issues and construct competing theories.
4. **Courtroom simulation:** hearings, advocacy, objections, judicial questions, opposing counsel and litigation strategy.
5. **Living world:** persistent characters, institutions, relationships, schedules, goals and events that continue independently of the player.

Core design principle:

> The player does not study law separately from the game. The player learns law because their career demands it.

The experience should combine serious professional simulation with character-driven legal drama. It should eventually support three career ambitions, progressively: exceptional courtroom advocate, founder of a law firm, and mentor/institution builder.

THE BAR is an educational simulation, not legal advice and not a substitute for formal legal education, professional qualification or supervised practice. Game progression must never imply that a player has become legally qualified in real life.

## 2. Setting and jurisdiction

- Primary jurisdiction: India.
- Start with a fictional law firm and fictional district/court environment.
- Legal content should be based on verified Indian legal sources.
- Initial legal foundation should include the Constitution of India, Bharatiya Nyaya Sanhita (BNS), Bharatiya Nagarik Suraksha Sanhita (BNSS), and Bharatiya Sakshya Adhiniyam (BSA), with later expansion to other central/state legislation and case law.
- Track source, version, effective date, amendments and the date relevant to each fictional incident.
- Clearly distinguish enacted law, binding precedent, persuasive authority, commentary and generated explanation.
- Do not fabricate statutory provisions, judgments, citations or procedural rules.

## 3. Player career and progression

Possible progression:

- Newcomer / law student
- Intern
- Junior advocate
- Independent advocate
- Established practitioner
- Senior advocate / firm founder / mentor / institution builder

This is a game progression model only. Real professional eligibility and enrolment requirements must be represented accurately and separately.

Long-term career paths:

- Courtroom specialist
- Law-firm founder and practice manager
- Mentor and institution builder

Players may combine paths over time.

## 4. Core gameplay loop

A typical loop:

1. Receive a case, assignment, client issue or professional responsibility.
2. Understand the facts and identify what is known, claimed, disputed and unknown.
3. Research relevant law and precedent using sourced legal material.
4. Investigate evidence, interview people and consult specialists.
5. Form a case theory and decide strategy.
6. Draft or revise a real legal-style document.
7. Discuss the matter with a senior, client, colleague or opposing counsel.
8. Attend a hearing or other professional event.
9. Receive an outcome, critique and consequences.
10. Update career, relationships, knowledge, reputation and the persistent world.

Avoid reducing the entire experience to multiple-choice dialogue. Use free-form drafting, decisions, investigations, conversations and document review alongside occasional structured choices.

## 5. The living legal world

The world should not wait for the player. Characters and institutions have schedules, goals, workloads and independent events.

Examples:

- A senior receives a new case.
- A colleague gets promoted or resigns.
- A rival joins another firm.
- A judge delivers an important judgment.
- A client approaches the firm directly.
- A lawyer in the player's network faces a professional controversy.
- A new amendment or important judgment changes the legal environment.
- A former colleague returns years later in a different professional role.

The player is a participant in the world, not its centre.

Use an in-game clock. Do not force real-world waiting. The player should be able to advance in-game time while deadlines, schedules and events are processed.

## 6. Characters and relationships

Start with approximately 8–12 important characters:

- Senior mentor
- Peer/friend
- Professional rival
- Other junior advocates
- Clerk / office staff
- Clients
- Opposing counsel
- Specialists and experts
- Later, judges and wider professional contacts

Each persistent character should have:

- Stable identity and personality
- Expertise and professional role
- Values, goals and ambitions
- Strengths and weaknesses
- Knowledge boundaries
- Schedule and current commitments
- Relationships with other characters
- Memories of specific events
- Current emotional state, where useful
- Independent actions and evolving circumstances

Relationships must be multidimensional, not a single affection score. Track dimensions such as trust, respect, loyalty, rivalry, resentment, affection, professional dependence and reputation.

Remember specific events, not just scores. A character might remember that the player helped them, took credit for their work, defended them or rejected an offer.

The player's former intern friend could later become a respected lawyer; a former rival could become opposing counsel; an intern mentored by the player could eventually establish a competing firm.

Romance/personal-life systems may be optional and should not displace professional gameplay.

## 7. Legal work as gameplay

Players should perform legal work through meaningful artifacts and decisions:

- Legal research and case-law comparison
- Case briefs and legal opinions
- Legal notices
- Bail applications and other applications
- Petitions and written submissions
- Contracts and document analysis
- Client interviewing and counselling
- Witness preparation
- Evidence analysis
- Negotiation and settlement
- Court filings and procedural work
- Oral submissions and advocacy

Documents should be editable text artifacts, not merely dialogue options. AI feedback should explain strengths, weaknesses, omissions, unsupported claims and possible improvements.

The game should evaluate legal reasoning, not just whether the player selected a prewritten answer.

## 8. Case engine and canonical truth

Cases need coherent underlying facts and controlled information discovery.

Keep separate:

- **Canonical truth:** what actually happened in the fictional world.
- **Character knowledge:** what each person knows or believes.
- **Player knowledge:** what the player has legitimately discovered.
- **Allegations:** what parties claim.
- **Admissible/reliable material:** what may properly be relied upon in the legal process.
- **Unresolved ambiguity:** what cannot be conclusively established.

Canonical truth should not leak to the player or to characters who have not discovered it. Once a case is active, its underlying truth should remain stable unless the scenario explicitly supports a later revelation or correction.

Illustrative case truth structure:

```ts
type CaseTruth = {
  actualEvents: Fact[];
  responsibleParties: string[];
  actualTimeline: TimelineEvent[];
  evidenceAuthenticity: Record<string, boolean>;
  hiddenMotives: string[];
  unresolvedAmbiguities: string[];
};
```

Cases should not always have a perfectly provable answer. Some evidence may be inconclusive; some facts may remain unknown.

Potential case categories:

- Criminal
- Civil and property
- Contractual
- Family
- Corporate fraud
- Employment/labour
- Consumer
- Constitutional and public interest
- Cybercrime and technology
- Environmental
- Arbitration and commercial disputes

## 9. Evidence and forensic investigation

Evidence categories:

- Physical evidence
- Digital evidence
- Medical evidence
- Oral testimony
- Documentary and financial evidence
- Expert opinion

Gameplay should cover:

- Relevance
- Authenticity
- Admissibility
- Reliability
- Chain of custody
- Corroboration
- Contradictions
- Burden and standard of proof
- Expert evidence
- Procedural defects

Possible actions:

- Request and inspect documents
- Interview witnesses
- Ask for expert examination
- Examine originals and metadata
- Challenge authenticity
- Test chain of custody
- Seek corroboration
- Challenge or distinguish evidence

Specialists should explain the relevant science at an appropriate level. For example, a forensic expert might explain limitations of DNA evidence; a digital examiner might explain metadata and integrity; a medical expert might explain what an injury report can and cannot establish.

## 10. Courtroom simulation

Courtroom gameplay may include:

- Preliminary and bail hearings
- Interim applications
- Examination-in-chief
- Cross-examination
- Re-examination
- Objections
- Oral and written submissions
- Evidence arguments
- Final arguments
- Judgments
- Appeals and review

Player decisions may include:

- Argument order
- Which facts and authorities to emphasise
- How to answer judicial questions
- Whether to challenge a witness
- Which objections to raise
- When to concede a point
- Whether to negotiate or settle
- Whether to appeal

Judges may have different judicial temperaments and courtroom styles, but outcomes must be grounded in law and facts, not arbitrary personality scores.

Opposing counsel should have their own case theory, research, strategy and knowledge boundaries. They may adapt to the player's previous tactics, but must not know information they could not legitimately obtain.

## 11. Legal knowledge and learning

Build a sourced legal knowledge system with:

- Statutes and provisions
- Amendments and effective dates
- Judgments and relevant paragraphs
- Legal principles and doctrines
- Definitions
- Procedural rules
- Legal citations
- Source provenance and verification status

The player should have a knowledge notebook for:

- Provisions
- Judgments
- Principles
- Case summaries
- Definitions
- Mistakes and feedback
- Personal notes and questions

Learning should be assessed through application:

- Issue spotting
- Fact analysis
- Legal interpretation
- Evidence evaluation
- Precedent analysis
- Procedural reasoning
- Counterarguments
- Strategy
- Ethical reasoning
- Drafting and advocacy

Track demonstrated mastery over multiple tasks. Do not reward memorisation alone.

## 12. Legal Mind Profile

A persistent profile should track growth in:

- Issue spotting
- Fact analysis
- Logical consistency
- Evidence evaluation
- Legal interpretation
- Precedent analysis
- Strategy
- Counterargument anticipation
- Procedural knowledge
- Ethical reasoning
- Drafting and advocacy

These are illustrative dimensions, not a single overall intelligence score. Assessments should be evidence-based and explain why a skill rating changed.

## 13. Ethics and professional judgment

Include difficult decisions involving:

- Client admissions
- Confidentiality
- Unethical instructions from a senior
- Witness dishonesty
- Questionable evidence
- Legal aid and poor clients
- Conflicts of interest
- Loyalty versus professional duties
- Commercial pressure and integrity

Distinguish legality, professional responsibility, personal morality and strategy. Avoid a simplistic good/evil meter.

## 14. Firm, finances and professional reputation

Eventually allow the player to:

- Establish a chamber or firm
- Choose practice areas
- Recruit juniors and staff
- Manage clients and workload
- Set fees
- Manage expenses and income
- Build a professional network
- Accept or reject cases
- Manage conflicts of interest
- Develop firm standards and reputation

Reputation should be multidimensional:

- Competence
- Integrity
- Reliability
- Client satisfaction
- Advocacy
- Professional network
- Specialisation
- Leadership

A brilliant but unreliable lawyer should be different from a meticulous, trusted lawyer.

## 15. Interdisciplinary knowledge

Cases should naturally connect law with:

- Forensic science
- Medicine
- Psychology
- Economics and accounting
- Cybersecurity and digital systems
- History
- Political and moral philosophy
- Sociology
- Technology

The player learns these subjects because a case requires them, not through unrelated lectures.

## 16. AI architecture: development AI versus runtime AI

Keep two concepts separate:

- **Development AI:** OpenCode and its coding agents build and maintain the application.
- **Runtime AI:** Models called by the game during play power characters, case generation, explanations, opposing counsel, evaluation and world events.

OpenCode writing an AI character system does not automatically give the shipped game access to an inference model. The application needs a separately configured runtime inference provider, local model endpoint or hosted service.

### Suggested runtime intelligence roles

These are logical roles, not necessarily separate models or servers:

1. Character intelligence: dialogue, reactions, teaching and memory-aware behaviour.
2. Case intelligence: scenario construction, facts, witnesses, evidence and legal issues.
3. Legal intelligence: retrieve and explain sourced law.
4. Courtroom intelligence: opposing counsel, judge interaction and hearing dialogue.
5. Evaluation intelligence: assess drafts, arguments and reasoning.
6. World intelligence: propose social, institutional and professional events.

A single foundation model can initially serve several roles through different prompts and structured output schemas. Specialised adapters or separate models can be explored later.

### Small specialised legal model

Explore a small fine-tuned model as the default in-app intelligence. Candidate sizes to benchmark include approximately 1.5B–3B parameters initially, then compare with 7B–8B models. Do not assume a small model will be capable enough without testing.

Fine-tuning should primarily teach:

- Legal workflow patterns
- Issue-spotting and structured analysis formats
- Legal terminology
- Case-analysis behaviour
- Draft critique formats
- Dialogue style and role behaviour
- Output schemas and tool-use discipline

Do not rely on fine-tuning to memorise all current Indian law. Legal knowledge should remain external, sourced and updateable.

Use four separate layers:

1. Fine-tuned model: behaviour and domain adaptation.
2. Retrieval-augmented generation (RAG): access to current verified legal sources.
3. Game database: persistent facts, characters, cases, player history and world state.
4. Deterministic validation engine: citations, dates, applicable provisions, evidence access and game rules.

The model must not invent citations or present unverified generated text as authoritative law.

### Model allocation and cost control

- Small/fast model: short NPC dialogue, reactions and memory summaries.
- Stronger model: complex case generation, legal synthesis and difficult evaluation.
- Deterministic code: schedules, inventory, time, money, relationship state updates, progression and routine mechanics.
- Use event-driven inference. Do not call an LLM for every click, movement or database lookup.
- Store structured state and use concise context windows.
- Validate all model outputs against schemas and game rules.

Local mobile inference has RAM, storage, latency and battery constraints. Consider downloadable model packs and an optional server-based fallback.

## 17. Visual direction: illustrated 2D point-and-click environments

The desired visual approach is not 3D and does not require animated frames. Use static illustrated scenes with selectable viewpoints.

Examples:

- Senior's chamber: entrance, desk, bookshelf, window.
- Office: reception, shared workspace, conference room, library.
- Court: corridor, courtroom, waiting area, canteen.
- Later: police station, hospital, forensic lab, prison, law college and the player's own office.

Each viewpoint is a static background image. Overlay clickable hotspots on objects and characters. Selecting a hotspot can open a detail view, dialogue, document, interaction panel or another viewpoint.

Example senior chamber interactions:

- Desk: inspect documents, assignments and case files.
- Bookshelf: access legal books and research.
- Senior's chair: speak to mentor.
- Window: observe outside world.
- Door: leave the chamber.

Characters can be represented by static portraits with expression variants (neutral, smiling, angry, disappointed, thinking, surprised). Switch the portrait based on dialogue and state; no animation is required.

### Suggested implementation

- Next.js + React interface.
- PNG/WebP scene backgrounds.
- HTML overlays or SVG hotspots.
- React state for viewpoint and interaction transitions.
- Database for scene state and persistence.
- Responsive/mobile-first layout.

Build a first prototype with one chamber, four viewpoints, five clickable objects, one character with several expressions, dialogue and navigation to another room. Validate the scene architecture before creating many assets.

Coding models can implement the scene system and wire assets, but artwork itself requires image-generation access or sourced assets. Do not assume free OpenCode coding models automatically generate high-quality art.

Maintain visual consistency through an art direction guide, fixed character descriptions, recurring environment references, palette and composition rules. Use licensed or original assets.

## 18. First playable release

Keep the first release small enough to complete.

Suggested scope:

- One fictional Indian law firm
- One fictional district
- 8–12 important characters
- One substantial principal case
- A few smaller assignments
- Approximately 30 in-game days
- Persistent player profile and career
- Dialogue, memory and relationship systems
- Evidence discovery
- Legal research using verified material
- Drafting and evaluation
- Senior feedback
- Save/load and world clock
- One illustrated office location prototype

### Example first case

A fictional criminal matter involving a disputed physical altercation, conflicting eyewitness accounts, a medical report and potentially unreliable digital evidence. It can introduce BNS, BNSS, BSA, forensic reasoning and evidence evaluation.

### Example first chapter: “The First Brief”

- Days 1–5: newcomer introduction and first research assignment.
- Days 6–10: first case, client interview, facts and applicable law.
- Days 11–15: disagreement with colleague, senior challenges reasoning, evidence complication.
- Days 16–20: courtroom exposure, drafting and opposing arguments.
- Days 21–25: first meaningful contribution.
- Days 26–30: evaluation, feedback, reputation changes and next career choice.

## 19. Development priorities

### P0 — Foundation

- Player profile and career state
- One firm and core locations
- 8–12 persistent characters
- Dialogue, memory and relationships
- One coherent case
- Evidence discovery
- Verified legal material and retrieval
- Research, drafting and evaluation
- Senior feedback
- Save/load and world clock
- Basic illustrated scene interaction

### P1 — First chapter expansion

- Courtroom system
- Opposing counsel
- Client management
- Multiple cases
- Ethics
- Reputation
- Personal life
- Specialisations

### P2 — Full legal world

- Independent practice and firm ownership
- Advanced litigation
- Higher-court pathways
- Major cases
- Rival firms
- Larger verified legal corpus
- Evolving legal events

### P3 — Experiments

- Multiplayer
- Player-run firms
- Moot court and tournaments
- Community-created cases
- More jurisdictions
- Advanced world simulation

## 20. Architecture principles and non-negotiables

- Start as a modular monolith; do not introduce microservices prematurely.
- Suggested stack: Next.js App Router, TypeScript, Tailwind, PostgreSQL and Prisma. Reassess based on the existing repository rather than blindly replacing working technology.
- Keep deterministic game rules separate from AI generation.
- Keep canonical case truth separate from discovered player knowledge.
- Keep legal sources/versioning separate from generated explanations.
- Validate AI output schemas and persist structured state.
- Use transactions for important state changes.
- Test persistence, continuity, knowledge boundaries and legal-source handling.
- Never present fabricated legal citations as real.
- Never let characters know facts they have not discovered.
- Keep fiction and real-world legal information clearly labelled.
- Make the interface mobile-first and accessible.
- Do not claim a feature works until it has been implemented and tested.

## 21. Initial OpenCode instructions

OpenCode should first inspect the existing repository before making architectural decisions.

Recommended first task:

1. Audit repository structure, existing implementation, framework, database, tests and runtime inference setup.
2. Identify existing working features and broken/incomplete features.
3. Compare the repository against this product context.
4. Produce a concise implementation plan with dependencies and risks.
5. Propose a realistic P0 vertical slice.
6. Only then begin implementation in small, testable phases.

Use specialised agents where useful:

- Product Architect
- World / Simulation Architect
- Case Architect
- Legal Research and Source Verification
- Character and Relationship Designer
- Frontend / Visual Environment Developer
- Runtime AI / Model Integration
- Evaluation Designer
- QA Auditor

Agents must share the same source of truth and avoid parallel edits that conflict. Require integration checks after each phase.

Do not attempt to implement every feature in one enormous run. Deliver a working vertical slice, test it, then expand.

---

## 22. Open questions (do not silently assume answers)

- Exact target platforms: mobile web first, installable PWA, native app, or desktop?
- Initial visual art style: realistic illustration, stylised realism, graphic novel or another direction?
- Which runtime model/provider will be available in the first playable build?
- Is local on-device inference a requirement for the first release or a later optimisation?
- How much real legal content can be sourced, licensed and verified for the first release?
- Which practice area should follow the initial criminal case?
- Should personal life and romance be included in the first chapter or deferred?
- What is the initial repository's actual stack and current implementation status?

**Instruction to agents:** Treat this document as product context, not proof of existing implementation. Inspect the repository, verify facts, record decisions and report uncertainty instead of inventing answers.
