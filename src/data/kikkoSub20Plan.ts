import type { Session } from "../types/api";

/**
 * kikkoSub20 — piano 5K sub-20:00 su 10 settimane.
 *
 * Impostazione richiesta dall'atleta:
 *  · QUATTRO uscite a settimana: 2 di qualità + 2 lente.
 *  · Settimana 1 a 32 km, poi sempre a salire con la regola del 10%.
 *  · Seduta 1 — intervalli brevi: da 6×600 m a 10×800 m, sempre a ritmo gara 5K.
 *  · Seduta 2 — resistenza a ritmo gara nelle settimane dispari: 3×2 km, con il
 *    recupero che si accorcia ogni 14 giorni. Nelle settimane pari la seconda
 *    seduta è una soglia: tiene il conto di "due qualità" senza aggiungere un
 *    secondo stimolo VO2max, che a questo volume non si recupera.
 *  · Taper negli ultimi 7-10 giorni: volume −58%, intensità INVARIATA a ritmo
 *    gara ma con molte meno ripetizioni.
 *
 * Ritmo gara 5K (RG5K) = 4:00/km → obiettivo 19:58.
 *
 * ── I RECUPERI ──────────────────────────────────────────────────────────────
 * Il criterio è il RAPPORTO LAVORO:RECUPERO, non un numero a caso.
 *
 * A 4:00/km una ripetuta dura: 600 m = 2:24 · 800 m = 3:12 · 2 km = 8:00.
 *
 * Sugli intervalli brevi il recupero parte vicino a 1:1 e si accorcia dentro
 * il blocco. Il razionale (Daniels, Running Formula: sul lavoro a ritmo
 * intervallo il recupero non deve superare la durata della ripetuta) è che con
 * un recupero incompleto il consumo di ossigeno resta alto anche nella pausa,
 * quindi il tempo utile ad alta intensità si accumula invece di azzerarsi.
 * Recuperi più lunghi trasformerebbero la seduta in un lavoro di velocità pura,
 * che per la 5K non serve.
 *
 *   600 m  W1 2:20 (1:0.97) · W2 2:10 (0.90) · W3 2:00 (0.83) · W4 1:50 (0.76)
 *   800 m  W5 3:10 (1:0.99) · W6 2:50 (0.89) · W7 2:35 (0.81) · W8 2:20 (0.73)
 *          W9 2:10 (0.68)
 *
 * Il rapporto si RIAZZERA a ~1:1 quando la ripetuta si allunga da 600 a 800 m
 * (settimana 5): distanza nuova, stimolo nuovo, si riparte dal recupero pieno.
 *
 * Sui 3×2 km il rapporto è molto più stretto (da 1:0.38 a 1:0.22) perché lì
 * l'obiettivo non è il VO2max ma la capacità di RIPRENDERE il ritmo gara con le
 * gambe già cariche, che è ciò che succede al terzo chilometro di gara.
 *
 * Il passo è fisso a ritmo gara per definizione, quindi la progressione non può
 * passare dalla velocità: passa dal numero di ripetute e dal recupero che si
 * accorcia. Sono le uniche due leve rimaste.
 *
 * ── VOLUME ──────────────────────────────────────────────────────────────────
 *   32 · 35 · 38 · 42 · 46 · 50 · 55 · 60 · 66 · 28 (taper)
 * Ogni incremento sta fra +8.6% e +10.6% (i km sono interi, da qui
 * l'arrotondamento). Nessuna settimana di scarico: la progressione è monotona
 * fino al picco, poi si scarica solo col taper.
 *
 * ⚠ Su quattro uscite, 66 km di picco significano una media di 16,5 km a
 * seduta, con il lungo che arriva a 23 km. Per un piano da 5K è tanto, ed è la
 * conseguenza diretta di tenere insieme "66 km di picco" e "4 giorni". Se il
 * corpo protesta, la leva giusta è abbassare il picco o aggiungere una quinta
 * uscita lenta, non tagliare le sedute di qualità.
 *
 * ── SETTIMANA ───────────────────────────────────────────────────────────────
 *   Martedì  → QUALITÀ 1 · intervalli brevi   (intervals · rosso)
 *   Giovedì  → QUALITÀ 2 · resistenza o soglia (tempo · arancio)
 *   Sabato   → lenta                           (recovery · grigio)
 *   Domenica → lungo lento                     (long · verde)
 * Lunedì, mercoledì e venerdì: riposo o attività non di corsa.
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

const RG5K = "4:00";   // ritmo gara 5K, a temperatura ideale
const SOGLIA = "4:18"; // soglia ~RG + 18 sec/km
const EASY = "5:40";
const LONG = "5:30";

/* ── TEMPERATURA ────────────────────────────────────────────────────────────
 * I ritmi scritti sopra valgono al fresco. A 26°C nessuno chiude 6×600 a
 * 4:00/km: il sangue va alla pelle a raffreddare invece che ai muscoli, e
 * inseguire un target scritto per novembre a luglio significa solo fallire la
 * seduta o cuocersi. Il piano quindi si scrive nella temperatura del giorno.
 *
 * Il rallentamento segue il modello di Ely (2007), lo stesso del generatore di
 * piani del backend: nullo fino a 15°C, +1,2 s/km per grado fino a 22°C, +1,8
 * fino a 28°C, +2,5 oltre. Applicato al centro di ogni fascia.
 */
