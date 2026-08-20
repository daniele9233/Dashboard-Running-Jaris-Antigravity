import type { Session } from "../../types/api";
import { predictSec, vdotFrom, heatSlowdownFrac, fmtPace, fmtClock } from "../gamification/gamiCore";
import {
  ROME, conditionsAt, bandForIndex, heatAdjustedPace,
  type Climate, type Conditions, type HeatKind,
} from "./climate";
import { STUDIES, type Study, type StudyId } from "./studies";

/**
 * IL PIANO
 * ════════════════════════════════════════════════════════════════════════════
 * Un generatore che parte da due domande a cui un atleta sa rispondere — che
 * tempo, che giorno — e costruisce all'indietro fino a lunedì prossimo.
 *
 * Le quattro cose che questo motore fa e che un piano scaricato da internet non
 * può fare:
 *
 * 1. DUE GARE, UN SOLO CORPO. Una gara corta e una lunga a tre settimane di
 *    distanza non sono due programmi affiancati: la prima è il test della
 *    seconda, e le tre settimane in mezzo non bastano per costruire, bastano
 *    solo per convertire. Il motore periodizza le due insieme.
 *
 * 2. IL VOLUME COMANDA LE RIPETUTE, NON IL CONTRARIO. I tetti di Daniels
 *    (I ≤ 8% dei km settimanali, T ≤ 10%, R ≤ 5%) sono vincoli veri: le
 *    ripetute vengono DIMENSIONATE dentro il budget della settimana. Se il
 *    budget è piccolo il piano non finge, dice che il limite è il volume.
 *
 * 3. LA TENUTA È UN NUMERO, NON UN AGGETTIVO. L'esponente di Riegel di QUESTO
 *    atleta — quanto perde allungando la distanza — si stima dai suoi km e dal
 *    suo lungo, e il piano lo abbassa di proposito. È l'unica leva che sposta
 *    una mezza quando i 5000 sono già a posto.
 *
 * 4. LA PROBABILITÀ È UNA DISTRIBUZIONE, NON UNA PROMESSA. Il numero finale è
 *    una gaussiana con dentro: la variabilità di gara misurata (Hopkins 2001),
 *    l'incertezza della proiezione di forma, il meteo del giorno e — sulle
 *    distanze lunghe — l'incertezza sulla tenuta. Da lì esce una percentuale
 *    che si può discutere invece che sperare.
 *
 * Ogni regola è agganciata a un id in `studies.ts`. Se una regola non ha una
 * fonte non sta qui.
 */

/* ══ 1 · INGRESSI ═════════════════════════════════════════════════════════ */

export interface RaceGoal {
  id: string;
  /** "5K", "Mezza", … */
  label: string;
  distanceM: number;
  targetSec: number;
  dateIso: string;
  /** Ora di partenza. È la voce che pesa di più su una gara di settembre. */
  startHour: number;
  /** A = gara che decide la stagione, B = la seconda. */
  priority: "A" | "B";
}

/** La forma di partenza. Il motore non la indovina: gliela si passa. */
export interface FitnessSnapshot {
  /** VDOT attuale, ancorato a una prova reale. */
  vdot: number;
  /** Da cosa è ancorato — va mostrato, perché cambia quanto ci si può fidare. */
  vdotSource: string;
  /** Media delle ultime 4 settimane. */
  weeklyKm: number;
  /** Massimo settimanale delle ultime 12: quello che il corpo ha già retto. */
  peakWeeklyKm: number;
  /** Uscita più lunga delle ultime 6 settimane. */
  longestKm: number;
  runsPerWeek: number;
  /**
   * Il VDOT che una PRESTAZIONE ha davvero dimostrato, sopra i 5 km.
   *
   * L'ancora del backend è una media pesata su tante corse e può stare sopra a
   * quello che il cronometro ha visto. Dove i due numeri divergono comanda la
   * prestazione misurata: il divario non viene nascosto, allarga la banda di
   * incertezza e fa comparire un avviso. È anche il motivo per cui la prima
   * seduta del piano è un 3000 a tutta.
   */
  vdotDemonstrated?: number | null;
  vdotDemonstratedFrom?: string;
}

export interface PlanConfig {
  todayIso: string;
  /** Lunedì di partenza. */
  startIso: string;
  goals: RaceGoal[];
  fitness: FitnessSnapshot;
  /** Tetto settimanale che l'atleta accetta. */
  maxWeeklyKm: number;
  /** Uscite a settimana da programmare (4-6). */
  runsPerWeek: number;
  /**
   * Il clima in cui ti ALLENI: le tue corse, non le medie.
   *
   * Serve per i ritmi delle sedute, e lì è il dato giusto: chi esce alle sei
   * non corre alla temperatura media di agosto.
   */
  climate: Climate;
  /**
   * Il clima della GARA, che è un'altra cosa e va tenuto separato.
   *
   * Le temperature delle tue corse sono selezionate: i giorni peggiori li salti,
   * le ore peggiori le eviti. Ottima abitudine, pessima statistica — la mediana
   * che ne esce sta sotto la normale climatica anche dopo aver tolto l'ora del
   * giorno, e usarla per prevedere una gara significa promettere un tempo che
   * dipende dal fatto che il 25 settembre sia una bella giornata. La gara si
   * corre col tempo che fa, quindi qui vanno le normali.
   */
  raceClimate?: Climate;
  /** Due richiami di forza a settimana (Blagrove 2018, Llanos-Lagos 2024). */
  strength: boolean;
}

/* ══ 2 · USCITE ═══════════════════════════════════════════════════════════ */

export type BlockId =
  | "avvio" | "carico" | "specifico" | "affilatura" | "taper" | "gara"
  | "rigenerazione" | "specificoHM";

export interface PlanSession extends Session {
  /** Ruolo nella settimana — serve al colore e all'ordinamento. */
  kind: "rest" | "recovery" | "easy" | "long" | "tempo" | "intervals" | "race" | "strength";
  /** Perché questa seduta esiste, in una riga. */
  why: string;
  studies: StudyId[];
  /** Seduta chiave: se salta, salta la settimana. */
  key: boolean;
  /** Test di verifica con un cancello da superare. */
  test?: PlanTest;
  /** Aria attesa quel giorno a quell'ora, e ritmo già corretto. */
  heat?: {
    conditions: Conditions;
    kind: HeatKind;
    baseSec: number;
    adjustedFrom: number;
    adjustedTo: number;
    /** Quanto costa quell'aria, in percentuale sul passo. */
    penaltyPct: number;
  };
}

export interface PlanTest {
  id: string;
  label: string;
  /** Cosa misura, e perché quella prova invece di un'altra. */
  measures: string;
  /** Il cancello: sotto questo valore sei in linea. */
  gate: string;
  /** Sopra questo sei fuori linea e il piano va ricalibrato. */
  alarm: string;
  studies: StudyId[];
}

export interface PlanWeek {
  index: number;
  startIso: string;
  endIso: string;
  block: BlockId;
  blockLabel: string;
  /** Perché questa settimana è così e non altrimenti. */
  why: string;
  targetKm: number;
  /** Carico acuto / cronico a 4 settimane: il tetto di sicurezza. */
  acwr: number;
  qualityCount: number;
  vdot: number;
  sessions: PlanSession[];
  studies: StudyId[];
  /** Quanto della settimana è qualità, in km. Serve a mostrare l'80/20. */
  qualityKm: number;
}

export interface Lever {
  label: string;
  detail: string;
  /** Secondi guadagnati (negativo = tempo più basso). */
  deltaSec: number;
}

export interface GoalOutlook {
  goal: RaceGoal;
  /** VDOT che quel tempo richiede, in condizioni ideali. */
  vdotRequired: number;
  /** VDOT proiettato al giorno di gara sotto questo piano. */
  vdotProjected: number;
  /** Previsione al fresco, dopo taper. */
  predictedCoolSec: number;
  /** Previsione nelle condizioni attese di quel giorno a quell'ora. */
  predictedSec: number;
  conditions: Conditions;
  heatCostSec: number;
  /** Esponente di tenuta usato (solo distanze > 10 km lo sentono davvero). */
  riegelExp: number;
  sigmaPct: number;
  probability: number;
  /** Banda 10-90%: il tempo non è un numero. */
  p10Sec: number;
  p90Sec: number;
  limiters: string[];
  levers: Lever[];
}

export interface Plan {
  config: PlanConfig;
  weeks: PlanWeek[];
  outlook: GoalOutlook[];
  tests: { dateIso: string; session: PlanSession }[];
  /** Esponente di tenuta oggi e a fine piano: la storia della mezza. */
  riegelNow: number;
  riegelEnd: number;
  peakKm: number;
  warnings: string[];
  studies: Study[];
}

/* ══ 3 · CALENDARIO ═══════════════════════════════════════════════════════ */

const DAY_MS = 86400000;
const dayIdx = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
const isoOf = (idx: number) => new Date(idx * DAY_MS).toISOString().slice(0, 10);
/** 0 = lunedì. */
const weekdayOf = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
const mondayOf = (iso: string) => isoOf(dayIdx(iso) - weekdayOf(iso));
const addDays = (iso: string, n: number) => isoOf(dayIdx(iso) + n);

const DAY_LABEL = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

/* ══ 4 · RITMI ════════════════════════════════════════════════════════════ */

