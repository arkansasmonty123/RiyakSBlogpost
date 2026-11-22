# Model Policy

> **Ownership**: Orchestrator reads/updates this policy. User may edit preferences.  
> **Purpose**: Define token-efficient model selection, per-agent routing, fallback, and exhaustion handling for autonomous orchestration.

## Current runtime reality (important)

OpenCode supports per-agent `model` in agent config/frontmatter (`provider/model[#variant]`). Subagents use their configured model; if unset, they inherit the parent session model. This workspace uses that supported mechanism for role-based routing.

OpenCode does **not** expose a guaranteed native "auto-switch model on quota exhaustion mid-session" config in this workspace. The Orchestrator must apply exhaustion handling **operationally**: detect model/rate-limit/quota errors, record them, switch/fallback using supported mechanisms when available; otherwise checkpoint and wait with exact resume instructions.

## Role-based model routing (token-efficient defaults)

Selected from available `opencode/*` free models at setup time (`opencode models`). Adjust if availability changes.

| Agent | Role complexity | Default model | Fallback | Rationale |
|---|---|---|---|---|
| `orchestrator` | High - coordination, synthesis, decisions | `opencode/iceman-free` | - | Stronger default for lifecycle control and delegation quality |
| `builder` | High - code implementation | `opencode/hy4-flash-free` | `opencode/iceman-free` | Fast capable coding default; fallback to iceman when needed |
| `architect` | Medium/High - planning/reasoning, read-only | `opencode/deepseek-v4.1-flash-free` | `opencode/iceman-free` | Reasoning-focused flash model; default variant |
| `ui-ux-frontend` | High - UI/UX design, frontend implementation, animations | `opencode/iceman-free` | `opencode/hy4-flash-free` | Needs strong design+frontend coding; web research for inspiration/prebuilt patterns |
| `devops-engineer` | Medium - CI/CD, build, env, infra config | `opencode/hy4-flash-free` | `opencode/iceman-free` | Operational tooling/scripts; safe, reproducible changes |
| `researcher` | Low/Medium - web/docs research, read-only | `opencode/nemotron-3.5-lightning-free` | `opencode/hy4-flash-free` | Fast cited research; escalate complex synthesis if needed |
| `bug-fixer` | Medium - debugging, minimal fixes | `opencode/hy4-flash-free` | `opencode/iceman-free` | User-preferred default for debugging; avoid costly deepseek by default |
| `scrutinizer` | Low/Medium - audit/checklists/tests, read-only | `opencode/nemotron-3.5-lightning-free` | `opencode/hy4-flash-free` | Lightweight/fast for scrutiny and targeted verification |
| `qa-engineer` | Low/Medium - test scenarios/regression | `opencode/nemotron-3.5-lightning-free` | `opencode/hy4-flash-free` | Lightweight/fast for test execution and reporting |
| `user-tester` | Low/Medium - human-like usability/visual/a11y review, read-only | `opencode/hy4-flash-free` | `opencode/nemotron-3.5-lightning-free` | Better judgment for UX/visual friction; use webapp-testing/design guideline skills |
| `security-auditor` | Low/Medium - read-only security review | `opencode/nemotron-3.5-lightning-free` | `opencode/hy4-flash-free` | Lightweight/fast for checklist-style audits; escalate complex findings to orchestrator |
| `compaction` (hidden) | Low - summarization | `opencode/nemotron-3.5-lightning-free` | - | Cheap summarization |
| `title` (hidden) | Low - short title generation | `opencode/nemotron-3.5-lightning-free` | - | Cheap metadata generation |
| `summary` (hidden) | Low - summarization | `opencode/nemotron-3.5-lightning-free` | - | Cheap summarization |

## Routing rules

1. **Role fit first**: use smaller/faster models for read-only audits, tests, summarization, and routine checks; reserve stronger models for implementation and high-stakes orchestration/planning.
2. **Availability first**: before relying on a configured model, confirm it exists in `/models` or `opencode models`. If unavailable, fall back to parent/default model or another available model and log the change.
3. **Escalate on complexity**: if a lightweight agent fails due to reasoning/coding limits, Orchestrator may reassign task to a stronger model/agent and record decision.
4. **No unnecessary upgrades**: do not route simple scrutiny/test tasks to heavy models.

## Exhaustion/fallback behavior

1. **On model error** (429/quota/rate-limit/unavailable/auth): capture error, timestamp, model, task ID; log in `ORCHESTRATION-LOG.md` and update `ORCHESTRATION-STATE.json.model_policy`.
2. **Fallback attempt**: switch to an available fallback for new work (user `/models` selection, or `opencode run --model ...` for a fresh run). Record switch.
3. **No fallback available**: set `waiting_for_model_capacity=true`, checkpoint, report exact wait/resume instructions. No tight retry loops.
4. **Resume**: re-check availability; clear wait flag only after successful retry/switch; continue from recorded `next_action`.

## User actions when all options exhausted

- Wait for quota reset / add credits / enable provider.
- Select available model in TUI: `/models`.
- Resume with explicit model: `opencode run --model provider/model "Resume from project-management/ORCHESTRATION-STATE.json"`.

## Audit

Every model assignment change, fallback, switch, or wait event must be logged in `ORCHESTRATION-LOG.md` and reflected in `ORCHESTRATION-STATE.json`.