# Module Summary: Activities

## Purpose

Activities shows synced runs, run cards, route maps, detail views, splits, HR/cadence/drift information, plan feedback and Live Telemetry 3D.

## Main Files

- `src/components/ActivitiesView.tsx`
- `src/components/RoutesView.tsx`
- `src/components/LiveTelemetry3DMap.tsx`
- `src/components/RecentActivities.tsx`
- `src/utils/cardiacDrift.ts`
- `src/utils/cadence.ts`

## API

- `getRuns()` -> `/api/runs`
- `getRun(id)` -> `/api/runs/{run_id}`
- `getRunSplits(id)` -> `/api/runs/{run_id}/splits`
- `analyzeRun(runId)` -> `/api/ai/analyze-run`

## Touch When

- Activity card metrics.
- Run detail panels.
- Cadence display.
- Mapbox route rendering.
- Live Telemetry 3D playback.
- Cardiac drift calculations.

## Watch Outs

- Cadence should be shown in normalized SPM and must not be doubled in the UI.
- Map rendering must stay bounded for performance.
- Treadmill/no-GPS runs need fallback states.
