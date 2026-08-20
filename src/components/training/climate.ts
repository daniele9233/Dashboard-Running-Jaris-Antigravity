/**
 * L'ARIA
 * ════════════════════════════════════════════════════════════════════════════
 * Il caldo entra nel piano in tre punti diversi, e confonderli è il modo più
 * facile per scrivere un programma che sulla carta funziona e sul campo no.
 *
 *  1. IL RITMO DI OGGI. Una ripetuta a 4:00 il 26 agosto alle 18 non è la
 *     stessa seduta del 26 agosto alle 6. Il target va spostato, altrimenti la
 *     seduta si chiude "fallita" quando invece era impossibile.
 *  2. IL TEMPO DI GARA. Quanto costa il termometro il giorno della gara — ed è
 *     spesso la voce più grande di tutta la previsione, più grande di tre
 *     settimane di allenamento.
 *  3. IL CREDITO. Allenarsi al caldo espande il volume plasmatico, e quello
 *     resta quando rinfresca (Périard 2015, Lorenzo 2010).
 *
 * Qui stanno il primo e il secondo. Il terzo lo tiene il motore fisiologico.
 *
 * ── PERCHÉ TEMPERATURA + PUNTO DI RUGIADA ───────────────────────────────────
 * A 30 °C con l'aria secca il sudore evapora e il corpo si raffredda; a 30 °C
 * con il punto di rugiada a 22 il sudore cola e basta. L'indice è la somma dei
 * due, entrambi in °C: è la lettura usata da chi corre d'estate ed è coerente
 * con il meccanismo descritto in Périard 2021 (l'umidità pesa perché blocca
 * l'evaporazione, non perché scalda).
 */

import { heatSlowdownFrac } from "../gamification/gamiCore";
import { STUDIES, type StudyId } from "./studies";

/* ── PUNTO DI RUGIADA ────────────────────────────────────────────────────── */

/** Magnus-Tetens. Il Garmin dà l'umidità relativa; l'indice vuole il DP. */
export function dewPoint(tempC: number, humidityPct: number): number {
  const rh = Math.min(100, Math.max(1, humidityPct));
  const g = (17.62 * tempC) / (243.12 + tempC) + Math.log(rh / 100);
  return (243.12 * g) / (17.62 - g);
}

/** L'inversa: che umidità relativa corrisponde a questa coppia T / DP. */
export function humidityFromDewPoint(tempC: number, dpC: number): number {
  const e = (t: number) => 6.112 * Math.exp((17.62 * t) / (243.12 + t));
  return Math.min(100, Math.max(1, (e(dpC) / e(tempC)) * 100));
}

/* ── FASCE DELL'INDICE ───────────────────────────────────────────────────── */

export interface HeatBand {
  id: string;
  /** Estremo inferiore incluso. */
  min: number;
  max: number | null;
  label: string;
  example: string;
  color: string;
  /** Sopra questa fascia la seduta di qualità va spostata, non rallentata. */
  move?: boolean;
}

/**
 * Le fasce servono a NOMINARE l'aria, non a calcolarne il costo.
 *
 * Il costo lo dà una funzione sola — `heatSlowdownFrac` nel nucleo — la stessa
 * che usa la previsione di gara e il banco di prova. Averne due significava
 * che la stessa mattina di ottobre risultava "quasi neutra" nella tabella e
 * costava due minuti nella previsione: l'atleta se ne accorge subito, e ha
 * ragione lui.
 */
