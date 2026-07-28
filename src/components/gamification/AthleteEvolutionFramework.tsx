import { useEffect, useMemo, useRef, useState } from "react";
import {
  Footprints, Sparkles, Flame, Zap, Medal, Award, Target, Trophy, Gem, Crown,
  Lock, Check, ChevronRight, Dna, TrendingUp, TrendingDown, Minus, Activity,
  Star, X, LineChart, Gauge, type LucideIcon,
} from "lucide-react";
import { gsap } from "../celebrations/gsapSetup";
import type { Run, Profile } from "../../types/api";
import { CHART_SERIES, CHART_TEXT } from "../statistics/chartTheme";
import {
  computeLevelSystem, XP_BONUS,
  type LevelSystem, type TierState, type LevelNode, type Projection, type XpExample,
  type LevelGain,
} from "./evolutionEngine";

const MONO = "'JetBrains Mono', monospace";
const ICONS: Record<string, LucideIcon> = { Footprints, Sparkles, Flame, Zap, Medal, Award, Target, Trophy, Gem, Crown };
const RUN_COLOR: Record<string, string> = { long: "#34D399", intervals: "#F43F5E", repetition: "#F43F5E", vo2max: "#F43F5E", tempo: "#FBBF24", threshold: "#FBBF24", fartlek: "#FB923C", progression: "#A3E635", easy: "#22D3EE", recovery: "#A78BFA", race: "#E879F9", trail: "#FB923C" };

