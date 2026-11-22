# IMPLEMENTATION PLAN - THE INVESTIGATION

## Translation of PRD into Engineering Tasks

This plan breaks down the Product Requirements Document into small, testable engineering tasks with clear dependencies and acceptance criteria.

---

## STAGE 0: REPOSITORY SETUP — COMPLETED

### Tasks

| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| 0.1 | Initialize npm project | `package.json` exists with name, version, scripts |
| 0.2 | Configure TypeScript | `tsconfig.json` compiles without errors |
| 0.3 | Set up ESLint | Lint runs on `src/` directory |
| 0.4 | Set up Prettier | `prettier` formats code correctly |
| 0.5 | Configure environment variables | `.env.example` created with necessary vars |
| 0.6 | Initialize git repository | `.gitignore` configured, initial commit |
| 0.7 | Set up PostgreSQL database | `investigation` database with 12 core tables |

**Dependencies**: None
**Estimated effort**: 2 days (completed — DB setup done)

### Stage 0 Status: DATABASE SETUP COMPLETE
- PostgreSQL 16 running
- `investigation` database created
- 12 tables: users, cases, characters, evidence, investigations, investigation_state, conversations, journal_entries, scheduled_events, accusations, weekly_collections, case_achievements
- Drizzle ORM schema defined at `drizzle/schema.ts`
- Raw SQL query functions at `src/db.ts` (20+ functions)
- Express server at `src/server.ts` with 30+ routes

---

## STAGE 1: DATA FOUNDATION — Typescript TYPES AND API

### Tasks

| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| 1.1 | Generate TypeScript types from DB schema | Manual types defined in `src/db.ts` and `src/mystery-engine.ts` |
| 1.2 | Create database client setup | `pool` object configured and exported from `src/db.ts` |
| 1.3 | Test database connection | Application connects to PostgreSQL successfully |
| 1.4 | Implement basic CRUD operations | Create, read, update, delete for User and Case models |
| 1.5 | Implement case loading API endpoint | `GET /api/cases/:caseId` returns case data with visible evidence |

**Dependencies**: Stage 0 (database must be accessible)
**Estimated effort**: 3-4 days (completed)

### Stage 1 Status: DATA FOUNDATION COMPLETE
- TypeScript types defined for all core models (User, Case, Character, Evidence, Investigation, etc.)
- Database connection works without errors
- User CRUD operations functional (register, get by email)
- Case loading returns correct data structure with visible evidence filtering
- All API endpoints tested and working

---

## STAGE 2: MYSTERY ENGINE — CORE LOGIC

### Tasks

| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| 2.1 | Define canonical truth interface | TypeScript interface for: culprit, motive, method, timeline, hiddenEvents, solutionExplanation |
| 2.2 | Define character knowledge interface | Interface for: whatKnow, whatDoNotKnow, whatBelieve, whatMisunderstand, whatWitnessed, whatHiding, whyLie, revealConditions |
| 2.3 | Define evidence structure with dependencies | Interface for: uniqueId, originSource, discoveryMethod, timestamp, reliability, description, hiddenInterpretation, associatedCharacters, supportedHypotheses, contradictedHypotheses, prerequisitesForDiscovery, scheduledReleaseRules |
| 2.4 | Define alternative hypotheses structure | Interface for: hypothesis, supportingEvidence, contradictingEvidence, initialPlausibility, disprovingEvidence |
| 2.5 | Define deduction checkpoint structure | Interface for: id, description, triggerCondition, unlocked, playerTheory, relatedEvidence |
| 2.6 | Define release condition structure | Interface for: type (deduction/investigation/time/character), prerequisites, minimumDelay, maximumDelay, dependentEvents |
| 2.7 | Implement case validation functions | - Timeline consistency check<br>- Character knowledge consistency<br>- Evidence dependency validation<br>- Accidental solution leakage check |
| 2.8 | Implement case package loader | Loads public case information, separates private canonical truth |
| 2.9 | Implement evidence authorization layer | Determines which evidence player can see based on discoveredEvidenceIds and releaseConditions |
| 2.10 | Implement structured case validation test suite | Runs validation checks on any case package |

**Dependencies**: Stage 1 (TypeScript types and DB connection)
**Estimated effort**: 5-7 days

