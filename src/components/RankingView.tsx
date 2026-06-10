/**
 * RANKING — METIC LAB
 * La Mia Classifica in stile "carta atleta" (come Runner DNA):
 * rank card con bordo gradiente, percentile FUT-style, tier ladder,
 * card distanza, radar multi-distanza, scouting Riegel.
 * Dati reali: profilo + best efforts. Benchmark FIDAL/ENDU/WAVA.
 */

import { useState, useEffect, useMemo } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, Tooltip as RechartTooltip,
} from "recharts";
import { Target, Trophy, Zap, Award, RefreshCw, BarChart2, TrendingUp } from "lucide-react";
import { getProfile, getBestEfforts } from "../api";
import type { Profile, BestEffort } from "../types/api";

const MONO = "JetBrains Mono, monospace";

const CARD =
  "rounded-3xl p-6 backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50";

// ─────────────────────────────────────────────────────────────────────────────
// DATA CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

type Sex = "M" | "F";
type DistKey = "3K" | "5K" | "10K" | "HM" | "M";

interface TierDef {
  id: string;
  label: string;
  sublabel: string;
  color: string;
  minPct: number;
  textColor: string;
}

const TIERS: TierDef[] = [
  { id: "podio",      label: "PODIO CATEGORIA",        sublabel: "Top 1%",  color: "#FFD700", textColor: "#000", minPct: 99 },
  { id: "elite",      label: "ELITE AMATORIALE",        sublabel: "Top 3%",  color: "#C0FF00", textColor: "#000", minPct: 97 },
  { id: "competitive",label: "COMPETITIVO NAZIONALE",   sublabel: "Top 10%", color: "#22D3EE", textColor: "#000", minPct: 90 },
  { id: "advanced",   label: "AVANZATO",                sublabel: "Top 25%", color: "#A78BFA", textColor: "#fff", minPct: 75 },
  { id: "warrior",    label: "GUERRIERO DELLA DOMENICA",sublabel: "Top 50%", color: "#FB923C", textColor: "#fff", minPct: 0  },
];

// Base benchmarks — Open Male, competitive Italian context (FIDAL + ENDU 2022-2024)
const BASE_BENCHMARKS_M: Record<DistKey, Record<string, number>> = {
  "3K":  { podio: 555,   elite: 585,   competitive: 660,   advanced: 780,  warrior: 960  },
  "5K":  { podio: 930,   elite: 990,   competitive: 1140,  advanced: 1350, warrior: 1680 },
  "10K": { podio: 1860,  elite: 2010,  competitive: 2280,  advanced: 2640, warrior: 3240 },
  "HM":  { podio: 4440,  elite: 4680,  competitive: 5340,  advanced: 6180, warrior: 7500 },
  "M":   { podio: 10080, elite: 10500, competitive: 12000, advanced: 13680,warrior: 16200 },
};

// Female benchmarks (~12-15% slower, FIDAL master data)
const BASE_BENCHMARKS_F: Record<DistKey, Record<string, number>> = {
  "3K":  { podio: 630,   elite: 675,   competitive: 765,   advanced: 900,  warrior: 1110 },
  "5K":  { podio: 1080,  elite: 1140,  competitive: 1320,  advanced: 1560, warrior: 1920 },
  "10K": { podio: 2160,  elite: 2340,  competitive: 2640,  advanced: 3060, warrior: 3720 },
  "HM":  { podio: 5040,  elite: 5400,  competitive: 6120,  advanced: 7080, warrior: 8520 },
  "M":   { podio: 11400, elite: 12000, competitive: 13560, advanced: 15540,warrior: 18300 },
};

// Competitive distribution (FIDAL + tesserati) — log-normal, σ=0.22
const DIST_PARAMS: Record<Sex, Record<DistKey, { mu: number; sigma: number }>> = {
  M: {
    "3K":  { mu: Math.log(960),   sigma: 0.22 },
    "5K":  { mu: Math.log(1680),  sigma: 0.22 },
    "10K": { mu: Math.log(3240),  sigma: 0.22 },
    "HM":  { mu: Math.log(7500),  sigma: 0.22 },
    "M":   { mu: Math.log(16200), sigma: 0.22 },
  },
  F: {
    "3K":  { mu: Math.log(1110),  sigma: 0.22 },
    "5K":  { mu: Math.log(1920),  sigma: 0.22 },
    "10K": { mu: Math.log(3720),  sigma: 0.22 },
    "HM":  { mu: Math.log(8520),  sigma: 0.22 },
    "M":   { mu: Math.log(18300), sigma: 0.22 },
  },
};

// ALL PARTICIPANTS — ENDU + MySDAM + Parkrun Italy + Run Card + non competitive
const ALL_PARTICIPANTS_PARAMS: Record<Sex, Record<DistKey, { mu: number; sigma: number }>> = {
  M: {
    "3K":  { mu: Math.log(1080),  sigma: 0.30 },
    "5K":  { mu: Math.log(1800),  sigma: 0.30 },
    "10K": { mu: Math.log(3720),  sigma: 0.30 },
    "HM":  { mu: Math.log(8100),  sigma: 0.30 },
    "M":   { mu: Math.log(17100), sigma: 0.30 },
  },
  F: {
    "3K":  { mu: Math.log(1320),  sigma: 0.30 },
    "5K":  { mu: Math.log(2160),  sigma: 0.30 },
    "10K": { mu: Math.log(4440),  sigma: 0.30 },
    "HM":  { mu: Math.log(9600),  sigma: 0.30 },
    "M":   { mu: Math.log(19200), sigma: 0.30 },
  },
};

