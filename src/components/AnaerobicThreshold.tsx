import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { Run } from "../types/api";

// ─── helpers ────────────────────────────────────────────────────────────────

function parsePaceSec(pace: string): number | null {
  if (!pace) return null;
  const parts = pace.split(":");
  if (parts.length < 2) return null;
  const v = parseInt(parts[0]) * 60 + parseInt(parts[1]);
  return v > 0 ? v : null;
}

function fmtPace(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── T-pace from VDOT ───────────────────────────────────────────────
function calcTPace(vdot: number): string {
  const a = 0.000104, b = 0.182258, c = -(vdot + 4.60);
  const vMax = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  const p = 1000 / (vMax * 0.88);
  return `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, "0")}`;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;
  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl px-3 py-2.5 shadow-2xl text-xs min-w-[180px]">
      <p className="text-[#C0FF00] font-bold mb-2 text-[10px] uppercase tracking-wider">{pt.label}</p>
      <div className="space-y-1.5">
        {pt.hr && (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#F43F5E] shrink-0" />
              <span className="text-gray-400">FC Media</span>
            </span>
            <span className="font-bold text-white">{pt.hr} bpm</span>
          </div>
        )}
        {pt.paceSec && (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#3B82F6] shrink-0" />
              <span className="text-gray-400">Passo</span>
            </span>
            <span className="font-bold text-white">{fmtPace(pt.paceSec)}/km</span>
          </div>
        )}
        {pt.distKm && (
          <div className="border-t border-[#1E293B] pt-1 text-gray-500">
            {pt.distKm.toFixed(1)} km
          </div>
        )}
      </div>
    </div>
  );
}

