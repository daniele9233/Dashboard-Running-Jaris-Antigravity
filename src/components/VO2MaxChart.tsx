import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Run } from "../types/api";

interface VO2MaxChartProps {
  runs: Run[];
  vdot: number | null;
}

// ─── VDOT estimate from a single run ─────────────────────────────────────────
function estimateVdot(distanceKm: number, durationMin: number): number | null {
  if (distanceKm <= 0 || durationMin <= 0 || durationMin < 10) return null;
  const v = (distanceKm * 1000) / durationMin;
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v;
  const denom =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * durationMin) +
    0.2989558 * Math.exp(-0.1932605 * durationMin);
  const vdot = vo2 / denom;
  if (vdot < 30 || vdot > 65) return null;
  return parseFloat(vdot.toFixed(1));
}

// ─── Color by VDOT level ──────────────────────────────────────────────────────
function vdotColor(v: number): string {
  if (v > 55) return "#C0FF00";
  if (v > 45) return "#14B8A6";
  if (v > 35) return "#3B82F6";
  return "#94A3B8";
}

function vdotLabel(v: number): string {
  if (v > 55) return "Elite";
  if (v > 45) return "Avanzato";
  if (v > 35) return "Intermedio";
  return "Principiante";
}

// ─── Build monthly VDOT history ───────────────────────────────────────────────
function buildHistory(runs: Run[]) {
  const now = new Date();

  // Step 1 — raw best VDOT per month
  const raw = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const monthRuns = runs.filter((r) => {
      const rd = new Date(r.date);
      return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
    });
    let best: number | null = null;
    for (const r of monthRuns) {
      if (r.distance_km < 5) continue;
      // If HR available, require >= 80% effort; otherwise stricter pace (≤ 5:45)
      const paceMinKm = r.duration_minutes / r.distance_km;
      if (r.avg_hr_pct !== null && r.avg_hr_pct !== undefined) {
        if (r.avg_hr_pct < 0.80) continue; // corsa facile con HR disponibile
      } else {
        if (paceMinKm > 5.75) continue; // senza HR, escludi ritmi troppo lenti
      }
      const v = estimateVdot(r.distance_km, r.duration_minutes);
      if (v !== null && (best === null || v > best)) best = v;
    }
    return {
      name: d.toLocaleString("it", { month: "short" }).toUpperCase(),
      vdot: best,
    };
  });

  // Step 2 — keep all months with qualifying runs (no artificial floor).
  // Forward-fill handles gaps when athlete had no qualifying runs that month.
  return raw;
}

