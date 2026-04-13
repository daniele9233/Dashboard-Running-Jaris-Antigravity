import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wind, TrendingDown, Activity, Target, Timer, Zap, Flame, Shield, Trophy,
} from "lucide-react";
import { LastRunMap } from "./LastRunMap";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useApi } from "../hooks/useApi";
import { getDashboard, getRuns, getAnalytics, getBestEfforts } from "../api";
import type { DashboardResponse, RunsResponse, AnalyticsResponse, Run, BestEffort } from "../types/api";

function fmtPbTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.round((minutes * 60) % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}
function bestPbTime(runs: Run[], minKm: number, maxKm: number, targetKm: number): string {
  const c = runs.filter(r =>
    !r.is_treadmill &&
    r.distance_km >= minKm &&
    r.distance_km <= maxKm &&
    r.duration_minutes > 0
  );
  if (!c.length) return '—';
  // Find best pace run, then project to exact target distance
  const best = c.reduce((b, r) => {
    const pace = r.duration_minutes / r.distance_km;
    return pace < b.duration_minutes / b.distance_km ? r : b;
  });
  const projectedMin = (best.duration_minutes / best.distance_km) * targetKm;
  return fmtPbTime(projectedMin);
}

function timeUntil(dateStr: string): { days: number; hours: number; minutes: number } | null {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return { days, hours, minutes };
}

function parsePaceToSecs(pace: string): number {
  if (!pace) return 0;
  const parts = pace.split(":");
  if (parts.length !== 2) return 0;
  const m = parseInt(parts[0]);
  const s = parseInt(parts[1]);
  if (isNaN(m) || isNaN(s)) return 0;
  return m * 60 + s;
}

