import { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Area,
} from "recharts";
import type { Run } from "../types/api";

// ─── helpers ─────────────────────────────────────────────────────────────────

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

// ─── T-pace & E-pace from VDOT ───────────────────────────────────────────────
function calcTPace(vdot: number): string {
  const a = 0.000104, b = 0.182258, c = -(vdot + 4.60);
  const vMax = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  const p = 1000 / (vMax * 0.88);
  return `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, "0")}`;
}
function calcEPace(vdot: number): string {
  const a = 0.000104, b = 0.182258, c = -(vdot + 4.60);
  const vMax = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  const p = 1000 / (vMax * 0.70);
  return `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, "0")}`;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;
  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl px-3 py-2.5 shadow-2xl text-xs min-w-[180px]">
      <p className="text-[#C0FF00] font-bold mb-2 text-[10px] uppercase tracking-wider">{pt.date}</p>
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
  const { points, hrMin, hrMax, paceDomain, paceTickValues, trend, bestPace, bestHr } = useMemo(() => {
    // Filter runs since April 2025, >= 3km, with HR data
    const validRuns = runs
      .filter(r => {
        const rd = new Date(r.date);
        return rd >= new Date("2025-04-01") && r.distance_km >= 3 && r.avg_hr && r.avg_hr > 0;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const points = validRuns.map(r => ({
      date: new Date(r.date).toLocaleDateString("it", { day: "numeric", month: "short" }),
      fullDate: r.date,
      hr: r.avg_hr ?? 0,
      paceSec: parsePaceSec(r.avg_pace) ?? 0,
      distKm: r.distance_km,
    })).filter(p => p.paceSec > 0);

    const hrs = points.map(p => p.hr);
    const paces = points.map(p => p.paceSec);

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

    // Trend: linear regression on pace over time
    let trend = 0;
    if (paces.length >= 4) {
      const n = paces.length;
      const xMean = (n - 1) / 2;
      const yMean = paces.reduce((a, b) => a + b, 0) / n;
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) {
        num += (i - xMean) * (paces[i] - yMean);
        den += (i - xMean) ** 2;
      }
      if (den > 0) {
        trend = num / den; // negative = improving (faster), positive = worsening
      }
    }

    const bestPace = paces.length ? Math.min(...paces) : 0;
    const bestHr = hrs.length ? Math.max(...hrs) : 0;

    return {
      points,
      hrMin, hrMax,
      paceDomain: [paceMax, paceMin] as [number, number],
      paceTickValues,
      trend,
      bestPace,
      bestHr,
    };
  }, [runs]);

  const safeMax = maxHr > 0 ? maxHr : 180;
  const latestPoint = points[points.length - 1];
  const currentHr = latestPoint?.hr ?? Math.round(safeMax * 0.85);
  const currentPace = latestPoint?.paceSec ?? 0;
  const aerobicHr = Math.round(safeMax * 0.75);

  const tPace = vdot ? calcTPace(vdot) : null;
  const ePace = vdot ? calcEPace(vdot) : null;

  // Trend label
  const trendLabel = trend < -0.5
    ? "Miglioramento"
    : trend > 0.5
    ? "Peggioramento"
    : "Stabile";
  const trendColor = trend < -0.5 ? "text-emerald-400" : trend > 0.5 ? "text-rose-400" : "text-gray-400";
  const trendIcon = trend < -0.5 ? "↓" : trend > 0.5 ? "↑" : "→";

  return (
    <div className="bg-bg-card border border-[#1E293B] rounded-xl p-5 flex flex-col" style={{ minHeight: 300 }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] text-text-muted font-semibold tracking-wider uppercase flex items-center gap-1.5">
          Soglia Anaerobica
          <span className="w-3.5 h-3.5 rounded-full bg-white/10 text-[8px] text-gray-500 flex items-center justify-center cursor-default" title="Tutte le corse ≥3km da Aprile 2025. FC sinistra, Passo destra — più in alto = più veloce.">?</span>
        </h3>
        <span className="text-[9px] text-gray-600 uppercase tracking-wider">Tutte le corse · ≥3 km · da Apr 2025</span>
      </div>

      <div className="flex gap-5 flex-1 min-h-0">
        {/* ── Left: current metrics ── */}
        <div className="flex flex-col justify-center gap-4 shrink-0 w-[160px]">

          <div>
            <div className="text-[9px] text-text-muted uppercase tracking-wider mb-1">FC Ultima Corsa</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-black text-[#F43F5E]">{currentHr}</span>
              <span className="text-sm text-text-muted">bpm</span>
            </div>
          </div>

          {currentPace > 0 && (
            <div>
              <div className="text-[9px] text-[#3B82F6] uppercase tracking-wider mb-1">Passo Ultima Corsa</div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">{fmtPace(currentPace)}</span>
                <span className="text-sm text-text-muted">/km</span>
              </div>
            </div>
          )}

          {tPace && (
            <div>
              <div className="text-[9px] text-[#8B5CF6] uppercase tracking-wider mb-1">
                T-Pace {vdot ? `· VDOT ${vdot}` : ""}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-[#8B5CF6]">{tPace}</span>
                <span className="text-sm text-text-muted">/km</span>
              </div>
            </div>
          )}

          <div>
            <div className="text-[9px] text-[#14B8A6] uppercase tracking-wider mb-0.5">Trend</div>
            <div className={`text-lg font-black ${trendColor}`}>
              {trendIcon} {trendLabel}
            </div>
          </div>
        </div>

        {/* ── Right: chart ── */}
        <div className="flex-1 min-w-0" style={{ minHeight: 200 }}>
          {points.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-xs text-gray-600">Nessuna corsa ≥3km da Aprile 2025.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 6, right: 50, left: -20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#1E293B" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 8 }}
                  dy={4}
                  interval={Math.max(0, Math.floor(points.length / 12) - 1)}
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

                {/* Pace dots — size based on distance */}
                <Scatter
                  yAxisId="pace"
                  dataKey="paceSec"
                  data={points}
                  fill="#3B82F6"
                  shape={(props: any) => {
                    const { cx, cy, payload } = props;
                    const r = Math.max(3, Math.min(7, payload.distKm / 2));
                    return <circle cx={cx} cy={cy} r={r} fill="#3B82F6" fillOpacity={0.6} stroke="#3B82F6" strokeWidth={1} />;
                  }}
                />

                {/* HR dots — size based on distance */}
                <Scatter
                  yAxisId="hr"
                  dataKey="hr"
                  data={points}
                  fill="#F43F5E"
                  shape={(props: any) => {
                    const { cx, cy, payload } = props;
                    const r = Math.max(3, Math.min(7, payload.distKm / 2));
                    return <circle cx={cx} cy={cy} r={r} fill="#F43F5E" fillOpacity={0.6} stroke="#F43F5E" strokeWidth={1} />;
                  }}
                />

                {/* T-Pace reference line */}
                {vdot && tPace && (() => {
                  const tp = parsePaceSec(tPace);
                  return tp ? <ReferenceLine yAxisId="pace" y={tp} stroke="#8B5CF6" strokeDasharray="4 3" label={{ value: "T-Pace", fill: "#8B5CF6", fontSize: 9, position: "insideTopRight" }} /> : null;
                })()}
              </ScatterChart>
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
        {tPace && (
          <span className="flex items-center gap-1.5 text-[10px] text-[#8B5CF6]">
            <span className="w-3 h-0 border-t border-dashed border-[#8B5CF6]" />
            T-Pace
          </span>
        )}
        <span className="ml-auto text-[9px] text-gray-500">
          Dim. punto = distanza · più in alto = più veloce
        </span>
      </div>
    </div>
  );
}
