/**
 * SHIN SPLINTS · sindrome da stress tibiale mediale (MTSS)
 * ════════════════════════════════════════════════════════════════════════════
 * Il programma in tre fasi per tornare a correre senza dolore: calmare, rinforzare,
 * riabituare l'osso all'impatto. È scritto a mano e leggibile, come i piani del
 * Training: niente generatore, niente leve da regolare.
 *
 * Cosa dice la letteratura, e cosa no. Non esiste una terapia dimostrata come
 * migliore delle altre per l'MTSS: le revisioni sistematiche (Moen 2009, Winters
 * 2013, Newman 2013) trovano prove deboli per quasi tutto, comprese solette,
 * ultrasuoni, onde d'urto e stretching da soli. Quello su cui concordano le
 * linee guida di fisioterapia è il resto: ridurre il carico che irrita l'osso,
 * rinforzare polpaccio (soleo in particolare, che si attacca proprio sul bordo
 * mediale della tibia), tibiale posteriore e anca, e tornare al carico in modo
 * graduale, guidati dal dolore. È quello che c'è qui.
 *
 * Il dolore decide. Nessun numero di questa pagina vale più di come sta la gamba
 * il mattino dopo.
 */

export type PhaseId = "calma" | "rinforza" | "corsa";
export type Equipment = "corpo-libero" | "manubri" | "elastico" | "gilet";

export const EQUIPMENT: { id: Equipment; label: string }[] = [
  { id: "corpo-libero", label: "Corpo libero" },
  { id: "manubri", label: "Manubri" },
  { id: "elastico", label: "Elastico" },
  { id: "gilet", label: "Gilet 10 kg" },
];

export interface Gate {
  id: string;
  text: string;
}

export interface Phase {
  id: PhaseId;
  /** "1 · Calmare" */
  label: string;
  title: string;
  goal: string;
  running: string;
  frequency: string;
  /** I criteri per passare alla fase dopo (per la terza: per dirsi guariti). */
  gates: Gate[];
  gatesTitle: string;
}

export const PHASES: Phase[] = [
  {
    id: "calma",
    label: "1 · Calmare",
    title: "Togliere il carico che irrita l'osso",
    goal:
      "Smettere di stimolare il punto che fa male e tenere in moto caviglia, piede e anca. Il dolore deve " +
      "scendere: non va sopportato, va ascoltato.",
    running:
      "Niente corsa finché camminare non è senza dolore. Per tenere il fiato: bici, nuoto o corsa in acqua, " +
      "purché a dolore zero.",
    frequency: "Ogni giorno, 15 minuti. Nessun esercizio deve far salire il dolore sopra 3/10.",
    gatesTitle: "Per passare alla fase 2",
    gates: [
      { id: "calma-walk", text: "Cammini 30 minuti senza dolore (0–1 su 10)." },
      { id: "calma-morning", text: "Il primo passo del mattino non fa male, o quasi." },
      {
        id: "calma-palpation",
        text: "Premendo sul bordo interno della tibia il dolore è lieve (al massimo 2/10) e non c'è un punto preciso, acuto, sull'osso.",
      },
      { id: "calma-raise", text: "20 sollevamenti sui talloni a due piedi, lenti, senza dolore." },
    ],
  },
  {
    id: "rinforza",
    label: "2 · Rinforzare",
    title: "Polpaccio, tibiale posteriore e anca",
    goal:
      "Rendere i muscoli che scaricano la tibia abbastanza forti da reggere il carico della corsa. È la fase " +
      "in cui si guarisce davvero: osso e muscolo si adattano a ciò che li carica, se lo fa con gradualità.",
    running: "Ancora niente corsa. Camminate lunghe e bici come prima; se vuoi, cammina veloce.",
    frequency:
      "Forza 3 volte a settimana a giorni alterni (per esempio lunedì, mercoledì, venerdì), più la mobilità " +
      "della fase 1 ogni giorno. Da 3 a 4 settimane.",
    gatesTitle: "Per passare alla fase 3",
    gates: [
      { id: "rinforza-raise", text: "25 sollevamenti su un piede, ginocchio dritto, per lato, senza dolore." },
      { id: "rinforza-symmetry", text: "Le ripetizioni a destra e a sinistra differiscono meno del 20%." },
      { id: "rinforza-walk", text: "Cammini 45–60 minuti senza dolore." },
      {
        id: "rinforza-hop",
        text: "Dieci saltelli bassi su un piede, per lato, senza dolore né il giorno dopo.",
      },
    ],
  },
  {
    id: "corsa",
    label: "3 · Tornare a correre",
    title: "Riabituare l'osso all'impatto",
    goal:
      "Prima i saltelli, poi la corsa a intervalli. È la fase in cui si sbaglia più spesso: si torna al volume " +
      "pieno perché non fa più male, e l'osso, che si adatta più lentamente del muscolo, ricade.",
    running:
      "Corsa a intervalli a giorni alterni, su terreno piano e morbido (sterrato, erba, pista), con la tabella " +
      "qui sotto. Mai due giorni di fila.",
    frequency: "Saltelli 2 volte a settimana, forza 2 volte a settimana, corsa a giorni alterni.",
    gatesTitle: "Per dirti guarito",
    gates: [
      { id: "corsa-30", text: "30 minuti di corsa continua, facile, senza dolore, per due volte di fila." },
      { id: "corsa-morning", text: "Il mattino dopo non senti il primo passo." },
      { id: "corsa-volume", text: "Una settimana intera all'80% del tuo volume abituale, senza dolore." },
    ],
  },
];

