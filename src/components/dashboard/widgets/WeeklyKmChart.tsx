import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Footprints } from "lucide-react";
import type { Run } from "../../../types/api";

/**
 * WeeklyKmChart — riepilogo settimanale (lun→dom) con obiettivo km inseribile
 * dall'utente, anello di progresso, barre giornaliere e tempo/dislivello.
 * Tab Mese/Anno mantengono il grafico a barre classico.
 */

const GOAL_KEY = "weekly-km-goal";
const DEFAULT_GOAL = 40;
const DAY_LETTERS = ["L", "M", "M", "G", "V", "S", "D"];
const LIME = "#C0FF00";
const CYAN = "#22D3EE";

const toLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function mondayOf(now: Date): Date {
  const dow = now.getDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1; // domenica → 6, lun → 0
  const m = new Date(now);
  m.setDate(now.getDate() - daysFromMon);
  m.setHours(0, 0, 0, 0);
  return m;
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export function WeeklyKmChart({ runs }: { runs: Run[] }) {
  const { t } = useTranslation();
  const [chartPeriod, setChartPeriod] = useState<'7d' | 'month' | 'year'>('7d');

  // ── Obiettivo km settimanale (persistente su localStorage) ──
  const [goal, setGoal] = useState<number>(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(GOAL_KEY) : null;
    const n = raw ? parseFloat(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_GOAL;
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(goal));
  const saveGoal = () => {
    const n = parseFloat(draft.replace(",", "."));
    if (Number.isFinite(n) && n > 0) {
      const v = Math.min(300, Math.round(n));
      setGoal(v);
      if (typeof window !== "undefined") localStorage.setItem(GOAL_KEY, String(v));
    }
    setEditing(false);
  };

  // ── Settimana corrente lun→dom: km/giorno + totali ──
  const week = useMemo(() => {
    const monday = mondayOf(new Date());
    const todayStr = toLocal(new Date());
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const ds = toLocal(d);
      const km = runs.filter(r => r.date?.slice(0, 10) === ds).reduce((s, r) => s + (r.distance_km || 0), 0);
      return { letter: DAY_LETTERS[i], km: Math.round(km * 10) / 10, isToday: ds === todayStr };
    });
    let totalMin = 0, totalElev = 0;
    for (const r of runs) {
      const ds = r.date?.slice(0, 10);
      if (!ds) continue;
      if (new Date(ds + "T00:00:00") >= monday) {
        totalMin += r.duration_minutes || 0;
        totalElev += r.elevation_gain || 0;
      }
    }
    const totalKm = Math.round(days.reduce((s, d) => s + d.km, 0) * 10) / 10;
    const maxKm = Math.max(...days.map(d => d.km), 0.1);
    return { days, totalKm, totalMin: Math.round(totalMin), totalElev: Math.round(totalElev), maxKm };
  }, [runs]);

  const pct = goal > 0 ? Math.min(100, Math.round((week.totalKm / goal) * 100)) : 0;
  const remaining = Math.max(0, Math.round((goal - week.totalKm) * 10) / 10);
  const R = 34, CIRC = 2 * Math.PI * R;

  // ── Dati barre Mese/Anno (grafico classico) ──
  const chartData = useMemo(() => {
    if (chartPeriod === 'month') {
      const now = new Date();
      const year = now.getFullYear(), month = now.getMonth();
      const days = new Date(year, month + 1, 0).getDate();
      return Array.from({ length: days }, (_, i) => {
        const day = i + 1;
        const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const km = runs.filter(r => r.date.slice(0, 10) === ds).reduce((s, r) => s + r.distance_km, 0);
        return { day: String(day), km: Math.round(km * 10) / 10 };
      });
    }
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const monthRuns = runs.filter(r => {
        const rd = new Date(r.date);
        return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
      });
      const km = monthRuns.reduce((s, r) => s + r.distance_km, 0);
      return { day: d.toLocaleDateString('en', { month: 'short' }).toUpperCase(), km: Math.round(km * 10) / 10 };
    });
  }, [runs, chartPeriod]);

  return (
    <div className="h-full rounded-[24px] p-6 flex flex-col overflow-hidden backdrop-blur-2xl border border-white/[0.12] shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50">
      {/* Header + tab periodo */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-[#A0A0A0] text-xs font-black tracking-widest">
          {chartPeriod === '7d'
            ? t("dashboard.thisWeek").toUpperCase()
            : chartPeriod === 'month'
            ? t("dashboard.currentMonth").toUpperCase()
            : t("dashboard.last12Months").toUpperCase()}
        </div>
        <div className="flex bg-[#111] rounded-[12px] border border-white/[0.06] p-0.5" role="tablist" aria-label="Periodo grafico">
          {(['7d', 'month', 'year'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setChartPeriod(p)}
              className={`px-3 py-1 rounded-[12px] text-[10px] font-black tracking-wider transition-all ${
                chartPeriod === p ? 'bg-[#C0FF00] text-black' : 'text-gray-500 hover:text-white'
              }`}
              role="tab"
              aria-selected={chartPeriod === p}
            >
              {p === '7d' ? '7D' : p === 'month' ? '1M' : '1Y'}
            </button>
          ))}
        </div>
      </div>

      {chartPeriod === '7d' ? (
        <div className="flex-1 flex flex-col justify-between min-h-0 gap-3">
          {/* Hero: totale / obiettivo + anello */}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-4xl font-black tabular-nums leading-none" style={{ color: LIME }}>{week.totalKm}</span>
                <span className="text-lg font-black text-gray-500 leading-none flex items-baseline gap-1">
                  /
                  {editing ? (
                    <input
                      type="number"
                      inputMode="numeric"
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={saveGoal}
                      onKeyDown={(e) => { if (e.key === "Enter") saveGoal(); if (e.key === "Escape") setEditing(false); }}
                      className="w-14 bg-transparent border-b border-[#C0FF00]/50 text-center text-[#C0FF00] outline-none tabular-nums"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setDraft(String(goal)); setEditing(true); }}
                      title={t("dashboard.setWeeklyGoal")}
                      className="text-white/80 hover:text-[#C0FF00] underline decoration-dotted underline-offset-4 transition-colors tabular-nums"
                    >
                      {goal}
                    </button>
                  )}
                  <span className="text-sm">km</span>
                </span>
              </div>
              <div className="text-[10px] font-bold mt-1" style={{ color: pct >= 100 ? LIME : "#8A8A8A" }}>
                {pct >= 100 ? t("dashboard.goalReached") : `${t("dashboard.toGo", { km: remaining })} · ${pct}%`}
              </div>
              <div className="flex gap-4 mt-3">
                <div>
                  <div className="text-white text-sm font-black tabular-nums leading-none">{fmtDuration(week.totalMin)}</div>
                  <div className="text-[9px] font-black tracking-widest uppercase text-gray-600 mt-0.5">{t("dashboard.weekTime")}</div>
                </div>
                <div>
                  <div className="text-white text-sm font-black tabular-nums leading-none">{week.totalElev} m</div>
                  <div className="text-[9px] font-black tracking-widest uppercase text-gray-600 mt-0.5">{t("dashboard.weekElevation")}</div>
                </div>
              </div>
            </div>

            {/* Anello di progresso */}
            <div className="relative shrink-0" style={{ width: 88, height: 88 }}>
              <svg width="88" height="88" viewBox="0 0 88 88">
                <defs>
                  <linearGradient id="wk-ring" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={LIME} />
                    <stop offset="100%" stopColor={CYAN} />
                  </linearGradient>
                </defs>
                <circle cx="44" cy="44" r={R} fill="none" stroke="#242424" strokeWidth="7" />
                <circle
                  cx="44" cy="44" r={R} fill="none" stroke="url(#wk-ring)" strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct / 100)}
                  transform="rotate(-90 44 44)" style={{ transition: "stroke-dashoffset 0.8s ease" }}
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <Footprints className="w-6 h-6" style={{ color: pct >= 100 ? LIME : "#E5E5E5" }} />
              </div>
            </div>
          </div>

          {/* Barre giornaliere lun→dom */}
          <div>
            <div className="flex items-end justify-between gap-1.5 h-14">
              {week.days.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end items-center h-full">
                  <div
                    className="w-full rounded-t-[3px] transition-all duration-500"
                    style={{
                      height: `${Math.max(d.km > 0 ? 8 : 3, (d.km / week.maxKm) * 100)}%`,
                      background: d.isToday ? LIME : d.km > 0 ? CYAN : "rgba(255,255,255,0.08)",
                    }}
                    title={`${d.km} km`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between gap-1.5 mt-1.5">
              {week.days.map((d, i) => (
                <div key={i} className="flex-1 text-center leading-none">
                  <span className="text-[10px] font-black" style={{ color: d.isToday ? LIME : "#5A5A5A" }}>{d.letter}</span>
                  {d.isToday && <div className="text-[7px] mt-0.5" style={{ color: LIME }}>▲</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="day" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
                contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: "12px", color: "#fff" }}
              />
              <Bar dataKey="km" fill="#C0FF00" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
