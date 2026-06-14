import { useMemo } from "react";
import { Trophy, Check, Lock, Footprints, CalendarRange, Route, Flame, Target } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { getRuns } from "../../api";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import type { RunsResponse } from "../../types/api";
import { computeStats } from "./runStats";

const MONO = "'JetBrains Mono', monospace";
const GOLD = "#F59E0B";
const VIOLET = "#A78BFA";

const TIER_REWARDS = [
  "Spilla Bronzo", "Pettorale Argento", "Medaglia Oro", "Coccarda Rubino", "Trofeo Smeraldo",
  "Corona Zaffiro", "Stella Platino", "Aureola Diamante", "Sigillo Leggenda", "Gran Maestro",
];

export function GamificationV2() {
  const { data } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const runs = useMemo(() => data?.runs ?? [], [data]);
  const s = useMemo(() => computeStats(runs), [runs]);

  const quests = [
    { icon: Route, label: "Macina chilometri", desc: "Volume della settimana", cur: s.weekKm, target: 40, unit: "km", xp: 300, fmt: (v: number) => v.toFixed(1) },
    { icon: Footprints, label: "Presenze", desc: "Corse questa settimana", cur: s.weekRuns, target: 4, unit: "corse", xp: 200, fmt: (v: number) => String(Math.round(v)) },
    { icon: CalendarRange, label: "Vai lungo", desc: "Corsa più lunga · settimana", cur: s.weekLong, target: 14, unit: "km", xp: 250, fmt: (v: number) => v.toFixed(1) },
    { icon: Flame, label: "Catena viva", desc: "Giorni consecutivi attuali", cur: s.currentStreak, target: 5, unit: "giorni", xp: 350, fmt: (v: number) => String(Math.round(v)) },
    { icon: Target, label: "Obiettivo mensile", desc: "Volume del mese", cur: s.monthKm, target: 120, unit: "km", xp: 500, fmt: (v: number) => v.toFixed(0) },
  ];
  const completed = quests.filter((q) => q.cur >= q.target).length;

  const seasonXp = Math.round(s.monthKm * 8 + s.weekRuns * 30 + completed * 150);
  const TIER_STEP = 250;
  const tier = Math.min(TIER_REWARDS.length, Math.floor(seasonXp / TIER_STEP) + 1);
  const tierFloor = (tier - 1) * TIER_STEP;
  const tierPct = Math.round(((seasonXp - tierFloor) / TIER_STEP) * 100);

  return (
    <main className="flex-1 overflow-y-auto bg-[#0A0A0A] text-white p-4 md:p-6 lg:p-10 min-h-0 custom-scrollbar">
      <div className="max-w-[1500px] mx-auto space-y-5 md:space-y-6">
        {/* HEADER */}
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-[#F59E0B]" />
          <div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter uppercase italic">
              La <span className="text-[#F59E0B]">Stagione</span>
            </h1>
            <p className="text-gray-600 text-[10px] font-black tracking-[0.3em] uppercase mt-1">Gamification V2 · pass a tier &amp; quest</p>
          </div>
        </div>

        {/* SEASON TRACK */}
        <div className="rounded-3xl border border-[#F59E0B]/20 bg-gradient-to-br from-[#F59E0B]/[0.06] to-black/50 p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
            <div>
              <div className="text-[10px] font-black tracking-[0.3em] uppercase text-gray-500">Tier attuale</div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black tabular-nums" style={{ fontFamily: MONO, color: GOLD }}>{tier}</span>
                <span className="text-sm font-bold text-gray-400">/ {TIER_REWARDS.length} · {TIER_REWARDS[tier - 1]}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black tracking-[0.2em] uppercase text-gray-500">Season XP</div>
              <div className="text-2xl font-black tabular-nums" style={{ fontFamily: MONO, color: VIOLET }}>{seasonXp.toLocaleString("it-IT")}</div>
            </div>
          </div>

          {/* Nodi tier */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
            {TIER_REWARDS.map((rw, i) => {
              const n = i + 1;
              const reached = n < tier;
              const current = n === tier;
              return (
                <div key={i} className="flex items-center gap-1.5 shrink-0">
                  <div className="flex flex-col items-center gap-1.5 w-16">
                    <div className="w-10 h-10 rounded-xl grid place-items-center border-2 transition-colors"
                      style={{ borderColor: reached || current ? GOLD : "#27272A", background: reached ? `${GOLD}22` : current ? `${GOLD}14` : "#111" }}>
                      {reached ? <Check className="w-4 h-4" style={{ color: GOLD }} />
                        : current ? <span className="text-[11px] font-black tabular-nums" style={{ fontFamily: MONO, color: GOLD }}>{n}</span>
                          : <Lock className="w-3.5 h-3.5 text-gray-700" />}
                    </div>
                    <span className="text-[8px] text-center leading-tight" style={{ color: reached || current ? "#A1A1AA" : "#52525B" }}>{rw}</span>
                  </div>
                  {i < TIER_REWARDS.length - 1 && <div className="w-5 h-[2px] rounded-full" style={{ background: reached ? GOLD : "#27272A" }} />}
                </div>
              );
            })}
          </div>

          {/* progress al prossimo tier */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[10px] font-bold mb-1.5">
              <span className="text-gray-500 uppercase tracking-wider">Verso tier {Math.min(TIER_REWARDS.length, tier + 1)}</span>
              <span style={{ fontFamily: MONO, color: GOLD }}>{tierPct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#F59E0B] to-[#A78BFA] transition-all duration-700" style={{ width: `${tierPct}%` }} />
            </div>
          </div>
        </div>

        {/* QUEST */}
        <div className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.02] to-black/30 p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black tracking-[0.25em] uppercase text-white">Quest della settimana</h2>
            <span className="text-[10px] font-black" style={{ fontFamily: MONO, color: GOLD }}>{completed}/{quests.length} complete</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {quests.map((q, i) => {
              const pct = Math.min(100, Math.round((q.cur / q.target) * 100));
              const done = q.cur >= q.target;
              const Icon = q.icon;
              return (
                <div key={i} className="rounded-2xl border p-4 transition-colors"
                  style={{ borderColor: done ? `${GOLD}55` : "rgba(255,255,255,0.06)", background: done ? `${GOLD}0E` : "rgba(255,255,255,0.02)" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: done ? `${GOLD}22` : "rgba(167,139,250,0.12)" }}>
                      {done ? <Check className="w-4 h-4" style={{ color: GOLD }} /> : <Icon className="w-4 h-4" style={{ color: VIOLET }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-black uppercase tracking-wide text-white leading-tight">{q.label}</div>
                      <div className="text-[10px] text-gray-500">{q.desc}</div>
                    </div>
                    <span className="text-[11px] font-black tabular-nums shrink-0" style={{ fontFamily: MONO, color: done ? GOLD : VIOLET }}>+{q.xp}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] mb-1.5">
                    <span className="tabular-nums text-gray-300" style={{ fontFamily: MONO }}>{q.fmt(q.cur)} / {q.target} {q.unit}</span>
                    <span className="tabular-nums" style={{ fontFamily: MONO, color: done ? GOLD : "#71717A" }}>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: done ? GOLD : VIOLET }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-600 mt-4">Le quest si ricalcolano dai dati reali a ogni sync. Completarle fa salire i tier della stagione.</p>
        </div>
      </div>
    </main>
  );
}
