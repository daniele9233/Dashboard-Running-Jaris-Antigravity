import { api } from './client';
import type {
  Profile,
  RunsResponse,
  TrainingPlanResponse,
  FitnessFreshnessResponse,
  DashboardResponse,
  BadgesResponse,
  RecoveryScoreResponse,
  InjuryRiskResponse,
  SupercompensationResponse,
  AnalyticsResponse,
  VdotPacesResponse,
  BestEffortsResponse,
  HeatmapResponse,
  AdaptResponse,
  ProAnalyticsResponse,
  GarminCsvLinkResult,
  RunnerDnaResponse,
} from '../types/api';

// ─── PROFILE ────────────────────────────────────────────────────────────────
export const getProfile = () => api.get<Profile>('/api/profile');

export const updateProfile = (data: Partial<Profile>) =>
  api.patch<Profile>('/api/profile', data);

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
export const getDashboard = () => api.get<DashboardResponse>('/api/dashboard');

// ─── RUNS ────────────────────────────────────────────────────────────────────
export const getRuns = () => api.get<RunsResponse>('/api/runs');

export const getRun = (id: string) => api.get<RunsResponse['runs'][0]>(`/api/runs/${id}`);

export const getRunSplits = (id: string) => api.get<unknown>(`/api/runs/${id}/splits`);

// ─── TRAINING PLAN ───────────────────────────────────────────────────────────
export const getTrainingPlan = () => api.get<TrainingPlanResponse>('/api/training-plan');

export const getCurrentWeek = () => api.get<TrainingPlanResponse['weeks'][0]>('/api/training-plan/current');

export const toggleSessionComplete = (weekId: string, sessionIndex: number, completed: boolean) =>
  api.patch('/api/training-plan/session/complete', { week_id: weekId, session_index: sessionIndex, completed });

export const generateTrainingPlan = (data: {
  goal_race: string;
  weeks_to_race: number;
  target_time?: string;
  plan_mode?: 'conservative' | 'balanced' | 'aggressive';
  dry_run?: boolean;
  test_distance_km?: number;
  test_time?: string;
  start_date?: string;       // ISO date YYYY-MM-DD — user-chosen plan start
}) =>
  api.post<{
    ok: boolean;
    dry_run?: boolean;
    weeks_generated: number;
    current_vdot: number;
    target_vdot: number;
    peak_vdot?: number;
    peak_date?: string;
    peak_source?: {
      date?: string;
      name?: string;
      distance_km?: number;
      duration_minutes?: number;
      avg_pace?: string;
      avg_hr?: number | null;
      strava_id?: string | number;
    } | null;
    training_months?: number;
    weekly_volume?: number;
    test_vdot?: number | null;
    plan_mode?: 'conservative' | 'balanced' | 'aggressive' | null;
    strategy_options?: Array<{
      mode: 'conservative' | 'balanced' | 'aggressive';
      label: string;
      focus: string;
      success_pct: number;
      completion_pct: number;
      weekly_volume_multiplier: number;
      projected_vdot: number;
      note: string;
    }>;
    feasibility: {
      feasible: boolean;
      difficulty: string;
      message: string;
      confidence_pct: number;
      is_recovery?: boolean;
      conservative_vdot?: number;
      conservative_time?: string;
      conservative_rate?: number;
      optimistic_vdot?: number;
      optimistic_time?: string;
      optimistic_rate?: number;
      original_target_time?: string;
      suggested_weeks?: number;
      suggested_months?: number;
      suggested_timeframe?: string;
    };
    race_predictions: Record<string, string>;
    suggested_weeks?: number;
    suggested_months?: number;
    suggested_timeframe?: string;
  }>('/api/training-plan/generate', data);

export const adaptTrainingPlan = () =>
  api.post<AdaptResponse>('/api/training-plan/adapt');

