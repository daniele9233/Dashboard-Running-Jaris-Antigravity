import { useMemo } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useApi } from '../hooks/useApi';
import { getCurrentWeek, getRuns } from '../api';
import type { TrainingWeek, RunsResponse } from '../types/api';

const SESSION_COLORS: Record<string, string> = {
  easy:      "#8B5CF6",
  recovery:  "#6B7280",
  intervals: "#EF4444",
  tempo:     "#F97316",
  long:      "#10B981",
  rest:      "transparent",
};

export function TrainingSidebar() {
  const { data: currentWeek } = useApi<TrainingWeek>(getCurrentWeek);
  const { data: runsData } = useApi<RunsResponse>(getRuns);

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

  // ── Weekly menu from current week sessions ──────────────────────────────────
  const weeklyMenu = useMemo(() => {
    if (!currentWeek?.sessions) return [];
    return currentWeek.sessions.map(session => {
      const d = new Date(session.date + 'T00:00:00');
      const dayLabel = d.toLocaleDateString('it-IT', {
        weekday: 'short', day: '2-digit', month: 'short',
      }).toUpperCase();
      return {
        date: dayLabel,
        type: session.type === 'rest' ? 'Riposo' : session.title,
        color: SESSION_COLORS[session.type] ?? '#6B7280',
        status: session.completed ? 'completed' as const
              : session.type === 'rest' ? 'rest' as const
              : 'pending' as const,
        km: session.target_distance_km > 0 ? session.target_distance_km : null,
      };
    });
  }, [currentWeek]);

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
            <span className="bg-white/20 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              No Injury
            </span>
          </div>

          <div className="absolute bottom-4 left-4">
            <h2 className="text-2xl font-bold text-white mb-1">Runner</h2>
            {currentWeek && (
              <p className="text-sm text-gray-300">
                Settimana {currentWeek.week_number} · {currentWeek.phase}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Mileage Chart */}
      <div className="p-6 border-b border-[#2A2A2A]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase">Km Settimanali</h3>
          <div className="flex gap-2">
            <button className="text-gray-500 hover:text-white"><ChevronLeft className="w-4 h-4" /></button>
            <button className="text-gray-500 hover:text-white"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="h-48 w-full">
          {mileageData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mileageData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6B7280', fontSize: 12 }}
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

      {/* Weekly Menu List */}
      <div className="p-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase">Weekly Menu</h3>
            {currentWeek && (
              <p className="text-xs text-gray-600 mt-0.5">
                {currentWeek.week_start} – {currentWeek.week_end}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button className="text-gray-500 hover:text-white"><ChevronLeft className="w-4 h-4" /></button>
            <button className="text-gray-500 hover:text-white"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        {weeklyMenu.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm">
            Nessun piano per questa settimana
          </div>
        ) : (
          <div className="space-y-3">
            {weeklyMenu.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-3 rounded-lg border-l-4 ${
                  item.status === 'rest' ? 'opacity-40' : 'bg-[#121212]'
                }`}
                style={{ borderLeftColor: item.color || '#2A2A2A' }}
              >
                <div className="flex items-center gap-4 min-w-0">
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
                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-gray-600" />
                    )}
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Week progress summary */}
        {currentWeek && (
          <div className="mt-6 p-4 bg-[#121212] rounded-xl border border-[#2A2A2A] space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Target settimana</span>
              <span className="text-white font-bold">{currentWeek.target_km} km</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Fase</span>
              <span className="text-gray-300">{currentWeek.phase}</span>
            </div>
            {currentWeek.target_vdot && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>VDOT target</span>
                <span className="text-[#3B82F6] font-bold font-mono">{currentWeek.target_vdot}</span>
              </div>
            )}
            {currentWeek.goal_race && currentWeek.target_time && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>Obiettivo</span>
                <span className="text-[#10B981] font-bold">{currentWeek.goal_race} in {currentWeek.target_time}</span>
              </div>
            )}
            {currentWeek.is_recovery_week && (
              <div className="text-xs text-amber-400">↓ Settimana di recupero</div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