function Panel({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl ${className}`} style={style}>{children}</div>;
}

const LEVEL_KEY = "aef-last-level";

export function AthleteEvolutionFramework({ runs, profile }: { runs: Run[]; profile: Profile | null }) {
  // La proiezione dipende da che giorno è oggi: se la pagina resta aperta o il
  // tab torna in primo piano dopo giorni, la data va rinfrescata o le finestre
  // (ritmo XP, forma recente) resterebbero ferme al momento del caricamento.
  const [today, setToday] = useState(() => new Date().toISOString().slice(0, 10));
  useEffect(() => {
    const sync = () => setToday(new Date().toISOString().slice(0, 10));
    const id = window.setInterval(sync, 30 * 60 * 1000);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const sys = useMemo(() => computeLevelSystem(runs, profile, today), [runs, profile, today]);
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [levelUp, setLevelUp] = useState<{ from: number; to: number; title: string; newTier: TierState | null } | null>(null);

  // LEVEL UP: festeggia se il livello è salito rispetto all'ultimo visto.
  // La baseline è catturata a stato/ref così la scrittura su localStorage non
  // "avvelena" la lettura (StrictMode double-mount in dev).
  const [storedLevel] = useState<number | null>(() => {
    const raw = localStorage.getItem(LEVEL_KEY); const n = Number(raw);
    return raw == null || Number.isNaN(n) ? null : n;
  });
  const baselineRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!sys.ok) return;
    const prev = baselineRef.current === undefined ? storedLevel : baselineRef.current;
    if (prev != null && sys.level > prev) {
      const crossedTier = Math.floor((sys.level - 1) / 10) > Math.floor((prev - 1) / 10);
      setLevelUp({ from: prev, to: sys.level, title: sys.title, newTier: crossedTier ? sys.tier : null });
    }
    baselineRef.current = sys.level;
    localStorage.setItem(LEVEL_KEY, String(sys.level));
  }, [sys.ok, sys.level]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const c = gsap.context(() => {
      gsap.from(".aef-rise", { opacity: 0, y: 16, duration: 0.5, stagger: 0.05, ease: "power3.out" });
      gsap.from(".aef-xpfill", { scaleX: 0, transformOrigin: "left", duration: 1.1, ease: "power3.out", delay: 0.2 });
      gsap.from(".aef-node", { opacity: 0, scale: 0.6, duration: 0.5, stagger: 0.05, ease: "back.out(1.7)", delay: 0.25 });
      gsap.from(".aef-curve", { drawSVG: "0%", duration: 1.3, ease: "power2.inOut", delay: 0.35 });
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
    // stessa larghezza delle altre pagine (Badge, Ranking, Runner DNA): con
    // max-w-6xl questa restava una colonna stretta persa in mezzo allo schermo
    <div ref={rootRef} className="mx-auto max-w-[1500px] px-4 md:px-6 pt-20 pb-16 text-white">
      <Hero sys={sys} />

      {/* colonna sinistra = dove stai andando · destra = come ci arrivi */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr] items-start">
        <ProjectionPanel p={sys.projection} />
        <XpLegendPanel sys={sys} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr] items-start">
        <PathPanel sys={sys} trackRef={trackRef} />
        <RecentRuns sys={sys} />
      </div>

      {levelUp && <LevelUpOverlay info={levelUp} tier={sys.tier} onClose={() => setLevelUp(null)} />}
    </div>
  );
}

// ── OVERLAY "LEVEL UP!" ───────────────────────────────────────────────────────
function LevelUpOverlay({ info, tier, onClose }: { info: { from: number; to: number; title: string; newTier: TierState | null }; tier: TierState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const col = (info.newTier ?? tier).color;
  const TierIcon = ICONS[(info.newTier ?? tier).icon] ?? Star;
  const sparks = useMemo(() => Array.from({ length: 18 }, (_, i) => i), []);
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.timeline()
        .from(".lu-card", { scale: 0.6, opacity: 0, duration: 0.5, ease: "back.out(1.8)" })
        .from(".lu-title", { y: -16, opacity: 0, duration: 0.4 }, "-=0.2")
        .from(".lu-badge", { scale: 0, opacity: 0, duration: 0.5, ease: "back.out(2)" }, "-=0.15")
        .from(".lu-num", { scale: 0.3, opacity: 0, duration: 0.5, ease: "back.out(2.2)" }, "-=0.2")
        .from(".lu-spark", { scale: 0, opacity: 1, x: 0, y: 0, duration: 0.9, stagger: 0.025, ease: "power2.out" }, "-=0.4");
      gsap.to(".lu-rays", { rotate: 360, duration: 22, repeat: -1, ease: "none" });
    }, ref);
    const t = window.setTimeout(onClose, 7000);
    return () => { window.clearTimeout(t); ctx.revert(); };
  }, [info.from, info.to, onClose]);

  return (
    <div ref={ref} className="fixed inset-0 z-[100] grid place-items-center" onClick={onClose} style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)" }}>
      <div className="lu-card relative w-[340px] max-w-[88vw] rounded-3xl border p-7 text-center overflow-hidden"
        onClick={(e) => e.stopPropagation()} style={{ borderColor: col + "66", background: `radial-gradient(120% 120% at 50% 0%, ${col}26, rgba(10,10,12,0.96))` }}>
        <button type="button" onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
        {/* raggi rotanti */}
        <div className="lu-rays absolute left-1/2 top-[120px] -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] pointer-events-none opacity-40"
          style={{ background: `repeating-conic-gradient(${col}22 0deg 12deg, transparent 12deg 24deg)`, maskImage: "radial-gradient(circle, #000 35%, transparent 70%)", WebkitMaskImage: "radial-gradient(circle, #000 35%, transparent 70%)" }} />
        {/* scintille */}
        {sparks.map((i) => {
          const a = (i / sparks.length) * Math.PI * 2, R = 120;
          return <span key={i} className="lu-spark absolute w-1.5 h-1.5 rounded-full" style={{ left: "50%", top: "120px", background: col, transform: `translate(${Math.cos(a) * R}px, ${Math.sin(a) * R}px)`, boxShadow: `0 0 8px ${col}` }} />;
        })}

        <div className="lu-title relative text-[13px] font-black tracking-[0.4em] uppercase mb-1" style={{ color: col }}>Level Up!</div>
        <div className="relative grid place-items-center mb-3">
          <div className="lu-badge grid place-items-center w-20 h-20 rounded-2xl mb-2" style={{ background: `${col}1f`, border: `2px solid ${col}` }}>
            <TierIcon className="w-10 h-10" style={{ color: col }} />
          </div>
          <div className="flex items-end gap-1.5">
            <span className="text-[11px] text-gray-500 font-black mb-2">Lv {info.from} →</span>
            <span className="lu-num text-6xl font-black tabular-nums leading-none" style={{ fontFamily: MONO, color: col }}>{info.to}</span>
          </div>
          <div className="text-base font-black uppercase tracking-wider mt-1" style={{ color: col }}>{info.title}</div>
        </div>
        {info.newTier && (
          <div className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-3" style={{ background: `${col}22`, color: col }}>
            <Sparkles className="w-3 h-3" />Nuovo grado · {info.newTier.name}
          </div>
        )}
        <button type="button" onClick={onClose} className="relative w-full mt-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-transform hover:scale-[1.02]" style={{ background: col, color: "#0a0a0c" }}>Continua</button>
      </div>
    </div>
  );
}

// ── HERO ──────────────────────────────────────────────────────────────────────
function Hero({ sys }: { sys: LevelSystem }) {
  const TierIcon = ICONS[sys.tier.icon] ?? Footprints;
  const p = sys.projection;
  const TrendIcon = p.trend === "up" ? TrendingUp : p.trend === "down" ? TrendingDown : Minus;
  const trendCol = p.trend === "up" ? CHART_SERIES.positive : p.trend === "down" ? CHART_SERIES.risk : CHART_TEXT.axis;
  return (
    <Panel className="p-5 md:p-6 aef-rise relative overflow-hidden" style={{ background: `radial-gradient(130% 150% at 0% 0%, ${sys.tier.color}22, transparent 55%), rgba(255,255,255,0.03)` }}>
      <div className="flex items-center gap-2 mb-5">
        <Dna className="w-5 h-5 text-[#C0FF00]" />
        <h1 className="text-lg md:text-xl font-black tracking-tight uppercase italic">Athlete <span className="text-[#C0FF00]">Evolution</span></h1>
        <span className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black tabular-nums"
          style={{ fontFamily: MONO, background: `${trendCol}1f`, color: trendCol }} title="Forma stimata a temperatura ideale">
          <Gauge className="w-3 h-3" />VDOT {sys.currentVdot}
          {p.ok && <><TrendIcon className="w-3 h-3 ml-0.5" />{p.perMonth > 0 ? "+" : ""}{p.perMonth.toFixed(2)}/mese</>}
        </span>
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

// ── PROIEZIONE: quanto costa in XP il prossimo pezzo di forma ─────────────────
const xpFmt = (n: number) => n.toLocaleString("it-IT");

function ProjectionPanel({ p }: { p: Projection }) {
  if (!p.ok) return (
    <section className="aef-rise min-w-0">
      <SectionTitle icon={LineChart}>Dove ti portano gli XP</SectionTitle>
      <Panel className="p-6 text-center text-[11px] text-gray-500">
        Servono almeno tre mesi di prove sopra i 3 km per stimare quanto rende il tuo lavoro.
      </Panel>
    </section>
  );

  const next = p.levels[0];
  const headline = p.trend === "down"
    ? <>La forma sta calando: prima di comprare secondi con gli XP serve invertire la rotta.</>
    : !next
      ? <>Sei al livello massimo: ogni XP da qui è mantenimento.</>
      : p.trend === "flat"
        ? <>Ti mancano <b style={{ color: CHART_SERIES.primary }}>{xpFmt(next.xpNeeded)} XP</b> al <b className="text-white">livello {next.level}</b> — circa {next.sessions} sedute. Al ritmo di crescita attuale la forma resta lì: per guadagnare secondi serve più qualità.</>
        : <>Ti mancano <b style={{ color: CHART_SERIES.primary }}>{xpFmt(next.xpNeeded)} XP</b> al <b className="text-white">livello {next.level}</b>: circa <b className="text-white">{next.sessions} sedute</b>, e ci arrivi con i 5 km in <b style={{ color: CHART_SERIES.primary }}>{next.t5k}</b>{next.gain5k > 0 && <> (−{next.gain5k}s)</>}.</>;

  return (
    <section className="aef-rise min-w-0">
      <SectionTitle icon={LineChart} hint={p.xpPerVdot ? `${xpFmt(p.xpPerVdot)} XP per +1 VDOT` : `tendenza su ${p.samples} mesi`}>
        Dove ti portano gli XP
      </SectionTitle>
      <Panel className="p-4 md:p-5">
        <p className="text-[12px] leading-relaxed text-gray-400 mb-4">{headline}</p>

        {p.stale && (
          <div className="mb-3 rounded-xl border px-3 py-2 text-[10px] leading-snug"
            style={{ borderColor: `${CHART_SERIES.load}55`, background: `${CHART_SERIES.load}12`, color: CHART_SERIES.load }}>
            Ultima corsa {p.daysSinceLastRun} giorni fa: il ritmo di XP sta scendendo e con lui questa proiezione.
          </div>
        )}

        <ProjectionChart p={p} />

        <div className="mt-4 grid grid-cols-2 gap-2">
          {p.levels.map((l) => <LevelCost key={l.level} l={l} vdotNow={p.vdotNow} />)}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.milestones.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black border"
              style={{ fontFamily: MONO, borderColor: m.xpNeeded == null ? "rgba(255,255,255,0.08)" : `${CHART_SERIES.primary}44`, color: m.xpNeeded == null ? CHART_TEXT.axis : CHART_SERIES.primary }}>
              {m.label}
              <span className="opacity-70">
                {m.xpNeeded == null ? "oltre questa tendenza" : `+${xpFmt(m.xpNeeded)} XP · Lv ${m.level}`}
              </span>
            </span>
          ))}
        </div>

        <p className="mt-3 text-[9px] leading-relaxed text-gray-600">
          Passa il dito o il mouse sulla curva (frecce da tastiera) per leggere cosa compri a ogni quota di XP.
          Prezzi calcolati sul tuo ritmo attuale: {xpFmt(p.xpPerDay)} XP al giorno, {xpFmt(p.xpPerSession)} XP a seduta.
          Tempi a temperatura ideale (con i 20-30°C di Roma aggiungi ~{p.hotDelta5k}s sui 5 km).
          La curva si appiattisce: più sei allenato, più XP costa lo stesso secondo.
        </p>
      </Panel>
    </section>
  );
}

function LevelCost({ l, vdotNow }: { l: LevelGain; vdotNow: number }) {
  const gain = l.dVdot > 0;
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-2.5">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[9px] font-black tracking-[0.2em] uppercase text-gray-500">Lv {l.level}</span>
        <span className="text-[11px] font-black tabular-nums" style={{ fontFamily: MONO, color: CHART_SERIES.primary }}>+{xpFmt(l.xpNeeded)}</span>
      </div>
      <div className="text-[9px] text-gray-600 mb-1.5" style={{ fontFamily: MONO }}>
        ≈ {l.sessions} sedute{l.days != null && ` · ${l.days} gg`}
      </div>
      <Row k="VDOT" v={gain ? `${l.vdot.toFixed(1)} +${l.dVdot.toFixed(2)}` : vdotNow.toFixed(1)} />
      <Row k="5 km" v={l.t5k} />
      <Row k="10 km" v={l.t10k} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-1">
      <span className="text-[9px] text-gray-500 shrink-0">{k}</span>
      <span className="text-[12px] font-black tabular-nums text-white truncate" style={{ fontFamily: MONO }}>{v}</span>
    </div>
  );
}

/**
 * Asse X = XP, non giorni: a sinistra quelli già spesi, a destra quelli che
 * servono. Le tacche verticali sono i livelli, così si legge subito quanto
 * lavoro separa dal prossimo scatto di forma.
 *
 * Interattivo: puntatore, dito o frecce muovono un cursore lungo la curva e
 * mostrano cosa compri con quegli XP. Il click blocca la lettura.
 */
function ProjectionChart({ p }: { p: Projection }) {
  const W = 360, H = 156, L = 46, R = 14, T = 16, B = 30;
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState<number | null>(null);   // XP sotto al cursore
  const [pinned, setPinned] = useState(false);
  const xMax = p.points[p.points.length - 1].xp || 1;
  const xMin = Math.min(0, ...p.history.map((h) => h.xp), -xMax * 0.6);
  const past = p.history.map((h) => ({ xp: h.xp, sec: h.sec5k }));
  const future = p.points.map((pt) => ({ xp: pt.xp, sec: pt.sec5k }));
  const all = [...past, ...future];
  const lo = Math.min(...all.map((a) => a.sec)), hi = Math.max(...all.map((a) => a.sec));
  const padY = Math.max(8, (hi - lo) * 0.18);
  const y0 = lo - padY, y1 = hi + padY;
  const X = (xp: number) => L + ((xp - xMin) / (xMax - xMin)) * (W - L - R);
  const Y = (s: number) => T + ((s - y0) / Math.max(1, y1 - y0)) * (H - T - B);
  const path = (pts: { xp: number; sec: number }[]) =>
    pts.map((pt, i) => `${i ? "L" : "M"} ${X(pt.xp).toFixed(1)} ${Y(pt.sec).toFixed(1)}`).join(" ");
  const ticks = [y0 + (y1 - y0) * 0.15, (y0 + y1) / 2, y1 - (y1 - y0) * 0.15];
  const kxp = (xp: number) => (Math.abs(xp) >= 1000 ? `${(xp / 1000).toFixed(1).replace(".", ",")}k` : String(Math.round(xp)));

  // ── lettura sotto al cursore: futuro dal modello, passato dalle misure ──
  const read = (xp: number) => {
    if (xp >= 0) {
      const pts = p.points;
      let i = pts.findIndex((q) => q.xp >= xp);
      if (i < 0) i = pts.length - 1;
      const a = pts[Math.max(0, i - 1)], b = pts[i];
      const k = b.xp === a.xp ? 0 : (xp - a.xp) / (b.xp - a.xp);
      const lerp = (u: number, v: number) => u + (v - u) * k;
      return {
        future: true, xp, sec: lerp(a.sec5k, b.sec5k), sec10k: lerp(a.sec10k, b.sec10k),
        vdot: lerp(a.vdot, b.vdot), level: k < 0.5 ? a.level : b.level,
        sessions: Math.round(lerp(a.sessions, b.sessions)), days: Math.round(lerp(a.days, b.days)),
      };
    }
    const h = p.history.reduce((best, q) => (Math.abs(q.xp - xp) < Math.abs(best.xp - xp) ? q : best), p.history[0]);
    return { future: false, xp: h.xp, sec: h.sec5k, sec10k: 0, vdot: h.vdot, level: 0, sessions: 0, days: h.day };
  };
  const info = cursor == null ? null : read(cursor);

  const move = (clientX: number) => {
    const el = svgRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * W;
    const xp = xMin + ((vx - L) / (W - L - R)) * (xMax - xMin);
    setCursor(Math.max(xMin, Math.min(xMax, xp)));
  };
  const step = (dir: number) => {
    const cur = cursor ?? 0;
    setCursor(Math.max(xMin, Math.min(xMax, cur + dir * (xMax - xMin) / 40)));
    setPinned(true);
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto touch-none cursor-crosshair focus-visible:outline-none"
      role="img"
      tabIndex={0}
      aria-label={`Forma prevista in base agli XP guadagnati. ${p.levels[0] ? `Prossimo livello ${p.levels[0].level} a ${p.levels[0].xpNeeded} XP.` : ""} Usa le frecce per esplorare la curva.`}
      onPointerMove={(e) => { if (!pinned) move(e.clientX); }}
      onPointerLeave={() => { if (!pinned) setCursor(null); }}
      onPointerDown={(e) => { move(e.clientX); setPinned(true); }}
      onDoubleClick={() => { setPinned(false); setCursor(null); }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
        else if (e.key === "Escape") { setPinned(false); setCursor(null); }
      }}
      onFocus={() => { if (cursor == null) setCursor(0); }}
    >
      {/* fascia "da guadagnare" */}
      <rect x={X(0)} y={T} width={X(xMax) - X(0)} height={H - T - B} fill={CHART_SERIES.projected} opacity={0.07} />

      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="#1E1E1E" strokeDasharray="3 3" />
          <text x={L - 8} y={Y(t) + 3} textAnchor="end" fill={CHART_TEXT.axis} style={{ fontFamily: MONO, fontSize: 9 }}>{clock(t)}</text>
        </g>
      ))}

      {/* livelli davanti: dove cade ogni scatto */}
      {p.levels.map((l) => (
        <g key={l.level}>
          <line x1={X(l.xpNeeded)} x2={X(l.xpNeeded)} y1={T} y2={H - B} stroke={CHART_SERIES.projected} strokeOpacity={0.35} strokeDasharray="2 3" />
          <text x={X(l.xpNeeded)} y={T - 5} textAnchor="middle" fill={CHART_SERIES.projected} style={{ fontFamily: MONO, fontSize: 8, fontWeight: 800 }}>Lv {l.level}</text>
          {/* il costo sotto l'asse solo se non finisce addosso a "oggi" */}
          {X(l.xpNeeded) - X(0) > 22 && (
            <text x={X(l.xpNeeded)} y={H - B + 12} textAnchor="middle" fill={CHART_TEXT.axis} style={{ fontFamily: MONO, fontSize: 8 }}>+{kxp(l.xpNeeded)}</text>
          )}
        </g>
      ))}

      {/* storico misurato */}
      {past.length > 1 && <path d={path(past)} fill="none" stroke={CHART_SERIES.primary} strokeWidth={2.5} strokeLinecap="round" />}
      {past.map((pt, i) => <circle key={i} cx={X(pt.xp)} cy={Y(pt.sec)} r={2.6} fill={CHART_SERIES.primary} />)}
      {/* proiezione: parte dall'ultima misura, così la linea non si spezza */}
      <path className="aef-curve" d={path(past.length ? [past[past.length - 1], ...future] : future)}
        fill="none" stroke={CHART_SERIES.projected} strokeWidth={2.5} strokeDasharray="5 4" strokeLinecap="round" />

      {/* oggi */}
      <line x1={X(0)} x2={X(0)} y1={T} y2={H - B} stroke="#2A2A2A" />
      <text x={X(0)} y={H - B + 12} textAnchor="middle" fill={CHART_TEXT.axis} style={{ fontFamily: MONO, fontSize: 9 }}>oggi</text>
      <text x={L} y={H - B + 12} textAnchor="start" fill={CHART_TEXT.axis} style={{ fontFamily: MONO, fontSize: 8 }}>{kxp(xMin)} XP</text>
      <text x={W / 2} y={H - 4} textAnchor="middle" fill={CHART_TEXT.faint} style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.2em" }}>XP</text>
      <circle cx={X(0)} cy={Y(future[0].sec)} r={4} fill="#0A0A0A" stroke={CHART_SERIES.primary} strokeWidth={2.5} />

      {/* dove si arriva: il numero in fondo alla curva, altrimenti la proiezione
          sembra piatta e non si legge il guadagno */}
      {!info && <>
        <circle cx={X(xMax)} cy={Y(future[future.length - 1].sec)} r={3} fill={CHART_SERIES.projected} />
        <text x={X(xMax) - 4} y={Y(future[future.length - 1].sec) - 8} textAnchor="end"
          fill={CHART_SERIES.projected} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800 }}>
          {clock(future[future.length - 1].sec)}
        </text>
      </>}

      {/* ── cursore + targhetta ── */}
      {info && <ChartCursor info={info} X={X} Y={Y} W={W} T={T} B={B} H={H} kxp={kxp} pinned={pinned} />}
    </svg>
  );
}

interface CursorInfo {
  future: boolean; xp: number; sec: number; sec10k: number;
  vdot: number; level: number; sessions: number; days: number;
}

/** Targhetta che segue il cursore: si specchia a sinistra quando è a fine corsa. */
function ChartCursor({ info, X, Y, W, T, B, H, kxp, pinned }: {
  info: CursorInfo; X: (n: number) => number; Y: (n: number) => number;
  W: number; T: number; B: number; H: number; kxp: (n: number) => string; pinned: boolean;
}) {
  const col = info.future ? CHART_SERIES.projected : CHART_SERIES.primary;
  const cx = X(info.xp), cy = Y(info.sec);
  const lines: [string, string][] = info.future
    ? [
        ["XP", `+${kxp(info.xp)}`],
        ["Livello", `${info.level}`],
        ["VDOT", info.vdot.toFixed(1)],
        ["5 km", clock(info.sec)],
        ["10 km", clock(info.sec10k)],
      ]
    : [
        ["Quando", `${Math.round(-info.days / 30)} mesi fa`],
        ["XP spesi", kxp(info.xp)],
        ["VDOT", info.vdot.toFixed(1)],
        ["5 km", clock(info.sec)],
      ];
  // lo sforzo sta su una riga sua: con l'etichetta a sinistra finiva sotto al valore
  const footer = info.future ? `${info.sessions} sedute · ${info.days} gg` : null;
  const bw = 96, bh = 12 + lines.length * 11 + (footer ? 12 : 0);
  const flip = cx + bw + 10 > W;
  const bx = flip ? cx - bw - 8 : cx + 8;
  const by = Math.max(T, Math.min(H - B - bh, cy - bh / 2));

  return (
    <g pointerEvents="none">
      <line x1={cx} x2={cx} y1={T} y2={H - B} stroke={col} strokeOpacity={0.55} strokeWidth={1} />
      <circle cx={cx} cy={cy} r={4.5} fill="#0A0A0A" stroke={col} strokeWidth={2.5} />
      <rect x={bx} y={by} width={bw} height={bh} rx={6} fill="#0A0A0Aee" stroke={col} strokeOpacity={0.5} />
      {lines.map(([k, v], i) => (
        <g key={k}>
          <text x={bx + 6} y={by + 14 + i * 11} fill={CHART_TEXT.axis} style={{ fontFamily: MONO, fontSize: 7.5 }}>{k}</text>
          <text x={bx + bw - 6} y={by + 14 + i * 11} textAnchor="end" fill={i === 0 ? col : "#FFFFFF"}
            style={{ fontFamily: MONO, fontSize: 8, fontWeight: 800 }}>{v}</text>
        </g>
      ))}
      {footer && (
        <>
          <line x1={bx + 5} x2={bx + bw - 5} y1={by + bh - 13} y2={by + bh - 13} stroke={col} strokeOpacity={0.25} />
          <text x={bx + bw / 2} y={by + bh - 4} textAnchor="middle" fill={col}
            style={{ fontFamily: MONO, fontSize: 7.5, fontWeight: 800 }}>{footer}</text>
        </>
      )}
      {pinned && (
        <text x={bx + bw / 2} y={by + bh + 8} textAnchor="middle" fill={CHART_TEXT.faint} style={{ fontFamily: MONO, fontSize: 6.5 }}>
          doppio click per sbloccare
        </text>
      )}
    </g>
  );
}
const clock = (sec: number) => {
  const total = Math.round(sec);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

// ── LEGGENDA XP ───────────────────────────────────────────────────────────────
function XpLegendPanel({ sys }: { sys: LevelSystem }) {
  const max = Math.max(...sys.legend.map((l) => l.xp), 1);
  return (
    <section className="aef-rise min-w-0">
      <SectionTitle icon={Zap} hint={`+${sys.weekBonusXp.toLocaleString("it-IT")} XP dai bonus settimana`}>Come guadagni XP</SectionTitle>
      <Panel className="p-4 md:p-5">
        <p className="text-[11px] text-gray-500 mb-3.5">
          Ogni minuto vale in base alla <b className="text-gray-300">zona</b> in cui l'hai corso, più 3 XP al km.
          Le sedute di qualità prendono un bonus fisso: dieci minuti forti pesano quanto mezz'ora di lento.
        </p>
        <div className="space-y-2">
          {sys.legend.map((l) => <LegendRow key={l.zone.id} l={l} max={max} />)}
        </div>

        <div className="mt-4 pt-3.5 border-t border-white/10">
          <div className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-500 mb-2">Bonus</div>
          <div className="grid grid-cols-2 gap-1.5">
            <Bonus label="Record personale" xp={XP_BONUS.pb} col="#FBBF24" />
            <Bonus label="Gara" xp={XP_BONUS.race} col="#E879F9" />
            <Bonus label="Settimana ≥ 35 km" xp={XP_BONUS.week35} col={CHART_SERIES.primary} />
            <Bonus label="Settimana ≥ 50 km" xp={XP_BONUS.week50} col={CHART_SERIES.primary} />
          </div>
        </div>
      </Panel>
    </section>
  );
}

function LegendRow({ l, max }: { l: XpExample; max: number }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/25 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: l.zone.color }} />
        <span className="text-[10px] font-black uppercase tracking-wider shrink-0" style={{ color: l.zone.color }}>{l.zone.name}</span>
        <span className="text-[11px] text-gray-400 truncate">{l.label}</span>
        <span className="ml-auto text-[13px] font-black tabular-nums shrink-0" style={{ fontFamily: MONO, color: CHART_SERIES.primary }}>+{l.xp}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-1 flex-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${(l.xp / max) * 100}%`, background: l.zone.color }} />
        </div>
        <span className="text-[8px] text-gray-600 shrink-0" style={{ fontFamily: MONO }}>{l.detail}</span>
      </div>
    </div>
  );
}

