/**
 * ATHLETE POTENTIAL VECTOR
 * Editorial-style race potential analysis.
 * Replaces RacePredictionsGrid + FitnessEvolutionGrid + RaceForecastLab.
 *
 * Real data sources:
 * - vdot → projected race times (Daniels) for 5K/10K/HM/FM
 * - runs → capacity evolution chart (avg pace per period)
 * - ffHistory → fatigue index (latest TSB)
 * - thresholdPace → lactate clearance indicator
 */
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Run, FitnessFreshnessPoint } from "../../types/api";

// ─── COLORS (site palette) ────────────────────────────────────────────────────
const NEON = "#C0FF00";
const AMBER = "#F59E0B";
const ROSE = "#F43F5E";
const CYAN = "#06FFA5";

// ─── DISTANCES ───────────────────────────────────────────────────────────────
const DISTANCES = [
  { id: "5k",  label: "5.0KM",   title: "5.000 METRI",        km: 5 },
  { id: "10k", label: "10.0KM",  title: "10.000 METRI",       km: 10 },
  { id: "hm",  label: "21.1KM",  title: "MEZZA MARATONA",     km: 21.0975 },
  { id: "fm",  label: "42.2KM",  title: "MARATONA",           km: 42.195 },
] as const;
type DistanceId = (typeof DISTANCES)[number]["id"];

const TIME_RANGES = [
  { id: "7d",  label: "7G",  days: 7 },
  { id: "30d", label: "30G", days: 30 },
  { id: "90d", label: "90G", days: 90 },
  { id: "all", label: "TUTTO", days: 720 },
] as const;
type RangeId = (typeof TIME_RANGES)[number]["id"];

// ─── MATH (Daniels VDOT) ─────────────────────────────────────────────────────
function parsePaceDec(pace: string): number {
  if (!pace) return 0;
  const [m, s] = pace.split(":").map(Number);
  if (isNaN(m) || isNaN(s)) return 0;
  return m + s / 60;
}

function vdotForRaceTime(distanceKm: number, durationMin: number): number {
  // velocity in m/min (Daniels formula requires m/min)
  const velocity = (distanceKm * 1000) / durationMin;
  const vo2 = -4.60 + 0.182258 * velocity + 0.000104 * velocity * velocity;
  const pct = 0.8
    + 0.1894393 * Math.exp(-0.012778 * durationMin)
    + 0.2989558 * Math.exp(-0.1932605 * durationMin);
  return vo2 / pct;
}

