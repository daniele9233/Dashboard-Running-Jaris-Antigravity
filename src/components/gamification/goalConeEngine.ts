import { dayIndex, dayToIso } from "./gamiCore";
import {
  doseWithRecipe, GOALS, timeAtDay, walkPlan,
  type PhysioState, type RecipeId, type SystemLevels,
} from "./physioEngine";
import { predictionSdPct, successProbability } from "../racelab/raceLabEngine";

/**
 * IL CONO DEL TRAGUARDO — "quando ci arrivo", detto con una data e un margine.
 *
 * La lista "Quando ci arrivi" dà una data sola, ed è per costruzione la data
 * del cinquanta per cento: il giorno in cui la previsione tocca il tempo, cioè
 * quello in cui metà delle volte va bene e metà no. Detta così sembra una
 * promessa, ed è una monetina.
 *
 * Il cono mostra tutte e tre le date che servono davvero:
 *
 *   possibile  20%  — il bordo veloce del cono tocca il tempo: una giornata
 *                     perfetta basterebbe
 *   alla pari  50%  — la previsione tocca il tempo
 *   probabile  80%  — anche il bordo lento ci sta: è la data su cui si
 *                     prenota un pettorale
 *
 * Il cono si allarga col passare dei giorni perché il modello sa meno del
 * futuro lontano che di quello vicino — la stessa incertezza con cui il banco
 * di prova calcola le probabilità, così le due pagine dicono la stessa cosa.
 */

export interface ConeGoal {
  id: string;
  /** "5K in 19:40". */
  label: string;
  distM: number;
  targetSec: number;
  /** Domenica di gara, se l'obiettivo ne ha una. */
  raceIso: string | null;
  /** È l'obiettivo scritto nel piano di allenamento. */
  mine: boolean;
}

export interface ConePoint {
  day: number;
  iso: string;
  /** Tempo previsto quel giorno, clima del mese compreso. */
  sec: number;
  /** Bordi del cono: 20° e 80° percentile del tempo. */
  lo: number;
  hi: number;
  /** Probabilità di stare sotto l'obiettivo se la gara fosse quel giorno. */
  p: number;
  tempC: number;
}

export interface ConeEta { days: number; iso: string; tempC: number }

export interface ConeBoost {
  recipe: RecipeId;
  /** "una soglia in più a settimana". */
  label: string;
  /** "+1 soglia", per le etichette strette. */
  short: string;
  even: ConeEta | null;
  /** Giorni guadagnati sulla data alla pari. Null se senza la ricetta non ci si arriva proprio. */
  daysSaved: number | null;
  points: { day: number; sec: number }[];
}

export interface GoalCone {
  goal: ConeGoal;
  points: ConePoint[];
  /** Giorni mostrati. */
  horizon: number;
  todaySec: number;
  todayP: number;
  /** Secondi che mancano oggi (negativo = già sotto). */
  gapSec: number;
  possible: ConeEta | null;
  even: ConeEta | null;
  likely: ConeEta | null;
  race: (ConeEta & { sec: number; p: number }) | null;
  boost: ConeBoost | null;
}

/** Il 20° e l'80° percentile di una normale: ±0,8416 deviazioni standard. */
const Z80 = 0.8416;
const MAX_DAYS = 540;
const STEP = 3;

const RECIPE_SHORT: Record<RecipeId, string> = {
  soglia: "+1 soglia", ripetute: "+1 ripetute", lungo: "+1 lungo", volume: "+90′ lento",
};
const RECIPE_LABEL: Record<RecipeId, string> = {
  soglia: "una soglia in più a settimana",
  ripetute: "una seduta di ripetute in più a settimana",
  lungo: "un lungo da 100′ a settimana",
  volume: "90′ di lento in più a settimana",
};

/** Le distanze fino ai 10K le spostano le qualità; la mezza il lungo. */
const recipesFor = (distM: number): RecipeId[] => (distM > 12000 ? ["soglia", "lungo"] : ["soglia", "ripetute"]);

/** Un obiettivo del piano di allenamento: distanza, tempo e giorno. */
export interface PlanGoalInput { label: string; distM: number; targetSec: number; raceIso: string | null }

/**
 * Gli obiettivi fra cui scegliere: prima quelli del piano, poi quelli ancora
 * aperti della lista, senza doppioni.
 */
export function coneGoals(p: PhysioState, mine?: PlanGoalInput[] | null): ConeGoal[] {
  const out: ConeGoal[] = [];
  (mine ?? []).forEach((g, i) => {
    if (g.targetSec > 0) out.push({ id: `mine-${i}`, label: g.label, distM: g.distM, targetSec: g.targetSec, raceIso: g.raceIso, mine: true });
  });
  for (const g of p.goals) {
    if (g.done || out.length >= 6) continue;
    const def = GOALS.find((d) => d.id === g.id);
    if (!def) continue;
    if (out.some((o) => o.distM === def.m && Math.abs(o.targetSec - def.sec) <= 2)) continue;
    out.push({ id: def.id, label: g.label, distM: def.m, targetSec: def.sec, raceIso: null, mine: false });
  }
  return out;
}

