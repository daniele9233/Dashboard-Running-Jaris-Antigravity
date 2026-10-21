import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, CartesianGrid } from "recharts";
import type { Run } from "../types/api";
import { computeDrift, type DriftResult } from "../utils/cardiacDrift";

import { CHART_SERIES, CHART_TEXT, ChartTip, chartGrid, chartMargin, chartXAxis, chartYAxis } from "./charts";
// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPace(sec: number): string {
  if (!sec || sec <= 0) return "—";
  const total = Math.round(sec);   // arrotonda il totale: mai ":60"
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Scale config ─────────────────────────────────────────────────────────────

function driftLabel(drift: number): { label: string; color: string; bg: string; border: string } {
  if (drift < 3.5)
    return { label: "Eccellente", color: CHART_SERIES.positive, bg: "bg-emerald-500/10", border: "border-emerald-500/30" };
  if (drift < 5.0)
    return { label: "Buona efficienza", color: CHART_SERIES.compare, bg: "bg-blue-500/10", border: "border-blue-500/30" };
  if (drift < 7.5)
    return { label: "Da migliorare", color: CHART_SERIES.load, bg: "bg-amber-500/10", border: "border-amber-500/30" };
  return { label: "Insufficiente", color: CHART_SERIES.risk, bg: "bg-rose-500/10", border: "border-rose-500/30" };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CardiacDrift({ runs }: { runs: Run[] }) {
  const results = useMemo(() => {
    return runs
      .filter(r => r.distance_km >= 4 && r.splits && r.splits.length >= 4)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20)
      .map(computeDrift)
      .filter((d): d is DriftResult => d !== null)
      .slice(0, 10);
  }, [runs]);

  const latest = results[0] ?? null;
  const trendData = [...results].reverse().map((r, i) => ({
    i,
    drift: r.drift,
    date: r.date.slice(5), // MM-DD
  }));

  if (!latest) {
    return (
      <div className="rounded-xl border border-ea-hairline bg-ea-surface-2 p-5 flex items-center justify-center">
        <p className="text-xs text-text-muted">
          Sincronizza corse con dati GPS e frequenza cardiaca per vedere la deriva cardiaca.
        </p>
      </div>
    );
  }

  const cfg = driftLabel(latest.drift);
  const driftColor = cfg.color;
  const driftSign = latest.drift >= 0 ? "+" : "";

  // Trend sparkline color: green if improving (going down)
  const improving = results.length >= 2 && results[0].drift < results[1].drift;

  return (
    <div className="rounded-xl border border-ea-hairline bg-ea-surface-2 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span className="text-xs font-bold text-text-muted uppercase tracking-widest">
            Efficienza Aerobica
          </span>
          <span className="text-xs text-gray-600 font-medium">Pa:Hr — Friel</span>
        </div>
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} border ${cfg.border}`}
          style={{ color: cfg.color }}
        >
          {cfg.label}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1.2fr] gap-5">

        {/* ── Left: Big drift number + halves ── */}
        <div className="flex flex-col gap-3">
          {/* Big number */}
          <div className="text-center">
            <div className="text-5xl font-black leading-none" style={{ color: driftColor }}>
              {driftSign}{latest.drift.toFixed(1)}%
            </div>
            <div className="text-xs text-text-muted mt-1.5">drift frequenza cardiaca</div>
          </div>

          {/* First half / Second half */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 border border-white/8 rounded-xl p-3 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Prima metà</div>
              <div className="text-xl font-black text-white">{latest.hr1} <span className="text-xs font-normal text-gray-500">bpm</span></div>
              <div className="text-xs text-gray-400 mt-0.5">{fmtPace(latest.pace1)}/km</div>
              <div className="text-xs text-gray-600 mt-0.5">{latest.kmFirst}</div>
            </div>
            <div className="bg-white/5 border border-white/8 rounded-xl p-3 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Seconda metà</div>
              <div className="text-xl font-black" style={{ color: driftColor }}>{latest.hr2} <span className="text-xs font-normal text-gray-500">bpm</span></div>
              <div className="text-xs text-gray-400 mt-0.5">{fmtPace(latest.pace2)}/km</div>
              <div className="text-xs text-gray-600 mt-0.5">{latest.kmSecond}</div>
            </div>
          </div>

          {/* CV passo */}
          {Math.abs(latest.pace2 - latest.pace1) / latest.pace1 < 0.15 && (
            <div className="text-xs text-gray-600 text-center">
              CV passo: {(Math.abs(latest.pace2 - latest.pace1) / latest.pace1 * 100).toFixed(1)}% (costante)
            </div>
          )}
        </div>

        {/* ── Center: Scale legend ── */}
        <div className="flex flex-col justify-center gap-1.5">
          {[
            { label: "< 3.5% = Base aerobica eccellente", color: CHART_SERIES.positive, active: latest.drift < 3.5 },
            { label: "3.5–5% = Buona efficienza", color: CHART_SERIES.compare, active: latest.drift >= 3.5 && latest.drift < 5 },
            { label: "5–7.5% = Base aerobica da migliorare", color: CHART_SERIES.load, active: latest.drift >= 5 && latest.drift < 7.5 },
            { label: "> 7.5% = Efficienza insufficiente", color: CHART_SERIES.risk, active: latest.drift >= 7.5 },
          ].map(({ label, color, active }) => (
            <div
              key={label}
              className={`text-xs flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${active ? "bg-white/5" : ""}`}
              style={{ color: active ? color: CHART_TEXT.axis }}
            >
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: active ? color: CHART_TEXT.axis }} />
              {label}
            </div>
          ))}

          <div className="mt-2 text-xs text-gray-600 leading-relaxed">
            Metodo Friel: a passo costante, la FC non dovrebbe aumentare significativamente.
            Drift alto → allenamento aerobico a bassa intensità insufficiente.
          </div>
        </div>

        {/* ── Right: Trend chart ── */}
        <div className="flex flex-col">
          <div className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
            Tendenza ultime {results.length} corse
            {results.length >= 2 && (
              <span className={`text-xs font-bold ${improving ? "text-emerald-400" : "text-rose-400"}`}>
                {improving ? "▼ in miglioramento" : "▲ in peggioramento"}
              </span>
            )}
          </div>

          <div className="flex-1 min-h-[120px]">
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={trendData} margin={chartMargin}>
                <CartesianGrid {...chartGrid} />
                <XAxis {...chartXAxis} dataKey="date" />
                <YAxis {...chartYAxis} domain={["auto", "auto"]} tickFormatter={v => `${v}%`} />
                <ChartTip formatter={(v: number) => [`${v.toFixed(1)}%`, "Deriva"]} labelFormatter={l => `Data: ${l}`} />
                {/* Reference bands */}
                <ReferenceLine y={3.5} stroke={CHART_SERIES.positive} strokeDasharray="4 4" strokeOpacity={0.4} />
                <ReferenceLine y={5.0} stroke={CHART_SERIES.compare} strokeDasharray="4 4" strokeOpacity={0.4} />
                <ReferenceLine y={7.5} stroke={CHART_SERIES.risk} strokeDasharray="4 4" strokeOpacity={0.4} />
                <Line
                  type="monotone"
                  dataKey="drift"
                  stroke={improving ? CHART_SERIES.positive : CHART_SERIES.risk}
                  strokeWidth={2}
                  dot={{ r: 3, fill: improving ? CHART_SERIES.positive : CHART_SERIES.risk, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Last run info */}
          <div className="text-xs text-gray-600 text-right mt-1">
            Ultima analisi: {latest.date} · {latest.distKm.toFixed(1)} km
          </div>
        </div>
      </div>
    </div>
  );
}
