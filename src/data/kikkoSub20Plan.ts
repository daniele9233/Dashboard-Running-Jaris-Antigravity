import type { Session } from "../types/api";

/**
 * kikkoSub20 — piano 5K su 12 settimane.
 *
 * ── DA DOVE VENGONO I RITMI ─────────────────────────────────────────────────
 * Da un VDOT, che è l'unico numero da toccare: da lì scendono ritmo gara,
 * ritmo 10K, soglia e lenti, e ogni ritmo viene poi corretto per l'aria del
 * giorno (indice T + DP). Il VDOT di partenza è ancorato alla prestazione
 * reale sui 5 km, non alle ripetute — vedi KIKKO_VDOT_START.
 *
 * ── STRUTTURA ───────────────────────────────────────────────────────────────
 *  · QUATTRO uscite: UNA di qualità + tre in scioltezza.
 *  · Tre blocchi da "3 settimane di carico + 1 di scarico":
 *      34 → 35 → 36 → 27 · 38 → 40 → 41 → 30 · 43 → 44 → 45 → 33 (gara)
 *  · Il martedì ALTERNA soglia e ripetute, una settimana ciascuna:
 *      soglia 5,5 → rip 6×600 → soglia 6 → rip 5×600 → soglia 6,5 → rip 7×600
 *      → soglia 7 → rip 5×800 → soglia 7,5 → rip 8×800 → soglia 8 → taper.
 *    La soglia cresce di mezzo km alla volta: è quella che regge il ritmo
 *    gara, le ripetute ci mettono sopra la velocità.
 *
 *   Martedì  → QUALITÀ · soglia o ripetute     (tempo arancio / intervals rosso)
 *   Giovedì  → lenta                             (recovery · grigio)
 *   Sabato   → lenta                             (recovery · grigio)
 *   Domenica → lungo lento                       (long · verde)
 *
 * Perché una sola qualità: su quattro uscite, due sedute dure lasciavano due
 * soli giorni per assorbirle. Il lavoro che sposta il 5K arrivava sempre a
 * gambe cariche, e il volume che lo sostiene non c'era.
 *
 * ── I RECUPERI ──────────────────────────────────────────────────────────────
 * Sugli intervalli il recupero parte vicino a 1:1 e si accorcia dentro il
 * blocco (Daniels: sul lavoro a ritmo intervallo il recupero non deve superare
 * la durata della ripetuta). Si riazzera quando la ripetuta passa da 600 a
 * 800 m, e si allunga di proposito nelle settimane di scarico e nel taper.
 *
 * Sui 3×2 km il recupero non è un dettaglio, è parte della prescrizione: con
 * 3:30 (~40% del lavoro) sei recuperato e tieni il ritmo 10K, con 1:45 (~20%)
 * riparti carico e il ritmo giusto è il T-pace. Il codice interpola invece di
 * inchiodare una costante — vedi repPaceForRecovery.
 */

export const KIKKO_SUB20_META = {
  weeks: 12,
  phase: "kikkoSub20",
  goalRace: "5K",
  goalTime: "19:33",
  runsPerWeek: 4,
  startDate: "2026-07-27", // lunedì di riferimento della settimana 1
};

/* ── VDOT ───────────────────────────────────────────────────────────────────*/

/**
 * Ancorato a DUE prestazioni massimali, non a una stima.
 *
 * 1) 17/06/2026 · 5,02 km in 21:04 · 23°C · UR 60%
 *    DP 14,8° → indice T+DP 37,8 (fascia 37-42, penalità 2,5-4% sul continuo).
 *    21:04 tal quale vale VDOT 47,1; al fresco diventa ~20:20, cioè 48,9.
 *
 * 2) Luglio 2026 · 4×1000 a 3:55 di media · rec 3′ camminando · 26,1°C · UR 70%
 *    DP 20,2° → indice T+DP 46,3 (fascia 42-48, penalità 3-4,5% sulle ripetute).
 *    3:55 al fresco vale ~3:46/km. Ma tre minuti di CAMMINATA sono un recupero
 *    generoso: un lavoro dosato per la gara si chiude con più riserva, quindi
 *    si sconta un altro 2,5% e resta un I-pace reale di ~3:51/km → VDOT ~50.
 *
 * Le due prove dicono 48,9 (giugno, continuo) e ~50 (luglio, frazionato). Il
 * frazionato promette sempre più di quanto la gara mantenga, ma è più recente
 * e il lavoro in mezzo c'è stato: 49,0 è il punto onesto fra i due.
 *
 * Il backend ne calcola 47,7 sulle stesse corse: legge male le sedute di
 * ripetute, perché gli split al km mescolano prova e recupero. Dove i due
 * numeri divergono comanda la prestazione misurata, non la media pesata.
 *
 * ⚠ Dopo ogni test (3 km a tutta ogni 3-4 settimane) riscrivi KIKKO_WEEK_VDOT
 * da lì in avanti: è l'unico posto da toccare perché tutto il piano si
 * ricalcoli.
 */