export const evaluateTest = (data: {
  test_distance_km: number;
  test_time: string;
  test_date?: string;
}) =>
  api.post<{
    ok: boolean;
    test_vdot: number;
    test_pace: string;
    previous_plan_vdot: number;
    new_target_vdot: number;
    vdot_change: number;
    direction: 'improved' | 'declined' | 'unchanged';
    confidence: number;
    weeks_remaining: number;
    weeks_regenerated: number;
    message: string;
  }>('/api/training-plan/evaluate-test', data);

// ─── FITNESS & FRESHNESS ─────────────────────────────────────────────────────
export const getFitnessFreshness = () => api.get<FitnessFreshnessResponse>('/api/fitness-freshness');
export const recalculateFitnessFreshness = () => api.post('/api/fitness-freshness/recalculate');

// ─── ANALYTICS ───────────────────────────────────────────────────────────────
export const getAnalytics = () => api.get<AnalyticsResponse>('/api/analytics');

export const getProAnalytics = (params: {
  tab?: 'all' | 'load_form' | 'potential_progress' | 'biomechanics';
  range?: '1M' | '3M' | '6M' | '12M' | 'ALL';
  resolution?: 'auto' | 'day' | 'week' | 'month';
  detail?: boolean;
  chart?: string;
} = {}) => {
  const search = new URLSearchParams();
  if (params.tab) search.set('tab', params.tab);
  if (params.range) search.set('range', params.range);
  if (params.resolution) search.set('resolution', params.resolution);
  if (params.detail !== undefined) search.set('detail', String(params.detail));
  if (params.chart) search.set('chart', params.chart);
  const qs = search.toString();
  return api.get<ProAnalyticsResponse>(`/api/analytics/pro${qs ? `?${qs}` : ''}`);
};

export const getPredictionHistory = () => api.get<unknown>('/api/prediction-history');

export const getVdotPaces = () => api.get<VdotPacesResponse>('/api/vdot/paces');

// ─── RECOVERY & RISK ─────────────────────────────────────────────────────────
export const getRecoveryScore = () => api.get<RecoveryScoreResponse>('/api/recovery-score');

export const getInjuryRisk = () => api.get<InjuryRiskResponse>('/api/injury-risk');

export const postRecoveryCheckin = (data: {
  energy: number;
  sleep_quality: number;
  muscle_soreness: number;
  mood: number;
  hrv?: number;
}) => api.post('/api/recovery-checkin', data);

// ─── SUPERCOMPENSATION ───────────────────────────────────────────────────────
export const getSupercompensation = () => api.get<SupercompensationResponse>('/api/supercompensation');

// ─── BADGES ──────────────────────────────────────────────────────────────────
export const getBadges = () => api.get<BadgesResponse>('/api/badges');

// ─── STRAVA ──────────────────────────────────────────────────────────────────
export const getStravaAuthUrl = () => api.get<{ url: string; redirect_uri: string }>('/api/strava/auth-url');

export const syncStrava = () => api.post('/api/strava/sync');

export const exchangeStravaCode = (code: string) =>
  api.post('/api/strava/exchange-code', { code });

// ─── WEEKLY REPORT ───────────────────────────────────────────────────────────
export const getWeeklyReport = () => api.get<unknown>('/api/weekly-report');

export const getWeeklyHistory = () => api.get<unknown>('/api/weekly-history');

// ─── BEST EFFORTS ────────────────────────────────────────────────────────────
export const getBestEfforts = () => api.get<BestEffortsResponse>('/api/best-efforts');

// ─── HEATMAP ─────────────────────────────────────────────────────────────────
export const getHeatmap = () => api.get<HeatmapResponse>('/api/heatmap');