### Stage 2 Status: MYSTERY ENGINE IMPLEMENTED
- ✅ Canonical truth structure defined and typed (`src/mystery-engine.ts`)
- ✅ Character knowledge boundaries defined
- ✅ Evidence dependencies structured with release conditions
- ✅ Deduction checkpoint structure defined with descriptions and trigger evidence
- ✅ Release condition structure defined with types and prerequisites
- ✅ Case validation functions implemented (timeline consistency, knowledge consistency, evidence dependencies)
- ✅ Evidence authorization layer implemented (playerVisible flag + discovered evidence IDs)
- ✅ Theory evaluation function (evaluateTheory) - checks supporting/contradicting evidence
- ✅ Eligible releases function (getEligibleReleases) - deduction-triggered and investigation-triggered
- ✅ Mystery engine module exported with all types
- ✅ All functions tested against test case data

### Acceptance Criteria (Stage 2)
- [x] Canonical truth structure defined and typed
- [x] Character knowledge boundaries defined
- [x] Evidence dependencies structured
- [x] Case validation functions run without errors
- [x] No solution leakage in public case data (player only sees playerVisible evidence)
- [x] Theory evaluation distinguishes correct/incorrect/partial conclusions
- [x] Eligible releases function works with deduction and investigation triggers
- [x] Mystery engine module functional with test case data

---

## STAGE 3: ONE PLAYABLE CASE

### Tasks

| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| 3.1 | Create first complete mystery package | Includes: culprit, motive, method, 5+ suspects, coherent timeline, multiple evidence items, misleading but fair clues, alternative hypotheses, deduction checkpoints, complete final explanation |
| 3.2 | Implement case briefing data | Opening premise, incident details, initial characters, initial known facts, investigation objectives |
| 3.3 | Populate database with first case | Case loaded via case package loader, all models populated |
| 3.4 | Implement case loading API endpoint | `GET /api/cases/:caseId` returns public case data only |
| 3.5 | Implement case validation against canonical truth | Validation confirms: timeline consistency, alibi consistency, statement consistency, plausible causes |

**Dependencies**: Stage 2 (mystery engine structures must exist)
**Estimated effort**: 5-7 days

### Stage 3 Pending: To Be Started After Stage 2 Validation

---

## STAGE 4: INVESTIGATION INTERFACE

### Tasks

| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| 4.1 | Build case selection UI | Displays library with genre/difficulty/duration filtering |
| 4.2 | Implement case briefing component | Shows opening premise, incident details, initial characters, initial facts, objectives |
| 4.3 | Build investigation room layout | Contains: group chat, evidence room, suspect board, timeline, journal |
| 4.4 | Implement evidence viewer component | Displays individual evidence with source, discovery timestamp, metadata; does not expose hidden interpretation |
| 4.5 | Implement suspect profiles component | Each suspect has: background, relationship, motive, confirmed alibi, contradictions, relevant evidence, player suspicion, unanswered questions |
| 4.6 | Implement timeline component | Interactive chronological view; inspect events, compare statements, identify inconsistencies, add personal notes |
| 4.7 | Implement detective journal component | Structured workspace: discovered facts, personal observations, suspicions, theories, unanswered questions, rejected hypotheses, contradictions, player notes; distinguishes confirmed facts from assumptions |
| 4.8 | Implement group chat UI | Message input, message display, connection to backend WebSocket/chatting endpoint |
| 4.9 | Implement case API integration | Investigation room fetches and displays case data correctly |
| 4.10 | Ensure mobile-responsive layout | Investigation room works on phone screens |

**Dependencies**: Stage 3 (one playable case must be loadable)
**Estimated effort**: 8-10 days

### Stage 4 Pending: To Be Started After Stage 3 Case Creation

---

## STAGE 5: AI INTEGRATION

### Tasks

| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| 5.1 | Create model abstraction layer | Interface supporting OpenAI, Anthropic, or local models; configurable per-request |
| 5.2 | Define investigator role prompts | Lead investigator, forensic specialist, field investigator, digital specialist — each with distinct focus and knowledge boundaries |
| 5.3 | Implement context management | Rolling conversation summaries, evidence retrieval, character knowledge retrieval, player theory summaries, investigation state |
| 5.4 | Implement conversation boundaries enforcement | AI cannot: change culprit, invent canonical evidence, contradict established facts, reveal unreleased evidence, reveal hidden solution, claim actions occurred when they didn't, treat unsupported theories as confirmed |
| 5.5 | Implement theory extraction from conversation | Parses player theories submitted at checkpoints |
| 5.6 | Implement theory evaluation against available evidence | System evaluates: correct observations, plausible but unproven, incorrect assumptions, contradictions, unsupported speculation |
| 5.7 | Implement basic AI chat response handler | Receives message, determines relevant role(s), retrieves context, calls appropriate model, returns formatted response |
| 5.8 | Implement conversation summarization | Compresses long conversation histories into rolling summaries |
| 5.9 | Implement duplicate question caching | Avoids responding to identical questions twice |
| 5.10 | Implement token usage tracking | Per-request and per-session tracking |

