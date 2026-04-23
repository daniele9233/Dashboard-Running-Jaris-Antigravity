# CHANGELOG-AI

This file is a compact memory for future LLM agents. Add short notes only when a change affects architecture, data flow, API behavior, model logic, or fragile UI behavior.

## 2026-04-23

- Added a versioned Git pre-commit hook in `.githooks/pre-commit`.
  - Local Git is expected to use `core.hooksPath=.githooks`.
  - The hook runs `npm run context:check` and blocks commits when `repo-map.md/json` are stale.
- Added the AI context pack architecture:
  - `llms.txt` as first-read entrypoint.
  - `.ai-context.md` as curated architecture context.
  - `docs/` architecture/data-flow/API/module summaries.
  - `scripts/update-ai-context.ts` generator for deterministic `repo-map.md` and `repo-map.json`.
  - `npm run context:update` and `npm run context:check`.
- Purpose: let any LLM understand the repo without rereading all source files on every task.
- Important rule: generated maps must not include secrets, `.env` files, logs, build output, heavy assets, or runtime data.
