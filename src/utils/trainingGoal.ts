import type { BestEffort, IntervalSession, Run } from "../types/api";
import {
  KIKKO_SUB20_PLAN, KIKKO_VDOT_MAX_GAIN, addDays, basesFor, kikkoPlausibleGain,
  kikkoSub20NormalizeStart, kikkoVdotForFiveK, type KikkoVdotChoice,
} from "../data/kikkoSub20Plan";
import { predictSec, runVdot, vdotFrom } from "../components/gamification/gamiCore";

/**
 * L'OBIETTIVO E IL PIANO CHE NE DISCENDE
 * ────────────────────────────────────────────────────────────────────────────
 * Il piano non si inventa: è quello di kikkoSub20, scritto a mano, con i ritmi
 * che seguono il VDOT settimana per settimana. Quello che si sceglie qui è
 * DA DOVE si parte (un VDOT, da una prestazione vera) e DOVE si vuole arrivare:
 * una distanza e un passo medio al km, scritti dall'atleta. Da questi due
 * numeri discendono il VDOT di arrivo, la durata e le date.
 *
 * La distanza è libera, ma il piano costruisce il MOTORE — il VDOT — e le sue
 * sedute sono quelle di un piano sui 5 km. Un obiettivo su un'altra distanza si
 * traduce nel motore che richiede (il VDOT è lo stesso a qualunque distanza) e
 * sul server si salva come il 5 km equivalente. Oltre i 10 km il piano alza il
 * motore ma non prepara la tenuta specifica: la pagina lo dice.
 *
 * La durata non è una leva: è quanto serve. Un punto di VDOT si compra in circa
 * otto settimane a questo livello (Milanović 2015, Bacon 2013), quindi un
 * obiettivo vicino sta in un blocco corto e uno lontano ne chiede uno pieno.
 * Se nemmeno il blocco pieno basta, il piano lo dice invece di far finta.
 */

/** La distanza su cui il piano è scritto, e a cui si salva l'obiettivo. */
export const GOAL_DISTANCE_KM = 5;

/** Oltre questa distanza il piano costruisce il motore ma non la tenuta. */
export const PLAN_SPECIFIC_UP_TO_KM = 10;

/** Sotto questa durata non è più un blocco, è una settimana di richiamo. */
export const MIN_PLAN_WEEKS = 8;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** "19:59" o "1:34:35" → secondi. Null se non è un tempo. */
export function parseClock(text: string): number | null {
  const m = text.trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = m[1] ? Number(m[1]) : 0;
  const min = Number(m[2]);
  const s = Number(m[3]);
  if (s > 59 || (m[1] && min > 59)) return null;
  return h * 3600 + min * 60 + s;
}

/** "19:47" o "1:34:12". */
export function fmtClock(sec: number): string {
  const t = Math.round(sec);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Le distanze di un obiettivo: dai 3 km alla maratona, sotto la formula non vale. */
export const GOAL_KM_RANGE = { min: 3, max: 42.2 } as const;
/** I passi di un obiettivo: da 2:30 a 10:00 al km. */
export const GOAL_PACE_RANGE_SEC = { min: 150, max: 600 } as const;

/** "5", "10", "21,1", "21.0975" → km. Null se non è una distanza da obiettivo. */
export function parseDistanceKm(text: string): number | null {
  const m = text.trim().replace(",", ".").match(/^\d{1,2}(?:\.\d{1,4})?$/);
  if (!m) return null;
  const km = Number(m[0]);
  return km >= GOAL_KM_RANGE.min && km <= GOAL_KM_RANGE.max ? km : null;
}

/** "4:00", "3:56" → secondi al km. Null se non è un passo da obiettivo. */
export function parsePace(text: string): number | null {
  const m = text.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m || Number(m[2]) > 59) return null;
  const sec = Number(m[1]) * 60 + Number(m[2]);
  return sec >= GOAL_PACE_RANGE_SEC.min && sec <= GOAL_PACE_RANGE_SEC.max ? sec : null;
}

/** Il tempo che lo stesso motore produce su un'altra distanza (Daniels, al fresco). */
export function equivalentSec(fromM: number, fromSec: number, toM: number): number {
  return predictSec(toM, vdotFrom(fromM, fromSec));
}

/** L'obiettivo come lo scrive l'atleta: una distanza e un passo medio al km. */
export interface GoalTarget {
  distKm: number;
  /** Secondi al km. */
  paceSec: number;
  /** Tempo sulla distanza: distanza × passo. */
  timeSec: number;
  /** Il 5 km a cui quello stesso motore corrisponde: è quello che il piano salva. */
  fiveKSec: number;
}

/** L'obiettivo da una distanza e un passo; null se uno dei due è fuori scala. */
export function goalFromPace(distKm: number, paceSec: number): GoalTarget | null {
  if (distKm < GOAL_KM_RANGE.min || distKm > GOAL_KM_RANGE.max) return null;
  if (paceSec < GOAL_PACE_RANGE_SEC.min || paceSec > GOAL_PACE_RANGE_SEC.max) return null;
  const timeSec = Math.round(distKm * paceSec);
  const fiveKSec = Math.round(equivalentSec(distKm * 1000, timeSec, GOAL_DISTANCE_KM * 1000));
  return { distKm, paceSec, timeSec, fiveKSec };
}

