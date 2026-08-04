import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Lock, GitBranch, Sparkles, Hammer, Calendar, TrendingUp } from "lucide-react";
import { gsap } from "../celebrations/gsapSetup";
import { useApi } from "../../hooks/useApi";
import { getRuns } from "../../api";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import type { RunsResponse } from "../../types/api";
import {
  buildTree, RESOURCES, RES_ORDER, type NodeState, type Play, type ResId, type TreeState,
} from "./skillTreeEngine";

const MONO = "'JetBrains Mono', monospace";
const CAPSTONE_COLOR = "#C0FF00";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.03] ${className}`}>{children}</div>;
}
function Head({ icon: Icon, title, hint }: { icon: typeof GitBranch; title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2 px-5 pt-4 pb-3">
      <Icon className="w-4 h-4 self-center text-white/70" />
      <h2 className="text-[11px] font-black tracking-[0.2em] uppercase text-white/90">{title}</h2>
      {hint && <span className="ml-auto text-[10px] text-gray-500 truncate">{hint}</span>}
    </div>
  );
}

// ── L'ALBERO ──────────────────────────────────────────────────────────────────
const W = 740, H = 400;
const COL_X = [80, 235, 390, 545, 700];            // un ramo per materiale, passo costante
const TIER_Y = [335, 258, 176, 88];                 // tier 1 in basso, 4 in cima
const ROOT: [number, number] = [390, 392];

function branchColor(b: NodeState["branch"]) {
  return b === "capstone" ? CAPSTONE_COLOR : RESOURCES[b as ResId].color;
}

function TreeCanvas({ st, selected, onSelect }: { st: TreeState; selected: string; onSelect: (id: string) => void }) {
  const cols = useMemo(() => {
    const map = new Map<string, { x: number; y: number; n: NodeState }>();
    RES_ORDER.forEach((res, ci) => {
      st.nodes.filter((n) => n.branch === res).forEach((n) => {
        map.set(n.id, { x: COL_X[ci], y: TIER_Y[n.tier - 1], n });
      });
    });
    return map;
  }, [st.nodes]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 460 }} role="group" aria-label="Albero dell'atleta">
      <defs>
        <filter id="nodeGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* tronco → base dei rami */}
      {RES_ORDER.map((res, ci) => {
        const x = COL_X[ci], y = TIER_Y[0];
        const anyUnlocked = st.nodes.some((n) => n.branch === res && n.unlocked);
        return (
          <path key={`trunk-${res}`}
            d={`M${ROOT[0]},${ROOT[1]} C${ROOT[0]},${(ROOT[1] + y) / 2} ${x},${(ROOT[1] + y) / 2} ${x},${y}`}
            fill="none" stroke={anyUnlocked ? RESOURCES[res].color : "#ffffff14"}
            strokeOpacity={anyUnlocked ? 0.45 : 1} strokeWidth="2" />
        );
      })}
      <circle cx={ROOT[0]} cy={ROOT[1]} r="6" fill="#ffffff" fillOpacity={0.25} />

      {/* segmenti fra i tier */}
      {RES_ORDER.map((res, ci) =>
        [1, 2, 3].map((t) => {
          const up = st.nodes.find((n) => n.branch === res && n.tier === t + 1);
          const lit = !!up?.unlocked;
          return (
            <line key={`seg-${res}-${t}`} x1={COL_X[ci]} x2={COL_X[ci]} y1={TIER_Y[t - 1]} y2={TIER_Y[t]}
              stroke={lit ? RESOURCES[res].color : "#ffffff14"} strokeOpacity={lit ? 0.5 : 1} strokeWidth="2" />
          );
        }),
      )}

      {/* etichette dei rami */}
      {RES_ORDER.map((res, ci) => (
        <text key={`lbl-${res}`} x={COL_X[ci]} y={370} textAnchor="middle" fontSize="9" fontFamily={MONO}
          fill={RESOURCES[res].color} opacity={0.75} letterSpacing="1">{RESOURCES[res].name.toUpperCase()}</text>
      ))}

      {/* nodi */}
      {[...cols.values()].map(({ x, y, n }) => (
        <TreeNode key={n.id} x={x} y={y} n={n} sel={selected === n.id} onSelect={onSelect} />
      ))}
    </svg>
  );
}

function TreeNode({ x, y, n, sel, onSelect }: { x: number; y: number; n: NodeState; sel: boolean; onSelect: (id: string) => void }) {
  const col = branchColor(n.branch);
  const R = 17, C = 2 * Math.PI * R;
  return (
    <g role="button" tabIndex={0} aria-label={`${n.name}, ${n.unlocked ? "sbloccato" : `${n.pct}% completato`}`}
      style={{ cursor: "pointer" }} className="tree-node"
      onClick={() => onSelect(n.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(n.id); } }}>
      {sel && <circle cx={x} cy={y} r={R + 8} fill="none" stroke={col} strokeOpacity={0.5} strokeWidth="1.5" strokeDasharray="3 3" />}
      <circle cx={x} cy={y} r={R} fill={n.unlocked ? col : "#111"} fillOpacity={n.unlocked ? 0.22 : 1}
        stroke={n.unlocked ? col : "#ffffff1f"} strokeWidth="2" filter={n.unlocked ? "url(#nodeGlow)" : undefined} />
      {!n.unlocked && n.pct > 0 && (
        <circle cx={x} cy={y} r={R} fill="none" stroke={col} strokeOpacity={0.85} strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={`${(C * n.pct) / 100} ${C}`} transform={`rotate(-90 ${x} ${y})`} />
      )}
      <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontFamily={MONO} fontWeight="bold"
        fill={n.unlocked ? col : "#8A8A8A"}>{n.unlocked ? "✦" : `${n.pct}`}</text>
      <text x={x} y={y + R + 13} textAnchor="middle" fontSize="8.5" fill={n.unlocked ? "#E5E7EB" : "#6B7280"}>
        {n.name.length > 20 ? n.name.slice(0, 19) + "…" : n.name}
      </text>
    </g>
  );
}

// ── PAGINA ────────────────────────────────────────────────────────────────────
export function GamificationV3() {
  const { data } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const runs = useMemo(() => data?.runs ?? [], [data]);
  const st = useMemo(() => buildTree(runs), [runs]);
  const [selId, setSelId] = useState<string>("");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selId && st.next[0]) setSelId(st.next[0].id);
  }, [st.next, selId]);

  useEffect(() => {
    const c = gsap.context(() => {
      gsap.from(".tr-rise", { opacity: 0, y: 14, duration: 0.45, stagger: 0.05, ease: "power3.out" });
      gsap.from(".tree-node", { opacity: 0, scale: 0.5, transformOrigin: "center", duration: 0.45, stagger: 0.02, ease: "back.out(1.8)", delay: 0.2 });
    }, root);
    return () => c.revert();
  }, [st.ok]);

  const sel = st.nodes.find((n) => n.id === selId) ?? st.next[0] ?? st.nodes[0];

  if (!st.ok) return (
    <main className="flex-1 grid place-items-center text-gray-500">
      <p className="text-sm font-black uppercase tracking-widest">Sincronizza le corse per far crescere l'albero</p>
    </main>
  );

  return (
    <main ref={root} className="flex-1 overflow-y-auto bg-black">
      <div className="mx-auto max-w-[1500px] px-4 md:px-6 py-8 text-white">

        {/* ── MATERIALI ──────────────────────────────────────────────────── */}
        <Card className="tr-rise p-5">
          <div className="flex flex-wrap items-baseline gap-3 mb-4">
            <GitBranch className="w-5 h-5 text-[#C0FF00] self-center" />
            <h1 className="text-lg md:text-xl font-black tracking-tight uppercase italic">Albero dell'<span className="text-[#C0FF00]">Atleta</span></h1>
            <span className="text-[11px] text-gray-500">
              {st.unlockedCount}/{st.total} nodi aperti
              {st.strongest && st.weakest && st.strongest.id !== st.weakest.id && (
                <> · forte in <b style={{ color: st.strongest.color }}>{st.strongest.name}</b>, indietro su <b style={{ color: st.weakest.color }}>{st.weakest.name}</b></>
              )}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {RES_ORDER.map((k) => {
              const r = RESOURCES[k];
              return (
                <div key={k} className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: r.color }}>{r.name}</span>
                    <span className="text-[9px] text-gray-500" style={{ fontFamily: MONO }}>{r.unit}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-black tabular-nums leading-none" style={{ fontFamily: MONO }}>{Math.round(st.res[k])}</span>
                    <span className="text-[10px] tabular-nums" style={{ fontFamily: MONO, color: st.rate[k] > 0 ? "#22C55E" : "#6B7280" }}>
                      +{st.rate[k]}/sett
                    </span>
                  </div>
                  <div className="text-[9.5px] text-gray-500 mt-1.5 leading-snug">da {r.from}</div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── ALBERO + NODO ──────────────────────────────────────────────── */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_0.7fr] items-start">
          <Card className="tr-rise overflow-hidden">
            <Head icon={GitBranch} title="I cinque rami" hint="il numero nel nodo è la percentuale mancante" />
            <div className="px-2 pb-2"><TreeCanvas st={st} selected={sel?.id ?? ""} onSelect={setSelId} /></div>
          </Card>

          <div className="grid gap-5">
            {sel && <NodeDetail n={sel} />}
            <Card className="tr-rise">
              <Head icon={Sparkles} title="I prossimi ad aprirsi" />
              <div className="px-4 pb-4 space-y-2">
                {st.next.map((n) => (
                  <button key={n.id} type="button" onClick={() => setSelId(n.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${sel?.id === n.id ? "border-white/25 bg-white/[0.06]" : "border-white/5 bg-white/[0.03] hover:bg-white/[0.05]"}`}>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-7 rounded-full shrink-0" style={{ background: branchColor(n.branch) }} />
                      <span className="text-[12px] font-bold text-white/90 flex-1 truncate">{n.name}</span>
                      <span className="text-[13px] font-black tabular-nums" style={{ fontFamily: MONO, color: branchColor(n.branch) }}>{n.pct}%</span>
                    </div>
                    <div className="mt-1 ml-4 text-[10px] text-gray-500">
                      {n.weeks != null ? `≈ ${n.weeks} settimane al tuo ritmo` : `fermo: non stai producendo ${n.blockedBy?.name}`}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* ── CAPSTONE ───────────────────────────────────────────────────── */}
        <Card className="tr-rise mt-5">
          <Head icon={TrendingUp} title="Dove i rami si incontrano" hint="i tempi non li sblocca un ramo solo" />
          <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-4">
            {st.nodes.filter((n) => n.branch === "capstone").map((n) => (
              <button key={n.id} type="button" onClick={() => setSelId(n.id)}
                className={`text-left rounded-xl p-3.5 border transition-colors ${n.unlocked ? "border-[#C0FF00]/40" : "border-white/8 hover:border-white/20"}`}
                style={{ background: n.unlocked ? "#C0FF0014" : "rgba(255,255,255,0.03)" }}>
                <div className="flex items-center gap-2 mb-1.5">
                  {n.unlocked ? <Check className="w-3.5 h-3.5 text-[#C0FF00]" /> : <Lock className="w-3.5 h-3.5 text-gray-600" />}
                  <span className="text-[12.5px] font-black uppercase tracking-wide" style={{ color: n.unlocked ? CAPSTONE_COLOR : "#E5E7EB" }}>{n.name}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden mb-2">
                  <div className="h-full rounded-full" style={{ width: `${n.pct}%`, background: CAPSTONE_COLOR }} />
                </div>
                <div className="text-[10.5px] text-gray-400 leading-snug">{n.effect}</div>
                <div className="text-[10px] mt-1.5" style={{ color: n.unlocked ? "#22C55E" : "#8A8A8A", fontFamily: MONO }}>
                  {n.unlocked ? "aperto" : n.weeks != null ? `≈ ${n.weeks} settimane` : `manca ${n.blockedBy?.name}`}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* ── COSA PRODUCE UNA SEDUTA + STORICO ──────────────────────────── */}
        <div className="mt-5 grid gap-5 lg:grid-cols-2 items-start">
          <Card className="tr-rise">
            <Head icon={Hammer} title="Cosa produce ogni seduta" hint="stessa formula dello storico, girata in avanti" />
            <div className="px-4 pb-4 space-y-2">
              {st.plays.map((p) => <PlayRow key={p.id} p={p} />)}
            </div>
          </Card>

          <Card className="tr-rise">
            <Head icon={Calendar} title="Le tue ultime corse" hint="cosa ha lasciato ognuna" />
            <div className="divide-y divide-white/5 max-h-[440px] overflow-y-auto">
              {st.recent.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="w-1.5 h-8 rounded-full shrink-0" style={{ background: r.zone.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-bold text-white/90 truncate">{r.name}</div>
                    <div className="text-[10px] text-gray-500" style={{ fontFamily: MONO }}>{r.date} · {r.km} km · {r.minutes} min · {r.zone.name}</div>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end shrink-0 max-w-[46%]">
                    {r.yields.map((y) => (
                      <span key={y.res.id} className="text-[9.5px] font-black tabular-nums px-1.5 py-0.5 rounded"
                        style={{ fontFamily: MONO, background: `${y.res.color}1f`, color: y.res.color }}>
                        +{y.amount} {y.res.unit}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

function NodeDetail({ n }: { n: NodeState }) {
  const col = branchColor(n.branch);
  return (
    <Card className="tr-rise overflow-hidden">
      <div className="px-5 pt-4 pb-3" style={{ background: `linear-gradient(180deg, ${col}1a, transparent)` }}>
        <div className="flex items-center gap-2">
          {n.unlocked
            ? <span className="grid place-items-center w-6 h-6 rounded-lg" style={{ background: `${col}2a` }}><Check className="w-3.5 h-3.5" style={{ color: col }} /></span>
            : <span className="grid place-items-center w-6 h-6 rounded-lg bg-white/5"><Lock className="w-3.5 h-3.5 text-gray-500" /></span>}
          <h3 className="text-[14px] font-black uppercase tracking-wide" style={{ color: col }}>{n.name}</h3>
          <span className="ml-auto text-[15px] font-black tabular-nums" style={{ fontFamily: MONO, color: col }}>{n.pct}%</span>
        </div>
      </div>
      <div className="px-5 pb-5 space-y-3">
        <div>
          <div className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-500 mb-1">Cosa sblocca</div>
          <p className="text-[12px] text-gray-300 leading-relaxed">{n.effect}</p>
        </div>
        <div>
          <div className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-500 mb-1">Come arrivarci</div>
          <p className="text-[12px] text-gray-400 leading-relaxed">{n.howTo}</p>
        </div>
        <div>
          <div className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-500 mb-1.5">Costo</div>
          <div className="space-y-1.5">
            {RES_ORDER.filter((k) => (n.cost[k] ?? 0) > 0).map((k) => {
              const need = n.cost[k]!;
              const miss = n.missing.find((m) => m.res.id === k);
              const have = miss ? miss.have : need;
              const r = RESOURCES[k];
              return (
                <div key={k} className="flex items-center gap-2">
                  <span className="text-[10px] w-16 shrink-0" style={{ color: r.color }}>{r.name}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (have / need) * 100)}%`, background: r.color }} />
                  </div>
                  <span className="text-[10px] tabular-nums text-gray-400 w-[74px] text-right" style={{ fontFamily: MONO }}>
                    {Math.round(have)}/{need}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="pt-2 border-t border-white/10 text-[11.5px]">
          {n.unlocked
            ? <span className="text-[#22C55E] font-bold">Nodo aperto.</span>
            : n.weeks != null
              ? <>Al ritmo delle ultime 8 settimane si apre fra <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{n.weeks}</b> settimane. A frenare è <b style={{ color: n.blockedBy?.color }}>{n.blockedBy?.name}</b>.</>
              : <span className="text-[#F43F5E]">Fermo: non stai producendo <b>{n.blockedBy?.name}</b>. Senza quel tipo di seduta questo nodo non si apre mai.</span>}
        </div>
      </div>
    </Card>
  );
}

function PlayRow({ p }: { p: Play }) {
  return (
    <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5">
      <div className="flex items-center gap-2.5">
        <span className="w-1.5 h-8 rounded-full shrink-0" style={{ background: p.zone.color }} />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-bold text-white/90 truncate">{p.label}</div>
          <div className="text-[10px] text-gray-500 truncate">{p.detail}</div>
        </div>
        <div className="flex flex-wrap gap-1 justify-end shrink-0 max-w-[45%]">
          {p.yields.map((y) => (
            <span key={y.res.id} className="text-[9.5px] font-black tabular-nums px-1.5 py-0.5 rounded"
              style={{ fontFamily: MONO, background: `${y.res.color}1f`, color: y.res.color }}>
              +{y.amount} {y.res.unit}
            </span>
          ))}
        </div>
      </div>
      {p.moves && (
        <div className="mt-1.5 ml-4 text-[10px] text-gray-500">
          avvicina <b className="text-gray-300">{p.moves.node.name}</b> di <b style={{ color: branchColor(p.moves.node.branch) }}>+{p.moves.gainPct}%</b>
        </div>
      )}
    </div>
  );
}