export type TempBandId = "ideale" | "media" | "alta";
export interface TempBand {
  id: TempBandId;
  label: string;
  range: string;
  /** Secondi/km da aggiungere ai ritmi di qualità. */
  paceAdjSec: number;
  /** Secondi/km sui lenti: il caldo pesa anche lì, ma meno. */
  easyAdjSec: number;
  /** Secondi in più di recupero fra le ripetute. */
  recAdjSec: number;
  note: string;
}

export const KIKKO_SUB20_TEMP_BANDS: TempBand[] = [
  {
    id: "ideale", label: "Ideale", range: "5-11°C",
    paceAdjSec: 0, easyAdjSec: 0, recAdjSec: 0,
    note: "Condizioni da primato: i ritmi del piano sono scritti qui.",
  },
  {
    id: "media", label: "Media", range: "12-19°C",
    paceAdjSec: 3, easyAdjSec: 5, recAdjSec: 10,
    note: "Si perde qualche secondo al km, il recupero si allunga di dieci.",
  },
  {
    id: "alta", label: "Alta", range: "20-30°C",
    paceAdjSec: 16, easyAdjSec: 20, recAdjSec: 30,
    note: "La qualità va spostata all'alba. Se il passo scivola oltre il target, chiudi la serie una ripetuta prima: il caldo è già lo stimolo.",
  },
];

/**
 * Temperatura mese per mese, mediana delle SUE corse a Roma (485 uscite con
 * dato meteo, all'ora in cui si allena davvero). Meglio di una media climatica
 * generica: chi corre alle 8 del mattino non vive i 33°C del pomeriggio.
 * Dicembre e gennaio hanno pochi dati e sono allineati a febbraio/novembre.
 */
const ROME_MONTH_C = [5, 7, 10, 12, 15, 22, 21, 23, 16, 13, 9, 6];

export function romeTempForDate(iso: string): number {
  const m = Number(iso.slice(5, 7));
  return ROME_MONTH_C[Math.min(11, Math.max(0, m - 1))] ?? 18;
}

export function tempBandForTemp(tempC: number): TempBand {
  if (tempC <= 11) return KIKKO_SUB20_TEMP_BANDS[0];
  if (tempC <= 19) return KIKKO_SUB20_TEMP_BANDS[1];
  return KIKKO_SUB20_TEMP_BANDS[2];
}

/** Fascia attesa nel giorno della seduta, dalle medie climatiche di Roma. */
export function tempBandForDate(iso: string): TempBand {
  return tempBandForTemp(romeTempForDate(iso));
}

const paceToSec = (p: string): number => {
  const [m, s] = p.split(":").map(Number);
  return m * 60 + s;
};
const secToPace = (sec: number): string => {
  const total = Math.round(sec);           // arrotonda il totale: mai ":60"
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
};
const shiftPace = (p: string, sec: number): string => secToPace(paceToSec(p) + sec);

/** I ritmi del giorno, già corretti per la fascia. */
interface Paces { band: TempBand; rg: string; soglia: string; easy: string; long: string; tempC: number }

