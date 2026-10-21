import { useMemo, useState } from "react";
import { Target } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { API_CACHE } from "../hooks/apiCacheKeys";
import { getBestEfforts, getIntervalSessions, getRuns } from "../api";
import type { BestEffortsResponse, IntervalSessionsResponse, RunsResponse } from "../types/api";
import { KIKKO_SUB20_PLAN, kikkoWindow, secToPace, type KikkoVdotChoice } from "../data/kikkoSub20Plan";
import { useAthleteVdot } from "./gamification/useAthleteVdot";
import {
  GOAL_DISTANCE_KM, PLAN_SPECIFIC_UP_TO_KM, buildGoalPlan, equivalentSec, fmtClock, goalFromPace,
  parseDistanceKm, parsePace, performancesFrom,
  type GoalPlan, type GoalTarget, type Performance,
} from "../utils/trainingGoal";

const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const ACCENT = "var(--app-accent)";
const AMBER = "#F59E0B";
const RED = "#F43F5E";

const dec = (n: number) => n.toFixed(1).replace(".", ",");
const fmtKm = (km: number) => String(Number(km.toFixed(2))).replace(".", ",");

const pad = (n: number) => String(n).padStart(2, "0");
const localIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "26 ott" — con l'anno quando serve. */
function fmtDay(iso: string, withYear = false): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("it-IT", {
    day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}),
  }).replace(".", "");
}

/** Il testo di una prestazione dentro il menu a tendina. */
function perfLabel(p: Performance): string {
  const when = fmtDay(p.date, true);
  if (p.kind === "pb") return `Record ${p.label} · ${fmtClock(p.timeSec)} · ${when} · VDOT ${dec(p.vdot)}`;
  if (p.kind === "reps" && p.reps) {
    const r = p.reps;
    return `${when} · ${r.n}×${r.avgM} m a ${secToPace(r.workPaceSec)}/km · più veloce ${secToPace(r.fastestPaceSec)} · VDOT ${dec(p.vdot)}`;
  }
  return `${when} · ${fmtKm(p.distKm)} km in ${fmtClock(p.timeSec)}${p.elevationM ? ` · +${p.elevationM} m` : ""} · VDOT ${dec(p.vdot)}`;
}

/** Sotto il menu: i dettagli di quella prestazione, per sapere cosa si sceglie. */
function perfDetail(p: Performance): string {
  if (p.kind === "reps" && p.reps) {
    const r = p.reps;
    return [
      `Ripetuta più veloce ${secToPace(r.fastestPaceSec)}/km su ${r.fastestM} m`,
      r.restSec != null ? `recupero medio ${r.restSec} s` : null,
      r.tempC != null ? `${dec(r.tempC)} °C` : null,
      "VDOT dai giri dell'orologio, riportato al fresco",
    ].filter(Boolean).join(" · ");
  }
  if (p.kind === "run") {
    return `${p.label} · corretta per il caldo, non per la pendenza${p.elevationM ? `: +${p.elevationM} m di dislivello` : ""}`;
  }
  return `Record personale sui ${p.label}`;
}

type Basis = "estimate" | "performance";

/** Le ripetute si guardano sugli ultimi quattro mesi, come il VDOT ufficiale. */
const getIntervalSessionsFourMonths = () => getIntervalSessions(4);

/**
 * L'obiettivo come lo ha scritto l'atleta, ricordato su questo browser.
 *
 * Il server conosce solo il 5 km equivalente (è quello che il piano usa): la
 * distanza e il passo scelti servono a rileggere l'obiettivo com'era stato
 * scritto. Vale solo finché il 5 km equivalente combacia con quello salvato.
 */
const META_KEY = "metic:goal-meta";
function readMeta(): GoalTarget | null {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) ?? "null");
    return m && [m.distKm, m.paceSec, m.timeSec, m.fiveKSec].every((n) => typeof n === "number") ? m : null;
  } catch {
    return null;
  }
}
function writeMeta(g: GoalTarget) {
  try { localStorage.setItem(META_KEY, JSON.stringify(g)); } catch { /* niente storage: resta il 5 km */ }
}

interface Props {
  /** L'obiettivo oggi attivo sul piano: il 5 km equivalente, in secondi. */
  goalSec: number;
  /** La forma di partenza e di arrivo del piano attivo, se è stata generata. */
  planVdot: KikkoVdotChoice | null;
  /** La finestra attiva: lunedì di partenza e lunedì della settimana di gara. */
  window: { start: string; race: string };
  /** Salva il piano e porta il calendario sulla prima settimana. */
  onGenerate: (plan: GoalPlan, goal: GoalTarget) => Promise<void> | void;
}