// ─── GARMIN ──────────────────────────────────────────────────────────────────
export const getGarminStatus = () => api.get<{ configured: boolean; email: string | null }>('/api/garmin/status');
export interface GarminSyncResult { ok: boolean; hr_updated: number; dynamics_updated: number; updated: number; skipped: number; skipped_no_match: number; skipped_complete: number; total_garmin_runs: number; errors: string[]; }
export interface GarminCsvImportResult { ok: boolean; imported: number; skipped: number; duplicates?: number; repaired?: number; duplicates_inactivated?: number; matched?: number; enriched?: number; unmatched?: number; ambiguous?: number; total_received: number; collection: string; errors: string[]; }
export interface GarminCsvData { id: string; athlete_id: number; source: string; imported_at: string; date: string; distance_km: number; duration_minutes: number | null; avg_pace: string | null; avg_hr: number | null; max_hr: number | null; avg_vertical_oscillation_cm: number | null; avg_vertical_ratio_pct: number | null; avg_ground_contact_time_ms: number | null; avg_stride_length_m: number | null; avg_cadence_spm: number | null; max_cadence_spm?: number | null; inactive_duplicate?: boolean; active?: boolean; elevation_gain_m: number | null; elevation_loss_m: number | null; min_elevation_m: number | null; max_elevation_m: number | null; avg_power_w: number | null; max_power_w: number | null; calories: number | null; steps: number | null; raw: Record<string, string>; }
export const syncGarmin = (limit = 50, force = false) => api.post<GarminSyncResult>(`/api/garmin/sync?limit=${limit}&force=${force}`);
export const syncGarminAll = (force = false) => api.post<GarminSyncResult>(`/api/garmin/sync-all?force=${force}`);
export const getGarminAuthUrl = () => api.get<{ auth_url: string; service: string }>(`/api/garmin/auth-start?frontend_origin=${encodeURIComponent(window.location.origin)}`);
export const exchangeGarminTicket = (ticket: string, service: string) => api.post<{ ok: boolean }>('/api/garmin/exchange-ticket', { ticket, service });
export const saveGarminToken = (tokenDump: string) => api.post<{ ok: boolean; message: string }>('/api/garmin/save-token', { token_dump: tokenDump });
export const importGarminCsv = (runs: Array<Record<string, string>>) => api.post<GarminCsvImportResult>('/api/garmin/csv-import', { runs });
export const linkGarminCsv = () => api.post<GarminCsvLinkResult>('/api/garmin/csv-link');
export const getGarminCsvData = () => api.get<{ data: GarminCsvData[]; count: number }>('/api/garmin/csv-data');
export const deleteGarminCsvData = (docId: string) => api.delete<{ ok: boolean }>(`/api/garmin/csv-data/${docId}`);
export interface GctAnalysisResponse { monthly: { month: string; pace_530: number | null; pace_500: number | null; pace_445: number | null }[]; summary: { total_runs: number; avg_gct: number | null; zones: Record<string, { label: string; color: string }> }; }
export const getGctAnalysis = () => api.get<GctAnalysisResponse>('/api/garmin/gct-analysis');

// ─── AI ──────────────────────────────────────────────────────────────────────
export const analyzeRun = (runId: string) =>
  api.post<{ analysis: string }>('/api/ai/analyze-run', { run_id: runId });

export const getRunnerDna = () => api.get<RunnerDnaResponse>('/api/runner-dna');
export const clearRunnerDnaCache = () => api.delete<{ ok: boolean }>('/api/runner-dna/cache');

export const getDashboardInsight = () =>
  api.get<{ insight: string | null; cached?: boolean; error?: string }>('/api/ai/dashboard-insight');

// ─── USER LAYOUT (dashboard grid persistence) ────────────────────────────────
export type GridLayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
};
export type GridLayouts = {
  lg?: GridLayoutItem[];
  md?: GridLayoutItem[];
  sm?: GridLayoutItem[];
};
export const getUserLayout = () =>
  api.get<{ layouts: GridLayouts | null; hidden_keys?: string[] }>('/api/user/layout');
export const putUserLayout = (payload: { layouts: GridLayouts; hidden_keys?: string[] }) =>
  api.put<{ ok: boolean }>('/api/user/layout', payload);

// ─── JARVIS ──────────────────────────────────────────────────────────────────
import type { JarvisResponse } from '../types/jarvis';
export const jarvisChat = (transcript: string) =>
  api.post<JarvisResponse>('/api/jarvis/chat', { transcript });