export const KIKKO_VDOT_START = 49.0;
/** 19:33 sui 5K: +2,1 punti in 12 settimane. La sub-20 cade già a metà piano. */
export const KIKKO_VDOT_GOAL = 51.1;

/**
 * VDOT atteso settimana per settimana. Nelle settimane di scarico non sale:
 * l'adattamento arriva dopo il carico, non durante.
 */
export const KIKKO_WEEK_VDOT: number[] = [
  49.0, 49.2, 49.4, 49.4,   // blocco 1 + scarico
  49.7, 50.0, 50.2, 50.2,   // blocco 2 + scarico  → qui cade la sub-20
  50.5, 50.8, 51.1, 51.1,   // blocco 3 + gara
];

/**
 * Tabelle Daniels, secondi/km, per VDOT intero.
 *   race = ritmo gara 5K · k10 = ritmo 10K · thr = T-pace (soglia)
 * Controprova sul valore che l'atleta conosce: VDOT 50 → soglia 4:15 ✓,
 * gara 5K 19:57 ✓.
 */
const VDOT_TABLE: Record<number, { race: number; k10: number; thr: number }> = {
  46: { race: 257, k10: 267, thr: 273 },
  47: { race: 252, k10: 262, thr: 269 },
  48: { race: 248, k10: 257, thr: 264 },
  49: { race: 244, k10: 253, thr: 260 },
  50: { race: 239, k10: 248, thr: 255 },
  51: { race: 235, k10: 244, thr: 251 },
  52: { race: 231, k10: 240, thr: 247 },
  53: { race: 228, k10: 236, thr: 244 },
  54: { race: 224, k10: 232, thr: 240 },
  55: { race: 220, k10: 229, thr: 237 },
  56: { race: 217, k10: 226, thr: 233 },
};

/** I ritmi base di un VDOT, in secondi/km. Interpola fra i valori interi. */
export interface Bases {
  vdot: number;
  /** Ritmo gara 5K: è il ritmo degli intervalli. */
  race: number;
  /** Ritmo 10K: il ritmo dei 2 km quando il recupero è pieno. */
  k10: number;
  /** T-pace: soglia continua, e i 2 km quando il recupero è corto. */
  thr: number;
  easy: number;
  slow: number;
}

export function basesFor(vdot: number): Bases {
  const v = Math.min(56, Math.max(46, vdot));
  const lo = Math.floor(v);
  const hi = Math.min(56, lo + 1);
  const f = v - lo;
  const mix = (k: "race" | "k10" | "thr") =>
    VDOT_TABLE[lo][k] + (VDOT_TABLE[hi][k] - VDOT_TABLE[lo][k]) * f;
  const thr = mix("thr");
  return {
    vdot: v,
    race: mix("race"),
    k10: mix("k10"),
    thr,
    // I lenti seguono la soglia con uno scarto fisso: si allineano da soli
    // quando il motore migliora, senza diventare mai una seduta.
    easy: thr + 85,
    slow: thr + 75,
  };
}

/* ── INDICE T + DP ──────────────────────────────────────────────────────────
 * Il caldo non si misura con la sola temperatura: a parità di gradi l'aria
 * umida non lascia evaporare il sudore e il corpo non si raffredda. L'indice
 * è la SOMMA di temperatura e punto di rugiada, entrambi in °C — il Garmin dà
 * il DP nei dati meteo della sessione.
 *
 * La penalità è una forbice, non un numero secco: il bordo basso della fascia
 * costa meno del bordo alto. Più l'impegno è continuo, più il caldo pesa: le
 * ripetute brevi lasciano smaltire calore nella pausa, la soglia no.
 */
export type HeatKind = "reps" | "long" | "tempo";

export interface HeatBand {
  id: string;
  /** Estremo inferiore incluso dell'indice T + DP. */
  min: number;
  /** Estremo superiore escluso; null sull'ultima fascia. */
  max: number | null;
  /** "26-37", "> 59", … */
  label: string;
  /**
   * Temperatura tipica a Roma che cade in questa fascia. È solo un'etichetta
   * di lettura: la riga giusta la sceglie l'indice T + DP, non i gradi.
   */
  example: string;
  /** Penalità % [min, max] sul ritmo, per tipo di seduta. */
  pen: Record<HeatKind, [number, number]>;
  /** Oltre l'indice 59 la seduta non si fa: si sposta all'alba o si rimanda. */
  skip?: boolean;
}

