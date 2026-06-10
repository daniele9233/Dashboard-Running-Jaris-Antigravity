import { useEffect, useState } from "react";
import { Dna, RefreshCcw, BrainCircuit, Trophy, Zap, Target, Footprints } from "lucide-react";
import { useRunnerDnaUiModel } from "../hooks/useRunnerDnaUiModel";
import { RunnerDnaLoading } from "./runner-dna/RunnerDnaLoading";

const MONO = "JetBrains Mono, monospace";

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
  return `-${m}:${s.toString().padStart(2, "0")}`;
}

const DISTANCE_LABELS: Record<string, string> = {
  "5K": "5K",
  "10K": "10K",
  "HALF MARATHON": "MEZZA",
  "MARATHON": "MARATONA",
};
const DISTANCE_ORDER = ["5K", "10K", "HALF MARATHON", "MARATHON"];

const TREND_COLORS: Record<string, string> = {
  "In Forte Crescita": "#C0FF00",
  "In Crescita": "#34D399",
  "Stabile": "#F59E0B",
  "In Calo": "#F97316",
  "In Forte Regressione": "#F43F5E",
};

const BIOMECH_SHORT_LABELS: Record<string, string> = {
  cadence: "Cadenza",
  vertical_oscillation: "Osc. verticale",
  vertical_ratio: "Ratio verticale",
  ground_contact: "Contatto suolo",
  stride: "Falcata",
};

// ─── SHARED UI (stile Carico & Forma) ────────────────────────────────────────
const CARD =
  "rounded-3xl p-6 backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50";

function CardHeader({
  title, subtitle, icon: Icon, right,
}: {
  title: string; subtitle: string;
  icon?: React.ComponentType<{ className?: string }>;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
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

function KpiTile({
  label, value, suffix, color, delta,
}: {
  label: string; value: string; suffix?: string; color: string; delta?: string;
}) {
  return (
    <div
      className="rounded-2xl px-4 py-3 flex flex-col gap-0.5"
      style={{ background: `${color}10`, border: `1px solid ${color}25` }}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black tabular-nums" style={{ color, fontFamily: MONO }}>
          {value}
        </span>
        {suffix && <span className="text-[10px] font-black text-[#555]">{suffix}</span>}
        {delta && (
          <span className="text-[10px] font-black tabular-nums text-[#34D399]">{delta}</span>
        )}
      </div>
      <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: `${color}99` }}>
        {label}
      </span>
    </div>
  );
}

function StatCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[#555] text-[9px] font-black tracking-widest uppercase">{label}</span>
      <span
        className="text-lg font-black tabular-nums leading-none"
        style={{ fontFamily: MONO, color: accent ?? "#fff" }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── SCORE BAR (stile Zone di Passo) ─────────────────────────────────────────
function ScoreBarRow({
  label, status, score, color, isMax, delay,
}: {
  label: string; status: string; score: number; color: string; isMax: boolean; delay: number;
}) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFilled(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className="flex items-center gap-3">
      <div className="w-28 sm:w-40 shrink-0">
        <div className="text-[10px] font-black tracking-widest uppercase truncate" style={{ color }}>
          {label}
        </div>
        <div className="text-[9px] text-[#555] truncate">{status}</div>
      </div>
      <div className="flex-1 h-2.5 bg-[#111] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: filled ? `${score}%` : "0%",
            background: color,
            boxShadow: isMax ? `0 0 8px ${color}55` : "none",
          }}
        />
      </div>
      <div className="w-14 text-right shrink-0">
        <span className="text-white text-sm font-black tabular-nums" style={{ fontFamily: MONO }}>
          {score}<span className="text-[#555] text-[10px]">/100</span>
        </span>
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export function RunnerDnaView() {
  const { model, loading, refreshing, error, regenerate } = useRunnerDnaUiModel();

  if (loading || refreshing) return <RunnerDnaLoading />;

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

  const scoreItems = model.scores.items;
  const maxScore = Math.max(...scoreItems.map((s) => s.score), 0);
  const strongest = scoreItems.find((s) => s.score === maxScore) ?? null;
  const weakest = scoreItems.length
    ? scoreItems.reduce((min, s) => (s.score < min.score ? s : min), scoreItems[0])
    : null;

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
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] text-white p-4 md:p-6 lg:p-10 min-h-0 custom-scrollbar">
      <div className="max-w-[1800px] mx-auto space-y-5 md:space-y-6">

        {/* ── HEADER ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter text-white uppercase italic">
              Runner <span className="text-[#C0FF00]">DNA</span>
            </h1>
            <p className="text-gray-600 text-[10px] font-black tracking-[0.3em] uppercase mt-2">
              Profilo fisiologico calcolato dai tuoi dati reali
            </p>
          </div>
          <button
            onClick={() => void regenerate()}
            disabled={refreshing}
            className="flex items-center gap-2 px-5 py-3 bg-[#0D0D0D] border border-[#1E1E1E] rounded-2xl text-[10px] font-black tracking-widest uppercase text-gray-400 hover:text-[#C0FF00] hover:border-[#C0FF00]/30 transition-all shadow-2xl disabled:opacity-40 self-start lg:self-auto"
          >
            <RefreshCcw className="w-4 h-4" />
            Rigenera DNA
          </button>
        </div>

        {/* ── IDENTITÀ ATLETICA ── */}
        <div className={CARD}>
          <CardHeader
            title="Identità Atletica"
            subtitle={model.identity.archetype}
            icon={Dna}
            right={<PillBadge label={model.performance.trendStatus} color={trendColor} />}
          />

          <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,560px)] lg:items-center">
            <div>
              <div className="text-2xl md:text-3xl font-black tracking-tight text-white">
                {model.identity.rank.name}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#A0A0A0] max-w-2xl">
                {model.identity.description}
              </p>
              <div className="flex gap-3 mt-4 text-[10px] text-[#555] font-semibold tracking-wider flex-wrap">
                <span className="text-[#888]">Distanza ideale {model.performance.idealDistance}</span>
                {model.base.weeklyFrequency !== null && model.base.weeklyFrequency > 0 && (
                  <>
                    <span>·</span>
                    <span>{formatItalianDecimal(model.base.weeklyFrequency, 1)} uscite/sett.</span>
                  </>
                )}
                <span>·</span>
                <span>PB 5K {model.performance.pb5k}</span>
                <span>·</span>
                <span>PB 10K {model.performance.pb10k}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiTile label="DNA Score" value={String(model.scores.overall)} suffix="/100" color="#C0FF00" />
              <KpiTile label="VDOT" value={vdot !== null ? vdot.toFixed(1) : "—"} color="#22D3EE" />
              <KpiTile label="Ceiling" value={ceiling !== null ? ceiling.toFixed(1) : "—"} color="#A78BFA" />
              <KpiTile
                label="Attivato"
                value={potentialPct !== null ? `${Math.round(potentialPct)}` : "—"}
                suffix="%"
                color="#F97316"
              />
            </div>
          </div>
        </div>

        {/* ── PROFILO DNA + TEMPI ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">

          <div className={CARD}>
            <CardHeader
              title="Profilo DNA"
              subtitle="5 dimensioni · score 0-100"
              icon={Trophy}
              right={strongest ? <PillBadge label={`Top · ${strongest.label}`} color={strongest.color} /> : undefined}
            />
            <div className="space-y-4">
              {scoreItems.map((item, i) => (
                <ScoreBarRow
                  key={item.key}
                  label={item.label}
                  status={item.status}
                  score={item.score}
                  color={item.color}
                  isMax={item.score === maxScore}
                  delay={150 + i * 120}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4 pt-5 mt-6 border-t border-white/[0.06]">
              <StatCell label="Più forte" value={strongest?.label ?? "—"} accent={strongest?.color} />
              <StatCell label="Da costruire" value={weakest?.label ?? "—"} accent={weakest?.color} />
              <StatCell label="Proiezione" value={`${model.scores.projected}/100`} accent="#C0FF00" />
            </div>
          </div>

          <div className={CARD + " flex flex-col"}>
            <CardHeader
              title="Tempi Raggiungibili"
              subtitle="Attuale → potenziale al ceiling"
              icon={Target}
              right={vdotGain !== null && vdotGain > 0
                ? <PillBadge label={`+${formatItalianDecimal(vdotGain, 1)} VDOT`} />
                : undefined}
            />
            {predictions.length === 0 ? (
              <div className="flex-1 flex items-center justify-center min-h-[120px]">
                <span className="text-[#444] text-xs font-black tracking-widest uppercase">Dati insufficienti</span>
              </div>
            ) : (
              <div className="flex-1 space-y-3">
                {predictions.map((p) => (
                  <div
                    key={p.dist}
                    className="flex items-center gap-3 rounded-2xl bg-white/[0.03] border border-white/[0.05] px-4 py-3"
                  >
                    <span className="w-20 text-[10px] font-black tracking-widest text-[#888] uppercase shrink-0">
                      {p.label}
                    </span>
                    <span className="flex-1 text-right text-sm font-black tabular-nums text-[#555]" style={{ fontFamily: MONO }}>
                      {p.currentTime ?? "—"}
                    </span>
                    <span className="text-[#444] text-xs shrink-0">→</span>
                    <span className="w-20 text-right text-lg font-black tabular-nums text-[#C0FF00]" style={{ fontFamily: MONO }}>
                      {p.potentialTime}
                    </span>
                    <span className="w-14 text-right text-[11px] font-black tabular-nums text-[#34D399] shrink-0" style={{ fontFamily: MONO }}>
                      {p.delta}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 pt-5 mt-6 border-t border-white/[0.06]">
              <StatCell
                label="VDOT oggi"
                value={vdot !== null ? vdot.toFixed(1) : "—"}
                accent="#22D3EE"
              />
              <StatCell
                label="Ceiling"
                value={ceiling !== null ? ceiling.toFixed(1) : "—"}
                accent="#A78BFA"
              />
              <StatCell
                label="Attivato"
                value={potentialPct !== null ? `${Math.round(potentialPct)}%` : "—"}
                accent="#F97316"
              />
            </div>
          </div>
        </div>

        {/* ── COACH + PRIORITÀ ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">

          <div className={CARD}>
            <CardHeader
              title="Verdetto Coach"
              subtitle="AI analysis sul tuo profilo"
              icon={BrainCircuit}
            />
            <p className="text-sm leading-relaxed text-gray-300">
              {humanizeCoachText(model.identity.coachVerdict)}
            </p>

            <div className="grid gap-6 sm:grid-cols-2 pt-5 mt-6 border-t border-white/[0.06]">
              <div>
                <div className="text-[10px] font-black tracking-widest uppercase text-[#C0FF00] mb-3">
                  Punti di forza
                </div>
                <ul className="space-y-2.5">
                  {strengths.map((s, i) => (
                    <li key={i} className="flex gap-2.5 items-start text-xs leading-5 text-[#A0A0A0]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C0FF00] shrink-0 mt-1.5" />
                      {humanizeCoachText(s)}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[10px] font-black tracking-widest uppercase text-[#F43F5E] mb-3">
                  Limiti
                </div>
                <ul className="space-y-2.5">
                  {weaknesses.map((w, i) => (
                    <li key={i} className="flex gap-2.5 items-start text-xs leading-5 text-[#A0A0A0]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F43F5E] shrink-0 mt-1.5" />
                      {humanizeCoachText(w)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className={CARD + " flex flex-col"}>
            <CardHeader
              title="Priorità di Allenamento"
              subtitle="Dove guadagni di più adesso"
              icon={Zap}
            />
            <div className="flex-1 space-y-3">
              {priorities.map((item, index) => (
                <div
                  key={item}
                  className="flex gap-4 items-start rounded-2xl bg-white/[0.03] border border-white/[0.05] px-4 py-3.5"
                >
                  <span
                    className="text-xl font-black tabular-nums shrink-0 leading-6 text-[#C0FF00]"
                    style={{ fontFamily: MONO }}
                  >
                    0{index + 1}
                  </span>
                  <p className="text-xs leading-5 text-gray-300">{humanizeCoachText(item)}</p>
                </div>
              ))}
            </div>
            {!priorities.some((p) => model.identity.unlockMessage.includes(p)) && (
              <p className="text-[10px] leading-4 text-[#555] pt-5 mt-6 border-t border-white/[0.06]">
                {humanizeCoachText(model.identity.unlockMessage)}
              </p>
            )}
          </div>
        </div>

        {/* ── DINAMICA DI CORSA ── */}
        <div className={CARD}>
          <CardHeader
            title="Dinamica di Corsa"
            subtitle="Medie reali dalle corse con dati Garmin"
            icon={Footprints}
          />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {model.biomechanics.map((m) => {
              const color = m.available ? m.color : "#475569";
              return (
                <div
                  key={m.key}
                  className="rounded-2xl px-4 py-3 flex flex-col gap-1.5"
                  style={{ background: `${color}10`, border: `1px solid ${color}25` }}
                >
                  <span className="text-[10px] font-black tracking-widest uppercase truncate" style={{ color: `${color}99` }}>
                    {BIOMECH_SHORT_LABELS[m.key] ?? m.label}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black tabular-nums text-white" style={{ fontFamily: MONO }}>
                      {m.available ? m.displayValue : "—"}
                    </span>
                    {m.available && <span className="text-[10px] font-black text-[#555]">{m.unit}</span>}
                  </div>
                  <span className="text-[9px] text-[#555] tracking-wider">
                    {m.available ? `target ${m.benchmark}` : "non disponibile"}
                  </span>
                  <span className="text-[9px] font-black tracking-widest uppercase" style={{ color }}>
                    {m.verdictLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1 pb-4">
          <span className="text-[9px] font-black tracking-widest uppercase text-[#444]">
            {model.freshness.label}
          </span>
          <span className="text-[9px] font-black tracking-widest uppercase text-[#444]">
            Metic Lab · Elite Performance
          </span>
        </div>

      </div>
    </div>
  );
}
