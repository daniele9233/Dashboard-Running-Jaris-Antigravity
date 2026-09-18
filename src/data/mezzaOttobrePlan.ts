import type { Session } from "../types/api";

/**
 * PIANO: MEZZA MARATONA IL 18 OTTOBRE.
 *
 * Versione del 18 settembre 2026. Il test 5 km del 10 ottobre è tolto: il
 * piano pensa solo alla mezza, la Rome Half Marathon (partenza a Porta
 * Ardeatina, arrivo al Colosseo). Scritto a mano e trascritto così com'è: cinque
 * settimane dal 14 settembre, una sola qualità a settimana (il mercoledì),
 * corsa lenta intorno, il lungo la domenica e la forza a casa — giubbotto da
 * 10 kg e manubri a dischi, niente palestra. Nessun motore sotto: le date sono
 * fisse e i ritmi sono quelli scritti.
 *
 * Due cose sono pensate anche per le macchine:
 *   - `adherence` è la stessa seduta scritta nel formato che l'esito automatico
 *     sa leggere ("3×3000 m @ 4:19/km", "8 km continui @ 4:26/km"): il titolo
 *     resta quello del piano, l'aderenza legge questa riga;
 *   - `PLAN_GOALS` è l'obiettivo, per chi calcola date e probabilità.
 */

export type PlanKind = "rest" | "easy" | "long" | "key" | "quality" | "race" | "bike" | "strength";

/** Le sedute a corpo libero e con i pesi di casa: vedi `ROUTINES`. */
export type RoutineId = "A" | "B" | "L" | "M";

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
  more?: "gara";
  /** La seduta di forza o di mobilità del giorno. */
  routine?: RoutineId;
  /**
   * La seduta per l'esito automatico. Assente sui giorni in cui non c'è una
   * corsa da giudicare (bici, forza, riposo) o dove un giudizio sul passo
   * sarebbe sbagliato (il lungo con il finale a ritmo).
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
  name: "Mezza del 18 ottobre",
  version: "Versione del 18 settembre: solo la mezza, con la forza a casa.",
  start: "2026-09-14",
  end: "2026-10-18",
};

/** La targa in testa alla pagina. */
export const PLAN_BIBS = [
  { id: "hm", value: "4:47", title: "Mezza maratona, passo al km", when: "domenica 18 ottobre", band: "#F0A040" },
] as const;

/** L'obiettivo in forma di numeri: 4:47 al km sui 21,0975. */
export const PLAN_GOALS = [
  { id: "mezza", label: "Mezza a 4:47/km", distM: 21097.5, targetSec: Math.round(287 * 21.0975), dateIso: "2026-10-18" },
];

