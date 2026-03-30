import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { Run } from "../types/api";

interface MainChartProps {
  runs: Run[];
}

// ─── Tipi e costanti ─────────────────────────────────────────────────────────

type Period = "1S" | "4S" | "8S" | "12S" | "6M" | "1A" | "TUTTO";

const PERIODS: { key: Period; label: string }[] = [
  { key: "1S",   label: "1 Sett." },
  { key: "4S",   label: "4 Sett." },
  { key: "8S",   label: "8 Sett." },
  { key: "12S",  label: "12 Sett." },
  { key: "6M",   label: "6 Mesi" },
  { key: "1A",   label: "1 Anno" },
  { key: "TUTTO",label: "Tutto" },
];

// ─── Utilities ──────────────────────────────────────────────────────────────

function getRunCategory(runType: string): "easy" | "tempo" | "intervals" | "long" | "race" {
  const t = (runType || "").toLowerCase();
  if (t.includes("race") || t.includes("gara") || t.includes("compet")) return "race";
  if (t.includes("long") || t.includes("lun") || t.includes("fondo lungo")) return "long";
  if (t.includes("interval") || t.includes("speed") || t.includes("fartlek") || t.includes("ripetute")) return "intervals";
  if (t.includes("tempo") || t.includes("threshold") || t.includes("soglia")) return "tempo";
  return "easy";
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface Entry {
  name: string;
  easy: number;
  tempo: number;
  intervals: number;
  long: number;
  race: number;
  total: number;
}

function makeEntry(name: string): Entry {
  return { name, easy: 0, tempo: 0, intervals: 0, long: 0, race: 0, total: 0 };
}

function addRun(entry: Entry, run: Run) {
  const km = parseFloat((run.distance_km || 0).toFixed(1));
  const cat = getRunCategory(run.run_type);
  entry[cat] = parseFloat((entry[cat] + km).toFixed(1));
  entry.total = parseFloat((entry.total + km).toFixed(1));
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, e: any) => s + (e.value || 0), 0);
  return (
    <div className="bg-[#1E293B] border border-[#334155] p-3 rounded-lg shadow-xl text-xs">
      <p className="text-text-muted mb-1 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold text-text-primary mb-2">Totale: {total.toFixed(1)} km</p>
      {payload
        .filter((e: any) => e.value > 0)
        .map((e: any, i: number) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
            <span className="text-text-secondary w-16 capitalize">{e.name}:</span>
            <span className="text-text-primary font-medium">{e.value.toFixed(1)} km</span>
          </div>
        ))}
    </div>
  );
};

// ─── Costruzione dati per periodo ─────────────────────────────────────────────

