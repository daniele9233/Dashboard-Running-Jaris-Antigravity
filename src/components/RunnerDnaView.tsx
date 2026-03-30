import React, { useEffect, useState } from "react";
import { getRunnerDna, clearRunnerDnaCache } from "../api";
import {
  Dna, BrainCircuit, Trophy, Zap, Target, TrendingUp,
  RefreshCcw, Activity, Heart, Timer, Gauge, Flame,
} from "lucide-react";

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

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export function RunnerDnaView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const load = () => {
    setLoading(true);
    setData(null);
    getRunnerDna()
      .then((res: any) => setData(res.dna))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try { await clearRunnerDnaCache(); } catch (_) {}
    setRegenerating(false);
    load();
  };

  if (loading) return <LoadingView />;

  if (!data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 bg-[#030303] p-8 gap-4">
        <Dna className="w-12 h-12 text-gray-700" />
        <p className="text-gray-500 uppercase tracking-widest text-sm">
          Dati insufficienti — effettua almeno 5 corse per sbloccare il tuo DNA
        </p>
      </div>
    );
  }

  const {
    profile, stats, performance, consistency, efficiency,
    current_state, potential, ai_coach, dna_scores,
  } = data;

  const potentialGap = (potential.vdot_ceiling - profile.vdot_current).toFixed(1);

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

        {/* ══ DNA STRANDS ══════════════════════════════════════════════════ */}
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
              sublabel="Frequenza allenamento — 4 run/week = 100"
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

        {/* ══ CORE METRICS ═════════════════════════════════════════════════ */}
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

        {/* ══ ZONE DISTRIBUTION ════════════════════════════════════════════ */}
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
              {ai_coach.coach_verdict}
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
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strengths */}
          <div className="bg-[#080808] border border-[#C0FF00]/15 rounded-3xl p-8">
            <div className="flex items-center gap-2 mb-6">
              <Trophy className="w-4 h-4 text-[#C0FF00]" />
              <span className="text-[9px] font-black tracking-[0.35em] text-[#C0FF00] uppercase">
                Punti di Forza
              </span>
            </div>
            <ul className="space-y-4">
              {(ai_coach.strengths ?? []).map((s: string, i: number) => (
                <li key={i} className="flex gap-3 items-start">
                  <div className="w-5 h-5 rounded-full bg-[#C0FF00]/10 border border-[#C0FF00]/25 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] font-black text-[#C0FF00]">✓</span>
                  </div>
                  <span className="text-sm text-gray-300 leading-relaxed">{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Gaps */}
          <div className="bg-[#080808] border border-rose-500/15 rounded-3xl p-8">
            <div className="flex items-center gap-2 mb-6">
              <Zap className="w-4 h-4 text-rose-500" />
              <span className="text-[9px] font-black tracking-[0.35em] text-rose-500 uppercase">
                Lacune Critiche
              </span>
            </div>
            <ul className="space-y-4">
              {(ai_coach.gaps ?? []).map((g: string, i: number) => (
                <li key={i} className="flex gap-3 items-start">
                  <div className="w-5 h-5 rounded-full bg-rose-500/10 border border-rose-500/25 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] font-black text-rose-500">!</span>
                  </div>
                  <span className="text-sm text-gray-300 leading-relaxed">{g}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ══ POTENTIAL ════════════════════════════════════════════════════ */}
        <section className="bg-[#080808] border border-white/[0.05] rounded-3xl p-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 pb-6 border-b border-white/[0.05]">
            <div>
              <div className="text-[9px] font-black tracking-[0.35em] text-gray-600 mb-2 uppercase">
                Potenziale Biologico Assoluto
              </div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-6xl font-black text-[#C0FF00] leading-none">
                  {potential.vdot_ceiling}
                </span>
                <span className="text-gray-500 font-black text-lg">VDOT CEILING</span>
                <span className="text-sm text-gray-600">
                  +{potentialGap} punti da sbloccare
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-black tracking-[0.25em] text-gray-600 mb-1">
                POTENZIALE ATTIVATO
              </div>
              <div className="text-5xl font-black text-white">{potential.potential_pct}%</div>
            </div>
          </div>

          {/* Potential % bar */}
          <div className="mb-8 space-y-2">
            <div className="text-[9px] font-black tracking-widest text-gray-600">
              ATTUALE ({profile.vdot_current}) → CEILING ({potential.vdot_ceiling})
            </div>
            <div className="relative h-3 bg-[#111] rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${potential.potential_pct}%`,
                  background: "linear-gradient(90deg, #C0FF00, #00FFAA)",
                  boxShadow: "0 0 20px rgba(192,255,0,0.4)",
                }}
              />
            </div>
          </div>

          {/* Race predictions table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="text-left text-[9px] font-black tracking-[0.25em] text-gray-600 pb-3 uppercase">Gara</th>
                  <th className="text-right text-[9px] font-black tracking-[0.25em] text-gray-500 pb-3 uppercase">Attuale</th>
                  <th className="text-right text-[9px] font-black tracking-[0.25em] text-[#C0FF00] pb-3 uppercase">Potenziale</th>
                  <th className="text-right text-[9px] font-black tracking-[0.25em] text-gray-600 pb-3 uppercase">Guadagno</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.025]">
                {Object.entries(potential.predictions ?? {}).map(([dist, potTime]) => {
                  const curTime = potential.current_predictions?.[dist] as string | undefined;
                  const delta = curTime && potTime ? formatDelta(curTime, potTime as string) : "";
                  return (
                    <tr key={dist} className="hover:bg-white/[0.015] transition-colors group">
                      <td className="py-4 font-black text-white tracking-widest uppercase group-hover:text-[#C0FF00] transition-colors">
                        {dist}
                      </td>
                      <td className="py-4 text-right font-mono text-gray-500 tabular-nums">
                        {curTime ?? "—"}
                      </td>
                      <td className="py-4 text-right font-mono font-black text-[#C0FF00] tabular-nums text-lg">
                        {potTime as string}
                      </td>
                      <td className="py-4 text-right text-sm font-black text-emerald-400 tabular-nums">
                        {delta}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ══ UNLOCK + REGENERATE ══════════════════════════════════════════ */}
        <section className="relative bg-gradient-to-r from-[#C0FF00]/[0.04] via-transparent to-transparent border border-[#C0FF00]/15 rounded-3xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-[#C0FF00]" />
              <span className="text-[9px] font-black tracking-[0.35em] text-[#C0FF00] uppercase">
                Come sbloccare il tuo potenziale biologico
              </span>
            </div>
            <p className="text-gray-300 leading-relaxed max-w-2xl">{ai_coach.unlock_message}</p>
          </div>

          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="shrink-0 flex items-center gap-2 px-6 py-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/15 hover:border-white/25 rounded-2xl text-sm font-black tracking-widest text-white uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {regenerating
              ? <Dna className="w-4 h-4 animate-spin" />
              : <RefreshCcw className="w-4 h-4" />}
            {regenerating ? "Analizzando..." : "Rigenera DNA"}
          </button>
        </section>

      </div>
    </div>
  );
}