const ALL_POP_TIERS = [
  { minPct: 98, label: "ÉLITE ASSOLUTA",     color: "#FFD700" },
  { minPct: 93, label: "ATLETA COMPETITIVO", color: "#C0FF00" },
  { minPct: 80, label: "RUNNER AVANZATO",    color: "#22D3EE" },
  { minPct: 60, label: "RUNNER ATTIVO",      color: "#A78BFA" },
  { minPct: 35, label: "RUN CARD RUNNER",    color: "#FB923C" },
  { minPct: 0,  label: "FINISHER",           color: "#6B7280" },
];

// World Records (seconds) for WAVA age-graded score
const WORLD_RECORDS: Record<Sex, Record<DistKey, number>> = {
  M: { "3K": 440, "5K": 755, "10K": 1577, "HM": 3451, "M": 7235 },
  F: { "3K": 489, "5K": 845, "10K": 1760, "HM": 4012, "M": 7954 },
};

// WAVA age factors (WMA 2015 tables)
const WAVA_FACTORS: Record<Sex, Array<{ minAge: number; factor: number }>> = {
  M: [
    { minAge: 20, factor: 1.000 }, { minAge: 35, factor: 0.966 },
    { minAge: 40, factor: 0.942 }, { minAge: 45, factor: 0.909 },
    { minAge: 50, factor: 0.868 }, { minAge: 55, factor: 0.821 },
    { minAge: 60, factor: 0.769 }, { minAge: 65, factor: 0.714 },
    { minAge: 70, factor: 0.656 },
  ],
  F: [
    { minAge: 20, factor: 1.000 }, { minAge: 35, factor: 0.962 },
    { minAge: 40, factor: 0.940 }, { minAge: 45, factor: 0.912 },
    { minAge: 50, factor: 0.876 }, { minAge: 55, factor: 0.829 },
    { minAge: 60, factor: 0.774 }, { minAge: 65, factor: 0.718 },
    { minAge: 70, factor: 0.660 },
  ],
};

// FIDAL Master categories
const FIDAL_CATEGORIES: Record<Sex, Array<{ minAge: number; maxAge: number; label: string }>> = {
  M: [
    { minAge: 18, maxAge: 34, label: "SM" }, { minAge: 35, maxAge: 39, label: "SM35" },
    { minAge: 40, maxAge: 44, label: "SM40" }, { minAge: 45, maxAge: 49, label: "SM45" },
    { minAge: 50, maxAge: 54, label: "SM50" }, { minAge: 55, maxAge: 59, label: "SM55" },
    { minAge: 60, maxAge: 64, label: "SM60" }, { minAge: 65, maxAge: 69, label: "SM65" },
    { minAge: 70, maxAge: 99, label: "SM70+" },
  ],
  F: [
    { minAge: 18, maxAge: 34, label: "SF" }, { minAge: 35, maxAge: 39, label: "SF35" },
    { minAge: 40, maxAge: 44, label: "SF40" }, { minAge: 45, maxAge: 49, label: "SF45" },
    { minAge: 50, maxAge: 54, label: "SF50" }, { minAge: 55, maxAge: 59, label: "SF55" },
    { minAge: 60, maxAge: 64, label: "SF60" }, { minAge: 65, maxAge: 69, label: "SF65" },
    { minAge: 70, maxAge: 99, label: "SF70+" },
  ],
};

const DISTANCES: Array<{ key: DistKey; label: string; meters: number }> = [
  { key: "3K",  label: "3.000m",        meters: 3000  },
  { key: "5K",  label: "5.000m",        meters: 5000  },
  { key: "10K", label: "10 Km",         meters: 10000 },
  { key: "HM",  label: "Mezza Maratona",meters: 21097 },
  { key: "M",   label: "Maratona",      meters: 42195 },
];

const PB_KEYS: Record<DistKey, string[]> = {
  "3K":  ["3K", "3k", "3000", "3000m", "3 km"],
  "5K":  ["5K", "5k", "5000", "5000m", "5 km"],
  "10K": ["10K", "10k", "10000", "10000m", "10 km"],
  "HM":  ["Half Marathon", "Mezza Maratona", "Mezza", "21K", "21k", "21097", "HALF MARATHON", "21,1 km", "21.1 km"],
  "M":   ["Marathon", "Maratona", "42K", "42k", "42195", "MARATHON", "42,2 km", "42.2 km"],
};

