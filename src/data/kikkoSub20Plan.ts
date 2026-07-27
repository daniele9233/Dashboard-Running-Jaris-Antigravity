import type { Session } from "../types/api";

/**
 * kikkoSub20 — piano 5K sub-20:00 su 10 settimane.
 *
 * Impostazione richiesta dall'atleta:
 *  · Settimana 1 a 32 km, progressione ~10%/settimana.
 *  · SOLO DUE sedute intense a settimana. Tutti gli altri giorni sono corse
 *    facili, che esistono per SOSTENERE i lavori duri: se una facile ti lascia
 *    stanco per il martedì, l'hai corsa troppo forte.
 *  · Seduta 1 — intervalli brevi: da 6×600 m a 10×800 m, sempre a ritmo gara 5K.
 *  · Seduta 2 — resistenza a ritmo gara nelle settimane dispari: 3×2 km, con il
 *    recupero che si accorcia ogni 14 giorni (3:00 → 1:45). Nelle settimane pari
 *    la seconda seduta è una soglia: tiene il conto di "due intense" senza
 *    aggiungere un secondo stimolo VO2max, che a questo volume non si recupera.
 *  · Taper negli ultimi 7-10 giorni: volume −58%, intensità INVARIATA a ritmo
 *    gara ma con molte meno ripetizioni.
 *
 * Ritmo gara 5K (RG5K) = 4:00/km → obiettivo 19:58.
 *
 * Volume settimanale — sempre a salire, regola del 10% su OGNI settimana:
 *   32 · 35 · 38 · 42 · 46 · 50 · 55 · 60 · 66 · 28 (taper)
 * Ogni incremento sta fra +8.6% e +10.6% (i km sono interi, da qui l'arrotondamento). Nessuna settimana di scarico: la
 * progressione richiesta è monotona fino al picco, poi si scarica solo col taper.
 *
 * Nota: 32 → 66 km in nove settimane è una rampa impegnativa e senza settimane
 * di richiamo il margine di recupero è tutto sulle corse facili. Se una
 * settimana arriva con le gambe piatte, ripeterla invece di proseguire vale più
 * di qualsiasi chilometro aggiunto.
 *
 * Ritmo settimanale:
 *   Lunedì    → facile          (recovery)
 *   Martedì   → INTENSA 1       (intervals · rosso)
 *   Mercoledì → facile          (recovery)
 *   Giovedì   → INTENSA 2       (tempo · arancio)
 *   Venerdì   → facile          (recovery)
 *   Sabato    → riposo
 *   Domenica  → lungo facile    (long · verde)
 */

export const KIKKO_SUB20_META = {
  weeks: 10,
  phase: "kikkoSub20",
  goalRace: "5K",
  goalTime: "19:58",
  racePace: "4:00",
  startDate: "2026-07-27", // lunedì
};

const RG5K = "4:00";   // ritmo gara 5K
const SOGLIA = "4:18"; // soglia ~RG + 18 sec/km
const EASY = "5:40";
const LONG = "5:30";

const IT_DAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

const pad = (n: number) => String(n).padStart(2, "0");

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

/** Una cella = una seduta. `null` = giorno di riposo. */
type Cell = { title: string; dist: number; pace: string | null; desc: string } | null;

/** Offset dal lunedì della settimana. */
const SLOTS = [
  { offset: 0, type: "recovery" },  // lunedì  · facile
  { offset: 1, type: "intervals" }, // martedì · INTENSA 1
  { offset: 2, type: "recovery" },  // mercoledì · facile
  { offset: 3, type: "tempo" },     // giovedì · INTENSA 2
  { offset: 4, type: "recovery" },  // venerdì · facile
  { offset: 5, type: "rest" },      // sabato  · riposo
  { offset: 6, type: "long" },      // domenica · lungo
] as const;

