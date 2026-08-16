import type { Run } from "../../types/api";
import {
  clamp, dayIndex, dayToIso, fmtClock, gradeFactor, heatSlowdownFrac, humidityOf, paceToSec,
  predictSec, vdotFrom,
} from "../gamification/gamiCore";
import {
  planToDose, timeAtDay, walkPlan,
  type PhysioModel, type SystemLevels, type WeeklyPlan,
} from "../gamification/physioEngine";
import {
  NITRATE_UNCERTAINTY, PACK_GAIN_PCT, nitrateGainPct, rpeMaxGainPct, shoeById, shoeGainPct,
  surfaceById, taperById, type ShoeClass, type SurfaceId, type TaperKind,
} from "./shoeLab";

/**
 * IL BANCO DI PROVA
 * ════════════════════════════════════════════════════════════════════════════
 * Due domande, un solo motore.
 *
 *   "Se avessi avuto le Alphafly, dieci gradi e il taper, quanto avrei corso?"
 *   "Quando arrivo al mio obiettivo, e cosa devo fare per arrivarci?"
 *
 * Sembrano lontane, ma sono la stessa: una prestazione è una forma moltiplicata
 * per le condizioni del giorno. La forma la costruisce il motore fisiologico e
 * ci vogliono mesi; le condizioni si scelgono la mattina della gara e valgono
 * più di quanto quasi tutti credano.
 *
 * Il pezzo che tiene insieme le due metà è la NORMALIZZAZIONE: ogni prova reale
 * viene riportata a condizioni di riferimento — flat da gara, 12 °C, nessun
 * taper, nessun integratore, asfalto, in solitaria, a tutta — e da lì si può
 * proiettare ovunque. Senza questo passaggio confrontare due corse fatte in
 * stagioni diverse con scarpe diverse non vuol dire niente.
 */

// ── CONDIZIONI ────────────────────────────────────────────────────────────────
export interface Conditions {
  shoeId: string;
  taper: TaperKind;
  tempC: number;
  humidity: number | null;
  nitrate: boolean;
  surface: SurfaceId;
  /** In gruppo o in gara vera, contro il correre da soli. */
  pack: boolean;
  /** Metri di dislivello positivo sul percorso. */
  elevationGain: number;
}

/** Le condizioni di riferimento: lo zero rispetto a cui si misura tutto. */
export const REFERENCE: Conditions = {
  shoeId: "flat", taper: "none", tempC: 12, humidity: 55,
  nitrate: false, surface: "road", pack: false, elevationGain: 0,
};

/** Una singola voce del conto, in secondi al chilometro. */
export interface Factor {
  id: string;
  label: string;
  detail: string;
  /** Positivo = ti fa guadagnare tempo (passo più veloce). */
  gainPct: number;
  /** Secondi al km guadagnati (positivo) o persi (negativo). */
  secPerKm: number;
  uncertaintyPct: number;
}

/**
 * Quanto quelle condizioni moltiplicano il passo.
 *
 * Restituisce anche la scomposizione, perché il numero finale senza le voci che
 * lo compongono è un oracolo: l'atleta deve poter vedere che dei quindici
 * secondi al chilometro, otto sono la temperatura e cinque le scarpe.
 */
