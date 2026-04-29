import { useEffect, useState } from "react";
import {
  Dna, BrainCircuit, Trophy, Zap, Target, TrendingUp,
  RefreshCcw, Activity, Heart, Timer, Gauge, Flame,
  ArrowUp, ArrowDown, Minus, BarChart2, Footprints,
  ShieldCheck, Dumbbell,
  LineChart as LineChartIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  AreaChart,
  Area,
  Line,
  ReferenceLine,
} from "recharts";
import { useRunnerDnaUiModel } from "../hooks/useRunnerDnaUiModel";

// ─── DNA HELIX SVG ────────────────────────────────────────────────────────────
function DnaHelixDecor({ className = "" }: { className?: string }) {
  const h = 420, w = 72, amp = 24, loops = 4, steps = 140;
  const pts1: string[] = [], pts2: string[] = [];
  const rungs: [number, number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const y = (i / steps) * h;
    const angle = (i / steps) * Math.PI * 2 * loops;
    const x1 = w / 2 + amp * Math.sin(angle);
    const x2 = w / 2 + amp * Math.sin(angle + Math.PI);
    pts1.push(`${i === 0 ? "M" : "L"}${x1.toFixed(1)},${y.toFixed(1)}`);
    pts2.push(`${i === 0 ? "M" : "L"}${x2.toFixed(1)},${y.toFixed(1)}`);
    if (i % 14 === 0) rungs.push([x1, x2, y]);
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`w-16 shrink-0 ${className}`}
      style={{ filter: "drop-shadow(0 0 10px rgba(192,255,0,0.25))" }}
    >
      <defs>
        <linearGradient id="hg1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#C0FF00" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#00FFAA" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#C0FF00" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="hg2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#C0FF00" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#00FFAA" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#C0FF00" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <path d={pts1.join(" ")} stroke="url(#hg1)" strokeWidth="2.5" fill="none" />
      <path d={pts2.join(" ")} stroke="url(#hg2)" strokeWidth="2.5" fill="none" />
      {rungs.map(([x1, x2, y], i) => (
        <g key={i}>
          <line x1={x1} y1={y} x2={x2} y2={y} stroke="#C0FF00" strokeWidth="1.5" opacity="0.3" />
          <circle cx={x1} cy={y} r="3" fill="#C0FF00" opacity="0.85" />
          <circle cx={x2} cy={y} r="2.5" fill="#C0FF00" opacity="0.4" />
        </g>
      ))}
    </svg>
  );
}

// ─── VDOT CIRCULAR GAUGE ─────────────────────────────────────────────────────
function VdotGauge({ current, ceiling }: { current: number; ceiling: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 200); return () => clearTimeout(t); }, []);

  const size = 200, sw = 14, r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, current / Math.max(ceiling, current + 0.1));
  const offset = circ * (1 - pct);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 absolute inset-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#141414" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r - 10} fill="none" stroke="#C0FF00" strokeWidth="1.5" opacity="0.08" strokeDasharray="4 6" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="url(#vg)" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={mounted ? offset : circ}
          style={{ transition: "stroke-dashoffset 2s cubic-bezier(0.34,1.56,0.64,1)" }}
        />
        <defs>
          <linearGradient id="vg" gradientUnits="userSpaceOnUse" x1="0" y1={size} x2={size} y2="0">
            <stop offset="0%" stopColor="#00FFAA" />
            <stop offset="100%" stopColor="#C0FF00" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-black tracking-[0.25em] text-gray-600 mb-1">VDOT</span>
        <span className="text-6xl font-black text-white leading-none">{current}</span>
        <span className="text-[10px] text-gray-600 mt-1.5 tracking-widest">/ {ceiling} ceiling</span>
      </div>
    </div>
  );
}

// ─── DNA STRAND BAR ───────────────────────────────────────────────────────────
function DnaStrand({
  label, sublabel, score, colors, delay,
}: {
  label: string; sublabel: string; score: number;
  colors: [string, string]; delay: number;
}) {
  const [filled, setFilled] = useState(false);
  useEffect(() => { const t = setTimeout(() => setFilled(true), delay); return () => clearTimeout(t); }, [delay]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs font-black tracking-[0.15em] text-gray-300 uppercase">{label}</div>
          <div className="text-[10px] text-gray-600 mt-0.5">{sublabel}</div>
        </div>
        <span className="text-4xl font-black text-white leading-none">{score}</span>
      </div>
      <div className="relative h-2 bg-[#111] rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
          style={{
            width: filled ? `${score}%` : "0%",
            background: `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`,
            boxShadow: `0 0 16px ${colors[1]}50`,
          }}
        />
      </div>
    </div>
  );
}

// ─── TREND BADGE ─────────────────────────────────────────────────────────────
const TREND_COLORS: Record<string, string> = {
  "In Forte Crescita": "#C0FF00",
  "In Crescita":       "#86EFAC",
  "Stabile":           "#FCD34D",
  "In Calo":           "#F97316",
  "In Forte Regressione": "#EF4444",
};

function TrendBadge({ status }: { status: string }) {
  const color = TREND_COLORS[status] ?? "#FCD34D";
  return (
    <span
      className="px-3 py-1.5 rounded-full text-[11px] font-black tracking-widest uppercase border"
      style={{ color, borderColor: `${color}40`, backgroundColor: `${color}12` }}
    >
      {status}
    </span>
  );
}