/** Colori in ordine di zona, come sul Garmin: dal grigio del riposo al rosso. */
export const PLAN_KINDS: Record<PlanKind, { label: string; color: string }> = {
  rest: { label: "riposo", color: "#8994A0" },
  easy: { label: "lento", color: "#5C9BEB" },
  long: { label: "lungo", color: "#3DBA80" },
  key: { label: "medio", color: "#F0A040" },
  quality: { label: "ripetute", color: "#F2644F" },
  race: { label: "gara", color: "#F0A040" },
  bike: { label: "bici", color: "#A08BEA" },
  strength: { label: "forza", color: "#E07BB5" },
};
export const PLAN_LEGEND: PlanKind[] = ["rest", "easy", "long", "key", "quality", "bike", "strength"];

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
      { date: "2026-09-18", kind: "easy", title: "Lento 8 km, poi Forza leggera", km: 8, routine: "L",
        detail: "Gli 8 km di sabato, corsi oggi. La sera la prima seduta di forza: due giri leggeri e niente affondi, perché domenica c'è il lungo. Se salta, pazienza.",
        adherence: { title: "Lento 8 km" } },
      { date: "2026-09-19", kind: "bike", title: "Cyclette B1 20' o riposo",
        detail: "Niente corsa: gli 8 km li hai già corsi ieri. Correrli anche oggi porterebbe la settimana a 50 km, il doppio delle due precedenti." },
      { date: "2026-09-20", kind: "long", title: "Lungo 16 km, ultimi 4 a 4:50", km: 16, big: true,
        detail: "12 km a 5:20 con FC 135–145, poi 4 km a 4:50.",
        adherence: { title: "Lungo 16 km" } },
    ],
  },
  {
    n: 2, dates: "21–27 settembre", km: "47 km",
    days: [
      { date: "2026-09-21", kind: "strength", title: "Cyclette leggera 20' + Forza B", routine: "B",
        detail: "20' di cyclette facile come riscaldamento, poi la seduta B. È quella che indolenzisce meno: mercoledì c'è la qualità." },
      { date: "2026-09-22", kind: "easy", title: "Lento 8 km", detail: "FC fino a 138.", km: 8,
        adherence: { title: "Lento 8 km" } },
      { date: "2026-09-23", kind: "quality", title: "Cruise intervals: 3×3000 a 4:18–4:20", km: 15, big: true,
        detail: "3 km di riscaldamento, 3×3000 con 3' di corsa molto lenta (5:30) fra una e l'altra, 2 km di defaticamento. È l'allenamento re della mezza: blocchi lunghi per accumulare lavoro a soglia senza saturare i muscoli. In alternativa 4×2000 a 4:15–4:18 con 2'30\" di corsa lenta. Con la fascia H10.",
        verify: "Stop: se nel terzo 3000 la FC supera 162 o la fatica passa 8, chiudi a 2×3000. Finora il tuo blocco più lungo a soglia è di 6 km: il lavoro utile l'hai già fatto.",
        adherence: { title: "3×3000 m", description: "3×3000 m @ 4:19/km, recupero 3′" } },
      { date: "2026-09-24", kind: "strength", title: "Cyclette leggera 20' + Forza A", routine: "A",
        detail: "20' di cyclette facile come riscaldamento, poi la seduta A. Il giorno dopo la qualità e tre giorni prima del lungo: il tempo per smaltire l'indolenzimento c'è." },
      { date: "2026-09-25", kind: "rest", title: "Riposo" },
      { date: "2026-09-26", kind: "easy", title: "Lento 6 km + 6 allunghi", detail: "FC fino a 138.", km: 6,
        adherence: { title: "Lento 6 km" } },
      { date: "2026-09-27", kind: "long", title: "Lungo 18 km, ultimi 5 a 4:47", km: 18, big: true,
        detail: "13 km a 5:10, poi 5 km a ritmo mezza con FC 145–152. Porta un gel e prendilo al km 9, prima dei 5 km a ritmo: lo provi come in gara.",
        verify: "Verifica 1: se il passo cede negli ultimi 2 km, l'obiettivo della mezza scende verso 4:52.",
        adherence: { title: "Lungo 18 km" } },
    ],
  },
  {
    n: 3, dates: "28 settembre – 4 ottobre", km: "43 km",
    days: [
      { date: "2026-09-28", kind: "strength", title: "Forza leggera", routine: "L",
        detail: "L'ultima seduta di forza prima della gara: due giri, carichi da mantenimento. Niente cyclette questa settimana." },
      { date: "2026-09-29", kind: "easy", title: "Lento 8 km", detail: "FC fino a 138.", km: 8,
        adherence: { title: "Lento 8 km" } },
      { date: "2026-09-30", kind: "key", title: "Medio 8 km in progressione", km: 13, big: true,
        detail: "3 km di riscaldamento, 5 km a 4:30 e subito 3 km a 4:20, 2 km di defaticamento. Allena gambe e testa alla fatica continua della mezza. Con la fascia H10.",
        verify: "Verifica 2: se chiudi gli 8 km a fatica 8 o meno, il 4:47 in gara regge. Se per tenere 4:20 negli ultimi 3 km devi andare oltre, in gara parti a 4:52 e decidi al km 10.",
        adherence: { title: "Medio 8 km", description: "8 km continui @ 4:26/km" } },
      { date: "2026-10-01", kind: "rest", title: "Riposo" },
      { date: "2026-10-02", kind: "rest", title: "Riposo o mobilità 12'", routine: "M" },
      { date: "2026-10-03", kind: "easy", title: "Lento 6 km + 6 allunghi", detail: "FC fino a 138.", km: 6,
        adherence: { title: "Lento 6 km" } },
      { date: "2026-10-04", kind: "long", title: "Lungo 16 km, tutto a 5:15–5:20", km: 16, big: true,
        detail: "Con FC 135–145, nessun finale veloce: è la settimana che assorbe il lavoro. Se le gambe sono pesanti, fermati a 15.",
        adherence: { title: "Lungo 16 km" } },
    ],
  },
  {
    n: 4, dates: "5–11 ottobre", km: "30 km",
    days: [
      { date: "2026-10-05", kind: "rest", title: "Riposo + mobilità 12'", routine: "M",
        detail: "Da qui in poi niente forza: si scarica." },
      { date: "2026-10-06", kind: "easy", title: "Lento 7 km + 4 allunghi", detail: "FC fino a 138.", km: 7,
        adherence: { title: "Lento 7 km" } },
      { date: "2026-10-07", kind: "quality", title: "Ultima qualità: 3×2000 a 4:15–4:18", km: 12, big: true,
        detail: "3 km di riscaldamento, 3×2000 con 2'30\" di corsa lenta, 2 km di defaticamento. Undici giorni alla gara: deve restarti la voglia di farne un'altra. Dopo, solo brillantezza e scarico.",
        adherence: { title: "3×2000 m", description: "3×2000 m @ 4:17/km, recupero 2′30″" } },
      { date: "2026-10-08", kind: "bike", title: "Cyclette leggera 30' + mobilità", routine: "M", detail: "FC fino a 118." },
      { date: "2026-10-09", kind: "rest", title: "Riposo" },
      { date: "2026-10-10", kind: "rest", title: "Riposo" },
      { date: "2026-10-11", kind: "long", title: "Lungo 11 km con 6 allunghi", km: 11, big: true,
        detail: "A 5:15–5:30 con FC 135–145. Negli ultimi 2 km, 6 allunghi da 20\" a sensazione, senza forzare. Prova la colazione e il gel della gara.",
        adherence: { title: "Lungo 11 km" } },
    ],
  },
  {
    n: 5, dates: "12–18 ottobre", km: "15 km + gara",
    days: [
      { date: "2026-10-12", kind: "rest", title: "Riposo" },
      { date: "2026-10-13", kind: "key", title: "Lento 6 km con 3×1 km a 4:45", detail: "I 3 km a ritmo dentro la corsa, con 2' di recupero.", km: 6,
        adherence: { title: "3×1000 m", description: "3×1000 m @ 4:45/km, recupero 2′" } },
      { date: "2026-10-14", kind: "rest", title: "Riposo" },
      { date: "2026-10-15", kind: "easy", title: "5 km sciolti + 6 allunghi", km: 5, adherence: { title: "5 km sciolti" } },
      { date: "2026-10-16", kind: "rest", title: "Riposo, da stasera carboidrati",
        detail: "Da stasera a sabato sera 8–10 g di carboidrati per kg al giorno: pasta, riso, pane bianco, patate. Poche fibre e pochi grassi." },
      { date: "2026-10-17", kind: "easy", title: "4 km sciolti + 3×200 a ritmo mezza", km: 4,
        detail: "Carboidrati anche oggi, cena presto e niente di nuovo.", adherence: { title: "4 km sciolti" } },
      { date: "2026-10-18", kind: "race", title: "Mezza maratona di Roma", km: 21.1, big: true, more: "gara",
        detail: "Colazione 3 ore prima, 1–2 g di carboidrati per kg. Gel al km 8 e al km 15.",
        adherence: { title: "Mezza maratona", description: "21,1 km continui @ 4:47/km" } },
    ],
  },
];

