import React, { useState, useMemo, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis, ReferenceLine } from "recharts";
import type { FitnessFreshnessPoint, Run, ProAnalyticsChart } from "../../types/api";
import { WeeklyKmChart } from "../dashboard/widgets/WeeklyKmChart";

// ─── TYPES ───────────────────────────────────────────────────────────────────

type FFRange = "1m" | "3m" | "6m" | "1y" | "2y";
const FF_RANGE_DAYS: Record<FFRange, number> = { "1m": 30, "3m": 90, "6m": 182, "1y": 365, "2y": 730 };

export interface CaricoFormaV2Props {
  ffHistory: FitnessFreshnessPoint[];
  kmRuns: Run[];
  paceDistributionChart?: ProAnalyticsChart;
  effortMatrixChart?: ProAnalyticsChart;
}

// ─── MAIN MULTI-LINE SVG CHART ────────────────────────────────────────────────

const CHART_LINES = [
  { key: "ctl" as const, label: "CTL",  color: "#F97316", gradId: "v2CtlGrad" },
  { key: "atl" as const, label: "ATL",  color: "#F43F5E", gradId: "v2AtlGrad" },
  { key: "tsb" as const, label: "TSB",  color: "#C0FF00", gradId: "v2TsbGrad" },
] as const;

function FitnessMultiChart({ ff }: { ff: FitnessFreshnessPoint[] }) {
  const [range, setRange] = useState<FFRange>("3m");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [focus, setFocus] = useState<"all" | "ctl" | "atl" | "tsb">("all");
  const svgRef = useRef<SVGSVGElement>(null);

  const data = useMemo(() => {
    if (!ff?.length) return [] as FitnessFreshnessPoint[];
    const cutoff = Date.now() - FF_RANGE_DAYS[range] * 86400000;
    return ff
      .filter(p => new Date(p.date).getTime() >= cutoff)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [ff, range]);

  const W = 1000, H = 260;
  const padL = 44, padR = 20, padT = 20, padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const { maxY, minY } = useMemo(() => {
    if (!data.length) return { maxY: 80, minY: -30 };
    const all = data.flatMap(d => [d.ctl, d.atl, d.tsb]);
    const mx = Math.ceil((Math.max(...all) + 8) / 10) * 10;
    const mn = Math.floor((Math.min(...all) - 8) / 10) * 10;
    return { maxY: Math.max(mx, 20), minY: Math.min(mn, -10) };
  }, [data]);

  const x  = (i: number) => padL + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y  = (v: number) => padT + (1 - (v - minY) / (maxY - minY || 1)) * plotH;
  const y0 = y(0);

  const buildLine = (key: "ctl" | "atl" | "tsb") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(" ");

  const buildArea = (key: "ctl" | "atl") => {
    if (!data.length) return "";
    const top = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(" ");
    return `${top} L ${x(data.length - 1).toFixed(1)} ${y0} L ${padL.toFixed(1)} ${y0} Z`;
  };

  const yTicks = useMemo(() => {
    const step = Math.max(10, Math.ceil((maxY - minY) / 5 / 10) * 10);
    const arr: number[] = [];
    for (let v = minY; v <= maxY; v += step) arr.push(v);
    return arr;
  }, [maxY, minY]);

  const xLabels = useMemo(() => {
    if (data.length < 2) return [] as { i: number; label: string }[];
    const want = 6;
    const step = Math.max(1, Math.floor(data.length / want));
    const out: { i: number; label: string }[] = [];
    const fmt = (s: string) =>
      new Date(s).toLocaleDateString("it", { month: "short", day: "numeric" }).replace(".", "");
    for (let i = 0; i < data.length; i += step) out.push({ i, label: fmt(data[i].date) });
    if (data.length && out[out.length - 1]?.i !== data.length - 1)
      out.push({ i: data.length - 1, label: "Oggi" });
    return out;
  }, [data]);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!data.length || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const rel = (px - padL) / plotW;
    setHoverIdx(Math.max(0, Math.min(data.length - 1, Math.round(rel * (data.length - 1)))));
  };

  const hov = hoverIdx !== null ? data[hoverIdx] ?? null : null;

  return (
    <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6 flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-white text-lg font-black tracking-tight">Fitness · Fatica · Forma</h3>
          <p className="text-[#A0A0A0] text-[11px] tracking-wide mt-0.5">CTL · ATL · TSB nel tempo</p>
        </div>
        <div className="flex gap-1 bg-[#111] border border-white/[0.06] rounded-full p-1">
          {(["1m", "3m", "6m", "1y", "2y"] as FFRange[]).map(k => (
            <button
              key={k}
              onClick={() => { setRange(k); setHoverIdx(null); }}
              className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase transition-colors ${range === k ? "bg-[#C0FF00] text-black" : "text-[#A0A0A0] hover:text-white"}`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* Legend / focus toggles */}
      <div className="flex items-center gap-2 flex-wrap">
        {CHART_LINES.map(l => {
          const active = focus === "all" || focus === l.key;
          return (
            <button
              key={l.key}
              onClick={() => setFocus(focus === l.key ? "all" : l.key)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase transition-all"
              style={{
                background: active ? `${l.color}18` : "transparent",
                color: active ? l.color : "#555",
                border: `1px solid ${active ? `${l.color}30` : "transparent"}`,
              }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: active ? l.color : "#555" }} />
              {l.label}
            </button>
          );
        })}
      </div>

      {/* SVG Chart */}
      <div className="relative min-h-[260px]">
        {!data.length ? (
          <div className="absolute inset-0 flex items-center justify-center text-[#444] text-xs font-black tracking-widest uppercase">
            Nessun dato nel periodo selezionato
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="w-full h-full"
            style={{ cursor: "crosshair", minHeight: 260 }}
            onMouseMove={onMove}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <defs>
              {CHART_LINES.map(l => (
                <linearGradient key={l.gradId} id={l.gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={l.color} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={l.color} stopOpacity="0.01" />
                </linearGradient>
              ))}
            </defs>

            {/* Y grid lines + labels */}
            {yTicks.map(v => (
              <g key={v}>
                <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#252528" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                <text x={padL - 7} y={y(v) + 4} textAnchor="end" fontSize="9" fill="#555" fontFamily="JetBrains Mono, monospace">{v}</text>
              </g>
            ))}

            {/* Zero reference */}
            <line x1={padL} x2={W - padR} y1={y0} y2={y0} stroke="#3a3a3f" strokeWidth={1.5} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />

            {/* CTL area */}
            {(focus === "all" || focus === "ctl") && (
              <g style={{ opacity: focus === "ctl" ? 1 : 0.7, transition: "opacity .3s" }}>
                <path d={buildArea("ctl")} fill="url(#v2CtlGrad)" />
                <path d={buildLine("ctl")} fill="none" stroke="#F97316" strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </g>
            )}

            {/* ATL area */}
            {(focus === "all" || focus === "atl") && (
              <g style={{ opacity: focus === "atl" ? 1 : 0.65, transition: "opacity .3s" }}>
                <path d={buildArea("atl")} fill="url(#v2AtlGrad)" />
                <path d={buildLine("atl")} fill="none" stroke="#F43F5E" strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </g>
            )}

            {/* TSB line only */}
            {(focus === "all" || focus === "tsb") && (
              <g style={{ opacity: focus === "tsb" ? 1 : 0.9, transition: "opacity .3s" }}>
                <path d={buildLine("tsb")} fill="none" stroke="#C0FF00" strokeWidth={2} strokeLinejoin="round" strokeDasharray="6 3" vectorEffect="non-scaling-stroke" />
              </g>
            )}

            {/* X axis labels */}
            {xLabels.map((lbl, k) => (
              <text key={k} x={x(lbl.i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#666" fontFamily="JetBrains Mono, monospace">
                {lbl.label}
              </text>
            ))}

            {/* Hover crosshair + dots */}
            {hov && hoverIdx !== null && (
              <g>
                <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={padT} y2={padT + plotH} stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                {CHART_LINES.map(l => {
                  if (focus !== "all" && focus !== l.key) return null;
                  const v = hov[l.key];
                  return (
                    <g key={l.key}>
                      <circle cx={x(hoverIdx)} cy={y(v)} r={12} fill={l.color} fillOpacity="0.15" />
                      <circle cx={x(hoverIdx)} cy={y(v)} r={4.5} fill={l.color} stroke="#111" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                    </g>
                  );
                })}
              </g>
            )}
          </svg>
        )}

        {/* Hover tooltip */}
        {hov && hoverIdx !== null && (
          <div className="absolute top-2 right-2 bg-[#111] border border-white/[0.08] rounded-2xl px-4 py-3 pointer-events-none min-w-[190px] shadow-2xl">
            <div className="text-[10px] text-[#A0A0A0] font-black tracking-widest uppercase mb-2">
              {new Date(hov.date).toLocaleDateString("it", { day: "numeric", month: "short", year: "numeric" })}
            </div>
            {CHART_LINES.map(l => (
              <div key={l.key} className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                  <span className="text-[11px] font-black" style={{ color: l.color }}>{l.label}</span>
                </div>
                <span className="text-white text-sm font-black tabular-nums" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                  {hov[l.key] >= 0 ? "+" : ""}{hov[l.key].toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PACE ZONES BARS ─────────────────────────────────────────────────────────

type ZoneRange = "7d" | "30d" | "90d" | "all";

const ZONE_BINS = [
  { zone: "Z1", name: "Recupero",  minSec: 390, color: "#60A5FA" },
  { zone: "Z2", name: "Easy",      minSec: 360, color: "#34D399" },
  { zone: "Z3", name: "Steady",    minSec: 330, color: "#C0FF00" },
  { zone: "Z4", name: "Threshold", minSec: 300, color: "#F59E0B" },
  { zone: "Z5", name: "Fast",      minSec:   0, color: "#F43F5E" },
] as const;

const RANGE_DAYS: Record<ZoneRange, number | null> = { "7d": 7, "30d": 30, "90d": 90, "all": null };
const RANGE_LABELS: Record<ZoneRange, string> = { "7d": "7D", "30d": "30D", "90d": "90D", "all": "ALL" };

function parsePaceSec(pace?: string | null): number | null {
  if (!pace) return null;
  const parts = String(pace).trim().split(":").map(Number);
  if (parts.length !== 2 || parts.some(Number.isNaN)) return null;
  return parts[0] * 60 + parts[1];
}

function PaceZonesCard({ runs }: { runs: Run[] }) {
  const [range, setRange] = useState<ZoneRange>("90d");

  const { zones, totalKm } = useMemo(() => {
    const days = RANGE_DAYS[range];
    const cutoff = days ? Date.now() - days * 86400000 : null;
    const filtered = runs.filter(r =>
      cutoff ? new Date(`${r.date.slice(0, 10)}T00:00:00`).getTime() >= cutoff : true
    );
    const bins = ZONE_BINS.map(b => ({ ...b, km: 0 }));
    for (const run of filtered) {
      const paceSec = parsePaceSec(run.avg_pace);
      if (!paceSec) continue;
      const bin = bins.find(b => paceSec >= b.minSec);
      if (bin) bin.km += run.distance_km;
    }
    const total = bins.reduce((s, b) => s + b.km, 0);
    return {
      zones: bins.map(b => ({ ...b, km: +b.km.toFixed(1), pct: total ? (b.km / total) * 100 : 0 })),
      totalKm: +total.toFixed(1),
    };
  }, [runs, range]);

  const maxPct = Math.max(...zones.map(z => z.pct), 1);

  return (
    <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-white text-base font-black tracking-tight">Zone di Passo</h3>
          <p className="text-[#A0A0A0] text-[10px] tracking-widest uppercase mt-0.5">
            Distribuzione km · {range === "all" ? "tutte le corse" : `ultimi ${range}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#A0A0A0] text-sm font-black">{totalKm} <span className="text-[10px] font-bold">km</span></span>
          <div className="flex bg-[#111] rounded-lg border border-white/[0.06] p-0.5">
            {(["7d", "30d", "90d", "all"] as ZoneRange[]).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded-md text-[10px] font-black tracking-wider transition-all ${
                  range === r ? "bg-[#C0FF00] text-black" : "text-gray-500 hover:text-white"
                }`}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      </div>
      {!totalKm ? (
        <div className="flex items-center justify-center min-h-[120px]">
          <span className="text-[#444] text-xs font-black tracking-widest uppercase">Dati insufficienti</span>
        </div>
      ) : (
        <div className="space-y-4">
          {zones.map(z => (
            <div key={z.zone} className="flex items-center gap-3">
              <div className="w-16 shrink-0">
                <div className="text-[10px] font-black tracking-widest" style={{ color: z.color }}>{z.zone}</div>
                <div className="text-[9px] text-[#555] truncate">{z.name}</div>
              </div>
              <div className="flex-1 h-2.5 bg-[#111] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(z.pct / maxPct) * 100}%`,
                    background: z.color,
                    boxShadow: z.pct === maxPct ? `0 0 8px ${z.color}55` : "none",
                  }}
                />
              </div>
              <div className="w-14 text-right shrink-0">
                <span className="text-white text-sm font-black tabular-nums" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                  {z.pct.toFixed(1)}<span className="text-[#555] text-[10px]">%</span>
                </span>
              </div>
              <div className="w-14 text-right text-[#555] text-[10px] shrink-0">{z.km} km</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PACE DISTRIBUTION CARD ──────────────────────────────────────────────────

function StatCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[#555] text-[9px] font-black tracking-widest uppercase">{label}</span>
      <span
        className="text-lg font-black tabular-nums leading-none"
        style={{ fontFamily: "JetBrains Mono, monospace", color: accent ?? "#fff" }}
      >
        {value}
      </span>
    </div>
  );
}

function PaceDistributionCard({ chart }: { chart?: ProAnalyticsChart }) {
  const data = (chart?.series_card ?? []) as Array<{ pace: string; pace_sec: number; runs: number }>;
  const totalRuns = data.reduce((s, d) => s + Number(d.runs ?? 0), 0);
  const modal = data.reduce<typeof data[number] | null>(
    (best, d) => (!best || Number(d.runs ?? 0) > Number(best.runs ?? 0) ? d : best),
    null,
  );
  const fastestPace = data.find(d => Number(d.runs) > 0)?.pace ?? "—";
  const slowestPace = [...data].reverse().find(d => Number(d.runs) > 0)?.pace ?? "—";
  const maxRuns = Math.max(...data.map(d => Number(d.runs ?? 0)), 1);

  return (
    <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-8 flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-white text-base font-black tracking-tight">Distribuzione del Passo</h3>
          <p className="text-[#A0A0A0] text-[10px] tracking-widest uppercase mt-1">Corse per zona · storico</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#C0FF00]/10 border border-[#C0FF00]/20">
          <div className="w-1.5 h-1.5 rounded-full bg-[#C0FF00]" />
          <span className="text-[#C0FF00] text-[10px] font-black tracking-widest uppercase">{totalRuns} run</span>
        </div>
      </div>

      <div className="h-[220px] -mx-2">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#444] text-xs font-black tracking-widest uppercase">
            Dati insufficienti
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
              <defs>
                <linearGradient id="paceBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C0FF00" stopOpacity={1} />
                  <stop offset="100%" stopColor="#C0FF00" stopOpacity={0.25} />
                </linearGradient>
                <linearGradient id="paceBarGradDim" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3A3A3A" stopOpacity={1} />
                  <stop offset="100%" stopColor="#2A2A2A" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="#252528" vertical={false} />
              <XAxis
                dataKey="pace"
                tick={{ fill: "#666", fontSize: 9, fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#666", fontSize: 9, fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                cursor={{ fill: "rgba(192,255,0,0.06)" }}
                contentStyle={{
                  background: "#111",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  fontFamily: "JetBrains Mono, monospace",
                }}
                labelStyle={{ color: "#A0A0A0", fontSize: 10, fontWeight: 700 }}
                itemStyle={{ color: "#C0FF00", fontSize: 11, fontWeight: 900 }}
                formatter={(v: any) => [`${v} corse`, "Frequenza"]}
                labelFormatter={(l: string) => `Passo ${l} /km`}
              />
              <Bar dataKey="runs" radius={[6, 6, 0, 0]}>
                {data.map((d, i) => {
                  const isModal = modal && d.pace === modal.pace;
                  const ratio = Number(d.runs) / maxRuns;
                  return (
                    <Cell
                      key={i}
                      fill={isModal ? "url(#paceBarGrad)" : ratio > 0.4 ? "url(#paceBarGrad)" : "url(#paceBarGradDim)"}
                      opacity={isModal ? 1 : ratio > 0.4 ? 0.55 : 1}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 pt-5 border-t border-white/[0.06]">
        <StatCell label="Passo Modale" value={modal?.pace ?? "—"} accent="#C0FF00" />
        <StatCell label="Più Veloce" value={fastestPace} />
        <StatCell label="Più Lento" value={slowestPace} />
      </div>
    </div>
  );
}

// ─── EFFORT MATRIX CARD ──────────────────────────────────────────────────────

function EffortMatrixCard({ chart }: { chart?: ProAnalyticsChart }) {
  const data = (chart?.series_card ?? []) as Array<{ dist: number; pace: number; z?: number; hr?: number }>;

  const stats = useMemo(() => {
    if (!data.length) return { count: 0, avgDist: 0, avgPace: 0, avgHr: 0, maxDist: 0 };
    const valid = data.filter(d => Number.isFinite(d.dist) && Number.isFinite(d.pace));
    const sum = valid.reduce<{ dist: number; pace: number; hr: number; hrN: number }>(
      (acc, d) => ({
        dist: acc.dist + d.dist,
        pace: acc.pace + d.pace,
        hr: acc.hr + (Number.isFinite(d.hr) ? Number(d.hr) : 0),
        hrN: acc.hrN + (Number.isFinite(d.hr) ? 1 : 0),
      }),
      { dist: 0, pace: 0, hr: 0, hrN: 0 },
    );
    return {
      count: valid.length,
      avgDist: sum.dist / valid.length,
      avgPace: sum.pace / valid.length,
      avgHr: sum.hrN ? sum.hr / sum.hrN : 0,
      maxDist: Math.max(...valid.map(d => d.dist)),
    };
  }, [data]);

  const fmtPace = (p: number) => {
    if (!Number.isFinite(p) || p <= 0) return "—";
    const m = Math.floor(p);
    const s = Math.round((p - m) * 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const xMax = Math.max(10, Math.ceil(stats.maxDist / 5) * 5);

  return (
    <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-8 flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-white text-base font-black tracking-tight">Matrice degli Sforzi</h3>
          <p className="text-[#A0A0A0] text-[10px] tracking-widest uppercase mt-1">
            Distanza × Passo · bolla = FC
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#C0FF00]/10 border border-[#C0FF00]/20">
          <div className="w-1.5 h-1.5 rounded-full bg-[#C0FF00]" />
          <span className="text-[#C0FF00] text-[10px] font-black tracking-widest uppercase">{stats.count} run</span>
        </div>
      </div>

      <div className="h-[220px] -mx-2">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#444] text-xs font-black tracking-widest uppercase">
            Dati insufficienti
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: -4 }}>
              <defs>
                <radialGradient id="effortDot">
                  <stop offset="0%" stopColor="#C0FF00" stopOpacity={0.9} />
                  <stop offset="80%" stopColor="#C0FF00" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#C0FF00" stopOpacity={0} />
                </radialGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="#252528" />
              <XAxis
                type="number"
                dataKey="dist"
                domain={[0, xMax]}
                tick={{ fill: "#666", fontSize: 9, fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                label={{ value: "KM", position: "insideBottomRight", fill: "#444", fontSize: 9, fontWeight: 900, offset: -2 }}
              />
              <YAxis
                type="number"
                dataKey="pace"
                domain={[3.5, 6.8]}
                reversed={false}
                tick={{ fill: "#666", fontSize: 9, fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                width={32}
                tickFormatter={(v: number) => fmtPace(v)}
              />
              <ZAxis type="number" dataKey="hr" range={[40, 240]} />
              <ReferenceLine
                y={stats.avgPace || 4.8}
                stroke="#C0FF00"
                strokeDasharray="4 4"
                strokeOpacity={0.4}
                label={{ value: "MEDIA", position: "right", fill: "#C0FF00", fontSize: 8, fontWeight: 900 }}
              />
              <Tooltip
                cursor={{ stroke: "rgba(192,255,0,0.3)", strokeWidth: 1 }}
                contentStyle={{
                  background: "#111",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  fontFamily: "JetBrains Mono, monospace",
                }}
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-[#111] border border-white/[0.08] rounded-xl px-3 py-2" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                      <div className="text-[#C0FF00] text-[11px] font-black">{d.dist.toFixed(1)} km</div>
                      <div className="text-white text-[10px] font-bold mt-0.5">{fmtPace(d.pace)} /km</div>
                      {Number.isFinite(d.hr) && d.hr > 0 && (
                        <div className="text-[#A0A0A0] text-[10px] font-bold mt-0.5">{Math.round(d.hr)} bpm</div>
                      )}
                    </div>
                  );
                }}
              />
              <Scatter data={data} fill="url(#effortDot)" />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 pt-5 border-t border-white/[0.06]">
        <StatCell label="Distanza Media" value={stats.count ? `${stats.avgDist.toFixed(1)} km` : "—"} accent="#C0FF00" />
        <StatCell label="Passo Medio" value={stats.count ? `${fmtPace(stats.avgPace)}` : "—"} />
        <StatCell label="FC Media" value={stats.avgHr ? `${Math.round(stats.avgHr)} bpm` : "—"} />
      </div>
    </div>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export function CaricoFormaV2({ ffHistory, kmRuns, paceDistributionChart, effortMatrixChart }: CaricoFormaV2Props) {
  return (
    <div className="space-y-5">
      {/* ── Main fitness/fatigue/form chart ── */}
      <FitnessMultiChart ff={ffHistory} />

      {/* ── Weekly km chart ── */}
      <div className="h-[280px]">
        <WeeklyKmChart runs={kmRuns} />
      </div>

      {/* ── Pace zones ── */}
      <PaceZonesCard runs={kmRuns} />

      {/* ── Distribuzione Passo + Matrice Sforzi ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PaceDistributionCard chart={paceDistributionChart} />
        <EffortMatrixCard chart={effortMatrixChart} />
      </div>
    </div>
  );
}
