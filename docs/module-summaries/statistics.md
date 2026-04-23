# Module Summary: Statistics

## Purpose

Statistics is the advanced analytics lab. It includes performance analytics, biomechanics/efficiency, future biology, badges and detailed charts.

## Main Files

- `src/components/statistics/StatisticsView.tsx`
- `src/components/statistics/AnalyticsV2.tsx`
- `src/components/statistics/AnalyticsV3.tsx`
- `src/components/statistics/AnalyticsV4.tsx`
- `src/components/statistics/AnalyticsV5.tsx`
- `src/components/statistics/StatsCalc.tsx`
- `src/components/statistics/StatsDrift.tsx`
- `src/components/statistics/StatsProgress.tsx`
- `src/components/statistics/StatsRisk.tsx`

## API

- `getAnalytics()` -> `/api/analytics`
- `getProAnalytics()` -> `/api/analytics/pro`
- `getFitnessFreshness()` -> `/api/fitness-freshness`
- `getVdotPaces()` -> `/api/vdot/paces`
- `getBestEfforts()` -> `/api/best-efforts`
- `getGctAnalysis()` -> `/api/garmin/gct-analysis`

## Touch When

- Analytics tabs.
- Biomechanics and efficiency charts.
- Badge/stat cards.
- GCT and running dynamics panels.
- Historical trend visualizations.

## Watch Outs

- If a metric is not supplied by Garmin/API, show `N/D` with explanation instead of inventing values.
- Heavy chart/map rendering should be bounded.
- Keep benchmark labels clear: user must know if a value is positive or negative.
