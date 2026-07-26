import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import {
  Activity,
  Timer,
  TrendingUp,
  TrendingDown,
  Gauge,
  Mountain,
} from "lucide-react";
import type { Run } from "../../types/api";
import { CHART_SERIES, CHART_SURFACE } from "./chartTheme";

const NEON = CHART_SERIES.primary;
const CYAN = CHART_SERIES.compare;
const LOAD = CHART_SERIES.load;
const RISK = CHART_SERIES.risk;
const POSITIVE = CHART_SERIES.positive;

const MONTH_NAMES = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

interface MonthYear {
  month: number;
  year: number;
}

function fmtLabel(my: MonthYear): string {
  return `${MONTH_NAMES[my.month].slice(0, 3)} ${my.year}`;
}

function parsePaceSec(pace?: string | null): number | null {
  if (!pace) return null;
  const [m, s] = pace.split(":").map(Number);
  if (isNaN(m) || isNaN(s)) return null;
  return m * 60 + s;
}

function fmtPace(sec: number): string {
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function filterRunsByPeriod(runs: Run[], my: MonthYear): Run[] {
  return runs.filter((r) => {
    const d = new Date(r.date);
    return d.getFullYear() === my.year && d.getMonth() === my.month;
  });
}

type StackedEntry = {
  label: string;
  easy: number;
  tempo: number;
  intervals: number;
  long: number;
  race: number;
  total: number;
};

function makeEntry(label: string): StackedEntry {
  return { label, easy: 0, tempo: 0, intervals: 0, long: 0, race: 0, total: 0 };
}

function classifyRun(run: Run): "easy" | "tempo" | "intervals" | "long" | "race" {
  const t = (run.run_type || "").toLowerCase();
  if (t.includes("race") || t.includes("gara") || t.includes("compet")) return "race";
  if (t.includes("long") || t.includes("fondo lungo")) return "long";
  if (t.includes("interval") || t.includes("speed") || t.includes("fartlek") || t.includes("ripetute")) return "intervals";
  if (t.includes("tempo") || t.includes("threshold") || t.includes("soglia")) return "tempo";
  return "easy";
}

const CAT_COLORS: Record<string, string> = {
  easy: CYAN,
  tempo: LOAD,
  intervals: RISK,
  long: "#F43F5E",
  race: "#A78BFA",
};

interface KpiSet {
  totalKm: number;
  runCount: number;
  avgDist: number;
  avgPace: number | null;
  avgHr: number | null;
  elevationGain: number;
  weekData: StackedEntry[];
  intensityDistribution: Record<string, number>;
}

function computeKpis(runs: Run[]): KpiSet {
  const totalKm = parseFloat(runs.reduce((s, r) => s + (r.distance_km || 0), 0).toFixed(1));
  const runCount = runs.length;
  const avgDist = runCount > 0 ? parseFloat((totalKm / runCount).toFixed(1)) : 0;
  const eleGain = parseFloat(runs.reduce((s, r) => s + (r.elevation_gain || 0), 0).toFixed(0));

  const hrRuns = runs.filter((r) => (r.avg_hr ?? 0) > 0);
  const avgHr = hrRuns.length > 0
    ? parseFloat((hrRuns.reduce((s, r) => s + (r.avg_hr ?? 0), 0) / hrRuns.length).toFixed(0))
    : null;

  const paceRuns = runs.filter((r) => r.avg_pace && parsePaceSec(r.avg_pace));
  const avgPace = paceRuns.length > 0
    ? paceRuns.reduce((s, r) => s + parsePaceSec(r.avg_pace!)!, 0) / paceRuns.length
    : null;

  const weeks = new Map<string, StackedEntry>();
  for (const r of runs) {
    const ws = getWeekStart(new Date(r.date));
    const key = ws.toISOString().slice(0, 10);
    if (!weeks.has(key)) weeks.set(key, makeEntry(key));
    const entry = weeks.get(key)!;
    const km = parseFloat((r.distance_km || 0).toFixed(1));
    entry[classifyRun(r)] = parseFloat((entry[classifyRun(r)] + km).toFixed(1));
    entry.total = parseFloat((entry.total + km).toFixed(1));
  }
  const weekData = [...weeks.values()].sort((a, b) => a.label.localeCompare(b.label));

  const intensity: Record<string, number> = { easy: 0, tempo: 0, intervals: 0, long: 0, race: 0 };
  for (const r of runs) {
    intensity[classifyRun(r)] = parseFloat((intensity[classifyRun(r)] + (r.distance_km || 0)).toFixed(1));
  }

  return { totalKm, runCount, avgDist, avgPace, avgHr, elevationGain: eleGain, weekData, intensityDistribution: intensity };
}

function deltaPct(a: number, b: number): number | null {
  if (b === 0) return null;
  return parseFloat((((a - b) / b) * 100).toFixed(1));
}

export function PeriodComparison({ runs }: { runs: Run[] }) {
  const now = new Date();
  const [periodA, setPeriodA] = useState<MonthYear>({ month: now.getMonth() - 1 >= 0 ? now.getMonth() - 1 : 11, year: now.getMonth() - 1 >= 0 ? now.getFullYear() : now.getFullYear() - 1 });
  const [periodB, setPeriodB] = useState<MonthYear>({ month: now.getMonth(), year: now.getFullYear() });

  const kpiA = useMemo(() => computeKpis(filterRunsByPeriod(runs, periodA)), [runs, periodA]);
  const kpiB = useMemo(() => computeKpis(filterRunsByPeriod(runs, periodB)), [runs, periodB]);

  const chartData = useMemo(() => {
    const allKeys = new Set([...kpiA.weekData.map((w) => w.label), ...kpiB.weekData.map((w) => w.label)]);
    return [...allKeys].sort().map((key) => {
      const wa = kpiA.weekData.find((w) => w.label === key);
      const wb = kpiB.weekData.find((w) => w.label === key);
      const d = new Date(key);
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      const a = wa?.total ?? 0;
      const b = wb?.total ?? 0;
      return { key, label, a, b, aDisplay: a > 0 ? a : null, bDisplay: b > 0 ? b : null };
    });
  }, [kpiA.weekData, kpiB.weekData]);

  const monthSelect = (value: MonthYear, onChange: (m: MonthYear) => void) => (
    <div className="flex gap-2">
      <select
        value={value.month}
        onChange={(e) => onChange({ ...value, month: parseInt(e.target.value) })}
        className="bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#C0FF00]/40"
      >
        {MONTH_NAMES.map((name, i) => (
          <option key={i} value={i}>{name}</option>
        ))}
      </select>
      <select
        value={value.year}
        onChange={(e) => onChange({ ...value, year: parseInt(e.target.value) })}
        className="bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#C0FF00]/40"
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );

  const Delta = ({ a, b, unit, inverted }: { a: number; b: number; unit: string; inverted?: boolean }) => {
    const d = deltaPct(a, b);
    if (d === null) return <span className="text-[#555] text-[11px] font-bold">—</span>;
    const improved = inverted ? d < 0 : d > 0;
    const color = improved ? POSITIVE : RISK;
    const icon = improved ? <TrendingUp className="w-3 h-3 inline" /> : <TrendingDown className="w-3 h-3 inline" />;
    return (
      <span className="text-[11px] font-bold inline-flex items-center gap-1" style={{ color }}>
        {icon} {d > 0 ? "+" : ""}{d}%
      </span>
    );
  };

  const KpiCard = ({
    icon: Icon,
    label,
    valueA,
    valueB,
    format,
    unit,
    inverted,
    color,
  }: {
    icon: typeof Activity;
    label: string;
    valueA: number | null;
    valueB: number | null;
    format?: (v: number) => string;
    unit: string;
    inverted?: boolean;
    color: string;
  }) => (
    <div className="rounded-2xl border p-4" style={{ background: "#0E0E0E", borderColor: "#1E1E1E" }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4" style={{ color }} />
        <div className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: "#888" }}>{label}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] font-bold text-[#555] mb-0.5">{fmtLabel(periodA)}</div>
          <div className="text-xl font-black text-white">{valueA != null ? (format ? format(valueA) : valueA) : "—"}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-[#555] mb-0.5">{fmtLabel(periodB)}</div>
          <div className="text-xl font-black text-white">{valueB != null ? (format ? format(valueB) : valueB) : "—"}</div>
        </div>
      </div>
      {valueA != null && valueB != null && (
        <div className="mt-2">
          <Delta a={valueA} b={valueB} unit={unit} inverted={inverted} />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[26px] border p-6" style={{ background: "#0E0E0E", borderColor: "#1E1E1E", borderLeft: `3px solid ${NEON}` }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-black italic text-white">Confronto Periodi</h2>
            <p className="text-[10px] tracking-[0.2em] font-bold text-[#666] mt-1">DUE MESI FACCIA A FACCIA — COSA È CAMBIATO?</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: NEON }} />
              <span className="text-[10px] font-black tracking-wider" style={{ color: "#888" }}>Periodo A</span>
              {monthSelect(periodA, setPeriodA)}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: CYAN }} />
              <span className="text-[10px] font-black tracking-wider" style={{ color: "#888" }}>Periodo B</span>
              {monthSelect(periodB, setPeriodB)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <KpiCard icon={Activity} label="Volume" valueA={kpiA.totalKm} valueB={kpiB.totalKm} unit="km" color={NEON} />
          <KpiCard icon={Activity} label="Uscite" valueA={kpiA.runCount} valueB={kpiB.runCount} unit="runs" color={CYAN} />
          <KpiCard icon={Gauge} label="Distanza media" valueA={kpiA.avgDist} valueB={kpiB.avgDist} unit="km" color={LOAD} />
          <KpiCard icon={Timer} label="Passo medio" valueA={kpiA.avgPace} valueB={kpiB.avgPace} format={fmtPace} unit="/km" inverted color={RISK} />
          <KpiCard icon={Activity} label="FC media" valueA={kpiA.avgHr} valueB={kpiB.avgHr} unit="bpm" inverted color="#F43F5E" />
          <KpiCard icon={Mountain} label="Dislivello" valueA={kpiA.elevationGain} valueB={kpiB.elevationGain} unit="m" color={POSITIVE} />
        </div>
      </section>

      {chartData.length > 0 && (
        <section className="rounded-[26px] border p-6" style={{ background: "#0E0E0E", borderColor: "#1E1E1E", borderLeft: `3px solid ${CYAN}` }}>
          <h3 className="text-sm font-black uppercase tracking-wider text-white mb-2">Volume Settimanale</h3>
          <p className="text-[10px] font-bold text-[#555] mb-4">{`${fmtLabel(periodA)} vs ${fmtLabel(periodB)}`}</p>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{ background: "#0A0A0A", border: "1px solid #1E1E1E", borderRadius: 12 }}
                  formatter={(v: number, name: string) => [`${v.toFixed(1)} km`, name === "a" ? fmtLabel(periodA) : fmtLabel(periodB)]}
                />
                <Bar dataKey="a" name="a" radius={[6, 6, 0, 0]} barSize={14} fill={NEON} fillOpacity={0.85} />
                <Bar dataKey="b" name="b" radius={[6, 6, 0, 0]} barSize={14} fill={CYAN} fillOpacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {kpiA.runCount + kpiB.runCount > 0 && (
        <section className="rounded-[26px] border p-6" style={{ background: "#0E0E0E", borderColor: "#1E1E1E", borderLeft: `3px solid ${LOAD}` }}>
          <h3 className="text-sm font-black uppercase tracking-wider text-white mb-4">Distribuzione Intensità</h3>
          <div className="space-y-3">
            {(["easy", "tempo", "intervals", "long", "race"] as const).map((cat) => {
              const a = kpiA.intensityDistribution[cat] || 0;
              const b = kpiB.intensityDistribution[cat] || 0;
              const total = Math.max(a, b, 1);
              const aPct = (a / total) * 100;
              const bPct = (b / total) * 100;
              return (
                <div key={cat} className="flex items-center gap-3">
                  <div className="w-14 text-[10px] font-black uppercase tracking-wider shrink-0 text-right" style={{ color: CAT_COLORS[cat] }}>{cat}</div>
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-[#555] w-16 text-right">{fmtLabel(periodA)}</span>
                      <div className="flex-1 h-5 rounded-lg relative" style={{ background: "rgba(255,255,255,0.04)" }}>
                        <div className="h-full rounded-lg" style={{ width: `${Math.max(aPct, 2)}%`, background: NEON }} />
                      </div>
                      <span className="text-[10px] font-bold text-white w-10 text-right">{a.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-[#555] w-16 text-right">{fmtLabel(periodB)}</span>
                      <div className="flex-1 h-5 rounded-lg relative" style={{ background: "rgba(255,255,255,0.04)" }}>
                        <div className="h-full rounded-lg" style={{ width: `${Math.max(bPct, 2)}%`, background: CYAN }} />
                      </div>
                      <span className="text-[10px] font-bold text-white w-10 text-right">{b.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
