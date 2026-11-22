# SETUP-GUIDE - Autonomous OpenCode Development Team

## Overview

This repository is configured as an autonomous multi-agent OpenCode development environment for the **THE INVESTIGATION** project (`project-investigation/`, PRD at `project-investigation/PRD.md`).

The system is designed so the **Orchestrator** receives objectives, inspects state, delegates to specialized subagents, verifies evidence, updates project memory, and advances work with minimal manual handoff.

## Agent roster

| Agent | Mode | File | Primary responsibility | Key permissions/limits |
|---|---|---|---|---|
| `orchestrator` | primary (default) | `.opencode/agents/orchestrator.md` | Owns lifecycle: plan, delegate, verify, update memory, decide next action, escalate on repeated failures | Can delegate to subagents; destructive shell guarded; never push/deploy automatically |
| `builder` | subagent | `.opencode/agents/builder.md` | Implements assigned tasks, runs checks, reports changes/verification | Edit/shell allowed; can delegate independent subtasks via `subagent`; no push/deploy |
| `scrutinizer` | subagent | `.opencode/agents/scrutinizer.md` | Independent audit vs PRD/task; targeted tests; evidence-based verdict | **Read-only for edits** (`edit` denied); can run shell checks; no production code rewrites |
| `bug-fixer` | subagent | `.opencode/agents/bug-fixer.md` | Root-cause analysis, minimal fix, targeted regression verification | Edit/shell allowed; can delegate independent investigation subtasks via `subagent`; no scope expansion |
| `architect` | subagent | `.opencode/agents/architect.md` | Breaks complex work into tasks, dependencies, risks, implementation plan | **Read-only for edits** (`edit` denied) |
| `ui-ux-frontend` | subagent | `.opencode/agents/ui-ux-frontend.md` | Designs and implements beautiful, accessible UI/UX/components/animations; web research for inspiration/prebuilt patterns | Edit/shell allowed; websearch/webfetch allowed; can delegate independent subtasks via `subagent`; no push/deploy |
| `devops-engineer` | subagent | `.opencode/agents/devops-engineer.md` | CI/CD, build/release scripts, env/config, Docker, observability, developer tooling | Edit/shell allowed; push/deploy ask; destructive guarded |
| `researcher` | subagent | `.opencode/agents/researcher.md` | External docs/library/API/best-practice research with cited sources | **Read-only for edits** (`edit` denied); websearch/webfetch allowed |
| `qa-engineer` | subagent | `.opencode/agents/qa-engineer.md` | Test scenarios, user journeys, edge cases, regression validation | Can run/add relevant tests; no push/deploy |
| `user-tester` | subagent | `.opencode/agents/user-tester.md` | Simulates real user behavior for usability, visuals, flows, and accessibility review | **Read-only for edits** (`edit` denied); can run app/browser checks; reports evidence-based issues |
| `security-auditor` | subagent | `.opencode/agents/security-auditor.md` | Auth/authz, API/input validation, secrets, dependency/data handling review | **Read-only for edits** (`edit` denied); reports risks only |

## Configuration structure

```text
/home/divyanshukumarsinha241/
├── opencode.jsonc                  # Project OpenCode config: default_agent, permissions, instructions
├── AGENTS.md                       # Persistent project instructions for agents
├── SETUP-GUIDE.md                  # This guide
├── .opencode/
│   └── agents/
│       ├── orchestrator.md
│       ├── architect.md
│       ├── builder.md
│       ├── bug-fixer.md
│       ├── devops-engineer.md
│       ├── qa-engineer.md
│       ├── researcher.md
│       ├── scrutinizer.md
│       ├── security-auditor.md
│       ├── ui-ux-frontend.md
│       └── user-tester.md
└── project-management/
    ├── DEV-STATUS.md               # Human-readable current status
    ├── TASKS.md                    # Task backlog/ownership/evidence
    ├── BUGS.md                     # Defect lifecycle
    ├── TEST-REPORT.md              # Test/verification log
    ├── DECISIONS.md                # Decision log
    ├── ORCHESTRATION-STATE.json    # Machine-recoverable orchestration state
    ├── ORCHESTRATION-LOG.md        # Append-only orchestration/event log
    ├── RECOVERY.md                 # Resume/recovery protocol
    └── MODEL-POLICY.md             # Model selection/fallback/wait policy
```

### Key config choices (`opencode.jsonc`)

