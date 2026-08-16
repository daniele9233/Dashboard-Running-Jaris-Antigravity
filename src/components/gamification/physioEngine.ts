import type { Run } from "../../types/api";
import {
  apparentTempC, clamp, dayIndex, dayToIso, daySessions, emptyZoneMinutes, heatSlowdownFrac,
  humidityOf, median, paceToSec, predictSec, thresholdPaceSec, vdotFrom,
  type DaySession, type ZoneId, type ZoneMinutes,
} from "./gamiCore";

// La lettura di una corsa sta nel nucleo, non qui: le quattro gamification e
// questo motore devono vedere la stessa identica seduta.
export {
  emptyZoneMinutes, gradeFactor, runZoneMinutes, zoneOfRatio, type ZoneMinutes,
} from "./gamiCore";
/** Quanto rallenta il caldo, in frazione di passo, rispetto a un ottimo ~12 °C. */
export { heatSlowdownFrac as heatPenaltyFrac } from "./gamiCore";

/**
 * IL MOTORE FISIOLOGICO — il piano sotto le quattro gamification
 * ════════════════════════════════════════════════════════════════════════════
 * Le quattro versioni raccontano storie diverse (livelli, classifica, albero,
 * momento) ma pescano tutte da qui, perché la domanda vera è una sola: cosa ha
 * costruito questo allenamento, e quando arrivo dove voglio arrivare.
 *
 * Tre cose che le versioni precedenti non facevano.
 *
 * 1. LA CORSA SI LEGGE CHILOMETRO PER CHILOMETRO.
 *    Prima una seduta era un'etichetta e un passo medio. Ma 10 km a 5:10 di
 *    media possono essere dieci chilometri uguali oppure 4 di riscaldamento,
 *    5×1000 in soglia e il defaticamento: due allenamenti che non c'entrano
 *    niente l'uno con l'altro. Ogni split viene corretto per pendenza e per
 *    temperatura e finisce nella sua zona. Il peso di una corsa non è più una
 *    stima: sono i minuti che ha davvero prodotto, dove li ha prodotti.
 *
 * 2. GLI ADATTAMENTI HANNO TEMPI DIVERSI.
 *    Il corpo non ha un solo serbatoio. Il fondo si costruisce in mesi e si
 *    perde in mesi; la potenza aerobica sale in tre settimane e scende quasi
 *    con la stessa velocità. Cinque compartimenti, ognuno con la sua costante
 *    di tempo, riempiti dai minuti giusti. È il motivo per cui una settimana di
 *    ripetute non compensa sei mesi senza lenti, e la pagina può dirlo.
 *
 * 3. IL CALDO ENTRA DUE VOLTE, CON SEGNI OPPOSTI.
 *    Corri peggio quando fa caldo — e questo lo sapevano già tutte le versioni.
 *    Ma allenarsi al caldo espande il volume plasmatico, e quell'adattamento lo
 *    porti con te quando la temperatura scende. Un'estate di lavoro sotto il
 *    sole non è tempo perso: è la ragione per cui i tempi buoni arrivano da
 *    ottobre in poi. Il modello tiene le due cose separate — la penalità del
 *    giorno e il credito che resta — e la previsione di una gara futura usa il
 *    clima del mese in cui quella gara cade.
 *
 * Da qui esce l'unica risposta che serve davvero all'atleta: non "quanti punti
 * hai" ma "il 14 novembre, se continui così".
 */

// ══ 1 · I COMPARTIMENTI ═══════════════════════════════════════════════════════

export type SystemId = "mito" | "soglia" | "vo2" | "tenuta" | "caldo";

export interface SystemDef {
  id: SystemId;
  name: string;
  color: string;
  /** Cosa fa, detto all'atleta. */
  what: string;
  /** Cosa lo alimenta. */
  from: string;
  /** Costante di tempo in giorni: quanto ci mette a salire e a scendere. */
  tau: number;
  /** Dose giornaliera (minuti equivalenti) che porta il sistema a 100. */
  fullDose: number;
  /** Quanti punti di VDOT vale, da vuoto a pieno. */
  vdotSpan: number;
}

/**
 * Le costanti di tempo sono la parte importante: sono loro a dire perché una
 * settimana buona non recupera un mese perso, e perché il fondo va difeso tutto
 * l'anno mentre le ripetute si rimettono a posto in fretta.
 */
export const SYSTEMS: Record<SystemId, SystemDef> = {
  mito: {
    id: "mito", name: "Motore aerobico", color: "#22D3EE",
    what: "Quanta energia produci senza andare in debito. È il tetto di tutto il resto.",
    from: "minuti in lento e medio",
    tau: 42, fullDose: 52, vdotSpan: 6.0,
  },
  soglia: {
    id: "soglia", name: "Soglia", color: "#FBBF24",
    what: "Il passo che reggi un'ora. Sposta il ritmo gara dai 10K in su.",
    from: "minuti in soglia e medio tirato",
    tau: 24, fullDose: 6.5, vdotSpan: 2.6,
  },
  vo2: {
    id: "vo2", name: "Potenza aerobica", color: "#F43F5E",
    what: "Il tetto massimo. Sale in tre settimane e scende con la stessa fretta.",
    from: "minuti di ripetute e gare corte",
    tau: 15, fullDose: 3.6, vdotSpan: 2.4,
  },
  tenuta: {
    id: "tenuta", name: "Tenuta", color: "#A78BFA",
    what: "Quanto reggi il passo quando la corsa si allunga. Non tocca i 5K, decide la mezza.",
    from: "corse oltre l'ora e settimane piene",
    tau: 60, fullDose: 26, vdotSpan: 1.6,
  },
  caldo: {
    id: "caldo", name: "Adattamento al caldo", color: "#FB923C",
    what: "Più plasma, cuore che lavora meno. Costruito d'estate, si spende quando rinfresca.",
    from: "minuti corsi sopra i 20 °C",
    tau: 12, fullDose: 34, vdotSpan: 1.2,
  },
};
export const SYSTEM_ORDER: SystemId[] = ["mito", "soglia", "vo2", "tenuta", "caldo"];