function pacesFor(iso: string): Paces {
  const tempC = romeTempForDate(iso);
  const band = tempBandForTemp(tempC);
  return {
    band, tempC,
    rg: shiftPace(RG5K, band.paceAdjSec),
    soglia: shiftPace(SOGLIA, band.paceAdjSec),
    easy: shiftPace(EASY, band.easyAdjSec),
    long: shiftPace(LONG, band.easyAdjSec),
  };
}

/** Frase che spiega perché il ritmo del giorno non è quello di riferimento. */
function heatNote(p: Paces, base: string, adjusted: string): string {
  if (p.band.paceAdjSec === 0) return "";
  return ` Riferimento a freddo ${base}/km: oggi si corre a ${adjusted} perché a Roma in questo periodo si trovano ~${p.tempC}°C (fascia ${p.band.label.toLowerCase()}, ${p.band.range}).`;
}

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

/**
 * Riporta una data qualsiasi al lunedì della sua settimana.
 *
 * Il piano è ancorato al lunedì: le uscite cadono martedì, giovedì, sabato e
 * domenica. Se la data di partenza è un altro giorno, l'intero calendario
 * slitta e le qualità finiscono su giorni sbagliati — è successo davvero,
 * perché sul database era rimasta salvata la partenza del vecchio piano Sub-20
 * (un martedì) e la settimana 1 usciva spostata di un giorno rispetto a tutte
 * le altre.
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

type Cell = { title: string; dist: number; pace: string | null; desc: string };
/** Una seduta si scrive solo quando si sa che temperatura farà quel giorno. */
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

const easy = (dist: number, extra = ""): CellFn => (p) => ({
  title: `Lenta ${dist} km`,
  dist,
  pace: p.easy,
  desc:
    `${dist} km davvero lenti (${p.easy}-${shiftPace(p.easy, 15)}). Esiste per sostenere le due sedute di ` +
    `qualità, non per aggiungere fatica: devi poter parlare a frasi intere dall'inizio alla fine.` +
    `${extra ? " " + extra : ""}`,
});

const longRun = (dist: number, extra = ""): CellFn => (p) => ({
  title: `Lungo ${dist} km`,
  dist,
  pace: p.long,
  desc:
    `${dist} km in conversazione (${p.long}-${shiftPace(p.long, 15)}). Base aerobica: è la cilindrata che regge ` +
    `le ripetute del martedì. Su quattro uscite il lungo porta molto volume, quindi vai piano davvero.` +
    `${extra ? " " + extra : ""}`,
});

/**
 * Qualità 1 — intervalli brevi a ritmo gara.
 * Il recupero è nel titolo, non solo nella descrizione: senza, la seduta non è
 * eseguibile guardando il calendario.
 */
const reps = (n: number, meters: number, dist: number, rec: string, extra = ""): CellFn => (p) => {
  const workSec = (meters / 1000) * paceToSec(p.rg);
  const recSec = paceToSec(rec) + p.band.recAdjSec;
  const recStr = secToPace(recSec);
  const ratio = (recSec / workSec).toFixed(2);
  return {
    title: `${n}×${meters} m @ ${p.rg} · rec ${recStr}`,
    dist,
    pace: p.rg,
    desc:
      `2 km di riscaldamento + 3 allunghi, poi ${n}×${meters} m a ${p.rg}/km con ${recStr} di jog lento fra una ` +
      `ripetuta e l'altra, 1,5 km di defaticamento. Ogni ripetuta dura circa ${secToPace(workSec)}, quindi il ` +
      `rapporto lavoro:recupero è 1:${ratio}. Passo COSTANTE su tutte: se l'ultima è la più veloce hai fatto ` +
      `centro, se la prima è la più veloce sei partito troppo forte.` +
      `${heatNote(p, RG5K, p.rg)}${extra ? " " + extra : ""}`,
  };
};

