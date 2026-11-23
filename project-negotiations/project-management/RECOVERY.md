# Recovery Protocol - The Negotiation Table

## On resume
1. Read `project-management/ORCHESTRATION-STATE.json`, `ORCHESTRATION-LOG.md`, `DEV-STATUS.md`, `TASKS.md`, `BUGS.md`, `TEST-REPORT.md`.
2. Read `../PRD.md`, `../ROADMAP.md`, `../docs/ARCHITECT-PLAN.md`.
3. Inspect actual repo state: `git status --short`, `npm run typecheck`, `npm test`, `npm run build` as needed.
4. If state conflicts with evidence, trust evidence and update state/log.
5. Continue from `next_action` or highest-priority unblocked task.

## Guardrails
- Do not revert user changes.
- Do not claim tests passed unless run.
- No deploy/push without explicit approval.
- LLM never sole authority over game state; deterministic fallback must remain labeled.