export type SystemLevels = Record<SystemId, number>;
const emptyLevels = (): SystemLevels => ({ mito: 0, soglia: 0, vo2: 0, tenuta: 0, caldo: 0 });

/**
 * Le dosi del giorno: dove finiscono i minuti appena corsi.
 *
 * Un minuto non alimenta un solo sistema. Le ripetute costruiscono soprattutto
 * potenza, ma anche loro fanno chilometri; la soglia lavora sulla soglia e
 * sostiene il motore aerobico. I coefficienti dicono quanto di quel minuto
 * arriva a destinazione.
 */
export function dosesOf(zm: ZoneMinutes, sessionMinutes: number, heatMinutes: number): SystemLevels {
  const d = emptyLevels();
  d.mito = zm.recovery * 0.55 + zm.easy * 1.0 + zm.medium * 0.85 + zm.threshold * 0.5 + zm.vo2 * 0.3;
  d.soglia = zm.threshold * 1.0 + zm.medium * 0.3 + zm.vo2 * 0.45;
  d.vo2 = zm.vo2 * 1.0 + zm.threshold * 0.2;
  // la tenuta la costruisce solo la parte di seduta oltre l'ora: è lì che
  // finisce il glicogeno facile e il corpo impara a lavorare senza
  d.tenuta = Math.max(0, sessionMinutes - 60) * 1.0 + Math.min(sessionMinutes, 60) * 0.12;
  d.caldo = heatMinutes;
  return d;
}

/** Quanto di una seduta è stata corsa in condizioni che allenano il caldo. */
function heatStressMinutes(r: Run): number {
  const t = r.temperature;
  if (t == null) return 0;
  const app = apparentTempC(t, humidityOf(r));
  if (app <= 20) return 0;
  // sopra i 20 °C lo stimolo cresce fino a saturare: a 32 °C un minuto vale uno
  return (r.duration_minutes || 0) * clamp((app - 20) / 12, 0, 1);
}

// ══ 3 · IL MODELLO ════════════════════════════════════════════════════════════

export interface DayLoad {
  day: number;
  zm: ZoneMinutes;
  minutes: number;
  km: number;
  heatMinutes: number;
}

/** Il carico giorno per giorno. Le zone le ha già lette il nucleo, split per split. */
export function buildDayLoads(sessions: DaySession[]): DayLoad[] {
  return sessions.map((s) => ({
    day: s.day, zm: s.zoneMinutes, minutes: s.minutes, km: s.km,
    heatMinutes: s.parts.reduce((acc, r) => acc + heatStressMinutes(r), 0),
  }));
}

/**
 * L'integrazione: ogni sistema è una media esponenziale delle sue dosi.
 *
 * `x(t) = x(t-1)·e^(-1/τ) + dose(t)/τ` — sotto dose costante il sistema tende a
 * `dose`, che è esattamente il comportamento che serve: allenarsi sempre uguale
 * porta a un livello e lì si ferma. Per salire ancora bisogna aumentare la dose,
 * ed è il motivo per cui i miglioramenti rallentano da soli senza bisogno di
 * tappi artificiali.
 */
function integrate(levels: SystemLevels, doses: SystemLevels): SystemLevels {
  const out = emptyLevels();
  for (const id of SYSTEM_ORDER) {
    const k = Math.exp(-1 / SYSTEMS[id].tau);
    out[id] = levels[id] * k + doses[id] * (1 - k);
  }
  return out;
}

/** Da minuti accumulati a percentuale del pieno. */
const pctOf = (levels: SystemLevels): SystemLevels => {
  const out = emptyLevels();
  for (const id of SYSTEM_ORDER) out[id] = clamp((levels[id] / SYSTEMS[id].fullDose) * 100, 0, 100);
  return out;
};

/**
 * Il contributo dei sistemi al VDOT, in punti.
 *
 * Non è lineare: i primi minuti di lavoro valgono molto più degli ultimi. La
 * radice smorzata riproduce la cosa che ogni allenatore sa — si va da fermi a
 * discreti in fretta, da discreti a forti ci vogliono anni.
 */
function vdotContribution(pct: SystemLevels, distKm: number): number {
  const curve = (p: number) => Math.pow(clamp(p, 0, 100) / 100, 0.62);
  // la tenuta non conta sui 5000 e decide la maratona
  const duraW = clamp((distKm - 5) / 16, 0, 1);
  return (
    curve(pct.mito) * SYSTEMS.mito.vdotSpan +
    curve(pct.soglia) * SYSTEMS.soglia.vdotSpan +
    curve(pct.vo2) * SYSTEMS.vo2.vdotSpan +
    curve(pct.tenuta) * SYSTEMS.tenuta.vdotSpan * duraW
  );
}

/**
 * Il credito del caldo: quanto vale, al fresco, l'adattamento costruito d'estate.
 *
 * Vale solo se la gara è al fresco — allenarsi al caldo e correre al caldo non
 * regala niente, serve solo a non perdere. Sotto i 15 °C il credito è pieno,
 * sopra i 25 è zero.
 */