function secsToPaceStr(secs: number): string {
  if (secs <= 0) return "--";
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Next Optimal Session Widget ─────────────────────────────────────────────
function NextOptimalSessionWidget({
  tsb, atl, ctl, runs, faticaColor,
}: {
  tsb: number | null;
  atl: number;
  ctl: number;
  runs: Run[];
  faticaColor: string;
}) {
  const { hoursUntil, pct, recommendation, readyAt } = useMemo(() => {
    const gpsRuns = runs.filter(r => !r.is_treadmill);
    const lastRun = gpsRuns[0] ?? null;

    // Hours elapsed since last run
    const hoursElapsed = lastRun
      ? (Date.now() - new Date(lastRun.date + 'T12:00:00').getTime()) / 3600000
      : 9999;

    // Minimum recovery based on last run intensity
    let minRecoveryHours = 24;
    if (lastRun) {
      const hrPct = lastRun.avg_hr_pct != null
        ? (lastRun.avg_hr_pct > 1 ? lastRun.avg_hr_pct / 100 : lastRun.avg_hr_pct)
        : 0.72;
      const isHard = ['intervals', 'ripetute', 'tempo', 'soglia'].includes(
        (lastRun.run_type ?? '').toLowerCase()
      );
      const isLong = lastRun.distance_km > 18;

      if (isHard || hrPct > 0.88) {
        minRecoveryHours = isLong ? 72 : 48;
      } else if (hrPct > 0.78 || lastRun.distance_km > 12) {
        minRecoveryHours = 36;
      } else {
        minRecoveryHours = 24;
      }
    }

    // Also compute ATL-based model as secondary signal
    let atlHours = 0;
    if (tsb !== null && atl > 0 && ctl > 0) {
      const targetAtl = ctl + 5;
      if (atl > targetAtl) {
        atlHours = Math.round(7 * Math.log(atl / targetAtl) * 24);
      }
    }

    // Take the larger of the two models (conservative)
    const remainingFromLastRun = Math.max(0, minRecoveryHours - hoursElapsed);
    const totalRemaining = Math.max(remainingFromLastRun, atlHours > 0 ? Math.min(atlHours, remainingFromLastRun + 12) : 0);
    const hoursUntil = Math.round(totalRemaining);

    // Recovery pct
    const pct = minRecoveryHours > 0
      ? Math.max(0, Math.min(1, hoursElapsed / minRecoveryHours))
      : 1;

    // Ready-at timestamp
    const readyAt = hoursUntil > 0
      ? new Date(Date.now() + hoursUntil * 3600000)
      : null;

    const recommendation = (atl > 70 || (tsb !== null && tsb < -20))
      ? 'easy'
      : (atl > 40 || (tsb !== null && tsb < -5))
      ? 'moderate'
      : 'hard';

    return {
      hoursUntil,
      pct,
      recommendation: recommendation as 'easy' | 'moderate' | 'hard',
      readyAt,
    };
  }, [tsb, atl, ctl, runs]);

  const isReady = hoursUntil === 0;
  const h = Math.floor(hoursUntil);
  const arcColor = faticaColor;
  const circ = 2 * Math.PI * 38;
  const offset = circ * (1 - pct);

  const readyAtLabel = readyAt
    ? readyAt.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })
      + ' ' + readyAt.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null;

  const recLabel = recommendation === 'hard'
    ? 'HARD SESSION' : recommendation === 'moderate'
    ? 'MODERATE SESSION' : 'EASY / RECOVERY';
  const recColor = recommendation === 'hard'
    ? '#C0FF00' : recommendation === 'moderate'
    ? '#F59E0B' : '#60A5FA';

  return (
    <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Timer style={{ color: faticaColor }} size={13} />
        <span className="text-[#A0A0A0] text-[9px] font-black tracking-widest uppercase">Next Optimal Session</span>
      </div>

      <div className="flex items-center gap-5 flex-1">
        {/* Arc timer */}
        <div className="relative w-[90px] h-[90px] shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="38" stroke="#2a2a2a" strokeWidth="7" fill="none" />
            <circle
              cx="50" cy="50" r="38"
              stroke={arcColor}
              strokeWidth="7"
              fill="none"
              strokeDasharray={`${circ}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${arcColor}88)` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isReady ? (
              <span className="text-[#C0FF00] text-xs font-black">NOW</span>
            ) : (
              <>
                <span className="text-white font-black font-mono text-lg leading-none">
                  {String(h).padStart(2, '0')}h
                </span>
                <span className="text-[#666] text-[8px] font-black mt-0.5">LEFT</span>
              </>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Shield size={11} className="text-orange-400 shrink-0" />
            <span className="text-orange-400 text-[9px] font-black tracking-widest uppercase">Injury Prevention Buffer</span>
          </div>
          <div className="text-white text-xs font-black mb-1">
            {isReady ? "Ready to train" : readyAtLabel ? `Ready by ${readyAtLabel}` : `~${h}h remaining`}
          </div>
          <div className="text-[#666] text-[9px] leading-relaxed">
            {isReady
              ? <>Recommended: <span style={{ color: recColor }} className="font-black">{recLabel}</span></>
              : `Recovery in progress. Reduce injury risk — wait for full recovery.`}
          </div>
          {/* Recovery bar */}
          <div className="mt-2 h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.round(pct * 100)}%`, backgroundColor: arcColor }}
            />
          </div>
          <div className="text-[#555] text-[8px] mt-0.5">{Math.round(pct * 100)}% recovered</div>
        </div>
      </div>
    </div>
  );
}

export function DashboardView() {
  const { data: dashData, loading: dashLoading, error: dashError } =
    useApi<DashboardResponse>(getDashboard);
  const { data: runsData } = useApi<RunsResponse>(getRuns);
  const { data: analyticsData } = useApi<AnalyticsResponse>(getAnalytics);
  const { data: effortsData } = useApi<{ efforts: BestEffort[] }>(getBestEfforts);

  const navigate = useNavigate();
  const [chartPeriod, setChartPeriod] = useState<'7d' | 'month' | 'year'>('year');
  const runs = runsData?.runs ?? [];
  const vdot = analyticsData?.vdot ?? null;

  const ff = dashData?.current_ff ?? null;
  const tsb = ff?.tsb ?? null;
  const ctl = ff?.ctl ?? 0;
  const atl = ff?.atl ?? 0;

  // Fatigue color — shared across Status of Form, Fatigue card, Next Optimal Session
  // Red when ATL > 50 (high fatigue), amber 30-50, green < 30
  const faticaColor = atl > 50 ? "#F43F5E" : atl > 30 ? "#F59E0B" : "#C0FF00";
  const faticaLabel = atl > 50 ? "HIGH" : atl > 30 ? "MODERATE" : "LOW";

  const readiness = tsb !== null ? Math.max(0, Math.min(100, 50 + tsb * 3)) : null;
  const gaugeOffset = readiness !== null ? 251.2 * (1 - readiness / 100) : 251.2;

  const status =
    tsb === null
      ? { label: "—" }
      : tsb > 10
      ? { label: "FRESH" }
      : tsb > -5
      ? { label: "NEUTRAL" }
      : tsb > -20
      ? { label: "FATIGUED" }
      : { label: "OVERLOADED" };

  const chartData = useMemo(() => {
    const toLocal = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (chartPeriod === '7d') {
      const now = new Date();
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now);
        d.setDate(now.getDate() - (6 - i));
        const ds = toLocal(d);
        const km = runs.filter(r => r.date.slice(0,10) === ds).reduce((s, r) => s + r.distance_km, 0);
        const label = d.toLocaleDateString('en', { weekday: 'short' }).slice(0,3).toUpperCase();
        return { day: label, km: Math.round(km*10)/10 };
      });
    } else if (chartPeriod === 'month') {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const days = new Date(year, month+1, 0).getDate();
      return Array.from({ length: days }, (_, i) => {
        const day = i + 1;
        const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const km = runs.filter(r => r.date.slice(0,10) === ds).reduce((s, r) => s + r.distance_km, 0);
        return { day: String(day), km: Math.round(km*10)/10 };
      });
    } else {
      // Last 12 months rolling — same pattern as StatisticsView
      const now = new Date();
      return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
        const monthRuns = runs.filter(r => {
          const rd = new Date(r.date);
          return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
        });
        const km = monthRuns.reduce((s, r) => s + r.distance_km, 0);
        const label = d.toLocaleDateString('en', { month: 'short' }).toUpperCase();
        return { day: label, km: Math.round(km * 10) / 10 };
      });
    }
  }, [runs, chartPeriod]);

  // Weekly km total (last 7 days)
  const weeklyKmTotal = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 6);
    cutoff.setHours(0, 0, 0, 0);
    return runs
      .filter(r => new Date(r.date) >= cutoff)
      .reduce((s, r) => s + r.distance_km, 0);
  }, [runs]);

  const avgPace = useMemo(() => {
    const recent = runs.slice(0, 5).filter((r) => !r.is_treadmill && r.avg_pace && parsePaceToSecs(r.avg_pace) > 100);
    if (!recent.length) return "--";
    const avg = recent.reduce((sum, r) => sum + parsePaceToSecs(r.avg_pace), 0) / recent.length;
    return secsToPaceStr(avg);
  }, [runs]);

  const profile = dashData?.profile;
  const maxHr = profile?.max_hr ?? 180;
  const atHr = Math.round(maxHr * 0.92);
  const ltHr = Math.round(maxHr * 0.87);

  const raceDate = profile?.race_date;
  const timeToRace = raceDate ? timeUntil(raceDate) : null;
  const daysToRace = timeToRace?.days ?? null;

  const weekProgress = dashData?.week_progress;
  const nextSession = dashData?.next_session;

  const efficiency = tsb !== null
    ? Math.max(70, Math.min(100, 85 + tsb * 1.05))
    : null;

  const neuroBar = Math.min(100, ctl);
  const metaboBar = Math.min(100, atl);
  const struttBar = tsb !== null ? Math.min(100, Math.max(0, 50 + tsb * 2)) : 0;

  const lastDrift = useMemo(() => {
    const qualifying = runs.find(r =>
      r.distance_km >= 4 &&
      r.splits.length >= 4 &&
      r.splits.some(s => s.hr && s.hr > 80)
    );
    if (!qualifying) return null;
    const splits = qualifying.splits.filter(
      s => s.hr && s.hr > 80 && s.pace && s.pace.includes(":")
    );
    if (splits.length < 4) return null;
    const mid = Math.floor(splits.length / 2);
    const avgHr = (arr: typeof splits) => arr.reduce((s, x) => s + (x.hr ?? 0), 0) / arr.length;
    const hr1 = avgHr(splits.slice(0, mid));
    const hr2 = avgHr(splits.slice(mid));
    if (!hr1) return null;
    return Math.round(((hr2 - hr1) / hr1) * 1000) / 10;
  }, [runs]);

  const gpsRuns = runs.filter(r => !r.is_treadmill);
  const recentRuns = runs.slice(0, 7);
  const lastRun = gpsRuns[0] ?? null;

  // Hall of Fame — real PRs from /api/best-efforts (same as Profile)
  const allEfforts = effortsData?.efforts ?? [];
  const hofEfforts = useMemo(() => {
    const targets = ['5 km', '10 km', 'Mezza Maratona'];
    return targets.map(dist => allEfforts.find(e => e.distance === dist) ?? null);
  }, [allEfforts]);

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="p-6 max-w-[2200px] mx-auto space-y-6">

        {/* Header */}
        {dashLoading && <div className="h-10 bg-white/5 rounded-xl animate-pulse" />}
        {dashError && (
          <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
            Backend connection error: {dashError}
          </div>
        )}
        {dashData && (
          <div className="mb-2">
            <h2 className="text-2xl font-black italic tracking-tight text-white uppercase">
              Hey, {profile?.name || "Runner"} 👋
            </h2>
            <p className="text-sm text-gray-500 font-medium mt-1">
              {profile?.race_goal}
              {raceDate && ` — ${raceDate}`}
              {daysToRace !== null && (
                <span className="ml-3 text-[#C0FF00] font-black">{daysToRace} days to race</span>
              )}
            </p>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">

          {/* ── Status of Form — col 1-6, row 1-2 ── */}
          <div className="col-span-6 row-span-2 bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-8 relative overflow-hidden flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="text-[#A0A0A0] text-xs font-black tracking-widest mb-2">LIVE BIO-FEED</div>
                <h2 className="text-white text-4xl font-black tracking-tighter italic">Status of Form</h2>
              </div>
              <div
                className="px-3 py-1 rounded-full text-xs font-black tracking-wide flex items-center gap-2"
                style={{
                  color: faticaColor,
                  backgroundColor: faticaColor + "18",
                  border: `1px solid ${faticaColor}35`,
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: faticaColor }} />
                {status.label}
              </div>
            </div>

            <div className="flex items-center justify-center gap-12 flex-1">
              {/* Gauge */}
              <div className="relative w-56 h-56 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="#333" strokeWidth="8" fill="none" />
                  <circle
                    cx="50" cy="50" r="40"
                    stroke={status.color}
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray="251.2"
                    strokeDashoffset={gaugeOffset}
                    strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 8px ${status.color}66)` }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-black" style={{ color: status.color }}>
                    {readiness !== null ? readiness.toFixed(0) : "—"}
                  </span>
                  <span className="text-[#A0A0A0] text-xs font-black tracking-widest mt-1">PEAK SCORE</span>
                </div>
              </div>

              {/* Divider */}
              <div className="w-px self-stretch bg-white/[0.06]" />

              {/* Stats col 1: TSB + Efficiency */}
              <div className="flex flex-col gap-6">
                <div>
                  <div className="text-[#A0A0A0] text-xs font-black tracking-widest mb-1">TSB</div>
                  <div className="text-3xl font-black" style={{ color: status.color }}>
                    {tsb !== null ? (tsb >= 0 ? "+" : "") + tsb.toFixed(1) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[#A0A0A0] text-xs font-black tracking-widest mb-1">EFFICIENCY</div>
                  <div className="text-white text-3xl font-black">
                    {efficiency !== null ? efficiency.toFixed(1) + "%" : "—"}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="w-px self-stretch bg-white/[0.06]" />

              {/* Stats col 2: CTL + ATL */}
              <div className="flex flex-col gap-6">
                <div>
                  <div className="text-[#A0A0A0] text-xs font-black tracking-widest mb-1">CTL</div>
                  <div className="text-white text-3xl font-black">
                    {ctl > 0 ? ctl.toFixed(0) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[#A0A0A0] text-xs font-black tracking-widest mb-1">ATL</div>
                  <div className="text-white text-3xl font-black">
                    {atl > 0 ? atl.toFixed(0) : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── VO2 Max — col 7-9, row 1 ── */}
          <div className="col-span-3 bg-[#1a1a1a] border border-white/[0.06] border-t-4 border-t-[#C0FF00] rounded-3xl p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <Wind className="text-[#C0FF00]" size={24} />
              <div className="bg-white/10 text-[#A0A0A0] px-2 py-1 rounded text-[10px] font-black tracking-widest">
                VDOT SCORE
              </div>
            </div>
            <div>
              <div className="text-[#A0A0A0] text-xs font-black tracking-widest mb-2">VO2 MAX EST.</div>
              <div className="flex items-baseline gap-2">
                <span className="text-white text-5xl font-black tracking-tight">
                  {vdot !== null ? vdot.toFixed(1) : "—"}
                </span>
                <span className="text-[#A0A0A0] text-sm font-semibold">ml/kg/min</span>
              </div>
            </div>
          </div>

          {/* ── Hall of Fame — col 10-12, row 1 ── */}
          <div className="col-span-3 bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="text-[#C0FF00]" size={14} />
              <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest">HALL OF FAME</span>
            </div>
            <div className="space-y-3 flex-1 flex flex-col justify-center">
              {[
                { label: '5K',   effort: hofEfforts[0] },
                { label: '10K',  effort: hofEfforts[1] },
                { label: 'HALF', effort: hofEfforts[2] },
              ].map(({ label, effort }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[#A0A0A0] text-sm font-black">{label}</span>
                  <div className="text-right">
                    <span className="text-white text-lg font-black">{effort?.time ?? '—'}</span>
                    {effort?.pace && (
                      <div className="text-[#555] text-[9px]">{effort.pace}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Fatigue ATL — col 7-9, row 2 ── */}
          <div
            className="col-span-3 rounded-3xl p-6 flex flex-col justify-between"
            style={{ backgroundColor: faticaColor }}
          >
            <div className="flex justify-between items-start">
              <TrendingDown className="text-black/70" size={24} />
              <div className="bg-black/10 text-black/70 px-2 py-1 rounded text-[10px] font-black tracking-widest">
                {faticaLabel}
              </div>
            </div>
            <div>
              <div className="text-black/60 text-xs font-black tracking-widest mb-2">FATIGUE (ATL)</div>
              <div className="flex items-baseline gap-2">
                <span className="text-black text-5xl font-black tracking-tight">
                  {atl > 0 ? atl.toFixed(1) : "—"}
                </span>
                <span className="text-black/60 text-sm font-black">{faticaLabel}</span>
              </div>
            </div>
          </div>

          {/* ── Target / Countdown — col 10-12, row 2 ── */}
          <div className="col-span-3 bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <Target className="text-[#C0FF00]" size={16} />
              <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase truncate">
                {profile?.race_goal || "No race set"}
              </span>
            </div>
            <div className="flex-1 flex items-center">
              {timeToRace !== null ? (
                <div className="flex items-baseline gap-3">
                  <div className="text-center">
                    <span className="text-white text-4xl font-black">{timeToRace.days}</span>
                    <div className="text-[#A0A0A0] text-[9px] font-black tracking-widest mt-0.5">D</div>
                  </div>
                  <div className="text-center">
                    <span className="text-white text-4xl font-black">{timeToRace.hours}</span>
                    <div className="text-[#A0A0A0] text-[9px] font-black tracking-widest mt-0.5">H</div>
                  </div>
                  <div className="text-center">
                    <span className="text-white text-4xl font-black">{timeToRace.minutes}</span>
                    <div className="text-[#A0A0A0] text-[9px] font-black tracking-widest mt-0.5">M</div>
                  </div>
                </div>
              ) : (
                <span className="text-[#A0A0A0] text-2xl font-black">—</span>
              )}
            </div>
            {weekProgress && (
              <div className="mt-3">
                <div className="flex justify-between text-[10px] font-black tracking-widest mb-2">
                  <span className="text-[#A0A0A0]">WEEKLY PLAN</span>
                  <span className="text-[#C0FF00]">{weekProgress.pct.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-[#333] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#C0FF00] rounded-full"
                    style={{ width: `${Math.min(100, weekProgress.pct)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── 4 Metric Cards — 3 cols each ── */}
          <div className="col-span-3 bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 flex flex-col justify-between">
            <div className="text-[#A0A0A0] text-[10px] font-black tracking-widest mb-4">ANAEROBIC THRESHOLD</div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-white text-3xl font-black">{atHr}</span>
              <span className="text-[#A0A0A0] text-xs">BPM</span>
            </div>
            <div className="flex gap-1 h-1.5 mt-auto">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`flex-1 rounded-full ${i < 4 ? "bg-[#C0FF00]" : "bg-[#333]"}`} />
              ))}
            </div>
          </div>

          <div className="col-span-3 bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 flex flex-col justify-between">
            <div className="text-[#A0A0A0] text-[10px] font-black tracking-widest mb-4">LACTATE THRESHOLD</div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-white text-3xl font-black">{ltHr}</span>
              <span className="text-[#A0A0A0] text-xs">BPM</span>
            </div>
            <div className="flex gap-1 h-1.5 mt-auto">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`flex-1 rounded-full ${i < 5 ? "bg-[#555]" : "bg-[#333]"}`} />
              ))}
            </div>
          </div>

          <div className="col-span-3 bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 flex flex-col justify-between">
            <div className="text-[#A0A0A0] text-[10px] font-black tracking-widest mb-4">AVG PACE</div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-white text-3xl font-black">{avgPace}</span>
              <span className="text-[#A0A0A0] text-xs">/km</span>
            </div>
            <div className="flex gap-1 h-1.5 mt-auto">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`flex-1 rounded-full ${i === 3 ? "bg-[#C0FF00]" : "bg-[#333]"}`} />
              ))}
            </div>
          </div>

          <div className="col-span-3 bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 flex flex-col justify-between">
            <div className="text-[#A0A0A0] text-[10px] font-black tracking-widest mb-4">CARDIAC DRIFT</div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-white text-3xl font-black">
                {lastDrift !== null ? (lastDrift >= 0 ? "+" : "") + lastDrift.toFixed(1) : "--"}
              </span>
              <span className="text-[#A0A0A0] text-xs">%</span>
            </div>
            <div className="flex gap-1 h-1.5 mt-auto">
              {[...Array(6)].map((_, i) => {
                const driftPct = lastDrift !== null ? Math.abs(lastDrift) : 0;
                const filled = Math.round(Math.min(6, driftPct / 2));
                const color = driftPct < 3.5 ? "#C0FF00" : driftPct < 5 ? "#F59E0B" : "#F43F5E";
                return <div key={i} className="flex-1 rounded-full" style={{ backgroundColor: i < filled ? color : "#333" }} />;
              })}
            </div>
          </div>

          {/* ── Weekly KM Chart — col-span-5 ── */}
          <div className="col-span-5 bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-8 flex flex-col h-[420px]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[#A0A0A0] text-xs font-black tracking-widest">
                  {chartPeriod === '7d' ? 'LAST 7 DAYS' : chartPeriod === 'month' ? 'CURRENT MONTH' : 'LAST 12 MONTHS'}
                </div>
                {chartPeriod === '7d' && (
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-[#C0FF00] text-2xl font-black">{weeklyKmTotal.toFixed(1)}</span>
                    <span className="text-[#A0A0A0] text-xs font-black">KM THIS WEEK</span>
                  </div>
                )}
              </div>
              <div className="flex bg-[#111] rounded-lg border border-white/[0.06] p-0.5">
                {(['7d','month','year'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setChartPeriod(p)}
                    className={`px-3 py-1 rounded-md text-[10px] font-black tracking-wider transition-all ${
                      chartPeriod === p ? 'bg-[#C0FF00] text-black' : 'text-gray-500 hover:text-white'
                    }`}
                  >
                    {p === '7d' ? '7D' : p === 'month' ? 'MONTH' : 'YEAR'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="day" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    contentStyle={{
                      backgroundColor: "#111",
                      border: "1px solid #333",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="km" fill="#C0FF00" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Last Run Map — col-span-4 ── */}
          <div className="col-span-4 rounded-3xl overflow-hidden relative h-[420px]">
            <div className="absolute inset-0">
              <LastRunMap run={lastRun} />
            </div>
          </div>

          {/* ── Right widgets stack — col-span-3 ── */}
          <div className="col-span-3 flex flex-col gap-6">
            {/* Next Session */}
            {nextSession && (
              <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Timer className="text-orange-500" size={16} />
                  <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase">
                    Next Session
                  </span>
                </div>
                <div className="text-white font-black text-sm mb-1">{nextSession.title}</div>
                <div className="text-[#A0A0A0] text-xs">
                  {nextSession.target_distance_km > 0 && `${nextSession.target_distance_km} km`}
                  {nextSession.target_pace && ` · ${nextSession.target_pace}/km`}
                </div>
                <div className="mt-3 text-orange-500 text-[10px] font-black tracking-widest uppercase">
                  {nextSession.type}
                </div>
              </div>
            )}

            {/* Next Optimal Session */}
            <NextOptimalSessionWidget tsb={tsb} atl={atl} ctl={ctl} runs={runs} faticaColor={faticaColor} />

            {/* Adaptation Summary */}
            <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6">
              <div className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase mb-5">
                Adaptation Summary
              </div>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="text-[#C0FF00]" size={14} />
                      <span className="text-white text-xs font-black uppercase">Neuro (CTL)</span>
                    </div>
                    <span className="text-[#A0A0A0] text-[10px]">{ctl > 0 ? ctl.toFixed(0) : "—"}</span>
                  </div>
                  <div className="h-1.5 bg-[#333] rounded-full overflow-hidden">
                    <div className="h-full bg-[#C0FF00] rounded-full" style={{ width: `${neuroBar}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <Flame className="text-orange-500" size={14} />
                      <span className="text-white text-xs font-black uppercase">Metabo (ATL)</span>
                    </div>
                    <span className="text-[#A0A0A0] text-[10px]">{atl > 0 ? atl.toFixed(0) : "—"}</span>
                  </div>
                  <div className="h-1.5 bg-[#333] rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full" style={{ width: `${metaboBar}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <Activity className="text-purple-500" size={14} />
                      <span className="text-white text-xs font-black uppercase">Form (TSB)</span>
                    </div>
                    <span className="text-[#A0A0A0] text-[10px]">
                      {tsb !== null ? (tsb >= 0 ? "+" : "") + tsb.toFixed(0) : "—"}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#333] rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${struttBar}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>{/* end main grid */}

        {/* Session Logs — full width */}
        {recentRuns.length > 0 && (
          <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-8 w-full">
            <div className="mb-8">
              <div className="text-[#A0A0A0] text-xs font-black tracking-widest mb-2">SESSION LOGS</div>
              <h2 className="text-white text-2xl font-black tracking-tighter italic">Performance History</h2>
            </div>

            <div className="w-full">
              <div className="grid grid-cols-7 text-[#A0A0A0] text-[10px] font-black tracking-widest mb-4 px-4">
                <div className="col-span-2">TYPE</div>
                <div>DATE</div>
                <div>DURATION</div>
                <div>AVG PACE</div>
                <div>TE SCORE</div>
                <div className="text-right">STATUS</div>
              </div>
              <div className="space-y-2">
                {recentRuns.map((run: Run) => {
                  const hrPct = run.avg_hr_pct != null
                    ? (run.avg_hr_pct > 1 ? run.avg_hr_pct / 100 : run.avg_hr_pct)
                    : null;
                  const teRaw = hrPct !== null ? hrPct * 5 : null;
                  const teLabel =
                    teRaw === null ? "—"
                    : teRaw >= 4 ? "HIGHLY AEROBIC"
                    : teRaw >= 3 ? "AEROBIC"
                    : teRaw >= 2 ? "RECOVERY"
                    : "—";
                  const teColor =
                    teRaw === null ? "#A0A0A0"
                    : teRaw >= 4 ? "#C0FF00"
                    : teRaw >= 3 ? "#60A5FA"
                    : "#A0A0A0";
                  return (
                    <div
                      key={run.id}
                      onClick={() => navigate(`/activities/${run.id}`)}
                      className="grid grid-cols-7 items-center bg-[#111] rounded-2xl p-4 cursor-pointer hover:bg-[#1a1a1a] hover:border hover:border-white/10 transition-all"
                    >
                      <div className="col-span-2 flex items-center gap-3">
                        <Activity className="text-[#C0FF00]" size={18} />
                        <span className="text-white font-black text-sm">{run.name || run.run_type || "Run"}</span>
                      </div>
                      <div className="text-[#A0A0A0] text-sm">
                        {new Date(run.date).toLocaleDateString("en", { day: "numeric", month: "short" })}
                      </div>
                      <div className="text-white font-black text-sm">{formatDuration(run.duration_minutes)}</div>
                      <div className="text-[#A0A0A0] text-sm">{run.avg_pace}/km</div>
                      <div className="text-xs font-black" style={{ color: teColor }}>
                        {teRaw !== null ? teRaw.toFixed(1) + " · " : ""}{teLabel}
                      </div>
                      <div className="text-right text-[#C0FF00] font-black text-xs">
                        ● VERIFIED
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
