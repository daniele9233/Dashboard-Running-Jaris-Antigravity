import React, { useState, useRef } from 'react';
import type { LucideIcon } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { StatsDrift } from './StatsDrift';
import { ScrollRow } from '../ScrollRow';
import { AnalyticsV2 } from './AnalyticsV2';
import { AnalyticsV3 } from './AnalyticsV3';
import { BiologyFutureV2 } from './BiologyFutureV2';
import { PotentialProgressV3 } from './PotentialProgressV3';
import { BiologyFutureV3 } from './BiologyFutureV3';
import { BiologyFutureLab } from './BiologyFutureLab';
import { EnvironmentalNormalizerView } from './EnvironmentalNormalizerView';
import { PaceCalculator } from './PaceCalculator';
import { AnalyticsV4CadenceSpeedMatrix } from "./AnalyticsV4";
import { CaricoFormaV2 } from './CaricoFormaV2';
import { ChartExpandButton, ChartFullscreenModal } from './ChartFullscreenModal';
import { useApi } from '../../hooks/useApi';
import { API_CACHE } from '../../hooks/apiCacheKeys';
import { getAnalytics, getVdotPaces, getRuns, getGctAnalysis, getDashboard, getProAnalytics, linkGarminCsv, getSupercompensation, getProfile, type GctAnalysisResponse } from '../../api';
import { cadenceSpmFromRun } from '../../utils/cadence';
import type {
  AnalyticsResponse,
  VdotPacesResponse,
  RunsResponse,
  DashboardResponse,
  ProAnalyticsResponse,
  ProAnalyticsChart,
  GarminCsvLinkResult,
  Profile,
  Run,
  SupercompensationResponse,
  SupercompensationRun,
  SupercompensationProjectionPoint,
  AdaptationKey,
  AdaptationType,
} from '../../types/api';
import { Activity, Zap, TrendingUp, BarChart3, Dna, FlaskConical, Timer, LineChart as LineChartIcon, Star, Briefcase, Info, Radar, CloudSun, Calculator, Sparkles, Microscope } from "lucide-react";
import { Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ComposedChart, Line, LineChart, ReferenceLine, Label, Legend } from "recharts";

import { CHART_SERIES, CHART_SURFACE, ChartCard, ChartHeader, ChartPlot, ChartTip, chartGrid, chartMargin, chartXAxis, chartYAxis } from "../charts";