// Maps BestEffort.distance labels (from Strava) → our DistKey
const EFFORT_TO_DIST: Array<{ key: DistKey; candidates: string[] }> = [
  { key: "3K",  candidates: ["3 km", "3k", "3000m", "3K", "3000 m"] },
  { key: "5K",  candidates: ["5 km", "5k", "5000m", "5K", "5000 m"] },
  { key: "10K", candidates: ["10 km", "10k", "10000m", "10K", "10000 m"] },
  { key: "HM",  candidates: ["Mezza Maratona", "Half Marathon", "21 km", "21K", "21k", "21097m", "21,1 km"] },
  { key: "M",   candidates: ["Marathon", "Maratona", "42 km", "42K", "42k", "42195m", "42,2 km"] },
];

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function parseTime(str: string): number | null {
  const s = str.trim();
  const parts = s.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatPace(timeSeconds: number, distMeters: number): string {
  const paceSecPerKm = (timeSeconds / distMeters) * 1000;
  const m = Math.floor(paceSecPerKm / 60);
  const s = Math.round(paceSecPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

function getWavaFactor(sex: Sex, age: number): number {
  const rows = WAVA_FACTORS[sex];
  let factor = rows[0].factor;
  for (const row of rows) {
    if (age >= row.minAge) factor = row.factor;
    else break;
  }
  return factor;
}

function getFidalCategory(sex: Sex, age: number): string {
  const rows = FIDAL_CATEGORIES[sex];
  for (const row of rows) {
    if (age >= row.minAge && age <= row.maxAge) return row.label;
  }
  return sex === "M" ? "SM" : "SF";
}

// Peter Acklam's probit (inverse normal CDF)
function probit(p: number): number {
  const p_low = 0.02425, p_high = 1 - p_low;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
              1.383577518672690e+02, -3.066479806614716e+01,  2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
              6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
              -2.549732539343734e+00,  4.374664141464968e+00,  2.938163982698783e+00];
  const d = [ 7.784695709041462e-03,  3.224671290700398e-01,  2.445134137142996e+00, 3.754408661907416e+00];
  const clamp = Math.min(Math.max(p, 1e-9), 1 - 1e-9);
  let q: number, r: number;
  if (clamp < p_low) {
    q = Math.sqrt(-2 * Math.log(clamp));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (clamp <= p_high) {
    q = clamp - 0.5; r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - clamp));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
             ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

// Standard normal CDF
function normCDF(z: number): number {
  const t = 1 / (1 + 0.2315419 * Math.abs(z));
  const d = 0.3989422820 * Math.exp(-z * z / 2);
  const poly = t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
  const p = 1 - d * poly;
  return z >= 0 ? p : 1 - p;
}

function computePercentile(userSec: number, dist: DistKey, sex: Sex): number {
  const { mu, sigma } = DIST_PARAMS[sex][dist];
  const z = (Math.log(userSec) - mu) / sigma;
  return Math.round(Math.min(Math.max((1 - normCDF(z)) * 100, 0.1), 99.9) * 10) / 10;
}

function computeAllParticipantsPct(userSec: number, dist: DistKey, sex: Sex): number {
  const { mu, sigma } = ALL_PARTICIPANTS_PARAMS[sex][dist];
  const z = (Math.log(userSec) - mu) / sigma;
  return Math.round(Math.min(Math.max((1 - normCDF(z)) * 100, 0.1), 99.9) * 10) / 10;
}

function getTierFromPct(pct: number): TierDef {
  for (const tier of TIERS) {
    if (pct >= tier.minPct) return tier;
  }
  return TIERS[TIERS.length - 1];
}

function getAllPopTier(pct: number) {
  for (const t of ALL_POP_TIERS) {
    if (pct >= t.minPct) return t;
  }
  return ALL_POP_TIERS[ALL_POP_TIERS.length - 1];
}

function getAdjustedBenchmarks(dist: DistKey, sex: Sex, age: number): Record<string, number> {
  const base = sex === "M" ? BASE_BENCHMARKS_M[dist] : BASE_BENCHMARKS_F[dist];
  const factor = getWavaFactor(sex, age);
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(base)) {
    result[k] = Math.round(v / factor);
  }
  return result;
}

function computeWAVA(userSec: number, dist: DistKey, sex: Sex, age: number): number {
  const wr = WORLD_RECORDS[sex][dist];
  const factor = getWavaFactor(sex, age);
  return Math.round((wr * factor / userSec) * 1000) / 10;
}

function riegelPredict(timeSec: number, fromMeters: number, toMeters: number): number {
  return timeSec * Math.pow(toMeters / fromMeters, 1.06);
}

function getNextTier(pct: number): { tier: TierDef; gapPct: number } | null {
  const sorted = [...TIERS].reverse();
  for (const tier of sorted) {
    if (pct < tier.minPct) return { tier, gapPct: tier.minPct - pct };
  }
  return null;
}

function computeTimeGapForNextTier(
  userSec: number, dist: DistKey, sex: Sex, nextTierMinPct: number
): number {
  const { mu, sigma } = DIST_PARAMS[sex][dist];
  const targetZ = probit(1 - nextTierMinPct / 100);
  const targetSec = Math.exp(targetZ * sigma + mu);
  return userSec - targetSec;
}

function findPb(pbs: Record<string, { time: string }>, candidates: string[]): string | null {
  const keys = Object.keys(pbs);
  const match = keys.find(k => candidates.some(c => k.toLowerCase() === c.toLowerCase()));
  return match ? pbs[match].time : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI PRIMITIVES (stile carta atleta — come Runner DNA)
// ─────────────────────────────────────────────────────────────────────────────

function CardHeader({
  title, subtitle, icon: Icon, right,
}: {
  title: string; subtitle: string;
  icon?: React.ComponentType<{ className?: string }>;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h3 className="text-white text-base font-black tracking-tight flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-[#C0FF00]" />}
          {title}
        </h3>
        <p className="text-[#A0A0A0] text-[10px] tracking-widest uppercase mt-1">{subtitle}</p>
      </div>
      {right}
    </div>
  );
}

function PillBadge({ label, color = "#C0FF00" }: { label: string; color?: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1 rounded-full shrink-0"
      style={{ background: `${color}10`, border: `1px solid ${color}20` }}
    >
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span className="text-[10px] font-black tracking-widest uppercase" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

// Riga stat FUT-style della rank card: percentile + distanza + barra + tempo
function RankStatRow({ dist, pct, time, color, delay }: {
  dist: DistKey; pct: number; time: string; color: string; delay: number;
}) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFilled(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className="flex items-center gap-3">
      <span className="w-11 text-2xl font-black tabular-nums leading-none" style={{ fontFamily: MONO, color }}>
        {Math.round(pct)}
      </span>
      <span className="w-9 text-[10px] font-black tracking-[0.15em] text-gray-400">{dist}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: filled ? `${pct}%` : "0%", background: color }}
        />
      </div>
      <span className="w-16 text-right text-[11px] font-bold tabular-nums text-gray-400" style={{ fontFamily: MONO }}>
        {time}
      </span>
    </div>
  );
}

// Doppia barra popolazione (competitivo / tutti i runner)
function PopBars({ compPct, allPct }: { compPct: number; allPct: number }) {
  const compTier = getTierFromPct(compPct);
  const allTier = getAllPopTier(allPct);
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-black tracking-[0.14em] uppercase text-gray-500">
            Campo competitivo · FIDAL
          </span>
          <span className="text-[10px] font-black tabular-nums" style={{ fontFamily: MONO, color: compTier.color }}>
            TOP {Math.max(1, Math.round(100 - compPct))}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${compPct}%`, background: compTier.color }} />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-black tracking-[0.14em] uppercase text-gray-500">
            Tutti i runner · ENDU/Parkrun
          </span>
          <span className="text-[10px] font-black tabular-nums" style={{ fontFamily: MONO, color: allTier.color }}>
            TOP {Math.max(1, Math.round(100 - allPct))}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${allPct}%`, background: allTier.color }} />
        </div>
      </div>
    </div>
  );
}

