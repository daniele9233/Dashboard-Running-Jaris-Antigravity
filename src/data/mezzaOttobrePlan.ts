import type { Session } from "../types/api";

/**
 * PIANO: TEST 5 KM IL 10 OTTOBRE, MEZZA MARATONA IL 18.
 *
 * Versione del 16 settembre 2026, rifatta dopo il 5×1000. Scritto a mano e
 * trascritto così com'è: cinque settimane dal 14 settembre, corsa e cyclette,
 * due verifiche lungo la strada e due appuntamenti. Nessun motore sotto: le
 * date sono fisse e i ritmi sono quelli scritti.
 *
 * Il file sostituisce kikkoSub20 nella pagina Training. Due cose sono pensate
 * anche per le macchine:
 *   - `adherence` è la stessa seduta scritta nel formato che l'esito automatico
 *     sa leggere ("6×800 m @ 3:57/km", "8 km continui @ 4:47/km"): il titolo
 *     resta quello del piano, l'aderenza legge questa riga;
 *   - `PLAN_GOALS` sono i due obiettivi, per chi calcola date e probabilità.
 */

export type PlanKind = "rest" | "easy" | "long" | "key" | "quality" | "test" | "race" | "bike";

export interface PlanDay {
  date: string;
  kind: PlanKind;
  title: string;
  detail?: string;
  /** Chilometri di corsa della giornata. */
  km?: number;
  /** Già corsa quando il piano è stato scritto. */
  done?: boolean;
  /** "Spostato da giovedì." */
  moved?: string;
  /** Il controllo che decide se l'obiettivo regge. */
  verify?: string;
  /** Seduta chiave: in lista si legge più grande. */
  big?: boolean;
  /** Rimanda a un approfondimento della pagina. */
  more?: "test" | "gara";
  /**
   * La seduta per l'esito automatico. Assente sui giorni in cui non c'è una
   * corsa da giudicare (bici, riposo) o dove un giudizio sul passo sarebbe
   * sbagliato (il lungo con il finale a ritmo).
   */
  adherence?: { title: string; description?: string };
}

export interface PlanWeek {
  n: number;
  dates: string;
  km: string;
  days: PlanDay[];
}

export const PLAN_META = {
  id: "mezza-ottobre-2026",
  name: "Test 5 km e mezza",
  version: "Versione del 16 settembre, rifatta dopo i 5×1000.",
  start: "2026-09-14",
  end: "2026-10-18",
};

/** Le due targhe in testa alla pagina. */
export const PLAN_BIBS = [
  { id: "5k", value: "19:59", title: "Test 5 km", when: "sabato 10 ottobre", band: "#F2644F" },
  { id: "hm", value: "4:47", title: "Mezza maratona, passo al km", when: "domenica 18 ottobre", band: "#F0A040" },
] as const;

/** Gli obiettivi in forma di numeri: 19:59 sui 5 km, 4:47 al km sui 21,0975. */
export const PLAN_GOALS = [
  { id: "test-5k", label: "Test 5 km in 19:59", distM: 5000, targetSec: 19 * 60 + 59, dateIso: "2026-10-10" },
  { id: "mezza", label: "Mezza a 4:47/km", distM: 21097.5, targetSec: Math.round(287 * 21.0975), dateIso: "2026-10-18" },
];

/** Colori in ordine di zona, come sul Garmin: dal grigio del riposo al rosso. */
export const PLAN_KINDS: Record<PlanKind, { label: string; color: string }> = {
  rest: { label: "riposo", color: "#8994A0" },
  easy: { label: "lento", color: "#5C9BEB" },
  long: { label: "lungo", color: "#3DBA80" },
  key: { label: "ritmo mezza", color: "#F0A040" },
  quality: { label: "ripetute", color: "#F2644F" },
  test: { label: "test", color: "#F2644F" },
  race: { label: "gara", color: "#F0A040" },
  bike: { label: "bici", color: "#A08BEA" },
};
export const PLAN_LEGEND: PlanKind[] = ["rest", "easy", "long", "key", "quality", "bike"];

