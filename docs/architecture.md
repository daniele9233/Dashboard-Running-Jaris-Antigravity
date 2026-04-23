# Architecture

## Overview

METIC LAB is split into:

- React/Vite frontend in `src/`.
- FastAPI-style Python backend in `backend/server.py`.
- MongoDB as persistence layer.
- External data providers: Strava and Garmin.
- AI providers and algorithmic fallbacks for analysis and coaching.

The frontend is a single-page app. The backend exposes JSON endpoints under `/api/*`. The frontend API client wraps fetch and keeps runtime calls centralized.

## Frontend

Key entrypoints:

- `src/main.tsx`: React bootstrapping.
- `src/App.tsx`: providers, layout, top navigation, routes.
- `src/api/client.ts`: fetch wrapper and base URL resolution.
- `src/api/index.ts`: exported API functions.
- `src/types/api.ts`: API and domain contracts.

The app uses component-level data fetching through `useApi()` and purpose-built hooks such as `useRunnerDnaUiModel()`.

## Backend

`backend/server.py` is the central backend module. It contains:

- lifespan and MongoDB setup.
- Strava OAuth/sync.
- Garmin auth/sync/CSV import.
- dashboard aggregation.
- training plan generation/adaptation.
- fitness/freshness computation.
- analytics endpoints.
- Runner DNA computation/cache.
- JARVIS/AI chat helpers.

Because the file is large, use `repo-map.md` or `repo-map.json` to locate routes/helpers before editing.

## Persistence

Main collections mentioned in product docs/code:

- `profile`
- `runs`
- `training_plan`
- `fitness_freshness`
- `best_efforts`
- `garmin_csv_data`
- `runner_dna_cache`
- `analytics_cache`
- `weekly_reports`
- `recovery_checkins`
- `adaptation_log`

Every user-scoped collection must use `athlete_id`.

## Deployment

- Frontend runs locally with Vite.
- Backend is configured for Render deployment through `render.yaml`.
- Frontend base URL comes from `VITE_BACKEND_URL`; if missing, `src/api/client.ts` falls back to the Render backend.

## Performance Constraints

- Render free tier memory is tight. Do not return full streams in list endpoints.
- Heavy Mapbox/3D/route rendering should be lazy and limited.
- Generated context maps should summarize source files, not copy large code.
