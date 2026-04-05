import { useMemo } from "react";
import {
  BarChart, Bar,
  ResponsiveContainer, Cell,
  XAxis, Tooltip,
} from "recharts";
import type { Run } from "../types/api";

interface TopStatsProps {
  runs: Run[];
}

// ─── Utilities ──────────────────────────────────────────────────────────────

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
const DayTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number } }> }) => {
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

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="mb-6">
      {/* ── Total Distance ── */}
      <div className="bg-bg-card border border-[#1E293B] rounded-xl p-5 flex flex-col justify-between max-w-sm">
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

        <div className="h-20 w-full mt-auto">
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
    </div>
  );
}