// Card per singola distanza
function DistanceRankCard({ dist, userSec, sex, age }: {
  dist: DistKey; userSec: number; sex: Sex; age: number;
}) {
  const distInfo = DISTANCES.find(d => d.key === dist)!;
  const compPct = computePercentile(userSec, dist, sex);
  const allPct = computeAllParticipantsPct(userSec, dist, sex);
  const tier = getTierFromPct(compPct);
  const nextTier = getNextTier(compPct);
  const gapSec = nextTier ? computeTimeGapForNextTier(userSec, dist, sex, nextTier.tier.minPct) : 0;
  const wava = computeWAVA(userSec, dist, sex, age);
  const pace = formatPace(userSec, distInfo.meters);
  const wavaColor = wava >= 80 ? "#FFD700" : wava >= 70 ? "#C0FF00" : wava >= 60 ? "#22D3EE" : "#A78BFA";

  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black tracking-[0.2em] uppercase text-gray-500">
            {distInfo.label}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black tabular-nums leading-none text-white" style={{ fontFamily: MONO }}>
              {formatTime(userSec)}
            </span>
            <span className="text-[10px] font-bold text-gray-500" style={{ fontFamily: MONO }}>{pace}</span>
          </div>
          <div className="mt-3">
            <PillBadge label={tier.label} color={tier.color} />
          </div>
        </div>
        <div className="text-right shrink-0">
          <div
            className="text-5xl font-black italic tabular-nums leading-none"
            style={{ fontFamily: MONO, color: tier.color, textShadow: `0 0 24px ${tier.color}50` }}
          >
            {Math.round(compPct)}
          </div>
          <div className="mt-1 text-[9px] font-black tracking-[0.2em] uppercase text-gray-600">
            Percentile
          </div>
        </div>
      </div>

      <div className="pt-4 mt-4 border-t border-white/[0.06]">
        <PopBars compPct={compPct} allPct={allPct} />
      </div>

      <div className="grid grid-cols-3 gap-3 pt-4 mt-4 border-t border-white/[0.06]">
        <div>
          <div className="text-[#555] text-[9px] font-black tracking-widest uppercase">Age-graded</div>
          <div className="mt-1 text-lg font-black tabular-nums leading-none" style={{ fontFamily: MONO, color: wavaColor }}>
            {wava.toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="text-[#555] text-[9px] font-black tracking-widest uppercase">Prossimo tier</div>
          {nextTier ? (
            <div className="mt-1 text-lg font-black tabular-nums leading-none" style={{ fontFamily: MONO, color: nextTier.tier.color }}>
              -{formatTime(Math.round(Math.max(gapSec, 0)))}
            </div>
          ) : (
            <div className="mt-1 text-lg font-black leading-none" style={{ fontFamily: MONO, color: "#FFD700" }}>
              PODIO
            </div>
          )}
        </div>
        <div>
          <div className="text-[#555] text-[9px] font-black tracking-widest uppercase">Categoria</div>
          <div className="mt-1 text-lg font-black leading-none text-white" style={{ fontFamily: MONO }}>
            {getFidalCategory(sex, age)}
          </div>
        </div>
      </div>

      {nextTier && (
        <div className="mt-4">
          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${Math.min(100, (compPct / nextTier.tier.minPct) * 100)}%`,
                background: `linear-gradient(90deg, ${tier.color}, ${nextTier.tier.color})`,
              }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[9px] font-black tracking-[0.12em] uppercase">
            <span style={{ color: tier.color }}>{tier.label}</span>
            <span style={{ color: nextTier.tier.color }}>{nextTier.tier.label}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Radar multi-distanza
function MultiDistRadar({ userTimes, sex }: {
  userTimes: Partial<Record<DistKey, number>>;
  sex: Sex;
}) {
  const activeDists = DISTANCES.filter(d => !!userTimes[d.key]);
  if (activeDists.length < 3) return null;

  const radarData = activeDists.map(d => {
    const sec = userTimes[d.key]!;
    return {
      dist: d.key,
      "Campo Competitivo": Math.round(computePercentile(sec, d.key, sex)),
      "Tutti i Runner":    Math.round(computeAllParticipantsPct(sec, d.key, sex)),
    };
  });

  return (
    <div className={CARD}>
      <CardHeader
        title="Radar Multi-Distanza"
        subtitle="Percentile per distanza · 0-100"
        icon={BarChart2}
      />
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis
            dataKey="dist"
            tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11, fontFamily: "JetBrains Mono", fontWeight: 700 }}
          />
          <PolarRadiusAxis
            domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 8 }}
            tickCount={5}
          />
          <Radar
            name="Campo Competitivo"
            dataKey="Campo Competitivo"
            stroke="#C0FF00"
            fill="#C0FF00"
            fillOpacity={0.15}
            strokeWidth={2}
          />
          <Radar
            name="Tutti i Runner"
            dataKey="Tutti i Runner"
            stroke="#22D3EE"
            fill="#22D3EE"
            fillOpacity={0.10}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <Legend
            wrapperStyle={{ fontSize: 9, fontFamily: "JetBrains Mono", color: "rgba(255,255,255,0.5)", paddingTop: 8 }}
          />
          <RechartTooltip
            contentStyle={{
              background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12, fontSize: 10, fontFamily: "JetBrains Mono",
            }}
            labelStyle={{ color: "#C0FF00", fontWeight: 700 }}
            formatter={(v: number, name: string) => [`${v}° percentile`, name]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Tabella comparativa tier — tutti i PB
function ComparativeTierTable({ userTimes, sex, age }: {
  userTimes: Partial<Record<DistKey, number>>;
  sex: Sex;
  age: number;
}) {
  const activeDists = DISTANCES.filter(d => !!userTimes[d.key]);
  if (activeDists.length === 0) return null;

  const tierKeys = ["podio", "elite", "competitive", "advanced", "warrior"] as const;

  return (
    <div className={CARD + " !p-0 overflow-hidden"}>
      <div className="px-6 pt-6 pb-5">
        <CardHeader
          title="Tabella Tier"
          subtitle="Soglie età-aggiustate · tutti i tuoi PB"
          icon={Award}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full" style={{ fontFamily: MONO }}>
          <thead>
            <tr className="border-y border-white/[0.06] bg-white/[0.02]">
              <th className="px-6 py-2.5 text-left text-[9px] font-black tracking-[0.18em] text-gray-500 uppercase">Tier</th>
              {activeDists.map(d => (
                <th key={d.key} className="px-4 py-2.5 text-center text-[9px] font-black tracking-[0.14em] text-gray-500 uppercase">
                  {d.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#C0FF00]/15 bg-[#C0FF00]/[0.04]">
              <td className="px-6 py-3">
                <span className="text-[10px] font-black tracking-[0.14em] text-[#C0FF00] uppercase">I miei PB</span>
              </td>
              {activeDists.map(d => {
                const sec = userTimes[d.key]!;
                const tier = getTierFromPct(computePercentile(sec, d.key, sex));
                return (
                  <td key={d.key} className="px-4 py-3 text-center">
                    <div className="text-sm font-black tabular-nums" style={{ color: tier.color }}>
                      {formatTime(sec)}
                    </div>
                    <div className="text-[8px] text-gray-600 mt-0.5">
                      {formatPace(sec, DISTANCES.find(dd => dd.key === d.key)!.meters)}
                    </div>
                  </td>
                );
              })}
            </tr>
            {tierKeys.map(tkey => {
              const tier = TIERS.find(t => t.id === tkey)!;
              return (
                <tr key={tkey} className="border-b border-white/[0.04] last:border-b-0">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tier.color }} />
                      <div>
                        <div className="text-[9px] font-black tracking-[0.1em] uppercase" style={{ color: tier.color }}>
                          {tier.label}
                        </div>
                        <div className="text-[8px] text-gray-600">{tier.sublabel}</div>
                      </div>
                    </div>
                  </td>
                  {activeDists.map(d => {
                    const benchmark = getAdjustedBenchmarks(d.key, sex, age)[tkey];
                    const userSec = userTimes[d.key]!;
                    const beaten = userSec <= benchmark;
                    const gap = userSec - benchmark;
                    const userTier = getTierFromPct(computePercentile(userSec, d.key, sex));
                    const isCurrentTier = userTier.id === tkey;
                    return (
                      <td key={d.key} className="px-4 py-3 text-center"
                        style={{ background: isCurrentTier ? `${tier.color}10` : "transparent" }}>
                        <div className="text-[11px] font-black tabular-nums"
                          style={{ color: isCurrentTier ? tier.color : "rgba(255,255,255,0.55)" }}>
                          {formatTime(benchmark)}
                        </div>
                        <div className="text-[8px] mt-0.5 font-bold"
                          style={{ color: isCurrentTier ? tier.color : beaten ? "#22D3EE" : "rgba(255,255,255,0.25)" }}>
                          {isCurrentTier ? "SEI QUI" : beaten ? `+${formatTime(Math.abs(gap))}` : `-${formatTime(Math.abs(gap))}`}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Scouting Riegel — forza/deficit per distanza
function RiegelScouting({ userTimes, sex, fidalCat }: {
  userTimes: Partial<Record<DistKey, number>>;
  sex: Sex;
  fidalCat: string;
}) {
  const activeDists = DISTANCES.filter(d => !!userTimes[d.key]);
  if (activeDists.length < 2) return null;

  const base = activeDists[0];
  const baseSec = userTimes[base.key]!;
  const basePct = computePercentile(baseSec, base.key, sex);

  const analysis = activeDists
    .filter(d => d.key !== base.key)
    .map(d => {
      const predicted = riegelPredict(baseSec, base.meters, d.meters);
      const actual = userTimes[d.key]!;
      const actualPct = computePercentile(actual, d.key, sex);
      return { dist: d.key, label: d.label, actualSec: actual, predictedSec: predicted, pctDiff: actualPct - basePct };
    });

  const deficits = analysis.filter(a => a.pctDiff < -5);
  const strengths = analysis.filter(a => a.pctDiff > 5);
  const balanced = analysis.filter(a => Math.abs(a.pctDiff) <= 5);

  return (
    <div className={CARD}>
      <CardHeader
        title="Scouting Riegel"
        subtitle={`Equilibrio tra distanze · ${fidalCat} · base ${base.key}`}
        icon={Target}
      />

      <div className="space-y-2.5">
        {strengths.map(s => (
          <div key={s.dist} className="flex gap-3 items-start text-xs leading-5 text-[#A0A0A0]">
            <span className="w-4 shrink-0 text-center font-bold text-[#C0FF00]" style={{ fontFamily: MONO }}>+</span>
            <span>
              <span className="text-[#C0FF00] font-black">{s.label}</span> — sopra la tua media di{" "}
              <span className="font-black text-white">+{Math.round(s.pctDiff)} percentili</span>: qui sei più forte del tuo profilo.
            </span>
          </div>
        ))}
        {deficits.map(d => (
          <div key={d.dist} className="flex gap-3 items-start text-xs leading-5 text-[#A0A0A0]">
            <span className="w-4 shrink-0 text-center font-bold text-[#F43F5E]" style={{ fontFamily: MONO }}>−</span>
            <span>
              <span className="text-[#F43F5E] font-black">{d.label}</span> — il Riegel prevede{" "}
              <span className="font-black text-white" style={{ fontFamily: MONO }}>{formatTime(Math.round(d.predictedSec))}</span>,
              hai <span className="font-black text-white" style={{ fontFamily: MONO }}>{formatTime(d.actualSec)}</span>.{" "}
              {d.dist === "M" || d.dist === "HM" ? "Deficit di resistenza aerobica." : "Deficit di velocità/lattacido."}
            </span>
          </div>
        ))}
        {balanced.map(b => (
          <div key={b.dist} className="flex gap-3 items-start text-xs leading-5 text-[#A0A0A0]">
            <span className="w-4 shrink-0 text-center font-bold text-[#22D3EE]" style={{ fontFamily: MONO }}>=</span>
            <span>
              <span className="text-[#22D3EE] font-black">{b.label}</span> — coerente con il tuo profilo.
            </span>
          </div>
        ))}
      </div>

      {(deficits.some(d => d.dist === "M" || d.dist === "HM") || deficits.some(d => d.dist === "3K" || d.dist === "5K")) && (
        <div className="pt-4 mt-4 border-t border-white/[0.06] space-y-2">
          {deficits.some(d => d.dist === "M" || d.dist === "HM") && (
            <p className="text-[11px] leading-5 text-gray-400">
              La distanza lunga è sbilanciata rispetto ai tuoi numeri brevi: aumenta il volume delle long run al 65-70% LTHR.
            </p>
          )}
          {deficits.some(d => d.dist === "3K" || d.dist === "5K") && (
            <p className="text-[11px] leading-5 text-gray-400">
              La velocità soffre rispetto alla resistenza: aggiungi 1 sessione/settimana di ripetute brevi (200-400m) al 95-100% VMA.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN VIEW
// ─────────────────────────────────────────────────────────────────────────────

export function RankingView() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [efforts, setEfforts] = useState<BestEffort[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDists, setSelectedDists] = useState<DistKey[]>(["5K", "10K"]);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([getProfile(), getBestEfforts()])
      .then(([profResult, effortsResult]) => {
        const p = profResult.status === "fulfilled" ? profResult.value : null;
        const e = effortsResult.status === "fulfilled" ? effortsResult.value.efforts : [];
        if (p) setProfile(p);
        if (e) setEfforts(e);

        const found: DistKey[] = [];
        for (const dist of DISTANCES) {
          const effortMatch = e.find(ef =>
            EFFORT_TO_DIST.find(m => m.key === dist.key)
              ?.candidates.some(c => ef.distance.toLowerCase() === c.toLowerCase())
          );
          if (effortMatch) { found.push(dist.key); continue; }
          if (p && findPb(p.pbs ?? {}, PB_KEYS[dist.key])) found.push(dist.key);
        }
        if (found.length > 0) setSelectedDists(found);
      })
      .finally(() => setLoading(false));
  }, []);

  const sex: Sex = useMemo(() => {
    if (!profile?.sex) return "M";
    const s = profile.sex.toUpperCase();
    return (s === "F" || s === "FEMALE" || s === "DONNA") ? "F" : "M";
  }, [profile?.sex]);

  const age = profile?.age ?? 40;
  const fidalCat = getFidalCategory(sex, age);

  // Merge tempi: best_efforts vs profile pbs — vince il più veloce
  const userTimes: Partial<Record<DistKey, number>> = useMemo(() => {
    const result: Partial<Record<DistKey, number>> = {};
    for (const dist of DISTANCES) {
      const candidates: number[] = [];
      const mapping = EFFORT_TO_DIST.find(m => m.key === dist.key);
      if (mapping) {
        const effortMatch = efforts.find(ef =>
          mapping.candidates.some(c => ef.distance.toLowerCase() === c.toLowerCase())
        );
        if (effortMatch) {
          const sec = parseTime(effortMatch.time);
          if (sec) candidates.push(sec);
        }
      }
      if (profile?.pbs) {
        const pbTime = findPb(profile.pbs, PB_KEYS[dist.key]);
        if (pbTime) {
          const sec = parseTime(pbTime);
          if (sec) candidates.push(sec);
        }
      }
      if (candidates.length > 0) {
        result[dist.key] = Math.min(...candidates);
      }
    }
    return result;
  }, [efforts, profile?.pbs]);

  const toggleDist = (key: DistKey) => {
    setSelectedDists(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const activeDists = DISTANCES.filter(d =>
    selectedDists.includes(d.key) && !!userTimes[d.key]
  );

  // Hero: la distanza con percentile competitivo più alto
  const heroStats = useMemo(() => {
    let best: { dist: DistKey; pct: number } | null = null;
    for (const d of activeDists) {
      const pct = computePercentile(userTimes[d.key]!, d.key, sex);
      if (!best || pct > best.pct) best = { dist: d.key, pct };
    }
    return best;
  }, [activeDists, userTimes, sex]);

  const heroTier = heroStats ? getTierFromPct(heroStats.pct) : null;
  const heroNextTier = heroStats ? getNextTier(heroStats.pct) : null;
  const bestWava = useMemo(() => {
    let max = 0;
    for (const d of activeDists) {
      max = Math.max(max, computeWAVA(userTimes[d.key]!, d.key, sex, age));
    }
    return max;
  }, [activeDists, userTimes, sex, age]);

  const activeTimes = Object.fromEntries(activeDists.map(d => [d.key, userTimes[d.key]!]));

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center bg-[#0A0A0A] gap-3">
        <RefreshCw className="w-5 h-5 animate-spin text-[#C0FF00]" />
        <span className="text-sm font-black uppercase tracking-widest text-gray-500">
          Carico profilo e PB...
        </span>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto bg-[#0A0A0A] text-white p-4 md:p-6 lg:p-10 min-h-0 custom-scrollbar">
      <div className="max-w-[1500px] mx-auto space-y-5 md:space-y-6">

        {/* ── HEADER ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter text-white uppercase italic">
              La Mia <span className="text-[#C0FF00]">Classifica</span>
            </h1>
            <p className="text-gray-600 text-[10px] font-black tracking-[0.3em] uppercase mt-2">
              Posizionamento reale · FIDAL · ENDU · WAVA age-graded
            </p>
          </div>
          {heroTier && (
            <PillBadge label={`${heroTier.label} · ${heroTier.sublabel}`} color={heroTier.color} />
          )}
        </div>

        {Object.keys(userTimes).length === 0 ? (
          <div className={CARD + " flex flex-col items-center justify-center py-20 gap-4"}>
            <Trophy className="w-10 h-10 text-gray-700" />
            <div className="text-center">
              <p className="text-sm font-black uppercase tracking-widest text-gray-400">
                Nessun Personal Best trovato
              </p>
              <p className="text-[11px] text-gray-600 mt-2">
                Sincronizza Strava o inserisci i tuoi PB nella sezione Profilo per sbloccare la classifica.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 md:gap-6 items-start">

            {/* ── COLONNA SINISTRA: RANK CARD ── */}
            <div className="space-y-5">
              <div className="rounded-3xl p-[1.5px] bg-gradient-to-b from-[#C0FF00]/70 via-[#22D3EE]/25 to-transparent shadow-[0_8px_40px_rgba(192,255,0,0.12)]">
                <div className="rounded-[22px] bg-gradient-to-b from-[#10130A] via-[#0B0D08] to-[#080808] p-6 relative overflow-hidden">
                  <div aria-hidden className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#C0FF00]/[0.07] blur-3xl" />

                  {/* Percentile hero */}
                  <div className="relative flex items-start justify-between">
                    <div>
                      <span
                        className="text-7xl font-black italic leading-none tabular-nums"
                        style={{ fontFamily: MONO, color: heroTier?.color ?? "#C0FF00" }}
                      >
                        {heroStats ? Math.round(heroStats.pct) : "—"}
                      </span>
                      <div className="mt-1 text-[10px] font-black tracking-[0.3em] uppercase text-gray-500">
                        Percentile · {heroStats?.dist ?? ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <Trophy className="w-7 h-7 ml-auto" style={{ color: `${heroTier?.color ?? "#C0FF00"}B0` }} />
                      <div className="mt-2 text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: heroTier?.color }}>
                        {heroTier?.sublabel}
                      </div>
                    </div>
                  </div>

                  <div className="relative mt-4 pb-4 border-b border-white/[0.08]">
                    <div className="text-xl font-black uppercase tracking-tight text-white">
                      {heroTier?.label ?? "—"}
                    </div>
                    <div className="text-[10px] font-black tracking-[0.18em] uppercase text-gray-500 mt-1">
                      {profile?.name ?? "Atleta"} · {fidalCat} · {age} anni
                    </div>
                  </div>

                  {/* Stat rows per distanza */}
                  <div className="relative mt-5 space-y-3.5">
                    {activeDists.map((d, i) => {
                      const sec = userTimes[d.key]!;
                      const pct = computePercentile(sec, d.key, sex);
                      const tier = getTierFromPct(pct);
                      return (
                        <RankStatRow
                          key={d.key}
                          dist={d.key}
                          pct={pct}
                          time={formatTime(sec)}
                          color={tier.color}
                          delay={200 + i * 130}
                        />
                      );
                    })}
                  </div>

                  {/* Footer card */}
                  <div className="relative mt-6 pt-4 border-t border-white/[0.08] grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "WAVA max", value: bestWava > 0 ? `${bestWava.toFixed(0)}%` : "—", color: bestWava >= 70 ? "#C0FF00" : "#22D3EE" },
                      { label: "PB attivi", value: String(activeDists.length), color: "#fff" },
                      { label: "Categoria", value: fidalCat, color: "#A78BFA" },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <div className="text-base font-black tabular-nums" style={{ fontFamily: MONO, color }}>{value}</div>
                        <div className="text-[8px] font-black tracking-[0.2em] uppercase text-gray-600 mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Prossimo tier */}
              {heroStats && heroNextTier && heroTier && (
                <div className={CARD}>
                  <CardHeader
                    title="Prossimo Tier"
                    subtitle={`Sulla tua distanza migliore · ${heroStats.dist}`}
                    icon={TrendingUp}
                  />
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black tabular-nums" style={{ fontFamily: MONO, color: heroNextTier.tier.color }}>
                      -{formatTime(Math.round(Math.max(computeTimeGapForNextTier(userTimes[heroStats.dist]!, heroStats.dist, sex, heroNextTier.tier.minPct), 0)))}
                    </span>
                    <span className="text-[10px] font-black tracking-[0.16em] uppercase text-gray-500">
                      da togliere
                    </span>
                  </div>
                  <div className="mt-4 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${Math.min(100, (heroStats.pct / heroNextTier.tier.minPct) * 100)}%`,
                        background: `linear-gradient(90deg, ${heroTier.color}, ${heroNextTier.tier.color})`,
                        boxShadow: `0 0 10px ${heroTier.color}50`,
                      }} />
                  </div>
                  <div className="mt-2 flex justify-between text-[9px] font-black tracking-[0.12em] uppercase">
                    <span style={{ color: heroTier.color }}>{heroTier.label}</span>
                    <span style={{ color: heroNextTier.tier.color }}>{heroNextTier.tier.label}</span>
                  </div>
                </div>
              )}
              {heroStats && !heroNextTier && (
                <div className={CARD + " text-center"}>
                  <Zap className="w-6 h-6 mx-auto text-[#FFD700]" />
                  <div className="mt-2 text-sm font-black uppercase tracking-widest text-[#FFD700]">
                    Livello massimo — sei al podio
                  </div>
                </div>
              )}
            </div>

            {/* ── COLONNA DESTRA ── */}
            <div className="space-y-5 md:space-y-6 min-w-0">

              {/* Selettore distanze */}
              <div className={CARD}>
                <CardHeader
                  title="Le Tue Distanze"
                  subtitle="PB rilevati da Strava + profilo · attiva/disattiva"
                  icon={Target}
                />
                <div className="flex flex-wrap gap-2">
                  {DISTANCES.map(d => {
                    const hasPb = !!userTimes[d.key];
                    const isSelected = selectedDists.includes(d.key);
                    const active = isSelected && hasPb;
                    return (
                      <button key={d.key}
                        onClick={() => hasPb && toggleDist(d.key)}
                        disabled={!hasPb}
                        className="px-4 py-2.5 rounded-2xl border text-[10px] font-black tracking-wider transition-all disabled:cursor-not-allowed"
                        style={{
                          borderColor: active ? "rgba(192,255,0,0.4)" : "rgba(255,255,255,0.08)",
                          background: active ? "rgba(192,255,0,0.1)" : "rgba(255,255,255,0.02)",
                          color: active ? "#C0FF00" : hasPb ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)",
                          opacity: hasPb ? 1 : 0.45,
                        }}>
                        {d.key}
                        <span className="ml-2 text-[9px] font-bold tabular-nums" style={{ fontFamily: MONO, color: active ? "#C0FF00" : "rgba(255,255,255,0.35)" }}>
                          {hasPb ? formatTime(userTimes[d.key]!) : "no PB"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card distanza */}
              {activeDists.length > 0 && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {activeDists.map(d => (
                    <DistanceRankCard
                      key={d.key}
                      dist={d.key}
                      userSec={userTimes[d.key]!}
                      sex={sex}
                      age={age}
                    />
                  ))}
                </div>
              )}

              {/* Radar */}
              {activeDists.length >= 3 && (
                <MultiDistRadar userTimes={activeTimes} sex={sex} />
              )}

              {/* Tabella comparativa */}
              {activeDists.length >= 2 && (
                <ComparativeTierTable userTimes={activeTimes} sex={sex} age={age} />
              )}

              {/* Scouting Riegel */}
              {activeDists.length >= 2 && (
                <RiegelScouting userTimes={activeTimes} sex={sex} fidalCat={fidalCat} />
              )}
            </div>
          </div>
        )}

        {/* ── FOOTER FONTI ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1 pb-4">
          <span className="text-[9px] font-black tracking-widest uppercase text-[#444] max-w-3xl leading-4">
            Fonti: FIDAL 2022-2024 · ENDU · MySDAM · Parkrun Italy · Run Card · age-grading WMA 2015 · Riegel T₂ = T₁ × (D₂/D₁)^1.06
          </span>
          <span className="text-[9px] font-black tracking-widest uppercase text-[#444] shrink-0">
            Metic Lab · Ranking
          </span>
        </div>

      </div>
    </main>
  );
}
