import { useMemo } from "react";
import {
  BarChart, Bar, AreaChart, Area,
  ResponsiveContainer, YAxis, Cell,
  XAxis, Tooltip,
} from "recharts";
import type { Run } from "../types/api";

interface TopStatsProps {
  runs: Run[];
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function parsePaceToSecs(pace: string): number {
  if (!pace) return 0;
  const parts = pace.split(":");
  if (parts.length !== 2) return 0;
  const m = parseInt(parts[0]);
  const s = parseInt(parts[1]);
  if (isNaN(m) || isNaN(s)) return 0;
  return m * 60 + s;
}

function secsToPaceStr(secs: number): string {
  if (secs <= 0) return "--";
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const DAY_NAMES = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const DAY_COLORS = ["#8B5CF6", "#3B82F6", "#14B8A6", "#F59E0B", "#F43F5E", "#10B981", "#EC4899"];

// ─── Tooltip per le barre dei giorni ─────────────────────────────────────────
const DayTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const { name, value } = payload[0].payload;
    return (
      <div className="bg-[#1E293B] border border-[#334155] px-3 py-2 rounded-lg shadow-xl text-xs">
        <p className="text-text-muted mb-1 font-semibold">{name}</p>
        <p className="text-text-primary font-bold">{value > 0 ? `${value} km` : "Riposo"}</p>
      </div>
    );
  }
  return null;
};

// ─── Tooltip per il passo ─────────────────────────────────────────────────────
const PaceTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const { name, value } = payload[0].payload;
    const paceStr = value > 0 ? secsToPaceStr(value * 60) : null;
    if (!paceStr) return null;
    return (
      <div className="bg-[#1E293B] border border-[#334155] px-3 py-2 rounded-lg shadow-xl text-xs">
        <p className="text-text-muted mb-1 font-semibold">{name}</p>
        <p className="text-text-primary font-bold">{paceStr} /km</p>
      </div>
    );
  }
  return null;
};

// ─── Tooltip per l'elevazione ─────────────────────────────────────────────────
const ElevTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const { name, value } = payload[0].payload;
    return (
      <div className="bg-[#1E293B] border border-[#334155] px-3 py-2 rounded-lg shadow-xl text-xs">
        <p className="text-text-muted mb-1 font-semibold">{name}</p>
        <p className="text-text-primary font-bold">{value.toLocaleString("it")} m</p>
      </div>
    );
  }
  return null;
};

// ─── Component ──────────────────────────────────────────────────────────────

