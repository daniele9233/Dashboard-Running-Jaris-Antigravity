import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Run } from "../../../types/api";

/**
 * WeeklyKmChart — bar chart KM per giorno/mese, con range tabs 7d/month/year.
 *
 * Estratto da DashboardView.tsx (round 8 — #14 god component split continuation).
 * Self-contained: state interno (chartPeriod) + memos derivati (chartData, weeklyKmTotal).
 *
 * Riceve solo `runs` come prop. Tutta la logica di aggregazione è interna.
 */
export function WeeklyKmChart({ runs }: { runs: Run[] }) {
  const { t } = useTranslation();
  const [chartPeriod, setChartPeriod] = useState<'7d' | 'month' | 'year'>('year');

  const chartData = useMemo(() => {
    const toLocal = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (chartPeriod === '7d') {
      const now = new Date();
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now);
        d.setDate(now.getDate() - (6 - i));
        const ds = toLocal(d);
        const km = runs.filter(r => r.date.slice(0, 10) === ds).reduce((s, r) => s + r.distance_km, 0);
        const label = d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 3).toUpperCase();
        return { day: label, km: Math.round(km * 10) / 10 };
      });
    } else if (chartPeriod === 'month') {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const days = new Date(year, month + 1, 0).getDate();
      return Array.from({ length: days }, (_, i) => {
        const day = i + 1;
        const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const km = runs.filter(r => r.date.slice(0, 10) === ds).reduce((s, r) => s + r.distance_km, 0);
        return { day: String(day), km: Math.round(km * 10) / 10 };
      });
    } else {
      const now = new Date();
      return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
        const monthRuns = runs.filter(r => {
          const rd = new Date(r.date);
          return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
        });
        const km = monthRuns.reduce((s, r) => s + r.distance_km, 0);
        const label = d.toLocaleDateString('en', { month: 'short' }).toUpperCase();
        return { day: label, km: Math.round(km * 10) / 10 };
      });
    }
  }, [runs, chartPeriod]);

  const weeklyKmTotal = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 6);
    cutoff.setHours(0, 0, 0, 0);
    return runs.filter(r => new Date(r.date) >= cutoff).reduce((s, r) => s + r.distance_km, 0);
  }, [runs]);

  return (
    <div className="h-full bg-[#1a1a1a] border border-white/[0.06] rounded-3xl p-8 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[#A0A0A0] text-xs font-black tracking-widest">
            {chartPeriod === '7d'
              ? t("dashboard.last7Days").toUpperCase()
              : chartPeriod === 'month'
              ? t("dashboard.currentMonth").toUpperCase()
              : t("dashboard.last12Months").toUpperCase()}
          </div>
          {chartPeriod === '7d' && (
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-[#C0FF00] text-2xl font-black">{weeklyKmTotal.toFixed(1)}</span>
              <span className="text-[#A0A0A0] text-xs font-black">{t("dashboard.kmThisWeek").toUpperCase()}</span>
            </div>
          )}
        </div>
        <div className="flex bg-[#111] rounded-lg border border-white/[0.06] p-0.5" role="tablist" aria-label="Periodo grafico">
          {(['7d', 'month', 'year'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setChartPeriod(p)}
              className={`px-3 py-1 rounded-md text-[10px] font-black tracking-wider transition-all ${
                chartPeriod === p ? 'bg-[#C0FF00] text-black' : 'text-gray-500 hover:text-white'
              }`}
              role="tab"
              aria-selected={chartPeriod === p}
            >
              {p === '7d' ? '7D' : p === 'month' ? 'MONTH' : 'YEAR'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="day" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              contentStyle={{
                backgroundColor: "#111",
                border: "1px solid #333",
                borderRadius: "8px",
                color: "#fff",
              }}
            />
            <Bar dataKey="km" fill="#C0FF00" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
