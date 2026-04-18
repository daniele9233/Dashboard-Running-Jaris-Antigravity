import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StatsDrift } from './StatsDrift';
import { BadgesGrid } from '../BadgesGrid';
import { MainChart } from '../MainChart';
import { AnaerobicThreshold } from '../AnaerobicThreshold';
import { FitnessFreshness } from '../FitnessFreshness';
import { AnalyticsV2 } from './AnalyticsV2';
import { AnalyticsV3 } from './AnalyticsV3';
import { AnalyticsV4CadenceSpeedMatrix, AnalyticsV4PaceZoneDistribution } from './AnalyticsV4';
import { AnalyticsV5BestEffortsProgression, AnalyticsV5EffortMatrix, AnalyticsV5PaceDistributionBell } from './AnalyticsV5';
import { ChartExpandButton, ChartFullscreenModal } from './ChartFullscreenModal';
import { useApi } from '../../hooks/useApi';
import { getAnalytics, getVdotPaces, getRuns, getGctAnalysis, getDashboard, getProAnalytics, linkGarminCsv, getSupercompensation, type GctAnalysisResponse } from '../../api';
import type {
  AnalyticsResponse,
  VdotPacesResponse,
  RunsResponse,
  DashboardResponse,
  ProAnalyticsResponse,
  ProAnalyticsChart,
  GarminCsvLinkResult,
  Run,
  SupercompensationResponse,
  SupercompensationRun,
  SupercompensationProjectionPoint,
  AdaptationKey,
  AdaptationType,
} from '../../types/api';
import {
  Activity,
  Zap,
  TrendingUp,
  Heart,
  Clock,
  BarChart3,
  Flame,
  Dna,
  FlaskConical,
  Timer,
  Target,
  LayoutGrid,
  LineChart as LineChartIcon,
  Star,
  Briefcase,
  Info,
  TrendingDown,
  Trophy,
  Radar
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  LineChart,
  Cell,
  ReferenceLine,
  Label,
  Legend
} from 'recharts';

const PRO_ACCENT = '#D4FF00';
const PRO_PANEL = '#0E0E0E';
const PRO_BORDER = '#1E1E1E';
const PRO_BORDER_STRONG = '#2A2A2A';
const PRO_GRID = '#1E1E1E';
const PRO_BLUE = '#6366F1';
const PRO_PURPLE = '#A78BFA';
const PRO_RED = '#F43F5E';
const PRO_ORANGE = '#F59E0B';
const PRO_ZONE_COLORS = ['#4A4A4A', '#6366F1', '#8B5CF6', '#A78BFA', PRO_ACCENT];
const PRO_TOOLTIP_STYLE = {
  backgroundColor: '#141414',
  border: `1px solid ${PRO_BORDER_STRONG}`,
  borderRadius: '12px',
};

