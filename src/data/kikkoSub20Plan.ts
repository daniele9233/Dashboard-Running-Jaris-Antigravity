import type { Session } from "../types/api";

/**
 * kikkoSub20 — piano 5K su 10 settimane.
 *
 * ── DA DOVE VENGONO I RITMI ─────────────────────────────────────────────────
 * Non più da costanti scritte a mano: da un VDOT, che è l'unico numero da
 * toccare. Da lì scendono ritmo gara, ritmo 10K, soglia e lenti, e ogni ritmo
 * viene poi corretto per l'aria del giorno (indice T + DP).
 *
 * Il VDOT di partenza è misurato, non stimato:
 *
 *   4×1000 m rec 3:00 · 3:59 / 3:56 / 3:57 / 3:50 (GAP 3:55/3:58/3:51/3:48)
 *   25°C · UR 68% → punto di rugiada 18,7° → indice T + DP 44 (fascia 42-48)
 *   Seduta MASSIMALE: l'ultima ripetuta chiusa al 100%, nessuna riserva.
 *
 * GAP medio 3:53/km. Tolta la fascia 42-48 (3-4,5%) si arriva a ~3:45/km al
 * fresco — ma una seduta portata all'esaurimento sta SOPRA il ritmo
 * sostenibile: un lavoro a ritmo intervallo dosato bene finisce con una o due
 * ripetute ancora in canna. Scontando quel 2,5% si ottiene un I-pace reale di
 * ~3:50/km al fresco, cioè VDOT 51 — 5K in 19:36.
 *
 * L'obiettivo è 19:10, cioè VDOT 52,4. Servono +1,4 punti in 10 settimane:
 * dentro il ritmo di miglioramento realistico (1 punto ogni 4-6 settimane).
 *
 * ⚠ KIKKO_WEEK_VDOT è una PROIEZIONE, non una misura. Dopo ogni test (3 km a
 * tutta ogni 3-4 settimane) va riscritto con il valore vero: è l'unico posto
 * da modificare perché tutto il piano si ricalcoli.
 *
 * ── STRUTTURA ───────────────────────────────────────────────────────────────
 *  · QUATTRO uscite: 2 di qualità + 2 lente.
 *  · Volume 32 → 66 km con la regola del 10%, poi taper.
 *  · Seduta 1 — intervalli brevi da 6×600 a 10×800, sempre a ritmo gara.
 *  · Seduta 2 — 3×2 km nelle settimane dispari, soglia in quelle pari.
 *
 *   Martedì  → QUALITÀ 1 · intervalli brevi   (intervals · rosso)
 *   Giovedì  → QUALITÀ 2 · resistenza o soglia (tempo · arancio)
 *   Sabato   → lenta                           (recovery · grigio)
 *   Domenica → lungo lento                     (long · verde)
 *
 * ── I RECUPERI ──────────────────────────────────────────────────────────────
 * Sugli intervalli il recupero parte vicino a 1:1 e si accorcia dentro il
 * blocco (Daniels: sul lavoro a ritmo intervallo il recupero non deve superare
 * la durata della ripetuta). Si riazzera quando la ripetuta passa da 600 a
 * 800 m: distanza nuova, si riparte dal recupero pieno.
 *
 * Sui 3×2 km il recupero non è un dettaglio, è parte della prescrizione: con
 * 3:30 (~40% del lavoro) sei recuperato e tieni il ritmo 10K, con 1:45 (~20%)
 * riparti carico e il ritmo giusto è il T-pace. Il codice interpola invece di
 * inchiodare una costante — vedi repPaceForRecovery.
 */

export const KIKKO_SUB20_META = {
  weeks: 10,
  phase: "kikkoSub20",
  goalRace: "5K",
  goalTime: "19:10",
  runsPerWeek: 4,
  startDate: "2026-07-27", // lunedì di riferimento della settimana 1
};

/* ── VDOT ───────────────────────────────────────────────────────────────────*/

/** VDOT misurato dal 4×1000 massimale, scontato per "seduta a esaurimento". */
export const KIKKO_VDOT_START = 51.0;
/** 19:10 sui 5K. */
export const KIKKO_VDOT_GOAL = 52.4;

/**
 * VDOT atteso settimana per settimana: salita lineare da 51 a 52,4.
 * È una previsione. Dopo un test, sovrascrivi i valori da lì in avanti.
 */
