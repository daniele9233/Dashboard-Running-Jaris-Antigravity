import { useMemo } from "react";
import { Swords, Zap, Activity, Flame, Heart, Mountain, ChevronRight } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { getRuns } from "../../api";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import type { RunsResponse } from "../../types/api";
import { computeStats, fmtPace, type GamiAttrs } from "./runStats";

const MONO = "'JetBrains Mono', monospace";
const ACCENT = "#22D3EE";
const ACCENT2 = "#C0FF00";

const ATTR_META: { key: keyof GamiAttrs; label: string; icon: typeof Zap; color: string }[] = [
  { key: "resistenza", label: "Resistenza", icon: Mountain, color: "#10B981" },
  { key: "velocita", label: "Velocità", icon: Zap, color: "#F43F5E" },
  { key: "costanza", label: "Costanza", icon: Flame, color: "#FB923C" },
  { key: "potenza", label: "Potenza", icon: Activity, color: "#A78BFA" },
  { key: "cuore", label: "Cuore", icon: Heart, color: "#22D3EE" },
];

/** Pentagono radar dei 5 attributi. */
function Radar({ attrs }: { attrs: GamiAttrs }) {
  const cx = 150, cy = 150, R = 110;
  const pts = ATTR_META.map((a, i) => {
    const ang = (-90 + i * 72) * (Math.PI / 180);
    const v = attrs[a.key] / 100;
    return { x: cx + Math.cos(ang) * R * v, y: cy + Math.sin(ang) * R * v, ax: cx + Math.cos(ang) * R, ay: cy + Math.sin(ang) * R, lx: cx + Math.cos(ang) * (R + 22), ly: cy + Math.sin(ang) * (R + 22), label: a.label, val: attrs[a.key], color: a.color };
  });
  const poly = pts.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <svg viewBox="0 0 300 300" className="w-full max-w-[340px]">
      {[0.25, 0.5, 0.75, 1].map((r) => (
        <polygon key={r} points={ATTR_META.map((_, i) => { const a = (-90 + i * 72) * (Math.PI / 180); return `${cx + Math.cos(a) * R * r},${cy + Math.sin(a) * R * r}`; }).join(" ")}
          fill="none" stroke="#FFFFFF12" strokeWidth="1" />
      ))}
      {pts.map((p, i) => <line key={i} x1={cx} y1={cy} x2={p.ax} y2={p.ay} stroke="#FFFFFF12" strokeWidth="1" />)}
      <polygon points={poly} fill={`${ACCENT}22`} stroke={ACCENT} strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill={p.color} />)}
      {pts.map((p, i) => (
        <text key={i} x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle" fill="#A1A1AA" style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700 }}>
          {p.label.toUpperCase()} <tspan fill={p.color}>{p.val}</tspan>
        </text>
      ))}
    </svg>
  );
}

