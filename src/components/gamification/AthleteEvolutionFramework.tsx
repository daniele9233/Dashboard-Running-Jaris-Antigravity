import { useEffect, useMemo, useRef, useState } from "react";
import {
  Footprints, Sparkles, Flame, Zap, Medal, Award, Target, Trophy, Gem, Crown,
  Lock, Check, ChevronRight, Dna, TrendingUp, Activity, type LucideIcon,
} from "lucide-react";
import { gsap } from "../celebrations/gsapSetup";
import type { Run, Profile } from "../../types/api";
import { computeLevelSystem, type LevelSystem, type TierState, type LevelNode, type GoalState } from "./evolutionEngine";

const MONO = "'JetBrains Mono', monospace";
const ICONS: Record<string, LucideIcon> = { Footprints, Sparkles, Flame, Zap, Medal, Award, Target, Trophy, Gem, Crown };
const RUN_COLOR: Record<string, string> = { long: "#34D399", intervals: "#F43F5E", repetition: "#F43F5E", vo2max: "#F43F5E", tempo: "#FBBF24", threshold: "#FBBF24", fartlek: "#FB923C", progression: "#A3E635", easy: "#22D3EE", recovery: "#A78BFA", race: "#E879F9", trail: "#FB923C" };

function Panel({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl ${className}`} style={style}>{children}</div>;
}

export function AthleteEvolutionFramework({ runs, profile }: { runs: Run[]; profile: Profile | null }) {
  const sys = useMemo(() => computeLevelSystem(runs, profile), [runs, profile]);
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = gsap.context(() => {
      gsap.from(".aef-rise", { opacity: 0, y: 16, duration: 0.5, stagger: 0.05, ease: "power3.out" });
      gsap.from(".aef-xpfill", { scaleX: 0, transformOrigin: "left", duration: 1.1, ease: "power3.out", delay: 0.2 });
      gsap.from(".aef-node", { opacity: 0, scale: 0.6, duration: 0.5, stagger: 0.05, ease: "back.out(1.7)", delay: 0.25 });
    }, rootRef);
    return () => c.revert();
  }, [sys.ok]);

  // centra la traccia sul grado attuale
  useEffect(() => {
    const el = trackRef.current?.querySelector<HTMLElement>(".aef-node-current");
    if (el && trackRef.current) trackRef.current.scrollLeft = el.offsetLeft - trackRef.current.clientWidth / 2 + el.clientWidth / 2;
  }, [sys.tierIdx]);

  if (!sys.ok) return (
    <div className="h-full grid place-items-center text-gray-500"><p className="text-sm font-black uppercase tracking-widest">Sincronizza Strava per iniziare la tua evoluzione</p></div>
  );

  return (
    <div ref={rootRef} className="mx-auto max-w-5xl px-4 md:px-6 pt-20 pb-16 text-white">
      <Hero sys={sys} />
      <TierTrack sys={sys} trackRef={trackRef} />
      <LevelGrid sys={sys} />
      <Goals sys={sys} />
      <RecentRuns sys={sys} />
      <p className="mt-8 text-center text-[9px] tracking-widest uppercase text-gray-700">
        Ogni corsa frutta XP in base a durata · intensità · qualità — bonus per personal best e gare
      </p>
    </div>
  );
}

// ── HERO ──────────────────────────────────────────────────────────────────────
function Hero({ sys }: { sys: LevelSystem }) {
  const TierIcon = ICONS[sys.tier.icon] ?? Footprints;
  return (
    <Panel className="p-5 md:p-6 aef-rise relative overflow-hidden" style={{ background: `radial-gradient(130% 150% at 0% 0%, ${sys.tier.color}22, transparent 55%), rgba(255,255,255,0.03)` }}>
      <div className="flex items-center gap-2 mb-5">
        <Dna className="w-5 h-5 text-[#C0FF00]" />
        <h1 className="text-lg md:text-xl font-black tracking-tight uppercase italic">Athlete <span className="text-[#C0FF00]">Evolution</span></h1>
        <span className="ml-auto text-[10px] font-black tracking-widest uppercase text-gray-500">{sys.tiers.filter((t) => t.state !== "locked").length}/10 gradi · livello max {sys.maxLevel}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 md:gap-7 items-center">
        {/* livello grande */}
        <div className="flex items-center gap-4">
          <div className="relative grid place-items-center w-20 h-20 rounded-2xl shrink-0" style={{ background: `${sys.tier.color}1f`, border: `1px solid ${sys.tier.color}55` }}>
            <TierIcon className="w-9 h-9" style={{ color: sys.tier.color }} />
          </div>
          <div>
            <div className="text-[9px] font-black tracking-[0.3em] uppercase text-gray-500">Livello</div>
            <div className="flex items-end gap-1">
              <span className="text-6xl font-black tabular-nums leading-none" style={{ fontFamily: MONO, color: sys.tier.color }}>{sys.level}</span>
              <span className="text-lg font-black text-gray-600 mb-1">/{sys.maxLevel}</span>
            </div>
            <div className="text-sm font-black uppercase tracking-wider mt-1" style={{ color: sys.tier.color }}>{sys.title}</div>
          </div>
        </div>

        {/* barra XP + stats */}
        <div className="min-w-0">
          <div className="flex justify-between items-baseline text-[10px] mb-1.5">
            <span className="text-gray-500 uppercase tracking-wider">{sys.maxed ? "Livello massimo raggiunto" : <>verso <b className="text-white/80">Lv {sys.level + 1}</b></>}</span>
            <span style={{ fontFamily: MONO }} className="text-gray-400">{sys.intoLevel.toLocaleString("it-IT")}/{sys.spanLevel.toLocaleString("it-IT")} XP</span>
          </div>
          <div className="h-3 rounded-full bg-white/10 overflow-hidden">
            <div className="aef-xpfill h-full rounded-full" style={{ width: `${sys.pct}%`, background: `linear-gradient(90deg, ${sys.tier.color}, #C0FF00)` }} />
          </div>
          <div className="flex justify-between items-center mt-1.5">
            <span className="text-[10px] text-gray-600" style={{ fontFamily: MONO }}>{sys.totalXp.toLocaleString("it-IT")} XP totali</span>
            {!sys.maxed && <span className="text-[10px] font-black" style={{ fontFamily: MONO, color: "#C0FF00" }}>−{sys.xpToNext.toLocaleString("it-IT")} XP al prossimo</span>}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="Distanza" value={`${sys.stats.totalKm.toLocaleString("it-IT")}`} unit="km" />
            <Stat label="Corse" value={`${sys.stats.totalRuns}`} unit="totali" />
            <Stat label="Tempo" value={`${sys.stats.totalHours}`} unit="ore" />
          </div>
        </div>
      </div>
    </Panel>
  );
}
function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-center">
      <div className="text-[8px] font-black tracking-widest uppercase text-gray-500">{label}</div>
      <div className="text-lg font-black tabular-nums text-white leading-tight" style={{ fontFamily: MONO }}>{value}</div>
      <div className="text-[8px] text-gray-600">{unit}</div>
    </div>
  );
}