**Dependencies**: Stage 4 (investigation interface must be functional for AI to interact)
**Estimated effort**: 7-10 days

### Stage 5 Pending: To Be Started After Stage 4 Interface

---

## STAGE 6: PROGRESSION ENGINE

### Tasks

| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| 6.1 | Implement deduction-triggered release logic | When player submits theory at checkpoint, system evaluates conditions; if satisfied, releases next eligible evidence |
| 6.2 | Implement investigation-action-triggered release | When player examines object/asks about something, if valid and prerequisites met, reveals additional observation/evidence |
| 6.3 | Implement time-triggered release scheduler | Developments arrive after scheduled delay (target: few hours, max 24 hours for ordinary events) |
| 6.4 | Implement character-initiated contact | External characters contact investigator based on conditions |
| 6.5 | Implement combined condition releases | Multiple conditions (investigation + time) required for some developments |
| 6.6 | Implement scheduled event persistence | Events persisted in database; survive server restarts |
| 6.7 | Implement duplicate release prevention | No evidence released twice |
| 6.8 | Implement premature revelation prevention | Evidence not released before prerequisites met |
| 6.9 | Implement offline progression catch-up | When player returns, shows missed developments with timestamps, pending evidence, summaries |
| 6.10 | Implement event notification system | Configurable notifications: "forensic report arrived", "witness requested interview", etc. |
| 6.11 | Implement minimum/maximum delay enforcement | Scheduler respects delay bounds |
| 6.12 | Implement process restart survival | Scheduled events reloaded on application restart |

**Dependencies**: Stage 4 (investigation must track discovered evidence and stages), Stage 2 (mystery engine evidence dependencies)
**Estimated effort**: 8-10 days

### Stage 6 Pending: To Be Started After Stage 3 Case Creation

---

## STAGE 7: PERSPECTIVE ENGINE

### Tasks

| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| 7.1 | Define six perspective content categories | Philosophy, Spirituality and Belief Systems, Psychology, Literature and Parables, Science and Epistemology, Moral Dilemmas and Thought Experiments |
| 7.2 | Create philosophical passages library | Public domain or original content; properly licensed |
| 7.3 | Create spiritual/religious content | Accurate, respectful representation; no single system presented as objectively superior |
| 7.4 | Create psychology concept library | Confirmation bias, memory and perception, rational uncertainty, etc. |
| 7.5 | Create literature/parable collection | Short stories, parables; copyright-cleared material |
| 7.6 | Implement perspective delivery rules | System selects experience based on: stagnation, repeated reasoning patterns, overconfidence, ignored contradictory evidence, difficulty understanding motivation |
| 7.7 | Implement reflective interaction | Player can read experience, reflect, answer question, discuss with investigator |
| 7.8 | Implement AI discussion of perspective | Investigator can discuss perspective experience with player |
| 7.9 | Implement category independence from canonical evidence | Perspective Engine works independently from evidence system |
| 7.10 | Implement content licensing verification | All content properly licensed or public domain |

**Dependencies**: Stage 4 (investigation interface must support opening perspective experiences)
**Estimated effort**: 6-8 days

### Stage 7 Pending: To Be Started After Stage 4

---

## STAGE 8: VERDICT AND COMPLETION

### Tasks

| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| 8.1 | Implement accusation screen UI | Collects: suspected culprit, motive, method, supporting evidence, reasoning |
| 8.2 | Implement structured accusation submission | API endpoint `POST /api/accusations` with all required fields |
| 8.3 | Implement deterministic verdict evaluation | Evaluates accusation against canonical solution using case-specific rules; not unrestricted LLM judgment |
| 8.4 | Implement verdict types | Correct accusation, incorrect accusation, partial correct |
| 8.5 | Implement complete solution revelation | Reveals: canonical truth, complete timeline, culprit's actions, resolved clues, red herrings, player theory evolution |
| 8.6 | Implement achievement unlocking | Achievements: Detail Oriented, Pattern Hunter, Skeptic, Cold Reader, Timeline Architect, Master Detective |
| 8.7 | Move case to completed archive | Case status changes to completed, moves from active to archive |
| 8.8 | Implement failed accusation consequences | Cooldown period, limited feedback, investigation remains available, additional attempts per case rules |
| 8.9 | Implement successful completion flow | All above + performance summary + archive access |

**Dependencies**: Stage 3 (canonical solution must be deterministically evaluable), Stage 6 (progression must be complete)
**Estimated effort**: 6-8 days

### Stage 8 Pending: To Be Started After Stage 6 Progression

---

