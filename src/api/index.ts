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
  FieldTest,
  FieldTestLatestResponse,
  FieldTestListResponse,
  FieldTestDivergenceResponse,
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

/** Scarpa, taper e RPE di una prova — le annotazioni del banco di prova. */
export const patchRaceLab = (
  id: string,
  data: { shoe_id?: string | null; taper?: "none" | "short" | "full" | null; rpe?: number | null },
) => api.patch<{ ok: boolean; race_lab: Record<string, unknown> }>(`/api/runs/${id}/race-lab`, data);

// ─── PARZIALI / RIPETUTE ─────────────────────────────────────────────────────
/** Da dove arrivano i parziali. Va mostrato: i giri veri e una segmentazione
 *  ricavata dai dati non sono la stessa cosa. */
export type IntervalSource = 'laps' | 'streams' | 'splits' | 'none';

export type IntervalSegment = {
  index: number;
  kind: 'work' | 'recovery' | 'steady' | 'split';
  distance_m: number;
  moving_time_s: number;
  pace_sec: number;
  avg_hr: number | null;
  max_hr: number | null;
  grade_pct: number | null;
  elev_delta_m?: number | null;
  /** PBP — passo corretto per la pendenza (sec/km). */
  gap_pace_sec: number | null;
};

export type IntervalSummary = {
  label: string;
  n_work: number;
  regular: boolean;
  avg_work_pace_sec: number;
  avg_work_gap_sec: number | null;
  avg_work_distance_m: number;
  total_work_distance_m: number;
  avg_recovery_s: number | null;
  fastest_pace_sec: number;
  slowest_pace_sec: number;
  /** Tenuta: secondi persi dall'ultima ripetuta rispetto alla prima. */
  fade_sec: number;
  hr_drift_bpm: number | null;
};

export type RunIntervals = {
  source: IntervalSource;
  segments: IntervalSegment[];
  summary: IntervalSummary | null;
};

export const getRunIntervals = (id: string) =>
  api.get<RunIntervals>(`/api/runs/${id}/intervals`);

/** Riscarica da Strava i giri delle corse importate prima che il sync li salvasse. */
export const postBackfillLaps = (limit = 40, onlyIntervals = true) =>
  api.post<{ ok: boolean; updated: number; failed: number; remaining: number; rate_limited: boolean; done: boolean }>(
    '/api/runs/backfill-laps',
    { limit, only_intervals: onlyIntervals },
  );

export type StoredWeather = {
  temperature?: number | null;
  humidity?: number | null;
  apparent_temperature?: number | null;
  dewpoint?: number | null;
  wind_speed?: number | null;
  source?: string | null;
  estimated_hour?: number | null;
};

export const getRunWeather = (id: string) => api.get<{ weather: StoredWeather | null }>(`/api/runs/${id}/weather`);

export const postRunWeather = (id: string, data: Record<string, unknown>) =>
  api.post<{ ok: boolean }>(`/api/runs/${id}/weather`, data);

/** Meteo di N corse in una chiamata sola: evita un round-trip per corsa. */
export const getRunsWeatherBulk = (runIds: string[]) =>
  api.post<{ weather: Record<string, StoredWeather> }>('/api/runs/weather/bulk', { run_ids: runIds });

// ─── FIELD TEST (pace-only VDOT benchmark) ───────────────────────────────────
export const postFieldTest = (data: { distance_km: 3 | 5 | 6; time_seconds: number; date?: string }) =>
  api.post<FieldTest>('/api/field-test', data);

export const getFieldTestLatest = () =>
  api.get<FieldTestLatestResponse>('/api/field-test/latest');

export const getFieldTestList = () =>
  api.get<FieldTestListResponse>('/api/field-test/list');

export const deleteFieldTest = (id: string) =>
  api.delete<{ ok: boolean }>(`/api/field-test/${id}`);

/** Divergence detection: zone obsolete vs reality? Smart suggestion ricalibra. */
export const getFieldTestDivergence = () =>
  api.get<FieldTestDivergenceResponse>('/api/field-test/divergence');

// ─── PIANO DI ALLENAMENTO (legacy backend) ───────────────────────────────────
// Il generatore vive nel frontend: vedi src/components/training/planEngine.ts.
// Gli endpoint /api/training-plan/* restano nel backend perché l'auto-adapt su
// sync ci scrive ancora, ma nessuna pagina li interroga più.


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
export interface StravaConnection {
  athlete_id: number | null;
  name: string | null;
  profile_pic: string | null;
  active: boolean;
}

