# AGENTS.md

## Project

- **Workspace**: `/home/divyanshukumarsinha241`
- **Main product codebase**: `project-investigation/`
- **PRD (source of truth for product requirements)**: `project-investigation/PRD.md`
- **Project memory**: `project-management/DEV-STATUS.md`, `TASKS.md`, `BUGS.md`, `TEST-REPORT.md`, `DECISIONS.md`
- **Persistent orchestration/recovery**: `project-management/ORCHESTRATION-STATE.json`, `ORCHESTRATION-LOG.md`, `RECOVERY.md`, `MODEL-POLICY.md`
- **Setup guide**: `SETUP-GUIDE.md`

## Working rules

- Inspect relevant files before making changes; do not assume state.
- On startup/resume, follow `project-management/RECOVERY.md` and reconstruct state from `ORCHESTRATION-STATE.json`/logs before acting.
- Follow existing code style and patterns in `project-investigation/`.
- Use project-management files as the source of truth for ongoing work; update ORCHESTRATION-STATE/LOG on task assignments, results, and checkpoints.
- Do not claim tests passed unless actually executed.
- Never hardcode secrets/API keys. Never push to remote or deploy to production automatically.
- Destructive operations require explicit approval.
- On model quota/rate-limit exhaustion, follow `project-management/MODEL-POLICY.md`: log, fallback if possible, otherwise checkpoint and wait with clear resume instructions (no tight retry loops).

## Verification (project-investigation)

Run from `project-investigation/` when relevant:

```bash
npm run typecheck
npm run test:smoke
npm test
```

Note: `npm run test:smoke` requires a configured local Postgres environment (see `project-investigation/src/db.ts` and IMPLEMENTATION_STATUS.md).