export function conditionFactors(
  c: Conditions, distKm: number, refPaceSec: number, vdot: number,
): { factor: number; factors: Factor[]; uncertaintyPct: number } {
  const factors: Factor[] = [];
  const push = (id: string, label: string, detail: string, gainPct: number, unc: number) => {
    if (Math.abs(gainPct) < 0.01 && unc === 0) return;
    factors.push({ id, label, detail, gainPct, secPerKm: (refPaceSec * gainPct) / 100, uncertaintyPct: unc });
  };

  const flat = shoeById("flat")!;
  const shoe = shoeById(c.shoeId) ?? flat;
  const shoeGain = shoeGainPct(flat, shoe, refPaceSec);
  push("shoe", `${shoe.brand} ${shoe.name}`.trim(), shoe.basis, shoeGain, shoe.uncertaintyPct * 0.75);

  const heat = heatSlowdownFrac(c.tempC, c.humidity, distKm) * 100;
  push("temp", `${Math.round(c.tempC)}°C`,
    heat > 0
      ? "Sopra i 12 °C il sangue serve anche a raffreddare, e il costo cresce con la distanza."
      : "Temperatura vicina all'ottimale: nessuna penalità.",
    -heat, heat > 0 ? 0.5 : 0);

  const taper = taperById(c.taper);
  push("taper", `Taper: ${taper.label.toLowerCase()}`, taper.detail, taper.gainPct, taper.uncertaintyPct);

  if (c.nitrate) {
    const g = nitrateGainPct(vdot);
    push("nitrate", "Nitrati (succo di barbabietola)",
      "Meno ossigeno per la stessa velocità. Il beneficio cala man mano che il livello sale: al tuo VDOT vale questo.",
      g, NITRATE_UNCERTAINTY);
  }

  const surf = surfaceById(c.surface);
  push("surface", surf.label, "Superficie e appoggio: quanto della spinta torna indietro.", surf.gainPct, 0.4);

  if (c.pack) push("pack", "In gruppo o in gara", "Aria e ritmo tenuti da altri, invece che da te.", PACK_GAIN_PCT, 0.4);

  if (c.elevationGain > 0 && distKm > 0) {
    // metà del dislivello positivo è salita vera, il resto lo restituisce la discesa
    const grade = (c.elevationGain * 0.5) / (distKm * 1000);
    const loss = (gradeFactor(grade) - 1) * 100;
    push("elev", `${Math.round(c.elevationGain)} m di dislivello`,
      "Il passo in salita costa più di quanto la discesa restituisca.", -loss, 0.3);
  }

  // i guadagni si compongono, non si sommano: due miglioramenti del 3% non fanno il 6%
  const factor = factors.reduce((f, x) => f / (1 + x.gainPct / 100), 1);
  const uncertaintyPct = Math.sqrt(factors.reduce((s, x) => s + x.uncertaintyPct ** 2, 0));
  return { factor, factors, uncertaintyPct };
}

// ── UNA PROVA REALE, NORMALIZZATA ─────────────────────────────────────────────
export interface Effort {
  id: string;
  date: string;
  name: string;
  km: number;
  paceSec: number;
  timeSec: number;
  tempC: number | null;
  humidity: number | null;
  elevationGain: number;
  /** Annotazioni dell'atleta: con cosa l'ha corsa e come stava. */
  shoeId: string;
  taper: TaperKind;
  rpe: number | null;
  /** Passo in condizioni di riferimento, a tutta. Il numero confrontabile. */
  refPaceSec: number;
  /** VDOT equivalente di quella prova, normalizzata. */
  refVdot: number;
}

const RACE_LAB_KEY = "race_lab";
type RunAnnotation = { shoe_id?: string | null; taper?: TaperKind | null; rpe?: number | null };
export const annotationOf = (r: Run): RunAnnotation =>
  ((r as Run & Record<string, unknown>)[RACE_LAB_KEY] as RunAnnotation | undefined) ?? {};

/**
 * Le prove veloci: le corse sotto una certa soglia di passo, nella finestra
 * scelta. Sono le uniche su cui ha senso ragionare di scarpe e di taper — su un
 * lento la differenza fra una piastra di carbonio e una flat è rumore.
 */