- `default_agent`: `"orchestrator"` - makes Orchestrator the default primary agent for new sessions in this workspace.
- `instructions`: includes `AGENTS.md`, `project-management/DEV-STATUS.md`, `project-management/RECOVERY.md`, and `project-management/ORCHESTRATION-STATE.json` so agents get recovery context.
- `permissions`: guards destructive/sensitive shell operations (`git push` asks, `sudo *` asks, `rm -rf /*` denied). Agent files also include role-specific permissions.

## How to start the Orchestrator

From the workspace root:

```bash
cd /home/divyanshukumarsinha241
opencode
```

Because `default_agent` is set to `orchestrator`, new sessions should start with Orchestrator as the primary agent. You can also explicitly select it in the TUI if needed.

For a one-shot prompt:

```bash
cd /home/divyanshukumarsinha241
opencode run "Read project-management/DEV-STATUS.md and continue the current objective."
```

## How to give it objectives

Give clear, outcome-oriented objectives. Include scope, constraints, and definition of done when possible.

Examples:

- "Read the PRD and project-management files, then implement the next highest-priority MVP task in `project-investigation/`. Validate with tests and update project memory."
- "Audit the accusation evaluation flow against PRD §10 and fix any confirmed defects. Do not change unrelated behavior."
- "Create an implementation plan for wiring canonical truth deterministically, then implement it with tests."

The Orchestrator should inspect relevant files first, update `project-management/TASKS.md`, delegate to subagents, and report evidence.

## How delegation works

The Orchestrator uses OpenCode's `subagent` tool to invoke specialized agents. Delegation is explicit and evidence-driven:

1. Orchestrator inspects objective/PRD/state.
2. Optionally delegates planning to `architect` and external research to `researcher`.
3. Delegates implementation to `builder` (backend/general), `ui-ux-frontend` (UI/UX), or `devops-engineer` (CI/build/env/tooling) with specific acceptance criteria.
4. Delegates independent verification to `scrutinizer`.
5. If defects found, delegates to `bug-fixer`, then back to `scrutinizer`.
6. Uses `qa-engineer` for milestone/regression testing, `user-tester` for human-like usability/visual review, and `security-auditor` for security-sensitive work.
7. Updates project-memory files and advances.

Subagents run in child sessions. The Orchestrator should pass complete context in the prompt (relevant files, PRD sections, acceptance criteria, commands). For follow-up on the same child session, pass the returned `sessionID`.

Parallel delegation is allowed only for independent, non-overlapping tasks.

## Persistent orchestration

The Orchestrator maintains durable orchestration state in `project-management/`:

- **ORCHESTRATION-STATE.json** - machine-recoverable state: objective, milestone, status, active/last task, next action, model policy state, task assignments (agent, status, result, next action), recovery checkpoint/blockers.
- **ORCHESTRATION-LOG.md** - append-only audit log: task assignments, agent results, state transitions, model events, recovery checkpoints.
- **DEV-STATUS.md / TASKS.md / BUGS.md / TEST-REPORT.md / DECISIONS.md** - human-readable project memory.

Rule: every task assignment, agent result, blocker, model event, and checkpoint must be recorded in STATE/LOG and reflected in human-readable memory.

## Recovery Controller

`project-management/RECOVERY.md` defines the resume protocol. On startup/resume/refresh/restart, Orchestrator must:

1. Read ORCHESTRATION-STATE.json, ORCHESTRATION-LOG.md, DEV-STATUS, TASKS, BUGS, MODEL-POLICY, relevant DECISIONS.
2. Reconstruct objective, active/interrupted task, last completed task, blockers, model wait state, next action.
3. Validate recorded state against repo evidence; trust evidence if conflict.
4. Resume from `next_action` or highest-priority unblocked task.
5. Report recovered state and continue without asking user to repeat instructions unless truly missing.

Resume command examples:

```bash
cd /home/divyanshukumarsinha241
opencode
# then: "Resume from project-management/ORCHESTRATION-STATE.json"
```

```bash
cd /home/divyanshukumarsinha241
opencode run "Resume from project-management/ORCHESTRATION-STATE.json and continue the next actionable task."
```

## Model routing & Model Manager (token-efficient)

`project-management/MODEL-POLICY.md` defines role-based model routing, fallback, and exhaustion behavior. Per-agent `model` is set via supported OpenCode agent frontmatter/config.