export interface Exercise {
  id: string;
  name: string;
  phases: PhaseId[];
  /** Cosa lavora, in poche parole. */
  target: string;
  equipment: Equipment[];
  /** Serie, ripetizioni, tempo. */
  prescription: string;
  steps: string[];
  /** L'errore tipico o il consiglio che conta. */
  cue: string;
  /** Come renderlo più difficile quando è facile. */
  progression?: string;
}

export const EXERCISES: Exercise[] = [
  // ── Fase 1: mobilità e attivazione ──────────────────────────────────────
  {
    id: "ankle-alphabet",
    name: "Alfabeto con la caviglia",
    phases: ["calma"],
    target: "Mobilità di caviglia e piede",
    equipment: ["corpo-libero"],
    prescription: "2 giri dell'alfabeto per piede",
    steps: [
      "Siediti con la gamba allungata, il piede libero nel vuoto.",
      "Con l'alluce disegna le lettere maiuscole, dalla A alla Z, muovendo solo la caviglia.",
      "Fai movimenti ampi e lenti, senza forzare oltre il fastidio.",
    ],
    cue: "Serve a scaldare, non a faticare: se fa male, riduci l'ampiezza.",
  },
  {
    id: "calf-stretch-straight",
    name: "Allungamento del polpaccio, ginocchio dritto",
    phases: ["calma"],
    target: "Gastrocnemio",
    equipment: ["corpo-libero"],
    prescription: "3 × 30″ per lato",
    steps: [
      "Mani al muro, una gamba dietro con il tallone a terra e il ginocchio teso.",
      "Piedi paralleli, punte avanti. Porta il bacino verso il muro.",
      "Senti il tirare nel polpaccio, non dolore sulla tibia. Tieni 30″.",
    ],
    cue: "Il tallone resta a terra: se si stacca, sei troppo lontano.",
  },
  {
    id: "soleus-stretch",
    name: "Allungamento del soleo, ginocchio piegato",
    phases: ["calma"],
    target: "Soleo",
    equipment: ["corpo-libero"],
    prescription: "3 × 30″ per lato",
    steps: [
      "Come sopra, ma avvicina i piedi al muro e piega il ginocchio della gamba dietro.",
      "Tieni il tallone a terra e spingi il ginocchio in avanti, sopra le dita.",
      "Il tirare si sposta in basso, vicino al tendine d'Achille.",
    ],
    cue: "Il soleo è il muscolo che si attacca al bordo mediale della tibia: è quello che più conta.",
  },
  {
    id: "short-foot",
    name: "Piede corto",
    phases: ["calma", "rinforza"],
    target: "Muscoli intrinseci del piede, arco plantare",
    equipment: ["corpo-libero"],
    prescription: "3 × 10, tenuta 5″",
    steps: [
      "In piedi o seduto, piede piatto a terra.",
      "Avvicina la base dell'alluce al tallone, accorciando il piede senza arricciare le dita.",
      "L'arco si alza; tieni 5″ e rilascia con calma.",
    ],
    cue: "Le dita restano distese. Se si piegano, stai facendo un altro esercizio.",
    progression: "Falli in piedi su un piede solo, poi con gli occhi chiusi.",
  },
  {
    id: "band-inversion",
    name: "Inversione con l'elastico",
    phases: ["calma", "rinforza"],
    target: "Tibiale posteriore",
    equipment: ["elastico"],
    prescription: "3 × 15 lenti, 3″ di ritorno",
    steps: [
      "Seduto, gamba tesa. Elastico leggero attorno all'avampiede, ancorato a un punto fisso dal lato esterno.",
      "Porta il piede verso l'interno, contro la resistenza, senza muovere la gamba.",
      "Torna in 3″: la parte che ritorna conta quanto quella che spinge.",
    ],
    cue: "Muovi solo il piede. Se oscilla il ginocchio, l'elastico è troppo duro.",
    progression: "Elastico più duro, o passa a 3 × 20.",
  },
  {
    id: "band-dorsiflexion",
    name: "Flessione dorsale con l'elastico",
    phases: ["calma", "rinforza"],
    target: "Tibiale anteriore",
    equipment: ["elastico"],
    prescription: "3 × 15 lenti",
    steps: [
      "Seduto, gamba tesa, elastico attorno al dorso del piede ancorato davanti a te.",
      "Tira le punte verso la tibia, contro l'elastico.",
      "Torna lento, in 3″, senza lasciare l'elastico scattare.",
    ],
    cue: "Se il dolore è sul davanti della gamba (non sul bordo interno), fermati e leggi gli allarmi in alto.",
  },
  {
    id: "calf-raise-double",
    name: "Sollevamento sui talloni, due piedi",
    phases: ["calma"],
    target: "Polpaccio (gastrocnemio e soleo)",
    equipment: ["corpo-libero"],
    prescription: "3 × 15, 3″ su e 3″ giù",
    steps: [
      "In piedi, piedi alla larghezza del bacino, mani leggere al muro.",
      "Sali sulle punte in 3″, tieni un istante in alto.",
      "Scendi in 3″ fino al pavimento, senza lasciarti cadere.",
    ],
    cue: "La salita e la discesa devono durare davvero 3″: è la lentezza a caricare il tendine e l'osso, non il numero.",
    progression: "Quando 3 × 15 è facile e senza dolore, passa al sollevamento su un piede (fase 2).",
  },
  {
    id: "clamshell-band",
    name: "Conchiglia con l'elastico",
    phases: ["calma"],
    target: "Gluteo medio",
    equipment: ["elastico"],
    prescription: "3 × 15 per lato",
    steps: [
      "Sdraiato su un fianco, ginocchia piegate, elastico attorno alle cosce sopra le ginocchia.",
      "Tieni i piedi uniti e apri il ginocchio di sopra, senza ruotare il bacino.",
      "Scendi lento, in 2″.",
    ],
    cue: "Il bacino non si muove: se rotola indietro stai usando la schiena, non il gluteo.",
  },
  {
    id: "glute-bridge",
    name: "Ponte dei glutei",
    phases: ["calma", "rinforza"],
    target: "Gluteo massimo, catena posteriore",
    equipment: ["corpo-libero", "manubri"],
    prescription: "3 × 12, tenuta 2″ in alto",
    steps: [
      "Schiena a terra, ginocchia piegate, piedi vicini ai glutei.",
      "Spingi sui talloni e solleva il bacino fino a formare una linea dalle spalle alle ginocchia.",
      "Stringi i glutei 2″ in alto e scendi lento.",
    ],
    cue: "Costole giù: se la schiena si inarca troppo, il lavoro passa ai lombari.",
    progression: "Su un piede solo; poi con un manubrio sul bacino.",
  },
  {
    id: "single-leg-balance",
    name: "Equilibrio su un piede",
    phases: ["calma", "rinforza"],
    target: "Controllo di caviglia e anca",
    equipment: ["corpo-libero"],
    prescription: "3 × 30″ per lato",
    steps: [
      "In piedi su un piede, ginocchio morbido, bacino a livello.",
      "Tieni 30″ senza appoggiarti.",
      "Quando è stabile, chiudi gli occhi o pesta su un cuscino.",
    ],
    cue: "Guarda il ginocchio: non deve cadere verso l'interno.",
    progression: "Occhi chiusi, poi sopra un cuscino o un asciugamano arrotolato.",
  },

  // ── Fase 2: rinforzo ────────────────────────────────────────────────────
  {
    id: "calf-raise-single",
    name: "Sollevamento su un piede, ginocchio dritto",
    phases: ["rinforza", "corsa"],
    target: "Gastrocnemio, carico lento",
    equipment: ["corpo-libero", "manubri", "gilet"],
    prescription: "3 × 8–12 per lato, 3″ su · 1″ fermo · 3″ giù",
    steps: [
      "Sul bordo di un gradino, un piede solo, mano al muro per l'equilibrio.",
      "Sali alto, in 3″, fino a stare sulla punta; fermo 1″.",
      "Scendi in 3″ fino a sotto il livello del gradino, poi risali.",
    ],
    cue: "Scendi fino in fondo: il tratto più utile è l'allungamento sotto il gradino.",
    progression:
      "Quando le 12 ripetizioni sono facili aggiungi carico: un manubrio nella mano libera, poi il gilet da 10 kg. " +
      "Il carico giusto lascia 2 ripetizioni in riserva.",
  },
  {
    id: "soleus-raise",
    name: "Sollevamento a ginocchio piegato (soleo)",
    phases: ["rinforza", "corsa"],
    target: "Soleo, il muscolo che tira sul bordo mediale della tibia",
    equipment: ["manubri", "corpo-libero"],
    prescription: "3 × 12–15, 3″ su · 3″ giù",
    steps: [
      "Seduto su una sedia, piedi a terra, un manubrio (o un disco) appoggiato sulle cosce vicino alle ginocchia.",
      "Solleva i talloni lentamente, in 3″, tenendo le ginocchia piegate a 90°.",
      "Scendi in 3″ fino a toccare terra.",
    ],
    cue: "Con il ginocchio piegato il gastrocnemio si spegne e il lavoro passa al soleo: ecco perché serve in più.",
    progression: "Aumenta il peso sulle cosce fino a 20–30 kg; poi falli su un piede solo.",
  },
  {
    id: "towel-heel-raise",
    name: "Sollevamento con asciugamano tra i talloni",
    phases: ["rinforza"],
    target: "Tibiale posteriore (spinta in inversione)",
    equipment: ["corpo-libero"],
    prescription: "3 × 12 lenti",
    steps: [
      "In piedi, un asciugamano arrotolato (o una piccola palla) tra i talloni, mani al muro.",
      "Stringi i talloni verso l'interno mentre sali sulle punte, in 3″.",
      "Scendi in 3″ mantenendo la pressione sull'asciugamano.",
    ],
    cue: "Le caviglie non devono cadere verso l'esterno: la linea resta dritta fino alle dita.",
  },
  {
    id: "heel-walk",
    name: "Camminata sui talloni",
    phases: ["rinforza"],
    target: "Tibiale anteriore",
    equipment: ["corpo-libero"],
    prescription: "3 × 20 m",
    steps: [
      "Cammina in avanti tenendo le punte alzate, sui soli talloni.",
      "Passi corti e controllati, postura alta.",
    ],
    cue: "Se sul davanti della gamba brucia, è normale: se fa male sul bordo interno della tibia, fermati.",
  },
  {
    id: "lateral-band-walk",
    name: "Camminata laterale con l'elastico",
    phases: ["rinforza", "corsa"],
    target: "Gluteo medio e abduttori",
    equipment: ["elastico"],
    prescription: "3 × 12 passi per lato",
    steps: [
      "Elastico attorno alle caviglie o sopra le ginocchia, ginocchia leggermente piegate.",
      "Fai passi laterali tenendo la tensione dell'elastico, senza far sbattere i piedi.",
      "Il busto resta dritto, le punte avanti.",
    ],
    cue: "Passi corti e continui: se il bacino dondola, l'elastico è troppo duro.",
  },
  {
    id: "step-down",
    name: "Discesa controllata dal gradino",
    phases: ["rinforza", "corsa"],
    target: "Controllo eccentrico di quadricipite, gluteo e caviglia",
    equipment: ["corpo-libero", "manubri"],
    prescription: "3 × 10 per lato, 3″ di discesa",
    steps: [
      "In piedi su un gradino di 15–20 cm, su un piede solo.",
      "Piega il ginocchio e abbassa il piede libero verso terra, lentamente, in 3″.",
      "Tocca appena con il tallone e risali.",
    ],
    cue: "Il ginocchio segue la linea del secondo dito: non cade verso l'interno.",
    progression: "Con un manubrio per mano.",
  },
  {
    id: "single-leg-rdl",
    name: "Stacco a una gamba",
    phases: ["rinforza", "corsa"],
    target: "Catena posteriore e stabilità",
    equipment: ["manubri"],
    prescription: "3 × 8 per lato",
    steps: [
      "In piedi su una gamba, ginocchio morbido, un manubrio nella mano opposta.",
      "Spingi il bacino indietro e abbassa il busto in avanti, la gamba libera si allunga dietro.",
      "Risali stringendo il gluteo.",
    ],
    cue: "La schiena resta piatta e il bacino parallelo al terreno: se ruota, il peso è troppo.",
  },
  {
    id: "reverse-lunge",
    name: "Affondo indietro",
    phases: ["rinforza"],
    target: "Quadricipite, gluteo, controllo del ginocchio",
    equipment: ["manubri", "gilet", "corpo-libero"],
    prescription: "3 × 8 per lato",
    steps: [
      "In piedi, manubri lungo i fianchi (o gilet addosso).",
      "Fai un passo indietro e scendi finché il ginocchio posteriore sfiora il pavimento.",
      "Risali spingendo sul piede davanti.",
    ],
    cue: "Il busto è dritto e il tallone davanti resta a terra.",
  },
  {
    id: "side-plank",
    name: "Plank laterale",
    phases: ["rinforza", "corsa"],
    target: "Core e gluteo medio",
    equipment: ["corpo-libero"],
    prescription: "3 × 30″ per lato",
    steps: [
      "Sdraiato su un fianco, appoggiato sull'avambraccio, gambe tese.",
      "Solleva il bacino fino a formare una linea dritta dalla testa ai piedi.",
      "Tieni 30″ respirando.",
    ],
    cue: "Il bacino non cede verso il pavimento.",
    progression: "Solleva la gamba di sopra; oppure 45″.",
  },

  // ── Fase 3: impatto ─────────────────────────────────────────────────────
  {
    id: "pogo-double",
    name: "Saltelli sul posto, due piedi (pogo)",
    phases: ["corsa"],
    target: "Rigidità e rimbalzo di tendine e caviglia",
    equipment: ["corpo-libero"],
    prescription: "3 × 20 saltelli, 2 volte a settimana",
    steps: [
      "In piedi, ginocchia quasi dritte, braccia rilassate.",
      "Rimbalza sulle punte con saltelli bassi e veloci, contatto a terra più corto possibile.",
      "Atterri morbido, senza far rumore.",
    ],
    cue: "Piccoli e rapidi: non è un salto in alto. Se senti dolore alla tibia, sei troppo alto o troppo pesante.",
  },
  {
    id: "pogo-single",
    name: "Saltelli su un piede solo",
    phases: ["corsa"],
    target: "Impatto monopodalico, come la corsa",
    equipment: ["corpo-libero"],
    prescription: "3 × 15 per lato, 2 volte a settimana",
    steps: [
      "Solo dopo che i saltelli a due piedi sono facili.",
      "Su un piede, saltelli bassi sul posto, un passo di corsa alla volta.",
    ],
    cue: "Se il giorno dopo il dolore sale, torna ai due piedi per una settimana.",
  },
  {
    id: "step-up",
    name: "Salita su gradino alto con spinta",
    phases: ["corsa"],
    target: "Potenza di gamba e ritmo di spinta",
    equipment: ["corpo-libero", "manubri", "gilet"],
    prescription: "3 × 8 per lato",
    steps: [
      "Gradino alto (altezza del ginocchio), un piede appoggiato sopra.",
      "Spingi forte sulla gamba di sopra e porta il ginocchio opposto in alto.",
      "Scendi controllato.",
    ],
    cue: "Spingi con il piede di sopra, non rimbalzare con quello di sotto.",
    progression: "Con il gilet da 10 kg.",
  },
];

