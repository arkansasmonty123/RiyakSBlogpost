# Contributing

This repository is a monorepo of independent projects. These conventions keep changes reviewable and prevent local tooling state from leaking into version control.

## Before you start

- Read [AGENTS.md](AGENTS.md) for repository working rules.
- Read the relevant project's `README.md` and, where present, `PRD.md` before changing behavior.
- Check `git status` first. This workspace often has local tool state and pre-existing work; do not overwrite, revert or claim changes you did not make.

## Scope

- Keep one change set focused on a single project and a single concern.
- Do not change a product's PRD or contracts as a side effect of UI or maintenance work.
- Do not add dependencies without a concrete need and a note explaining why.
- Do not introduce mock or hardcoded data into production flows. Deterministic fallback behavior must remain explicitly labeled.

## Commits

- Use a clear, imperative message (for example, `fix: harden reduced-motion handling for skeleton loading`).
- Stage only the files you intentionally changed. Use explicit paths rather than `git add -A`.
- Never commit secrets, credentials, `.env` files with values, local databases, caches, or editor/tool runtime state.
- Do not push, force-push, merge or deploy without explicit approval.

## Checks

Run the checks for the project you touched. At minimum:

| Project | Commands |
|---|---|
| `project-negotiations` | `npm run typecheck`, `npm test`, `npm run build` |
| `project-investigation` | `npm run ci` (full suite: `npm test` requires a seeded local Postgres) |
| `project-courtroom` | `npm run verify` |

For UI work, also exercise the affected screens in a browser at desktop and mobile widths and confirm there are no console errors or horizontal overflow. A successful build alone is not proof that a UI works.

## Repository hygiene

- Local tool state (`.cce/`, `.gemini/`, `.serena/`, `.planning/`, `.playwright-mcp/`, caches, `*.db-wal`, `*.db-shm`, lock/port files) belongs in `.gitignore`, never in a commit.
- Runtime databases and build output (`dist/`, `node_modules/`, `coverage/`) are ignored; do not force-add them.
- Documentation that describes the current state of a project belongs in that project's `docs/` or `README.md`. Delivery status and decisions belong in `project-management/`.

## Safety

- Destructive operations (deleting user data, rewriting history, removing functionality) require explicit approval.
- If a workspace conflict or unexpected diff appears, stop and report it rather than guessing which version is correct.