| Agent | Default model | Fallback (operational) | Why |
|---|---|---|---|
| `orchestrator` | `opencode/iceman-free` | - | Stronger coordination/synthesis |
| `builder` | `opencode/hy4-flash-free` | `opencode/iceman-free` | Fast capable coding; iceman fallback |
| `architect` | `opencode/deepseek-v4.1-flash-free` | `opencode/iceman-free` | Planning/reasoning at default variant |
| `ui-ux-frontend` | `opencode/iceman-free` | `opencode/hy4-flash-free` | UI/UX design, components, animations, frontend implementation |
| `devops-engineer` | `opencode/hy4-flash-free` | `opencode/iceman-free` | CI/CD, build/env/tooling, safe ops |
| `researcher` | `opencode/nemotron-3.5-lightning-free` | `opencode/hy4-flash-free` | Fast read-only web/docs research with citations |
| `bug-fixer` | `opencode/hy4-flash-free` | `opencode/iceman-free` | Debugging default; avoids costly deepseek |
| `scrutinizer` | `opencode/nemotron-3.5-lightning-free` | `opencode/hy4-flash-free` | Lightweight read-only audit/tests |
| `qa-engineer` | `opencode/nemotron-3.5-lightning-free` | `opencode/hy4-flash-free` | Lightweight test execution/reporting |
| `user-tester` | `opencode/hy4-flash-free` | `opencode/nemotron-3.5-lightning-free` | Human-like usability/visual/a11y review with better judgment |
| `security-auditor` | `opencode/nemotron-3.5-lightning-free` | `opencode/hy4-flash-free` | Lightweight read-only security checklist |
| `compaction/title/summary` | `opencode/nemotron-3.5-lightning-free` | - | Cheap hidden maintenance tasks |

**Routing rules:** smaller/faster models for scrutiny/testing/summarization; stronger models for build/orchestration; escalate to stronger model if lightweight agent is insufficient. Verify availability with `opencode models` / `/models`; adjust in `.opencode/agents/*.md` or `opencode.jsonc`.

**Exhaustion handling:** Orchestrator logs quota/rate-limit/model errors in `ORCHESTRATION-STATE.json`/`ORCHESTRATION-LOG.md`, attempts supported fallback when possible, otherwise sets `waiting_for_model_capacity=true`, checkpoints, and reports exact resume steps. No tight retry loops.

**Runtime limitation:** no guaranteed automatic mid-session model failover inside a running session; this is operational policy + persistent recovery, not invisible background switching.

## Permission and safety boundaries

- **No automatic remote push/deploy**: `git push` requires approval; deployment should not be automated.
- **Destructive commands guarded**: `sudo *` asks, `rm -rf /*` denied; other destructive actions should be treated cautiously and require approval when risky.
- **Read-only agents**: `scrutinizer`, `security-auditor`, `architect`, `researcher`, and `user-tester` have `edit` denied by default to prevent unintended changes.
- **Secrets**: no hardcoded API keys/secrets; use env vars/.env patterns already used by project.
- **Evidence-based claims**: agents must not claim tests passed or bugs fixed without executed evidence.

## Known limitations

- **No background execution after process exit**: if OpenCode closes, work stops. Recovery Controller reconstructs state on next invocation from `ORCHESTRATION-STATE.json`/logs.
- **No guaranteed scheduled/cron execution**: this setup does not create persistent schedulers or background jobs.
- **Model Manager is operational, not guaranteed auto-failover**: OpenCode does not expose a guaranteed agent-config-only mechanism for automatic mid-session model switching on quota exhaustion. The system detects/logs exhaustion, checkpoints, attempts supported fallback where possible, and provides wait/resume instructions; it does **not** claim invisible background model switching inside a running session.
- **Subagent background behavior depends on OpenCode runtime**: Orchestrator should wait for subagent completion notifications; it should not poll/sleep aggressively.
- **Model/provider availability**: this setup preserves existing model/provider config and does not hardcode models. Agent quality depends on configured/available models.
- **Project tests may have environment dependencies**: `project-investigation` smoke tests require local Postgres configuration as documented in `IMPLEMENTATION_STATUS.md` and `src/db.ts`.
- **Read-only is tool-policy, not absolute filesystem security**: shell commands can still be powerful; policies reduce risk but do not replace trusted execution environments.

## Validation checklist

After changes to this setup, validate:

```bash
cd /home/divyanshukumarsinha241
opencode debug config
opencode debug agents
```

Confirm:
- `opencode.jsonc` is loaded.
- `default_agent` is `orchestrator`.
- All 11 agent files are discoverable.
- Orchestrator is primary; others are subagents.
- Permission rules reflect intended safety boundaries.

Also run project checks when relevant:

```bash
cd /home/divyanshukumarsinha241/project-investigation
npm run typecheck
npm run test:smoke
```

Record results in `project-management/TEST-REPORT.md`.
