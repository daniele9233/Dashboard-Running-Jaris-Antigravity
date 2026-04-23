import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  Award,
  BarChart3,
  BrainCircuit,
  ChevronRight,
  Dna,
  Dumbbell,
  Flame,
  Footprints,
  Gauge,
  HeartPulse,
  LineChart as LineChartIcon,
  Medal,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  UserRound,
  Zap,
  type LucideIcon,
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
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import { motion } from "motion/react";
import { useRunnerDnaUiModel } from "../hooks/useRunnerDnaUiModel";
import { RunnerDnaLoading } from "./runner-dna/RunnerDnaLoading";
import { displayNumber, formatRaceTime, type RunnerDnaBiomechanicMetric, type RunnerDnaScoreItem } from "../utils/runnerDnaModel";

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.26em] text-[#C8FF2D]">
          <Icon className="h-4 w-4" />
          {eyebrow}
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{title}</h2>
      </div>
      <p className="max-w-xl text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function GlassPanel({
  children,
  className = "",
  accent = "white",
}: {
  children: ReactNode;
  className?: string;
  accent?: "white" | "lime" | "cyan" | "violet" | "rose" | "amber";
}) {
  const border: Record<string, string> = {
    white: "border-white/10",
    lime: "border-[#C8FF2D]/25",
    cyan: "border-cyan-300/20",
    violet: "border-violet-400/20",
    rose: "border-rose-400/20",
    amber: "border-amber-300/20",
  };

  return (
    <div
      className={`border ${border[accent]} bg-[#0B0D10]/85 shadow-[0_20px_70px_rgba(0,0,0,0.35)] ${className}`}
    >
      {children}
    </div>
  );
}

function ScoreRing({ score, label, rank }: { score: number; label: string; rank: string }) {
  const size = 220;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * (1 - score / 100);

  return (
    <div className="relative mx-auto h-[220px] w-[220px]">
      <svg className="h-full w-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius - 18} fill="none" stroke="rgba(34,211,238,0.12)" strokeWidth="2" strokeDasharray="4 9" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#runnerDnaV2Ring)"
          strokeLinecap="round"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dash }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="runnerDnaV2Ring" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="48%" stopColor="#C8FF2D" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{label}</span>
        <span className="mt-1 text-7xl font-black leading-none text-white">{score}</span>
        <span className="mt-2 rounded-full border border-[#C8FF2D]/25 bg-[#C8FF2D]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#C8FF2D]">
          {rank}
        </span>
      </div>
    </div>
  );
}

