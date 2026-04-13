import { useMemo } from "react";
import {
  Wind, TrendingDown, Activity, Target, Timer, Zap, Flame,
} from "lucide-react";
import { LastRunMap } from "./LastRunMap";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useApi } from "../hooks/useApi";
import { getDashboard, getRuns, getAnalytics } from "../api";
import type { DashboardResponse, RunsResponse, AnalyticsResponse, Run } from "../types/api";

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86400000));
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

export function DashboardView() {
  const { data: dashData, loading: dashLoading, error: dashError } =
    useApi<DashboardResponse>(getDashboard);
  const { data: runsData } = useApi<RunsResponse>(getRuns);
  const { data: analyticsData } = useApi<AnalyticsResponse>(getAnalytics);

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

  // Weekly km chart (current week Mon-Sun)
  const weeklyData = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const now = new Date();
    const weekStart = new Date(now);
    const dow = now.getDay();
    const diff = dow === 0 ? 6 : dow - 1;
    weekStart.setDate(now.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);

    const dayKm: number[] = [0, 0, 0, 0, 0, 0, 0];
    runs.forEach((r) => {
      const rd = new Date(r.date);
      const diffDays = Math.floor((rd.getTime() - weekStart.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays < 7) {
        dayKm[diffDays] += r.distance_km;
      }
    });
    return days.map((day, i) => ({ day, km: Math.round(dayKm[i] * 10) / 10 }));
  }, [runs]);

  // Avg pace from last 5 runs
  const avgPace = useMemo(() => {
    const recent = runs.slice(0, 5).filter((r) => r.avg_pace && parsePaceToSecs(r.avg_pace) > 100);
    if (!recent.length) return "--";
    const avg = recent.reduce((sum, r) => sum + parsePaceToSecs(r.avg_pace), 0) / recent.length;
    return secsToPaceStr(avg);
  }, [runs]);

  const profile = dashData?.profile;
  const maxHr = profile?.max_hr ?? 180;
  const atHr = Math.round(maxHr * 0.92); // LT2 / AT
  const ltHr = Math.round(maxHr * 0.87); // LT1

  const raceDate = profile?.race_date;
  const daysToRace = raceDate ? daysUntil(raceDate) : null;

  const weekProgress = dashData?.week_progress;
  const nextSession = dashData?.next_session;

  // Adaptation bars
  const neuroBar = Math.min(100, ctl);
  const metaboBar = Math.min(100, atl);
  const struttBar = tsb !== null ? Math.min(100, Math.max(0, 50 + tsb * 2)) : 0;

  const recentRuns = runs.slice(0, 3);
  const lastRun = dashData?.last_run ?? runs[0] ?? null;

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
                      <span className="text-[#A0A0A0] text-xs font-black tracking-widest mt-1">READINESS</span>
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
                      <div className="text-[#A0A0A0] text-xs font-black tracking-widest mb-1">CTL (FITNESS)</div>
                      <div className="text-white text-3xl font-black">{ctl > 0 ? ctl.toFixed(0) : "—"}</div>
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
                <div className="text-[#A0A0A0] text-[10px] font-black tracking-widest mb-4">KM QUESTA SETTIMANA</div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-white text-3xl font-black">
                    {weekProgress
                      ? weekProgress.done_km.toFixed(1)
                      : weeklyData.reduce((s, d) => s + d.km, 0).toFixed(1)}
                  </span>
                  <span className="text-[#A0A0A0] text-xs">km</span>
                </div>
                <div className="flex gap-1 h-1.5 mt-auto">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-full ${
                        i < Math.round((weekProgress?.pct ?? 0) / 16.67) ? "bg-[#C0FF00]" : "bg-[#333]"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Row 3: Weekly chart + Last Run map */}
            <div className="grid grid-cols-5 gap-5 items-stretch">
              <div className="col-span-3 bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-8 flex flex-col">
                <div className="text-[#A0A0A0] text-xs font-black tracking-widest mb-6">
                  KILOMETRAGGIO SETTIMANA CORRENTE
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

              <div className="col-span-2 bg-[#1a1a1a] border border-white/[0.06] rounded-3xl overflow-hidden relative min-h-[320px]">
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
                {daysToRace !== null ? (
                  <>
                    <span className="text-white text-5xl font-black">{daysToRace}</span>
                    <span className="text-[#A0A0A0] text-sm font-black ml-2">GIORNI</span>
                  </>
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
              <div className="grid grid-cols-6 text-[#A0A0A0] text-[10px] font-black tracking-widest mb-4 px-4">
                <div className="col-span-2">TIPO</div>
                <div>DATA</div>
                <div>DURATA</div>
                <div>AVG PACE</div>
                <div className="text-right">KM</div>
              </div>
              <div className="space-y-2">
                {recentRuns.map((run: Run) => (
                  <div key={run.id} className="grid grid-cols-6 items-center bg-[#111] rounded-2xl p-4">
                    <div className="col-span-2 flex items-center gap-3">
                      <Activity className="text-[#C0FF00]" size={18} />
                      <span className="text-white font-black text-sm">{run.name || run.run_type || "Run"}</span>
                    </div>
                    <div className="text-[#A0A0A0] text-sm">
                      {new Date(run.date).toLocaleDateString("it", { day: "numeric", month: "short" })}
                    </div>
                    <div className="text-white font-black text-sm">{formatDuration(run.duration_minutes)}</div>
                    <div className="text-[#A0A0A0] text-sm">{run.avg_pace}/km</div>
                    <div className="text-right text-[#C0FF00] font-black text-sm">
                      {run.distance_km.toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
