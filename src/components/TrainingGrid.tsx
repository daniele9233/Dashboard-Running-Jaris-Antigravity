import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, CalendarDays, Target, BookOpen, ChevronDown, TrendingUp } from "lucide-react";
import { useApi, invalidateCache } from "../hooks/useApi";
import { API_CACHE } from "../hooks/apiCacheKeys";
import { getRuns } from "../api";
import type { RunsResponse } from "../types/api";
import { evaluatePlan } from "../utils/trainingAdherence";
import { SessionVerdict, AdherenceStrip } from "./TrainingAdherence";
import {
  getSub20Status, putSub20Status, putSub20Window, putSub20Goal,
  type Sub20StatusResponse, type Sub20SessionStatus,
} from "../api";
import type { Session } from "../types/api";
import { EVIDENCE, type EvidenceKey } from "../data/kikkoEvidence";
import {
  KIKKO_SUB20_LEGEND, KIKKO_SUB20_DEFAULT_START,
  buildKikkoSub20Sessions, kikkoSub20RaceDate, kikkoSub20NormalizeStart,
  kikkoSub20HeatInfo, heatTable, heatReferenceLabel,
  kikkoGoalOdds, KIKKO_SUB20_TARGETS, KIKKO_SUB20_PLAN, kikkoWindow, addDays,
  kikkoVdotGainTable, kikkoVdotForFiveK, kikkoPlausibleGain, secToPace,
} from "../data/kikkoSub20Plan";

/** Il piano e' uno solo, e la sua distanza non si sceglie: 5 km. */
const PLAN_ID = "sub20";
const GOAL_DISTANCE_KM = 5;

/**
 * La finestra del piano: quando comincio e quando corro.
 *
 * Le due date NON si legano fra loro. Se la gara è fra sei settimane il piano
 * ne corre sei — le ultime sei, quelle col picco e il taper — invece di
 * spostarti la gara a dodici settimane da oggi. La durata la decide l'atleta,
 * non il software.
 */
interface Window { start: string; race: string }

/** Verde finché l'aria non conta, ambra quando inizia a costare, rosso oltre. */
const HEAT_COLOR: Record<string, string> = {
  b0: "#22D3EE", b1: "#A3E635", b2: "#C0FF00",
  b3: "#F59E0B", b4: "#F97316", b5: "#EF4444", b6: "#EF4444",
};

/**
 * Perché il target di oggi non è quello di riferimento.
 *
 * Non è la temperatura da sola: è l'indice T + DP (temperatura + punto di
 * rugiada, entrambi in °C — il Garmin dà il DP nei dati meteo della sessione).
 * A parità di gradi l'aria umida non lascia evaporare il sudore, e il ritmo
 * paga. La tabella sta accanto alla seduta, non sepolta nella descrizione.
 */