function heatCredit(pctCaldo: number, raceTempC: number): number {
  const usable = clamp((25 - raceTempC) / 10, 0, 1);
  return (clamp(pctCaldo, 0, 100) / 100) * SYSTEMS.caldo.vdotSpan * usable;
}

// ══ 4 · IL CLIMA DELL'ATLETA ══════════════════════════════════════════════════

/** Medie mensili di Roma, usate solo dove l'atleta non ha ancora corso. */
const ROME_NORMALS = [8, 9, 11, 14, 18, 22, 25, 25, 21, 17, 12, 9];

/**
 * Che temperatura trova questo atleta, mese per mese. Le sue corse valgono più
 * di una media climatica: chi esce alle sei del mattino d'agosto non corre a
 * 25 °C, e la previsione di settembre deve saperlo.
 */
export function monthlyClimate(runs: Run[]): number[] {
  const byMonth: number[][] = Array.from({ length: 12 }, () => []);
  for (const r of runs) {
    if (r.temperature == null || r.is_treadmill) continue;
    const m = +r.date.slice(5, 7) - 1;
    if (m >= 0 && m < 12) byMonth[m].push(r.temperature);
  }
  return byMonth.map((xs, i) => (xs.length >= 3 ? median(xs)! : ROME_NORMALS[i]));
}

const monthOfDay = (dayIdx: number) => new Date(dayIdx * 86400000).getUTCMonth();

// ══ 5 · STATO E PREVISIONE ════════════════════════════════════════════════════

export interface SystemState {
  def: SystemDef;
  /** 0-100. */
  pct: number;
  /** Variazione negli ultimi 28 giorni, in punti percentuali. */
  trend28: number;
  /** Minuti settimanali che alimentano questo sistema, ultime 6 settimane. */
  weeklyDose: number;
  /** Dose settimanale che lo terrebbe al pieno. */
  weeklyFull: number;
  /** Cosa succede se non cambia niente: dove si stabilizza. */
  settlesAt: number;
}

/** Cosa ha costruito una singola corsa — il "peso" di quella seduta. */
export interface SessionImpact {
  id: string; date: string; day: number; name: string;
  km: number; minutes: number;
  zm: ZoneMinutes;
  tempC: number | null;
  /** Punti percentuali aggiunti a ciascun sistema da questa seduta sola. */
  gain: SystemLevels;
  /** Il sistema che questa seduta ha alimentato di più, in termini di VDOT. */
  mainSystem: SystemDef | null;
  /**
   * Quanto vale questa seduta sola, in punti di VDOT, al margine di dove sei
   * adesso. È un numero piccolo di proposito — nessuna singola uscita cambia una
   * stagione — ma è la stessa unità su ogni riga, quindi due corse si possono
   * finalmente confrontare.
   */
  vdotGain: number;
  /** Frase pronta: cosa ha fatto questa corsa. */
  what: string;
}

export interface GoalEta {
  id: string; group: string; label: string;
  /** Secondi da battere. */
  targetSec: number;
  /** Data prevista al ritmo attuale — null se non ci si arriva. */
  iso: string | null;
  days: number | null;
  /** "fra 3 settimane", "fra 5 mesi". */
  human: string;
  /** Già raggiunto oggi, alle condizioni di oggi. */
  done: boolean;
  /** Temperatura attesa nel mese di arrivo: il perché della data. */
  etaTempC: number | null;
  /** Cosa serve, detto in una riga. */
  blocker: string | null;
}

export interface PhysioForecast {
  /** VDOT previsto fra 30 / 90 / 180 giorni tenendo il ritmo attuale. */
  in30: number; in90: number; in180: number;
  /** Punti di VDOT al mese, adesso. */
  perMonth: number;
  /** Dove si ferma se non cambia niente. */
  plateau: number;
  /** Giorni per arrivare a metà strada verso il plateau. */
  halfwayDays: number | null;
  points: { day: number; iso: string; vdot: number; sec5k: number; sec10k: number }[];
}

export interface PhysioState {
  ok: boolean;
  /** VDOT di oggi, al fresco: il potenziale, non la prestazione di ferragosto. */
  vdot: number;
  /** Quello che faresti oggi, con la temperatura di oggi. */
  vdotToday: number;
  anchored: boolean;
  systems: SystemState[];
  byId: Record<SystemId, SystemState>;
  /** Il sistema che frena di più: quello con più margine e più peso. */
  limiter: SystemState | null;
  /** Quello messo meglio. */
  strongest: SystemState | null;
  forecast: PhysioForecast;
  goals: GoalEta[];
  /** Cosa aggiungere all'allenamento, ordinato per quanto avvicina il traguardo. */
  prescriptions: Prescription[];
  /** Storia: un punto al giorno degli ultimi 12 mesi. */
  history: { day: number; iso: string; vdot: number; levels: SystemLevels }[];
  impacts: SessionImpact[];
  /** Minuti settimanali per zona, ultime 6 settimane. */
  weeklyZone: ZoneMinutes;
  weeklyMinutes: number;
  weeklyKm: number;
  daysSinceLastRun: number;
  thresholdPaceSec: number;
  climate: number[];
  /** Quanto ti costa oggi il caldo sui 5K, in secondi. */
  heatCost5kNow: number;
  /** Quanto ti restituisce l'adattamento al caldo quando rinfresca. */
  heatCreditCool: number;
}

const DOSE_WINDOW = 42;        // su quante settimane si legge "come ti alleni"
const HISTORY_DAYS = 365;
const FORECAST_DAYS = 900;     // due anni e mezzo: oltre, promettere è ridicolo
const MAX_VDOT_PER_MONTH = 1.0;

