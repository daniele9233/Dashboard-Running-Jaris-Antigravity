import { TopStats } from "./TopStats";
import { RecentActivities } from "./RecentActivities";
import { MainChart } from "./MainChart";
import { AnaerobicThreshold } from "./AnaerobicThreshold";
import { FitnessFreshness } from "./FitnessFreshness";
import { RacePredictions } from "./RacePredictions";
import { VO2MaxChart } from "./VO2MaxChart";
import { SupercompensationChart } from "./SupercompensationChart";
import { useApi } from "../hooks/useApi";
import { getDashboard, getRuns, getAnalytics } from "../api";
import type { DashboardResponse, RunsResponse, AnalyticsResponse, Run } from "../types/api";

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

// ─── Stato di Forma card (enhanced) ──────────────────────────────────────────
function StatoFormaCard({ dashData }: { dashData: DashboardResponse | null }) {
  const ff = dashData?.current_ff;
  const tsb = ff?.tsb ?? null;
  const ctl = ff?.ctl ?? 0;
  const atl = ff?.atl ?? 0;

  type StatusConfig = { label: string; color: string; desc: string; icon: string };
  const status: StatusConfig =
    tsb === null
      ? { label: "—", color: "#64748B", desc: "Sincronizza le corse", icon: "●" }
      : tsb > 10
      ? { label: "Fresco", color: "#C0FF00", desc: "Pronto per la gara", icon: "⚡" }
      : tsb > -5
      ? { label: "Neutro", color: "#14B8A6", desc: "Allenamento regolare", icon: "●" }
      : tsb > -20
      ? { label: "Affaticato", color: "#F59E0B", desc: "Mantieni il ritmo", icon: "▲" }
      : { label: "Sovracc.", color: "#F43F5E", desc: "Recupera prima di spingere", icon: "⚠" };

  // Prontezza 0-100: 50 = neutro, >50 = fresco, <50 = affaticato
  const readiness = tsb !== null ? Math.max(0, Math.min(100, 50 + tsb * 3)) : null;

  return (
    <div
      className="bg-bg-card border rounded-xl p-5 flex flex-col justify-between h-full relative overflow-hidden"
      style={{ borderColor: status.color + "30" }}
    >
      {/* Background accent glow */}
      <div
        className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full opacity-10 blur-2xl"
        style={{ backgroundColor: status.color }}
      />

      {/* Header */}
      <div className="text-[10px] text-text-muted uppercase tracking-widest font-bold">
        Stato di Forma
      </div>

      {/* Status + TSB */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-4xl font-black leading-none mb-1" style={{ color: status.color }}>
            {status.label}
          </div>
          <div
            className="text-xs font-black tracking-widest uppercase px-2 py-0.5 rounded-full inline-block mt-1"
            style={{ color: status.color, backgroundColor: status.color + "18", border: `1px solid ${status.color}35` }}
          >
            TSB {tsb !== null ? (tsb >= 0 ? "+" : "") + tsb.toFixed(1) : "—"}
          </div>
        </div>
        <div className="text-3xl opacity-50">{status.icon}</div>
      </div>

      {/* Condizione / Fatica */}
      <div className="flex gap-5 text-xs">
        <div className="flex flex-col">
          <span className="text-[9px] text-[#475569] uppercase tracking-wider">Condizione</span>
          <span className="text-[#3B82F6] font-black text-base">{ctl > 0 ? ctl.toFixed(0) : "—"}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] text-[#475569] uppercase tracking-wider">Fatica</span>
          <span className="text-[#F43F5E] font-black text-base">{atl > 0 ? atl.toFixed(0) : "—"}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] text-[#475569] uppercase tracking-wider">Equilibrio</span>
          <span className="font-black text-base" style={{ color: status.color }}>
            {tsb !== null ? (tsb >= 0 ? "+" : "") + tsb.toFixed(0) : "—"}
          </span>
        </div>
      </div>

      {/* Prontezza bar */}
      {readiness !== null && (
        <div>
          <div className="flex justify-between text-[9px] text-text-muted mb-1.5">
            <span>Prontezza</span>
            <span style={{ color: status.color }}>{readiness.toFixed(0)}%</span>
          </div>
          <div className="h-1 bg-[#1E293B] rounded-full">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${readiness}%`, backgroundColor: status.color }}
            />
          </div>
        </div>
      )}

      <div className="text-[9px] text-text-muted">{status.desc}</div>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white/5 rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      )}

      {/* ── 1) Stato di Forma + Ultima Corsa (mappa) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 mb-6" style={{ height: 220 }}>
        <StatoFormaCard dashData={dashData ?? null} />
        <SupercompensationChart currentFf={dashData?.current_ff ?? null} />
      </div>

      {/* ── 2) Main grid: RecentActivities | MainChart | RacePredictions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_1fr] gap-6 mb-6">
        {/* Left column — recent activities */}
        <div className="min-h-[500px] lg:h-[700px]">
          <RecentActivities runs={runs} />
        </div>

        {/* Center — volume chart */}
        <div className="min-h-[500px] lg:h-[700px]">
          <MainChart runs={runs} />
        </div>

        {/* Right — race predictions */}
        <div className="min-h-[500px] lg:h-[700px] overflow-y-auto">
          <RacePredictions
            runs={runs}
            vdot={vdot}
            racePredictions={racePredictions}
          />
        </div>
      </div>

      {/* ── 3) Zona Lattato + VO2Max — side by side 50/50 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <AnaerobicThreshold runs={runs} maxHr={dashData?.profile?.max_hr ?? 180} vdot={vdot} />
        <VO2MaxChart runs={runs} vdot={vdot} />
      </div>

      {/* ── 4) Fitness & Freshness — in fondo ── */}
      <FitnessFreshness
        fitnessFreshness={ffHistory}
        currentFf={dashData?.current_ff ?? null}
        prevCtl={prevCtl}
      />

      {/* TopStats mantienuto per compatibilità — nascosto visivamente tramite sostituzione con KpiCards */}
      <div className="hidden">
        <TopStats runs={runs} />
      </div>
    </main>
  );
}
