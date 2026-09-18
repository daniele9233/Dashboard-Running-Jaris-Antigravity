import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useApi } from '../hooks/useApi';
import { API_CACHE } from '../hooks/apiCacheKeys';
import { getRuns, getSub20Status, type Sub20StatusResponse } from '../api';
import type { RunsResponse } from '../types/api';
import { PLAN_BIBS, PLAN_KINDS, PLAN_META, PLAN_WEEKS } from '../data/mezzaOttobrePlan';

/** La settimana del piano da mostrare all'apertura: quella in corso, o la più vicina. */
function initialWeekIndex(todayIso: string): number {
  const i = PLAN_WEEKS.findIndex((w) => w.days[0].date <= todayIso && todayIso <= w.days[w.days.length - 1].date);
  if (i >= 0) return i;
  return todayIso < PLAN_WEEKS[0].days[0].date ? 0 : PLAN_WEEKS.length - 1;
}

export function TrainingSidebar() {
  const { data: runsData } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  // Il menu della settimana viene dal piano scritto, non dal vecchio piano
  // generato dal backend: quello era fermo a una settimana di dicembre.
  const { data: statusData } = useApi<Sub20StatusResponse>(getSub20Status, { cacheKey: "sub20-status" });
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [weekIdx, setWeekIdx] = useState(() => initialWeekIndex(todayIso));
  const week = PLAN_WEEKS[weekIdx];
  const currentIdx = PLAN_WEEKS.findIndex((w) => w.days[0].date <= todayIso && todayIso <= w.days[w.days.length - 1].date);

  // ── Weekly mileage from last 9 weeks ────────────────────────────────────────
  const mileageData = useMemo(() => {
    if (!runsData?.runs?.length) return [];

    const weekMap = new Map<string, number>();
    runsData.runs.forEach(run => {
      const d = new Date(run.date + 'T00:00:00');
      const dow = d.getDay();
      const diff = d.getDate() - dow + (dow === 0 ? -6 : 1); // Monday
      const mon = new Date(d);
      mon.setDate(diff);
      const key = mon.toISOString().slice(0, 10);
      weekMap.set(key, (weekMap.get(key) ?? 0) + run.distance_km);
    });

    const sorted = [...weekMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-9);
    return sorted.map(([dateStr, km], i) => {
      const d = new Date(dateStr + 'T00:00:00');
      const isFirst = i === 0;
      const isMonthStart = d.getDate() <= 7;
      const name = isFirst || isMonthStart
        ? d.toLocaleDateString('it-IT', { month: 'short' })
        : '';
      return { name, value: Math.round(km * 10) / 10 };
    });
  }, [runsData]);

  const maxMileage = Math.max(...mileageData.map(d => d.value), 10);
  const yMax = Math.ceil(maxMileage / 10) * 10;

  // ── Menu della settimana, dal piano ─────────────────────────────────────────
  const weeklyMenu = useMemo(() => {
    const manual = statusData?.statuses ?? {};
    return week.days.map((d) => {
      const dt = new Date(d.date + 'T00:00:00');
      const dayLabel = dt.toLocaleDateString('it-IT', {
        weekday: 'short', day: '2-digit', month: 'short',
      }).toUpperCase();
      return {
        date: dayLabel,
        type: d.title,
        color: PLAN_KINDS[d.kind].color,
        status: d.done || manual[d.date] === 'done' ? 'completed' as const
              : d.kind === 'rest' ? 'rest' as const
              : 'pending' as const,
        km: d.km ?? null,
        today: d.date === todayIso,
      };
    });
  }, [week, statusData, todayIso]);

  return (
    <div className="flex flex-col h-full bg-[#181818] border-l border-[#2A2A2A]">

      {/* Profile Card */}
      <div className="p-6 border-b border-[#2A2A2A]">
        <div className="relative h-48 rounded-xl overflow-hidden mb-4">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900">
            <img
              src="https://images.unsplash.com/photo-1552674605-171d31fea3fa?auto=format&fit=crop&q=80&w=800"
              alt="Runner"
              className="w-full h-full object-cover opacity-60 mix-blend-overlay"
            />
          </div>

          <div className="absolute top-4 left-4">
            <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              No Injury
            </span>
          </div>

          <div className="absolute bottom-4 left-4">
            <h2 className="text-2xl font-bold text-white mb-1">Runner</h2>
            <p className="text-sm text-gray-300">
              {currentIdx >= 0 ? `Settimana ${currentIdx + 1} di ${PLAN_WEEKS.length} · ` : ''}{PLAN_META.name}
            </p>
          </div>
        </div>
      </div>

      {/* Weekly Mileage Chart */}
      <div className="p-6 border-b border-[#2A2A2A]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase">Km Settimanali</h3>
        </div>

        <div className="h-48 w-full">
          {mileageData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mileageData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#878787", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#878787", fontSize: 12 }}
                  domain={[0, yMax]}
                  ticks={[0, Math.round(yMax / 4), Math.round(yMax / 2), Math.round(yMax * 3 / 4), yMax]}
                />
                <Tooltip
                  cursor={{ fill: '#2A2A2A' }}
                  contentStyle={{ backgroundColor: '#1E1E1E', border: '1px solid #2A2A2A', borderRadius: '8px', color: '#fff' }}
                  formatter={(value: number) => [`${value} KM`, 'Distanza']}
                  labelStyle={{ display: 'none' }}
                />
                <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                  {mileageData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill="#10B981"
                      opacity={index === mileageData.length - 1 ? 1 : 0.65}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-600 text-sm">
              Nessuna corsa registrata
            </div>
          )}
        </div>
      </div>

      {/* Menu della settimana */}
      <div className="p-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase">Settimana {week.n}</h3>
            <p className="text-xs text-gray-600 mt-0.5">{week.dates}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" aria-label="Settimana precedente" disabled={weekIdx === 0}
              onClick={() => setWeekIdx((i) => Math.max(0, i - 1))}
              className="text-gray-500 hover:text-white disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" aria-label="Settimana successiva" disabled={weekIdx === PLAN_WEEKS.length - 1}
              onClick={() => setWeekIdx((i) => Math.min(PLAN_WEEKS.length - 1, i + 1))}
              className="text-gray-500 hover:text-white disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {weeklyMenu.map((item, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between p-3 rounded-lg ${
                item.status === 'rest' ? 'opacity-40' : 'bg-surface-2'
              } ${item.today ? 'ring-1 ring-brand/40' : ''}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color || '#2A2A2A' }} aria-hidden />
                <span className="text-xs font-semibold text-gray-500 w-24 shrink-0">{item.date}</span>
                <div className="min-w-0">
                  <span className={`text-sm font-medium block truncate ${item.status === 'rest' ? 'text-gray-500' : 'text-gray-200'}`}>
                    {item.type}
                  </span>
                  {item.km && (
                    <span className="text-xs text-gray-500">{item.km} km</span>
                  )}
                </div>
              </div>

              {item.status !== 'rest' && (
                <CheckCircle2 className={`w-5 h-5 shrink-0 ${item.status === 'completed' ? 'text-[#10B981]' : 'text-gray-600'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Riepilogo della settimana */}
        <div className="mt-6 p-4 rounded-xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 space-y-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Km della settimana</span>
            <span className="text-white font-bold">{week.km}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Piano</span>
            <span className="text-gray-300">{PLAN_META.name}</span>
          </div>
          {PLAN_BIBS.map((b) => (
            <div key={b.id} className="flex justify-between gap-3 text-xs text-gray-500">
              <span className="truncate">{b.title} · {b.when}</span>
              <span className="font-bold shrink-0" style={{ color: b.band }}>{b.value}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
