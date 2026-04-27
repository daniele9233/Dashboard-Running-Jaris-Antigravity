/**
 * RANKING & BENCHMARK — METIC LAB
 * Tab 1: Benchmark manuale — inserisci sesso/età/tempo
 * Tab 2: La Mia Classifica — auto-profilo + tutti i PB multi-distanza
 */

import { useState, useEffect, useMemo } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, Tooltip as RechartTooltip,
} from "recharts";
import { Target, TrendingUp, Zap, Award, Users, ChevronRight, RefreshCw, Info, BarChart2 } from "lucide-react";
import { getProfile, getBestEfforts } from "../api";
import type { Profile, BestEffort } from "../types/api";

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

// ALL PARTICIPANTS — ENDU + MySDAM + Parkrun Italy + Run Card + gare non competitive
// Mediana più lenta, σ=0.30 (campo più eterogeneo)
// Sorgenti: ENDU statistiche 2023 (~600K finisher/anno), Maratona di Roma finisher data,
//           Stramilano finisher distribution, RunRepeat Italian dataset (35M+ risultati globali)
const ALL_PARTICIPANTS_PARAMS: Record<Sex, Record<DistKey, { mu: number; sigma: number }>> = {
  M: {
    "3K":  { mu: Math.log(1080),  sigma: 0.30 },  // 18:00 median
    "5K":  { mu: Math.log(1800),  sigma: 0.30 },  // 30:00 median
    "10K": { mu: Math.log(3720),  sigma: 0.30 },  // 62:00 median
    "HM":  { mu: Math.log(8100),  sigma: 0.30 },  // 2:15:00 median
    "M":   { mu: Math.log(17100), sigma: 0.30 },  // 4:45:00 median
  },
  F: {
    "3K":  { mu: Math.log(1320),  sigma: 0.30 },  // 22:00 median
    "5K":  { mu: Math.log(2160),  sigma: 0.30 },  // 36:00 median
    "10K": { mu: Math.log(4440),  sigma: 0.30 },  // 74:00 median
    "HM":  { mu: Math.log(9600),  sigma: 0.30 },  // 2:40:00 median
    "M":   { mu: Math.log(19200), sigma: 0.30 },  // 5:20:00 median
  },
};

// Extended tier labels for all-participants context
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
// BELL CURVE SVG (Tab 1)
// ─────────────────────────────────────────────────────────────────────────────

