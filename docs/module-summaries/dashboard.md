# Module Summary: Dashboard

## Purpose

The dashboard is the main performance cockpit. It shows readiness, form, fatigue, VDOT, race predictions, best efforts, weekly/monthly/yearly running volume, last run map, next session, and training adaptation context.

## Main Files

- `src/components/DashboardView.tsx`
- `src/components/dashboard/widgetRegistry.ts`
- `src/components/FitnessFreshness.tsx`
- `src/components/RacePredictions.tsx`
- `src/components/VO2MaxChart.tsx`
- `src/components/MainChart.tsx`
- `src/components/LastRunMap.tsx`
- `src/components/AdaptationPanel.tsx`

## API

- `getDashboard()` -> `/api/dashboard`
- `getDashboardInsight()` -> `/api/ai/dashboard-insight`
- supporting endpoints: fitness/freshness, best efforts, analytics.

## Touch When

- Dashboard card layout.
- Status Forma/Peak Score/TSB/CTL/ATL copy or calculations.
- Last run map or recent activity rendering.
- Dashboard widget visibility/layout persistence.

## Watch Outs

- Do not reintroduce fixed wide sidebars that create dead space.
- Do not show invented values when backend data is missing.
- Do not load full run streams in dashboard.
