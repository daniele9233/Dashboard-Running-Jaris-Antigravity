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
  plan_mode?: 'conservative' | 'aggressive';
  test_distance_km?: number;
  test_time?: string;
}) =>
  api.post<{
    ok: boolean;
    dry_run?: boolean;
    weeks_generated: number;
    current_vdot: number;
    target_vdot: number;
    peak_vdot?: number;
    peak_date?: string;
    training_months?: number;
    weekly_volume?: number;
    test_vdot?: number | null;
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
export interface GarminCsvImportResult { ok: boolean; imported: number; skipped: number; total_received: number; collection: string; errors: string[]; }
export interface GarminCsvData { id: string; athlete_id: number; source: string; imported_at: string; date: string; distance_km: number; duration_minutes: number | null; avg_pace: string | null; avg_hr: number | null; max_hr: number | null; avg_vertical_oscillation_cm: number | null; avg_vertical_ratio_pct: number | null; avg_ground_contact_time_ms: number | null; avg_stride_length_m: number | null; avg_cadence_spm: number | null; elevation_gain_m: number | null; elevation_loss_m: number | null; min_elevation_m: number | null; max_elevation_m: number | null; avg_power_w: number | null; max_power_w: number | null; calories: number | null; steps: number | null; raw: Record<string, string>; }
export const syncGarmin = (limit = 50, force = false) => api.post<GarminSyncResult>(`/api/garmin/sync?limit=${limit}&force=${force}`);
export const syncGarminAll = (force = false) => api.post<GarminSyncResult>(`/api/garmin/sync-all?force=${force}`);
export const getGarminAuthUrl = () => api.get<{ auth_url: string; service: string }>(`/api/garmin/auth-start?frontend_origin=${encodeURIComponent(window.location.origin)}`);
export const exchangeGarminTicket = (ticket: string, service: string) => api.post<{ ok: boolean }>('/api/garmin/exchange-ticket', { ticket, service });
export const saveGarminToken = (tokenDump: string) => api.post<{ ok: boolean; message: string }>('/api/garmin/save-token', { token_dump: tokenDump });
export const importGarminCsv = (runs: Array<Record<string, string>>) => api.post<GarminCsvImportResult>('/api/garmin/csv-import', { runs });
export const getGarminCsvData = () => api.get<{ data: GarminCsvData[]; count: number }>('/api/garmin/csv-data');
export const deleteGarminCsvData = (docId: string) => api.delete<{ ok: boolean }>(`/api/garmin/csv-data/${docId}`);

// ─── AI ──────────────────────────────────────────────────────────────────────
export const analyzeRun = (runId: string) =>
  api.post<{ analysis: string }>('/api/ai/analyze-run', { run_id: runId });

export const getRunnerDna = () => api.get<any>('/api/runner-dna');
export const clearRunnerDnaCache = () => api.delete<{ ok: boolean }>('/api/runner-dna/cache');

// ─── JARVIS ──────────────────────────────────────────────────────────────────
import type { JarvisResponse } from '../types/jarvis';
export const jarvisChat = (transcript: string) =>
  api.post<JarvisResponse>('/api/jarvis/chat', { transcript });

