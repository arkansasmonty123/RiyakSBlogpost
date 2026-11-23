# Findings & Decisions

## Requirements
- Improve existing agents and orchestration for real software-engineering practice.
- Do not inspect or modify the game projects; keep changes to OpenCode agent/config documentation.
- Preserve unrelated in-progress workspace changes and current negotiations recovery state.
- User preference: use web research by default; current OpenCode docs are primary source.

## Research Findings
- OpenCode V2 agents have their own configured permissions; subagent permissions on the parent determine which children it can launch. Children run in background with fresh context. Source: https://opencode.ai/docs/agents
- Permission rules are ordered and last matching rule wins; agent permissions append after global rules. Source: https://opencode.ai/docs/permissions
- OpenCode V2 supports worktree configuration, but agent docs do not guarantee automatic worktree isolation for every subagent. Orchestration should explicitly avoid overlapping concurrent writes and verify shared worktree state. Source: https://opencode.ai/docs/config
- Current orchestration hardcodes `project-investigation/` as main project despite active project now being negotiations. It also requires scrutinizer/user-tester on a near-every-change basis, creating cost/latency overhead.
- Current incident record describes destructive concurrent subagent collision. Agent prompts need explicit single-writer/file-ownership rules, baseline/diff preservation, no reset/restore/clean, and stop/escalate on unexpected deletions or concurrent edits.
- Workspace has many unrelated in-progress modifications/deletions. Do not touch those or attempt to reconcile them as part of this task.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Keep current agent roster; improve orchestration and role contracts rather than add agents | Existing roles cover implementation, design, operations, GitHub, QA, review, security, research, and user testing |
| Make Fast the default and gate independent reviews by risk | Reduce handoff/testing overhead while keeping strong controls for security, data, migrations, critical logic, and release |
| Enforce single-writer ownership and stop-on-conflict behavior | Prevent recurrence of destructive concurrent edits; subagents share project state unless isolated |
| Make active project resolution state-driven | Workspace currently contains multiple projects and the hardcoded orchestrator target is stale |
| Keep Orchestrator sole owner of shared task/state/log files | Avoid worker races and inconsistent orchestration records |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Active project has a recorded critical backend recovery task, with concurrent UI work and a dirty workspace | Scope this task to agent/setup files only; do not read/edit project source or touch user changes |

## Resources
- https://opencode.ai/docs/agents
- https://opencode.ai/docs/permissions
- https://opencode.ai/docs/config
