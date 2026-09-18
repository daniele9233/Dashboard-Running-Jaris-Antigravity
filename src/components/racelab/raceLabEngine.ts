import type { Run } from "../../types/api";
import {
  clamp, dayIndex, dayToIso, fmtClock, gradeFactor, heatSlowdownFrac, humidityOf, paceToSec,
  predictSec, vdotFrom,
} from "../gamification/gamiCore";
import {
  adaptationCeiling, planToDose, timeAtDay, walkPlan,
  type PhysioModel, type SystemLevels, type WeeklyPlan,
} from "../gamification/physioEngine";
import {
  CAFFEINE_MAX_TABS, CAFFEINE_TAB_MG, CAFFEINE_UNCERTAINTY, NITRATE_UNCERTAINTY, NITRATE_WITH_CAFFEINE,
  PACK_GAIN_PCT, caffeineGainPct, nitrateGainPct, rpeMaxGainPct, shoeById, shoeGainPct,
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
 * rispetto alla calzatura abituale — e per la stessa ragione il taper, i
 * nitrati e la caffeina partono da "no", perché così sono state corse le prove
 * da cui il modello ha imparato.
 */
export interface RaceSetup {
  shoeId: string;
  /** La scarpa con cui hai corso le prove da cui il modello ha imparato. */
  baselineShoeId: string;
  taper: TaperKind;
  nitrate: boolean;
  /** Compresse di caffeina (Caffeine Tabs da 200 mg) un'ora prima del via. 0 = niente. */
  caffeineTabs: number;
  /** Peso dell'atleta: la caffeina si dosa in mg per chilo, non a compresse. */
  bodyKg: number;
  /** Temperatura della gara. Null = quella tipica del mese in cui cade. */
  tempC: number | null;
  pack: boolean;
}

export const defaultSetup = (baselineShoeId: string, bodyKg = 70): RaceSetup => ({
  shoeId: baselineShoeId, baselineShoeId, taper: "none", nitrate: false, caffeineTabs: 0, bodyKg,
  tempC: null, pack: false,
});

/** Milligrammi di caffeina di quella scelta, e quanti per chilo. */
export function caffeineDose(setup: Pick<RaceSetup, "caffeineTabs" | "bodyKg">): { mg: number; mgPerKg: number } {
  const tabs = clamp(Math.round(setup.caffeineTabs || 0), 0, CAFFEINE_MAX_TABS);
  const mg = tabs * CAFFEINE_TAB_MG;
  return { mg, mgPerKg: mg / clamp(setup.bodyKg || 70, 40, 150) };
}

const fmtMgKg = (v: number) => v.toFixed(1).replace(".", ",");

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

  const caffeine = caffeineDose(setup);
  if (setup.nitrate) {
    push("nitrate", "Nitrati (succo di barbabietola)",
      caffeine.mg > 0
        ? "Insieme alla caffeina ne conta metà: gli studi sulla combinazione non trovano la somma piena."
        : "Meno ossigeno per la stessa velocità: al tuo livello vale questo, e cala man mano che sali.",
      nitrateGainPct(vdot) * (caffeine.mg > 0 ? NITRATE_WITH_CAFFEINE : 1), NITRATE_UNCERTAINTY);
  }
  if (caffeine.mg > 0) {
    const tabs = caffeine.mg / CAFFEINE_TAB_MG;
    push("caffeine", `Caffeine Tabs · ${tabs === 1 ? "1 compressa" : `${tabs} compresse`} (${caffeine.mg} mg)`,
      tabs === 1
        ? `${fmtMgKg(caffeine.mgPerKg)} mg/kg un'ora prima del via: la dose con più prove. Il picco arriva in 45–60′ e copre la gara.`
        : `${fmtMgKg(caffeine.mgPerKg)} mg/kg: la seconda compressa aggiunge poco e raddoppia il rischio di stomaco e battiti alti.`,
      caffeineGainPct(caffeine.mgPerKg), CAFFEINE_UNCERTAINTY);
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
  ceiling?: number,
): void {
  const distKm = distM / 1000;
  walkPlan(model, dose, distM, days, (i, sec, dayTemp) => {
    const { factor } = raceFactor(setup, distKm, dayTemp, sec / distKm, vdot);
    return visit(i, sec * factor, setup.tempC ?? dayTemp);
  }, ceiling);
}

// ── L'OBIETTIVO ───────────────────────────────────────────────────────────────

/** Un punto della traiettoria: cosa faresti quel giorno, col piano e senza. */
export interface GoalCurvePoint {
  day: number;
  iso: string;
  /** Tempo previsto sotto il piano simulato, in quelle condizioni di gara. */
  planSec: number;
  /** Tempo previsto tenendo il carico di adesso: il confronto che dà senso al piano. */
  nowSec: number;
  /** Banda di incertezza del piano (±1 deviazione standard). */
  loSec: number;
  hiSec: number;
  /** Probabilità di stare sotto il tempo obiettivo quel giorno, col piano. */
  planProb: number;
  /** Probabilità tenendo il carico di adesso. */
  nowProb: number;
  /** Temperatura attesa: il perché delle gobbe estive. */
  tempC: number;
}

/** Quanto sposta una singola leva, a parità di tutto il resto. */
export interface Lever {
  id: string;
  label: string;
  detail: string;
  /** Secondi guadagnati alla data di riferimento (positivo = più veloce). */
  gainSec: number;
  /** Secondi guadagnati sei mesi dopo la data di riferimento: la leva lenta si vede la'. */
  gainSecLate: number;
  /** Giorni guadagnati sulla data in cui l'obiettivo diventa probabile. */
  daysEarlier: number | null;
  /** Punti di probabilità guadagnati alla data di riferimento. */
  probPoints: number;
  /** Si compra con l'allenamento (mesi) o la mattina della gara (una scelta). */
  kind: "forma" | "giornata";
}

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
  /** Probabilità di farcela alla data di riferimento. */
  probability: number;
  /** La stessa probabilità tenendo il carico di adesso: il valore del piano. */
  probabilityNow: number;
  /**
   * La data a cui si legge la probabilità, e perché.
   *
   * È il pezzo che prima mancava: senza data di gara la probabilità veniva letta
   * alla data in cui il piano stesso arrivava all'80%, quindi diceva sempre 80 e
   * i cursori del piano non muovevano niente. Ora l'ancora è indipendente dal
   * piano — la data della gara, o quella in cui il carico ATTUALE toccherebbe il
   * tempo — così cambiare carico cambia il numero, che è tutto il punto.
   */
  horizon: { days: number; iso: string; source: "gara" | "carico-attuale" | "convenzione" };
  /** Quanto manca, in secondi, alla data di riferimento. */
  gapSec: number | null;
  /** Il piano più leggero che porta all'obiettivo entro la data. */
  suggested: WeeklyPlan | null;
  /** Perché non ci si arriva, quando non ci si arriva. */
  blocker: string | null;
  /** Punti di VDOT al mese che quel carico rende possibili: il tetto di adattamento. */
  ceilingPerMonth: number;
  /** La traiettoria, per disegnarla. */
  curve: GoalCurvePoint[];
  /** Cosa sposta la data, leva per leva. */
  levers: Lever[];
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

/** Deviazione standard di una previsione a `days` giorni, in % del tempo: giornata + modello. */
export const predictionSdPct = (days: number) => Math.sqrt(RACE_DAY_SD_PCT ** 2 + modelSdPct(days) ** 2);

export function successProbability(predictedSec: number, targetSec: number, horizonDays: number): number {
  const sd = (predictedSec * predictionSdPct(horizonDays)) / 100;
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
  confidence: number, setup: RaceSetup, vdot: number, days = 540, ceiling?: number,
): { days: number; iso: string; tempC: number } | null {
  let hit: { days: number; iso: string; tempC: number } | null = null;
  walkRace(model, dose, distM, setup, vdot, days, (i, sec, temp) => {
    if (successProbability(sec, targetSec, i) >= confidence) {
      hit = { days: i, iso: dayToIso(model.today + i), tempC: Math.round(temp) };
      return true;
    }
  }, ceiling);
  return hit;
}

/** Il primo giorno in cui il piano, in quelle condizioni, tocca il tempo. */
export function raceEta(
  model: PhysioModel, dose: SystemLevels, distM: number, targetSec: number,
  setup: RaceSetup, vdot: number, days = 540, ceiling?: number,
): { days: number; iso: string; tempC: number } | null {
  let hit: { days: number; iso: string; tempC: number } | null = null;
  walkRace(model, dose, distM, setup, vdot, days, (i, sec, temp) => {
    if (sec <= targetSec) {
      hit = { days: i, iso: dayToIso(model.today + i), tempC: Math.round(temp) };
      return true;
    }
  }, ceiling);
  return hit;
}

/** Che tempo faresti fra `dayOffset` giorni, in quelle condizioni. */
export function raceTimeAtDay(
  model: PhysioModel, dose: SystemLevels, distM: number, dayOffset: number,
  setup: RaceSetup, vdot: number, ceiling?: number,
): { sec: number; tempC: number; factors: Factor[]; uncertaintyPct: number } {
  const plain = timeAtDay(model, dose, distM, dayOffset, ceiling);
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

/**
 * La traiettoria sotto due carichi, già convertita in tempi di gara.
 *
 * Il passo di campionamento segue la finestra: giorno per giorno quando si
 * guardano poche settimane (una gara vicina si legge al giorno, non alla
 * settimana), più rado sugli orizzonti lunghi. I `keyDays` — la gara, le due
 * date dell'obiettivo — ci sono sempre, così il grafico li legge esatti invece
 * di arrotondarli al campione più vicino.
 */
function goalCurve(
  model: PhysioModel, doseNow: SystemLevels, dosePlan: SystemLevels, distM: number,
  targetSec: number, setup: RaceSetup, vdot: number, days: number,
  ceilNow: number, ceilPlan: number, keyDays: number[] = [],
): GoalCurvePoint[] {
  const plan = new Map<number, { sec: number; tempC: number }>();
  const now = new Map<number, number>();
  const step = days <= 120 ? 1 : days <= 240 ? 2 : days <= 400 ? 7 : 14;
  const keys = new Set(keyDays.filter((d) => d > 0 && d <= days));
  const keep = (i: number) => i % step === 0 || i === days || keys.has(i);

  walkRace(model, doseNow, distM, setup, vdot, days, (i, sec) => {
    if (keep(i)) now.set(i, sec);
  }, ceilNow);
  walkRace(model, dosePlan, distM, setup, vdot, days, (i, sec, temp) => {
    if (keep(i)) plan.set(i, { sec, tempC: temp });
  }, ceilPlan);

  const out: GoalCurvePoint[] = [];
  const today = raceTimeAtDay(model, dosePlan, distM, 0, setup, vdot, ceilPlan);
  // anche oggi la banda non è zero: la variabilità della giornata c'è comunque,
  // ed è la stessa che entra nella probabilità di oggi
  const sd0 = (today.sec * predictionSdPct(0)) / 100;
  out.push({
    day: 0, iso: dayToIso(model.today), planSec: Math.round(today.sec), nowSec: Math.round(today.sec),
    loSec: Math.round(today.sec - sd0), hiSec: Math.round(today.sec + sd0),
    planProb: successProbability(today.sec, targetSec, 0),
    nowProb: successProbability(today.sec, targetSec, 0),
    tempC: Math.round(today.tempC),
  });

  for (const [i, p] of [...plan.entries()].sort((a, b) => a[0] - b[0])) {
    const sd = (p.sec * predictionSdPct(i)) / 100;
    const nowSec = now.get(i) ?? p.sec;
    out.push({
      day: i, iso: dayToIso(model.today + i),
      planSec: Math.round(p.sec), nowSec: Math.round(nowSec),
      loSec: Math.round(p.sec - sd), hiSec: Math.round(p.sec + sd),
      planProb: successProbability(p.sec, targetSec, i),
      nowProb: successProbability(nowSec, targetSec, i),
      tempC: Math.round(p.tempC),
    });
  }
  return out;
}

/**
 * Cosa sposta la data, una leva alla volta.
 *
 * Ogni riga è il modello rifatto girare cambiando una cosa sola: dieci
 * chilometri a settimana in più, una seduta di qualità, il lungo, le scarpe, il
 * taper, dieci gradi in meno. Serve perché "aumenta il carico" non è un
 * consiglio: sapere che i km valgono tre settimane e le scarpe trentadue
 * secondi, sì. Le leve di forma si comprano in mesi, quelle di giornata la
 * mattina della gara — ed è la distinzione che questa pagina esiste per fare.
 */
function goalLevers(
  model: PhysioModel, distM: number, targetSec: number, easyPaceSec: number,
  plan: WeeklyPlan, setup: RaceSetup, vdot: number, horizonDays: number,
  baseSec: number, baseLateSec: number, baseSafeDays: number | null, coolShoeId: string | null,
): Lever[] {
  const out: Lever[] = [];
  const add = (
    id: string, label: string, detail: string, kind: Lever["kind"],
    p: WeeklyPlan, s: RaceSetup,
  ) => {
    const dose = planToDose(p, easyPaceSec);
    const ceil = adaptationCeiling(p);
    const at = raceTimeAtDay(model, dose, distM, horizonDays, s, vdot, ceil);
    const safe = etaAtConfidence(model, dose, distM, targetSec, 0.8, s, vdot, 540, ceil);
    const gainSec = Math.round(baseSec - at.sec);
    // le leve di forma restano in tabella anche quando a questa data non pagano:
    // "zero adesso, un minuto fra sei mesi" e' un'informazione, non un vuoto
    const late = raceTimeAtDay(
      model, dose, distM, Math.min(540, horizonDays + 180), s, vdot, ceil);
    const gainSecLate = Math.round(baseLateSec - late.sec);
    if (Math.abs(gainSec) < 1 && Math.abs(gainSecLate) < 1) return;
    out.push({
      id, label, detail, kind, gainSec, gainSecLate,
      daysEarlier: safe && baseSafeDays != null ? baseSafeDays - safe.days : null,
      probPoints: Math.round(
        (successProbability(at.sec, targetSec, horizonDays)
          - successProbability(baseSec, targetSec, horizonDays)) * 100,
      ),
    });
  };

  add("km", "+10 km a settimana", "Il chilometraggio è la leva più lenta e la più affidabile.",
    "forma", { ...plan, km: clamp(plan.km + 10, 20, 160) }, setup);
  add("quality", "+1 seduta di qualità", "Costa recupero: va aggiunta dopo i chilometri, non prima.",
    "forma", { ...plan, qualitySessions: clamp(plan.qualitySessions + 1, 0, 4) }, setup);
  add("long", "+20′ di lungo", "Tenuta: pesa sulle distanze lunghe, quasi niente sui 5 km.",
    "forma", { ...plan, longRunMinutes: clamp(plan.longRunMinutes + 20, 40, 220) }, setup);
  if (coolShoeId && coolShoeId !== setup.shoeId) {
    add("shoe", "Scarpe da gara", "Si mette il giorno della gara e vale mesi di allenamento.",
      "giornata", plan, { ...setup, shoeId: coolShoeId });
  }
  if (setup.taper !== "full") {
    add("taper", "Taper pieno", "Dieci-quattordici giorni di scarico: la leva gratuita più grande.",
      "giornata", plan, { ...setup, taper: "full" });
  }
  if (!setup.nitrate) {
    add("nitrate", "Nitrati", "Succo di barbabietola nei giorni prima: piccolo, ma reale.",
      "giornata", plan, { ...setup, nitrate: true });
  }
  if (caffeineDose(setup).mg === 0) {
    add("caffeine", `Caffeine Tabs · ${CAFFEINE_TAB_MG} mg`, "Una compressa un'ora prima del via, se l'hai già provata in allenamento.",
      "giornata", plan, { ...setup, caffeineTabs: 1 });
  }
  if (!setup.pack) {
    add("pack", "In gara, non da solo", "Aria e ritmo tenuti da altri.",
      "giornata", plan, { ...setup, pack: true });
  }
  const coolTarget = setup.tempC != null ? Math.min(10, setup.tempC - 6) : 10;
  add("temp",
    setup.tempC != null
      ? `${Math.round(coolTarget)}°C invece di ${Math.round(setup.tempC)}°`
      : `${Math.round(coolTarget)}°C invece del clima del mese`,
    "Il fresco non si allena: si sceglie l'ora di partenza, o il mese.",
    "giornata", plan, { ...setup, tempC: coolTarget });

  return out.sort((a, b) => b.gainSec - a.gainSec);
}

export function planGoal(
  model: PhysioModel, distM: number, targetSec: number,
  opt: {
    deadlineDays: number | null; easyPaceSec: number;
    current: WeeklyPlan; plan: WeeklyPlan; setup: RaceSetup; vdot: number;
    /** La scarpa da gara più veloce che l'atleta ha in rastrelliera, per la leva. */
    fastestShoeId?: string | null;
    /** Quanti giorni disegnare nella traiettoria. */
    curveDays?: number;
  },
): GoalPlanResult {
  const doseNow = planToDose(opt.current, opt.easyPaceSec);
  const dosePlan = planToDose(opt.plan, opt.easyPaceSec);
  const { setup, vdot } = opt;
  /**
   * Il tetto di adattamento dipende dal carico, non e' una costante: con venti
   * chilometri a settimana non si sale come con settanta. Senza questo, ogni
   * piano sopra il minimo dava la stessa data e la stessa probabilita' -- i
   * cursori del piano sembravano scollegati, ed e' la segnalazione da cui e'
   * partita questa revisione.
   */
  const ceilNow = adaptationCeiling(opt.current);
  const ceilPlan = adaptationCeiling(opt.plan);

  const etaNow = raceEta(model, doseNow, distM, targetSec, setup, vdot, 540, ceilNow);
  const etaPlan = raceEta(model, dosePlan, distM, targetSec, setup, vdot, 540, ceilPlan);
  const etaSafe = etaAtConfidence(
    model, dosePlan, distM, targetSec, 0.8, setup, vdot, 540, ceilPlan);

  /**
   * L'ancora della probabilità deve essere INDIPENDENTE dal piano, altrimenti
   * spostare i cursori sposta anche il metro e il numero non si muove mai. In
   * ordine: la data della gara se c'è; se no il giorno in cui il carico attuale
   * toccherebbe il tempo (il confronto naturale: "e se invece mi allenassi
   * così?"); se il carico attuale non ci arriva mai, sei mesi per convenzione.
   */
  const horizonDays = opt.deadlineDays ?? etaNow?.days ?? 180;
  const horizonSource: GoalPlanResult["horizon"]["source"] =
    opt.deadlineDays != null ? "gara" : etaNow ? "carico-attuale" : "convenzione";
  const horizon = {
    days: horizonDays,
    iso: dayToIso(model.today + horizonDays),
    source: horizonSource,
  };

  const at = raceTimeAtDay(model, dosePlan, distM, horizonDays, setup, vdot, ceilPlan);
  const atNow = raceTimeAtDay(model, doseNow, distM, horizonDays, setup, vdot, ceilNow);
  const probability = successProbability(at.sec, targetSec, horizonDays);
  const probabilityNow = successProbability(atNow.sec, targetSec, horizonDays);
  const todayRace = raceTimeAtDay(model, dosePlan, distM, 0, setup, vdot, ceilPlan);
  const atLate = raceTimeAtDay(
    model, dosePlan, distM, Math.min(540, horizonDays + 180), setup, vdot, ceilPlan);

  /**
   * Quanto disegnare. Con una data di gara si guarda quella: fino a qualche
   * settimana dopo il via e basta, così una gara fra un mese non finisce
   * schiacciata nel primo sesto di un grafico da sei mesi. La finestra dipende
   * solo dalla data, non dal piano: muovere i cursori non deve spostare l'asse.
   */
  const curveDays = opt.curveDays != null
    ? clamp(opt.curveDays, 56, 540)
    : opt.deadlineDays != null
      ? clamp(Math.ceil(Math.max(opt.deadlineDays + 28, opt.deadlineDays * 1.6) / 7) * 7, 56, 540)
      : clamp(Math.max(180, Math.round(((etaSafe?.days ?? horizonDays) + 60) / 7) * 7), 90, 540);
  const keyDays = [horizonDays, etaPlan?.days, etaSafe?.days].filter((d): d is number => d != null);

  return {
    etaNow, etaPlan, etaSafe,
    atTarget: opt.deadlineDays != null ? { sec: at.sec, tempC: at.tempC } : null,
    todaySec: todayRace.sec,
    factors: todayRace.factors,
    probability,
    probabilityNow,
    horizon,
    gapSec: Math.round(at.sec - targetSec),
    suggested: solvePlan(model, distM, targetSec, opt.deadlineDays, opt.easyPaceSec, opt.current, setup, vdot),
    blocker: etaPlan
      ? null
      : "Con questo piano, in queste condizioni, i sistemi si stabilizzano prima del tempo obiettivo: serve più carico, più tempo, o una giornata migliore.",
    ceilingPerMonth: ceilPlan,
    curve: goalCurve(
      model, doseNow, dosePlan, distM, targetSec, setup, vdot, curveDays, ceilNow, ceilPlan, keyDays),
    levers: goalLevers(
      model, distM, targetSec, opt.easyPaceSec, opt.plan, setup, vdot, horizonDays,
      at.sec, atLate.sec, etaSafe?.days ?? null, opt.fastestShoeId ?? null,
    ),
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
