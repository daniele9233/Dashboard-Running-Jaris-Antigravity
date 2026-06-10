import { useEffect, useState } from "react";
import { Dna, RefreshCcw } from "lucide-react";
import { useRunnerDnaUiModel } from "../hooks/useRunnerDnaUiModel";
import { RunnerDnaLoading } from "./runner-dna/RunnerDnaLoading";

const ACCENT = "#C8FF2D";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
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

function parseTimeSecs(t: string): number {
  const parts = t.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + (parts[1] ?? 0);
}

function formatDelta(from: string, to: string): string {
  const diff = parseTimeSecs(from) - parseTimeSecs(to);
  if (diff <= 0) return "";
  const m = Math.floor(diff / 60), s = diff % 60;
  return `−${m}:${s.toString().padStart(2, "0")}`;
}

const DISTANCE_LABELS: Record<string, string> = {
  "5K": "5K",
  "10K": "10K",
  "HALF MARATHON": "Mezza",
  "MARATHON": "Maratona",
};
const DISTANCE_ORDER = ["5K", "10K", "HALF MARATHON", "MARATHON"];

const TREND_COLORS: Record<string, string> = {
  "In Forte Crescita": ACCENT,
  "In Crescita": "#86EFAC",
  "Stabile": "#FCD34D",
  "In Calo": "#F97316",
  "In Forte Regressione": "#EF4444",
};

// ─── MICRO LABEL ─────────────────────────────────────────────────────────────
function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">
      {children}
    </div>
  );
}

// ─── SCORE RING ──────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 150);
    return () => clearTimeout(t);
  }, []);

  const size = 210, sw = 3, r = (size - sw * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, score / 100));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 absolute inset-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={ACCENT} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={mounted ? offset : circ}
          style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-7xl font-extralight tracking-tighter text-white leading-none tabular-nums">
          {score}
        </span>
        <span className="mt-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">
          DNA Score
        </span>
      </div>
    </div>
  );
}

// ─── SCORE BAR ───────────────────────────────────────────────────────────────
function ScoreBar({
  label, score, delay, highlight,
}: {
  label: string; score: number; delay: number; highlight: boolean;
}) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFilled(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const bar = (
    <div className="h-px relative bg-white/[0.08]">
      <div
        className="absolute inset-y-0 left-0 -top-px h-[3px] rounded-full transition-all duration-1000 ease-out"
        style={{
          width: filled ? `${score}%` : "0%",
          backgroundColor: highlight ? ACCENT : "rgba(255,255,255,0.55)",
        }}
      />
    </div>
  );

  return (
    <div className="grid grid-cols-[1fr_44px] md:grid-cols-[minmax(110px,190px)_1fr_44px] items-center gap-x-5">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="hidden md:block">{bar}</div>
      <div
        className="text-right text-lg font-light tabular-nums leading-none"
        style={{ color: highlight ? ACCENT : "#fff" }}
      >
        {score}
      </div>
      <div className="col-span-2 mt-3 md:hidden">{bar}</div>
    </div>
  );
}

const BIOMECH_SHORT_LABELS: Record<string, string> = {
  cadence: "Cadenza",
  vertical_oscillation: "Osc. verticale",
  vertical_ratio: "Ratio verticale",
  ground_contact: "Contatto suolo",
  stride: "Falcata",
};

// ─── VERDICT DOT ─────────────────────────────────────────────────────────────
const VERDICT_DOT: Record<string, string> = {
  positivo: ACCENT,
  neutro: "#7DD3FC",
  "da migliorare": "#FBBF24",
  "non disponibile": "#475569",
};