export interface StravaStatus {
  connected: boolean;
  athlete_id: number | null;
  name: string | null;
  connections: StravaConnection[];
}

export interface StravaDisconnectResponse {
  ok: boolean;
  revoked: boolean;
  /** true se il token locale è stato effettivamente rimosso dal DB */
  removed?: boolean;
  /** true se rimosso via force=true senza che Strava abbia revocato */
  forced?: boolean;
  connected: boolean;
  athlete_id?: number | null;
  active_athlete_id?: number | null;
  connections?: StravaConnection[];
  revoke_error?: string | null;
}

export interface StravaConnectionsResponse {
  active_athlete_id: number | null;
  connections: StravaConnection[];
}

export const getStravaAuthUrl = () => api.get<{ url: string; redirect_uri: string }>('/api/strava/auth-url');

export const getStravaStatus = () => api.get<StravaStatus>('/api/strava/status');

export const getStravaConnections = () => api.get<StravaConnectionsResponse>('/api/strava/connections');

export const setActiveStravaAthlete = (athleteId: number) =>
  api.patch<StravaConnectionsResponse>('/api/strava/active-athlete', { athlete_id: athleteId });

export const syncStrava = () => api.post('/api/strava/sync');

export const disconnectStrava = (athleteId?: number | null, force = false) => {
  const params = new URLSearchParams();
  if (athleteId) params.set('athlete_id', String(athleteId));
  if (force) params.set('force', 'true');
  const qs = params.toString();
  return api.delete<StravaDisconnectResponse>(`/api/strava/connection${qs ? `?${qs}` : ''}`);
};

export const exchangeStravaCode = (code: string) =>
  api.post('/api/strava/exchange-code', { code });

// ─── BADGES STATE ────────────────────────────────────────────────────────────
export interface BadgeUnlock { at: string }
export interface BadgeState {
  activated: boolean;
  activated_at: string | null;
  baseline_run_ids: string[];
  baseline: Record<string, unknown>;
  unlocked: Record<string, BadgeUnlock>;
}
export const getBadgeState = () => api.get<BadgeState>('/api/badges/state');
export const saveBadgeState = (state: BadgeState) =>
  api.put<BadgeState>('/api/badges/state', state);

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

// ─── PIANO DI ALLENAMENTO — stato lato server ────────────────────────────────
// Il piano NON viaggia sulla rete: lo ricostruisce il motore dalla config, che è
// deterministica. Al server vanno solo la configurazione e il registro di cosa
// è stato fatto — così il piano è lo stesso sul telefono e sul portatile.

export interface PlanStateResponse {
  config: unknown | null;
  log: Record<string, string>;
  tests: Record<string, unknown>;
  updated_at?: string;
  ok?: boolean;
}

export const getPlanState = () => api.get<PlanStateResponse>('/api/training/plan-state');

export const putPlanState = (body: {
  config?: unknown | null;
  log?: Record<string, string>;
  tests?: Record<string, unknown>;
}) => api.put<PlanStateResponse>('/api/training/plan-state', body);


// ─── CONQUISTA D'ITALIA (gamification) ───────────────────────────────────────
export interface ConquestsResponse {
  conquered: string[];
  ok?: boolean;
}
export const getConquests = () => api.get<ConquestsResponse>('/api/conquests');
export const putConquest = (region: string, action: 'conquer' | 'release') =>
  api.put<ConquestsResponse>('/api/conquests', { region, action });

// ─── Obiettivo km settimanale (sincronizzato su DB) ──────────────────────────
export interface WeeklyGoalResponse {
  weekly_km_goal: number | null;
  ok?: boolean;
}
export const getWeeklyGoal = () => api.get<WeeklyGoalResponse>('/api/user/weekly-goal');
export const putWeeklyGoal = (goal: number) =>
  api.put<WeeklyGoalResponse>('/api/user/weekly-goal', { weekly_km_goal: goal });

// ─── JARVIS ──────────────────────────────────────────────────────────────────
import type { JarvisResponse } from '../types/jarvis';
export const jarvisChat = (transcript: string) =>
  api.post<JarvisResponse>('/api/jarvis/chat', { transcript });