type WeekDef = {
  /** Lunedì di riferimento. */
  mon: string;
  /** Volume atteso, usato dal test di coerenza. */
  totalKm: number;
  cells: [Cell, Cell, Cell, Cell, Cell, Cell, Cell];
};

const easy = (dist: number, extra = ""): Cell => ({
  title: `Facile ${dist} km`,
  dist,
  pace: EASY,
  desc:
    `${dist} km molto facili (5:30-5:55). Serve a sostenere le due sedute dure, non ad aggiungere fatica: ` +
    `devi poter parlare a frasi intere per tutta la corsa.${extra ? " " + extra : ""}`,
});

const longRun = (dist: number, extra = ""): Cell => ({
  title: `Lungo ${dist} km`,
  dist,
  pace: LONG,
  desc:
    `${dist} km facili in conversazione (5:20-5:45). Base aerobica: è la cilindrata che regge le ripetute ` +
    `del martedì.${extra ? " " + extra : ""}`,
});

/** Seduta 1 — intervalli brevi a ritmo gara. */
const reps = (n: number, meters: number, dist: number, rec: string, extra = ""): Cell => ({
  title: `${n}×${meters} m @ ${RG5K}`,
  dist,
  pace: RG5K,
  desc:
    `2 km di riscaldamento + 3 allunghi, poi ${n}×${meters} m a ${RG5K}/km (ritmo gara 5K) con ${rec} di jog ` +
    `di recupero, 1,5 km di defaticamento. Passo COSTANTE su tutte: se l'ultima è la più veloce hai fatto ` +
    `centro, se la prima è la più veloce sei partito troppo forte.${extra ? " " + extra : ""}`,
});

/** Seduta 2 — resistenza al ritmo gara, settimane dispari. */
const longReps = (rec: string, dist: number, extra = ""): Cell => ({
  title: `3×2 km @ ${RG5K} · rec ${rec}`,
  dist,
  pace: RG5K,
  desc:
    `2 km di riscaldamento, poi 3×2 km a ${RG5K}/km con ${rec} di recupero, 1,5 km di defaticamento. ` +
    `Questa seduta costruisce la capacità di TENERE il ritmo gara su tratti lunghi. Torna ogni 14 giorni con ` +
    `il recupero più corto: stesso lavoro, meno respiro, più simile alla gara.${extra ? " " + extra : ""}`,
});

/** Seduta 2 — soglia, settimane pari. */
const tempo = (minutes: number, dist: number, extra = ""): Cell => ({
  title: `Soglia ${minutes}′ @ ${SOGLIA}`,
  dist,
  pace: SOGLIA,
  desc:
    `2 km facili + allunghi, poi ${minutes}′ continui a ${SOGLIA}/km, 1,5 km di defaticamento. Soglia = sforzo ` +
    `che potresti quasi tenere per un'ora. Nelle settimane senza 3×2 km è questa la seconda seduta intensa: ` +
    `sostiene il ritmo gara senza un secondo stimolo VO2max da recuperare.${extra ? " " + extra : ""}`,
});