export interface Paces {
  vdot: number;
  /** Ripetute lunghe: il ritmo che reggi ~12 minuti (I di Daniels). */
  interval: number;
  /** Ritmo gara 5000. */
  race5k: number;
  /** Soglia: il ritmo che reggi un'ora. */
  threshold: number;
  /** Ritmo mezza previsto per questo atleta (tenuta inclusa). */
  halfPace: number;
  /** Ritmo maratona teorico — la base dei medi. */
  marathon: number;
  easy: number;
  slow: number;
  /** Ripetute brevi (R): meccanica, non motore. */
  rep: number;
}

const paceOf = (distM: number, vdot: number) => predictSec(distM, vdot) / (distM / 1000);

/**
 * Tutti i ritmi da un solo numero, come vuole Daniels — con una sola
 * differenza: il ritmo mezza NON è quello della tabella, è quello che questo
 * atleta regge davvero, cioè il 5000 proiettato con il SUO esponente di tenuta.
 * È la stessa correzione che il resto dell'app chiama "frazione di picco".
 */
export function pacesFor(vdot: number, riegelExp: number): Paces {
  const race5k = paceOf(5000, vdot);
  const threshold = paceOf(distanceInSeconds(vdot, 3600), vdot);
  const halfSec = predictSec(5000, vdot) * Math.pow(21097.5 / 5000, riegelExp);
  return {
    vdot,
    race5k,
    interval: paceOf(distanceInSeconds(vdot, 720), vdot),
    threshold,
    halfPace: halfSec / 21.0975,
    marathon: paceOf(42195, vdot),
    easy: threshold + 85,
    slow: threshold + 105,
    rep: paceOf(distanceInSeconds(vdot, 720), vdot) - 15,
  };
}

