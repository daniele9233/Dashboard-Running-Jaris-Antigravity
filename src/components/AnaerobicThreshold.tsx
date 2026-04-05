import { useMemo } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  YAxis,
  XAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { Run } from "../types/api";

interface AnaerobicThresholdProps {
  runs: Run[];
  maxHr: number;
  vdot?: number | null;
}

// ─── VDOT da una singola corsa (stessa formula di VO2MaxChart) ────────────────
function estimateMonthVdot(monthRuns: Run[]): number | null {
  let best: number | null = null;
  for (const r of monthRuns) {
    if (r.distance_km < 3 || r.duration_minutes <= 0 || r.duration_minutes < 10) continue;
    const v = (r.distance_km * 1000) / r.duration_minutes; // m/min
    const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v;
    const denom =
      0.8 +
      0.1894393 * Math.exp(-0.012778 * r.duration_minutes) +
      0.2989558 * Math.exp(-0.1932605 * r.duration_minutes);
    const vdot = vo2 / denom;
    if (vdot < 28 || vdot > 70) continue;
    if (best === null || vdot > best) best = parseFloat(vdot.toFixed(1));
  }
  return best;
}

// ─── T-pace (soglia Daniels 88% VO2max) da VDOT ─────────────────────────────
function calcTPaceFromVdot(vdot: number): string {
  const a = 0.000104, b = 0.182258, c = -(vdot + 4.60);
  const vMax = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  const vT = vMax * 0.88;
  const paceMin = 1000 / vT;
  const m = Math.floor(paceMin);
  const s = Math.round((paceMin % 1) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── E-pace (aerobica Daniels 70% VO2max) da VDOT ───────────────────────────
function calcEPaceFromVdot(vdot: number): string {
  const a = 0.000104, b = 0.182258, c = -(vdot + 4.60);
  const vMax = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  const vE = vMax * 0.70;
  const paceMin = 1000 / vE;
  const m = Math.floor(paceMin);
  const s = Math.round((paceMin % 1) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Tooltip (factory che chiude sul monthData per accedere al vdot per-mese) ─
function makeThresholdTooltip(
  monthVdots: Record<string, number | null>
) {
  return function ThresholdTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const { name, value, aerobic } = payload[0].payload;
    const monthVdot = monthVdots[name] ?? null;

    const tPace = monthVdot ? calcTPaceFromVdot(monthVdot) : null;
    const ePace = monthVdot ? calcEPaceFromVdot(monthVdot) : null;

    return (
      <div className="bg-[#1E293B] border border-[#334155] px-3 py-2 rounded-xl shadow-2xl text-xs min-w-[185px]">
        <p className="text-[#C0FF00] font-bold mb-1.5 uppercase tracking-wider">{name}</p>
        {monthVdot && (
          <p className="text-text-muted text-[10px] mb-1.5">VDOT {monthVdot}</p>
        )}
        <div className="space-y-1.5">
          <div className="flex justify-between gap-3">
            <span className="text-[#8B5CF6]">Soglia</span>
            <span className="text-white font-bold">{value} bpm</span>
          </div>
          {tPace && (
            <div className="flex justify-between gap-3">
              <span className="text-[#8B5CF6] text-[10px]">T-pace</span>
              <span className="text-[#C0FF00] font-black">{tPace}/km</span>
            </div>
          )}
          <div className="border-t border-[#334155] pt-1.5 flex justify-between gap-3">
            <span className="text-[#14B8A6]">Aerobica</span>
            <span className="text-white font-bold">
              {aerobic} bpm{ePace ? ` · ${ePace}/km` : ""}
            </span>
          </div>
        </div>
      </div>
    );
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AnaerobicThreshold({ runs, maxHr, vdot }: AnaerobicThresholdProps) {
  const { monthData, monthVdots, currentThreshold, currentMonthVdot, aerobicThreshold, delta, yMin, yMax } = useMemo(() => {
    const now = new Date();
    const safeMax = maxHr > 0 ? maxHr : 180;
    const thresholdFloor = Math.round(safeMax * 0.78);
    const thresholdCeil = Math.round(safeMax * 0.92);
    const aerobicFloor = Math.round(safeMax * 0.68);
    const aerobicCeil = Math.round(safeMax * 0.79);

    const data: { name: string; value: number; aerobic: number; anaerobic: number }[] = [];
    const vdotMap: Record<string, number | null> = {};
    let curr = 0;
    let prev = 0;
    let aerobic = 0;
    let currMonthVdot: number | null = null;

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);

      // Tutte le corse del mese (con HR per la soglia, tutte per VDOT)
      const allMonthRuns = runs.filter((r) => {
        const rd = new Date(r.date);
        return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
      });

      const hrMonthRuns = allMonthRuns.filter((r) => r.avg_hr !== null && r.avg_hr > 0);

      // VDOT per-mese dal dataset reale Strava
      const monthVdot = estimateMonthVdot(allMonthRuns);

      const threshRuns = hrMonthRuns.filter((r) => {
        const t = (r.run_type || "").toLowerCase();
        return t.includes("tempo") || t.includes("threshold") || t.includes("soglia");
      });

      const targetRuns =
        threshRuns.length > 0
          ? threshRuns
          : hrMonthRuns.filter((r) => (r.avg_hr ?? 0) > safeMax * 0.75);

      let value = 0;
      let aerobicVal = 0;
      if (targetRuns.length > 0) {
        const avgHr = targetRuns.reduce((sum, r) => sum + (r.avg_hr ?? 0), 0) / targetRuns.length;
        value = Math.round(avgHr);
        aerobicVal = Math.round(avgHr * 0.86);
      } else if (hrMonthRuns.length > 0) {
        const hrRuns = hrMonthRuns.filter((r) => r.max_hr && r.max_hr > 0);
        const avgMax = hrRuns.length > 0
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
      vdotMap[monthName] = monthVdot;

      if (i === 0) { curr = value; aerobic = aerobicVal; currMonthVdot = monthVdot; }
      if (i === 1) prev = value;
    }

    const values = data.flatMap((d) => [d.value, d.aerobic]);

    return {
      monthData: data,
      monthVdots: vdotMap,
      currentThreshold: curr,
      currentMonthVdot: currMonthVdot,
      aerobicThreshold: aerobic,
      delta: curr - prev,
      yMin: Math.min(...values) - 8,
      yMax: Math.max(...values) + 8,
    };
  }, [runs, maxHr]);

  const safeMax = maxHr > 0 ? maxHr : 180;

  // Pace corrente: usa VDOT del mese corrente se disponibile, poi VDOT globale analytics,
  // entrambi basati su corse reali Strava — si aggiorna ad ogni sync
  const effectiveVdot = currentMonthVdot ?? vdot ?? null;
  const thresholdPace = effectiveVdot ? calcTPaceFromVdot(effectiveVdot) : null;
  const aerobicPace = effectiveVdot ? calcEPaceFromVdot(effectiveVdot) : null;

  return (
    <div className="bg-bg-card border border-[#1E293B] rounded-xl p-5 flex flex-col" style={{ minHeight: 220 }}>
      <h3 className="text-[10px] text-text-muted font-semibold tracking-wider mb-4 uppercase">
        Zona Lattato · 12 Mesi
      </h3>

      <div className="flex gap-8 flex-1 min-h-0">
        {/* Left — metrics */}
        <div className="flex flex-col justify-center gap-5 shrink-0 w-[200px]">
          <div>
            <div className="text-[9px] text-text-muted uppercase tracking-wider mb-1">Soglia Anaerobica</div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-[#8B5CF6]">{currentThreshold}</span>
              <span className="text-base text-text-muted">bpm</span>
              {delta !== 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${delta >= 0 ? "text-[#8B5CF6] bg-[#8B5CF6]/10" : "text-[#F43F5E] bg-[#F43F5E]/10"}`}>
                  {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}
                </span>
              )}
            </div>
          </div>

          {thresholdPace && (
            <div>
              <div className="text-[9px] text-text-muted uppercase tracking-wider mb-1">
                T-Pace · Soglia
                {effectiveVdot && (
                  <span className="ml-1 text-[#8B5CF6]">(VDOT {effectiveVdot})</span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-white">{thresholdPace}</span>
                <span className="text-base text-text-muted">/km</span>
              </div>
            </div>
          )}

          <div>
            <div className="text-[9px] text-[#14B8A6] uppercase tracking-wider mb-0.5">Aerobica (E-pace)</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-[#14B8A6]">{aerobicThreshold}</span>
              <span className="text-sm text-text-muted">bpm</span>
              {aerobicPace && (
                <span className="text-sm font-bold text-[#14B8A6]">· {aerobicPace}/km</span>
              )}
            </div>
          </div>
        </div>

        {/* Right — chart */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex gap-3 mb-2">
            <div className="flex items-center gap-1.5 text-[9px] font-semibold tracking-wider">
              <div className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
              <span className="text-[#8B5CF6]">ANAEROBICA</span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-semibold tracking-wider">
              <div className="w-2 h-2 rounded-full bg-[#14B8A6]" />
              <span className="text-[#14B8A6]">AEROBICA</span>
            </div>
          </div>
          <div className="flex-1" style={{ minHeight: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
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
                  tick={{ fill: "#475569", fontSize: 9 }}
                  dy={6}
                  interval={0}
                />
                <YAxis domain={[yMin, yMax]} hide />
                <Tooltip
                  content={makeThresholdTooltip(monthVdots)}
                  cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
                />
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
      </div>
    </div>
  );
}