export const PLAN_WEEKS: PlanWeek[] = [
  {
    n: 1, dates: "14–20 settembre", km: "~42 km",
    days: [
      { date: "2026-09-14", kind: "bike", title: "Cyclette B1 65'", done: true },
      { date: "2026-09-15", kind: "easy", title: "Lento 8 km", detail: "5:58 al km, FC media 130.", km: 8, done: true,
        adherence: { title: "Lento 8 km" } },
      { date: "2026-09-16", kind: "quality", title: "5×1000, recupero 2'", km: 10.4, done: true,
        detail: "Ripetute tra 3:56 e 4:02, media 3:58. FC a fine ripetuta 154–165.", moved: "Spostato da giovedì.",
        adherence: { title: "5×1000 m", description: "5×1000 m @ 3:58/km, recupero 2′" } },
      { date: "2026-09-17", kind: "bike", title: "Cyclette facile 45–60'", detail: "FC sotto 130." },
      { date: "2026-09-18", kind: "bike", title: "Cyclette B1 45' o riposo", detail: "FC fino a 118." },
      { date: "2026-09-19", kind: "easy", title: "Lento 8 km + 6 allunghi da 100 m", detail: "FC fino a 138.", km: 8,
        adherence: { title: "Lento 8 km" } },
      { date: "2026-09-20", kind: "long", title: "Lungo 16 km", detail: "A 5:15–5:35 con FC 135–145. Ultimi 3 km a 4:50.", km: 16, big: true,
        adherence: { title: "Lungo 16 km" } },
    ],
  },
  {
    n: 2, dates: "21–27 settembre", km: "49,5 km",
    days: [
      { date: "2026-09-21", kind: "bike", title: "Cyclette: 3×10' in B4",
        detail: "20' in B1, poi 3×10' a FC 140–148 con 5' di recupero in B1, 15' di defaticamento. Solo se dopo il lungo hai le gambe fresche; altrimenti B2 per 60'." },
      { date: "2026-09-22", kind: "easy", title: "Lento 10 km", detail: "FC fino a 138.", km: 10,
        adherence: { title: "Lento 10 km" } },
      { date: "2026-09-23", kind: "bike", title: "Cyclette B2 60'", detail: "FC 118–130." },
      { date: "2026-09-24", kind: "quality", title: "6×800 a 3:55–3:58", km: 11.5, big: true,
        detail: "3 km di riscaldamento, 6×800 con 2' di recupero, 2 km di defaticamento. Con la fascia H10.",
        adherence: { title: "6×800 m", description: "6×800 m @ 3:57/km, recupero 2′" } },
      { date: "2026-09-25", kind: "bike", title: "Cyclette B1 40'" },
      { date: "2026-09-26", kind: "easy", title: "Lento 10 km + 6 allunghi", detail: "FC fino a 138.", km: 10,
        adherence: { title: "Lento 10 km" } },
      { date: "2026-09-27", kind: "long", title: "Lungo 18 km, ultimi 5 a 4:47", km: 18, big: true,
        detail: "Prima parte a 5:15–5:25, poi 5 km a ritmo mezza con FC 145–152.",
        verify: "Verifica 1: se il passo cede negli ultimi 2 km, l'obiettivo della mezza scende verso 4:52.",
        adherence: { title: "Lungo 18 km" } },
    ],
  },
  {
    n: 3, dates: "28 settembre – 4 ottobre", km: "49 km",
    days: [
      { date: "2026-09-28", kind: "bike", title: "Cyclette B1 45'" },
      { date: "2026-09-29", kind: "easy", title: "Lento 10 km", detail: "FC fino a 138.", km: 10,
        adherence: { title: "Lento 10 km" } },
      { date: "2026-09-30", kind: "bike", title: "Cyclette B2 50' o riposo" },
      { date: "2026-10-01", kind: "key", title: "8 km a ritmo mezza", km: 13, big: true,
        detail: "3 km di riscaldamento, 8 km continui a 4:47, 2 km di defaticamento. Con la fascia H10.", moved: "Spostato da giovedì 8.",
        verify: "Verifica 2: deve finire a fatica 7 con FC stabile sotto 152. Se chiudi a fatica 8,5 o sopra 158 negli ultimi km, il ritmo realistico per la mezza è 4:52–4:55.",
        adherence: { title: "8 km a ritmo mezza", description: "8 km continui @ 4:47/km" } },
      { date: "2026-10-02", kind: "bike", title: "Cyclette B1 40'" },
      { date: "2026-10-03", kind: "easy", title: "Lento 6 km", km: 6, adherence: { title: "Lento 6 km" } },
      { date: "2026-10-04", kind: "long", title: "Lungo 20 km, tutto lento", detail: "A 5:20–5:35 con FC 135–145. Nessun finale veloce.", km: 20, big: true,
        adherence: { title: "Lungo 20 km" } },
    ],
  },
  {
    n: 4, dates: "5–11 ottobre", km: "41 km",
    days: [
      { date: "2026-10-05", kind: "bike", title: "Cyclette B1 45'", detail: "Al posto dei 6×3' in B5." },
      { date: "2026-10-06", kind: "easy", title: "Lento 8 km", km: 8, adherence: { title: "Lento 8 km" } },
      { date: "2026-10-07", kind: "quality", title: "Rifinitura: 3×1000 a 4:00", km: 9, big: true,
        detail: "3 km di riscaldamento, 3×1000 con 2'30\" di recupero, 2 km di defaticamento. Deve sembrarti controllato: fatica 7, mai sotto 3:58.",
        adherence: { title: "3×1000 m", description: "3×1000 m @ 4:00/km, recupero 2′30″" } },
      { date: "2026-10-08", kind: "rest", title: "Riposo o cyclette B1 30'" },
      { date: "2026-10-09", kind: "easy", title: "5 km sciolti + 4×200 a 3:40", km: 6, adherence: { title: "5 km sciolti" } },
      { date: "2026-10-10", kind: "test", title: "Test 5 km", km: 10, big: true, more: "test",
        detail: "3 km di riscaldamento e 4 allunghi, 5 km al massimo, 2 km di defaticamento.",
        adherence: { title: "Test 5 km", description: "5 km continui @ 4:00/km" } },
      { date: "2026-10-11", kind: "easy", title: "Lento 8 km", detail: "Niente finale veloce.", km: 8, adherence: { title: "Lento 8 km" } },
    ],
  },
  {
    n: 5, dates: "12–18 ottobre", km: "17 km + gara",
    days: [
      { date: "2026-10-12", kind: "rest", title: "Riposo" },
      { date: "2026-10-13", kind: "key", title: "Lento 8 km con 3×1 km a 4:45", detail: "I 3 km a ritmo dentro la corsa, con 2' di recupero.", km: 8,
        adherence: { title: "3×1000 m", description: "3×1000 m @ 4:45/km, recupero 2′" } },
      { date: "2026-10-14", kind: "bike", title: "Riposo o cyclette leggera 30'" },
      { date: "2026-10-15", kind: "easy", title: "5 km sciolti + 6 allunghi", km: 5, adherence: { title: "5 km sciolti" } },
      { date: "2026-10-16", kind: "rest", title: "Riposo" },
      { date: "2026-10-17", kind: "easy", title: "4 km sciolti + 3×200 a ritmo mezza", km: 4, adherence: { title: "4 km sciolti" } },
      { date: "2026-10-18", kind: "race", title: "Mezza maratona", km: 21.1, big: true, more: "gara",
        adherence: { title: "Mezza maratona", description: "21,1 km continui @ 4:47/km" } },
    ],
  },
];