// ─── T-Pace (soglia) da VDOT ─────────────────────────────────────────────────
function calcTPace(vdot: number): string {
  // Daniels T pace = 88% VO2max intensity
  // vMax in m/min che produce VO2max: solve 0.000104*v^2 + 0.182258*v - (vdot+4.60) = 0
  const a = 0.000104, b = 0.182258, c = -(vdot + 4.60);
  const vMax = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  const vT = vMax * 0.88; // T pace velocity
  const paceMin = 1000 / vT;
  const m = Math.floor(paceMin);
  const s = Math.round((paceMin % 1) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Semi-circular gauge SVG ──────────────────────────────────────────────────
function VdotGauge({ value, color }: { value: number; color: string }) {
  const min = 28;
  const max = 65;
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const r = 52;
  const cx = 70;
  const cy = 70;
  const startAngle = 180;
  const endAngle = 0;
  const totalArc = 180;
  const arcDeg = pct * totalArc;

  function polarToXY(cx: number, cy: number, r: number, deg: number) {
    const rad = (deg * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy - r * Math.sin(rad),
    };
  }

  const start = polarToXY(cx, cy, r, startAngle);
  const end = polarToXY(cx, cy, r, startAngle - arcDeg);
  const bgEnd = polarToXY(cx, cy, r, endAngle);

  const bgPath = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${bgEnd.x} ${bgEnd.y}`;
  const fgPath =
    arcDeg > 0
      ? `M ${start.x} ${start.y} A ${r} ${r} 0 ${arcDeg > 180 ? 1 : 0} 1 ${end.x} ${end.y}`
      : "";

  return (
    <svg viewBox="0 0 140 80" className="w-full max-w-[180px]">
      {/* Background arc */}
      <path d={bgPath} fill="none" stroke="#1E293B" strokeWidth={10} strokeLinecap="round" />
      {/* Value arc */}
      {fgPath && (
        <path d={fgPath} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />
      )}
      {/* Zone markers */}
      {[35, 45, 55].map((v) => {
        const p = (v - min) / (max - min);
        const deg = startAngle - p * totalArc;
        const pt = polarToXY(cx, cy, r, deg);
        return (
          <circle key={v} cx={pt.x} cy={pt.y} r={2.5} fill="#334155" />
        );
      })}
      {/* Center value text */}
      <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize={26} fontWeight={900} fontFamily="sans-serif">
        {value}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="#64748B" fontSize={9} fontFamily="sans-serif" fontWeight={600} letterSpacing={1}>
        VO2MAX
      </text>
    </svg>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  if (!v) return null;
  const pace = calcTPace(v);
  return (
    <div className="bg-[#1E293B] border border-[#334155] px-3 py-2 rounded-xl shadow-xl text-xs min-w-[150px]">
      <p className="text-[#C0FF00] font-bold mb-1">{label}</p>
      <p className="text-white font-black text-base">VDOT {v}</p>
      <p className="text-text-muted text-[10px]">{vdotLabel(v)}</p>
      <div className="border-t border-[#334155] mt-1.5 pt-1.5 flex justify-between gap-3">
        <span className="text-text-muted">T-Pace</span>
        <span className="text-[#C0FF00] font-black">{pace}/km</span>
      </div>
    </div>
  );
};

// ─── Component ──────────────────────────────────────────────────────────────

export function VO2MaxChart({ runs, vdot }: VO2MaxChartProps) {
  const history = useMemo(() => buildHistory(runs), [runs]);

  // Forward-fill nulls
  const filledHistory = useMemo(() => {
    const arr = [...history];
    let last: number | null = null;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].vdot !== null) last = arr[i].vdot;
      else if (last !== null) arr[i] = { ...arr[i], vdot: last };
    }
    return arr;
  }, [history]);

  // Force the last month's point to match the real current VDOT from API
  // so gauge and chart always agree.
  const filledWithCurrent = useMemo(() => {
    if (!vdot || filledHistory.length === 0) return filledHistory;
    const arr = [...filledHistory];
    arr[arr.length - 1] = { ...arr[arr.length - 1], vdot };
    return arr;
  }, [filledHistory, vdot]);

  const displayVdot = vdot ?? filledWithCurrent[filledWithCurrent.length - 1]?.vdot ?? null;
  const color = displayVdot ? vdotColor(displayVdot) : "#94A3B8";
  const label = displayVdot ? vdotLabel(displayVdot) : "—";
  const tPace = displayVdot ? calcTPace(displayVdot) : null;

  // Trend vs 3 months ago
  const recent = filledWithCurrent[filledWithCurrent.length - 1]?.vdot;
  const older = filledWithCurrent[filledWithCurrent.length - 4]?.vdot;
  const trend = recent != null && older != null ? parseFloat((recent - older).toFixed(1)) : null;

  return (
    <div className="bg-bg-card border border-[#1E293B] rounded-xl p-5 flex flex-col" style={{ minHeight: 220 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] text-text-muted font-semibold tracking-wider uppercase">
          VO2 Max / VDOT
        </h3>
        {trend !== null && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${trend >= 0 ? "text-[#14B8A6] bg-[#14B8A6]/10" : "text-[#F43F5E] bg-[#F43F5E]/10"}`}>
            {trend >= 0 ? "+" : ""}{trend} (3M)
          </span>
        )}
      </div>

      {/* Horizontal layout: gauge+metrics left, chart right */}
      <div className="flex gap-8 flex-1 min-h-0">
        {/* Left — gauge + metrics */}
        <div className="flex flex-col items-center justify-center gap-3 shrink-0 w-[220px]">
          {displayVdot ? (
            <>
              <VdotGauge value={displayVdot} color={color} />
              <div className="text-sm font-black uppercase tracking-widest" style={{ color }}>{label}</div>
              <div className="text-[9px] text-text-muted">ml/kg/min · Jack Daniels</div>
              {tPace && (
                <div className="flex flex-col items-center mt-1">
                  <div className="text-[9px] text-text-muted uppercase tracking-wider mb-0.5">Pace Soglia (T)</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">{tPace}</span>
                    <span className="text-base text-text-muted">/km</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <div className="text-2xl font-black text-text-muted">—</div>
              <div className="text-[10px] text-text-muted mt-1">Aggiungi corse per calcolare</div>
            </div>
          )}
        </div>

        {/* Right — history chart */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="text-[9px] text-text-muted font-semibold tracking-wider uppercase mb-2">
            Storico 12 mesi
          </div>
          <div className="flex-1" style={{ minHeight: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filledWithCurrent} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="vo2Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#1E293B" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 9 }}
                  dy={4}
                  interval={0}
                />
                <YAxis hide domain={["auto", "auto"]} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)" }} />
                <Area
                  type="monotone"
                  dataKey="vdot"
                  stroke={color}
                  strokeWidth={2}
                  fill="url(#vo2Grad)"
                  dot={{ r: 3, fill: color, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: color, stroke: "#fff", strokeWidth: 1.5 }}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
