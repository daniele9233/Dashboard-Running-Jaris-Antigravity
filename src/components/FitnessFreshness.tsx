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

const CLR_CTL = "#3B82F6";
const CLR_ATL = "#F43F5E";
const CLR_TSB = "#14B8A6";
const CLR_TRIMP = "#C0FF00";

function tsbStatusLabel(tsb: number): string {
  if (tsb > 10) return "Fresco";
  if (tsb > 0) return "Neutro";
  if (tsb > -10) return "Affaticato";
  return "Sovrallenamento";
}

function tsbStatusColor(tsb: number): string {
  if (tsb > 10) return "#14B8A6";
  if (tsb > 0) return "#F59E0B";
  if (tsb > -10) return "#8B5CF6";
  return "#F43F5E";
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
const FFTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const ctl = payload.find((p: any) => p.dataKey === "ctl")?.value ?? null;
  const atl = payload.find((p: any) => p.dataKey === "atl")?.value ?? null;
  const tsb = payload.find((p: any) => p.dataKey === "tsb")?.value ?? null;
  const trimp = payload.find((p: any) => p.dataKey === "trimp")?.value ?? null;
  const dateStr = label
    ? new Date(label).toLocaleDateString("it", { day: "numeric", month: "short", year: "numeric" }).toUpperCase()
    : "";
  const tsbColor = tsb !== null ? tsbStatusColor(tsb) : "#64748B";

  return (
    <div className="bg-[#0F172A] border border-[#334155] px-3 py-2.5 rounded-xl shadow-2xl text-xs min-w-[180px]">
      <p className="text-[#94A3B8] font-bold mb-2 tracking-wider">{dateStr}</p>
      <div className="space-y-1.5">
        <div className="flex justify-between gap-6">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-[2px] rounded-full inline-block" style={{ backgroundColor: CLR_CTL }} />
            <span style={{ color: CLR_CTL }}>Condizione Fisica</span>
          </span>
          <span className="text-white font-bold">{ctl?.toFixed(1) ?? "—"}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-[2px] rounded-full inline-block" style={{ backgroundColor: CLR_ATL }} />
            <span style={{ color: CLR_ATL }}>Affaticamento</span>
          </span>
          <span className="text-white font-bold">{atl?.toFixed(1) ?? "—"}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-[2px] rounded-full inline-block" style={{ backgroundColor: tsbColor }} />
            <span style={{ color: tsbColor }}>Forma Fisica</span>
          </span>
          <span className="font-bold" style={{ color: tsbColor }}>
            {tsb !== null ? (tsb >= 0 ? "+" : "") + tsb.toFixed(1) : "—"}
          </span>
        </div>
        {trimp != null && trimp > 0 && (
          <div className="border-t border-[#1E293B] pt-1.5 flex justify-between gap-6">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-[2px] rounded-full inline-block" style={{ backgroundColor: CLR_TRIMP }} />
              <span style={{ color: CLR_TRIMP }}>TRIMP</span>
            </span>
            <span className="text-[#94A3B8] font-bold">{trimp.toFixed(0)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Componente principale ───────────────────────────────────────────────────

export function FitnessFreshness({ fitnessFreshness, currentFf, prevCtl }: FitnessFreshnessProps) {
  const [recalcLoading, setRecalcLoading] = useState(false);

  const ctl = currentFf?.ctl ?? 0;
  const atl = currentFf?.atl ?? 0;
  const tsb = currentFf?.tsb ?? 0;
  const ctlTrend = currentFf?.ctl_trend ?? (prevCtl !== null ? parseFloat((ctl - prevCtl).toFixed(1)) : null);
  const statusLabel = currentFf?.form_status ?? tsbStatusLabel(tsb);
  const statusColor = tsbStatusColor(tsb);

  // Ticks mensili per X-axis (prima occorrenza di ogni mese)
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

  return (
    <div className="bg-bg-card border border-[#1E293B] rounded-xl p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#3B82F6]" />
          <h2 className="text-lg font-bold tracking-wider uppercase text-text-primary">
            Fitness &amp; Freshness
          </h2>
          <span className="text-[10px] text-text-muted font-mono ml-1">(TRIMP Lucia)</span>
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

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* CTL */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: CLR_CTL }}>
            CTL · Condizione Fisica
          </div>
          <div className="text-5xl font-black mb-1" style={{ color: CLR_CTL }}>
            {ctl > 0 ? ctl.toFixed(1) : "—"}
          </div>
          {ctlTrend !== null && ctlTrend !== 0 && (
            <div className={`text-xs font-bold mt-2 ${ctlTrend >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
              {ctlTrend >= 0 ? "+" : ""}{ctlTrend} (7 giorni)
            </div>
          )}
          <div className="text-[10px] text-[#475569] mt-1">Chronic Training Load · 42gg</div>
        </div>

        {/* ATL */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: CLR_ATL }}>
            ATL · Affaticamento
          </div>
          <div className="text-5xl font-black mb-1" style={{ color: CLR_ATL }}>
            {atl > 0 ? atl.toFixed(1) : "—"}
          </div>
          {atl > 0 && ctlTrend !== null && (
            <div className="text-xs font-bold mt-2 text-[#F43F5E]">
              +{(atl - ctl).toFixed(1) > "0" ? (atl - ctl).toFixed(1) : Math.abs(atl - ctl).toFixed(1)} vs CTL
            </div>
          )}
          <div className="text-[10px] text-[#475569] mt-1">Acute Training Load · 7gg</div>
        </div>

        {/* TSB */}
        <div
          className="bg-[#0F172A] rounded-xl p-5 border"
          style={{ borderColor: statusColor + "40" }}
        >
          <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: statusColor }}>
            TSB · Forma Fisica
          </div>
          <div className="text-5xl font-black mb-1" style={{ color: statusColor }}>
            {currentFf ? (tsb >= 0 ? "+" : "") + tsb.toFixed(1) : "—"}
          </div>
          <div
            className="text-xs font-black uppercase tracking-widest mt-2 px-2 py-0.5 rounded-md inline-block"
            style={{ color: statusColor, backgroundColor: statusColor + "18" }}
          >
            {statusLabel}
          </div>
        </div>
      </div>

      {/* ── Grafico ── */}
      {fitnessFreshness && fitnessFreshness.length > 0 ? (
        <>
          {/* Legend */}
          <div className="flex gap-5 mb-3 text-[9px] font-semibold tracking-wider">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-[2.5px] rounded-full" style={{ backgroundColor: CLR_CTL }} />
              <span style={{ color: CLR_CTL }}>CONDIZIONE (CTL 42gg)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-[2px] rounded-full" style={{ backgroundColor: CLR_ATL }} />
              <span style={{ color: CLR_ATL }}>AFFATICAMENTO (ATL 7gg)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-[2px] rounded-full" style={{ backgroundColor: CLR_TSB }} />
              <span style={{ color: CLR_TSB }}>FORMA (TSB)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-[1.5px] rounded-full opacity-60" style={{ backgroundColor: CLR_TRIMP }} />
              <span className="opacity-60" style={{ color: CLR_TRIMP }}>TRIMP</span>
            </div>
          </div>

          <div style={{ height: 280 }}>
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
                />
                <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 3" strokeWidth={1} />
                <Tooltip
                  content={<FFTooltip />}
                  cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }}
                />
                {/* TRIMP (background, low opacity) */}
                <Line
                  type="monotone"
                  dataKey="trimp"
                  stroke={CLR_TRIMP}
                  strokeWidth={1}
                  strokeOpacity={0.35}
                  dot={false}
                  isAnimationActive={false}
                />
                {/* ATL */}
                <Line
                  type="monotone"
                  dataKey="atl"
                  stroke={CLR_ATL}
                  strokeWidth={1.5}
                  strokeOpacity={0.85}
                  dot={false}
                  isAnimationActive={false}
                />
                {/* TSB */}
                <Line
                  type="monotone"
                  dataKey="tsb"
                  stroke={CLR_TSB}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                {/* CTL (in cima, più spesso) */}
                <Line
                  type="monotone"
                  dataKey="ctl"
                  stroke={CLR_CTL}
                  strokeWidth={3}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* TSB status guide */}
          <div className="grid grid-cols-4 gap-3 mt-5 text-[10px]">
            {[
              { label: "Fresco", range: "TSB > 10", color: "#14B8A6", desc: "Pronto per gara/test" },
              { label: "Neutro", range: "TSB 0–10", color: "#F59E0B", desc: "Buon allenamento" },
              { label: "Affaticato", range: "TSB −10–0", color: "#8B5CF6", desc: "Mantieni il ritmo" },
              { label: "Sovrallenamento", range: "TSB < −10", color: "#F43F5E", desc: "Recupera" },
            ].map(({ label, range, color, desc }) => (
              <div
                key={label}
                className="rounded-lg px-3 py-2 border"
                style={{ borderColor: color + "30", backgroundColor: color + "08" }}
              >
                <div className="font-bold uppercase tracking-wider" style={{ color }}>{label}</div>
                <div className="text-text-muted mt-0.5">{range}</div>
                <div className="text-text-muted mt-0.5">{desc}</div>
              </div>
            ))}
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