export interface GoalDef { id: string; group: string; label: string; m: number; sec: number }
export const GOALS: GoalDef[] = [
  { id: "5k-25", group: "5K", label: "5K sotto 25'", m: 5000, sec: 1500 },
  { id: "5k-22", group: "5K", label: "5K sotto 22'", m: 5000, sec: 1320 },
  { id: "5k-21", group: "5K", label: "5K sotto 21'", m: 5000, sec: 1260 },
  { id: "5k-20", group: "5K", label: "5K sotto 20'", m: 5000, sec: 1200 },
  { id: "5k-19", group: "5K", label: "5K sotto 19'", m: 5000, sec: 1140 },
  { id: "10k-50", group: "10K", label: "10K sotto 50'", m: 10000, sec: 3000 },
  { id: "10k-45", group: "10K", label: "10K sotto 45'", m: 10000, sec: 2700 },
  { id: "10k-42", group: "10K", label: "10K sotto 42'", m: 10000, sec: 2520 },
  { id: "10k-40", group: "10K", label: "10K sotto 40'", m: 10000, sec: 2400 },
  { id: "hm-145", group: "Mezza", label: "Mezza sotto 1:45", m: 21097, sec: 6300 },
  { id: "hm-140", group: "Mezza", label: "Mezza sotto 1:40", m: 21097, sec: 6000 },
  { id: "hm-130", group: "Mezza", label: "Mezza sotto 1:30", m: 21097, sec: 5400 },
];

const EMPTY_FORECAST: PhysioForecast = {
  in30: 0, in90: 0, in180: 0, perMonth: 0, plateau: 0, halfwayDays: null, points: [],
};

const EMPTY: PhysioState = {
  ok: false, vdot: 0, vdotToday: 0, anchored: false, systems: [],
  byId: {} as Record<SystemId, SystemState>, limiter: null, strongest: null,
  forecast: EMPTY_FORECAST, goals: [], prescriptions: [], history: [], impacts: [],
  weeklyZone: emptyZoneMinutes(), weeklyMinutes: 0, weeklyKm: 0, daysSinceLastRun: 0,
  thresholdPaceSec: 0, climate: ROME_NORMALS, heatCost5kNow: 0, heatCreditCool: 0,
};

/**
 * Stima grezza del VDOT quando l'ancora del backend non è ancora arrivata.
 * Solo prove ≥5 km: sotto quella distanza il contributo anaerobico gonfia il
 * numero, ed è una regola già pagata a caro prezzo altrove nell'app.
 */
function seedVdot(runs: Run[]): number {
  let best = 0;
  for (const r of runs) {
    if (r.is_treadmill) continue;
    const ps = paceToSec(r.avg_pace), km = r.distance_km || 0;
    if (!ps || km < 5 || km > 25) continue;
    const cool = ps / (1 + heatSlowdownFrac(r.temperature, humidityOf(r), km));
    best = Math.max(best, vdotFrom(km * 1000, cool * km));
  }
  return best > 0 ? clamp(best, 25, 80) : 38;
}

