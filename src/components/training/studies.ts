/**
 * LE FONTI
 * ════════════════════════════════════════════════════════════════════════════
 * Ogni scelta del piano — quanto volume, quante qualità, quanto taper, quanto
 * pesa il caldo, quanto è probabile arrivarci — punta a un lavoro pubblicato.
 * Non è bibliografia decorativa: il motore legge questi id e la pagina mostra
 * accanto a ogni regola il perché e da dove viene, così una prescrizione si
 * può discutere invece che subire.
 *
 * Dove la letteratura è in disaccordo con sé stessa (l'ACWR, il credito del
 * caldo al fresco) la voce lo dice: un piano che nasconde le controversie è un
 * piano di cui non sai quando smettere di fidarti.
 */

export type StudyId =
  | "daniels-2013" | "seiler-2010" | "stoggl-2014" | "casado-2021" | "filipas-2022"
  | "esteve-lanao-2007" | "billat-2001" | "milanovic-2015" | "issurin-2010"
  | "bosquet-2007" | "mujika-2003"
  | "gabbett-2016" | "impellizzeri-2020" | "nielsen-2014" | "damsted-2019"
  | "ely-2007" | "periard-2021" | "periard-2015" | "lorenzo-2010" | "racinais-2015"
  | "hopkins-2001" | "riegel-1981" | "vickers-2016"
  | "blagrove-2018" | "llanos-2024" | "jones-2017";

export type StudyTopic = "carico" | "intensità" | "taper" | "caldo" | "previsione" | "forza";

export interface Study {
  id: StudyId;
  /** Come si cita in una riga. */
  ref: string;
  year: number;
  topic: StudyTopic;
  /** Cosa dice, in una frase. */
  says: string;
  /** Cosa ne fa questo piano. */
  used: string;
  /** Dove la letteratura non è d'accordo con sé stessa. */
  caveat?: string;
}