export function TopStats({ runs }: TopStatsProps) {
  // ── Total Distance (questa settimana) ─────────────────────────────────────
  const { weekDayData, thisWeekKm, weekPct } = useMemo(() => {
    const weekStart = getWeekStart(new Date());
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(weekStart.getDate() - 7);

    const dayData = DAY_NAMES.map((name, i) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      const dayStr = dayDate.toISOString().slice(0, 10);
      const km = runs
        .filter((r) => r.date?.slice(0, 10) === dayStr)
        .reduce((sum, r) => sum + (r.distance_km || 0), 0);
      return { name, value: parseFloat(km.toFixed(1)), color: DAY_COLORS[i] };
    });

    const thisKm = parseFloat(dayData.reduce((s, d) => s + d.value, 0).toFixed(1));
    const lastKm = runs
      .filter((r) => {
        const d = r.date?.slice(0, 10);
        if (!d) return false;
        const rd = new Date(d);
        return rd >= lastWeekStart && rd < weekStart;
      })
      .reduce((sum, r) => sum + (r.distance_km || 0), 0);

    const pct = lastKm > 0 ? Math.round(((thisKm - lastKm) / lastKm) * 100) : null;
    return { weekDayData: dayData, thisWeekKm: thisKm, weekPct: pct };
  }, [runs]);

  // ── Avg Pace (andamento mensile) ──────────────────────────────────────────
  const { paceMonthData, currentPace, pacePct, paceMin, paceMax } = useMemo(() => {
    const now = new Date();
    const monthData: { name: string; value: number }[] = [];
    let currSecs = 0;
    let prevSecs = 0;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthRuns = runs.filter((r) => {
        const rd = new Date(r.date);
        return (
          rd.getFullYear() === d.getFullYear() &&
          rd.getMonth() === d.getMonth() &&
          r.avg_pace &&
          parsePaceToSecs(r.avg_pace) > 100
        );
      });
      const avgSecs =
        monthRuns.length > 0
          ? monthRuns.reduce((sum, r) => sum + parsePaceToSecs(r.avg_pace), 0) / monthRuns.length
          : 0;
      const decimalMins = avgSecs > 0 ? parseFloat((avgSecs / 60).toFixed(3)) : 0;
      monthData.push({
        name: d.toLocaleString("it", { month: "short" }).toUpperCase(),
        value: decimalMins,
      });
      if (i === 0) currSecs = avgSecs;
      if (i === 1) prevSecs = avgSecs;
    }

    const pct =
      prevSecs > 0 && currSecs > 0
        ? Math.round(((currSecs - prevSecs) / prevSecs) * 100)
        : null;

    const values = monthData.map((m) => m.value).filter((v) => v > 0);
    const minV = values.length > 0 ? Math.min(...values) - 0.3 : 4;
    const maxV = values.length > 0 ? Math.max(...values) + 0.3 : 7;

    return {
      paceMonthData: monthData,
      currentPace: secsToPaceStr(currSecs),
      pacePct: pct,
      paceMin: minV,
      paceMax: maxV,
    };
  }, [runs]);

  const paceYAxisLabels = useMemo(
    () => [
      secsToPaceStr(paceMax * 60),
      secsToPaceStr(((paceMin + paceMax) / 2) * 60),
      secsToPaceStr(paceMin * 60),
    ],
    [paceMin, paceMax]
  );

  // ── Elevation Gain (quest'anno) ───────────────────────────────────────────
  const { elevMonthData, thisYearElev, elevPct, elevMax } = useMemo(() => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const lastYear = thisYear - 1;

    const monthData: { name: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(thisYear, now.getMonth() - i, 1);
      const elev = runs
        .filter((r) => {
          const rd = new Date(r.date);
          return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
        })
        .reduce((sum, r) => sum + (r.elevation_gain || 0), 0);
      monthData.push({
        name: d.toLocaleString("it", { month: "short" }).toUpperCase(),
        value: Math.round(elev),
      });
    }

    const thisTotal = runs
      .filter((r) => new Date(r.date).getFullYear() === thisYear)
      .reduce((sum, r) => sum + (r.elevation_gain || 0), 0);
    const lastTotal = runs
      .filter((r) => new Date(r.date).getFullYear() === lastYear)
      .reduce((sum, r) => sum + (r.elevation_gain || 0), 0);

    const pct = lastTotal > 0 ? Math.round(((thisTotal - lastTotal) / lastTotal) * 100) : null;
    const maxV = Math.max(...monthData.map((m) => m.value), 200);

    return { elevMonthData: monthData, thisYearElev: Math.round(thisTotal), elevPct: pct, elevMax: maxV };
  }, [runs]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">

      {/* ── Total Distance ── */}
      <div className="bg-bg-card border border-[#1E293B] rounded-xl p-5 flex flex-col justify-between">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xs text-text-muted font-semibold tracking-wider mb-1 uppercase">Total Distance</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-text-primary">
                {thisWeekKm > 0 ? `${thisWeekKm} km` : "0 km"}
              </span>
              {weekPct !== null && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${weekPct >= 0 ? "text-[#14B8A6] bg-[#14B8A6]/10" : "text-[#F43F5E] bg-[#F43F5E]/10"}`}>
                  {weekPct >= 0 ? "+" : ""}{weekPct}%
                </span>
              )}
            </div>
          </div>
          <span className="text-xs text-text-secondary">QUESTA SETT.</span>
        </div>

        <div className="h-24 w-full mt-auto">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekDayData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" hide />
              <Tooltip
                content={<DayTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                {weekDayData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} opacity={entry.value > 0 ? 1 : 0.12} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-text-muted">
          {DAY_NAMES.map((d) => <span key={d}>{d}</span>)}
        </div>
      </div>

      {/* ── Avg Pace ── */}
      <div className="bg-bg-card border border-[#1E293B] rounded-xl p-5 flex flex-col justify-between">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xs text-text-muted font-semibold tracking-wider mb-1 uppercase">Avg Pace</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-text-primary">
                {currentPace !== "--" ? `${currentPace} /km` : "--"}
              </span>
              {pacePct !== null && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${pacePct <= 0 ? "text-[#14B8A6] bg-[#14B8A6]/10" : "text-[#F43F5E] bg-[#F43F5E]/10"}`}>
                  {pacePct >= 0 ? "+" : ""}{pacePct}%
                </span>
              )}
            </div>
          </div>
          <span className="text-xs text-text-secondary">QUEST'ANNO</span>
        </div>

        <div className="h-24 w-full mt-auto relative">
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] text-text-muted pb-6 pointer-events-none">
            {paceYAxisLabels.map((l, i) => <span key={i}>{l}</span>)}
          </div>
          <div className="ml-8 h-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={paceMonthData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPace" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" hide />
                <YAxis domain={[paceMin, paceMax]} hide />
                <Tooltip
                  content={<PaceTooltip />}
                  cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#F43F5E"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPace)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex justify-between ml-8 mt-2 text-[10px] text-text-muted">
          {paceMonthData.map((d) => <span key={d.name}>{d.name}</span>)}
        </div>
      </div>

      {/* ── Elevation Gain ── */}
      <div className="bg-bg-card border border-[#1E293B] rounded-xl p-5 flex flex-col justify-between">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xs text-text-muted font-semibold tracking-wider mb-1 uppercase">Elevation Gain</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-text-primary">
                {thisYearElev > 0 ? `${thisYearElev.toLocaleString("it")} m` : "0 m"}
              </span>
              {elevPct !== null && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${elevPct >= 0 ? "text-[#14B8A6] bg-[#14B8A6]/10" : "text-[#F43F5E] bg-[#F43F5E]/10"}`}>
                  {elevPct >= 0 ? "+" : ""}{elevPct}%
                </span>
              )}
            </div>
          </div>
          <span className="text-xs text-text-secondary">QUEST'ANNO</span>
        </div>

        <div className="h-24 w-full mt-auto relative">
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] text-text-muted pb-6 pointer-events-none">
            <span>{elevMax >= 1000 ? `${(elevMax / 1000).toFixed(1)}K` : elevMax}</span>
            <span>{elevMax >= 1000 ? `${(elevMax / 2000).toFixed(1)}K` : Math.round(elevMax / 2)}</span>
            <span>0</span>
          </div>
          <div className="ml-8 h-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={elevMonthData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorElevation" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" hide />
                <YAxis domain={[0, elevMax + 50]} hide />
                <Tooltip
                  content={<ElevTooltip />}
                  cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#14B8A6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorElevation)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex justify-between ml-8 mt-2 text-[10px] text-text-muted">
          {elevMonthData.map((d) => <span key={d.name}>{d.name}</span>)}
        </div>
      </div>
    </div>
  );
}