export interface ReturnStep {
  step: number;
  label: string;
  rounds: number;
  runMin: number;
  walkMin: number;
}

/** Corsa e camminata alternate, a giorni alterni: si sale solo dopo due uscite senza dolore. */
export const RETURN_TO_RUN: ReturnStep[] = [
  { step: 1, label: "8 × (1′ corsa · 2′ cammino)", rounds: 8, runMin: 1, walkMin: 2 },
  { step: 2, label: "6 × (2′ corsa · 2′ cammino)", rounds: 6, runMin: 2, walkMin: 2 },
  { step: 3, label: "5 × (3′ corsa · 2′ cammino)", rounds: 5, runMin: 3, walkMin: 2 },
  { step: 4, label: "4 × (5′ corsa · 2′ cammino)", rounds: 4, runMin: 5, walkMin: 2 },
  { step: 5, label: "3 × (8′ corsa · 2′ cammino)", rounds: 3, runMin: 8, walkMin: 2 },
  { step: 6, label: "2 × (12′ corsa · 2′ cammino)", rounds: 2, runMin: 12, walkMin: 2 },
  { step: 7, label: "25–30′ di corsa continua, facile", rounds: 1, runMin: 28, walkMin: 0 },
];

export const RETURN_RULES: string[] = [
  "A giorni alterni, mai due volte di fila. Nei giorni liberi fai la forza o riposi.",
  "Su terreno piano e morbido: sterrato, erba, pista. Evita le discese e l'asfalto duro.",
  "Ritmo facile, da poter parlare. Niente ripetute né salite finché non hai due settimane di volume stabile.",
  "Sali di un passo solo dopo due uscite senza dolore. Se in una uscita il dolore supera 3/10, o il mattino dopo è peggio, torna al passo precedente.",
  "Dopo il passo 7, il volume cresce al massimo del 10% a settimana.",
];