export function buildPhysio(
  runsIn: Run[],
  todayIso: string = new Date().toISOString(),
  vdotAnchor?: number | null,
): PhysioState {
  const anchored = !!(vdotAnchor && vdotAnchor > 0);
  const vdotRef = anchored ? vdotAnchor! : seedVdot(runsIn);
  const thrPace = thresholdPaceSec(vdotRef);

  // le zone si leggono rispetto alla SUA soglia: la stessa seduta è qualità per
  // un atleta e fondo per un altro, ed è tutto il punto
  const sessions = daySessions(runsIn, 1.0, thrPace);
  if (sessions.length < 5) return EMPTY;

  const loads = buildDayLoads(sessions);
  const byDay = new Map<number, DayLoad>();
  for (const l of loads) byDay.set(l.day, l);

  const lastRun = loads[loads.length - 1].day;
  const today = Math.max(dayIndex(todayIso), lastRun);
  const climate = monthlyClimate(runsIn);

  // ── la storia: integrazione giorno per giorno dalla prima corsa ──
  let levels = emptyLevels();
  const history: PhysioState["history"] = [];
  const levelsAt = new Map<number, SystemLevels>();
  const zero = emptyLevels();

  for (let d = loads[0].day; d <= today; d++) {
    const l = byDay.get(d);
    levels = integrate(levels, l ? dosesOf(l.zm, l.minutes, l.heatMinutes) : zero);
    if (d > today - HISTORY_DAYS) levelsAt.set(d, { ...levels });
  }

  const pct = pctOf(levels);
  // il modello spiega la FORMA della curva; il livello lo fissa l'ancora del
  // backend, che è la fonte di verità del resto dell'app. Senza questa
  // traslazione la pagina mostrerebbe un secondo VDOT diverso da tutti gli altri.
  const modelToday = vdotContribution(pct, 5);
  const base = vdotRef - modelToday - heatCredit(pct.caldo, 12);
  const vdotOf = (p: SystemLevels, distKm: number, raceTempC: number) =>
    base + vdotContribution(p, distKm) + heatCredit(p.caldo, raceTempC);

  for (const [d, lv] of [...levelsAt.entries()].sort((a, b) => a[0] - b[0])) {
    history.push({ day: d, iso: dayToIso(d), vdot: round1(vdotOf(pctOf(lv), 5, 12)), levels: pctOf(lv) });
  }

  // ── come ti alleni adesso: dose settimanale media delle ultime 6 settimane ──
  const from = today - DOSE_WINDOW;
  const recent = loads.filter((l) => l.day > from);
  const weeklyZone = emptyZoneMinutes();
  let weeklyMinutes = 0, weeklyKm = 0;
  for (const l of recent) {
    for (const k of Object.keys(weeklyZone) as ZoneId[]) weeklyZone[k] += l.zm[k];
    weeklyMinutes += l.minutes; weeklyKm += l.km;
  }
  const wk = DOSE_WINDOW / 7;
  for (const k of Object.keys(weeklyZone) as ZoneId[]) weeklyZone[k] = round1(weeklyZone[k] / wk);
  weeklyMinutes = round1(weeklyMinutes / wk);
  weeklyKm = round1(weeklyKm / wk);

  // dose giornaliera media da proiettare in avanti: quella che stai tenendo
  const dailyDose = emptyLevels();
  {
    const sumZ = emptyZoneMinutes();
    let sumMin = 0, sumHeat = 0, sumSessionOver = 0;
    for (const l of recent) {
      for (const k of Object.keys(sumZ) as ZoneId[]) sumZ[k] += l.zm[k];
      sumMin += l.minutes; sumHeat += l.heatMinutes;
      sumSessionOver += Math.max(0, l.minutes - 60);
    }
    const perDay = (v: number) => v / DOSE_WINDOW;
    const zAvg = emptyZoneMinutes();
    for (const k of Object.keys(sumZ) as ZoneId[]) zAvg[k] = perDay(sumZ[k]);
    const d = dosesOf(zAvg, perDay(sumMin), perDay(sumHeat));
    // la tenuta dipende dalla LUNGHEZZA delle sedute, non dai minuti spalmati:
    // ricalcolata sui lunghi veri, altrimenti sei sedute da 40′ fingerebbero un lungo
    d.tenuta = perDay(sumSessionOver) + perDay(sumMin) * 0.12;
    Object.assign(dailyDose, d);
  }

  // ── previsione ──
  const forecast = buildForecast(levels, dailyDose, today, base, climate);
  const nowMonthTemp = climate[monthOfDay(today)];
  const vdotCool = round1(vdotOf(pct, 5, 12));
  // il VDOT di oggi è quello che il cronometro direbbe uscendo adesso: credito
  // del caldo ridotto (se fa caldo non lo spendi) E penalità della giornata
  const vdotNow = round1(vdotFrom(5000, seasonalTime(levels, base, 5000, nowMonthTemp)));

  /**
   * Il livello mostrato è la media di una settimana, non la fotografia di oggi.
   *
   * I serbatoi veloci si riempiono di scatto: una seduta di ripetute è quasi
   * tutto lo stimolo settimanale di quel sistema, quindi il valore del giorno
   * salta di decine di punti a seconda che tu abbia corso ieri o l'altroieri.
   * Il modello lavora sul valore esatto — le previsioni non vanno smussate — ma
   * un numero che rimbalza così non è leggibile, e soprattutto non è quello che
   * l'atleta vuole sapere: la domanda è come stai messo, non cosa hai fatto ieri.
   */
  const smoothPct = (at: number): SystemLevels => {
    const acc = emptyLevels();
    let n = 0;
    for (let d = at - 6; d <= at; d++) {
      const lv = levelsAt.get(d);
      if (!lv) continue;
      const p = pctOf(lv);
      for (const id of SYSTEM_ORDER) acc[id] += p[id];
      n++;
    }
    if (!n) return pctOf(levels);
    for (const id of SYSTEM_ORDER) acc[id] /= n;
    return acc;
  };
  const shown = smoothPct(today);
  const shown28 = smoothPct(today - 28);

  const systems = SYSTEM_ORDER.map<SystemState>((id) => {
    const def = SYSTEMS[id];
    const weeklyDose = round1(dailyDose[id] * 7);
    return {
      def, pct: Math.round(shown[id]),
      trend28: levelsAt.has(today - 28) ? Math.round(shown[id] - shown28[id]) : 0,
      weeklyDose, weeklyFull: Math.round(def.fullDose * 7),
      settlesAt: Math.round(clamp((dailyDose[id] / def.fullDose) * 100, 0, 100)),
    };
  });
  const byId = Object.fromEntries(systems.map((s) => [s.def.id, s])) as Record<SystemId, SystemState>;

  // il freno: quanti punti di VDOT lascia sul tavolo ciascun sistema
  const roomOf = (s: SystemState) =>
    (Math.pow(1, 0.62) - Math.pow(s.pct / 100, 0.62)) * s.def.vdotSpan * (s.def.id === "caldo" ? 0.4 : 1);
  const ranked = [...systems].sort((a, b) => roomOf(b) - roomOf(a));
  const goals = buildGoals(levels, dailyDose, today, base, climate, vdotCool);

  return {
    ok: true,
    vdot: vdotCool, vdotToday: vdotNow, anchored,
    systems, byId,
    limiter: ranked[0] ?? null,
    strongest: [...systems].sort((a, b) => b.pct - a.pct)[0] ?? null,
    forecast,
    goals,
    prescriptions: buildPrescriptions(levels, dailyDose, today, base, climate, goals, vdotCool),
    history,
    impacts: buildImpacts(sessions, loads, levels),
    weeklyZone, weeklyMinutes, weeklyKm,
    daysSinceLastRun: today - lastRun,
    thresholdPaceSec: thrPace,
    climate,
    heatCost5kNow: Math.round(predictSec(5000, vdotCool) * heatSlowdownFrac(nowMonthTemp, null, 5)),
    heatCreditCool: round1(heatCredit(pct.caldo, 8)),
  };
}