/** Il lunedì da cui si parte: oggi se è lunedì, altrimenti il prossimo. */
export function nextMonday(iso: string): string {
  const monday = kikkoSub20NormalizeStart(iso);
  return monday === iso ? iso : addDays(monday, 7);
}

export interface GoalPlan {
  /** Da dove si parte. */
  baseVdot: number;
  /** Il VDOT che il tempo obiettivo richiede sui 5 km, al fresco. */
  goalVdot: number;
  /** Punti da guadagnare (0 se il motore c'è già). */
  gain: number;
  /** Quanto un blocco di queste settimane può dare, secondo la letteratura. */
  capGain: number;
  /** Settimane del piano. */
  weeks: number;
  /** Lunedì della prima settimana. */
  startIso: string;
  /** Lunedì della settimana di gara — il formato in cui la pagina lo salva. */
  raceMondayIso: string;
  /** Domenica di gara. */
  raceIso: string;
  /** La progressione da usare: partenza e arrivo del piano. */
  vdot: KikkoVdotChoice;
  /** Il guadagno chiesto sta dentro quello che il blocco produce. */
  realistic: boolean;
  /** Il piano si ferma al tetto di +2 punti: l'obiettivo sta oltre. */
  clipped: boolean;
  /** Il tempo a cui il piano porta, al fresco: l'obiettivo se è alla portata. */
  reachSec: number;
}

/**
 * Il piano per un obiettivo, a partire da un VDOT.
 *
 * Le settimane sono il blocco più corto che il guadagno chiesto rende
 * plausibile, fra MIN_PLAN_WEEKS e la durata piena del piano. Il VDOT di arrivo
 * non supera la partenza di più di due punti: è il tetto che il server applica
 * e che un blocco può produrre davvero.
 *
 * `fiveKSec` è il tempo sui 5 km: per un obiettivo su un'altra distanza è il 5 km
 * equivalente (`GoalTarget.fiveKSec`), cioè lo stesso motore.
 */
export function buildGoalPlan(baseVdot: number, fiveKSec: number, todayIso: string): GoalPlan {
  const base = round1(baseVdot);
  const goalVdot = kikkoVdotForFiveK(fiveKSec);
  const gain = Math.max(0, round1(goalVdot - base));
  const maxWeeks = KIKKO_SUB20_PLAN.weeks.length;

  let weeks = maxWeeks;
  for (let w = MIN_PLAN_WEEKS; w <= maxWeeks; w++) {
    if (kikkoPlausibleGain(w, base) >= gain - 1e-9) { weeks = w; break; }
  }

  const capGain = kikkoPlausibleGain(weeks, base);
  const realistic = gain <= capGain + 0.05;
  const target = round1(Math.min(Math.max(goalVdot, base), base + KIKKO_VDOT_MAX_GAIN));

  const startIso = nextMonday(todayIso);
  const raceMondayIso = addDays(startIso, (weeks - 1) * 7);

  return {
    baseVdot: base,
    goalVdot,
    gain,
    capGain,
    weeks,
    startIso,
    raceMondayIso,
    raceIso: addDays(raceMondayIso, 6),
    vdot: { start: base, target },
    realistic,
    clipped: goalVdot - base > KIKKO_VDOT_MAX_GAIN + 0.05,
    reachSec: realistic ? fiveKSec : basesFor(base + capGain).race * GOAL_DISTANCE_KM,
  };
}

/**
 * Un VDOT salvato sul server vale solo se discende dall'obiettivo salvato.
 *
 * Sul server può esserci una scelta di VDOT fatta quando la pagina aveva un
 * campo apposta: da allora l'obiettivo si è mosso e quel numero non lo
 * rappresenta più. Applicarlo cambierebbe in silenzio i ritmi di un piano che
 * si sta correndo. Un piano generato qui è sempre coerente: il VDOT di arrivo è
 * quello dell'obiettivo, fermo a +2 sulla partenza.
 */
export function vdotMatchesGoal(v: KikkoVdotChoice, goalSec: number): boolean {
  const expected = Math.min(Math.max(kikkoVdotForFiveK(goalSec), v.start), v.start + KIKKO_VDOT_MAX_GAIN);
  return Math.abs(v.target - expected) <= 0.15;
}

// ── Le prestazioni da cui partire ────────────────────────────────────────────

/** Le ripetute di una seduta: quante, a che passo, e la più veloce. */
export interface RepsDetail {
  n: number;
  /** Lunghezza media di una ripetuta, metri. */
  avgM: number;
  /** Passo medio sul lavoro, secondi/km. */
  workPaceSec: number;
  /** La ripetuta più veloce: passo (secondi/km) e lunghezza (metri). */
  fastestPaceSec: number;
  fastestM: number;
  /** Recupero medio in secondi, se c'è. */
  restSec: number | null;
  tempC: number | null;
}

