import { TopStats } from "./TopStats";
import { RecentActivities } from "./RecentActivities";
import { MainChart } from "./MainChart";
import { AnaerobicThreshold } from "./AnaerobicThreshold";
import { FitnessFreshness } from "./FitnessFreshness";
import { RacePredictions } from "./RacePredictions";
import { VO2MaxChart } from "./VO2MaxChart";
import { useApi } from "../hooks/useApi";
import { getDashboard, getRuns, getAnalytics } from "../api";
import type { DashboardResponse, RunsResponse, AnalyticsResponse } from "../types/api";

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86400000));
}

function DashboardHeader({ data }: { data: DashboardResponse }) {
  const { profile, next_session, week_progress } = data;
  const days = profile.race_date ? daysUntil(profile.race_date) : null;

  return (
    <div className="flex items-center justify-between mb-6 px-1">
      <div>
        <h2 className="text-2xl font-black italic tracking-tight text-white uppercase">
          Ciao, {profile.name || "Runner"} 👋
        </h2>
        <p className="text-sm text-gray-500 font-medium mt-1">
          {profile.race_goal} — {profile.race_date}
          {days !== null && (
            <span className="ml-3 text-[#C0FF00] font-black">{days} giorni alla gara</span>
          )}
        </p>
      </div>

      {week_progress && (
        <div className="bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-right">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">
            Settimana
          </div>
          <div className="text-lg font-black text-white">
            {week_progress.done_km.toFixed(1)}
            <span className="text-gray-500 text-sm font-medium"> / {week_progress.target_km} km</span>
          </div>
          <div className="h-1 w-32 bg-white/10 rounded-full mt-2">
            <div
              className="h-full bg-[#C0FF00] rounded-full transition-all"
              style={{ width: `${Math.min(100, week_progress.pct)}%` }}
            />
          </div>
        </div>
      )}

      {next_session && (
        <div className="bg-white/5 border border-white/10 rounded-xl px-5 py-3">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">
            Prossimo allenamento
          </div>
          <div className="text-sm font-black text-white">{next_session.title}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {next_session.target_distance_km > 0 && `${next_session.target_distance_km} km`}
            {next_session.target_pace && ` · ${next_session.target_pace}/km`}
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardView() {
  const { data: dashData, loading: dashLoading, error: dashError } =
    useApi<DashboardResponse>(getDashboard);
  const { data: runsData, loading: runsLoading } =
    useApi<RunsResponse>(getRuns);
  const { data: analyticsData } =
    useApi<AnalyticsResponse>(getAnalytics);

  const runs = runsData?.runs ?? [];
  const vdot = analyticsData?.vdot ?? null;
  const racePredictions = analyticsData?.race_predictions ?? null;

  // Calcola il CTL del penultimo punto per il delta
  const ffHistory = dashData?.fitness_freshness ?? [];
  const prevCtl = ffHistory.length >= 2
    ? ffHistory[ffHistory.length - 2].ctl
    : null;

  return (
    <main className="flex-1 flex flex-col p-6 lg:p-8 overflow-y-auto custom-scrollbar">
      {/* ── Header ── */}
      {dashLoading && (
        <div className="mb-6 h-16 bg-white/5 rounded-xl animate-pulse" />
      )}
      {dashError && (
        <div className="mb-6 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
          Errore connessione backend: {dashError}
        </div>
      )}
      {dashData && <DashboardHeader data={dashData} />}

      {/* ── Skeleton TopStats mentre carica ── */}
      {runsLoading && runs.length === 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/5 rounded-xl h-48 animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Componenti con dati reali ── */}
      <TopStats runs={runs} />

      {/* ── Main grid: left column + right chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6 mb-6">
        {/* Left column */}
        <div className="flex flex-col gap-6 min-h-[600px] lg:h-[700px]">
          <div className="flex-1 min-h-0">
            <RecentActivities runs={runs} />
          </div>
          <div className="flex-shrink-0" style={{ minHeight: 220 }}>
            <AnaerobicThreshold
              runs={runs}
              maxHr={dashData?.profile?.max_hr ?? 180}
            />
          </div>
          <div className="flex-shrink-0" style={{ minHeight: 260 }}>
            <VO2MaxChart runs={runs} vdot={vdot} />
          </div>
        </div>

        {/* Right chart */}
        <div className="min-h-[500px] lg:h-[700px]">
          <MainChart runs={runs} />
        </div>
      </div>

      {/* ── Race Predictions ── */}
      <div className="mb-6">
        <RacePredictions
          runs={runs}
          vdot={vdot}
          racePredictions={racePredictions}
        />
      </div>

      {/* ── Fitness & Freshness ── */}
      <FitnessFreshness
        fitnessFreshness={ffHistory}
        currentFf={dashData?.current_ff ?? null}
        prevCtl={prevCtl}
      />
    </main>
  );
}