export function fastEfforts(
  runs: Run[], opt: { maxPaceSec?: number; days?: number; minKm?: number; todayIso?: string; defaultShoe: string } ,
): Effort[] {
  const maxPace = opt.maxPaceSec ?? 270;
  const today = dayIndex(opt.todayIso ?? new Date().toISOString());
  const from = today - (opt.days ?? 90);
  const minKm = opt.minKm ?? 3;

  return runs
    .filter((r) => !r.is_treadmill && (r.distance_km || 0) >= minKm && dayIndex(r.date) >= from)
    .map((r) => {
      const paceSec = paceToSec(r.avg_pace);
      if (!paceSec || paceSec > maxPace) return null;
      const a = annotationOf(r);
      const km = r.distance_km || 0;
      const shoeId = a.shoe_id ?? opt.defaultShoe;
      const taper = a.taper ?? "none";
      const rpe = a.rpe ?? null;

      const cond: Conditions = {
        shoeId, taper, tempC: r.temperature ?? 12, humidity: humidityOf(r),
        nitrate: false, surface: "road", pack: false, elevationGain: r.elevation_gain || 0,
      };
      // il VDOT grezzo serve solo a tarare la resa dei nitrati: qui non è ancora
      // normalizzato, ma per quella scala l'ordine di grandezza basta
      const rawVdot = vdotFrom(km * 1000, paceSec * km);
      const { factor } = conditionFactors(cond, km, paceSec, rawVdot);
      // dalle condizioni di quel giorno al riferimento, poi da RPE a massimale
      const refPace = (paceSec / factor) / (1 + rpeMaxGainPct(rpe) / 100);

      return {
        id: r.id, date: r.date.slice(0, 10), name: r.name ?? "Corsa",
        km: Math.round(km * 100) / 100, paceSec, timeSec: paceSec * km,
        tempC: r.temperature ?? null, humidity: humidityOf(r),
        elevationGain: r.elevation_gain || 0,
        shoeId, taper, rpe,
        refPaceSec: refPace,
        refVdot: vdotFrom(km * 1000, refPace * km),
      } satisfies Effort;
    })
    .filter((e): e is Effort => e != null)
    .sort((a, b) => a.refPaceSec - b.refPaceSec);
}

// ── "E SE INVECE…" ────────────────────────────────────────────────────────────
export interface WhatIf {
  distM: number;
  /** Tempo previsto in quelle condizioni. */
  sec: number;
  /** Banda di incertezza, in secondi. */
  bandSec: number;
  paceSec: number;
  /** Rispetto alla prova di partenza, secondi guadagnati sul totale. */
  deltaSec: number;
  factors: Factor[];
  /** Le stesse voci per le condizioni di partenza, per il confronto affiancato. */
  baseFactors: Factor[];
}

/**
 * Che tempo avresti fatto — o faresti — su quella distanza, in quelle condizioni,
 * partendo dalla forma dimostrata in una prova reale.
 *
 * Se la distanza chiesta è diversa da quella corsa, il passaggio è via VDOT:
 * la forma è la stessa, la distanza cambia il ritmo che regge.
 */
export function whatIf(base: Effort, target: Conditions, distM: number): WhatIf {
  const distKm = distM / 1000;
  // la forma dimostrata, portata sulla distanza richiesta
  const refPaceAtDist = predictSec(distM, base.refVdot) / distKm;
  const { factor, factors, uncertaintyPct } = conditionFactors(target, distKm, refPaceAtDist, base.refVdot);

  const paceSec = refPaceAtDist * factor;
  const sec = paceSec * distKm;

  const baseCond: Conditions = {
    shoeId: base.shoeId, taper: base.taper, tempC: base.tempC ?? 12, humidity: base.humidity,
    nitrate: false, surface: "road", pack: false, elevationGain: base.elevationGain,
  };
  const baseAtDist = conditionFactors(baseCond, distKm, refPaceAtDist, base.refVdot);
  const baseSec = refPaceAtDist * baseAtDist.factor * distKm;

  return {
    distM, sec, paceSec,
    bandSec: (sec * uncertaintyPct) / 100,
    deltaSec: baseSec - sec,
    factors,
    baseFactors: baseAtDist.factors,
  };
}

