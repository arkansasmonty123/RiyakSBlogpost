# Recovery Protocol

> **Ownership**: Orchestrator follows this on every new/resumed session.  
> **Purpose**: Reconstruct workflow after interruption, refresh, restart, or model failure without asking the user to repeat instructions.

## Resume trigger

Run this protocol when:
- a new session starts in this workspace,
- the user says "resume", "continue", "recover", or "pick up where you left off",
- OpenCode was refreshed/restarted,
- a prior run ended due to error, limit, model exhaustion, or interruption.

## Recovery steps (must execute in order)

1. **Load state**
   - Read `project-management/ORCHESTRATION-STATE.json`
   - Read `project-management/ORCHESTRATION-LOG.md` (last entries)
   - Read `project-management/DEV-STATUS.md`
   - Read `project-management/TASKS.md`
   - Read `project-management/BUGS.md`
   - Read `project-management/MODEL-POLICY.md`
   - Read `project-management/DECISIONS.md` if recent decisions may affect work

2. **Reconstruct**
   - Identify `objective`, `current_milestone`, `active_task_id`, `active_agent`, `last_completed_task_id`, `next_action`, `open_blockers`.
   - Identify any `in_progress` task in TASKS/STATE. If an agent assignment was in progress but no result recorded, mark as `interrupted` in log and determine safe resume point (do not assume completion).
   - Check `model_policy.waiting_for_model_capacity`. If true, report wait state and required user action before retrying.

3. **Validate before resuming**
   - Inspect files/evidence referenced by the active/interrupted task. Confirm actual repo state matches recorded state.
   - If state conflicts with repo reality, trust repo evidence, update state/log, and record the discrepancy.

4. **Resume**
   - Continue from `next_action` if still valid.
   - Otherwise pick highest-priority unblocked `pending`/`in_progress` task from TASKS.
   - Delegate via `subagent` as normal; record assignment in ORCHESTRATION-STATE and ORCHESTRATION-LOG.

5. **Report**
   - Tell user: recovered objective, last completed step, interrupted/in-progress step, current blockers, model state, and exact next action being taken. Do not ask user to repeat prior instructions unless information is truly missing.

## Interruption handling

- Before ending a session or when nearing limits, write a checkpoint: update ORCHESTRATION-STATE.json, append ORCHESTRATION-LOG.md, update DEV-STATUS.md/TASKS.md.
- If interrupted mid-task, next session must verify partial work (git diff if available, file inspection, tests) before continuing.
- Never duplicate completed work; never skip verification of interrupted work.

## Model exhaustion recovery

- If failure is quota/rate-limit/model unavailable: log it in ORCHESTRATION-STATE `model_policy.last_model_error`, set `waiting_for_model_capacity` when no fallback available, and write resume instructions.
- User can resume after capacity returns with: `opencode` then "Resume from project-management/ORCHESTRATION-STATE.json" (or `opencode run "Resume from project-management/ORCHESTRATION-STATE.json"`).
- On resume, clear wait flag only after confirming model availability/retry success.