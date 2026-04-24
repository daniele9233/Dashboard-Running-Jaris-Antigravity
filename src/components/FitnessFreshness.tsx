import { useMemo, useState, useRef } from "react";
import { Activity, RefreshCw, Info } from "lucide-react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import type { FitnessFreshnessPoint, CurrentFF } from "../types/api";
import { recalculateFitnessFreshness } from "../api";
import { ChartExpandButton, ChartFullscreenModal } from "./statistics/ChartFullscreenModal";

interface FitnessFreshnessProps {
  fitnessFreshness: FitnessFreshnessPoint[];
  currentFf: CurrentFF | null;
  prevCtl: number | null;
}

const CLR_CTL  = "#6366F1"; // indigo â€” Condizione fisica (same as PMC)
const CLR_ATL  = "#F43F5E"; // red    â€” Affaticamento (same as PMC)
const CLR_TSB  = "#D4FF00"; // lime   â€” Forma (same as PMC NEON)

function tsbStatusColor(tsb: number): string {
  if (tsb > 10)  return "#C0FF00";  // lime  â€” Fresco
  if (tsb > -5)  return "#14B8A6";  // teal  â€” Neutro
  if (tsb > -20) return "#F59E0B";  // amber â€” Affaticato
  return "#F43F5E";                  // red   â€” Sovrallenamento
}

function tsbStatusLabel(tsb: number): string {
  if (tsb > 10)  return "Fresco";
  if (tsb > -5)  return "Neutro";
  if (tsb > -20) return "Affaticato";
  return "Sovrallenamento";
}

function getInsight(tsb: number): { emoji: string; text: string } {
  if (tsb > 10)
    return { emoji: "*", text: "Sei in forma ottimale. Momento perfetto per gareggiare o fare un test di velocita." };
  if (tsb > -5)
    return { emoji: "|", text: "Equilibrio tra allenamento e recupero. Continua cosi per migliorare costantemente." };
  if (tsb > -20)
    return { emoji: "^", text: "Il corpo sta assorbendo il carico. Gli adattamenti emergeranno nei prossimi giorni." };
  return { emoji: "~", text: "Recupera prima di spingere. La supercompensazione richiede riposo per manifestarsi." };
}

// â”€â”€â”€ Tooltip compatto â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const FFTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const ctl = payload.find((p: any) => p.dataKey === "ctl")?.value ?? null;
  const atl = payload.find((p: any) => p.dataKey === "atl")?.value ?? null;
  const tsb = payload.find((p: any) => p.dataKey === "tsb")?.value ?? null;
  const dateStr = label
    ? new Date(label).toLocaleDateString("it", { weekday: "short", day: "numeric", month: "numeric" })
    : "";
  const tsbColor = tsb !== null ? tsbStatusColor(tsb) : CLR_TSB;

  return (
    <div className="bg-[#0F172A] border border-[#334155] px-3 py-2 rounded-xl shadow-xl text-xs">
      <p className="text-[#94A3B8] font-semibold mb-1.5 capitalize">{dateStr}</p>
      <div className="flex gap-3 flex-wrap">
        {ctl !== null && (
          <span style={{ color: CLR_CTL }} className="font-bold">
            {ctl.toFixed(1)} Cond.
          </span>
        )}
        {atl !== null && (
          <span style={{ color: CLR_ATL }} className="font-bold">
            {atl.toFixed(1)} Affat.
          </span>
        )}
        {tsb !== null && (
          <span style={{ color: tsbColor }} className="font-bold">
            {tsb >= 0 ? "+" : ""}{tsb.toFixed(1)} Forma
          </span>
        )}
      </div>
    </div>
  );
};

