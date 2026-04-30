import { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import {
  Wind, TrendingDown, Activity, Target, Timer, Zap, Flame, Shield, Trophy, Info, RotateCcw,
  Sparkles, Plus, X,
} from "lucide-react";
// Use v1-compat API from `/legacy` entry (Responsive + WidthProvider HOC with flat props).
import { Responsive, WidthProvider } from "react-grid-layout/legacy";

const ResponsiveGrid = WidthProvider(Responsive);
import { GridCard } from "./GridCard";
import { FirstRunOnboarding } from "./FirstRunOnboarding";
import { InfoTooltip } from "./dashboard/widgets/InfoTooltip";
import { WeeklyKmChart } from "./dashboard/widgets/WeeklyKmChart";
import { useLayout } from "../context/LayoutContext";
import { WIDGET_REGISTRY } from "./dashboard/widgetRegistry";

// ─── media query hook (mobile detection) ─────────────────────────────────────
function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(query);
    const onChange = () => setMatch(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return match;
}

// InfoTooltip extracted to ./dashboard/widgets/InfoTooltip.tsx (round 6 #14)
import { LastRunMap } from "./LastRunMap";
import { FitnessChart } from "./dashboard/widgets/FitnessChart";
import { HRZones } from "./dashboard/widgets/HRZones";
import { NextOptimalSessionWidget } from "./dashboard/widgets/NextOptimalSessionWidget";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, CartesianGrid, Area, ComposedChart } from "recharts";
import { useApi } from "../hooks/useApi";
import { API_CACHE } from "../hooks/apiCacheKeys";
import { getDashboard, getRuns, getAnalytics, getBestEfforts, getVdotPaces, getDashboardInsight, getProfile } from "../api";
import type { DashboardResponse, RunsResponse, AnalyticsResponse, Run, BestEffort, FitnessFreshnessPoint, VdotPacesResponse, Profile } from "../types/api";
import { DetrainingWidget } from "./DetrainingWidget";
import { computeDrift as computeDriftCanonical } from "../utils/cardiacDrift";
import { parsePaceToSecs, secsToPaceStr, hmsToSecs, formatDuration, fmtPbTime } from "../utils/paceFormat";
import { buildRacePredictions } from "../utils/racePredictions";

// `bestPbTime` rimosso (round 6 — #3 dead code). Backend espone già le PB
// projections via `analytics.race_predictions` + `buildRacePredictions` util.

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