function DnaHelix() {
  const rungs = Array.from({ length: 14 }, (_, index) => index);
  return (
    <div className="relative h-full min-h-[260px] overflow-hidden rounded-lg border border-white/10 bg-[#06080A]">
      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <svg viewBox="0 0 220 420" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="helixV2" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#C8FF2D" />
            <stop offset="50%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>
        </defs>
        <motion.path
          d="M70 20 C170 90 50 150 150 220 C250 290 40 330 150 400"
          fill="none"
          stroke="url(#helixV2)"
          strokeLinecap="round"
          strokeWidth="6"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />
        <path d="M150 20 C50 90 170 150 70 220 C-20 290 180 330 70 400" fill="none" stroke="rgba(255,255,255,0.22)" strokeLinecap="round" strokeWidth="4" />
        {rungs.map((index) => {
          const y = 38 + index * 27;
          const x1 = 82 + Math.sin(index * 0.9) * 34;
          const x2 = 138 - Math.sin(index * 0.9) * 34;
          return (
            <g key={index}>
              <line x1={x1} x2={x2} y1={y} y2={y + 4} stroke="rgba(200,255,45,0.45)" strokeWidth="2" />
              <circle cx={x1} cy={y} r="5" fill="#C8FF2D" opacity="0.8" />
              <circle cx={x2} cy={y + 4} r="4" fill="#22D3EE" opacity="0.65" />
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-5 left-5 right-5">
        <div className="text-[10px] font-black uppercase tracking-[0.26em] text-[#C8FF2D]">Sequenza reale</div>
        <div className="mt-2 text-sm leading-6 text-slate-300">
          Performance, biomeccanica e consistenza arrivano dai dati sincronizzati.
        </div>
      </div>
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  unit,
  detail,
  color = "#C8FF2D",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  detail: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</div>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="mt-3 flex min-w-0 flex-wrap items-end gap-x-2 gap-y-1">
        <span className="min-w-0 max-w-full break-words text-[clamp(1.35rem,2.1vw,1.875rem)] font-black leading-none text-white">
          {value}
        </span>
        {unit && <span className="pb-0.5 text-xs font-bold text-slate-500">{unit}</span>}
      </div>
      <div className="mt-3 text-xs leading-5 text-slate-400">{detail}</div>
    </div>
  );
}

function PillarCard({ item, index }: { item: RunnerDnaScoreItem; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-lg border border-white/10 bg-[#0A0D10] p-5 transition-colors hover:border-white/20"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
          <div className="mt-2 text-sm leading-5 text-slate-300">{item.description}</div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black leading-none" style={{ color: item.color }}>
            {item.score}
          </div>
          <div className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{item.status}</div>
        </div>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${item.color}, rgba(255,255,255,0.82))` }}
          initial={{ width: 0 }}
          animate={{ width: `${item.score}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </div>
      <div className="mt-4 rounded-md border border-white/8 bg-white/[0.03] p-3 text-xs leading-5 text-slate-400">
        {item.insight}
      </div>
    </motion.div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-white/10 bg-[#080A0D] px-3 py-2 shadow-2xl">
      <div className="text-xs font-black text-white">{label}</div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="mt-1 text-xs" style={{ color: entry.color }}>
          {entry.name ?? entry.dataKey}: {entry.value ?? "N/D"}
        </div>
      ))}
    </div>
  );
}

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
  verdict: RunnerDnaBiomechanicMetric["verdict"];
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
  const verdictClasses: Record<RunnerDnaBiomechanicMetric["verdict"], string> = {
    positivo: "border-[#C8FF2D]/30 bg-[#C8FF2D]/10 text-[#C8FF2D]",
    neutro: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
    "da migliorare": "border-amber-300/25 bg-amber-300/10 text-amber-200",
    "non disponibile": "border-slate-500/25 bg-slate-500/10 text-slate-300",
  };
  return (
    <div className="rounded-lg border border-white/10 bg-[#090B0E] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-3xl font-black leading-none text-white">{value}</span>
            <span className="text-xs font-bold text-slate-500">{unit}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
              {sampleLabel}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${verdictClasses[verdict]}`}>
              {verdictLabel}
            </span>
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Benchmark</div>
          <div className="mt-1 text-sm font-black text-slate-200">{benchmark}</div>
        </div>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: fill }}
          initial={{ width: 0 }}
          whileInView={{ width: `${score}%` }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9 }}
        />
      </div>
      <div className="mt-4 grid gap-3 text-xs leading-5 text-slate-400 md:grid-cols-2">
        <p>{interpretation}</p>
        <p className="text-slate-300">{suggestion}</p>
      </div>
    </div>
  );
}

type BiomechanicsReferenceRow = {
  key: "vertical_oscillation" | "vertical_ratio" | "ground_contact" | "stride";
  label: string;
  shortLabel: string;
  unit: string;
  direction: string;
  solid: string;
  semiPro: string;
  pro: string;
  elite: string;
  note: string;
};

const biomechanicsReferenceRows: BiomechanicsReferenceRow[] = [
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
    note: "Misura il rimbalzo verso l'alto: meno dispersione significa corsa piu economica.",
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
    note: "Rapporta rimbalzo e falcata: alto indica che stai salendo piu che avanzando.",
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
    note: "Tempo a terra: valori piu bassi indicano appoggio piu reattivo, se sostenibile.",
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
    note: "Non e sempre meglio allungarla: dipende da velocita, altezza e contatto sotto il baricentro.",
  },
];

function BiomechanicsReferencePanel({ metrics }: { metrics: RunnerDnaBiomechanicMetric[] }) {
  const metricByKey = new Map(metrics.map((metric) => [metric.key, metric]));
  const chartData = biomechanicsReferenceRows.map((row) => {
    const metric = metricByKey.get(row.key);
    return {
      metric: row.shortLabel,
      Tu: metric?.available ? metric.score : undefined,
      "Amatore solido": 58,
      "Semi-prof": 72,
      Professionista: 86,
      Elite: 96,
    };
  });

  return (
    <GlassPanel className="mt-5 rounded-lg p-5 sm:p-6" accent="cyan">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">Benchmark biomeccanico</div>
          <h3 className="mt-2 text-2xl font-black text-white">Tu vs amatore solido, semi-prof, pro ed elite</h3>
        </div>
        <p className="max-w-xl text-sm leading-6 text-slate-400">
          Il grafico usa un indice qualita 0-100 per confrontare metriche con unita diverse. La tabella sotto mostra i range reali di riferimento.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="h-[330px] rounded-lg border border-white/10 bg-[#07090C] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="metric" tick={{ fill: "#94A3B8", fontSize: 11, fontWeight: 800 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ color: "#94A3B8", fontSize: 11, fontWeight: 800 }} />
              <Bar dataKey="Tu" fill="#C8FF2D" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Amatore solido" fill="#334155" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Semi-prof" fill="#22D3EE" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Professionista" fill="#A78BFA" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Elite" fill="#FB7185" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-hidden rounded-lg border border-white/10">
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[1.3fr_0.7fr_0.95fr_0.95fr_0.95fr_0.9fr] gap-0 border-b border-white/10 bg-white/[0.04] px-3 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                <span>Metrica</span>
                <span>Tu</span>
                <span>Solido</span>
                <span>Semi-prof</span>
                <span>Pro</span>
                <span>Elite</span>
              </div>
              {biomechanicsReferenceRows.map((row) => {
                const metric = metricByKey.get(row.key);
                return (
                  <div key={row.key} className="grid grid-cols-[1.3fr_0.7fr_0.95fr_0.95fr_0.95fr_0.9fr] gap-0 border-b border-white/5 px-3 py-3 text-xs text-slate-300 last:border-b-0">
                    <div className="min-w-0">
                      <div className="font-black text-white">{row.label}</div>
                      <div className="mt-1 text-[10px] leading-4 text-slate-500">{row.direction}</div>
                    </div>
                    <div className="font-black text-[#C8FF2D]">
                      {metric?.available ? `${metric.displayValue} ${row.unit}` : "N/D"}
                    </div>
                    <div>{row.solid}</div>
                    <div>{row.semiPro}</div>
                    <div>{row.pro}</div>
                    <div>{row.elite}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {biomechanicsReferenceRows.map((row) => (
          <div key={row.key} className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-slate-400">
            <span className="font-black text-slate-200">{row.label}: </span>
            {row.note}
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex-1 bg-[#050609] p-8 text-white">
      <div className="mx-auto mt-20 max-w-xl rounded-lg border border-rose-400/25 bg-rose-400/10 p-8 text-center">
        <Dna className="mx-auto h-10 w-10 text-rose-300" />
        <h2 className="mt-4 text-2xl font-black">Runner DNA V2 non disponibile</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">{message}</p>
        <button onClick={onRetry} className="mt-6 rounded-lg bg-[#C8FF2D] px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-black">
          Riprova
        </button>
      </div>
    </div>
  );
}

export function RunnerDnaV2View() {
  const { model, loading, refreshing, error, reload, regenerate } = useRunnerDnaUiModel();
  const [selectedDistance, setSelectedDistance] = useState("10k");

  const selectedTalent = useMemo(() => {
    if (!model) return null;
    return model.distanceTalents.find((distance) => distance.id === selectedDistance) ?? model.distanceTalents[0] ?? null;
  }, [model, selectedDistance]);

  if (loading || refreshing) {
    return <RunnerDnaLoading label={refreshing ? "Ricalcolo Runner DNA V2" : "Sequenziamento Runner DNA V2"} />;
  }

  if (error || !model) {
    return <ErrorView message={error ?? "Dati Runner DNA non disponibili."} onRetry={reload} />;
  }

  const bestDistance = model.distanceTalents[0];
  const radarData = model.scores.items.map((item) => ({ metric: item.label, score: item.score }));
  const distanceData = [...model.distanceTalents].reverse();
  const scoringRows = model.scores.items.map((item) => ({
    label: item.label,
    score: item.score,
    weight: `${item.weight}%`,
  }));

  return (
    <main className="flex-1 overflow-y-auto bg-[#050609] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-45"
        style={{
          backgroundImage:
            "linear-gradient(rgba(200,255,45,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.035) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-[1540px] flex-col gap-8 px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-lg border border-white/10 bg-[#080A0E]"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-[#C8FF2D] to-violet-400" />
          <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[1.15fr_0.85fr] lg:p-9">
            <div className="flex min-w-0 flex-col justify-between gap-8">
              <div>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#C8FF2D]/30 bg-[#C8FF2D]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#C8FF2D]">
                    Dati reali sincronizzati
                  </span>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">
                    {model.freshness.label}
                  </span>
                </div>

                <h1 className="max-w-4xl text-5xl font-black uppercase leading-[0.9] tracking-tight text-white sm:text-7xl xl:text-8xl">
                  Runner DNA V2
                </h1>
                <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">
                  Non e solo un report: e la tua identita da runner, calcolata dai dati Strava, Garmin e profilo atleta.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <MetricTile
                  icon={UserRound}
                  label="Profilo base"
                  value={model.base.age !== null ? String(model.base.age) : "N/D"}
                  unit={model.base.age !== null ? "anni" : undefined}
                  detail={`${model.base.sex ?? "sesso N/D"}, ${displayNumber(model.base.heightCm)} cm, ${displayNumber(model.base.weightKg)} kg, ${model.base.level}`}
                  color="#22D3EE"
                />
                <MetricTile
                  icon={Activity}
                  label="Storico"
                  value={displayNumber(model.base.totalRuns)}
                  unit="corse"
                  detail={`${displayNumber(model.base.weeklyFrequency, 1)} allenamenti a settimana, ${displayNumber(model.base.weeksActive)} settimane tracciate`}
                  color="#C8FF2D"
                />
                <MetricTile
                  icon={Medal}
                  label="Distanza ideale"
                  value={bestDistance?.label ?? "N/D"}
                  detail={bestDistance?.insight ?? "Dato non ancora disponibile."}
                  color="#A78BFA"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => void regenerate()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C8FF2D] px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-black transition-transform hover:-translate-y-0.5"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Aggiorna il tuo DNA
                </button>
                <a href="#distance-talent" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white transition-colors hover:border-cyan-300/40">
                  Scopri dove rendi al massimo
                  <ChevronRight className="h-4 w-4" />
                </a>
                <a href="#coach-insights" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white transition-colors hover:border-violet-300/40">
                  Vedi margini di crescita
                </a>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-[260px_1fr] lg:grid-cols-1 xl:grid-cols-[260px_1fr]">
              <GlassPanel className="flex items-center justify-center rounded-lg p-5" accent="lime">
                <ScoreRing score={model.scores.overall} label="DNA score" rank={model.identity.rank.name} />
              </GlassPanel>
              <DnaHelix />
            </div>
          </div>

          <div className="border-t border-white/10 px-5 py-4 sm:px-7 lg:px-9">
            <div className="flex flex-col gap-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <span>Profilo aggiornato automaticamente dopo sync/import.</span>
              <span className="font-black text-slate-300">
                {model.identity.archetype} · {model.performance.trendStatus}
              </span>
            </div>
          </div>
        </motion.section>

        <section>
          <SectionHeader
            icon={Gauge}
            eyebrow="DNA score overview"
            title="Macro indicatori del profilo"
            description="Sottoscore reali normalizzati 1-100: motore, costanza, capacita di carico, efficienza e biomeccanica."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {model.scores.items.map((item, index) => (
              <PillarCard key={item.key} item={item} index={index} />
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <GlassPanel className="rounded-lg p-5 sm:p-6" accent="cyan">
            <SectionHeader
              icon={BrainCircuit}
              eyebrow="Runner identity"
              title={`Sei un ${model.identity.rank.name} da ${model.scores.overall}/100`}
              description={model.identity.rank.description}
            />
            <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
              <ScoreRing score={model.scores.overall} label="Identity" rank={model.identity.rank.tone} />
              <div className="flex flex-col justify-center gap-4">
                <div className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">Profilo sintetico</div>
                  <p className="mt-3 text-lg leading-8 text-slate-200">{model.identity.description}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricTile icon={HeartPulse} label="VDOT / VO2" value={model.performance.vo2maxLabel} detail="Motore aerobico reale dal profilo Runner DNA." color="#22D3EE" />
                  <MetricTile icon={Timer} label="Passo medio" value={model.performance.avgPace} detail={`FC media ${displayNumber(model.performance.avgHr)} bpm.`} color="#C8FF2D" />
                  <MetricTile icon={Flame} label="TSB" value={displayNumber(model.performance.tsb, 1)} detail={model.performance.thresholdLabel} color="#FBBF24" />
                </div>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="rounded-lg p-5 sm:p-6" accent="violet">
            <SectionHeader
              icon={BarChart3}
              eyebrow="Profilo visivo"
              title="Dove sei forte, dove puoi salire"
              description="Radar e breakdown usano lo stesso modello reale della pagina Runner DNA."
            />
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="h-[320px] rounded-lg border border-white/10 bg-[#07090C] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.12)" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: "#94A3B8", fontSize: 11, fontWeight: 800 }} />
                    <Radar dataKey="score" stroke="#C8FF2D" fill="#C8FF2D" fillOpacity={0.24} strokeWidth={2} />
                    <Tooltip content={<ChartTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-[320px] rounded-lg border border-white/10 bg-[#07090C] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoringRows} layout="vertical" margin={{ left: 12, right: 16, top: 10, bottom: 10 }}>
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis type="category" dataKey="label" width={128} tick={{ fill: "#94A3B8", fontSize: 11, fontWeight: 800 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                      {scoringRows.map((_, index) => (
                        <Cell key={index} fill={["#C8FF2D", "#22D3EE", "#A78BFA", "#FBBF24", "#FB7185"][index % 5]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </GlassPanel>
        </section>

        <section id="distance-talent">
          <SectionHeader
            icon={Target}
            eyebrow="Distance talent"
            title="La tua distanza naturale oggi e domani"
            description="La mappa distanza deriva da score reali: motore, carico, costanza, efficienza e biomeccanica."
          />
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <GlassPanel className="rounded-lg p-5 sm:p-6" accent="lime">
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distanceData} layout="vertical" margin={{ left: 16, right: 24, top: 8, bottom: 8 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 11 }} />
                    <YAxis type="category" dataKey="label" width={90} tick={{ fill: "#CBD5E1", fontSize: 12, fontWeight: 900 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="score" radius={[0, 8, 8, 0]}>
                      {distanceData.map((item) => (
                        <Cell key={item.id} fill={item.id === bestDistance?.id ? "#C8FF2D" : item.role === "Potenziale" ? "#22D3EE" : "#64748B"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassPanel>

            <div className="grid gap-3">
              {model.distanceTalents.map((distance) => (
                <button
                  key={distance.id}
                  onClick={() => setSelectedDistance(distance.id)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    selectedTalent?.id === distance.id ? "border-[#C8FF2D]/45 bg-[#C8FF2D]/10" : "border-white/10 bg-[#0B0D10] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-black text-white">{distance.label}</div>
                      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{distance.role}</div>
                    </div>
                    <div className="text-3xl font-black text-[#C8FF2D]">{distance.score}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <GlassPanel className="mt-6 rounded-lg p-5 sm:p-6" accent="cyan">
            <div className="grid gap-4 md:grid-cols-[180px_1fr_1fr] md:items-center">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">Focus selezionato</div>
                <div className="mt-2 text-4xl font-black text-white">{selectedTalent?.label ?? "N/D"}</div>
              </div>
              <p className="text-sm leading-6 text-slate-300">{selectedTalent?.insight ?? "Dato non disponibile."}</p>
              <p className="rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-400">
                Limite principale: <span className="font-black text-slate-200">{selectedTalent?.limiter ?? "N/D"}</span>
              </p>
            </div>
          </GlassPanel>
        </section>

        <section>
          <SectionHeader
            icon={LineChartIcon}
            eyebrow="Performance analysis"
            title="Prestazione, motore e readiness"
            description="VDOT, previsioni, passo medio, CTL/ATL/TSB e dati disponibili dal profilo reale."
          />
          <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <MetricTile icon={HeartPulse} label="VDOT attuale" value={displayNumber(model.performance.vdot, 1)} detail={`Ceiling reale: ${displayNumber(model.performance.vdotCeiling, 1)}`} color="#22D3EE" />
              <MetricTile icon={Award} label="PB 5K" value={formatRaceTime(model.performance.pb5k)} detail={`Previsione attuale: ${model.predictions.current["5K"] ?? "N/D"}`} color="#C8FF2D" />
              <MetricTile icon={Timer} label="PB 10K" value={formatRaceTime(model.performance.pb10k)} detail={`Previsione attuale: ${model.predictions.current["10K"] ?? "N/D"}`} color="#A78BFA" />
              <MetricTile icon={Medal} label="PB mezza" value={formatRaceTime(model.performance.pbHalf)} detail={`Previsione attuale: ${model.predictions.current["Half Marathon"] ?? model.predictions.current["21K"] ?? "N/D"}`} color="#38BDF8" />
              <MetricTile icon={Gauge} label="CTL / ATL" value={`${displayNumber(model.performance.ctl, 1)} / ${displayNumber(model.performance.atl, 1)}`} detail={model.performance.cardiacDriftLabel} color="#FBBF24" />
            </div>
            <GlassPanel className="rounded-lg p-5 sm:p-6" accent="white">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Curva reale + potenziale</div>
                  <div className="mt-2 text-2xl font-black text-white">Evoluzione disponibile</div>
                </div>
                <div className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
                  {model.performance.trendStatus}
                </div>
              </div>
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={model.evolution}>
                    <defs>
                      <linearGradient id="scoreAreaV2" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#C8FF2D" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#C8FF2D" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area name="DNA score" type="monotone" dataKey="score" stroke="#C8FF2D" strokeWidth={3} fill="url(#scoreAreaV2)" connectNulls />
                    <Line name="VDOT" type="monotone" dataKey="vdot" stroke="#A78BFA" strokeWidth={2} connectNulls />
                    <Line name="Readiness" type="monotone" dataKey="readiness" stroke="#22D3EE" strokeWidth={2} dot={false} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassPanel>
          </div>
        </section>

        <section>
          <SectionHeader
            icon={Footprints}
            eyebrow="Biomechanics lab"
            title="Qualita del gesto e running dynamics"
            description="Le metriche sono medie delle corse con dati disponibili: ogni box mostra il campione usato e se il valore e positivo, nella norma o da migliorare."
          />
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
                color={metric.color}
                interpretation={metric.interpretation}
                suggestion={metric.suggestion}
                available={metric.available}
              />
            ))}
          </div>
          <BiomechanicsReferencePanel metrics={model.biomechanics} />
        </section>

        <section>
          <SectionHeader
            icon={ShieldCheck}
            eyebrow="Strengths / weaknesses / priorities"
            title="Cosa ti rende forte e cosa ti limita"
            description="Insight generati dal backend Runner DNA e rinfrescati con sync/import."
          />
          <div className="grid gap-5 lg:grid-cols-3">
            <GlassPanel className="rounded-lg p-6" accent="lime">
              <div className="mb-5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#C8FF2D]">
                <Sparkles className="h-4 w-4" />
                Punti di forza
              </div>
              <ul className="space-y-4">
                {model.diagnostics.strengths.map((item) => (
                  <li key={item} className="rounded-md border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">{item}</li>
                ))}
              </ul>
            </GlassPanel>

            <GlassPanel className="rounded-lg p-6" accent="rose">
              <div className="mb-5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-rose-300">
                <Zap className="h-4 w-4" />
                Punti deboli
              </div>
              <ul className="space-y-4">
                {model.diagnostics.weaknesses.map((item) => (
                  <li key={item} className="rounded-md border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">{item}</li>
                ))}
              </ul>
            </GlassPanel>

            <GlassPanel className="rounded-lg p-6" accent="cyan">
              <div className="mb-5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">
                <Dumbbell className="h-4 w-4" />
                Aree da migliorare
              </div>
              <ul className="space-y-4">
                {model.diagnostics.priorities.slice(0, 3).map((item, index) => (
                  <li key={item} className="rounded-md border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">
                    <span className="mr-2 font-black text-cyan-200">0{index + 1}</span>
                    {item}
                  </li>
                ))}
              </ul>
            </GlassPanel>
          </div>
        </section>

        <section id="coach-insights">
          <GlassPanel className="rounded-lg p-6 sm:p-8" accent="violet">
            <SectionHeader
              icon={BrainCircuit}
              eyebrow="Coach insights"
              title="Il verdetto del coach"
              description="La parte narrativa usa gli insight reali calcolati dal modello Runner DNA."
            />
            <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-6">
                <p className="text-xl leading-9 text-slate-100">{model.identity.coachVerdict}</p>
              </div>
              <div className="grid gap-3">
                {model.diagnostics.priorities.map((item, index) => (
                  <div key={item} className="flex gap-4 rounded-lg border border-white/10 bg-[#07090C] p-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#C8FF2D] text-sm font-black text-black">{index + 1}</div>
                    <p className="text-sm leading-6 text-slate-300">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </GlassPanel>
        </section>

        <section className="pb-8">
          <GlassPanel className="rounded-lg p-6" accent="lime">
            <div className="grid gap-5 lg:grid-cols-[260px_1fr] lg:items-center">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#C8FF2D]">Output finale reale</div>
                <div className="mt-3 text-4xl font-black text-white">{model.identity.rank.name}</div>
              </div>
              <p className="text-base leading-8 text-slate-300">
                Forza attuale {model.scores.overall}/100, margine di miglioramento {model.performance.improvementPotential}/100. {model.identity.unlockMessage}
              </p>
            </div>
          </GlassPanel>
        </section>
      </div>
    </main>
  );
}
