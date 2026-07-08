import { useEffect, useState } from "react";
import { Dna, RefreshCcw, BrainCircuit, Medal, TrendingUp, Footprints, ChevronRight } from "lucide-react";
import { useRunnerDnaUiModel } from "../hooks/useRunnerDnaUiModel";
import { RANK_RULES } from "../utils/runnerDnaModel";
import {
  MONO, formatItalianDecimal, humanizeCoachText, formatDelta,
  DISTANCE_LABELS, DISTANCE_ORDER, TREND_COLORS, BIOMECH_SHORT_LABELS,
} from "./runner-dna/dnaShared";

// ─────────────────────────────────────────────────────────────────────────────
// RUNNER DNA — "ATHLETE CARD"
// Carta atleta stile gaming: card OVR con bordo gradiente, scala livelli,
// medagliere crono, scouting report. Layout scannabile a due colonne.
// (Ex variante V2, promossa a versione ufficiale.)
// ─────────────────────────────────────────────────────────────────────────────

const STAT_ABBR: Record<string, string> = {
  aerobic_engine: "MOT",
  consistency: "COS",
  load_capacity: "CAR",
  efficiency: "EFF",
  biomechanics: "BIO",
};

const CARD =
  "rounded-3xl p-6 backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50";

// ─── DNA HELIX SVG (loading storico) ─────────────────────────────────────────
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

// ─── LOADING (animazione storica: elica + dots) ──────────────────────────────
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

// ─── DONUT GAUGE ─────────────────────────────────────────────────────────────
function DonutGauge({ pct, size = 140 }: { pct: number; size?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 250);
    return () => clearTimeout(t);
  }, []);

  const sw = 10, r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, pct / 100));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 absolute inset-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="#C0FF00" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={mounted ? offset : circ}
          style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black tabular-nums text-white" style={{ fontFamily: MONO }}>
          {Math.round(pct)}<span className="text-sm text-[#555]">%</span>
        </span>
        <span className="text-[8px] font-black tracking-[0.25em] uppercase text-[#555] mt-1">Attivato</span>
      </div>
    </div>
  );
}