// ── TRACCIA ORIZZONTALE DEI GRADI (tappe-ricompensa) ──────────────────────────
function TierTrack({ sys, trackRef }: { sys: LevelSystem; trackRef: React.RefObject<HTMLDivElement> }) {
  return (
    <section className="mt-7 aef-rise">
      <SectionTitle icon={Trophy} hint={sys.nextReward ? `prossimo premio · ${sys.nextReward.name}` : "tutti i gradi sbloccati"}>I 10 Gradi · Tappe</SectionTitle>
      <Panel className="p-4">
        <div ref={trackRef} className="flex items-stretch gap-0 overflow-x-auto scrollbar-hide pb-1">
          {sys.tiers.map((t, i) => <TierNode key={t.idx} t={t} last={i === sys.tiers.length - 1} isNext={sys.nextReward?.idx === t.idx} />)}
        </div>
      </Panel>
    </section>
  );
}
function TierNode({ t, last, isNext }: { t: TierState; last: boolean; isNext: boolean }) {
  const Icon = ICONS[t.icon] ?? Footprints;
  const done = t.state === "done", current = t.state === "current";
  const dim = t.state === "locked" && !isNext;
  return (
    <div className={`aef-node ${current ? "aef-node-current" : ""} relative flex flex-col items-center shrink-0 w-[104px]`}>
      {/* connettore */}
      {!last && <span className="absolute top-7 left-1/2 w-full h-[3px] rounded-full" style={{ background: done ? t.color : "rgba(255,255,255,0.1)" }} />}
      {/* nodo */}
      <div className="relative grid place-items-center w-14 h-14 rounded-full z-10 transition-transform"
        style={{
          background: done || current ? `${t.color}22` : "rgba(255,255,255,0.04)",
          border: `2px solid ${done || current ? t.color : isNext ? t.color + "99" : "rgba(255,255,255,0.12)"}`,
          boxShadow: current ? `0 0 22px ${t.color}77` : "none", opacity: dim ? 0.5 : 1,
        }}>
        {current && <span className="absolute inset-0 rounded-full animate-ping" style={{ background: `${t.color}33` }} />}
        {done ? <Check className="w-6 h-6" style={{ color: t.color }} />
          : t.state === "locked" ? <Lock className="w-5 h-5 text-gray-500" />
          : <Icon className="w-6 h-6" style={{ color: t.color }} />}
      </div>
      <div className="mt-2 text-center px-1">
        <div className="text-[10px] font-black uppercase tracking-wide leading-tight" style={{ color: done || current || isNext ? t.color : "#6b7280" }}>{t.name}</div>
        <div className="text-[8px] text-gray-600" style={{ fontFamily: MONO }}>Lv {t.levelStart}–{t.levelEnd}</div>
        {current && <div className="mt-0.5 text-[8px] font-black text-white/80 tabular-nums" style={{ fontFamily: MONO }}>{t.unlockedLevels}/10 ✓</div>}
        {isNext && <div className="mt-0.5 text-[8px] font-black uppercase" style={{ color: t.color }}>prossimo</div>}
      </div>
    </div>
  );
}

