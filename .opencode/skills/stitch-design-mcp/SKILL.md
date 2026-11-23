---
name: stitch-design-mcp
description: Use the connected Google Stitch MCP server to generate, edit, and manage AI UI designs/screens. Use when the user wants Stitch-based design generation, design-to-code from Stitch, or managing Stitch projects/screens via MCP.
---

# Stitch MCP (Google Stitch)

Use this skill when a task should leverage **Google Stitch** through the connected MCP server.

## When to use

- Generate new UI screens/designs from text or image prompts in Stitch
- Edit existing Stitch screens or generate variants
- List/manage Stitch projects and screens
- Pull Stitch design context into implementation work (handoff to frontend/build agents)

## Workspace setup

- Stitch MCP is configured in `opencode.jsonc` as remote server `stitch` (`https://stitch.googleapis.com/mcp`).
- In OpenCode Code Mode, Stitch tools are available only inside `execute` under `tools["stitch"]`.
- Discover current tools/signatures before calling: `search({ namespace: "stitch" })`.
- If Stitch requires account auth, use TUI `/mcps` -> select `stitch` -> sign in. Do **not** run `opencode mcp auth` via shell.

## Usage guidelines

- Do not send secrets, API keys, credentials, or proprietary data in prompts.
- Stitch is an external Google service; treat generated output as drafts that must be reviewed for UX, accessibility, code quality, and licensing/context fit.
- For implementation, pair Stitch output with local skills: `frontend-design`, `web-design-guidelines`, `vercel-react-best-practices`/`vercel-composition-patterns` as relevant.
- Verify UI with Playwright/webapp-testing after integrating generated designs; do not claim visual quality without evidence.