export interface PainBand {
  id: "verde" | "giallo" | "rosso";
  range: string;
  title: string;
  text: string;
}

/** Il semaforo del dolore: 0–10, misurato durante e il mattino dopo. */
export const PAIN_BANDS: PainBand[] = [
  { id: "verde", range: "0–2", title: "Vai avanti", text: "Fai il carico previsto." },
  {
    id: "giallo",
    range: "3–4",
    title: "Resta dove sei",
    text: "Stesso carico, niente aumenti, finché non scende. Va bene se sparisce entro un'ora e il mattino dopo non è peggio.",
  },
  {
    id: "rosso",
    range: "5 o più",
    title: "Fermati",
    text: "Interrompi, torna indietro di un livello e riposa 2–3 giorni. Vale anche per dolore a riposo, o se il mattino dopo è peggio.",
  },
];

export interface RedFlag {
  id: string;
  text: string;
}

/** Quando la pagina non basta e serve un medico dello sport o un fisioterapista. */
export const RED_FLAGS: RedFlag[] = [
  { id: "spot", text: "Un punto preciso sull'osso che fa male alla pressione di un dito (non una striscia lunga sul bordo): può essere una frattura da stress." },
  { id: "rest", text: "Dolore a riposo, di notte, o che ti sveglia." },
  { id: "walk", text: "Dolore che peggiora camminando o ti fa zoppicare." },
  { id: "swelling", text: "Gonfiore visibile, arrossamento o calore sulla tibia." },
  { id: "nerves", text: "Formicolio, intorpidimento o piede freddo e pallido durante lo sforzo." },
  { id: "weeks", text: "Nessun miglioramento dopo 2–3 settimane di carico ridotto." },
];

