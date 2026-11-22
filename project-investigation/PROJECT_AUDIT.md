# PROJECT AUDIT - THE INVESTIGATION

## Repository Status: GREENFIELD

This is a fresh workspace with no existing codebase, framework, or technology stack. The only file present is the PRD.md created earlier.

### Current Files
- `/home/divyanshukumarsinha241/PRD.md` — Product Requirements Document
- `/home/divyanshukumarsinha241/PROJECT_AUDIT.md` — This audit document
- `/home/divyanshukumarsinha241/IMPLEMENTATION_PLAN.md` — Implementation plan

### Technology Stack: PARTIALLY SETUP

#### Backend
- **Framework**: Node.js with Express (to be set up)
- **ORM**: Drizzle ORM with PostgreSQL (schema created, tables migrated)
- **Runtime**: Node.js v26.13.0
- **Package Manager**: npm

#### Frontend
- **Framework**: Not yet set up (will be React + TypeScript)
- **Styling**: Not yet set up (will be Tailwind CSS)
- **State Management**: Not yet set up (will be React Query + Context)

#### Database
- **System**: PostgreSQL 16 (running)
- **Database**: `investigation`
- **Schema**: 12 tables created via raw SQL
- **ORM Status**: Drizzle schema defined but migration path under refinement

### Critical Systems Identified from PRD

1. **Mystery Engine** — Structured case representation with canonical truth, character knowledge, evidence, dependencies, deduction checkpoints
2. **Investigation System** — Persistent investigation state machine, investigation room UI, group chat, evidence room, suspect profiles, timeline, journal
3. **Asynchronous Event Engine** — Deduction-triggered, investigation-action-triggered, and time-triggered evidence releases; scheduled events; offline progression
4. **AI Orchestration** — One shared model with multiple investigator roles; context management; conversation boundaries
5. **Perspective Engine** — Six content categories (philosophy, spirituality, psychology, literature, science, moral dilemmas)
6. **Verdict/Accusation System** — Structured accusation evaluation against canonical solution
7. **Case Library** — 100+ cases with weekly releases, genre/difficulty/duration filtering
8. **Data Architecture** — Versioned case packages, server-side canonical truth, player-visible evidence separation

## Database Status: MIGRATION COMPLETE

All 12 tables created in PostgreSQL `investigation` database:

| Table | Description |
|-------|-------------|
| users | User accounts with preferences and notification settings |
| cases | Case metadata, briefing, genre, difficulty, duration |
| characters | Suspects/witnesses with knowledge, beliefs, secrets |
| evidence | Evidence items with discovery conditions and release rules |
| investigations | Player investigation state machine |
| investigation_state | Persistent investigation state (discovered evidence, theories, checkpoints) |
| conversations | Player AI group chat history and summaries |
| journal_entries | Player's personal investigation notebook |
| scheduled_events | Background event scheduler for async progression |
| accusations | Structured accusation submissions and evaluation |
| weekly_collections | Weekly case release management |
| case_achievements | Player achievements for investigation quality |

### Existing Functionality: LIMITED

- Database tables exist and are populated (empty)
- No API routes implemented
- No frontend components implemented
- No AI integrations
- No investigation state persistence beyond database

### Technical Risks

1. **AI Cost Management** — Uncontrolled token usage can make the platform unaffordable. Requires rigorous model routing and context compression (§12.3, §12.6).
2. **Solution Leakage** — Canonical truth must never reach the frontend. Requires strict server-side authorization (§13.2).
3. **Async Progression Bugs** — Scheduled events must survive server restarts and avoid duplicate releases. Must handle offline progression correctly (§8.4).
4. **Mystery Validation** — Structured mysteries must be logically consistent, solvable, and fair. Adversarial testing required (§19).
5. **Mobile UX** — Investigation room must function well on small screens with touch interaction.

### Missing Features (Complete Greenfield)

- Backend API routes and Express server
- Frontend React application
- Mystery engine logic (canonical truth, evidence authorization)
- Investigation state machine
- AI orchestration layer
- Group chat system
- Scheduled event engine
- Perspective Engine
- Accusation and verdict evaluation
- Case library management
- Weekly release system
- Notification system
- Mobile-responsive UI

## Recommended Development Sequence

Based on the PRD roadmap (Stages 0-10) and the engineering principles:

