import { useMemo } from "react";
import { Trees, Sprout, Leaf, Flower2, Droplets } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { getRuns } from "../../api";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import type { RunsResponse } from "../../types/api";
import { computeStats } from "./runStats";

const MONO = "'JetBrains Mono', monospace";
const GREENS = ["#10B981", "#34D399", "#22C55E", "#86EFAC"];
const AUTUMN = ["#F59E0B", "#FB923C", "#EAB308"];

/**
 * L'Albero Vivente — il chilometraggio fa crescere l'albero (altezza/chioma),
 * ogni gruppo di corse aggiunge foglie, i record fioriscono, e lo STREAK ne
 * decide la vitalità: rigoglioso se corri, foglie che cadono se ti fermi.
 */
function Tree({ growth, leaves, blossoms, vital }: { growth: number; leaves: number; blossoms: number; vital: boolean }) {
  const cx = 300;
  const groundY = 420;
  const topY = 230 - growth * 60;       // più alto con la crescita
  const canopyCY = topY - 6;
  const canopyR = 90 + growth * 70;

  // Foglie a spirale (phyllotaxis) — posizioni deterministiche
  const leafEls = Array.from({ length: leaves }, (_, i) => {
    const a = i * 2.399963;             // golden angle
    const rr = Math.sqrt((i + 1) / leaves) * canopyR;
    const x = cx + Math.cos(a) * rr;
    const y = canopyCY + Math.sin(a) * rr * 0.82 - 8;
    const green = vital ? true : i % 3 !== 0;
    const fill = green ? GREENS[i % GREENS.length] : AUTUMN[i % AUTUMN.length];
    const rot = (a * 180) / Math.PI;
    return <ellipse key={i} cx={x} cy={y} rx="7.5" ry="4" fill={fill} opacity={0.92} transform={`rotate(${rot} ${x} ${y})`} />;
  });

  // Fioriture (record) sui bordi della chioma
  const blossomEls = Array.from({ length: blossoms }, (_, i) => {
    const a = (i / Math.max(1, blossoms)) * Math.PI * 2 + 0.6;
    const rr = canopyR * 0.86;
    const x = cx + Math.cos(a) * rr;
    const y = canopyCY + Math.sin(a) * rr * 0.8 - 8;
    return (
      <g key={i} transform={`translate(${x} ${y})`}>
        {[0, 72, 144, 216, 288].map((d) => (
          <ellipse key={d} cx="0" cy="-5" rx="2.6" ry="5" fill="#F472B6" opacity="0.95" transform={`rotate(${d})`} />
        ))}
        <circle r="2.4" fill="#FDE68A" />
      </g>
    );
  });

  // Foglie cadute a terra quando non è vitale
  const fallen = !vital
    ? Array.from({ length: 10 }, (_, i) => {
        const x = 150 + ((i * 53) % 320);
        return <ellipse key={i} cx={x} cy={groundY + 6 + (i % 3) * 4} rx="6" ry="3" fill={AUTUMN[i % AUTUMN.length]} opacity="0.7" transform={`rotate(${i * 40} ${x} ${groundY})`} />;
      })
    : null;

  return (
    <svg viewBox="0 0 600 480" className="w-full max-w-[640px]">
      {/* alone chioma */}
      <ellipse cx={cx} cy={canopyCY - 6} rx={canopyR + 18} ry={(canopyR + 18) * 0.82} fill={vital ? "#10B98110" : "#F59E0B0E"} />
      {/* sole / luna */}
      <circle cx="510" cy="80" r="26" fill={vital ? "#FDE68A" : "#94A3B8"} opacity="0.85" />
      {/* terreno */}
      <line x1="60" y1={groundY} x2="540" y2={groundY} stroke="#3F3F46" strokeWidth="3" strokeLinecap="round" />
      {Array.from({ length: 18 }, (_, i) => <line key={i} x1={80 + i * 26} y1={groundY} x2={80 + i * 26 - 5} y2={groundY - 7} stroke="#10B98155" strokeWidth="2" strokeLinecap="round" />)}
      {/* radici (costanza) */}
      {[-1, 1].map((d) => <path key={d} d={`M ${cx} ${groundY} q ${d * 30} 14 ${d * 64} 22`} stroke="#52341E" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5" />)}
      {/* tronco */}
      <path d={`M ${cx - 18} ${groundY} C ${cx - 14} ${groundY - 60}, ${cx - 10} ${(groundY + topY) / 2}, ${cx - 7} ${topY} L ${cx + 7} ${topY} C ${cx + 10} ${(groundY + topY) / 2}, ${cx + 14} ${groundY - 60}, ${cx + 18} ${groundY} Z`} fill="#6B4423" />
      {/* rami principali */}
      {[[-1, 0.55], [1, 0.5], [-1, 0.8], [1, 0.75]].map(([d, t], i) => {
        const by = topY + (groundY - topY) * (1 - t) * 0.5 + 20;
        return <path key={i} d={`M ${cx} ${by} Q ${cx + d * 40} ${by - 30} ${cx + d * (60 + growth * 30)} ${by - 60 - growth * 20}`} stroke="#6B4423" strokeWidth={5 - i * 0.5} fill="none" strokeLinecap="round" />;
      })}
      {fallen}
      {leafEls}
      {blossomEls}
    </svg>
  );
}

export function GamificationV3() {
  const { data } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const runs = useMemo(() => data?.runs ?? [], [data]);
  const s = useMemo(() => computeStats(runs), [runs]);

  const growth = Math.max(0.15, Math.min(1, s.level / 12));
  const leaves = Math.max(3, Math.min(120, Math.round(s.m.totalRuns / 5)));
  const milestones = [
    s.m.best5k != null, s.m.best10k != null, s.m.longestRunKm >= 15, s.m.longestRunKm >= 30,
    s.m.weeklyMaxKm >= 40, s.m.maxStreak >= 7, s.m.totalKm >= 500, s.m.totalKm >= 1000,
  ].filter(Boolean).length;
  const vital = s.currentStreak > 0;

  const stats = [
    { icon: Sprout, label: "Altezza", value: `${Math.round(s.m.totalKm)}`, unit: "km nutriti", color: "#86EFAC" },
    { icon: Leaf, label: "Foglie", value: `${leaves}`, unit: `${s.m.totalRuns} corse`, color: "#10B981" },
    { icon: Droplets, label: "Vitalità", value: vital ? `${s.currentStreak}` : "0", unit: vital ? "giorni di streak" : "albero a riposo", color: vital ? "#22D3EE" : "#F59E0B" },
    { icon: Flower2, label: "Fioriture", value: `${milestones}`, unit: "record sbocciati", color: "#F472B6" },
  ];

  return (
    <main className="flex-1 overflow-y-auto bg-[#0A0A0A] text-white p-4 md:p-6 lg:p-10 min-h-0 custom-scrollbar">
      <div className="max-w-[1500px] mx-auto space-y-5 md:space-y-6">
        {/* HEADER */}
        <div className="flex items-center gap-3">
          <Trees className="w-6 h-6 text-[#10B981]" />
          <div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter uppercase italic">
              L'Albero <span className="text-[#10B981]">Vivente</span>
            </h1>
            <p className="text-gray-600 text-[10px] font-black tracking-[0.3em] uppercase mt-1">Gamification V3 · cresce con le tue corse</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
          {/* ALBERO */}
          <div className="lg:col-span-2 rounded-3xl border border-[#10B981]/20 bg-gradient-to-b from-[#10B981]/[0.05] to-black/50 p-4 md:p-6 grid place-items-center animate-in fade-in duration-700">
            <Tree growth={growth} leaves={leaves} blossoms={milestones} vital={vital} />
          </div>

          {/* PANNELLO */}
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-black/40 p-5">
              <div className="text-[10px] font-black tracking-[0.3em] uppercase text-gray-500 mb-1">Stato dell'albero</div>
              <div className="text-xl font-black" style={{ color: vital ? "#34D399" : "#F59E0B" }}>
                {vital ? "Rigoglioso" : "A riposo"}
              </div>
              <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                {vital
                  ? `Streak vivo di ${s.currentStreak} ${s.currentStreak === 1 ? "giorno" : "giorni"}: la chioma è verde e folta. Continua a correre per farlo crescere.`
                  : "Le foglie cadono: è da un po' che non corri. Una corsa e una sincronizzazione lo faranno rifiorire."}
              </p>
            </div>

            {stats.map((st, i) => {
              const Icon = st.icon;
              return (
                <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: `${st.color}1A` }}>
                    <Icon className="w-5 h-5" style={{ color: st.color }} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] font-black tracking-[0.2em] uppercase text-gray-500">{st.label}</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black tabular-nums" style={{ fontFamily: MONO, color: st.color }}>{st.value}</span>
                      <span className="text-[10px] text-gray-500">{st.unit}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