export const PLAN_DAYS: PlanDay[] = PLAN_WEEKS.flatMap((w) => w.days);
export const PLAN_DAY_BY_DATE: Record<string, PlanDay> = Object.fromEntries(PLAN_DAYS.map((d) => [d.date, d]));

export const PLAN_CHANGES = [
  "Il test 5 km del 10 ottobre è tolto: il piano pensa solo alla mezza.",
  "Una sola qualità a settimana, il mercoledì: 3×3000 il 23 settembre, medio in progressione il 30, 3×2000 il 7 ottobre. Saltano i 6×800 e i 3×1000.",
  "Entra la forza a casa, con giubbotto da 10 kg e manubri: la B il 21 e la A il 24 settembre, a 2 serie; una leggera il 18 e il 28, poi solo mobilità.",
  "Gli 8 km di sabato 19 sono stati corsi venerdì 18: sabato niente corsa, e la settimana resta a 42 km invece di 50.",
  "Il passo di gara segue l'altimetria di Roma: discesa in partenza, strappi fra il km 2,5 e il 5, salite e sampietrini negli ultimi 3,5 km.",
  "Carboidrati negli ultimi due giorni e un gel al km 8 e al km 15, provati prima nei lunghi.",
  "La cyclette scende a 20' leggeri prima della forza; saltano i 3×10' in B4 e le uscite lunghe in bici.",
  "Il lungo del 20 settembre chiude con 4 km a 4:50, quello del 4 ottobre scende a 16 km tutti a 5:15–5:20, quello dell'11 ottobre diventa 11 km con allunghi.",
  "Scarico anticipato: 30 km nella settimana del 5 ottobre, 15 km più la gara in quella del 12.",
];

