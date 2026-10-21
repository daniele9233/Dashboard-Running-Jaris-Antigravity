import { useEffect, useMemo, useState } from "react";
import { Target } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { API_CACHE } from "../hooks/apiCacheKeys";
import { getBestEfforts, getRuns } from "../api";
import type { BestEffortsResponse, RunsResponse } from "../types/api";
import { KIKKO_SUB20_PLAN, kikkoWindow, secToPace, type KikkoVdotChoice } from "../data/kikkoSub20Plan";
import { useAthleteVdot } from "./gamification/useAthleteVdot";
import {
  GOAL_DISTANCE_KM, GOAL_PRESETS, buildGoalPlan, fmtClock, parseFiveKGoal, performancesFrom,
  type GoalPlan, type Performance,
} from "../utils/trainingGoal";

const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const ACCENT = "var(--app-accent)";
const AMBER = "#F59E0B";

const dec = (n: number) => n.toFixed(1).replace(".", ",");

const pad = (n: number) => String(n).padStart(2, "0");
const localIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "26 ott" — con l'anno quando non è quello in corso. */
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
  const head = p.kind === "pb"
    ? `Record ${p.label} · ${fmtClock(p.timeSec)}`
    : `${when} · ${p.distKm.toFixed(1).replace(".", ",")} km in ${fmtClock(p.timeSec)}${p.elevationM ? ` · +${p.elevationM} m` : ""}`;
  return `${head}${p.kind === "pb" ? ` · ${when}` : ""} · VDOT ${dec(p.vdot)}`;
}

type Basis = "estimate" | "performance";
type GoalChoice = number | "custom";

interface Props {
  /** L'obiettivo oggi attivo sul piano, in secondi. */
  goalSec: number;
  /** La forma di partenza e di arrivo del piano attivo, se è stata generata. */
  planVdot: KikkoVdotChoice | null;
  /** La finestra attiva: lunedì di partenza e lunedì della settimana di gara. */
  window: { start: string; race: string };
  /** Salva il piano e porta il calendario sulla prima settimana. */
  onGenerate: (plan: GoalPlan, goalSec: number) => Promise<void> | void;
}

/**
 * OBIETTIVO E PIANO.
 *
 * Si sceglie un tempo sui 5 km — uno dei pronti o uno scritto a mano — e da dove
 * partire: dal VDOT stimato dell'app oppure da una prestazione vera, un record o
 * una corsa recente. Il piano si ricalcola da solo mentre si sceglie e si salva
 * solo con "Genera piano": prima di premerlo si vede già quante settimane
 * servono, quando si corre e se l'obiettivo sta dentro quello che un blocco può
 * dare.
 */
