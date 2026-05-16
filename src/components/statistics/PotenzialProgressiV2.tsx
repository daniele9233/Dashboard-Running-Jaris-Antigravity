/**
 * POTENZIALE & PROGRESSI V2 — Cinematic Runner Dashboard
 *
 * Visual storytelling per runner: ogni schermata racconta dove sei,
 * dove eri, dove stai andando. Glow, gradients, animazioni, milestone.
 */
import React, { useMemo, useState, useEffect } from "react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, BarChart, Bar, Cell,
} from "recharts";
import type { Run, FitnessFreshnessPoint, ProAnalyticsChart, Profile } from "../../types/api";
import {
  Flame, TrendingUp, TrendingDown, Minus, Zap, Activity,
  Wind, Mountain, Heart, Sparkles, Award, ChevronRight, Crosshair,
  Rocket, Trophy, Timer, ArrowUpRight, Target,
} from "lucide-react";

// ─── PROPS ───────────────────────────────────────────────────────────────────

export interface PotenzialProgressiV2Props {
  vdot: number | null;
  runs?: Run[];
  ffHistory?: FitnessFreshnessPoint[];
  maxHr?: number;
  thresholdPace?: string | null;
  proCharts?: Record<string, ProAnalyticsChart>;
  profile?: Profile | null;
}

// ─── COLOR SYSTEM ─────────────────────────────────────────────────────────────

const LIME = "#C0FF00";
const CYAN = "#06FFA5";
const VIOLET = "#A78BFA";
const MAGENTA = "#F0ABFC";
const ORANGE = "#FB923C";
const ROSE = "#F43F5E";
const AMBER = "#F59E0B";
const SKY = "#38BDF8";

// ─── MATH ─────────────────────────────────────────────────────────────────────

function parsePaceDec(pace: string): number {
  if (!pace) return 0;
  const [m, s] = pace.split(":").map(Number);
  if (isNaN(m) || isNaN(s)) return 0;
  return m + s / 60;
}

function vdotForRaceTime(distanceKm: number, durationMin: number): number {
  const v = distanceKm / durationMin;
  const pct = 0.8 + 0.1894393 * Math.exp(-0.012778 * durationMin)
    + 0.2989558 * Math.exp(-0.1932605 * durationMin);
  const vo2 = -4.60 + 0.182258 * v * 1000 / durationMin + 0.000104 * Math.pow(v * 1000 / durationMin, 2);
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

function fmtPaceSec(secs: number): string {
  if (!secs || secs <= 0) return "—";
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ─── LEVEL SYSTEM con next-step ───────────────────────────────────────────────

interface RunnerLevel {
  rank: number;
  label: string;
  color: string;
  desc: string;
  threshold: number;
  nextThreshold: number;
}

function vdotLevel(v: number): RunnerLevel {
  if (v >= 60) return { rank: 5, label: "ELITE", color: LIME, desc: "Atleta nazionale/internazionale", threshold: 60, nextThreshold: 70 };
  if (v >= 52) return { rank: 4, label: "AVANZATO", color: VIOLET, desc: "Competitivo a livello regionale", threshold: 52, nextThreshold: 60 };
  if (v >= 47) return { rank: 3, label: "ESPERTO", color: SKY, desc: "Esperto di mezza e maratona", threshold: 47, nextThreshold: 52 };
  if (v >= 40) return { rank: 2, label: "BUONO", color: CYAN, desc: "Runner consistente, race-ready", threshold: 40, nextThreshold: 47 };
  if (v >= 32) return { rank: 1, label: "INTERMEDIO", color: AMBER, desc: "Base costruita, in crescita", threshold: 32, nextThreshold: 40 };
  return { rank: 0, label: "PRINCIPIANTE", color: ROSE, desc: "Stai posando fondamenta", threshold: 25, nextThreshold: 32 };
}

// ─── ANIMATED NUMBER ──────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf: number, start: number | null = null;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

// ─── HERO: VDOT GAUGE ─────────────────────────────────────────────────────────

function VdotGauge({ vdot, level }: { vdot: number; level: RunnerLevel }) {
  const animated = useCountUp(vdot);
  const SIZE = 220;
  const STROKE = 14;
  const R = (SIZE - STROKE) / 2 - 4;
  const C = 2 * Math.PI * R;
  // Progress to next level
  const span = level.nextThreshold - level.threshold;
  const progress = clamp((vdot - level.threshold) / span, 0, 1);
  const dash = C * progress;

  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <defs>
          <linearGradient id="vdotGaugeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={level.color} stopOpacity={1} />
            <stop offset="100%" stopColor={level.color} stopOpacity={0.6} />
          </linearGradient>
          <filter id="vdotGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
          stroke="rgba(255,255,255,0.05)" strokeWidth={STROKE} />
        {/* Progress */}
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
          stroke="url(#vdotGaugeGrad)" strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          filter="url(#vdotGlow)"
          style={{ transition: "stroke-dasharray 1.4s cubic-bezier(0.25,0.1,0.25,1)" }} />
        {/* Tick marks */}
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i / 24) * 2 * Math.PI;
          const r1 = R - STROKE / 2 - 4;
          const r2 = R - STROKE / 2 - 9;
          const x1 = SIZE / 2 + Math.cos(angle) * r1;
          const y1 = SIZE / 2 + Math.sin(angle) * r1;
          const x2 = SIZE / 2 + Math.cos(angle) * r2;
          const y2 = SIZE / 2 + Math.sin(angle) * r2;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[9px] font-black tracking-[0.25em] text-[#555]">VDOT</div>
        <div className="text-[64px] font-black leading-none tabular-nums" style={{ color: level.color, textShadow: `0 0 24px ${level.color}55` }}>
          {animated.toFixed(1)}
        </div>
        <div className="text-[9px] font-black tracking-widest mt-1" style={{ color: level.color }}>
          {level.label}
        </div>
      </div>
    </div>
  );
}

// ─── DELTA BADGE ──────────────────────────────────────────────────────────────

function DeltaBadge({ delta, suffix = "", invert = false }: { delta: number | null; suffix?: string; invert?: boolean }) {
  if (delta === null) return null;
  const positive = invert ? delta < 0 : delta > 0;
  const negative = invert ? delta > 0 : delta < 0;
  const color = positive ? CYAN : negative ? ROSE : "#666";
  const Icon = positive ? TrendingUp : negative ? TrendingDown : Minus;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
      <Icon size={10} />
      {delta > 0 ? "+" : ""}{delta.toFixed(suffix === "s" ? 0 : 1)}{suffix}
    </span>
  );
}