/** Le regole che valgono per tutte le settimane. */
export const PLAN_RULES = [
  "Un solo lavoro di qualità a settimana, il mercoledì. Intorno solo corsa lenta, con la FC fino a 138, e il lungo della domenica.",
  "Chiudi ogni seduta con la sensazione di poterne fare ancora un'altra ripetuta: fatica mai sopra 8 su 10.",
  "L'ultima qualità è il 3×2000 di mercoledì 7 ottobre, 11 giorni prima della gara. Poi solo brillantezza e scarico.",
];

// ── forza a casa ──────────────────────────────────────────────────────────────
export interface Exercise { name: string; dose: string; how: string }
export interface Routine {
  id: RoutineId;
  name: string;
  minutes: number;
  purpose: string;
  rest: string;
  exercises: Exercise[];
}

export const ROUTINE_GEAR = "Giubbotto da 10 kg, manubri a dischi e una sedia stabile o un gradino.";

export const ROUTINES: Record<RoutineId, Routine> = {
  A: {
    id: "A", name: "Forza A · gambe pesanti", minutes: 25,
    purpose: "La seduta più pesante: squat, affondi e stacchi per spingere di più a ogni passo e reggere il finale.",
    rest: "90\" fra le serie, 60\" nel plank.",
    exercises: [
      { name: "Squat goblet con giubbotto", dose: "2×8",
        how: "Giubbotto addosso e un manubrio al petto. Scendi in 2\" fino a cosce parallele, risali deciso." },
      { name: "Affondo bulgaro", dose: "2×8 per gamba",
        how: "Piede dietro su una sedia. La prima volta solo col giubbotto; i manubri, uno per mano, dalla volta dopo. Il ginocchio davanti segue la punta del piede." },
      { name: "Stacco rumeno con manubri", dose: "2×8",
        how: "Ginocchia appena flesse, schiena dritta: scendi finché tirano i femorali, circa a metà tibia." },
      { name: "Polpaccio su gradino, a una gamba", dose: "2×12 per gamba",
        how: "Tallone fuori dal gradino, manubrio nella mano dello stesso lato. Scendi in 2\" sotto il livello del gradino." },
      { name: "Plank con giubbotto", dose: "2×40\"",
        how: "Gomiti sotto le spalle, bacino in linea. Se la schiena cede, togli il giubbotto." },
    ],
  },
  B: {
    id: "B", name: "Forza B · una gamba alla volta", minutes: 20,
    purpose: "Una gamba alla volta, come quando corri: stabilità di anca e ginocchio, e il soleo che regge i chilometri.",
    rest: "60–90\" fra le serie.",
    exercises: [
      { name: "Step-up con giubbotto", dose: "2×8 per gamba",
        how: "Sedia o gradino di 40–50 cm. Spingi solo con la gamba sopra, senza slancio da terra. Aggiungi i manubri quando diventa facile." },
      { name: "Stacco a una gamba", dose: "2×8 per gamba",
        how: "Manubrio nella mano opposta alla gamba d'appoggio. Bacino chiuso, busto e gamba libera in linea." },
      { name: "Hip thrust a una gamba", dose: "2×10 per gamba",
        how: "Spalle sul divano, manubrio sull'anca. Sali fino a busto e coscia in linea, fermo 1\" in alto." },
      { name: "Polpaccio da seduto", dose: "2×15",
        how: "Avampiedi su un rialzo, manubri appoggiati sulle ginocchia. A ginocchio piegato lavora il soleo." },
      { name: "Plank laterale", dose: "2×30\" per lato",
        how: "Col giubbotto se la linea regge. Quando diventa facile, Copenhagen: piede alto su una sedia, 2×20\"." },
    ],
  },
  L: {
    id: "L", name: "Forza leggera", minutes: 20,
    purpose: "Mantenimento: tiene sveglia la forza senza lasciare dolori. È anche la prima seduta, per abituare i muscoli.",
    rest: "Due giri di fila, 2' fra un giro e l'altro.",
    exercises: [
      { name: "Squat con giubbotto", dose: "10", how: "Solo il giubbotto, niente manubri." },
      { name: "Step-up con giubbotto", dose: "6 per gamba", how: "Sedia bassa o gradino." },
      { name: "Ponte glutei", dose: "12", how: "A due gambe, manubrio sull'anca, 1\" fermo in alto." },
      { name: "Polpaccio su gradino", dose: "15", how: "A due gambe, discesa lenta." },
      { name: "Plank", dose: "30\"", how: "Senza giubbotto." },
    ],
  },
  M: {
    id: "M", name: "Mobilità", minutes: 12,
    purpose: "Per le settimane di scarico: articolazioni libere, nessuna fatica.",
    rest: "Senza carichi, di seguito.",
    exercises: [
      { name: "Caviglia al muro", dose: "10 per lato",
        how: "Piede a un palmo dal muro: porta il ginocchio a toccarlo senza staccare il tallone." },
      { name: "90/90 delle anche", dose: "6 per lato",
        how: "Seduto con le gambe piegate a 90°, ruota le ginocchia da un lato all'altro." },
      { name: "Affondo con allungamento", dose: "30\" per lato",
        how: "Ginocchio dietro a terra, spingi avanti il bacino: si allunga il flessore dell'anca." },
      { name: "Oscillazioni delle gambe", dose: "10 + 10 per lato",
        how: "Avanti e indietro, poi di lato, con una mano al muro." },
      { name: "Ponte glutei", dose: "2×10", how: "A corpo libero, lento." },
    ],
  },
};