/** Qualità 2 — resistenza al ritmo gara, settimane dispari. */
const longReps = (rec: string, dist: number, extra = ""): CellFn => (p) => {
  const workSec = 2 * paceToSec(p.rg);
  const recSec = paceToSec(rec) + p.band.recAdjSec;
  const recStr = secToPace(recSec);
  const ratio = (recSec / workSec).toFixed(2);
  return {
    title: `3×2 km @ ${p.rg} · rec ${recStr}`,
    dist,
    pace: p.rg,
    desc:
      `2 km di riscaldamento, poi 3×2 km a ${p.rg}/km con ${recStr} di recupero fra una serie e l'altra, 1,5 km ` +
      `di defaticamento. Ogni serie dura ${secToPace(workSec)}, quindi il rapporto lavoro:recupero è 1:${ratio}: volutamente ` +
      `stretto, perché qui non si cerca il VO2max ma la capacità di RIPRENDERE il ritmo gara con le gambe già ` +
      `cariche — quello che succede al terzo chilometro di gara. Torna ogni 14 giorni con il recupero più ` +
      `corto.${heatNote(p, RG5K, p.rg)}${extra ? " " + extra : ""}`,
  };
};

/** Qualità 2 — soglia, settimane pari. */
const tempo = (minutes: number, dist: number, extra = ""): CellFn => (p) => ({
  title: `Soglia ${minutes}′ @ ${p.soglia}`,
  dist,
  pace: p.soglia,
  desc:
    `2 km facili + allunghi, poi ${minutes}′ continui a ${p.soglia}/km senza pause, 1,5 km di defaticamento. ` +
    `Soglia = sforzo che potresti quasi tenere per un'ora. Nelle settimane senza 3×2 km è questa la seconda ` +
    `seduta di qualità: sostiene il ritmo gara senza un secondo stimolo VO2max da recuperare.` +
    `${heatNote(p, SOGLIA, p.soglia)}${extra ? " " + extra : ""}`,
});

const WEEKS: WeekDef[] = [
  // ═══ BLOCCO 1 · INGRESSO · ripetute da 600 m ══════════════════════════════
  {
    mon: "2026-07-27", totalKm: 32,
    cells: [
      reps(6, 600, 9, "2:20", "Prima seduta del piano: 3,6 km di lavoro. Deve finire con la sensazione di poterne fare altre due."),
      longReps("3:00", 10, "Recupero pieno alla prima uscita: serve a imparare il ritmo, non a soffrire."),
      easy(6, "Prima lenta: parti deliberatamente piano."),
      longRun(7, "Il lungo parte corto e cresce ogni settimana."),
    ],
  },
  {
    mon: "2026-08-03", totalKm: 35,
    cells: [
      reps(7, 600, 10, "2:10", "Una ripetuta in più e dieci secondi di recupero in meno: la progressione è qui, il passo non si tocca."),
      tempo(20, 8),
      easy(8),
      longRun(9),
    ],
  },
  {
    mon: "2026-08-10", totalKm: 38,
    cells: [
      reps(8, 600, 10, "2:00", "8×600 = 4,8 km a ritmo gara."),
      longReps("2:30", 10, "Secondo giro dei 3×2 km: mezzo minuto di recupero in meno rispetto alla settimana 1."),
      easy(8),
      longRun(10),
    ],
  },
  {
    mon: "2026-08-17", totalKm: 42,
    cells: [
      reps(9, 600, 11, "1:50", "Ultima settimana sui 600: nove ripetute e recupero sotto i due minuti."),
      tempo(25, 9, "La soglia sale a 25′ continui."),
      easy(10),
      longRun(12),
    ],
  },

  // ═══ BLOCCO 2 · si passa agli 800 m ═══════════════════════════════════════
  {
    mon: "2026-08-24", totalKm: 46,
    cells: [
      reps(6, 800, 10, "3:10", "La ripetuta si allunga da 600 a 800 m: il numero riparte da 6 e il recupero torna pieno (1:1). Distanza nuova, si ricomincia da capo."),
      longReps("2:15", 10, "Terzo giro dei 3×2 km."),
      easy(12),
      longRun(14),
    ],
  },
  {
    mon: "2026-08-31", totalKm: 50,
    cells: [
      reps(7, 800, 11, "2:50"),
      tempo(30, 11, "Trenta minuti continui di soglia: il motore che regge i 4:00 in gara si costruisce qui."),
      easy(13),
      longRun(15),
    ],
  },
  {
    mon: "2026-09-07", totalKm: 55,
    cells: [
      reps(8, 800, 12, "2:35", "8×800 = 6,4 km a ritmo gara: più della distanza di gara, frazionata."),
      longReps("2:00", 10, "Quarto giro: due minuti di recupero. Inizia a somigliare a una gara."),
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
      reps(10, 800, 14, "2:10", "LA SEDUTA DEL PIANO: 10×800 = 8 km a ritmo gara con recupero ridotto a 1:0.68. Se la chiudi con passo costante, la sub-20 è nelle gambe."),
      longReps("1:45", 10, "Ultimo giro dei 3×2 km, recupero minimo. È il test finale della tenuta."),
      easy(19),
      longRun(23, "Ultimo lungo pieno: da qui si scarica verso la gara."),
    ],
  },

  // ═══ SETTIMANA 10 · TAPER + GARA ══════════════════════════════════════════
  {
    mon: "2026-09-28", totalKm: 28,
    cells: [
      reps(5, 800, 9, "3:15", "TAPER (−58% sul picco). Metà delle ripetute del picco, stesso ritmo gara e recupero PIÙ LUNGO del solito: qui l'obiettivo è la freschezza, non lo stimolo. L'intensità si tiene, il volume no."),
      (p) => ({
        title: `Sblocco 2×1000 @ ${p.rg} · rec 3:00`,
        dist: 7,
        pace: p.rg,
        desc:
          `2 km di riscaldamento, 2×1000 a ${p.rg}/km con 3′ di recupero, defaticamento sciolto. Ultimo richiamo ` +
          `del passo a gambe fresche: DEVE sembrare facile. Se sembra dura non è un problema di forma, è che il ` +
          `taper non ha ancora finito il suo lavoro. Da oggi: idratazione, carboidrati, sonno.` +
          `${heatNote(p, RG5K, p.rg)}`,
      }),
      (p) => ({
        title: "Sciolto 5 km + 4 allunghi",
        dist: 5,
        pace: p.easy,
        desc:
          "5 km sciolti + 4 allunghi progressivi da 80 m. Rifinitura: scarica le gambe e tiene sveglio il " +
          "sistema nervoso. Controlla il meteo di domani e punta all'orario più fresco.",
      }),
      (p) => ({
        // il titolo resta l'obiettivo: la previsione onesta sta nel testo
        title: "🏁 GARA 5K · sub 20:00",
        dist: 7,
        pace: p.rg,
        desc:
          `GIORNO GARA. Riscaldamento 15′ + 4 allunghi (i 7 km comprendono riscaldamento e defaticamento). ` +
          `Strategia a negativo: ${shiftPace(p.rg, 2)} il primo km (MAI più veloce), ${p.rg} nei km centrali, ` +
          `dal quarto km svuota tutto. Con 5-11°C il motore vale la sub-20 (4:00/km); a ~${p.tempC}°C il passo ` +
          `realistico è ${p.rg}/km, cioè ${secToPace(paceToSec(p.rg) * 5)}. Se il meteo del giorno è più fresco ` +
          `del previsto, il tempo scende con lui: guarda la temperatura la mattina stessa e scegli il passo lì.`,
      }),
    ],
  },
];