function predictRaceSec(vdot: number, distanceKm: number): number {
  let lo = distanceKm * 50, hi = distanceKm * 600;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (vdotForRaceTime(distanceKm, mid / 60) > vdot) lo = mid; else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

function fmtTime(secs: number): string {
  if (!secs || secs <= 0) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.round(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtPaceFromSec(secs: number, distKm: number): string {
  const ps = secs / distKm;
  const m = Math.floor(ps / 60);
  const s = Math.round(ps % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtSignedTime(secs: number): string {
  if (!Number.isFinite(secs) || secs === 0) return "0:00";
  const sign = secs < 0 ? "-" : "+";
  const abs = Math.abs(secs);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = Math.round(abs % 60);
  if (h > 0) return `${sign}${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}

// ─── PROPS ───────────────────────────────────────────────────────────────────
export interface AthletePotentialVectorProps {
  vdot: number | null;
  runs?: Run[];
  ffHistory?: FitnessFreshnessPoint[];
  thresholdPace?: string | null;
  maxHr?: number;
  /** Optional: VDOT history monthly. If not provided, derived from runs. */
  vdotHistory?: { date: string; vdot: number }[];
}

// ─── CUSTOM TOOLTIP ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#0E0E0E] border border-white/[0.08] rounded-xl px-4 py-3 shadow-2xl min-w-[150px]">
      <p className="text-[#888] font-mono text-[10px] mb-2 font-bold tracking-wider">{d.displayDate}</p>
      <div className="flex justify-between items-center mb-1.5 gap-4">
        <span className="text-[#666] text-[10px] font-black tracking-wider uppercase">Tempo</span>
        <span className="text-[#C0FF00] font-mono font-black text-sm tabular-nums">{d.tempo}</span>
      </div>
      <div className="flex justify-between items-center gap-4">
        <span className="text-[#666] text-[10px] font-black tracking-wider uppercase">Passo</span>
        <span className="text-white font-mono font-black text-sm tabular-nums">{d.pace}</span>
      </div>
    </div>
  );
};

// ─── TREND ARROW ─────────────────────────────────────────────────────────────
function TrendIndicator({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <span className="font-mono text-xs mt-1 text-[#C0FF00]">↗ In crescita</span>;
  if (trend === "down") return <span className="font-mono text-xs mt-1 text-[#F59E0B]">↘ In calo</span>;
  return <span className="font-mono text-xs mt-1 text-[#666]">→ Stabile</span>;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export function AthletePotentialVector({
  vdot,
  runs = [],
  ffHistory = [],
  thresholdPace,
  maxHr,
}: AthletePotentialVectorProps) {
  const [activeDistance, setActiveDistance] = useState<DistanceId>("hm");
  const [timeRange, setTimeRange] = useState<RangeId>("30d");

  // ── Resolve current + previous VDOT ──────────────────────────────────────
  const currentVdot = vdot ?? 45;

  // ── Athlete profile snapshot (real data) ─────────────────────────────────
  const athleteSnapshot = useMemo(() => {
    const now = Date.now();
    const last7 = runs.filter(r => !r.is_treadmill && (now - new Date(r.date).getTime()) / 86400000 <= 7);
    const last30 = runs.filter(r => !r.is_treadmill && (now - new Date(r.date).getTime()) / 86400000 <= 30);
    const last90 = runs.filter(r => !r.is_treadmill && (now - new Date(r.date).getTime()) / 86400000 <= 90);

    const km7 = last7.reduce((s, r) => s + (r.distance_km ?? 0), 0);
    const km30 = last30.reduce((s, r) => s + (r.distance_km ?? 0), 0);
    const hours90 = last90.reduce((s, r) => s + (r.duration_minutes ?? 0), 0) / 60;

    // Level from VDOT
    let levelLabel = "PRINCIPIANTE", levelColor = ROSE;
    if (currentVdot >= 60) { levelLabel = "ELITE"; levelColor = NEON; }
    else if (currentVdot >= 52) { levelLabel = "AVANZATO"; levelColor = "#A78BFA"; }
    else if (currentVdot >= 47) { levelLabel = "ESPERTO"; levelColor = "#38BDF8"; }
    else if (currentVdot >= 40) { levelLabel = "BUONO"; levelColor = CYAN; }
    else if (currentVdot >= 32) { levelLabel = "INTERMEDIO"; levelColor = AMBER; }

    // Latest CTL/ATL/TSB
    const latest = ffHistory.length ? ffHistory[ffHistory.length - 1] : null;
    const ctl = latest ? Math.round(latest.ctl) : null;
    const tsb = latest ? Math.round(latest.tsb) : null;
    let formLabel = "—", formColor = "#666";
    if (tsb !== null) {
      if (tsb >= 5) { formLabel = "Fresco"; formColor = NEON; }
      else if (tsb >= -10) { formLabel = "Ottimale"; formColor = CYAN; }
      else if (tsb >= -25) { formLabel = "Carico"; formColor = AMBER; }
      else { formLabel = "Affaticato"; formColor = ROSE; }
    }

    return {
      km7: Math.round(km7 * 10) / 10,
      km30: Math.round(km30),
      hours90: Math.round(hours90),
      runs30: last30.length,
      levelLabel, levelColor,
      ctl, tsb, formLabel, formColor,
    };
  }, [runs, ffHistory, currentVdot]);

  // VDOT 90 days ago: estimate from runs of that period
  const vdot90DaysAgo = useMemo(() => {
    if (!runs.length) return null;
    const now = Date.now();
    const min = now - 180 * 86400000;
    const max = now - 90 * 86400000;
    const window = runs.filter(r => {
      const ts = new Date(r.date).getTime();
      return ts >= min && ts <= max && !r.is_treadmill && r.distance_km >= 5 && r.avg_pace;
    });
    if (!window.length) return null;
    // Best run in that window → estimate VDOT
    const best = window.reduce((p, c) =>
      parsePaceDec(c.avg_pace) < parsePaceDec(p.avg_pace) ? c : p);
    return vdotForRaceTime(best.distance_km, best.duration_minutes);
  }, [runs]);

  // ── Active distance data ─────────────────────────────────────────────────
  const activeDistMeta = DISTANCES.find(d => d.id === activeDistance)!;

  // ── Predicted time + pace + delta ────────────────────────────────────────
  const predictionData = useMemo(() => {
    const secs = predictRaceSec(currentVdot, activeDistMeta.km);
    const pace = fmtPaceFromSec(secs, activeDistMeta.km);
    const prevSecs = vdot90DaysAgo ? predictRaceSec(vdot90DaysAgo, activeDistMeta.km) : null;
    const deltaSec = prevSecs !== null ? secs - prevSecs : null;
    return {
      time: fmtTime(secs),
      pace: `${pace}/km`,
      delta: deltaSec !== null ? fmtSignedTime(deltaSec) : null,
      deltaIsFaster: deltaSec !== null && deltaSec < 0,
      secs,
    };
  }, [currentVdot, vdot90DaysAgo, activeDistMeta]);

  // ── Real factors from data ───────────────────────────────────────────────
  const factors = useMemo(() => {
    const now = Date.now();
    const last30 = runs.filter(r => !r.is_treadmill && (now - new Date(r.date).getTime()) / 86400000 <= 30);
    const last90 = runs.filter(r => !r.is_treadmill && (now - new Date(r.date).getTime()) / 86400000 <= 90);

    // 1) Aerobic efficiency: % HR vs maxHR at threshold-ish runs
    const easyRuns = last30.filter(r => r.distance_km >= 8 && (r.avg_hr_pct ?? 0) > 0 && (r.avg_hr_pct ?? 0) < 85);
    const avgHrPct = easyRuns.length
      ? easyRuns.reduce((s, r) => s + (r.avg_hr_pct ?? 0), 0) / easyRuns.length
      : 0;
    const aerobicScore = avgHrPct > 0 ? Math.round(100 - (avgHrPct - 60) * 0.8) : null;
    const aerobicTrend: "up" | "down" | "stable" =
      aerobicScore === null ? "stable" : aerobicScore >= 88 ? "up" : aerobicScore >= 75 ? "stable" : "down";

    // 2) Lactate clearance: threshold pace existence + threshold quality
    let lactateLabel = "—";
    let lactateTrend: "up" | "down" | "stable" = "stable";
    if (thresholdPace) {
      const tPaceSec = parsePaceDec(thresholdPace) * 60;
      if (tPaceSec < 240) { lactateLabel = "Eccellente"; lactateTrend = "up"; }
      else if (tPaceSec < 280) { lactateLabel = "Alta"; lactateTrend = "up"; }
      else if (tPaceSec < 320) { lactateLabel = "Media"; lactateTrend = "stable"; }
      else { lactateLabel = "Bassa"; lactateTrend = "down"; }
    }

    // 3) Fatigue index: latest TSB (negative = high fatigue)
    const latestTsb = ffHistory.length ? ffHistory[ffHistory.length - 1]?.tsb : null;
    let fatigueLabel = "—";
    let fatigueTrend: "up" | "down" | "stable" = "stable";
    if (latestTsb !== null) {
      if (latestTsb >= 5) { fatigueLabel = "Bassa"; fatigueTrend = "down"; } // low fatigue = good = "down" arrow
      else if (latestTsb >= -10) { fatigueLabel = "Media"; fatigueTrend = "stable"; }
      else if (latestTsb >= -25) { fatigueLabel = "Alta"; fatigueTrend = "up"; }
      else { fatigueLabel = "Critica"; fatigueTrend = "up"; }
    }

    // 4) Biomechanics: cadence + GCT availability
    const cadRuns = last90.filter(r => r.avg_cadence_spm ?? r.avg_cadence);
    const avgCad = cadRuns.length
      ? cadRuns.reduce((s, r) => s + (r.avg_cadence_spm ?? r.avg_cadence ?? 0), 0) / cadRuns.length
      : 0;
    let bioLabel = "—";
    let bioTrend: "up" | "down" | "stable" = "stable";
    if (avgCad > 0) {
      if (avgCad >= 178) { bioLabel = "Ottimale"; bioTrend = "up"; }
      else if (avgCad >= 170) { bioLabel = "Buona"; bioTrend = "stable"; }
      else if (avgCad >= 160) { bioLabel = "Migliorabile"; bioTrend = "down"; }
      else { bioLabel = "Da curare"; bioTrend = "down"; }
    }

    return [
      { label: "EFFICIENZA AEROBICA", value: aerobicScore !== null ? `${aerobicScore}%` : "—", trend: aerobicTrend },
      { label: "CLEARANCE LATTATO",   value: lactateLabel,                                    trend: lactateTrend },
      { label: "INDICE FATICA",       value: fatigueLabel,                                    trend: fatigueTrend },
      { label: "BIOMECCANICA",        value: bioLabel,                                        trend: bioTrend },
    ];
  }, [runs, ffHistory, thresholdPace]);

  // ── Narrative from real signals ──────────────────────────────────────────
  const narrative = useMemo(() => {
    const latestTsb = ffHistory.length ? ffHistory[ffHistory.length - 1]?.tsb : null;
    const dist = activeDistMeta.label;
    const formGood = latestTsb !== null && latestTsb >= -10;
    const formFresh = latestTsb !== null && latestTsb >= 5;
    const formFatigued = latestTsb !== null && latestTsb < -20;

    if (activeDistance === "5k") {
      if (formFatigued) return `Sul ${dist} la potenza neuromuscolare è il fattore chiave, ma il carico accumulato sta limitando la spinta finale. Scarica 5 giorni prima di testare il tempo proiettato.`;
      if (formFresh) return `Le riserve glicolitiche sono al massimo. Sul ${dist} puoi attaccare la soglia dal primo km e tenere fino al traguardo. Condizioni ideali per attaccare il PB.`;
      return `Capacità anaerobica solida. Sul ${dist} puoi sostenere la soglia per gli ultimi 2km. Il tempo proiettato è realistico con condizioni climatiche favorevoli.`;
    }
    if (activeDistance === "10k") {
      if (formFatigued) return `Sul ${dist} il fattore limitante è la soglia. Carico recente alto: meglio attendere finestra di freschezza per stimare al meglio il potenziale.`;
      if (formGood) return `Il 10K mette in mostra equilibrio tra velocità e resistenza. Blocchi sub-soglia recenti hanno costruito resilienza: aggancia il ritmo target già dal 3° km.`;
      return `Sul ${dist} l'efficienza di soglia è determinante. Il tempo proiettato presuppone una gestione corretta dei primi 3 km — non strafare in partenza.`;
    }
    if (activeDistance === "hm") {
      if (formFatigued) return `La mezza richiede aerobica e freschezza. Indice di fatica elevato: la proiezione è teorica, scarica almeno 7-10 giorni prima del test.`;
      if (formGood) return `Volume accumulato negli ultimi 12 settimane ha alzato la baseline aerobica. Cardiac drift al ritmo target è minimo: gestione lineare fino al 15° km, finale forte.`;
      return `Sulla mezza l'endurance aerobica fa la differenza. Il tempo proiettato è coerente: cruise stabile fino al 15° km e progressione finale.`;
    }
    // Marathon
    if (formFatigued) return `La maratona richiede freschezza assoluta. Carico elevato negli ultimi 28 giorni: priorità taper e carico glicogeno per i prossimi 14 giorni.`;
    if (formGood) return `Marcatori fisiologici buoni per la distanza. Attenzione ai lunghi recenti — se sopra 30 km, la proiezione è realistica. Taper 3 settimane e nutrizione precisa sblocca il potenziale.`;
    return `Sulla maratona il fattore principale è la riserva glicogenica e la tenuta aerobica. La proiezione presuppone almeno 3 lunghi sopra i 28 km nelle ultime 6 settimane.`;
  }, [activeDistance, ffHistory, activeDistMeta]);

  // ── Capacity Evolution chart data ────────────────────────────────────────
  const trendData = useMemo(() => {
    const rangeMeta = TIME_RANGES.find(r => r.id === timeRange)!;
    const now = Date.now();
    const cutoff = now - rangeMeta.days * 86400000;
    const distKm = activeDistMeta.km;

    // Filter: outdoor runs within window, similar distance bracket
    const window = runs.filter(r => {
      const ts = new Date(r.date).getTime();
      if (ts < cutoff) return false;
      if (r.is_treadmill || !r.avg_pace) return false;
      // For predictions, include runs ≥ 3 km
      return r.distance_km >= 3;
    });

    if (window.length < 2) {
      // Fallback: synthesize from current VDOT
      const points = 6;
      return Array.from({ length: points }, (_, i) => {
        const t = now - (points - 1 - i) * (rangeMeta.days / points) * 86400000;
        const date = new Date(t);
        const predSec = predictRaceSec(currentVdot, distKm);
        return {
          date: date.toISOString().slice(0, 10),
          displayDate: date.toLocaleDateString("it", { day: "2-digit", month: "short" }),
          Capacity: Math.round(1000 - predSec / distKm),
          tempo: fmtTime(predSec),
          pace: `${fmtPaceFromSec(predSec, distKm)}/km`,
        };
      });
    }

    // Sort by date
    window.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Bucket into ~8-12 buckets for the period
    const bucketCount = timeRange === "7d" ? 7 : timeRange === "30d" ? 6 : timeRange === "90d" ? 8 : 10;
    const span = now - cutoff;
    const bucketSize = span / bucketCount;
    const buckets: { runs: Run[]; tsCenter: number }[] = Array.from({ length: bucketCount }, (_, i) => ({
      runs: [],
      tsCenter: cutoff + bucketSize * (i + 0.5),
    }));
    window.forEach(r => {
      const ts = new Date(r.date).getTime();
      const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor((ts - cutoff) / bucketSize)));
      buckets[idx].runs.push(r);
    });

    // For each bucket: estimate VDOT from best effort, then project to active distance
    let lastVdot = currentVdot;
    const out = buckets.map(b => {
      if (b.runs.length > 0) {
        const best = b.runs.reduce((p, c) => parsePaceDec(c.avg_pace) < parsePaceDec(p.avg_pace) ? c : p);
        const estV = vdotForRaceTime(best.distance_km, best.duration_minutes);
        if (Number.isFinite(estV) && estV > 25 && estV < 85) lastVdot = estV;
      }
      const predSec = predictRaceSec(lastVdot, distKm);
      const date = new Date(b.tsCenter);
      return {
        date: date.toISOString().slice(0, 10),
        displayDate: date.toLocaleDateString("it", { day: "2-digit", month: "short" }),
        Capacity: Math.round(10000 / (predSec / distKm)), // higher = faster
        tempo: fmtTime(predSec),
        pace: `${fmtPaceFromSec(predSec, distKm)}/km`,
      };
    });
    return out;
  }, [runs, timeRange, activeDistMeta, currentVdot]);

  const xTicks = useMemo(() => {
    if (trendData.length <= 3) return trendData.map(d => d.date);
    const ticks: string[] = [];
    const n = 3;
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(i * (trendData.length - 1) / (n - 1));
      ticks.push(trendData[idx].date);
    }
    return [...new Set(ticks)];
  }, [trendData]);

  // ── Scaled equivalents (4 distances) ─────────────────────────────────────
  const equivalents = useMemo(() => {
    return DISTANCES.map(d => {
      const secs = predictRaceSec(currentVdot, d.km);
      return {
        distance: d.label,
        title: d.title,
        time: fmtTime(secs),
        pace: `${fmtPaceFromSec(secs, d.km)}/km`,
      };
    });
  }, [currentVdot]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="rounded-3xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-4 md:p-6 lg:p-12 overflow-hidden">
      <div className="grid lg:grid-cols-12 gap-6 md:gap-10 lg:gap-16">

        {/* ─── LEFT COLUMN: TITLE + NAV ─────────────────────────────── */}
        <div className="lg:col-span-4 flex flex-col">
          <div className="mb-10">
            <div className="text-[10px] text-[#C0FF00] font-mono tracking-[0.3em] uppercase mb-3">
              Vettore Potenziale
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight text-zinc-100 leading-[1.05]">
              Cosa puoi <br className="hidden lg:block" />
              correre <span className="text-[#C0FF00]">oggi</span>
            </h1>
          </div>

          {/* Distance selector */}
          <nav className="flex flex-col gap-0.5 relative">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.06]" />
            {DISTANCES.map(d => (
              <button
                key={d.id}
                onClick={() => setActiveDistance(d.id)}
                className={`relative flex items-center justify-between py-3.5 pl-6 pr-3 text-left transition-all duration-300 ${
                  activeDistance === d.id ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {activeDistance === d.id && (
                  <motion.div
                    layoutId="apv-active-indicator"
                    className="absolute left-[-1px] top-0 bottom-0 w-[2px] bg-[#C0FF00]"
                    style={{ boxShadow: `0 0 12px ${NEON}88` }}
                  />
                )}
                <span className="font-mono text-xs tracking-widest uppercase">{d.label}</span>
                <ChevronRight
                  className="w-4 h-4 transition-opacity"
                  style={{
                    opacity: activeDistance === d.id ? 1 : 0,
                    color: NEON,
                  }}
                />
              </button>
            ))}
          </nav>

          {/* ─── Athlete Profile Snapshot ─── */}
          <div className="mt-10 pt-10 border-t border-white/[0.06] flex flex-col gap-8">

            {/* VDOT hero */}
            <div className="flex flex-col gap-2">
              <div className="text-[9px] font-mono tracking-[0.3em] uppercase text-[#555]">
                Indice VDOT
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl lg:text-6xl font-light tracking-tighter tabular-nums leading-none"
                  style={{ color: athleteSnapshot.levelColor, textShadow: `0 0 18px ${athleteSnapshot.levelColor}33` }}>
                  {currentVdot.toFixed(1)}
                </span>
                <span className="font-mono text-[10px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-full"
                  style={{
                    color: athleteSnapshot.levelColor,
                    background: `${athleteSnapshot.levelColor}12`,
                    border: `1px solid ${athleteSnapshot.levelColor}33`,
                  }}>
                  {athleteSnapshot.levelLabel}
                </span>
              </div>
            </div>

            {/* Forma & Carico (from FF) */}
            {athleteSnapshot.tsb !== null && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[9px] text-[#555] tracking-[0.2em] uppercase">Forma</span>
                  <span className="text-xl font-light tabular-nums" style={{ color: athleteSnapshot.formColor }}>
                    {athleteSnapshot.formLabel}
                  </span>
                  <span className="font-mono text-[10px] text-[#666] tabular-nums">
                    TSB {athleteSnapshot.tsb > 0 ? "+" : ""}{athleteSnapshot.tsb}
                  </span>
                </div>
                {athleteSnapshot.ctl !== null && (
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[9px] text-[#555] tracking-[0.2em] uppercase">Condizione</span>
                    <span className="text-xl font-light text-zinc-100 tabular-nums">
                      {athleteSnapshot.ctl}
                    </span>
                    <span className="font-mono text-[10px] text-[#666] tracking-wider uppercase">CTL fitness</span>
                  </div>
                )}
              </div>
            )}

            {/* Volume tiles */}
            <div>
              <div className="font-mono text-[9px] text-[#555] tracking-[0.3em] uppercase mb-3">
                Volume Recente
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-3 flex flex-col gap-0.5">
                  <span className="font-mono text-[9px] text-[#555] tracking-[0.2em] uppercase">7 giorni</span>
                  <span className="text-xl font-light text-zinc-100 tabular-nums">
                    {athleteSnapshot.km7}<span className="text-[10px] text-[#666] font-mono ml-1">km</span>
                  </span>
                </div>
                <div className="rounded-2xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-3 flex flex-col gap-0.5">
                  <span className="font-mono text-[9px] text-[#555] tracking-[0.2em] uppercase">30 giorni</span>
                  <span className="text-xl font-light text-zinc-100 tabular-nums">
                    {athleteSnapshot.km30}<span className="text-[10px] text-[#666] font-mono ml-1">km</span>
                  </span>
                </div>
                <div className="rounded-2xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-3 flex flex-col gap-0.5">
                  <span className="font-mono text-[9px] text-[#555] tracking-[0.2em] uppercase">Uscite 30g</span>
                  <span className="text-xl font-light text-zinc-100 tabular-nums">
                    {athleteSnapshot.runs30}
                  </span>
                </div>
                <div className="rounded-2xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-3 flex flex-col gap-0.5">
                  <span className="font-mono text-[9px] text-[#555] tracking-[0.2em] uppercase">Ore 90g</span>
                  <span className="text-xl font-light text-zinc-100 tabular-nums">
                    {athleteSnapshot.hours90}<span className="text-[10px] text-[#666] font-mono ml-1">h</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Soglia anaerobica */}
            {thresholdPace && (
              <div>
                <div className="font-mono text-[9px] text-[#555] tracking-[0.3em] uppercase mb-2">
                  Passo di Soglia
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-light tabular-nums text-[#C0FF00]">{thresholdPace}</span>
                  <span className="font-mono text-[10px] text-[#666] tracking-wider">/km</span>
                </div>
                {maxHr && (
                  <div className="font-mono text-[10px] text-[#555] tracking-wider mt-1">
                    HR target ~{Math.round(maxHr * 0.88)} bpm
                  </div>
                )}
              </div>
            )}

            {/* Signature */}
            <div className="pt-6 border-t border-white/[0.04] hidden lg:block">
              <div className="text-[9px] font-mono tracking-[0.25em] uppercase text-[#444]">
                Powered by
              </div>
              <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#777] mt-1">
                VDOT · CTL/ATL/TSB · Pace history
              </div>
            </div>
          </div>
        </div>

        {/* ─── RIGHT COLUMN: VISUALIZATION ──────────────────────────── */}
        <div className="lg:col-span-8 lg:col-start-5 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeDistance}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex flex-col"
            >
              {/* Header: title + projected time */}
              <div className="mb-6">
                <div className="text-[10px] font-mono tracking-[0.3em] text-[#555] mb-3 uppercase">
                  {activeDistMeta.title}
                </div>
                <div className="flex flex-wrap items-baseline gap-3 md:gap-6">
                  <span className="text-5xl sm:text-6xl md:text-7xl lg:text-[120px] font-light tracking-tighter leading-none text-zinc-50 tabular-nums break-all">
                    {predictionData.time}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-base lg:text-lg font-bold text-[#C0FF00] tabular-nums">
                      {predictionData.pace}
                    </span>
                    <span className="font-mono text-[10px] text-[#555] uppercase tracking-widest">
                      Passo target
                    </span>
                  </div>
                </div>
              </div>

              {/* Narrative */}
              <div className="max-w-2xl mb-8 md:mb-14">
                <p className="text-base md:text-lg text-zinc-400 leading-relaxed font-light">
                  {narrative}
                </p>
                {predictionData.delta !== null && (
                  <div className="mt-5 flex items-center gap-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold tabular-nums"
                      style={{
                        background: predictionData.deltaIsFaster ? "rgba(192,255,0,0.1)" : "rgba(245,158,11,0.1)",
                        color: predictionData.deltaIsFaster ? NEON : AMBER,
                        border: `1px solid ${predictionData.deltaIsFaster ? "rgba(192,255,0,0.25)" : "rgba(245,158,11,0.25)"}`,
                      }}
                    >
                      {predictionData.deltaIsFaster
                        ? <TrendingUp size={12} />
                        : <TrendingDown size={12} />}
                      {predictionData.delta} vs 90 giorni fa
                    </span>
                  </div>
                )}
              </div>

              {/* Capacity Evolution chart */}
              <div className="relative h-52 md:h-64 lg:h-80 w-full mb-10 md:mb-14 border-b border-white/[0.06]">
                <div className="absolute top-0 left-0 right-0 flex items-center justify-between z-10 pointer-events-none">
                  <div className="font-mono text-[9px] text-[#555] tracking-[0.3em] uppercase">
                    Indice di Capacità
                  </div>
                  <div className="flex items-center bg-[#0E0E0E] border border-white/[0.06] rounded-full p-1 pointer-events-auto shadow-xl">
                    {TIME_RANGES.map(r => (
                      <button
                        key={r.id}
                        onClick={() => setTimeRange(r.id)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider transition-colors ${
                          timeRange === r.id
                            ? "bg-[#1a1a1a] text-[#C0FF00]"
                            : "text-[#555] hover:text-zinc-300"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="absolute inset-0 pt-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="apvCapGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={NEON} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={NEON} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#555", fontSize: 10, fontFamily: "monospace" }}
                        dy={10}
                        ticks={xTicks}
                        tickFormatter={(val) => {
                          const d = new Date(val);
                          return d.toLocaleDateString("it", { day: "2-digit", month: "short" }).toUpperCase();
                        }}
                      />
                      <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ stroke: "#555", strokeWidth: 1, strokeDasharray: "4 4" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="Capacity"
                        stroke={NEON}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#apvCapGrad)"
                        activeDot={{ r: 5, fill: NEON, stroke: "#000", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Factor breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5 sm:gap-8 md:gap-10 mb-10 md:mb-14">
                {factors.map((f, i) => (
                  <div key={i} className="flex flex-col">
                    <span className="font-mono text-[9px] text-[#555] tracking-[0.2em] mb-2 uppercase break-words">
                      {f.label}
                    </span>
                    <span className="text-xl font-light text-zinc-100 tracking-tight tabular-nums">
                      {f.value}
                    </span>
                    <TrendIndicator trend={f.trend} />
                  </div>
                ))}
              </div>

              {/* Scaled equivalents */}
              <div className="pt-8 border-t border-white/[0.06]">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                  <h3 className="font-mono text-[10px] text-[#888] tracking-[0.3em] uppercase">
                    Distanze Scalate
                  </h3>
                  <span className="text-[9px] text-[#C0FF00] font-mono tracking-widest bg-[#C0FF00]/10 border border-[#C0FF00]/20 px-2 py-1 rounded font-bold">
                    BASATO SU FORMA ATTUALE
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {equivalents.map((eq, i) => {
                    const isActive = DISTANCES[i].id === activeDistance;
                    return (
                      <div
                        key={i}
                        className={`bg-[#111] border rounded-2xl p-5 flex flex-col justify-between transition-colors group cursor-pointer ${
                          isActive ? "border-[#C0FF00]/50" : "border-white/[0.05] hover:border-[#C0FF00]/25"
                        }`}
                        onClick={() => setActiveDistance(DISTANCES[i].id)}
                      >
                        <span className={`font-mono text-[10px] tracking-widest mb-4 uppercase font-bold transition-colors ${
                          isActive ? "text-[#C0FF00]" : "text-[#666] group-hover:text-[#C0FF00]"
                        }`}>
                          {eq.distance}
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xl md:text-2xl font-light text-zinc-100 tracking-tight tabular-nums">
                            {eq.time}
                          </span>
                          <span className="font-mono text-[10px] font-bold text-[#C0FF00] tracking-wider tabular-nums">
                            {eq.pace}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