export const ROUTINE_RULES = [
  "Fino alla gara 2 serie per esercizio: con due sole sedute vere la forza non ti fa correre più forte il 18, serve a cominciare senza pagarlo in gambe. Le 3 serie arrivano dopo la gara.",
  "Il carico si sceglie sulle ripetizioni, non sui kg: ogni serie finisce con 3 ripetizioni ancora in canna. Se ne restano 5, la volta dopo aggiungi un disco.",
  "Discesa controllata in 2 secondi, salita decisa. Serve forza, non fiatone: fra le serie si recupera davvero.",
  "Mai il giorno prima di ripetute, medio o lungo. La B, che indolenzisce meno, va il lunedì prima della qualità; la A, con affondi e stacchi, il giovedì dopo.",
  "Le prime volte i muscoli fanno male per uno–tre giorni: per questo si comincia con la leggera e la A arriva per ultima.",
  "Ultima seduta di forza lunedì 28 settembre. Dal 5 ottobre solo mobilità: alla gara si arriva con le gambe fresche.",
  "Se un esercizio fa male a un tendine, Achille o rotula, toglilo: non si stringono i denti.",
];

// ── zone ──────────────────────────────────────────────────────────────────────
export interface ZoneRow { kind: PlanKind; name: string; pace: string; hr: string }
export const RUN_ZONES: ZoneRow[] = [
  { kind: "easy", name: "Lento", pace: "decide la FC", hr: "fino a 138" },
  { kind: "long", name: "Lungo", pace: "5:10–5:20", hr: "135–145" },
  { kind: "key", name: "Ritmo mezza", pace: "4:47", hr: "145–152 nei primi 10 km" },
  { kind: "key", name: "Medio", pace: "4:20–4:30", hr: "fra ritmo mezza e soglia" },
  { kind: "quality", name: "Soglia", pace: "4:15–4:20", hr: "150–160" },
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
  intro: "Calcolate sui tuoi lavori di giugno–agosto, con la soglia intorno a 155. Da confermare con la fascia H10 nel 3×3000 del 23 settembre.",
  bike: "Le zone bici sono stime: in bici i battiti stanno 5–10 sotto la corsa. Pedala a 90–95 rpm; prima della forza basta la B1.",
  heat: "Fino al 30 settembre, se T+DP supera 130, rallenta del 2–3% i ritmi di qualità. In ottobre la correzione è quasi nulla.",
};