export const PLAN_DAYS: PlanDay[] = PLAN_WEEKS.flatMap((w) => w.days);
export const PLAN_DAY_BY_DATE: Record<string, PlanDay> = Object.fromEntries(PLAN_DAYS.map((d) => [d.date, d]));

export const PLAN_CHANGES = [
  "Il test 5 km passa da giovedì 1 a sabato 10 ottobre: nove giorni in più di preparazione e mattine più fresche.",
  "Gli 8 km a ritmo mezza passano da giovedì 8 a giovedì 1 ottobre.",
  "Il lungo del 27 settembre mantiene i 5 km finali a 4:47, perché il test non cade più quattro giorni dopo.",
  "In bici saltano i 6×3' del 5 ottobre. I 3×10' del 21 settembre si fanno solo con le gambe fresche.",
  "Le zone di frequenza cardiaca sono ricalcolate sui tuoi dati, e con loro i limiti di FC della gara.",
];

export interface ZoneRow { kind: PlanKind; name: string; pace: string; hr: string }
export const RUN_ZONES: ZoneRow[] = [
  { kind: "easy", name: "Lento", pace: "decide la FC", hr: "fino a 138" },
  { kind: "long", name: "Lungo", pace: "5:15–5:35", hr: "135–145" },
  { kind: "key", name: "Ritmo mezza", pace: "4:47", hr: "145–152 nei primi 10 km" },
  { kind: "key", name: "Soglia", pace: "4:20–4:25", hr: "150–160" },
  { kind: "quality", name: "Ritmo 5 km", pace: "4:00", hr: "155–168, sale durante la prova" },
  { kind: "quality", name: "Allunghi", pace: "3:40–3:50", hr: "non conta" },
];
export const BIKE_ZONES: ZoneRow[] = [
  { kind: "bike", name: "B1", pace: "recupero", hr: "fino a 118" },
  { kind: "bike", name: "B2", pace: "fondo", hr: "118–130" },
  { kind: "bike", name: "B3", pace: "medio", hr: "131–139" },
  { kind: "bike", name: "B4", pace: "soglia", hr: "140–148" },
  { kind: "bike", name: "B5", pace: "VO2max", hr: "da 150" },
];
export const ZONE_NOTES = {
  intro: "Calcolate sui tuoi lavori di giugno–agosto, con la soglia intorno a 155. Da confermare con la fascia H10 negli 800 del 24 settembre.",
  bike: "Le zone bici sono stime: in bici i battiti stanno 5–10 sotto la corsa. Pedala a 90–95 rpm.",
  heat: "Fino al 30 settembre, se T+DP supera 130, rallenta del 2–3% i ritmi di qualità. In ottobre la correzione è quasi nulla.",
};

