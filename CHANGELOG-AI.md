# CHANGELOG-AI

This file is a compact memory for future LLM agents. Add short notes only when a change affects architecture, data flow, API behavior, model logic, or fragile UI behavior.

## 2026-05-04

- Strava OAuth is now local multi-athlete:
  - `strava_tokens` can hold multiple athletes.
  - One token is selected via `active: true`.
  - Backend identity uses `_get_active_strava_token()` instead of "latest token".
  - New endpoints: `GET /api/strava/status`, `GET /api/strava/connections`, `PATCH /api/strava/active-athlete`, `DELETE /api/strava/connection`.
  - `ProfileView` lists connected athletes, switches the active athlete, adds another Strava athlete, and disconnects a specific athlete.
  - External Strava quota still governs whether more than one athlete can authorize the app.
- Training/VDOT generation is history-aware:
  - `history_context` captures stop days, recent volume, recent peak, quality sessions, easy ratio, aerobic base, readiness and CTL/ATL/TSB.
  - Stop history softens current VDOT and shifts plan phases toward Base Aerobica.
  - Quality history can reduce Base and move earlier into Intensita.
  - `TrainingGrid` displays the history context returned by `/api/training-plan/generate`.

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