export const HEAT_BANDS: HeatBand[] = [
  { id: "b0", min: -99, max: 25, label: "fresca", example: "15° + DP 10°", color: "#22D3EE" },
  { id: "b1", min: 25, max: 31, label: "buona", example: "18° + DP 12°", color: "#A3E635" },
  { id: "b2", min: 31, max: 37, label: "si sente", example: "21° + DP 14°", color: "#C0FF00" },
  { id: "b3", min: 37, max: 42, label: "costa", example: "24° + DP 16°", color: "#F59E0B" },
  { id: "b4", min: 42, max: 48, label: "pesante", example: "27° + DP 18°", color: "#F97316" },
  { id: "b5", min: 48, max: 53, label: "ostile", example: "30° + DP 20°", color: "#EF4444" },
  { id: "b6", min: 53, max: 59, label: "proibitiva", example: "33° + DP 22°", color: "#EF4444" },
  { id: "b7", min: 59, max: null, label: "da spostare", example: "35° + DP 24°", color: "#B91C1C", move: true },
];

export const bandForIndex = (index: number): HeatBand =>
  HEAT_BANDS.find((b) => index >= b.min && (b.max === null || index < b.max)) ?? HEAT_BANDS[0];

export type HeatKind = "reps" | "tempo" | "long";

/**
 * La durata dello sforzo, tradotta in distanza equivalente.
 *
 * Il costo del caldo cresce con quanto a lungo resti là fuori: una ripetuta da
 * tre minuti finisce prima che il nucleo si scaldi davvero, un lungo da due ore
 * no. `heatSlowdownFrac` scala già sulla distanza, quindi basta dirle di che
 * sforzo si tratta: una serie di ripetute si comporta come un 5000, un
 * continuo come un 12 km, un lungo come una mezza.
 */
const KIND_DIST_KM: Record<HeatKind, number> = { reps: 5, tempo: 12, long: 21 };

/** Quanto costa quell'aria a quel tipo di seduta, in percentuale sul passo. */
export function heatPenaltyPct(tempC: number, humidity: number | null, kind: HeatKind): number {
  return heatSlowdownFrac(tempC, humidity, KIND_DIST_KM[kind]) * 100;
}

/**
 * Il ritmo del giorno. La banda è ±25% della penalità: il modello dice quanto
 * costa in media, non quanto costerà a te stamattina, e un target puntuale su
 * una stima è una precisione finta.
 */
export function heatAdjustedPace(
  kind: HeatKind, tempC: number, humidity: number | null, baseSec: number,
) {
  const pen = heatPenaltyPct(tempC, humidity, kind);
  const lo = pen * 0.75;
  const hi = pen * 1.25;
  return {
    from: baseSec * (1 + lo / 100),
    to: baseSec * (1 + hi / 100),
    mid: baseSec * (1 + pen / 100),
    penLo: lo, penHi: hi, pen,
  };
}

/* ── CLIMA DI ROMA ───────────────────────────────────────────────────────── */

/**
 * Medie mensili: temperatura media giornaliera e punto di rugiada medio.
 * Servono da rete di sicurezza — quando l'atleta ha corso abbastanza in un
 * mese, le sue temperature reali valgono di più di qualsiasi normale
 * climatica, perché chi esce alle sei di agosto non corre a 25 °C.
 */
export const ROME_MONTH_TEMP = [8.0, 8.8, 11.2, 14.0, 18.3, 22.3, 25.2, 25.3, 21.4, 17.2, 12.3, 9.2];
export const ROME_MONTH_DP = [4, 4, 5, 7, 11, 14, 16, 17, 15, 12, 9, 5];

/**
 * Quanto si scosta dalla media giornaliera, ora per ora. La curva è quella di
 * un clima mediterraneo: minimo poco prima dell'alba, massimo alle tre del
 * pomeriggio, e un'ora di differenza fra le 7 e le 9 vale più di due settimane
 * di allenamento sul risultato dei 5000.
 */
const HOUR_OFFSET = [
  -3.0, -3.4, -3.7, -4.0, -4.2, -4.4, -4.2, -3.4,
  -2.2, -0.8, 0.6, 1.9, 2.9, 3.7, 4.2, 4.3,
  3.9, 3.1, 2.0, 0.8, -0.3, -1.2, -1.9, -2.5,
];

export interface Climate {
  /** Temperatura media giornaliera per mese (0 = gennaio). */
  monthTempC: number[];
  monthDpC: number[];
}