// ── LE CONDIZIONI DEL GIORNO DELLA GARA ───────────────────────────────────────
/**
 * Con cosa la corri, l'obiettivo.
 *
 * C'è una trappola qui, e va detta: il VDOT su cui poggia tutto il modello viene
 * dalle corse dell'atleta, che sono state corse con le SUE scarpe. Applicare il
 * guadagno di una super scarpa rispetto a una flat da gara conterebbe due volte
 * quello che è già dentro il numero di partenza. Il confronto quindi è sempre
 * rispetto alla calzatura abituale — e per la stessa ragione il taper e i
 * nitrati partono da "no", perché così sono state corse le prove da cui il
 * modello ha imparato.
 */
export interface RaceSetup {
  shoeId: string;
  /** La scarpa con cui hai corso le prove da cui il modello ha imparato. */
  baselineShoeId: string;
  taper: TaperKind;
  nitrate: boolean;
  /** Temperatura della gara. Null = quella tipica del mese in cui cade. */
  tempC: number | null;
  pack: boolean;
}

export const defaultSetup = (baselineShoeId: string): RaceSetup => ({
  shoeId: baselineShoeId, baselineShoeId, taper: "none", nitrate: false, tempC: null, pack: false,
});

/**
 * Quanto quelle condizioni moltiplicano il tempo che il modello fisiologico
 * prevede per quel giorno. Sotto 1 = correresti più forte della previsione nuda.
 */
export function raceFactor(
  setup: RaceSetup, distKm: number, dayTempC: number, refPaceSec: number, vdot: number,
): { factor: number; factors: Factor[]; uncertaintyPct: number } {
  const factors: Factor[] = [];
  const push = (id: string, label: string, detail: string, gainPct: number, unc: number) => {
    if (Math.abs(gainPct) < 0.01) return;
    factors.push({ id, label, detail, gainPct, secPerKm: (refPaceSec * gainPct) / 100, uncertaintyPct: unc });
  };

  const baseShoe = shoeById(setup.baselineShoeId) ?? shoeById("flat")!;
  const raceShoe = shoeById(setup.shoeId) ?? baseShoe;
  if (raceShoe.id !== baseShoe.id) {
    push("shoe", `${raceShoe.brand} ${raceShoe.name}`.trim(),
      `Rispetto alle tue ${baseShoe.name}, con cui hai corso le prove da cui viene la stima.`,
      shoeGainPct(baseShoe, raceShoe, refPaceSec),
      Math.sqrt(raceShoe.uncertaintyPct ** 2 + baseShoe.uncertaintyPct ** 2) * 0.75);
  }

  const taper = taperById(setup.taper);
  push("taper", `Taper: ${taper.label.toLowerCase()}`, taper.detail, taper.gainPct, taper.uncertaintyPct);

  if (setup.nitrate) {
    push("nitrate", "Nitrati (succo di barbabietola)",
      "Meno ossigeno per la stessa velocità: al tuo livello vale questo, e cala man mano che sali.",
      nitrateGainPct(vdot), NITRATE_UNCERTAINTY);
  }
  if (setup.pack) push("pack", "In gara, non da solo", "Aria e ritmo tenuti da altri.", PACK_GAIN_PCT, 0.4);

  // la temperatura sostituisce quella del mese, non ci si somma
  let tempRatio = 1;
  if (setup.tempC != null && Math.abs(setup.tempC - dayTempC) > 0.5) {
    const race = heatSlowdownFrac(setup.tempC, null, distKm);
    const day = heatSlowdownFrac(dayTempC, null, distKm);
    tempRatio = (1 + race) / (1 + day);
    push("temp", `${Math.round(setup.tempC)}°C invece dei ${Math.round(dayTempC)}° tipici`,
      "La previsione usa il clima medio del mese: qui stai chiedendo una giornata precisa.",
      (1 - tempRatio) * 100, 0.5);
  }

  const gains = factors.filter((f) => f.id !== "temp");
  const factor = gains.reduce((f, x) => f / (1 + x.gainPct / 100), 1) * tempRatio;
  return {
    factor, factors,
    uncertaintyPct: Math.sqrt(factors.reduce((s, x) => s + x.uncertaintyPct ** 2, 0)),
  };
}

