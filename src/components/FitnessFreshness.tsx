import { useMemo, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { FitnessFreshnessPoint, CurrentFF } from "../types/api";
import { recalculateFitnessFreshness } from "../api";

interface FitnessFreshnessProps {
  fitnessFreshness: FitnessFreshnessPoint[];
  currentFf: CurrentFF | null;
  prevCtl: number | null;
}

const CLR_CTL  = "#3B82F6"; // blue  — Condizione fisica
const CLR_ATL  = "#F43F5E"; // red   — Affaticamento
const CLR_TSB  = "#14B8A6"; // teal  — Forma (neutro)

function tsbStatusColor(tsb: number): string {
  if (tsb > 10)  return "#C0FF00";  // lime  — Fresco
  if (tsb > -5)  return "#14B8A6";  // teal  — Neutro
  if (tsb > -20) return "#F59E0B";  // amber — Affaticato
  return "#F43F5E";                  // red   — Sovrallenamento
}

function tsbStatusLabel(tsb: number): string {
  if (tsb > 10)  return "Fresco";
  if (tsb > -5)  return "Neutro";
  if (tsb > -20) return "Affaticato";
  return "Sovrallenamento";
}

function getInsight(tsb: number): { emoji: string; text: string } {
  if (tsb > 10)
    return { emoji: "🌟", text: "Sei in forma ottimale. Momento perfetto per gareggiare o fare un test di velocità." };
  if (tsb > -5)
    return { emoji: "⚖️", text: "Equilibrio tra allenamento e recupero. Continua così per migliorare costantemente." };
  if (tsb > -20)
    return { emoji: "🔥", text: "Il corpo sta assorbendo il carico. Gli adattamenti emergeranno nei prossimi giorni." };
  return { emoji: "💤", text: "Recupera prima di spingere. La supercompensazione richiede riposo per manifestarsi." };
}

// ─── Tooltip compatto ─────────────────────────────────────────────────────────
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

// ─── Componente principale ────────────────────────────────────────────────────

export function FitnessFreshness({ fitnessFreshness, currentFf, prevCtl }: FitnessFreshnessProps) {
  const [recalcLoading, setRecalcLoading] = useState(false);

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

  // ── KPI helper
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

  return (
    <div
      className="bg-[#0E0E0E] border border-[#1E1E1E] rounded-xl p-6"
      style={{ borderLeft: "3px solid #3B82F6" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5" style={{ color: CLR_CTL }} />
          <h2 className="text-lg font-bold tracking-wider uppercase text-text-primary">
            Fitness &amp; Freshness
          </h2>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalcLoading}
          className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted hover:text-white border border-white/10 hover:border-white/30 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${recalcLoading ? "animate-spin" : ""}`} />
          Ricalcola
        </button>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-3 gap-4 pb-5 mb-5 border-b border-[#1E293B]">
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

      {/* ── Grafico ── */}
      {fitnessFreshness && fitnessFreshness.length > 0 ? (
        <>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fitnessFreshness} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 6" vertical={false} stroke="#1E293B" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 9 }}
                  dy={6}
                  ticks={monthTicks}
                  tickFormatter={tickFormatter}
                  interval={0}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 9 }}
                  dx={-4}
                  width={28}
                  ticks={[0, 20, 40, 60, 80]}
                />
                <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 3" strokeWidth={1} />
                <Tooltip
                  content={<FFTooltip />}
                  cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }}
                />
                {/* Condizione (CTL) — linea principale */}
                <Line
                  type="monotone"
                  dataKey="ctl"
                  stroke={CLR_CTL}
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
                {/* Affaticamento (ATL) */}
                <Line
                  type="monotone"
                  dataKey="atl"
                  stroke={CLR_ATL}
                  strokeWidth={1.5}
                  strokeOpacity={0.8}
                  dot={false}
                  isAnimationActive={false}
                />
                {/* Forma (TSB) */}
                <Line
                  type="monotone"
                  dataKey="tsb"
                  stroke={CLR_TSB}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ── Legenda ── */}
          <div className="flex gap-5 mt-3 mb-4 text-[9px] font-semibold tracking-wider">
            {[
              { label: "Condizione fisica", color: CLR_CTL, width: 2.5 },
              { label: "Affaticamento",     color: CLR_ATL, width: 1.5 },
              { label: "Forma fisica",      color: CLR_TSB, width: 2 },
            ].map(({ label, color, width }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-5 rounded-full" style={{ height: width, backgroundColor: color }} />
                <span style={{ color }}>{label}</span>
              </div>
            ))}
          </div>

          {/* ── Insight ── */}
          <div className="bg-white/[0.03] border border-[#1E293B] rounded-xl px-4 py-3 text-xs text-[#94A3B8]">
            <span className="mr-1.5">{insight.emoji}</span>
            {insight.text}
          </div>
        </>
      ) : (
        <div className="h-48 flex flex-col items-center justify-center gap-3 text-text-muted">
          <p className="text-sm">Nessun dato — sincronizza le corse o clicca Ricalcola</p>
          <button
            onClick={handleRecalculate}
            disabled={recalcLoading}
            className="text-xs font-bold text-[#C0FF00] border border-[#C0FF00]/30 hover:border-[#C0FF00] rounded-lg px-4 py-2 transition-all"
          >
            {recalcLoading ? "Calcolo in corso..." : "Ricalcola ora"}
          </button>
        </div>
      )}
    </div>
  );
}