// ── GRIGLIA DI TUTTI I 100 LIVELLI ────────────────────────────────────────────
function LevelGrid({ sys }: { sys: LevelSystem }) {
  const [hover, setHover] = useState<LevelNode | null>(null);
  const rows = useMemo(() => sys.tiers.map((t) => ({ t, cells: sys.levels.slice(t.levelStart - 1, t.levelEnd) })), [sys]);
  const info = hover ?? sys.levels[sys.level - 1];
  return (
    <section className="mt-7 aef-rise">
      <SectionTitle icon={TrendingUp} hint={`${sys.level} sbloccati · ${sys.maxLevel - sys.level} da conquistare`}>Tutti i 100 Livelli</SectionTitle>
      <Panel className="p-4">
        <div className="space-y-1.5">
          {rows.map(({ t, cells }) => {
            const TierIcon = ICONS[t.icon] ?? Footprints;
            return (
              <div key={t.idx} className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 w-[112px] shrink-0">
                  <TierIcon className="w-3.5 h-3.5 shrink-0" style={{ color: t.state === "locked" ? "#4b5563" : t.color }} />
                  <span className="text-[10px] font-black uppercase tracking-wide truncate" style={{ color: t.state === "locked" ? "#4b5563" : t.color }}>{t.name}</span>
                </div>
                <div className="flex gap-1 flex-1">
                  {cells.map((c) => (
                    <button key={c.n} type="button" onMouseEnter={() => setHover(c)} onMouseLeave={() => setHover(null)}
                      className="relative flex-1 aspect-square rounded-md transition-transform hover:scale-110"
                      title={`Lv ${c.n} · ${c.title}${c.unlocked ? "" : ` · ${c.cumXp.toLocaleString("it-IT")} XP`}`}
                      style={{
                        background: c.unlocked ? c.color : "rgba(255,255,255,0.05)",
                        border: c.current ? "2px solid #fff" : c.unlocked ? "none" : `1px solid ${t.color}33`,
                        boxShadow: c.current ? `0 0 12px ${c.color}` : "none",
                        opacity: c.unlocked ? 1 : 0.85,
                      }}>
                      {!c.unlocked && <Lock className="absolute inset-0 m-auto w-2.5 h-2.5 text-gray-600" />}
                      {c.current && <span className="absolute inset-0 rounded-md animate-pulse" style={{ boxShadow: `inset 0 0 0 2px #fff` }} />}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {/* dettaglio livello */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center w-8 h-8 rounded-lg text-[11px] font-black tabular-nums" style={{ background: `${info.color}22`, color: info.color, fontFamily: MONO }}>{info.n}</span>
            <div>
              <div className="text-[12px] font-black" style={{ color: info.color }}>{info.title}</div>
              <div className="text-[9px] text-gray-500">{info.unlocked ? (info.current ? "livello attuale" : "sbloccato") : "bloccato"}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-widest text-gray-500">soglia</div>
            <div className="text-sm font-black tabular-nums" style={{ fontFamily: MONO, color: info.unlocked ? "#C0FF00" : "#94A3B8" }}>{info.cumXp.toLocaleString("it-IT")} XP</div>
          </div>
        </div>
      </Panel>
    </section>
  );
}

// ── OBIETTIVI (livello/XP stimati per raggiungerli) ───────────────────────────
const GOAL_COLOR: Record<string, string> = { "5K": "#C0FF00", "10K": "#22D3EE", "Mezza": "#FB923C", "Maratona": "#E879F9" };
function Goals({ sys }: { sys: LevelSystem }) {
  return (
    <section className="mt-7 aef-rise">
      <SectionTitle icon={Target} hint={`${sys.goalsAchieved}/${sys.goals.length} alla tua portata · forma ~VDOT ${sys.currentVdot}`}>Obiettivi</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {sys.goals.map((g) => <GoalCard key={g.id} g={g} />)}
      </div>
    </section>
  );
}
function GoalCard({ g }: { g: GoalState }) {
  const col = GOAL_COLOR[g.group] ?? "#22D3EE";
  return (
    <Panel className="p-3.5" style={{ borderColor: g.achieved ? "#10B98155" : "rgba(255,255,255,0.1)" }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-1.5 py-0.5 rounded text-[8px] font-black tracking-wide uppercase shrink-0" style={{ background: `${col}22`, color: col }}>{g.group}</span>
          <span className="text-[13px] font-black text-white/90 truncate">{g.label}</span>
        </div>
        {g.achieved
          ? <span className="flex items-center gap-1 text-[10px] font-black uppercase shrink-0" style={{ color: "#10B981" }}><Check className="w-3.5 h-3.5" />Alla portata</span>
          : <span className="text-[11px] font-black tabular-nums shrink-0" style={{ fontFamily: MONO, color: col }}>≈ Lv {g.recLevel}</span>}
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-1.5">
        <div className="h-full rounded-full" style={{ width: `${g.progress}%`, background: g.achieved ? "#10B981" : `linear-gradient(90deg, ${col}, #C0FF00)` }} />
      </div>
      <div className="flex items-center justify-between text-[9px]" style={{ fontFamily: MONO }}>
        <span className="text-gray-500">previsto ora {g.predicted} <span style={{ color: g.achieved ? "#10B981" : "#94A3B8" }}>({g.gapLabel})</span></span>
        {g.achieved
          ? <span className="text-[#10B981] font-bold">raggiunto · Lv ~{g.recLevel}</span>
          : <span className="font-black" style={{ color: "#C0FF00" }}>mancano {g.xpGap.toLocaleString("it-IT")} XP</span>}
      </div>
    </Panel>
  );
}

// ── ULTIME CORSE → XP GUADAGNATI ──────────────────────────────────────────────
function RecentRuns({ sys }: { sys: LevelSystem }) {
  return (
    <section className="mt-7 aef-rise">
      <SectionTitle icon={Activity} hint="XP guadagnati">Ultime Corse</SectionTitle>
      <Panel className="p-2">
        {sys.recent.map((r, i) => {
          const col = RUN_COLOR[r.type] ?? "#22D3EE";
          return (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.03] transition-colors">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col }} />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-bold text-white/90 truncate">{r.name}</div>
                <div className="text-[9px] text-gray-500" style={{ fontFamily: MONO }}>{r.date} · {r.km} km
                  {r.isRace && <span className="ml-1.5 text-[#E879F9] font-black">GARA</span>}
                  {r.isPB && !r.isRace && <span className="ml-1.5 text-[#FBBF24] font-black">PB</span>}
                </div>
              </div>
              <span className="text-[13px] font-black tabular-nums shrink-0" style={{ fontFamily: MONO, color: "#C0FF00" }}>+{r.xp}</span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-700 shrink-0" />
            </div>
          );
        })}
      </Panel>
    </section>
  );
}

function SectionTitle({ icon: Icon, children, hint }: { icon: LucideIcon; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between mb-3 px-0.5">
      <div className="flex items-center gap-2"><Icon className="w-4 h-4 text-[#C0FF00]" /><h2 className="text-[11px] font-black tracking-[0.28em] uppercase text-white/90">{children}</h2></div>
      {hint && <span className="text-[9px] tracking-widest uppercase text-gray-600">{hint}</span>}
    </div>
  );
}