/**
 * Le temperatura d'esempio sono la metà alta di ogni fascia, con il punto di
 * rugiada che le accompagna a Roma:
 *   15°+DP 10° · 20°+DP 14° · 24°+DP 17° · 28°+DP 18° · 31°+DP 19° ·
 *   34°+DP 20° · 37°+DP 22°
 * In tabella si mostra solo la temperatura, ma la fascia la decide la somma.
 */
export const KIKKO_SUB20_HEAT_BANDS: HeatBand[] = [
  // Sotto 26 l'aria non è mai il limite: sugli intervalli si può anche
  // scendere di un paio di secondi rispetto alla base.
  { id: "b0", min: -Infinity, max: 26, label: "< 26",  example: "15°",
    pen: { reps: [-0.8, 0],  long: [0, 0],     tempo: [0, 0]     } },
  { id: "b1", min: 26, max: 37, label: "26-37", example: "20°",
    pen: { reps: [0.5, 1.5], long: [0.5, 2],   tempo: [0.5, 2]   } },
  { id: "b2", min: 37, max: 42, label: "37-42", example: "24°",
    pen: { reps: [2, 3],     long: [2.5, 3.5], tempo: [2.5, 4]   } },
  { id: "b3", min: 42, max: 48, label: "42-48", example: "28°",
    pen: { reps: [3, 4.5],   long: [3.5, 5],   tempo: [4, 6]     } },
  { id: "b4", min: 48, max: 53, label: "48-53", example: "31°",
    pen: { reps: [4.5, 6],   long: [5, 7],     tempo: [6, 8]     } },
  { id: "b5", min: 53, max: 59, label: "53-59", example: "34°",
    pen: { reps: [6, 8],     long: [7, 9],     tempo: [8, 10]    } },
  { id: "b6", min: 59, max: null, label: "> 59", example: "37°", skip: true,
    pen: { reps: [8, 12],    long: [8, 12],    tempo: [8, 12]    } },
];

/**
 * Temperatura mese per mese, mediana delle SUE corse a Roma (485 uscite con
 * dato meteo, all'ora in cui si allena davvero). Meglio di una media climatica
 * generica: chi corre alle 8 del mattino non vive i 33°C del pomeriggio.
 */
const ROME_MONTH_C = [5, 7, 10, 12, 15, 22, 21, 23, 16, 13, 9, 6];

/**
 * Punto di rugiada atteso a Roma, mese per mese, alla stessa ora.
 * Serve solo finché il dato vero non arriva dal Garmin: quando c'è il DP
 * misurato, l'indice va ricalcolato con quello.
 */
const ROME_MONTH_DP = [3, 3, 5, 7, 10, 14, 16, 17, 14, 11, 8, 4];

const monthIndex = (iso: string): number =>
  Math.min(11, Math.max(0, Number(iso.slice(5, 7)) - 1));

export function romeTempForDate(iso: string): number {
  return ROME_MONTH_C[monthIndex(iso)] ?? 18;
}

export function romeDewPointForDate(iso: string): number {
  return ROME_MONTH_DP[monthIndex(iso)] ?? 12;
}

/** Indice T + DP atteso quel giorno. */
export function romeHeatIndexForDate(iso: string): number {
  return romeTempForDate(iso) + romeDewPointForDate(iso);
}

export function heatBandForIndex(index: number): HeatBand {
  return (
    KIKKO_SUB20_HEAT_BANDS.find((b) => index >= b.min && (b.max === null || index < b.max)) ??
    KIKKO_SUB20_HEAT_BANDS[0]
  );
}

/** Fascia attesa nel giorno della seduta. */
export function heatBandForDate(iso: string): HeatBand {
  return heatBandForIndex(romeHeatIndexForDate(iso));
}

/**
 * Punto di rugiada da temperatura e umidità relativa (Magnus).
 * Il Garmin dà l'umidità; l'indice vuole il DP.
 */
export function dewPoint(tempC: number, humidityPct: number): number {
  const rh = Math.min(100, Math.max(1, humidityPct));
  const a = Math.log(rh / 100) + (17.62 * tempC) / (243.12 + tempC);
  return (243.12 * a) / (17.62 - a);
}

/* ── FORMATTAZIONE ──────────────────────────────────────────────────────────*/

const pad = (n: number) => String(n).padStart(2, "0");

export const paceToSec = (p: string): number => {
  const [m, s] = p.split(":").map(Number);
  return m * 60 + s;
};
export const secToPace = (sec: number): string => {
  const total = Math.round(sec);           // arrotonda il totale: mai ":60"
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
};

/** "4,58" — i decimali si scrivono all'italiana. */
export const fmtNum = (n: number, digits = 2): string =>
  n.toFixed(digits).replace(".", ",");

/** "8,0 km" → "8 km": sui numeri tondi la coda non serve. */
export const trimZero = (s: string): string => s.replace(/,0$/, "");

const fmtPct = (v: number): string => (Number.isInteger(v) ? String(v) : fmtNum(v, 1));