export const TEST_5K = {
  before: [
    "Alphafly, prima mattina, percorso piatto oppure di andata e ritorno.",
    "Fascia H10: il valore più alto del finale è un minimo sicuro della tua FC massima.",
    "Caffeina solo se l'hai già provata in allenamento.",
  ],
  splits: [["km 1", "4:02"], ["km 2", "4:00"], ["km 3", "4:00"], ["km 4", "3:59"], ["km 5", "3:57"]] as const,
  after: [
    "Il primo km mai sotto 4:00: partire a 3:52 è l'errore che ti costa il tempo.",
    "Se al km 3 sei sopra 4:04, chiudi a 4:03–4:05. Il dato ti serve comunque.",
    "Nel test la FC non guida: si corre sugli split.",
    "Tra il test e la mezza ci sono otto giorni, abbastanza per recuperare un 5 km.",
  ],
};

export const RACE_HM = {
  segments: [
    { stretch: "km 1–5", pace: "4:52", hr: "sotto 150" },
    { stretch: "km 6–15", pace: "4:46", hr: "fino a 155 al km 10, fino a 160 al km 15" },
    { stretch: "km 16–21,1", pace: "4:43 o quello che resta", hr: "libera" },
  ],
  notes: [
    "I primi 5 km a 4:52 sembreranno lenti: servono a non crollare al km 16.",
    "Se al km 10 sei stabilmente sopra 155, passa a 4:55 e chiudi intorno a 1:43.",
    "Arrivo previsto intorno a 1:40:50, se le verifiche del 27 settembre e del 1° ottobre sono andate bene.",
  ],
};

export const AFTER_RACE = [
  "Test della FC massima con la H10, sul tapis roulant o in piano.",
  "Volume verso 45–50 km a settimana, con una settimana di scarico ogni 3–4.",
  "Forza due volte a settimana.",
];

const DOW = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/** "giovedì 1 ottobre". */
export function planDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DOW[dt.getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}

/** La settimana del piano che contiene quel giorno, o null fuori dal piano. */
export function planWeekOf(iso: string): PlanWeek | null {
  return PLAN_WEEKS.find((w) => w.days[0].date <= iso && iso <= w.days[w.days.length - 1].date) ?? null;
}

/**
 * La seduta da mostrare adesso: quella di oggi se non è già fatta, altrimenti
 * la prossima del calendario.
 */
export function nextPlanDay(todayIso: string): { day: PlanDay; isToday: boolean } | null {
  const today = PLAN_DAY_BY_DATE[todayIso];
  if (today && !today.done) return { day: today, isToday: true };
  const next = PLAN_DAYS.find((d) => d.date > todayIso);
  return next ? { day: next, isToday: false } : null;
}

/** Le sedute di corsa, nel formato che l'esito automatico sa giudicare. */
export function planRunSessions(): Session[] {
  return PLAN_DAYS.filter((d) => d.adherence).map((d) => ({
    day: DOW[new Date(d.date + "T00:00:00Z").getUTCDay()],
    date: d.date,
    type: d.kind === "quality" || d.kind === "test" ? "intervals" : d.kind === "key" || d.kind === "race" ? "tempo" : d.kind,
    title: d.adherence!.title,
    description: d.adherence!.description ?? "",
    target_distance_km: d.km ?? 0,
    target_pace: null,
    target_duration_min: null,
    completed: !!d.done,
    run_id: null,
  }));
}