export const ROME: Climate = { monthTempC: ROME_MONTH_TEMP, monthDpC: ROME_MONTH_DP };

/** Interpola fra i due mesi adiacenti: il 25 settembre non è il 5 settembre. */
function smoothMonthly(values: number[], iso: string): number {
  const d = new Date(`${iso}T12:00:00Z`);
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), m + 1, 0)).getUTCDate();
  // il valore mensile vale a metà mese; prima si guarda indietro, dopo avanti
  const f = (day - 15) / daysInMonth;
  const other = values[(m + (f >= 0 ? 1 : 11)) % 12];
  return values[m] + Math.abs(f) * (other - values[m]);
}

export interface Conditions {
  iso: string;
  hour: number;
  tempC: number;
  dpC: number;
  humidity: number;
  index: number;
  band: HeatBand;
}

/** Che aria trovi quel giorno a quell'ora. */
export function conditionsAt(iso: string, hour: number, climate: Climate = ROME): Conditions {
  const h = Math.min(23, Math.max(0, Math.round(hour)));
  const tempC = smoothMonthly(climate.monthTempC, iso) + HOUR_OFFSET[h];
  // il punto di rugiada è una massa d'aria, non un'ora: varia poco nella giornata
  const dpC = Math.min(tempC - 0.5, smoothMonthly(climate.monthDpC, iso));
  const index = tempC + dpC;
  return {
    iso, hour: h,
    tempC: Math.round(tempC * 10) / 10,
    dpC: Math.round(dpC * 10) / 10,
    humidity: Math.round(humidityFromDewPoint(tempC, dpC)),
    index: Math.round(index * 10) / 10,
    band: bandForIndex(index),
  };
}

/**
 * Il clima dell'atleta, ricavato dalle sue corse dove ce ne sono abbastanza.
 * Sotto le tre corse in un mese resta la normale climatica: due uscite non
 * fanno una statistica, e una delle due può essere stata in vacanza.
 *
 * ⚠ Le temperature registrate sono quelle dell'ORA in cui l'atleta corre, non
 * la media del giorno. Vanno de-orarizzate prima di finire nella tabella
 * mensile, altrimenti `conditionsAt` rimette l'offset una seconda volta e
 * agosto alle sei del mattino risulta più fresco del reale di quattro gradi.
 * Una corsa senza orario locale leggibile non contribuisce: meglio la normale
 * climatica di un dato che sposta il numero nella direzione sbagliata.
 */
export function climateFromRuns(
  runs: {
    date: string;
    start_date_local?: string | null;
    temperature?: number | null;
    humidity?: number | null;
    is_treadmill?: boolean;
  }[],
): Climate {
  const t: number[][] = Array.from({ length: 12 }, () => []);
  const dp: number[][] = Array.from({ length: 12 }, () => []);
  for (const r of runs) {
    if (r.is_treadmill || r.temperature == null || !r.date) continue;
    const m = +r.date.slice(5, 7) - 1;
    if (m < 0 || m > 11) continue;
    const hour = Number((r.start_date_local ?? "").slice(11, 13));
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
    const daily = r.temperature - HOUR_OFFSET[hour];
    t[m].push(daily);
    if (r.humidity != null) dp[m].push(dewPoint(r.temperature, r.humidity));
  }
  const med = (xs: number[]): number | null => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const i = s.length >> 1;
    return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
  };
  return {
    monthTempC: t.map((xs, i) => (xs.length >= 3 ? med(xs)! : ROME_MONTH_TEMP[i])),
    monthDpC: dp.map((xs, i) => (xs.length >= 3 ? med(xs)! : ROME_MONTH_DP[i])),
  };
}

/** Le fonti che reggono questo modulo. */
export const CLIMATE_STUDIES: StudyId[] = ["periard-2021", "ely-2007", "racinais-2015"];
export const climateStudyRefs = () => CLIMATE_STUDIES.map((id) => STUDIES[id]);