// Alias sul tema condiviso (chartTheme.ts): un'unica fonte di verità.
const PRO_ACCENT = CHART_SERIES.primary;
const PRO_PANEL = CHART_SURFACE.panel;
const PRO_BORDER = CHART_SURFACE.border;
const PRO_BLUE = CHART_SERIES.projected;
const PRO_PURPLE = CHART_SERIES.tertiary;
const PRO_RED = CHART_SERIES.risk;
const PRO_ORANGE = CHART_SERIES.load;
const PRO_ZONE_COLORS = ['#4A4A4A', '#6366F1', '#8B5CF6', '#A78BFA', PRO_ACCENT];

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
        className="text-ea-text-axis hover:text-ea-text-axis transition-colors focus:outline-none"
      >
        <Info size={14} />
      </button>
      {open && (
        <div className="absolute z-50 top-full right-0 mt-2 w-72 bg-ea-surface-1 border border-ea-hairline rounded-2xl p-4 shadow-2xl pointer-events-none">
          <div className="text-ea-lime text-xs font-black tracking-widest mb-2">{title}</div>
          <ul className="space-y-1.5">
            {lines.map((l, i) => (
              <li key={i} className="text-ea-text-axis text-xs leading-relaxed flex gap-1.5">
                <span className="text-ea-text-axis shrink-0">·</span>{l}
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
}: {
  children: React.ReactNode;
  className?: string;
  /** Mantenuti per compatibilità con i chiamanti: il filo colorato e le varianti non fanno più parte del sistema. */
  accent?: string;
  variant?: 'default' | 'pro';
}) {
  return <ChartCard className={className}>{children}</ChartCard>;
}

// ─────────────────────────────────────────────────────────────
// CARD HEADER
// ─────────────────────────────────────────────────────────────
function CardHeader({
  icon: Icon,
  title,
  subtitle,
  tooltip,
  onExpand,
}: {
  icon: LucideIcon;
  iconColor?: string;
  title: string;
  subtitle?: string;
  tooltip?: { title: string; lines: string[] };
  onExpand?: () => void;
  variant?: 'default' | 'pro';
}) {
  return (
    <ChartHeader
      icon={<Icon className="w-4 h-4" />}
      title={title}
      description={subtitle}
      as="h2"
      actions={
        <>
          {onExpand && <ChartExpandButton onClick={onExpand} />}
          {tooltip && <InfoTooltip title={tooltip.title} lines={tooltip.lines} />}
        </>
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION LABEL
// ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs text-ea-text-axis font-black tracking-[0.3em] uppercase pt-2">{children}</div>
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
  const cadence = Number(cadenceSpmFromRun(run) ?? 0);
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
    { zone: 'Z1', name: 'Recupero', minSec: 390, color: CHART_SERIES.compare, runs: 0, km: 0 },
    { zone: 'Z2', name: 'Easy', minSec: 360, color: CHART_SERIES.positive, runs: 0, km: 0 },
    { zone: 'Z3', name: 'Steady', minSec: 330, color: '#A3E635', runs: 0, km: 0 },
    { zone: 'Z4', name: 'Threshold', minSec: 300, color: CHART_SERIES.load, runs: 0, km: 0 },
    { zone: 'Z5', name: 'Fast', minSec: 0, color: CHART_SERIES.risk, runs: 0, km: 0 },
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
  const [activeTab, setActiveTab] = useState('analytics-cf-v2');
  const [expandedChart, setExpandedChart] = useState<null | 'paces' | 'cadence' | 'gctMonthly'>(null);
  const [proSections, setProSections] = useState<ProAnalyticsResponse['sections']>({});
  const [proError, setProError] = useState<string | null>(null);
  const detailRequestsRef = useRef<Set<string>>(new Set());
  const { data: analyticsData } = useApi<AnalyticsResponse>(getAnalytics, { cacheKey: API_CACHE.ANALYTICS });
  const { data: vdotData } = useApi<VdotPacesResponse>(getVdotPaces, { cacheKey: API_CACHE.VDOT_PACES });
  const { data: runsData } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const { data: gctData } = useApi<GctAnalysisResponse>(getGctAnalysis, { cacheKey: API_CACHE.GCT_ANALYSIS });
  const { data: dashData } = useApi<DashboardResponse>(getDashboard, { cacheKey: API_CACHE.DASHBOARD });
  const { data: superData } = useApi<SupercompensationResponse>(getSupercompensation, { cacheKey: API_CACHE.SUPERCOMPENSATION });
  const { data: profileData } = useApi<Profile>(getProfile, { cacheKey: API_CACHE.PROFILE });
  const [openLoadWidgetMenu, setOpenLoadWidgetMenu] = useState(false);
  const loadWidgetMenuRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!openLoadWidgetMenu) return;
    const onClick = (event: MouseEvent) => {
      if (loadWidgetMenuRef.current && !loadWidgetMenuRef.current.contains(event.target as Node)) {
        setOpenLoadWidgetMenu(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [openLoadWidgetMenu]);

  type ProTab = 'load_form' | 'potential_progress' | 'biomechanics';
  const activeProTab = React.useMemo<ProTab | null>(() => {
    if (activeTab === 'analytics-cf-v2') return 'load_form';
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
  // km charts include treadmill runs (distance counts, but treadmill excluded from analytics)
  const kmRuns = React.useMemo(
    () => runs.filter((r) => (r.distance_km ?? 0) > 0),
    [runs]
  );
  const fallbackCharts = React.useMemo(() => buildClientAnalyticsFallbacks(statsRuns), [statsRuns]);
  const vdot = vdotData?.vdot ?? null;
  const level = vdot ? vdotLevel(vdot, t) : null;
  const racePredictions = vdotData?.race_predictions ?? analyticsData?.race_predictions ?? {};
  const zoneDistribution = analyticsData?.zone_distribution ?? [];
  const ffHistory = dashData?.fitness_freshness ?? [];
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


  const tabs = [
    { id: 'analytics-cf-v2', label: t('statsTabs.loadForm'),          icon: BarChart3  },
    { id: 'analyticsv2',    label: t('statsTabs.potentialProgress'),  icon: Radar },
    { id: 'potential-v3',   label: t('statsTabs.potentialV2'),        icon: Sparkles },
    { id: 'analyticsv3', label: t('statsTabs.biomechanics'),          icon: Activity },
    { id: 'biology',     label: t('statsTabs.biologyFuture'),         icon: FlaskConical },
    { id: 'environment', label: t('statsTabs.climatePace'),           icon: CloudSun },
    { id: 'biologyv2',   label: t('statsTabs.detraining'),            icon: Dna },
    { id: 'biology-v3',  label: t('statsTabs.biologyV2'),             icon: Microscope },
    { id: 'pace-calc',   label: 'Calcolatore',                       icon: Calculator },
  ];

  const noData = (message = t('statsTabs.insufficientData')) => (
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
          <CartesianGrid {...chartGrid} />
          <XAxis {...chartXAxis} dataKey="date" />
          <YAxis {...chartYAxis} hide width={0} domain={['dataMin - 0.15', 'dataMax + 0.15']} reversed />
          <ChartTip formatter={(value: any) => {
              const sec = Math.round(Number(value) * 60);
              return [`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} /km`, 'Passo medio'];
            }} />
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
          <CartesianGrid {...chartGrid} />
          <XAxis {...chartXAxis} dataKey="date" />
          <YAxis {...chartYAxis} domain={['dataMin - 5', 'dataMax + 5']} />
          <ChartTip formatter={(v: any) => [`${Number(v).toFixed(0)} spm`, 'Cadenza']} />
          <ReferenceLine y={180} stroke={CHART_SURFACE.borderStrong} strokeDasharray="5 5" />
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
        <CartesianGrid {...chartGrid} />
        <XAxis {...chartXAxis} dataKey="date" interval="preserveStartEnd" minTickGap={22} tickFormatter={formatGctMonth} />
        <YAxis {...chartYAxis} domain={['dataMin - 10', 'dataMax + 10']} tickFormatter={(v) => `${v}ms`} />
        <ChartTip formatter={(value: any, name: string) => {
            if (value === null || value === undefined) return ['N/D', ''];
            return [`${value} ms`, formatGctZone(name)];
          }} />
        <Legend
          formatter={formatGctZone}
          wrapperStyle={{ fontSize: '11px', fontWeight: 700 }}
        />
        <Line type="monotone" dataKey="pace_530" stroke={PRO_BLUE} strokeWidth={2} dot={{ r: 4, fill: PRO_BLUE }} connectNulls />
        <Line type="monotone" dataKey="pace_500" stroke={PRO_PURPLE} strokeWidth={2} dot={{ r: 4, fill: PRO_PURPLE }} connectNulls />
        <Line type="monotone" dataKey="pace_445" stroke={PRO_ACCENT} strokeWidth={2} dot={{ r: 4, fill: PRO_ACCENT }} connectNulls />
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
    <div className="flex-1 overflow-y-auto bg-ea-ink text-white p-4 md:p-6 lg:p-10">
      <div className="max-w-[1800px] mx-auto space-y-6 md:space-y-8">

        {/* ── HEADER ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-8">
          <div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter text-white uppercase">
              Elite <span className="text-ea-lime">Analytics</span>
            </h1>
            <p className="text-gray-600 text-xs font-black tracking-[0.3em] uppercase mt-2">
              Engineered for peak human performance
            </p>
          </div>

          {/* nove sezioni non stanno in una riga: le frecce ai lati la fanno scorrere */}
          <ScrollRow
            className="bg-ea-surface-1 rounded-2xl border border-ea-hairline shadow-2xl -mx-4 md:mx-0"
            innerClassName="flex items-center whitespace-nowrap p-1.5"
            fade="#0D0D0D"
            activeKey={activeTab}
            label="Sezioni delle statistiche"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                data-scroll-key={tab.id}
                aria-pressed={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 md:px-6 py-3 rounded-xl text-xs font-black transition-all tracking-widest shrink-0 min-h-[44px] ${
                  activeTab === tab.id
                    ? 'bg-ea-surface-3 text-white shadow-lg border border-ea-hairline-strong'
                    : 'text-gray-600 hover:text-gray-300'
                }`}
              >
                <tab.icon
                  className={`w-4 h-4 ${activeTab === tab.id ? 'text-ea-lime' : ''}`}
                />
                {tab.label.toUpperCase()}
              </button>
            ))}
          </ScrollRow>
        </div>

        {proError && ['analytics', 'analyticsv2', 'analyticsv3'].includes(activeTab) && (
          <div className="rounded-xl border border-[#ff5b00]/40 bg-ea-amber/10 px-5 py-4 text-sm text-[#ffb38a]">
            Backend analytics non disponibile: {proError}. Verifica che Render stia servendo il backend aggiornato e che /api/analytics/pro risponda 200.
          </div>
        )}


        {/* ════════════════════════════════════════════════════
            CARICO & FORMA V2
        ════════════════════════════════════════════════════ */}
        {activeTab === 'analytics-cf-v2' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <CaricoFormaV2
              ffHistory={ffHistory}
              kmRuns={kmRuns}
              paceDistributionChart={loadCharts.pace_distribution}
              effortMatrixChart={loadCharts.effort_matrix}
            />
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
              racePredictions={racePredictions}
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
                  subtitle="Passi/minuto a ritmo — giri delle ripetute e km sotto 4:45"
                  tooltip={{
                    title: 'CADENZA A RITMO (SPM)',
                    lines: [
                      'Cadenza = passi al minuto, letta solo quando vai forte.',
                      'Ripetute: la cadenza dentro ogni giro di lavoro, dagli streams.',
                      'Corse continue: i chilometri sotto 4:45/km.',
                      'A ritmo gara: 180-190 spm è la finestra buona.',
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
            (Supercompensazione legacy + Detraining Lab Coyle/Mujika)
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
                  <ChartPlot size="hero">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={biologyProjection} margin={chartMargin}>
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
                        <CartesianGrid {...chartGrid} />
                        <XAxis {...chartXAxis} dataKey="label" interval={2} padding={{ left: 20, right: 12 }} />
                        <YAxis {...chartYAxis} yAxisId="left" hide width={0} domain={[0, 100]} />
                        <YAxis {...chartYAxis} yAxisId="right" hide width={0} domain={[0, 100]} />
                        <ChartTip formatter={(value: any, name: string) => [`${Number(value).toFixed(1)}%`, name]} />
                        <Area yAxisId="left" type="monotone" dataKey="structural" name="Strutturale" stroke={PRO_BLUE} fill="url(#bio-structural)" strokeWidth={1.5} dot={false} />
                        <Area yAxisId="left" type="monotone" dataKey="metabolic" name="Metabolico" stroke={PRO_ORANGE} fill="url(#bio-metabolic)" strokeWidth={1.5} dot={false} />
                        <Area yAxisId="left" type="monotone" dataKey="neuromuscular" name="Neuromuscolare" stroke={PRO_ACCENT} fill="url(#bio-neuro)" strokeWidth={1.5} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="readiness" name="Readiness" stroke={PRO_ACCENT} strokeWidth={3} dot={{ r: 3, fill: PRO_ACCENT, strokeWidth: 0 }} />
                        {biologyGoldenPoint && (
                          <ReferenceLine yAxisId="right" x={biologyGoldenPoint.label} stroke={PRO_ACCENT} strokeDasharray="4 4">
                            <Label value="Golden Day" position="top" fill={PRO_ACCENT} fontSize={12} fontWeight="bold" />
                          </ReferenceLine>
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ChartPlot>
                ) : (
                  <div className="h-[260px] flex items-center justify-center border border-dashed border-ea-hairline-strong rounded-[6px] text-center">
                    <div>
                      <div className="text-white font-black uppercase tracking-widest text-sm">Dati reali insufficienti</div>
                      <div className="text-ea-text-axis text-xs mt-2">Servono corse Strava recenti per calcolare la curva biologica.</div>
                    </div>
                  </div>
                )}
              </Card>

              <Card className="xl:col-span-4 flex flex-col" accent={PRO_ACCENT} variant="pro">
                <div className="flex items-center gap-3 mb-6">
                  <Star className="w-5 h-5" style={{ color: PRO_ACCENT }} />
                  <div>
                    <div className="text-white font-black uppercase tracking-widest">Golden Day</div>
                    <div className="text-xs text-ea-text-axis uppercase tracking-widest font-bold">Picco aggregato</div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="relative w-44 h-44 mb-6">
                    <svg className="w-full h-full -rotate-90">
                      <circle cx="88" cy="88" r="78" stroke={CHART_SURFACE.raised} strokeWidth="8" fill="none" />
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
                      <span className="text-5xl font-black text-white">{biologyData.days_to_golden ?? '--'}</span>
                      <span className="text-xs text-ea-text-axis uppercase tracking-widest font-black">giorni</span>
                    </div>
                  </div>
                  <div className="text-2xl font-black uppercase" style={{ color: PRO_ACCENT }}>{biologyGoldenLabel}</div>
                  <div className="text-xs text-ea-text-axis mt-3 font-bold leading-relaxed">
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
                      <div className="p-2 rounded-[6px] bg-ea-surface-2 border border-ea-hairline-strong">
                        <Icon className="w-4 h-4" style={{ color }} />
                      </div>
                      <div>
                        <div className="text-sm text-white font-black uppercase">{label}</div>
                        <div className="text-xs text-ea-text-axis font-bold uppercase tracking-widest">{desc}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-mono font-black" style={{ color }}>{total?.ready_pct ?? 0}%</div>
                      <div className="text-xs text-ea-text-axis uppercase font-black">maturato</div>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-ea-surface-3 overflow-hidden mb-4">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, total?.ready_pct ?? 0))}%`, backgroundColor: color }} />
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg border border-ea-hairline bg-ea-surface-2 p-3">
                      <div className="text-white font-mono font-black">{total?.runs ?? 0}</div>
                      <div className="text-xs text-ea-text-axis uppercase font-black">corse</div>
                    </div>
                    <div className="rounded-lg border border-ea-hairline bg-ea-surface-2 p-3">
                      <div className="text-white font-mono font-black">{total?.load ?? 0}</div>
                      <div className="text-xs text-ea-text-axis uppercase font-black">carico</div>
                    </div>
                    <div className="rounded-lg border border-ea-hairline bg-ea-surface-2 p-3">
                      <div className="text-white font-mono font-black">{total?.missing_pct ?? 0}%</div>
                      <div className="text-xs text-ea-text-axis uppercase font-black">manca</div>
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
                      <div key={`${run.id}-${run.date}`} className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center rounded-lg border border-ea-hairline bg-ea-surface-2 p-4 hover:border-white/[0.2] transition-colors">
                        <div className="lg:col-span-4 min-w-0">
                          <div className="text-white font-black uppercase tracking-wide truncate">{run.name || 'Corsa'}</div>
                          <div className="text-xs text-ea-text-axis font-bold uppercase tracking-widest mt-1">
                            {run.date_label} - {run.distance_km.toFixed(2)} km - {run.avg_pace ?? 'N/D'}/km
                          </div>
                        </div>
                        <div className="lg:col-span-2">
                          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-[6px] border border-ea-hairline-strong bg-ea-surface-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-xs font-black uppercase tracking-widest" style={{ color }}>{run.adaptation_type}</span>
                          </div>
                        </div>
                        <div className="lg:col-span-3">
                          <div className="flex justify-between text-xs uppercase font-black tracking-widest mb-2">
                            <span className="text-ea-text-axis">Maturato</span>
                            <span className="text-white">{run.benefit_progress_pct}%</span>
                          </div>
                          <div className="h-2 bg-ea-surface-3 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, run.benefit_progress_pct))}%`, backgroundColor: color }} />
                          </div>
                        </div>
                        <div className="lg:col-span-3 grid grid-cols-2 gap-3">
                          <div className="rounded-lg border border-ea-hairline bg-ea-surface-2 p-3">
                            <div className="text-lg font-mono font-black text-white">{run.missing_pct}%</div>
                            <div className="text-xs text-ea-text-axis uppercase font-black">manca</div>
                          </div>
                          <div className="rounded-lg border border-ea-hairline bg-ea-surface-2 p-3">
                            <div className="text-lg font-mono font-black" style={{ color }}>{run.days_remaining}</div>
                            <div className="text-xs text-ea-text-axis uppercase font-black">gg - {benefitDate}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-ea-hairline-strong rounded-[6px]">
                  <div className="text-white font-black uppercase tracking-widest">Dati reali insufficienti</div>
                  <div className="text-ea-text-axis text-xs mt-2">Quando arrivano corse syncate su Strava, qui compariranno adattamenti e Golden Day.</div>
                </div>
              )}
            </Card>

          </div>
        )}

        {activeTab === 'environment' && (
          <EnvironmentalNormalizerView runs={statsRuns} />
        )}


        {/* ════════════════════════════════════════════════════
            BADGES TAB
        ════════════════════════════════════════════════════ */}
        {activeTab === 'biologyv2' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <BiologyFutureV2 data={biologyData} profile={profileData ?? null} runs={runs} vdot={vdot} />
            <BiologyFutureLab profile={profileData ?? null} runs={runs} vdot={vdot} />
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            POTENZIALE & PROGRESSI V2 — sezione nuova, motore physio
        ════════════════════════════════════════════════════ */}
        {activeTab === 'potential-v3' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <PotentialProgressV3 runs={runs} />
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            BIOLOGIA & FUTURO V2 — sezione nuova
        ════════════════════════════════════════════════════ */}
        {activeTab === 'biology-v3' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <BiologyFutureV3 runs={runs} profile={profileData ?? null} />
          </div>
        )}

        {/* ═══ CALCOLATORE PASSO ═══ */}
        {activeTab === 'pace-calc' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <PaceCalculator vdot={vdot} />
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
              <div className="rounded-xl border border-ea-hairline bg-white/[0.02] p-3">
                <p className="text-xs text-gray-500 font-black tracking-widest uppercase">Easy</p>
                <p className="text-sm text-gray-300 font-bold mt-1">Passo lento, scala Y invertita</p>
              </div>
              <div className="rounded-xl border border-ea-hairline bg-white/[0.02] p-3">
                <p className="text-xs text-gray-500 font-black tracking-widest uppercase">Tempo</p>
                <p className="text-sm text-gray-300 font-bold mt-1">Indicatore soglia lattato</p>
              </div>
              <div className="rounded-xl border border-ea-hairline bg-white/[0.02] p-3">
                <p className="text-xs text-gray-500 font-black tracking-widest uppercase">Fast</p>
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
              <div className="rounded-xl border border-ea-hairline bg-white/[0.02] p-3">
                <p className="text-xs text-gray-500 font-black tracking-widest uppercase">Target</p>
                <p className="text-xl text-white font-black mt-1">170-185 <span className="text-xs text-gray-500">spm</span></p>
              </div>
              <div className="rounded-xl border border-ea-hairline bg-white/[0.02] p-3">
                <p className="text-xs text-gray-500 font-black tracking-widest uppercase">Reference</p>
                <p className="text-xl text-white font-black mt-1">180 <span className="text-xs text-gray-500">spm</span></p>
              </div>
              <div className="rounded-xl border border-ea-hairline bg-white/[0.02] p-3">
                <p className="text-xs text-gray-500 font-black tracking-widest uppercase">Focus</p>
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
              <div className="rounded-xl border border-ea-hairline bg-white/[0.02] p-3">
                <p className="text-xs text-gray-500 font-black tracking-widest uppercase">Lento</p>
                <p className="text-sm text-gray-300 font-bold mt-1">&gt;= 5:30/km</p>
              </div>
              <div className="rounded-xl border border-ea-hairline bg-white/[0.02] p-3">
                <p className="text-xs text-gray-500 font-black tracking-widest uppercase">Medio</p>
                <p className="text-sm text-gray-300 font-bold mt-1">5:00-5:29/km</p>
              </div>
              <div className="rounded-xl border border-ea-hairline bg-white/[0.02] p-3">
                <p className="text-xs text-gray-500 font-black tracking-widest uppercase">Veloce</p>
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
