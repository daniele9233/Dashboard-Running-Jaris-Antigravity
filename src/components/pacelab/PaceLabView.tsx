import { useEffect, useMemo, useRef, useState } from "react";
import { Gauge } from "lucide-react";
import { gsap } from "../celebrations/gsapSetup";
import { fmtClock, fmtPace, predictSec } from "../gamification/gamiCore";
import { useAthleteVdot } from "../gamification/useAthleteVdot";
import {
  DISTANCES, distanceById, fmtKm, kmCost, levelFromEven, limitPace, tankPerSecond,
  type DistanceId,
} from "./paceEngine";
import { LIT, MONO, RISK, Label, Segmented, Stat, Stepper } from "./ui";
import { ListinoSection } from "./ListinoSection";
import { FastStartSection } from "./FastStartSection";
import { DistancesSection } from "./DistancesSection";
import { PaceProSection } from "./PaceProSection";

/**
 * PACE LAB — IL PREZZO DEL PASSO
 * ════════════════════════════════════════════════════════════════════════════
 * «Quanto pesa correre 3″ al km più forte?» Sul cronometro è una
 * moltiplicazione. In gara è un'altra cosa: quei secondi costano serbatoio, e il
 * serbatoio si paga in un punto preciso del percorso. Questa pagina mette i
 * due conti uno accanto all'altro — quello della calcolatrice e quello delle
 * gambe — e da lì costruisce il piano di gara km per km.
 *
 * Tutto in pagina viene da un solo motore (`paceEngine`), tarato sulla stessa
 * curva di Daniels del resto dell'app.
 */

export interface PaceCtx {
  distId: DistanceId;
  distKm: number;
  distLabel: string;
  /** "sui 10 km", "sulla mezza". */
  distOn: string;
  /** Il tempo obiettivo esatto, in secondi. */
  targetSec: number;
  /** Il passo obiettivo al secondo intero: la scala delle sezioni in piano. */
  pace0: number;
  /** Il livello in piano: il VDOT del tuo limite. */
  vdot: number;
  levelMode: LevelMode;
  /** Il passo costante che a quel livello svuota il serbatoio sul traguardo. */
  limitPace: number;
}

type LevelMode = "target" | "vdot";

const DEFAULT_TARGETS: Record<DistanceId, number> = {
  "3k": 705, "5k": 1200, "10k": 2500, "15k": 4125, "21k": 6055,
};

interface Saved {
  distId: DistanceId;
  targets: Record<DistanceId, number>;
  levelMode: LevelMode;
  vdot: number | null;
}

const STORE = "metic.pacelab.v1";

function loadSaved(): Saved {
  const base: Saved = { distId: "21k", targets: { ...DEFAULT_TARGETS }, levelMode: "target", vdot: null };
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return base;
    const s = JSON.parse(raw) as Partial<Saved>;
    return {
      distId: DISTANCES.some((d) => d.id === s.distId) ? (s.distId as DistanceId) : base.distId,
      targets: { ...base.targets, ...(s.targets ?? {}) },
      levelMode: s.levelMode === "vdot" ? "vdot" : "target",
      vdot: typeof s.vdot === "number" && s.vdot > 20 && s.vdot < 90 ? s.vdot : null,
    };
  } catch {
    return base;
  }
}

