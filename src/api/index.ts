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

export const generateTrainingPlan = (data: { goal_race: string; weeks_to_race: number; target_time?: string }) =>
  api.post<{
    ok: boolean;
    weeks_generated: number;
    current_vdot: number;
    target_vdot: number;
    feasibility: {
      feasible: boolean;
      difficulty: string;
      message: string;
      confidence_pct: number;
      adjusted_target_vdot?: number;
      adjusted_time?: string;
      suggested_weeks?: number;
    };
    race_predictions: Record<string, string>;
  }>('/api/training-plan/generate', data);

export const adaptTrainingPlan = () =>
  api.post<AdaptResponse>('/api/training-plan/adapt');

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
export const syncGarmin = (limit = 50) => api.post<{ ok: boolean; updated: number; skipped: number; total_garmin_runs: number; errors: string[] }>(`/api/garmin/sync?limit=${limit}`);
export const syncGarminAll = () => api.post<{ ok: boolean; updated: number; skipped: number; total_garmin_runs: number; errors: string[] }>('/api/garmin/sync-all');

// ─── AI ──────────────────────────────────────────────────────────────────────
export const analyzeRun = (runId: string) =>
  api.post<{ analysis: string }>('/api/ai/analyze-run', { run_id: runId });

export const getRunnerDna = () => api.get<any>('/api/runner-dna');
export const clearRunnerDnaCache = () => api.delete<{ ok: boolean }>('/api/runner-dna/cache');

// ─── JARVIS ──────────────────────────────────────────────────────────────────
import type { JarvisResponse } from '../types/jarvis';
export const jarvisChat = (transcript: string) =>
  api.post<JarvisResponse>('/api/jarvis/chat', { transcript });

