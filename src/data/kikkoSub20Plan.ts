import type { Session } from "../types/api";

/**
 * kikkoSub20 — piano 5K sub-20:00 su 10 settimane.
 *
 * Impostazione richiesta dall'atleta:
 *  · QUATTRO uscite a settimana: 2 di qualità + 2 lente.
 *  · Settimana 1 a 32 km, poi sempre a salire con la regola del 10%.
 *  · Seduta 1 — intervalli brevi: da 6×600 m a 10×800 m, sempre a ritmo gara 5K.
 *  · Seduta 2 — resistenza nelle settimane dispari: 3×2 km, con il recupero che
 *    si accorcia ogni 14 giorni. Nelle settimane pari la seconda seduta è una
 *    soglia: tiene il conto di "due qualità" senza aggiungere un secondo
 *    stimolo VO2max, che a questo volume non si recupera.
 *  · Taper negli ultimi 7-10 giorni: volume −58%, intensità INVARIATA a ritmo
 *    gara ma con molte meno ripetizioni.
 *
 * ── I RECUPERI ──────────────────────────────────────────────────────────────
 * Il criterio è il RAPPORTO LAVORO:RECUPERO, non un numero a caso.
 *
 * Sugli intervalli brevi il recupero parte vicino a 1:1 e si accorcia dentro
 * il blocco (Daniels, Running Formula: sul lavoro a ritmo intervallo il
 * recupero non deve superare la durata della ripetuta). Con un recupero
 * incompleto il consumo di ossigeno resta alto anche nella pausa, quindi il
 * tempo utile ad alta intensità si accumula invece di azzerarsi.
 *
 *   600 m  W1 2:20 · W2 2:10 · W3 2:00 · W4 1:50
 *   800 m  W5 3:10 · W6 2:50 · W7 2:35 · W8 2:20 · W9 2:10
 *
 * Il rapporto si RIAZZERA a ~1:1 quando la ripetuta si allunga da 600 a 800 m
 * (settimana 5): distanza nuova, stimolo nuovo, si riparte dal recupero pieno.
 *
 * Sui 3×2 km il rapporto è molto più stretto perché lì l'obiettivo non è il
 * VO2max ma la capacità di RIPRENDERE il ritmo con le gambe già cariche.
 *
 * ── VOLUME ──────────────────────────────────────────────────────────────────
 *   32 · 35 · 38 · 42 · 46 · 50 · 55 · 60 · 66 · 28 (taper)
 * Ogni incremento sta fra +8.6% e +10.6%. Nessuna settimana di scarico: la
 * progressione è monotona fino al picco, poi si scarica solo col taper.
 *
 * ── SETTIMANA ───────────────────────────────────────────────────────────────
 *   Martedì  → QUALITÀ 1 · intervalli brevi   (intervals · rosso)
 *   Giovedì  → QUALITÀ 2 · resistenza o soglia (tempo · arancio)
 *   Sabato   → lenta                           (recovery · grigio)
 *   Domenica → lungo lento                     (long · verde)
 */

export const KIKKO_SUB20_META = {
  weeks: 10,
  phase: "kikkoSub20",
  goalRace: "5K",
  goalTime: "19:58",
  racePace: "4:00",
  runsPerWeek: 4,
  startDate: "2026-07-27", // lunedì di riferimento della settimana 1
};

/* ── LE BASI DI PARTENZA ────────────────────────────────────────────────────
 * Ritmi al fresco (12-14°C), calcolati sul VDOT REALE attuale 48-49, non su
 * quello che uscirebbe dalle ripetute.
 *
 *   intervalli brevi  4:00/km  → ritmo gara 5K, obiettivo 19:58
 *   3×2 km rec 3:30   4:15/km  → 2 km in 8:30. Con 3:30 di recupero è ritmo
 *                                10K, non soglia continua: 5-8 s/km più veloce
 *                                del T-pace.
 *   soglia 20′        4:22/km  → ~4,58 km coperti
 *
 * Quando il VDOT arriva a 50, i due ritmi della qualità 2 diventano
 * rispettivamente 4:08 e 4:15 (vedi KIKKO_SUB20_VDOT50).
 */
const BASE_PACE = {
  reps: "4:00",
  long: "4:15",
  tempo: "4:22",
} as const;

/** Le stesse basi quando il VDOT reale arriva a 50. */
export const KIKKO_SUB20_VDOT50 = { reps: "4:00", long: "4:08", tempo: "4:15" } as const;

const EASY = "5:40";
const LONG = "5:30";

export type HeatKind = keyof typeof BASE_PACE;