const WEEKS: WeekDef[] = [
  // ═══ BLOCCO 1 · INGRESSO · 600 m ══════════════════════════════════════════
  {
    mon: "2026-07-27", totalKm: 32,
    cells: [
      easy(3, "Prima uscita del piano: parti deliberatamente piano."),
      reps(6, 600, 7, "2:00", "Prima seduta di qualità: 3,6 km di lavoro. Deve finire con la sensazione di poterne fare altre due."),
      easy(4),
      longReps("3:00", 9, "Recupero generoso alla prima: serve a imparare il ritmo, non a soffrire."),
      easy(3),
      null,
      longRun(6, "Il lungo parte corto e cresce ogni settimana."),
    ],
  },
  {
    mon: "2026-08-03", totalKm: 35,
    cells: [
      easy(3),
      reps(7, 600, 8, "2:00", "Una ripetuta in più: la progressione è nel numero, non nel passo."),
      easy(4),
      tempo(20, 9),
      easy(4),
      null,
      longRun(7),
    ],
  },
  {
    mon: "2026-08-10", totalKm: 38,
    cells: [
      easy(4),
      reps(8, 600, 9, "1:50", "8×600 = 4,8 km a ritmo gara, recupero leggermente più corto."),
      easy(4),
      longReps("2:30", 10, "Secondo giro dei 3×2 km: 30 secondi di recupero in meno rispetto alla settimana 1."),
      easy(4),
      null,
      longRun(7),
    ],
  },
  {
    mon: "2026-08-17", totalKm: 42,
    cells: [
      easy(4),
      reps(9, 600, 10, "1:50", "Ultima settimana sui 600: nove ripetute, 5,4 km di lavoro."),
      easy(5),
      tempo(25, 10, "La soglia sale a 25′ continui."),
      easy(4),
      null,
      longRun(9),
    ],
  },

  // ═══ BLOCCO 2 · SI PASSA AGLI 800 ═════════════════════════════════════════
  {
    mon: "2026-08-24", totalKm: 46,
    cells: [
      easy(5),
      reps(6, 800, 9, "2:15", "Si allunga la ripetuta: da 600 a 800 m. Il numero riparte da 6, la distanza cresce."),
      easy(6),
      longReps("2:15", 10, "Terzo giro dei 3×2 km: recupero a 2:15."),
      easy(5),
      null,
      longRun(11),
    ],
  },
  {
    mon: "2026-08-31", totalKm: 50,
    cells: [
      easy(5),
      reps(7, 800, 10, "2:10"),
      easy(7),
      tempo(30, 11, "Trenta minuti continui di soglia: il motore che regge i 4:00 in gara si costruisce qui."),
      easy(6),
      null,
      longRun(11),
    ],
  },
  {
    mon: "2026-09-07", totalKm: 55,
    cells: [
      easy(6),
      reps(8, 800, 11, "2:00", "8×800 = 6,4 km a ritmo gara: più della distanza di gara, frazionata."),
      easy(8),
      longReps("2:00", 11, "Quarto giro: recupero a 2:00. Inizia a somigliare a una gara."),
      easy(7),
      null,
      longRun(12),
    ],
  },
  {
    mon: "2026-09-14", totalKm: 60,
    cells: [
      easy(7),
      reps(9, 800, 12, "2:00"),
      easy(9),
      tempo(30, 11),
      easy(7),
      null,
      longRun(14),
    ],
  },

  // ═══ BLOCCO 3 · PICCO ═════════════════════════════════════════════════════
  {
    mon: "2026-09-21", totalKm: 66,
    cells: [
      easy(7),
      reps(10, 800, 13, "2:00", "LA SEDUTA DEL PIANO: 10×800 = 8 km a ritmo gara. Se la chiudi con passo costante, la sub-20 è nelle gambe."),
      easy(10),
      longReps("1:45", 11, "Ultimo giro dei 3×2 km, recupero minimo a 1:45. È il test finale della tenuta."),
      easy(9),
      null,
      longRun(16, "Ultimo lungo pieno: da qui si scarica verso la gara."),
    ],
  },

  // ═══ SETTIMANA 10 · TAPER + GARA ══════════════════════════════════════════
  {
    mon: "2026-09-28", totalKm: 28,
    cells: [
      easy(4, "TAPER (−58% sul picco). Da qui in poi il lavoro è già fatto: si tratta solo di arrivare riposato."),
      reps(5, 800, 7, "2:30", "Metà delle ripetute del picco, STESSO ritmo gara e recupero più lungo. L'intensità si tiene, il volume no."),
      easy(4),
      {
        title: `Sblocco 2×1000 @ ${RG5K}`,
        dist: 5,
        pace: RG5K,
        desc:
          `2 km di riscaldamento, 2×1000 a ${RG5K}/km con 3′ di recupero, defaticamento sciolto. Ultimo richiamo ` +
          `del passo a gambe fresche: DEVE sembrare facile. Se sembra dura non è un problema di forma, è che il ` +
          `taper non ha ancora finito il suo lavoro. Da oggi: idratazione, carboidrati, sonno.`,
      },
      null,
      {
        title: "Sciolto 3 km + 4 allunghi",
        dist: 3,
        pace: EASY,
        desc:
          "3 km sciolti + 4 allunghi progressivi da 80 m. Rifinitura: scarica le gambe e tiene sveglio il sistema " +
          "nervoso. Controlla il meteo di domani e punta all'orario più fresco.",
      },
      {
        title: "🏁 GARA 5K · sub 20:00",
        dist: 5,
        pace: RG5K,
        desc:
          "GIORNO GARA. Riscaldamento 15′ + 4 allunghi. Strategia a negativo: 4:01-4:02 il primo km (MAI più " +
          "veloce), 4:00 nei km centrali, dal quarto km svuota tutto. Split ideale 4:02 / 4:00 / 4:00 / 3:59 / a " +
          "tutta = 19:5x. Con 5-11°C il motore vale la sub-20; sopra i 22°C il caldo si porta via 3-5 sec/km, " +
          "valuta di spostare di qualche giorno.",
      },
    ],
  },
];

