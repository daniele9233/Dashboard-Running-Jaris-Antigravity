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
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const monthRuns = runs.filter((r) => {
      const rd = new Date(r.date);
      return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
    });
    let best: number | null = null;
    for (const r of monthRuns) {
      if (r.distance_km < 3) continue;
      const v = estimateVdot(r.distance_km, r.duration_minutes);
      if (v !== null && (best === null || v > best)) best = v;
    }
    return {
      name: d.toLocaleString("it", { month: "short" }).toUpperCase(),
      vdot: best,
    };
  });
}

// ─── Training zones from VDOT ─────────────────────────────────────────────────
function buildZones(vdot: number) {
  // Based on Jack Daniels pace zones
  const threshold = vdot; // VDOT is threshold intensity
  const easyPctMin = 0.59;
  const easyPctMax = 0.74;
  const tempoPct = 0.88;
  const intervalPct = 0.98;

  // Reverse-engineer pace from VDOT: pace_per_km = 1000 / v_m_per_min
  // v at VO2max ≈ vdot / 0.8 * 1/0.182258 approx
  const v_max = (vdot * 1.25 + 4.6) / 0.182258;

  function toPace(pct: number) {
    const v = v_max * pct;
    const paceMin = 1000 / v;
    const m = Math.floor(paceMin);
    const s = Math.round((paceMin % 1) * 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  return [
    { name: "Easy", range: `${toPace(easyPctMin)}–${toPace(easyPctMax)}/km`, color: "#14B8A6" },
    { name: "Soglia", range: `${toPace(tempoPct)}/km`, color: "#3B82F6" },
    { name: "Intervalli", range: `${toPace(intervalPct)}/km`, color: "#F59E0B" },
    { name: "Gara 5K", range: `${toPace(1.02)}/km`, color: "#F43F5E" },
  ];
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
  return (
    <div className="bg-[#1E293B] border border-[#334155] px-3 py-2 rounded-xl shadow-xl text-xs">
      <p className="text-[#C0FF00] font-bold mb-1">{label}</p>
      <p className="text-white font-black">VDOT {v}</p>
      <p className="text-text-muted">{vdotLabel(v)}</p>
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

  const displayVdot = vdot ?? filledHistory[filledHistory.length - 1]?.vdot ?? null;
  const color = displayVdot ? vdotColor(displayVdot) : "#94A3B8";
  const label = displayVdot ? vdotLabel(displayVdot) : "—";
  const zones = displayVdot ? buildZones(displayVdot) : [];

  // Trend vs 3 months ago
  const recent = filledHistory[filledHistory.length - 1]?.vdot;
  const older = filledHistory[filledHistory.length - 4]?.vdot;
  const trend = recent != null && older != null ? parseFloat((recent - older).toFixed(1)) : null;

  return (
    <div className="bg-bg-card border border-[#1E293B] rounded-xl p-5 flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] text-text-muted font-semibold tracking-wider uppercase">
          VO2 Max / VDOT
        </h3>
        {trend !== null && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${trend >= 0 ? "text-[#14B8A6] bg-[#14B8A6]/10" : "text-[#F43F5E] bg-[#F43F5E]/10"}`}>
            {trend >= 0 ? "+" : ""}{trend} (3M)
          </span>
        )}
      </div>

      {/* Gauge + level */}
      {displayVdot ? (
        <div className="flex flex-col items-center gap-1">
          <VdotGauge value={displayVdot} color={color} />
          <div className="text-xs font-black uppercase tracking-widest" style={{ color }}>
            {label}
          </div>
          <div className="text-[9px] text-text-muted">ml/kg/min · Jack Daniels</div>
        </div>
      ) : (
        <div className="text-center py-4">
          <div className="text-2xl font-black text-text-muted">—</div>
          <div className="text-[10px] text-text-muted mt-1">Aggiungi corse per calcolare</div>
        </div>
      )}

      {/* Training zones */}
      {zones.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[9px] text-text-muted font-semibold tracking-wider uppercase mb-1">
            Zone di allenamento
          </div>
          {zones.map((z) => (
            <div key={z.name} className="flex justify-between items-center text-[10px]">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: z.color }} />
                <span className="text-text-secondary">{z.name}</span>
              </div>
              <span className="font-mono font-medium" style={{ color: z.color }}>{z.range}</span>
            </div>
          ))}
        </div>
      )}

      {/* History chart */}
      <div className="flex-1 min-h-[80px]">
        <div className="text-[9px] text-text-muted font-semibold tracking-wider uppercase mb-1.5">
          Storico 12 mesi
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filledHistory} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
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
              tick={{ fill: "#475569", fontSize: 7 }}
              dy={4}
              interval={2}
            />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)" }} />
            <Area
              type="monotone"
              dataKey="vdot"
              stroke={color}
              strokeWidth={2}
              fill="url(#vo2Grad)"
              dot={{ r: 2.5, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: color, stroke: "#fff", strokeWidth: 1 }}
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
