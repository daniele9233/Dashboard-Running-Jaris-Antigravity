/**
 * Cache keys for `useApi` — centralized so peers share the same response.
 *
 * Usage:
 *   useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS })
 *
 * To invalidate (e.g. after a Strava sync):
 *   invalidateCache(API_CACHE.RUNS)
 *
 * Keep keys short and stable; never reuse a key for a different endpoint.
 */
export const API_CACHE = {
  PROFILE: 'profile',
  DASHBOARD: 'dashboard',
  RUNS: 'runs',
  ANALYTICS: 'analytics',
  VDOT_PACES: 'vdot-paces',
  BEST_EFFORTS: 'best-efforts',
  HEATMAP: 'heatmap',
  TRAINING_PLAN: 'training-plan',
  TRAINING_CURRENT_WEEK: 'training-current-week',
  GCT_ANALYSIS: 'gct-analysis',
  SUPERCOMPENSATION: 'supercompensation',
  DASHBOARD_INSIGHT: 'dashboard-insight',
} as const;

export type ApiCacheKey = (typeof API_CACHE)[keyof typeof API_CACHE];