// Custom right-axis tick (pace) — formatted as mm:ss
function PaceTick({ x, y, payload }: any) {
  return (
    <text x={x + 4} y={y} fill="#475569" fontSize={9} textAnchor="start" dominantBaseline="middle">
      {fmtPace(payload.value)}
    </text>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { runs: Run[]; maxHr: number; vdot?: number | null; }

export function AnaerobicThreshold({ runs, maxHr, vdot }: Props) {
  const [timeRange, setTimeRange] = useState<"6m" | "12m" | "all">("all");

  const { points, hrMin, hrMax, paceDomain, paceTickValues, tPaceSec } = useMemo(() => {
    // Filter runs since April 2025, >= 1km (include intervals), with HR data
    const validRuns = runs
      .filter(r => {
        const rd = new Date(r.date);
        return rd >= new Date("2025-04-01") && r.distance_km >= 1 && r.avg_hr && r.avg_hr > 0;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Group into 2-month periods
    const periods: { label: string; runs: typeof validRuns }[] = [];
    const now = new Date();
    const startDate = new Date("2025-04-01");

    let current = new Date(startDate);
    while (current <= now) {
      const periodEnd = new Date(current);
      periodEnd.setMonth(periodEnd.getMonth() + 2);

      const periodRuns = validRuns.filter(r => {
        const rd = new Date(r.date);
        return rd >= current && rd < periodEnd;
      });

      if (periodRuns.length > 0) {
        const label = current.toLocaleDateString("it", { month: "short" }) + "–" +
          new Date(Math.min(periodEnd.getTime(), now.getTime())).toLocaleDateString("it", { month: "short" });
        periods.push({ label, runs: periodRuns });
      }

      current = periodEnd;
    }

    // For each period, pick the 6 best runs (highest avg_hr = most effort)
    const points = periods.map(period => {
      const sorted = [...period.runs].sort((a, b) => (b.avg_hr ?? 0) - (a.avg_hr ?? 0));
      const best = sorted.slice(0, 6);

      // Average HR and pace of best 6
      const avgHr = Math.round(best.reduce((s, r) => s + (r.avg_hr ?? 0), 0) / best.length);
      const paces = best.map(r => parsePaceSec(r.avg_pace)).filter((p): p is number => p !== null);
      const avgPace = paces.length > 0 ? Math.round(paces.reduce((a, b) => a + b, 0) / paces.length) : 0;
      const avgDist = best.reduce((s, r) => s + r.distance_km, 0) / best.length;

      return {
        label: period.label,
        hr: avgHr,
        paceSec: avgPace,
        distKm: avgDist,
      };
    });

    // Apply time range filter
    let filtered = points;
    if (timeRange === "6m") {
      filtered = points.slice(-3); // last 3 periods = 6 months
    } else if (timeRange === "12m") {
      filtered = points.slice(-6); // last 6 periods = 12 months
    }

    const hrs = filtered.map(p => p.hr);
    const paces = filtered.map(p => p.paceSec).filter(p => p > 0);

    const hrMin = hrs.length ? Math.min(...hrs) - 5 : 120;
    const hrMax = hrs.length ? Math.max(...hrs) + 5 : 180;
    const paceMin = paces.length ? Math.min(...paces) - 10 : 200;
    const paceMax = paces.length ? Math.max(...paces) + 10 : 400;

    // Ticks every 15s
    const paceTickValues: number[] = [];
    const step = 15;
    for (let v = Math.ceil(paceMin / step) * step; v <= paceMax; v += step) {
      paceTickValues.push(v);
    }

    const tPaceSec = vdot ? parsePaceSec(calcTPace(vdot)) : null;

    return {
      points: filtered,
      hrMin, hrMax,
      paceDomain: [paceMax, paceMin] as [number, number],
      paceTickValues,
      tPaceSec,
    };
  }, [runs, timeRange, vdot]);

  const safeMax = maxHr > 0 ? maxHr : 180;
  const latestPoint = points[points.length - 1];
  const currentHr = latestPoint?.hr ?? Math.round(safeMax * 0.85);
  const currentPace = latestPoint?.paceSec ?? 0;

  // Trend: compare first half vs second half
  const trend = (() => {
    if (points.length < 4) return 0;
    const half = Math.floor(points.length / 2);
    const firstPaces = points.slice(0, half).map(p => p.paceSec).filter(p => p > 0);
    const lastPaces = points.slice(half).map(p => p.paceSec).filter(p => p > 0);
    if (firstPaces.length === 0 || lastPaces.length === 0) return 0;
    const avg1 = firstPaces.reduce((a, b) => a + b, 0) / firstPaces.length;
    const avg2 = lastPaces.reduce((a, b) => a + b, 0) / lastPaces.length;
    return avg2 - avg1; // negative = improving (faster)
  })();

  const trendLabel = trend < -5
    ? "Miglioramento"
    : trend > 5
    ? "Peggioramento"
    : "Stabile";
  const trendColor = trend < -5 ? "text-emerald-400" : trend > 5 ? "text-rose-400" : "text-gray-400";
  const trendIcon = trend < -5 ? "↓" : trend > 5 ? "↑" : "→";

  return (
    <div className="bg-bg-card border border-[#1E293B] rounded-xl p-5 flex flex-col" style={{ minHeight: 320 }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] text-text-muted font-semibold tracking-wider uppercase flex items-center gap-1.5">
          Soglia Anaerobica
          <span className="w-3.5 h-3.5 rounded-full bg-white/10 text-[8px] text-gray-500 flex items-center justify-center cursor-default" title="6 migliori corse ogni 2 mesi (≥1km). FC = media FC, Passo = media passo delle migliori.">?</span>
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#1E1E1E] rounded-md border border-[#2A2A2A] p-0.5">
            {([
              ["6m", "6 mesi"],
              ["12m", "12 mesi"],
              ["all", "Tutto"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTimeRange(key)}
                className={`px-2.5 py-1 text-[10px] rounded transition-colors ${
                  timeRange === key ? "bg-[#2A2A2A] text-white font-medium" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-5 flex-1 min-h-0">
        {/* ── Left: current metrics ── */}
        <div className="flex flex-col justify-center gap-4 shrink-0 w-[140px]">

          <div>
            <div className="text-[9px] text-text-muted uppercase tracking-wider mb-1">FC Soglia</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-[#F43F5E]">{currentHr}</span>
              <span className="text-xs text-text-muted">bpm</span>
            </div>
          </div>

          {currentPace > 0 && (
            <div>
              <div className="text-[9px] text-[#3B82F6] uppercase tracking-wider mb-1">Passo Soglia</div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-white">{fmtPace(currentPace)}</span>
                <span className="text-xs text-text-muted">/km</span>
              </div>
            </div>
          )}

          <div>
            <div className="text-[9px] text-[#14B8A6] uppercase tracking-wider mb-0.5">Trend</div>
            <div className={`text-base font-black ${trendColor}`}>
              {trendIcon} {trendLabel}
            </div>
          </div>
        </div>

        {/* ── Right: chart ── */}
        <div className="flex-1 min-w-0" style={{ minHeight: 200 }}>
          {points.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-xs text-gray-600">Nessuna corsa ≥1km da Aprile 2025.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 6, right: 50, left: -10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#1E293B" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 9 }}
                  dy={4}
                  angle={-30}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  yAxisId="hr"
                  orientation="left"
                  domain={[hrMin, hrMax]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 9 }}
                  width={28}
                />
                <YAxis
                  yAxisId="pace"
                  orientation="right"
                  domain={paceDomain}
                  ticks={paceTickValues}
                  axisLine={false}
                  tickLine={false}
                  tick={<PaceTick />}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }} />

                {/* HR line */}
                <Line
                  yAxisId="hr"
                  type="monotone"
                  dataKey="hr"
                  stroke="#F43F5E"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: "#F43F5E", stroke: "#0F172A", strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: "#F43F5E", stroke: "#C0FF00", strokeWidth: 2 }}
                  connectNulls
                  isAnimationActive={false}
                  name="FC Media"
                />

                {/* Pace line */}
                <Line
                  yAxisId="pace"
                  type="monotone"
                  dataKey="paceSec"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: "#3B82F6", stroke: "#0F172A", strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: "#3B82F6", stroke: "#C0FF00", strokeWidth: 2 }}
                  connectNulls
                  isAnimationActive={false}
                  name="Passo"
                />

                {/* T-Pace reference line */}
                {vdot && tPaceSec && (
                  <ReferenceLine
                    yAxisId="pace"
                    y={tPaceSec}
                    stroke="#8B5CF6"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    label={{ value: "T-Pace", fill: "#8B5CF6", fontSize: 9, position: "insideTopRight" }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 mt-2 pt-2 border-t border-white/5">
        <span className="flex items-center gap-1.5 text-[10px] text-[#F43F5E]">
          <span className="w-2 h-2 rounded-full bg-[#F43F5E]" />
          FC Media
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-[#3B82F6]">
          <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
          Passo
        </span>
        {tPaceSec && (
          <span className="flex items-center gap-1.5 text-[10px] text-[#8B5CF6]">
            <span className="w-3 h-0 border-t border-dashed border-[#8B5CF6]" />
            T-Pace
          </span>
        )}
        <span className="ml-auto text-[9px] text-gray-500">
          6 migliori corse / 2 mesi
        </span>
      </div>
    </div>
  );
}