/* ── RITMO DEL GIORNO ───────────────────────────────────────────────────────*/

/** Il ritmo di una seduta corretto per l'aria: forbice della fascia + centro. */
export interface HeatPace {
  band: HeatBand;
  kind: HeatKind;
  /** Base al fresco, secondi/km. */
  baseSec: number;
  base: string;
  /** Estremo veloce e lento della forbice, in secondi/km (non arrotondati). */
  fastSec: number;
  slowSec: number;
  /** Centro della forbice: è questo il target scritto sulla seduta. */
  midSec: number;
  mid: string;
  /** "4:05-4:07" (o "4:00" quando la fascia non penalizza). */
  range: string;
  /** "2-3%" · "0%" */
  penLabel: string;
}

export function heatPace(kind: HeatKind, band: HeatBand, baseSec: number): HeatPace {
  const [lo, hi] = band.pen[kind];
  const fastSec = baseSec * (1 + lo / 100);
  const slowSec = baseSec * (1 + hi / 100);
  const midSec = (fastSec + slowSec) / 2;
  const fast = secToPace(fastSec);
  const slow = secToPace(slowSec);
  return {
    band, kind, baseSec, base: secToPace(baseSec),
    fastSec, slowSec, midSec,
    mid: secToPace(midSec),
    range: fast === slow ? fast : `${fast}-${slow}`,
    // sotto l'indice 26 la penalità è nulla per definizione: la forbice
    // negativa serve solo a dire che al fresco si può spingere un filo.
    penLabel: hi <= 0 ? "0%" : lo === hi ? `${fmtPct(hi)}%` : `${fmtPct(Math.max(0, lo))}-${fmtPct(hi)}%`,
  };
}

/**
 * Il ritmo dei 2 km in funzione del recupero.
 *
 * Con 3:30 di recupero (~41% del lavoro) riparti recuperato e il ritmo giusto
 * è quello dei 10K. Con 1:45 (~21%) sei al rapporto dei cruise interval di
 * Daniels e il ritmo giusto è il T-pace. In mezzo si interpola: il recupero
 * che si accorcia è la progressione, e il cronometro deve saperlo.
 */
export function repPaceForRecovery(recSec: number, b: Bases): number {
  const workSec = 2 * b.thr;                     // riferimento stabile
  const ratio = recSec / workSec;
  const blend = Math.min(1, Math.max(0, (ratio - 0.21) / (0.41 - 0.21)));
  return b.thr - blend * (b.thr - b.k10);
}

/** I ritmi del giorno: base della settimana + aria attesa. */
export interface Paces {
  band: HeatBand;
  index: number;
  tempC: number;
  dpC: number;
  bases: Bases;
  easy: string;
  slow: string;
}

export function pacesFor(iso: string, vdot: number): Paces {
  const tempC = romeTempForDate(iso);
  const dpC = romeDewPointForDate(iso);
  const index = tempC + dpC;
  const band = heatBandForIndex(index);
  const bases = basesFor(vdot);
  // Sui lenti il caldo pesa, ma la metà: si corre a sensazione, non a target.
  const adj = 1 + band.pen.tempo[1] / 2 / 100;
  return {
    band, index, tempC, dpC, bases,
    easy: secToPace(bases.easy * adj),
    slow: secToPace(bases.slow * adj),
  };
}

/* ── CALENDARIO ─────────────────────────────────────────────────────────────*/

const IT_DAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function itDayName(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return IT_DAYS[new Date(y, m - 1, d).getDay()];
}

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/**
 * Riporta una data qualsiasi al lunedì della sua settimana.
 *
 * Il piano è ancorato al lunedì: le uscite cadono martedì, giovedì, sabato e
 * domenica. Se la data di partenza è un altro giorno, l'intero calendario
 * slitta e le qualità finiscono su giorni sbagliati.
 */
export function kikkoSub20NormalizeStart(iso?: string | null): string {
  const base = iso && iso.length === 10 ? iso : KIKKO_SUB20_META.startDate;
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return KIKKO_SUB20_META.startDate;
  const dow = dt.getDay();                    // 0 = domenica
  const backToMonday = dow === 0 ? 6 : dow - 1;
  return addDays(base, -backToMonday);
}

/* ── LE SEDUTE ──────────────────────────────────────────────────────────────
 *
 * Da qui in giù i pezzi sono esportati perché li usa anche kikkoSub1:34:35.
 * Non è per comodità: il modello del caldo, i ritmi e la costruzione del
 * calendario devono essere GLI STESSI per i due piani. Due copie divergono al
 * primo ritocco, e l'atleta si ritrova la stessa domenica con due target.
 *
 * Le descrizioni stanno in una riga: struttura e numeri, niente spiegazioni.
 * Il "perché" del ritmo del giorno sta nella tabella T + DP accanto alla
 * seduta, non dentro il testo.
 */