export interface Cause {
  id: string;
  title: string;
  text: string;
}

/** Perché torna: le quattro cose che nella pratica lo fanno ricadere. */
export const CAUSES: Cause[] = [
  {
    id: "load",
    title: "Carico salito troppo in fretta",
    text: "Chilometri, intensità, salite o gare ravvicinate: l'osso si adatta più lentamente del fiato. Dopo un blocco duro il volume si riprende per gradi.",
  },
  {
    id: "surface",
    title: "Superficie e scarpe",
    text: "Asfalto duro e scarpe oltre i 600–800 km danno più impatto. Alterna terreni e cambia le scarpe prima che siano morte.",
  },
  {
    id: "strength",
    title: "Polpaccio e anca deboli",
    text: "Se i muscoli che frenano l'atterraggio non reggono, il carico passa alla tibia. Per questo la forza, non lo stretching, è il centro del programma.",
  },
  {
    id: "stride",
    title: "Passo lungo, cadenza bassa",
    text: "Atterrare con il piede davanti al corpo aumenta l'impatto. Alza la cadenza del 5% e accorcia il passo: spesso toglie il dolore da solo.",
  },
];

// ── logica pura, testabile ────────────────────────────────────────────────────

export const phaseById = (id: PhaseId): Phase => PHASES.find((p) => p.id === id) ?? PHASES[0];

