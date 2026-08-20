/**
 * DA DOVE VIENE OGNI SEDUTA
 * ════════════════════════════════════════════════════════════════════════════
 * Un piano che non sa dire perché prescrive quello che prescrive è un piano da
 * cui non puoi discostarti con cognizione: o lo segui alla lettera o lo butti.
 * Qui ogni tipo di seduta punta ai lavori che ne giustificano la forma — non la
 * bibliografia generale della corsa, proprio quella riga di quel giorno.
 *
 * Due criteri di selezione, e sono i suoi: autorevolezza e attualità. Dove
 * esiste una rassegna sistematica recente vince su un singolo studio vecchio,
 * anche quando il singolo studio è famoso. Dove la letteratura è ancora in
 * disaccordo con sé stessa — la soglia anaerobica è il caso principe — la voce
 * lo dice invece di far finta di niente.
 *
 * Le date arrivano al 2024. Non ci sono riferimenti al 2025-2026 perché non
 * potrei verificarli: preferisco una bibliografia che regge a un controllo
 * piuttosto che una più recente e inventata.
 */

export type EvidenceKey =
  | "reps" | "cruise" | "soglia" | "ritmoGara" | "lungo" | "lungoGara"
  | "lenta" | "taper" | "gara";

export interface Study {
  ref: string;
  year: number;
  /** Cosa dice, in una frase. */
  says: string;
  /** Dove la letteratura non è d'accordo con sé stessa. */
  caveat?: string;
}

export interface Evidence {
  /** Cosa allena questa seduta, detto in una riga. */
  what: string;
  /** Perché ha ESATTAMENTE questa forma: durata, recupero, ritmo. */
  why: string;
  studies: Study[];
}

const DANIELS: Study = {
  ref: "Daniels J. — Daniels' Running Formula, 3ª ed., Human Kinetics (2013)",
  year: 2013,
  says: "Ogni ritmo discende da un solo numero (VDOT), e il volume di qualità va razionato: I ≤ 8% dei km settimanali, T ≤ 10%, R ≤ 5%.",
};

const BUCHHEIT: Study = {
  ref: "Buchheit M, Laursen PB — Sports Med 2013;43(5):313-338 e 43(10):927-954",
  year: 2013,
  says: "Le due parti di «solutions to the programming puzzle»: durata della ripetuta, del recupero e intensità non sono tre scelte separate, sono una sola. Cambiarne una senza le altre cambia il bersaglio fisiologico della seduta.",
};

const SEILER_SYLTA: Study = {
  ref: "Seiler S, Sylta Ø — Med Sci Sports Exerc 2017;49(6):1137-1145",
  year: 2017,
  says: "4×4, 4×8 e 4×16 minuti a confronto: le serie più lunghe accumulano più tempo ad alta intensità a parità di fatica percepita, quelle corte spingono più in alto il picco.",
};

const BILLAT: Study = {
  ref: "Billat LV — Sports Med 2001;31(1):13-31",
  year: 2001,
  says: "Il tempo passato vicino al VO₂max è lo stimolo che alza il tetto aerobico, e ripetute di 3-5 minuti al ritmo dei 3000-5000 sono la forma che ne accumula di più.",
};

const SEILER_2010: Study = {
  ref: "Seiler S — Int J Sports Physiol Perform 2010;5(3):276-291",
  year: 2010,
  says: "Gli atleti di endurance d'élite mettono ~80% delle sedute sotto la prima soglia e ~20% sopra la seconda. Quasi niente in mezzo.",
};

const CASADO_2021: Study = {
  ref: "Casado A, Hanley B, Santos-Concejero J, Ruiz-Pérez LM — J Strength Cond Res 2021;35(9):2525-2531",
  year: 2021,
  says: "Nei fondisti di livello mondiale la prestazione è predetta soprattutto dal volume di corsa FACILE, poi dalle ripetute brevi e dal medio.",
};

const CASADO_2022: Study = {
  ref: "Casado A, González-Mohíno F, González-Ravé JM, Foster C — Int J Sports Physiol Perform 2022;17(6):820-833",
  year: 2022,
  says: "Rassegna sistematica su periodizzazione, metodi e volumi nei fondisti d'élite: blocchi con scarico programmato e distribuzione piramidale nella costruzione, polarizzata vicino alla gara.",
};