export type Cell = {
  title: string;
  dist: number;
  pace: string | null;
  desc: string;
  /** Tipo di ritmo e base al fresco: servono alla tabella T + DP nella UI. */
  kind?: HeatKind;
  baseSec?: number;
};
export type CellFn = (p: Paces) => Cell;

/**
 * Le quattro uscite, per offset dal lunedì.
 *
 * UNA sola seduta di qualità a settimana. Con due (ripetute il martedì +
 * soglia il giovedì) su quattro uscite totali metà della settimana era dura:
 * niente spazio per assorbire, e il lavoro vero — quello che sposta il 5K —
 * arrivava sempre con le gambe già cariche. Ora il martedì è l'unico giorno
 * intenso e il resto serve a reggerlo.
 */
export const SLOTS = [
  { offset: 1, type: "intervals" }, // martedì  · L'UNICA QUALITÀ
  { offset: 3, type: "recovery" },  // giovedì  · lenta
  { offset: 5, type: "recovery" },  // sabato   · lenta
  { offset: 6, type: "long" },      // domenica · lungo
] as const;

export type WeekDef = {
  /** Lunedì di riferimento. */
  mon: string;
  /** Volume atteso, verificato dai test contro la somma reale delle sedute. */
  totalKm: number;
  /**
   * Settimana di scarico. Sta nel dato e non nella posizione: da quando lo
   * scarico si è spostato, "ogni quarta settimana" ha smesso di essere vero.
   */
  deload?: true;
  /** [qualità 1, qualità 2, lenta, lungo] */
  cells: [CellFn, CellFn, CellFn, CellFn];
};

export const easy = (dist: number): CellFn => (p) => ({
  title: `Lenta ${dist} km`,
  dist,
  pace: p.easy,
  desc: `${dist} km a ${p.easy}-${secToPace(paceToSec(p.easy) + 15)}. Conversazione piena.`,
});

export const longRun = (dist: number): CellFn => (p) => ({
  title: `Lungo ${dist} km`,
  dist,
  pace: p.slow,
  desc: `${dist} km a ${p.slow}-${secToPace(paceToSec(p.slow) + 15)}. Base aerobica: piano davvero.`,
});

/** Qualità 1 — intervalli brevi a ritmo gara. */
export const reps = (n: number, meters: number, dist: number, rec: string, note = ""): CellFn => (p) => {
  const hp = heatPace("reps", p.band, p.bases.race);
  const workSec = (meters / 1000) * hp.midSec;
  const ratio = (paceToSec(rec) / workSec).toFixed(2);
  return {
    title: `${n}×${meters} m @ ${hp.mid} · rec ${rec}`,
    dist,
    pace: hp.mid,
    kind: "reps",
    baseSec: p.bases.race,
    desc:
      `Risc. 2 km + 3 allunghi, def. 1,5 km. Ripetuta ~${secToPace(workSec)}, rec ${rec} di jog ` +
      `(1:${ratio}). ${trimZero(fmtNum((n * meters) / 1000, 1))} km a ritmo gara, passo costante.` +
      `${note ? " " + note : ""}`,
  };
};

/** Qualità 2 — resistenza sui 2 km, settimane dispari. */
export const longReps = (rec: string, dist: number, note = ""): CellFn => (p) => {
  const baseSec = repPaceForRecovery(paceToSec(rec), p.bases);
  const hp = heatPace("long", p.band, baseSec);
  const workSec = 2 * hp.midSec;
  const ratio = (paceToSec(rec) / workSec).toFixed(2);
  return {
    title: `3×2 km @ ${hp.mid} · rec ${rec}`,
    dist,
    pace: hp.mid,
    kind: "long",
    baseSec,
    desc:
      `Risc. 2 km, def. 1,5 km. Serie da ~${secToPace(workSec)}, rec ${rec} (1:${ratio}). ` +
      `Riprendere il ritmo a gambe cariche.${note ? " " + note : ""}`,
  };
};

/** Qualità 2 — soglia, settimane pari. */
const tempo = (minutes: number, dist: number, note = ""): CellFn => (p) => {
  const hp = heatPace("tempo", p.band, p.bases.thr);
  return {
    title: `Soglia ${minutes}′ @ ${hp.mid}`,
    dist,
    pace: hp.mid,
    kind: "tempo",
    baseSec: p.bases.thr,
    desc:
      `Risc. 2 km + allunghi, def. 1,5 km. ${minutes}′ continui senza pause: ` +
      `~${fmtNum((minutes * 60) / hp.midSec)} km.${note ? " " + note : ""}`,
  };
};

/**
 * Soglia misurata in CHILOMETRI, non in minuti.
 *
 * "30′ continui" cambia lunghezza col passo del giorno; "6 km continui" no, e
 * la progressione si legge da sola: 5,5 → 6 → 6,5 → 7 → 7,5 → 8.
 */