/**
 * OBIETTIVO E PIANO.
 *
 * L'obiettivo lo scrive l'atleta: una distanza e un passo medio al km, niente
 * proposte. Da dove si parte lo sceglie lui: dal VDOT stimato dell'app oppure da
 * una prestazione vera — un record, una seduta a ripetute degli ultimi quattro
 * mesi, una corsa dell'ultimo anno. Il piano si ricalcola da solo mentre si
 * scrive e si salva solo con "Genera piano": prima di premerlo si vede già quante
 * settimane servono, quando si corre e se l'obiettivo sta dentro quello che un
 * blocco può dare.
 */
export function TrainingGoalBox({ goalSec, planVdot, window: win, onGenerate }: Props) {
  const todayIso = useMemo(() => localIso(new Date()), []);

  const athleteVdot = useAthleteVdot();
  const { data: runsData } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const { data: effortsData } = useApi<BestEffortsResponse>(getBestEfforts, { cacheKey: API_CACHE.BEST_EFFORTS });
  // se il backend non ha ancora l'elenco, il gruppo semplicemente non c'è
  const { data: intervalsData } = useApi<IntervalSessionsResponse>(getIntervalSessionsFourMonths, {
    cacheKey: API_CACHE.INTERVAL_SESSIONS,
  });
  const perfs = useMemo(
    () => performancesFrom(effortsData?.efforts ?? [], runsData?.runs ?? [], intervalsData?.sessions ?? [], todayIso),
    [effortsData, runsData, intervalsData, todayIso],
  );
  const allPerfs = useMemo(() => [...perfs.pbs, ...perfs.reps, ...perfs.runs], [perfs]);

  // ── L'obiettivo: lo scrive l'atleta, nessun valore proposto ──
  const [distText, setDistText] = useState("");
  const [paceText, setPaceText] = useState("");
  const distKm = parseDistanceKm(distText);
  const paceSec = parsePace(paceText);
  const goal = useMemo(
    () => (distKm != null && paceSec != null ? goalFromPace(distKm, paceSec) : null),
    [distKm, paceSec],
  );
  const distInvalid = distText.trim() !== "" && distKm == null;
  const paceInvalid = paceText.trim() !== "" && paceSec == null;

  // ── Da dove si parte: sempre una scelta esplicita ──
  const [basis, setBasis] = useState<Basis>("performance");
  const [perfId, setPerfId] = useState<string | null>(null);
  const perf = allPerfs.find((p) => p.id === perfId) ?? null;

  const baseVdot = basis === "estimate" ? athleteVdot : perf?.vdot ?? null;
  // il server scarta partenze fuori da questo intervallo: meglio dirlo qui
  const baseOk = baseVdot != null && baseVdot >= 25 && baseVdot <= 85;

  const plan = useMemo(
    () => (goal && baseOk ? buildGoalPlan(baseVdot as number, goal.fiveKSec, todayIso) : null),
    [goal, baseOk, baseVdot, todayIso],
  );

  // ── Il piano acceso ──
  const active = useMemo(() => kikkoWindow(KIKKO_SUB20_PLAN, win.start, win.race), [win]);
  const [meta, setMeta] = useState<GoalTarget | null>(readMeta);
  const activeGoal = meta && meta.fiveKSec === goalSec
    ? `${fmtKm(meta.distKm)} km a ${secToPace(meta.paceSec)}/km (${fmtClock(meta.timeSec)})`
    : `${GOAL_DISTANCE_KM} km in ${fmtClock(goalSec)}`;

  const [busy, setBusy] = useState(false);
  const generate = async () => {
    if (!plan || !goal || busy) return;
    setBusy(true);
    try {
      writeMeta(goal);
      setMeta(goal);
      await onGenerate(plan, goal);
    } finally {
      setBusy(false);
    }
  };

  const blocker =
    !goal ? "Scrivi la distanza e il passo medio al km: sono l'obiettivo."
    : basis === "estimate" && athleteVdot == null ? "Sto leggendo il tuo VDOT stimato…"
    : basis === "performance" && !perf ? "Scegli la prestazione da cui partire."
    : !baseOk ? "Il VDOT di partenza è fuori scala: scegli un'altra base."
    : null;

  const fieldClass = (bad: boolean) =>
    `w-full min-h-[40px] rounded-md border bg-[#0A0A0A] px-2.5 py-2 text-sm font-bold outline-none focus:border-white/40 ${
      bad ? "border-[#F43F5E]" : "border-[#2A2A2A]"
    }`;

  return (
    <section aria-label="Obiettivo e piano" className="mb-6 rounded-xl border border-[#2A2A2A] bg-[#0F0F0F] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2A2A2A] flex flex-wrap items-center gap-x-3 gap-y-1">
        <Target className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
        <h2 className="text-[10px] font-black tracking-[0.2em] uppercase text-gray-300">Obiettivo e piano</h2>
        <span className="text-[11px] text-gray-500" style={MONO}>
          Piano attivo · {activeGoal} · {active.weeksUsed} sett. · {fmtDay(active.firstMonday)} → {fmtDay(active.raceIso, true)}
          {planVdot && <> · VDOT {dec(planVdot.start)} → {dec(planVdot.target)}</>}
        </span>
      </div>

      <div className="grid gap-x-8 gap-y-5 p-4 md:grid-cols-2">
        {/* L'obiettivo: lo scrive l'atleta */}
        <div className="min-w-0">
          <div className="text-[9px] font-black tracking-[0.18em] uppercase text-gray-500 mb-2">Il tuo obiettivo</div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[11px] text-gray-400 mb-1">Distanza</span>
              <div className="relative">
                <input
                  value={distText}
                  onChange={(e) => setDistText(e.target.value)}
                  inputMode="decimal"
                  placeholder="es. 5"
                  aria-invalid={distInvalid}
                  className={`${fieldClass(distInvalid)} pr-9`}
                  style={{ ...MONO, color: distInvalid ? RED : ACCENT }}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-500 pointer-events-none">km</span>
              </div>
            </label>
            <label className="block">
              <span className="block text-[11px] text-gray-400 mb-1">Passo medio</span>
              <div className="relative">
                <input
                  value={paceText}
                  onChange={(e) => setPaceText(e.target.value)}
                  inputMode="numeric"
                  placeholder="es. 4:00"
                  aria-invalid={paceInvalid}
                  className={`${fieldClass(paceInvalid)} pr-11`}
                  style={{ ...MONO, color: paceInvalid ? RED : ACCENT }}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-500 pointer-events-none">/km</span>
              </div>
            </label>
          </div>

          <div className="mt-2 min-h-[34px] text-[11px] leading-snug">
            {distInvalid && <p style={{ color: RED }}>Distanza da 3 a 42,2 km, per esempio 10 o 21,1.</p>}
            {paceInvalid && <p style={{ color: RED }}>Passo al km da 2:30 a 10:00, scritto m:ss, per esempio 4:00.</p>}
            {goal && !distInvalid && !paceInvalid && (
              <p className="text-gray-400" style={MONO}>
                = <span className="font-bold" style={{ color: ACCENT }}>{fmtClock(goal.timeSec)}</span> sui {fmtKm(goal.distKm)} km
                {Math.abs(goal.distKm - GOAL_DISTANCE_KM) > 0.01 && (
                  <> · il motore di un 5 km in {fmtClock(goal.fiveKSec)}</>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Da dove si parte */}
        <div className="min-w-0">
          <div className="text-[9px] font-black tracking-[0.18em] uppercase text-gray-500 mb-2">Calcola il piano su</div>
          <div className="inline-flex rounded-lg bg-[#1E1E1E] border border-[#2A2A2A] p-1" role="group" aria-label="Base di partenza">
            {([
              ["performance", "Una mia prestazione"],
              ["estimate", "VDOT stimato"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={basis === id}
                onClick={() => setBasis(id)}
                className={`min-h-[32px] px-3 py-1 rounded-md text-xs transition-colors ${
                  basis === id ? "bg-[#2A2A2A] text-white font-bold shadow-sm" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 min-h-[34px]">
            {basis === "estimate" ? (
              <p className="text-xs text-gray-400" style={MONO}>
                VDOT stimato dall'app:{" "}
                <span className="font-bold text-gray-200">{athleteVdot != null ? dec(athleteVdot) : "…"}</span>
              </p>
            ) : allPerfs.length === 0 ? (
              <p className="text-xs text-gray-500">Nessuna prestazione da 5 km in su, per ora.</p>
            ) : (
              <>
                <label className="block">
                  <span className="sr-only">Prestazione di partenza</span>
                  <select
                    value={perf?.id ?? ""}
                    onChange={(e) => setPerfId(e.target.value || null)}
                    className="w-full min-h-[40px] rounded-md border border-[#2A2A2A] bg-[#0A0A0A] px-2 py-2 text-xs text-gray-200 outline-none focus:border-white/40"
                    style={{ colorScheme: "dark" }}
                  >
                    <option value="" disabled>Scegli una prestazione…</option>
                    {perfs.reps.length > 0 && (
                      <optgroup label="Ripetute · ultimi 4 mesi, dalla più forte">
                        {perfs.reps.map((p) => <option key={p.id} value={p.id}>{perfLabel(p)}</option>)}
                      </optgroup>
                    )}
                    {perfs.pbs.length > 0 && (
                      <optgroup label="Record personali">
                        {perfs.pbs.map((p) => <option key={p.id} value={p.id}>{perfLabel(p)}</option>)}
                      </optgroup>
                    )}
                    {perfs.runs.length > 0 && (
                      <optgroup label="Corse dell'ultimo anno, dalla più forte">
                        {perfs.runs.map((p) => <option key={p.id} value={p.id}>{perfLabel(p)}</option>)}
                      </optgroup>
                    )}
                  </select>
                </label>
                {perf && <p className="mt-2 text-[11px] leading-snug text-gray-500">{perfDetail(perf)}</p>}
                {intervalsData && perfs.reps.length === 0 && (
                  <p className="mt-2 text-[11px] leading-snug text-gray-600">
                    Nessuna seduta a ripetute letta dai giri negli ultimi 4 mesi.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Quello che ne esce, prima di salvare */}
      <div className="px-4 py-3 border-t border-[#2A2A2A] flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex-1 min-w-[260px] space-y-1.5 text-[11.5px] leading-snug" aria-live="polite">
          {blocker ? (
            <p className="text-gray-500">{blocker}</p>
          ) : plan && goal ? (
            <>
              <p className="text-gray-400">
                Si parte da VDOT <span className="font-bold text-gray-200">{dec(plan.baseVdot)}</span>:{" "}
                {fmtKm(goal.distKm)} km a {secToPace(goal.paceSec)}/km ne chiedono{" "}
                <span className="font-bold text-gray-200">{dec(plan.goalVdot)}</span>
                {plan.gain > 0.05 ? (
                  <> (<span className="font-bold" style={{ color: plan.realistic ? ACCENT : AMBER }}>+{dec(plan.gain)}</span>).</>
                ) : (
                  <>: il motore per farlo c'è già, il piano lo porta alla gara.</>
                )}
              </p>
              <p className="text-gray-400" style={MONO}>
                <span className="font-bold text-gray-200">{plan.weeks} settimane</span> · dal lunedì {fmtDay(plan.startIso)} alla
                gara di domenica {fmtDay(plan.raceIso, true)}
              </p>
              {!plan.realistic && (() => {
                const reach = equivalentSec(GOAL_DISTANCE_KM * 1000, plan.reachSec, goal.distKm * 1000);
                return (
                  <p style={{ color: AMBER }}>
                    In {plan.weeks} settimane la letteratura misura circa +{dec(plan.capGain)} punti di VDOT: a fine blocco
                    ti porta a circa {fmtClock(reach)} sui {fmtKm(goal.distKm)} km ({secToPace(reach / goal.distKm)}/km), non a{" "}
                    {fmtClock(goal.timeSec)}.
                    {plan.clipped
                      ? " I ritmi non salgono oltre +2 punti: per il resto serve un secondo blocco."
                      : " Il piano punta comunque all'obiettivo: è una punta, non il valore atteso."}
                  </p>
                );
              })()}
              {goal.distKm > PLAN_SPECIFIC_UP_TO_KM && (
                <p className="text-gray-500">
                  Il piano è scritto sui {GOAL_DISTANCE_KM} km: alza il motore (il VDOT) ma non prepara la tenuta
                  specifica per {fmtKm(goal.distKm)} km.
                </p>
              )}
            </>
          ) : null}
        </div>

        <button
          type="button"
          onClick={generate}
          disabled={!plan || busy}
          className="min-h-[40px] px-5 py-2 rounded-lg text-sm font-black text-[#0A0A0A] transition-opacity disabled:opacity-35 disabled:cursor-default hover:opacity-90"
          style={{ background: ACCENT, boxShadow: plan && !busy ? "0 0 18px rgba(192,255,0,0.35)" : undefined }}
        >
          {busy ? "Genero…" : "Genera piano"}
        </button>
      </div>
    </section>
  );
}