// ─── DNA RUNNER STAT BAR ──────────────────────────────────────────────────────

function DnaBar({ icon: Icon, label, value, color, desc }: {
  icon: any; label: string; value: number; color: string; desc: string;
}) {
  return (
    <div className="bg-[#0E0E0E] border border-white/[0.05] rounded-2xl p-4 flex flex-col gap-2.5 hover:border-white/[0.12] transition-all group">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icon size={13} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black tracking-widest uppercase" style={{ color }}>{label}</div>
        </div>
        <div className="text-xl font-black tabular-nums" style={{ color }}>{value}</div>
      </div>
      <div className="w-full bg-[#1a1a1a] rounded-full h-1.5 overflow-hidden relative">
        <div className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${value}%`,
            background: `linear-gradient(90deg, ${color}AA, ${color})`,
            boxShadow: `0 0 12px ${color}66`,
            transition: "width 1.4s cubic-bezier(0.25,0.1,0.25,1)",
          }} />
      </div>
      <div className="text-[10px] text-[#666] font-bold leading-relaxed">{desc}</div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function PotenzialProgressiV2({
  vdot,
  runs = [],
  ffHistory = [],
  maxHr,
  thresholdPace,
  profile,
}: PotenzialProgressiV2Props) {

  // ── VDOT trend monthly ────────────────────────────────────────────────────
  const vdotMonthly = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const mRuns = runs.filter(r => {
        const rd = new Date(r.date);
        return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth()
          && !r.is_treadmill && r.distance_km >= 5 && r.avg_pace;
      });
      if (!mRuns.length) return null;
      const best = mRuns.reduce((p, c) => parsePaceDec(c.avg_pace) < parsePaceDec(p.avg_pace) ? c : p);
      const dur = best.duration_minutes;
      const dist = best.distance_km;
      if (!dur || !dist) return null;
      const v = clamp(vdotForRaceTime(dist, dur), 25, 85);
      return {
        month: d.toLocaleString("it", { month: "short" }).toUpperCase(),
        vdot: Math.round(v * 10) / 10,
        ts: d.getTime(),
        forecast: null as number | null,
      };
    }).filter((d): d is { month: string; vdot: number; ts: number; forecast: number | null } => d !== null);
  }, [runs]);

  const currentVdot = vdot ?? vdotMonthly[vdotMonthly.length - 1]?.vdot ?? 45;
  const prevVdot = vdotMonthly.length >= 2 ? vdotMonthly[vdotMonthly.length - 2]?.vdot : null;
  const vdot3mAgo = vdotMonthly.length >= 4 ? vdotMonthly[vdotMonthly.length - 4]?.vdot : null;
  const vdotDelta90 = vdot3mAgo !== null ? Math.round((currentVdot - vdot3mAgo) * 10) / 10 : null;
  const level = vdotLevel(currentVdot);

  // ── VDOT trend + forecast (next 3 months) ─────────────────────────────────
  const vdotWithForecast = useMemo(() => {
    if (vdotMonthly.length < 3) return vdotMonthly.map(d => ({ ...d, forecast: null }));
    // Linear regression on last 6 months
    const lastN = vdotMonthly.slice(-6);
    const xs = lastN.map((_, i) => i);
    const ys = lastN.map(d => d.vdot);
    const n = xs.length;
    const sumX = xs.reduce((s, x) => s + x, 0);
    const sumY = ys.reduce((s, y) => s + y, 0);
    const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
    const sumXX = xs.reduce((s, x) => s + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
    const intercept = (sumY - slope * sumX) / n;
    const lastIdx = lastN.length - 1;

    const historical = vdotMonthly.map(d => ({ ...d, forecast: null as number | null, isForecast: false }));
    // Bridge point: last real becomes both real and forecast start
    const lastReal = historical[historical.length - 1];
    lastReal.forecast = lastReal.vdot;

    const now = new Date();
    const forecast = Array.from({ length: 3 }, (_, i) => {
      const fIdx = lastIdx + i + 1;
      const v = clamp(intercept + slope * fIdx, 25, 85);
      const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      return {
        month: d.toLocaleString("it", { month: "short" }).toUpperCase(),
        vdot: null as any,
        forecast: Math.round(v * 10) / 10,
        ts: d.getTime(),
        isForecast: true,
      };
    });
    return [...historical, ...forecast];
  }, [vdotMonthly]);

  // ── DNA Runner: 4 sistemi ─────────────────────────────────────────────────
  const dna = useMemo(() => {
    const now = new Date();
    const recent = runs.filter(r => {
      const days = (now.getTime() - new Date(r.date).getTime()) / 86400000;
      return days <= 90 && !r.is_treadmill;
    });
    const aerobicRuns = recent.filter(r => r.distance_km >= 8 && (r.avg_hr_pct ?? 0) < 85);
    const lactateRuns = recent.filter(r => /tempo|threshold|soglia/i.test(r.run_type + " " + (r.name ?? "")) || ((r.avg_hr_pct ?? 0) >= 82 && (r.avg_hr_pct ?? 0) <= 92));
    const anaerobicRuns = recent.filter(r => /interval|ripet|fartlek/i.test(r.run_type + " " + (r.name ?? "")) || (r.avg_hr_pct ?? 0) >= 92);
    const neuroRuns = recent.filter(r => /sprint|strides|allunghi|hill/i.test(r.run_type + " " + (r.name ?? "")) || (r.duration_minutes <= 30 && (r.avg_hr_pct ?? 0) >= 85));

    const longRuns = recent.filter(r => r.distance_km >= 14).length;
    const totalKm = recent.reduce((s, r) => s + r.distance_km, 0);

    const aerobic = clamp(Math.round((aerobicRuns.length * 4 + longRuns * 6 + totalKm / 4) + (currentVdot - 35) * 1.2), 15, 100);
    const lactate = clamp(Math.round(lactateRuns.length * 7 + (thresholdPace ? 40 : 20) + (currentVdot - 35) * 0.8), 15, 100);
    const anaerobic = clamp(Math.round(anaerobicRuns.length * 10 + (currentVdot - 35) * 0.6), 10, 100);
    const neuro = clamp(Math.round(neuroRuns.length * 12 + (currentVdot - 35) * 0.5), 10, 100);

    return [
      { key: "aerobic", icon: Wind, label: "Aerobico", value: aerobic, color: CYAN, desc: "Resistenza, lunghi, ossigenazione muscolare." },
      { key: "lactate", icon: Activity, label: "Soglia Lattacida", value: lactate, color: AMBER, desc: "Tempo run, ritmo gara mezza/maratona." },
      { key: "anaerobic", icon: Flame, label: "Anaerobico", value: anaerobic, color: ROSE, desc: "VO₂max, ripetute, capacità di soffrire." },
      { key: "neuro", icon: Zap, label: "Neuromuscolare", value: neuro, color: VIOLET, desc: "Velocità pura, reattività, allunghi." },
    ];
  }, [runs, currentVdot, thresholdPace]);

  // ── Dominant trait ─────────────────────────────────────────────────────────
  const dominantTrait = useMemo(() => {
    const max = dna.reduce((m, d) => d.value > m.value ? d : m, dna[0]);
    const min = dna.reduce((m, d) => d.value < m.value ? d : m, dna[0]);
    const profiles: Record<string, { title: string; tagline: string; emoji: string }> = {
      aerobic: { title: "MARATONETA PURO", tagline: "La distanza è il tuo elemento", emoji: "🏔️" },
      lactate: { title: "TEMPO MASTER", tagline: "Soffrir lungo è la tua firma", emoji: "🔥" },
      anaerobic: { title: "VO₂ KILLER", tagline: "Le ripetute sono casa tua", emoji: "⚡" },
      neuro: { title: "VELOCISTA NATO", tagline: "Acceleri come una scintilla", emoji: "💨" },
    };
    return { ...profiles[max.key], weak: min.label, weakColor: min.color };
  }, [dna]);

  // ── Race predictions ──────────────────────────────────────────────────────
  const raceDefs = useMemo(() => [
    { key: "5K",   label: "5 KM",    sublabel: "Sprint",   distKm: 5,       color: LIME,    icon: Zap },
    { key: "10K",  label: "10 KM",   sublabel: "Velocità", distKm: 10,      color: SKY,     icon: Wind },
    { key: "HALF", label: "21,1 KM", sublabel: "Mezza",    distKm: 21.0975, color: VIOLET,  icon: Mountain },
    { key: "FULL", label: "42,2 KM", sublabel: "Maratona", distKm: 42.195,  color: ORANGE,  icon: Trophy },
  ], []);

  const racePredictions = useMemo(() => {
    return raceDefs.map(def => {
      const predSecs = predictRaceSec(currentVdot, def.distKm);
      const prevSecs = vdot3mAgo ? predictRaceSec(vdot3mAgo, def.distKm) : null;
      const delta = prevSecs !== null ? predSecs - prevSecs : null;
      // PB from runs
      const pbRuns = runs.filter(r => !r.is_treadmill && r.distance_km >= def.distKm * 0.95 && r.distance_km <= def.distKm * 1.06 && r.avg_pace);
      let pbSecs: number | null = null;
      let pbDate: string | null = null;
      if (pbRuns.length) {
        const best = pbRuns.reduce((p, c) => parsePaceDec(c.avg_pace) < parsePaceDec(p.avg_pace) ? c : p);
        pbSecs = Math.round(parsePaceDec(best.avg_pace) * 60 * best.distance_km);
        pbDate = new Date(best.date).toLocaleDateString("it", { day: "2-digit", month: "short", year: "2-digit" });
      }
      return {
        ...def,
        predSecs,
        delta,
        pbSecs,
        pbDate,
        gap: pbSecs !== null ? pbSecs - predSecs : null,
      };
    });
  }, [raceDefs, runs, currentVdot, vdot3mAgo]);

  // ── Race readiness (radar) ────────────────────────────────────────────────
  const readiness = useMemo(() => {
    const now = new Date();
    const dated = runs.map(r => ({ run: r, date: new Date(`${r.date}T12:00:00`) })).filter(({ date }) => !isNaN(date.getTime()));
    const recent = (days: number) => dated.filter(({ date }) => (now.getTime() - date.getTime()) / 86400000 <= days);
    const r35 = recent(35), r56 = recent(56), r90 = recent(90);
    const olderV = vdot3mAgo ?? currentVdot;
    const vTrend = currentVdot - olderV;
    const latestTsb = ffHistory.length ? ffHistory[ffHistory.length - 1]?.tsb : null;
    const maxDist = Math.max(0, ...r90.map(({ run }) => run.distance_km ?? 0));
    const longRuns = r90.filter(({ run }) => (run.distance_km ?? 0) >= 14).length;
    const weekKeys = new Set(r56.map(({ date }) => {
      const ws = new Date(date);
      ws.setDate(date.getDate() - date.getDay());
      return `${ws.getFullYear()}-${ws.getMonth()}-${ws.getDate()}`;
    }));
    const threshSecs = thresholdPace ? parsePaceDec(thresholdPace) * 60 : null;
    const speed = clamp(48 + (currentVdot - 38) * 2.3 + vTrend * 5, 25, 100);
    const soglia = clamp(threshSecs ? 112 - (threshSecs - 240) * 0.32 : 52 + (currentVdot - 40) * 2.1, 25, 100);
    const endur = clamp((maxDist / 21.1) * 70 + longRuns * 8 + r90.length * 0.7, 20, 100);
    const cons = clamp((weekKeys.size / 8) * 82 + Math.min(r56.length, 16) * 1.4, 20, 100);
    const fresh = clamp(latestTsb == null ? 62 : 58 + latestTsb * 1.6 + Math.min(r35.length, 12) * 0.6, 20, 100);
    const axes = [
      { label: "Velocità", value: Math.round(speed) },
      { label: "Soglia", value: Math.round(soglia) },
      { label: "Endurance", value: Math.round(endur) },
      { label: "Consistenza", value: Math.round(cons) },
      { label: "Freschezza", value: Math.round(fresh) },
    ];
    const overall = Math.round(axes.reduce((s, a) => s + a.value, 0) / axes.length);
    const limiter = axes.reduce((m, a) => a.value < m.value ? a : m, axes[0]);
    return { axes, overall, limiter: limiter.label };
  }, [runs, ffHistory, thresholdPace, currentVdot, vdot3mAgo]);

  // ── Milestones / Next Goals ───────────────────────────────────────────────
  const milestones = useMemo(() => {
    const slopePerMonth = vdotDelta90 !== null ? vdotDelta90 / 3 : 0;
    const items: { label: string; current: string; target: string; eta: string; color: string; icon: any; pct: number }[] = [];

    // 5K milestone (round down to nearest 30s)
    const cur5k = predictRaceSec(currentVdot, 5);
    const target5k = Math.floor(cur5k / 30) * 30;
    if (target5k < cur5k && slopePerMonth > 0) {
      const targetVdot = currentVdot + Math.max(0.5, (cur5k - target5k) / 30 * 0.4);
      const months = (targetVdot - currentVdot) / slopePerMonth;
      const days = Math.round(months * 30);
      items.push({
        label: `5K sotto ${fmtTime(target5k)}`,
        current: fmtTime(cur5k),
        target: fmtTime(target5k),
        eta: days > 0 && days < 365 ? `tra ~${days}g` : "ritmo da costruire",
        color: LIME,
        icon: Zap,
        pct: clamp(100 - (cur5k - target5k) / cur5k * 100 * 2, 0, 100),
      });
    }

    // Next VDOT level
    if (level.nextThreshold < 70) {
      const gap = level.nextThreshold - currentVdot;
      const months = slopePerMonth > 0 ? gap / slopePerMonth : 999;
      const days = Math.round(months * 30);
      items.push({
        label: `Livello ${vdotLevel(level.nextThreshold).label}`,
        current: `VDOT ${currentVdot.toFixed(1)}`,
        target: `VDOT ${level.nextThreshold}`,
        eta: days > 0 && days < 365 ? `tra ~${days}g` : "obiettivo lungo periodo",
        color: vdotLevel(level.nextThreshold).color,
        icon: Sparkles,
        pct: clamp((currentVdot - level.threshold) / (level.nextThreshold - level.threshold) * 100, 0, 100),
      });
    }

    // 10K milestone
    const cur10k = predictRaceSec(currentVdot, 10);
    const target10k = Math.floor(cur10k / 60) * 60;
    if (target10k < cur10k && slopePerMonth > 0) {
      const targetVdot = currentVdot + Math.max(0.5, (cur10k - target10k) / 60 * 0.3);
      const months = (targetVdot - currentVdot) / slopePerMonth;
      const days = Math.round(months * 30);
      items.push({
        label: `10K sotto ${fmtTime(target10k)}`,
        current: fmtTime(cur10k),
        target: fmtTime(target10k),
        eta: days > 0 && days < 365 ? `tra ~${days}g` : "ritmo da costruire",
        color: SKY,
        icon: Wind,
        pct: clamp(100 - (cur10k - target10k) / cur10k * 100 * 2, 0, 100),
      });
    }
    return items.slice(0, 3);
  }, [currentVdot, vdotDelta90, level]);

  // ── Pace trend (12 mesi) ──────────────────────────────────────────────────
  const paceTrend = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const mRuns = runs.filter(r => {
        const rd = new Date(r.date);
        return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth()
          && !r.is_treadmill && r.avg_pace && r.distance_km >= 3;
      });
      if (!mRuns.length) return null;
      const avg = mRuns.reduce((s, r) => s + parsePaceDec(r.avg_pace), 0) / mRuns.length;
      return { month: d.toLocaleString("it", { month: "short" }).toUpperCase(), paceSec: Math.round(avg * 60) };
    }).filter((d): d is { month: string; paceSec: number } => d !== null);
  }, [runs]);

  const paceMin = paceTrend.length ? Math.min(...paceTrend.map(d => d.paceSec)) - 10 : 240;
  const paceMax = paceTrend.length ? Math.max(...paceTrend.map(d => d.paceSec)) + 10 : 360;
  const paceImprovement = paceTrend.length >= 2 ? paceTrend[0].paceSec - paceTrend[paceTrend.length - 1].paceSec : 0;

  // ── 90-day stats ──────────────────────────────────────────────────────────
  const stats90 = useMemo(() => {
    const now = new Date();
    const r = runs.filter(x => !x.is_treadmill && (now.getTime() - new Date(x.date).getTime()) / 86400000 <= 90);
    const km = r.reduce((s, x) => s + x.distance_km, 0);
    const elevation = r.reduce((s, x) => s + (x.elevation_gain || 0), 0);
    const durations = r.reduce((s, x) => s + x.duration_minutes, 0);
    return {
      km: Math.round(km),
      hours: Math.round(durations / 60),
      runs: r.length,
      elevation: Math.round(elevation),
    };
  }, [runs]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ═══════════════════════════════════════════════════════════
          HERO — VDOT gauge + identità runner + KPI 90gg
      ═══════════════════════════════════════════════════════════ */}
      <div className="relative bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 lg:p-8 overflow-hidden">
        {/* Glow background */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-[0.07] blur-3xl pointer-events-none"
          style={{ background: `radial-gradient(circle, ${level.color}, transparent)` }} />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full opacity-[0.05] blur-3xl pointer-events-none"
          style={{ background: `radial-gradient(circle, ${VIOLET}, transparent)` }} />

        <div className="relative grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-8 items-center">
          {/* Gauge */}
          <div className="flex justify-center lg:justify-start">
            <VdotGauge vdot={currentVdot} level={level} />
          </div>

          {/* Identity */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Crosshair size={12} style={{ color: level.color }} />
              <span className="text-[10px] font-black tracking-[0.25em] uppercase" style={{ color: level.color }}>
                Profilo del runner
              </span>
            </div>
            <div className="text-[28px] lg:text-[34px] font-black leading-tight">
              <span className="text-white">Sei un </span>
              <span style={{ color: level.color, textShadow: `0 0 18px ${level.color}55` }}>
                {dominantTrait.title}
              </span>
            </div>
            <div className="text-[#999] text-sm font-bold italic">"{dominantTrait.tagline}"</div>
            <div className="text-[#666] text-xs leading-relaxed max-w-md">
              {level.desc}. Da migliorare: <span className="font-black" style={{ color: dominantTrait.weakColor }}>{dominantTrait.weak}</span>.
            </div>
            {vdotDelta90 !== null && (
              <div className="flex items-center gap-3 mt-1">
                <DeltaBadge delta={vdotDelta90} suffix=" VDOT" />
                <span className="text-[10px] text-[#555] font-bold uppercase tracking-wider">ultimi 90 giorni</span>
              </div>
            )}
          </div>

          {/* 90gg KPIs */}
          <div className="grid grid-cols-2 gap-2.5 lg:w-[260px]">
            {[
              { label: "KM 90gg", value: stats90.km, color: LIME },
              { label: "Uscite", value: stats90.runs, color: SKY },
              { label: "Ore", value: stats90.hours, color: VIOLET },
              { label: "D+ metri", value: stats90.elevation, color: AMBER },
            ].map(s => (
              <div key={s.label} className="bg-[#0E0E0E] border border-white/[0.05] rounded-2xl px-3 py-2.5 flex flex-col gap-0.5">
                <div className="text-[9px] font-black tracking-widest uppercase" style={{ color: s.color }}>{s.label}</div>
                <div className="text-xl font-black text-white tabular-nums leading-none">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          DNA RUNNER — 4 sistemi fisiologici
      ═══════════════════════════════════════════════════════════ */}
      <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 lg:p-8">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={14} style={{ color: LIME }} />
              <span className="text-[10px] font-black tracking-[0.25em] uppercase text-[#A0A0A0]">
                DNA del Runner
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">I tuoi quattro motori</h2>
            <div className="text-[11px] text-[#666] font-bold mt-1">Sistemi energetici sviluppati negli ultimi 90 giorni</div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {dna.map(d => <DnaBar key={d.key} {...d} />)}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          PREVISIONI GARA — 4 cards con PB gap
      ═══════════════════════════════════════════════════════════ */}
      <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 lg:p-8">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Target size={14} style={{ color: LIME }} />
              <span className="text-[10px] font-black tracking-[0.25em] uppercase text-[#A0A0A0]">
                Previsioni gara
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">Cosa puoi correre oggi</h2>
            <div className="text-[11px] text-[#666] font-bold mt-1">Tempi predetti basati sul VDOT attuale · confronto con il tuo record personale</div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {racePredictions.map(r => {
            const beatsPb = r.gap !== null && r.gap > 5;
            const closeToPb = r.gap !== null && Math.abs(r.gap) <= 5;
            return (
              <div key={r.key} className="relative bg-[#0E0E0E] border border-white/[0.05] rounded-2xl p-5 overflow-hidden hover:border-white/[0.15] transition-all group">
                {/* Top color stripe */}
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${r.color}, ${r.color}33)` }} />
                <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity"
                  style={{ background: r.color }} />

                <div className="relative flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: `${r.color}18`, border: `1px solid ${r.color}30` }}>
                        <r.icon size={13} style={{ color: r.color }} />
                      </div>
                      <div>
                        <div className="text-[11px] font-black tracking-widest" style={{ color: r.color }}>{r.label}</div>
                        <div className="text-[9px] text-[#555] font-bold uppercase">{r.sublabel}</div>
                      </div>
                    </div>
                    <DeltaBadge delta={r.delta} suffix="s" invert />
                  </div>

                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[36px] font-black text-white tabular-nums leading-none">{fmtTime(r.predSecs)}</span>
                  </div>
                  <div className="text-[10px] text-[#666] font-bold">
                    {fmtPaceFromSec(r.predSecs, r.distKm)}/km · previsto
                  </div>

                  {/* PB row */}
                  {r.pbSecs !== null ? (
                    <div className="bg-[#080808] border border-white/[0.04] rounded-xl px-3 py-2 flex items-center justify-between mt-1">
                      <div className="flex flex-col">
                        <div className="text-[8.5px] font-black text-[#555] tracking-widest uppercase">Tuo PB</div>
                        <div className="text-sm font-black text-white tabular-nums">{fmtTime(r.pbSecs)}</div>
                      </div>
                      <div className="text-right">
                        {beatsPb && (
                          <div className="flex items-center gap-1 text-[10px] font-black text-[#06FFA5]">
                            <Rocket size={10} />
                            <span>Pronto a −{r.gap}s</span>
                          </div>
                        )}
                        {closeToPb && (
                          <div className="text-[10px] font-black text-[#F59E0B]">PB in vista</div>
                        )}
                        {!beatsPb && !closeToPb && r.gap !== null && r.gap < 0 && (
                          <div className="text-[10px] font-black text-[#555]">{Math.abs(r.gap)}s sopra</div>
                        )}
                        <div className="text-[8.5px] text-[#444] font-bold">{r.pbDate}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#080808] border border-dashed border-white/[0.06] rounded-xl px-3 py-2 text-center">
                      <div className="text-[10px] font-black text-[#444] tracking-wider">Nessuna gara registrata</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MOMENTUM — trend VDOT 12 mesi + proiezione futura
      ═══════════════════════════════════════════════════════════ */}
      <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 lg:p-8">
        <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight size={14} style={{ color: LIME }} />
              <span className="text-[10px] font-black tracking-[0.25em] uppercase text-[#A0A0A0]">
                Momentum
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">La tua traiettoria</h2>
            <div className="text-[11px] text-[#666] font-bold mt-1">
              Trend VDOT 12 mesi + proiezione 3 mesi futuri al ritmo attuale
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: LIME, boxShadow: `0 0 8px ${LIME}` }} />
              <span className="text-[10px] font-bold text-[#888]">Storico</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full border border-dashed" style={{ borderColor: VIOLET }} />
              <span className="text-[10px] font-bold text-[#888]">Proiezione</span>
            </div>
          </div>
        </div>

        {vdotWithForecast.length >= 3 ? (
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={vdotWithForecast} margin={{ top: 10, right: 20, bottom: 5, left: -10 }}>
                <defs>
                  <linearGradient id="momentumHist" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={LIME} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={LIME} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="momentumFcst" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={VIOLET} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={VIOLET} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} width={32} />
                <Tooltip
                  contentStyle={{ background: "#0E0E0E", border: "1px solid #2A2A2A", borderRadius: 10, color: "#fff", fontSize: 11 }}
                  formatter={(value: any, name: string) => {
                    if (value === null || value === undefined) return ["—", name];
                    return [Number(value).toFixed(1), name === "vdot" ? "VDOT" : "Proiezione"];
                  }}
                  cursor={{ stroke: "rgba(255,255,255,0.08)" }}
                />
                <Area type="monotone" dataKey="vdot" stroke={LIME} strokeWidth={2.5}
                  fill="url(#momentumHist)" dot={{ r: 3, fill: LIME, strokeWidth: 0 }}
                  activeDot={{ r: 5, stroke: LIME, strokeWidth: 2, fill: "#000" }} />
                <Area type="monotone" dataKey="forecast" stroke={VIOLET} strokeWidth={2}
                  strokeDasharray="4 3" fill="url(#momentumFcst)"
                  dot={{ r: 2.5, fill: VIOLET, strokeWidth: 0 }} />
                <ReferenceLine y={level.nextThreshold} stroke={level.color} strokeDasharray="2 4" strokeOpacity={0.4}>
                </ReferenceLine>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-[#444] text-xs font-bold">Almeno 3 mesi di dati richiesti</div>
        )}

        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="bg-[#0E0E0E] border border-white/[0.05] rounded-2xl px-4 py-3 flex flex-col gap-1">
            <div className="text-[9px] font-black text-[#555] tracking-widest uppercase">Crescita 90gg</div>
            <div className="text-xl font-black tabular-nums" style={{ color: vdotDelta90 && vdotDelta90 > 0 ? CYAN : ROSE }}>
              {vdotDelta90 !== null ? `${vdotDelta90 > 0 ? "+" : ""}${vdotDelta90}` : "—"}
            </div>
          </div>
          <div className="bg-[#0E0E0E] border border-white/[0.05] rounded-2xl px-4 py-3 flex flex-col gap-1">
            <div className="text-[9px] font-black text-[#555] tracking-widest uppercase">Prossimo livello</div>
            <div className="text-xl font-black tabular-nums" style={{ color: vdotLevel(level.nextThreshold).color }}>
              VDOT {level.nextThreshold}
            </div>
          </div>
          <div className="bg-[#0E0E0E] border border-white/[0.05] rounded-2xl px-4 py-3 flex flex-col gap-1">
            <div className="text-[9px] font-black text-[#555] tracking-widest uppercase">Stima sblocco</div>
            <div className="text-xl font-black tabular-nums text-white">
              {(() => {
                const gap = level.nextThreshold - currentVdot;
                const slope = vdotDelta90 ? vdotDelta90 / 90 : 0;
                if (slope <= 0) return "—";
                const days = Math.round(gap / slope);
                if (days < 30) return `${days}g`;
                if (days < 365) return `${Math.round(days / 30)}m`;
                return ">1a";
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          PRONTEZZA GARA (radar) + PROSSIMI OBIETTIVI
      ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Radar */}
        <div className="lg:col-span-2 bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Heart size={14} style={{ color: LIME }} />
              <span className="text-[10px] font-black tracking-[0.25em] uppercase text-[#A0A0A0]">
                Prontezza gara
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-black text-white tabular-nums">{readiness.overall}</span>
              <span className="text-xs text-[#666] font-bold">/100</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full ml-auto"
                style={{ background: `${LIME}18`, color: LIME, border: `1px solid ${LIME}30` }}>
                Limita · {readiness.limiter}
              </span>
            </div>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={readiness.axes.map(a => ({ subject: a.label, value: a.value }))}>
                <defs>
                  <linearGradient id="ppRadarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={LIME} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={LIME} stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#888", fontSize: 10, fontWeight: 700 }} />
                <Radar dataKey="value" stroke={LIME} strokeWidth={2} fill="url(#ppRadarGrad)" />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {readiness.axes.map(a => (
              <div key={a.label} className="flex flex-col items-center gap-1">
                <div className="text-[11px] font-black text-white tabular-nums">{a.value}</div>
                <div className="text-[8px] text-[#555] font-bold">{a.label.slice(0, 5)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Milestones */}
        <div className="lg:col-span-3 bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Award size={14} style={{ color: LIME }} />
              <span className="text-[10px] font-black tracking-[0.25em] uppercase text-[#A0A0A0]">
                Prossimi traguardi
              </span>
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">Cosa puoi sbloccare</h2>
          </div>
          {milestones.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[#444] text-xs font-bold py-12">
              Continua a correre per sbloccare traguardi
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {milestones.map((m, i) => (
                <div key={i} className="bg-[#0E0E0E] border border-white/[0.05] rounded-2xl p-4 flex items-center gap-4 hover:border-white/[0.12] transition-all group">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${m.color}18`, border: `1px solid ${m.color}30` }}>
                    <m.icon size={16} style={{ color: m.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <div className="text-sm font-black text-white truncate">{m.label}</div>
                      <div className="text-[10px] font-black tabular-nums" style={{ color: m.color }}>{m.eta}</div>
                    </div>
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span className="text-[10px] text-[#666] font-bold">Ora</span>
                      <span className="text-[11px] font-black text-[#999] tabular-nums">{m.current}</span>
                      <ChevronRight size={10} className="text-[#444]" />
                      <span className="text-[10px] text-[#666] font-bold">Target</span>
                      <span className="text-[11px] font-black tabular-nums" style={{ color: m.color }}>{m.target}</span>
                    </div>
                    <div className="w-full bg-[#1a1a1a] rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{
                          width: `${m.pct}%`,
                          background: `linear-gradient(90deg, ${m.color}AA, ${m.color})`,
                          boxShadow: `0 0 10px ${m.color}55`,
                          transition: "width 1.4s ease-out",
                        }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          PACE EVOLUTION — passo medio mensile
      ═══════════════════════════════════════════════════════════ */}
      <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 lg:p-8">
        <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Timer size={14} style={{ color: LIME }} />
              <span className="text-[10px] font-black tracking-[0.25em] uppercase text-[#A0A0A0]">
                Evoluzione passo
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">Quanto sei diventato veloce</h2>
            <div className="text-[11px] text-[#666] font-bold mt-1">Passo medio mensile · ultimi 12 mesi</div>
          </div>
          {paceTrend.length >= 2 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl"
              style={{ background: paceImprovement > 0 ? `${CYAN}12` : `${ROSE}12`, border: `1px solid ${paceImprovement > 0 ? CYAN : ROSE}30` }}>
              {paceImprovement > 0
                ? <TrendingUp size={14} style={{ color: CYAN }} />
                : <TrendingDown size={14} style={{ color: ROSE }} />}
              <div className="flex flex-col">
                <span className="text-[9px] font-black tracking-wider uppercase" style={{ color: paceImprovement > 0 ? CYAN : ROSE }}>
                  {paceImprovement > 0 ? "Più veloce di" : "Più lento di"}
                </span>
                <span className="text-base font-black tabular-nums" style={{ color: paceImprovement > 0 ? CYAN : ROSE }}>
                  {Math.abs(paceImprovement)}s/km
                </span>
              </div>
            </div>
          )}
        </div>
        {paceTrend.length >= 2 ? (
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={paceTrend} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
                <defs>
                  <linearGradient id="paceEvo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SKY} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={SKY} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} domain={[paceMin, paceMax]}
                  tickFormatter={fmtPaceSec} reversed width={40} />
                <Tooltip
                  contentStyle={{ background: "#0E0E0E", border: "1px solid #2A2A2A", borderRadius: 10, color: "#fff", fontSize: 11 }}
                  formatter={(v: number) => [fmtPaceSec(v) + "/km", "Passo"]}
                  cursor={{ stroke: "rgba(255,255,255,0.08)" }}
                />
                <Area type="monotone" dataKey="paceSec" stroke={SKY} strokeWidth={2.5}
                  fill="url(#paceEvo)" dot={{ r: 3, fill: SKY, strokeWidth: 0 }}
                  activeDot={{ r: 5, stroke: SKY, strokeWidth: 2, fill: "#000" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-[#444] text-xs font-bold">Dati insufficienti</div>
        )}
      </div>

    </div>
  );
}