function HeatPanel({
  date, startDate, raceDate,
}: {
  date: string; startDate: string; raceDate: string;
}) {
  const info = kikkoSub20HeatInfo(date, startDate, raceDate);
  const { kind, baseSec } = info;
  const col = HEAT_COLOR[info.band.id] ?? "#A3E635";
  // La tabella usa la base di QUELLA settimana: il VDOT sale lungo il piano,
  // quindi le stesse fasce danno ritmi diversi a luglio e a settembre.
  const rows = kind && baseSec != null ? heatTable(kind, baseSec) : [];
  const mono = { fontFamily: "'JetBrains Mono', monospace" };

  return (
    <div className="mb-6 rounded-xl border overflow-hidden" style={{ borderColor: `${col}44`, background: `${col}0d` }}>
      <div className="px-3.5 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: col }}>
          Indice T + DP {info.index}
        </span>
        <span className="text-[11px] text-gray-400" style={mono}>
          ~{info.tempC}°C + DP {info.dpC}° · fascia {info.band.label}
          {info.pace && ` · penalità ${info.pace.penLabel}`}
        </span>
        {info.pace && info.base && (
          <span className="text-[11px] text-gray-400" style={mono}>
            base {info.base} → <span className="font-bold" style={{ color: col }}>{info.pace.range}</span>
          </span>
        )}
        {info.vdot != null && (
          <span className="text-[11px] text-gray-500" style={mono}>VDOT {info.vdot.toFixed(1)}</span>
        )}
        {info.band.skip && (
          <span className="text-[11px] font-bold text-[#EF4444] basis-full">
            Oltre 59: seduta da spostare all'alba o da rimandare.
          </span>
        )}
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto border-t" style={{ borderColor: `${col}22` }}>
          <table className="w-full text-[11px]" style={mono}>
            <thead>
              <tr className="text-gray-500">
                <th className="text-left font-bold px-3.5 py-1.5">Esempio</th>
                <th className="text-left font-bold px-2 py-1.5">Penalità</th>
                <th className="text-left font-bold px-2 py-1.5">Passo/km</th>
                <th className="text-left font-bold px-3.5 py-1.5">{heatReferenceLabel(kind!)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const here = r.band.id === info.band.id;
                return (
                  <tr
                    key={r.band.id}
                    className={here ? "text-white font-bold" : "text-gray-500"}
                    style={here ? { background: `${col}1a` } : undefined}
                  >
                    <td className="px-3.5 py-1.5 whitespace-nowrap" style={here ? { color: col } : undefined}>{r.band.example}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{r.penLabel}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{r.pace}</td>
                    <td className="px-3.5 py-1.5 whitespace-nowrap">{r.reference}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * SE LA CHIUDI A TARGET, A CHE PUNTO SEI.
 *
 * La domanda dopo una seduta dura non è quanti chilometri hai fatto: è se
 * quella fatica sta portando dove volevi. La percentuale è condizionata —
 * "chiusa al passo prescritto" — e non è una promessa: è la parte della
 * distribuzione che cade sotto il tempo obiettivo, con dentro la variabilità
 * misurata fra gare simili e le settimane che ancora mancano.
 *
 * Sale lungo il piano anche chiudendo sempre al target, e non perché il motore
 * cresca soltanto: perché resta meno ignoto davanti.
 */
function OddsPanel({
  date, vdot, raceIso, targets, distanceKm,
}: {
  date: string;
  vdot: number;
  raceIso: string;
  targets: { label: string; sec: number }[];
  distanceKm: number;
}) {
  const mono = { fontFamily: "'JetBrains Mono', monospace" };
  const odds = targets.map((t) => ({
    ...t,
    o: kikkoGoalOdds({ vdot, distanceKm, targetSec: t.sec, raceIso, sessionIso: date }),
  }));
  if (!odds.length) return null;

  const colorOf = (p: number) =>
    p >= 0.7 ? "#22C55E" : p >= 0.45 ? "#C0FF00" : p >= 0.25 ? "#F59E0B" : "#F43F5E";

  return (
    <div className="mb-6 rounded-xl border border-[#2A2A2A] bg-[#0F0F0F] overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-[#2A2A2A]">
        <span className="text-[10px] font-black tracking-[0.2em] uppercase text-gray-400">
          Se la chiudi a target
        </span>
        <span className="ml-2 text-[11px] text-gray-600" style={mono}>
          VDOT {vdot.toFixed(1)} · gara fra {Math.round(odds[0].o.weeksLeft)} settimane
        </span>
      </div>

      <div className="divide-y divide-[#1E1E1E]">
        {odds.map(({ label, o }) => {
          const col = colorOf(o.p);
          return (
            <div key={label} className="px-3.5 py-2.5 flex items-center gap-3">
              <span className="text-[11px] font-bold text-gray-300 w-16 shrink-0">{label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-[#1E1E1E] overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${Math.round(o.p * 100)}%`, background: col }} />
              </div>
              <span className="text-[15px] font-black tabular-nums w-12 text-right"
                style={{ ...mono, color: col }}>
                {Math.round(o.p * 100)}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="px-3.5 py-2 border-t border-[#2A2A2A] text-[10px] text-gray-600 leading-snug">
        Previsione con l'aria attesa il giorno di gara:{" "}
        <span className="text-gray-400" style={mono}>
          {odds.map((x) => fmtRaceTime(x.o.predictedSec)).filter((v, i, a) => a.indexOf(v) === i).join(" · ")}
        </span>
        . La banda tiene conto dell'1,4% di variabilità fra gare simili dello stesso atleta e di
        quanto manca alla gara.
      </div>
    </div>
  );
}

/**
 * Un campo data che si comporta come un calendario.
 *
 * Due correzioni a quello nativo. La prima è l'icona: senza `color-scheme:
 * dark` il browser la disegna quasi nera su fondo nero, e il campo sembra
 * testo morto — la riga sta in index.css e vale per tutta l'app. La seconda è
 * il bersaglio: l'icona nativa è larga sedici pixel, qui il clic apre il
 * calendario da qualunque punto del campo.
 */
function DateField({
  label, value, onChange, title, accent,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  title: string;
  accent?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const open = () => {
    const el = ref.current;
    if (!el) return;
    // showPicker non c'è su tutti i browser: dove manca resta il clic nativo
    try { (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); }
    catch { /* il campo resta comunque digitabile */ }
  };

  return (
    <div
      onClick={open}
      role="presentation"
      title={title}
      className="flex items-center gap-1.5 rounded-md border border-[#2A2A2A] bg-[#0A0A0A] px-2 py-1 cursor-pointer hover:border-white/25 transition-colors"
    >
      <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: accent ?? "#6B7280" }} />
      <span className="text-[9px] font-black tracking-[0.18em] uppercase text-gray-600">{label}</span>
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent border-0 p-0 text-xs font-bold outline-none cursor-pointer"
        style={{ color: accent ?? "#FFFFFF" }}
      />
    </div>
  );
}

/**
 * PERCHÉ QUESTA SEDUTA HA QUESTA FORMA.
 *
 * Non la bibliografia della corsa: proprio i lavori che giustificano la durata
 * della ripetuta, la lunghezza del recupero e il ritmo scritto su quella riga.
 * Sta chiuso di default — chi vuole solo correre non deve leggerlo — ma esiste,
 * perché un piano da cui non puoi discostarti con cognizione è un piano che o
 * segui alla lettera o butti.
 */
function EvidencePanel({ evidence }: { evidence: EvidenceKey }) {
  const [open, setOpen] = useState(false);
  const e = EVIDENCE[evidence];
  if (!e) return null;

  return (
    <div className="mb-6 rounded-xl border border-[#2A2A2A] bg-[#0F0F0F] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <BookOpen className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-500" />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-black tracking-[0.2em] uppercase text-gray-400">
            Cosa allena
          </span>
          <span className="block text-[12px] text-gray-300 leading-snug mt-0.5">{e.what}</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-gray-600 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-3">
          <p className="text-[11.5px] text-gray-400 leading-relaxed">{e.why}</p>
          <div className="space-y-2.5">
            {e.studies.map((st) => (
              <div key={st.ref} className="border-l-2 border-[#2A2A2A] pl-3">
                <div className="text-[11px] font-bold text-gray-300 leading-snug">{st.ref}</div>
                <div className="text-[11px] text-gray-500 leading-snug mt-0.5">{st.says}</div>
                {st.caveat && (
                  <div className="text-[10.5px] text-amber-300/70 leading-snug mt-1">⚠ {st.caveat}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** "19:59" o "1:34:35" → secondi. Null se non è un tempo. */
function parseGoal(text: string): number | null {
  const parts = text.trim().split(":").map((x) => Number(x));
  if (!parts.length || parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const sec = parts.length === 2 ? parts[0] * 60 + parts[1]
    : parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : null;
  return sec != null && sec >= 300 && sec <= 6 * 3600 ? sec : null;
}

/** "19:47" o "1:34:12". */
function fmtRaceTime(sec: number): string {
  const t = Math.round(sec);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

const SESSION_COLORS: Record<string, string> = {
  easy:      "#8B5CF6",
  recovery:  "#6B7280",
  intervals: "#EF4444",
  tempo:     "#F97316",
  long:      "#10B981",
  rest:      "transparent",
  strength:  "#0EA5E9",   // sky-blue — riposo attivo con forza
};

interface SessionDisplay {
  color: string;
  title: string;
  details: string[];
  completed: boolean;
  description: string;
}

function toDisplay(session: Session | undefined): SessionDisplay | null {
  if (!session) return null;
  // Rest day with strength exercises → show as "strength" day
  if (session.type === "rest") {
    const hasStrength = (session.strength_exercises?.length ?? 0) > 0;
    if (!hasStrength) return null;
    return {
      color: SESSION_COLORS.strength,
      title: "Riposo + Forza",
      details: [`${session.strength_exercises!.length} esercizi`],
      completed: session.completed,
      description: "Recupero attivo con sessione di forza e prevenzione.",
    };
  }
  const color = SESSION_COLORS[session.type] ?? "#6B7280";
  const details: string[] = [];
  if (session.target_distance_km) details.push(`${session.target_distance_km} km`);
  if (session.target_pace) details.push(`${session.target_pace}/km`);
  return { color, title: session.title, details, completed: session.completed, description: session.description };
}

/**
 * ALLA FINE DEL PIANO: QUANTI PUNTI CI PUOI METTERE, E QUANTO VALGONO.
 *
 * "VDOT" da solo non dice niente a nessuno. Un punto è un numero astratto
 * finché non lo si traduce in secondi al chilometro — e quanti secondi sia un
 * punto DIPENDE DA DOVE PARTI: intorno a 49 vale circa cinque secondi al km,
 * a 60 meno di quattro. Non è la regola del pollice da sei secondi che gira
 * nei forum: qui il conto esce dalla tabella dei ritmi, la stessa che scrive
 * i target di ogni seduta.
 *
 * La colonna che conta è l'ultima: quanto scende il tempo sui 5 km. E la
 * riga in fondo dice quanto di quella scala la finestra scelta può davvero
 * produrre — circa un punto ogni otto settimane a questo livello (Milanović
 * 2015, Bacon 2013). Chiedere di più non è ambizione, è scrivere ritmi che
 * non arrivano.
 */
function VdotGainPanel({
  startVdot, weeks, goalSec,
}: {
  startVdot: number;
  weeks: number;
  goalSec: number;
}) {
  const mono = { fontFamily: "'JetBrains Mono', monospace" };
  const rows = kikkoVdotGainTable(startVdot, weeks);
  const cap = kikkoPlausibleGain(weeks, startVdot);
  const needVdot = kikkoVdotForFiveK(goalSec);
  const needGain = Math.round((needVdot - startVdot) * 10) / 10;
  const dec = (n: number) => n.toFixed(1).replace(".", ",");

  return (
    <div className="mt-8 rounded-xl border border-[#2A2A2A] bg-[#0F0F0F] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2A2A2A] flex flex-wrap items-center gap-x-3 gap-y-1">
        <TrendingUp className="w-4 h-4 shrink-0" style={{ color: "var(--app-accent)" }} />
        <span className="text-[10px] font-black tracking-[0.2em] uppercase text-gray-300">
          Quanto VDOT puoi guadagnare
        </span>
        <span className="text-[11px] text-gray-500" style={mono}>
          parti da {dec(startVdot)} · {weeks} settimane
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px]" style={mono}>
          <thead>
            <tr className="text-gray-500 border-b border-[#1E1E1E]">
              <th className="text-left font-bold px-4 py-2">Guadagno</th>
              <th className="text-left font-bold px-2 py-2">VDOT</th>
              <th className="text-left font-bold px-2 py-2">Ritmo gara</th>
              <th className="text-left font-bold px-2 py-2">al km</th>
              <th className="text-left font-bold px-2 py-2">Soglia</th>
              <th className="text-left font-bold px-2 py-2">5 km</th>
              <th className="text-left font-bold px-4 py-2">Sui 5 km</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const col = r.plausible ? "var(--app-accent)" : "#F59E0B";
              return (
                <tr
                  key={r.gain}
                  className="border-b border-[#141414] last:border-0"
                  style={r.plausible ? undefined : { opacity: 0.55 }}
                >
                  <td className="px-4 py-2 font-bold whitespace-nowrap" style={{ color: col }}>
                    +{dec(r.gain)}
                  </td>
                  <td className="px-2 py-2 text-gray-400 whitespace-nowrap">{dec(r.vdot)}</td>
                  <td className="px-2 py-2 text-gray-300 whitespace-nowrap">{secToPace(r.raceSec / GOAL_DISTANCE_KM)}</td>
                  <td className="px-2 py-2 font-bold whitespace-nowrap" style={{ color: col }}>
                    −{dec(r.racePerKm)}″
                  </td>
                  <td className="px-2 py-2 text-gray-500 whitespace-nowrap">{secToPace(r.thrSec)}</td>
                  <td className="px-2 py-2 text-gray-300 whitespace-nowrap">{fmtRaceTime(r.raceSec)}</td>
                  <td className="px-4 py-2 font-bold whitespace-nowrap" style={{ color: col }}>
                    −{Math.round(r.raceGainSec)}″
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-[#2A2A2A] space-y-1.5 text-[11px] leading-snug">
        <p className="text-gray-400">
          In <span className="text-gray-200 font-bold">{weeks} settimane</span> fatte per intero la
          letteratura misura circa{" "}
          <span className="font-bold" style={{ color: "var(--app-accent)" }}>+{dec(cap)} punti</span>{" "}
          per un atleta a questo livello: le righe sotto quella soglia sono realistiche, quelle
          sopra sono ambizione. Circa un punto ogni otto settimane (Milanović 2015, Bacon 2013).
        </p>
        <p className="text-gray-400">
          Per <span className="text-gray-200 font-bold">{fmtRaceTime(goalSec)}</span> sui{" "}
          {GOAL_DISTANCE_KM} km serve VDOT{" "}
          <span className="text-gray-200 font-bold">{dec(needVdot)}</span>
          {needGain > 0.05 ? (
            <>
              , cioè{" "}
              <span className="font-bold" style={{ color: needGain <= cap + 0.05 ? "var(--app-accent)" : "#F59E0B" }}>
                +{dec(needGain)}
              </span>{" "}
              da qui{needGain <= cap + 0.05 ? " — dentro quello che la finestra può dare." : " — più di quanto la finestra può dare: o si allunga, o si sposta l'obiettivo."}
            </>
          ) : (
            <> — il motore per farlo c'è già: quello che manca è portarlo alla gara.</>
          )}
        </p>
        <p className="text-gray-600">
          Un punto non vale sempre uguale: più il motore è grande, meno secondi compra. A{" "}
          {dec(startVdot)} un punto pieno sono {dec(rows.find((r) => r.gain === 1)?.racePerKm ?? 0)}″
          al km, non i sei che si sentono ripetere.
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TrainingGrid() {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'Day' | 'Week' | 'Month' | 'Year'>('Year');
  /**
   * Giorno aperto a schermo intero. Prima cliccare una seduta portava alla
   * vista "Day", che restava dentro la pagina: header, legenda e diagnosi
   * continuavano a leggersi dietro il pannello semitrasparente. La seduta si
   * apre invece sopra tutto, su fondo pieno, senza niente che filtri.
   */
  const [detailDate, setDetailDate] = useState<Date | null>(null);
  /**
   * La finestra: il lunedì da cui si parte e la settimana della gara.
   * Vive sul server, così vale da qualunque browser si apra la pagina.
   */
  const [sub20Win, setSub20Win] = useState<Window>({
    start: KIKKO_SUB20_DEFAULT_START,
    race: kikkoSub20RaceDate(KIKKO_SUB20_DEFAULT_START),
  });
  const [draft, setDraft] = useState<Window | null>(null);

  const openDay = (date: Date) => setDetailDate(date);
  const closeDay = useCallback(() => setDetailDate(null), []);

  // Esc chiude, e finché il dettaglio è aperto la pagina sotto non scrolla:
  // altrimenti la rotellina muove il calendario dietro invece della seduta.
  useEffect(() => {
    if (!detailDate) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDay(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [detailDate, closeDay]);

  /**
   * Il tempo obiettivo, in secondi, per piano.
   *
   * Vive sul server accanto alla data di partenza — è configurazione del
   * piano, non una preferenza di questo browser — e finché non arriva valgono
   * quelli scritti dentro i piani.
   */
  const [goals, setGoals] = useState<Record<string, number>>({});
  const [goalDraft, setGoalDraft] = useState<string | null>(null);

  const activeStart = sub20Win.start;
  const activeRaceIso = sub20Win.race;
  const activeAccent = "var(--app-accent)";

  /**
   * L'obiettivo: il tempo, e il passo che ne discende.
   *
   * La distanza non è una scelta — il piano è sui 5 km — quindi il passo è
   * solo il tempo diviso cinque. Scriverlo accanto evita di rifare il conto a
   * mente ogni volta che l'obiettivo si sposta di dieci secondi.
   */
  const goalSec = goals[PLAN_ID] ?? KIKKO_SUB20_TARGETS[0].sec;
  const goalPace = secToPace(goalSec / GOAL_DISTANCE_KM);

  /**
   * Cosa misura la percentuale: l'obiettivo scelto, più l'altro obiettivo di
   * targa del piano — che sia più ambizioso o più prudente.
   *
   * Prima si mostrava solo quello PIÙ veloce, e aveva senso finché il piano
   * puntava oltre la sub-20. Ora che il bersaglio è il 19:40 la riga che serve
   * è quella sotto: la probabilità sulla sub-20 è il pavimento, ed è il numero
   * che decide come partire il giorno della gara.
   */
  const activeTargets = useMemo(() => {
    const chosen = { label: fmtRaceTime(goalSec), sec: goalSec };
    const other = KIKKO_SUB20_TARGETS
      .filter((t) => Math.abs(t.sec - goalSec) > 1)
      .sort((a, b) => Math.abs(a.sec - goalSec) - Math.abs(b.sec - goalSec))[0];
    return other ? [chosen, other].sort((a, b) => a.sec - b.sec) : [chosen];
  }, [goalSec]);

  /**
   * La probabilità del giorno, se quel giorno ha una qualità.
   *
   * Sulle lente non compare: un fondo chiuso al passo giusto non dimostra
   * niente sull'obiettivo, e un numero che non si muove mai smette di essere
   * letto.
   */
  const activeOdds = (dayKey: string) => {
    const info = kikkoSub20HeatInfo(dayKey, activeStart, activeRaceIso);
    const session = sub20Map[dayKey];
    const isQuality = session?.type === "intervals" || session?.type === "tempo";
    if (!isQuality || info.vdot == null) return null;
    return (
      <OddsPanel
        date={dayKey}
        vdot={info.vdot}
        raceIso={activeRaceIso}
        distanceKm={GOAL_DISTANCE_KM}
        targets={activeTargets}
      />
    );
  };

  /** Le prove dietro la seduta del giorno, se quel giorno c'è una seduta. */
  const activeEvidence = (dayKey: string) => {
    const info = kikkoSub20HeatInfo(dayKey, activeStart, activeRaceIso);
    return info.evidence ? <EvidencePanel evidence={info.evidence} /> : null;
  };

  /** La bozza dei due calendari: quella applicata quando non si sta modificando. */
  const shownWin = draft ?? sub20Win;
  /**
   * Quanto del piano entra nella finestra scelta.
   *
   * Se le settimane bastano il piano ci sta intero; se sono meno si corrono le
   * ULTIME — quelle col picco e il taper — e la pagina lo dice, invece di far
   * finta che il programma sia lo stesso.
   */
  const draftWindow = useMemo(
    () => kikkoWindow(KIKKO_SUB20_PLAN, shownWin.start, shownWin.race),
    [shownWin],
  );
  const dirty = shownWin.start !== sub20Win.start || shownWin.race !== sub20Win.race;

  // Il piano acceso, dentro la sua finestra.
  const sub20Sessions = useMemo(
    () => buildKikkoSub20Sessions(sub20Win.start, sub20Win.race),
    [sub20Win],
  );
  const sub20Map = useMemo(() => {
    const map: Record<string, Session> = {};
    for (const s of sub20Sessions) map[s.date] = s;
    return map;
  }, [sub20Sessions]);

  const getSession = (year: number, month: number, day: number): Session | undefined => {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return sub20Map[key];
  };

  // ── Aderenza: confronto automatico fra prescrizione e giri realmente corsi.
  // Il verdetto lo dà il sistema; la diagnosi guarda il pattern, non il giorno.
  const { data: runsData } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const adherence = useMemo(
    () => evaluatePlan(sub20Sessions, runsData?.runs ?? []),
    [sub20Sessions, runsData],
  );
  const adherenceByDate = useMemo(
    () => Object.fromEntries(adherence.map((e) => [e.date.slice(0, 10), e])),
    [adherence],
  );

  // ── Esiti sedute Sub-20 (persistenti su DB) ──
  const { data: sub20StatusData } = useApi<Sub20StatusResponse>(getSub20Status, { cacheKey: "sub20-status" });
  const [sub20Status, setSub20StatusLocal] = useState<Record<string, Sub20SessionStatus>>({});
  useEffect(() => {
    if (sub20StatusData?.statuses) setSub20StatusLocal(sub20StatusData.statuses);
    if (sub20StatusData?.goals) setGoals(sub20StatusData.goals);
    // Sul DB può esserci la partenza del vecchio piano Sub-20, che era ancorata
    // a un martedì: senza normalizzare, kikkoSub20 slitta di un giorno e le
    // qualità cadono di mercoledì e venerdì.
    if (sub20StatusData?.start_date || sub20StatusData?.race_date) {
      setSub20Win((prev) => ({
        start: sub20StatusData.start_date
          ? kikkoSub20NormalizeStart(sub20StatusData.start_date)
          : prev.start,
        race: sub20StatusData.race_date
          ? kikkoSub20NormalizeStart(sub20StatusData.race_date)
          : prev.race,
      }));
      setDraft(null);
    }
  }, [sub20StatusData]);

  const keyOf = (year: number, month: number, day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const sub20StatusOf = (year: number, month: number, day: number): Sub20SessionStatus | undefined =>
    sub20Status[keyOf(year, month, day)];

  const markSub20 = useCallback(async (date: string, status: Sub20SessionStatus | null) => {
    setSub20StatusLocal((prev) => {
      const next = { ...prev };
      if (status) next[date] = status; else delete next[date];
      return next;
    });
    try {
      const res = await putSub20Status(date, status);
      if (res?.statuses) setSub20StatusLocal(res.statuses);
      invalidateCache("sub20-status");
    } catch {
      /* l'ottimistico resta; ritenta al prossimo click */
    }
  }, []);


  /**
   * "Applica": la finestra in bozza diventa quella del piano.
   *
   * Entrambe le date vengono riportate al lunedì della loro settimana — il
   * piano è ancorato al lunedì, e una partenza di mercoledì farebbe cadere le
   * qualità di giovedì e sabato. Il calendario salta sulla prima settimana
   * davvero corsa, che con una finestra stretta non è quella scelta ma la
   * prima che il piano riesce a farci stare.
   */
  const applyWindow = useCallback(async () => {
    if (!draft) return;
    const win: Window = {
      start: kikkoSub20NormalizeStart(draft.start),
      race: kikkoSub20NormalizeStart(draft.race),
    };
    setDraft(null);

    const w = kikkoWindow(KIKKO_SUB20_PLAN, win.start, win.race);
    const [y, m, d] = w.firstMonday.split("-").map(Number);
    setCurrentDate(new Date(y, m - 1, d));
    setView("Month");

    setSub20Win(win);
    try {
      const res = await putSub20Window(win.start, win.race);
      if (res?.start_date && res?.race_date) {
        setSub20Win({
          start: kikkoSub20NormalizeStart(res.start_date),
          race: kikkoSub20NormalizeStart(res.race_date),
        });
      }
      invalidateCache("sub20-status");
    } catch {
      /* l'ottimistico resta */
    }
  }, [draft]);

  /** Salva il tempo obiettivo del piano acceso. Testo non valido: si ignora. */
  const saveGoal = useCallback(async () => {
    if (goalDraft == null) return;
    const sec = parseGoal(goalDraft);
    setGoalDraft(null);
    if (sec == null || sec === goalSec) return;
    setGoals((prev) => ({ ...prev, [PLAN_ID]: sec }));
    try {
      const res = await putSub20Goal(PLAN_ID, sec);
      if (res?.goals) setGoals(res.goals);
      invalidateCache("sub20-status");
    } catch {
      /* l'ottimistico resta; ritenta al prossimo salvataggio */
    }
  }, [goalDraft, goalSec]);

  const next = () => {
    const d = new Date(currentDate);
    if (view === 'Month') d.setMonth(d.getMonth() + 1);
    else if (view === 'Week') d.setDate(d.getDate() + 7);
    else if (view === 'Day') d.setDate(d.getDate() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    setCurrentDate(d);
  };

  const prev = () => {
    const d = new Date(currentDate);
    if (view === 'Month') d.setMonth(d.getMonth() - 1);
    else if (view === 'Week') d.setDate(d.getDate() - 7);
    else if (view === 'Day') d.setDate(d.getDate() - 1);
    else d.setFullYear(d.getFullYear() - 1);
    setCurrentDate(d);
  };

  const formatDateDisplay = () => {
    if (view === 'Month') return currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    if (view === 'Year') return currentDate.getFullYear().toString();
    if (view === 'Week') {
      const mon = new Date(currentDate);
      const day = mon.getDay();
      const diff = mon.getDate() - day + (day === 0 ? -6 : 1);
      mon.setDate(diff);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return `${mon.toLocaleDateString('it-IT', { month: 'short', day: 'numeric' })} – ${sun.toLocaleDateString('it-IT', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('it-IT', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  // ── Month View ──────────────────────────────────────────────────────────────
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDay = new Date(year, month, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;

    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    while (days.length % 7 !== 0) days.push(null);

    const weekDays = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];

    return (
      <div className="h-full flex flex-col min-h-[600px]">
        <div className="grid grid-cols-7 mb-2">
          {weekDays.map(d => (
            <div key={d} className="text-xs font-semibold text-gray-500 tracking-wider text-center">{d}</div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 gap-px bg-[#2A2A2A] border border-[#2A2A2A] rounded-lg overflow-hidden">
          {days.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="bg-[#181818] min-h-[120px]" />;

            const session = getSession(year, month, day);
            const display = toDisplay(session);
            const st = sub20StatusOf(year, month, day);
            const done = st === 'done';
            const failed = st === 'failed';
            const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

            return (
              <div
                key={`${year}-${month}-${day}`}
                className="bg-[#181818] min-h-[120px] p-2 flex flex-col group hover:bg-[#1E1E1E] transition-colors cursor-pointer"
                onClick={() => openDay(new Date(year, month, day))}
              >
                <span className={`text-sm font-medium mb-2 w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-[#3B82F6] text-white' : 'text-gray-400'}`}>
                  {day}
                </span>
                {display && (
                  <div
                    className={`flex-1 rounded-md p-2 border-l-4 bg-[#121212] flex flex-col gap-1 ${done ? 'opacity-60' : ''}`}
                    style={{ borderLeftColor: failed ? '#EF4444' : display.color }}
                  >
                    <span className="text-xs font-bold text-gray-200">{display.title}</span>
                    <span className="text-[10px] text-gray-400 line-clamp-2 leading-tight">{display.details.join(' · ')}</span>
                    {done && <span className="text-[10px] text-[#10B981]">✓ Effettuata</span>}
                    {failed && <span className="text-[10px] text-[#EF4444]">✗ Fallita</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Week View ───────────────────────────────────────────────────────────────
  const renderWeekView = () => {
    const mon = new Date(currentDate);
    const day = mon.getDay();
    const diff = mon.getDate() - day + (day === 0 ? -6 : 1);
    mon.setDate(diff);

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      return d;
    });

    const dayNames = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];

    return (
      <div className="h-full flex flex-col min-h-[600px]">
        <div className="flex-1 grid grid-cols-7 gap-4">
          {weekDays.map(date => {
            const session = getSession(date.getFullYear(), date.getMonth(), date.getDate());
            const display = toDisplay(session);
            const st = sub20StatusOf(date.getFullYear(), date.getMonth(), date.getDate());
            const done = st === 'done';
            const failed = st === 'failed';
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div
                key={date.toISOString()}
                className="rounded-xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-4 flex flex-col cursor-pointer hover:border-white/[0.2] transition-colors"
                onClick={() => openDay(date)}
              >
                <div className="text-center mb-6 pb-4 border-b border-[#2A2A2A]">
                  <div className="text-xs font-semibold text-gray-500 tracking-wider mb-2">{dayNames[date.getDay()]}</div>
                  <div className={`text-2xl font-bold mx-auto w-10 h-10 flex items-center justify-center rounded-full ${isToday ? 'bg-[#3B82F6] text-white' : 'text-gray-200'}`}>
                    {date.getDate()}
                  </div>
                </div>

                {display ? (
                  <div className={`flex-1 rounded-lg p-4 border-t-4 bg-[#121212] flex flex-col gap-3 ${done ? 'opacity-60' : ''}`} style={{ borderTopColor: failed ? '#EF4444' : display.color }}>
                    <span className="text-sm font-bold text-gray-200 uppercase tracking-wider">{display.title}</span>
                    <div className="flex flex-col gap-2">
                      {display.details.map((d, i) => (
                        <span key={i} className="text-xs text-gray-400 bg-[#1E1E1E] px-2 py-1.5 rounded">{d}</span>
                      ))}
                    </div>
                    {done && <span className="text-xs text-[#10B981] mt-auto">✓ Effettuata</span>}
                    {failed && <span className="text-xs text-[#EF4444] mt-auto">✗ Fallita</span>}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-gray-600 font-medium bg-[#121212] rounded-lg border border-[#2A2A2A] border-dashed">
                    Riposo
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Dettaglio del giorno ────────────────────────────────────────────────────
  // Usato sia dalla vista "Day" sia dal pannello a schermo intero che si apre
  // cliccando una seduta: stesso contenuto, fondo PIENO in entrambi i casi.
  const renderDayDetail = (date: Date, onClose?: () => void) => {
    const session = getSession(date.getFullYear(), date.getMonth(), date.getDate());
    const display = toDisplay(session);
    const dayKey = keyOf(date.getFullYear(), date.getMonth(), date.getDate());
    const st = sub20StatusOf(date.getFullYear(), date.getMonth(), date.getDate());
    const done = st === 'done';
    const failed = st === 'failed';

    return (
      <div className="w-full max-w-2xl mx-auto rounded-2xl border border-white/[0.12] shadow-[0_8px_40px_rgba(0,0,0,0.85)] bg-[#141414] p-8">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 group transition-colors"
            >
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Chiudi</span>
            </button>
          )}
          <h2 className="text-3xl font-bold text-white mb-8 text-center capitalize">
            {date.toLocaleDateString('it-IT', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h2>

          {display ? (
            <div className={`rounded-xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.6)] bg-[#1A1A1A] p-8 border-l-4 ${done ? 'opacity-75' : ''}`} style={{ borderLeftColor: failed ? '#EF4444' : display.color }}>
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#2A2A2A]">
                <h3 className="text-2xl font-bold text-gray-200">{display.title}</h3>
                <span className={`px-4 py-1.5 rounded-full text-sm font-medium border ${
                  done
                    ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
                    : failed
                    ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]'
                    : 'bg-[#1E1E1E] border-[#2A2A2A] text-gray-300'
                }`}>
                  {done ? '✓ Effettuata' : failed ? '✗ Fallita' : 'Programmata'}
                </span>
              </div>

              {/* Esito AUTOMATICO: confronto prescrizione ↔ giri corsi */}
              {adherenceByDate[dayKey] && (
                <div className="mb-6 pb-6 border-b border-[#2A2A2A]">
                  <SessionVerdict e={adherenceByDate[dayKey]} />
                </div>
              )}

              {/* Esito manuale — solo Sub-20, persistente su DB */}
              <div className="mb-6 pb-6 border-b border-[#2A2A2A]">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Correzione manuale</div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => markSub20(dayKey, done ? null : 'done')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold border transition-colors ${
                      done
                        ? 'bg-[#10B981] border-[#10B981] text-black'
                        : 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/20'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" /> Effettuato
                  </button>
                  <button
                    type="button"
                    onClick={() => markSub20(dayKey, failed ? null : 'failed')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold border transition-colors ${
                      failed
                        ? 'bg-[#EF4444] border-[#EF4444] text-white'
                        : 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20'
                    }`}
                  >
                    <XCircle className="w-4 h-4" /> Fallito
                  </button>
                </div>
                <p className="text-[11px] text-gray-600 mt-2.5">
                  Salvato sul database, permanente. Ritocca lo stesso pulsante per annullare.
                </p>
              </div>


              <p className="text-gray-300 leading-relaxed mb-6">{display.description}</p>

              <HeatPanel
                date={dayKey} startDate={activeStart} raceDate={activeRaceIso}
              />
              {activeOdds(dayKey)}
              {activeEvidence(dayKey)}

              {display.details.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {display.details.map((d, i) => (
                    <div key={i} className="flex items-center gap-3 bg-[#1E1E1E] px-5 py-3 rounded-xl border border-[#2A2A2A]">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: display.color }} />
                      <span className="text-gray-200 text-sm font-medium">{d}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Strength / Prehab Exercises */}
              {session?.strength_exercises && session.strength_exercises.length > 0 && (
                <div className="mt-6 pt-6 border-t border-[#2A2A2A]">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-[#8B5CF6]/15 flex items-center justify-center text-[#8B5CF6] text-[10px]">💪</span>
                    Forza & Prevenzione
                  </h4>
                  <div className="grid gap-2">
                    {session.strength_exercises.map((ex, i) => (
                      <div key={i} className="flex items-center justify-between bg-[#1E1E1E] px-4 py-2.5 rounded-lg border border-[#2A2A2A]">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-200 font-medium">{ex.name}</span>
                          {ex.note && <span className="text-[10px] text-gray-600 ml-2">{ex.note}</span>}
                        </div>
                        <span className="text-xs text-gray-500 font-mono ml-3 shrink-0">
                          {ex.sets}×{ex.reps}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            (() => {
              // Rest day — may have strength exercises
              const restSession = session;
              const restExercises = restSession?.strength_exercises ?? [];
              return (
                <div className="bg-[#121212] rounded-xl border border-[#2A2A2A] border-dashed">
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-20 h-20 rounded-full bg-[#1E1E1E] flex items-center justify-center mb-6 border border-[#2A2A2A]">
                      <span className="text-4xl">{restExercises.length > 0 ? '💪' : '☕'}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-300">
                      {restExercises.length > 0 ? 'Riposo + Forza' : 'Giorno di Riposo'}
                    </h3>
                    <p className="text-gray-500 mt-2 text-lg">
                      {restExercises.length > 0 ? 'Recupero attivo con sessione di forza e prevenzione.' : 'Recupero e ricarica delle energie.'}
                    </p>
                  </div>

                  {restExercises.length > 0 && (
                    <div className="px-8 pb-8">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-[#8B5CF6]/15 flex items-center justify-center text-[#8B5CF6] text-[10px]">💪</span>
                        Sessione Forza & Prevenzione Infortuni
                      </h4>
                      <div className="grid gap-2">
                        {restExercises.map((ex, i) => (
                          <div key={i} className="flex items-center justify-between bg-[#1E1E1E] px-4 py-2.5 rounded-lg border border-[#2A2A2A]">
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-gray-200 font-medium">{ex.name}</span>
                              {ex.note && <span className="text-[10px] text-gray-600 ml-2">{ex.note}</span>}
                            </div>
                            <span className="text-xs text-gray-500 font-mono ml-3 shrink-0">
                              {ex.sets}×{ex.reps}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          )}
      </div>
    );
  };

  const renderDayView = () => (
    <div className="h-full flex items-start justify-center pt-10">
      {renderDayDetail(currentDate)}
    </div>
  );

  // ── Year View ───────────────────────────────────────────────────────────────
  const renderYearView = () => {
    const year = currentDate.getFullYear();
    const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

    return (
      <div className="grid grid-cols-3 xl:grid-cols-4 gap-6 pb-8">
        {Array.from({ length: 12 }, (_, month) => {
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          let firstDay = new Date(year, month, 1).getDay();
          firstDay = firstDay === 0 ? 6 : firstDay - 1;

          const days: (number | null)[] = [];
          for (let i = 0; i < firstDay; i++) days.push(null);
          for (let i = 1; i <= daysInMonth; i++) days.push(i);

          return (
            <div
              key={month}
              className="rounded-xl backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50 p-5 cursor-pointer hover:border-white/[0.2] transition-colors"
              onClick={() => { const d = new Date(currentDate); d.setMonth(month); setCurrentDate(d); setView('Month'); }}
            >
              <h3 className="text-sm font-bold text-gray-200 mb-4 uppercase tracking-wider">{monthNames[month]} {year}</h3>
              <div className="grid grid-cols-7 gap-1.5">
                {days.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} className="aspect-square" />;
                  const session = getSession(year, month, day);
                  const display = toDisplay(session);
                  const st = sub20StatusOf(year, month, day);
                  const done = st === 'done';
                  const failed = st === 'failed';
                  return (
                    <div
                      key={`${year}-${month}-${day}`}
                      // Sul quadratino di una seduta il click apre quella seduta,
                      // non il mese: è il gesto che ci si aspetta.
                      className={`aspect-square rounded-sm ${display ? 'cursor-pointer hover:ring-1 hover:ring-white/50' : ''}`}
                      onClick={display ? (e) => { e.stopPropagation(); openDay(new Date(year, month, day)); } : undefined}
                      style={{
                        backgroundColor: failed ? '#EF4444' : display ? display.color : '#2A2A2A',
                        opacity: display ? (done ? 0.45 : 0.9) : 0.3,
                      }}
                      title={display ? `${day} ${monthNames[month]}: ${display.title}${done ? ' ✓' : failed ? ' ✗' : ''}` : `${day} ${monthNames[month]}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#121212]">
      {/* Header
          Va a capo, e non è pignoleria: fra i due calendari, l'obiettivo e i
          quattro tasti di vista, a 1280 px la riga traboccava e il primo
          elemento finiva fuori dallo schermo — invisibile e non cliccabile. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-6 border-b border-[#2A2A2A]">
        <div className="flex items-center gap-4 min-w-0">
          <h1 className="text-2xl font-bold text-white shrink-0">{t("sections.trainingMenu")}</h1>
          <AdherenceStrip evals={adherence} />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          {/* Il piano. Uno solo, e non si spegne: la pagina è quella. */}
          <span
            className="flex items-center gap-2 px-4 py-2 text-sm font-black rounded-lg border"
            style={{
              background: activeAccent,
              color: "#0A0A0A",
              borderColor: activeAccent,
              boxShadow: "0 0 22px rgba(192,255,0,0.55)",
            }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#0A0A0A" }} />
            kikkoSub20
          </span>

          {/* I due calendari: quando si comincia e quando si finisce.
              Sono indipendenti — se fra le due date ci stanno sei settimane si
              corrono le ULTIME sei del piano, quelle col picco e il taper, e
              la riga accanto lo dice invece di far finta di niente. */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#141414] px-2.5 py-1.5">
            <DateField
              label="Inizio"
              value={shownWin.start}
              onChange={(iso) => setDraft({ ...shownWin, start: kikkoSub20NormalizeStart(iso) })}
              title="Lunedì da cui parti"
            />

            <span className="text-gray-700">→</span>

            <DateField
              label="Fine"
              value={addDays(kikkoSub20NormalizeStart(shownWin.race), 6)}
              accent={activeAccent}
              title="Ultimo giorno: la gara. Indipendente dall'inizio."
              onChange={(iso) => setDraft({ ...shownWin, race: kikkoSub20NormalizeStart(iso) })}
            />

            <span
              className="text-[10px] whitespace-nowrap"
              style={{ color: draftWindow.weeksSkipped > 0 ? "#F59E0B" : "#6B7280" }}
              title={
                draftWindow.weeksSkipped > 0
                  ? `Il piano ne ha ${KIKKO_SUB20_PLAN.weeks.length}: con questa finestra si corrono le ultime ${draftWindow.weeksUsed}, dal picco al taper.`
                  : draftWindow.weeksIdle > 0
                    ? `Il piano dura ${KIKKO_SUB20_PLAN.weeks.length} settimane: le prime ${draftWindow.weeksIdle} restano libere.`
                    : "Il piano ci sta intero."
              }
            >
              {draftWindow.weeksUsed} sett.
              {draftWindow.weeksSkipped > 0 && ` · ultime ${draftWindow.weeksUsed} di ${KIKKO_SUB20_PLAN.weeks.length}`}
              {draftWindow.weeksIdle > 0 && ` · ${draftWindow.weeksIdle} libere prima`}
            </span>

            <button
              type="button"
              onClick={applyWindow}
              disabled={!dirty}
              className="px-3 py-1 rounded-md text-xs font-bold text-gray-300 bg-[#1E1E1E] border border-[#2A2A2A] hover:text-white disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              Applica
            </button>
          </div>

          {/* L'obiettivo. La distanza non si sceglie: il piano è sui 5 km.
              Si scrive il tempo, e accanto compare da solo il passo che serve
              per farlo — che è il numero che poi si legge sull'orologio. */}
          <div
            className="flex items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#141414] px-2.5 py-1.5"
            title="Il tempo che vuoi fare sui 5 km. È l'obiettivo su cui si misura la percentuale delle sedute di qualità."
          >
            <Target className="w-3.5 h-3.5 shrink-0" style={{ color: activeAccent }} />
            <span className="text-[9px] font-black tracking-[0.18em] uppercase text-gray-600">Obiettivo</span>
            <span className="text-xs font-bold text-gray-400">{GOAL_DISTANCE_KM} km</span>
            <span className="text-gray-700">in</span>
            <input
              value={goalDraft ?? fmtRaceTime(goalSec)}
              onChange={(e) => setGoalDraft(e.target.value)}
              onBlur={saveGoal}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              inputMode="numeric"
              placeholder="19:59"
              className="w-[3.6rem] bg-transparent border-0 p-0 text-xs font-bold outline-none"
              style={{
                color: goalDraft != null && parseGoal(goalDraft) == null ? "#F43F5E" : activeAccent,
              }}
            />
            <span className="text-gray-700">=</span>
            <span
              className="text-xs font-bold tabular-nums"
              style={{ fontFamily: "'JetBrains Mono', monospace", color: activeAccent }}
            >
              {goalPace}/km
            </span>
          </div>


          <div className="flex bg-[#1E1E1E] rounded-md border border-[#2A2A2A] p-1">
            {(['Day', 'Week', 'Month', 'Year'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 text-sm rounded-sm transition-colors ${view === v ? 'bg-[#2A2A2A] text-white font-medium shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {v}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-[#1E1E1E] rounded-md border border-[#2A2A2A] px-2 py-1.5">
            <button onClick={prev} className="p-1 text-gray-400 hover:text-white hover:bg-[#2A2A2A] rounded transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="mx-2 text-sm text-gray-200 min-w-[160px] text-center font-semibold tracking-wide capitalize">
              {formatDateDisplay()}
            </span>
            <button onClick={next} className="p-1 text-gray-400 hover:text-white hover:bg-[#2A2A2A] rounded transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendario */}
      <div className="flex-1 overflow-auto p-6">
        {view === 'Month' && renderMonthView()}
        {view === 'Week' && renderWeekView()}
        {view === 'Day' && renderDayView()}
        {view === 'Year' && renderYearView()}
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-[#2A2A2A]">
          {KIKKO_SUB20_LEGEND.map(({ color, label, opacity }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color, opacity: (opacity as number | undefined) ?? 0.9 }} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>

        <VdotGainPanel
          startVdot={KIKKO_SUB20_PLAN.weekVdot[0]}
          weeks={draftWindow.weeksUsed}
          goalSec={goalSec}
        />
      </div>

      {/* Dettaglio seduta — copre tutto: niente scritte che filtrano da dietro */}
      {detailDate && (
        <div
          className="fixed inset-0 z-[70] bg-[#0A0A0A] overflow-y-auto"
          onClick={closeDay}
          role="presentation"
        >
          <div className="min-h-full flex items-start justify-center p-4 sm:p-8">
            <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
              {renderDayDetail(detailDate, closeDay)}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
