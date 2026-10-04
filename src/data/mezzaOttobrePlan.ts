import type { Session } from "../types/api";

/**
 * PIANO: MEZZA MARATONA IL 18 OTTOBRE, A 4:45 AL KM.
 *
 * Versione del 4 ottobre 2026, rifatta da zero: due settimane, dal 5 al 18
 * ottobre, per la Rome Half Marathon (partenza a Porta Ardeatina, arrivo al
 * Colosseo). La prima è di carico — il test sui 18 km di martedì 6, che dice
 * se il 4:45 si regge, e una qualità a nove giorni dalla gara — la seconda è
 * l'unica di scarico. Niente forza fino alla gara, solo mobilità. Scritto a
 * mano: nessun motore sotto, le date sono fisse e i ritmi sono quelli scritti.
 *
 * Due cose sono pensate anche per le macchine:
 *   - `adherence` è la stessa seduta scritta nel formato che l'esito automatico
 *     sa leggere ("3×2000 m @ 4:17/km", "12 km continui @ 4:45/km"): il titolo
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
  version: "Versione del 4 ottobre: rifatto da zero, obiettivo 4:45 e test sui 18 km di martedì 6.",
  start: "2026-10-05",
  end: "2026-10-18",
};

/** La targa in testa alla pagina. */
export const PLAN_BIBS = [
  { id: "hm", value: "4:45", title: "Mezza maratona, passo al km", when: "domenica 18 ottobre", band: "#F0A040" },
] as const;