/* ── INDICE T + DP ──────────────────────────────────────────────────────────
 * Il caldo non si misura con la sola temperatura: a parità di gradi, l'aria
 * umida non lascia evaporare il sudore e il corpo non si raffredda. L'indice
 * è la SOMMA di temperatura e punto di rugiada, entrambi in °C — il Garmin dà
 * il DP nei dati meteo della sessione.
 *
 * La penalità è una forbice, non un numero secco: il bordo basso della fascia
 * costa meno del bordo alto. I ritmi mostrati sono la forbice applicata alla
 * base della seduta.
 */
export interface HeatBand {
  id: string;
  /** Estremo inferiore incluso dell'indice T + DP. */
  min: number;
  /** Estremo superiore escluso; null sull'ultima fascia. */
  max: number | null;
  /** "26-37", "> 59", … */
  label: string;
  /** Combinazione tipica a Roma che cade in questa fascia. */
  example: string;
  /** Penalità % [min, max] sul ritmo, per tipo di seduta. */
  pen: Record<HeatKind, [number, number]>;
  /** Oltre l'indice 59 la seduta non si fa: si sposta all'alba o si rimanda. */
  skip?: boolean;
}

export const KIKKO_SUB20_HEAT_BANDS: HeatBand[] = [
  // Sotto 26 l'aria non è mai il limite: sugli intervalli si può anche
  // scendere di un paio di secondi rispetto alla base.
  { id: "b0", min: -Infinity, max: 26, label: "< 26",  example: "15° + DP 10°",
    pen: { reps: [-0.8, 0],  long: [0, 0],     tempo: [0, 0]     } },
  { id: "b1", min: 26, max: 37, label: "26-37", example: "20° + DP 14°",
    pen: { reps: [0.5, 1.5], long: [0.5, 2],   tempo: [0.5, 2]   } },
  { id: "b2", min: 37, max: 42, label: "37-42", example: "24° + DP 17°",
    pen: { reps: [2, 3],     long: [2.5, 3.5], tempo: [2.5, 4]   } },
  { id: "b3", min: 42, max: 48, label: "42-48", example: "28° + DP 18°",
    pen: { reps: [3, 4.5],   long: [3.5, 5],   tempo: [4, 6]     } },
  { id: "b4", min: 48, max: 53, label: "48-53", example: "31° + DP 19°",
    pen: { reps: [4.5, 6],   long: [5, 7],     tempo: [6, 8]     } },
  { id: "b5", min: 53, max: 59, label: "53-59", example: "34° + DP 20°",
    pen: { reps: [6, 8],     long: [7, 9],     tempo: [8, 10]    } },
  { id: "b6", min: 59, max: null, label: "> 59", example: "37° + DP 22°", skip: true,
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

const pad = (n: number) => String(n).padStart(2, "0");

const paceToSec = (p: string): number => {
  const [m, s] = p.split(":").map(Number);
  return m * 60 + s;
};
const secToPace = (sec: number): string => {
  const total = Math.round(sec);           // arrotonda il totale: mai ":60"
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
};
const shiftPace = (p: string, sec: number): string => secToPace(paceToSec(p) + sec);

/** "4,58" — i decimali si scrivono all'italiana. */
export const fmtNum = (n: number, digits = 2): string =>
  n.toFixed(digits).replace(".", ",");

/** "8,0 km" → "8 km": sui numeri tondi la coda non serve. */
const trimZero = (s: string): string => s.replace(/,0$/, "");

/** Il ritmo del giorno per una seduta: forbice della fascia + centro. */
export interface HeatPace {
  band: HeatBand;
  kind: HeatKind;
  /** Base al fresco, es. "4:00". */
  base: string;
  /** Estremo veloce e lento della forbice, in secondi/km (non arrotondati). */
  fastSec: number;
  slowSec: number;
  /** Centro della forbice: è questo il target scritto sulla seduta. */
  midSec: number;
  mid: string;
  /** "4:05-4:07" (o "4:00" quando la fascia non penalizza). */
  range: string;
  /** "+2-3%" · "0%" */
  penLabel: string;
}

const fmtPct = (v: number): string => (Number.isInteger(v) ? String(v) : fmtNum(v, 1));

export function heatPace(kind: HeatKind, band: HeatBand, base = BASE_PACE[kind]): HeatPace {
  const baseSec = paceToSec(base);
  const [lo, hi] = band.pen[kind];
  const fastSec = baseSec * (1 + lo / 100);
  const slowSec = baseSec * (1 + hi / 100);
  const midSec = (fastSec + slowSec) / 2;
  const fast = secToPace(fastSec);
  const slow = secToPace(slowSec);
  return {
    band, kind, base, fastSec, slowSec, midSec,
    mid: secToPace(midSec),
    range: fast === slow ? fast : `${fast}-${slow}`,
    // sotto l'indice 26 la penalità è nulla per definizione: la forbice
    // negativa serve solo a dire che al fresco si può spingere un filo.
    penLabel: hi <= 0 ? "0%" : lo === hi ? `${fmtPct(hi)}%` : `${fmtPct(Math.max(0, lo))}-${fmtPct(hi)}%`,
  };
}

/** I ritmi del giorno, già corretti per la fascia. */
export interface Paces {
  band: HeatBand;
  index: number;
  tempC: number;
  dpC: number;
  reps: HeatPace;
  long: HeatPace;
  tempo: HeatPace;
  easy: string;
  slow: string;
}

function pacesFor(iso: string): Paces {
  const tempC = romeTempForDate(iso);
  const dpC = romeDewPointForDate(iso);
  const index = tempC + dpC;
  const band = heatBandForIndex(index);
  // Sui lenti il caldo pesa, ma la metà: si corre a sensazione, non a target.
  const easyAdj = Math.round((band.pen.tempo[1] / 2 / 100) * paceToSec(EASY));
  return {
    band, index, tempC, dpC,
    reps: heatPace("reps", band),
    long: heatPace("long", band),
    tempo: heatPace("tempo", band),
    easy: shiftPace(EASY, easyAdj),
    slow: shiftPace(LONG, easyAdj),
  };
}

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

type Cell = { title: string; dist: number; pace: string | null; desc: string; kind?: HeatKind };
/** Una seduta si scrive solo quando si sa che aria ci sarà quel giorno. */
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

/* ── LE SEDUTE ──────────────────────────────────────────────────────────────
 * Le descrizioni stanno in una riga: struttura e numeri, niente spiegazioni.
 * Il "perché" del ritmo del giorno sta nella tabella T + DP accanto alla
 * seduta, non dentro il testo.
 */

const easy = (dist: number): CellFn => (p) => ({
  title: `Lenta ${dist} km`,
  dist,
  pace: p.easy,
  desc: `${dist} km a ${p.easy}-${shiftPace(p.easy, 15)}. Conversazione piena.`,
});

const longRun = (dist: number): CellFn => (p) => ({
  title: `Lungo ${dist} km`,
  dist,
  pace: p.slow,
  desc: `${dist} km a ${p.slow}-${shiftPace(p.slow, 15)}. Base aerobica: piano davvero.`,
});

/** Qualità 1 — intervalli brevi a ritmo gara. */
const reps = (n: number, meters: number, dist: number, rec: string, note = ""): CellFn => (p) => {
  const workSec = (meters / 1000) * p.reps.midSec;
  const ratio = (paceToSec(rec) / workSec).toFixed(2);
  return {
    title: `${n}×${meters} m @ ${p.reps.mid} · rec ${rec}`,
    dist,
    pace: p.reps.mid,
    kind: "reps",
    desc:
      `Risc. 2 km + 3 allunghi, def. 1,5 km. Ripetuta ~${secToPace(workSec)}, rec ${rec} di jog ` +
      `(1:${ratio}). ${trimZero(fmtNum((n * meters) / 1000, 1))} km a ritmo gara, passo costante.` +
      `${note ? " " + note : ""}`,
  };
};

/** Qualità 2 — resistenza a ritmo 10K, settimane dispari. */
const longReps = (rec: string, dist: number, note = ""): CellFn => (p) => {
  const workSec = 2 * p.long.midSec;
  const ratio = (paceToSec(rec) / workSec).toFixed(2);
  return {
    title: `3×2 km @ ${p.long.mid} · rec ${rec}`,
    dist,
    pace: p.long.mid,
    kind: "long",
    desc:
      `Risc. 2 km, def. 1,5 km. Serie da ~${secToPace(workSec)}, rec ${rec} (1:${ratio}). ` +
      `Riprendere il ritmo a gambe cariche.${note ? " " + note : ""}`,
  };
};

/** Qualità 2 — soglia, settimane pari. */
const tempo = (minutes: number, dist: number, note = ""): CellFn => (p) => ({
  title: `Soglia ${minutes}′ @ ${p.tempo.mid}`,
  dist,
  pace: p.tempo.mid,
  kind: "tempo",
  desc:
    `Risc. 2 km + allunghi, def. 1,5 km. ${minutes}′ continui senza pause: ` +
    `~${fmtNum((minutes * 60) / p.tempo.midSec)} km.${note ? " " + note : ""}`,
});

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
      reps(10, 800, 14, "2:10", "La seduta del piano: se regge il passo, la sub-20 c'è."),
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
      (p) => ({
        title: `Sblocco 2×1000 @ ${p.reps.mid} · rec 3:00`,
        dist: 7,
        pace: p.reps.mid,
        kind: "reps",
        desc: "Risc. 2 km, def. sciolto. Ultimo richiamo del passo: deve sembrare facile.",
      }),
      (p) => ({
        title: "Sciolto 5 km + 4 allunghi",
        dist: 5,
        pace: p.easy,
        desc: "5 km sciolti + 4 allunghi da 80 m. Controlla il meteo di domani.",
      }),
      (p) => ({
        title: "🏁 GARA 5K · sub 20:00",
        dist: 7,
        pace: p.reps.mid,
        kind: "reps",
        desc:
          `Risc. 15′ + 4 allunghi (i 7 km li comprendono). Primo km ${shiftPace(p.reps.mid, 2)}, ` +
          `poi ${p.reps.mid}, dal 4° svuota. Previsione con l'aria attesa: ${secToPace(p.reps.midSec * 5)}.`,
      }),
    ],
  },
];

