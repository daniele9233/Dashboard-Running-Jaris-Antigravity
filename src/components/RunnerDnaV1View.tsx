import { useEffect, useMemo, useState } from "react";
import { Dna, RefreshCcw, Activity, Radar as RadarIcon, Terminal, Timer, Footprints } from "lucide-react";
import { useRunnerDnaUiModel } from "../hooks/useRunnerDnaUiModel";
import { RunnerDnaLoading } from "./runner-dna/RunnerDnaLoading";
import {
  MONO, formatItalianDecimal, humanizeCoachText, formatDelta,
  DISTANCE_LABELS, DISTANCE_ORDER, TREND_COLORS, BIOMECH_SHORT_LABELS,
} from "./runner-dna/dnaShared";

// ─────────────────────────────────────────────────────────────────────────────
// RUNNER DNA V1 — "SEQUENCER"
// Lab HUD telemetrico: griglia tecnica, radar pentagonale custom, geni a
// barre segmentate, feed diagnostica stile console. Tutto SVG/CSS, zero deps.
// ─────────────────────────────────────────────────────────────────────────────

const GENE_CODES: Record<string, string> = {
  aerobic_engine: "AER",
  consistency: "CON",
  load_capacity: "LOA",
  efficiency: "EFF",
  biomechanics: "BIO",
};

const GRID_BG: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(rgba(200,255,45,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.035) 1px, transparent 1px)",
  backgroundSize: "44px 44px",
};

// ─── PANEL (bordo tecnico + angoli marcati) ──────────────────────────────────
function Panel({
  title, code, icon: Icon, children, className = "",
}: {
  title: string; code: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`relative border border-white/[0.08] bg-[#080A0E]/90 rounded-lg ${className}`}>
      {/* angoli HUD */}
      <span aria-hidden className="absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2 border-[#C8FF2D]/60 rounded-tl-lg" />
      <span aria-hidden className="absolute -top-px -right-px w-3 h-3 border-t-2 border-r-2 border-[#C8FF2D]/25 rounded-tr-lg" />
      <span aria-hidden className="absolute -bottom-px -left-px w-3 h-3 border-b-2 border-l-2 border-[#C8FF2D]/25 rounded-bl-lg" />
      <span aria-hidden className="absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2 border-[#C8FF2D]/60 rounded-br-lg" />

      <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-3.5 h-3.5 text-[#C8FF2D] shrink-0" />}
          <h3 className="text-[11px] font-black tracking-[0.22em] uppercase text-white truncate">{title}</h3>
        </div>
        <span className="text-[9px] font-bold tracking-[0.18em] text-[#445]" style={{ fontFamily: MONO }}>
          {code}
        </span>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

// ─── SEGMENTED GENE BAR ──────────────────────────────────────────────────────
function GeneRow({
  code, label, score, status, color, delay,
}: {
  code: string; label: string; score: number; status: string; color: string; delay: number;
}) {
  const SEGMENTS = 24;
  const [lit, setLit] = useState(0);
  const target = Math.round((score / 100) * SEGMENTS);

  useEffect(() => {
    const start = setTimeout(() => {
      let i = 0;
      const tick = setInterval(() => {
        i += 1;
        setLit(i);
        if (i >= target) clearInterval(tick);
      }, 28);
      return () => clearInterval(tick);
    }, delay);
    return () => clearTimeout(start);
  }, [target, delay]);

  return (
    <div className="flex items-center gap-4">
      <span
        className="w-11 shrink-0 text-center text-[10px] font-bold py-1 rounded border"
        style={{ fontFamily: MONO, color, borderColor: `${color}40`, background: `${color}0D` }}
      >
        {code}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <span className="text-[10px] font-black tracking-[0.18em] uppercase text-gray-300 truncate">{label}</span>
          <span className="text-[9px] font-bold tracking-[0.14em] uppercase shrink-0" style={{ color }}>{status}</span>
        </div>
        <div className="flex gap-[3px] motion-reduce:transition-none">
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <span
              key={i}
              className="h-2.5 flex-1 rounded-[1px] transition-colors duration-150"
              style={{
                background: i < lit ? color : "rgba(255,255,255,0.05)",
                boxShadow: i < lit && i === lit - 1 ? `0 0 6px ${color}` : "none",
              }}
            />
          ))}
        </div>
      </div>
      <span className="w-12 shrink-0 text-right text-xl font-bold tabular-nums text-white" style={{ fontFamily: MONO }}>
        {score}
      </span>
    </div>
  );
}