/** Cammina in avanti sotto una dose e raccoglie il tempo di ogni giorno. */
function trajectory(p: PhysioState, dose: SystemLevels, distM: number, days: number): { sec: number; tempC: number }[] {
  const out: { sec: number; tempC: number }[] = [];
  const t0 = timeAtDay(p.model, dose, distM, 0);
  out.push({ sec: t0.sec, tempC: t0.tempC });
  walkPlan(p.model, dose, distM, days, (_i, sec, tempC) => { out.push({ sec, tempC: Math.round(tempC) }); });
  return out;
}

const etaOf = (p: PhysioState, traj: { tempC: number }[], i: number): ConeEta =>
  ({ days: i, iso: dayToIso(p.model.today + i), tempC: traj[i].tempC });

export function buildGoalCone(p: PhysioState, goal: ConeGoal, todayIso?: string): GoalCone | null {
  if (!p.ok) return null;
  const traj = trajectory(p, p.dose, goal.distM, MAX_DAYS);
  const prob = (i: number) => (i === 0
    ? successProbability(traj[0].sec, goal.targetSec, 1)
    : successProbability(traj[i].sec, goal.targetSec, i));

  let possible: ConeEta | null = null, even: ConeEta | null = null, likely: ConeEta | null = null;
  for (let i = 1; i < traj.length && !likely; i++) {
    const pi = prob(i);
    if (!possible && pi >= 0.2) possible = etaOf(p, traj, i);
    if (!even && traj[i].sec <= goal.targetSec) even = etaOf(p, traj, i);
    if (pi >= 0.8) likely = etaOf(p, traj, i);
  }

  // la gara si legge dal giorno di oggi del calendario, non dall'ultima corsa:
  // il modello conta da `model.today`, che può essere indietro di qualche giorno
  const today = todayIso ? Math.max(dayIndex(todayIso), p.model.today) : p.model.today;
  let race: GoalCone["race"] = null;
  if (goal.raceIso) {
    const i = dayIndex(goal.raceIso) - p.model.today;
    if (i >= 0 && i < traj.length && dayIndex(goal.raceIso) >= today) {
      race = { ...etaOf(p, traj, i), sec: traj[i].sec, p: prob(i) };
    }
  }

  // si guarda fino a dove la risposta si legge: la data probabile, altrimenti la
  // gara, altrimenti otto mesi — oltre, la stagione dopo ruberebbe la scena
  const reach = (likely ?? even)?.days ?? race?.days ?? 240;
  const horizon = Math.min(MAX_DAYS, Math.max(120, reach + 35, (race?.days ?? 0) + 28));

  const points: ConePoint[] = [];
  for (let i = 0; i <= horizon; i += STEP) {
    const sd = (traj[i].sec * predictionSdPct(Math.max(1, i))) / 100;
    points.push({
      day: i, iso: dayToIso(p.model.today + i), sec: traj[i].sec,
      lo: traj[i].sec - Z80 * sd, hi: traj[i].sec + Z80 * sd,
      p: prob(i), tempC: traj[i].tempC,
    });
  }

  // cosa sposta la data: la ricetta che anticipa di più il giorno alla pari
  let boost: ConeBoost | null = null;
  for (const recipe of recipesFor(goal.distM)) {
    const bt = trajectory(p, doseWithRecipe(p.dose, recipe), goal.distM, MAX_DAYS);
    const hit = bt.findIndex((x, i) => i > 0 && x.sec <= goal.targetSec);
    const bEven = hit > 0 ? etaOf(p, bt, hit) : null;
    if (!bEven) continue;
    const daysSaved = even ? even.days - bEven.days : null;
    if (daysSaved != null && daysSaved <= 0) continue;
    const better = !boost || !boost.even || bEven.days < boost.even.days;
    if (better) {
      const pts: { day: number; sec: number }[] = [];
      for (let i = 0; i <= horizon; i += STEP) pts.push({ day: i, sec: bt[i].sec });
      boost = { recipe, label: RECIPE_LABEL[recipe], short: RECIPE_SHORT[recipe], even: bEven, daysSaved, points: pts };
    }
  }

  return {
    goal, points, horizon,
    todaySec: traj[0].sec, todayP: prob(0),
    gapSec: Math.round(traj[0].sec - goal.targetSec),
    possible, even, likely, race, boost,
  };
}