function buildData(runs: Run[], period: Period): Entry[] {
  const now = new Date();

  // ── Giornaliero (1 settimana) ──────────────────────────────────────────────
  if (period === "1S") {
    const weekStart = getWeekStart(now);
    const DAY_IT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
    return DAY_IT.map((name, i) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      const dayStr = dayDate.toISOString().slice(0, 10);
      const entry = makeEntry(name);
      runs
        .filter((r) => r.date?.slice(0, 10) === dayStr)
        .forEach((r) => addRun(entry, r));
      return entry;
    });
  }

  // ── Settimanale (4S / 8S / 12S) ───────────────────────────────────────────
  if (period === "4S" || period === "8S" || period === "12S") {
    const numWeeks = period === "4S" ? 4 : period === "8S" ? 8 : 12;
    const currentWeekStart = getWeekStart(now);
    return Array.from({ length: numWeeks }, (_, i) => {
      const ws = new Date(currentWeekStart);
      ws.setDate(currentWeekStart.getDate() - (numWeeks - 1 - i) * 7);
      const we = new Date(ws);
      we.setDate(ws.getDate() + 7);
      const label =
        ws.toLocaleString("it", { month: "short" }).toUpperCase() + " " + ws.getDate();
      const entry = makeEntry(label);
      runs.filter((r) => {
        const d = new Date(r.date);
        return d >= ws && d < we;
      }).forEach((r) => addRun(entry, r));
      return entry;
    });
  }

  // ── Mensile (6M / 1A / TUTTO) ─────────────────────────────────────────────
  let months: { year: number; month: number }[] = [];

  if (period === "6M") {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }
  } else if (period === "1A") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }
  } else {
    // TUTTO: dal mese della corsa più vecchia ad oggi
    if (runs.length === 0) return [];
    const oldest = runs.reduce((min, r) =>
      new Date(r.date) < new Date(min.date) ? r : min
    );
    const start = new Date(oldest.date);
    const d = new Date(start.getFullYear(), start.getMonth(), 1);
    while (d <= now) {
      months.push({ year: d.getFullYear(), month: d.getMonth() });
      d.setMonth(d.getMonth() + 1);
    }
  }

  return months.map(({ year, month }) => {
    const d = new Date(year, month, 1);
    const label = d.toLocaleString("it", { month: "short" }).toUpperCase() +
      (period === "TUTTO" || period === "1A" ? " " + String(year).slice(2) : "");
    const entry = makeEntry(label);
    runs
      .filter((r) => {
        const rd = new Date(r.date);
        return rd.getFullYear() === year && rd.getMonth() === month;
      })
      .forEach((r) => addRun(entry, r));
    return entry;
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export function MainChart({ runs }: MainChartProps) {
  const [period, setPeriod] = useState<Period>("12S");

  const chartData = useMemo(() => buildData(runs, period), [runs, period]);

  const { totalYearKm, avgKm, maxKm } = useMemo(() => {
    const now = new Date();
    const yearKm = runs
      .filter((r) => new Date(r.date).getFullYear() === now.getFullYear())
      .reduce((sum, r) => sum + (r.distance_km || 0), 0);

    const withRuns = chartData.filter((w) => w.total > 0);
    const avg = withRuns.length > 0
      ? parseFloat((withRuns.reduce((s, w) => s + w.total, 0) / withRuns.length).toFixed(1))
      : 0;

    const max = Math.max(...chartData.map((w) => w.total), 10);

    return { totalYearKm: parseFloat(yearKm.toFixed(1)), avgKm: avg, maxKm: max };
  }, [runs, chartData]);

  const barSize = period === "1S" ? 28 : period === "4S" ? 22 : period === "TUTTO" && chartData.length > 24 ? 8 : 14;

  return (
    <div className="bg-bg-card border border-[#1E293B] rounded-xl p-6 flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex justify-between items-start mb-6">
        <div className="text-xl font-bold text-text-primary">
          {totalYearKm > 0 ? `${totalYearKm.toLocaleString("it")} km` : "Nessuna corsa"}
          <span className="text-sm text-text-muted font-normal ml-2">quest'anno</span>
        </div>

        {/* ── Selettore periodo ── */}
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-md transition-all ${
                period === key
                  ? "bg-[#C0FF00] text-black"
                  : "text-text-muted hover:text-text-primary hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grafico ── */}
      <div className="flex-1 min-h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 0, left: -20, bottom: 0 }}
            barSize={barSize}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E293B" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748B", fontSize: 9 }}
              dy={10}
              interval={period === "TUTTO" && chartData.length > 24 ? Math.floor(chartData.length / 12) : 0}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748B", fontSize: 10 }}
              dx={-10}
              domain={[0, Math.ceil(maxKm * 1.15)]}
            />
            <Tooltip
              cursor={{ fill: "#1E293B", opacity: 0.4 }}
              content={<CustomTooltip />}
            />
            {avgKm > 0 && (
              <ReferenceLine
                y={avgKm}
                stroke="#94A3B8"
                strokeDasharray="3 3"
                label={{
                  position: "insideLeft",
                  value: `AVG ${avgKm} km`,
                  fill: "#E2E8F0",
                  fontSize: 10,
                  dy: -10,
                }}
              />
            )}

            <Bar dataKey="easy"      stackId="a" fill="#14B8A6" radius={[0, 0, 2, 2]} name="easy" />
            <Bar dataKey="tempo"     stackId="a" fill="#3B82F6" name="tempo" />
            <Bar dataKey="intervals" stackId="a" fill="#F59E0B" name="intervals" />
            <Bar dataKey="long"      stackId="a" fill="#F43F5E" name="long" />
            <Bar dataKey="race"      stackId="a" fill="#8B5CF6" radius={[2, 2, 0, 0]} name="race" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Legenda ── */}
      <div className="flex gap-6 mt-6 pt-6 border-t border-[#1E293B] text-[10px] text-text-muted font-semibold tracking-wider justify-center">
        {[
          { color: "#14B8A6", label: "EASY RUN" },
          { color: "#3B82F6", label: "TEMPO" },
          { color: "#F59E0B", label: "INTERVALS" },
          { color: "#F43F5E", label: "LONG RUN" },
          { color: "#8B5CF6", label: "RACE" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