export const STUDIES: Record<StudyId, Study> = {
  "daniels-2013": {
    id: "daniels-2013", year: 2013, topic: "intensità",
    ref: "Daniels J. — Daniels' Running Formula, 3ª ed., Human Kinetics (2013)",
    says: "Ogni ritmo di allenamento discende da un solo numero (VDOT), e il volume di qualità va razionato: I ≤ 8% dei km settimanali, T ≤ 10%, R ≤ 5%.",
    used: "I ritmi E/M/T/I/R e i tetti settimanali di qualità: il motore dimensiona le ripetute dentro quei limiti, non al contrario.",
  },
  "seiler-2010": {
    id: "seiler-2010", year: 2010, topic: "intensità",
    ref: "Seiler S. — Int J Sports Physiol Perform 2010;5(3):276-291",
    says: "Gli atleti di endurance d'élite mettono ~80% delle sedute sotto la prima soglia e ~20% sopra la seconda, quasi niente in mezzo.",
    used: "Il rapporto 80/20 fra minuti facili e minuti di qualità è il vincolo su cui si costruisce ogni settimana.",
  },
  "stoggl-2014": {
    id: "stoggl-2014", year: 2014, topic: "intensità",
    ref: "Stöggl T, Sperlich B. — Front Physiol 2014;5:33",
    says: "Nove settimane polarizzate battono soglia, alto volume e HIIT puro su VO₂max, tempo a esaurimento e picco di velocità.",
    used: "Giustifica due sole qualità a settimana con tutto il resto davvero facile, invece di tre sedute medie.",
  },
  "casado-2021": {
    id: "casado-2021", year: 2021, topic: "intensità",
    ref: "Casado A, Hanley B, Santos-Concejero J, Ruiz-Pérez LM — J Strength Cond Res 2021;35(9):2525-2531",
    says: "Nei fondisti di livello mondiale la prestazione è predetta soprattutto dal volume di corsa facile, poi dalle ripetute brevi e dal medio.",
    used: "Il volume facile è il primo obiettivo del piano; le ripetute stanno sopra, non al posto.",
  },
  "filipas-2022": {
    id: "filipas-2022", year: 2022, topic: "intensità",
    ref: "Filipas L, Bonato M, Gallo G, Codella R. — Scand J Med Sci Sports 2022;32(3):498-511",
    says: "Su 16 settimane in fondisti allenati, piramidale e polarizzata migliorano entrambe; la polarizzata rende di più nel blocco finale specifico.",
    used: "Piramidale nel blocco di costruzione, polarizzata nelle settimane vicino alla gara.",
  },
  "esteve-lanao-2007": {
    id: "esteve-lanao-2007", year: 2007, topic: "intensità",
    ref: "Esteve-Lanao J, Foster C, Seiler S, Lucía A. — J Strength Cond Res 2007;21(3):943-949",
    says: "A parità di carico, chi mette più minuti in zona 1 corre più forte in gara di chi li sposta in zona 2.",
    used: "I lenti restano lenti: il motore fissa il ritmo facile a T+85″ e non lo lascia scivolare.",
  },
  "billat-2001": {
    id: "billat-2001", year: 2001, topic: "intensità",
    ref: "Billat LV. — Sports Med 2001;31(1):13-31 e 31(2):75-90",
    says: "Il tempo passato vicino al VO₂max è lo stimolo che alza il tetto aerobico; ripetute di 3-5 minuti al ritmo dei 3000-5000 lo massimizzano.",
    used: "Le ripetute del blocco 5K sono da 1000-1200 m (3½-5′), non da 400.",
  },
  "milanovic-2015": {
    id: "milanovic-2015", year: 2015, topic: "previsione",
    ref: "Milanović Z, Sporiš G, Weston M. — Sports Med 2015;45(10):1469-1481",
    says: "Meta-analisi su 28 studi: l'HIIT alza il VO₂max più del continuo, ma il guadagno si dimezza man mano che il soggetto è già allenato.",
    used: "Il tasso di miglioramento proiettato (≈ +0,9 punti VDOT su 8 settimane a questo livello) esce da qui, non da un ottimismo.",
  },
  "issurin-2010": {
    id: "issurin-2010", year: 2010, topic: "carico",
    ref: "Issurin VB. — Sports Med 2010;40(3):189-206",
    says: "I blocchi concentrati con scarico programmato reggono meglio della periodizzazione classica quando le gare sono ravvicinate.",
    used: "Struttura a blocchi 2:1 e scarico prima di ogni gara, invece di un'unica lunga progressione.",
  },
  "bosquet-2007": {
    id: "bosquet-2007", year: 2007, topic: "taper",
    ref: "Bosquet L, Montpetit J, Arvisais D, Mujika I. — Med Sci Sports Exerc 2007;39(8):1358-1365",
    says: "Meta-analisi di 182 confronti: il taper migliore dura ~2 settimane, taglia il volume del 41-60% e NON tocca intensità né frequenza. Guadagno medio ≈ 3%.",
    used: "Il taper di entrambe le gare: volume a scendere, ripetute corte mantenute, stessi giorni di corsa.",
    caveat: "Il 3% medio è misurato contro un blocco di carico pieno. Qui il VDOT è già ancorato a prove fresche, quindi il motore ne accredita meno di un terzo (0,8%).",
  },
  "mujika-2003": {
    id: "mujika-2003", year: 2003, topic: "taper",
    ref: "Mujika I, Padilla S. — Med Sci Sports Exerc 2003;35(7):1182-1187",
    says: "Riduzione esponenziale del volume, frequenza invariata, intensità invariata: è la combinazione che produce la supercompensazione.",
    used: "La curva del taper è esponenziale (−20%, poi −45%), non un gradino.",
  },
  "gabbett-2016": {
    id: "gabbett-2016", year: 2016, topic: "carico",
    ref: "Gabbett TJ. — Br J Sports Med 2016;50(5):273-280",
    says: "Il rischio non sta nel carico alto, sta nel salto: rapporto carico acuto/cronico oltre 1,5 e l'infortunio diventa probabile.",
    used: "Nessuna settimana del piano supera 1,3 volte la media delle 4 precedenti.",
    caveat: "Vedi Impellizzeri 2020: l'ACWR è statisticamente fragile. Qui è un tetto di sicurezza, mai una previsione.",
  },
  "impellizzeri-2020": {
    id: "impellizzeri-2020", year: 2020, topic: "carico",
    ref: "Impellizzeri FM, Woodcock S, Coutts AJ, Fanchini M, McCall A, Vigotsky AD. — Int J Sports Physiol Perform 2020;15(6):907-913",
    says: "L'ACWR soffre di correlazione matematica spuria e di artefatti di soglia: non è la legge fisica che è stata raccontata.",
    used: "Motivo per cui il piano non ottimizza l'ACWR: lo usa solo come limite superiore, insieme a un tetto assoluto sul salto settimanale.",
  },
  "nielsen-2014": {
    id: "nielsen-2014", year: 2014, topic: "carico",
    ref: "Nielsen RO, Parner ET, Nohr EA, Sørensen H, Lind M, Rasmussen S. — J Orthop Sports Phys Ther 2014;44(10):739-747",
    says: "Su 874 corridori, aumentare i km settimanali di oltre il 30% espone agli infortuni da distanza più di un aumento sotto il 10%.",
    used: "Tetto duro: +10% a settimana sul volume, mai due salti pieni consecutivi.",
  },
  "damsted-2019": {
    id: "damsted-2019", year: 2019, topic: "carico",
    ref: "Damsted C, Parner ET, Sørensen H, Malisoux L, Hulme A, Nielsen RØ. — J Sci Med Sport 2019;22(3):281-287 (ProjectRun21)",
    says: "In 14 settimane di preparazione alla mezza la progressione settimanale non è risultata associata all'infortunio: contano di più esperienza e ritmo abituale.",
    used: "Contrappeso onesto alla regola del 10%: il piano la applica come prudenza, non come verità dimostrata.",
  },
  "ely-2007": {
    id: "ely-2007", year: 2007, topic: "caldo",
    ref: "Ely MR, Cheuvront SN, Roberts WO, Montain SJ. — Med Sci Sports Exerc 2007;39(3):487-493",
    says: "Su sette maratone e migliaia di finisher la prestazione peggiora in modo continuo già da ~10 °C WBGT, e il costo cresce quanto più si è lenti.",
    used: "Il caldo entra nella previsione di gara come penalità continua sopra i 12 °C, scalata sulla distanza.",
  },
  "periard-2021": {
    id: "periard-2021", year: 2021, topic: "caldo",
    ref: "Périard JD, Eijsvogels TMH, Daanen HAM. — Physiol Rev 2021;101(4):1873-1979",
    says: "Rassegna di riferimento: sopra la neutralità termica la gittata destinata ai muscoli cala, e l'umidità pesa perché blocca l'evaporazione, non perché scalda.",
    used: "L'indice di gara è temperatura + punto di rugiada, non i soli gradi.",
  },
  "periard-2015": {
    id: "periard-2015", year: 2015, topic: "caldo",
    ref: "Périard JD, Racinais S, Sawka MN. — Scand J Med Sci Sports 2015;25(Suppl 1):20-38",
    says: "5-14 giorni di esposizione producono espansione del volume plasmatico, sudorazione più precoce e frequenza cardiaca più bassa a parità di lavoro.",
    used: "L'estate di lavoro al caldo non è tempo perso: il motore la contabilizza come credito da spendere quando rinfresca.",
  },
  "lorenzo-2010": {
    id: "lorenzo-2010", year: 2010, topic: "caldo",
    ref: "Lorenzo S, Halliwill JR, Sawka MN, Minson CT. — J Appl Physiol 2010;109(4):1140-1147",
    says: "Dieci giorni di acclimatazione hanno migliorato VO₂max (+5%) e prova a cronometro (+6%) anche in condizioni fresche.",
    used: "Stima del credito termico che l'estate porta alle gare d'autunno.",
    caveat: "Non replicato in modo pulito (Karlsen 2015, Nybo 2017): il motore accredita al massimo ~1 punto di VDOT, non il 5-6% dello studio.",
  },
  "racinais-2015": {
    id: "racinais-2015", year: 2015, topic: "caldo",
    ref: "Racinais S, Alonso JM, Coutts AJ, et al. — Scand J Med Sci Sports 2015;25(Suppl 1):6-19",
    says: "Raccomandazioni di consenso: al caldo si adattano i ritmi, non la volontà; sopra certe soglie la seduta va spostata di orario.",
    used: "La tabella indice → penalità di ritmo, e la regola che sopra indice 59 la qualità si sposta all'alba o salta.",
  },
  "hopkins-2001": {
    id: "hopkins-2001", year: 2001, topic: "previsione",
    ref: "Hopkins WG, Hewson DJ. — Med Sci Sports Exerc 2001;33(9):1588-1592",
    says: "La variabilità della prestazione di un fondista fra gare simili è di circa 1,2-1,6% di coefficiente di variazione.",
    used: "È la deviazione standard di base della probabilità di successo: nemmeno la forma perfetta rende una gara un numero certo.",
  },
  "riegel-1981": {
    id: "riegel-1981", year: 1981, topic: "previsione",
    ref: "Riegel PS. — American Scientist 1981;69(3):285-290",
    says: "I tempi su distanze diverse stanno in legge di potenza: T₂ = T₁·(D₂/D₁)^b, con b ≈ 1,06 negli atleti allenati.",
    used: "Converte il 5K in mezza. L'esponente non è una costante: è la tenuta di QUESTO atleta, e il piano lo abbassa allungando i lunghi.",
  },
  "vickers-2016": {
    id: "vickers-2016", year: 2016, topic: "previsione",
    ref: "Vickers AJ, Vertosick EA. — BMC Sports Sci Med Rehabil 2016;8:26",
    says: "Su 2.497 podisti amatori il chilometraggio settimanale è il predittore modificabile più forte del tempo in gara; l'esponente di Riegel peggiora nei bassi volumi.",
    used: "Il volume settimanale entra direttamente nell'esponente di tenuta: è il motivo per cui la mezza si guadagna con i km, non con le ripetute.",
  },
  "blagrove-2018": {
    id: "blagrove-2018", year: 2018, topic: "forza",
    ref: "Blagrove RC, Howatson G, Hayes PR. — Sports Med 2018;48(5):1117-1149",
    says: "2-3 sedute a settimana di forza pesante e pliometria migliorano l'economia di corsa del 2-8% senza ipertrofia rilevante.",
    used: "Due richiami di forza a settimana agganciati ai giorni facili, tolti negli ultimi 10 giorni.",
  },
  "llanos-2024": {
    id: "llanos-2024", year: 2024, topic: "forza",
    ref: "Llanos-Lagos C, Ramirez-Campillo R, Moran J, Sáez de Villarreal E. — Sports Med 2024;54(4):895-932",
    says: "Meta-analisi recente: il guadagno di economia è maggiore alle velocità di gara e con carichi alti (≥80% 1RM) o pliometrici, non con circuiti leggeri.",
    used: "Le sedute di forza sono poche serie pesanti più salti, non un circuito di resistenza muscolare.",
  },
  "jones-2017": {
    id: "jones-2017", year: 2017, topic: "previsione",
    ref: "Jones AM, Vanhatalo A. — Sports Med 2017;47(Suppl 1):65-78",
    says: "Due prove massimali di durata diversa individuano velocità critica e D′: il confine reale fra sostenibile e non sostenibile.",
    used: "Impianto dei test sul campo: una prova lunga (3000 m) e una prova a ritmo gara dicono cose diverse e servono entrambe.",
  },
};

export const studyList = (ids: StudyId[]): Study[] => ids.map((id) => STUDIES[id]);
export const allStudies = (): Study[] =>
  Object.values(STUDIES).sort((a, b) => b.year - a.year || a.ref.localeCompare(b.ref));
