---
name: context-harness
description: Apply context engineering and harness engineering to AI coding agent work - reduce token/context waste, prevent repo scans, improve reliability with verification/guardrails, and turn repeated failures into durable harness improvements.
---

# Context & Harness Engineering

Use this skill when agent runs are slow/expensive, scanning too much, losing context, or making repeated mistakes. Goal: smallest high-signal context + reliable harness.

## Context engineering (input budget)

- **Curate, don't dump.** Start from task, acceptance criteria, and named entry points. Read minimum relevant files first; expand only with evidence.
- **No broad scan.** Never `ls -R`/recursive repo reads by default. Use targeted `rg`, `glob`, symbol/file slices.
- **Just-in-time retrieval.** Keep lightweight refs (paths/symbols/queries); fetch detail only when needed.
- **Tool/output budget.** Run narrow commands (one test file, filtered logs). Cap/trim large output; summarize key file/line/signal. Disable unused MCP/tools.
- **Progressive disclosure.** Keep always-loaded rules short; put detail in path-scoped docs/skills loaded on demand.
- **Distill/compact.** One task per session. `/compact` with focus when continuity matters; fresh session on topic change. Don't carry dead history.
- **Isolate noise.** Use subagents for broad exploration/log/research; return condensed summaries, not raw dumps.
- **Externalize state.** Write plans/decisions/checkpoints to files outside the window; pull back when needed.
- **Cache awareness.** Stable instructions first, volatile task last; caching cuts cost but cached tokens still occupy context.

## Harness engineering (runtime reliability)

- **Feedforward + feedback.** Guides before action (rules/skills/plan); sensors after action (tests/lint/typecheck/runtime/browser checks).
- **Verification is mandatory.** Exact commands, exit codes, artifacts/screenshots, observed outcomes. Never claim unobserved checks passed.
- **Hard boundaries.** Least privilege: scoped paths/tools, approvals for risky/destructive actions, no secrets in prompts/logs.
- **Tool design.** Small relevant outputs; actionable errors (what failed, where, next step); separate risky writes from safe reads.
- **Failure -> harness change.** Repeated mistake becomes a rule, checklist, skill, guardrail, or test - not repeated chat correction.
- **Trace before tweak.** When behavior is bad, inspect what context/tools/steps caused it; change one harness knob at a time.

## Orchestrator handoff checklist

Include in every subagent prompt:
- Objective + acceptance criteria
- In-scope / out-of-scope paths and start files
- Read/query budget and "no broad repo scan" rule
- Required skills/docs/current-source checks
- Commands/checks to run and expected signal
- Report format with evidence and gaps/risks

## Tool stack (configured in opencode.jsonc)

MCPs are enabled by default; agents may toggle `mcp.servers.<name>.enabled` in `opencode.jsonc` when useful/noisy (report changes). Extra enabled MCP servers add tool-schema context overhead.

| Category | Config key | Status | How to enable / use |
|---|---|---|---|
| Code graph (local) | `mcp.servers.graphify_local` | enabled (binary installed) | Build graph: `/home/divyanshukumarsinha241/.local/bin/graphify .` (in target project). Set `enabled:true`, adjust `--graph` path, then use Graphify MCP tools for callers/impact/path/query before broad reads. |
| Code graph (hosted) | `mcp.servers.graphify` | enabled (may need OAuth) | Set `enabled:true`, authenticate via TUI `/mcps` if required. Use for cross-repo/shared graph; review data/privacy before sending code. |
| Structural index MCP | `mcp.servers.codebase_memory` | enabled (verify/index) | Verify package command, set `enabled:true`, index repo per package docs, then query symbols/call paths instead of file scans. |
| LSP/symbol MCP | `mcp.servers.serena` | enabled (verify deps) | Verify command/deps, set `enabled:true`; use for definition/references/symbol operations. |
| Semantic search MCP | `mcp.servers.code_context_engine` | enabled (verify deps) | Verify command/deps, set `enabled:true`; use for meaning-based code discovery, then read exact source before editing. |
| Context compression | (external/proxy) | not wired | Use targeted commands, `head/tail/rg`, subagent summaries. Optional: evaluate RTK/Headroom/LeanCTX; measure before/after on real tasks. |
| Prompt caching | provider/runtime | active by default where supported | Keep stable instructions/tool defs first, volatile task last; avoid unnecessary prefix churn. |
| Model routing | `agents.compaction/title/summary` | configured | Use small/cheap models for lightweight tasks; reserve strong models for complex reasoning. Add per-agent overrides only with measured benefit. |

## Measurement checklist

Before/after on 5-10 real tasks: total tokens/cost, time-to-correct-answer, files read, missed files/false edges, index freshness, privacy/risk. Remove tools that add overhead without measurable win.
