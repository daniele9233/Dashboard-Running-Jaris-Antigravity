import { useMemo, useState } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import type { Run } from "../../types/api";
import { computeDrift, driftLabel } from "../../utils/cardiacDrift";
import type { DriftResult } from "../../utils/cardiacDrift";

// ─── Single Run Drift ─────────────────────────────────────────────────────────

function SingleRunDrift({ results }: { results: DriftResult[] }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const run = results[selectedIdx];

  if (!run) return (
    <div className="flex items-center justify-center h-40">
      <p className="text-xs text-gray-600">Nessuna corsa con pace costante e dati split disponibile.</p>
    </div>
  );

  const cfg = driftLabel(run.drift);
  const driftSign = run.drift >= 0 ? "+" : "";

  return (
    <div className="space-y-4">
      {/* Run selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Corsa:</span>
        <select
          value={selectedIdx}
          onChange={e => setSelectedIdx(Number(e.target.value))}
          className="bg-[#1E293B] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#3B82F6] cursor-pointer"
        >
          {results.map((r, i) => (
            <option key={r.runId} value={i}>
              {new Date(r.date).toLocaleDateString("it", { day: "numeric", month: "short", year: "numeric" })} · {r.distKm.toFixed(1)} km
            </option>
          ))}
        </select>
        <span className="text-[9px] text-gray-600">Solo corse a passo costante (±12% dal mediano)</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-5">
        {/* Left: metrics */}
        <div className="flex flex-col gap-3">
          {/* Big drift */}
          <div className="bg-[#0F172A] rounded-xl p-4 text-center border border-white/5">
            <div className="text-4xl font-black" style={{ color: cfg.color }}>
              {driftSign}{run.drift.toFixed(1)}%
            </div>
            <div className="text-[10px] text-gray-500 mt-1">drift FC</div>
            <div className="text-xs font-bold mt-1.5 px-2 py-0.5 rounded-full inline-block" style={{ color: cfg.color, backgroundColor: cfg.color + "18" }}>
              {cfg.label}
            </div>
          </div>

          {/* Halves */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#0F172A] border border-white/5 rounded-xl p-3 text-center">
              <div className="text-[9px] text-gray-500 uppercase mb-1">Prima metà</div>
              <div className="text-lg font-black text-white">{run.hr1} <span className="text-xs text-gray-500">bpm</span></div>
              <div className="text-[10px] text-gray-400">{run.kmFirst}</div>
            </div>
            <div className="bg-[#0F172A] border border-white/5 rounded-xl p-3 text-center">
              <div className="text-[9px] text-gray-500 uppercase mb-1">Seconda metà</div>
              <div className="text-lg font-black" style={{ color: cfg.color }}>{run.hr2} <span className="text-xs text-gray-500">bpm</span></div>
              <div className="text-[10px] text-gray-400">{run.kmSecond}</div>
            </div>
          </div>

          {/* Scale */}
          <div className="space-y-1">
            {[
              { range: "< 3.5%", label: "Base aerobica eccellente", color: "#10B981" },
              { range: "3.5–5%", label: "Buona efficienza",         color: "#3B82F6" },
              { range: "5–7.5%", label: "Da migliorare",            color: "#F59E0B" },
              { range: "> 7.5%", label: "Insufficiente",            color: "#F43F5E" },
            ].map(item => {
              const active = (
                (item.range === "< 3.5%"  && run.drift < 3.5) ||
                (item.range === "3.5–5%"  && run.drift >= 3.5 && run.drift < 5) ||
                (item.range === "5–7.5%"  && run.drift >= 5   && run.drift < 7.5) ||
                (item.range === "> 7.5%"  && run.drift >= 7.5)
              );
              return (
                <div key={item.range} className={`flex items-center gap-2 text-[10px] px-2 py-0.5 rounded ${active ? "bg-white/5" : ""}`}
                  style={{ color: active ? item.color : "#475569" }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: active ? item.color : "#475569" }} />
                  <span className="font-mono">{item.range}</span>
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: HR per km bar chart */}
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            FC per km (splits a passo costante)
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={run.splits} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
              <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#1E293B" />
              <XAxis dataKey="km" tick={{ fontSize: 9, fill: "#475569" }} axisLine={false} tickLine={false} label={{ value: "km", position: "insideBottomRight", offset: -4, fill: "#475569", fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9, fill: "#475569" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, fontSize: 11 }}
                formatter={(v: number, _: string, props: any) => [
                  `${v} bpm · ${props.payload.paceLabel}/km`,
                  "HR"
                ]}
                labelFormatter={(l) => `km ${l}`}
              />
              <ReferenceLine y={run.hr1} stroke="#10B981" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: `Prima ${run.hr1}`, fill: "#10B981", fontSize: 8, position: "insideTopLeft" }} />
              <ReferenceLine y={run.hr2} stroke={cfg.color} strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: `Seconda ${run.hr2}`, fill: cfg.color, fontSize: 8, position: "insideTopRight" }} />
              <Bar dataKey="hr" radius={[4, 4, 0, 0]}>
                {run.splits.map((_, i) => {
                  const mid = Math.floor(run.splits.length / 2);
                  return <Cell key={i} fill={i < mid ? "#10B981" : cfg.color} fillOpacity={0.85} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-1">
            <span className="flex items-center gap-1 text-[9px] text-[#10B981]"><span className="w-2 h-2 rounded-sm bg-[#10B981]" /> Prima metà</span>
            <span className="flex items-center gap-1 text-[9px]" style={{ color: cfg.color }}><span className="w-2 h-2 rounded-sm" style={{ background: cfg.color }} /> Seconda metà</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Historical Drift ─────────────────────────────────────────────────────────

function HistoricalDrift({ results }: { results: DriftResult[] }) {
  const data = [...results].reverse().map(r => ({
    date: new Date(r.date).toLocaleDateString("it", { day: "numeric", month: "short" }),
    drift: r.drift,
    color: driftLabel(r.drift).color,
    fullDate: new Date(r.date).toLocaleDateString("it", { day: "numeric", month: "long", year: "numeric" }),
    distKm: r.distKm,
  }));

  if (!data.length) return (
    <div className="flex items-center justify-center h-40">
      <p className="text-xs text-gray-600">Nessun dato storico disponibile.</p>
    </div>
  );

  const improving = data.length >= 2 && data[data.length - 1].drift < data[data.length - 2].drift;
  const avgDrift = data.reduce((s, d) => s + d.drift, 0) / data.length;
  const minDrift = Math.min(...data.map(d => d.drift));
  const maxDrift = Math.max(...data.map(d => d.drift));
  const latestDrift = data[data.length - 1].drift;
  const latestCfg = driftLabel(latestDrift);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Ultima deriva", value: `${latestDrift >= 0 ? "+" : ""}${latestDrift.toFixed(1)}%`, color: latestCfg.color, sub: latestCfg.label },
          { label: "Media storica", value: `${avgDrift >= 0 ? "+" : ""}${avgDrift.toFixed(1)}%`, color: driftLabel(avgDrift).color, sub: `${data.length} corse` },
          { label: "Migliore",      value: `${minDrift >= 0 ? "+" : ""}${minDrift.toFixed(1)}%`, color: "#10B981", sub: "min drift" },
          { label: "Peggiore",      value: `${maxDrift >= 0 ? "+" : ""}${maxDrift.toFixed(1)}%`, color: "#F43F5E", sub: "max drift" },
        ].map(k => (
          <div key={k.label} className="bg-[#0F172A] border border-white/5 rounded-xl p-3 text-center">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">{k.label}</div>
            <div className="text-xl font-black" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[9px] text-gray-600 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Deriva FC — storico corse a passo costante</span>
          {data.length >= 2 && (
            <span className={`text-[10px] font-bold ${improving ? "text-emerald-400" : "text-rose-400"}`}>
              {improving ? "▼ in miglioramento" : "▲ in peggioramento"}
            </span>
          )}
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#1E293B" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#475569" }} axisLine={false} tickLine={false}
              interval={Math.max(0, Math.floor(data.length / 8) - 1)} />
            <YAxis tick={{ fontSize: 9, fill: "#475569" }} axisLine={false} tickLine={false}
              tickFormatter={v => `${v}%`} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, fontSize: 11 }}
              formatter={(v: number, _: string, props: any) => [
                `${v >= 0 ? "+" : ""}${v.toFixed(1)}% · ${props.payload.distKm.toFixed(1)} km`,
                "Deriva FC"
              ]}
              labelFormatter={(l) => `${l}`}
            />
            <ReferenceLine y={3.5} stroke="#10B981" strokeDasharray="4 4" strokeOpacity={0.3} />
            <ReferenceLine y={5.0} stroke="#3B82F6" strokeDasharray="4 4" strokeOpacity={0.3} />
            <ReferenceLine y={7.5} stroke="#F43F5E" strokeDasharray="4 4" strokeOpacity={0.3} />
            <Line
              type="monotone"
              dataKey="drift"
              stroke={improving ? "#10B981" : "#F43F5E"}
              strokeWidth={2.5}
              dot={(props: any) => {
                const c = driftLabel(props.payload.drift).color;
                return <circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill={c} stroke="none" />;
              }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Zone legend */}
        <div className="flex flex-wrap gap-4 mt-2">
          {[
            { color: "#10B981", label: "< 3.5% Eccellente" },
            { color: "#3B82F6", label: "3.5–5% Buona" },
            { color: "#F59E0B", label: "5–7.5% Da migliorare" },
            { color: "#F43F5E", label: "> 7.5% Insufficiente" },
          ].map(z => (
            <span key={z.label} className="flex items-center gap-1.5 text-[9px]" style={{ color: z.color }}>
              <span className="w-6 border-t-2 border-dashed inline-block" style={{ borderColor: z.color }} />
              {z.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function StatsDrift({ runs }: { runs: Run[] }) {
  const [driftTab, setDriftTab] = useState<"single" | "historical">("historical");

  const results = useMemo(() => {
    return runs
      .filter(r => !r.is_treadmill && r.distance_km >= 4 && (r.splits ?? []).length >= 4)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(computeDrift)
      .filter((d): d is DriftResult => d !== null);
  }, [runs]);

  return (
    <div className="bg-[#111111] border border-[#1E293B] rounded-2xl p-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-rose-500/15 flex items-center justify-center">
            <svg className="w-4 h-4 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Deriva Cardiaca</h2>
            <p className="text-[10px] text-gray-500 font-medium">Pa:Hr ratio — Metodo Friel · solo corse a passo costante</p>
          </div>
        </div>
        {results.length > 0 && (
          <span className="text-[10px] text-gray-600">{results.length} corse qualificate</span>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-5 bg-[#0A0A0A] p-1 rounded-xl w-fit">
        {([
          { id: "historical", label: "Historical Drift" },
          { id: "single",     label: "Single Run Drift" },
        ] as const).map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setDriftTab(t.id)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
              driftTab === t.id
                ? "bg-[#1E293B] text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-600">Nessuna corsa a passo costante con dati HR e split trovata.</p>
          <p className="text-[10px] text-gray-700 mt-1">Richiede: GPS + frequenza cardiaca + ≥4 km + pace costante (±12%)</p>
        </div>
      ) : (
        <>
          {driftTab === "historical" && <HistoricalDrift results={results} />}
          {driftTab === "single"     && <SingleRunDrift  results={results} />}
        </>
      )}
    </div>
  );
}