function mk(date: string, type: string, cell: CellFn): Session {
  // La seduta si scrive sulla temperatura attesa QUEL giorno: le ripetute di
  // agosto e quelle di ottobre non possono avere lo stesso target.
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

/** Data della gara (ultima seduta) per una data partenza. */
export function kikkoSub20RaceDate(startDate?: string | null): string {
  return addDays(kikkoSub20NormalizeStart(startDate), KIKKO_RACE_OFFSET_DAYS);
}

/** Volume settimanale dichiarato, per grafici e verifiche. */
export const KIKKO_SUB20_WEEKLY_KM: number[] = WEEKS.map((w) => w.totalKm);

/** Somma reale dei km per settimana, ricavata dalle sedute. */
export function kikkoSub20ActualWeeklyKm(): number[] {
  // le distanze non dipendono dalla temperatura: basta una fascia qualsiasi
  const ref = pacesFor(WEEKS[0].mon);
  return WEEKS.map((w) => w.cells.reduce((sum, c) => sum + c(ref).dist, 0));
}

export const KIKKO_SUB20_LEGEND: { color: string; label: string; opacity?: number }[] = [
  { color: "#EF4444", label: "Qualità 1 · intervalli a ritmo gara" },
  { color: "#F97316", label: "Qualità 2 · resistenza o soglia" },
  { color: "#6B7280", label: "Lenta" },
  { color: "#10B981", label: "Lungo" },
  { color: "#2A2A2A", label: "Riposo", opacity: 0.3 },
];
