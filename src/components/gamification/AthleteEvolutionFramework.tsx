import { useEffect, useMemo, useState } from "react";
import {
  Zap, Flame, Shield, CalendarCheck, Trophy, Infinity as InfinityIcon, Gauge, Mountain, Wind,
  ShieldCheck, HeartPulse, TrendingUp, Flag, Compass, Crown, Route, Activity, Clock, Sunrise, Moon,
  Dna, Target, Sparkles, Lock, Brain, AlertTriangle, Award, type LucideIcon,
} from "lucide-react";
import { gsap } from "../celebrations/gsapSetup";
import type { Run, Profile } from "../../types/api";
import { computeEvolution, type EvolutionState, type CatState } from "./evolutionEngine";

const MONO = "'JetBrains Mono', monospace";
const PRESTIGE_KEY = "aef-prestige";
const FOCUS_KEY = "aef-focus-goal";

const ICONS: Record<string, LucideIcon> = {
  Zap, Flame, Shield, CalendarCheck, Trophy, Infinity: InfinityIcon, Gauge, Mountain, Wind,
  ShieldCheck, HeartPulse, TrendingUp, Flag, Compass, Crown, Route, Activity, Clock, Sunrise, Moon,
};
const Ic = ({ name, ...p }: { name: string; className?: string; style?: React.CSSProperties }) => {
  const C = ICONS[name] ?? Activity; return <C {...p} />;
};