/** Quanta distanza copri in `sec` secondi a quel VDOT. */
function distanceInSeconds(vdot: number, sec: number): number {
  let lo = 400, hi = 45000;
  for (let i = 0; i < 44; i++) {
    const mid = (lo + hi) / 2;
    if (predictSec(mid, vdot) < sec) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/* ══ 5 · TENUTA ═══════════════════════════════════════════════════════════ */

/**
 * L'ESPONENTE DI RIEGEL DI QUESTO ATLETA.
 *
 * Riegel 1981 misurò b ≈ 1,06 sui record: atleti a volume alto. Vickers &
 * Vertosick 2016, su 2.497 amatori, hanno mostrato che nei bassi
 * chilometraggi l'esponente peggiora — cioè si perde molto di più allungando.
 *
 * Il modello è deliberatamente semplice e con due sole variabili, perché sono
 * le due che l'atleta può cambiare: il volume cronico e il lungo. La taratura
 * è quella: 50 km/settimana e un lungo da 24 km portano a 1,055; 35 km con un
 * lungo da 15 danno 1,098, che è la differenza fra una mezza da 1:33 e una da
 * 1:37 a parità di 5000.
 */
export function riegelExponent(chronicKm: number, longestKm: number): number {
  const volGap = clamp01((50 - chronicKm) / 35);
  const longGap = clamp01((24 - longestKm) / 14);
  return 1.055 + 0.055 * volGap + 0.030 * longGap;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/* ══ 6 · VOLUME ═══════════════════════════════════════════════════════════ */

/** Quanto vale ogni blocco rispetto alla settimana di picco. */
const BLOCK_VOLUME: Record<BlockId, number> = {
  avvio: 0.82,
  carico: 0.93,
  specifico: 1.00,
  affilatura: 0.80,
  taper: 0.58,
  gara: 0.48,
  rigenerazione: 0.76,
  specificoHM: 1.02,
};

const BLOCK_LABEL: Record<BlockId, string> = {
  avvio: "Avvio",
  carico: "Carico",
  specifico: "Specifico 5K",
  affilatura: "Affilatura",
  taper: "Taper",
  gara: "Settimana di gara",
  rigenerazione: "Rigenerazione",
  specificoHM: "Specifico mezza",
};

/**
 * Il tetto: quanto volume può reggere questo atleta a fine piano.
 *
 * Tre limiti, vince il più basso. Il terzo è il meno ovvio ed è quello che
 * salva le gambe: +12 km assoluti sopra la media recente, perché il 35% di
 * crescita su 20 km/settimana è una cosa e su 80 è un'altra.
 */
export function ceilingKm(f: FitnessSnapshot, maxWeeklyKm: number): number {
  return Math.round(Math.min(maxWeeklyKm, f.weeklyKm * 1.35, f.weeklyKm + 12, f.peakWeeklyKm * 1.20));
}

/* ══ 7 · BLOCCHI ══════════════════════════════════════════════════════════ */

interface WeekSkeleton {
  index: number;
  startIso: string;
  endIso: string;
  block: BlockId;
  /** La gara che cade in questa settimana, se c'è. */
  race: RaceGoal | null;
  /** La gara verso cui questa settimana lavora. */
  towards: RaceGoal;
}

/**
 * Assegna i blocchi camminando ALL'INDIETRO da ogni gara. È l'unico ordine che
 * produce un piano coerente: il taper non è "le ultime settimane che avanzano",
 * è una finestra fissa che va prenotata prima di distribuire il resto.
 */
export function buildSkeleton(config: PlanConfig): WeekSkeleton[] {
  const goals = [...config.goals].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  const start = mondayOf(config.startIso);
  const last = goals[goals.length - 1];
  const lastMonday = mondayOf(last.dateIso);
  const total = Math.round((dayIdx(lastMonday) - dayIdx(start)) / 7) + 1;

  const blocks: BlockId[] = new Array(Math.max(1, total)).fill("carico");
  const weekOfIso = (iso: string) => Math.round((dayIdx(mondayOf(iso)) - dayIdx(start)) / 7);

  // 1 · prenota le finestre di gara, all'indietro.
  //
  //     Il taper è una finestra fissa; l'affilatura NO. Bosquet 2007 misura il
  //     taper dentro un ciclo lungo: prenotare due settimane scariche su un
  //     blocco che ne ha cinque significa allenarsi per tre e riposare per due,
  //     e a quel punto non resta niente da affilare. L'affilatura si prenota
  //     solo se davanti restano almeno quattro settimane vere di carico.
  const raceWeeks = goals
    .map((g) => ({ g, w: weekOfIso(g.dateIso) }))
    .filter(({ w }) => w >= 0 && w < blocks.length);

  for (let k = 0; k < raceWeeks.length; k++) {
    const { w } = raceWeeks[k];
    const prevRace = k > 0 ? raceWeeks[k - 1].w : -1;
    // settimane disponibili fra la gara precedente (o l'inizio) e questa
    const runway = w - prevRace - 1;
    blocks[w] = "gara";

    if (runway >= 3) {
      // taper vero: la settimana prima della gara
      if (w - 1 >= 0) blocks[w - 1] = "taper";
      if (runway >= 6 && w - 2 >= 0) blocks[w - 2] = "affilatura";
    }
    // runway < 3 (seconda gara molto ravvicinata): la settimana di gara è già
    // il taper — il suo volume è meno della metà del picco — e la settimana
    // prima resta di carico specifico, che è l'unica occasione rimasta.
  }

  // 2 · la settimana dopo una gara è rigenerazione, sempre. Correre forte lascia
  //     un conto che si paga nei sette giorni successivi, non importa quanto
  //     era corta la gara.
  for (const { w } of raceWeeks) {
    if (w + 1 < blocks.length && blocks[w + 1] === "carico") blocks[w + 1] = "rigenerazione";
  }

  // 3 · le settimane fra due gare che restano "carico" sono specifiche della
  //     seconda: tre settimane non costruiscono un motore, convertono quello
  //     che c'è già nella distanza nuova
  if (raceWeeks.length > 1) {
    const wA = raceWeeks[0].w;
    const last = raceWeeks[raceWeeks.length - 1];
    const longB = last.g.distanceM >= 15000;
    for (let i = wA + 1; i < last.w; i++) {
      if (blocks[i] === "carico") blocks[i] = longB ? "specificoHM" : "specifico";
    }
  }

  // 4 · la prima settimana è sempre di avvio, e l'ultima piena prima del taper
  //     della prima gara è quella specifica: le ripetute più lunghe stanno lì.
  if (blocks[0] === "carico") blocks[0] = "avvio";
  const firstRaceWeek = raceWeeks[0]?.w ?? blocks.length - 1;
  for (let i = firstRaceWeek - 1; i > 0; i--) {
    if (blocks[i] === "carico") { blocks[i] = "specifico"; break; }
  }

  return blocks.map((block, i) => {
    const startIso = addDays(start, i * 7);
    const endIso = addDays(startIso, 6);
    const race = goals.find((g) => g.dateIso >= startIso && g.dateIso <= endIso) ?? null;
    const towards = goals.find((g) => g.dateIso >= startIso) ?? last;
    return { index: i + 1, startIso, endIso, block, race, towards };
  });
}

/* ══ 8 · SEDUTE ═══════════════════════════════════════════════════════════ */

/** I budget di qualità della settimana, in km. Daniels 2013, capitolo 4. */
export interface QualityBudget {
  /** I-pace: ≤ 8% dei km settimanali, mai oltre 10 km. */
  interval: number;
  /** T-pace: ≤ 10% dei km settimanali. */
  threshold: number;
  /** R-pace: ≤ 5% dei km settimanali, mai oltre 8 km. */
  rep: number;
  /** Ritmo maratona/mezza dentro il lungo: ≤ 25% dei km settimanali. */
  marathon: number;
}

/**
 * Riscaldamento più defaticamento, in km.
 *
 * Cinque chilometri di contorno sono giusti in una settimana da settanta e
 * assurdi in una da trentasei: là dentro sono il 14% del volume settimanale, e
 * quello che tolgono lo tolgono ai fondi facili, che sono il pezzo che
 * costruisce il motore (Casado 2021). Scala con la settimana, con un minimo che
 * resta sufficiente a scaldare davvero.
 */
export function warmupKm(weekKm: number): number {
  // il minimo non scende sotto 4 km complessivi: sotto quella soglia non si
  // scalda abbastanza per una seduta di ripetute, e il risparmio di volume non
  // vale il rischio di partire freddi su un lavoro al 100% del VO₂max
  return clamp(Math.round(weekKm * 0.09), 4, 6);
}

/** Il contorno della seduta, scritto come lo si legge sulla scheda. */
const warm = (wu: number) => `${trimKm(wu * 0.6)} km lenti`;
const cool = (wu: number) => `${trimKm(wu * 0.4)} km lenti`;
const trimKm = (v: number) => (Math.round(v * 10) / 10).toString().replace(/\.0$/, "");

export function qualityBudget(weekKm: number, block: BlockId): QualityBudget {
  // nel blocco specifico della mezza il tetto della soglia sale al 12%: il
  // lavoro di soglia È la preparazione della mezza, e Daniels stesso alza il
  // limite quando la gara obiettivo si corre poco sopra quel ritmo
  const tPct = block === "specificoHM" ? 0.12 : 0.10;
  return {
    interval: Math.min(weekKm * 0.08, 10),
    threshold: weekKm * tPct,
    rep: Math.min(weekKm * 0.05, 8),
    marathon: Math.min(weekKm * 0.25, 29),
  };
}

const fmtSecPace = (s: number) => fmtPace(s);
const roundTo = (v: number, step: number) => Math.round(v / step) * step;

interface SessionSeed {
  weekday: number;
  /**
   * Titolo e descrizione delle sedute elastiche.
   *
   * I facili e i rigeneranti vengono ridimensionati alla fine, per far
   * quadrare il totale della settimana. Se il testo fosse scritto prima, la
   * scheda direbbe "Facile 7 km" sopra una seduta da 5, ed è il tipo di
   * incoerenza che fa perdere fiducia in tutto il resto del piano.
   */
  render?: (km: number) => { title: string; description: string };
  kind: PlanSession["kind"];
  title: string;
  description: string;
  km: number;
  paceSec: number | null;
  why: string;
  studies: StudyId[];
  key: boolean;
  durationMin?: number | null;
  heatKind?: HeatKind;
  heatBaseSec?: number;
  test?: PlanTest;
}

/**
 * IL MENU DELLA SETTIMANA.
 *
 * Due qualità separate da un giorno facile, il lungo la domenica, il resto
 * davvero lento. La forma è quella classica del martedì/giovedì perché è
 * l'unica che, su cinque uscite, lascia 48 ore piene prima di ogni lavoro e
 * due giorni fra l'ultima qualità e il lungo.
 */
function weekMenu(
  w: WeekSkeleton, weekKm: number, p: Paces, budget: QualityBudget,
  config: PlanConfig,
): SessionSeed[] {
  const seeds: SessionSeed[] = [];
  const goal = w.towards;
  const isShort = goal.distanceM <= 10000;
  const goalPace = goal.targetSec / (goal.distanceM / 1000);
  const wu = warmupKm(weekKm);

  /* ── la gara, se cade qui ── */
  if (w.race) {
    const g = w.race;
    const rd = weekdayOf(g.dateIso);
    seeds.push({
      weekday: rd, kind: "race", key: true,
      title: `GARA · ${g.label} — obiettivo ${fmtClock(g.targetSec)}`,
      description: `Riscaldamento 20′ + 4 allunghi. Passaggi a ${fmtSecPace(goalPace)}/km. `
        + `Primo km MAI più veloce di ${fmtSecPace(goalPace - 3)}: il tempo si perde nel finale, non nel primo chilometro.`,
      km: g.distanceM / 1000 + 4, paceSec: goalPace,
      why: "Il giorno per cui è stato costruito tutto il resto.",
      studies: ["daniels-2013"],
    });
    // attivazione due giorni prima, scarico intorno
    const act = rd >= 2 ? rd - 2 : rd + 5;
    // sui 5000 si attiva al ritmo gara; su una mezza il ritmo gara è troppo
    // lento per svegliare qualcosa, e l'attivazione va alla soglia
    const actPace = isShort ? goalPace : p.threshold;
    seeds.push({
      weekday: act, kind: "intervals", key: false,
      title: `Attivazione · 4×400 m @ ${fmtSecPace(actPace)}/km`,
      description: `${warm(wu)} + 4×400 m a ${fmtSecPace(actPace)}/km con 400 m di corsa lenta. 2 km di defaticamento. Niente di più.`,
      km: 7, paceSec: actPace, heatKind: "reps", heatBaseSec: actPace,
      why: "Ricorda al sistema nervoso il ritmo senza consumare niente: intensità mantenuta, volume azzerato.",
      studies: ["bosquet-2007", "mujika-2003"],
    });
    const taken = new Set<number>([rd, act]);
    const claim = (d: number): number | null => {
      if (d < 0 || d > 6 || taken.has(d)) return null;
      taken.add(d);
      return d;
    };

    const eve = claim(rd - 1);
    if (eve !== null) {
      seeds.push({
        weekday: eve, kind: "rest", key: false,
        title: "Riposo · vigilia",
        description: "20′ molto lenti o niente. Cena come sempre, non un esperimento.",
        km: 0, paceSec: null,
        why: "L'ultimo giorno non aggiunge forma, può solo toglierla.",
        studies: ["bosquet-2007"],
      });
    }
    // il rigenerante dopo la gara esiste solo se la settimana ha ancora giorni:
    // con la gara di domenica cade nel piano successivo, non qui
    const after = claim(rd + 2) ?? claim(rd + 1);
    if (after !== null) {
      seeds.push({
        weekday: after, kind: "recovery", key: false,
        title: "", description: "",
        render: (km) => ({
          title: `Rigenerante · ${km} km lentissimi`,
          description: `${km} km a ${fmtSecPace(p.slow)}/km. Se le gambe non ci sono, cammina.`,
        }),
        km: 6, paceSec: p.slow,
        why: "Riattiva il circolo dopo la gara senza chiedere niente.",
        studies: ["issurin-2010"],
      });
    }
    // il resto della settimana: facili corti, sempre PRIMA della gara
    for (const d of [1, 2, 3]) {
      if (d >= rd || taken.has(d)) continue;
      if (seeds.filter((s) => s.kind === "easy").length >= 2) break;
      taken.add(d);
      seeds.push({
        weekday: d, kind: "easy", key: false,
        title: "", description: "",
        render: (km) => ({
          title: `Facile ${km} km @ ${fmtSecPace(p.easy)}/km`,
          description: `${km} km a ${fmtSecPace(p.easy)}/km + 4 allunghi da 20″.`,
        }),
        km: 6, paceSec: p.easy, heatKind: "tempo", heatBaseSec: p.easy,
        why: "Frequenza mantenuta, volume tolto: è esattamente ciò che il taper chiede.",
        studies: ["bosquet-2007"],
      });
    }
    return seeds;
  }

  /* ── Q1: martedì ── */
  seeds.push(q1(w, p, budget, goalPace, isShort, wu));

  /* ── Q2: giovedì ── */
  const q = q2(w, p, budget, goalPace, isShort, wu, weekKm);
  if (q) seeds.push(q);

  /* ── mercoledì: facile con allunghi ── */
  const easyKm = Math.max(6, Math.round(weekKm * 0.18));
  seeds.push({
    weekday: 2, kind: "easy", key: false,
    title: "", description: "",
    render: (km) => ({
      title: `Facile ${km} km @ ${fmtSecPace(p.easy)}/km`,
      description: `${km} km a ${fmtSecPace(p.easy)}/km + 6 allunghi da 20″ in progressione. `
        + `Se il passo scende sotto ${fmtSecPace(p.easy - 20)} non è più un facile.`,
    }),
    km: easyKm, paceSec: p.easy, heatKind: "tempo", heatBaseSec: p.easy,
    why: "I minuti facili sono il predittore più forte della prestazione: qui si costruisce il motore, non nelle ripetute.",
    studies: ["casado-2021", "esteve-lanao-2007", "seiler-2010"],
  });

  /* ── sabato: corto rigenerante ──
   *
   * Non è un riempitivo. Entra quando la settimana ha meno uscite di quante
   * l'atleta ne ha chieste — e questo succede proprio nei blocchi leggeri, dove
   * la seconda qualità non c'è. Nel taper è obbligatorio: Bosquet 2007 taglia il
   * volume e NON la frequenza, e una settimana di scarico con un'uscita in meno
   * smette di essere il taper studiato e diventa una settimana persa.
   */
  {
    const running = seeds.filter((x) => x.km > 0).length + 1; // +1 = il lungo, ancora da aggiungere
    const wantsMore = running < config.runsPerWeek;
    const taperKeepsFrequency = w.block === "taper";
    if (config.runsPerWeek >= 5 || wantsMore || taperKeepsFrequency) {
      const shortKm = Math.max(5, Math.round(weekKm * 0.13));
      seeds.push({
        weekday: 5, kind: "recovery", key: false,
        title: "", description: "",
        render: (km) => ({
          title: `Rigenerante ${km} km @ ${fmtSecPace(p.slow)}/km`,
          description: `${km} km a ${fmtSecPace(p.slow)}/km. Sciolto, senza guardare l'orologio.`,
        }),
        km: shortKm, paceSec: p.slow, heatKind: "tempo", heatBaseSec: p.slow,
        why: taperKeepsFrequency
          ? "Nel taper si toglie volume, non frequenza: i giorni di corsa restano quelli."
          : "Volume a costo zero il giorno prima del lungo.",
        studies: taperKeepsFrequency ? ["bosquet-2007", "mujika-2003"] : ["seiler-2010"],
      });
    }
  }

  /* ── domenica: il lungo ── */
  seeds.push(longRun(w, p, budget, weekKm, goal, config.fitness.longestKm));

  /* ── forza ── */
  if (config.strength && w.block !== "taper" && w.block !== "gara") {
    seeds.push({
      weekday: 0, kind: "strength", key: false,
      title: "Forza · 40′ pesante + salti",
      description: "Squat o affondi 4×5 @ 80-85% · stacco rumeno 3×6 · calf raise 3×8 lenti · "
        + "6×5 balzi alternati · core 8′. Carichi alti, poche ripetizioni, nessun cedimento.",
      km: 0, paceSec: null,
      why: "Economia di corsa: 2-8% di risparmio a parità di motore, e si guadagna con i carichi alti, non con i circuiti.",
      studies: ["blagrove-2018", "llanos-2024"],
    });
  }

  return seeds;
}

/** La prima qualità: quella che definisce il blocco. */
function q1(
  w: WeekSkeleton, p: Paces, b: QualityBudget, goalPace: number,
  isShort: boolean, wu: number,
): SessionSeed {
  const base = { weekday: 1, key: true } as const;

  if (w.block === "avvio") {
    const reps = Math.max(3, Math.round((b.threshold * 1000) / 1600));
    return {
      ...base, kind: "tempo",
      title: `Soglia · ${reps}×1600 m @ ${fmtSecPace(p.threshold)}/km`,
      description: `${warm(wu)} + ${reps}×1600 m a ${fmtSecPace(p.threshold)}/km con 60″ di corsa lenta + ${cool(wu)}. `
        + `Il ritmo è quello che reggeresti un'ora: se al terzo blocco devi spingere, è troppo veloce.`,
      km: wu + (reps * 1600) / 1000, paceSec: p.threshold, heatKind: "tempo", heatBaseSec: p.threshold,
      why: "Si riparte dalla soglia: alza il pavimento su cui poi poggiano le ripetute, e costa poco in termini di recupero.",
      studies: ["daniels-2013", "filipas-2022"],
    };
  }

  if (w.block === "carico" || w.block === "specifico") {
    const repM = w.block === "specifico" ? 1200 : 1000;
    const reps = Math.max(3, Math.floor((b.interval * 1000) / repM));
    const recSec = Math.round(((repM / 1000) * p.interval) * 0.75);
    return {
      ...base, kind: "intervals",
      title: `Ripetute · ${reps}×${repM} m @ ${fmtSecPace(p.interval)}/km`,
      description: `${warm(wu)} + ${reps}×${repM} m a ${fmtSecPace(p.interval)}/km con ${Math.floor(recSec / 60)}′${String(recSec % 60).padStart(2, "0")}″ di corsa lenta + ${cool(wu)}. `
        + `Recupero corto per scelta: il tempo vicino al VO₂max si accumula se non si scende troppo fra una e l'altra.`,
      km: wu + (reps * repM) / 1000, paceSec: p.interval, heatKind: "reps", heatBaseSec: p.interval,
      why: `${reps} ripetute e non di più: il tetto di Daniels sull'I-pace è l'8% dei km settimanali, e qui vale ${b.interval.toFixed(1)} km.`,
      studies: ["daniels-2013", "billat-2001", "stoggl-2014"],
    };
  }

  if (w.block === "affilatura") {
    const reps = Math.max(3, Math.floor((b.interval * 1000) / 1600));
    return {
      ...base, kind: "intervals",
      title: `Ritmo gara · ${reps}×1600 m @ ${fmtSecPace(goalPace)}/km`,
      description: `${warm(wu)} + ${reps}×1600 m esattamente a ${fmtSecPace(goalPace)}/km con 3′ di corsa lenta + ${cool(wu)}. `
        + `Non più veloce: la seduta serve a rendere quel ritmo familiare, non a dimostrare niente.`,
      km: wu + (reps * 1600) / 1000, paceSec: goalPace, heatKind: "reps", heatBaseSec: goalPace,
      why: "Adattamento neuromuscolare e psicologico al ritmo obiettivo, con volume già in discesa.",
      studies: ["daniels-2013", "bosquet-2007"],
    };
  }

  if (w.block === "taper") {
    const reps = isShort ? 5 : 4;
    const pace = isShort ? goalPace : p.halfPace;
    return {
      ...base, kind: "intervals",
      title: `Richiamo · ${reps}×1000 m @ ${fmtSecPace(pace)}/km`,
      description: `${warm(wu)} + ${reps}×1000 m a ${fmtSecPace(pace)}/km con 2′ di corsa lenta + ${cool(wu)}. `
        + `Volume dimezzato, ritmo invariato: è la combinazione che produce la supercompensazione.`,
      km: wu + reps, paceSec: pace, heatKind: "reps", heatBaseSec: pace,
      why: "Bosquet 2007: nel taper si taglia il volume del 41-60% e non si toccano né intensità né frequenza.",
      studies: ["bosquet-2007", "mujika-2003"],
    };
  }

  if (w.block === "rigenerazione") {
    return {
      ...base, kind: "tempo",
      title: `Soglia leggera · 2×10′ @ ${fmtSecPace(p.threshold)}/km`,
      description: `${warm(wu)} + 2×10′ a ${fmtSecPace(p.threshold)}/km con 3′ lenti + ${cool(wu)}. `
        + `Se le gambe della gara sono ancora lì, si trasforma in 40′ lenti e basta.`,
      km: wu + 5, paceSec: p.threshold, heatKind: "tempo", heatBaseSec: p.threshold,
      why: "Riapre il motore dopo la gara senza riaprire il conto della fatica.",
      studies: ["issurin-2010", "filipas-2022"],
    };
  }

  // specificoHM
  const totKm = Math.max(4, roundTo(b.threshold, 0.5));
  const reps = Math.max(2, Math.round((totKm * 1000) / 2000));
  return {
    ...base, kind: "tempo",
    title: `Soglia lunga · ${reps}×2000 m @ ${fmtSecPace(p.threshold)}/km`,
    description: `${warm(wu)} + ${reps}×2000 m a ${fmtSecPace(p.threshold)}/km con 90″ di corsa lenta + ${cool(wu)}. `
      + `Recupero corto di proposito: con 90″ non si riparte freschi, ed è quello il punto.`,
    km: wu + (reps * 2000) / 1000, paceSec: p.threshold, heatKind: "tempo", heatBaseSec: p.threshold,
    why: "Sulla mezza il ritmo gara sta appena sotto la soglia: allungare i blocchi di soglia è la seduta che sposta il risultato.",
    studies: ["daniels-2013", "filipas-2022", "casado-2021"],
  };
}

/** La seconda qualità: quella che completa, non quella che ripete. */
function q2(
  w: WeekSkeleton, p: Paces, b: QualityBudget, goalPace: number,
  isShort: boolean, wu: number, weekKm: number,
): SessionSeed | null {
  const base = { weekday: 3, key: true } as const;

  if (w.block === "avvio") {
    const hills = clamp(Math.round(weekKm * 0.06), 6, 10);
    return {
      ...base, kind: "intervals", key: false,
      title: `Collinare · ${hills}×60″ in salita`,
      description: `${warm(wu)} + ${hills}×60″ in salita al 5-6% forte ma controllato, discesa lenta + ${cool(wu)}.`,
      km: wu + 2, paceSec: p.easy,
      why: "Forza specifica e reclutamento senza il costo articolare delle ripetute in piano: il ponte fra il lento e la qualità.",
      studies: ["blagrove-2018", "daniels-2013"],
    };
  }

  if (w.block === "carico") {
    const reps = Math.max(3, Math.round((b.threshold * 1000) / 1600));
    return {
      ...base, kind: "tempo",
      title: `Soglia · ${reps}×1600 m @ ${fmtSecPace(p.threshold)}/km`,
      description: `${warm(wu)} + ${reps}×1600 m a ${fmtSecPace(p.threshold)}/km con 60″ di corsa lenta + ${cool(wu)}.`,
      km: wu + (reps * 1600) / 1000, paceSec: p.threshold, heatKind: "tempo", heatBaseSec: p.threshold,
      why: `Soglia entro il tetto del 10% (${b.threshold.toFixed(1)} km): sostiene le ripetute del martedì senza rubare recupero.`,
      studies: ["daniels-2013", "seiler-2010"],
    };
  }

  if (w.block === "specifico") {
    const rReps = Math.max(4, Math.floor((b.rep * 1000) / 400));
    return {
      ...base, kind: "tempo",
      title: `Misto · 2×10′ @ ${fmtSecPace(p.threshold)}/km + ${rReps}×400 m @ ${fmtSecPace(p.rep)}/km`,
      description: `${warm(wu)} + 2×10′ a ${fmtSecPace(p.threshold)}/km (3′ lenti) + ${rReps}×400 m a ${fmtSecPace(p.rep)}/km con 400 m lenti + ${cool(wu)}.`,
      km: wu + 5 + (rReps * 400) / 1000, paceSec: p.threshold, heatKind: "tempo", heatBaseSec: p.threshold,
      why: "Soglia per la tenuta e 400 veloci per la meccanica: nelle ultime settimane la velocità va tenuta viva, non aumentata.",
      studies: ["daniels-2013", "stoggl-2014"],
    };
  }

  if (w.block === "affilatura") {
    const rReps = Math.max(4, Math.floor((b.rep * 1000) / 400));
    return {
      ...base, kind: "intervals",
      title: `Veloce · ${rReps}×400 m @ ${fmtSecPace(p.rep)}/km`,
      description: `${warm(wu)} + ${rReps}×400 m a ${fmtSecPace(p.rep)}/km con 400 m di corsa lenta + ${cool(wu)}. `
        + `Il recupero è pieno: qui si allena l'appoggio, non la resistenza.`,
      km: wu + (rReps * 400) / 1000, paceSec: p.rep, heatKind: "reps", heatBaseSec: p.rep,
      why: "R-pace entro il 5% settimanale: costa poco in recupero e rende il ritmo gara più facile da tenere.",
      studies: ["daniels-2013"],
    };
  }

  // Nel blocco specifico mezza la seconda qualità è IL LUNGO: 20 km con dieci a
  // ritmo gara alla fine valgono più di una seduta di medio a gambe fresche, e
  // aggiungerne una terza in settimana significherebbe arrivarci già consumati.
  return null;
}

/**
 * QUANTO DEVE ESSERE IL LUNGO.
 *
 * Sta qui, in una funzione sola, perché serve in due punti che devono dire la
 * stessa cosa: al generatore della seduta e alla stima dell'esponente di
 * tenuta. Se divergono, il piano promette una mezza che le sue stesse domeniche
 * non costruiscono.
 *
 * La quota classica è il 30% della settimana. Nel blocco specifico della mezza
 * sale al 42%, ed è una scelta consapevole: con 43 km a settimana il 30% dà un
 * lungo da 13 km, che non prepara nessuna mezza. L'alternativa vera non è un
 * lungo più corto, è più volume — e il piano lo dice invece di nasconderlo.
 */
export function longRunKm(
  block: BlockId, weekKm: number, goalIsLong: boolean, longestNow: number,
): number {
  if (block === "taper") return clamp(roundTo(weekKm * 0.30, 1), 8, 13);
  const share = block === "specificoHM" ? 0.42 : goalIsLong ? 0.34 : 0.32;
  const cap = goalIsLong ? 21 : 18;
  const base = clamp(roundTo(weekKm * share, 1), 10, cap);
  // non si torna indietro: il lungo non scende sotto quello che l'atleta fa già…
  const withFloor = Math.max(base, Math.min(longestNow, cap));
  // …ma nemmeno divora la settimana. Un lungo al 44% del volume settimanale
  // lascia quattro chilometri da spartire fra due fondi facili, e i fondi
  // facili sono il pezzo che costruisce il motore: il tetto li protegge.
  const shareCap = block === "specificoHM" ? 0.46 : 0.38;
  return Math.max(10, Math.min(withFloor, roundTo(weekKm * shareCap, 1)));
}

/** Il lungo: la seduta che decide la mezza e non tocca i 5000. */
function longRun(
  w: WeekSkeleton, p: Paces, b: QualityBudget, weekKm: number,
  goal: RaceGoal, longestNow: number,
): SessionSeed {
  const goalIsLong = goal.distanceM >= 15000;
  const km = longRunKm(w.block, weekKm, goalIsLong, longestNow);
  const goalPace = goal.targetSec / (goal.distanceM / 1000);

  if (w.block === "taper") {
    return {
      weekday: 6, kind: "long", key: false,
      title: `Lungo corto · ${km} km @ ${fmtSecPace(p.easy)}/km`,
      description: `${km} km a ${fmtSecPace(p.easy)}/km con gli ultimi 2 km a ${fmtSecPace(goalPace)}/km.`,
      km, paceSec: p.easy, heatKind: "long", heatBaseSec: p.easy,
      why: "Il lungo del taper serve a non perdere l'abitudine, non a costruire: −40% di distanza, ritmo intatto.",
      studies: ["bosquet-2007"],
    };
  }

  if (w.block === "specificoHM") {
    const fast = Math.max(6, Math.min(12, roundTo(km * 0.5, 1)));
    return {
      weekday: 6, kind: "long", key: true,
      title: `Lungo con ritmo gara · ${km} km, di cui ${fast} km @ ${fmtSecPace(goalPace)}/km`,
      description: `${km - fast} km a ${fmtSecPace(p.easy)}/km, poi ${fast} km continui a ${fmtSecPace(goalPace)}/km fino alla fine. `
        + `Ultima verifica prima della gara: se il ritmo tiene con i km già nelle gambe, tiene anche il 18 ottobre.`,
      km, paceSec: p.easy, heatKind: "long", heatBaseSec: p.easy,
      why: "È la seduta che abbassa l'esponente di tenuta: km sotto le gambe più ritmo gara alla fine.",
      studies: ["vickers-2016", "riegel-1981", "daniels-2013"],
    };
  }

  const finish = w.block === "carico" || w.block === "specifico";
  return {
    weekday: 6, kind: "long", key: w.block !== "avvio",
    title: `Lungo · ${km} km @ ${fmtSecPace(p.easy)}/km`,
    description: finish
      ? `${km} km a ${fmtSecPace(p.easy)}/km con gli ultimi 3 km a ${fmtSecPace(p.marathon)}/km.`
      : `${km} km a ${fmtSecPace(p.easy)}/km, tutti uguali.`,
    km, paceSec: p.easy, heatKind: "long", heatBaseSec: p.easy,
    why: "Il lungo costruisce la tenuta e nient'altro: è il termine che separa una mezza da 1:33 da una da 1:37 a parità di 5000.",
    studies: ["vickers-2016", "casado-2021"],
  };
}

/* ══ 9 · TEST ═════════════════════════════════════════════════════════════ */

/**
 * I TEST.
 *
 * Non sono allenamenti travestiti: sono misure, e ognuna misura una cosa
 * diversa. Una prova lunga a tutta dà il motore; una serie al ritmo obiettivo
 * dice se quel ritmo è già sostenibile; un lungo con ritmo gara dentro dice se
 * la tenuta c'è. Jones & Vanhatalo 2017 è il perché servono almeno due punti
 * e non uno.
 */
function testFor(kind: "baseline" | "goalpace" | "durability", p: Paces, goals: RaceGoal[]): PlanTest {
  const g5 = goals.find((g) => g.distanceM <= 10000) ?? goals[0];
  const gLong = goals.find((g) => g.distanceM >= 15000) ?? goals[goals.length - 1];
  const goalPace5 = g5.targetSec / (g5.distanceM / 1000);
  const goalPaceL = gLong.targetSec / (gLong.distanceM / 1000);

  if (kind === "baseline") {
    // il 3000 è la distanza giusta: abbastanza lungo da non essere anaerobico,
    // abbastanza corto da non lasciare strascichi in un blocco di 5 settimane
    const needed = vdotFrom(g5.distanceM, g5.targetSec);
    const gate = predictSec(3000, needed);
    return {
      id: "test-baseline", label: "3000 m a tutta",
      measures: "Il VDOT vero, senza le stime. Da fare all'alba, su pista o percorso piatto misurato, "
        + "con 20′ di riscaldamento e 4 allunghi.",
      gate: `≤ ${fmtClock(gate)} → sei già al VDOT che serve per ${fmtClock(g5.targetSec)}`,
      alarm: `> ${fmtClock(gate + 25)} → l'obiettivo ${fmtClock(g5.targetSec)} richiede più tempo di quello che c'è: il piano va ridiscusso, non spinto`,
      studies: ["daniels-2013", "jones-2017"],
    };
  }

  if (kind === "goalpace") {
    return {
      id: "test-goalpace", label: `Ripetute al ritmo obiettivo (${fmtSecPace(goalPace5)}/km)`,
      measures: "Se il ritmo gara è già sostenibile in frazionato. Non è una prova a tutta: "
        + "conta chiudere l'ultima ripetuta uguale alla prima, con la sensazione di poterne fare un'altra.",
      gate: `Tutte le ripetute entro ${fmtSecPace(goalPace5 + 2)}/km e l'ultima non più lenta della prima → in linea`,
      alarm: `Se l'ultima è oltre ${fmtSecPace(goalPace5 + 6)}/km o hai dovuto spingere al massimo → il ritmo obiettivo non è ancora tuo`,
      studies: ["daniels-2013", "billat-2001"],
    };
  }

  return {
    id: "test-durability", label: `Lungo con ritmo mezza (${fmtSecPace(goalPaceL)}/km)`,
    measures: "La tenuta, che è la variabile che decide la mezza. Misura se il ritmo obiettivo "
      + "regge quando i chilometri sono già nelle gambe.",
    gate: `Ultimi km a ${fmtSecPace(goalPaceL)}/km senza deriva del passo → l'esponente di tenuta è dove serve`,
    alarm: `Deriva oltre 8″/km negli ultimi 3 km → mancano km cronici: meglio rivedere il tempo obiettivo che il piano`,
    studies: ["riegel-1981", "vickers-2016", "jones-2017"],
  };
}

/* ══ 10 · PROIEZIONE E PROBABILITÀ ════════════════════════════════════════ */

/**
 * Quanto VDOT si guadagna, onestamente.
 *
 * Milanović 2015 (meta-analisi su 28 studi): l'HIIT alza il VO₂max, ma il
 * guadagno si comprime man mano che il soggetto è già allenato. Tradotto in
 * VDOT per un atleta intorno a 50: circa +0,9 punti in otto settimane di
 * lavoro ben fatto, non di più.
 *
 * Sopra si somma il termine di volume — Vickers & Vertosick 2016: i km
 * settimanali sono il predittore modificabile più forte — e sotto si applica il
 * freno del livello: a VDOT 60 lo stesso blocco rende metà che a 45.
 */
export function projectVdot(vdotNow: number, weeks: number, plannedKm: number, currentKm: number): number {
  const levelFactor = clamp((60 - vdotNow) / 12, 0.35, 1.3);
  const base = 0.9 * (weeks / 8) * levelFactor;
  // il volume in più non paga il primo lunedì: i mitocondri e i capillari che
  // costruisce hanno una costante di tempo di settimane, non di giorni
  const maturity = clamp(weeks / 6, 0, 1);
  const volumeBonus = clamp(0.5 * ((plannedKm / Math.max(1, currentKm)) - 1) / 0.25, 0, 0.8) * maturity;
  return vdotNow + base + volumeBonus;
}

/** Guadagno del taper. Bosquet dà ~3% contro carico pieno; qui ne vale un terzo. */
const TAPER_GAIN = 0.008;

const erf = (x: number): number => {
  const s = Math.sign(x), a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
};
const normalCdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

/**
 * L'incertezza, scomposta.
 *
 * · giorno di gara — Hopkins & Hewson 2001 hanno misurato un CV dell'1,2-1,6%
 *   fra gare simili dello stesso atleta. È il pavimento: non scende mai.
 * · proiezione — quanto ci si può fidare della forma prevista. Cresce con la
 *   distanza temporale dalla gara.
 * · meteo — la variabilità del giorno intorno alla normale climatica.
 * · tenuta — solo oltre i 10 km: l'esponente di Riegel è una stima, e ±0,015
 *   su una mezza valgono più di due minuti.
 */
export function sigmaPct(weeksOut: number, distanceM: number, anchorGapVdot = 0): number {
  const day = 1.4;
  const projection = 0.5 + 0.12 * weeksOut;
  const weather = 0.5;
  const durability = distanceM > 10000 ? 1.5 : 0;
  // un punto di VDOT vale circa l'1,7% di tempo: se l'ancora sta sopra la
  // prestazione dimostrata, quel divario è incertezza vera, non ottimismo
  const anchor = Math.max(0, anchorGapVdot) * 1.7 * 0.6;
  return Math.sqrt(day ** 2 + projection ** 2 + weather ** 2 + durability ** 2 + anchor ** 2);
}

/* ══ 11 · IL GENERATORE ═══════════════════════════════════════════════════ */

export function buildPlan(config: PlanConfig): Plan {
  const warnings: string[] = [];
  const f = config.fitness;
  const goals = [...config.goals].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  const skeleton = buildSkeleton({ ...config, goals });
  const peak = ceilingKm(f, config.maxWeeklyKm);

  if (peak <= f.weeklyKm + 1) {
    warnings.push(
      `Il tetto di volume (${peak} km) è al livello attuale: senza margine di crescita il piano può solo affilare la forma che c'è, non costruirne altra.`,
    );
  }

  /* ── volume settimana per settimana, con i freni ── */
  const kmByWeek: number[] = [];
  const acwrByWeek: number[] = [];
  const history: number[] = [f.weeklyKm, f.weeklyKm, f.weeklyKm, f.weeklyKm];
  let prev = f.weeklyKm;
  let familiar = Math.max(f.weeklyKm, f.peakWeeklyKm * 0.9);

  for (let i = 0; i < skeleton.length; i++) {
    const w = skeleton[i];
    const chronic = history.slice(-4).reduce((s, v) => s + v, 0) / 4;
    let desired = peak * BLOCK_VOLUME[w.block];

    // la settimana di gara non può stare sotto la gara stessa: una mezza sono
    // già 21 km, e fingere una settimana da 22 è aritmetica, non allenamento
    if (w.race) desired = Math.max(desired, w.race.distanceM / 1000 + 4 + peak * 0.28);

    // Nielsen 2014: +10% a settimana. Gabbett 2016: mai oltre 1,3× il cronico.
    // Tornare su un volume già retto di recente non è un salto: dopo un taper
    // il cronico crolla, e senza questa eccezione il piano non ricostruirebbe
    // più niente. La prima settimana ha un freno in più — è quella in cui
    // cambiano anche il numero di uscite e il numero di qualità, e due
    // aumenti insieme sono il modo classico di rompersi a settembre.
    const stepCap = i === 0
      ? f.weeklyKm * 1.05
      : Math.max(prev * 1.10, familiar);
    const acwrCap = Math.max(chronic * 1.30, familiar);
    const km = Math.round(Math.min(desired, stepCap, acwrCap, peak * 1.05));
    kmByWeek.push(km);
    acwrByWeek.push(Math.round((km / Math.max(1, chronic)) * 100) / 100);
    history.push(km);
    prev = km;
    familiar = Math.max(familiar, km * 0.95);
  }

  /* ── VDOT settimana per settimana ── */
  const totalWeeks = skeleton.length;
  // la media che conta è quella delle settimane di CARICO: taper e settimana di
  // gara abbassano la media proprio mentre la forma sale
  const loadKm = kmByWeek.filter((_, i) => skeleton[i].block !== "taper" && skeleton[i].block !== "gara");
  const meanKm = loadKm.length ? loadKm.reduce((s, v) => s + v, 0) / loadKm.length : f.weeklyKm;
  const vdotByWeek = skeleton.map((_, i) =>
    Math.round(projectVdot(f.vdot, i + 1, meanKm, f.weeklyKm) * 10) / 10,
  );

  /* ── esponente di tenuta: oggi e a fine piano ── */
  const riegelNow = riegelExponent(f.weeklyKm, f.longestKm);
  const goalIsLong = goals[goals.length - 1].distanceM >= 15000;
  const longEnd = Math.max(
    f.longestKm,
    ...skeleton.map((w, i) => longRunKm(w.block, kmByWeek[i], goalIsLong, f.longestKm)),
  );
  const riegelEnd = riegelExponent(meanKm, longEnd);

  /* ── le settimane ── */
  const weeks: PlanWeek[] = [];
  let blockRun = 0;
  let lastBlock: BlockId | null = null;
  const tests: { dateIso: string; session: PlanSession }[] = [];

  // dove cadono i test, calcolato una volta sola sullo scheletro
  const testPlan = placeTests(skeleton, goals);

  for (let i = 0; i < skeleton.length; i++) {
    const w = skeleton[i];
    blockRun = w.block === lastBlock ? blockRun + 1 : 0;
    lastBlock = w.block;

    const weekKm = kmByWeek[i];
    const vdot = vdotByWeek[i];
    const exp = riegelNow + ((riegelEnd - riegelNow) * (i + 1)) / totalWeeks;
    const p = pacesFor(vdot, exp);
    const budget = qualityBudget(weekKm, w.block);
    const seeds = weekMenu(w, weekKm, p, budget, config);

    // i test sostituiscono la seduta del giorno in cui cadono
    for (const t of testPlan.filter((t) => t.weekIndex === i)) {
      const idx = seeds.findIndex((s) => s.weekday === t.weekday);
      const seed = buildTestSeed(t.kind, t.weekday, p, goals, budget, weekKm);
      if (idx >= 0) seeds[idx] = seed; else seeds.push(seed);

      // Un 3000 a tutta il sabato e il lungo la domenica sono due sedute che
      // si annullano a vicenda: la prima misura, il secondo la falsifica. La
      // domenica del test diventa rigenerante — e la settimana torna nel suo
      // volume invece di sforare del 15%.
      if (t.kind === "baseline") {
        const li = seeds.findIndex((s) => s.kind === "long");
        if (li >= 0) {
          seeds[li] = {
            weekday: seeds[li].weekday, kind: "recovery", key: false,
            title: "", description: "",
            render: (km) => ({
              title: `Rigenerante dopo il test · ${km} km @ ${fmtSecPace(p.slow)}/km`,
              description: `Il giorno dopo una prova a tutta si corre piano e basta: ${km} km a ${fmtSecPace(p.slow)}/km.`,
            }),
            km: 8, paceSec: p.slow, heatKind: "tempo", heatBaseSec: p.slow,
            why: "Il lungo torna la settimana prossima: questa domenica serve a non sprecare il numero appena misurato.",
            studies: ["issurin-2010"],
          };
        }
      }
    }

    const sessions = materialise(seeds, w, weekKm, p, config.climate);
    for (const s of sessions) if (s.test) tests.push({ dateIso: s.date, session: s });

    const qualityKm = sessions
      .filter((s) => s.kind === "intervals" || s.kind === "tempo" || s.kind === "race")
      .reduce((sum, s) => sum + Math.max(0, s.target_distance_km - 5), 0);

    weeks.push({
      index: w.index,
      startIso: w.startIso,
      endIso: w.endIso,
      block: w.block,
      blockLabel: BLOCK_LABEL[w.block],
      why: blockWhy(w, weekKm, budget, kmByWeek[i - 1] ?? f.weeklyKm),
      targetKm: weekKm,
      acwr: acwrByWeek[i],
      qualityCount: sessions.filter((s) => s.key && s.kind !== "long" && s.kind !== "race").length,
      vdot,
      sessions,
      qualityKm: Math.round(qualityKm * 10) / 10,
      studies: [...new Set(sessions.flatMap((s) => s.studies))],
    });
  }

  /* ── la previsione per ogni gara ── */
  const outlook = goals.map((g) => outlookFor(g, config, skeleton, kmByWeek, meanKm, riegelNow, riegelEnd, longEnd));

  if (f.vdotDemonstrated != null && f.vdot - f.vdotDemonstrated > 1.0) {
    warnings.push(
      `L'ancora dice VDOT ${f.vdot.toFixed(1)}, ma la prestazione più forte davvero misurata ne vale `
      + `${f.vdotDemonstrated.toFixed(1)} (${f.vdotDemonstratedFrom ?? "prova su strada"}). `
      + `Tutte le percentuali qui sotto poggiano sul primo numero: il 3000 della prima settimana serve a stabilire quale dei due è vero.`,
    );
  }

  for (const o of outlook) {
    if (o.probability < 0.35) {
      warnings.push(
        `${o.goal.label} ${fmtClock(o.goal.targetSec)}: ${Math.round(o.probability * 100)}% di riuscita. `
        + `Il piano è costruito per andarci il più vicino possibile, ma il numero va guardato prima della gara, non dopo.`,
      );
    }
    if (o.heatCostSec > 25) {
      warnings.push(
        `${o.goal.label}: alle ${o.goal.startHour}:00 il caldo atteso costa ${Math.round(o.heatCostSec)}″. `
        + `Se la gara ha una partenza più fresca, quel cambio vale più di tre settimane di allenamento.`,
      );
    }
  }

  const studyIds = [...new Set(weeks.flatMap((w) => w.studies).concat([
    "hopkins-2001", "riegel-1981", "vickers-2016", "milanovic-2015",
    "gabbett-2016", "impellizzeri-2020", "nielsen-2014", "damsted-2019",
    "ely-2007", "periard-2021", "periard-2015", "lorenzo-2010", "racinais-2015",
    "issurin-2010", "jones-2017",
  ] as StudyId[]))];

  return {
    config, weeks, outlook, tests,
    riegelNow: Math.round(riegelNow * 1000) / 1000,
    riegelEnd: Math.round(riegelEnd * 1000) / 1000,
    peakKm: peak,
    warnings,
    studies: studyIds.map((id) => STUDIES[id]),
  };
}

/* ── da seme a seduta vera ── */
function materialise(
  seeds: SessionSeed[], w: WeekSkeleton, weekKm: number, p: Paces, climate: Climate,
): PlanSession[] {
  // il volume dei facili si aggiusta per far tornare il totale della settimana
  const fixed = seeds.filter((s) => s.kind !== "easy" && s.kind !== "recovery");
  const elastic = seeds.filter((s) => s.kind === "easy" || s.kind === "recovery");
  const fixedKm = fixed.reduce((s, x) => s + x.km, 0);
  const elasticKm = elastic.reduce((s, x) => s + x.km, 0);
  const need = Math.max(0, weekKm - fixedKm);
  const scale = elasticKm > 0 ? clamp(need / elasticKm, 0.35, 2.0) : 1;

  const out: PlanSession[] = [];
  for (const s of seeds) {
    const km = s.kind === "easy" || s.kind === "recovery"
      ? Math.max(4, Math.round(s.km * scale))
      : Math.round(s.km * 10) / 10;
    const date = addDays(w.startIso, s.weekday);
    // l'ora di allenamento: alle 7 in estate, alle 8 quando rinfresca
    const month = +date.slice(5, 7);
    const hour = month >= 6 && month <= 9 ? 7 : 8;
    const cond = conditionsAt(date, hour, climate);

    const heat = s.heatKind && s.heatBaseSec
      ? (() => {
          const adj = heatAdjustedPace(s.heatKind!, cond.tempC, cond.humidity, s.heatBaseSec!);
          return {
            conditions: cond, kind: s.heatKind!, baseSec: s.heatBaseSec!,
            adjustedFrom: Math.round(adj.from), adjustedTo: Math.round(adj.to),
            penaltyPct: Math.round(adj.pen * 10) / 10,
          };
        })()
      : undefined;

    const text = s.render ? s.render(km) : { title: s.title, description: s.description };

    out.push({
      day: DAY_LABEL[s.weekday],
      date,
      type: s.kind === "strength" ? "strength" : s.kind === "race" ? "intervals" : s.kind,
      title: text.title,
      description: text.description,
      target_distance_km: km,
      target_pace: s.paceSec ? fmtSecPace(s.paceSec) : null,
      target_duration_min: s.durationMin ?? (s.paceSec ? Math.round((km * s.paceSec) / 60) : null),
      completed: false,
      run_id: null,
      kind: s.kind,
      why: s.why,
      studies: s.studies,
      key: s.key,
      test: s.test,
      heat,
    });
  }

  // riposo nei giorni vuoti
  const used = new Set(out.map((s) => weekdayOf(s.date)));
  for (let d = 0; d < 7; d++) {
    if (used.has(d)) continue;
    out.push({
      day: DAY_LABEL[d], date: addDays(w.startIso, d), type: "rest",
      title: "Riposo", description: "Niente corsa. È parte del piano quanto le ripetute.",
      target_distance_km: 0, target_pace: null, target_duration_min: null,
      completed: false, run_id: null,
      kind: "rest", why: "L'adattamento arriva nel recupero, non nello stimolo.",
      studies: ["issurin-2010"], key: false,
    });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function blockWhy(w: WeekSkeleton, km: number, b: QualityBudget, prevKm: number): string {
  const delta = km - prevKm;
  const move = delta > 0 ? `+${Math.round(delta)} km sulla precedente` : delta < 0 ? `${Math.round(delta)} km sulla precedente` : "stesso volume";
  switch (w.block) {
    case "avvio":
      return `Si entra nel piano senza strappi (${move}). La qualità è la soglia, che costa poco in recupero e prepara le ripetute.`;
    case "carico":
      return `Settimana piena (${move}). Due qualità: ripetute al martedì dentro il tetto dell'8% (${b.interval.toFixed(1)} km), soglia al giovedì entro il 10% (${b.threshold.toFixed(1)} km).`;
    case "specifico":
      return `Volume al massimo (${move}) e ripetute più lunghe: è la settimana che sposta il VDOT, quella dopo si comincia a togliere.`;
    case "affilatura":
      return `Il volume scende del 20% (${move}) ma l'intensità no. Da qui la fatica comincia a scaricarsi e la forma a emergere.`;
    case "taper":
      return `Taper: volume a −45% circa (${move}), intensità e giorni di corsa invariati. È la combinazione che Bosquet 2007 ha trovato migliore su 182 confronti.`;
    case "gara":
      return `Settimana di gara. Quello che c'è, c'è: si difende, non si costruisce.`;
    case "rigenerazione":
      return `Dopo la gara si riapre piano (${move}). Una sola qualità leggera, il resto lento.`;
    case "specificoHM":
      return `Blocco specifico mezza: soglia lunga e lungo con ritmo gara dentro (${move}). Non si costruisce più motore, si costruisce tenuta.`;
  }
}

/* ── posizionamento dei test ── */
interface TestSlot { weekIndex: number; weekday: number; kind: "baseline" | "goalpace" | "durability" }

function placeTests(skeleton: WeekSkeleton[], goals: RaceGoal[]): TestSlot[] {
  const slots: TestSlot[] = [];
  const firstRace = goals[0];
  const firstRaceWeek = skeleton.findIndex((w) => w.race?.id === firstRace.id);

  // baseline: sabato della prima settimana — prima che il piano abbia
  // cambiato qualcosa, altrimenti non è più un punto di partenza
  slots.push({ weekIndex: 0, weekday: 5, kind: "baseline" });

  // ritmo obiettivo: due settimane prima della gara A, al posto della Q1
  const goalPaceWeek = Math.max(1, firstRaceWeek - 2);
  if (goalPaceWeek > 0 && goalPaceWeek < skeleton.length) {
    slots.push({ weekIndex: goalPaceWeek, weekday: 1, kind: "goalpace" });
  }

  // tenuta: il lungo dell'ultima settimana piena prima della gara lunga
  const longGoal = goals.find((g) => g.distanceM >= 15000);
  if (longGoal) {
    const lastFull = skeleton.map((w, i) => ({ w, i }))
      .filter(({ w }) => w.block === "specificoHM")
      .pop();
    if (lastFull) slots.push({ weekIndex: lastFull.i, weekday: 6, kind: "durability" });
  }

  return slots;
}

function buildTestSeed(
  kind: "baseline" | "goalpace" | "durability", weekday: number,
  p: Paces, goals: RaceGoal[], b: QualityBudget, weekKm: number,
): SessionSeed {
  const wu = warmupKm(weekKm);
  const test = testFor(kind, p, goals);
  const g5 = goals.find((g) => g.distanceM <= 10000) ?? goals[0];
  const gLong = goals.find((g) => g.distanceM >= 15000) ?? goals[goals.length - 1];
  const goalPace5 = g5.targetSec / (g5.distanceM / 1000);
  const goalPaceL = gLong.targetSec / (gLong.distanceM / 1000);

  if (kind === "baseline") {
    return {
      weekday, kind: "intervals", key: true, test,
      title: "TEST · 3000 m a tutta",
      description: "20′ di riscaldamento + 4 allunghi, poi 3000 m a tutta su pista o percorso piatto misurato. "
        + "10′ di defaticamento. All'alba, non alle sei di sera: il numero deve misurare te, non il termometro.",
      km: 10, paceSec: p.race5k - 4, heatKind: "reps", heatBaseSec: p.race5k - 4,
      why: "Ancora il VDOT a una prestazione vera. Tutto il piano — ritmi, previsioni, probabilità — ruota su questo numero.",
      studies: ["daniels-2013", "jones-2017"],
    };
  }

  if (kind === "goalpace") {
    const reps = Math.max(4, Math.floor((b.interval * 1000) / 1000));
    return {
      weekday, kind: "intervals", key: true, test,
      title: `TEST · ${reps}×1000 m @ ${fmtSecPace(goalPace5)}/km`,
      description: `${warm(wu)} + ${reps}×1000 m a ${fmtSecPace(goalPace5)}/km con 2′ di corsa lenta + ${cool(wu)}. `
        + "Ritmo bloccato: non più veloce, non più lento. Conta come finisci, non quanto vai forte.",
      km: wu + reps, paceSec: goalPace5, heatKind: "reps", heatBaseSec: goalPace5,
      why: "Verifica specifica: il ritmo obiettivo è già sostenibile in frazionato, o è ancora un ritmo da inseguire?",
      studies: ["daniels-2013", "billat-2001"],
    };
  }

  // il test lungo si dimensiona sulla settimana in cui cade: un 18 km fisso
  // dentro una settimana da 35 è un altro allenamento, non una verifica
  const km = clamp(roundTo(weekKm * 0.42, 1), 14, 21);
  const fast = clamp(roundTo(km * 0.55, 1), 8, 12);
  return {
    weekday, kind: "long", key: true, test,
    title: `TEST · ${km} km con ${fast} km @ ${fmtSecPace(goalPaceL)}/km`,
    description: `${km - fast} km a ${fmtSecPace(p.easy)}/km, poi ${fast} km continui a ${fmtSecPace(goalPaceL)}/km fino alla fine. `
      + "Guarda la deriva del passo negli ultimi 3 km: è lì che si legge la tenuta.",
    km, paceSec: p.easy, heatKind: "long", heatBaseSec: p.easy,
    why: "L'esponente di tenuta non si stima, si misura: questa è la prova che dice se la mezza obiettivo è reale.",
    studies: ["riegel-1981", "vickers-2016", "jones-2017"],
  };
}

/* ── la previsione di una gara ── */
function outlookFor(
  g: RaceGoal, config: PlanConfig, skeleton: WeekSkeleton[], kmByWeek: number[],
  meanKm: number, riegelNow: number, riegelEnd: number, longEnd: number,
): GoalOutlook {
  const f = config.fitness;
  const raceWeek = skeleton.findIndex((w) => w.race?.id === g.id);
  const weeksOut = Math.max(0.5, (dayIdx(g.dateIso) - dayIdx(config.todayIso)) / 7);
  const weeksOfPlan = raceWeek >= 0 ? raceWeek + 1 : skeleton.length;

  /**
   * Lo STIMOLO non è la media delle settimane fino alla gara: il taper e la
   * settimana di gara abbassano quella media proprio mentre la forma sale, e
   * un piano con un taper più lungo risulterebbe meno allenante di uno senza.
   * Il volume che ha costruito la forma è quello delle settimane di carico.
   */
  const loadKm = kmByWeek
    .slice(0, Math.max(1, weeksOfPlan))
    .filter((_, i) => {
      const b = skeleton[i]?.block;
      return b !== "taper" && b !== "gara";
    });
  const meanKmUpTo = loadKm.length
    ? loadKm.reduce((s, v) => s + v, 0) / loadKm.length
    : f.weeklyKm;

  const vdotProjected = projectVdot(f.vdot, weeksOfPlan, meanKmUpTo, f.weeklyKm);
  const vdotRequired = vdotFrom(g.distanceM, g.targetSec);

  // la tenuta al giorno di quella gara
  const frac = weeksOfPlan / Math.max(1, skeleton.length);
  const exp = riegelNow + (riegelEnd - riegelNow) * frac;

  // ≤ 10 km: il VDOT basta. Oltre: si passa dal 5000 con l'esponente di questo
  // atleta, perché la tabella di Daniels dà per scontata una tenuta allenata.
  const coolRaw = g.distanceM <= 10000
    ? predictSec(g.distanceM, vdotProjected)
    : predictSec(5000, vdotProjected) * Math.pow(g.distanceM / 5000, exp);
  const predictedCoolSec = coolRaw * (1 - TAPER_GAIN);

  const raceClimate = config.raceClimate ?? ROME;
  const conditions = conditionsAt(g.dateIso, g.startHour, raceClimate);
  const heatFrac = heatSlowdownFrac(conditions.tempC, conditions.humidity, g.distanceM / 1000);
  const predictedSec = predictedCoolSec * (1 + heatFrac);
  const heatCostSec = predictedSec - predictedCoolSec;

  const anchorGap = f.vdotDemonstrated != null ? f.vdot - f.vdotDemonstrated : 0;
  const sPct = sigmaPct(weeksOut, g.distanceM, anchorGap);
  const sigma = (sPct / 100) * predictedSec;
  const probability = clamp(normalCdf((g.targetSec - predictedSec) / sigma), 0.005, 0.995);

  /* ── cosa frena ── */
  const limiters: string[] = [];
  if (vdotRequired > vdotProjected + 0.2) {
    limiters.push(
      `Servono ${vdotRequired.toFixed(1)} punti di VDOT, la proiezione ne dà ${vdotProjected.toFixed(1)}: `
      + `mancano ${(vdotRequired - vdotProjected).toFixed(1)} punti di motore.`,
    );
  }
  if (heatCostSec > 12) {
    limiters.push(
      `L'aria attesa (${conditions.tempC}°C + DP ${conditions.dpC}°, indice ${conditions.index}) costa ${Math.round(heatCostSec)}″.`,
    );
  }
  if (g.distanceM > 10000 && exp > 1.078) {
    limiters.push(
      `Tenuta: con ${Math.round(meanKmUpTo)} km/settimana e un lungo da ${Math.round(longEnd)} km l'esponente resta a ${exp.toFixed(3)}. `
      // stesso trattamento della previsione principale, caldo compreso: mettere
      // a confronto un tempo al fresco e uno corretto è un confronto truccato
      + `A 1,070 questa gara varrebbe ${fmtClock(predictSec(5000, vdotProjected) * Math.pow(g.distanceM / 5000, 1.07) * (1 - TAPER_GAIN) * (1 + heatFrac))}.`,
    );
  }
  if (!limiters.length) limiters.push("Niente di strutturale: a questo punto è la giornata.");

  /* ── le leve, in secondi ── */
  const levers: Lever[] = [];

  const dawn = conditionsAt(g.dateIso, 7, raceClimate);
  if (dawn.index < conditions.index - 1) {
    const dawnSec = predictedCoolSec * (1 + heatSlowdownFrac(dawn.tempC, dawn.humidity, g.distanceM / 1000));
    levers.push({
      label: "Partenza all'alba invece che alle " + g.startHour + ":00",
      detail: `${dawn.tempC}°C + DP ${dawn.dpC}° invece di ${conditions.tempC}°C + DP ${conditions.dpC}°.`,
      deltaSec: Math.round(dawnSec - predictedSec),
    });
  }

  const moreKm = projectVdot(f.vdot, weeksOfPlan, meanKmUpTo + 5, f.weeklyKm);
  const moreKmSec = g.distanceM <= 10000
    ? predictSec(g.distanceM, moreKm) * (1 - TAPER_GAIN) * (1 + heatFrac)
    : predictSec(5000, moreKm) * Math.pow(g.distanceM / 5000, riegelExponent(meanKmUpTo + 5, longEnd)) * (1 - TAPER_GAIN) * (1 + heatFrac);
  levers.push({
    label: "+5 km a settimana di volume",
    detail: "Il predittore modificabile più forte (Vickers 2016). Vale sia sul motore sia sulla tenuta.",
    deltaSec: Math.round(moreKmSec - predictedSec),
  });

  if (g.distanceM > 10000) {
    const betterExp = riegelExponent(meanKmUpTo, Math.min(24, longEnd + 4));
    const betterSec = predictSec(5000, vdotProjected) * Math.pow(g.distanceM / 5000, betterExp) * (1 - TAPER_GAIN) * (1 + heatFrac);
    levers.push({
      label: `Lungo da ${Math.round(Math.min(24, longEnd + 4))} km invece di ${Math.round(longEnd)}`,
      detail: "Abbassa l'esponente di tenuta: è la leva che agisce solo sulle distanze lunghe.",
      deltaSec: Math.round(betterSec - predictedSec),
    });
  }

  levers.push({
    label: "Scarpa da gara a piastra",
    detail: "Meta-analisi sui supercalzari: 1,5-2,5% di economia in più rispetto a una scarpa piatta.",
    deltaSec: -Math.round(predictedSec * 0.018),
  });

  return {
    goal: g,
    vdotRequired: Math.round(vdotRequired * 10) / 10,
    vdotProjected: Math.round(vdotProjected * 10) / 10,
    predictedCoolSec: Math.round(predictedCoolSec),
    predictedSec: Math.round(predictedSec),
    conditions,
    heatCostSec: Math.round(heatCostSec),
    riegelExp: Math.round(exp * 1000) / 1000,
    sigmaPct: Math.round(sPct * 100) / 100,
    probability,
    p10Sec: Math.round(predictedSec - 1.2816 * sigma),
    p90Sec: Math.round(predictedSec + 1.2816 * sigma),
    limiters,
    levers: levers.sort((a, b) => a.deltaSec - b.deltaSec),
  };
}

/* ══ 12 · UTILITÀ PER LA PAGINA ═══════════════════════════════════════════ */

export { fmtClock, fmtPace };
export const bandOf = bandForIndex;
export const conditionsFor = conditionsAt;
export const defaultClimate = ROME;