function mk(date: string, type: string, c: NonNullable<Cell>): Session {
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

/** Piano ancorato alla partenza di default. */
export const KIKKO_SUB20_SESSIONS: Session[] = WEEKS.flatMap((w) =>
  w.cells.flatMap((cell, i) => {
    const slot = SLOTS[i];
    if (!cell || slot.type === "rest") return [];
    return [mk(addDays(w.mon, slot.offset), slot.type, cell)];
  }),
);

export const KIKKO_SUB20_DEFAULT_START = KIKKO_SUB20_META.startDate;

/** Giorni fra la prima seduta e la gara: 9 settimane piene + domenica = 69. */
const KIKKO_RACE_OFFSET_DAYS = (KIKKO_SUB20_META.weeks - 1) * 7 + 6;

/** Ricostruisce il piano a partire ESATTAMENTE dal lunedì scelto. */
export function buildKikkoSub20Sessions(startDate?: string | null): Session[] {
  const start = startDate || KIKKO_SUB20_DEFAULT_START;
  const delta = daysBetween(KIKKO_SUB20_DEFAULT_START, start);
  if (delta === 0) return KIKKO_SUB20_SESSIONS;
  return KIKKO_SUB20_SESSIONS.map((s) => {
    const date = addDays(s.date, delta);
    return { ...s, date, day: itDayName(date) };
  });
}

/** Data della gara (ultima seduta) per una data partenza. */
export function kikkoSub20RaceDate(startDate?: string | null): string {
  return addDays(startDate || KIKKO_SUB20_DEFAULT_START, KIKKO_RACE_OFFSET_DAYS);
}

/** Volume settimanale dichiarato, per grafici e verifiche. */
export const KIKKO_SUB20_WEEKLY_KM: number[] = WEEKS.map((w) => w.totalKm);

/**
 * Somma reale dei km per settimana, ricavata dalle sedute. Serve al test di
 * coerenza: se una cella viene modificata e il totale non torna più, si vede.
 */
export function kikkoSub20ActualWeeklyKm(): number[] {
  return WEEKS.map((w) =>
    w.cells.reduce((sum, c) => sum + (c?.dist ?? 0), 0),
  );
}

export const KIKKO_SUB20_LEGEND: { color: string; label: string; opacity?: number }[] = [
  { color: "#EF4444", label: "Intensa 1 · intervalli a ritmo gara" },
  { color: "#F97316", label: "Intensa 2 · resistenza / soglia" },
  { color: "#6B7280", label: "Facile · supporto" },
  { color: "#10B981", label: "Lungo" },
  { color: "#2A2A2A", label: "Riposo", opacity: 0.3 },
];