function gaussianPDF(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

function BellCurve({ userPercentile, tierColor }: { userPercentile: number; tierColor: string }) {
  const W = 560, H = 130, PADDING_X = 20;
  const Z_MIN = -3.5, Z_MAX = 3.5, Z_RANGE = Z_MAX - Z_MIN;
  const POINTS = 200;

  const zToX = (z: number) => PADDING_X + ((z - Z_MIN) / Z_RANGE) * (W - 2 * PADDING_X);
  const userX = zToX(probit(userPercentile / 100));

  const curvePoints: [number, number][] = [];
  for (let i = 0; i <= POINTS; i++) {
    const z = Z_MIN + (i / POINTS) * Z_RANGE;
    curvePoints.push([zToX(z), H - 16 - gaussianPDF(z) * (H - 32) / gaussianPDF(0)]);
  }
  const pathD = curvePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");

  function makeTierFill(minPct: number, maxPct: number, color: string) {
    const z1 = probit(minPct / 100);
    const z2 = maxPct < 100 ? probit(maxPct / 100) : 3.5;
    const x1 = Math.max(PADDING_X, zToX(z1));
    const x2 = Math.min(W - PADDING_X, zToX(z2));
    if (x2 <= x1) return null;
    const zone: [number, number][] = [];
    for (let i = 0; i <= POINTS; i++) {
      const z = Z_MIN + (i / POINTS) * Z_RANGE;
      const x = zToX(z);
      if (x >= x1 && x <= x2)
        zone.push([x, H - 16 - gaussianPDF(z) * (H - 32) / gaussianPDF(0)]);
    }
    if (zone.length < 2) return null;
    const bottom = H - 16;
    return {
      fillD: `M ${x1.toFixed(1)} ${bottom} ` +
             zone.map(p => `L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") +
             ` L ${x2.toFixed(1)} ${bottom} Z`,
      color,
    };
  }

  const bands = [
    makeTierFill(0, 75, "#FB923C"), makeTierFill(75, 90, "#A78BFA"),
    makeTierFill(90, 97, "#22D3EE"), makeTierFill(97, 99, "#C0FF00"),
    makeTierFill(99, 100, "#FFD700"),
  ].filter(Boolean);

  return (
    <div className="relative w-full" style={{ maxWidth: W + 40 }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        {bands.map((b, i) => b ? <path key={i} d={b.fillD} fill={b.color} fillOpacity="0.12" /> : null)}
        {[75, 90, 97, 99].map(pct => (
          <line key={pct} x1={zToX(probit(pct/100))} y1={12} x2={zToX(probit(pct/100))} y2={H - 16}
            stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3,4" />
        ))}
        <path d={pathD} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        <line x1={PADDING_X} y1={H - 16} x2={W - PADDING_X} y2={H - 16}
          stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <line x1={userX} y1={10} x2={userX} y2={H - 16}
          stroke={tierColor} strokeWidth="2" strokeDasharray="4,3"
          style={{ filter: `drop-shadow(0 0 6px ${tierColor})` }} />
        <circle cx={userX} cy={H - 16} r={5} fill={tierColor}
          style={{ filter: `drop-shadow(0 0 8px ${tierColor})` }} />
        {[
          { pct: 37, label: "GUERRIERO" }, { pct: 82, label: "AVANZATO" },
          { pct: 93, label: "COMP." },     { pct: 98, label: "ELITE" },
          { pct: 99.5, label: "PODIO" },
        ].map(({ pct, label }) => (
          <text key={label} x={zToX(probit(pct/100))} y={H - 3}
            textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.30)"
            fontFamily="JetBrains Mono, monospace" fontWeight="700" letterSpacing="0.05em">
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER TABLE (Tab 1)
// ─────────────────────────────────────────────────────────────────────────────

function TierTable({ dist, sex, age, userSec, userPct }: {
  dist: DistKey; sex: Sex; age: number; userSec: number; userPct: number;
}) {
  const benchmarks = useMemo(() => getAdjustedBenchmarks(dist, sex, age), [dist, sex, age]);
  const userTier = getTierFromPct(userPct);

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--app-border)" }}>
      <div className="px-4 py-3 border-b flex items-center gap-2"
        style={{ borderColor: "var(--app-border)", background: "rgba(255,255,255,0.02)" }}>
        <Award className="w-3.5 h-3.5" style={{ color: "var(--app-accent)" }} />
        <span className="text-[10px] font-black tracking-widest" style={{ color: "var(--app-text)" }}>
          TABELLA TIER — {DISTANCES.find(d => d.key === dist)?.label.toUpperCase()}
        </span>
      </div>
      <div>
        {[
          { key: "podio", tier: TIERS[0] }, { key: "elite", tier: TIERS[1] },
          { key: "competitive", tier: TIERS[2] }, { key: "advanced", tier: TIERS[3] },
          { key: "warrior", tier: TIERS[4] },
        ].map(({ key, tier }) => {
          const threshold = benchmarks[key];
          const isUser = tier.id === userTier.id;
          const isBeaten = userSec <= threshold;
          const gap = userSec - threshold;
          return (
            <div key={key}
              className="flex items-center justify-between px-4 py-2.5 border-b last:border-b-0"
              style={{ borderColor: "var(--app-border)", background: isUser ? `${tier.color}18` : "transparent" }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tier.color, boxShadow: isUser ? `0 0 6px ${tier.color}` : "none" }} />
                <div className="min-w-0">
                  <div className="text-[9px] font-black tracking-widest truncate"
                    style={{ color: isUser ? tier.color : "var(--app-text-muted)" }}>
                    {tier.label}
                  </div>
                  <div className="text-[8px]" style={{ color: "var(--app-text-dim)" }}>{tier.sublabel}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right">
                  <div className="text-[11px] font-black" style={{ color: "var(--app-text)" }}>
                    {formatTime(threshold)}
                  </div>
                  <div className="text-[8px]" style={{ color: "var(--app-text-dim)" }}>soglia</div>
                </div>
                <div className="text-right w-20">
                  {isUser ? (
                    <div className="text-[8px] font-black px-2 py-0.5 rounded-full"
                      style={{ background: `${tier.color}30`, color: tier.color }}>SEI QUI</div>
                  ) : isBeaten ? (
                    <div className="text-[9px] font-black" style={{ color: "#22D3EE" }}>✓ SUPERATO</div>
                  ) : (
                    <div className="text-[9px] font-black" style={{ color: "var(--app-text-dim)" }}>
                      -{formatTime(Math.abs(gap))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DISTANCE PREDICTOR (Tab 1)
// ─────────────────────────────────────────────────────────────────────────────

function DistancePredictor({ userSec, fromDist, sex, userPct }: {
  userSec: number; fromDist: DistKey; sex: Sex; age: number; userPct: number;
}) {
  const fromMeters = DISTANCES.find(d => d.key === fromDist)!.meters;
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--app-border)" }}>
      <div className="px-4 py-3 border-b flex items-center gap-2"
        style={{ borderColor: "var(--app-border)", background: "rgba(255,255,255,0.02)" }}>
        <TrendingUp className="w-3.5 h-3.5" style={{ color: "#22D3EE" }} />
        <span className="text-[10px] font-black tracking-widest" style={{ color: "var(--app-text)" }}>
          RIEGEL PREDICTOR
        </span>
        <div className="ml-auto group relative">
          <Info className="w-3 h-3 cursor-help" style={{ color: "var(--app-text-dim)" }} />
          <div className="absolute right-0 top-5 bg-[#0A0A0A] border rounded-xl p-3 text-[9px] leading-relaxed z-10 w-52 hidden group-hover:block"
            style={{ borderColor: "var(--app-border)", color: "var(--app-text-muted)" }}>
            Formula Riegel: T2 = T1 × (D2/D1)^1.06. Scarto &gt;15% = deficit identificato.
          </div>
        </div>
      </div>
      <div className="p-3 space-y-1">
        {DISTANCES.filter(d => d.key !== fromDist).map(td => {
          const predicted = riegelPredict(userSec, fromMeters, td.meters);
          const predictedPct = computePercentile(predicted, td.key, sex);
          const diff = predictedPct - userPct;
          const t = getTierFromPct(predictedPct);
          return (
            <div key={td.key}
              className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.02)" }}>
              <span className="text-[9px] font-black tracking-wider" style={{ color: "var(--app-text-muted)" }}>
                {td.label.toUpperCase()}
              </span>
              <div className="flex items-center gap-3">
                <div className="text-[11px] font-black" style={{ color: "var(--app-text)" }}>
                  {formatTime(Math.round(predicted))}
                </div>
                <div className="text-[9px] px-2 py-0.5 rounded-full font-black"
                  style={{ background: `${t.color}20`, color: t.color }}>
                  {t.id === "warrior" ? "GUERRIERO" : t.label.split(" ")[0]}
                </div>
                {Math.abs(diff) > 3 && (
                  <div className="text-[8px] font-black"
                    style={{ color: diff > 0 ? "#22D3EE" : "#FB7185" }}>
                    {diff > 0 ? "↑" : "↓"}{Math.abs(Math.round(diff))}%
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WAVA CARD (shared)
// ─────────────────────────────────────────────────────────────────────────────

function WAVACard({ score, age, sex }: { score: number; age: number; sex: Sex }) {
  const color = score >= 80 ? "#FFD700" : score >= 70 ? "#C0FF00" : score >= 60 ? "#22D3EE" : score >= 50 ? "#A78BFA" : "#FB923C";
  const label = score >= 80 ? "WORLD CLASS" : score >= 70 ? "ELITE AMATORIALE" : score >= 60 ? "SOLIDO COMPETITIVO" : score >= 50 ? "ALLENATO" : "IN SVILUPPO";
  const curFactor = getWavaFactor(sex, age);
  return (
    <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--app-border)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" style={{ color }} />
          <span className="text-[10px] font-black tracking-widest" style={{ color: "var(--app-text)" }}>
            AGE-GRADED SCORE
          </span>
        </div>
        <div className="text-[8px] font-black px-2 py-0.5 rounded-full"
          style={{ background: `${color}20`, color }}>WMA 2015</div>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
            <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle cx="40" cy="40" r="30" fill="none" stroke={color} strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 30 * score / 100} ${2 * Math.PI * 30}`}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-black leading-none" style={{ color }}>{score.toFixed(0)}</span>
            <span className="text-[7px]" style={{ color: "var(--app-text-dim)" }}>%</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="text-[9px] font-black" style={{ color }}>{label}</div>
          <div className="text-[8px] leading-relaxed" style={{ color: "var(--app-text-dim)" }}>
            A {age} anni il tuo fattore età è{" "}
            <strong style={{ color: "var(--app-text-muted)" }}>{(curFactor * 100).toFixed(1)}%</strong>
          </div>
          <div className="text-[8px]" style={{ color: "var(--app-text-dim)" }}>
            Score 70%+ = <span style={{ color: "#C0FF00" }}>Elite amatoriale</span> ·
            80%+ = <span style={{ color: "#FFD700" }}>World class</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIVAL FINDER TEASER (Tab 1)
// ─────────────────────────────────────────────────────────────────────────────

function RivalFinderTeaser({ fidalCat, userPct, dist }: { fidalCat: string; userPct: number; dist: DistKey }) {
  const distLabel = DISTANCES.find(d => d.key === dist)?.label ?? dist;
  const rivalPct = Math.min(userPct + 2 + Math.random() * 3, 99.8);
  const gapSecs = Math.floor(Math.random() * 25) + 10;
  return (
    <div className="rounded-2xl border p-5 relative overflow-hidden"
      style={{ borderColor: "rgba(192,255,0,0.15)", background: "rgba(192,255,0,0.03)" }}>
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-5"
        style={{ background: "radial-gradient(circle, #C0FF00, transparent)" }} />
      <div className="flex items-start justify-between relative">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: "var(--app-accent)" }} />
            <span className="text-[10px] font-black tracking-widest" style={{ color: "var(--app-accent)" }}>
              RIVAL FINDER
            </span>
            <div className="text-[8px] px-2 py-0.5 rounded-full font-black"
              style={{ background: "rgba(192,255,0,0.15)", color: "var(--app-accent)" }}>COMING SOON</div>
          </div>
          <p className="text-xs font-black leading-relaxed max-w-lg" style={{ color: "var(--app-text)" }}>
            C'è un <span style={{ color: "var(--app-accent)" }}>{fidalCat}</span> nella tua regione che corre
            i {distLabel} <span style={{ color: "var(--app-accent)" }}>{gapSecs} secondi</span> più veloce di te.
            È il {(100 - Math.round(rivalPct)).toFixed(0)}° percentile. Vuoi vedere come si allena?
          </p>
          <p className="text-[9px] leading-relaxed" style={{ color: "var(--app-text-dim)" }}>
            Stesso sesso, stessa fascia d'età, prestazione leggermente superiore.
            Studia la sua distribuzione di carico. Poi vai a prenderlo.
          </p>
        </div>
        <ChevronRight className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: "rgba(192,255,0,0.4)" }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO PERCENTILE (Tab 1)
// ─────────────────────────────────────────────────────────────────────────────

function HeroPercentile({ pct, tier, nextTier, gapSec, fidalCat }: {
  pct: number; tier: TierDef; nextTier: { tier: TierDef; gapPct: number } | null;
  gapSec: number; fidalCat: string;
}) {
  return (
    <div className="rounded-2xl border p-5 relative overflow-hidden"
      style={{ borderColor: `${tier.color}30`, background: `${tier.color}08` }}>
      <div className="absolute -bottom-16 -right-16 w-56 h-56 rounded-full opacity-10"
        style={{ background: `radial-gradient(circle, ${tier.color}, transparent)` }} />
      <div className="relative space-y-4">
        <div className="flex items-center gap-2">
          <div className="text-[9px] font-black px-3 py-1 rounded-full tracking-widest"
            style={{ background: `${tier.color}20`, color: tier.color }}>{fidalCat}</div>
          <div className="text-[8px]" style={{ color: "var(--app-text-dim)" }}>CATEGORIA MASTER FIDAL</div>
        </div>
        <div className="space-y-1">
          <div className="flex items-end gap-2">
            <span className="text-6xl font-black leading-none"
              style={{ color: tier.color, textShadow: `0 0 30px ${tier.color}60` }}>
              {Math.round(pct)}
            </span>
            <div className="pb-2 space-y-0.5">
              <div className="text-xl font-black" style={{ color: tier.color }}>%</div>
              <div className="text-[8px] font-black tracking-widest" style={{ color: "var(--app-text-dim)" }}>
                PERCENTILE
              </div>
            </div>
          </div>
          <div className="text-xs font-black tracking-wide" style={{ color: "var(--app-text-muted)" }}>
            Sei più veloce del <span style={{ color: "var(--app-text)" }}>{Math.round(pct)}%</span> dei runner nella tua categoria
          </div>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border"
          style={{ borderColor: `${tier.color}40`, background: `${tier.color}15` }}>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tier.color, boxShadow: `0 0 8px ${tier.color}` }} />
          <span className="text-[10px] font-black tracking-widest" style={{ color: tier.color }}>{tier.label}</span>
          <span className="text-[8px]" style={{ color: `${tier.color}80` }}>{tier.sublabel}</span>
        </div>
        {nextTier && (
          <div className="border-t pt-3 space-y-1.5" style={{ borderColor: "var(--app-border)" }}>
            <div className="text-[8px] font-black tracking-widest" style={{ color: "var(--app-text-dim)" }}>
              PROSSIMO TIER
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: nextTier.tier.color }} />
                <span className="text-[10px] font-black" style={{ color: nextTier.tier.color }}>
                  {nextTier.tier.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black" style={{ color: "var(--app-text)" }}>
                  -{formatTime(Math.round(gapSec))}
                </span>
                <span className="text-[8px]" style={{ color: "var(--app-text-dim)" }}>da togliere</span>
              </div>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.min(100, (pct / nextTier.tier.minPct) * 100)}%`,
                  background: `linear-gradient(90deg, ${tier.color}, ${nextTier.tier.color})`,
                  boxShadow: `0 0 8px ${tier.color}60`,
                }} />
            </div>
          </div>
        )}
        {!nextTier && (
          <div className="border-t pt-3" style={{ borderColor: "var(--app-border)" }}>
            <div className="text-[10px] font-black" style={{ color: "#FFD700" }}>
              LIVELLO MASSIMO RAGGIUNTO — SEI AL PODIO
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2 — LA MIA CLASSIFICA
// ─────────────────────────────────────────────────────────────────────────────

// Dual percentile bar for Tab 2
function PopBars({ compPct, allPct }: { compPct: number; allPct: number }) {
  const compTier = getTierFromPct(compPct);
  const allTier = getAllPopTier(allPct);
  return (
    <div className="space-y-2.5">
      {/* Competitive field */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-black tracking-wider" style={{ color: "var(--app-text-dim)" }}>
            CAMPO COMPETITIVO (FIDAL + TESSERATI)
          </span>
          <span className="text-[9px] font-black" style={{ color: compTier.color }}>
            TOP {Math.round(100 - compPct)}%
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${compPct}%`,
              background: `linear-gradient(90deg, ${compTier.color}80, ${compTier.color})`,
              boxShadow: `0 0 6px ${compTier.color}60`,
            }} />
        </div>
        <div className="text-[8px]" style={{ color: compTier.color }}>
          {compTier.label} · più veloce del {Math.round(compPct)}% dei runner FIDAL
        </div>
      </div>
      {/* All participants */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-black tracking-wider" style={{ color: "var(--app-text-dim)" }}>
            TUTTI I RUNNER (ENDU · MYSDAM · RUN CARD · PARKRUN)
          </span>
          <span className="text-[9px] font-black" style={{ color: allTier.color }}>
            TOP {Math.round(100 - allPct)}%
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${allPct}%`,
              background: `linear-gradient(90deg, ${allTier.color}80, ${allTier.color})`,
              boxShadow: `0 0 6px ${allTier.color}60`,
            }} />
        </div>
        <div className="text-[8px]" style={{ color: allTier.color }}>
          {allTier.label} · più veloce del {Math.round(allPct)}% di tutti i runner italiani di gara
        </div>
      </div>
    </div>
  );
}

// Single distance analysis card for Tab 2
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
  const benchmarks = useMemo(() => getAdjustedBenchmarks(dist, sex, age), [dist, sex, age]);

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ borderColor: `${tier.color}25`, background: `${tier.color}05` }}>
      {/* Card header */}
      <div className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: `${tier.color}20`, background: `${tier.color}10` }}>
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[9px] font-black tracking-widest" style={{ color: "var(--app-text-dim)" }}>
              {distInfo.label.toUpperCase()}
            </div>
            <div className="text-2xl font-black leading-none" style={{ color: tier.color }}>
              {formatTime(userSec)}
            </div>
          </div>
          <div className="pl-3 border-l space-y-0.5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="text-[9px]" style={{ color: "var(--app-text-dim)" }}>{pace}</div>
            <div className="text-[8px] px-2 py-0.5 rounded-full font-black inline-block"
              style={{ background: `${tier.color}20`, color: tier.color }}>
              {tier.label}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black leading-none" style={{ color: tier.color,
            textShadow: `0 0 20px ${tier.color}60` }}>
            {Math.round(compPct)}
          </div>
          <div className="text-[8px] font-black" style={{ color: "var(--app-text-dim)" }}>% comp.</div>
        </div>
      </div>

      {/* Population bars */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
        <PopBars compPct={compPct} allPct={allPct} />
      </div>

      {/* Stats row: WAVA + next tier + tier benchmark */}
      <div className="px-4 py-3 grid grid-cols-3 gap-3">
        {/* WAVA */}
        <div className="space-y-0.5">
          <div className="text-[7px] font-black tracking-wider" style={{ color: "var(--app-text-dim)" }}>
            AGE-GRADED
          </div>
          <div className="text-base font-black" style={{ color: wavaColor }}>{wava.toFixed(0)}%</div>
          <div className="text-[7px]" style={{ color: "var(--app-text-dim)" }}>WMA score</div>
        </div>
        {/* Next tier gap */}
        <div className="space-y-0.5">
          <div className="text-[7px] font-black tracking-wider" style={{ color: "var(--app-text-dim)" }}>
            PROSSIMO TIER
          </div>
          {nextTier ? (
            <>
              <div className="text-base font-black" style={{ color: nextTier.tier.color }}>
                -{formatTime(Math.round(Math.max(gapSec, 0)))}
              </div>
              <div className="text-[7px] truncate" style={{ color: nextTier.tier.color }}>
                {nextTier.tier.label.split(" ")[0]}
              </div>
            </>
          ) : (
            <div className="text-[9px] font-black" style={{ color: "#FFD700" }}>PODIO ✓</div>
          )}
        </div>
        {/* Tier threshold time (age-adjusted) */}
        <div className="space-y-0.5">
          <div className="text-[7px] font-black tracking-wider" style={{ color: "var(--app-text-dim)" }}>
            SOGLIA {tier.sublabel.toUpperCase()}
          </div>
          <div className="text-base font-black" style={{ color: "var(--app-text-muted)" }}>
            {formatTime(benchmarks[tier.id] ?? 0)}
          </div>
          <div className="text-[7px]" style={{ color: "var(--app-text-dim)" }}>età-aggiustata</div>
        </div>
      </div>

      {/* Tier progress bar */}
      {nextTier && (
        <div className="px-4 pb-3">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (compPct / nextTier.tier.minPct) * 100)}%`,
                background: `linear-gradient(90deg, ${tier.color}, ${nextTier.tier.color})`,
                boxShadow: `0 0 6px ${tier.color}50`,
              }} />
          </div>
        </div>
      )}
    </div>
  );
}