// ─── PENTAGON RADAR (SVG custom) ─────────────────────────────────────────────
function PentagonRadar({ items }: { items: Array<{ key: string; label: string; score: number; color: string }> }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 250);
    return () => clearTimeout(t);
  }, []);

  const size = 320, cx = size / 2, cy = size / 2 + 6, R = 116;
  const n = Math.max(items.length, 3);
  const angle = (i: number) => -Math.PI / 2 + (i / n) * Math.PI * 2;
  const pt = (i: number, r: number) => ({
    x: cx + Math.cos(angle(i)) * r,
    y: cy + Math.sin(angle(i)) * r,
  });
  const ring = (frac: number) =>
    Array.from({ length: n }, (_, i) => {
      const { x, y } = pt(i, R * frac);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

  const poly = items
    .map((item, i) => {
      const { x, y } = pt(i, R * (Math.max(0, Math.min(100, item.score)) / 100));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[340px] mx-auto" role="img"
      aria-label={`Radar DNA: ${items.map((i) => `${i.label} ${i.score}`).join(", ")}`}>
      {/* anelli */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
      ))}
      {/* assi */}
      {items.map((_, i) => {
        const { x, y } = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />;
      })}
      {/* area dati */}
      <g
        style={{
          transform: mounted ? "scale(1)" : "scale(0.4)",
          opacity: mounted ? 1 : 0,
          transformOrigin: `${cx}px ${cy}px`,
          transition: "transform .8s cubic-bezier(0.22,1,0.36,1), opacity .6s ease",
        }}
      >
        <polygon points={poly} fill="rgba(200,255,45,0.14)" stroke="#C8FF2D" strokeWidth="2" strokeLinejoin="round" />
        {items.map((item, i) => {
          const { x, y } = pt(i, R * (item.score / 100));
          return <circle key={item.label} cx={x} cy={y} r="4" fill={item.color} stroke="#080A0E" strokeWidth="2" />;
        })}
      </g>
      {/* etichette vertici: codici gene + valore */}
      {items.map((item, i) => {
        const { x, y } = pt(i, R + 26);
        return (
          <g key={item.label}>
            <text
              x={x} y={y - 5}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="10" fontWeight="900" letterSpacing="2"
              fill="#8a93a6"
            >
              {GENE_CODES[item.key] ?? item.label.toUpperCase().slice(0, 3)}
            </text>
            <text
              x={x} y={y + 8}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="10" fontWeight="700"
              fill={item.color}
              style={{ fontFamily: MONO }}
            >
              {item.score}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── TELEMETRY CELL ──────────────────────────────────────────────────────────
function TelemetryCell({ label, value, unit, color = "#fff" }: {
  label: string; value: string; unit?: string; color?: string;
}) {
  return (
    <div className="px-5 py-4">
      <div className="text-[9px] font-black tracking-[0.22em] uppercase text-[#556]">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums" style={{ fontFamily: MONO, color }}>{value}</span>
        {unit && <span className="text-[10px] font-bold text-[#556]">{unit}</span>}
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export function RunnerDnaV1View() {
  const { model, loading, refreshing, error, regenerate } = useRunnerDnaUiModel();

  const radarItems = useMemo(
    () => (model?.scores.items ?? []).map((i) => ({ key: i.key, label: i.label, score: i.score, color: i.color })),
    [model],
  );

  if (loading || refreshing) return <RunnerDnaLoading label="Sequenziamento Runner DNA · V1" />;

  if (error || !model) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 bg-[#050609] p-8 gap-4">
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
  const trendColor = TREND_COLORS[model.performance.trendStatus] ?? "#F59E0B";

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

  const feed: Array<{ sym: string; color: string; text: string }> = [
    ...model.diagnostics.strengths.slice(0, 3).map((t) => ({ sym: "+", color: "#C8FF2D", text: t })),
    ...model.diagnostics.weaknesses.slice(0, 3).map((t) => ({ sym: "!", color: "#F43F5E", text: t })),
    ...model.diagnostics.priorities.slice(0, 3).map((t) => ({ sym: ">", color: "#22D3EE", text: t })),
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#050609] text-white min-h-0 custom-scrollbar relative">
      <div aria-hidden className="absolute inset-0 pointer-events-none opacity-50" style={GRID_BG} />

      <div className="relative max-w-[1700px] mx-auto p-4 md:p-6 lg:p-10 space-y-5">

        {/* ── HEADER ── */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black tracking-[0.35em] uppercase text-[#C8FF2D]">
              <Dna className="w-4 h-4" />
              Sequencer · Build V1
            </div>
            <h1 className="mt-2 text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter uppercase italic">
              Runner <span className="text-[#C8FF2D]">DNA</span>
            </h1>
            <p className="text-gray-600 text-[10px] font-black tracking-[0.3em] uppercase mt-2">
              Lettura genomica della tua corsa · {model.identity.archetype}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="px-3 py-1.5 rounded text-[10px] font-black tracking-[0.18em] uppercase border"
              style={{ color: trendColor, borderColor: `${trendColor}40`, background: `${trendColor}10` }}
            >
              {model.performance.trendStatus}
            </span>
            <button
              onClick={() => void regenerate()}
              disabled={refreshing}
              className="flex items-center gap-2 px-5 py-2.5 border border-[#C8FF2D]/30 bg-[#C8FF2D]/5 rounded text-[10px] font-black tracking-widest uppercase text-[#C8FF2D] hover:bg-[#C8FF2D]/15 transition-colors disabled:opacity-40"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Risequenzia
            </button>
          </div>
        </div>

        {/* ── TELEMETRY STRIP ── */}
        <div className="relative border border-white/[0.08] bg-[#080A0E]/90 rounded-lg grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 divide-x divide-y md:divide-y-0 xl:divide-y-0 divide-white/[0.05]">
          <TelemetryCell label="DNA Score" value={String(model.scores.overall)} unit="/100" color="#C8FF2D" />
          <TelemetryCell label="VDOT" value={vdot !== null ? vdot.toFixed(1) : "—"} color="#22D3EE" />
          <TelemetryCell label="Ceiling" value={ceiling !== null ? ceiling.toFixed(1) : "—"} color="#A78BFA" />
          <TelemetryCell label="Attivato" value={potentialPct !== null ? String(Math.round(potentialPct)) : "—"} unit="%" color="#F97316" />
          <TelemetryCell
            label="Uscite/sett"
            value={model.base.weeklyFrequency !== null ? formatItalianDecimal(model.base.weeklyFrequency, 1) : "—"}
          />
          <TelemetryCell label="Dist. ideale" value={model.performance.idealDistance} />
        </div>

        {/* ── GENOMA + RADAR ── */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
          <Panel title="Genoma Atletico" code="SEQ-01" icon={Activity} className="xl:col-span-7">
            <div className="space-y-5">
              {model.scores.items.map((item, i) => (
                <GeneRow
                  key={item.key}
                  code={GENE_CODES[item.key] ?? item.key.slice(0, 3).toUpperCase()}
                  label={item.label}
                  score={item.score}
                  status={item.status}
                  color={item.color}
                  delay={250 + i * 180}
                />
              ))}
            </div>
            <p className="mt-6 pt-4 border-t border-white/[0.05] text-xs leading-5 text-gray-500">
              {model.identity.description}
            </p>
          </Panel>

          <Panel title="Impronta Radar" code="SEQ-02" icon={RadarIcon} className="xl:col-span-5">
            <PentagonRadar items={radarItems} />
            <div className="mt-4 flex items-center justify-center gap-6">
              <div className="text-center">
                <div className="text-[9px] font-black tracking-[0.22em] uppercase text-[#556]">Rango</div>
                <div className="mt-1 text-lg font-black text-white">{model.identity.rank.name}</div>
              </div>
              <div className="w-px h-8 bg-white/[0.08]" />
              <div className="text-center">
                <div className="text-[9px] font-black tracking-[0.22em] uppercase text-[#556]">Proiezione</div>
                <div className="mt-1 text-lg font-bold tabular-nums text-[#C8FF2D]" style={{ fontFamily: MONO }}>
                  {model.scores.projected}/100
                </div>
              </div>
            </div>
          </Panel>
        </div>

        {/* ── CRONO + DIAGNOSTICA ── */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
          <Panel title="Proiezioni Crono" code="SEQ-03" icon={Timer} className="xl:col-span-7">
            {predictions.length === 0 ? (
              <p className="text-[#445] text-xs font-black tracking-widest uppercase text-center py-8">Dati insufficienti</p>
            ) : (
              <div style={{ fontFamily: MONO }}>
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 pb-2 border-b border-white/[0.06] text-[9px] font-bold tracking-[0.2em] text-[#556] uppercase">
                  <span>Distanza</span>
                  <span className="text-right">Attuale</span>
                  <span className="text-right">Potenziale</span>
                  <span className="text-right">Delta</span>
                </div>
                {predictions.map((p) => (
                  <div
                    key={p.dist}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 py-3 border-b border-white/[0.04] last:border-b-0 items-baseline hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="text-[11px] font-bold tracking-[0.14em] text-gray-300">{p.label}</span>
                    <span className="text-right text-sm tabular-nums text-[#667]">{p.currentTime ?? "—"}</span>
                    <span className="text-right text-lg font-bold tabular-nums text-[#C8FF2D]">{p.potentialTime}</span>
                    <span className="text-right text-xs font-bold tabular-nums text-[#34D399] w-14">{p.delta}</span>
                  </div>
                ))}
                {vdot !== null && ceiling !== null && (
                  <div className="mt-4 text-[10px] text-[#556] tracking-wider">
                    margine VDOT {vdot.toFixed(1)} → {ceiling.toFixed(1)}
                    {potentialPct !== null && ` · potenziale attivato ${Math.round(potentialPct)}%`}
                  </div>
                )}
              </div>
            )}
          </Panel>

          <Panel title="Diagnostica Coach" code="SEQ-04" icon={Terminal} className="xl:col-span-5">
            <p className="text-xs leading-5 text-gray-300 mb-4">{humanizeCoachText(model.identity.coachVerdict)}</p>
            <div className="space-y-2.5 border-t border-white/[0.05] pt-4">
              {feed.map((line, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span
                    className="w-5 shrink-0 text-center text-xs font-bold leading-5"
                    style={{ fontFamily: MONO, color: line.color }}
                  >
                    {line.sym}
                  </span>
                  <span className="text-[11px] leading-5 text-gray-400">{humanizeCoachText(line.text)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* ── DINAMICA ── */}
        <Panel title="Dinamica di Corsa" code="SEQ-05" icon={Footprints}>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-x-8 gap-y-6">
            {model.biomechanics.map((m) => {
              const color = m.available ? m.color : "#475569";
              return (
                <div key={m.key}>
                  <div className="text-[9px] font-black tracking-[0.2em] uppercase text-[#556] truncate">
                    {BIOMECH_SHORT_LABELS[m.key] ?? m.label}
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold tabular-nums text-white" style={{ fontFamily: MONO }}>
                      {m.available ? m.displayValue : "—"}
                    </span>
                    {m.available && <span className="text-[10px] font-bold text-[#556]">{m.unit}</span>}
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${m.available ? m.score : 0}%`, background: color }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[9px]">
                    <span className="text-[#556] tracking-wider">{m.available ? m.benchmark : "non disponibile"}</span>
                    <span className="font-black tracking-[0.12em] uppercase" style={{ color }}>{m.verdictLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* ── FOOTER ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1 pb-4 text-[9px] font-bold tracking-[0.2em] uppercase text-[#445]" style={{ fontFamily: MONO }}>
          <span>{model.freshness.label}</span>
          <span>METIC LAB · SEQ build V1</span>
        </div>
      </div>
    </div>
  );
}