export const soglia = (workKm: number, dist: number, note = ""): CellFn => (p) => {
  const hp = heatPace("tempo", p.band, p.bases.thr);
  const minutes = (workKm * hp.midSec) / 60;
  return {
    title: `Soglia ${trimZero(fmtNum(workKm, 1))} km @ ${hp.mid}`,
    dist,
    pace: hp.mid,
    kind: "tempo",
    baseSec: p.bases.thr,
    desc:
      `Risc. 2 km + allunghi, def. 1,5 km. ${trimZero(fmtNum(workKm, 1))} km continui senza ` +
      `pause: ~${Math.round(minutes)}′ allo sforzo che reggeresti quasi un'ora.` +
      `${note ? " " + note : ""}`,
  };
};

/**
 * Blocchi di carico con lo scarico programmato. Il volume non sale
 * all'infinito come prima (32 → 66 era una curva che nessuno regge su quattro
 * uscite): ogni blocco cresce di poco, scarica, e riparte sopra il precedente.
 *
 *   blocco 1 · 34 → 35 → 36 → 36 → 28
 *   blocco 2 · 39 → 41 → 30
 *   blocco 3 · 43 → 44 → 45 → 33 (gara)
 *
 * ── PERCHÉ IL PRIMO BLOCCO HA QUATTRO SETTIMANE E NON TRE ───────────────────
 * Il 17 agosto era in origine lo scarico a 27 km. Sul campo è andata
 * diversamente: quella settimana è stata corsa a pieno carico — 5×1000 al
 * martedì con 32 gradi — e la settimana prima si era fermata a 30 km per una
 * seduta saltata. Lo scarico serviva lì, non qui.
 *
 * Quindi il 17 resta di carico a 36 km e lo scarico si sposta al 24. Il conto
 * torna: la progressione fra settimane di carico resta sotto il 10%, ogni
 * blocco chiude con un taglio fra il 20 e il 30%, e il totale del piano cambia
 * di due chilometri su 446. Le settimane di scarico sono dichiarate nel dato,
 * non dedotte dalla posizione, perché una volta che si spostano contarle a
 * gruppi di quattro non funziona più.
 */
const WEEKS: WeekDef[] = [
  // ═══ BLOCCO 1 · 34 → 35 → 36 → 36 → 28 ════════════════════════════════════
  {
    mon: "2026-07-27", totalKm: 34,
    cells: [soglia(5.5, 9, "Si apre con la soglia: è il motore che regge il ritmo gara."), easy(7), easy(7), longRun(11)],
  },
  {
    mon: "2026-08-03", totalKm: 35,
    cells: [reps(6, 600, 9, "2:20", "Prima seduta di ripetute: deve finire con due in tasca."), easy(7), easy(8), longRun(11)],
  },
  {
    mon: "2026-08-10", totalKm: 36,
    cells: [soglia(6, 10), easy(7), easy(8), longRun(11)],
  },
  {
    // Corsa davvero: 5×1000 con 32 gradi il 18, lenta da 8 il 20. Restano
    // sabato e domenica, e sono i 20 km che mancano ai 36.
    mon: "2026-08-17", totalKm: 36,
    cells: [
      reps(5, 1000, 8, "2:30", "Da 600 a 1000: stesso ritmo, il doppio da reggere."),
      easy(8), easy(8), longRun(12),
    ],
  },
  {
    mon: "2026-08-24", totalKm: 28, deload: true,
    cells: [reps(5, 600, 8, "2:30", "Scarico: meno ripetute, stesso ritmo."), easy(6), easy(6), longRun(8)],
  },

  // ═══ BLOCCO 2 · 39 → 41 → 30 ══════════════════════════════════════════════
  {
    mon: "2026-08-31", totalKm: 39,
    cells: [soglia(6.5, 10), easy(8), easy(8), longRun(13)],
  },
  {
    mon: "2026-09-07", totalKm: 41,
    cells: [reps(7, 600, 11, "2:10"), easy(8), easy(9), longRun(13)],
  },
  {
    mon: "2026-09-14", totalKm: 30, deload: true,
    cells: [reps(5, 800, 8, "3:00", "Scarico: la ripetuta si allunga, il numero scende."), easy(7), easy(7), longRun(8)],
  },

  // ═══ BLOCCO 3 · 43 → 44 → 45 → 33 (gara) ══════════════════════════════════
  {
    mon: "2026-09-21", totalKm: 43,
    cells: [soglia(7, 11), easy(9), easy(9), longRun(14)],
  },
  {
    mon: "2026-09-28", totalKm: 44,
    cells: [reps(8, 800, 12, "2:20", "Seduta chiave: se il passo scivola, chiudi a 6."), easy(9), easy(9), longRun(14)],
  },
  {
    mon: "2026-10-05", totalKm: 45,
    cells: [soglia(7.5, 12, "L'ultima soglia lunga: da qui si scarica verso la gara."), easy(9), easy(10), longRun(14)],
  },

  // ═══ SETTIMANA 12 · TAPER + GARA ══════════════════════════════════════════
  {
    mon: "2026-10-12", totalKm: 33, deload: true,
    cells: [
      reps(5, 800, 9, "3:15", "Taper: metà ripetute, stesso ritmo, recupero più lungo."),
      easy(8),
      (p) => ({
        title: "Sciolto 5 km + 4 allunghi",
        dist: 5,
        pace: p.easy,
        desc: "5 km sciolti + 4 allunghi da 80 m. Controlla temperatura e DP di domani.",
      }),
      (p) => {
        const hp = heatPace("reps", p.band, p.bases.race);
        return {
          title: `🏁 GARA 5K · ${KIKKO_SUB20_META.goalTime}`,
          dist: 11,
          pace: hp.mid,
          kind: "reps" as HeatKind,
          baseSec: p.bases.race,
          desc:
            `Risc. 15′ + 4 allunghi (i 7 km li comprendono). Primo km ${secToPace(hp.midSec + 2)}, ` +
            `poi ${hp.mid}, dal 4° svuota. Previsione con l'aria attesa: ${secToPace(hp.midSec * 5)}.`,
        };
      },
    ],
  },
];