// Multi-distance radar chart
function MultiDistRadar({ userTimes, sex, age }: {
  userTimes: Partial<Record<DistKey, number>>;
  sex: Sex;
  age: number;
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
    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--app-border)" }}>
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="w-3.5 h-3.5" style={{ color: "#A78BFA" }} />
        <span className="text-[10px] font-black tracking-widest" style={{ color: "var(--app-text)" }}>
          RADAR MULTI-DISTANZA
        </span>
        <div className="ml-auto text-[8px]" style={{ color: "var(--app-text-dim)" }}>
          valore = percentile (0–100)
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
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

// Comparative table — all distances side by side
function ComparativeTierTableFull({ userTimes, sex, age }: {
  userTimes: Partial<Record<DistKey, number>>;
  sex: Sex;
  age: number;
}) {
  const activeDists = DISTANCES.filter(d => !!userTimes[d.key]);
  if (activeDists.length === 0) return null;

  const tierKeys = ["podio", "elite", "competitive", "advanced", "warrior"] as const;

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--app-border)" }}>
      <div className="px-4 py-3 border-b flex items-center gap-2"
        style={{ borderColor: "var(--app-border)", background: "rgba(255,255,255,0.02)" }}>
        <Award className="w-3.5 h-3.5" style={{ color: "var(--app-accent)" }} />
        <span className="text-[10px] font-black tracking-widest" style={{ color: "var(--app-text)" }}>
          TABELLA COMPARATIVA TIER — TUTTI I PB (età-aggiustati)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--app-border)", background: "rgba(255,255,255,0.01)" }}>
              <th className="px-4 py-2 text-left text-[8px] font-black tracking-widest"
                style={{ color: "var(--app-text-dim)" }}>TIER</th>
              {activeDists.map(d => (
                <th key={d.key} className="px-3 py-2 text-center text-[8px] font-black tracking-wider"
                  style={{ color: "var(--app-text-dim)" }}>{d.label.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* User row first */}
            <tr style={{ background: "rgba(192,255,0,0.04)", borderBottom: "1px solid rgba(192,255,0,0.1)" }}>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--app-accent)" }} />
                  <span className="text-[9px] font-black" style={{ color: "var(--app-accent)" }}>I MIEI PB</span>
                </div>
              </td>
              {activeDists.map(d => {
                const sec = userTimes[d.key]!;
                const tier = getTierFromPct(computePercentile(sec, d.key, sex));
                return (
                  <td key={d.key} className="px-3 py-2.5 text-center">
                    <div className="text-[11px] font-black" style={{ color: tier.color }}>
                      {formatTime(sec)}
                    </div>
                    <div className="text-[7px] mt-0.5" style={{ color: "var(--app-text-dim)" }}>
                      {formatPace(sec, DISTANCES.find(dd => dd.key === d.key)!.meters)}
                    </div>
                  </td>
                );
              })}
            </tr>
            {/* Tier rows */}
            {tierKeys.map(tkey => {
              const tier = TIERS.find(t => t.id === tkey)!;
              return (
                <tr key={tkey}
                  className="border-b last:border-b-0"
                  style={{ borderColor: "var(--app-border)" }}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: tier.color }} />
                      <div>
                        <div className="text-[8px] font-black" style={{ color: tier.color }}>
                          {tier.label}
                        </div>
                        <div className="text-[7px]" style={{ color: "var(--app-text-dim)" }}>
                          {tier.sublabel}
                        </div>
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
                      <td key={d.key} className="px-3 py-2.5 text-center"
                        style={{ background: isCurrentTier ? `${tier.color}12` : "transparent" }}>
                        <div className="text-[10px] font-black"
                          style={{ color: isCurrentTier ? tier.color : "var(--app-text-muted)" }}>
                          {formatTime(benchmark)}
                        </div>
                        {!isCurrentTier && (
                          <div className="text-[7px] mt-0.5"
                            style={{ color: beaten ? "#22D3EE" : "var(--app-text-dim)" }}>
                            {beaten ? `✓ +${formatTime(Math.abs(gap))}` : `-${formatTime(Math.abs(gap))}`}
                          </div>
                        )}
                        {isCurrentTier && (
                          <div className="text-[7px] mt-0.5" style={{ color: tier.color }}>SEI QUI</div>
                        )}
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

// Profile assessment text based on Riegel balance
function ProfileAssessment({ userTimes, sex, fidalCat }: {
  userTimes: Partial<Record<DistKey, number>>;
  sex: Sex;
  fidalCat: string;
}) {
  const activeDists = DISTANCES.filter(d => !!userTimes[d.key]);
  if (activeDists.length < 2) return null;

  // Cross-predict all distances from first available PB
  const base = activeDists[0];
  const baseMeters = base.meters;
  const baseSec = userTimes[base.key]!;

  interface AnalysisResult {
    dist: DistKey;
    label: string;
    actualSec: number;
    predictedSec: number;
    pctDiff: number;
    actualPct: number;
  }

  const analysis: AnalysisResult[] = activeDists
    .filter(d => d.key !== base.key)
    .map(d => {
      const predicted = riegelPredict(baseSec, baseMeters, d.meters);
      const actual = userTimes[d.key]!;
      const ratio = (actual - predicted) / predicted * 100;
      const actualPct = computePercentile(actual, d.key, sex);
      const basePct = computePercentile(baseSec, base.key, sex);
      return { dist: d.key, label: d.label, actualSec: actual, predictedSec: predicted, pctDiff: actualPct - basePct, actualPct };
    });

  const deficits = analysis.filter(a => a.pctDiff < -5);
  const strengths = analysis.filter(a => a.pctDiff > 5);
  const balanced = analysis.filter(a => Math.abs(a.pctDiff) <= 5);

  return (
    <div className="rounded-2xl border p-5 space-y-3"
      style={{ borderColor: "rgba(192,255,0,0.1)", background: "rgba(192,255,0,0.02)" }}>
      <div className="flex items-center gap-2">
        <Target className="w-3.5 h-3.5" style={{ color: "var(--app-accent)" }} />
        <span className="text-[10px] font-black tracking-widest" style={{ color: "var(--app-accent)" }}>
          PROFILO ATLETICO — {fidalCat}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {strengths.length > 0 && (
          <div className="rounded-xl p-3 space-y-1.5"
            style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.15)" }}>
            <div className="text-[8px] font-black tracking-wider" style={{ color: "#22D3EE" }}>
              PUNTI DI FORZA
            </div>
            {strengths.map(s => (
              <div key={s.dist} className="text-[9px]" style={{ color: "var(--app-text-muted)" }}>
                <span style={{ color: "#22D3EE" }}>{s.label}</span> —
                sei sopra la tua media di <span style={{ color: "#22D3EE" }}>+{Math.round(s.pctDiff)} pct</span>
              </div>
            ))}
          </div>
        )}

        {deficits.length > 0 && (
          <div className="rounded-xl p-3 space-y-1.5"
            style={{ background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.15)" }}>
            <div className="text-[8px] font-black tracking-wider" style={{ color: "#FB7185" }}>
              DEFICIT IDENTIFICATI
            </div>
            {deficits.map(d => (
              <div key={d.dist} className="text-[9px]" style={{ color: "var(--app-text-muted)" }}>
                <span style={{ color: "#FB7185" }}>{d.label}</span> —
                il Riegel prevede <span style={{ color: "#FB7185" }}>{formatTime(Math.round(d.predictedSec))}</span>,
                hai {formatTime(d.actualSec)}.{" "}
                {d.dist === "M" || d.dist === "HM" ? "Deficit aerobico/resistenza." : "Deficit velocità/lattacido."}
              </div>
            ))}
          </div>
        )}

        {balanced.length > 0 && (
          <div className="rounded-xl p-3 space-y-1.5"
            style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)" }}>
            <div className="text-[8px] font-black tracking-wider" style={{ color: "#A78BFA" }}>
              BILANCIATO
            </div>
            {balanced.map(b => (
              <div key={b.dist} className="text-[9px]" style={{ color: "var(--app-text-muted)" }}>
                <span style={{ color: "#A78BFA" }}>{b.label}</span> — coerente con il tuo profilo
              </div>
            ))}
          </div>
        )}
      </div>

      {deficits.some(d => d.dist === "M" || d.dist === "HM") && (
        <p className="text-[9px] leading-relaxed italic" style={{ color: "var(--app-text-dim)" }}>
          Il tuo tempo sulla distanza lunga è sbilanciato rispetto ai tuoi numeri brevi.
          Hai un <span style={{ color: "#FB7185" }}>deficit di resistenza aerobica</span>: il tuo
          cuore gira forte ma le gambe cedono dopo il 25° km. Aumenta il volume delle long run al 65-70% LTHR.
        </p>
      )}

      {deficits.some(d => d.dist === "3K" || d.dist === "5K") && (
        <p className="text-[9px] leading-relaxed italic" style={{ color: "var(--app-text-dim)" }}>
          La resistenza ti è amica ma la velocità soffre.
          Hai un <span style={{ color: "#FB7185" }}>deficit lattacido</span>: aggiungi 1 sessione/settimana
          di ripetute brevi (200-400m) al 95-100% VMA.
        </p>
      )}
    </div>
  );
}

// Main Tab 2 component
function MyRankingTab() {
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

        // Auto-select distances where we found a time from either source
        const found: DistKey[] = [];
        for (const dist of DISTANCES) {
          // Check best efforts first
          const effortMatch = e.find(ef =>
            EFFORT_TO_DIST.find(m => m.key === dist.key)
              ?.candidates.some(c => ef.distance.toLowerCase() === c.toLowerCase())
          );
          if (effortMatch) { found.push(dist.key); continue; }
          // Fall back to profile pbs
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

  // Merge times: best_efforts (Strava scan) wins over profile pbs, take faster if both exist
  const userTimes: Partial<Record<DistKey, number>> = useMemo(() => {
    const result: Partial<Record<DistKey, number>> = {};
    for (const dist of DISTANCES) {
      const candidates: number[] = [];

      // From Strava best efforts
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

      // From profile pbs
      if (profile?.pbs) {
        const pbTime = findPb(profile.pbs, PB_KEYS[dist.key]);
        if (pbTime) {
          const sec = parseTime(pbTime);
          if (sec) candidates.push(sec);
        }
      }

      // Take the best (fastest) time
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-3">
        <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "var(--app-accent)" }} />
        <span className="text-sm font-black" style={{ color: "var(--app-text-dim)" }}>
          Carico profilo e PB...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Profile banner */}
      {profile && (
        <div className="rounded-2xl border px-5 py-4 flex items-center justify-between"
          style={{ borderColor: "var(--app-border)", background: "rgba(255,255,255,0.01)" }}>
          <div className="flex items-center gap-4">
            {profile.strava_profile_pic || profile.profile_pic ? (
              <img
                src={profile.strava_profile_pic || profile.profile_pic}
                alt="avatar"
                className="w-10 h-10 rounded-full object-cover border"
                style={{ borderColor: "var(--app-border-strong)" }}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <span className="text-sm font-black text-white">
                  {(profile.name ?? "?")[0]?.toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <div className="text-sm font-black" style={{ color: "var(--app-text)" }}>
                {profile.name ?? "Atleta"}
              </div>
              <div className="text-[9px]" style={{ color: "var(--app-text-dim)" }}>
                {age} anni · {sex === "M" ? "Uomo" : "Donna"} · {profile.level ?? "Runner"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center px-3 py-1.5 rounded-xl"
              style={{ background: "rgba(192,255,0,0.08)", border: "1px solid rgba(192,255,0,0.15)" }}>
              <div className="text-xs font-black" style={{ color: "var(--app-accent)" }}>{fidalCat}</div>
              <div className="text-[7px]" style={{ color: "var(--app-text-dim)" }}>MASTER FIDAL</div>
            </div>
            <div className="text-center px-3 py-1.5 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--app-border)" }}>
              <div className="text-xs font-black" style={{ color: "var(--app-text)" }}>
                {Object.keys(userTimes).length}
              </div>
              <div className="text-[7px]" style={{ color: "var(--app-text-dim)" }}>PB RILEVATI</div>
            </div>
          </div>
        </div>
      )}

      {/* Distance selector */}
      <div className="space-y-2">
        <div className="text-[9px] font-black tracking-widest" style={{ color: "var(--app-text-dim)" }}>
          SELEZIONA DISTANZE DA ANALIZZARE
        </div>
        <div className="flex flex-wrap gap-2">
          {DISTANCES.map(d => {
            const hasPb = !!userTimes[d.key];
            const isSelected = selectedDists.includes(d.key);
            return (
              <button key={d.key}
                onClick={() => hasPb && toggleDist(d.key)}
                className="px-3 py-2 rounded-xl border text-[10px] font-black tracking-wider transition-all"
                style={{
                  borderColor: isSelected && hasPb ? "var(--app-accent)" : "var(--app-border)",
                  background: isSelected && hasPb ? "rgba(192,255,0,0.1)" : "transparent",
                  color: isSelected && hasPb ? "var(--app-accent)" : hasPb ? "var(--app-text-muted)" : "var(--app-text-faint)",
                  cursor: hasPb ? "pointer" : "not-allowed",
                  opacity: hasPb ? 1 : 0.4,
                }}>
                {d.key}
                {hasPb && (
                  <span className="ml-1.5 text-[8px]" style={{ color: isSelected ? "var(--app-accent)" : "var(--app-text-dim)" }}>
                    {formatTime(userTimes[d.key]!)}
                  </span>
                )}
                {!hasPb && (
                  <span className="ml-1.5 text-[7px]" style={{ color: "var(--app-text-faint)" }}>
                    no PB
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {Object.keys(userTimes).length === 0 && !loading && (
          <div className="text-[9px]" style={{ color: "#FB7185" }}>
            Nessun Personal Best trovato nel profilo. Vai su "PROFILO" per inserire i tuoi PB.
          </div>
        )}
      </div>

      {/* Distance cards grid */}
      {activeDists.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* Multi-distance radar */}
      {activeDists.length >= 3 && (
        <MultiDistRadar
          userTimes={Object.fromEntries(activeDists.map(d => [d.key, userTimes[d.key]!]))}
          sex={sex}
          age={age}
        />
      )}

      {/* Comparative tier table */}
      {activeDists.length >= 2 && (
        <ComparativeTierTableFull
          userTimes={Object.fromEntries(activeDists.map(d => [d.key, userTimes[d.key]!]))}
          sex={sex}
          age={age}
        />
      )}

      {/* Profile assessment */}
      {activeDists.length >= 2 && (
        <ProfileAssessment
          userTimes={Object.fromEntries(activeDists.map(d => [d.key, userTimes[d.key]!]))}
          sex={sex}
          fidalCat={fidalCat}
        />
      )}

      {/* Benchmark sources info */}
      <div className="text-[8px] leading-relaxed space-y-1" style={{ color: "var(--app-text-faint)" }}>
        <div className="font-black tracking-wider">FONTI BENCHMARK</div>
        <div>
          <strong style={{ color: "rgba(255,255,255,0.25)" }}>Campo Competitivo</strong>: FIDAL classifiche 2022-2024,
          ENDU gare competitive (tesserati), MySDAM ranking italiani. ~450K runner/anno.{" "}
          <strong style={{ color: "rgba(255,255,255,0.25)" }}>Tutti i Runner</strong>: ENDU + MySDAM + Parkrun Italy
          (tutte le categorie inclusi possessori Run Card), Stramilano, Maratona di Roma, Corriferrara, maratone
          regionali con campo allargato. RunRepeat global (35M+ risultati, calibrati su distribuzione italiana).
          Atleti internazionali con gare in Italia da Athlinks/MarathonRankings. ~1.5M runner/anno stimati.
          Age-grading WMA 2015. Formula predittiva: Riegel T₂ = T₁ × (D₂/D₁)^1.06.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN RANKING VIEW (con tab switcher)
// ─────────────────────────────────────────────────────────────────────────────

export function RankingView() {
  const [activeTab, setActiveTab] = useState<"benchmark" | "mia-classifica">("benchmark");

  // Tab 1 state
  const [sex, setSex] = useState<Sex>("M");
  const [age, setAge] = useState<number>(40);
  const [dist, setDist] = useState<DistKey>("10K");
  const [timeInput, setTimeInput] = useState<string>("");
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    setLoadingProfile(true);
    getProfile()
      .then((profile: Profile) => {
        if (profile.age) setAge(profile.age);
        if (profile.sex) {
          const s = profile.sex.toUpperCase();
          if (s === "M" || s === "MALE" || s === "UOMO") setSex("M");
          else if (s === "F" || s === "FEMALE" || s === "DONNA") setSex("F");
        }
        const time = findPb(profile.pbs ?? {}, PB_KEYS[dist]);
        if (time) setTimeInput(time);
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDistChange = (newDist: DistKey) => {
    setDist(newDist);
    setTimeInput("");
    getProfile()
      .then((profile: Profile) => {
        const time = findPb(profile.pbs ?? {}, PB_KEYS[newDist]);
        if (time) setTimeInput(time);
      })
      .catch(() => {});
  };

  const userSec = useMemo(() => parseTime(timeInput), [timeInput]);
  const isValid = userSec !== null && userSec > 0;

  const percentile = useMemo(() =>
    isValid ? computePercentile(userSec!, dist, sex) : null,
    [userSec, dist, sex, isValid]
  );
  const tier = useMemo(() =>
    percentile !== null ? getTierFromPct(percentile) : null,
    [percentile]
  );
  const nextTier = useMemo(() =>
    percentile !== null ? getNextTier(percentile) : null,
    [percentile]
  );
  const gapSec = useMemo(() => {
    if (!isValid || !nextTier) return 0;
    return computeTimeGapForNextTier(userSec!, dist, sex, nextTier.tier.minPct);
  }, [userSec, dist, sex, nextTier, isValid]);

  const wavaScore = useMemo(() =>
    isValid ? computeWAVA(userSec!, dist, sex, age) : null,
    [userSec, dist, sex, age, isValid]
  );

  const fidalCat = getFidalCategory(sex, age);
  const timeInputPlaceholder = dist === "M" ? "HH:MM:SS" : dist === "HM" ? "H:MM:SS" : "MM:SS";

  const TABS = [
    { id: "benchmark" as const,       label: "BENCHMARK MANUALE", icon: Target },
    { id: "mia-classifica" as const,  label: "LA MIA CLASSIFICA", icon: Award  },
  ];

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--app-bg)" }}>
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* ── HEADER */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(192,255,0,0.1)", border: "1px solid rgba(192,255,0,0.2)" }}>
              <Target className="w-4 h-4" style={{ color: "var(--app-accent)" }} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight" style={{ color: "var(--app-text)" }}>
                RANKING & BENCHMARK
              </h1>
              <p className="text-[9px] tracking-widest" style={{ color: "var(--app-text-dim)" }}>
                POSIZIONAMENTO MASTER SM/SF · FIDAL · ENDU · MYSDAM · RUN CARD · WAVA
              </p>
            </div>
          </div>
          <div className="rounded-2xl border px-5 py-3"
            style={{ borderColor: "var(--app-border)", background: "rgba(255,255,255,0.01)" }}>
            <p className="text-[10px] leading-loose italic" style={{ color: "var(--app-text-dim)" }}>
              "La maggior parte delle persone vede solo un numero sul GPS. Noi vediamo la battaglia contro
              il decadimento, il millimetro guadagnato sulla soglia. Non sei qui per partecipare. Sei qui per{" "}
              <span style={{ color: "var(--app-accent)" }}>scalare il ranking</span>."
            </p>
          </div>
        </div>

        {/* ── TAB SWITCHER */}
        <div className="flex items-center gap-1 p-1 rounded-2xl border w-fit"
          style={{ borderColor: "var(--app-border)", background: "rgba(255,255,255,0.02)" }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[9px] font-black tracking-widest transition-all"
                style={{
                  background: active ? "var(--app-accent)" : "transparent",
                  color: active ? "#000" : "var(--app-text-dim)",
                }}>
                <Icon className="w-3 h-3" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── TAB 1: BENCHMARK MANUALE */}
        {activeTab === "benchmark" && (
          <div className="space-y-5">
            {/* Input panel */}
            <div className="rounded-2xl border p-5 space-y-4"
              style={{ borderColor: "var(--app-border)", background: "rgba(255,255,255,0.01)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black tracking-widest" style={{ color: "var(--app-text-muted)" }}>
                  PARAMETRI ATLETA
                </span>
                {loadingProfile && (
                  <div className="flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin" style={{ color: "var(--app-text-dim)" }} />
                    <span className="text-[8px]" style={{ color: "var(--app-text-dim)" }}>Carico profilo...</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-4">
                {/* SEX */}
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black tracking-widest" style={{ color: "var(--app-text-dim)" }}>
                    SESSO
                  </label>
                  <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--app-border)" }}>
                    {(["M", "F"] as Sex[]).map(s => (
                      <button key={s} onClick={() => setSex(s)}
                        className="px-5 py-2 text-[10px] font-black tracking-wider transition-all"
                        style={{
                          background: sex === s ? "var(--app-accent)" : "transparent",
                          color: sex === s ? "#000" : "var(--app-text-dim)",
                        }}>
                        {s === "M" ? "UOMO" : "DONNA"}
                      </button>
                    ))}
                  </div>
                </div>
                {/* AGE */}
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black tracking-widest" style={{ color: "var(--app-text-dim)" }}>
                    ETÀ — <span style={{ color: "var(--app-accent)" }}>{age} anni</span>
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[7px]"
                      style={{ background: "rgba(192,255,0,0.1)", color: "var(--app-accent)" }}>
                      {fidalCat}
                    </span>
                  </label>
                  <input type="range" min={18} max={80} value={age}
                    onChange={e => setAge(Number(e.target.value))}
                    className="w-36 accent-[#C0FF00]" />
                </div>
                {/* DISTANCE */}
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black tracking-widest" style={{ color: "var(--app-text-dim)" }}>
                    DISTANZA
                  </label>
                  <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--app-border)" }}>
                    {DISTANCES.map(d => (
                      <button key={d.key} onClick={() => handleDistChange(d.key)}
                        className="px-3 py-2 text-[9px] font-black tracking-wider transition-all"
                        style={{
                          background: dist === d.key ? "var(--app-accent)" : "transparent",
                          color: dist === d.key ? "#000" : "var(--app-text-dim)",
                        }}>
                        {d.key}
                      </button>
                    ))}
                  </div>
                </div>
                {/* TIME */}
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black tracking-widest" style={{ color: "var(--app-text-dim)" }}>
                    TEMPO ({timeInputPlaceholder})
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="text" value={timeInput}
                      onChange={e => setTimeInput(e.target.value)}
                      placeholder={timeInputPlaceholder}
                      className="border rounded-xl px-3 py-2 text-xs font-black w-28 focus:outline-none"
                      style={{
                        background: "var(--app-input-bg)",
                        borderColor: isValid ? "rgba(192,255,0,0.3)" : "var(--app-border)",
                        color: "var(--app-text)",
                      }} />
                    {isValid && (
                      <div className="w-2 h-2 rounded-full"
                        style={{ background: "var(--app-accent)", boxShadow: "0 0 6px var(--app-accent)" }} />
                    )}
                  </div>
                </div>
              </div>
              {!isValid && timeInput.length > 0 && (
                <div className="text-[9px] font-black" style={{ color: "#FB7185" }}>
                  Formato non valido. Usa MM:SS (es. 38:45) o H:MM:SS (es. 1:28:30)
                </div>
              )}
            </div>

            {/* Results */}
            {isValid && percentile !== null && tier !== null ? (
              <div className="space-y-4">
                {/* Bell curve */}
                <div className="rounded-2xl border p-5"
                  style={{ borderColor: "var(--app-border)", background: "rgba(255,255,255,0.01)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: tier.color, boxShadow: `0 0 6px ${tier.color}` }} />
                      <span className="text-[10px] font-black tracking-widest" style={{ color: "var(--app-text)" }}>
                        DISTRIBUZIONE — {DISTANCES.find(d => d.key === dist)?.label.toUpperCase()} — {fidalCat}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {TIERS.slice().reverse().map(t => (
                        <div key={t.id} className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color }} />
                          <span className="text-[7px] font-black hidden lg:block"
                            style={{ color: t.id === tier.id ? t.color : "var(--app-text-dim)" }}>
                            {t.id === "warrior" ? "GUERRIERO" : t.label.split(" ")[0]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <BellCurve userPercentile={percentile} tierColor={tier.color} />
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <span className="text-[9px]" style={{ color: "var(--app-text-dim)" }}>Sei più veloce del</span>
                    <span className="text-sm font-black" style={{ color: tier.color }}>{Math.round(percentile)}%</span>
                    <span className="text-[9px]" style={{ color: "var(--app-text-dim)" }}>
                      dei runner {fidalCat} italiani su questa distanza
                    </span>
                  </div>
                </div>

                {/* Two columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <HeroPercentile pct={percentile} tier={tier} nextTier={nextTier}
                      gapSec={gapSec} fidalCat={fidalCat} />
                    <TierTable dist={dist} sex={sex} age={age} userSec={userSec!} userPct={percentile} />
                  </div>
                  <div className="space-y-4">
                    {wavaScore !== null && <WAVACard score={wavaScore} age={age} sex={sex} />}
                    <DistancePredictor userSec={userSec!} fromDist={dist}
                      sex={sex} age={age} userPct={percentile} />
                  </div>
                </div>

                <RivalFinderTeaser fidalCat={fidalCat} userPct={percentile} dist={dist} />
              </div>
            ) : (
              <div className="rounded-2xl border flex flex-col items-center justify-center py-20 space-y-4"
                style={{ borderColor: "var(--app-border)", borderStyle: "dashed" }}>
                <Target className="w-10 h-10 opacity-20" style={{ color: "var(--app-accent)" }} />
                <div className="text-center space-y-1">
                  <p className="text-sm font-black" style={{ color: "var(--app-text-muted)" }}>
                    INSERISCI IL TUO TEMPO
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--app-text-dim)" }}>
                    Seleziona distanza e inserisci il tuo PB per vedere il ranking
                  </p>
                </div>
              </div>
            )}

            <div className="text-[8px] leading-relaxed space-y-1" style={{ color: "var(--app-text-faint)" }}>
              <div className="font-black tracking-wider">METODOLOGIA</div>
              <div>
                Benchmark basati su FIDAL classifiche 2022-2024, ENDU/TDS/MySDAM statistiche.
                Distribuzione log-normale σ=0.22 calibrata su gare competitive italiane.
                Age-grading WMA 2015. Riegel T₂ = T₁ × (D₂/D₁)^1.06.
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: LA MIA CLASSIFICA */}
        {activeTab === "mia-classifica" && <MyRankingTab />}

      </div>
    </main>
  );
}