export function GamificationV1() {
  const { data } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const runs = useMemo(() => data?.runs ?? [], [data]);
  const s = useMemo(() => computeStats(runs), [runs]);
  const xpPct = s.xpToNext > 0 ? Math.round((s.xpInLevel / s.xpToNext) * 100) : 100;

  return (
    <main className="flex-1 overflow-y-auto bg-[#0A0A0A] text-white p-4 md:p-6 lg:p-10 min-h-0 custom-scrollbar">
      <div className="max-w-[1500px] mx-auto space-y-5 md:space-y-6">
        {/* HEADER */}
        <div className="flex items-center gap-3">
          <Swords className="w-6 h-6 text-[#22D3EE]" />
          <div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter uppercase italic">
              Atleta <span className="text-[#22D3EE]">RPG</span>
            </h1>
            <p className="text-gray-600 text-[10px] font-black tracking-[0.3em] uppercase mt-1">Gamification V1 · progressione personaggio</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
          {/* HERO — livello + XP + overall */}
          <div className="lg:col-span-2 rounded-3xl border border-[#22D3EE]/20 bg-gradient-to-br from-[#22D3EE]/[0.06] to-black/50 p-6 md:p-8 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[#22D3EE]/10 blur-3xl pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
              {/* Level badge */}
              <div className="shrink-0 relative w-28 h-28 grid place-items-center">
                <svg viewBox="0 0 112 112" className="absolute inset-0 -rotate-90">
                  <circle cx="56" cy="56" r="50" fill="none" stroke="#FFFFFF10" strokeWidth="6" />
                  <circle cx="56" cy="56" r="50" fill="none" stroke={ACCENT} strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${(xpPct / 100) * 314} 314`} />
                </svg>
                <div className="text-center">
                  <div className="text-[9px] font-black tracking-[0.2em] text-gray-500 uppercase">LVL</div>
                  <div className="text-4xl font-black text-white tabular-nums" style={{ fontFamily: MONO }}>{s.level}</div>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#C0FF00]/30 bg-[#C0FF00]/10 mb-2">
                  <span className="text-[10px] font-black tracking-[0.25em] uppercase text-[#C0FF00]">{s.rank}</span>
                </div>
                <div className="flex items-baseline gap-3 mb-3">
                  <div>
                    <div className="text-[9px] font-black tracking-[0.2em] text-gray-500 uppercase">Overall</div>
                    <div className="text-5xl font-black tabular-nums" style={{ fontFamily: MONO, color: ACCENT2 }}>{s.overall}</div>
                  </div>
                  <div className="text-[11px] text-gray-500 pb-1">/ 100 rating complessivo</div>
                </div>
                {/* XP bar */}
                <div className="flex items-center justify-between text-[10px] font-bold mb-1.5">
                  <span className="text-gray-500 uppercase tracking-wider">XP livello</span>
                  <span style={{ fontFamily: MONO, color: ACCENT }}>{s.xpInLevel} / {s.xpToNext}</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#22D3EE] to-[#C0FF00] transition-all duration-700" style={{ width: `${xpPct}%` }} />
                </div>
                <div className="text-[10px] text-gray-600 mt-1.5">
                  XP totali: <span style={{ fontFamily: MONO }} className="text-gray-400">{s.totalXp.toLocaleString("it-IT")}</span> · {s.m.totalRuns} corse · {Math.round(s.m.totalKm)} km
                </div>
              </div>
            </div>
          </div>

          {/* RADAR */}
          <div className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-black/40 p-6 grid place-items-center">
            <Radar attrs={s.attrs} />
          </div>
        </div>

        {/* ATTRIBUTI */}
        <div className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.02] to-black/30 p-5 md:p-6">
          <h2 className="text-sm font-black tracking-[0.25em] uppercase text-white mb-4">Attributi</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ATTR_META.map((a) => {
              const v = s.attrs[a.key];
              const Icon = a.icon;
              return (
                <div key={a.key} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                  <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: `${a.color}1A` }}>
                    <Icon className="w-4 h-4" style={{ color: a.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-black uppercase tracking-wider text-gray-300">{a.label}</span>
                      <span className="text-sm font-black tabular-nums" style={{ fontFamily: MONO, color: a.color }}>{v}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${v}%`, background: a.color }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FEED XP */}
        <div className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.02] to-black/30 p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black tracking-[0.25em] uppercase text-white">Ultimi guadagni</h2>
            <span className="text-[10px] text-gray-600">passo migliore {fmtPace(s.bestPaceSecKm)}/km</span>
          </div>
          {s.recent.length === 0 ? (
            <p className="text-[11px] text-gray-500">Nessuna corsa: sincronizza per guadagnare XP.</p>
          ) : (
            <div className="space-y-2">
              {s.recent.map((r, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3.5 py-2.5">
                  <ChevronRight className="w-4 h-4 text-[#22D3EE] shrink-0" />
                  <span className="text-[11px] text-gray-400 tabular-nums w-24 shrink-0" style={{ fontFamily: MONO }}>{r.date}</span>
                  <span className="text-[12px] font-bold text-white tabular-nums w-20" style={{ fontFamily: MONO }}>{r.km.toFixed(1)} km</span>
                  <span className="text-[11px] text-gray-500 tabular-nums flex-1" style={{ fontFamily: MONO }}>{r.pace}/km</span>
                  <span className="text-[12px] font-black tabular-nums" style={{ fontFamily: MONO, color: ACCENT2 }}>+{r.xp} XP</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