// ─── STAT ROW (stile carta FUT) ──────────────────────────────────────────────
function CardStatRow({ abbr, label, score, color, delay }: {
  abbr: string; label: string; score: number; color: string; delay: number;
}) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFilled(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className="flex items-center gap-3" title={label}>
      <span className="w-12 text-2xl font-black tabular-nums leading-none" style={{ fontFamily: MONO, color }}>
        {score}
      </span>
      <span className="w-12 text-[10px] font-black tracking-[0.2em] text-gray-400">{abbr}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: filled ? `${score}%` : "0%", background: color }}
        />
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export function RunnerDnaView() {
  const { model, loading, refreshing, error, regenerate } = useRunnerDnaUiModel();

  if (loading || refreshing) return <LoadingView />;

  if (error || !model) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 bg-[#0A0A0A] p-8 gap-4">
        <Dna className="w-12 h-12 text-gray-700" />
        <p className="text-gray-500 uppercase tracking-widest text-sm font-black text-center">
          Dati insufficienti — effettua almeno 5 corse per sbloccare il tuo DNA
        </p>
      </div>
    );
  }

  const vdot = model.performance.vdot;
  const ceiling = model.performance.vdotCeiling;
  const potentialPct = model.performance.potentialPct;
  const vdotGain = vdot !== null && ceiling !== null
    ? Math.max(0, Math.round((ceiling - vdot) * 10) / 10)
    : null;
  const trendColor = TREND_COLORS[model.performance.trendStatus] ?? "#F59E0B";
  const overall = model.scores.overall;

  // Scala livelli: dal basso verso l'alto, evidenzia rank attuale + prossimo
  const ladder = [...RANK_RULES].reverse(); // dal min più basso al più alto
  const currentRankName = model.identity.rank.name;
  const nextRank = [...RANK_RULES].reverse().find((r) => r.min > overall) ?? null;
  const gapToNext = nextRank ? Math.max(0, nextRank.min - overall) : 0;

  const predictions = DISTANCE_ORDER
    .map((dist) => {
      const potentialTime = model.predictions.potential[dist];
      if (!potentialTime) return null;
      const currentTime = model.predictions.current[dist] ?? null;
      return {
        dist,
        label: DISTANCE_LABELS[dist] ?? dist,
        currentTime,
        potentialTime,
        delta: currentTime ? formatDelta(currentTime, potentialTime) : "",
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const strengths = model.diagnostics.strengths.slice(0, 3);
  const weaknesses = model.diagnostics.weaknesses.slice(0, 3);
  const priorities = model.diagnostics.priorities.slice(0, 3);
  const unlockPlan = model.diagnostics.unlockPlan;

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] text-white p-4 md:p-6 lg:p-10 min-h-0 custom-scrollbar">
      <div className="max-w-[1500px] mx-auto space-y-5 md:space-y-6">

        {/* ── HEADER ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter text-white uppercase italic">
              Runner <span className="text-[#C0FF00]">DNA</span>
            </h1>
            <p className="text-gray-600 text-[10px] font-black tracking-[0.3em] uppercase mt-2">
              Carta atleta · scouting report
            </p>
          </div>
          <button
            onClick={() => void regenerate()}
            disabled={refreshing}
            className="flex items-center gap-2 px-5 py-3 bg-[#0D0D0D] border border-[#1E1E1E] rounded-2xl text-[10px] font-black tracking-widest uppercase text-gray-400 hover:text-[#C0FF00] hover:border-[#C0FF00]/30 transition-all shadow-2xl disabled:opacity-40 self-start lg:self-auto"
          >
            <RefreshCcw className="w-4 h-4" />
            Rigenera carta
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 md:gap-6 items-start">

          {/* ── COLONNA SINISTRA: CARTA ATLETA ── */}
          <div className="space-y-5">
            <div className="rounded-3xl p-[1.5px] bg-gradient-to-b from-[#C0FF00]/70 via-[#22D3EE]/25 to-transparent shadow-[0_8px_40px_rgba(192,255,0,0.12)]">
              <div className="rounded-[22px] bg-gradient-to-b from-[#10130A] via-[#0B0D08] to-[#080808] p-6 relative overflow-hidden">
                <div aria-hidden className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#C0FF00]/[0.07] blur-3xl" />

                {/* OVR */}
                <div className="relative flex items-start justify-between">
                  <div>
                    <span className="text-7xl font-black italic leading-none tabular-nums text-[#C0FF00]" style={{ fontFamily: MONO }}>
                      {overall}
                    </span>
                    <div className="mt-1 text-[10px] font-black tracking-[0.3em] uppercase text-gray-500">
                      DNA Overall
                    </div>
                  </div>
                  <div className="text-right">
                    <Dna className="w-7 h-7 text-[#C0FF00]/70 ml-auto" />
                    <div className="mt-2 text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: trendColor }}>
                      {model.performance.trendStatus}
                    </div>
                  </div>
                </div>

                <div className="relative mt-4 pb-4 border-b border-white/[0.08]">
                  <div className="text-xl font-black uppercase tracking-tight text-white">
                    {currentRankName}
                  </div>
                  <div className="text-[10px] font-black tracking-[0.18em] uppercase text-gray-500 mt-1">
                    {model.identity.archetype} · {model.performance.idealDistance}
                  </div>
                </div>

                {/* Stats */}
                <div className="relative mt-5 space-y-3.5">
                  {model.scores.items.map((item, i) => (
                    <CardStatRow
                      key={item.key}
                      abbr={STAT_ABBR[item.key] ?? item.key.slice(0, 3).toUpperCase()}
                      label={item.label}
                      score={item.score}
                      color={item.color}
                      delay={200 + i * 130}
                    />
                  ))}
                </div>

                {/* Footer card */}
                <div className="relative mt-6 pt-4 border-t border-white/[0.08] grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "VDOT", value: vdot !== null ? vdot.toFixed(1) : "—", color: "#22D3EE" },
                    { label: "Ceiling", value: ceiling !== null ? ceiling.toFixed(1) : "—", color: "#A78BFA" },
                    { label: "PB 5K", value: model.performance.pb5k, color: "#fff" },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div className="text-base font-black tabular-nums" style={{ fontFamily: MONO, color }}>{value}</div>
                      <div className="text-[8px] font-black tracking-[0.2em] uppercase text-gray-600 mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Potenziale + come sbloccarlo */}
            <div className={CARD}>
              <div className="flex items-center gap-5">
                {potentialPct !== null ? <DonutGauge pct={potentialPct} /> : null}
                <div className="min-w-0">
                  <div className="text-[10px] font-black tracking-widest uppercase text-[#A0A0A0]">Potenziale</div>
                  {vdotGain !== null && vdotGain > 0 && (
                    <div className="mt-2 text-2xl font-black tabular-nums text-[#C0FF00]" style={{ fontFamily: MONO }}>
                      +{formatItalianDecimal(vdotGain, 1)} <span className="text-xs text-gray-500">VDOT</span>
                    </div>
                  )}
                  <p className="mt-2 text-[11px] leading-4 text-gray-500">
                    Margine ancora sbloccabile rispetto al tetto fisiologico stimato ({ceiling !== null ? ceiling.toFixed(1) : "—"}).
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-5 border-t border-white/[0.06]">
                <div className="text-[10px] font-black tracking-widest uppercase text-[#C0FF00] mb-3">
                  Come sbloccarlo
                </div>
                {unlockPlan ? (
                  <>
                    {/* ETA: quando arrivi al tetto se segui il piano */}
                    <div className="mb-3 rounded-xl border border-[#C0FF00]/25 bg-[#C0FF00]/[0.06] px-3.5 py-2.5">
                      <div className="text-[9px] font-black tracking-[0.2em] uppercase text-gray-500">Traguardo stimato</div>
                      <div className="text-[12px] font-black text-white mt-0.5">
                        VDOT {unlockPlan.targetVdot.toFixed(1)} in{" "}
                        <span className="text-[#C0FF00]">{unlockPlan.etaWeeksMin}-{unlockPlan.etaWeeksMax} settimane</span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5" style={{ fontFamily: MONO }}>
                        ≈ {unlockPlan.etaLabel} · seguendo il piano qui sotto
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {unlockPlan.steps.map((step, index) => (
                        <div key={step.title} className="flex gap-3 items-start rounded-xl bg-white/[0.03] border border-white/[0.05] px-3.5 py-2.5">
                          <span className="text-base font-black tabular-nums text-[#C0FF00] leading-5" style={{ fontFamily: MONO }}>
                            0{index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-black leading-4 text-white">{step.title}</p>
                            <p className="text-[11px] leading-5 text-gray-400 mt-1">{step.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="space-y-2.5">
                    {priorities.map((item, index) => (
                      <div key={item} className="flex gap-3 items-start rounded-xl bg-white/[0.03] border border-white/[0.05] px-3.5 py-2.5">
                        <span className="text-base font-black tabular-nums text-[#C0FF00] leading-5" style={{ fontFamily: MONO }}>
                          0{index + 1}
                        </span>
                        <p className="text-[11px] leading-5 text-gray-300">{humanizeCoachText(item)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── COLONNA DESTRA ── */}
          <div className="space-y-5 md:space-y-6 min-w-0">

            {/* Scala livelli */}
            <div className={CARD}>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h3 className="text-white text-base font-black tracking-tight flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#C0FF00]" />
                    Scala Livelli
                  </h3>
                  <p className="text-[#A0A0A0] text-[10px] tracking-widest uppercase mt-1">
                    {nextRank
                      ? `${gapToNext} punti al livello ${nextRank.name}`
                      : "Livello massimo raggiunto"}
                  </p>
                </div>
              </div>

              <div className="relative">
                <div className="flex h-3 rounded-full overflow-hidden bg-white/[0.05]">
                  {ladder.map((rank, i) => {
                    const next = ladder[i + 1];
                    const width = (next ? next.min : 100) - rank.min;
                    const reached = overall >= rank.min;
                    return (
                      <div
                        key={rank.name}
                        className="h-full border-r border-black/60 last:border-r-0 transition-colors"
                        style={{
                          width: `${width}%`,
                          background: reached ? "linear-gradient(90deg, #5a7a00, #C0FF00)" : "rgba(255,255,255,0.05)",
                        }}
                        title={`${rank.name} · da ${rank.min}`}
                      />
                    );
                  })}
                </div>
                <div
                  className="absolute -top-1.5 w-6 h-6 rounded-full bg-[#C0FF00] border-4 border-[#0A0A0A] shadow-[0_0_14px_rgba(192,255,0,0.6)] -translate-x-1/2"
                  style={{ left: `${Math.min(99, Math.max(1, overall))}%` }}
                  title={`Tu: ${overall}/100`}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {ladder.map((rank) => {
                  const active = rank.name === currentRankName;
                  return (
                    <span
                      key={rank.name}
                      className="px-2.5 py-1 rounded-lg text-[9px] font-black tracking-[0.12em] uppercase border"
                      style={{
                        color: active ? "#C0FF00" : overall >= rank.min ? "#9aa" : "#555",
                        borderColor: active ? "#C0FF0050" : "rgba(255,255,255,0.07)",
                        background: active ? "#C0FF0012" : "transparent",
                      }}
                    >
                      {rank.name} <span className="text-[#555] normal-case">·{rank.min}</span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Medagliere crono */}
            <div className={CARD}>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h3 className="text-white text-base font-black tracking-tight flex items-center gap-2">
                    <Medal className="w-4 h-4 text-[#C0FF00]" />
                    Obiettivi Crono
                  </h3>
                  <p className="text-[#A0A0A0] text-[10px] tracking-widest uppercase mt-1">
                    Cosa vale la tua carta al ceiling
                  </p>
                </div>
                {vdotGain !== null && vdotGain > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#C0FF00]/10 border border-[#C0FF00]/20 shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#C0FF00]" />
                    <span className="text-[#C0FF00] text-[10px] font-black tracking-widest uppercase">
                      +{formatItalianDecimal(vdotGain, 1)} VDOT
                    </span>
                  </div>
                )}
              </div>

              {predictions.length === 0 ? (
                <p className="text-[#444] text-xs font-black tracking-widest uppercase text-center py-8">Dati insufficienti</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {predictions.map((p) => (
                    <div key={p.dist} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 hover:border-[#C0FF00]/25 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black tracking-[0.2em] uppercase text-gray-500">{p.label}</span>
                        {p.delta && (
                          <span className="text-[10px] font-black tabular-nums text-[#34D399]" style={{ fontFamily: MONO }}>
                            {p.delta}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm font-bold tabular-nums text-[#555]" style={{ fontFamily: MONO }}>
                          {p.currentTime ?? "—"}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-[#444] shrink-0" />
                        <span className="text-2xl font-black tabular-nums text-[#C0FF00]" style={{ fontFamily: MONO }}>
                          {p.potentialTime}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scouting report */}
            <div className={CARD}>
              <div className="mb-5">
                <h3 className="text-white text-base font-black tracking-tight flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-[#C0FF00]" />
                  Scouting Report
                </h3>
                <p className="text-[#A0A0A0] text-[10px] tracking-widest uppercase mt-1">Verdetto coach + piano</p>
              </div>

              <p className="text-sm leading-relaxed text-gray-300">
                {humanizeCoachText(model.identity.coachVerdict)}
              </p>

              <div className="grid gap-6 md:grid-cols-2 pt-5 mt-5 border-t border-white/[0.06]">
                <div>
                  <div className="text-[10px] font-black tracking-widest uppercase text-[#C0FF00] mb-3">
                    Punti di forza
                  </div>
                  <div className="space-y-2.5">
                    {strengths.map((s, i) => (
                      <div key={`s-${i}`} className="flex gap-3 items-start text-xs leading-5 text-[#A0A0A0]">
                        <span className="w-4 shrink-0 text-center font-bold text-[#C0FF00]" style={{ fontFamily: MONO }}>+</span>
                        {humanizeCoachText(s)}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-black tracking-widest uppercase text-[#F43F5E] mb-3">
                    Limiti
                  </div>
                  <div className="space-y-2.5">
                    {weaknesses.map((w, i) => (
                      <div key={`w-${i}`} className="flex gap-3 items-start text-xs leading-5 text-[#A0A0A0]">
                        <span className="w-4 shrink-0 text-center font-bold text-[#F43F5E]" style={{ fontFamily: MONO }}>−</span>
                        {humanizeCoachText(w)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Dinamica */}
            <div className={CARD}>
              <div className="mb-5">
                <h3 className="text-white text-base font-black tracking-tight flex items-center gap-2">
                  <Footprints className="w-4 h-4 text-[#C0FF00]" />
                  Dinamica di Corsa
                </h3>
                <p className="text-[#A0A0A0] text-[10px] tracking-widest uppercase mt-1">Medie reali Garmin</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-5">
                {model.biomechanics.map((m) => {
                  const color = m.available ? m.color : "#475569";
                  return (
                    <div key={m.key} className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                        <span className="text-[9px] font-black tracking-[0.16em] uppercase text-gray-500 truncate">
                          {BIOMECH_SHORT_LABELS[m.key] ?? m.label}
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-xl font-black tabular-nums text-white" style={{ fontFamily: MONO }}>
                          {m.available ? m.displayValue : "—"}
                        </span>
                        {m.available && <span className="text-[9px] font-bold text-[#555]">{m.unit}</span>}
                      </div>
                      <div className="text-[9px] text-[#555] mt-1 tracking-wider truncate">
                        {m.available ? m.benchmark : "non disponibile"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1 pb-4">
          <span className="text-[9px] font-black tracking-widest uppercase text-[#444]">{model.freshness.label}</span>
          <span className="text-[9px] font-black tracking-widest uppercase text-[#444]">Metic Lab · Carta Atleta</span>
        </div>
      </div>
    </div>
  );
}