export interface Performance {
  id: string;
  kind: "pb" | "reps" | "run";
  /** "5 km", "Mezza Maratona" per i record; il nome della seduta o della corsa per il resto. */
  label: string;
  /** Per le ripetute, i chilometri di lavoro. */
  distKm: number;
  timeSec: number;
  /** YYYY-MM-DD. */
  date: string;
  /** Il VDOT che quella prestazione dimostra, sulla stessa scala del piano. */
  vdot: number;
  /** Dislivello positivo della corsa, in metri: serve a scegliere una prova piatta. */
  elevationM?: number;
  reps?: RepsDetail;
}

/** Un VDOT qualsiasi, riportato sulla scala dei ritmi del piano via il 5 km equivalente. */
const planScaleVdot = (v: number) => round1(kikkoVdotForFiveK(predictSec(5000, v)));

/** I record che il piano sa leggere: dai 5 km alla mezza. */
const PB_METERS: Record<string, number> = {
  "5 km": 5000,
  "10 km": 10000,
  "15 km": 15000,
  "Mezza Maratona": 21097.5,
};

/** Un record valido ha un tempo leggibile e un passo da essere umano. */
function pbPerformance(e: BestEffort): Performance | null {
  const distM = PB_METERS[e.distance];
  const timeSec = parseClock(e.time);
  if (!distM || !timeSec) return null;
  if (timeSec / (distM / 1000) < 175) return null;
  return {
    id: `pb-${e.distance}`,
    kind: "pb",
    label: e.distance,
    distKm: distM / 1000,
    timeSec,
    date: (e.date ?? "").slice(0, 10),
    vdot: planScaleVdot(vdotFrom(distM, timeSec)),
  };
}

/**
 * Una seduta a ripetute come punto di partenza.
 *
 * Il VDOT è quello del server — lo stesso conto del VDOT ufficiale dell'app, dai
 * giri dell'orologio, con il passo riportato al fresco e lo sconto del recupero —
 * e qui si porta solo sulla scala dei ritmi del piano. Non si rifà il calcolo.
 */
function repsPerformance(s: IntervalSession): Performance {
  const distKm = (s.n_reps * s.avg_rep_m) / 1000;
  return {
    id: `reps-${s.run_id}`,
    kind: "reps",
    label: s.name?.trim() || `${s.n_reps}×${s.avg_rep_m} m`,
    distKm,
    timeSec: Math.round(distKm * s.work_pace_sec),
    date: s.date,
    vdot: planScaleVdot(s.vdot),
    reps: {
      n: s.n_reps,
      avgM: s.avg_rep_m,
      workPaceSec: s.work_pace_sec,
      fastestPaceSec: s.fastest_pace_sec,
      fastestM: s.fastest_rep_m,
      restSec: s.rest_avg_sec,
      tempC: s.temp_c,
    },
  };
}

/**
 * Le prestazioni fra cui scegliere: i record personali, le sedute a ripetute
 * degli ultimi mesi (dalla più forte) e le corse migliori dell'ultimo anno.
 *
 * Solo corse da 5 km in su, per lo stesso motivo del resto dell'app: sotto, la
 * componente anaerobica gonfia il VDOT. Il VDOT di una corsa è quello al fresco
 * (corretto per il caldo, non per la pendenza: chi sceglie vede il dislivello
 * accanto e può preferire una corsa piatta). Una seduta a ripetute sta nel suo
 * gruppo e non fra le corse: sul passo medio di tutta l'uscita varrebbe meno di
 * un lento.
 */
export function performancesFrom(
  efforts: BestEffort[],
  runs: Run[],
  intervals: IntervalSession[],
  todayIso: string,
  { maxRuns = 8, maxReps = 6 }: { maxRuns?: number; maxReps?: number } = {},
): { pbs: Performance[]; reps: Performance[]; runs: Performance[] } {
  const pbs = efforts
    .map(pbPerformance)
    .filter((p): p is Performance => p != null)
    .sort((a, b) => a.distKm - b.distKm);

  const reps = intervals
    .map(repsPerformance)
    .sort((a, b) => b.vdot - a.vdot);

  const skip = new Set([...efforts.map((e) => e.run_id), ...intervals.map((s) => s.run_id)]);
  const since = addDays(todayIso, -365);

  const fromRuns: Performance[] = [];
  for (const r of runs) {
    const date = (r.date ?? "").slice(0, 10);
    if (date < since || date > todayIso) continue;
    if (!r.distance_km || r.distance_km < 5 || skip.has(r.id)) continue;
    const v = runVdot(r);
    if (v == null || !Number.isFinite(v)) continue;
    fromRuns.push({
      id: `run-${r.id}`,
      kind: "run",
      label: r.name?.trim() || `${r.distance_km.toFixed(1)} km`,
      distKm: r.distance_km,
      timeSec: r.duration_minutes * 60,
      date,
      vdot: planScaleVdot(v),
      elevationM: r.elevation_gain > 0 ? Math.round(r.elevation_gain) : undefined,
    });
  }
  fromRuns.sort((a, b) => b.vdot - a.vdot);

  return { pbs, reps: reps.slice(0, maxReps), runs: fromRuns.slice(0, maxRuns) };
}