// ─────────────────────────────────────────────────────────────
// INFO TOOLTIP
// ─────────────────────────────────────────────────────────────
function InfoTooltip({ title, lines }: { title: string; lines: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="relative inline-flex ml-auto shrink-0" ref={ref}>
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="text-[#444] hover:text-[#888] transition-colors focus:outline-none"
      >
        <Info size={14} />
      </button>
      {open && (
        <div className="absolute z-50 top-full right-0 mt-2 w-72 bg-[#0D0D0D] border border-white/10 rounded-2xl p-4 shadow-2xl pointer-events-none">
          <div className="text-[#C0FF00] text-[10px] font-black tracking-widest mb-2">{title}</div>
          <ul className="space-y-1.5">
            {lines.map((l, i) => (
              <li key={i} className="text-[#888] text-[10px] leading-relaxed flex gap-1.5">
                <span className="text-[#444] shrink-0">·</span>{l}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────
const volumeData = [
  { week: 'W1', distance: 42, duration: 4.1 },
  { week: 'W2', distance: 48, duration: 4.8 },
  { week: 'W3', distance: 55, duration: 5.5 },
  { week: 'W4', distance: 35, duration: 3.2 },
  { week: 'W5', distance: 60, duration: 6.1 },
  { week: 'W6', distance: 65, duration: 6.5 },
  { week: 'W7', distance: 70, duration: 7.2 },
  { week: 'W8', distance: 40, duration: 4.0 },
];

const zoneData = [
  { name: 'Z1 (Recovery)', time: 120, fill: PRO_ZONE_COLORS[0] },
  { name: 'Z2 (Aerobic)', time: 450, fill: PRO_ZONE_COLORS[1] },
  { name: 'Z3 (Tempo)', time: 180, fill: PRO_ZONE_COLORS[2] },
  { name: 'Z4 (Threshold)', time: 90, fill: PRO_ZONE_COLORS[3] },
  { name: 'Z5 (Anaerobic)', time: 30, fill: PRO_ZONE_COLORS[4] },
];

const pacesTrendData = [
  { date: '17/11', easy: 5.40, tempo: 4.50, fast: 4.10 },
  { date: '26/01', easy: 5.50, tempo: 5.00, fast: 4.30 },
  { date: '09/02', easy: 5.30, tempo: 4.45, fast: 4.15 },
  { date: '02/03', easy: 5.20, tempo: 4.35, fast: 4.05 },
  { date: '16/03', easy: 5.15, tempo: 4.30, fast: 4.00 },
];

const cadenceMonthlyData = [
  { month: '04/25', value: 165 },
  { month: '06/25', value: 170 },
  { month: '08/25', value: 174 },
  { month: '10/25', value: 176 },
  { month: '01/26', value: 174 },
  { month: '03/26', value: 173 },
];

const futureTrendData = [
  { date: '25/3', condizione: 40, affaticamento: 60, forma: -20 },
  { date: '29/3', condizione: 42, affaticamento: 75, forma: -33 },
  { date: '1/4', condizione: 45, affaticamento: 40, forma: 5 },
  { date: '4/4', condizione: 44, affaticamento: 30, forma: 14 },
  { date: '7/4', condizione: 42, affaticamento: 25, forma: 17 },
  { date: '9/4', condizione: 40, affaticamento: 20, forma: 20 },
];

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function vdotLevel(v: number, t: (k: string) => string): { label: string; color: string } {
  if (v >= 52) return { label: t('statistics.elite'), color: PRO_ACCENT };
  if (v >= 47) return { label: t('statistics.advanced'), color: PRO_PURPLE };
  if (v >= 40) return { label: 'Buono', color: PRO_BLUE };
  if (v >= 32) return { label: t('statistics.intermediate'), color: PRO_ORANGE };
  return { label: t('statistics.beginner'), color: PRO_RED };
}

// ─────────────────────────────────────────────────────────────
// CARD WRAPPER
// ─────────────────────────────────────────────────────────────
function Card({
  children,
  className = '',
  accent = '#C0FF00',
  variant = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  accent?: string;
  variant?: 'default' | 'pro';
}) {
  const isPro = variant === 'pro';
  return (
    <div
      className={`${isPro ? 'rounded-2xl p-7 shadow-2xl' : 'rounded-3xl p-8'} ${className}`}
      style={{
        background: PRO_PANEL,
        border: `1px solid ${isPro ? PRO_BORDER_STRONG : PRO_BORDER}`,
        borderLeft: `3px solid ${isPro ? PRO_ACCENT : accent}`,
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CARD HEADER
// ─────────────────────────────────────────────────────────────
function CardHeader({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  tooltip,
  onExpand,
  variant = 'default',
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  subtitle?: string;
  tooltip?: { title: string; lines: string[] };
  onExpand?: () => void;
  variant?: 'default' | 'pro';
}) {
  const isPro = variant === 'pro';
  return (
    <div className={`flex items-start justify-between gap-3 ${isPro ? 'mb-6' : 'mb-8'}`}>
      <div className="flex items-center gap-3">
        <Icon className={`${isPro ? 'w-4 h-4' : 'w-5 h-5'} shrink-0`} style={{ color: isPro ? PRO_ACCENT : iconColor }} />
        <div>
          <h2 className={`${isPro ? 'text-sm text-white' : 'text-base'} font-black tracking-widest uppercase italic leading-none`}>{title}</h2>
          {subtitle && (
            <p className={`text-[10px] ${isPro ? 'text-[#555]' : 'text-gray-500'} font-bold uppercase tracking-widest mt-1`}>{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onExpand && <ChartExpandButton onClick={onExpand} />}
        {tooltip && <InfoTooltip title={tooltip.title} lines={tooltip.lines} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION LABEL
// ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] text-[#333] font-black tracking-[0.3em] uppercase pt-2">{children}</div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
function hasUsableChart(chart?: ProAnalyticsChart): boolean {
  return Boolean(chart?.quality?.sample_size && ((chart.series_card?.length ?? 0) > 0 || (chart.series_detail?.length ?? 0) > 0));
}

function preferChart(primary: ProAnalyticsChart | undefined, fallback: ProAnalyticsChart): ProAnalyticsChart {
  return hasUsableChart(primary) ? primary as ProAnalyticsChart : fallback;
}

function parseRunPaceSec(pace?: string | null): number | null {
  if (!pace) return null;
  const parts = String(pace).trim().split(':').map(Number);
  if (parts.length !== 2 || parts.some(Number.isNaN)) return null;
  return parts[0] * 60 + parts[1];
}

function paceLabel(seconds?: number | null): string {
  if (!seconds || !Number.isFinite(seconds)) return '--';
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

function dateLabel(dateString?: string | null): string {
  const date = new Date(`${String(dateString ?? '').slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(dateString ?? '');
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

function classifyBiologyRun(run: Run): {
  type: AdaptationType;
  key: AdaptationKey;
  window: number;
  reason: string;
} {
  const paceSec = parseRunPaceSec(run.avg_pace);
  const duration = Number(run.duration_minutes ?? 0);
  const distance = Number(run.distance_km ?? 0);
  const hrPct = Number(run.avg_hr_pct ?? 0);
  const cadence = Number(run.avg_cadence ?? run.biomechanics?.avg_cadence_spm ?? 0);
  const elevation = Number(run.elevation_gain ?? 0);
  const text = `${run.name ?? ''} ${run.run_type ?? ''} ${run.notes ?? ''}`.toLowerCase();

  if (
    /repetition|ripet|sprint|strides|fartlek|hill sprint|salite brevi/.test(text)
    || (duration <= 45 && paceSec !== null && paceSec <= 300 && (hrPct >= 82 || cadence >= 178))
    || (duration <= 40 && cadence >= 182)
  ) {
    return {
      type: 'Neuromuscolare',
      key: 'neuromuscular',
      window: 7,
      reason: 'Velocita, coordinazione e reclutamento muscolare',
    };
  }

  if (/long|lungo|trail|hilly|collinare|easy lungo/.test(text) || distance >= 14 || duration >= 75 || elevation >= 250) {
    return {
      type: 'Strutturale',
      key: 'structural',
      window: 21,
      reason: 'Tendini, capillari, tolleranza al volume',
    };
  }

  return {
    type: 'Metabolico',
    key: 'metabolic',
    window: 14,
    reason: 'Soglia, mitocondri ed economia aerobica',
  };
}

function buildStravaBiologyFallback(runs: Run[], ffHistory: DashboardResponse['fitness_freshness']): SupercompensationResponse {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const latestTsb = ffHistory.length ? Number(ffHistory[ffHistory.length - 1]?.tsb) : null;
  const stravaRuns = runs
    .filter((run) => run.strava_id !== null && run.strava_id !== undefined && run.is_treadmill !== true)
    .slice()
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
    .slice(0, 20);

  const recent_runs: SupercompensationRun[] = stravaRuns.map((run) => {
    const adaptation = classifyBiologyRun(run);
    const runDate = new Date(`${String(run.date ?? '').slice(0, 10)}T12:00:00`);
    const elapsed = Number.isNaN(runDate.getTime()) ? 0 : Math.max(0, Math.floor((today.getTime() - runDate.getTime()) / 86400000));
    const progress = Math.max(0, Math.min(100, (elapsed / adaptation.window) * 100));
    const benefitDate = Number.isNaN(runDate.getTime())
      ? String(run.date ?? '').slice(0, 10)
      : new Date(runDate.getTime() + adaptation.window * 86400000).toISOString().slice(0, 10);
    const distance = Number(run.distance_km ?? 0);
    const duration = Number(run.duration_minutes ?? 0);
    const hrFactor = run.avg_hr_pct ? 1 + Math.max(0, run.avg_hr_pct - 70) / 100 : 1;

    return {
      id: run.id ?? String(run.strava_id ?? `${run.date}-${run.distance_km}`),
      strava_id: run.strava_id,
      date: String(run.date ?? ''),
      date_label: dateLabel(run.date),
      name: run.name || run.run_type || 'Corsa Strava',
      distance_km: Math.round(distance * 100) / 100,
      duration_minutes: Math.round(duration * 10) / 10,
      avg_pace: run.avg_pace ?? null,
      avg_hr: run.avg_hr ?? null,
      run_type: run.run_type ?? null,
      adaptation_type: adaptation.type,
      adaptation_key: adaptation.key,
      benefit_window_days: adaptation.window,
      benefit_date: benefitDate,
      benefit_progress_pct: Math.round(progress),
      missing_pct: Math.round(Math.max(0, 100 - progress)),
      days_remaining: Math.max(0, adaptation.window - elapsed),
      load: Math.round(Math.max(0, distance * Math.max(duration, 1) / 10 * hrFactor) * 10) / 10,
      reason: adaptation.reason,
    };
  });

  const adaptation_totals: SupercompensationResponse['adaptation_totals'] = {
    neuromuscular: { label: 'Neuromuscolare', load: 0, runs: 0, missing_pct: 0, ready_pct: 0, color: PRO_ACCENT },
    metabolic: { label: 'Metabolico', load: 0, runs: 0, missing_pct: 0, ready_pct: 0, color: PRO_ORANGE },
    structural: { label: 'Strutturale', load: 0, runs: 0, missing_pct: 0, ready_pct: 0, color: PRO_BLUE },
  };

  recent_runs.forEach((run) => {
    const total = adaptation_totals[run.adaptation_key];
    total.load += run.load;
    total.runs += 1;
    total.missing_pct += run.missing_pct;
    total.ready_pct += run.benefit_progress_pct;
  });
  Object.values(adaptation_totals).forEach((total) => {
    const count = total.runs || 1;
    total.load = Math.round(total.load * 10) / 10;
    total.missing_pct = Math.round(total.missing_pct / count);
    total.ready_pct = Math.round(total.ready_pct / count);
  });

  const totalLoad = recent_runs.reduce((sum, run) => sum + run.load, 0) || 1;
  const loadByKey = (key: AdaptationKey) => recent_runs.filter((run) => run.adaptation_key === key).reduce((sum, run) => sum + run.load, 0) || 1;
  const categoryLoad: Record<AdaptationKey, number> = {
    neuromuscular: loadByKey('neuromuscular'),
    metabolic: loadByKey('metabolic'),
    structural: loadByKey('structural'),
  };

  let bestPoint: SupercompensationProjectionPoint | null = null;
  const projection: SupercompensationProjectionPoint[] = Array.from({ length: recent_runs.length ? 21 : 0 }, (_, i) => {
    const day = new Date(today.getTime() + i * 86400000);
    const raw: Record<AdaptationKey, number> = { neuromuscular: 0, metabolic: 0, structural: 0 };
    let matured = 0;
    recent_runs.forEach((run) => {
      const runDate = new Date(`${run.date.slice(0, 10)}T12:00:00`);
      const elapsed = Number.isNaN(runDate.getTime()) ? 0 : Math.max(0, Math.floor((day.getTime() - runDate.getTime()) / 86400000));
      const window = run.benefit_window_days || 1;
      const maturity = elapsed <= window
        ? elapsed / window
        : Math.max(0, 1 - ((elapsed - window) / Math.max(1, window * 0.75)));
      raw[run.adaptation_key] += run.load * maturity;
      matured += run.load * maturity;
    });
    const adaptationReady = Math.max(0, Math.min(100, matured / totalLoad * 100));
    const freshness = latestTsb === null ? null : Math.max(0, Math.min(100, 50 + latestTsb * 1.4 + i * 0.6));
    const readiness = freshness === null ? adaptationReady : adaptationReady * 0.62 + freshness * 0.38;
    const point: SupercompensationProjectionPoint = {
      date: day.toISOString().slice(0, 10),
      label: dateLabel(day.toISOString()),
      neuromuscular: Math.round(Math.min(100, raw.neuromuscular / categoryLoad.neuromuscular * 100) * 10) / 10,
      metabolic: Math.round(Math.min(100, raw.metabolic / categoryLoad.metabolic * 100) * 10) / 10,
      structural: Math.round(Math.min(100, raw.structural / categoryLoad.structural * 100) * 10) / 10,
      adaptation_ready: Math.round(adaptationReady * 10) / 10,
      readiness: Math.round(readiness * 10) / 10,
      fitness: Math.round(readiness * 10) / 10,
      tsb: latestTsb,
      freshness: freshness === null ? null : Math.round(freshness * 10) / 10,
    };
    if (!bestPoint || point.readiness > bestPoint.readiness) bestPoint = point;
    return point;
  });

  return {
    investments: recent_runs.slice(0, 10).map((run) => ({
      date: run.date,
      load: run.load,
      type: run.run_type,
      adaptation_type: run.adaptation_type,
    })),
    golden_day: bestPoint?.date ?? null,
    days_to_golden: bestPoint ? Math.max(0, Math.floor((new Date(`${bestPoint.date}T12:00:00`).getTime() - today.getTime()) / 86400000)) : null,
    projection,
    recent_runs,
    adaptation_totals,
    golden_day_score: bestPoint?.readiness ?? null,
  };
}

function isoWeekKey(dateString: string): string {
  const date = new Date(`${dateString.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString.slice(0, 10);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function makeFallbackChart(
  id: string,
  title: string,
  unit: string,
  seriesCard: Array<Record<string, any>>,
  seriesDetail: Array<Record<string, any>>,
  kpis: Record<string, any> = {},
): ProAnalyticsChart {
  const sampleSize = Number(kpis.samples ?? kpis.runs ?? kpis.points ?? seriesDetail.length ?? seriesCard.length);
  return {
    id,
    title,
    unit,
    summary: kpis,
    series_card: seriesCard,
    series_detail: seriesDetail,
    kpis,
    quality: {
      status: sampleSize > 0 ? 'ok' : 'insufficient_data',
      sample_size: sampleSize,
      message: sampleSize > 0 ? null : 'Fallback locale: nessuna corsa valida disponibile',
    },
  };
}

function buildClientAnalyticsFallbacks(runs: Run[]) {
  const validRuns = runs
    .filter((run) => !run.is_treadmill && (run.has_gps ?? Boolean(run.polyline || run.start_latlng)))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const latestDate = validRuns.reduce<Date | null>((latest, run) => {
    const date = new Date(`${run.date.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return latest;
    return !latest || date > latest ? date : latest;
  }, null);

  const paceRuns = validRuns
    .map((run) => ({ run, paceSec: parseRunPaceSec(run.avg_pace) }))
    .filter((item): item is { run: Run; paceSec: number } => Boolean(item.paceSec));

  const paceBins = new Map<number, number>();
  for (const { paceSec } of paceRuns) {
    const bucket = Math.floor(paceSec / 15) * 15;
    paceBins.set(bucket, (paceBins.get(bucket) ?? 0) + 1);
  }
  const paceDistribution = Array.from(paceBins.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([paceSec, count]) => ({ pace: paceLabel(paceSec), pace_sec: paceSec, runs: count }));

  const paceZoneBins = [
    { zone: 'Z1', name: 'Recupero', minSec: 390, color: '#3B82F6', runs: 0, km: 0 },
    { zone: 'Z2', name: 'Easy', minSec: 360, color: '#10B981', runs: 0, km: 0 },
    { zone: 'Z3', name: 'Steady', minSec: 330, color: '#A3E635', runs: 0, km: 0 },
    { zone: 'Z4', name: 'Threshold', minSec: 300, color: '#F59E0B', runs: 0, km: 0 },
    { zone: 'Z5', name: 'Fast', minSec: 0, color: '#F43F5E', runs: 0, km: 0 },
  ];
  const cutoff90 = latestDate ? new Date(latestDate) : null;
  cutoff90?.setDate(cutoff90.getDate() - 90);
  for (const { run, paceSec } of paceRuns) {
    const date = new Date(`${run.date.slice(0, 10)}T00:00:00`);
    if (cutoff90 && date < cutoff90) continue;
    const zone = paceZoneBins.find((bin) => paceSec >= bin.minSec);
    if (!zone) continue;
    zone.runs += 1;
    zone.km += Number(run.distance_km || 0);
  }
  const totalZoneKm = paceZoneBins.reduce((sum, zone) => sum + zone.km, 0);
  const paceZones = paceZoneBins.map((zone) => ({
    zone: zone.zone,
    name: zone.name,
    km: Number(zone.km.toFixed(1)),
    runs: zone.runs,
    pct: totalZoneKm ? Number(((zone.km / totalZoneKm) * 100).toFixed(1)) : 0,
    color: zone.color,
  }));

  const effortPoints = paceRuns
    .filter(({ run }) => Number(run.distance_km || 0) > 0)
    .map(({ run, paceSec }) => {
      const distance = Number(run.distance_km || 0);
      const duration = Number(run.duration_minutes || 0) || (distance * paceSec) / 60;
      const hr = run.avg_hr ?? null;
      return {
        date: run.date,
        dist: Number(distance.toFixed(2)),
        pace: Number((paceSec / 60).toFixed(2)),
        pace_sec: paceSec,
        hr,
        z: Number((duration * ((hr ?? 140) / 140)).toFixed(1)),
      };
    });

  const monthlyBest: Record<string, Record<string, any>> = {};
  const weeklyBest: Record<string, Record<string, any>> = {};
  const targets = [
    ['k5', 5.0, 4.5],
    ['k10', 10.0, 9.5],
    ['hm', 21.097, 20.0],
  ] as const;
  let bestSamples = 0;
  const updateBest = (rows: Record<string, Record<string, any>>, key: string, label: string, seconds: number) => {
    rows[key] ??= { date: key };
    if (!rows[key][label] || seconds < Number(rows[key][label])) rows[key][label] = Math.round(seconds);
  };
  for (const { run } of paceRuns) {
    const distance = Number(run.distance_km || 0);
    const durationSeconds = Number(run.duration_minutes || 0) * 60;
    if (distance <= 0 || durationSeconds <= 0) continue;
    const month = run.date.slice(0, 7);
    const week = isoWeekKey(run.date);
    for (const [label, targetKm, minKm] of targets) {
      if (distance < minKm || distance < targetKm * 0.98) continue;
      const estimate = durationSeconds * (targetKm / distance);
      updateBest(monthlyBest, month, label, estimate);
      updateBest(weeklyBest, week, label, estimate);
      bestSamples += 1;
    }
  }
  const bestEffortsCard = Object.values(monthlyBest)
    .filter((row) => row.k5 || row.k10 || row.hm)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(-12);
  const bestEffortsDetail = Object.values(weeklyBest)
    .filter((row) => row.k5 || row.k10 || row.hm)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return {
    load_form: {
      pace_zones: makeFallbackChart('pace_zones', 'Distribuzione Zone di Passo', '%', paceZones, paceZones, {
        total_km: Number(totalZoneKm.toFixed(1)),
        runs: paceZoneBins.reduce((sum, zone) => sum + zone.runs, 0),
      }),
      pace_distribution: makeFallbackChart('pace_distribution', 'Distribuzione del Passo', 'runs', paceDistribution, paceDistribution, {
        runs: paceRuns.length,
        avg_pace: paceLabel(paceRuns.reduce((sum, item) => sum + item.paceSec, 0) / Math.max(1, paceRuns.length)),
      }),
      effort_matrix: makeFallbackChart('effort_matrix', 'Matrice degli Sforzi', 'effort', effortPoints.slice(-80), effortPoints, {
        points: effortPoints.length,
      }),
    },
    potential_progress: {
      best_efforts_progression: makeFallbackChart('best_efforts_progression', 'Best Efforts Progression', 'seconds', bestEffortsCard, bestEffortsDetail, {
        samples: bestSamples,
      }),
    },
  };
}

export function StatisticsView() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('analytics');
  const [expandedChart, setExpandedChart] = useState<null | 'paces' | 'cadence' | 'gctMonthly'>(null);
  const [proSections, setProSections] = useState<ProAnalyticsResponse['sections']>({});
  const [proError, setProError] = useState<string | null>(null);
  const detailRequestsRef = useRef<Set<string>>(new Set());
  const { data: analyticsData } = useApi<AnalyticsResponse>(getAnalytics);
  const { data: vdotData } = useApi<VdotPacesResponse>(getVdotPaces);
  const { data: runsData } = useApi<RunsResponse>(getRuns);
  const { data: gctData } = useApi<GctAnalysisResponse>(getGctAnalysis);
  const { data: dashData } = useApi<DashboardResponse>(getDashboard);
  const { data: superData } = useApi<SupercompensationResponse>(getSupercompensation);

  type ProTab = 'load_form' | 'potential_progress' | 'biomechanics';
  const activeProTab = React.useMemo<ProTab | null>(() => {
    if (activeTab === 'analytics') return 'load_form';
    if (activeTab === 'analyticsv2') return 'potential_progress';
    if (activeTab === 'analyticsv3') return 'biomechanics';
    return null;
  }, [activeTab]);

  const mergeProAnalytics = React.useCallback((response: ProAnalyticsResponse) => {
    setProSections((prev) => {
      const next: ProAnalyticsResponse['sections'] = { ...prev };
      (Object.keys(response.sections) as ProTab[]).forEach((sectionKey) => {
        const incoming = response.sections[sectionKey];
        if (!incoming) return;
        next[sectionKey] = {
          charts: {
            ...(next[sectionKey]?.charts ?? {}),
            ...incoming.charts,
          },
        };
      });
      return next;
    });
  }, []);

  const fetchProSection = React.useCallback(async (tab: ProTab) => {
    try {
      setProError(null);
      const response = await getProAnalytics({ tab, range: '12M', resolution: 'auto', detail: false });
      mergeProAnalytics(response);
    } catch (err) {
      setProError(err instanceof Error ? err.message : 'Errore analytics');
    }
  }, [mergeProAnalytics]);

  const requestProChartDetail = React.useCallback((tab: ProTab, chart: string) => {
    const key = `${tab}:${chart}`;
    if (detailRequestsRef.current.has(key)) return;
    detailRequestsRef.current.add(key);
    getProAnalytics({ tab, range: '12M', resolution: 'auto', detail: true, chart })
      .then(mergeProAnalytics)
      .catch((err) => {
        detailRequestsRef.current.delete(key);
        setProError(err instanceof Error ? err.message : 'Errore analytics');
      });
  }, [mergeProAnalytics]);

  React.useEffect(() => {
    if (!activeProTab) return;
    void fetchProSection(activeProTab);
  }, [activeProTab, fetchProSection]);

  const runs = runsData?.runs ?? [];
  const statsRuns = React.useMemo(
    () => runs.filter((r) => !r.is_treadmill && (r.has_gps ?? Boolean(r.polyline || r.start_latlng))),
    [runs]
  );
  const fallbackCharts = React.useMemo(() => buildClientAnalyticsFallbacks(statsRuns), [statsRuns]);
  const vdot = vdotData?.vdot ?? null;
  const level = vdot ? vdotLevel(vdot, t) : null;
  const paces = vdotData?.paces ?? {};
  const racePredictions = vdotData?.race_predictions ?? analyticsData?.race_predictions ?? {};
  const zoneDistribution = analyticsData?.zone_distribution ?? [];
  const ffHistory = dashData?.fitness_freshness ?? [];
  const prevCtl = ffHistory.length >= 2 ? ffHistory[ffHistory.length - 2].ctl : null;
  const rawLoadCharts: Record<string, ProAnalyticsChart> = proSections.load_form?.charts ?? {};
  const rawPotentialCharts: Record<string, ProAnalyticsChart> = proSections.potential_progress?.charts ?? {};
  const loadCharts: Record<string, ProAnalyticsChart> = {
    ...rawLoadCharts,
    pace_zones: preferChart(rawLoadCharts.pace_zones, fallbackCharts.load_form.pace_zones),
    pace_distribution: preferChart(rawLoadCharts.pace_distribution, fallbackCharts.load_form.pace_distribution),
    effort_matrix: preferChart(rawLoadCharts.effort_matrix, fallbackCharts.load_form.effort_matrix),
  };
  const potentialCharts: Record<string, ProAnalyticsChart> = {
    ...rawPotentialCharts,
    best_efforts_progression: preferChart(rawPotentialCharts.best_efforts_progression, fallbackCharts.potential_progress.best_efforts_progression),
  };
  const biomechCharts: Record<string, ProAnalyticsChart> = proSections.biomechanics?.charts ?? {};
  const localBiologyData = React.useMemo(() => buildStravaBiologyFallback(runs, ffHistory), [runs, ffHistory]);
  const serverBiologyHasStravaRuns = Boolean(superData?.recent_runs?.some((run) => run.strava_id !== null && run.strava_id !== undefined));
  const biologyData = serverBiologyHasStravaRuns ? superData as SupercompensationResponse : localBiologyData;
  const biologyProjection = biologyData.projection ?? [];
  const biologyRuns = biologyData.recent_runs ?? [];
  const biologyGoldenPoint = biologyProjection.find((p) => p.date === biologyData.golden_day) ?? null;
  const biologyGoldenDate = biologyData.golden_day ? new Date(`${biologyData.golden_day}T12:00:00`) : null;
  const biologyGoldenLabel = biologyGoldenDate
    ? biologyGoldenDate.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
    : 'Dati reali insufficienti';
  const biologyGoldenScore = biologyData.golden_day_score ?? biologyGoldenPoint?.readiness ?? null;
  const biologyAdaptationCards = React.useMemo(() => ([
    {
      key: 'neuromuscular' as const,
      label: 'Neuromuscolare',
      icon: Zap,
      color: PRO_ACCENT,
      desc: 'Velocita, cadenza, potenza breve',
      total: biologyData.adaptation_totals?.neuromuscular,
    },
    {
      key: 'metabolic' as const,
      label: 'Metabolico',
      icon: Activity,
      color: PRO_ORANGE,
      desc: 'Soglia, VO2, economia aerobica',
      total: biologyData.adaptation_totals?.metabolic,
    },
    {
      key: 'structural' as const,
      label: 'Strutturale',
      icon: Dna,
      color: PRO_BLUE,
      desc: 'Tendini, capillari, volume',
      total: biologyData.adaptation_totals?.structural,
    },
  ]), [biologyData]);

  // ── Monthly elevation from runs ───────────────────────────
  const elevationData = React.useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const elevation = statsRuns
        .filter((r) => {
          const rd = new Date(r.date);
          return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
        })
        .reduce((sum, r) => sum + (r.elevation_gain ?? 0), 0);
      return {
        name: d.toLocaleString('it', { month: 'short' }).toUpperCase(),
        dislivello: Math.round(elevation),
      };
    });
  }, [statsRuns]);


  const tabs = [
    { id: 'analytics',   label: 'Carico & Forma',              icon: LayoutGrid },
    { id: 'analyticsv2', label: 'Potenziale & Progressi',      icon: Radar },
    { id: 'analyticsv3', label: 'Biomeccanica & Efficienza',   icon: Activity },
    { id: 'biology',     label: 'Biologia & Futuro',           icon: FlaskConical },
    { id: 'badges',      label: 'Badge',                       icon: Star },
  ];

  const noData = (message = 'Dati reali insufficienti') => (
    <div className="h-full min-h-[180px] flex items-center justify-center text-gray-600 text-sm font-bold uppercase tracking-widest text-center px-6">
      {message}
    </div>
  );

  const renderPacesTrendChart = (fullscreen = false) => {
    const chart = biomechCharts.paces ?? potentialCharts.trend_passo;
    const source = fullscreen ? chart?.series_detail : chart?.series_card;
    const data = (source ?? [])
      .filter((d) => d.pace)
      .map((d) => ({ date: String(d.date), pace: Number(d.pace) / 60, paceSec: Number(d.pace), runs: d.runs }));
    if (!data.length) return noData(chart?.quality?.message ?? 'Passo non disponibile per le corse outdoor GPS');
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
          <XAxis dataKey="date" stroke="#333" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis hide domain={['dataMin - 0.15', 'dataMax + 0.15']} reversed />
          <Tooltip
            contentStyle={PRO_TOOLTIP_STYLE}
            formatter={(value: any) => {
              const sec = Math.round(Number(value) * 60);
              return [`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} /km`, 'Passo medio'];
            }}
          />
          <Line type="monotone" dataKey="pace" stroke={PRO_ACCENT} strokeWidth={2} dot={{ r: 4, fill: PRO_ACCENT }} />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderCadenceMonthlyChart = (fullscreen = false) => {
    const chart = biomechCharts.cadence_monthly;
    const source = fullscreen ? chart?.series_detail : chart?.series_card;
    const data = (source ?? [])
      .filter((d) => d.cadence)
      .map((d) => ({ date: String(d.date), cadence: Number(d.cadence), runs: d.runs }));
    if (!data.length) return noData(chart?.quality?.message ?? 'Cadenza reale non disponibile');
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
          <XAxis dataKey="date" stroke="#333" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="#333" fontSize={10} domain={['dataMin - 5', 'dataMax + 5']} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={PRO_TOOLTIP_STYLE} formatter={(v: any) => [`${Number(v).toFixed(0)} spm`, 'Cadenza']} />
          <ReferenceLine y={180} stroke="#333" strokeDasharray="5 5" />
          <Line type="monotone" dataKey="cadence" stroke={PRO_ACCENT} strokeWidth={2} dot={{ r: 5, fill: PRO_ACCENT }} />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const formatGctMonth = (value: string) => {
    const [y, m] = value.split('-');
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    return `${months[parseInt(m) - 1]} '${y.slice(2)}`;
  };

  const formatGctZone = (value: string) => {
    const labels: Record<string, string> = {
      pace_530: '>= 5:30/km',
      pace_500: '5:00-5:29/km',
      pace_445: '< 4:45/km',
    };
    return labels[value] || value;
  };

  const renderGctMonthlyChart = (fullscreen = false) => {
    const chart = biomechCharts.gct_monthly;
    const source = fullscreen ? chart?.series_detail : chart?.series_card;
    const data = (source?.length ? source : (gctData?.monthly ?? []).map((d) => ({ ...d, date: d.month }))) ?? [];
    if (!data.length) return noData(chart?.quality?.message ?? 'Importa CSV Garmin e collega la telemetria');
    return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="#333"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatGctMonth}
        />
        <YAxis
          stroke="#333"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          domain={['dataMin - 10', 'dataMax + 10']}
          tickFormatter={(v) => `${v}ms`}
        />
        <Tooltip
          contentStyle={PRO_TOOLTIP_STYLE}
          formatter={(value: any, name: string) => {
            if (value === null || value === undefined) return ['N/D', ''];
            return [`${value} ms`, formatGctZone(name)];
          }}
        />
        <Legend
          formatter={formatGctZone}
          wrapperStyle={{ fontSize: '11px', fontWeight: 700 }}
        />
        <Line type="monotone" dataKey="pace_530" stroke={PRO_BLUE} strokeWidth={2} dot={{ r: 4, fill: PRO_BLUE }} connectNulls={false} />
        <Line type="monotone" dataKey="pace_500" stroke={PRO_PURPLE} strokeWidth={2} dot={{ r: 4, fill: PRO_PURPLE }} connectNulls={false} />
        <Line type="monotone" dataKey="pace_445" stroke={PRO_ACCENT} strokeWidth={2} dot={{ r: 4, fill: PRO_ACCENT }} connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  );
  };

  const openBiomechModal = (modal: 'paces' | 'cadence' | 'gctMonthly') => {
    const chartByModal = {
      paces: 'paces',
      cadence: 'cadence_monthly',
      gctMonthly: 'gct_monthly',
    } as const;
    requestProChartDetail('biomechanics', chartByModal[modal]);
    setExpandedChart(modal);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] text-white p-6 lg:p-10">
      <div className="max-w-[1800px] mx-auto space-y-8">

        {/* ── HEADER ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div>
            <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic">
              Elite <span className="text-[#C0FF00]">Analytics</span>
            </h1>
            <p className="text-gray-600 text-[10px] font-black tracking-[0.3em] uppercase mt-2">
              Engineered for peak human performance
            </p>
          </div>

          <div className="flex items-center bg-[#0D0D0D] p-1.5 rounded-2xl border border-[#1E1E1E] shadow-2xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black transition-all tracking-widest ${
                  activeTab === tab.id
                    ? 'bg-[#1A1A1A] text-white shadow-lg border border-[#2A2A2A]'
                    : 'text-gray-600 hover:text-gray-300'
                }`}
              >
                <tab.icon
                  className={`w-4 h-4 ${activeTab === tab.id ? 'text-[#C0FF00]' : ''}`}
                />
                {tab.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {proError && ['analytics', 'analyticsv2', 'analyticsv3'].includes(activeTab) && (
          <div className="rounded-xl border border-[#ff5b00]/40 bg-[#ff5b00]/10 px-5 py-4 text-sm text-[#ffb38a]">
            Backend analytics non disponibile: {proError}. Verifica che Render stia servendo il backend aggiornato e che /api/analytics/pro risponda 200.
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            ANALYTICS PRO TAB
        ════════════════════════════════════════════════════ */}
        {activeTab === 'analytics' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            <SectionLabel>CARICO — FITNESS · FATICA · FORMA</SectionLabel>

             {/* ── KPI Grid ── */}
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
               {[
                 {
                   label: 'Fitness (CTL)',
                   value: '54.2',
                   trend: '+2.1',
                   trendUp: true,
                   icon: TrendingUp,
                   color: PRO_BLUE,
                   desc: 'Carico Cronico',
                 },
                 {
                   label: 'Fatigue (ATL)',
                   value: '68.5',
                   trend: '+5.4',
                   trendUp: true,
                   icon: Zap,
                   color: PRO_RED,
                   desc: 'Carico Acuto',
                 },
                 {
                   label: 'Form (TSB)',
                   value: '-14.3',
                   trend: '-3.3',
                   trendUp: false,
                   icon: Activity,
                   color: PRO_ACCENT,
                   desc: 'Bilancio Carico/Recupero',
                 },
                 {
                   label: 'Efficiency Factor',
                   value: '1.42',
                   trend: '+0.05',
                   trendUp: true,
                   icon: Flame,
                   color: PRO_PURPLE,
                   desc: 'Passo vs Frequenza Cardiaca',
                 },
               ].map((kpi, i) => (
                 <div
                   key={i}
                   className="bg-[#0E0E0E] border border-[#2A2A2A] rounded-2xl p-6 relative overflow-hidden hover:border-[#333] transition-colors shadow-2xl"
                   style={{ borderLeft: `3px solid ${kpi.color}` }}
                 >
                   <div className="flex justify-between items-start mb-4">
                     <div>
                       <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                         {kpi.label}
                       </p>
                       <div className="flex items-baseline gap-2">
                         <span className="text-3xl font-black italic">{kpi.value}</span>
                         <span
                           className={`text-xs font-bold flex items-center ${
                             kpi.trendUp ? 'text-[#D4FF00]' : 'text-[#F43F5E]'
                           }`}
                         >
                           {kpi.trendUp ? '↑' : '↓'} {kpi.trend}
                         </span>
                       </div>
                     </div>
                     <div
                       className="p-3 rounded-xl bg-[#0D0D0D] border border-[#1E1E1E]"
                       style={{ color: kpi.color }}
                     >
                       <kpi.icon className="w-5 h-5" />
                     </div>
                   </div>
                   <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                     {kpi.desc}
                   </p>
                 </div>
               ))}
             </div>

            {/* ── Fitness & Freshness (real data) ── */}
            <div className="relative">
              <FitnessFreshness
                fitnessFreshness={ffHistory}
                currentFf={dashData?.current_ff ?? null}
                prevCtl={prevCtl}
              />
            </div>

             <SectionLabel>TREND — KM · ANDAMENTO · DISTRIBUZIONE ZONE DI PASSO</SectionLabel>

             {/* ── MainChart and PaceZoneDistribution on same row ── */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
               <div>
                 {/* ── MainChart ── */}
                 <div className="h-[420px]">
                   <MainChart runs={statsRuns} />
                 </div>
               </div>
               <div>
                 {/* ── Pace Zone Distribution ── */}
                  <AnalyticsV4PaceZoneDistribution
                    chart={loadCharts.pace_zones}
                    onRequestDetail={() => requestProChartDetail('load_form', 'pace_zones')}
                  />
               </div>
             </div>

             {false && (
             <>
             {/* ── Paces Trend + Cadenza ── */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <Card accent={PRO_ACCENT} variant="pro">
                 <CardHeader
                   icon={TrendingUp}
                   iconColor={PRO_ACCENT}
                   title="Andamento Paces"
                   variant="pro"
                   subtitle="Easy · Tempo · Rapido — trend storico"
                   tooltip={{
                     title: 'ANDAMENTO PACES',
                     lines: [
                       'Easy (giallo): passo delle corse lente. Deve scendere nel tempo.',
                       'Tempo (blu): passo soglia lattato. Indica progressi fitness.',
                       'Fast (rosso): passo delle ripetute veloci.',
                       'Scala Y invertita: valore più basso = passo più veloce.',
                     ],
                   }}
                 />
                 <div className="h-64 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={pacesTrendData}>
                       <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                       <XAxis
                         dataKey="date"
                         stroke="#333"
                         fontSize={10}
                         tickLine={false}
                         axisLine={false}
                       />
                       <YAxis hide domain={[3.5, 6]} reversed />
                       <Tooltip
                         contentStyle={PRO_TOOLTIP_STYLE}
                       />
                       <Legend
                         wrapperStyle={{ fontSize: '10px', fontWeight: 700 }}
                         formatter={(v) =>
                           v === 'easy' ? 'Easy' : v === 'tempo' ? 'Tempo' : 'Fast'
                         }
                       />
                       <Line
                         type="monotone"
                         dataKey="easy"
                         stroke={PRO_BLUE}
                         strokeWidth={2}
                         dot={{ r: 4, fill: PRO_BLUE }}
                       />
                       <Line
                         type="monotone"
                         dataKey="tempo"
                         stroke={PRO_PURPLE}
                         strokeWidth={2}
                         dot={{ r: 4, fill: PRO_PURPLE }}
                       />
                       <Line
                         type="monotone"
                         dataKey="fast"
                         stroke={PRO_ACCENT}
                         strokeWidth={2}
                         dot={{ r: 4, fill: PRO_ACCENT }}
                       />
                     </LineChart>
                   </ResponsiveContainer>
                 </div>
               </Card>

               <Card accent={PRO_ACCENT} variant="pro">
                 <CardHeader
                   icon={Timer}
                   iconColor={PRO_ACCENT}
                   title="Cadenza Mensile"
                   variant="pro"
                   subtitle="Passi/minuto — media mensile"
                   tooltip={{
                     title: 'CADENZA (SPM)',
                     lines: [
                       'Cadenza = passi al minuto (strides per minute).',
                       'Ottimale: 170–185 spm per la maggior parte dei runner.',
                       '< 160 spm: over-striding, rischio infortuni al ginocchio.',
                       '> 185 spm: molto efficiente, tipico dei runner elite.',
                       'Linea tratteggiata = 180 spm (target ideale Daniels).',
                     ],
                   }}
                 />
                 <div className="h-64 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={cadenceMonthlyData}>
                       <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                       <XAxis
                         dataKey="month"
                         stroke="#333"
                         fontSize={10}
                         tickLine={false}
                         axisLine={false}
                       />
                       <YAxis
                         stroke="#333"
                         fontSize={10}
                         domain={[160, 185]}
                         tickLine={false}
                         axisLine={false}
                       />
                       <Tooltip
                         contentStyle={PRO_TOOLTIP_STYLE}
                       />
                       <ReferenceLine y={180} stroke="#333" strokeDasharray="5 5" />
                       <Line
                         type="monotone"
                         dataKey="value"
                         stroke={PRO_ACCENT}
                         strokeWidth={2}
                         dot={{ r: 5, fill: PRO_ACCENT }}
                       />
                     </LineChart>
                   </ResponsiveContainer>
                 </div>
               </Card>
             </div>
             </>
             )}

             {false && <SectionLabel>FISIOLOGIA — SOGLIA · DERIVA · GCT · DISLIVELLO</SectionLabel>}

             {/* ── Anaerobic Threshold ── */}
             {false && (
             <div>
               <AnaerobicThreshold
                 runs={statsRuns}
                 maxHr={dashData?.profile?.max_hr ?? 180}
                 vdot={vdot}
               />
             </div>
             )}

             {/* ── Cardiac Drift ── */}
             {false && <StatsDrift runs={statsRuns} />}

             {/* ── GCT Analysis ── */}
             {false && gctData && gctData.monthly.length > 0 && (
               <Card accent={PRO_ACCENT} variant="pro">
                 <CardHeader
                   icon={Zap}
                   iconColor={PRO_ACCENT}
                   title="Tempo Contatto Suolo (GCT)"
                   variant="pro"
                   subtitle={`Media mensile per fascia di pace · ${gctData.summary.total_runs} corse${gctData.summary.avg_gct ? ` · GCT medio: ${gctData.summary.avg_gct} ms` : ''}`}
                   tooltip={{
                     title: 'GROUND CONTACT TIME',
                     lines: [
                       'Tempo (ms) in cui il piede è a contatto col suolo per passo.',
                       'Elite: < 200 ms. Amatori avanzati: 220–260 ms. Principianti: > 270 ms.',
                       'GCT ridotto = corsa più elastica e reattiva.',
                       'Migliora con pliometria (box jump, pogo), forza reattiva.',
                       'Analizzato per fascia di passo: lento, medio, veloce.',
                     ],
                   }}
                 />
                 <div className="h-72 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={gctData.monthly}>
                       <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                       <XAxis
                         dataKey="month"
                         stroke="#333"
                         fontSize={10}
                         tickLine={false}
                         axisLine={false}
                         tickFormatter={(v) => {
                           const [y, m] = v.split('-');
                           const months = [
                             'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
                             'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
                           ];
                           return `${months[parseInt(m) - 1]} '${y.slice(2)}`;
                         }}
                       />
                       <YAxis
                         stroke="#333"
                         fontSize={10}
                         tickLine={false}
                         axisLine={false}
                         domain={['dataMin - 10', 'dataMax + 10']}
                         tickFormatter={(v) => `${v}ms`}
                       />
                       <Tooltip
                         contentStyle={PRO_TOOLTIP_STYLE}
                         formatter={(value: any, name: string) => {
                           if (value === null || value === undefined) return ['N/D', ''];
                           const zoneLabels: Record<string, string> = {
                             pace_530: '≥ 5:30/km',
                             pace_500: '5:00-5:29/km',
                             pace_445: '< 4:45/km',
                           };
                           return [`${value} ms`, zoneLabels[name] || name];
                         }}
                         labelFormatter={(label) => {
                           const [y, m] = label.split('-');
                           const months = [
                             'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                             'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
                           ];
                           return `${months[parseInt(m) - 1]} ${y}`;
                         }}
                       />
                       <Legend
                         formatter={(value: string) => {
                           const labels: Record<string, string> = {
                             pace_530: '≥ 5:30/km',
                             pace_500: '5:00-5:29/km',
                             pace_445: '< 4:45/km',
                           };
                           return labels[value] || value;
                         }}
                         wrapperStyle={{ fontSize: '11px', fontWeight: 700 }}
                       />
                       <Line
                         type="monotone"
                         dataKey="pace_530"
                         stroke={PRO_BLUE}
                         strokeWidth={2}
                         dot={{ r: 4, fill: PRO_BLUE }}
                         connectNulls={false}
                       />
                       <Line
                         type="monotone"
                         dataKey="pace_500"
                         stroke={PRO_PURPLE}
                         strokeWidth={2}
                         dot={{ r: 4, fill: PRO_PURPLE }}
                         connectNulls={false}
                       />
                       <Line
                         type="monotone"
                         dataKey="pace_445"
                         stroke={PRO_ACCENT}
                         strokeWidth={2}
                         dot={{ r: 4, fill: PRO_ACCENT }}
                         connectNulls={false}
                       />
                     </LineChart>
                   </ResponsiveContainer>
                 </div>
                 <div className="mt-4 grid grid-cols-3 gap-4">
                   {[
                     { key: 'pace_530', label: '≥ 5:30/km', color: PRO_BLUE },
                     { key: 'pace_500', label: '5:00–5:29/km', color: PRO_PURPLE },
                     { key: 'pace_445', label: '< 4:45/km', color: PRO_ACCENT },
                   ].map(({ key, label, color }) => {
                     const values = gctData.monthly
                       .map((m) => m[key as keyof typeof m])
                       .filter((v): v is number => v !== null);
                     const avg = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
                     const min = values.length > 0 ? Math.min(...values) : null;
                     const max = values.length > 0 ? Math.max(...values) : null;
                     return (
                       <div
                         key={key}
                         className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-4 text-center"
                       >
                         <div
                           className="text-[9px] font-black uppercase tracking-widest mb-2"
                           style={{ color }}
                         >
                           {label}
                         </div>
                         {avg !== null ? (
                           <>
                             <div className="text-2xl font-black italic text-white">
                               {avg}
                               <span className="text-xs text-gray-500 font-normal ml-1">ms</span>
                             </div>
                             <div className="text-[9px] text-gray-500 mt-1">
                               min {min}ms · max {max}ms
                             </div>
                           </>
                         ) : (
                           <div className="text-sm text-gray-600 font-bold">N/D</div>
                         )}
                       </div>
                     );
                   })}
                 </div>
               </Card>
             )}

             {/* ── Elevation Gain ── */}
             {false && (
             <Card accent={PRO_ACCENT} variant="pro">
               <div className="flex items-start justify-between mb-8">
                 <div className="flex items-center gap-3">
                   <TrendingUp className="w-5 h-5" style={{ color: PRO_ACCENT }} />
                   <div>
                     <h2 className="text-base font-black tracking-widest uppercase italic leading-none">
                       Dislivello Mensile
                     </h2>
                     <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                       Guadagno altimetrico (m) — ultimi 12 mesi
                     </p>
                   </div>
                 </div>
                 <div className="flex items-center gap-4">
                   <div className="text-right">
                     <div className="text-xl font-black italic" style={{ color: PRO_ACCENT }}>
                       {elevationData.reduce((s, d) => s + d.dislivello, 0).toLocaleString('it')} m
                     </div>
                     <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest">
                       Totale anno
                     </div>
                   </div>
                   <InfoTooltip
                     title="DISLIVELLO MENSILE"
                     lines={[
                       'Guadagno altimetrico totale per mese da Strava.',
                       'Indicatore di volume di lavoro muscolare eccentrico.',
                       'Utile per pianificare il recupero dopo settimane con molto salita.',
                       'Più dislivello = maggiore stress muscolare su quadricipiti e tendini.',
                     ]}
                   />
                 </div>
               </div>
               {elevationData.some((d) => d.dislivello > 0) ? (
                 <div className="h-64 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={elevationData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                       <defs>
                         <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="0%" stopColor={PRO_ACCENT} stopOpacity={0.9} />
                           <stop offset="100%" stopColor={PRO_ORANGE} stopOpacity={0.45} />
                         </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1A1A1A" />
                       <XAxis
                         dataKey="name"
                         stroke="#333"
                         fontSize={10}
                         tickLine={false}
                         axisLine={false}
                       />
                       <YAxis
                         stroke="#333"
                         fontSize={10}
                         tickLine={false}
                         axisLine={false}
                         tickFormatter={(v) => `${v}m`}
                       />
                       <Tooltip
                         contentStyle={PRO_TOOLTIP_STYLE}
                         formatter={(v: any) => [`${v.toLocaleString('it')} m`, 'Dislivello']}
                         labelStyle={{ color: PRO_ACCENT, fontWeight: 700, fontSize: 11 }}
                       />
                       <Bar
                         dataKey="dislivello"
                         fill="url(#elevGrad)"
                         radius={[4, 4, 0, 0]}
                         maxBarSize={36}
                       />
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
               ) : (
                 <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
                   Nessun dato di dislivello disponibile
                 </div>
               )}
             </Card>
             )}

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
               <AnalyticsV5PaceDistributionBell
                 chart={loadCharts.pace_distribution}
                 onRequestDetail={() => requestProChartDetail('load_form', 'pace_distribution')}
               />
               <AnalyticsV5EffortMatrix
                 chart={loadCharts.effort_matrix}
                 onRequestDetail={() => requestProChartDetail('load_form', 'effort_matrix')}
               />
             </div>

          </div>
        )}

        {/* ════════════════════════════════════════════════════
            ANALYTICS PRO V2 TAB
        ════════════════════════════════════════════════════ */}
        {activeTab === 'analyticsv2' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <AnalyticsV2
              vdot={vdot}
              zoneDistribution={zoneDistribution}
              gctData={gctData}
              runs={statsRuns}
              ffHistory={ffHistory}
              maxHr={dashData?.profile?.max_hr}
              thresholdPace={vdotData?.paces?.threshold}
              proCharts={potentialCharts}
              onRequestChartDetail={(chartId) => requestProChartDetail('potential_progress', chartId)}
              hideSections={['pmc', 'drift', 'zones', 'gct']}
            />
            {false && (
            <Card accent={PRO_ACCENT} variant="pro">
              <CardHeader
                icon={Target}
                iconColor={PRO_ACCENT}
                title="Previsioni Gara"
                variant="pro"
                subtitle={`da VDOT ${vdot ?? '—'}`}
                tooltip={{
                  title: 'PREVISIONI GARA',
                  lines: [
                    'Tempi predetti dalla formula Jack Daniels basata sul VDOT attuale.',
                    'Presuppongono allenamento adeguato alla distanza.',
                    '5K e 10K: previsioni piu accurate.',
                    'Mezza e Maratona: aggiungere margine energetico.',
                  ],
                }}
              />
              {Object.keys(racePredictions).length > 0 ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                  {[
                    { key: '5K', label: '5 km', color: PRO_BLUE, sub: 'Base' },
                    { key: '10K', label: '10 km', color: PRO_PURPLE, sub: 'Test' },
                    { key: 'Half Marathon', label: 'Mezza', color: PRO_ACCENT, sub: '21.1 km' },
                    { key: 'Marathon', label: 'Maratona', color: PRO_RED, sub: '42.2 km' },
                  ].map(({ key, label, color, sub }) => (
                    <div
                      key={key}
                      className="bg-[#111111] border border-[#2A2A2A] rounded-2xl p-5 text-center"
                    >
                      <div
                        className="text-[10px] font-black uppercase tracking-widest mb-1"
                        style={{ color }}
                      >
                        {label}
                      </div>
                      <div className="text-[9px] text-gray-600 font-bold mb-3">{sub}</div>
                      <div className="text-2xl font-black italic text-white">
                        {(racePredictions as Record<string, string>)[key] ?? '—'}
                      </div>
                      <div className="text-[9px] text-gray-500 font-bold mt-1">Daniels</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-600 text-sm py-8">
                  Sincronizza corse validate per calcolare le previsioni
                </p>
              )}
            </Card>
            )}

            <Card accent={PRO_ACCENT} variant="pro">
              <CardHeader
                icon={Zap}
                iconColor={PRO_ACCENT}
                title="Zone di Allenamento Daniels"
                variant="pro"
                subtitle="5 zone fisiologiche da VDOT"
                tooltip={{
                  title: 'ZONE DANIELS',
                  lines: [
                    'E: recupero e volume base.',
                    'M: ritmo maratona.',
                    'T: soglia lattato.',
                    'I: ripetute VO2max.',
                    'R: velocita neuromuscolare.',
                  ],
                }}
              />
              {Object.keys(paces).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {[
                    { key: 'easy', zone: 'E', name: 'Easy', desc: 'Recupero / volume lento', pct: '59-74%', color: PRO_BLUE },
                    { key: 'marathon', zone: 'M', name: 'Marathon', desc: 'Ritmo maratona', pct: '75-84%', color: PRO_PURPLE },
                    { key: 'threshold', zone: 'T', name: 'Threshold', desc: 'Soglia lattato', pct: '83-88%', color: PRO_ACCENT },
                    { key: 'interval', zone: 'I', name: 'Interval', desc: 'Ripetute VO2max', pct: '95-100%', color: PRO_ORANGE },
                    { key: 'repetition', zone: 'R', name: 'Repetition', desc: 'Velocita neuromuscolare', pct: '105-120%', color: PRO_RED },
                  ].map(({ key, zone, name, desc, pct, color }) => (
                    <div
                      key={key}
                      className="bg-[#111111] border border-[#2A2A2A] rounded-2xl p-5 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-black italic" style={{ color }}>
                          {zone}
                        </span>
                        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">
                          {pct}
                        </span>
                      </div>
                      <div className="text-xs font-black text-white uppercase tracking-wider">
                        {name}
                      </div>
                      <div className="text-xl font-black text-white">
                        {(paces as Record<string, string | null>)[key] ?? '—'}
                        <span className="text-xs text-gray-500 font-normal ml-1">/km</span>
                      </div>
                      <div className="text-[10px] text-gray-500 italic leading-tight">{desc}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-600 text-sm py-4">
                  VDOT non disponibile: sincronizza corse validate per calcolare i passi
                </p>
              )}
            </Card>
            <AnalyticsV5BestEffortsProgression
              chart={potentialCharts.best_efforts_progression}
              onRequestDetail={() => requestProChartDetail('potential_progress', 'best_efforts_progression')}
            />
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            ANALYTICS PRO V3 TAB
        ════════════════════════════════════════════════════ */}
        {activeTab === 'analyticsv3' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <AnalyticsV3 data={biomechCharts} onRequestChartDetail={(chartId) => requestProChartDetail('biomechanics', chartId)} onTelemetrySync={async () => {
              const result = await linkGarminCsv();
              detailRequestsRef.current.clear();
              setProSections((prev) => {
                const next = { ...prev };
                delete next.biomechanics;
                return next;
              });
              void fetchProSection('biomechanics');
              return result as GarminCsvLinkResult;
            }} />
            <SectionLabel>BIOMECCANICA — PACES · CADENZA · DERIVA · GCT</SectionLabel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card accent={PRO_ACCENT} variant="pro" className="group">
                <CardHeader
                  icon={TrendingUp}
                  iconColor={PRO_ACCENT}
                  title="Andamento Paces"
                  variant="pro"
                  onExpand={() => openBiomechModal('paces')}
                  subtitle="Easy · Tempo · Rapido — trend storico"
                  tooltip={{
                    title: 'ANDAMENTO PACES',
                    lines: [
                      'Easy: passo delle corse lente. Deve scendere nel tempo.',
                      'Tempo: passo soglia lattato. Indica progressi fitness.',
                      'Fast: passo delle ripetute veloci.',
                      'Scala Y invertita: valore più basso = passo più veloce.',
                    ],
                  }}
                />
                <div className="h-64 w-full">
                  {renderPacesTrendChart()}
                </div>
              </Card>

              <Card accent={PRO_ACCENT} variant="pro" className="group">
                <CardHeader
                  icon={Timer}
                  iconColor={PRO_ACCENT}
                  title="Cadenza Mensile"
                  variant="pro"
                  onExpand={() => openBiomechModal('cadence')}
                  subtitle="Passi/minuto — media mensile"
                  tooltip={{
                    title: 'CADENZA (SPM)',
                    lines: [
                      'Cadenza = passi al minuto.',
                      'Ottimale: 170-185 spm per la maggior parte dei runner.',
                      '< 160 spm: over-striding.',
                      '> 185 spm: molto efficiente.',
                      'Linea tratteggiata = 180 spm.',
                    ],
                  }}
                />
                <div className="h-64 w-full">
                  {renderCadenceMonthlyChart()}
                </div>
              </Card>
            </div>

            <StatsDrift runs={statsRuns} />

            {gctData && gctData.monthly.length > 0 && (
              <Card accent={PRO_ACCENT} variant="pro" className="group">
                <CardHeader
                  icon={Zap}
                  iconColor={PRO_ACCENT}
                  title="Tempo Contatto Suolo (GCT)"
                  variant="pro"
                  onExpand={() => openBiomechModal('gctMonthly')}
                  subtitle={`Media mensile per fascia di pace · ${gctData.summary.total_runs} corse${gctData.summary.avg_gct ? ` · GCT medio: ${gctData.summary.avg_gct} ms` : ''}`}
                  tooltip={{
                    title: 'GROUND CONTACT TIME',
                    lines: [
                      'Tempo in cui il piede resta a contatto col suolo per passo.',
                      'Elite: < 200 ms.',
                      'GCT ridotto = corsa più elastica e reattiva.',
                      'Analizzato per fascia di passo.',
                    ],
                  }}
                />
                <div className="h-72 w-full">
                  {renderGctMonthlyChart()}
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <AnalyticsV2
                vdot={vdot}
                zoneDistribution={zoneDistribution}
                gctData={gctData}
                runs={statsRuns}
                ffHistory={ffHistory}
                maxHr={dashData?.profile?.max_hr}
                thresholdPace={vdotData?.paces?.threshold}
                proCharts={biomechCharts}
                onRequestChartDetail={(chartId) => requestProChartDetail('biomechanics', chartId)}
                onlySections={['gct']}
              />
              <AnalyticsV4CadenceSpeedMatrix
                chart={biomechCharts.cadence_speed_matrix}
                onRequestDetail={() => requestProChartDetail('biomechanics', 'cadence_speed_matrix')}
              />
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            BIOLOGIA & FUTURO TAB
        ════════════════════════════════════════════════════ */}
        {activeTab === 'biology' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <Card className="xl:col-span-8" accent={PRO_ACCENT} variant="pro">
                <CardHeader
                  icon={LineChartIcon}
                  iconColor={PRO_ACCENT}
                  title="Curva Biologica"
                  subtitle="Maturazione adattamenti - prossimi 21 giorni"
                  variant="pro"
                  tooltip={{
                    title: 'SUPERCOMPENSAZIONE REALE',
                    lines: [
                      'Usa le ultime 20 corse syncate su Strava, escludendo il tapis roulant.',
                      'Ogni corsa genera uno stimolo neuromuscolare, metabolico o strutturale.',
                      'La linea readiness combina adattamento maturato e freschezza TSB quando disponibile.',
                    ],
                  }}
                />
                {biologyRuns.length > 0 && biologyProjection.length > 0 ? (
                  <div className="h-[360px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={biologyProjection} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="bio-neuro" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={PRO_ACCENT} stopOpacity={0.42} />
                            <stop offset="100%" stopColor={PRO_ACCENT} stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="bio-metabolic" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={PRO_ORANGE} stopOpacity={0.34} />
                            <stop offset="100%" stopColor={PRO_ORANGE} stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="bio-structural" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={PRO_BLUE} stopOpacity={0.30} />
                            <stop offset="100%" stopColor={PRO_BLUE} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={PRO_GRID} vertical={false} />
                        <XAxis dataKey="label" stroke="#444" fontSize={10} tickLine={false} axisLine={false} interval={2} />
                        <YAxis yAxisId="left" hide domain={[0, 100]} />
                        <YAxis yAxisId="right" hide domain={[0, 100]} />
                        <Tooltip
                          contentStyle={PRO_TOOLTIP_STYLE}
                          labelStyle={{ color: PRO_ACCENT, fontSize: 11, fontWeight: 800 }}
                          formatter={(value: any, name: string) => [`${Number(value).toFixed(1)}%`, name]}
                        />
                        <Area yAxisId="left" type="monotone" dataKey="structural" name="Strutturale" stroke={PRO_BLUE} fill="url(#bio-structural)" strokeWidth={1.5} dot={false} />
                        <Area yAxisId="left" type="monotone" dataKey="metabolic" name="Metabolico" stroke={PRO_ORANGE} fill="url(#bio-metabolic)" strokeWidth={1.5} dot={false} />
                        <Area yAxisId="left" type="monotone" dataKey="neuromuscular" name="Neuromuscolare" stroke={PRO_ACCENT} fill="url(#bio-neuro)" strokeWidth={1.5} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="readiness" name="Readiness" stroke={PRO_ACCENT} strokeWidth={3} dot={{ r: 3, fill: PRO_ACCENT, strokeWidth: 0 }} />
                        {biologyGoldenPoint && (
                          <ReferenceLine yAxisId="right" x={biologyGoldenPoint.label} stroke={PRO_ACCENT} strokeDasharray="4 4">
                            <Label value="Golden Day" position="top" fill={PRO_ACCENT} fontSize={10} fontWeight="bold" />
                          </ReferenceLine>
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[260px] flex items-center justify-center border border-dashed border-[#2A2A2A] rounded-[6px] text-center">
                    <div>
                      <div className="text-white font-black uppercase tracking-widest text-sm">Dati reali insufficienti</div>
                      <div className="text-[#666] text-xs mt-2">Servono corse Strava recenti per calcolare la curva biologica.</div>
                    </div>
                  </div>
                )}
              </Card>

              <Card className="xl:col-span-4 flex flex-col" accent={PRO_ACCENT} variant="pro">
                <div className="flex items-center gap-3 mb-6">
                  <Star className="w-5 h-5" style={{ color: PRO_ACCENT }} />
                  <div>
                    <div className="text-white font-black uppercase italic tracking-widest">Golden Day</div>
                    <div className="text-[10px] text-[#666] uppercase tracking-widest font-bold">Picco aggregato</div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="relative w-44 h-44 mb-6">
                    <svg className="w-full h-full -rotate-90">
                      <circle cx="88" cy="88" r="78" stroke="#1A1A1A" strokeWidth="8" fill="none" />
                      <circle
                        cx="88"
                        cy="88"
                        r="78"
                        stroke={PRO_ACCENT}
                        strokeWidth="8"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={490}
                        strokeDashoffset={490 * (1 - Math.max(0, Math.min(100, biologyGoldenScore ?? 0)) / 100)}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-black text-white italic">{biologyData.days_to_golden ?? '--'}</span>
                      <span className="text-[10px] text-[#666] uppercase tracking-widest font-black">giorni</span>
                    </div>
                  </div>
                  <div className="text-2xl font-black italic uppercase" style={{ color: PRO_ACCENT }}>{biologyGoldenLabel}</div>
                  <div className="text-xs text-[#777] mt-3 font-bold leading-relaxed">
                    Readiness {biologyGoldenScore != null ? `${Math.round(biologyGoldenScore)}%` : 'N/D'} con carichi reali e freschezza disponibile.
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {biologyAdaptationCards.map(({ key, label, icon: Icon, color, desc, total }) => (
                <Card key={key} accent={color} variant="pro">
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-[6px] bg-[#111] border border-[#2A2A2A]">
                        <Icon className="w-4 h-4" style={{ color }} />
                      </div>
                      <div>
                        <div className="text-sm text-white font-black uppercase italic">{label}</div>
                        <div className="text-[10px] text-[#666] font-bold uppercase tracking-widest">{desc}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-mono font-black" style={{ color }}>{total?.ready_pct ?? 0}%</div>
                      <div className="text-[9px] text-[#666] uppercase font-black">maturato</div>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-[#1A1A1A] overflow-hidden mb-4">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, total?.ready_pct ?? 0))}%`, backgroundColor: color }} />
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-[#111] border border-[#1E1E1E] rounded-[6px] p-3">
                      <div className="text-white font-mono font-black">{total?.runs ?? 0}</div>
                      <div className="text-[9px] text-[#666] uppercase font-black">corse</div>
                    </div>
                    <div className="bg-[#111] border border-[#1E1E1E] rounded-[6px] p-3">
                      <div className="text-white font-mono font-black">{total?.load ?? 0}</div>
                      <div className="text-[9px] text-[#666] uppercase font-black">carico</div>
                    </div>
                    <div className="bg-[#111] border border-[#1E1E1E] rounded-[6px] p-3">
                      <div className="text-white font-mono font-black">{total?.missing_pct ?? 0}%</div>
                      <div className="text-[9px] text-[#666] uppercase font-black">manca</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Card accent={PRO_ACCENT} variant="pro">
              <CardHeader
                icon={Briefcase}
                iconColor={PRO_ACCENT}
                title="Ultime 20 Corse Strava"
                subtitle="Adattamento generato e beneficio residuo"
                variant="pro"
                tooltip={{
                  title: 'ADATTAMENTI PER CORSA',
                  lines: [
                    'Neuromuscolare: ripetute brevi, cadenza alta, lavori veloci.',
                    'Metabolico: soglia, tempo, intervalli sostenuti e FC media alta.',
                    'Strutturale: lunghi, trail, colline, volume e durata alta.',
                  ],
                }}
              />
              {biologyRuns.length > 0 ? (
                <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
                  {biologyRuns.map((run) => {
                    const meta = biologyAdaptationCards.find((card) => card.key === run.adaptation_key);
                    const color = meta?.color ?? PRO_ACCENT;
                    const benefitDate = run.benefit_date
                      ? new Date(`${run.benefit_date}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
                      : 'N/D';
                    return (
                      <div key={`${run.id}-${run.date}`} className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center bg-[#111] border border-[#1E1E1E] rounded-[6px] p-4 hover:border-[#333] transition-colors">
                        <div className="lg:col-span-4 min-w-0">
                          <div className="text-white font-black uppercase tracking-wide truncate">{run.name || 'Corsa'}</div>
                          <div className="text-[10px] text-[#666] font-bold uppercase tracking-widest mt-1">
                            {run.date_label} - {run.distance_km.toFixed(2)} km - {run.avg_pace ?? 'N/D'}/km
                          </div>
                        </div>
                        <div className="lg:col-span-2">
                          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-[6px] border border-[#2A2A2A] bg-[#0D0D0D]">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color }}>{run.adaptation_type}</span>
                          </div>
                        </div>
                        <div className="lg:col-span-3">
                          <div className="flex justify-between text-[10px] uppercase font-black tracking-widest mb-2">
                            <span className="text-[#666]">Maturato</span>
                            <span className="text-white">{run.benefit_progress_pct}%</span>
                          </div>
                          <div className="h-2 bg-[#1A1A1A] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, run.benefit_progress_pct))}%`, backgroundColor: color }} />
                          </div>
                        </div>
                        <div className="lg:col-span-3 grid grid-cols-2 gap-3">
                          <div className="bg-[#0D0D0D] border border-[#1E1E1E] rounded-[6px] p-3">
                            <div className="text-lg font-mono font-black text-white">{run.missing_pct}%</div>
                            <div className="text-[9px] text-[#666] uppercase font-black">manca</div>
                          </div>
                          <div className="bg-[#0D0D0D] border border-[#1E1E1E] rounded-[6px] p-3">
                            <div className="text-lg font-mono font-black" style={{ color }}>{run.days_remaining}</div>
                            <div className="text-[9px] text-[#666] uppercase font-black">gg - {benefitDate}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-[#2A2A2A] rounded-[6px]">
                  <div className="text-white font-black uppercase tracking-widest">Dati reali insufficienti</div>
                  <div className="text-[#666] text-xs mt-2">Quando arrivano corse syncate su Strava, qui compariranno adattamenti e Golden Day.</div>
                </div>
              )}
            </Card>
          </div>
        )}

        {false && activeTab === 'biology' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Grafico del Futuro */}
              <Card className="lg:col-span-8" accent="#3B82F6">
                <CardHeader
                  icon={LineChartIcon}
                  iconColor="#3B82F6"
                  title="Grafico del Futuro"
                  subtitle="Proiezione CTL · ATL · TSB nei prossimi giorni"
                  tooltip={{
                    title: 'PROIEZIONE FORMA',
                    lines: [
                      'Condizione (giallo): livello di fitness corrente (CTL).',
                      'Affaticamento (rosso): accumulo di fatica (ATL).',
                      'Forma (verde): TSB = CTL − ATL. Positivo = fresco.',
                      'Il "Golden Day" è il giorno in cui TSB raggiunge il picco.',
                      'Modello Banister-Coggan con decadimento esponenziale.',
                    ],
                  }}
                />
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={futureTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#333"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis hide domain={[-50, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111',
                          border: '1px solid #1E1E1E',
                          borderRadius: '12px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="condizione"
                        stroke="#EAB308"
                        strokeWidth={2}
                        dot={false}
                        name="Condizione"
                      />
                      <Line
                        type="monotone"
                        dataKey="affaticamento"
                        stroke="#F43F5E"
                        strokeWidth={2}
                        dot={false}
                        name="Affaticamento"
                      />
                      <Line
                        type="monotone"
                        dataKey="forma"
                        stroke="#10B981"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#10B981' }}
                        name="Forma"
                      />
                      <ReferenceLine x="1/4" stroke="#EAB308" strokeDasharray="3 3">
                        <Label value="PICCO 1 Apr" position="top" fill="#EAB308" fontSize={10} fontWeight="black" />
                      </ReferenceLine>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Golden Day */}
              <Card className="lg:col-span-4 flex flex-col items-center justify-center text-center" accent="#EAB308">
                <div className="flex items-center gap-2 mb-6 self-stretch">
                  <Star className="w-5 h-5 text-[#EAB308]" />
                  <span className="text-base font-black tracking-widest uppercase italic">
                    Golden Day
                  </span>
                  <InfoTooltip
                    title="GOLDEN DAY"
                    lines={[
                      'Giorno di picco di TSB (Training Stress Balance) previsto.',
                      'Con TSB > +10 il rischio infortuni è basso e la performance è massima.',
                      'Pianifica la gara principale attorno a questa data.',
                      'Il taper (riduzione volume) deve iniziare 10–14 giorni prima.',
                    ]}
                  />
                </div>
                <div className="relative w-44 h-44 mb-6">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="88" cy="88" r="80" stroke="#1A1A1A" strokeWidth="4" fill="none" />
                    <circle
                      cx="88"
                      cy="88"
                      r="80"
                      stroke="#EAB308"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={502.65}
                      strokeDashoffset={502.65 * (1 - 0.7)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-black text-white italic">6</span>
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      Giorni
                    </span>
                  </div>
                </div>
                <h3 className="text-sm font-black text-white uppercase italic">Il tuo Golden Day</h3>
                <div className="text-2xl font-black text-[#EAB308] italic mt-1 uppercase tracking-widest">
                  Mer 1 Apr
                </div>
              </Card>
            </div>

            {/* Portafoglio Biologico + Spiegazione */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="lg:col-span-7" accent="#8B5CF6">
                <CardHeader
                  icon={Briefcase}
                  iconColor="#3B82F6"
                  title="Portafoglio Biologico"
                  subtitle="Adattamenti in corso per tipo di stimolo"
                  tooltip={{
                    title: 'PORTAFOGLIO BIOLOGICO',
                    lines: [
                      'Neuromuscolare: forza, reattività, potenza. Adattamento rapido (3–7 gg).',
                      'Metabolico: efficienza mitocondriale, soglia lattato (7–14 gg).',
                      'Strutturale: capillarizzazione, densità ossea, tendini (14–21 gg).',
                      'Concentra stimoli diversi nelle fasi corrette del piano.',
                    ],
                  }}
                />
                <div className="space-y-4">
                  {[
                    {
                      name: 'Neuromuscolare',
                      km: '0 km',
                      time: '3–7 giorni',
                      effect: 'Reattività e Potenza',
                      color: '#EAB308',
                      icon: Zap,
                    },
                    {
                      name: 'Metabolico',
                      km: '43.4 km',
                      time: '7–14 giorni',
                      effect: 'Efficienza e Soglia',
                      color: '#F43F5E',
                      icon: Activity,
                    },
                    {
                      name: 'Strutturale',
                      km: '0 km',
                      time: '14–21 giorni',
                      effect: 'Capillari e Mitocondri',
                      color: '#3B82F6',
                      icon: Dna,
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-4 bg-[#0D0D0D] border border-[#1A1A1A] rounded-2xl"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-xl bg-[#111] border border-[#1E1E1E]">
                          <item.icon className="w-4 h-4" style={{ color: item.color }} />
                        </div>
                        <div>
                          <div className="text-sm font-black text-white uppercase">{item.name}</div>
                          <div className="text-[10px] font-bold text-gray-500">{item.km}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className="text-[10px] font-black uppercase tracking-widest"
                          style={{ color: item.color }}
                        >
                          {item.time}
                        </div>
                        <div className="text-[10px] text-gray-600 font-bold italic">{item.effect}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="lg:col-span-5" accent="#C0FF00">
                <CardHeader
                  icon={FlaskConical}
                  iconColor="#10B981"
                  title="Come funziona?"
                  tooltip={{
                    title: 'SUPERCOMPENSAZIONE',
                    lines: [
                      'Allenamento = stress controllato sul corpo.',
                      'Nelle 24–72h post-sforzo il corpo si ripara e diventa più forte.',
                      'Se il prossimo allenamento avviene nel momento giusto, la performance sale.',
                      'Troppo presto: accumulo fatica. Troppo tardi: perdita adattamento.',
                    ],
                  }}
                />
                <div className="space-y-4 text-xs text-gray-500 font-medium italic leading-relaxed">
                  <p>
                    Quando ti alleni, il tuo corpo subisce uno{' '}
                    <span className="text-[#F43F5E] font-black">stress controllato</span>. Nelle ore
                    e giorni successivi, si ricostruisce{' '}
                    <span className="text-[#10B981] font-black">più forte di prima</span>.
                  </p>
                  <p>
                    Questo fenomeno si chiama{' '}
                    <span className="text-white font-black">supercompensazione</span>. I cambiamenti
                    strutturali richiedono dai{' '}
                    <span className="text-[#3B82F6] font-black">10 ai 21 giorni</span> per
                    manifestarsi come performance misurabile in gara.
                  </p>
                  <p>
                    Il <span className="text-[#EAB308] font-black">Golden Day</span> è calcolato
                    proiettando il modello Banister-Coggan in avanti, identificando il giorno in cui
                    TSB raggiunge il suo valore più alto.
                  </p>
                </div>
              </Card>
            </div>

          </div>
        )}

        {/* ════════════════════════════════════════════════════
            BADGES TAB
        ════════════════════════════════════════════════════ */}
        {activeTab === 'badges' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <BadgesGrid
              runs={runs}
              vdot={vdot ?? 0}
              vdotPeak={vdot ? vdot + 2 : 0}
              vdotDelta={0}
            />
          </div>
        )}

        <ChartFullscreenModal
          open={expandedChart === 'paces'}
          onClose={() => setExpandedChart(null)}
          title="Andamento Paces"
          subtitle="Easy · Tempo · Rapido — trend storico"
          accent={PRO_ACCENT}
          details={
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[9px] text-gray-500 font-black tracking-widest uppercase">Easy</p>
                <p className="text-sm text-gray-300 font-bold mt-1">Passo lento, scala Y invertita</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[9px] text-gray-500 font-black tracking-widest uppercase">Tempo</p>
                <p className="text-sm text-gray-300 font-bold mt-1">Indicatore soglia lattato</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[9px] text-gray-500 font-black tracking-widest uppercase">Fast</p>
                <p className="text-sm text-gray-300 font-bold mt-1">Ripetute e lavoro veloce</p>
              </div>
            </div>
          }
        >
          {renderPacesTrendChart(true)}
        </ChartFullscreenModal>

        <ChartFullscreenModal
          open={expandedChart === 'cadence'}
          onClose={() => setExpandedChart(null)}
          title="Cadenza Mensile"
          subtitle="Passi/minuto — media mensile"
          accent={PRO_ACCENT}
          details={
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[9px] text-gray-500 font-black tracking-widest uppercase">Target</p>
                <p className="text-xl text-white font-black mt-1">170-185 <span className="text-xs text-gray-500">spm</span></p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[9px] text-gray-500 font-black tracking-widest uppercase">Reference</p>
                <p className="text-xl text-white font-black mt-1">180 <span className="text-xs text-gray-500">spm</span></p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[9px] text-gray-500 font-black tracking-widest uppercase">Focus</p>
                <p className="text-sm text-gray-300 font-bold mt-1">Stabilita e riduzione over-striding</p>
              </div>
            </div>
          }
        >
          {renderCadenceMonthlyChart(true)}
        </ChartFullscreenModal>

        <ChartFullscreenModal
          open={expandedChart === 'gctMonthly'}
          onClose={() => setExpandedChart(null)}
          title="Tempo Contatto Suolo (GCT)"
          subtitle={gctData ? `Media mensile per fascia di pace · ${gctData.summary.total_runs} corse${gctData.summary.avg_gct ? ` · GCT medio: ${gctData.summary.avg_gct} ms` : ''}` : 'Media mensile per fascia di pace'}
          accent={PRO_ACCENT}
          details={
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[9px] text-gray-500 font-black tracking-widest uppercase">Lento</p>
                <p className="text-sm text-gray-300 font-bold mt-1">&gt;= 5:30/km</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[9px] text-gray-500 font-black tracking-widest uppercase">Medio</p>
                <p className="text-sm text-gray-300 font-bold mt-1">5:00-5:29/km</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[9px] text-gray-500 font-black tracking-widest uppercase">Veloce</p>
                <p className="text-sm text-gray-300 font-bold mt-1">&lt; 4:45/km</p>
              </div>
            </div>
          }
        >
          {renderGctMonthlyChart(true)}
        </ChartFullscreenModal>

      </div>
    </div>
  );
}
