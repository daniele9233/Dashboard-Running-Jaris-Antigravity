import { TopStats } from "./TopStats";
import { RecentActivities } from "./RecentActivities";
import { MainChart } from "./MainChart";
import { AnaerobicThreshold } from "./AnaerobicThreshold";
import { FitnessFreshness } from "./FitnessFreshness";
import { RacePredictions } from "./RacePredictions";
import { VO2MaxChart } from "./VO2MaxChart";
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

// ─── KPI Cards row ────────────────────────────────────────────────────────────
interface KpiCardsProps {
  runs: Run[];
  vdot: number | null;
  dashData: DashboardResponse | null;
}

function KpiCards({ runs, vdot, dashData }: KpiCardsProps) {
  // Total Distance questa settimana
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1); // lunedì
  startOfWeek.setHours(0, 0, 0, 0);
  const weekKm = runs
    .filter((r) => new Date(r.date) >= startOfWeek)
    .reduce((s, r) => s + r.distance_km, 0);

  // Weekly KM last week for % change
  const lastWeekStart = new Date(startOfWeek);
  lastWeekStart.setDate(startOfWeek.getDate() - 7);
  const lastWeekKm = runs
    .filter((r) => {
      const d = new Date(r.date);
      return d >= lastWeekStart && d < startOfWeek;
    })
    .reduce((s, r) => s + r.distance_km, 0);
  const weekPct = lastWeekKm > 0 ? Math.round(((weekKm - lastWeekKm) / lastWeekKm) * 100) : null;

  // Stato forma da TSB
  const tsb = dashData?.current_ff?.tsb ?? null;
  const formLabel =
    tsb === null ? "—" : tsb > 5 ? "Fresco" : tsb > -10 ? "Neutro" : tsb > -20 ? "Affaticato" : "Sovracc.";
  const formColor =
    tsb === null
      ? "#64748B"
      : tsb > 5
      ? "#C0FF00"
      : tsb > -10
      ? "#14B8A6"
      : tsb > -20
      ? "#F59E0B"
      : "#F43F5E";

  // Prossimo obiettivo
  const nextTitle =
    dashData?.next_session?.title ??
    (dashData?.profile?.race_goal ? dashData.profile.race_goal : null);
  const nextSub = dashData?.profile?.race_date
    ? `${daysUntil(dashData.profile.race_date)} gg alla gara`
    : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Distance */}
      <div className="bg-bg-card border border-[#1E293B] rounded-xl p-4 flex flex-col justify-between">
        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">
          Distanza Sett.
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-white">
            {weekKm > 0 ? weekKm.toFixed(1) : "0"}
          </span>
          <span className="text-sm text-gray-500">km</span>
          {weekPct !== null && (
            <span
              className={`text-xs font-bold px-1.5 py-0.5 rounded ml-auto ${
                weekPct >= 0
                  ? "text-[#14B8A6] bg-[#14B8A6]/10"
                  : "text-[#F43F5E] bg-[#F43F5E]/10"
              }`}
            >
              {weekPct >= 0 ? "+" : ""}
              {weekPct}%
            </span>
          )}
        </div>
        <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Questa settimana</div>
      </div>

      {/* VO2Max */}
      <div className="bg-bg-card border border-[#1E293B] rounded-xl p-4 flex flex-col justify-between">
        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">
          VO2 Max
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-[#C0FF00]">
            {vdot != null ? vdot.toFixed(1) : "—"}
          </span>
          {vdot != null && <span className="text-sm text-gray-500">VDOT</span>}
        </div>
        <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">
          {vdot != null
            ? vdot > 55
              ? "Elite"
              : vdot > 45
              ? "Avanzato"
              : vdot > 35
              ? "Intermedio"
              : "Principiante"
            : "Aggiungi corse"}
        </div>
      </div>

      {/* Stato di Forma */}
      <div className="bg-bg-card border border-[#1E293B] rounded-xl p-4 flex flex-col justify-between">
        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">
          Stato di Forma
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black" style={{ color: formColor }}>
            {formLabel}
          </span>
        </div>
        <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">
          {tsb !== null ? `TSB ${tsb > 0 ? "+" : ""}${tsb.toFixed(0)}` : "Fitness & Freshness"}
        </div>
      </div>

      {/* Prossimo Obiettivo */}
      <div className="bg-bg-card border border-[#1E293B] rounded-xl p-4 flex flex-col justify-between">
        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">
          Prossimo Obiettivo
        </div>
        <div className="text-base font-black text-white leading-tight line-clamp-2">
          {nextTitle ?? "—"}
        </div>
        {nextSub && (
          <div className="text-[10px] text-[#C0FF00] font-bold uppercase tracking-widest mt-1">
            {nextSub}
          </div>
        )}
      </div>
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

      {/* ── 1) KPI Row — 4 cards ── */}
      {runs.length > 0 || dashData ? (
        <KpiCards runs={runs} vdot={vdot} dashData={dashData ?? null} />
      ) : null}

      {/* ── 2) Main grid: RecentActivities left + MainChart right ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 mb-6">
        {/* Left column — recent activities */}
        <div className="min-h-[500px] lg:h-[700px]">
          <RecentActivities runs={runs} />
        </div>

        {/* Right chart */}
        <div className="min-h-[500px] lg:h-[700px]">
          <MainChart runs={runs} />
        </div>
      </div>

      {/* ── 3) Fitness & Freshness — full width ── */}
      <div className="mb-6">
        <FitnessFreshness
          fitnessFreshness={ffHistory}
          currentFf={dashData?.current_ff ?? null}
          prevCtl={prevCtl}
        />
      </div>

      {/* ── 4) Zona Lattato + VO2Max — side by side 50/50 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <AnaerobicThreshold runs={runs} maxHr={dashData?.profile?.max_hr ?? 180} />
        <VO2MaxChart runs={runs} vdot={vdot} />
      </div>

      {/* ── 5) Race Predictions — full width ── */}
      <div className="mb-6">
        <RacePredictions
          runs={runs}
          vdot={vdot}
          racePredictions={racePredictions}
        />
      </div>

      {/* TopStats mantienuto per compatibilità — nascosto visivamente tramite sostituzione con KpiCards */}
      <div className="hidden">
        <TopStats runs={runs} />
      </div>
    </main>
  );
}