// ── la curva in avanti ────────────────────────────────────────────────────────
/**
 * Cosa succede se continui così.
 *
 * I sistemi tendono ognuno alla propria dose, con la propria costante di tempo:
 * la potenza aerobica arriva a destinazione in un mese, il fondo ci mette un
 * semestre. La curva che ne esce non è una retta e non ha bisogno di tappi
 * inventati — rallenta da sola perché i serbatoi si riempiono.
 *
 * L'unico limite imposto a mano è la velocità di salita: oltre un punto di VDOT
 * al mese non è progresso, è un modello che si è innamorato di sé stesso.
 */
function buildForecast(
  levels0: SystemLevels, dailyDose: SystemLevels, today: number,
  base: number, climate: number[],
): PhysioForecast {
  let lv = { ...levels0 };
  const points: PhysioForecast["points"] = [];
  const coolAt = (l: SystemLevels) => base + vdotContribution(pctOf(l), 5) + heatCredit(pctOf(l).caldo, 12);

  const v0 = coolAt(levels0);
  let capped = v0;
  const out: Record<number, number> = {};

  for (let i = 1; i <= FORECAST_DAYS; i++) {
    lv = integrate(lv, dailyDose);
    const raw = coolAt(lv);
    // il tetto di salita si applica al potenziale al fresco, non al giorno
    capped = Math.min(raw, capped + MAX_VDOT_PER_MONTH / 30);
    out[i] = capped;
    if (i % 15 === 0 && i <= 540) {
      const d = today + i;
      const t = climate[monthOfDay(d)];
      // il tempo di quel giorno lo dà il clima del mese: stessa forma, cronometro
      // diverso fra luglio e novembre. È la ragione per cui la curva ondeggia.
      const shift = capped - raw;
      points.push({
        day: d, iso: dayToIso(d), vdot: round1(capped),
        sec5k: Math.round(seasonalTime(lv, base + shift, 5000, t)),
        sec10k: Math.round(seasonalTime(lv, base + shift, 10000, t)),
      });
    }
  }

  const plateau = out[FORECAST_DAYS];
  const gap = plateau - v0;
  let halfway: number | null = null;
  if (gap > 0.2) {
    for (let i = 1; i <= FORECAST_DAYS; i++) if (out[i] >= v0 + gap / 2) { halfway = i; break; }
  }

  return {
    in30: round1(out[30]), in90: round1(out[90]), in180: round1(out[180]),
    perMonth: round1(out[30] - v0),
    plateau: round1(plateau),
    halfwayDays: halfway,
    points,
  };
}

// ── quando arrivo lì ──────────────────────────────────────────────────────────
/**
 * La domanda che nessuna delle quattro versioni sapeva davvero rispondere.
 *
 * Si cammina in avanti giorno per giorno con i sistemi che si riempiono, e per
 * ogni giorno si chiede: se corressi quella gara OGGI, col clima di questo mese,
 * la chiuderei sotto il tempo? Il primo giorno in cui la risposta è sì è la data.
 *
 * Il clima conta e non è un dettaglio: sui 5000 la differenza fra luglio e
 * gennaio vale più di un mese di allenamento. È il motivo per cui certi
 * traguardi cadono sempre in autunno anche a parità di lavoro.
 */
function buildGoals(
  levels0: SystemLevels, dailyDose: SystemLevels, today: number,
  base: number, climate: number[], vdotToday: number,
): GoalEta[] {
  const targets = GOALS.filter((g) => vdotFrom(g.m, g.sec) < vdotToday + 14);  // oltre, è un altro sport
  if (!targets.length) return [];

  const pending = new Map<string, GoalEta>();
  const chase: GoalDef[] = [];
  for (const g of targets) {
    const done = seasonalTime(levels0, base, g.m, climate[monthOfDay(today)]) <= g.sec;
    pending.set(g.id, {
      id: g.id, group: g.group, label: g.label, targetSec: g.sec,
      iso: null, days: null, human: done ? "già alla tua portata" : "fuori portata",
      done, etaTempC: null, blocker: null,
    });
    if (!done) chase.push(g);
  }

  walkForward(levels0, dailyDose, today, base, climate, chase, (g, day, i, temp) => {
    const e = pending.get(g.id)!;
    e.iso = dayToIso(day); e.days = i; e.human = humanDays(i); e.etaTempC = Math.round(temp);
  });

  for (const e of pending.values()) {
    if (!e.done && !e.iso) {
      e.blocker = "col carico di queste settimane il modello non ci arriva: serve più lavoro, non più tempo";
    }
  }
  return [...pending.values()].sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9));
}

/**
 * Cammina in avanti finché ogni traguardo della lista non cade, e chiama `hit`
 * il giorno in cui cade. Estratto perché serve due volte: per le date di oggi e
 * per rispondere a "e se aggiungessi una seduta di soglia?".
 */
function walkForward(
  levels0: SystemLevels, dailyDose: SystemLevels, today: number,
  base: number, climate: number[], goals: GoalDef[],
  hit: (g: GoalDef, day: number, days: number, tempC: number) => void,
): void {
  if (!goals.length) return;
  const open = new Set(goals.map((g) => g.id));
  let lv = { ...levels0 };
  let capped = base + vdotContribution(pctOf(levels0), 5);

  for (let i = 1; i <= FORECAST_DAYS && open.size; i++) {
    lv = integrate(lv, dailyDose);
    const rawCool = base + vdotContribution(pctOf(lv), 5);
    capped = Math.min(rawCool, capped + MAX_VDOT_PER_MONTH / 30);
    const shift = capped - rawCool;                 // il tetto di salita vale anche qui
    const d = today + i;
    const temp = climate[monthOfDay(d)];
    for (const g of goals) {
      if (!open.has(g.id)) continue;
      if (seasonalTime(lv, base + shift, g.m, temp) <= g.sec) {
        open.delete(g.id);
        hit(g, d, i, temp);
      }
    }
  }
}