### Stage 0: Repository Setup (Completed)
- [x] Create project structure
- [x] Initialize npm project
- [x] Configure TypeScript
- [x] Set up ESLint/Prettier
- [x] Configure environment variables
- [x] Set up PostgreSQL database with 12 core tables

### Stage 1: Data Foundation (Completed at DB level)
- [x] Database schema designed with all core models
- [x] Prisma/Drizzle schema defined
- [x] Tables migrated to PostgreSQL
- [ ] TypeScript types for all models
- [ ] Seed script creates basic test data

### Stage 2: Mystery Engine (Not started)
- [ ] Define canonical truth structure
- [ ] Define character knowledge structure
- [ ] Define evidence structure with dependencies
- [ ] Define alternative hypotheses structure
- [ ] Define deduction checkpoint structure
- [ ] Define release condition structure
- [ ] Implement case validation functions
- [ ] Implement case package loader
- [ ] Implement evidence authorization layer
- [ ] Implement structured case validation test suite

### Stage 3: One Playable Case (Not started)
- [ ] Create first complete mystery package
- [ ] Implement case briefing data
- [ ] Populate database with first case
- [ ] Implement case loading API endpoint
- [ ] Implement case validation against canonical truth

### Stage 4: Investigation Interface (Not started)
- [ ] Build case selection UI
- [ ] Implement case briefing component
- [ ] Build investigation room layout
- [ ] Implement evidence viewer component
- [ ] Implement suspect profiles component
- [ ] Implement timeline component
- [ ] Implement detective journal component
- [ ] Implement group chat UI
- [ ] Implement case API integration
- [ ] Ensure mobile-responsive layout

### Stage 5: AI Integration (Not started)
- [ ] Create model abstraction layer
- [ ] Define investigator role prompts
- [ ] Implement context management
- [ ] Implement conversation boundaries enforcement
- [ ] Implement theory extraction from conversation
- [ ] Implement theory evaluation against available evidence
- [ ] Implement basic AI chat response handler
- [ ] Implement conversation summarization
- [ ] Implement duplicate question caching
- [ ] Implement token usage tracking

### Stage 6: Progression Engine (Not started)
- [ ] Implement deduction-triggered release logic
- [ ] Implement investigation-action-triggered release
- [ ] Implement time-triggered release scheduler
- [ ] Implement character-initiated contact
- [ ] Implement combined condition releases
- [ ] Implement scheduled event persistence
- [ ] Implement duplicate release prevention
- [ ] Implement premature revelation prevention
- [ ] Implement offline progression catch-up
- [ ] Implement event notification system

### Stage 7: Perspective Engine (Not started)
- [ ] Define six perspective content categories
- [ ] Create philosophical passages library
- [ ] Create spiritual/religious content
- [ ] Create psychology concept library
- [ ] Create literature/parable collection
- [ ] Implement perspective delivery rules
- [ ] Implement reflective interaction
- [ ] Implement AI discussion of perspective
- [ ] Implement category independence from canonical evidence
- [ ] Implement content licensing verification

### Stage 8: Verdict and Completion (Not started)
- [ ] Implement accusation screen UI
- [ ] Implement structured accusation submission
- [ ] Implement deterministic verdict evaluation
- [ ] Implement verdict types (correct, incorrect, partial)
- [ ] Implement complete solution revelation
- [ ] Implement achievement unlocking
- [ ] Move case to completed archive
- [ ] Implement failed accusation consequences

### Stage 9: Testing and Optimization (Not started)
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Write mystery validation tests
- [ ] Write AI behavior tests
- [ ] Write progression tests
- [ ] Perform security checks
- [ ] Perform performance checks
- [ ] Perform mobile layout testing
- [ ] Fix all linting and type errors
- [ ] Create IMPLEMENTATION_STATUS.md

### Stage 10: Content Platform (Not started)
- [ ] Build case library management UI
- [ ] Implement weekly release workflow
- [ ] Implement case versioning
- [ ] Implement completed archive
- [ ] Implement case abandonment
- [ ] Implement genre/difficulty/duration filtering
- [ ] Implement search functionality
- [ ] Administrative publishing tools

## Estimated Complexity

- **MVP (one case)**: 4-6 weeks with focused development
- **Full platform (100 cases, weekly releases)**: 6-9 months
- **Key bottleneck**: Mystery validation and AI cost management

## Blockers

None currently — all decisions are open. Database is set up and ready for API development.