// â”€â”€â”€ Info Tooltip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function InfoTooltip({ title, lines }: { title: string; lines: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="text-[#555] hover:text-[#A0A0A0] transition-colors focus:outline-none"
      >
        <Info size={13} />
      </button>
      {open && (
        <div className="absolute z-50 bottom-full right-0 mb-2 w-64 bg-[#111] border border-white/10 rounded-2xl p-4 shadow-2xl pointer-events-none">
          <div className="text-[#C0FF00] text-[10px] font-black tracking-widest mb-2">{title}</div>
          <ul className="space-y-1.5">
            {lines.map((l, i) => (
              <li key={i} className="text-[#A0A0A0] text-[10px] leading-relaxed flex gap-1.5">
                <span className="text-[#555] shrink-0">-</span>
                {l}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Componente principale â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function FitnessFreshness({ fitnessFreshness, currentFf, prevCtl }: FitnessFreshnessProps) {
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const ctl = currentFf?.ctl ?? 0;
  const atl = currentFf?.atl ?? 0;
  const tsb = currentFf?.tsb ?? 0;
  const ctlTrend = currentFf?.ctl_trend ?? (prevCtl !== null ? parseFloat((ctl - prevCtl).toFixed(1)) : null);
  const statusLabel = currentFf?.form_status ?? tsbStatusLabel(tsb);
  const statusColor = tsbStatusColor(tsb);

  // ATL trend dall'array storico
  const atlTrend = useMemo(() => {
    if (!fitnessFreshness || fitnessFreshness.length < 2) return null;
    const prev = fitnessFreshness[fitnessFreshness.length - 2].atl;
    return parseFloat((atl - prev).toFixed(1));
  }, [fitnessFreshness, atl]);

  const insight = useMemo(() => getInsight(tsb), [tsb]);

  // Ticks mensili per X-axis
  const monthTicks = useMemo(() => {
    const seen = new Set<string>();
    return (fitnessFreshness ?? [])
      .filter((d) => {
        const month = d.date.slice(0, 7);
        if (seen.has(month)) return false;
        seen.add(month);
        return true;
      })
      .map((d) => d.date);
  }, [fitnessFreshness]);

  const tickFormatter = (date: string) =>
    new Date(date).toLocaleString("it", { month: "short" }).toUpperCase();

  const handleRecalculate = async () => {
    setRecalcLoading(true);
    try {
      await recalculateFitnessFreshness();
      window.location.reload();
    } catch (e) {
      console.error(e);
    } finally {
      setRecalcLoading(false);
    }
  };

  // â”€â”€ KPI helper
  const KPI = ({
    value,
    label,
    color,
    trend,
    trendInverted = false,
    showSign = false,
  }: {
    value: number;
    label: string;
    color: string;
    trend?: number | null;
    trendInverted?: boolean;
    showSign?: boolean;
  }) => (
    <div className="flex flex-col gap-1.5">
      <div className="text-5xl font-black leading-none tabular-nums" style={{ color }}>
        {showSign && value >= 0 ? "+" : ""}{value > 0 || showSign ? value.toFixed(1) : "—"}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[9px] font-bold uppercase tracking-widest leading-tight" style={{ color }}>
          {label}
        </span>
      </div>
      {trend !== null && trend !== undefined && trend !== 0 && (
        <div
          className="text-xs font-bold"
          style={{ color: (trendInverted ? trend < 0 : trend >= 0) ? "#22c55e" : "#ef4444" }}
        >
          {trend >= 0 ? "+" : ""}{trend}
        </div>
      )}
      {/* Status badge per TSB */}
      {showSign && (
        <div
          className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md self-start"
          style={{ color, backgroundColor: color + "18" }}
        >
          {statusLabel}
        </div>
      )}
    </div>
  );

  const renderFitnessChart = (isExpanded = false) => {
    const suffix = isExpanded ? '-expanded' : '';
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={fitnessFreshness} margin={{ top: isExpanded ? 20 : 8, right: isExpanded ? 20 : 8, left: 0, bottom: isExpanded ? 20 : 0 }}>
          <defs>
            <linearGradient id={`ff-ctl-grad${suffix}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CLR_CTL} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CLR_CTL} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`ff-atl-grad${suffix}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CLR_ATL} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CLR_ATL} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`ff-tsb-grad${suffix}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CLR_TSB} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CLR_TSB} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 6" vertical={false} stroke="rgba(192,255,0,0.08)" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#475569", fontSize: isExpanded ? 12 : 9 }}
            dy={6}
            ticks={monthTicks}
            tickFormatter={tickFormatter}
            interval={0}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#475569", fontSize: isExpanded ? 12 : 9 }}
            dx={-4}
            width={isExpanded ? 40 : 28}
            ticks={[0, 20, 40, 60, 80]}
          />
          <ReferenceLine y={0} stroke="rgba(192,255,0,0.24)" strokeDasharray="4 3" strokeWidth={1} />
          <Tooltip
            content={<FFTooltip />}
            cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="ctl"
            name="Condizione fisica"
            stroke={CLR_CTL}
            strokeWidth={2.5}
            fillOpacity={1}
            fill={`url(#ff-ctl-grad${suffix})`}
            dot={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="atl"
            name="Affaticamento"
            stroke={CLR_ATL}
            strokeWidth={1.5}
            strokeOpacity={0.8}
            fillOpacity={1}
            fill={`url(#ff-atl-grad${suffix})`}
            dot={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="tsb"
            name="Forma fisica"
            stroke="#F59E0B"
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#ff-tsb-grad${suffix})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div
      className="relative overflow-hidden rounded-xl p-6 group"
      style={{
        background: "radial-gradient(circle at top left, rgba(192,255,0,0.08), transparent 22%), radial-gradient(circle at top right, rgba(99,102,241,0.08), transparent 34%), #0B0B0B",
        border: "1px solid #20290F",
        borderLeft: `3px solid ${CLR_TSB}`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02), 0 0 0 1px rgba(192,255,0,0.04)",
      }}
    >
      {/* â”€â”€ Header â”€â”€ */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5" style={{ color: CLR_TSB }} />
          <h2 className="text-lg font-bold tracking-wider uppercase text-text-primary">
            Fitness & Freschezza
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {fitnessFreshness && fitnessFreshness.length > 0 && (
            <ChartExpandButton onClick={() => setExpanded(true)} />
          )}
          <button
            onClick={handleRecalculate}
            disabled={recalcLoading}
            className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted hover:text-white border border-white/10 hover:border-white/30 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${recalcLoading ? "animate-spin" : ""}`} />
            Ricalcola
          </button>
          <InfoTooltip
            title="Storico 12 mesi - stima Jack Daniels"
            lines={[
              "Storico 12 mesi - stima Jack Daniels",
              "CTL: Carico Cronico (Chronic Training Load) - misura del fitness a lungo termine.",
              "ATL: Carico Acuto (Acute Training Load) - misura della fatica e del carico recente.",
              "TSB: Forma (Training Stress Balance) - bilancio tra CTL e ATL, indica freschezza o affaticamento.",
              "Efficiency Factor: rapporto tra passo e frequenza cardiaca, misura dell'efficienza di corsa.",
            ]}
          />
        </div>
      </div>

      {/* â”€â”€ KPI Row â”€â”€ */}
      <div className="grid grid-cols-3 gap-4 pb-5 mb-5 border-b border-[#243018]">
        <KPI
          value={ctl}
          label="Condizione fisica"
          color={CLR_CTL}
          trend={ctlTrend}
        />
        <KPI
          value={atl}
          label="Affaticamento"
          color={CLR_ATL}
          trend={atlTrend}
          trendInverted
        />
        <KPI
          value={tsb}
          label="Forma"
          color={statusColor}
          showSign
        />
      </div>

      {/* â”€â”€ Grafico â”€â”€ */}
      {fitnessFreshness && fitnessFreshness.length > 0 ? (
        <>
          <div style={{ height: 260 }}>
            {renderFitnessChart(false)}
          </div>

          {/* â”€â”€ Legenda â”€â”€ */}
          <div className="flex gap-5 mt-3 mb-4 text-[9px] font-semibold tracking-wider">
            {[
              { label: "Condizione fisica", color: CLR_CTL, width: 2.5 },
              { label: "Affaticamento",     color: CLR_ATL, width: 1.5 },
              { label: "Forma fisica",      color: "#F59E0B", width: 2 },
            ].map(({ label, color, width }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-5 rounded-full" style={{ height: width, backgroundColor: color }} />
                <span style={{ color }}>{label}</span>
              </div>
            ))}
          </div>

          {/* â”€â”€ Insight â”€â”€ */}
          <div className="bg-[#10130D] border border-[#243018] rounded-xl px-4 py-3 text-xs text-[#A9B5C9]">
            <span className="mr-1.5">{insight.emoji}</span>
            {insight.text}
          </div>
        </>
      ) : (
        <div className="h-48 flex flex-col items-center justify-center gap-3 text-text-muted">
          <p className="text-sm">Nessun dato - sincronizza le corse o clicca Ricalcola</p>
          <button
            onClick={handleRecalculate}
            disabled={recalcLoading}
            className="text-xs font-bold text-[#C0FF00] border border-[#C0FF00]/30 hover:border-[#C0FF00] rounded-lg px-4 py-2 transition-all"
          >
            {recalcLoading ? "Calcolo in corso..." : "Ricalcola ora"}
          </button>
        </div>
      )}
      <ChartFullscreenModal
        open={expanded}
        onClose={() => setExpanded(false)}
        title="Fitness & Freschezza"
        subtitle="CTL / ATL / TSB - storico forma"
        accent={CLR_CTL}
        details={
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-4 items-center">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-3">
                <div className="text-[9px] text-[#555] uppercase tracking-widest font-black">Condizione</div>
                <div className="text-xl font-black" style={{ color: CLR_CTL }}>{ctl.toFixed(1)}</div>
              </div>
              <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-3">
                <div className="text-[9px] text-[#555] uppercase tracking-widest font-black">Affaticamento</div>
                <div className="text-xl font-black" style={{ color: CLR_ATL }}>{atl.toFixed(1)}</div>
              </div>
              <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-3">
                <div className="text-[9px] text-[#555] uppercase tracking-widest font-black">Forma</div>
                <div className="text-xl font-black" style={{ color: statusColor }}>{tsb >= 0 ? '+' : ''}{tsb.toFixed(1)}</div>
              </div>
            </div>
            <div className="text-xs text-[#94A3B8] flex flex-col gap-2">
              <div className="flex flex-wrap gap-5 text-[9px] font-semibold tracking-wider">
                <span className="flex items-center gap-1.5" style={{ color: CLR_CTL }}><span className="w-5 h-0.5 rounded-full" style={{ backgroundColor: CLR_CTL }} />Condizione fisica</span>
                <span className="flex items-center gap-1.5" style={{ color: CLR_ATL }}><span className="w-5 h-0.5 rounded-full" style={{ backgroundColor: CLR_ATL }} />Affaticamento</span>
                <span className="flex items-center gap-1.5" style={{ color: '#F59E0B' }}><span className="w-5 h-0.5 rounded-full bg-[#F59E0B]" />Forma fisica</span>
              </div>
              <div>{insight.text}</div>
            </div>
          </div>
        }
      >
        {renderFitnessChart(true)}
      </ChartFullscreenModal>
    </div>
  );
}