export function DashboardView() {
  const { data: dashData, loading: dashLoading, error: dashError, refetch: refetchDashboard } =
    useApi<DashboardResponse>(getDashboard, { cacheKey: API_CACHE.DASHBOARD });
  const { data: runsData, loading: runsLoading } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const { data: analyticsData } = useApi<AnalyticsResponse>(getAnalytics, { cacheKey: API_CACHE.ANALYTICS });
  const { data: effortsData } = useApi<{ efforts: BestEffort[] }>(getBestEfforts, { cacheKey: API_CACHE.BEST_EFFORTS });
  const { data: vdotPacesData } = useApi<VdotPacesResponse>(getVdotPaces, { cacheKey: API_CACHE.VDOT_PACES });
  const { data: profileData } = useApi<Profile>(getProfile, { cacheKey: API_CACHE.PROFILE });
  const { data: insightData } = useApi<{ insight: string | null }>(getDashboardInsight, { cacheKey: API_CACHE.DASHBOARD_INSIGHT });

  const navigate = useNavigate();
  const { t } = useTranslation();
  const { layouts, onLayoutChange, resetLayout, hiddenKeys, hideWidget, restoreWidget } = useLayout();
  const [openAddMenu, setOpenAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const interval = window.setInterval(refetchDashboard, 60 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [refetchDashboard]);
  useEffect(() => {
    if (!openAddMenu) return;
    const onClick = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setOpenAddMenu(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openAddMenu]);
  const hiddenMeta = WIDGET_REGISTRY.filter((w) => hiddenKeys.includes(w.key));
  const isMobile = useMediaQuery("(max-width: 767px)");
  // chartPeriod state moved into WeeklyKmChart widget (round 8 — #14)
  const runs = runsData?.runs ?? [];
  const vdot = analyticsData?.vdot ?? null;

  // First-run onboarding: nessuna corsa caricata e fetch completato →
  // mostra CTA Strava/Garmin invece della dashboard piena di skeleton vuoti.
  // Skip mentre runsLoading per evitare flash dell'onboarding al primo paint.
  const showOnboarding = !runsLoading && runsData !== null && runs.length === 0;

  const ff = dashData?.current_ff ?? null;
  const tsb = ff?.tsb ?? null;
  const ctl = ff?.ctl ?? 0;
  const atl = ff?.atl ?? 0;

  // Fatigue color — shared across Status of Form, Fatigue card, Next Optimal Session
  // Red when ATL > 50 (high fatigue), amber 30-50, green < 30
  const faticaColor = atl > 50 ? "#F43F5E" : atl > 30 ? "#F59E0B" : "#C0FF00";
  const faticaLabel = atl > 50 ? "HIGH" : atl > 30 ? "MODERATE" : "LOW";

  // Peak Score — map TSB [-40..+30] → [0..100]. Linear, clamped.
  // tsb=-30 → ~14, tsb=-10 → ~43, tsb=0 → ~57, tsb=+20 → ~86
  const readiness = tsb !== null ? Math.max(0, Math.min(100, ((tsb + 40) / 70) * 100)) : null;
  const gaugeOffset = readiness !== null ? 251.2 * (1 - readiness / 100) : 251.2;

  const status =
    tsb === null
      ? { label: "—",          color: "#64748B" }
      : tsb > 10
      ? { label: "FRESH",      color: "#C0FF00" }
      : tsb > -5
      ? { label: "NEUTRAL",    color: "#14B8A6" }
      : tsb > -20
      ? { label: "FATIGUED",   color: "#F59E0B" }
      : { label: "OVERLOADED", color: "#F43F5E" };

  // chartData / weeklyKmTotal moved into WeeklyKmChart widget (round 8 — #14).

  const avgPace = useMemo(() => {
    const recent = runs.slice(0, 5).filter((r) => !r.is_treadmill && r.avg_pace && parsePaceToSecs(r.avg_pace) > 100);
    if (!recent.length) return "--";
    const avg = recent.reduce((sum, r) => sum + parsePaceToSecs(r.avg_pace), 0) / recent.length;
    return secsToPaceStr(avg);
  }, [runs]);


  const profile = dashData?.profile;
  const maxHr = profile?.max_hr ?? 180;
  // Anaerobic threshold HR — Daniels: T-pace ~88% VO2max ≈ 88-90% HRmax
  // (not 92% → that's already VO2max / I-pace territory)
  const atHr = Math.round(maxHr * 0.88);
  const ltHr = Math.round(maxHr * 0.85);

  const raceDate = profile?.race_date;
  const timeToRace = raceDate ? timeUntil(raceDate) : null;
  const daysToRace = timeToRace?.days ?? null;

  const weekProgress = dashData?.week_progress;
  const nextSession = dashData?.next_session;

  const efficiency = tsb !== null
    ? Math.max(70, Math.min(100, 85 + tsb * 1.05))
    : null;
  const tsbValue = tsb !== null ? tsb.toFixed(1) : "—";
  const ctlValue = ctl > 0 ? ctl.toFixed(1) : "—";
  const effValue = efficiency !== null ? efficiency.toFixed(1) : "—";
  const atlValue = atl > 0 ? atl.toFixed(1) : "—";

  // ─── Human-friendly metaphors (no jargon) ─────────────────────────────
  const tsbMeta = (() => {
    if (tsb === null) return { icon: "🪫", label: "—", sub: "Dati non disponibili", color: "#64748B" };
    if (tsb > 10)   return { icon: "🔋", label: "Pieno",    sub: "Sei fresco, spingi!",        color: "#C0FF00" };
    if (tsb > -5)   return { icon: "🔋", label: "Buono",    sub: "Equilibrio perfetto",        color: "#14B8A6" };
    if (tsb > -15)  return { icon: "🪫", label: "Medio",    sub: "Fase di allenamento",        color: "#F59E0B" };
    if (tsb > -25)  return { icon: "🪫", label: "Scarico",  sub: "Recupera!",                  color: "#F59E0B" };
    return              { icon: "🔴", label: "Critico",  sub: "Stop, rischio infortuni",     color: "#F43F5E" };
  })();

  const ctlMeta = (() => {
    if (ctl <= 0)  return { icon: "🚗", label: "—",         sub: "Nessun dato"         };
    if (ctl < 20)  return { icon: "🛴", label: "Base",      sub: "In crescita"         };
    if (ctl < 35)  return { icon: "🚗", label: "Discreto",  sub: "Solido, continua"    };
    if (ctl < 55)  return { icon: "🏎️", label: "Potente",  sub: "Ottima base"         };
    if (ctl < 75)  return { icon: "🏎️", label: "Forte",    sub: "Atleta evoluto"      };
    return             { icon: "🚀", label: "Elite",     sub: "Top form"            };
  })();

  const atlMeta = (() => {
    if (atl <= 0)  return { icon: "💤", label: "—",         sub: "Nessun dato"            };
    if (atl < 20)  return { icon: "💨", label: "Leggero",   sub: "Molto calmo"            };
    if (atl < 35)  return { icon: "🔥", label: "Medio",     sub: "Attivo"                 };
    if (atl < 55)  return { icon: "🔥", label: "Alto",      sub: "Hai dato molto"         };
    return             { icon: "🌋", label: "Estremo",   sub: "Attenzione al recupero" };
  })();

  const effMeta = (() => {
    if (efficiency === null) return { icon: "⚡", label: "—",        sub: "Dati non disponibili" };
    if (efficiency >= 92)    return { icon: "⚡", label: "Piena",    sub: "Motore al top"        };
    if (efficiency >= 82)    return { icon: "⚡", label: "Buona",    sub: "Ritmo sostenibile"    };
    if (efficiency >= 75)    return { icon: "⚠️", label: "Ridotta",  sub: "Sei un po' stanco"    };
    return                       { icon: "⚠️", label: "Bassa",    sub: "Centralina in protezione" };
  })();

  // ─── PMC (Performance Management Chart) — last 30 days ────────────────
  const pmcData = useMemo(() => {
    const ff = dashData?.fitness_freshness ?? [];
    return ff.slice(-30).map((d) => ({
      date: d.date.slice(5),
      ctl: Number(d.ctl?.toFixed?.(1) ?? 0),
      atl: Number(d.atl?.toFixed?.(1) ?? 0),
      tsb: Number(d.tsb?.toFixed?.(1) ?? 0),
    }));
  }, [dashData?.fitness_freshness]);

  const neuroBar = Math.min(100, ctl);
  const metaboBar = Math.min(100, atl);
  const struttBar = tsb !== null ? Math.min(100, Math.max(0, 50 + tsb * 2)) : 0;

  // Cardiac drift uses the canonical util (src/utils/cardiacDrift.ts) — single
  // source of truth across the app (was previously a 3rd local copy here that
  // diverged from CardiacDrift.tsx and the official util — now removed).
  const driftFor = (r: Run): number | null => computeDriftCanonical(r)?.drift ?? null;

  const lastDrift = useMemo(() => {
    const qualifying = runs.find(r => r.distance_km >= 4 && r.splits?.length >= 4);
    return qualifying ? driftFor(qualifying) : null;
  }, [runs]);

  // Drift over last N qualifying runs (for Cardiac Drift card sparkline)
  const driftSeries = useMemo(() => {
    const out: { date: string; drift: number }[] = [];
    for (const r of runs) {
      if (out.length >= 12) break;
      const d = driftFor(r);
      if (d !== null) out.push({ date: r.date, drift: d });
    }
    return out.reverse(); // oldest → newest
  }, [runs]);

  // Threshold pace — Daniels T-pace dal VDOT (88% VO2max).
  // Fonte primaria = VDOT corrente (sempre affidabile).
  // Override solo se ≥3 corse recenti nel range HR 86–91% HRmax (vera soglia),
  // altrimenti il filtro largo mescola M-pace/I-pace e distorce la mediana.
  // Threshold pace migrato lato backend (round 5 — #3 math heavy → backend).
  // Backend ora calcola SIA Daniels formula SIA empirical override (mediana
  // tempo runs 86-91% HR) e li espone in `paces.threshold_empirical` /
  // `paces.threshold`. Client = sola visualizzazione: prefer empirical, fallback formula.
  const thresholdPace = vdotPacesData?.paces?.threshold_empirical
    ?? vdotPacesData?.paces?.threshold
    ?? null;

  const gpsRuns = runs.filter(r => !r.is_treadmill);
  const recentRuns = runs.slice(0, 7);
  const lastRun = gpsRuns[0] ?? null;

  // ── Sparkline: km settimanali ultimi 10 settimane (Status of Form nel tempo)
  const sparklinePoints = useMemo(() => {
    const weeks = Array.from({ length: 10 }, (_, i) => {
      const end = new Date(); end.setDate(end.getDate() - (9 - i) * 7 + 7);
      const start = new Date(end); start.setDate(end.getDate() - 7);
      return runs.filter(r => { const d = new Date(r.date); return d >= start && d < end; })
                 .reduce((s, r) => s + r.distance_km, 0);
    });
    const max = Math.max(...weeks, 1);
    // SVG path: 100×32, points spaced 11px apart
    const pts = weeks.map((v, i) => `${i * 11},${32 - (v / max) * 28}`).join(' ');
    return { pts, hasData: weeks.some(v => v > 0) };
  }, [runs]);

  // Hall of Fame — real PRs from /api/best-efforts (same as Profile)
  const allEfforts = effortsData?.efforts ?? [];
  const hofEfforts = useMemo(() => {
    const targets = ['5 km', '10 km', 'Mezza Maratona'];
    return targets.map(dist => allEfforts.find(e => e.distance === dist) ?? null);
  }, [allEfforts]);

  // ─── Race Predictions (Strava-style multi-distance) ────────────────────────
  // Target 4 distances: 5K, 10K, Half Marathon, Marathon.
  // Match loosely against prediction keys returned by /api/analytics.
  // Delta = impatto della ULTIMA corsa sulla previsione.
  //   Confronto pace ultima corsa vs mediana pace ultime 5 precedenti.
  //   Proiezione su distanza target via Riegel (deltaSec ≈ paceDelta_sec/km × D_km × (D_km/lastD)^0.06)
  const predictions = analyticsData?.race_predictions ?? {};

  // ── Previsione Gara — stimolo fisiologico dell'ultima corsa proiettato su 5K/10K/21K/42K
  // Logica estratta in `src/utils/racePredictions.ts` (pure function). Vedi nota
  // di migrazione in REPORT-TECNICO.md → ideale che viva in FastAPI.
  const racePredictions = useMemo(
    () => buildRacePredictions({ predictions, runs, thresholdPace }),
    [predictions, runs, thresholdPace],
  );

  // First-run onboarding gate (#6): zero corse → CTA Strava/Garmin.
  if (showOnboarding) {
    return <FirstRunOnboarding onImportClick={() => navigate("/activities")} />;
  }

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="px-14 py-6 max-w-[2200px] mx-auto space-y-6">

        {/* Header */}
        {dashLoading && <div className="h-10 bg-white/5 rounded-xl animate-pulse" />}
        {dashError && (
          <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
            Backend connection error: {dashError}
          </div>
        )}
        {dashData && (
          <div className="mb-2 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black italic tracking-tight text-white uppercase">
                {t("dashboard.greeting")}, {profile?.name || t("dashboard.runner")} 👋
              </h2>
              <p className="text-sm text-gray-500 font-medium mt-1">
                {profile?.race_goal}
                {raceDate && ` — ${raceDate}`}
                {daysToRace !== null && (
                  <span className="ml-3 text-[#C0FF00] font-black">{t("dashboard.daysToRace", { days: daysToRace })}</span>
                )}
              </p>
            </div>
            {!isMobile && (
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative" ref={addMenuRef}>
                  <button
                    type="button"
                    onClick={() => setOpenAddMenu((v) => !v)}
                    disabled={hiddenMeta.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[#666] hover:text-[#C0FF00] hover:border-[#C0FF00]/30 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-[#666] disabled:hover:border-white/[0.06] text-[10px] font-black tracking-widest transition-colors"
                    title="Ripristina widget nascosti"
                  >
                    <Plus size={12} />
                    AGGIUNGI WIDGET
                    {hiddenMeta.length > 0 && (
                      <span className="bg-[#C0FF00] text-black rounded-full px-1.5 text-[9px] leading-4">
                        {hiddenMeta.length}
                      </span>
                    )}
                  </button>
                  {openAddMenu && hiddenMeta.length > 0 && (
                    <div className="absolute right-0 mt-2 w-64 bg-[#1a1a1a] border border-white/[0.08] rounded-2xl shadow-2xl z-40 p-2">
                      <div className="text-[#666] text-[9px] font-black tracking-widest uppercase px-3 py-2">
                        Archivio ({hiddenMeta.length})
                      </div>
                      {hiddenMeta.map((w) => (
                        <button
                          key={w.key}
                          type="button"
                          onClick={() => {
                            restoreWidget(w.key);
                            setOpenAddMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 text-[12px] text-white hover:bg-white/[0.06] rounded-xl flex items-center justify-between group"
                        >
                          <span>{w.label}</span>
                          <Plus size={12} className="text-[#666] group-hover:text-[#C0FF00]" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (confirm("Ripristinare il layout predefinito?")) resetLayout();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[#666] hover:text-[#C0FF00] hover:border-[#C0FF00]/30 text-[10px] font-black tracking-widest transition-colors"
                  title="Ripristina posizioni widget"
                >
                  <RotateCcw size={12} />
                  RESET LAYOUT
                </button>
              </div>
            )}
          </div>
        )}

        <ResponsiveGrid
          className="layout"
          layouts={layouts as any}
          breakpoints={{ lg: 1200, md: 768, sm: 0 }}
          cols={{ lg: 12, md: 6, sm: 1 }}
          rowHeight={60}
          margin={[24, 24]}
          containerPadding={[0, 0]}
          isDraggable={!isMobile}
          isResizable={!isMobile}
          draggableHandle=".drag-handle"
          resizeHandles={['se']}
          onLayoutChange={onLayoutChange as any}
          useCSSTransforms={true}
        >

          {/* ── Status of Form ── */}
          {!hiddenKeys.includes("status-form") && (
          <div key="status-form">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("status-form")}>
            <div className="h-full bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-8 relative overflow-hidden flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="text-[#A0A0A0] text-xs font-black tracking-widest mb-2">LIVE BIO-FEED</div>
                <div className="flex items-center gap-2">
                  <h2 className="text-white text-4xl font-black tracking-tighter italic">{t("dashboard.statusOfForm")}</h2>
                  <InfoTooltip title="STATUS FORMA" lines={[
                    'CTL (Fitness): e il tuo "motore" costruito nel tempo. Piu e alto, piu sei allenato.',
                    "ATL (Stanchezza): lo stress accumulato negli ultimi giorni. Indica quanto hai spinto di recente.",
                    "TSB (Forma): il bilancio tra Fitness e Stanchezza. Ti dice se oggi sei al top o ko.",
                    "Valore TSB | Stato | Obiettivo",
                    "Sopra +10 | Fresco | Momento ideale per una gara o un record.",
                    "Tra -5 e +10 | Neutro | Fase di mantenimento della forma fisica.",
                    "Tra -20 e -5 | Stanco | Fase di carico: qui e dove diventi piu forte.",
                    "Sotto -20 | Alert | Troppo stress. Riposa per evitare infortuni.",
                    'EFF (Efficienza): indica quanto lavoro produci per ogni battito cardiaco. Piu e alta, piu il tuo motore e "economico".',
                    "PEAK SCORE (0-100): il tuo semaforo della freschezza. Piu e vicino a 100, piu sei pronto a dare il massimo della tua potenza."
                  ]} />
                </div>
              </div>
              <div
                className="px-3 py-1 rounded-full text-xs font-black tracking-wide flex items-center gap-2"
                style={{
                  color: faticaColor,
                  backgroundColor: faticaColor + "18",
                  border: `1px solid ${faticaColor}35`,
                }}
              >
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: faticaColor }} />
                {status.label === "FRESH" ? t("dashboard.fresh").toUpperCase()
                  : status.label === "NEUTRAL" ? t("dashboard.neutral").toUpperCase()
                  : status.label === "FATIGUED" ? t("dashboard.fatigued").toUpperCase()
                  : status.label === "OVERLOADED" ? t("dashboard.overloaded").toUpperCase()
                  : status.label}
              </div>
            </div>

            <div className="flex items-center justify-center gap-12 flex-1">
              {/* Gauge */}
              <div className="relative w-56 h-56 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100" overflow="visible">
                  <defs>
                    <filter id="gauge-glow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <circle cx="50" cy="50" r="40" stroke="#222" strokeWidth="9" fill="none" />
                  <circle
                    cx="50" cy="50" r="40"
                    stroke={faticaColor}
                    strokeWidth="9"
                    fill="none"
                    strokeDasharray="251.2"
                    strokeDashoffset={gaugeOffset}
                    strokeLinecap="round"
                    filter="url(#gauge-glow)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-black" style={{ color: faticaColor }}>
                    {readiness !== null ? readiness.toFixed(0) : "—"}
                  </span>
                  <span className="text-[#A0A0A0] text-xs font-black tracking-widest mt-1">{t("dashboard.peakScore").toUpperCase()}</span>
                </div>
              </div>

              {/* Metaphor stats col 1: Serbatoio (TSB) + Potenza (Efficiency) */}
              <div className="flex flex-col gap-4 min-w-[180px]">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase">Il tuo serbatoio</span>
                    <span className="text-[#C0FF00]/70 text-[9px] font-black tracking-widest">TSB</span>
                  </div>
                  <div className="text-[#555] text-[9px] font-semibold italic mb-1">quanto sei fresco oggi</div>
                  <div className="text-xl font-black whitespace-nowrap" style={{ color: tsbMeta.color }}>
                    <span className="mr-1.5 font-mono tabular-nums">{tsbValue}</span>{tsbMeta.label}
                  </div>
                  <div className="text-[#888] text-[11px] font-medium mt-0.5">{tsbMeta.sub}</div>
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase">Potenza attuale</span>
                    <span className="text-[#C0FF00]/70 text-[9px] font-black tracking-widest">EFF</span>
                  </div>
                  <div className="text-[#555] text-[9px] font-semibold italic mb-1">efficienza cuore vs ritmo</div>
                  <div className="text-white text-xl font-black whitespace-nowrap">
                    <span className="mr-1.5 font-mono tabular-nums">{effValue}</span>{effMeta.label}
                  </div>
                  <div className="text-[#888] text-[11px] font-medium mt-0.5">{effMeta.sub}</div>
                </div>
              </div>

              {/* Metaphor stats col 2: Motore (CTL) + Lavoro svolto (ATL) */}
              <div className="flex flex-col gap-4 min-w-[180px]">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase">Il tuo motore</span>
                    <span className="text-[#C0FF00]/70 text-[9px] font-black tracking-widest">CTL</span>
                  </div>
                  <div className="text-[#555] text-[9px] font-semibold italic mb-1">fitness media 42 giorni</div>
                  <div className="text-white text-xl font-black whitespace-nowrap">
                    <span className="mr-1.5 font-mono tabular-nums">{ctlValue}</span>{ctlMeta.label}
                  </div>
                  <div className="text-[#888] text-[11px] font-medium mt-0.5">{ctlMeta.sub}</div>
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase">Lavoro svolto</span>
                    <span className="text-[#C0FF00]/70 text-[9px] font-black tracking-widest">ATL</span>
                  </div>
                  <div className="text-[#555] text-[9px] font-semibold italic mb-1">carico ultimi 7 giorni</div>
                  <div className="text-white text-xl font-black whitespace-nowrap">
                    <span className="mr-1.5 font-mono tabular-nums">{atlValue}</span>{atlMeta.label}
                  </div>
                  <div className="text-[#888] text-[11px] font-medium mt-0.5">{atlMeta.sub}</div>
                </div>
              </div>
            </div>

            {/* PMC — Performance Management Chart (30d) */}
            {insightData?.insight && (
              <div className="mt-2 pt-2 border-t border-white/[0.06]">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="text-[#C0FF00] mt-0.5 shrink-0" size={14} />
                  <p className="text-[#A0A0A0] text-[12px] leading-snug whitespace-pre-line">
                    {insightData.insight}
                  </p>
                </div>
              </div>
            )}
            </div>
           </GridCard>
          </div>
          )}

          {/* ── VO2 Max ── */}
          {!hiddenKeys.includes("vo2max") && (
          <div key="vo2max">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("vo2max")}>
            <div className="h-full bg-[#1a1a1a] border border-white/[0.06] border-t-4 border-t-[#C0FF00] rounded-3xl p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <Wind className="text-[#C0FF00]" size={24} />
              <div className="bg-white/10 text-[#A0A0A0] px-2 py-1 rounded text-[10px] font-black tracking-widest">
                {t("dashboard.vdotScore").toUpperCase()}
              </div>
            </div>
            <div>
              <div className="text-[#A0A0A0] text-xs font-black tracking-widest mb-2">{t("dashboard.vo2MaxEst")}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-white text-5xl font-black tracking-tight">
                  {vdot !== null ? vdot.toFixed(1) : "—"}
                </span>
                <span className="text-[#A0A0A0] text-sm font-semibold">ml/kg/min</span>
              </div>
            </div>
            </div>
           </GridCard>
          </div>
          )}

          {/* ── Previsione Gara ── */}
          {!hiddenKeys.includes("previsione-gara") && (
          <div key="previsione-gara">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("previsione-gara")}>
            <div className="h-full bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Target className="text-[#C0FF00]" size={14} />
              <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest">PREVISIONE GARA</span>
            </div>

            <div className="flex-1 flex flex-col gap-1.5">
              {racePredictions.map(p => {
                const delta = p.deltaSec;
                const improved = delta !== null && delta < 0;
                const worsened = delta !== null && delta > 0;
                const deltaColor = improved ? "#16A34A" : worsened ? "#F43F5E" : "#64748B";
                const deltaBg    = improved ? "rgba(22,163,74,0.18)" : worsened ? "rgba(244,63,94,0.15)" : "rgba(100,116,139,0.12)";
                // Strava-style: "8m 22sec" when ≥60s, else "45sec"
                const fmtDelta = (s: number) => {
                  const a = Math.abs(s);
                  if (a >= 60) {
                    const m = Math.floor(a / 60);
                    const ss = a % 60;
                    return `${m}m ${ss.toString().padStart(2, "0")}sec`;
                  }
                  return `${a}sec`;
                };
                return (
                  <div
                    key={p.short}
                    className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                  >
                    <span className="text-[#A0A0A0] text-[11px] font-black tracking-widest w-10">
                      {p.short}
                    </span>
                    <span className="text-white text-sm font-black font-mono flex-1 text-center">
                      {p.timeStr ?? "—"}
                    </span>
                    {delta !== null && delta !== 0 ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold"
                        style={{ background: deltaBg, color: deltaColor }}
                      >
                        <span className="leading-none">{improved ? "▼" : "▲"}</span>
                        <span className="leading-none font-mono">{fmtDelta(delta)}</span>
                      </span>
                    ) : (
                      <span className="text-[#555] text-[9px] font-black tracking-widest uppercase">—</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-[#555] text-[9px] tracking-wider mt-3 text-center">
              stimolo fisiologico ultima corsa → beneficio per distanza
            </div>
            </div>
           </GridCard>
          </div>
          )}

          {/* ── Detraining (taper vs fermo totale) ── */}
          {!hiddenKeys.includes("detraining") && (
          <div key="detraining">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("detraining")}>
            <DetrainingWidget
              profile={profileData ?? null}
              runs={runs}
              vdot={vdot}
              base5kSec={racePredictions.find(p => p.short === '5K')?.secs ?? null}
            />
           </GridCard>
          </div>
          )}

          {/* ── Fatigue ATL ── */}
          {!hiddenKeys.includes("fatigue-atl") && (
          <div key="fatigue-atl">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("fatigue-atl")}>
            <div
              className="h-full rounded-3xl p-6 flex flex-col justify-between"
              style={{ backgroundColor: faticaColor }}
            >
            <div className="flex justify-between items-start">
              <TrendingDown className="text-black/70" size={24} />
              <div className="bg-black/10 text-black/70 px-2 py-1 rounded text-[10px] font-black tracking-widest">
                {faticaLabel}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-black/60 text-xs font-black tracking-widest">{t("dashboard.fatigueATL").toUpperCase()}</span>
                <InfoTooltip title="FATIGUE — ATL" lines={[
                  "ATL (Acute Training Load) = carico ultimi 7 giorni. Media mobile esponenziale.",
                  "ATL > 80: HIGH RISK — recupero insufficiente.",
                  "ATL 30-80: MODERATE — zona di sviluppo.",
                  "ATL < 30: LOW — fresco, carico sostenibile.",
                  "Formula TRIMP (Lucia): durata × HR_reserve × fattore esponenziale.",
                  "Aumenta dopo ogni allenamento intenso, decade in ~7 giorni."
                ]} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-black text-5xl font-black tracking-tight">
                  {atl > 0 ? atl.toFixed(1) : "—"}
                </span>
                <span className="text-black/60 text-sm font-black">{faticaLabel}</span>
              </div>
            </div>
            </div>
           </GridCard>
          </div>
          )}

          {/* ── Soglia Anaerobica ── */}
          {!hiddenKeys.includes("soglia") && (
          <div key="soglia">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("soglia")}>
            <div className="h-full bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 flex flex-col justify-between">
            <div className="text-[#A0A0A0] text-[10px] font-black tracking-widest mb-4">{t("dashboard.anaerobicThreshold").toUpperCase()}</div>
            <div className="flex items-stretch gap-5 mb-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-white text-3xl font-black">{atHr}</span>
                  <span className="text-[#A0A0A0] text-xs">BPM</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-[#F43F5E] inline-block" />
                  <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase">FC</span>
                </div>
              </div>
              <div className="w-px bg-white/[0.08]" />
              <div className="flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-white text-3xl font-black">{thresholdPace ?? "—"}</span>
                  <span className="text-[#A0A0A0] text-xs">/km</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-[#60A5FA] inline-block" />
                  <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase">Passo</span>
                </div>
              </div>
            </div>
            <div className="flex gap-1 h-1.5 mt-auto">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`flex-1 rounded-full ${i < 4 ? "bg-[#F43F5E]" : "bg-[#333]"}`} />
              ))}
            </div>
            </div>
           </GridCard>
          </div>
          )}

          {/* ── Deriva Cardiaca ── */}
          {!hiddenKeys.includes("deriva") && (
          <div key="deriva">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("deriva")}>
            <div className="h-full bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-[#A0A0A0] text-[10px] font-black tracking-widest">
                {t("dashboard.cardiacDrift").toUpperCase()}
              </div>
              {lastDrift !== null && (() => {
                const abs = Math.abs(lastDrift);
                const col = abs < 3.5 ? "#C0FF00" : abs < 5 ? "#F59E0B" : "#F43F5E";
                const lbl = abs < 3.5 ? "Ottima" : abs < 5 ? "Normale" : "Elevata";
                return (
                  <span
                    className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase"
                    style={{ background: `${col}15`, border: `1px solid ${col}44`, color: col }}
                  >
                    {lbl}
                  </span>
                );
              })()}
            </div>

            {/* Big value */}
            <div className="flex items-baseline gap-2 mb-1">
              <span
                className="text-5xl font-black"
                style={{
                  color: lastDrift === null ? "#666"
                    : Math.abs(lastDrift) < 3.5 ? "#C0FF00"
                    : Math.abs(lastDrift) < 5 ? "#F59E0B" : "#F43F5E",
                }}
              >
                {lastDrift !== null ? (lastDrift >= 0 ? "+" : "") + lastDrift.toFixed(1) : "—"}
              </span>
              <span className="text-[#A0A0A0] text-sm font-black">%</span>
            </div>
            <div className="text-[#666] text-[10px] tracking-wider mb-4">
              ΔFC 2ª metà vs 1ª metà · ultima corsa
            </div>

            {/* Stats grid — media / migliore / peggiore over last qualifying runs */}
            {driftSeries.length >= 2 ? (() => {
              const vals = driftSeries.map(d => Math.abs(d.drift));
              const media = vals.reduce((s, v) => s + v, 0) / vals.length;
              const best = Math.min(...vals);
              const worst = Math.max(...vals);
              const colorFor = (v: number) => v < 3.5 ? "#C0FF00" : v < 5 ? "#F59E0B" : "#F43F5E";
              const Row = ({ label, value, color }: { label: string; value: string; color: string }) => (
                <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                  <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                    <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase">{label}</span>
                  </div>
                  <span className="text-white text-sm font-black font-mono" style={{ color }}>{value}</span>
                </div>
              );
              return (
                <div className="flex-1 flex flex-col justify-center">
                  <div className="text-[#A0A0A0] text-[9px] font-black tracking-widest uppercase mb-1">
                    Ultime {driftSeries.length} corse
                  </div>
                  <Row label="Media"    value={`${media.toFixed(1)}%`} color={colorFor(media)} />
                  <Row label="Migliore" value={`${best.toFixed(1)}%`}  color={colorFor(best)} />
                  <Row label="Peggiore" value={`${worst.toFixed(1)}%`} color={colorFor(worst)} />
                </div>
              );
            })() : (
              <div className="flex-1 flex items-center justify-center text-[#666] text-[10px] font-black tracking-widest uppercase">
                dati insufficienti
              </div>
            )}

            {/* Scale bar */}
            <div className="flex gap-1 h-1 mt-3">
              {[...Array(6)].map((_, i) => {
                const driftPct = lastDrift !== null ? Math.abs(lastDrift) : 0;
                const filled = Math.round(Math.min(6, driftPct / 2));
                const color = driftPct < 3.5 ? "#C0FF00" : driftPct < 5 ? "#F59E0B" : "#F43F5E";
                return <div key={i} className="flex-1 rounded-full" style={{ backgroundColor: i < filled ? color : "#333" }} />;
              })}
            </div>
            </div>
           </GridCard>
          </div>
          )}

          {/* ── Weekly KM Chart ── (extracted round 8 — #14) */}
          {!hiddenKeys.includes("weekly-km") && (
          <div key="weekly-km">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("weekly-km")} scope="WeeklyKmChart">
            <WeeklyKmChart runs={runs} />
           </GridCard>
          </div>
          )}

          {/* ── Last Run Map ── */}
          {!hiddenKeys.includes("last-run-map") && (
          <div key="last-run-map">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("last-run-map")}>
            <div className="h-full rounded-3xl overflow-hidden relative">
              <div className="absolute inset-0">
                <LastRunMap run={lastRun} />
              </div>
            </div>
           </GridCard>
          </div>
          )}

          {/* ── Next Optimal Session ── */}
          {!hiddenKeys.includes("next-optimal") && (
          <div key="next-optimal">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("next-optimal")}>
            <div className="h-full">
              <NextOptimalSessionWidget tsb={tsb} atl={atl} ctl={ctl} runs={runs} faticaColor={faticaColor} />
            </div>
           </GridCard>
          </div>
          )}

          {/* ── HR Zones ── */}
          {!hiddenKeys.includes("hr-zones") && (
          <div key="hr-zones">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("hr-zones")}>
            <div className="h-full">
              <HRZones lastRun={lastRun} />
            </div>
           </GridCard>
          </div>
          )}

          {/* ── Fitness Chart ── */}
          {!hiddenKeys.includes("fitness-chart") && (
          <div key="fitness-chart">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("fitness-chart")}>
            <FitnessChart ff={dashData?.fitness_freshness} />
           </GridCard>
          </div>
          )}

          {/* ── Training Paces ── */}
          {!hiddenKeys.includes("training-paces") && (
          <div key="training-paces">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("training-paces")}>
            {(() => {
              const vdot = vdotPacesData?.vdot ?? analyticsData?.vdot;
              const paces = vdotPacesData?.paces;

              const zones: { key: string; label: string; abbr: string; color: string; desc: string }[] = [
                { key: "easy",       label: "Easy / Long Run",        abbr: "E", color: "#60A5FA", desc: "Corsa facile, recupero" },
                { key: "marathon",   label: "Marathon Pace",          abbr: "M", color: "#34D399", desc: "Lungo specifico maratona" },
                { key: "threshold",  label: "Threshold / Tempo",      abbr: "T", color: "#F59E0B", desc: "Tempo run 20-40 min" },
                { key: "interval",   label: "Interval (VO2max)",      abbr: "I", color: "#F43F5E", desc: "Ripetute 800m-1600m" },
                { key: "repetition", label: "Repetition / Speed",     abbr: "R", color: "#C0FF00", desc: "Ripetizioni 200-400m" },
              ];

              // Compute range ±5% intorno al passo centrale Daniels
              const parseSecsPace = (p: string | null | undefined): number | null => {
                if (!p || !p.includes(":")) return null;
                const [m, s] = p.split(":").map(Number);
                return m * 60 + s;
              };
              const fmtSecs = (s: number): string =>
                `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

              return (
                <div className="h-full bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-5 flex flex-col overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4 shrink-0">
                    <div>
                      <div className="text-[#A0A0A0] text-[9px] font-black tracking-[0.2em] uppercase">
                        Training Paces
                      </div>
                      <div className="text-white text-xs font-black italic tracking-tight mt-0.5">
                        Zone Daniels personalizzate
                      </div>
                    </div>
                    {vdot && (
                      <div className="flex flex-col items-end">
                        <span className="text-[#A0A0A0] text-[9px] font-black tracking-widest uppercase">VDOT</span>
                        <span className="text-[#C0FF00] text-xl font-black leading-none">{vdot.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  {/* Column headers */}
                  {paces ? (
                    <>
                      <div className="grid grid-cols-[28px_1fr_auto] gap-x-3 text-[9px] font-black tracking-widest text-[#555] uppercase mb-2 px-1 shrink-0">
                        <div />
                        <div>Zone</div>
                        <div className="text-right">Passo</div>
                      </div>

                      <div className="flex flex-col gap-2 flex-1 overflow-hidden">
                        {zones.map(z => {
                          const centerSecs = parseSecsPace(paces[z.key as keyof typeof paces]);
                          if (!centerSecs) return null;
                          const loSecs = Math.round(centerSecs * 0.97);
                          const hiSecs = Math.round(centerSecs * 1.03);
                          return (
                            <div key={z.key}
                              className="grid grid-cols-[28px_1fr_auto] gap-x-3 items-center px-1 py-2 rounded-xl"
                              style={{ background: `${z.color}08`, border: `1px solid ${z.color}18` }}
                            >
                              {/* Abbr badge */}
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black"
                                style={{ background: `${z.color}22`, color: z.color }}
                              >
                                {z.abbr}
                              </div>

                              {/* Name + desc */}
                              <div className="min-w-0">
                                <div className="text-white text-[11px] font-black truncate">{z.label}</div>
                                <div className="text-[#555] text-[9px] truncate">{z.desc}</div>
                              </div>

                              {/* Pace range */}
                              <div className="text-right">
                                <div className="font-black font-mono text-[11px]" style={{ color: z.color }}>
                                  {fmtSecs(loSecs)} – {fmtSecs(hiSecs)}
                                </div>
                                <div className="text-[#555] text-[9px]">min/km</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer note */}
                      <div className="text-[#444] text-[9px] tracking-wider mt-3 shrink-0 text-center">
                        basate su formula Daniels 2013 · aggiornate automaticamente
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2">
                      <div className="text-[#555] text-[9px] font-black tracking-widest uppercase text-center">
                        {vdot ? "Calcolo paces…" : "Nessun dato VDOT disponibile"}
                      </div>
                      {!vdot && (
                        <div className="text-[#444] text-[9px] text-center">
                          Registra una corsa a sforzo medio-alto per calibrare il VDOT
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
           </GridCard>
          </div>
          )}

          {/* ── Session Logs ── */}
          {!hiddenKeys.includes("session-logs") && (
          <div key="session-logs">
           <GridCard disabled={isMobile} onRemove={() => hideWidget("session-logs")}>
          {recentRuns.length > 0 ? (
            <div className="h-full bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-8 w-full overflow-auto">
            <div className="mb-8">
              <div className="text-[#A0A0A0] text-xs font-black tracking-widest mb-2">{t("dashboard.sessionLogs").toUpperCase()}</div>
              <h2 className="text-white text-2xl font-black tracking-tighter italic">{t("dashboard.performanceHistory")}</h2>
            </div>

            <div className="w-full">
              <div className="grid grid-cols-7 text-[#A0A0A0] text-[10px] font-black tracking-widest mb-4 px-4">
                <div className="col-span-2">{t("dashboard.type")}</div>
                <div>{t("dashboard.date")}</div>
                <div>{t("dashboard.duration")}</div>
                <div>{t("dashboard.avgPace").toUpperCase()}</div>
                <div>{t("dashboard.teScore")}</div>
                <div className="text-right">{t("dashboard.status")}</div>
              </div>
              <div className="space-y-2">
                {recentRuns.map((run: Run) => {
                  const hrPct = run.avg_hr_pct != null
                    ? (run.avg_hr_pct > 1 ? run.avg_hr_pct / 100 : run.avg_hr_pct)
                    : null;
                  const teRaw = hrPct !== null ? hrPct * 5 : null;
                  const teLabel =
                    teRaw === null ? "—"
                    : teRaw >= 4 ? t("dashboard.highlyAerobic").toUpperCase()
                    : teRaw >= 3 ? t("dashboard.aerobic").toUpperCase()
                    : teRaw >= 2 ? t("dashboard.recovery").toUpperCase()
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
                        ● {t("dashboard.verified").toUpperCase()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-[#666] text-[10px] font-black tracking-widest">
              NESSUNA CORSA RECENTE
            </div>
          )}
           </GridCard>
          </div>
          )}

        </ResponsiveGrid>
      </div>
    </main>
  );
}