export const KIKKO_WEEK_VDOT: number[] = [
  51.0, 51.2, 51.3, 51.5, 51.6, 51.8, 51.9, 52.1, 52.2, 52.4,
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

const paceToSec = (p: string): number => {
  const [m, s] = p.split(":").map(Number);
  return m * 60 + s;
};
const secToPace = (sec: number): string => {
  const total = Math.round(sec);           // arrotonda il totale: mai ":60"
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
};

/** "4,58" — i decimali si scrivono all'italiana. */
export const fmtNum = (n: number, digits = 2): string =>
  n.toFixed(digits).replace(".", ",");

/** "8,0 km" → "8 km": sui numeri tondi la coda non serve. */
const trimZero = (s: string): string => s.replace(/,0$/, "");

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

function pacesFor(iso: string, vdot: number): Paces {
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

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function itDayName(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return IT_DAYS[new Date(y, m - 1, d).getDay()];
}

function daysBetween(a: string, b: string): number {
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
 * Le descrizioni stanno in una riga: struttura e numeri, niente spiegazioni.
 * Il "perché" del ritmo del giorno sta nella tabella T + DP accanto alla
 * seduta, non dentro il testo.
 */

type Cell = {
  title: string;
  dist: number;
  pace: string | null;
  desc: string;
  /** Tipo di ritmo e base al fresco: servono alla tabella T + DP nella UI. */
  kind?: HeatKind;
  baseSec?: number;
};
type CellFn = (p: Paces) => Cell;

/** Le quattro uscite, per offset dal lunedì della settimana. */
const SLOTS = [
  { offset: 1, type: "intervals" }, // martedì  · QUALITÀ 1
  { offset: 3, type: "tempo" },     // giovedì  · QUALITÀ 2
  { offset: 5, type: "recovery" },  // sabato   · lenta
  { offset: 6, type: "long" },      // domenica · lungo
] as const;

type WeekDef = {
  /** Lunedì di riferimento. */
  mon: string;
  /** Volume atteso, verificato dai test contro la somma reale delle sedute. */
  totalKm: number;
  /** [qualità 1, qualità 2, lenta, lungo] */
  cells: [CellFn, CellFn, CellFn, CellFn];
};

const easy = (dist: number): CellFn => (p) => ({
  title: `Lenta ${dist} km`,
  dist,
  pace: p.easy,
  desc: `${dist} km a ${p.easy}-${secToPace(paceToSec(p.easy) + 15)}. Conversazione piena.`,
});

const longRun = (dist: number): CellFn => (p) => ({
  title: `Lungo ${dist} km`,
  dist,
  pace: p.slow,
  desc: `${dist} km a ${p.slow}-${secToPace(paceToSec(p.slow) + 15)}. Base aerobica: piano davvero.`,
});

/** Qualità 1 — intervalli brevi a ritmo gara. */
const reps = (n: number, meters: number, dist: number, rec: string, note = ""): CellFn => (p) => {
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
const longReps = (rec: string, dist: number, note = ""): CellFn => (p) => {
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

const WEEKS: WeekDef[] = [
  // ═══ BLOCCO 1 · INGRESSO · ripetute da 600 m ══════════════════════════════
  {
    mon: "2026-07-27", totalKm: 32,
    cells: [
      reps(6, 600, 9, "2:20", "Prima seduta: deve finire con due ripetute in tasca."),
      longReps("3:00", 10, "Recupero pieno: si impara il ritmo."),
      easy(6),
      longRun(7),
    ],
  },
  {
    mon: "2026-08-03", totalKm: 35,
    cells: [
      reps(7, 600, 10, "2:10", "Una ripetuta in più, 10″ di recupero in meno."),
      tempo(20, 8),
      easy(8),
      longRun(9),
    ],
  },
  {
    mon: "2026-08-10", totalKm: 38,
    cells: [
      reps(8, 600, 10, "2:00"),
      longReps("2:30", 10),
      easy(8),
      longRun(10),
    ],
  },
  {
    mon: "2026-08-17", totalKm: 42,
    cells: [
      reps(9, 600, 11, "1:50", "Ultima sui 600."),
      tempo(25, 9),
      easy(10),
      longRun(12),
    ],
  },

  // ═══ BLOCCO 2 · si passa agli 800 m ═══════════════════════════════════════
  {
    mon: "2026-08-24", totalKm: 46,
    cells: [
      reps(6, 800, 10, "3:10", "Distanza nuova: si riparte da 6 e col recupero pieno."),
      longReps("2:15", 10),
      easy(12),
      longRun(14),
    ],
  },
  {
    mon: "2026-08-31", totalKm: 50,
    cells: [
      reps(7, 800, 11, "2:50"),
      tempo(30, 11),
      easy(13),
      longRun(15),
    ],
  },
  {
    mon: "2026-09-07", totalKm: 55,
    cells: [
      reps(8, 800, 12, "2:35"),
      longReps("2:00", 10),
      easy(15),
      longRun(18),
    ],
  },
  {
    mon: "2026-09-14", totalKm: 60,
    cells: [
      reps(9, 800, 13, "2:20"),
      tempo(30, 11),
      easy(16),
      longRun(20),
    ],
  },

  // ═══ BLOCCO 3 · PICCO ═════════════════════════════════════════════════════
  {
    mon: "2026-09-21", totalKm: 66,
    cells: [
      reps(10, 800, 14, "2:10", "Seduta chiave: se il passo scivola, chiudi a 8."),
      longReps("1:45", 10, "Recupero minimo: test della tenuta."),
      easy(19),
      longRun(23),
    ],
  },

  // ═══ SETTIMANA 10 · TAPER + GARA ══════════════════════════════════════════
  {
    mon: "2026-09-28", totalKm: 28,
    cells: [
      reps(5, 800, 9, "3:15", "Taper: metà ripetute, stesso ritmo, recupero più lungo."),
      (p) => {
        const hp = heatPace("reps", p.band, p.bases.race);
        return {
          title: `Sblocco 2×1000 @ ${hp.mid} · rec 3:00`,
          dist: 7,
          pace: hp.mid,
          kind: "reps" as HeatKind,
          baseSec: p.bases.race,
          desc: "Risc. 2 km, def. sciolto. Ultimo richiamo del passo: deve sembrare facile.",
        };
      },
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
          dist: 7,
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

function mk(date: string, type: string, cell: CellFn, vdot: number): Session {
  // La seduta si scrive sul VDOT di quella settimana e sull'aria attesa QUEL
  // giorno: le ripetute di agosto e quelle di ottobre non possono avere lo
  // stesso target.
  const c = cell(pacesFor(date, vdot));
  return {
    day: itDayName(date),
    date,
    type,
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
export function kikkoSub20HeatInfo(iso: string, startDate?: string | null) {
  const start = kikkoSub20NormalizeStart(startDate);
  const delta = daysBetween(KIKKO_SUB20_DEFAULT_START, start);
  const tempC = romeTempForDate(iso);
  const dpC = romeDewPointForDate(iso);
  const index = tempC + dpC;
  const band = heatBandForIndex(index);

  for (let wi = 0; wi < WEEKS.length; wi++) {
    const w = WEEKS[wi];
    for (let i = 0; i < w.cells.length; i++) {
      if (addDays(w.mon, SLOTS[i].offset + delta) !== iso) continue;
      const cell = w.cells[i](pacesFor(iso, KIKKO_WEEK_VDOT[wi]));
      const kind = cell.kind ?? null;
      return {
        tempC, dpC, index, band, kind,
        vdot: KIKKO_WEEK_VDOT[wi],
        baseSec: cell.baseSec ?? null,
        base: cell.baseSec != null ? secToPace(cell.baseSec) : null,
        pace: kind && cell.baseSec != null ? heatPace(kind, band, cell.baseSec) : null,
      };
    }
  }
  return { tempC, dpC, index, band, kind: null, vdot: null, baseSec: null, base: null, pace: null };
}

export const KIKKO_SUB20_LEGEND: { color: string; label: string; opacity?: number }[] = [
  { color: "#EF4444", label: "Qualità 1 · intervalli a ritmo gara" },
  { color: "#F97316", label: "Qualità 2 · resistenza o soglia" },
  { color: "#6B7280", label: "Lenta" },
  { color: "#10B981", label: "Lungo" },
  { color: "#2A2A2A", label: "Riposo", opacity: 0.3 },
];
