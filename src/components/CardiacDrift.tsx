import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";
import type { Run, Split } from "../types/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parsePaceSec(pace: string): number {
  const parts = pace.split(":");
  if (parts.length < 2) return 0;
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function fmtPace(sec: number): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface DriftResult {
  drift: number;        // %
  hr1: number;          // avg HR first half
  hr2: number;          // avg HR second half
  pace1: number;        // avg pace first half (sec)
  pace2: number;        // avg pace second half (sec)
  kmFirst: string;      // label "km 1-N"
  kmSecond: string;     // label "km N+1-M"
  date: string;
  distKm: number;
}

function computeDrift(run: Run): DriftResult | null {
  const splits: Split[] = (run.splits ?? []).filter(
    s => s.hr && s.hr > 80 && s.pace && parsePaceSec(s.pace) > 0
  );
  // Need at least 4 km with HR data
  if (splits.length < 4) return null;
  // Filter out interval-pace splits (very fast or very slow)
  const paces = splits.map(s => parsePaceSec(s.pace));
  const medianPace = [...paces].sort((a, b) => a - b)[Math.floor(paces.length / 2)];
  const steady = splits.filter(s => {
    const p = parsePaceSec(s.pace);
    return p >= medianPace * 0.85 && p <= medianPace * 1.20;
  });
  if (steady.length < 4) return null;

  const mid = Math.floor(steady.length / 2);
  const first = steady.slice(0, mid);
  const second = steady.slice(mid);

  const avgHr = (arr: Split[]) =>
    arr.reduce((s, x) => s + (x.hr ?? 0), 0) / arr.length;
  const avgPace = (arr: Split[]) =>
    arr.reduce((s, x) => s + parsePaceSec(x.pace), 0) / arr.length;

  const hr1 = avgHr(first);
  const hr2 = avgHr(second);
  if (hr1 <= 0) return null;

  const drift = ((hr2 - hr1) / hr1) * 100;
  const km1 = steady[0].km;
  const kmMid = steady[mid - 1].km;
  const kmEnd = steady[steady.length - 1].km;

  return {
    drift: Math.round(drift * 10) / 10,
    hr1: Math.round(hr1),
    hr2: Math.round(hr2),
    pace1: avgPace(first),
    pace2: avgPace(second),
    kmFirst: `km ${km1}–${kmMid}`,
    kmSecond: `km ${kmMid + 1}–${kmEnd}`,
    date: run.date,
    distKm: run.distance_km,
  };
}

// ─── Scale config ─────────────────────────────────────────────────────────────

function driftLabel(drift: number): { label: string; color: string; bg: string; border: string } {
  if (drift < 3.5)
    return { label: "Eccellente", color: "#10B981", bg: "bg-emerald-500/10", border: "border-emerald-500/30" };
  if (drift < 5.0)
    return { label: "Buona efficienza", color: "#3B82F6", bg: "bg-blue-500/10", border: "border-blue-500/30" };
  if (drift < 7.5)
    return { label: "Da migliorare", color: "#F59E0B", bg: "bg-amber-500/10", border: "border-amber-500/30" };
  return { label: "Insufficiente", color: "#F43F5E", bg: "bg-rose-500/10", border: "border-rose-500/30" };
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
      <div className="bg-bg-card border border-white/8 rounded-xl p-5 flex items-center justify-center">
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
    <div className="bg-bg-card border border-white/8 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
            Efficienza Aerobica
          </span>
          <span className="text-[9px] text-gray-600 font-medium">Pa:Hr — Friel</span>
        </div>
        <span
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.bg} border ${cfg.border}`}
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
              <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1.5">Prima metà</div>
              <div className="text-xl font-black text-white">{latest.hr1} <span className="text-xs font-normal text-gray-500">bpm</span></div>
              <div className="text-xs text-gray-400 mt-0.5">{fmtPace(latest.pace1)}/km</div>
              <div className="text-[9px] text-gray-600 mt-0.5">{latest.kmFirst}</div>
            </div>
            <div className="bg-white/5 border border-white/8 rounded-xl p-3 text-center">
              <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1.5">Seconda metà</div>
              <div className="text-xl font-black" style={{ color: driftColor }}>{latest.hr2} <span className="text-xs font-normal text-gray-500">bpm</span></div>
              <div className="text-xs text-gray-400 mt-0.5">{fmtPace(latest.pace2)}/km</div>
              <div className="text-[9px] text-gray-600 mt-0.5">{latest.kmSecond}</div>
            </div>
          </div>

          {/* CV passo */}
          {Math.abs(latest.pace2 - latest.pace1) / latest.pace1 < 0.15 && (
            <div className="text-[10px] text-gray-600 text-center">
              CV passo: {(Math.abs(latest.pace2 - latest.pace1) / latest.pace1 * 100).toFixed(1)}% (costante)
            </div>
          )}
        </div>

        {/* ── Center: Scale legend ── */}
        <div className="flex flex-col justify-center gap-1.5">
          {[
            { label: "< 3.5% = Base aerobica eccellente", color: "#10B981", active: latest.drift < 3.5 },
            { label: "3.5–5% = Buona efficienza", color: "#3B82F6", active: latest.drift >= 3.5 && latest.drift < 5 },
            { label: "5–7.5% = Base aerobica da migliorare", color: "#F59E0B", active: latest.drift >= 5 && latest.drift < 7.5 },
            { label: "> 7.5% = Efficienza insufficiente", color: "#F43F5E", active: latest.drift >= 7.5 },
          ].map(({ label, color, active }) => (
            <div
              key={label}
              className={`text-[11px] flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${active ? "bg-white/5" : ""}`}
              style={{ color: active ? color : "#475569" }}
            >
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: active ? color : "#475569" }} />
              {label}
            </div>
          ))}

          <div className="mt-2 text-[10px] text-gray-600 leading-relaxed">
            Metodo Friel: a passo costante, la FC non dovrebbe aumentare significativamente.
            Drift alto → allenamento aerobico a bassa intensità insufficiente.
          </div>
        </div>

        {/* ── Right: Trend chart ── */}
        <div className="flex flex-col">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
            Tendenza ultime {results.length} corse
            {results.length >= 2 && (
              <span className={`text-[9px] font-bold ${improving ? "text-emerald-400" : "text-rose-400"}`}>
                {improving ? "▼ in miglioramento" : "▲ in peggioramento"}
              </span>
            )}
          </div>

          <div className="flex-1 min-h-[120px]">
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "#475569" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#475569" }}
                  axisLine={false}
                  tickLine={false}
                  domain={["auto", "auto"]}
                  tickFormatter={v => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [`${v.toFixed(1)}%`, "Deriva"]}
                  labelFormatter={l => `Data: ${l}`}
                />
                {/* Reference bands */}
                <ReferenceLine y={3.5} stroke="#10B981" strokeDasharray="4 4" strokeOpacity={0.4} />
                <ReferenceLine y={5.0} stroke="#3B82F6" strokeDasharray="4 4" strokeOpacity={0.4} />
                <ReferenceLine y={7.5} stroke="#F43F5E" strokeDasharray="4 4" strokeOpacity={0.4} />
                <Line
                  type="monotone"
                  dataKey="drift"
                  stroke={improving ? "#10B981" : "#F43F5E"}
                  strokeWidth={2}
                  dot={{ r: 3, fill: improving ? "#10B981" : "#F43F5E", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Last run info */}
          <div className="text-[10px] text-gray-600 text-right mt-1">
            Ultima analisi: {latest.date} · {latest.distKm.toFixed(1)} km
          </div>
        </div>
      </div>
    </div>
  );
}