/* ── COSTRUZIONE ────────────────────────────────────────────────────────────*/

export function mk(date: string, type: string, cell: CellFn, vdot: number): Session {
  // La seduta si scrive sul VDOT di quella settimana e sull'aria attesa QUEL
  // giorno: le ripetute di agosto e quelle di ottobre non possono avere lo
  // stesso target.
  const c = cell(pacesFor(date, vdot));
  return {
    day: itDayName(date),
    date,
    // Il martedì alterna soglia e ripetute: il colore lo decide la seduta, non
    // lo slot, altrimenti in calendario una soglia sembrerebbe una ripetuta.
    type: c.kind === "tempo" ? "tempo" : type,
    title: c.title,
    description: c.desc,
    target_distance_km: c.dist,
    target_pace: c.pace,
    target_duration_min: null,
    completed: false,
    run_id: null,
  };
}

export const KIKKO_SUB20_DEFAULT_START = KIKKO_SUB20_META.startDate;

/** Giorni fra il lunedì della settimana 1 e la gara: 9 settimane + domenica. */
const KIKKO_RACE_OFFSET_DAYS = (KIKKO_SUB20_META.weeks - 1) * 7 + 6;

/** Ricostruisce il piano a partire dal lunedì scelto (la data viene normalizzata). */
export function buildKikkoSub20Sessions(startDate?: string | null): Session[] {
  const start = kikkoSub20NormalizeStart(startDate);
  const delta = daysBetween(KIKKO_SUB20_DEFAULT_START, start);
  return WEEKS.flatMap((w, wi) =>
    w.cells.map((cell, i) =>
      mk(addDays(w.mon, SLOTS[i].offset + delta), SLOTS[i].type, cell, KIKKO_WEEK_VDOT[wi]),
    ),
  );
}

/** Piano ancorato alla partenza di default. */
export const KIKKO_SUB20_SESSIONS: Session[] = buildKikkoSub20Sessions();

/** Data della gara (ultima seduta) per una data partenza. */
export function kikkoSub20RaceDate(startDate?: string | null): string {
  return addDays(kikkoSub20NormalizeStart(startDate), KIKKO_RACE_OFFSET_DAYS);
}

/** Volume settimanale dichiarato, per grafici e verifiche. */
export const KIKKO_SUB20_WEEKLY_KM: number[] = WEEKS.map((w) => w.totalKm);

/** Indici (base 0) delle settimane di scarico, taper compreso. */
export const KIKKO_SUB20_DELOAD_WEEKS: number[] = WEEKS
  .map((w, i) => (w.deload ? i : -1))
  .filter((i) => i >= 0);

/** Somma reale dei km per settimana, ricavata dalle sedute. */
export function kikkoSub20ActualWeeklyKm(): number[] {
  // le distanze non dipendono né dall'aria né dal VDOT: basta un riferimento
  const ref = pacesFor(WEEKS[0].mon, KIKKO_WEEK_VDOT[0]);
  return WEEKS.map((w) => w.cells.reduce((sum, c) => sum + c(ref).dist, 0));
}

/* ── TABELLA T + DP PER LA UI ───────────────────────────────────────────────*/

/**
 * Il riferimento pratico della seduta: il tempo sulla ripetuta o la strada
 * coperta. I TEMPI si leggono dal passo arrotondato — è quello che finisce
 * sull'orologio; la DISTANZA in 20′ dal passo esatto, perché mezzo secondo di
 * arrotondamento lì vale già una decina di metri.
 */