function Bonus({ label, xp, col }: { label: string; xp: number; col: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-black/25 px-2.5 py-1.5">
      <span className="text-[10px] text-gray-400 truncate">{label}</span>
      <span className="text-[11px] font-black tabular-nums shrink-0 ml-1.5" style={{ fontFamily: MONO, color: col }}>+{xp}</span>
    </div>
  );
}

// ── PERCORSO: gradi + 100 livelli in un solo pannello ─────────────────────────
function PathPanel({ sys, trackRef }: { sys: LevelSystem; trackRef: React.RefObject<HTMLDivElement> }) {
  const [hover, setHover] = useState<LevelNode | null>(null);
  const rows = useMemo(() => sys.tiers.map((t) => ({ t, cells: sys.levels.slice(t.levelStart - 1, t.levelEnd) })), [sys]);
  const info = hover ?? sys.levels[sys.level - 1];
  return (
    <section className="aef-rise min-w-0">
      <SectionTitle icon={Trophy} hint={sys.nextReward ? `prossimo grado · ${sys.nextReward.name}` : "tutti i gradi sbloccati"}>Il percorso · 10 gradi</SectionTitle>
      <Panel className="p-4">
        <div ref={trackRef} className="flex items-stretch gap-0 overflow-x-auto scrollbar-hide pb-1 mb-4">
          {sys.tiers.map((t, i) => <TierNode key={t.idx} t={t} last={i === sys.tiers.length - 1} isNext={sys.nextReward?.idx === t.idx} />)}
        </div>

        <div className="space-y-1.5 pt-3.5 border-t border-white/10">
          {rows.map(({ t, cells }) => {
            const TierIcon = ICONS[t.icon] ?? Footprints;
            return (
              <div key={t.idx} className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 w-[104px] shrink-0">
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

function TierNode({ t, last, isNext }: { t: TierState; last: boolean; isNext: boolean }) {
  const Icon = ICONS[t.icon] ?? Footprints;
  const done = t.state === "done", current = t.state === "current";
  const dim = t.state === "locked" && !isNext;
  return (
    <div className={`aef-node ${current ? "aef-node-current" : ""} relative flex flex-col items-center shrink-0 w-[92px]`}>
      {!last && <span className="absolute top-6 left-1/2 w-full h-[3px] rounded-full" style={{ background: done ? t.color : "rgba(255,255,255,0.1)" }} />}
      <div className="relative grid place-items-center w-12 h-12 rounded-full z-10 transition-transform"
        style={{
          background: done || current ? `${t.color}22` : "rgba(255,255,255,0.04)",
          border: `2px solid ${done || current ? t.color : isNext ? t.color + "99" : "rgba(255,255,255,0.12)"}`,
          boxShadow: current ? `0 0 22px ${t.color}77` : "none", opacity: dim ? 0.5 : 1,
        }}>
        {current && <span className="absolute inset-0 rounded-full animate-ping" style={{ background: `${t.color}33` }} />}
        {done ? <Check className="w-5 h-5" style={{ color: t.color }} />
          : t.state === "locked" ? <Lock className="w-4 h-4 text-gray-500" />
          : <Icon className="w-5 h-5" style={{ color: t.color }} />}
      </div>
      <div className="mt-2 text-center px-1">
        <div className="text-[9px] font-black uppercase tracking-wide leading-tight" style={{ color: done || current || isNext ? t.color : "#6b7280" }}>{t.name}</div>
        <div className="text-[8px] text-gray-600" style={{ fontFamily: MONO }}>Lv {t.levelStart}–{t.levelEnd}</div>
        {current && <div className="mt-0.5 text-[8px] font-black text-white/80 tabular-nums" style={{ fontFamily: MONO }}>{t.unlockedLevels}/10 ✓</div>}
      </div>
    </div>
  );
}

// ── ULTIME CORSE → XP GUADAGNATI ──────────────────────────────────────────────
function RecentRuns({ sys }: { sys: LevelSystem }) {
  return (
    <section className="aef-rise min-w-0">
      <SectionTitle icon={Activity} hint="XP guadagnati">Ultime corse</SectionTitle>
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
    <div className="flex items-center justify-between gap-3 mb-3 px-0.5">
      <div className="flex items-center gap-2 min-w-0"><Icon className="w-4 h-4 text-[#C0FF00] shrink-0" /><h2 className="text-[11px] font-black tracking-[0.28em] uppercase text-white/90 truncate">{children}</h2></div>
      {hint && <span className="text-[9px] tracking-widest uppercase text-gray-600 shrink-0 truncate">{hint}</span>}
    </div>
  );
}