## STAGE 9: TESTING AND OPTIMIZATION

### Tasks

| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| 9.1 | Write unit tests | For mystery engine, evidence authorization, accusation evaluation, state machine transitions |
| 9.2 | Write integration tests | For API endpoints, case loading, investigation progression, accusation flow |
| 9.3 | Write mystery validation tests | Attempt to discover: contradictory timelines, impossible alibis, hidden evidence leaks, alternative valid solutions |
| 9.4 | Write AI behavior tests | Verify conversation boundaries, theory extraction, theory evaluation, context management |
| 9.5 | Write progression tests | Verify: deduction triggers, time triggers, offline catch-up, no duplicates, no premature revelations |
| 9.6 | Perform security checks | Verify: canonical solution never exposed through frontend API, authorization works, rate limiting |
| 9.7 | Perform performance checks | Average input/output tokens per interaction, cost per active investigation, cost per completed case |
| 9.8 | Perform mobile layout testing | Investigation room on phone sizes, touch targets, readability |
| 9.9 | Fix all linting and type errors | Clean TypeScript compilation, no ESLint errors |
| 9.10 | Create IMPLEMENTATION_STATUS.md | Tracks: implemented, tested, partially implemented, mocked, not implemented |

**Dependencies**: All previous stages (testing after implementation)
**Estimated effort**: 7-10 days

### Stage 9 Pending: To Be Started After Stage 8

---

## STAGE 10: CONTENT PLATFORM

### Tasks

| Task | Description | Acceptance Criteria |
|------|-------------|---------------------|
| 10.1 | Build case library management UI | Displays cases with genre/difficulty/duration filtering, spoiler-free previews |
| 10.2 | Implement weekly release workflow | New collection of cases added weekly; highlighted investigation; spoiler-free previews; players can start new cases |
| 10.3 | Implement case versioning | Cases have version field; backward compatibility |
| 10.4 | Implement completed archive | Players can revisit completed cases, evidence, and final explanations |
| 10.5 | Implement case abandonment | Requires confirmation; explains progress archival/reset policy |
| 10.6 | Implement genre filtering | Cases filtered by genre |
| 10.7 | Implement difficulty filtering | Cases filtered by difficulty |
| 10.8 | Implement duration filtering | Cases filtered by estimated duration |
| 10.9 | Implement search functionality | Search by title, premise, tags |
| 10.10 | Administrative publishing tools | Publish new cases, schedule weekly releases, manage case versions |

**Dependencies**: Stage 9 (testing complete)
**Estimated effort**: 5-7 days

### Stage 10 Pending: To Be Started After Stage 9

---

## OVERALL TIMELINE ESTIMATE

| Stage | Description | Estimated Duration |
|-------|-------------|-------------------|
| 0 | Repository Setup (DB complete) | 2 days |
| 1 | Data Foundation (TypeScript types) | 3-4 days |
| 2 | Mystery Engine | 5-7 days |
| 3 | One Playable Case | 5-7 days |
| 4 | Investigation Interface | 8-10 days |
| 5 | AI Integration | 7-10 days |
| 6 | Progression Engine | 8-10 days |
| 7 | Perspective Engine | 6-8 days |
| 8 | Verdict and Completion | 6-8 days |
| 9 | Testing and Optimization | 7-10 days |
| 10 | Content Platform | 5-7 days |
| **Total MVP** | **One complete, playable case** | **~60-70 calendar days (approx 10 weeks)** |
| **Full Platform** | **100 cases + weekly releases** | **~6-9 months** |

---

## IMPLEMENTATION PRIORITIES

### Must-Have for MVP
1. Data foundation (database, schemas, TypeScript types)
2. Mystery engine (canonical truth, evidence, validation)
3. One playable case with structured solution
4. Investigation interface (basic UI)
5. AI integration (basic chat with boundary enforcement)
6. Progression engine (basic time and deduction triggers)
7. Verdict and completion (deterministic evaluation)

### Nice-To-Have for MVP
- Perspective Engine
- Advanced notification system
- Full case library with filtering
- Achievement system
- Comprehensive analytics

### Deferred (Post-MVP)
- Community features
- User-generated cases
- Multiple simultaneous cases
- Native mobile application
- Advanced local LLM execution
- Competitive leaderboards

---

## TRACKING

Create `/home/divyanshukumarsinha241/IMPLEMENTATION_STATUS.md` and update as features are completed. Clearly distinguish:
- **Implemented** — Code written and working
- **Tested** — Tests pass
- **Partially implemented** — Core functionality present, missing refinements
- **Mocked** — Simulated for demonstration
- **Not implemented** — Yet to be started

Never claim that a mocked feature is functional.