/** Gli esercizi di una fase, con l'eventuale filtro per attrezzo. Senza filtro: tutti. */
export function exercisesFor(phase: PhaseId, equipment: Equipment | "tutti" = "tutti"): Exercise[] {
  return EXERCISES.filter((e) => e.phases.includes(phase) && (equipment === "tutti" || e.equipment.includes(equipment)));
}

export interface PainEntry {
  /** YYYY-MM-DD */
  date: string;
  /** Il primo passo del mattino, 0–10. */
  morning: number;
  /** Camminando, 0–10. */
  walking: number;
  /** Durante esercizi o corsa, 0–10. */
  effort: number;
}

const clampPain = (n: number) => Math.max(0, Math.min(10, Math.round(Number.isFinite(n) ? n : 0)));

/** Aggiunge o sostituisce il giorno, tenendo il registro ordinato per data. */
export function upsertPain(log: PainEntry[], entry: PainEntry): PainEntry[] {
  const clean: PainEntry = {
    date: entry.date,
    morning: clampPain(entry.morning),
    walking: clampPain(entry.walking),
    effort: clampPain(entry.effort),
  };
  return [...log.filter((e) => e.date !== clean.date), clean].sort((a, b) => a.date.localeCompare(b.date));
}

/** Il picco del giorno: è quello che il semaforo guarda. */
export const painPeak = (e: PainEntry) => Math.max(e.morning, e.walking, e.effort);

export type PainTrend = "scende" | "stabile" | "sale" | "dati-pochi";

/**
 * Come va: confronta la media del picco degli ultimi 3 giorni registrati con i 3
 * precedenti. Servono almeno 4 giorni, altrimenti non si dice niente.
 */
export function painTrend(log: PainEntry[]): PainTrend {
  if (log.length < 4) return "dati-pochi";
  const peaks = log.map(painPeak);
  const last = peaks.slice(-3);
  const before = peaks.slice(-6, -3);
  if (!before.length) return "dati-pochi";
  const avg = (a: number[]) => a.reduce((s, n) => s + n, 0) / a.length;
  const d = avg(last) - avg(before);
  return d <= -0.7 ? "scende" : d >= 0.7 ? "sale" : "stabile";
}

/** In che banda del semaforo cade un valore di dolore. */
export function painBand(value: number): PainBand["id"] {
  return value >= 5 ? "rosso" : value >= 3 ? "giallo" : "verde";
}
