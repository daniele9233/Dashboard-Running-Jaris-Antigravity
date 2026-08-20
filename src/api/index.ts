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
  start_weekly_km?: number;  // km/sett di partenza (vuoto = auto dal volume recente)
  city?: string;             // base climatica (default "roma") per adattare i ritmi
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
    history_context?: {
      days_since_last_run: number;
      longest_stop_days_6m: number;
      weekly_volume_4w: number;
      weekly_volume_8w: number;
      recent_peak_weekly_km: number;
      quality_sessions_8w: number;
      interval_sessions_8w: number;
      tempo_sessions_8w: number;
      long_runs_8w: number;
      easy_ratio_8w: number;
      aerobic_base_score: number;
      readiness_score: number;
      training_status: string;
      load: { ctl: number; atl: number; tsb: number };
    };
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

// ─── SUB-20 SESSION EVALUATION (kikkoderisoSub20) ────────────────────────────
export interface Sub20RepDetail {
  dist_m: number;
  dur_s: number;
  pace_sec: number | null;
  elev_m: number | null;
  grade_pct: number | null;
  pbp_sec: number | null;
  ideal_sec: number | null;
  hr_avg: number | null;
  hr_max: number | null;
}
export interface Sub20Conditions {
  temp_c: number | null;
  humidity: number | null;
  apparent_c: number | null;
  net_elev_m: number;
  grade_adj_sec: number;
  heat_adj_sec: number;
  temp_source: string | null;
  weather_source: string | null;
  hours_used: number[] | null;
}
export interface Sub20Adaptation {
  absorb: string;
  peak_from: string;
  peak_to: string;
  kind: string;
  note: string;
}
export interface Sub20EvalResult {
  matched: boolean;
  run_id?: string;
  run_date?: string;
  run_name?: string;
  run_type?: string;
  reps?: Sub20RepDetail[];
  reps_done?: number;
  reps_prescribed?: number;
  avg_raw_sec?: number | null;
  target_pace_sec?: number;
  conditions?: Sub20Conditions;
  normalized_avg_sec?: number | null;
  delta_sec?: number | null;
  verdict?: 'AVANTI' | 'IN_LINEA' | 'INDIETRO' | 'ND';
  suggested_pct?: number | null;
  vdot_implied?: number | null;
  adaptation?: Sub20Adaptation;
  reason?: string;
  error?: string;
}
export const evaluateSub20Session = (body: {
  date: string;
  reps: number;
  rep_m: number;
  target_pace_sec: number;
  window_days?: number;
  manual_temp_c?: number;
  manual_humidity?: number;
}) => api.post<Sub20EvalResult>('/api/sub20/evaluate-session', body);

// Esiti sedute Sub-20 (effettuato / fallito) + RPE — persistenti su DB.
// L'RPE (facile/giusto/duro) alimenta l'auto-adattamento del piano.
export type Sub20SessionStatus = 'done' | 'failed';
export type Sub20RpeLevel = 'facile' | 'giusto' | 'duro';
export interface Sub20StatusResponse {
  statuses: Record<string, Sub20SessionStatus>;
  rpe?: Record<string, Sub20RpeLevel>;
  start_date?: string | null;
  /** Domenica di gara, scelta liberamente: il piano si adatta alla finestra. */
  race_date?: string | null;
  /** Tempo obiettivo in secondi, per piano: { sub20: 1199, sub135: 5675 }. */
  goals?: Record<string, number>;
  ok?: boolean;
}
export const getSub20Status = () => api.get<Sub20StatusResponse>('/api/sub20/status');
export const putSub20Status = (date: string, status: Sub20SessionStatus | null) =>
  api.put<Sub20StatusResponse>('/api/sub20/status', { date, status });
export const putSub20Rpe = (date: string, rpe: Sub20RpeLevel | null) =>
  api.put<Sub20StatusResponse>('/api/sub20/status', { date, rpe });
// Finestra del piano: inizio e gara, indipendenti. null → torna al default.
export const putSub20StartDate = (startDate: string | null) =>
  api.put<Sub20StatusResponse>('/api/sub20/status', { start_date: startDate });

export const putSub20Window = (startDate: string | null, raceDate: string | null) =>
  api.put<Sub20StatusResponse>('/api/sub20/status', { start_date: startDate, race_date: raceDate });

/** Tempo obiettivo di un piano, in secondi. null → torna a quello scritto nel piano. */
export const putSub20Goal = (plan: string, seconds: number | null) =>
  api.put<Sub20StatusResponse>('/api/sub20/status', { goals: { [plan]: seconds } });

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