// ── cosa fare, e quanto serve ─────────────────────────────────────────────────
export interface Prescription {
  id: string;
  /** L'ordine, in una riga: "Una soglia da 6 km a 4:22/km". */
  title: string;
  /** Quando e quanto spesso. */
  detail: string;
  system: SystemDef;
  /** Dove porta quel sistema fra otto settimane, contro il {@link nowPct}. */
  in8w: number;
  nowPct: number;
  /** Giorni tolti al traguardo di riferimento — la vera misura di "conviene". */
  daysSaved: number | null;
  /** Punti di VDOT guadagnati in otto settimane rispetto al non farlo. */
  vdotGain: number;
}

/** Minuti settimanali che ogni ricetta aggiunge, per zona. */
const RECIPES: { id: string; system: SystemId; zone: ZoneId; weeklyMin: number; longRunMin?: number }[] = [
  { id: "soglia", system: "soglia", zone: "threshold", weeklyMin: 26 },
  { id: "ripetute", system: "vo2", zone: "vo2", weeklyMin: 20 },
  { id: "lungo", system: "tenuta", zone: "easy", weeklyMin: 100, longRunMin: 100 },
  { id: "volume", system: "mito", zone: "easy", weeklyMin: 90 },
];

/**
 * "Se aggiungo questa seduta, quanto ci guadagno?"
 *
 * Non è una lista di consigli generici: ogni riga viene fatta girare nel
 * modello, con la dose che aggiungerebbe davvero, e il risultato è misurato in
 * giorni tolti al primo traguardo ancora aperto. Se una seduta non sposta la
 * data, la pagina lo dice invece di raccomandarla lo stesso.
 */