/** L'obiettivo in forma di numeri: 4:45 al km sui 21,0975, cioè 1:40:13. */
export const PLAN_GOALS = [
  { id: "mezza", label: "Mezza a 4:45/km", distM: 21097.5, targetSec: Math.round(285 * 21.0975), dateIso: "2026-10-18" },
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
export const PLAN_LEGEND: PlanKind[] = ["rest", "easy", "long", "key", "quality"];

export const PLAN_WEEKS: PlanWeek[] = [
  {
    n: 1, dates: "5–11 ottobre", km: "43 km",
    days: [
      { date: "2026-10-05", kind: "rest", title: "Riposo + mobilità 12'", routine: "M",
        detail: "Domani c'è il test e serve una misura pulita: niente corsa, niente alcol, a letto presto." },
      { date: "2026-10-06", kind: "key", title: "Test: 18 km con 12 a 4:45", km: 18, big: true,
        detail: "3 km di riscaldamento con la FC sotto 140, 12 km a 4:45 senza pause, 3 km di defaticamento. In piano, con la fascia H10. Il passo è 4:45 e basta: più forte cancella la misura. Circa 90 minuti: 500 ml addosso, bevi dal km 5, gel al km 8 con acqua come in gara. Tetto 168: se la FC ci arriva, il blocco finisce lì. Se ti svegli con febbre, tosse di petto o la FC a riposo 7 battiti sopra il solito, niente test: 10 km lenti, e venerdì 9 il 3×2000 lascia il posto a 8 km a 4:45.",
        verify: "Tre numeri, tutti sul blocco da 12 km: la FC media dei km 10–12, il drift (FC dei km 2–6 contro i km 8–12) e quanto ti è costato. Verde — FC fino a 160, drift sotto il 5 %, fatica fino a 7 su 10: in gara 4:45. Giallo — FC 161–165 o drift fra 5 e 8 %: parti a 4:50 e decidi al km 10. Rosso — FC oltre 165, passo che cede negli ultimi 3 km o blocco interrotto: l'obiettivo diventa 4:53, intorno a 1:43. Col naso ancora chiuso la FC legge qualche battito in più: tienine conto prima di abbassare l'obiettivo.",
        adherence: { title: "Ritmo gara 12 km", description: "12 km continui @ 4:45/km" } },
      { date: "2026-10-07", kind: "rest", title: "Riposo + mobilità 12'", routine: "M" },
      { date: "2026-10-08", kind: "easy", title: "Lento 5 km + 4 allunghi", detail: "FC fino a 138.", km: 5,
        adherence: { title: "Lento 5 km" } },
      { date: "2026-10-09", kind: "quality", title: "Ultima qualità: 3×2000 a 4:15–4:18", km: 10, big: true,
        detail: "2 km di riscaldamento, 3×2000 con 2'30\" di corsa lenta, 1 km di defaticamento. Nove giorni alla gara: deve restarti la voglia di farne un'altra. Se il test di martedì è finito in rosso, o giovedì le gambe sono ancora pesanti, fermati a 2×2000.",
        adherence: { title: "3×2000 m", description: "3×2000 m @ 4:17/km, recupero 2′30″" } },
      { date: "2026-10-10", kind: "rest", title: "Riposo" },
      { date: "2026-10-11", kind: "long", title: "Lungo 10 km con 6 allunghi", km: 10, big: true,
        detail: "A 5:15–5:30 con la FC sotto 145. Negli ultimi 2 km, 6 allunghi da 20\" a sensazione, senza forzare. Prova la colazione, il gel e il modo di bere della gara: il 18 niente deve essere nuovo.",
        adherence: { title: "Lungo 10 km" } },
    ],
  },
  {
    n: 2, dates: "12–18 ottobre", km: "15 km + gara",
    days: [
      { date: "2026-10-12", kind: "rest", title: "Riposo", detail: "Da oggi si scarica: è l'unica settimana di taper." },
      { date: "2026-10-13", kind: "key", title: "Lento 7 km con 3×1 km a 4:45", detail: "I 3 km a ritmo dentro la corsa, con 2' di recupero.", km: 7,
        adherence: { title: "3×1000 m", description: "3×1000 m @ 4:45/km, recupero 2′" } },
      { date: "2026-10-14", kind: "rest", title: "Riposo" },
      { date: "2026-10-15", kind: "easy", title: "5 km sciolti + 6 allunghi", km: 5, adherence: { title: "5 km sciolti" } },
      { date: "2026-10-16", kind: "easy", title: "3 km sciolti + 3×200 a ritmo mezza", km: 3,
        detail: "L'ultima corsa. Da stasera a sabato sera 8–10 g di carboidrati per kg al giorno: pasta, riso, pane bianco, patate. Poche fibre e pochi grassi.",
        adherence: { title: "3 km sciolti" } },
      { date: "2026-10-17", kind: "rest", title: "Riposo, carboidrati",
        detail: "Niente corsa: con una settimana sola di scarico la vigilia si passa fermi. Carboidrati anche oggi, cena presto e niente di nuovo." },
      { date: "2026-10-18", kind: "race", title: "Mezza maratona di Roma", km: 21.1, big: true, more: "gara",
        detail: "Colazione 3 ore prima, 1–2 g di carboidrati per kg. Gel al km 8 e al km 15.",
        adherence: { title: "Mezza maratona", description: "21,1 km continui @ 4:45/km" } },
    ],
  },
];

export const PLAN_DAYS: PlanDay[] = PLAN_WEEKS.flatMap((w) => w.days);
export const PLAN_DAY_BY_DATE: Record<string, PlanDay> = Object.fromEntries(PLAN_DAYS.map((d) => [d.date, d]));

export const PLAN_CHANGES = [
  "L'obiettivo passa da 4:47 a 4:45 al km: 1:40:13 sul traguardo.",
  "Il piano riparte da zero lunedì 5 ottobre: due settimane invece di cinque. Le ultime due del piano vecchio sono finite a 22 km l'una contro i 47 e i 43 scritti, senza il lungo da 18 e senza il medio.",
  "Martedì 6 il test: 18 km con 12 a 4:45. Decide se in gara si parte a 4:45, a 4:50 o a 4:53.",
  "L'ultima qualità, il 3×2000, va a venerdì 9: nove giorni prima della gara. Era mercoledì 7.",
  "Scarico solo nell'ultima settimana: 43 km in quella del 5 ottobre (erano 30), 15 più la gara in quella del 12.",
  "L'ultima corsa è venerdì 16 e sabato 17 si riposa: con una settimana sola di scarico, la corsetta della vigilia costa freschezza che non c'è.",
  "Niente forza fino alla gara, solo mobilità.",
  "Il sub 20 sui 5 km ha la sua finestra dopo la mezza: vedi in fondo.",
  "Resta la soglia misurata con la Polar H10 il 24 settembre: 158–162, passo di soglia 4:15–4:20.",
];

/** Le regole che valgono per tutte e due le settimane. */
export const PLAN_RULES = [
  "Due sedute contano, il test di martedì 6 e il 3×2000 di venerdì 9. Intorno solo corsa lenta, con la FC fino a 138. Dopo il 9 nessun lavoro: nove giorni servono per assorbire.",
  "Il tratto a ritmo gara si corre a ritmo gara. Correrlo più forte sembra una vittoria ma cancella la misura: la domanda non è se il 4:30 lo sai fare, è quanto ti costa il 4:45.",
  "Fino al 18 niente prove a tutta fuori programma. Il sub 20 ha la sua finestra dopo la mezza.",
  "Niente alcol nelle 48 ore prima del test, del 3×2000 e della gara: disidrata, spezza il sonno e alza la FC a parità di passo — sporca proprio la misura che ti serve.",
  "Raffreddore: col solo naso chiuso si corre, ma la FC legge alto. Se scende sotto il collo — tosse di petto, febbre, dolori — la seduta del giorno diventa riposo.",
  "Bevi. Su ogni uscita oltre i 70 minuti: 300–500 ml, a sorsi, a partire dal km 5. Il 20 settembre hai corso 80 minuti senza liquidi e il drift è arrivato al 9 %.",
  "Sulle corse lente e sul lungo comanda la FC, non il passo: tetto 138 sul lento, 145 sul lungo. Se per restare sotto devi rallentare, rallenti.",
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
  "Fino alla gara niente forza, solo mobilità: mancano due settimane, e una seduta adesso la paghi in gambe il 18 senza guadagnarci niente.",
  "Si riparte dopo la mezza dalla seduta leggera; poi la A e la B due volte a settimana, a 2 serie la prima settimana e a 3 dalla seconda.",
  "Il carico si sceglie sulle ripetizioni, non sui kg: ogni serie finisce con 3 ripetizioni ancora in canna. Se ne restano 5, la volta dopo aggiungi un disco.",
  "Discesa controllata in 2 secondi, salita decisa. Serve forza, non fiatone: fra le serie si recupera davvero.",
  "Mai il giorno prima di ripetute, medio o lungo. La B, che indolenzisce meno, va prima della qualità; la A, con affondi e stacchi, il giorno dopo.",
  "Se un esercizio fa male a un tendine, Achille o rotula, toglilo: non si stringono i denti.",
];

// ── zone ──────────────────────────────────────────────────────────────────────
export interface ZoneRow { kind: PlanKind; name: string; pace: string; hr: string }
export const RUN_ZONES: ZoneRow[] = [
  { kind: "easy", name: "Lento", pace: "decide la FC", hr: "fino a 138" },
  { kind: "long", name: "Lungo", pace: "decide la FC", hr: "135–145, tetto 145" },
  { kind: "key", name: "Ritmo mezza", pace: "4:45", hr: "148–155 nei primi 10 km" },
  { kind: "key", name: "Medio", pace: "4:20–4:30", hr: "fra ritmo mezza e soglia" },
  { kind: "quality", name: "Soglia", pace: "4:15–4:20", hr: "158–165" },
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
  intro: "La soglia era stimata intorno a 155 sui lavori di giugno–agosto: sbagliata di un intervallo intero. Il 3×3000 del 24 settembre l'ha misurata con la Polar H10 — 9 km a 4:15 con la FC che si assesta fra 157 e 162 e il passo che migliora ripetuta dopo ripetuta. La soglia è fra 158 e 162, il passo di soglia fra 4:15 e 4:20, e tutte le zone di qui sopra valgono cinque battiti più in alto di come erano scritte. Il lungo del 20 settembre, da polso, diceva la stessa cosa: due misure indipendenti, stessa risposta.",
  bike: "Le zone bici sono stime: in bici i battiti stanno 5–10 sotto la corsa. Pedala a 90–95 rpm; prima della forza basta la B1.",
  heat: "In ottobre la correzione per il caldo è quasi nulla: i ritmi si corrono come sono scritti.",
};

/**
 * La gara: Rome Half Marathon. Il percorso costa circa mezzo minuto rispetto
 * al piano (+63 m letti sull'altimetria ufficiale, col modello di pendenza del
 * backend), quindi 4:45 di media a Roma valgono 4:43 in piano. I tratti
 * sommano a circa 1:40:15.
 */
export const RACE_HM = {
  segments: [
    { stretch: "km 0–2,5", where: "Discesa da Porta Ardeatina", pace: "4:46–4:48", hr: "sotto 155" },
    { stretch: "km 2,5–5", where: "Aventino e Circo Massimo, a sforzo", pace: "~4:50", hr: "sotto 157" },
    { stretch: "km 5–17,5", where: "Lungotevere, San Pietro, Foro Italico: piatto", pace: "4:43", hr: "fino a 160 al km 10, fino a 165 al km 15" },
    { stretch: "km 17,5–21,1", where: "Centro e salita al Colosseo, a sforzo", pace: "4:46–4:50", hr: "libera" },
  ],
  notes: [
    "La discesa iniziale e la folla spingono: non guadagnare tempo nei primi 2,5 km, lo ripaghi sugli strappi dell'Aventino.",
    "Il tempo si fa sui 12 km piatti lungo il Tevere: lì il 4:43 deve sembrarti controllato.",
    "Negli ultimi 3,5 km sampietrini nelle piazze e due salite, l'ultima fino al Colosseo: il passo cala anche a sforzo uguale. Lì non inseguire il 4:45, spingi sullo sforzo.",
    "Il GPS in città misura di più: a fine gara segnerà 21,3–21,4 km. Prendi il giro a mano ai cartelli dei km, oppure punta a 4:42 sul Garmin.",
    "Se al km 10 sei stabilmente sopra 160, passa a 4:52 e chiudi intorno a 1:41:30.",
    "Bevi a ogni ristoro, anche i primi, anche se non hai sete: sono cento minuti. Due sorsi e via, non una borraccia intera.",
    "Arrivo previsto intorno a 1:40:15, se il test di martedì 6 è finito in verde. In giallo si parte a 4:50, in rosso a 4:53.",
    "Se riesci, prima della gara corri piano il finale del percorso, da Piazza del Popolo al Colosseo: vedi dove sono sampietrini e salite.",
  ],
};

/** Il serbatoio: carboidrati prima e durante la gara. */
export const RACE_FUEL = [
  "Da venerdì sera a sabato sera 8–10 g di carboidrati per kg al giorno: con i tuoi 68 kg sono 550–680 g. Pasta, riso, pane bianco, patate; poche fibre e pochi grassi.",
  "Colazione 3 ore prima della partenza: 1–2 g per kg, cioè 70–130 g di carboidrati, cibi già provati.",
  "In gara 30–60 g all'ora: un gel al km 8 e uno al km 15, con acqua.",
  "Acqua a ogni ristoro, dal primo: due sorsi. Su cento minuti la disidratazione non si recupera, si previene.",
  "Il gel da 40 g vuole acqua, sempre: è concentrato, e senza liquido tira acqua nell'intestino invece di darne. Prendilo al ristoro, non fra un ristoro e l'altro.",
  "Il gel si prova prima, nel test di martedì 6 e nel lungo dell'11 ottobre: il giorno della gara niente di nuovo.",
  "Caffeina 3 mg per kg, circa 200 mg, un'ora prima: solo se l'hai già provata in allenamento.",
];

/** Dopo la mezza: la strada per i 5 km sotto i 20 minuti. */
export const AFTER_RACE = [
  "Il prossimo obiettivo: 5 km sotto i 20 minuti, sabato 28 novembre. Sei settimane dalla mezza: una di recupero, quattro di lavoro, una di scarico.",
  "Domenica 4 ottobre ti sei fermato a 1,9 km: primo km a 3:56 in leggera discesa, poi 4:10 in leggera salita, FC massima 159. Il 16 settembre a fine ripetuta arrivavi a 165: non era il cuore al limite, era la giornata. Naso chiuso da quattro giorni, alcol, 2 km di riscaldamento a 6:33 e otto minuti fermo prima del via, alle 7:25.",
  "Non è la forma che manca: il 24 settembre hai corso 9 km a 4:15 senza passare 164. Ma l'ultimo lavoro a ritmo 5 km è il 5×1000 del 16 settembre e le ultime due settimane sono a 22 km: il 4:00 va riallenato, non solo ritentato.",
  "19–25 ottobre, recupero: tre corse lente, 20 km in tutto. Riparte la forza, dalla seduta leggera.",
  "26 ottobre – 22 novembre: 40–45 km a settimana con due qualità. Il martedì il ritmo 5 km — 6×800, poi 5×1000, poi 4×1200 a 3:55–3:58 — e il venerdì la soglia a 4:10–4:15. Lungo da 14–16 km la domenica, Forza A e B.",
  "Il via libera, dieci giorni prima: 5×1000 a 3:57 con 90\" di recupero, l'ultimo veloce come il primo. Se cede, il tentativo slitta di una settimana.",
  "Il giorno del tentativo: sano, 48 ore senza alcol, in piano e non all'alba. 15' lenti, 4 allunghi, 2×1' a ritmo, via entro 5 minuti. Primo km a 4:00–4:02: quello regalato al via si ripaga con gli interessi al terzo.",
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