/** Come {@link walkPlan}, ma il tempo che passa a `visit` è già quello di gara. */
function walkRace(
  model: PhysioModel, dose: SystemLevels, distM: number, setup: RaceSetup, vdot: number, days: number,
  visit: (i: number, raceSec: number, tempC: number) => boolean | void,
): void {
  const distKm = distM / 1000;
  walkPlan(model, dose, distM, days, (i, sec, dayTemp) => {
    const { factor } = raceFactor(setup, distKm, dayTemp, sec / distKm, vdot);
    return visit(i, sec * factor, setup.tempC ?? dayTemp);
  });
}

// ── L'OBIETTIVO ───────────────────────────────────────────────────────────────
export interface GoalPlanResult {
  /** Data prevista al carico attuale, e sotto il piano proposto. */
  etaNow: { days: number; iso: string; tempC: number } | null;
  /** Il giorno in cui diventa possibile: la previsione tocca il tempo, 50%. */
  etaPlan: { days: number; iso: string; tempC: number } | null;
  /** Il giorno in cui diventa probabile: 80%. È quello su cui si prenota un pettorale. */
  etaSafe: { days: number; iso: string; tempC: number } | null;
  /** Tempo previsto alla data-obiettivo, se c'è. */
  atTarget: { sec: number; tempC: number } | null;
  /** Che tempo faresti OGGI in quelle condizioni: il controllo di realtà. */
  todaySec: number;
  /** Da dove vengono i secondi che le condizioni scelte regalano o tolgono. */
  factors: Factor[];
  /** Probabilità di farcela alla data-obiettivo (o all'ETA del piano). */
  probability: number;
  /** Quanto manca, in secondi, alla data di riferimento. */
  gapSec: number | null;
  /** Il piano più leggero che porta all'obiettivo entro la data. */
  suggested: WeeklyPlan | null;
  /** Perché non ci si arriva, quando non ci si arriva. */
  blocker: string | null;
}

/**
 * La variabilità del giorno di gara.
 *
 * Anche a forma identica due gare non danno lo stesso tempo: sonno, stomaco,
 * vento, come è andata la partenza. Sull'ordine dell'1,5% del tempo per un
 * amatore allenato — ed è il motivo per cui una previsione onesta è una
 * probabilità e non una promessa.
 */
const RACE_DAY_SD_PCT = 1.5;
/** Incertezza del modello stesso: cresce con l'orizzonte della previsione. */
const modelSdPct = (days: number) => 1.2 + Math.min(3.0, (days / 180) * 2.2);

/** Funzione di ripartizione normale, per trasformare un margine in probabilità. */
function normalCdf(z: number): number {
  // approssimazione di Abramowitz-Stegun 7.1.26 sull'erf
  const s = z < 0 ? -1 : 1, x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + s * y);
}

export function successProbability(predictedSec: number, targetSec: number, horizonDays: number): number {
  const sd = (predictedSec * Math.sqrt(RACE_DAY_SD_PCT ** 2 + modelSdPct(horizonDays) ** 2)) / 100;
  if (sd <= 0) return predictedSec <= targetSec ? 1 : 0;
  return clamp(normalCdf((targetSec - predictedSec) / sd), 0, 1);
}

/**
 * Il giorno in cui il piano porta all'obiettivo con una certa confidenza.
 *
 * Serve perché la data "nuda" è per costruzione la data del cinquanta per cento:
 * è il giorno in cui la previsione tocca esattamente il tempo, quindi metà delle
 * volte va bene e metà no. Chiedere l'ottanta per cento a quella data è una
 * contraddizione, e la prima versione di questa pagina ci cascava — diceva
 * "arrivi il 16 settembre" e sotto "nessun carico ragionevole ci arriva".
 *
 * Le due date insieme sono l'informazione vera: quando diventa possibile, e
 * quando diventa probabile.
 */