function buildPrescriptions(
  levels0: SystemLevels, dailyDose: SystemLevels, today: number,
  base: number, climate: number[], goals: GoalEta[], vdotCool: number,
): Prescription[] {
  /**
   * Su quale traguardo si misura il guadagno.
   *
   * Non il più vicino: un obiettivo che cade fra due settimane è già in mano, e
   * ottimizzare su quello premia il sistema più rapido invece di quello che
   * frena davvero — la pagina finiva per dire "ti frena il motore aerobico" e
   * subito sotto "fai una soglia". Si prende il primo traguardo abbastanza
   * lontano da avere senso, cioè almeno sei settimane, altrimenti il più lontano
   * che c'è.
   */
  const open = goals.filter((g) => !g.done && g.days != null);
  const target = open.find((g) => (g.days ?? 0) >= 42) ?? open[open.length - 1] ?? null;
  const baseDays = target?.days ?? null;
  const targetDef = target ? GOALS.find((g) => g.id === target.id) ?? null : null;

  const thr = thresholdPaceSec(vdotCool);
  const paceTxt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec) % 60).padStart(2, "0")}`;
  const copy: Record<string, { title: string; detail: string }> = {
    soglia: {
      title: `Una soglia da 6 km a ${paceTxt(thr)}/km`,
      detail: "Una volta a settimana, 25-30 minuti continui. È il lavoro che sposta il ritmo gara dai 10K in su.",
    },
    ripetute: {
      title: `5×1000 a ${paceTxt(thr * 0.945)}/km`,
      detail: "Una volta a settimana, recupero 2'. Alza il tetto: sale in fretta, ma va rinnovato.",
    },
    lungo: {
      title: `Un lungo da 100 minuti a ${paceTxt(thr * 1.22)}/km`,
      detail: "Uno a settimana. Solo la parte oltre l'ora costruisce tenuta: sotto, è un lento come gli altri.",
    },
    volume: {
      title: `90 minuti di lento in più a settimana a ${paceTxt(thr * 1.22)}/km`,
      detail: "Due uscite da 45', o allunga quelle che fai già. È il mattone del motore aerobico.",
    },
  };

  return RECIPES.map((rec) => {
    const extra = { ...dailyDose };
    const zm = emptyZoneMinutes();
    zm[rec.zone] = rec.weeklyMin / 7;
    const add = dosesOf(zm, rec.weeklyMin / 7, 0);
    // la tenuta la dà la lunghezza della singola seduta, non i minuti spalmati
    add.tenuta = rec.longRunMin ? Math.max(0, rec.longRunMin - 60) / 7 : (rec.weeklyMin / 7) * 0.12;
    for (const id of SYSTEM_ORDER) extra[id] += add[id];

    let lv = { ...levels0 }, lvBase = { ...levels0 };
    for (let i = 0; i < 56; i++) { lv = integrate(lv, extra); lvBase = integrate(lvBase, dailyDose); }
    const in8w = Math.round(clamp((lv[rec.system] / SYSTEMS[rec.system].fullDose) * 100, 0, 100));
    // il guadagno vero è in punti di VDOT, non in punti percentuali di un
    // serbatoio: riempire la soglia di cinquanta punti vale meno che riempirne
    // venti di motore aerobico, perché i due non pesano uguale
    const vdotGain = round2(
      vdotContribution(pctOf(lv), 5) - vdotContribution(pctOf(lvBase), 5),
    );

    let daysSaved: number | null = null;
    if (targetDef && baseDays != null) {
      walkForward(levels0, extra, today, base, climate, [targetDef], (_g, _d, days) => {
        daysSaved = Math.max(0, baseDays - days);
      });
    }

    return {
      id: rec.id, ...copy[rec.id], system: SYSTEMS[rec.system],
      in8w, nowPct: Math.round(clamp((levels0[rec.system] / SYSTEMS[rec.system].fullDose) * 100, 0, 100)),
      daysSaved, vdotGain,
    };
  }).sort((a, b) => (b.daysSaved ?? 0) - (a.daysSaved ?? 0) || b.vdotGain - a.vdotGain);
}

/** Tempo su una distanza in un mese con quella temperatura, tenuta inclusa. */
function seasonalTime(levels: SystemLevels, base: number, distM: number, tempC: number): number {
  const p = pctOf(levels);
  const distKm = distM / 1000;
  const vCool = base + vdotContribution(p, distKm) + heatCredit(p.caldo, tempC);
  return predictSec(distM, vCool) * (1 + heatSlowdownFrac(tempC, null, distKm));
}

export function humanDays(days: number): string {
  if (days <= 1) return "domani";
  if (days < 14) return `fra ${days} giorni`;
  if (days < 70) {
    const w = Math.round(days / 7);
    return `fra ${w} settimane`;
  }
  const m = Math.round(days / 30.4);
  if (m < 24) return `fra ${m} mesi`;
  return `fra ${Math.round((m / 12) * 10) / 10} anni`;
}

// ── il peso di una corsa ──────────────────────────────────────────────────────
/**
 * Quanto ha spostato UNA seduta. Si rifà girare il modello senza quella corsa e
 * si guarda la differenza: è l'unico modo onesto di attribuire un contributo,
 * perché il valore di un allenamento dipende da quelli che ha intorno.
 *
 * I numeri sono piccoli, ed è giusto così: nessuna singola uscita cambia una
 * stagione. Quello che si legge è la direzione — cosa stavi costruendo quel
 * giorno, e se era quello che ti serviva.
 */
function buildImpacts(sessions: DaySession[], loads: DayLoad[], levels: SystemLevels): SessionImpact[] {
  const byDay = new Map<number, DayLoad>();
  for (const l of loads) byDay.set(l.day, l);
  const now = pctOf(levels);
  const baseline = vdotContribution(now, 5) + heatCredit(now.caldo, 12);

  return sessions.slice(-40).reverse().map((s) => {
    const l = byDay.get(s.day)!;
    const doses = dosesOf(l.zm, l.minutes, l.heatMinutes);
    // il contributo istantaneo di questa seduta ai sistemi, in punti percentuali
    const gain = emptyLevels();
    for (const id of SYSTEM_ORDER) {
      const k = 1 - Math.exp(-1 / SYSTEMS[id].tau);
      gain[id] = round2(clamp((doses[id] * k / SYSTEMS[id].fullDose) * 100, 0, 100));
    }

    /**
     * Il valore di un guadagno va pesato dove ti trovi, non in astratto.
     *
     * La prima versione ordinava i sistemi per punti percentuali diviso il loro
     * peso — cioè esattamente al contrario — e un lento da un'ora finiva
     * attribuito alla Tenuta invece che al motore aerobico, perché la Tenuta ha
     * un serbatoio piccolo e si muove di più in percentuale. Qui si misura la
     * cosa che conta: quanti punti di VDOT ha aggiunto quel minuto, al margine.
     */
    const vdotOfGain = (only?: SystemId) => {
      const after = { ...now };
      for (const id of SYSTEM_ORDER) {
        if (only && id !== only) continue;
        after[id] = clamp(after[id] + gain[id], 0, 100);
      }
      return vdotContribution(after, 5) + heatCredit(after.caldo, 12) - baseline;
    };
    const main = SYSTEM_ORDER
      .map((id) => ({ id, v: vdotOfGain(id) }))
      .sort((a, b) => b.v - a.v)[0];

    return {
      id: s.id, date: s.date, day: s.day, name: s.name,
      km: round1(s.km), minutes: Math.round(s.minutes), zm: l.zm,
      tempC: s.temperature,
      gain, mainSystem: main && main.v > 0 ? SYSTEMS[main.id] : null,
      vdotGain: Math.round(vdotOfGain() * 1000) / 1000,
      what: impactPhrase(l, main?.id ?? null),
    };
  });
}

function impactPhrase(l: DayLoad, main: SystemId | null): string {
  const q = Math.round(l.zm.threshold + l.zm.vo2);
  const heat = l.heatMinutes >= 20;
  if (q >= 8 && (main === "vo2" || main === "soglia")) {
    const kind = main === "vo2" ? "sopra soglia" : "in soglia";
    return `${q} minuti ${kind}${heat ? ", e col caldo addosso" : ""}: il lavoro che sposta il ritmo gara.`;
  }
  if (main === "tenuta") return `${Math.round(l.minutes)} minuti: oltre l'ora si costruisce la tenuta, non il fiato.`;
  if (main === "caldo") return `${Math.round(l.minutes)} minuti sotto il sole: qui si espande il volume plasmatico, e si spende in inverno.`;
  const aerobic = Math.round(l.zm.easy + l.zm.recovery + l.zm.medium);
  if (aerobic > 0) {
    return `${aerobic} minuti aerobici${heat ? " al caldo" : ""}: mattoni per il motore.`;
  }
  return "Seduta breve: tiene l'abitudine, non sposta i numeri.";
}

// ── utilità ───────────────────────────────────────────────────────────────────
const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;