export function TrainingGoalBox({ goalSec, planVdot, window: win, onGenerate }: Props) {
  const todayIso = useMemo(() => localIso(new Date()), []);

  const athleteVdot = useAthleteVdot();
  const { data: runsData } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const { data: effortsData } = useApi<BestEffortsResponse>(getBestEfforts, { cacheKey: API_CACHE.BEST_EFFORTS });
  const perfs = useMemo(
    () => performancesFrom(effortsData?.efforts ?? [], runsData?.runs ?? [], todayIso),
    [effortsData, runsData, todayIso],
  );
  const allPerfs = useMemo(() => [...perfs.pbs, ...perfs.runs], [perfs]);

  // ── L'obiettivo ──
  const presetOf = (sec: number): GoalChoice => (GOAL_PRESETS.some((p) => p.sec === sec) ? sec : "custom");
  const [choice, setChoice] = useState<GoalChoice>(() => presetOf(goalSec));
  const [customText, setCustomText] = useState(() => fmtClock(goalSec));
  // finché non si tocca niente, la scelta segue l'obiettivo che arriva dal server
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched) return;
    setChoice(presetOf(goalSec));
    setCustomText(fmtClock(goalSec));
  }, [goalSec, touched]);

  const draftGoalSec = choice === "custom" ? parseFiveKGoal(customText) : choice;
  const customInvalid = choice === "custom" && draftGoalSec == null;

  // ── Da dove si parte ──
  const [basis, setBasis] = useState<Basis>("estimate");
  const [perfId, setPerfId] = useState<string | null>(null);
  const defaultPerf = perfs.pbs.find((p) => p.label === "5 km") ?? allPerfs[0] ?? null;
  const perf = allPerfs.find((p) => p.id === perfId) ?? defaultPerf;

  const baseVdot = basis === "estimate" ? athleteVdot : perf?.vdot ?? null;
  // il server scarta partenze fuori da questo intervallo: meglio dirlo qui
  const baseOk = baseVdot != null && baseVdot >= 25 && baseVdot <= 85;

  const plan = useMemo(
    () => (baseOk && draftGoalSec != null ? buildGoalPlan(baseVdot as number, draftGoalSec, todayIso) : null),
    [baseOk, baseVdot, draftGoalSec, todayIso],
  );

  // ── Il piano acceso ──
  const active = useMemo(() => kikkoWindow(KIKKO_SUB20_PLAN, win.start, win.race), [win]);

  const [busy, setBusy] = useState(false);
  const generate = async () => {
    if (!plan || draftGoalSec == null || busy) return;
    setBusy(true);
    try { await onGenerate(plan, draftGoalSec); } finally { setBusy(false); }
  };

  const chip = (selected: boolean) =>
    `min-h-[36px] px-3 py-1.5 rounded-lg border text-xs font-black transition-colors ${
      selected
        ? "text-[#0A0A0A] border-transparent"
        : "bg-[#141414] border-[#2A2A2A] text-gray-300 hover:text-white hover:border-white/25"
    }`;
  const chipStyle = (selected: boolean) => (selected ? { background: ACCENT, ...MONO } : MONO);

  const blocker =
    customInvalid ? "Scrivi un tempo sui 5 km, per esempio 19:45."
    : basis === "estimate" && athleteVdot == null ? "Sto leggendo il tuo VDOT stimato…"
    : basis === "performance" && !perf ? "Non ci sono prestazioni da 5 km in su da cui partire."
    : !baseOk ? "Il VDOT di partenza è fuori scala: scegli un'altra base."
    : null;

  return (
    <section aria-label="Obiettivo e piano" className="mb-6 rounded-xl border border-[#2A2A2A] bg-[#0F0F0F] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2A2A2A] flex flex-wrap items-center gap-x-3 gap-y-1">
        <Target className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
        <h2 className="text-[10px] font-black tracking-[0.2em] uppercase text-gray-300">Obiettivo e piano</h2>
        <span className="text-[11px] text-gray-500" style={MONO}>
          Piano attivo · {GOAL_DISTANCE_KM} km in {fmtClock(goalSec)} · {active.weeksUsed} sett. ·{" "}
          {fmtDay(active.firstMonday)} → {fmtDay(active.raceIso, true)}
          {planVdot && <> · VDOT {dec(planVdot.start)} → {dec(planVdot.target)}</>}
        </span>
      </div>

      <div className="grid gap-x-8 gap-y-5 p-4 md:grid-cols-2">
        {/* L'obiettivo */}
        <div className="min-w-0">
          <div className="text-[9px] font-black tracking-[0.18em] uppercase text-gray-500 mb-2">
            Obiettivo · {GOAL_DISTANCE_KM} km in
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Tempo obiettivo sui 5 km">
            {GOAL_PRESETS.map((p) => (
              <button
                key={p.sec}
                type="button"
                aria-pressed={choice === p.sec}
                onClick={() => { setTouched(true); setChoice(p.sec); }}
                className={chip(choice === p.sec)}
                style={chipStyle(choice === p.sec)}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={choice === "custom"}
              onClick={() => { setTouched(true); setChoice("custom"); }}
              className={chip(choice === "custom")}
              style={choice === "custom" ? { background: ACCENT } : undefined}
            >
              Personalizzato
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 min-h-[34px]">
            {choice === "custom" && (
              <input
                aria-label="Tempo personalizzato sui 5 km"
                value={customText}
                onChange={(e) => { setTouched(true); setCustomText(e.target.value); }}
                inputMode="numeric"
                placeholder="19:45"
                className="w-[5.5rem] rounded-md border bg-[#0A0A0A] px-2 py-1.5 text-xs font-bold outline-none focus:border-white/40"
                style={{ ...MONO, color: customInvalid ? "#F43F5E" : ACCENT, borderColor: customInvalid ? "#F43F5E" : "#2A2A2A" }}
              />
            )}
            {draftGoalSec != null && (
              <span className="text-xs text-gray-400" style={MONO}>
                = <span className="font-bold" style={{ color: ACCENT }}>{secToPace(draftGoalSec / GOAL_DISTANCE_KM)}/km</span>
              </span>
            )}
          </div>
        </div>

        {/* Da dove si parte */}
        <div className="min-w-0">
          <div className="text-[9px] font-black tracking-[0.18em] uppercase text-gray-500 mb-2">
            Calcola il piano su
          </div>
          <div className="inline-flex rounded-lg bg-[#1E1E1E] border border-[#2A2A2A] p-1" role="group" aria-label="Base di partenza">
            {([
              ["estimate", "VDOT stimato"],
              ["performance", "Una mia prestazione"],
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
              <label className="block">
                <span className="sr-only">Prestazione di partenza</span>
                <select
                  value={perf?.id ?? ""}
                  onChange={(e) => setPerfId(e.target.value)}
                  className="w-full rounded-md border border-[#2A2A2A] bg-[#0A0A0A] px-2 py-2 text-xs text-gray-200 outline-none focus:border-white/40"
                  style={{ colorScheme: "dark" }}
                >
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
            )}
          </div>
        </div>
      </div>

      {/* Quello che ne esce, prima di salvare */}
      <div className="px-4 py-3 border-t border-[#2A2A2A] flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex-1 min-w-[260px] space-y-1.5 text-[11.5px] leading-snug" aria-live="polite">
          {blocker ? (
            <p className="text-gray-500">{blocker}</p>
          ) : plan ? (
            <>
              <p className="text-gray-400">
                Si parte da VDOT <span className="font-bold text-gray-200">{dec(plan.baseVdot)}</span>:{" "}
                {fmtClock(draftGoalSec as number)} sui {GOAL_DISTANCE_KM} km ne chiede{" "}
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
              {!plan.realistic && (
                <p style={{ color: AMBER }}>
                  In {plan.weeks} settimane la letteratura misura circa +{dec(plan.capGain)} punti di VDOT: a fine blocco
                  ti porta a circa {fmtClock(plan.reachSec)}, non a {fmtClock(draftGoalSec as number)}.
                  {plan.clipped
                    ? " I ritmi non salgono oltre +2 punti: per il resto serve un secondo blocco."
                    : " Il piano punta comunque all'obiettivo: è una punta, non il valore atteso."}
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