// ─── LOADING ──────────────────────────────────────────────────────────────────
function LoadingView() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-0 bg-[#030303] gap-8 p-8">
      <DnaHelixDecor className="w-20 animate-pulse" />
      <div className="text-center space-y-2">
        <h2 className="text-[#C0FF00] font-black text-3xl tracking-[0.2em] animate-pulse uppercase">
          Sequenziamento DNA in corso...
        </h2>
        <p className="text-gray-600 text-sm tracking-widest uppercase">
          Il coach olimpico sta analizzando il tuo profilo fisiologico
        </p>
      </div>
      <div className="flex gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-[#C0FF00]"
            style={{ animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── TIME DELTA ───────────────────────────────────────────────────────────────
function parseTimeSecs(t: string): number {
  const parts = t.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + (parts[1] ?? 0);
}
function formatDelta(from: string, to: string): string {
  const diff = parseTimeSecs(from) - parseTimeSecs(to);
  if (diff <= 0) return "";
  const m = Math.floor(diff / 60), s = diff % 60;
  return `-${m}:${s.toString().padStart(2, "0")}`;
}

// ─── PACE STR → SECONDS ───────────────────────────────────────────────────────
function formatItalianDecimal(value: number, digits = 1) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function humanizeCoachText(text: string | null | undefined) {
  if (!text) return "";
  return text.replace(/(\d+(?:[.,]\d+)?)\s*(?:corse\/settimana|runs?\/week)/gi, (_match, rawValue: string) => {
    const numericValue = Number(rawValue.replace(",", "."));
    if (!Number.isFinite(numericValue)) return "uscite medie a settimana";
    return `${formatItalianDecimal(numericValue, 1)} uscite medie a settimana`;
  });
}

function paceStrToSec(pace: string | null | undefined): number | null {
  if (!pace) return null;
  const clean = pace.replace(/\/km$/, "").trim();
  const parts = clean.split(":");
  if (parts.length < 2) return null;
  const m = parseInt(parts[0]), s = parseInt(parts[1]);
  return isNaN(m) || isNaN(s) ? null : m * 60 + s;
}

// ─── COMPARISON BAR ROWS ──────────────────────────────────────────────────────
function ComparisonRow({
  label, entries, higherBetter, min, max, format,
}: {
  label: string;
  entries: { name: string; value: number | null; color: string }[];
  higherBetter: boolean;
  min: number;
  max: number;
  format: (v: number) => string;
}) {
  const [filled, setFilled] = useState(false);
  useEffect(() => { const t = setTimeout(() => setFilled(true), 300); return () => clearTimeout(t); }, []);

  return (
    <div className="space-y-2">
      <div className="text-[9px] font-black tracking-[0.25em] text-gray-500 uppercase">{label}</div>
      {entries.map(({ name, value, color }) => {
        const range = max - min || 1;
        const normalized = value != null
          ? higherBetter
            ? (value - min) / range
            : 1 - (value - min) / range
          : 0;
        const pct = Math.min(100, Math.max(2, normalized * 100));
        return (
          <div key={name} className="flex items-center gap-3">
            <div className="w-24 text-[10px] font-black text-gray-600 shrink-0 text-right">{name}</div>
            <div className="flex-1 h-2.5 bg-[#111] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: filled ? `${pct}%` : "0%",
                  backgroundColor: color,
                  boxShadow: `0 0 10px ${color}50`,
                }}
              />
            </div>
            <div className="w-20 text-[11px] font-black shrink-0" style={{ color }}>
              {value != null ? format(value) : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── RUNNING DYNAMICS GAUGE ───────────────────────────────────────────────────
type ProfileVisualScore = {
  key: string;
  label: string;
  score: number;
  color: string;
};

type BiomechanicsBenchmarkRow = {
  key: "vertical_oscillation" | "vertical_ratio" | "ground_contact" | "stride";
  label: string;
  shortLabel: string;
  unit: string;
  direction: string;
  solid: string;
  semiPro: string;
  pro: string;
  elite: string;
  color: string;
  value: number | null;
  score: number | null;
};

function clampScore(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function metricScoreHigher(value: number | null, low: number, high: number) {
  if (value == null) return null;
  return Math.round(clampScore(((value - low) / (high - low)) * 100));
}

function metricScoreLower(value: number | null, best: number, worst: number) {
  if (value == null) return null;
  return Math.round(clampScore(((worst - value) / (worst - best)) * 100));
}

function formatMetricValue(value: number | null, unit: string) {
  if (value == null || Number.isNaN(value)) return "N/D";
  const decimals = value < 20 ? 1 : 0;
  return `${value.toFixed(decimals)} ${unit}`;
}

function DarkChartTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ color?: string; name?: string; value?: number | string }>;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-[#05070A]/95 px-3 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
      {label ? <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div> : null}
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4 text-xs">
            <span className="font-black" style={{ color: entry.color ?? "#CBD5E1" }}>
              {entry.name}
            </span>
            <span className="text-slate-200">{entry.value ?? "N/D"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildProfileVisualScores(data: any): ProfileVisualScore[] {
  const colors = ["#C0FF00", "#22D3EE", "#A78BFA", "#FBBF24", "#FB7185"];
  const breakdown = Array.isArray(data?.scores?.breakdown) ? data.scores.breakdown : [];

  if (breakdown.length > 0) {
    return breakdown.map((item: any, index: number) => ({
      key: item?.key ?? `score_${index}`,
      label: item?.label ?? `Score ${index + 1}`,
      score: Math.round(clampScore(Number(item?.score) || 0)),
      color: colors[index % colors.length],
    }));
  }

  const dnaScores = data?.dna_scores ?? {};
  return [
    { key: "aerobic_engine", label: "Motore aerobico", score: Math.round(clampScore(Number(dnaScores.aerobic_engine) || 0)), color: colors[0] },
    { key: "consistency", label: "Costanza", score: Math.round(clampScore(Number(dnaScores.consistency) || 0)), color: colors[1] },
    { key: "load_capacity", label: "Capacita di carico", score: Math.round(clampScore(Number(dnaScores.load_capacity) || 0)), color: colors[2] },
    { key: "efficiency", label: "Efficienza", score: Math.round(clampScore(Number(dnaScores.efficiency) || 0)), color: colors[3] },
    { key: "biomechanics", label: "Biomeccanica", score: Math.round(clampScore(Number(dnaScores.biomechanics) || 0)), color: colors[4] },
  ].filter((item) => item.score > 0);
}

function buildBiomechanicsBenchmarkRows(runningDynamics: any): BiomechanicsBenchmarkRow[] {
  const verticalOscillation = typeof runningDynamics?.vertical_oscillation_cm === "number"
    ? runningDynamics.vertical_oscillation_cm
    : null;
  const verticalRatio = typeof runningDynamics?.vertical_ratio_pct === "number"
    ? runningDynamics.vertical_ratio_pct
    : null;
  const groundContact = typeof runningDynamics?.ground_contact_ms === "number"
    ? runningDynamics.ground_contact_ms
    : null;
  const stride = typeof runningDynamics?.stride_length_m === "number"
    ? runningDynamics.stride_length_m
    : null;

  return [
    {
      key: "vertical_oscillation",
      label: "Oscillazione verticale",
      shortLabel: "Osc. vert.",
      unit: "cm",
      direction: "piu bassa = meglio",
      solid: "8.5-10.0",
      semiPro: "7.2-8.5",
      pro: "6.2-7.2",
      elite: "5.5-6.5",
      color: "#22D3EE",
      value: verticalOscillation,
      score: metricScoreLower(verticalOscillation, 6.4, 11.2),
    },
    {
      key: "vertical_ratio",
      label: "Rapporto verticale",
      shortLabel: "Ratio vert.",
      unit: "%",
      direction: "piu basso = meglio",
      solid: "8.5-10.0",
      semiPro: "7.5-8.5",
      pro: "6.5-7.5",
      elite: "5.5-6.5",
      color: "#A78BFA",
      value: verticalRatio,
      score: metricScoreLower(verticalRatio, 5.8, 10.2),
    },
    {
      key: "ground_contact",
      label: "Ground contact time",
      shortLabel: "GCT",
      unit: "ms",
      direction: "piu basso = meglio",
      solid: "245-280",
      semiPro: "225-245",
      pro: "205-225",
      elite: "180-205",
      color: "#FBBF24",
      value: groundContact,
      score: metricScoreLower(groundContact, 205, 300),
    },
    {
      key: "stride",
      label: "Lunghezza falcata",
      shortLabel: "Falcata",
      unit: "m",
      direction: "contestuale al ritmo",
      solid: "0.95-1.15",
      semiPro: "1.10-1.30",
      pro: "1.25-1.50",
      elite: "1.40-1.70",
      color: "#38BDF8",
      value: stride,
      score: metricScoreHigher(stride, 0.85, 1.35),
    },
  ];
}

type RunnerCategory = {
  label: string;
  description: string;
  color: string;
  min: number;
};

type ContextualRunnerRating = {
  score: number;
  label: string;
  description: string;
  ageBand: string;
  sexLabel: string;
  thresholds: RunnerCategory[];
};

function BenchmarkBar({
  label,
  value,
  unit,
  benchmark,
  score,
  sampleRuns,
  verdict,
  verdictLabel,
  interpretation,
  suggestion,
  color,
  available,
}: {
  label: string;
  value: string;
  unit: string;
  benchmark: string;
  score: number;
  sampleRuns: number | null;
  verdict: "positivo" | "neutro" | "da migliorare" | "non disponibile";
  verdictLabel: string;
  interpretation: string;
  suggestion: string;
  color: string;
  available: boolean;
}) {
  const fill = available ? color : "#475569";
  const sampleCount = sampleRuns !== null ? Math.round(sampleRuns) : null;
  const sampleLabel = sampleCount !== null && sampleCount > 0
    ? `Media su ${sampleCount} ${sampleCount === 1 ? "corsa" : "corse"}`
    : available
    ? "Valore reale, campione N/D"
    : "Nessuna corsa con questo dato";
  const verdictClasses: Record<typeof verdict, string> = {
    positivo: "border-[#C8FF2D]/30 bg-[#C8FF2D]/10 text-[#C8FF2D]",
    neutro: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
    "da migliorare": "border-amber-300/25 bg-amber-300/10 text-amber-200",
    "non disponibile": "border-slate-500/25 bg-slate-500/10 text-slate-300",
  };

  return (
    <div className="rounded-2xl border border-white/[0.04] bg-[#04070B] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-3xl font-black leading-none text-white">{value}</span>
            <span className="text-xs font-bold text-slate-500">{unit}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
              {sampleLabel}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${verdictClasses[verdict]}`}>
              {verdictLabel}
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-[#0A1016] px-3 py-2 text-right">
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Benchmark</div>
          <div className="mt-1 text-sm font-black text-slate-200">{benchmark}</div>
        </div>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${score}%`, backgroundColor: fill }}
        />
      </div>
      <div className="mt-4 grid gap-3 text-xs leading-5 text-slate-400 md:grid-cols-2">
        <p>{interpretation}</p>
        <p className="text-slate-300">{suggestion}</p>
      </div>
    </div>
  );
}

function formatSexLabel(value: string | null | undefined) {
  if (!value) return "profilo non definito";
  const lower = value.trim().toLowerCase();
  if (["f", "female", "femmina", "donna"].includes(lower)) return "donna";
  if (["m", "male", "maschio", "uomo"].includes(lower)) return "uomo";
  return value;
}

function formatAgeBand(age: number | null | undefined) {
  if (!age || age <= 0) return "eta non disponibile";
  if (age < 25) return "18-24";
  if (age < 35) return "25-34";
  if (age < 45) return "35-44";
  if (age < 55) return "45-54";
  if (age < 65) return "55-64";
  return "65+";
}

function buildContextualRunnerRating(args: {
  overall: number;
  age: number | null;
  sex: string | null;
}) {
  const { overall, age, sex } = args;
  const ageAdjustment = age === null
    ? 0
    : age >= 65 ? -8
    : age >= 55 ? -6
    : age >= 45 ? -4
    : age >= 35 ? -2
    : 0;
  const sexAdjustment = formatSexLabel(sex) === "donna" ? -2 : 0;

  const thresholds: RunnerCategory[] = [
    { min: 82 + ageAdjustment + sexAdjustment, label: "Competitivo", description: "Il profilo e gia vicino a trasformare qualita, tenuta e carico in prestazione vera.", color: "#C8FF2D" },
    { min: 68 + ageAdjustment + sexAdjustment, label: "Avanzato", description: "Hai una base forte e segnali agonistici chiari: manca poco per fare un salto netto.", color: "#22D3EE" },
    { min: 52 + ageAdjustment + sexAdjustment, label: "Intermedio", description: "La struttura tiene bene; il prossimo salto passa da economia, continuita e lavori mirati.", color: "#A78BFA" },
    { min: 36 + ageAdjustment + sexAdjustment, label: "In crescita", description: "Il talento c'e, ma va reso stabile con settimane piu piene e recupero meglio gestito.", color: "#FBBF24" },
    { min: 0, label: "Base", description: "C'e materiale utile da costruire: routine, volume progressivo e ordine faranno la differenza.", color: "#FB7185" },
  ];

  const match = thresholds.find((category) => overall >= category.min) ?? thresholds[thresholds.length - 1];
  return {
    score: overall,
    label: match.label,
    description: match.description,
    ageBand: formatAgeBand(age),
    sexLabel: formatSexLabel(sex),
    thresholds,
  } satisfies ContextualRunnerRating;
}

function DynMetric({
  label, value, unit, optimal, good, lowerBetter,
}: {
  label: string; value: number | null; unit: string;
  optimal: number; good: number; lowerBetter: boolean;
}) {
  if (value == null) return null;
  const isOptimal = lowerBetter ? value <= optimal : value >= optimal;
  const isGood    = lowerBetter ? value <= good   : value >= good;
  const color     = isOptimal ? "#C0FF00" : isGood ? "#FCD34D" : "#EF4444";
  const label2    = isOptimal ? "Elite"   : isGood ? "Buono"   : "Da migliorare";

  return (
    <div className="bg-[#0A0A0A] border border-white/[0.05] rounded-2xl p-5 flex flex-col gap-3 hover:border-white/10 transition-colors">
      <div className="text-[9px] font-black tracking-[0.2em] text-gray-600 uppercase">{label}</div>
      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-black leading-none" style={{ color }}>{value}</span>
        <span className="text-sm text-gray-500 pb-0.5">{unit}</span>
      </div>
      <div
        className="text-[10px] font-black tracking-wider px-2 py-1 rounded-lg self-start"
        style={{ color, backgroundColor: `${color}12`, border: `1px solid ${color}25` }}
      >
        {label2}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
function PotentialBiologySection({
  potential,
  currentVdotValue,
  ceilingVdotValue,
  activatedPotentialPct,
  vdotGain,
  focusAreas,
  weeksToCeilingEstimate,
  trainingFrequencyLabel,
}: {
  potential: any;
  currentVdotValue: number;
  ceilingVdotValue: number;
  activatedPotentialPct: number;
  vdotGain: number;
  focusAreas: Array<{ key: string; label: string; score: number; color: string; insight: string }>;
  weeksToCeilingEstimate: number;
  trainingFrequencyLabel: string;
}) {
  const activatedMarkerLeft = `${Math.min(100, Math.max(6, activatedPotentialPct))}%`;
  const unlockedWeeks = Math.max(3, Math.round(weeksToCeilingEstimate * 0.35));
  const qualityWeeks = Math.max(unlockedWeeks + 2, Math.round(weeksToCeilingEstimate * 0.72));
  const weeksRangeLabel = `${Math.max(4, weeksToCeilingEstimate - 2)}-${weeksToCeilingEstimate + 3} settimane`;
  const potentialPreview = ["5K", "10K", "HALF MARATHON", "MARATHON"]
    .map((dist) => {
      const potentialTime = potential.predictions?.[dist] as string | undefined;
      if (!potentialTime) return null;
      const currentTime = potential.current_predictions?.[dist] as string | undefined;
      return {
        dist,
        currentTime,
        potentialTime,
        delta: currentTime ? formatDelta(currentTime, potentialTime) : "",
      };
    })
    .filter((item): item is { dist: string; currentTime: string | undefined; potentialTime: string; delta: string } => item !== null)
    .slice(0, 3);
  const primaryFocusArea = focusAreas[0] ?? null;

  return (
    <section className="bg-[#080808] border border-white/[0.05] rounded-3xl p-8">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-white/[0.06] bg-[radial-gradient(circle_at_top_left,rgba(192,255,0,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.1),transparent_38%),#05070A] p-6 h-full flex flex-col">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[9px] font-black tracking-[0.35em] text-gray-500 mb-2 uppercase">
                Potenziale Biologico Assoluto
              </div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-6xl font-black text-[#C0FF00] leading-none">
                  {ceilingVdotValue.toFixed(1)}
                </span>
                <span className="text-gray-500 font-black text-lg">VDOT CEILING</span>
                <span className="text-sm text-gray-400">
                  +{vdotGain.toFixed(1)} punti da sbloccare
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-right">
              <div className="text-[9px] font-black tracking-[0.25em] text-gray-500 mb-1 uppercase">
                Potenziale attivato
              </div>
              <div className="text-4xl font-black text-white">{Math.round(activatedPotentialPct)}%</div>
            </div>
          </div>

          <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300">
            E il punto piu alto che il tuo motore puo toccare se trasformi in prestazione tutto quello che oggi si disperde tra efficienza, carico e recupero. Non e fantasia: e il tetto credibile del tuo profilo.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Ceiling</div>
              <div className="mt-2 text-3xl font-black text-[#C0FF00]">{ceilingVdotValue.toFixed(1)}</div>
              <p className="mt-2 text-xs leading-5 text-slate-400">Il tetto fisiologico che oggi il modello considera raggiungibile.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Gia attivato</div>
              <div className="mt-2 text-3xl font-black text-white">{Math.round(activatedPotentialPct)}%</div>
              <p className="mt-2 text-xs leading-5 text-slate-400">La quota di potenziale che stai gia convertendo in prestazione reale.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Margine</div>
              <div className="mt-2 text-3xl font-black text-cyan-200">+{vdotGain.toFixed(1)}</div>
              <p className="mt-2 text-xs leading-5 text-slate-400">Il salto ancora disponibile tra il tuo VDOT di oggi e il ceiling stimato.</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-black/30 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Mappa di sblocco</div>
              <div className="text-xs text-slate-400">Oggi {currentVdotValue.toFixed(1)} fino a ceiling {ceilingVdotValue.toFixed(1)}</div>
            </div>

            <div className="relative mt-5 h-4 overflow-hidden rounded-full bg-white/10">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${activatedPotentialPct}%`,
                  background: "linear-gradient(90deg, #22D3EE, #C0FF00)",
                  boxShadow: "0 0 24px rgba(192,255,0,0.35)",
                }}
              />
              <div className="absolute inset-y-0 right-0 w-[32%] bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.08))]" />
              <div
                className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-[#05070A] bg-white shadow-[0_0_0_4px_rgba(34,211,238,0.18)]"
                style={{ left: `calc(${activatedMarkerLeft} - 10px)` }}
              />
              <div className="absolute top-1/2 right-0 h-5 w-5 -translate-y-1/2 translate-x-[-50%] rounded-full border-2 border-[#05070A] bg-[#C0FF00] shadow-[0_0_0_4px_rgba(192,255,0,0.16)]" />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Cos'e</div>
                <p className="mt-2 text-xs leading-5 text-slate-400">La barra mostra quanto del ceiling e gia diventato performance concreta.</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Parte accesa</div>
                <p className="mt-2 text-xs leading-5 text-slate-400">Il tratto colorato e la quota di potenziale che stai gia usando adesso.</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Parte da sbloccare</div>
                <p className="mt-2 text-xs leading-5 text-slate-400">La parte finale e il margine che dipende da tecnica, carico e recupero.</p>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-6">
            <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Quando il ceiling entra in gara</div>
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C0FF00]">effetto cronometro</div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {potentialPreview.map((item) => (
                    <div key={item.dist} className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{item.dist}</div>
                      <div className="mt-2 text-lg font-black text-[#C0FF00]">{item.potentialTime}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.currentTime ? `oggi ${item.currentTime}` : "baseline non disponibile"}
                      </div>
                      <div className="mt-2 text-xs font-black text-emerald-400">{item.delta || "margine da confermare"}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Lettura operativa del margine</div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Margine utile</div>
                    <div className="mt-2 text-lg font-black text-cyan-200">+{vdotGain.toFixed(1)} VDOT</div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">Non e margine teorico: e quota attaccabile se la qualita smette di disperdersi.</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Finestra credibile</div>
                    <div className="mt-2 text-lg font-black text-white">~{weeksToCeilingEstimate} settimane</div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">La forbice si chiude se il blocco resta ordinato, senza inseguire salti bruschi.</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Priorita n.1</div>
                    <div className="mt-2 text-lg font-black text-white">{primaryFocusArea?.label ?? "Ordine del blocco"}</div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      {primaryFocusArea
                        ? humanizeCoachText(primaryFocusArea.insight)
                        : "Tecnica, recupero e continuita sono ancora il primo moltiplicatore del tuo ceiling."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-white/[0.06] bg-[#05070A] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Cos'e davvero</div>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Il potenziale biologico assoluto non dice solo quanto puoi valere, ma quanto del tuo motore stai lasciando sul tavolo. Quando la forbice e ampia, il corpo puo ancora correre meglio di quanto sta correndo oggi.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-[#05070A] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Se continui cosi</div>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-5xl font-black text-white">~{weeksToCeilingEstimate}</span>
                  <span className="pb-2 text-sm font-black uppercase tracking-[0.16em] text-cyan-200">settimane</span>
                </div>
              </div>
              <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">
                ritmo attuale
              </div>
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-300">
              Con {trainingFrequencyLabel} e l'attuale margine di {vdotGain.toFixed(1)} VDOT, il ceiling puo diventare attaccabile in circa {weeksRangeLabel} se il blocco resta ordinato.
            </p>

            <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                <span>Oggi</span>
                <span>Finestra realistica</span>
                <span>Ceiling</span>
              </div>
              <div className="relative mt-4 h-2 rounded-full bg-white/10">
                <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.55),rgba(192,255,0,0.9))]" />
                <div className="absolute top-1/2 left-0 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-[#05070A] bg-white" />
                <div className="absolute top-1/2 left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#05070A] bg-cyan-200 shadow-[0_0_0_4px_rgba(34,211,238,0.16)]" />
                <div className="absolute top-1/2 right-0 h-4 w-4 translate-x-[-50%] -translate-y-1/2 rounded-full border-2 border-[#05070A] bg-[#C0FF00] shadow-[0_0_0_4px_rgba(192,255,0,0.16)]" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Prime risposte</div>
                  <div className="mt-2 text-lg font-black text-white">{unlockedWeeks} sett</div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">Il corpo smette di disperdere energia e la corsa inizia a diventare piu pulita.</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Salto visibile</div>
                  <div className="mt-2 text-lg font-black text-cyan-200">{qualityWeeks} sett</div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">Qui il margine inizia a spostare ritmo gara, tenuta e qualita delle sedute chiave.</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Tetto attaccabile</div>
                  <div className="mt-2 text-lg font-black text-[#C0FF00]">~{weeksToCeilingEstimate} sett</div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">Il profilo puo iniziare a esprimere un DNA vicino al tuo tetto, non solo inseguirlo.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-[#05070A] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Come ci arrivo</div>
            <div className="mt-4 space-y-3">
              {focusAreas.map((item, index) => (
                <div key={item.key} className="rounded-2xl border border-white/[0.06] bg-black/25 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Step 0{index + 1}</div>
                      <div className="mt-1 text-lg font-black text-white">{item.label}</div>
                    </div>
                    <div
                      className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]"
                      style={{ color: item.color, borderColor: `${item.color}40`, backgroundColor: `${item.color}14` }}
                    >
                      score {Math.round(item.score)}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{humanizeCoachText(item.insight)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-white/[0.06]">
        <div className="border-b border-white/[0.06] bg-white/[0.03] px-5 py-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Tempi che puoi avvicinare</div>
          <p className="mt-2 text-sm leading-6 text-slate-400">Se trasformi il ceiling in prestazione, questi sono i riferimenti che il modello considera credibili.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.04]">
                <th className="text-left text-[9px] font-black tracking-[0.25em] text-gray-600 px-5 py-3 uppercase">Gara</th>
                <th className="text-right text-[9px] font-black tracking-[0.25em] text-gray-500 px-5 py-3 uppercase">Attuale</th>
                <th className="text-right text-[9px] font-black tracking-[0.25em] text-[#C0FF00] px-5 py-3 uppercase">Potenziale</th>
                <th className="text-right text-[9px] font-black tracking-[0.25em] text-gray-600 px-5 py-3 uppercase">Guadagno</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.025]">
              {Object.entries(potential.predictions ?? {}).map(([dist, potentialTime]) => {
                const currentTime = potential.current_predictions?.[dist] as string | undefined;
                const delta = currentTime && potentialTime ? formatDelta(currentTime, potentialTime as string) : "";
                return (
                  <tr key={dist} className="hover:bg-white/[0.015] transition-colors group">
                    <td className="px-5 py-4 font-black text-white tracking-widest uppercase group-hover:text-[#C0FF00] transition-colors">
                      {dist}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-gray-500 tabular-nums">
                      {currentTime ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-right font-mono font-black text-[#C0FF00] tabular-nums text-lg">
                      {potentialTime as string}
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-black text-emerald-400 tabular-nums">
                      {delta}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function RunnerDnaView() {
  const { model, loading, refreshing, error, reload, regenerate } = useRunnerDnaUiModel();

  if (loading || refreshing) return <LoadingView />;

  if (error || !model) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 bg-[#030303] p-8 gap-4">
        <Dna className="w-12 h-12 text-gray-700" />
        <p className="text-gray-500 uppercase tracking-widest text-sm">
          Dati insufficienti — effettua almeno 5 corse per sbloccare il tuo DNA
        </p>
      </div>
    );
  }

  const data = model.raw.dna as any;

  const {
    profile, stats, performance, consistency, efficiency,
    current_state, potential, ai_coach, dna_scores,
    running_dynamics, comparison,
  } = data;

  const potentialGap = (potential.vdot_ceiling - profile.vdot_current).toFixed(1);
  const profileVisualScores = buildProfileVisualScores(data);
  const profileVisualRadar = profileVisualScores.map((item) => ({ metric: item.label, score: item.score }));
  const biomechanicsBenchmarkRows = buildBiomechanicsBenchmarkRows(running_dynamics);
  const hasBiomechanicsBenchmark = biomechanicsBenchmarkRows.some((row) => row.value != null);
  const biomechanicsBenchmarkChart = biomechanicsBenchmarkRows.map((row) => ({
    metric: row.shortLabel,
    Tu: row.score ?? undefined,
    "Amatore solido": 58,
    "Semi-prof": 72,
    Professionista: 86,
    Elite: 96,
  }));
  const contextualRating = buildContextualRunnerRating({
    overall: model.scores.overall,
    age: model.base.age,
    sex: model.base.sex,
  });
  const contextualCategoryColor = contextualRating.thresholds.find((category) => category.label === contextualRating.label)?.color ?? "#C8FF2D";
  const contextualNextTier = contextualRating.thresholds.find((category) => contextualRating.score < category.min) ?? null;
  const contextualGapToNextTier = contextualNextTier ? Math.max(0, contextualNextTier.min - contextualRating.score) : 0;
  const projectedContextualRating = buildContextualRunnerRating({
    overall: model.scores.projected,
    age: model.base.age,
    sex: model.base.sex,
  });
  const currentVdotValue = typeof model.performance.vdot === "number"
    ? model.performance.vdot
    : Number(profile.vdot_current) || 0;
  const ceilingVdotValue = typeof model.performance.vdotCeiling === "number"
    ? model.performance.vdotCeiling
    : Number(potential.vdot_ceiling) || currentVdotValue;
  const activatedPotentialPct = typeof model.performance.potentialPct === "number"
    ? model.performance.potentialPct
    : Number(potential.potential_pct) || 0;
  const projectedScoreGain = Math.max(0, Math.round(model.scores.projected - model.scores.overall));
  const vdotGain = Math.max(0, Math.round((ceilingVdotValue - currentVdotValue) * 10) / 10);
  const weeklyRunsAverage = typeof model.base.weeklyFrequency === "number"
    ? model.base.weeklyFrequency
    : Number(consistency.runs_per_week) || 0;
  const trainingFrequencyLabel = weeklyRunsAverage > 0
    ? `${formatItalianDecimal(weeklyRunsAverage, 1)} uscite medie a settimana`
    : "una frequenza di allenamento stabile";
  const weeksToCeilingEstimate = Math.max(
    6,
    Math.min(
      24,
      Math.round(
        vdotGain * 2.5
        + Math.max(0, 5 - weeklyRunsAverage) * 1.4
        + Math.max(0, 100 - activatedPotentialPct) / 18
        + 1
      ),
    ),
  );
  const focusAreas = (model.scores.items.length > 0
    ? [...model.scores.items].sort((a, b) => a.score - b.score).slice(0, 3)
    : model.diagnostics.priorities.slice(0, 3).map((item, index) => ({
        key: `priority_${index}`,
        label: `Priorita ${index + 1}`,
        score: 0,
        status: "Focus",
        color: ["#FB7185", "#FBBF24", "#22D3EE"][index % 3],
        weight: 0,
        description: item,
        insight: item,
      })));
  const primaryFocusArea = focusAreas[0] ?? null;
  const evolutionChartData = model.evolution
    .filter((point) => point.label !== "Mese scorso")
    .map((point) => ({
    ...point,
    scoreTrack: point.score,
    vdotTrack: point.vdot,
  }));
  const evolutionVdotValues = evolutionChartData
    .map((point) => point.vdotTrack)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const evolutionVdotMin = evolutionVdotValues.length > 0
    ? Math.max(0, Math.floor(Math.min(...evolutionVdotValues) - 2))
    : 30;
  const evolutionVdotMax = evolutionVdotValues.length > 0
    ? Math.ceil(Math.max(...evolutionVdotValues) + 2)
    : 60;
  const evolutionRange = Math.max(1, evolutionVdotMax - evolutionVdotMin);
  const evolutionChartSeries = evolutionChartData.map((point) => ({
    ...point,
    vdotVisual: point.vdotTrack == null
      ? null
      : ((point.vdotTrack - evolutionVdotMin) / evolutionRange) * 100,
  }));
  const activatedMarkerLeft = `${Math.min(100, Math.max(6, activatedPotentialPct))}%`;

  return (
    <div className="flex-1 overflow-y-auto bg-[#030303] min-h-0 custom-scrollbar">

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden border-b border-white/[0.05]">
        {/* ambient glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/3 w-[500px] h-[500px] rounded-full bg-[#C0FF00]/[0.04] blur-3xl -translate-y-1/2" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-blue-500/[0.04] blur-3xl translate-y-1/2" />
        </div>

        <div className="relative z-10 max-w-[1400px] mx-auto px-8 lg:px-12 py-12">
          <div className="flex flex-col lg:flex-row items-center gap-10">

            {/* Left: helix + VDOT */}
            <div className="flex items-center gap-6 shrink-0">
              <DnaHelixDecor />
              <VdotGauge current={profile.vdot_current} ceiling={potential.vdot_ceiling} />
            </div>

            {/* Center: identity */}
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-black tracking-[0.4em] text-gray-600 mb-3 uppercase">
                Metic Lab · Identità Atletica
              </div>
              <h1 className="text-7xl font-black italic tracking-tighter text-white leading-none mb-1">
                RUNNER
              </h1>
              <h1 className="text-7xl font-black italic tracking-tighter text-[#C0FF00] leading-none mb-6">
                DNA
              </h1>

              <div className="flex flex-wrap gap-2 mb-5">
                <span className="px-3 py-1.5 rounded-full text-[11px] font-black tracking-widest uppercase border border-[#C0FF00]/30 bg-[#C0FF00]/10 text-[#C0FF00]">
                  {profile.level}
                </span>
                <span className="px-3 py-1.5 rounded-full text-[11px] font-black tracking-widest uppercase border border-white/10 bg-white/5 text-white">
                  {profile.type}
                </span>
                <TrendBadge status={performance.trend_status} />
                {profile.vdot_delta !== null && profile.vdot_delta !== undefined && (
                  <span
                    className="px-3 py-1.5 rounded-full text-[11px] font-black tracking-widest uppercase border"
                    style={
                      profile.vdot_delta >= 0
                        ? { color: "#C0FF00", borderColor: "#C0FF00aa", backgroundColor: "#C0FF0015" }
                        : { color: "#EF4444", borderColor: "#EF444440", backgroundColor: "#EF444412" }
                    }
                  >
                    {profile.vdot_delta >= 0 ? "+" : ""}{profile.vdot_delta} VDOT vs 6 mesi fa
                  </span>
                )}
              </div>

              <p className="text-gray-400 text-sm leading-relaxed max-w-xl">
                {profile.archetype_description}
              </p>
            </div>

            {/* Right: quick stats */}
            <div className="hidden xl:grid grid-cols-1 gap-3 shrink-0 w-44">
              {[
                { label: "KM TOTALI",   value: stats.total_km,      unit: "km" },
                { label: "CORSE",       value: stats.total_runs,    unit: "" },
                { label: "DIST. IDEALE",value: potential.ideal_distance, unit: "" },
                { label: "SETTIMANE",   value: stats.weeks_active,  unit: "att." },
              ].map(({ label, value, unit }) => (
                <div key={label} className="text-center p-3 bg-white/[0.025] border border-white/[0.05] rounded-2xl">
                  <div className="text-[8px] font-black tracking-[0.2em] text-gray-600 mb-1">{label}</div>
                  <div className="text-xl font-black text-white leading-tight">
                    {value}<span className="text-xs text-gray-500 ml-0.5">{unit}</span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-8 lg:px-12 py-10 space-y-10">
        <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-3xl border border-white/[0.05] bg-[#080808] p-8 flex h-full flex-col">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.35em] text-[#C0FF00]">
              <Trophy className="w-4 h-4 text-[#C0FF00]" />
              Voto runner contestualizzato
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
              <div>
                <div className="flex items-end gap-3">
                  <span className="text-7xl font-black leading-none text-white">{contextualRating.score}</span>
                  <span className="pb-2 text-2xl font-black text-slate-500">/100</span>
                </div>
                <div
                  className="mt-4 inline-flex rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em]"
                  style={{ color: contextualCategoryColor, borderColor: `${contextualCategoryColor}40`, backgroundColor: `${contextualCategoryColor}14` }}
                >
                  {contextualRating.label}
                </div>
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">{contextualRating.description}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Contesto atleta</div>
                <div className="mt-3 text-lg font-black text-white">
                  {contextualRating.sexLabel} · fascia {contextualRating.ageBand}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  La categoria usa il tuo DNA score reale e la contestualizza nella fascia anagrafica e nel sesso registrato nel profilo.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Prossimo gradino</div>
                <div className="mt-2 text-xl font-black text-white">
                  {contextualNextTier ? contextualNextTier.label : projectedContextualRating.label}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {contextualNextTier
                    ? `Ti separano ${contextualGapToNextTier} punti contestualizzati dal livello successivo.`
                    : "Sei gia sulla fascia piu alta prevista per il tuo contesto atleta."}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Score proiettato</div>
                <div className="mt-2 text-xl font-black text-[#C0FF00]">
                  {model.scores.projected}
                  <span className="ml-1 text-xs text-slate-500">/100</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {projectedScoreGain > 0
                    ? `Il margine realistico oggi vale circa +${projectedScoreGain} punti se il blocco resta pulito.`
                    : "Il focus ora e consolidare il livello attuale senza disperdere qualita."}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Focus immediato</div>
                <div className="mt-2 text-xl font-black text-white">
                  {primaryFocusArea?.label ?? "Ordine del blocco"}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {primaryFocusArea
                    ? humanizeCoachText(primaryFocusArea.insight)
                    : "Continuita, recupero e ordine del carico restano il primo moltiplicatore del tuo DNA."}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/[0.05] bg-[#080808] p-8">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Livelli runner</div>
            <div className="mt-6 space-y-4">
              {contextualRating.thresholds.map((category) => {
                const active = contextualRating.label === category.label;
                return (
                  <div key={category.label} className="rounded-2xl border border-white/10 bg-[#0B0D10] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-lg font-black text-white">{category.label}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-400">{category.description}</div>
                      </div>
                      <div
                        className="shrink-0 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]"
                        style={{
                          color: category.color,
                          borderColor: `${category.color}40`,
                          backgroundColor: active ? `${category.color}14` : "transparent",
                        }}
                      >
                        da {Math.max(category.min, 0)}
                      </div>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{
                          width: `${Math.max(8, Math.min(100, contextualRating.score))}%`,
                          background: active ? `linear-gradient(90deg, ${category.color}, rgba(255,255,255,0.9))` : "rgba(255,255,255,0.12)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══ DNA STRANDS ══════════════════════════════════════════════════ */}
        <PotentialBiologySection
          potential={potential}
          currentVdotValue={currentVdotValue}
          ceilingVdotValue={ceilingVdotValue}
          activatedPotentialPct={activatedPotentialPct}
          vdotGain={vdotGain}
          focusAreas={focusAreas}
          weeksToCeilingEstimate={weeksToCeilingEstimate}
          trainingFrequencyLabel={trainingFrequencyLabel}
        />

        <section>
          <div className="text-[9px] font-black tracking-[0.35em] text-gray-600 mb-6 uppercase">
            Sequenza Biomolecolare — 4 Dimensioni Atletiche
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 bg-[#080808] border border-white/[0.05] rounded-3xl">
            <DnaStrand
              label="Motore Aerobico"
              sublabel="VDOT — capacità ossidativa massimale"
              score={dna_scores.aerobic_engine}
              colors={["#C0FF00", "#00FFAA"]}
              delay={150}
            />
            <DnaStrand
              label="Biomeccanica"
              sublabel="Efficienza passo-cardiaca · cadenza"
              score={dna_scores.biomechanics}
              colors={["#3B82F6", "#06B6D4"]}
              delay={350}
            />
            <DnaStrand
              label="Costanza Atletica"
              sublabel="Media uscite settimanali convertita in score DNA"
              score={dna_scores.consistency}
              colors={["#A855F7", "#EC4899"]}
              delay={550}
            />
            <DnaStrand
              label="Capacità di Carico"
              sublabel="CTL — carico cronico adattativo"
              score={dna_scores.load_capacity}
              colors={["#F59E0B", "#EF4444"]}
              delay={750}
            />
          </div>
        </section>

        {/* ══ PROFILE VISUAL ═══════════════════════════════════════════════ */}
        {profileVisualScores.length > 0 && (
          <section className="bg-[#080808] border border-white/[0.05] rounded-3xl p-8">
            <div className="flex flex-col gap-3 mb-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[9px] font-black tracking-[0.35em] text-[#C0FF00] uppercase">
                  <BarChart2 className="w-4 h-4 text-[#C0FF00]" />
                  Profilo visivo
                </div>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-white">
                  Dove sei forte, dove puoi salire
                </h2>
              </div>
              <p className="max-w-2xl text-sm leading-7 text-gray-400">
                Radar e breakdown leggono gli score reali del tuo Runner DNA: motore, costanza, carico, efficienza e biomeccanica.
              </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="h-[360px] rounded-2xl border border-white/[0.06] bg-[#0A0A0A] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={profileVisualRadar}>
                    <PolarGrid stroke="rgba(255,255,255,0.12)" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: "#94A3B8", fontSize: 11, fontWeight: 800 }} />
                    <Radar dataKey="score" name="DNA score" stroke="#C0FF00" fill="#C0FF00" fillOpacity={0.22} strokeWidth={2} />
                    <Tooltip content={<DarkChartTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="h-[360px] rounded-2xl border border-white/[0.06] bg-[#0A0A0A] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profileVisualScores} layout="vertical" margin={{ left: 12, right: 16, top: 10, bottom: 10 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="label" width={140} tick={{ fill: "#CBD5E1", fontSize: 11, fontWeight: 800 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<DarkChartTooltip />} />
                    <Bar dataKey="score" name="Score" radius={[0, 8, 8, 0]}>
                      {profileVisualScores.map((item) => (
                        <Cell key={item.key} fill={item.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        )}

        {/* ══ CORE METRICS ═════════════════════════════════════════════════ */}
        {false && (
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "PASSO MEDIO",  value: stats.avg_pace,          unit: "/km",  icon: Timer },
            { label: "FC MEDIA",     value: stats.avg_hr || "—",     unit: "bpm",  icon: Heart },
            { label: "CADENZA",      value: stats.avg_cadence || "—",unit: "spm",  icon: Activity },
            { label: "CTL",          value: current_state.fitness_ctl,unit: "",    icon: Gauge },
            { label: "ATL",          value: current_state.atl,       unit: "",     icon: Flame },
            { label: "TSB",          value: current_state.tsb,       unit: "",     icon: TrendingUp },
          ].map(({ label, value, unit, icon: Icon }) => {
            const isTsb = label === "TSB";
            const tsb = Number(value);
            const tsbColor = isTsb
              ? tsb > 5 ? "#C0FF00" : tsb > -10 ? "#FCD34D" : "#EF4444"
              : "white";
            return (
              <div key={label} className="bg-[#080808] border border-white/[0.05] rounded-2xl p-4 text-center flex flex-col items-center gap-2 hover:border-white/10 transition-colors">
                <Icon className="w-4 h-4 text-gray-600" />
                <div className="text-[8px] font-black tracking-[0.2em] text-gray-600">{label}</div>
                <div className="text-2xl font-black leading-none" style={{ color: tsbColor }}>
                  {value}<span className="text-xs text-gray-500 ml-0.5">{unit}</span>
                </div>
              </div>
            );
          })}
        </section>
        )}

        {false && (
        <section className="bg-[#080808] border border-white/[0.05] rounded-3xl p-8">
          <div className="text-[9px] font-black tracking-[0.35em] text-gray-600 mb-6 uppercase">
            Distribuzione Energetica — Zone Fisiologiche
          </div>

          {/* Stacked bar */}
          <div className="flex h-4 rounded-full overflow-hidden mb-6 gap-px">
            {([
              { key: "z1", color: "#4B5563" },
              { key: "z2", color: "#3B82F6" },
              { key: "z3", color: "#10B981" },
              { key: "z4", color: "#F59E0B" },
              { key: "z5", color: "#EF4444" },
            ] as { key: string; color: string }[]).map(({ key, color }) => (
              <div
                key={key}
                style={{ width: `${stats.zone_distribution[key] ?? 0}%`, backgroundColor: color }}
                title={`${key.toUpperCase()}: ${stats.zone_distribution[key] ?? 0}%`}
              />
            ))}
          </div>

          <div className="space-y-3">
            {([
              { key: "z1", label: "Z1 · Recovery",  color: "#4B5563" },
              { key: "z2", label: "Z2 · Aerobico",  color: "#3B82F6" },
              { key: "z3", label: "Z3 · Tempo",     color: "#10B981" },
              { key: "z4", label: "Z4 · Threshold", color: "#F59E0B" },
              { key: "z5", label: "Z5 · VO₂max",    color: "#EF4444" },
            ] as { key: string; label: string; color: string }[]).map(({ key, label, color }) => {
              const pct = stats.zone_distribution[key] ?? 0;
              return (
                <div key={key} className="flex items-center gap-4">
                  <div className="w-28 text-[10px] font-black text-gray-500 tracking-wide shrink-0">{label}</div>
                  <div className="flex-1 h-1.5 bg-[#111] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}50` }}
                    />
                  </div>
                  <div className="w-9 text-right text-sm font-black text-white shrink-0">{pct}%</div>
                </div>
              );
            })}
          </div>

          {/* 80/20 insight */}
          {(() => {
            const easy = (stats.zone_distribution.z1 ?? 0) + (stats.zone_distribution.z2 ?? 0);
            const ok = easy >= 75;
            return (
              <div
                className="mt-6 px-4 py-3 rounded-xl text-xs font-black tracking-wide border"
                style={
                  ok
                    ? { color: "#C0FF00", borderColor: "#C0FF0025", backgroundColor: "#C0FF0008" }
                    : { color: "#F59E0B", borderColor: "#F59E0B25", backgroundColor: "#F59E0B08" }
                }
              >
                {ok
                  ? `✓ Polarizzazione 80/20 rispettata — ${easy}% del tempo in Z1/Z2`
                  : `⚠ Polarizzazione 80/20 non rispettata — solo ${easy}% in Z1/Z2. Troppo lavoro in zona medio-alta.`}
              </div>
            );
          })()}
        </section>
        )}

        {/* ══ RUNNING DYNAMICS ═════════════════════════════════════════════ */}
        {false && (running_dynamics && (
          running_dynamics.vertical_oscillation_cm != null ||
          running_dynamics.vertical_ratio_pct != null ||
          running_dynamics.ground_contact_ms != null ||
          running_dynamics.stride_length_m != null
        )) ? (
          <section className="bg-[#080808] border border-white/[0.05] rounded-3xl p-8">
            <div className="flex items-center gap-2 mb-6">
              <Footprints className="w-4 h-4 text-indigo-400" />
              <span className="text-[9px] font-black tracking-[0.35em] text-gray-500 uppercase">
                Running Dynamics — Biomeccanica Avanzata
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <DynMetric
                label="Oscillazione Verticale"
                value={running_dynamics.vertical_oscillation_cm}
                unit="cm"
                optimal={6} good={9} lowerBetter={true}
              />
              <DynMetric
                label="Rapporto Verticale"
                value={running_dynamics.vertical_ratio_pct}
                unit="%"
                optimal={6} good={9} lowerBetter={true}
              />
              <DynMetric
                label="Contatto Suolo"
                value={running_dynamics.ground_contact_ms}
                unit="ms"
                optimal={200} good={250} lowerBetter={true}
              />
              <DynMetric
                label="Lunghezza Falcata"
                value={running_dynamics.stride_length_m}
                unit="m"
                optimal={1.2} good={1.0} lowerBetter={false}
              />
            </div>
            <p className="mt-4 text-[10px] text-gray-700 leading-relaxed">
              Oscillazione verticale: target &lt;6cm (elite) · Rapporto verticale: target &lt;6% · Contatto suolo: target &lt;200ms · Richiede orologio con Running Dynamics (Garmin HRM-Pro, Coros, Polar Vantage)
            </p>
          </section>
        ) : (
          <section className="bg-[#080808] border border-white/[0.05] border-dashed rounded-3xl p-6 flex items-center gap-4">
            <Footprints className="w-8 h-8 text-gray-700 shrink-0" />
            <div>
              <div className="text-[9px] font-black tracking-[0.25em] text-gray-600 uppercase mb-1">Running Dynamics Non Ancora Sincronizzate</div>
              <p className="text-xs text-gray-600">
                Il tuo Garmin Forerunner 265 registra oscillazione verticale, rapporto verticale e contatto suolo nei file FIT. Premi <strong className="text-gray-400">Garmin Sync</strong> in Attività per importarle.
              </p>
            </div>
          </section>
        )}

        {/* ══ BIOMECHANICS BENCHMARK ═══════════════════════════════════════ */}
        <section className="bg-[#080808] border border-white/[0.05] rounded-3xl p-8">
          <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                <LineChartIcon className="w-4 h-4 text-[#C0FF00]" />
                Traiettoria reale + margine
              </div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-white">Evoluzione disponibile</h2>
            </div>
            <div className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
              {performance.trend_status}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">VDOT attuale</div>
                <div className="mt-3 text-4xl font-black text-white">{profile.vdot_current}</div>
                <div className="mt-3 text-xs leading-5 text-slate-400">Ceiling reale: {potential.vdot_ceiling}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">PB 5K</div>
                <div className="mt-3 text-4xl font-black text-white">{model.performance.pb5k}</div>
                <div className="mt-3 text-xs leading-5 text-slate-400">Previsione attuale: {model.predictions.current["5K"] ?? "N/D"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">PB 10K</div>
                <div className="mt-3 text-4xl font-black text-white">{model.performance.pb10k}</div>
                <div className="mt-3 text-xs leading-5 text-slate-400">Previsione attuale: {model.predictions.current["10K"] ?? "N/D"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">CTL / ATL</div>
                <div className="mt-3 text-4xl font-black text-white">{current_state.fitness_ctl} / {current_state.atl}</div>
                <div className="mt-3 text-xs leading-5 text-slate-400">{efficiency.label}</div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/[0.06] bg-[radial-gradient(circle_at_top_left,rgba(192,255,0,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.12),transparent_36%),#05070A] p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">
                      DNA di oggi
                    </span>
                    <span className="rounded-full border border-[#C0FF00]/20 bg-[#C0FF00]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#C0FF00]">
                      DNA raggiungibile
                    </span>
                    <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-violet-200">
                      Tetto del motore
                    </span>
                  </div>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
                    Una lettura semplice: la curva verde mostra il DNA che puoi rendere reale, la linea viola fa vedere quanto puo crescere il motore.
                  </p>
                </div>
                <div className="grid gap-2 text-right text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  <span>+{projectedScoreGain} punti DNA disponibili</span>
                  <span>+{vdotGain.toFixed(1)} VDOT di margine</span>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#06111A] p-4">
                <div className="mb-4 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">DNA oggi</div>
                    <div className="mt-2 text-lg font-black text-white">{model.scores.overall}/100</div>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">DNA raggiungibile</div>
                    <div className="mt-2 text-lg font-black text-[#C0FF00]">{model.scores.projected}/100</div>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">VDOT ora</div>
                    <div className="mt-2 text-lg font-black text-cyan-200">{currentVdotValue.toFixed(1)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Ceiling motore</div>
                    <div className="mt-2 text-lg font-black text-violet-200">{ceilingVdotValue.toFixed(1)}</div>
                  </div>
                </div>

                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={evolutionChartSeries} margin={{ top: 12, right: 12, left: -18, bottom: 4 }}>
                      <defs>
                        <linearGradient id="runnerDnaPotentialArea" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#C0FF00" stopOpacity={0.34} />
                          <stop offset="100%" stopColor="#C0FF00" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} strokeDasharray="4 8" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#64748B", fontSize: 11, fontWeight: 800 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="score"
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        tick={{ fill: "#64748B", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={34}
                      />
                      <YAxis yAxisId="vdot" hide domain={[evolutionVdotMin, evolutionVdotMax]} />
                      <Tooltip content={<DarkChartTooltip />} />
                      <ReferenceLine x="Ora" yAxisId="score" stroke="rgba(255,255,255,0.1)" strokeDasharray="4 6" />
                      <ReferenceLine x="Potenziale" yAxisId="score" stroke="rgba(192,255,0,0.16)" strokeDasharray="4 6" />
                      <Area
                        yAxisId="score"
                        name="DNA raggiungibile"
                        type="monotone"
                        dataKey="scoreTrack"
                        stroke="#C0FF00"
                        strokeWidth={3}
                        fill="url(#runnerDnaPotentialArea)"
                        activeDot={{ r: 6, stroke: "#0B0F14", strokeWidth: 2, fill: "#C0FF00" }}
                        connectNulls
                      />
                      <Line
                        yAxisId="vdot"
                        name="Tetto del motore"
                        type="monotone"
                        dataKey="vdotTrack"
                        stroke="#A78BFA"
                        strokeWidth={2.5}
                        strokeDasharray="8 6"
                        dot={{ r: 4, stroke: "#05070A", strokeWidth: 2, fill: "#C4B5FD" }}
                        activeDot={{ r: 6, stroke: "#05070A", strokeWidth: 2, fill: "#DDD6FE" }}
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Lettura 1</div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">La curva verde sale dal tuo valore reale al livello che puoi convertire con allenamento ordinato.</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Lettura 2</div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">La linea viola non e un risultato garantito: e il tetto del motore se smetti di disperdere energia.</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Lettura 3</div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">Il tratto corto tra oggi e potenziale dice che il salto e realistico, non teorico o lontanissimo.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="bg-[#05070A] border border-white/[0.05] rounded-3xl p-8">
          <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.35em] text-[#C0FF00]">
                <Footprints className="w-4 h-4 text-[#C0FF00]" />
                Biomechanics lab
              </div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-white">Qualita del gesto e running dynamics</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-gray-400">
              Le metriche sono medie delle corse con dati disponibili: ogni box mostra il campione usato e se il valore e positivo, nella norma o da migliorare.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {model.biomechanics.map((metric) => (
              <BenchmarkBar
                key={metric.key}
                label={metric.label}
                value={metric.displayValue}
                unit={metric.unit}
                benchmark={metric.benchmark}
                score={metric.score}
                sampleRuns={metric.sampleRuns}
                verdict={metric.verdict}
                verdictLabel={metric.verdictLabel}
                interpretation={metric.interpretation}
                suggestion={metric.suggestion}
                color={metric.color}
                available={metric.available}
              />
            ))}
          </div>
        </section>
        {hasBiomechanicsBenchmark && (
          <section className="bg-[#080808] border border-white/[0.05] rounded-3xl p-8">
            <div className="flex flex-col gap-3 mb-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[9px] font-black tracking-[0.35em] text-[#C0FF00] uppercase">
                  <Footprints className="w-4 h-4 text-[#C0FF00]" />
                  Benchmark biomeccanico
                </div>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-white">
                  Tu vs amatore solido, semi-prof, pro ed elite
                </h2>
              </div>
              <p className="max-w-2xl text-sm leading-7 text-gray-400">
                Il grafico usa un indice qualita 0-100 per confrontare metriche con unita diverse. La tabella sotto mostra i range reali di riferimento.
              </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="h-[360px] rounded-2xl border border-white/[0.06] bg-[#0A0A0A] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={biomechanicsBenchmarkChart} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="metric" tick={{ fill: "#94A3B8", fontSize: 11, fontWeight: 800 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<DarkChartTooltip />} />
                    <Legend wrapperStyle={{ color: "#94A3B8", fontSize: 11, fontWeight: 800 }} />
                    <Bar dataKey="Tu" fill="#C0FF00" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Amatore solido" fill="#334155" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Semi-prof" fill="#22D3EE" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Professionista" fill="#A78BFA" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Elite" fill="#FB7185" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
                <div className="overflow-x-auto">
                  <div className="min-w-[760px]">
                    <div className="grid grid-cols-[1.3fr_0.7fr_0.95fr_0.95fr_0.95fr_0.9fr] gap-0 border-b border-white/[0.08] bg-white/[0.04] px-3 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-gray-500">
                      <span>Metrica</span>
                      <span>Tu</span>
                      <span>Solido</span>
                      <span>Semi-prof</span>
                      <span>Pro</span>
                      <span>Elite</span>
                    </div>
                    {biomechanicsBenchmarkRows.map((row) => (
                      <div key={row.key} className="grid grid-cols-[1.3fr_0.7fr_0.95fr_0.95fr_0.95fr_0.9fr] gap-0 border-b border-white/[0.04] px-3 py-3 text-xs text-gray-300 last:border-b-0">
                        <div className="min-w-0">
                          <div className="font-black text-white">{row.label}</div>
                          <div className="mt-1 text-[10px] leading-4 text-gray-500">{row.direction}</div>
                        </div>
                        <div className="font-black" style={{ color: row.color }}>
                          {formatMetricValue(row.value, row.unit)}
                        </div>
                        <div>{row.solid}</div>
                        <div>{row.semiPro}</div>
                        <div>{row.pro}</div>
                        <div>{row.elite}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ══ COACH VERDICT ════════════════════════════════════════════════ */}
        <section className="relative bg-gradient-to-br from-[#0C0C0C] to-[#060606] border border-[#C0FF00]/15 rounded-3xl p-10 overflow-hidden">
          <div
            className="absolute top-4 left-6 select-none pointer-events-none font-black leading-none"
            style={{ fontSize: 160, color: "#C0FF00", opacity: 0.04 }}
          >"</div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-5">
              <BrainCircuit className="w-4 h-4 text-[#C0FF00]" />
              <span className="text-[9px] font-black tracking-[0.35em] text-[#C0FF00] uppercase">
                Verdetto Coach Olimpico · AI Analysis
              </span>
            </div>
            <p className="text-xl text-white leading-relaxed font-medium max-w-4xl">
              {humanizeCoachText(ai_coach.coach_verdict)}
            </p>
            {performance.trend_detail && (
              <p className="mt-3 text-sm text-gray-500 italic">{performance.trend_detail}</p>
            )}

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Activity className="w-3 h-3 text-gray-600" />
                <span className="font-black tracking-wider text-gray-400">{efficiency.label}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Timer className="w-3 h-3 text-gray-600" />
                <span className="font-black tracking-wider text-gray-400">{consistency.label}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Gauge className="w-3 h-3 text-gray-600" />
                <span className="font-black tracking-wider text-gray-400">{current_state.form_label}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ══ STRENGTHS & GAPS ══════════════════════════════════════════════ */}
        <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.35em] text-[#C0FF00]">
              <ShieldCheck className="w-4 h-4 text-[#C0FF00]" />
              Strengths / weaknesses / priorities
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white">Cosi mi rende forte e cosa mi limita</h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-gray-400">
            Insight generati dal backend Runner DNA e rinfrescati con sync e import Garmin.
          </p>
        </div>
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Strengths */}
          <div className="bg-[#080808] border border-[#C0FF00]/15 rounded-3xl p-8">
            <div className="flex items-center gap-2 mb-6">
              <Trophy className="w-4 h-4 text-[#C0FF00]" />
              <span className="text-[9px] font-black tracking-[0.35em] text-[#C0FF00] uppercase">
                Punti di Forza
              </span>
            </div>
            <ul className="space-y-4">
                {model.diagnostics.strengths.map((s: string, i: number) => (
                  <li key={i} className="flex gap-3 items-start">
                  <div className="w-5 h-5 rounded-full bg-[#C0FF00]/10 border border-[#C0FF00]/25 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] font-black text-[#C0FF00]">✓</span>
                  </div>
                  <span className="text-sm text-gray-300 leading-relaxed">{humanizeCoachText(s)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Gaps */}
          <div className="bg-[#080808] border border-rose-500/15 rounded-3xl p-8">
            <div className="flex items-center gap-2 mb-6">
              <Zap className="w-4 h-4 text-rose-500" />
              <span className="text-[9px] font-black tracking-[0.35em] text-rose-500 uppercase">
                Punti deboli
              </span>
            </div>
            <ul className="space-y-4">
                {model.diagnostics.weaknesses.map((g: string, i: number) => (
                  <li key={i} className="flex gap-3 items-start">
                  <div className="w-5 h-5 rounded-full bg-rose-500/10 border border-rose-500/25 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] font-black text-rose-500">!</span>
                  </div>
                  <span className="text-sm text-gray-300 leading-relaxed">{humanizeCoachText(g)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#080808] border border-cyan-300/20 rounded-3xl p-8">
            <div className="flex items-center gap-2 mb-6">
              <Dumbbell className="w-4 h-4 text-cyan-200" />
              <span className="text-[9px] font-black tracking-[0.35em] text-cyan-200 uppercase">
                Aree da migliorare
              </span>
            </div>
            <ul className="space-y-4">
                {model.diagnostics.priorities.slice(0, 3).map((item, index) => (
                <li key={item} className="rounded-md border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">
                  <span className="mr-2 font-black text-cyan-200">0{index + 1}</span>
                  {humanizeCoachText(item)}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ══ POTENTIAL ════════════════════════════════════════════════════ */}
        <section className="hidden bg-[#080808] border border-white/[0.05] rounded-3xl p-8">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[28px] border border-white/[0.06] bg-[radial-gradient(circle_at_top_left,rgba(192,255,0,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.1),transparent_38%),#05070A] p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-[9px] font-black tracking-[0.35em] text-gray-500 mb-2 uppercase">
                    Potenziale Biologico Assoluto
                  </div>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-6xl font-black text-[#C0FF00] leading-none">
                      {potential.vdot_ceiling}
                    </span>
                    <span className="text-gray-500 font-black text-lg">VDOT CEILING</span>
                    <span className="text-sm text-gray-400">
                      +{potentialGap} punti da sbloccare
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-right">
                  <div className="text-[9px] font-black tracking-[0.25em] text-gray-500 mb-1 uppercase">
                    Potenziale attivato
                  </div>
                  <div className="text-4xl font-black text-white">{potential.potential_pct}%</div>
                </div>
              </div>

              <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300">
                E il punto piu alto che il tuo motore puo toccare se trasformi in prestazione tutto quello che oggi si disperde tra efficienza, carico e recupero. Non e fantasia: e il tetto credibile del tuo profilo.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Ceiling</div>
                  <div className="mt-2 text-3xl font-black text-[#C0FF00]">{ceilingVdotValue.toFixed(1)}</div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">Il tetto fisiologico che oggi il modello considera raggiungibile.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Gia attivato</div>
                  <div className="mt-2 text-3xl font-black text-white">{activatedPotentialPct}%</div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">La quota di potenziale che stai gia convertendo in prestazione reale.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Margine</div>
                  <div className="mt-2 text-3xl font-black text-cyan-200">+{vdotGain}</div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">Il salto ancora disponibile tra il tuo VDOT di oggi e il ceiling stimato.</p>
                </div>
              </div>

          {/* Potential % bar */}
          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-black/30 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Mappa di sblocco</div>
              <div className="text-xs text-slate-400">Oggi {currentVdotValue.toFixed(1)} fino a ceiling {ceilingVdotValue.toFixed(1)}</div>
            </div>

            <div className="relative mt-5 h-4 overflow-hidden rounded-full bg-white/10">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${activatedPotentialPct}%`,
                  background: "linear-gradient(90deg, #22D3EE, #C0FF00)",
                  boxShadow: "0 0 24px rgba(192,255,0,0.35)",
                }}
              />
              <div className="absolute inset-y-0 right-0 w-[32%] bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.08))]" />
              <div
                className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-[#05070A] bg-white shadow-[0_0_0_4px_rgba(34,211,238,0.18)]"
                style={{ left: `calc(${activatedMarkerLeft} - 10px)` }}
              />
              <div className="absolute top-1/2 right-0 h-5 w-5 -translate-y-1/2 translate-x-[-50%] rounded-full border-2 border-[#05070A] bg-[#C0FF00] shadow-[0_0_0_4px_rgba(192,255,0,0.16)]" />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Cos'e</div>
                <p className="mt-2 text-xs leading-5 text-slate-400">La barra mostra quanto del ceiling e gia diventato performance concreta.</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Parte accesa</div>
                <p className="mt-2 text-xs leading-5 text-slate-400">Il tratto colorato e la quota di potenziale che stai gia usando adesso.</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Parte da sbloccare</div>
                <p className="mt-2 text-xs leading-5 text-slate-400">La parte finale e il margine che dipende da tecnica, carico e recupero.</p>
              </div>
            </div>
          </div>

            </div>

            <div className="grid gap-4">
              <div className="rounded-2xl border border-white/[0.06] bg-[#05070A] p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Cos'e davvero</div>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Il potenziale biologico assoluto non dice solo quanto puoi valere, ma quanto del tuo motore stai lasciando sul tavolo. Quando la forbice e ampia, il corpo puo ancora correre meglio di quanto sta correndo oggi.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-[#05070A] p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Come ci arrivo</div>
                <div className="mt-4 space-y-3">
                  {focusAreas.map((item, index) => (
                    <div key={item.key} className="rounded-2xl border border-white/[0.06] bg-black/25 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Step 0{index + 1}</div>
                          <div className="mt-1 text-lg font-black text-white">{item.label}</div>
                        </div>
                        <div
                          className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]"
                          style={{ color: item.color, borderColor: `${item.color}40`, backgroundColor: `${item.color}14` }}
                        >
                          score {Math.round(item.score)}
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">{item.insight}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-white/[0.06]">
            <div className="border-b border-white/[0.06] bg-white/[0.03] px-5 py-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Tempi che puoi avvicinare</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">Se trasformi il ceiling in prestazione, questi sono i riferimenti che il modello considera credibili.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="text-left text-[9px] font-black tracking-[0.25em] text-gray-600 px-5 py-3 uppercase">Gara</th>
                  <th className="text-right text-[9px] font-black tracking-[0.25em] text-gray-500 px-5 py-3 uppercase">Attuale</th>
                  <th className="text-right text-[9px] font-black tracking-[0.25em] text-[#C0FF00] px-5 py-3 uppercase">Potenziale</th>
                  <th className="text-right text-[9px] font-black tracking-[0.25em] text-gray-600 px-5 py-3 uppercase">Guadagno</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.025]">
                {Object.entries(potential.predictions ?? {}).map(([dist, potTime]) => {
                  const curTime = potential.current_predictions?.[dist] as string | undefined;
                  const delta = curTime && potTime ? formatDelta(curTime, potTime as string) : "";
                  return (
                    <tr key={dist} className="hover:bg-white/[0.015] transition-colors group">
                      <td className="px-5 py-4 font-black text-white tracking-widest uppercase group-hover:text-[#C0FF00] transition-colors">
                        {dist}
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-gray-500 tabular-nums">
                        {curTime ?? "—"}
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-black text-[#C0FF00] tabular-nums text-lg">
                        {potTime as string}
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-black text-emerald-400 tabular-nums">
                        {delta}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ══ CONFRONTO ════════════════════════════════════════════════════ */}
        {comparison && (
          <section className="bg-[#080808] border border-white/[0.05] rounded-3xl p-8">
            <div className="flex items-center gap-2 mb-8">
              <BarChart2 className="w-4 h-4 text-indigo-400" />
              <span className="text-[9px] font-black tracking-[0.35em] text-gray-500 uppercase">
                Confronto — Te Stesso · Media Runner · Target
              </span>
            </div>

            {/* Legend */}
            <div className="flex gap-6 mb-8">
              {[
                { color: "#6B7280", label: "Mese Scorso" },
                { color: "#C0FF00", label: "Adesso" },
                { color: "#6366F1", label: "Target Livello" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[10px] font-black text-gray-500">{label}</span>
                </div>
              ))}
            </div>

            <div className="space-y-8">
              {/* VDOT */}
              <ComparisonRow
                label="VDOT — Capacità Aerobica"
                entries={[
                  { name: "Mese Scorso", value: comparison.last_month?.vdot ?? null,   color: "#6B7280" },
                  { name: "Adesso",      value: profile.vdot_current,                  color: "#C0FF00" },
                  { name: "Target",      value: comparison.target?.vdot ?? null,        color: "#6366F1" },
                ]}
                higherBetter={true}
                min={25} max={58}
                format={(v) => v.toFixed(1)}
              />

              {/* PASSO */}
              <ComparisonRow
                label="PASSO MEDIO — Velocità (più basso = meglio)"
                entries={[
                  { name: "Mese Scorso", value: paceStrToSec(comparison.last_month?.pace_str), color: "#6B7280" },
                  { name: "Adesso",      value: paceStrToSec(stats.avg_pace),                  color: "#C0FF00" },
                  { name: "Target",      value: comparison.target?.pace_sec ?? null,            color: "#6366F1" },
                ]}
                higherBetter={false}
                min={230} max={600}
                format={(v) => `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}/km`}
              />

              {/* FC MEDIA */}
              {stats.avg_hr > 0 && (
                <ComparisonRow
                  label="FC MEDIA — Efficienza Cardiaca (più bassa = meglio)"
                  entries={[
                    { name: "Mese Scorso", value: comparison.last_month?.avg_hr ?? null, color: "#6B7280" },
                    { name: "Adesso",      value: stats.avg_hr,                          color: "#C0FF00" },
                    { name: "Target",      value: comparison.target?.avg_hr ?? null,     color: "#6366F1" },
                  ]}
                  higherBetter={false}
                  min={130} max={175}
                  format={(v) => `${Math.round(v)} bpm`}
                />
              )}

              {/* RUN/WEEK */}
              <div className="space-y-2">
                <ComparisonRow
                  label="USCITE MEDIE / SETTIMANA"
                  entries={[
                    { name: "Mese Scorso", value: comparison.last_month?.runs_per_week ?? null, color: "#6B7280" },
                    { name: "Adesso",      value: consistency.runs_per_week,                    color: "#C0FF00" },
                    { name: "Target",      value: comparison.target?.runs_per_week ?? null,     color: "#6366F1" },
                  ]}
                  higherBetter={true}
                  min={0}
                  max={8}
                  format={(v) => `${formatItalianDecimal(v, 1)} uscite`}
                />
                <p className="pl-[6.85rem] text-xs leading-5 text-slate-500">
                  E una media mobile delle ultime settimane: 7,7 non vuol dire sette sedute identiche ogni settimana, ma una frequenza media molto alta e continua.
                </p>
              </div>
            </div>

            {/* Delta summary */}
            {comparison.last_month?.vdot && (
              <div className="mt-8 pt-6 border-t border-white/[0.04] grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  {
                    label: "VDOT",
                    delta: profile.vdot_current - (comparison.last_month.vdot ?? profile.vdot_current),
                    fmt: (d: number) => `${d >= 0 ? "+" : ""}${d.toFixed(1)}`,
                    higherBetter: true,
                  },
                  {
                    label: "PASSO",
                    delta: (paceStrToSec(comparison.last_month.pace_str) ?? 0) - (paceStrToSec(stats.avg_pace) ?? 0),
                    fmt: (d: number) => `${d >= 0 ? "-" : "+"}${Math.abs(Math.floor(d / 60))}:${String(Math.abs(d % 60)).padStart(2, "0")}/km`,
                    higherBetter: true, // positive delta = faster
                  },
                  {
                    label: "FC MEDIA",
                    delta: (comparison.last_month.avg_hr ?? stats.avg_hr) - stats.avg_hr,
                    fmt: (d: number) => `${d >= 0 ? "-" : "+"}${Math.abs(Math.round(d))} bpm`,
                    higherBetter: true, // lower HR = better
                  },
                  {
                    label: "USCITE",
                    delta: consistency.runs_per_week - (comparison.last_month.runs_per_week ?? consistency.runs_per_week),
                    fmt: (d: number) => `${d >= 0 ? "+" : ""}${formatItalianDecimal(d, 1)}`,
                    higherBetter: true,
                  },
                ].map(({ label, delta, fmt, higherBetter }) => {
                  const positive = higherBetter ? delta > 0 : delta < 0;
                  const neutral = Math.abs(delta) < 0.1;
                  const color = neutral ? "#6B7280" : positive ? "#C0FF00" : "#EF4444";
                  const Icon = neutral ? Minus : positive ? ArrowUp : ArrowDown;
                  return (
                    <div key={label} className="text-center p-3 bg-black/30 rounded-2xl border border-white/[0.04]">
                      <div className="text-[8px] font-black tracking-[0.2em] text-gray-600 mb-2">{label}</div>
                      <div className="flex items-center justify-center gap-1" style={{ color }}>
                        <Icon className="w-3 h-3" />
                        <span className="text-sm font-black">{fmt(delta)}</span>
                      </div>
                      <div className="text-[9px] text-gray-600 mt-1">vs mese scorso</div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ══ UNLOCK + REGENERATE ══════════════════════════════════════════ */}
        <section className="relative bg-gradient-to-r from-[#C0FF00]/[0.04] via-transparent to-transparent border border-[#C0FF00]/15 rounded-3xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-[#C0FF00]" />
              <span className="text-[9px] font-black tracking-[0.35em] text-[#C0FF00] uppercase">
                Come sbloccare il tuo potenziale biologico
              </span>
            </div>
            <p className="text-gray-300 leading-relaxed max-w-2xl">{humanizeCoachText(ai_coach.unlock_message)}</p>
          </div>

          <button
            onClick={() => void regenerate()}
            disabled={refreshing}
            className="shrink-0 flex items-center gap-2 px-6 py-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/15 hover:border-white/25 rounded-2xl text-sm font-black tracking-widest text-white uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {refreshing
              ? <Dna className="w-4 h-4 animate-spin" />
              : <RefreshCcw className="w-4 h-4" />}
            {refreshing ? "Analizzando..." : "Rigenera DNA"}
          </button>
        </section>

      </div>
    </div>
  );
}