function mk(date: string, type: string, cell: CellFn): Session {
  // La seduta si scrive sull'aria attesa QUEL giorno: le ripetute di agosto e
  // quelle di ottobre non possono avere lo stesso target.
  const c = cell(pacesFor(date));
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
  return WEEKS.flatMap((w) =>
    w.cells.map((cell, i) => mk(addDays(w.mon, SLOTS[i].offset + delta), SLOTS[i].type, cell)),
  );
}

/** Piano ancorato alla partenza di default. */
export const KIKKO_SUB20_SESSIONS: Session[] = buildKikkoSub20Sessions();

/**
 * Tipo di ritmo che comanda la seduta di quel giorno: serve alla tabella
 * T + DP per mostrare la riga giusta (e nessuna, sulle lente).
 */
export function kikkoSub20HeatKind(iso: string, startDate?: string | null): HeatKind | null {
  const start = kikkoSub20NormalizeStart(startDate);
  const delta = daysBetween(KIKKO_SUB20_DEFAULT_START, start);
  for (const w of WEEKS) {
    for (let i = 0; i < w.cells.length; i++) {
      if (addDays(w.mon, SLOTS[i].offset + delta) === iso) {
        return w.cells[i](pacesFor(iso)).kind ?? null;
      }
    }
  }
  return null;
}

