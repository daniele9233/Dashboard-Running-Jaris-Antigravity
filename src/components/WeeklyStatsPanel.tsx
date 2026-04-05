import { useMemo } from "react";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import type { Run } from "../types/api";

// ─── Ultimi 8 blocchi da 7 giorni ────────────────────────────────────────────
function buildWeeklyData(runs: Run[]) {
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  return Array.from({ length: 8 }, (_, idx) => {
    const weeksAgo = 7 - idx; // 7 = oldest, 0 = current week
    const end = new Date(now.getTime());
    end.setDate(now.getDate() - weeksAgo * 7);
    const start = new Date(end.getTime());
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const weekRuns = runs.filter((r) => {
      const d = new Date(r.date);
      return d >= start && d <= end;
    });

    const km = weekRuns.reduce((sum, r) => sum + r.distance_km, 0);
    const label =
      weeksAgo === 0
        ? "OGG"
        : start.toLocaleDateString("it", { day: "numeric", month: "short" }).toUpperCase();

    return { label, km: parseFloat(km.toFixed(1)), count: weekRuns.length, current: weeksAgo === 0 };
  });
}

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const { km, count } = payload[0].payload;
  return (
    <div className="bg-[#1E293B] border border-[#334155] px-2.5 py-2 rounded-lg shadow-xl text-xs">
      <p className="text-[#C0FF00] font-bold mb-0.5">{label}</p>
      <p className="text-white font-black">{km.toFixed(1)} km</p>
      <p className="text-[#64748B]">{count} {count === 1 ? "corsa" : "corse"}</p>
    </div>
  );
};

interface WeeklyStatsPanelProps {
  runs: Run[];
}

export function WeeklyStatsPanel({ runs }: WeeklyStatsPanelProps) {
  const weeklyData = useMemo(() => buildWeeklyData(runs), [runs]);
  const recentRuns = useMemo(() => runs.slice(0, 5), [runs]);

  if (runs.length === 0) {
    return (
      <div className="bg-bg-card border border-[#1E293B] rounded-xl flex items-center justify-center h-full">
        <p className="text-xs text-text-muted">Sincronizza corse per i dati settimanali</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-[#1E293B] rounded-xl h-full flex overflow-hidden">
      {/* Left: weekly km bars */}
      <div className="flex-1 p-4 flex flex-col min-w-0">
        <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-2">
          Volume Settimanale · 8 Settimane
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barSize={14}>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#475569", fontSize: 8 }}
                dy={4}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="km" radius={[3, 3, 0, 0]}>
                {weeklyData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.current ? "#C0FF00" : "#3B82F6"}
                    fillOpacity={entry.km > 0 ? (entry.current ? 0.9 : 0.6) : 0.12}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px bg-[#1E293B] my-3" />

      {/* Right: last runs */}
      <div className="w-[195px] shrink-0 p-4 flex flex-col overflow-hidden">
        <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-2">
          Ultime Corse
        </div>
        <div className="flex flex-col gap-0 flex-1 overflow-hidden">
          {recentRuns.map((run, i) => (
            <div
              key={run.id}
              className="flex items-center justify-between py-1.5 border-b border-[#0F172A] last:border-0"
            >
              <div className="min-w-0 flex items-center gap-2">
                <div
                  className="w-1 h-6 rounded-full shrink-0"
                  style={{ backgroundColor: i === 0 ? "#C0FF00" : "#1E293B" }}
                />
                <div>
                  <div className="text-[9px] text-[#64748B]">
                    {new Date(run.date).toLocaleDateString("it", { day: "numeric", month: "short" })}
                  </div>
                  <div className="text-xs font-black text-white leading-none">
                    {run.distance_km.toFixed(1)} km
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] font-bold text-[#14B8A6]">{run.avg_pace}/km</div>
                {run.avg_hr ? (
                  <div className="text-[9px] text-[#F43F5E]">♥ {run.avg_hr}</div>
                ) : (
                  <div className="text-[9px] text-[#334155]">
                    {run.duration_minutes < 60
                      ? `${Math.round(run.duration_minutes)}m`
                      : `${Math.floor(run.duration_minutes / 60)}h${Math.round(run.duration_minutes % 60)}m`}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