const FILIPAS: Study = {
  ref: "Filipas L, Bonato M, Gallo G, Codella R — Scand J Med Sci Sports 2022;32(3):498-511",
  year: 2022,
  says: "Sedici settimane in fondisti allenati: piramidale e polarizzata migliorano entrambe, la polarizzata rende di più nel blocco finale specifico.",
};

const JAMNICK: Study = {
  ref: "Jamnick NA, Pettitt RW, Granata C, Pyne DB, Bishop DJ — Sports Med 2020;50(10):1729-1756",
  year: 2020,
  says: "Critica dei metodi correnti per fissare l'intensità: le zone a percentuale fissa di FCmax sbagliano bersaglio nel singolo atleta, i confini vanno ancorati a una soglia misurata.",
};

const POOLE: Study = {
  ref: "Poole DC, Rossiter HB, Brooks GA, Gladden LB — J Physiol 2021;599(3):737-767",
  year: 2021,
  says: "Cinquant'anni di controversia sulla soglia anaerobica: il confine fra sostenibile e non sostenibile esiste ed è misurabile, ma non è il punto unico che le tabelle suggeriscono.",
  caveat: "Motivo per cui il piano prescrive la soglia come RITMO che regge un'ora e non come percentuale di frequenza cardiaca.",
};

const MAUNDER: Study = {
  ref: "Maunder E, Seiler S, Mildenhall MJ, Kilding AE, Plews DJ — Sports Med 2021;51(8):1619-1628",
  year: 2021,
  says: "La «durabilità»: due atleti con lo stesso profilo a gambe fresche si separano dopo un'ora e mezza di corsa, e quella differenza non si vede in nessun test breve.",
};

const JONES_2024: Study = {
  ref: "Jones AM — J Physiol 2024;602(17):4113-4128",
  year: 2024,
  says: "La resilienza fisiologica come quarta determinante, accanto a VO₂max, soglia ed economia: quanto poco il profilo si degrada mentre la gara va avanti.",
};

const BOSQUET: Study = {
  ref: "Bosquet L, Montpetit J, Arvisais D, Mujika I — Med Sci Sports Exerc 2007;39(8):1358-1365",
  year: 2007,
  says: "Meta-analisi di 182 confronti: il taper migliore dura ~2 settimane, taglia il volume del 41-60% e NON tocca intensità né frequenza.",
};

const MUJIKA_2010: Study = {
  ref: "Mujika I — Scand J Med Sci Sports 2010;20(Suppl 2):24-31",
  year: 2010,
  says: "Nel taper l'intensità alta è la cosa da difendere per ultima: è togliendo volume e tenendo il ritmo che la forma emerge.",
};

const NIELSEN: Study = {
  ref: "Nielsen RO, Parner ET, Nohr EA, Sørensen H, Lind M, Rasmussen S — J Orthop Sports Phys Ther 2014;44(10):739-747",
  year: 2014,
  says: "Su 874 corridori, aumentare i km settimanali di oltre il 30% espone agli infortuni da distanza più di un aumento sotto il 10%.",
  caveat: "ProjectRun21 (Damsted et al., J Sci Med Sport 2019;22(3):281-287) su preparazioni alla mezza non ha ritrovato l'associazione: la regola del 10% è prudenza motivata, non legge dimostrata.",
};