// ── primitivi UI ──────────────────────────────────────────────────────────────
function Panel({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl ${className}`} style={style}>{children}</div>;
}
function SectionTitle({ icon: Icon, children, hint }: { icon: LucideIcon; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between mb-3 px-0.5">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-[#C0FF00]" />
        <h2 className="text-[11px] font-black tracking-[0.28em] uppercase text-white/90">{children}</h2>
      </div>
      {hint && <span className="text-[9px] tracking-widest uppercase text-gray-600">{hint}</span>}
    </div>
  );
}

export function AthleteEvolutionFramework({ runs, profile }: { runs: Run[]; profile: Profile | null }) {
  const [prestige, setPrestige] = useState(0);
  const [focusGoalId, setFocusGoalId] = useState("5k-20");
  useEffect(() => {
    setPrestige(Number(localStorage.getItem(PRESTIGE_KEY) || 0));
    const f = localStorage.getItem(FOCUS_KEY); if (f) setFocusGoalId(f);
  }, []);
  const setFocus = (id: string) => { setFocusGoalId(id); localStorage.setItem(FOCUS_KEY, id); };

  const ev = useMemo(() => computeEvolution(runs, profile, focusGoalId, prestige), [runs, profile, focusGoalId, prestige]);
  const focusGoal = ev.goals.find((g) => g.id === focusGoalId) ?? ev.goals[0];

  // animazioni d'entrata
  useEffect(() => {
    const c = gsap.context(() => {
      gsap.from(".aef-rise", { opacity: 0, y: 16, duration: 0.5, stagger: 0.04, ease: "power3.out" });
      gsap.from(".aef-bar > i", { scaleX: 0, transformOrigin: "left", duration: 0.9, stagger: 0.02, ease: "power3.out" });
    });
    return () => c.revert();
  }, [ev.ok]);

  const doPrestige = () => { const n = prestige + 1; setPrestige(n); localStorage.setItem(PRESTIGE_KEY, String(n)); };

  if (!ev.ok) return (
    <div className="h-full grid place-items-center text-gray-500"><p className="text-sm font-black uppercase tracking-widest">Sincronizza Strava per costruire la tua evoluzione</p></div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 pt-20 pb-16 text-white">
      {/* ══ HERO ══ */}
      <Hero ev={ev} focusGoal={focusGoal} prestige={prestige} onPrestige={doPrestige} />

      {/* ══ ANALYST ══ */}
      {ev.analyst && (
        <section className="mt-6 aef-rise">
          <SectionTitle icon={Brain} hint={`ultima · ${ev.analyst.date}`}>Evolution Analyst</SectionTitle>
          <Panel className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="relative grid place-items-center w-2 h-2"><span className="absolute inset-0 rounded-full bg-[#C0FF00] animate-ping" /><span className="relative w-2 h-2 rounded-full bg-[#C0FF00]" /></span>
              <span className="text-xs font-black text-white/90 truncate">{ev.analyst.runName}</span>
            </div>
            <ul className="space-y-2">
              {ev.analyst.lines.map((l, i) => (
                <li key={i} className="flex gap-2.5 text-[12px] leading-relaxed text-gray-300">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ANALYST_COLOR[l.kind] }} />
                  <span>{l.text}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      )}

      {/* ══ 15 SISTEMI XP ══ */}
      <section className="mt-7 aef-rise">
        <SectionTitle icon={Dna} hint="adattamenti biologici">Sistemi di Evoluzione</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {ev.cats.map((c) => <CatCard key={c.meta.key} c={c} />)}
        </div>
      </section>

      {/* ══ OBIETTIVI ══ */}
      <section className="mt-7 aef-rise">
        <SectionTitle icon={Target} hint="probabilità dinamica">Obiettivi · Evoluzione Prestazionale</SectionTitle>
        <Panel className="p-4">
          <div className="flex flex-wrap gap-1.5 mb-4">
            {ev.goals.map((g) => (
              <button key={g.id} type="button" onClick={() => setFocus(g.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide uppercase transition-colors ${focusGoalId === g.id ? "bg-[#C0FF00]/15 text-[#C0FF00]" : "text-gray-400 hover:text-white bg-white/[0.03]"}`}>
                {g.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {ev.goals.map((g) => <GoalRow key={g.id} g={g} active={g.id === focusGoalId} />)}
          </div>
        </Panel>
      </section>

      {/* ══ FORMA + DETRAINING ══ */}
      <div className="mt-7 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="aef-rise">
          <SectionTitle icon={Activity} hint="CTL · GAP-adjusted">Confronto Forma Storica</SectionTitle>
          <FormPanel ev={ev} />
        </section>
        <section className="aef-rise">
          <SectionTitle icon={AlertTriangle} hint={ev.detrain.band}>Detraining · Decadimento</SectionTitle>
          <DetrainPanel ev={ev} />
        </section>
      </div>

      {/* ══ PICCHI ══ */}
      <section className="mt-7 aef-rise">
        <SectionTitle icon={Sparkles} hint={`miglior periodo · ${ev.peaks.bestPeriod}`}>Peak Detection</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Panel className="p-4">
            <div className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-500 mb-2">Top corse · GAP VDOT</div>
            {ev.peaks.runs.slice(0, 6).map((r, i) => (
              <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                <span className="flex items-center gap-2 min-w-0"><span className="text-[10px] tabular-nums text-gray-600 w-4">{i + 1}</span><span className="text-[11px] truncate text-gray-300">{r.distanceKm.toFixed(1)}k · {r.date}</span></span>
                <span className="text-[11px] font-black tabular-nums text-[#FBBF24]" style={{ fontFamily: MONO }}>{r.vdot.toFixed(1)}</span>
              </div>
            ))}
          </Panel>
          <Panel className="p-4">
            <div className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-500 mb-2">Top settimane · carico</div>
            {ev.peaks.weeks.slice(0, 6).map((w, i) => (
              <div key={w.label} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                <span className="flex items-center gap-2"><span className="text-[10px] tabular-nums text-gray-600 w-4">{i + 1}</span><span className="text-[11px] text-gray-300">{w.label}</span></span>
                <span className="text-[11px] tabular-nums text-gray-400" style={{ fontFamily: MONO }}>{w.km} km · {w.load}</span>
              </div>
            ))}
          </Panel>
          <Panel className="p-4">
            <div className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-500 mb-2">Top mesi · volume</div>
            {ev.peaks.months.slice(0, 6).map((m, i) => (
              <div key={m.label} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                <span className="flex items-center gap-2"><span className="text-[10px] tabular-nums text-gray-600 w-4">{i + 1}</span><span className="text-[11px] text-gray-300">{m.label}</span></span>
                <span className="text-[11px] tabular-nums text-gray-400" style={{ fontFamily: MONO }}>{m.km} km · {m.runs}×</span>
              </div>
            ))}
          </Panel>
        </div>
      </section>

      {/* ══ ACHIEVEMENTS ══ */}
      <section className="mt-7 aef-rise">
        <SectionTitle icon={Award} hint={`${ev.achievementsUnlocked}/${ev.achievements.length} sbloccati`}>Achievements</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {ev.achievements.map((a) => (
            <Panel key={a.id} className={`p-2.5 transition-opacity ${a.unlocked ? "" : "opacity-45"}`} style={a.unlocked ? { borderColor: a.color + "55" } : undefined}>
              <div className="flex items-center gap-1.5 mb-1">
                {a.unlocked ? <Ic name={a.icon} className="w-3.5 h-3.5" style={{ color: a.color }} /> : <Lock className="w-3 h-3 text-gray-600" />}
                <span className="text-[10px] font-black leading-tight truncate" style={{ color: a.unlocked ? a.color : "#9ca3af" }}>{a.label}</span>
              </div>
              <div className="text-[8.5px] text-gray-500 leading-tight line-clamp-2 h-[22px]">{a.desc}</div>
              {!a.unlocked && a.target > 1 && (
                <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (a.progress / a.target) * 100)}%`, background: a.color }} /></div>
              )}
            </Panel>
          ))}
        </div>
      </section>

      <p className="mt-8 text-center text-[9px] tracking-widest uppercase text-gray-700">
        Modello: TRIMP Banister · VDOT Daniels · Critical Speed · CTL/ATL · Foster monotony · Seiler 80/20 · GAP Minetti
      </p>
    </div>
  );
}

const ANALYST_COLOR: Record<string, string> = { impact: "#F43F5E", xp: "#C0FF00", goal: "#FBBF24", form: "#22D3EE", peak: "#E879F9" };

// ── HERO ──────────────────────────────────────────────────────────────────────
function Hero({ ev, focusGoal, prestige, onPrestige }: { ev: EvolutionState; focusGoal: EvolutionState["goals"][0]; prestige: number; onPrestige: () => void }) {
  const canPrestige = focusGoal?.achieved;
  return (
    <Panel className="p-5 md:p-6 aef-rise relative overflow-hidden" style={{ background: "radial-gradient(120% 140% at 0% 0%, rgba(192,255,0,0.08), transparent 55%), rgba(255,255,255,0.03)" }}>
      <div className="flex items-center gap-2 mb-4">
        <Dna className="w-5 h-5 text-[#C0FF00]" />
        <h1 className="text-lg md:text-xl font-black tracking-tight uppercase italic">Athlete <span className="text-[#C0FF00]">Evolution</span> Framework</h1>
        {prestige > 0 && <span className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E879F9]/15 text-[#E879F9] text-[10px] font-black"><Crown className="w-3 h-3" />Prestige {prestige}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-5 items-center">
        {/* livello */}
        <div className="flex items-end gap-4">
          <div>
            <div className="text-[9px] font-black tracking-[0.3em] uppercase text-gray-500">Livello</div>
            <div className="text-6xl font-black tabular-nums text-[#C0FF00] leading-none" style={{ fontFamily: MONO }}>{ev.level}</div>
            <div className="text-[11px] font-black uppercase tracking-wider text-white/80 mt-1">{ev.rankTitle}</div>
          </div>
        </div>

        {/* xp + archetipo + physiology */}
        <div className="min-w-0">
          <div className="flex justify-between text-[10px] mb-1"><span className="text-gray-500 uppercase tracking-wider">XP livello</span><span style={{ fontFamily: MONO }} className="text-gray-400">{(ev.totalXp - ev.levelFloor).toLocaleString("it-IT")}/{(ev.levelCeil - ev.levelFloor).toLocaleString("it-IT")}</span></div>
          <div className="aef-bar h-2.5 rounded-full bg-white/10 overflow-hidden"><i className="block h-full rounded-full bg-gradient-to-r from-[#C0FF00] to-[#22D3EE]" style={{ width: `${ev.levelPct}%` }} /></div>
          <div className="text-[10px] text-gray-600 mt-1" style={{ fontFamily: MONO }}>{ev.totalXp.toLocaleString("it-IT")} XP totali</div>

          <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <Sparkles className="w-4 h-4 shrink-0" style={{ color: ev.archetype.color }} />
            <div className="min-w-0">
              <div className="text-[11px] font-black truncate" style={{ color: ev.archetype.color }}>{ev.archetype.label}{ev.archetypeAlt ? <span className="text-gray-500 font-bold"> · {ev.archetypeAlt.label}</span> : null}</div>
              <div className="text-[9px] text-gray-500 truncate">{ev.archetype.tagline}</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            <Metric label="VO₂max" value={ev.vo2max.toFixed(1)} unit="ml/kg" />
            <Metric label="VDOT" value={ev.vdot.toFixed(1)} unit="" />
            <Metric label="Crit. Speed" value={ev.csKmh.toFixed(1)} unit="km/h" />
            <Metric label="Soglia" value={paceLabel(ev.thresholdPaceSec)} unit="/km" />
          </div>
        </div>

        {/* fitness gauge */}
        <div className="flex flex-col items-center justify-center">
          <FitnessGauge score={ev.fitnessScore} band={ev.fitnessBand} />
          {canPrestige && (
            <button type="button" onClick={onPrestige} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E879F9]/15 text-[#E879F9] text-[10px] font-black uppercase tracking-wider hover:bg-[#E879F9]/25 transition-colors">
              <Crown className="w-3.5 h-3.5" />Entra in Prestige
            </button>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-center">
      <div className="text-[8px] font-black tracking-widest uppercase text-gray-500">{label}</div>
      <div className="text-sm font-black tabular-nums text-white leading-tight" style={{ fontFamily: MONO }}>{value}</div>
      {unit && <div className="text-[8px] text-gray-600">{unit}</div>}
    </div>
  );
}

function FitnessGauge({ score, band }: { score: number; band: string }) {
  const pct = Math.min(1, score / 1000);
  const r = 46, c = 2 * Math.PI * r, off = c * (1 - pct * 0.75); // arco 270°
  const col = score >= 850 ? "#E879F9" : score >= 680 ? "#C0FF00" : score >= 500 ? "#22D3EE" : score >= 320 ? "#FBBF24" : "#94A3B8";
  return (
    <div className="relative w-[124px] h-[124px]">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-[135deg]">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeDasharray={`${c * 0.75} ${c}`} strokeLinecap="round" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={col} strokeWidth="8" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-[8px] font-black tracking-[0.25em] uppercase text-gray-500">Fitness</div>
          <div className="text-3xl font-black tabular-nums leading-none" style={{ fontFamily: MONO, color: col }}>{score}</div>
          <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: col }}>{band}</div>
        </div>
      </div>
    </div>
  );
}

// ── CATEGORIA ─────────────────────────────────────────────────────────────────
function CatCard({ c }: { c: CatState }) {
  return (
    <Panel className="p-3" style={{ borderColor: c.meta.color + "33" }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide" style={{ color: c.meta.color }}>
          <Ic name={c.meta.icon} className="w-3.5 h-3.5" />{c.meta.short}
        </span>
        <span className="text-[10px] font-black tabular-nums text-white/70" style={{ fontFamily: MONO }}>Lv{c.level}</span>
      </div>
      <div className="aef-bar h-1.5 rounded-full bg-white/10 overflow-hidden mb-1.5"><i className="block h-full rounded-full" style={{ width: `${c.pct}%`, background: c.meta.color }} /></div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] tabular-nums text-gray-500" style={{ fontFamily: MONO }}>{c.xp.toLocaleString("it-IT")} XP</span>
      </div>
      <div className="text-[8.5px] text-gray-600 leading-tight mt-1 line-clamp-2 h-[22px]">{c.meta.what}</div>
    </Panel>
  );
}

// ── GOAL ROW ──────────────────────────────────────────────────────────────────
function GoalRow({ g, active }: { g: EvolutionState["goals"][0]; active: boolean }) {
  const probCol = g.probability >= 70 ? "#C0FF00" : g.probability >= 40 ? "#FBBF24" : "#F43F5E";
  return (
    <div className={`rounded-xl border p-3 transition-colors ${active ? "border-[#C0FF00]/40 bg-[#C0FF00]/[0.06]" : "border-white/10 bg-black/20"}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-black text-white/90">{g.label}{g.achieved && <span className="ml-1.5 text-[#C0FF00]">✓</span>}</span>
        <span className="text-[11px] font-black tabular-nums" style={{ fontFamily: MONO, color: probCol }}>{g.probability}%</span>
      </div>
      <div className="aef-bar h-1.5 rounded-full bg-white/10 overflow-hidden mb-1.5"><i className="block h-full rounded-full" style={{ width: `${g.probability}%`, background: probCol }} /></div>
      <div className="flex items-center justify-between text-[9px] text-gray-500" style={{ fontFamily: MONO }}>
        <span>previsto {g.predictedLabel} <span style={{ color: g.gapSec <= 0 ? "#C0FF00" : "#94A3B8" }}>({g.gapLabel})</span></span>
        <span>VDOT {g.reqVdot} · Lv{g.recLevel}</span>
      </div>
    </div>
  );
}

// ── FORM ──────────────────────────────────────────────────────────────────────
function FormPanel({ ev }: { ev: EvolutionState }) {
  const path = useMemo(() => {
    const s = ev.form.series; if (s.length < 2) return { line: "", area: "", peakX: 0 };
    const step = Math.max(1, Math.floor(s.length / 120));
    const pts = s.filter((_, i) => i % step === 0);
    const max = Math.max(...pts.map((p) => p.ctl), 1);
    const W = 100, H = 40;
    const xy = pts.map((p, i) => [(i / (pts.length - 1)) * W, H - (p.ctl / max) * H] as const);
    const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const area = `${line} L${W},${H} L0,${H} Z`;
    const peakIdx = pts.reduce((mi, p, i, arr) => (p.ctl > arr[mi].ctl ? i : mi), 0);
    return { line, area, peakX: (peakIdx / (pts.length - 1)) * W };
  }, [ev.form.series]);
  return (
    <Panel className="p-5">
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-500">Forma attuale (CTL)</div>
          <div className="text-3xl font-black tabular-nums" style={{ fontFamily: MONO, color: ev.form.surpassed ? "#C0FF00" : "#22D3EE" }}>{ev.form.currentCtl}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-500">Picco · {ev.form.peakLabel}</div>
          <div className="text-xl font-black tabular-nums text-white/70" style={{ fontFamily: MONO }}>{ev.form.peakCtl}</div>
        </div>
      </div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-20">
        <defs><linearGradient id="aef-form" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22D3EE" stopOpacity="0.4" /><stop offset="100%" stopColor="#22D3EE" stopOpacity="0" /></linearGradient></defs>
        <path d={path.area} fill="url(#aef-form)" />
        <path d={path.line} fill="none" stroke="#22D3EE" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
        <line x1={path.peakX} y1="0" x2={path.peakX} y2="40" stroke="#FBBF24" strokeWidth="0.5" strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
        <span className="text-[11px] font-bold" style={{ color: ev.form.surpassed ? "#C0FF00" : "#22D3EE" }}>{ev.form.message}</span>
        <span className="text-2xl font-black tabular-nums" style={{ fontFamily: MONO, color: ev.form.surpassed ? "#C0FF00" : "#22D3EE" }}>{ev.form.equivalencePct}%</span>
      </div>
    </Panel>
  );
}

// ── DETRAINING ────────────────────────────────────────────────────────────────
function DetrainPanel({ ev }: { ev: EvolutionState }) {
  const safe = ev.detrain.daysInactive <= 2;
  return (
    <Panel className="p-5">
      <div className="flex items-center gap-2 mb-3">
        {safe ? <ShieldCheck className="w-5 h-5 text-[#10B981]" /> : <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />}
        <div>
          <div className="text-sm font-black" style={{ color: safe ? "#10B981" : "#F59E0B" }}>{ev.detrain.band}</div>
          <div className="text-[10px] text-gray-500">{safe ? `forma protetta · ${2 - ev.detrain.daysInactive} gg di tolleranza` : `fermo da ${ev.detrain.daysInactive} giorni`}</div>
        </div>
      </div>
      <div className="space-y-2.5">
        {ev.detrain.axes.map((a) => (
          <div key={a.key}>
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="font-black uppercase tracking-wide text-gray-300">{a.label}</span>
              <span className="tabular-nums" style={{ fontFamily: MONO, color: a.lostPct > 0 ? "#F43F5E" : "#10B981" }}>{a.lostPct > 0 ? `−${a.lostPct}%` : "intatto"}</span>
            </div>
            <div className="relative h-2 rounded-full bg-[#F43F5E]/20 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.round(a.retention * 100)}%`, background: a.retention > 0.85 ? "#10B981" : a.retention > 0.6 ? "#FBBF24" : "#F43F5E" }} />
            </div>
            <div className="text-[8.5px] text-gray-600 mt-0.5">emivita {a.halfLife} gg · ritenzione {Math.round(a.retention * 100)}%</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

const paceLabel = (sec: number) => { const m = Math.floor(sec / 60), s = Math.round(sec % 60); return `${m}:${String(s).padStart(2, "0")}`; };