export function etaAtConfidence(
  model: PhysioModel, dose: SystemLevels, distM: number, targetSec: number,
  confidence: number, setup: RaceSetup, vdot: number, days = 540,
): { days: number; iso: string; tempC: number } | null {
  let hit: { days: number; iso: string; tempC: number } | null = null;
  walkRace(model, dose, distM, setup, vdot, days, (i, sec, temp) => {
    if (successProbability(sec, targetSec, i) >= confidence) {
      hit = { days: i, iso: dayToIso(model.today + i), tempC: Math.round(temp) };
      return true;
    }
  });
  return hit;
}

/** Il primo giorno in cui il piano, in quelle condizioni, tocca il tempo. */
export function raceEta(
  model: PhysioModel, dose: SystemLevels, distM: number, targetSec: number,
  setup: RaceSetup, vdot: number, days = 540,
): { days: number; iso: string; tempC: number } | null {
  let hit: { days: number; iso: string; tempC: number } | null = null;
  walkRace(model, dose, distM, setup, vdot, days, (i, sec, temp) => {
    if (sec <= targetSec) {
      hit = { days: i, iso: dayToIso(model.today + i), tempC: Math.round(temp) };
      return true;
    }
  });
  return hit;
}

/** Che tempo faresti fra `dayOffset` giorni, in quelle condizioni. */
export function raceTimeAtDay(
  model: PhysioModel, dose: SystemLevels, distM: number, dayOffset: number,
  setup: RaceSetup, vdot: number,
): { sec: number; tempC: number; factors: Factor[]; uncertaintyPct: number } {
  const plain = timeAtDay(model, dose, distM, dayOffset);
  const distKm = distM / 1000;
  const { factor, factors, uncertaintyPct } = raceFactor(setup, distKm, plain.tempC, plain.sec / distKm, vdot);
  return { sec: plain.sec * factor, tempC: setup.tempC ?? plain.tempC, factors, uncertaintyPct };
}

/** Il carico attuale espresso come piano, per confrontarlo con quello proposto. */
export function currentPlan(weeklyKm: number, weeklyQualityMin: number, longRunMin: number, tempC: number): WeeklyPlan {
  const sessions = weeklyQualityMin >= 12 ? Math.max(1, Math.round(weeklyQualityMin / 24)) : 0;
  return {
    km: Math.round(weeklyKm),
    qualitySessions: sessions,
    qualityMinutes: sessions ? Math.round(weeklyQualityMin / sessions) : 0,
    vo2Share: 0.4,
    longRunMinutes: Math.round(longRunMin),
    trainingTempC: tempC,
  };
}

/**
 * Il piano più leggero che porta all'obiettivo entro la data.
 *
 * Si cerca sul serio, provando le combinazioni in ordine di costo per l'atleta —
 * prima i chilometri, che sono la cosa che si può quasi sempre aggiungere, poi
 * le sedute di qualità, che costano recupero. Il primo piano che supera la
 * soglia di probabilità vince: è il minimo indispensabile, non il massimo
 * teorico, e questa è la differenza fra un consiglio e una lista dei desideri.
 */