const REFERENCE: Record<HeatKind, {
  label: string;
  of: (secPerKm: number) => string;
  fromRounded?: boolean;
  /** Più lento è il passo, MENO strada fai: la coppia va letta al contrario. */
  reverse?: boolean;
}> = {
  reps:  { label: "600 m",     of: (s) => secToPace(s * 0.6), fromRounded: true },
  long:  { label: "2 km",      of: (s) => secToPace(s * 2),   fromRounded: true },
  tempo: { label: "km in 20′", of: (s) => fmtNum(1200 / s),   reverse: true },
};

export function heatReferenceLabel(kind: HeatKind): string {
  return REFERENCE[kind].label;
}

export interface HeatRow {
  band: HeatBand;
  /** "4:05-4:07" */
  pace: string;
  /** "2:27-2:28" · "8:42-8:48" · "4,40-4,47" */
  reference: string;
  penLabel: string;
  skip: boolean;
}

/** La tabella completa per un tipo di seduta: una riga per fascia. */
export function heatTable(kind: HeatKind, baseSec: number): HeatRow[] {
  const ref = REFERENCE[kind];
  return KIKKO_SUB20_HEAT_BANDS.map((band) => {
    const p = heatPace(kind, band, baseSec);
    const a = ref.of(ref.fromRounded ? Math.round(p.fastSec) : p.fastSec);
    const b = ref.of(ref.fromRounded ? Math.round(p.slowSec) : p.slowSec);
    const [lo, hi] = ref.reverse ? [b, a] : [a, b];
    return {
      band,
      pace: band.skip ? "—" : p.range,
      reference: band.skip ? "seduta da spostare" : lo === hi ? lo : `${lo}-${hi}`,
      penLabel: p.penLabel,
      skip: !!band.skip,
    };
  });
}

/**
 * Il quadro dell'aria attesa in un giorno, con la base di QUELLA settimana.
 * Senza la base giusta la tabella mostrerebbe i ritmi di un'altra settimana.
 */
/**
 * L'aria attesa quel giorno e il ritmo che ne esce, per un piano qualsiasi.
 *
 * Generica di proposito: kikkoSub20 e kikkoSub1:34:35 devono leggere lo stesso
 * termometro. Se ognuno si portasse dietro la sua copia, basterebbe ritoccare
 * una fascia in un file per avere due target diversi sulla stessa mattina — ed
 * è esattamente il tipo di divergenza che l'atleta nota subito.
 */
export function kikkoHeatInfo(
  plan: { weeks: WeekDef[]; defaultStart: string; weekVdot: number[] },
  iso: string,
  startDate?: string | null,
) {
  const start = kikkoSub20NormalizeStart(startDate ?? plan.defaultStart);
  const delta = daysBetween(plan.defaultStart, start);
  const tempC = romeTempForDate(iso);
  const dpC = romeDewPointForDate(iso);
  const index = tempC + dpC;
  const band = heatBandForIndex(index);

  for (let wi = 0; wi < plan.weeks.length; wi++) {
    const w = plan.weeks[wi];
    for (let i = 0; i < w.cells.length; i++) {
      if (addDays(w.mon, SLOTS[i].offset + delta) !== iso) continue;
      const cell = w.cells[i](pacesFor(iso, plan.weekVdot[wi]));
      const kind = cell.kind ?? null;
      return {
        tempC, dpC, index, band, kind,
        vdot: plan.weekVdot[wi],
        baseSec: cell.baseSec ?? null,
        base: cell.baseSec != null ? secToPace(cell.baseSec) : null,
        pace: kind && cell.baseSec != null ? heatPace(kind, band, cell.baseSec) : null,
      };
    }
  }
  return { tempC, dpC, index, band, kind: null, vdot: null, baseSec: null, base: null, pace: null };
}

/** Le settimane di kikkoSub20, per chi deve interrogarne il calendario. */
export const KIKKO_SUB20_PLAN = {
  get weeks() { return WEEKS; },
  defaultStart: KIKKO_SUB20_DEFAULT_START,
  weekVdot: KIKKO_WEEK_VDOT,
};

export function kikkoSub20HeatInfo(iso: string, startDate?: string | null) {
  return kikkoHeatInfo(KIKKO_SUB20_PLAN, iso, startDate);
}

export const KIKKO_SUB20_LEGEND: { color: string; label: string; opacity?: number }[] = [
  { color: "#EF4444", label: "Qualità 1 · intervalli a ritmo gara" },
  { color: "#F97316", label: "Qualità 2 · resistenza o soglia" },
  { color: "#6B7280", label: "Lenta" },
  { color: "#10B981", label: "Lungo" },
  { color: "#2A2A2A", label: "Riposo", opacity: 0.3 },
];