/** Data della gara (ultima seduta) per una data partenza. */
export function kikkoSub20RaceDate(startDate?: string | null): string {
  return addDays(kikkoSub20NormalizeStart(startDate), KIKKO_RACE_OFFSET_DAYS);
}

/** Volume settimanale dichiarato, per grafici e verifiche. */
export const KIKKO_SUB20_WEEKLY_KM: number[] = WEEKS.map((w) => w.totalKm);

/** Somma reale dei km per settimana, ricavata dalle sedute. */
export function kikkoSub20ActualWeeklyKm(): number[] {
  // le distanze non dipendono dall'aria: basta una fascia qualsiasi
  const ref = pacesFor(WEEKS[0].mon);
  return WEEKS.map((w) => w.cells.reduce((sum, c) => sum + c(ref).dist, 0));
}

/**
 * Riga della tabella T + DP per una seduta: ritmo e riferimento pratico
 * (tempo sui 600 m, tempo sui 2 km, distanza in 20′).
 */
export interface HeatRow {
  band: HeatBand;
  /** "4:05-4:07" */
  pace: string;
  /** "2:27-2:28" · "8:42-8:48" · "4,40-4,47 km" */
  reference: string;
  penLabel: string;
  skip: boolean;
}

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

/** La tabella completa per un tipo di seduta: una riga per fascia. */
export function heatTable(kind: HeatKind): HeatRow[] {
  const ref = REFERENCE[kind];
  return KIKKO_SUB20_HEAT_BANDS.map((band) => {
    const p = heatPace(kind, band);
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

/** Il quadro dell'aria attesa in un giorno, per la UI. */
export function kikkoSub20HeatInfo(iso: string, kind: HeatKind | null) {
  const tempC = romeTempForDate(iso);
  const dpC = romeDewPointForDate(iso);
  const index = tempC + dpC;
  const band = heatBandForIndex(index);
  return {
    tempC, dpC, index, band,
    kind,
    pace: kind ? heatPace(kind, band) : null,
    base: kind ? BASE_PACE[kind] : null,
  };
}

export const KIKKO_SUB20_LEGEND: { color: string; label: string; opacity?: number }[] = [
  { color: "#EF4444", label: "Qualità 1 · intervalli a ritmo gara" },
  { color: "#F97316", label: "Qualità 2 · resistenza o soglia" },
  { color: "#6B7280", label: "Lenta" },
  { color: "#10B981", label: "Lungo" },
  { color: "#2A2A2A", label: "Riposo", opacity: 0.3 },
];