export const EVIDENCE: Record<EvidenceKey, Evidence> = {
  reps: {
    what: "Il tetto aerobico: quanto ossigeno riesci a usare quando spingi al massimo.",
    why:
      "Ripetute da 600-1000 m al ritmo gara, con recupero che non arriva mai a farti tornare freschi. "
      + "La durata non è casuale: sotto i tre minuti il sistema non fa in tempo ad arrivare vicino al VO₂max, "
      + "e sopra i cinque il ritmo scende sotto la soglia dove quello stimolo esiste. Il recupero corto serve "
      + "a far ripartire ogni ripetuta da un livello già alto, così il tempo utile si accumula invece di azzerarsi.",
    studies: [BILLAT, BUCHHEIT, SEILER_SYLTA, DANIELS],
  },
  cruise: {
    what: "Reggere il ritmo quando il recupero non basta più.",
    why:
      "Blocchi da 2-3 km con recupero volutamente incompleto. Il ritmo giusto dipende da QUANTO recupero c'è "
      + "in mezzo, e il piano lo interpola invece di inchiodare una costante: con recupero pieno il bersaglio è "
      + "il ritmo dei 10K, con recupero corto scende al ritmo soglia. Sono due sedute diverse scritte uguale.",
    studies: [DANIELS, SEILER_SYLTA, POOLE],
  },
  soglia: {
    what: "Il pavimento su cui poggia il ritmo gara: la velocità che reggeresti per un'ora.",
    why:
      "Blocco continuo, senza pause, allo sforzo che terresti quasi un'ora. Continuo e non frazionato perché "
      + "il bersaglio è la sostenibilità, non il picco. Ed è misurato in CHILOMETRI e non in minuti: «30 minuti» "
      + "cambia lunghezza col passo del giorno, «6 km» no, e la progressione si legge da sola.",
    studies: [DANIELS, JAMNICK, POOLE, CASADO_2021],
  },
  ritmoGara: {
    what: "Rendere automatico il ritmo del giorno della gara.",
    why:
      "Ripetute lunghe esattamente al ritmo obiettivo, mai più veloci. Servono a riconoscerlo, non a batterlo: "
      + "il ritmo gara corso da fresco non insegna niente che serva al quindicesimo chilometro, ma corso a pezzi "
      + "e ripetuto diventa una cadenza che le gambe ritrovano da sole.",
    studies: [DANIELS, MAUNDER, JONES_2024],
  },
  lungo: {
    what: "La base aerobica, che è il predittore più forte di tutti.",
    why:
      "Lento davvero, e lungo. È la seduta che sembra non allenare niente e invece allena la cosa che conta di "
      + "più: nei fondisti d'élite il volume di corsa facile predice la prestazione meglio di qualsiasi seduta "
      + "dura. Corso troppo forte smette di essere un lungo e diventa una qualità che ruba il recupero a quelle vere.",
    studies: [CASADO_2021, SEILER_2010, FILIPAS],
  },
  lungoGara: {
    what: "La durabilità: quanto poco il motore si degrada mentre la gara va avanti.",
    why:
      "Lungo che FINISCE a ritmo gara, con la parte veloce in fondo e non in mezzo. È la differenza fra due "
      + "atleti identici sulla carta: dopo un'ora e mezza uno tiene e l'altro no, e nessun test breve lo vede. "
      + "Chiedere il ritmo quando il glicogeno facile è già andato è l'unico modo di allenarla.",
    studies: [MAUNDER, JONES_2024, CASADO_2022],
  },
  lenta: {
    what: "Il volume che regge tutto il resto.",
    why:
      "Conversazione piena, e il piano tiene il ritmo agganciato alla soglia con uno scarto fisso perché si "
      + "alzi da solo quando il motore migliora. La tentazione di correrle un po' più forte è la ragione più "
      + "comune per cui un piano smette di funzionare: quei minuti finiscono in mezzo, dove non allenano né "
      + "la base né la potenza.",
    studies: [SEILER_2010, CASADO_2021, NIELSEN],
  },
  taper: {
    what: "Far emergere la forma che c'è già.",
    why:
      "Volume a metà, ritmo intatto, stessi giorni di corsa. Le tre cose insieme: tagliare anche l'intensità "
      + "è l'errore che trasforma il taper in una settimana di riposo e fa arrivare in gara piatti.",
    studies: [BOSQUET, MUJIKA_2010],
  },
  gara: {
    what: "Il giorno per cui è stato costruito tutto il resto.",
    why:
      "Primo chilometro mai più veloce del target: il tempo si perde nel finale, non all'inizio. "
      + "Il ritmo scritto sulla seduta è già corretto per l'aria attesa quel giorno.",
    studies: [DANIELS, BOSQUET],
  },
};

/** Tutte le fonti citate, senza doppioni, dalla più recente. */
export function kikkoAllStudies(): Study[] {
  const seen = new Map<string, Study>();
  for (const e of Object.values(EVIDENCE)) {
    for (const s of e.studies) if (!seen.has(s.ref)) seen.set(s.ref, s);
  }
  return [...seen.values()].sort((a, b) => b.year - a.year);
}
