import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wind, TrendingDown, Activity, Target, Timer, Zap, Flame, Shield,
} from "lucide-react";
import { LastRunMap } from "./LastRunMap";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useApi } from "../hooks/useApi";
import { getDashboard, getRuns, getAnalytics } from "../api";
import type { DashboardResponse, RunsResponse, AnalyticsResponse, Run } from "../types/api";

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
function NextOptimalSessionWidget({ tsb, atl, ctl }: { tsb: number | null; atl: number; ctl: number }) {
  const { hoursUntil, pct } = useMemo(() => {
    if (tsb === null || tsb >= -5) return { hoursUntil: 0, pct: 1 };
    // Daily TSB improvement without training:
    // ATL decays at 1/7 day constant, CTL at 1/42 — net TSB gain per hour
    const dailyGain = atl * (1 - Math.exp(-1 / 7)) - ctl * (1 - Math.exp(-1 / 42));
    const gap = -5 - tsb; // how much TSB needs to rise
    const hours = Math.max(0, Math.round((gap / Math.max(dailyGain, 0.1)) * 24));
    // Total hours needed from -15 baseline (rough scale for arc)
    const totalHours = Math.round(((-5 - (-15)) / Math.max(dailyGain, 0.1)) * 24);
    const recovered = Math.max(0, 1 - hours / Math.max(totalHours, 1));
    return { hoursUntil: hours, pct: recovered };
  }, [tsb, atl, ctl]);

  const isReady = hoursUntil === 0;
  const h = Math.floor(hoursUntil);
  const m = Math.round((hoursUntil - h) * 60);
  const arcColor = isReady ? "#C0FF00" : pct > 0.6 ? "#C0FF00" : pct > 0.3 ? "#F59E0B" : "#F43F5E";
  const circ = 2 * Math.PI * 38;
  const offset = circ * (1 - pct);

  return (
    <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Timer className="text-orange-400" size={13} />
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
                  {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}
                </span>
                <span className="text-[#666] text-[8px] font-black mt-0.5">H : M</span>
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
            {isReady ? "Pronto ad allenarti" : `Ottimale tra ~${h}h`}
          </div>
          <div className="text-[#666] text-[9px] leading-relaxed">
            {isReady
              ? "TSB in zona neutrale. Allenamento consigliato."
              : `TSB ${tsb?.toFixed(1)} → recupero in corso. Attendi per ridurre rischio infortuni.`}
          </div>
          {/* Recovery bar */}
          <div className="mt-2 h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.round(pct * 100)}%`, backgroundColor: arcColor }}
            />
          </div>
          <div className="text-[#555] text-[8px] mt-0.5">{Math.round(pct * 100)}% recuperato</div>
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

  const navigate = useNavigate();
  const runs = runsData?.runs ?? [];
  const vdot = analyticsData?.vdot ?? null;

  const ff = dashData?.current_ff ?? null;
  const tsb = ff?.tsb ?? null;
  const ctl = ff?.ctl ?? 0;
  const atl = ff?.atl ?? 0;

  // Readiness 0-100 (50=neutro, >50=fresco, <50=affaticato)
  const readiness = tsb !== null ? Math.max(0, Math.min(100, 50 + tsb * 3)) : null;
  const gaugeOffset = readiness !== null ? 251.2 * (1 - readiness / 100) : 251.2;

  const status =
    tsb === null
      ? { label: "—", color: "#64748B" }
      : tsb > 10
      ? { label: "FRESCO", color: "#C0FF00" }
      : tsb > -5
      ? { label: "NEUTRO", color: "#14B8A6" }
      : tsb > -20
      ? { label: "AFFATICATO", color: "#F59E0B" }
      : { label: "SOVRACC.", color: "#F43F5E" };

  const faticaLabel = atl > 80 ? "HIGH RISK" : atl > 50 ? "MODERATE" : "LOW RISK";
  const faticaColor = atl > 80 ? "#F43F5E" : atl > 50 ? "#F59E0B" : "#C0FF00";

  // Weekly km chart — ultimi 7 giorni rolling (sempre mostra dati recenti)
  const weeklyData = useMemo(() => {
    const toLocal = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));
      const ds = toLocal(d);
      const km = runs
        .filter(r => r.date.slice(0, 10) === ds)
        .reduce((s, r) => s + r.distance_km, 0);
      const label = d.toLocaleDateString("it", { weekday: "short" })
        .replace(".", "").slice(0, 3);
      return { day: label, km: Math.round(km * 10) / 10 };
    });
  }, [runs]);

  // Avg pace from last 5 runs
  const avgPace = useMemo(() => {
    const recent = runs.slice(0, 5).filter((r) => !r.is_treadmill && r.avg_pace && parsePaceToSecs(r.avg_pace) > 100);
    if (!recent.length) return "--";
    const avg = recent.reduce((sum, r) => sum + parsePaceToSecs(r.avg_pace), 0) / recent.length;
    return secsToPaceStr(avg);
  }, [runs]);

  const profile = dashData?.profile;
  const maxHr = profile?.max_hr ?? 180;
  const atHr = Math.round(maxHr * 0.92); // LT2 / AT
  const ltHr = Math.round(maxHr * 0.87); // LT1

  const raceDate = profile?.race_date;
  const timeToRace = raceDate ? timeUntil(raceDate) : null;
  const daysToRace = timeToRace?.days ?? null;

  const weekProgress = dashData?.week_progress;
  const nextSession = dashData?.next_session;

  // Efficiency: TSB-based aerobic efficiency score (Coggan 2003 adaptation)
  const efficiency = tsb !== null
    ? Math.max(70, Math.min(100, 85 + tsb * 1.05))
    : null;

  // Adaptation bars
  const neuroBar = Math.min(100, ctl);
  const metaboBar = Math.min(100, atl);
  const struttBar = tsb !== null ? Math.min(100, Math.max(0, 50 + tsb * 2)) : 0;

  // Cardiac drift from last qualifying run (needs splits)
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

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="p-8 w-full max-w-[1600px] mx-auto space-y-5">

        {/* Header */}
        {dashLoading && <div className="h-10 bg-white/5 rounded-xl animate-pulse" />}
        {dashError && (
          <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
            Errore connessione backend: {dashError}
          </div>
        )}
        {dashData && (
          <div className="mb-2">
            <h2 className="text-2xl font-black italic tracking-tight text-white uppercase">
              Ciao, {profile?.name || "Runner"} 👋
            </h2>
            <p className="text-sm text-gray-500 font-medium mt-1">
              {profile?.race_goal}
              {raceDate && ` — ${raceDate}`}
              {daysToRace !== null && (
                <span className="ml-3 text-[#C0FF00] font-black">{daysToRace} giorni alla gara</span>
              )}
            </p>
          </div>
        )}

        <div className="flex gap-5 items-start">
          {/* ── Main Content ── */}
          <div className="flex-1 space-y-5 min-w-0">

            {/* Top Row: Status of Form + VO2Max/Fatigue */}
            <div className="grid grid-cols-3 gap-5">
              {/* Status of Form */}
              <div className="col-span-2 bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-8 relative overflow-hidden">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <div className="text-[#A0A0A0] text-xs font-black tracking-widest mb-2">LIVE BIO-FEED</div>
                    <h2 className="text-white text-4xl font-black tracking-tighter italic">Status of Form</h2>
                  </div>
                  <div
                    className="px-3 py-1 rounded-full text-xs font-black tracking-wide flex items-center gap-2"
                    style={{
                      color: status.color,
                      backgroundColor: status.color + "18",
                      border: `1px solid ${status.color}35`,
                    }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: status.color }} />
                    {status.label}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="relative w-64 h-64 flex-shrink-0">
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
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-black" style={{ color: status.color }}>
                        {readiness !== null ? readiness.toFixed(0) : "—"}
                      </span>
                      <span className="text-[#A0A0A0] text-xs font-black tracking-widest mt-1">PEAK SCORE</span>
                    </div>
                  </div>

                  <div className="text-right flex flex-col gap-6">
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
                </div>
              </div>

              {/* Right column: VO2Max + Fatigue */}
              <div className="col-span-1 flex flex-col gap-5">
                {/* VO2 Max (VDOT) */}
                <div className="bg-[#1a1a1a] border border-white/[0.06] border-t-4 border-t-[#C0FF00] rounded-3xl p-6 flex-1 flex flex-col justify-between">
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

                {/* Fatigue Index (ATL) */}
                <div
                  className="rounded-3xl p-6 flex-1 flex flex-col justify-between"
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
              </div>
            </div>

            {/* 4 Small Cards */}
            <div className="grid grid-cols-4 gap-5">
              <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-8 flex flex-col justify-between">
                <div className="text-[#A0A0A0] text-[10px] font-black tracking-widest mb-4">SOGLIA ANAEROBICA</div>
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

              <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-8 flex flex-col justify-between">
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

              <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-8 flex flex-col justify-between">
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

              <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-8 flex flex-col justify-between">
                <div className="text-[#A0A0A0] text-[10px] font-black tracking-widest mb-4">DERIVA CARDIACA</div>
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
                    return <div key={i} className={`flex-1 rounded-full`} style={{ backgroundColor: i < filled ? color : "#333" }} />;
                  })}
                </div>
              </div>
            </div>

            {/* Row 3: Weekly chart + Last Run map */}
            <div className="grid grid-cols-5 gap-5 items-stretch">
              <div className="col-span-3 bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-8 flex flex-col">
                <div className="text-[#A0A0A0] text-xs font-black tracking-widest mb-6">
                  KILOMETRAGGIO SETTIMANALE
                </div>
                <div className="flex-1 min-h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData}>
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

              <div className="col-span-2 bg-[#1a1a1a] border border-white/[0.06] rounded-3xl overflow-hidden relative">
                <div className="absolute inset-0">
                  <LastRunMap run={lastRun} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Right Sidebar ── */}
          <div className="w-[300px] shrink-0 space-y-5">
            {/* Target Card */}
            <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="text-[#C0FF00]" size={16} />
                <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase">
                  {profile?.race_goal || "Nessuna gara"}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-6">
                {timeToRace !== null ? (
                  <div className="flex items-baseline gap-3">
                    <div className="text-center">
                      <span className="text-white text-5xl font-black">{timeToRace.days}</span>
                      <div className="text-[#A0A0A0] text-[9px] font-black tracking-widest mt-0.5">D</div>
                    </div>
                    <div className="text-center">
                      <span className="text-white text-5xl font-black">{timeToRace.hours}</span>
                      <div className="text-[#A0A0A0] text-[9px] font-black tracking-widest mt-0.5">H</div>
                    </div>
                    <div className="text-center">
                      <span className="text-white text-5xl font-black">{timeToRace.minutes}</span>
                      <div className="text-[#A0A0A0] text-[9px] font-black tracking-widest mt-0.5">M</div>
                    </div>
                  </div>
                ) : (
                  <span className="text-[#A0A0A0] text-2xl font-black">—</span>
                )}
              </div>
              {weekProgress && (
                <div>
                  <div className="flex justify-between text-[10px] font-black tracking-widest mb-2">
                    <span className="text-[#A0A0A0]">PIANO SETTIMANA</span>
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

            {/* Next Session */}
            {nextSession && (
              <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Timer className="text-orange-500" size={16} />
                  <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase">
                    Prossimo Allenamento
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
            <NextOptimalSessionWidget tsb={tsb} atl={atl} ctl={ctl} />

            {/* Adaptation Summary */}
            <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6">
              <div className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase mb-6">
                Adaptation Summary
              </div>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="text-[#C0FF00]" size={14} />
                      <span className="text-white text-xs font-black uppercase">Neuro (CTL)</span>
                    </div>
                    <span className="text-[#A0A0A0] text-[10px]">
                      {ctl > 0 ? ctl.toFixed(0) : "—"}
                    </span>
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
                    <span className="text-[#A0A0A0] text-[10px]">
                      {atl > 0 ? atl.toFixed(0) : "—"}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#333] rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full" style={{ width: `${metaboBar}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <Activity className="text-purple-500" size={14} />
                      <span className="text-white text-xs font-black uppercase">Forma (TSB)</span>
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
        </div>

        {/* Session Logs */}
        {recentRuns.length > 0 && (
          <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-8 w-full">
            <div className="mb-8">
              <div className="text-[#A0A0A0] text-xs font-black tracking-widest mb-2">SESSION LOGS</div>
              <h2 className="text-white text-2xl font-black tracking-tighter italic">Performance History</h2>
            </div>

            <div className="w-full">
              <div className="grid grid-cols-7 text-[#A0A0A0] text-[10px] font-black tracking-widest mb-4 px-4">
                <div className="col-span-2">TIPO</div>
                <div>DATA</div>
                <div>DURATA</div>
                <div>AVG PACE</div>
                <div>TE SCORE</div>
                <div className="text-right">STATUS</div>
              </div>
              <div className="space-y-2">
                {recentRuns.map((run: Run) => {
                  // avg_hr_pct may be 0-1 (decimal) or 0-100 (integer) — normalize
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
                        {new Date(run.date).toLocaleDateString("it", { day: "numeric", month: "short" })}
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
