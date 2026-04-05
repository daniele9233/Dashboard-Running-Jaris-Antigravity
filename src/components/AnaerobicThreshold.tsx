import { useMemo } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  YAxis,
  XAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import type { Run } from "../types/api";

interface AnaerobicThresholdProps {
  runs: Run[];
  maxHr: number;
}

// ─── Tooltip personalizzato ──────────────────────────────────────────────────
const ThresholdTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const { name, value, aerobic, anaerobic } = payload[0].payload;
  return (
    <div className="bg-[#1E293B] border border-[#334155] px-4 py-3 rounded-xl shadow-2xl text-xs min-w-[160px]">
      <p className="text-[#C0FF00] font-bold mb-2 uppercase tracking-wider">{name}</p>
      <div className="space-y-1.5">
        <div className="flex justify-between gap-4">
          <span className="text-[#8B5CF6]">Soglia Anaerobica</span>
          <span className="text-white font-bold">{value} bpm</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[#14B8A6]">Soglia Aerobica</span>
          <span className="text-white font-bold">{aerobic} bpm</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-white/10 pt-1.5">
          <span className="text-text-muted">Zona Lattato</span>
          <span className="text-[#F59E0B] font-bold">{aerobic}–{anaerobic} bpm</span>
        </div>
      </div>
    </div>
  );
};

// ─── Component ──────────────────────────────────────────────────────────────

export function AnaerobicThreshold({ runs, maxHr }: AnaerobicThresholdProps) {
  const { monthData, currentThreshold, aerobicThreshold, delta, yMin, yMax } = useMemo(() => {
    const now = new Date();
    const safeMax = maxHr > 0 ? maxHr : 180;
    const thresholdFloor = Math.round(safeMax * 0.78);
    const thresholdCeil = Math.round(safeMax * 0.92);
    const aerobicFloor = Math.round(safeMax * 0.68);
    const aerobicCeil = Math.round(safeMax * 0.79);

    const data: { name: string; value: number; aerobic: number; anaerobic: number }[] = [];
    let curr = 0;
    let prev = 0;
    let aerobic = 0;

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);

      const monthRuns = runs.filter((r) => {
        const rd = new Date(r.date);
        return (
          rd.getFullYear() === d.getFullYear() &&
          rd.getMonth() === d.getMonth() &&
          r.avg_hr !== null &&
          r.avg_hr > 0
        );
      });

      const threshRuns = monthRuns.filter((r) => {
        const t = (r.run_type || "").toLowerCase();
        return t.includes("tempo") || t.includes("threshold") || t.includes("soglia");
      });

      const targetRuns =
        threshRuns.length > 0
          ? threshRuns
          : monthRuns.filter((r) => (r.avg_hr ?? 0) > safeMax * 0.75);

      let value = 0;
      let aerobicVal = 0;
      if (targetRuns.length > 0) {
        const avgHr =
          targetRuns.reduce((sum, r) => sum + (r.avg_hr ?? 0), 0) / targetRuns.length;
        value = Math.round(avgHr);
        aerobicVal = Math.round(avgHr * 0.86);
      } else if (monthRuns.length > 0) {
        const hrRuns = monthRuns.filter((r) => r.max_hr && r.max_hr > 0);
        const avgMax =
          hrRuns.length > 0
            ? hrRuns.reduce((sum, r) => sum + (r.max_hr ?? 0), 0) / hrRuns.length
            : safeMax;
        value = Math.round(avgMax * 0.88);
        aerobicVal = Math.round(avgMax * 0.76);
      } else {
        value = Math.round(safeMax * 0.85);
        aerobicVal = Math.round(safeMax * 0.73);
      }

      value = Math.max(thresholdFloor, Math.min(thresholdCeil, value));
      aerobicVal = Math.max(aerobicFloor, Math.min(aerobicCeil, aerobicVal));

      const monthName = d.toLocaleString("it", { month: "short" }).toUpperCase();
      data.push({ name: monthName, value, aerobic: aerobicVal, anaerobic: value });

      if (i === 0) { curr = value; aerobic = aerobicVal; }
      if (i === 1) prev = value;
    }

    const values = data.flatMap((d) => [d.value, d.aerobic]);
    const minV = Math.min(...values) - 8;
    const maxV = Math.max(...values) + 8;

    return {
      monthData: data,
      currentThreshold: curr,
      aerobicThreshold: aerobic,
      delta: curr - prev,
      yMin: minV,
      yMax: maxV,
    };
  }, [runs, maxHr]);

  return (
    <div className="bg-bg-card border border-[#1E293B] rounded-xl p-5 flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-[10px] text-text-muted font-semibold tracking-wider mb-1 uppercase">
            Zona Lattato · 12 Mesi
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text-primary">{currentThreshold}</span>
            <span className="text-sm text-text-muted">bpm</span>
            {delta !== 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                  delta >= 0 ? "text-[#8B5CF6] bg-[#8B5CF6]/10" : "text-[#F43F5E] bg-[#F43F5E]/10"
                }`}
              >
                {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)} bpm
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-text-muted uppercase tracking-wider mb-0.5">Aerobica</div>
          <div className="text-sm font-bold text-[#14B8A6]">{aerobicThreshold} bpm</div>
        </div>
      </div>

      {/* Zone labels */}
      <div className="flex gap-2 mb-3">
        <div className="flex items-center gap-1.5 text-[9px] font-semibold tracking-wider">
          <div className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
          <span className="text-[#8B5CF6]">ANAEROBICA</span>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] font-semibold tracking-wider">
          <div className="w-2 h-2 rounded-full bg-[#14B8A6]" />
          <span className="text-[#14B8A6]">AEROBICA</span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={monthData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradAnaerobic" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="gradAerobic" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#14B8A6" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#1E293B" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#475569", fontSize: 8 }}
              dy={6}
              interval={1}
            />
            <YAxis domain={[yMin, yMax]} hide />
            <Tooltip
              content={<ThresholdTooltip />}
              cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
            />
            {/* Reference lines for zones */}
            <ReferenceLine
              y={aerobicThreshold}
              stroke="#14B8A6"
              strokeDasharray="3 3"
              strokeOpacity={0.4}
            />
            {/* Aerobic zone area */}
            <Area
              type="monotone"
              dataKey="aerobic"
              stroke="#14B8A6"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#gradAerobic)"
              dot={false}
              isAnimationActive={false}
            />
            {/* Anaerobic threshold line */}
            <Area
              type="monotone"
              dataKey="value"
              stroke="#8B5CF6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#gradAnaerobic)"
              dot={{ r: 3, fill: "#8B5CF6", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#8B5CF6", stroke: "#C0FF00", strokeWidth: 1.5 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