/**
 * La gara: Rome Half Marathon. Il percorso costa circa mezzo minuto rispetto
 * al piano (+63 m letti sull'altimetria ufficiale, col modello di pendenza del
 * backend), quindi 4:47 di media a Roma valgono 4:45 in piano. I tratti
 * sommano a circa 1:40:55.
 */
export const RACE_HM = {
  segments: [
    { stretch: "km 0–2,5", where: "Discesa da Porta Ardeatina", pace: "4:48–4:50", hr: "sotto 150" },
    { stretch: "km 2,5–5", where: "Aventino e Circo Massimo, a sforzo", pace: "~4:52", hr: "sotto 152" },
    { stretch: "km 5–17,5", where: "Lungotevere, San Pietro, Foro Italico: piatto", pace: "4:45", hr: "fino a 155 al km 10, fino a 160 al km 15" },
    { stretch: "km 17,5–21,1", where: "Centro e salita al Colosseo, a sforzo", pace: "4:48–4:52", hr: "libera" },
  ],
  notes: [
    "La discesa iniziale e la folla spingono: non guadagnare tempo nei primi 2,5 km, lo ripaghi sugli strappi dell'Aventino.",
    "Il tempo si fa sui 12 km piatti lungo il Tevere: lì il 4:45 deve sembrarti controllato.",
    "Negli ultimi 3,5 km sampietrini nelle piazze e due salite, l'ultima fino al Colosseo: il passo cala anche a sforzo uguale. Lì non inseguire il 4:47, spingi sullo sforzo.",
    "Il GPS in città misura di più: a fine gara segnerà 21,3–21,4 km. Prendi il giro a mano ai cartelli dei km, oppure punta a 4:44 sul Garmin.",
    "Se al km 10 sei stabilmente sopra 155, passa a 4:52 e chiudi intorno a 1:42.",
    "Arrivo previsto intorno a 1:40:55, se le verifiche del 27 e del 30 settembre sono andate bene.",
    "Se riesci, prima della gara corri piano il finale del percorso, da Piazza del Popolo al Colosseo: vedi dove sono sampietrini e salite.",
  ],
};

/** Il serbatoio: carboidrati prima e durante la gara. */
export const RACE_FUEL = [
  "Da venerdì sera a sabato sera 8–10 g di carboidrati per kg al giorno: con i tuoi 68 kg sono 550–680 g. Pasta, riso, pane bianco, patate; poche fibre e pochi grassi.",
  "Colazione 3 ore prima della partenza: 1–2 g per kg, cioè 70–130 g di carboidrati, cibi già provati.",
  "In gara 30–60 g all'ora: un gel al km 8 e uno al km 15, con acqua.",
  "Il gel si prova prima, nei lunghi del 27 settembre e dell'11 ottobre: il giorno della gara niente di nuovo.",
  "Caffeina 3 mg per kg, circa 200 mg, un'ora prima: solo se l'hai già provata in allenamento.",
];

export const AFTER_RACE = [
  "Test della FC massima con la H10, sul tapis roulant o in piano.",
  "Volume verso 45–50 km a settimana, con una settimana di scarico ogni 3–4.",
  "Forza due volte a settimana, con le sedute A e B a 3 serie.",
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

/** I giorni in cui si fa quella seduta di forza o di mobilità. */
export function routineDays(id: RoutineId): PlanDay[] {
  return PLAN_DAYS.filter((d) => d.routine === id);
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
    type: d.kind === "quality" ? "intervals" : d.kind === "key" || d.kind === "race" ? "tempo" : d.kind,
    title: d.adherence!.title,
    description: d.adherence!.description ?? "",
    target_distance_km: d.km ?? 0,
    target_pace: null,
    target_duration_min: null,
    completed: !!d.done,
    run_id: null,
  }));
}
