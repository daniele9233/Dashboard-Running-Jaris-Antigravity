# API Map

This file is a human summary. For generated endpoint extraction, use `repo-map.md` or `repo-map.json`.

## Frontend API Client

- `src/api/client.ts`: base fetch wrapper.
- `src/api/index.ts`: typed API functions used by components/hooks.

## Core Backend Endpoint Groups

### Health/Version

- `GET /`
- `GET /api/version`

### Strava

- `GET /api/strava/auth-url`
- `GET /api/strava/status`
- `GET /api/strava/connections`
- `PATCH /api/strava/active-athlete`
- `GET /api/strava/callback`
- `POST /api/strava/exchange-code`
- `DELETE /api/strava/connection`
- `POST /api/strava/sync`

Consumers: profile, dashboard, activities, training auto-adaptation, Runner DNA.

Notes: Strava is local multi-athlete. `strava_tokens` can store multiple athletes; one is active. Sync and athlete-scoped reads use the active athlete. External Strava app quota can still block authorizing a second real athlete.

### Profile/Layout

- `GET /api/profile`
- `PATCH /api/profile`
- `GET /api/user/layout`
- `PUT /api/user/layout`

Consumers: profile page, dashboard layout persistence, Runner DNA V2 profile context.

### Runs/Activities

- `GET /api/runs`
- `GET /api/runs/{run_id}`
- `GET /api/runs/{run_id}/splits`

Consumers: activities, run detail, maps, analytics, dashboard, Runner DNA.

### Dashboard

- `GET /api/dashboard`

Consumers: `DashboardView`, status/form cards, training snippets, latest run.

### Training

- `GET /api/training-plan`
- `GET /api/training-plan/current`
- `PATCH /api/training-plan/session/complete`
- `POST /api/training-plan/generate`
- `POST /api/training-plan/evaluate-test`
- `POST /api/training-plan/adapt`

Consumers: `TrainingView`, `TrainingGrid`, `TrainingSidebar`.

### Fitness/Analytics

- `GET /api/fitness-freshness`
- `POST /api/fitness-freshness/recalculate`
- `GET /api/analytics`
- `GET /api/analytics/pro`
- `GET /api/prediction-history`
- `GET /api/vdot/paces`
- `GET /api/best-efforts`
- `GET /api/heatmap`
- `GET /api/garmin/gct-analysis`

Consumers: dashboard, statistics, Runner DNA, training plan.

### Recovery/Risk/Supercompensation/Badges

- `GET /api/recovery-score`
- `GET /api/injury-risk`
- `POST /api/recovery-checkin`
- `GET /api/supercompensation`
- `GET /api/badges`
- `GET /api/weekly-report`
- `GET /api/weekly-history`

Consumers: dashboard cards, statistics, badge grids, future recovery pages.

### Runner DNA

- `GET /api/runner-dna`
- `GET /api/runner-dna-legacy`
- `DELETE /api/runner-dna/cache`

Consumers: `RunnerDnaView`, `RunnerDnaV2View`, `useRunnerDnaUiModel`.

### Garmin

- `GET /api/garmin/status`
- `POST /api/garmin/save-token`
- `POST /api/garmin/login`
- `GET /api/garmin/auth-start`
- `POST /api/garmin/exchange-ticket`
- `POST /api/garmin/sync`
- `POST /api/garmin/sync-all`
- `POST /api/garmin/csv-import`
- `POST /api/garmin/csv-link`
- `GET /api/garmin/csv-data`
- `DELETE /api/garmin/csv-data/{doc_id}`

Consumers: Garmin Watch controls, activities, statistics, Runner DNA.

### AI/JARVIS

- `POST /api/ai/analyze-run`
- `GET /api/ai/dashboard-insight`
- `GET /api/test-ai`
- `POST /api/jarvis/chat`

Consumers: run detail analysis, dashboard insight, voice assistant.
