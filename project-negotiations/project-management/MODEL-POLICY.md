# Model Policy - The Negotiation Table

## Defaults
- Orchestrator: `opencode/iceman-free`
- Builder: `opencode/hy4-flash-free` (fallback `iceman-free`)
- UI/UX/QA/Scrutinizer/Security/User-tester: per root OpenCode agent config; choose lighter models for read-only audits.

## Rules
1. Do not tight-loop on quota/rate-limit/model errors.
2. On exhaustion: log error, checkpoint state, report exact resume instruction.
3. Use stronger models only for complex implementation/planning; prefer lighter models for audits/tests.
4. Record model switches/waits in `ORCHESTRATION-LOG.md` and `ORCHESTRATION-STATE.json`.

## Resume
`opencode` then: "Resume The Negotiation Table from project-negotiations/project-management/ORCHESTRATION-STATE.json"