/** "1:40:55", "41:40", "4140" → secondi. */
function parseTime(s: string): number | null {
  const t = s.trim();
  if (/^\d{3,6}$/.test(t)) {
    // cifre di fila: le ultime due sono i secondi, poi i minuti, poi le ore
    const n = t.padStart(6, "0");
    const sec = +n.slice(0, 2) * 3600 + +n.slice(2, 4) * 60 + +n.slice(4, 6);
    return sec > 0 ? sec : null;
  }
  const parts = t.split(/[:.,'′″ ]+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const n = parts.map(Number);
  if (n.slice(1).some((x) => x >= 60)) return null;
  const sec = n.length === 3 ? n[0] * 3600 + n[1] * 60 + n[2] : n[0] * 60 + n[1];
  return sec > 0 ? sec : null;
}

/** Il campo del tempo: si scrive libero, si conferma con Invio o uscendo. */
function TimeField({ sec, onCommit, ariaLabel, width = "w-[6.2rem]" }: {
  sec: number; onCommit: (s: number) => void; ariaLabel: string; width?: string;
}) {
  const [text, setText] = useState(fmtClock(sec));
  const [bad, setBad] = useState(false);
  useEffect(() => { setText(fmtClock(sec)); setBad(false); }, [sec]);
  const commit = () => {
    const v = parseTime(text);
    if (v == null) { setBad(true); return; }
    setBad(false);
    onCommit(v);
  };
  return (
    <input value={text} aria-label={ariaLabel} inputMode="numeric"
      onChange={(e) => setText(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className={`${width} h-[38px] rounded-xl border bg-black/40 px-2.5 text-center text-[15px] font-black text-white tabular-nums outline-none transition-colors focus:border-[#C0FF00]/60`}
      style={{ fontFamily: MONO, borderColor: bad ? RISK : "rgba(255,255,255,0.1)" }} />
  );
}

export function PaceLabView() {
  const saved = useMemo(loadSaved, []);
  const [distId, setDistId] = useState<DistanceId>(saved.distId);
  const [targets, setTargets] = useState<Record<DistanceId, number>>(saved.targets);
  const [levelMode, setLevelMode] = useState<LevelMode>(saved.levelMode);
  const appVdot = useAthleteVdot();
  const [vdotManual, setVdotManual] = useState<number | null>(saved.vdot);
  const [fromDist, setFromDist] = useState<DistanceId>("5k");
  const [fromSec, setFromSec] = useState(1207);
  const root = useRef<HTMLDivElement>(null);

  const dist = distanceById(distId);
  const targetSec = targets[distId];
  const pace0 = Math.round(targetSec / dist.km);
  const vdotChosen = vdotManual ?? (appVdot != null ? Math.round(appVdot * 10) / 10 : 45);
  const vdot = levelMode === "target" ? levelFromEven(dist.km, pace0) : vdotChosen;
  const limit = levelMode === "target" ? pace0 : limitPace(dist.km, vdot);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ distId, targets, levelMode, vdot: vdotManual } satisfies Saved));
    } catch { /* senza memoria la pagina funziona lo stesso */ }
  }, [distId, targets, levelMode, vdotManual]);

  useEffect(() => {
    const c = gsap.context(() => {
      gsap.from(".pl-rise", { opacity: 0, y: 14, duration: 0.45, stagger: 0.06, ease: "power3.out" });
    }, root);
    return () => c.revert();
  }, []);

  // la striscia compatta del telefono compare quando la barra grande esce di vista
  const barRef = useRef<HTMLDivElement>(null);
  const [barHidden, setBarHidden] = useState(false);
  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setBarHidden(!e.isIntersecting), { root: root.current, threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // fuori da 2:30–10:00/km la curva di Daniels non dice più niente di sensato
  const setTarget = (sec: number) =>
    setTargets((t) => ({ ...t, [distId]: Math.round(Math.min(600 * dist.km, Math.max(150 * dist.km, sec))) }));
  const setVdot = (v: number) => setVdotManual(Math.round(Math.min(85, Math.max(25, v)) * 10) / 10);
  const nudgePace = (d: number) => setTarget((pace0 + d) * dist.km);

  const ctx: PaceCtx = {
    distId, distKm: dist.km, distLabel: dist.label, distOn: dist.on, targetSec, pace0, vdot, levelMode, limitPace: limit,
  };

  // ── i numeri della regola, per questa distanza ──
  const perSec = tankPerSecond(dist.km, limit, vdot);
  const kmOfRace = perSec / kmCost(limit, vdot);
  const wall3 = 1 / kmCost(limit - 3, vdot);
  const marginAtTarget = 1 - dist.km * kmCost(pace0, vdot);

  return (
    <main ref={root} className="flex-1 overflow-y-auto bg-black">
      {/* ── sul telefono la barra grande scorre via e resta questa striscia:
           alta zero e sovrapposta, così comparire non sposta la pagina ── */}
      <div className="md:hidden sticky top-0 z-40 h-0">
        <div inert={!barHidden}
          className={`absolute inset-x-0 top-0 border-b border-white/10 bg-black/90 backdrop-blur-md transition-all duration-200 ${barHidden ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full pointer-events-none"}`}>
          <div className="px-4 py-2 flex items-center gap-2 text-white">
            <Segmented size="sm" ariaLabel="Distanza" value={distId} onChange={setDistId}
              options={DISTANCES.map((d) => ({ value: d.id, label: d.short, title: d.label }))} />
            <button type="button" onClick={() => root.current?.scrollTo({ top: 0, behavior: "smooth" })}
              className="ml-auto text-right leading-tight" aria-label="Modifica obiettivo e limite">
              <span className="block text-[13px] font-black tabular-nums" style={{ fontFamily: MONO }}>{fmtClock(targetSec)}</span>
              <span className="block text-[10px] tabular-nums text-gray-500" style={{ fontFamily: MONO }}>{fmtPace(pace0)}/km ✎</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── la barra dei comandi: resta in alto, comanda tutta la pagina ── */}
      <div ref={barRef} className="md:sticky md:top-0 z-30 border-b border-white/10 bg-black/85 backdrop-blur-md">
        <div className="mx-auto max-w-[1500px] px-4 md:px-6 py-3 flex flex-wrap items-end gap-x-5 gap-y-3 text-white">
          <div>
            <Label className="mb-1.5">Distanza</Label>
            <Segmented ariaLabel="Distanza" value={distId} onChange={setDistId}
              options={DISTANCES.map((d) => ({ value: d.id, label: d.short, title: d.label }))} />
          </div>

          <div>
            <Label className="mb-1.5">Obiettivo</Label>
            <div className="flex items-center gap-2">
              <TimeField sec={targetSec} onCommit={setTarget} ariaLabel="Tempo obiettivo" />
              <Stepper label="Passo obiettivo" value={fmtPace(pace0)} sub="/km"
                onDec={() => nudgePace(-1)} onInc={() => nudgePace(1)} />
            </div>
          </div>

          <div>
            <Label className="mb-1.5">Il tuo limite</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented ariaLabel="Da dove viene il tuo limite" value={levelMode} onChange={setLevelMode}
                options={[
                  { value: "target", label: "È l'obiettivo", title: "L'obiettivo è esattamente il massimo che puoi fare" },
                  { value: "vdot", label: "Il mio VDOT", title: "Il tuo livello attuale, dal modello o da un tuo tempo" },
                ]} />
              {levelMode === "vdot" && (
                <Stepper label="VDOT" value={vdotChosen.toFixed(1).replace(".", ",")} sub="VDOT"
                  onDec={() => setVdot(vdotChosen - 0.1)}
                  onInc={() => setVdot(vdotChosen + 0.1)} />
              )}
            </div>
          </div>

          <nav className="hidden 2xl:flex items-center gap-1 ml-auto pb-1" aria-label="Sezioni">
            {[["listino", "01 Listino"], ["partenza", "02 Partenza"], ["distanze", "03 Distanze"], ["pacepro", "04 PacePro"]].map(([id, l]) => (
              <a key={id} href={`#${id}`}
                onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-black tracking-[0.15em] uppercase text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
                {l}
              </a>
            ))}
          </nav>
        </div>

        {levelMode === "vdot" && (
          <div className="mx-auto max-w-[1500px] px-4 md:px-6 pb-3 -mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-gray-400">
            <span>
              VDOT <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{vdotChosen.toFixed(1).replace(".", ",")}</b>
              {" "}= 5K <b className="text-gray-200 tabular-nums" style={{ fontFamily: MONO }}>{fmtClock(predictSec(5000, vdotChosen))}</b>
              {" · "}10K <b className="text-gray-200 tabular-nums" style={{ fontFamily: MONO }}>{fmtClock(predictSec(10000, vdotChosen))}</b>
              {" · "}mezza <b className="text-gray-200 tabular-nums" style={{ fontFamily: MONO }}>{fmtClock(predictSec(21097.5, vdotChosen))}</b>
            </span>
            {appVdot != null && Math.abs(appVdot - vdotChosen) > 0.05 && (
              <button type="button" onClick={() => setVdotManual(null)}
                className="px-2 py-1 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:border-white/25 transition-colors">
                usa quello dell'app ({appVdot.toFixed(1).replace(".", ",")})
              </button>
            )}
            <span className="text-gray-600 cursor-help underline decoration-dotted decoration-gray-700 underline-offset-2"
              title="Il più affidabile è un tempo recente sulla stessa distanza: da un 5K a una mezza il VDOT tende a promettere più tenuta di quella che c'è.">
              oppure da un tuo tempo:
            </span>
            <select value={fromDist} onChange={(e) => setFromDist(e.target.value as DistanceId)} aria-label="Distanza del tempo"
              className="h-7 rounded-lg border border-white/10 bg-black/40 px-1.5 text-[11px] text-white outline-none" style={{ fontFamily: MONO }}>
              {DISTANCES.map((d) => <option key={d.id} value={d.id}>{d.short}</option>)}
            </select>
            <TimeField sec={fromSec} onCommit={setFromSec} ariaLabel="Il tuo tempo" width="w-[5.4rem]" />
            <button type="button"
              onClick={() => { const d = distanceById(fromDist); setVdot(levelFromEven(d.km, fromSec / d.km)); }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-black text-black transition-transform hover:scale-105" style={{ background: LIT }}>
              Usa
            </button>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-[1500px] px-4 md:px-6 py-7 text-white">
        {/* ── il titolo ── */}
        <header className="pl-rise mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Gauge className="w-6 h-6 self-center" style={{ color: LIT }} />
          <h1 className="text-xl md:text-2xl font-black tracking-tight uppercase italic">
            Il prezzo del <span style={{ color: LIT }}>passo</span>
          </h1>
          <p className="text-[12px] text-gray-500 max-w-3xl">
            Ogni secondo al km ha due prezzi: quello del cronometro, e quello delle gambe — il serbatoio che
            consuma e il punto della gara in cui lo paghi. Qui li vedi tutti e due, prima di pagarli.
          </p>
        </header>

        {/* ── la regola della distanza ── */}
        <section className="pl-rise rounded-2xl border border-white/10 bg-gradient-to-br from-[#C0FF00]/[0.07] via-white/[0.02] to-transparent p-5">
          <p className="text-[15px] md:text-[19px] font-black leading-snug text-gray-200 max-w-5xl">
            {dist.on[0].toUpperCase() + dist.on.slice(1)}, ogni secondo al km vale{" "}
            <span style={{ color: LIT }}>{Math.round(dist.km)}″</span> sul cronometro e il{" "}
            <span style={{ color: LIT }}>{(perSec * 100).toFixed(1).replace(".", ",")}%</span> del serbatoio.{" "}
            {levelMode === "target"
              ? <>Corri a {fmtPace(limit - 3)} invece di {fmtPace(limit)} e il serbatoio finisce al{" "}
                  <span style={{ color: RISK }}>km {fmtKm(wall3)}</span>: da lì non tieni più il passo.</>
              : marginAtTarget >= 0
                ? <>L'obiettivo a {fmtPace(pace0)} è {Math.max(1, Math.round(pace0 - limit))}″/km più piano del tuo limite ({fmtPace(limit)}):
                    arrivi con il <span style={{ color: LIT }}>{Math.round(marginAtTarget * 100)}%</span> del serbatoio.</>
                : <>L'obiettivo a {fmtPace(pace0)} è {Math.max(1, Math.round(limit - pace0))}″/km più veloce del tuo limite ({fmtPace(limit)}):
                    a passo costante il serbatoio finisce al{" "}
                    <span style={{ color: RISK }}>km {fmtKm(1 / kmCost(pace0, vdot))}</span>.</>}
          </p>
          <div className="mt-4 grid gap-2.5 grid-cols-2 lg:grid-cols-4">
            <Stat label="1″ al km sul cronometro" value={`${Math.round(dist.km)}″`}
              sub={<>un secondo per ognuno dei {fmtKm(dist.km, Number.isInteger(dist.km) ? 0 : 1)} km</>} />
            <Stat label="1″ al km nel serbatoio" value={`${(perSec * 100).toFixed(1).replace(".", ",")}%`} color={LIT}
              sub={<>quanto consumi in {fmtKm(kmOfRace)} km di gara</>} />
            <Stat label="3″/km oltre il limite" value={`km ${fmtKm(wall3)}`} color={RISK}
              sub={<>a {fmtPace(limit - 3)}/km il serbatoio finisce qui, {fmtKm(dist.km - wall3)} km prima dell'arrivo</>} />
            <Stat label="Il tuo limite" value={`${fmtPace(limit)}`}
              sub={<>{fmtClock(limit * dist.km)} · VDOT {vdot.toFixed(1).replace(".", ",")}
                {levelMode === "target" ? " · l'obiettivo, preso come limite" : " · dal livello che hai scelto"}</>} />
          </div>
          <p className="mt-3 text-[11px] text-gray-500 leading-relaxed max-w-5xl">
            <b className="text-gray-300">Il serbatoio</b> è la fatica che puoi spendere in gara. Ogni ritmo ha una durata
            massima (la curva di Daniels, la stessa di tutta l'app): un minuto a un ritmo che reggeresti 40 minuti ne
            consuma 1/40. Al tuo limite, a passo costante, arriva a zero esattamente sul traguardo. Più veloce si
            svuota prima; più lento avanza — e quello che avanza sono secondi lasciati sul tavolo.
            {" "}Le sezioni 01–03 sono in piano; il PacePro in fondo tiene conto del percorso.
          </p>
        </section>

        <div className="mt-5 grid grid-cols-1 gap-5">
          <ListinoSection ctx={ctx} />
          <FastStartSection ctx={ctx} />
          <DistancesSection ctx={ctx} onPickDistance={setDistId} />
          <PaceProSection ctx={ctx} />
        </div>
      </div>
    </main>
  );
}