// ─── MAIN ────────────────────────────────────────────────────────────────────
export function RunnerDnaView() {
  const { model, loading, refreshing, error, regenerate } = useRunnerDnaUiModel();

  if (loading || refreshing) return <RunnerDnaLoading />;

  if (error || !model) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 bg-[#030303] p-8 gap-4">
        <Dna className="w-10 h-10 text-slate-700" />
        <p className="text-slate-500 uppercase tracking-[0.25em] text-xs font-black text-center">
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
  const trendColor = TREND_COLORS[model.performance.trendStatus] ?? "#FCD34D";

  const scoreItems = [...model.scores.items];
  const maxScore = Math.max(...scoreItems.map((s) => s.score), 0);

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

  return (
    <div className="flex-1 overflow-y-auto bg-[#030303] min-h-0 custom-scrollbar">
      <div className="max-w-[1080px] mx-auto px-6 md:px-10 py-12 md:py-16">

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-14">
          <div className="flex items-center gap-3">
            <Dna className="w-4 h-4" style={{ color: ACCENT }} />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
              Runner DNA
            </span>
          </div>
          <button
            onClick={() => void regenerate()}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white hover:border-white/25 transition-colors disabled:opacity-40"
          >
            <RefreshCcw className="w-3 h-3" />
            Rigenera
          </button>
        </div>

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <section className="flex flex-col lg:flex-row items-center lg:items-start gap-12 lg:gap-16">
          <ScoreRing score={model.scores.overall} />

          <div className="flex-1 min-w-0 text-center lg:text-left">
            <MicroLabel>Identità atletica</MicroLabel>
            <h1 className="mt-4 text-5xl md:text-6xl font-extralight tracking-tighter text-white leading-none">
              {model.identity.rank.name}
            </h1>
            <p className="mt-5 text-sm leading-7 text-slate-400 max-w-xl mx-auto lg:mx-0">
              {model.identity.description}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-x-3 gap-y-2 text-[11px] font-black uppercase tracking-[0.18em]">
              <span style={{ color: trendColor }}>{model.performance.trendStatus}</span>
              <span className="text-slate-700">·</span>
              <span className="text-slate-400">Distanza ideale {model.performance.idealDistance}</span>
              {model.base.weeklyFrequency !== null && model.base.weeklyFrequency > 0 && (
                <>
                  <span className="text-slate-700">·</span>
                  <span className="text-slate-400">
                    {formatItalianDecimal(model.base.weeklyFrequency, 1)} uscite/sett
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="shrink-0 w-full lg:w-44 grid grid-cols-3 lg:grid-cols-1 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
            {[
              { label: "VDOT", value: vdot !== null ? formatItalianDecimal(vdot, 1) : "—", accent: true },
              { label: "Ceiling", value: ceiling !== null ? formatItalianDecimal(ceiling, 1) : "—", accent: false },
              { label: "PB 5K", value: model.performance.pb5k, accent: false },
            ].map(({ label, value, accent }) => (
              <div key={label} className="bg-[#050505] px-5 py-4 text-center lg:text-left">
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-600">{label}</div>
                <div
                  className="mt-1.5 text-2xl font-extralight tracking-tight tabular-nums"
                  style={{ color: accent ? ACCENT : "#fff" }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── DNA SCORES ─────────────────────────────────────────────────── */}
        <section className="mt-20">
          <MicroLabel>Profilo</MicroLabel>
          <div className="mt-8 space-y-7">
            {scoreItems.map((item, i) => (
              <ScoreBar
                key={item.key}
                label={item.label}
                score={item.score}
                delay={200 + i * 120}
                highlight={item.score === maxScore}
              />
            ))}
          </div>
        </section>

        {/* ── POTENZIALE ─────────────────────────────────────────────────── */}
        <section className="mt-20 grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <MicroLabel>Potenziale</MicroLabel>
            <div className="mt-8 flex items-baseline gap-3">
              <span className="text-5xl font-extralight tracking-tighter text-white tabular-nums">
                {potentialPct !== null ? Math.round(potentialPct) : "—"}
                <span className="text-2xl text-slate-500">%</span>
              </span>
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                attivato
              </span>
            </div>

            {vdot !== null && ceiling !== null && (
              <div className="mt-8">
                <div className="relative h-px bg-white/[0.08]">
                  <div
                    className="absolute inset-y-0 left-0 -top-px h-[3px] rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(4, potentialPct ?? 0))}%`,
                      backgroundColor: ACCENT,
                    }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                    style={{
                      left: `calc(${Math.min(100, Math.max(4, potentialPct ?? 0))}% - 4px)`,
                      backgroundColor: ACCENT,
                      boxShadow: `0 0 12px ${ACCENT}80`,
                    }}
                  />
                </div>
                <div className="mt-4 flex justify-between text-[11px] font-black uppercase tracking-[0.18em]">
                  <span className="text-slate-400">
                    Oggi <span className="text-white">{formatItalianDecimal(vdot, 1)}</span>
                  </span>
                  {vdotGain !== null && vdotGain > 0 && (
                    <span style={{ color: ACCENT }}>+{formatItalianDecimal(vdotGain, 1)}</span>
                  )}
                  <span className="text-slate-400">
                    Ceiling <span className="text-white">{formatItalianDecimal(ceiling, 1)}</span>
                  </span>
                </div>
              </div>
            )}

            <p className="mt-8 text-sm leading-7 text-slate-500 max-w-md">
              Il ceiling è il tetto fisiologico che il modello considera raggiungibile
              con il tuo profilo attuale di carico, efficienza e recupero.
            </p>
          </div>

          {predictions.length > 0 && (
            <div>
              <MicroLabel>Tempi raggiungibili</MicroLabel>
              <div className="mt-8 divide-y divide-white/[0.06]">
                {predictions.map((p) => (
                  <div key={p.dist} className="py-4 flex items-baseline justify-between gap-4">
                    <span className="w-20 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                      {p.label}
                    </span>
                    <span className="text-sm font-light text-slate-600 tabular-nums">
                      {p.currentTime ?? "—"}
                    </span>
                    <span className="flex-1 text-right text-xl font-extralight tracking-tight text-white tabular-nums">
                      {p.potentialTime}
                    </span>
                    <span className="w-16 text-right text-xs font-black tabular-nums" style={{ color: ACCENT }}>
                      {p.delta}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── COACH ──────────────────────────────────────────────────────── */}
        <section className="mt-20">
          <MicroLabel>Coach</MicroLabel>
          <p className="mt-8 text-xl md:text-2xl font-light leading-relaxed text-slate-200 max-w-3xl">
            {humanizeCoachText(model.identity.coachVerdict)}
          </p>

          <div className="mt-12 grid gap-10 md:grid-cols-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: ACCENT }}>
                Punti di forza
              </div>
              <ul className="mt-5 space-y-4">
                {strengths.map((s, i) => (
                  <li key={i} className="text-sm leading-6 text-slate-400">
                    {humanizeCoachText(s)}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-rose-400">
                Limiti
              </div>
              <ul className="mt-5 space-y-4">
                {weaknesses.map((w, i) => (
                  <li key={i} className="text-sm leading-6 text-slate-400">
                    {humanizeCoachText(w)}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-sky-300">
                Priorità
              </div>
              <ul className="mt-5 space-y-4">
                {priorities.map((p, i) => (
                  <li key={p} className="flex gap-3 text-sm leading-6 text-slate-400">
                    <span className="font-black text-slate-600 tabular-nums">0{i + 1}</span>
                    <span>{humanizeCoachText(p)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── DINAMICA DI CORSA ──────────────────────────────────────────── */}
        <section className="mt-20">
          <MicroLabel>Dinamica di corsa</MicroLabel>
          <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
            {model.biomechanics.map((m) => (
              <div key={m.key} className="bg-[#050505] px-5 py-5 last:odd:col-span-2 md:last:odd:col-span-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: VERDICT_DOT[m.verdict] ?? "#475569" }}
                  />
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-600 truncate">
                    {BIOMECH_SHORT_LABELS[m.key] ?? m.label}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-2xl font-extralight tracking-tight text-white tabular-nums">
                    {m.available ? m.displayValue : "—"}
                  </span>
                  {m.available && (
                    <span className="text-[10px] text-slate-600">{m.unit}</span>
                  )}
                </div>
                <div className="mt-2 text-[9px] text-slate-600 tracking-wide">
                  {m.available ? m.benchmark : "non disponibile"}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <footer className="mt-20 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[10px] tracking-[0.15em] uppercase text-slate-700 font-black">
            {model.freshness.label}
          </span>
          <span className="text-[10px] tracking-[0.15em] uppercase text-slate-700 font-black">
            Metic Lab
          </span>
        </footer>

      </div>
    </div>
  );
}