export function solvePlan(
  model: PhysioModel, distM: number, targetSec: number, deadlineDays: number | null,
  easyPaceSec: number, from: WeeklyPlan, setup: RaceSetup, vdot: number, minProbability = 0.8,
): WeeklyPlan | null {
  const kmSteps = [from.km, from.km + 10, from.km + 20, from.km + 30, from.km + 45, from.km + 60]
    .map((k) => clamp(Math.round(k), 20, 140));
  const qualitySteps = [Math.max(1, from.qualitySessions), 2, 3];
  const longSteps = [Math.max(60, from.longRunMinutes), 90, 110, 130];

  let best: WeeklyPlan | null = null;
  for (const km of [...new Set(kmSteps)]) {
    for (const q of [...new Set(qualitySteps)]) {
      for (const lr of [...new Set(longSteps)]) {
        const plan: WeeklyPlan = {
          ...from, km, qualitySessions: q,
          qualityMinutes: Math.max(24, from.qualityMinutes || 26),
          longRunMinutes: lr,
        };
        const dose = planToDose(plan, easyPaceSec);
        if (deadlineDays != null) {
          const at = raceTimeAtDay(model, dose, distM, deadlineDays, setup, vdot);
          if (successProbability(at.sec, targetSec, deadlineDays) < minProbability) continue;
        } else if (!etaAtConfidence(model, dose, distM, targetSec, minProbability, setup, vdot)) {
          // senza scadenza basta che il piano ci arrivi con quella confidenza,
          // prima o poi: chiederlo alla data di crossing sarebbe impossibile
          continue;
        }
        // il carico più basso che basta: km prima di tutto, poi qualità
        if (!best || km + q * 8 + lr * 0.1 < best.km + best.qualitySessions * 8 + best.longRunMinutes * 0.1) {
          best = plan;
        }
      }
    }
  }
  return best;
}

export function planGoal(
  model: PhysioModel, distM: number, targetSec: number,
  opt: {
    deadlineDays: number | null; easyPaceSec: number;
    current: WeeklyPlan; plan: WeeklyPlan; setup: RaceSetup; vdot: number;
  },
): GoalPlanResult {
  const doseNow = planToDose(opt.current, opt.easyPaceSec);
  const dosePlan = planToDose(opt.plan, opt.easyPaceSec);
  const { setup, vdot } = opt;

  const etaNow = raceEta(model, doseNow, distM, targetSec, setup, vdot);
  const etaPlan = raceEta(model, dosePlan, distM, targetSec, setup, vdot);
  const etaSafe = etaAtConfidence(model, dosePlan, distM, targetSec, 0.8, setup, vdot);

  // senza una data di gara la probabilità si legge dove serve: alla data in cui
  // il piano diventa affidabile, non a quella in cui è una monetina
  const horizon = opt.deadlineDays ?? etaSafe?.days ?? etaPlan?.days ?? 365;
  const at = raceTimeAtDay(model, dosePlan, distM, horizon, setup, vdot);
  const probability = successProbability(at.sec, targetSec, horizon);
  const todayRace = raceTimeAtDay(model, dosePlan, distM, 0, setup, vdot);

  return {
    etaNow, etaPlan, etaSafe,
    atTarget: opt.deadlineDays != null ? { sec: at.sec, tempC: at.tempC } : null,
    todaySec: todayRace.sec,
    factors: todayRace.factors,
    probability,
    gapSec: Math.round(at.sec - targetSec),
    suggested: solvePlan(model, distM, targetSec, opt.deadlineDays, opt.easyPaceSec, opt.current, setup, vdot),
    blocker: etaPlan
      ? null
      : "Con questo piano, in queste condizioni, i sistemi si stabilizzano prima del tempo obiettivo: serve più carico, più tempo, o una giornata migliore.",
  };
}

// ── utilità di pagina ─────────────────────────────────────────────────────────
export const fmtSec = (sec: number) => fmtClock(sec);
export const fmtPaceSec = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec) % 60).padStart(2, "0")}`;
export const fmtDelta = (sec: number) => `${sec >= 0 ? "−" : "+"}${fmtClock(Math.abs(sec))}`;

export const CLASS_LABEL: Record<ShoeClass, string> = {
  superRacer: "Super scarpa da gara",
  superTrainer: "Super trainer",
  trainer: "Allenamento",
  flat: "Riferimento",
};
