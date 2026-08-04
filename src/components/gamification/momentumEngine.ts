import type { Run } from "../../types/api";
import {
  ZONES, type ZoneDef, type ZoneId, type DaySession,
  bestSustainedPaceSec, dayIndex, daySessions, dayToIso,
} from "./gamiCore";

/**
 * GAMIFICATION V4 — MOMENTUM
 * ════════════════════════════════════════════════════════════════════════════
 * Le altre tre versioni chiedono COSA hai fatto. Questa chiede QUANDO.
 *
 * La stessa identica seduta — 5×1000 allo stesso passo — non vale uguale il
 * giorno dopo una seduta dura e due giorni dopo. Fisiologicamente non lo è, e
 * qui il punteggio lo dice prima che tu esca, non dopo.
 *
 * Due cose si moltiplicano:
 *
 *   MOMENTUM   quanto sei "acceso": sale a ogni corsa, scende ogni giorno di
 *              stop. È lo stato di forma della settimana, non della stagione.
 *   FINESTRA   se sei nel momento giusto rispetto all'ultima seduta. Il giorno
 *              dopo una prova dura la finestra è chiusa (×0.75): non è pigrizia,
 *              è che quel lavoro lì, quel giorno, rende meno.
 *
 * Il risultato è l'unica pagina che ti dice "esci giovedì, non domani" — e di
 * quanto ci guadagni.
 *
 * La stagione dura 13 settimane e ha una scadenza: i capitoli non si raggiungono
 * "prima o poi", si raggiungono entro domenica della tredicesima.
 */

// ── MOMENTUM ──────────────────────────────────────────────────────────────────
export const MOM_MAX = 100;
export const MOM_DECAY_PER_REST_DAY = 5.5;
const MOM_MULT_SPAN = 1.5;                    // momentum pieno = ×2.5 sulla base

const ZONE_CHARGE: Record<ZoneId, number> = { recovery: 2, easy: 4, medium: 6, threshold: 9, vo2: 11 };
/** Con quanti minuti la durata vale 1. Sotto, la seduta pesa meno. */
const CHARGE_UNIT = 15;
/**
 * Quanto la durata conta: sotto 1 satura.
 *
 * Con un tetto secco (il primo tentativo era un clamp a 3 unità) un lungo da
 * 18 km e un lento da 10 finivano a pari punteggio, perché entrambi lo
 * sfondavano — e la pagina diceva che uscire un'ora e mezza o cinquanta minuti
 * è la stessa cosa. Una curva sublineare satura senza appiattire: due ore
 * valgono ~1,6 volte un'ora, non il doppio e non uguale.
 */
const CHARGE_EXP = 0.65;

/** Carica di una seduta, prima del moltiplicatore: durata × durezza della zona. */
export function chargeOf(minutes: number, zone: ZoneId): number {
  return Math.pow(Math.max(0.35, minutes / CHARGE_UNIT), CHARGE_EXP) * ZONE_CHARGE[zone];
}

const isHardZone = (z: ZoneId) => z === "threshold" || z === "vo2";

/**
 * La finestra: quanto rende una seduta dato il tempo passato dall'ultima e la
 * durezza di quella. Numeri scelti sulla logica dell'allenamento, non a caso —
 * 48 ore dopo una seduta dura sei nel punto migliore per la prossima.
 */
export function windowFactor(gapDays: number, lastWasHard: boolean, nextIsHard: boolean): number {
  if (gapDays <= 0) return 0.55;                        // doppia seduta nello stesso giorno
  if (lastWasHard && nextIsHard) {
    return gapDays === 1 ? 0.70 : gapDays === 2 ? 1.18 : gapDays === 3 ? 1.10 : gapDays <= 5 ? 0.98 : 0.88;
  }
  if (lastWasHard) {                                     // seduta facile dopo una dura: scarico
    return gapDays === 1 ? 1.12 : gapDays === 2 ? 1.02 : 0.94;
  }
  if (nextIsHard) {                                      // dura dopo una facile
    return gapDays === 1 ? 1.05 : gapDays === 2 ? 1.10 : gapDays <= 4 ? 1.0 : 0.9;
  }
  return gapDays === 1 ? 1.04 : gapDays === 2 ? 0.98 : 0.9;
}

export const multiplierOf = (momentum: number, win: number) =>
  Math.round((1 + (momentum / MOM_MAX) * MOM_MULT_SPAN) * win * 100) / 100;

// ── STAGIONE ──────────────────────────────────────────────────────────────────
export const SEASON_WEEKS = 13;
const SEASON_DAYS = SEASON_WEEKS * 7;
/** Lunedì 5 gennaio 2026 — l'ancora fissa da cui si contano le stagioni. */
const SEASON_EPOCH = dayIndex("2026-01-05");

export interface Chapter { n: number; name: string; sp: number; reward: string; meaning: string }
export const CHAPTERS: Chapter[] = [
  { n: 1, name: "Accensione", sp: 120,
    reward: "La stagione è partita davvero.",
    meaning: "Due settimane senza saltare: il motore è acceso, il resto viene da sé." },
  { n: 2, name: "Ritmo Preso", sp: 340,
    reward: "Il momentum non torna più a zero fra una settimana e l'altra.",
    meaning: "Le uscite non sono più episodi isolati: c'è una settimana tipo." },
  { n: 3, name: "Blocco Solido", sp: 640,
    reward: "Puoi permetterti una qualità a settimana senza pagarla.",
    meaning: "Metà stagione fatta bene. Da qui i miglioramenti si vedono sul cronometro." },
  { n: 4, name: "Carico Pieno", sp: 1000,
    reward: "Il corpo regge il volume che serve per migliorare sul serio.",
    meaning: "È il punto in cui una preparazione smette di essere 'correre' e diventa allenarsi." },
  { n: 5, name: "Forma", sp: 1420,
    reward: "Arrivi alla gara con una preparazione vera dietro.",
    meaning: "Stagione riuscita. Il 90% di chi corre non arriva qui." },
  { n: 6, name: "Picco", sp: 1900,
    reward: "Tutto quello che si poteva estrarre da tredici settimane.",
    meaning: "Stagione da manuale: niente buchi, niente sedute buttate." },
];

// ── TIPI ──────────────────────────────────────────────────────────────────────
export interface MomentumPoint { day: number; momentum: number; ran: boolean; sp: number }

export interface BankedRun {
  id: string; date: string; day: number; name: string;
  km: number; minutes: number; zone: ZoneDef;
  gap: number; charge: number; win: number; mult: number; sp: number;
  /** Frase pronta sul TIMING, non sul contenuto. */
  timing: string;
}

/** Una cella della griglia: seduta × giorno. */
export interface Slot { dayOffset: number; sessionId: string; mult: number; sp: number; momentum: number }
export interface SessionSpec { id: string; label: string; detail: string; zone: ZoneDef; minutes: number; hard: boolean }

export interface MomentumState {
  ok: boolean;
  momentum: number;
  /** Moltiplicatore che avresti uscendo OGGI con una seduta media. */
  multiplierNow: number;
  daysSinceLastRun: number;
  lastWasHard: boolean;
  /** Fra quanti giorni il momentum tocca zero se non esci più. */
  zeroIn: number;
  streakDays: number;
  /** Settimane consecutive con almeno 3 uscite. */
  streakWeeks: number;

  seasonStart: number; seasonEnd: number; daysLeft: number; seasonPct: number;
  sp: number; spPerWeek: number;
  chapter: Chapter | null; nextChapter: Chapter | null; toNext: number;
  /** Data stimata del prossimo capitolo — null se il ritmo non basta. */
  etaIso: string | null; etaInSeason: boolean;
  /** Dove arrivi a fine stagione se tieni questo ritmo. */
  projectedSp: number; projectedChapter: Chapter | null;

  history: MomentumPoint[];
  banked: BankedRun[];
  sessions: SessionSpec[];
  grid: Slot[];
  /** La casella migliore dei prossimi 7 giorni. */
  best: Slot | null;
  days: { offset: number; iso: string; label: string; momentum: number }[];
}

const EMPTY: MomentumState = {
  ok: false, momentum: 0, multiplierNow: 1, daysSinceLastRun: 0, lastWasHard: false, zeroIn: 0,
  streakDays: 0, streakWeeks: 0, seasonStart: 0, seasonEnd: 0, daysLeft: 0, seasonPct: 0,
  sp: 0, spPerWeek: 0, chapter: null, nextChapter: CHAPTERS[0], toNext: CHAPTERS[0].sp,
  etaIso: null, etaInSeason: false, projectedSp: 0, projectedChapter: null,
  history: [], banked: [], sessions: [], grid: [], best: null, days: [],
};

const DOW = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

export function buildMomentum(runsIn: Run[], todayIso: string = new Date().toISOString()): MomentumState {
  // una seduta per giorno: se Strava spezza l'allenamento in tre attività, il
  // "buco" fra loro non è riposo e non deve entrare nel calcolo della finestra
  const log = daySessions(runsIn);
  if (log.length < 3) return EMPTY;

  const bestPace = bestSustainedPaceSec(runsIn);
  const lastRunDay = log[log.length - 1].day;
  const today = Math.max(dayIndex(todayIso), lastRunDay);

  const seasonStart = SEASON_EPOCH + Math.floor((today - SEASON_EPOCH) / SEASON_DAYS) * SEASON_DAYS;
  const seasonEnd = seasonStart + SEASON_DAYS - 1;

  const byDay = new Map<number, DaySession>();
  for (const s of log) byDay.set(s.day, s);

  // ── la simulazione: momentum giorno per giorno, SP banchettati a ogni seduta ──
  const firstDay = log[0].day;
  let momentum = 0;
  let prevRunDay = -Infinity;
  let prevHard = false;
  let sp = 0;
  const banked: BankedRun[] = [];
  const history: MomentumPoint[] = [];

  for (let d = firstDay; d <= today; d++) {
    const s = byDay.get(d);
    let daySp = 0;
    if (s) {
      const hard = isHardZone(s.zone.id);
      const gap = prevRunDay === -Infinity ? 7 : d - prevRunDay;
      const win = windowFactor(gap, prevHard, hard);
      const charge = chargeOf(s.minutes, s.zone.id);
      const mult = multiplierOf(momentum, win);
      const gained = Math.round(charge * mult);
      if (d >= seasonStart) sp += gained;
      daySp = gained;
      momentum = Math.min(MOM_MAX, momentum + charge);
      banked.push({
        id: s.id, date: s.date, day: d, name: s.name,
        km: Math.round(s.km * 10) / 10, minutes: Math.round(s.minutes), zone: s.zone,
        gap, charge: Math.round(charge), win, mult, sp: gained,
        timing: timingWhy(gap, prevHard, hard, win),
      });
      prevHard = hard;
      prevRunDay = d;
    } else {
      momentum = Math.max(0, momentum - MOM_DECAY_PER_REST_DAY);
    }
    history.push({ day: d, momentum: Math.round(momentum), ran: !!s, sp: daySp });
  }

  const daysSince = today - prevRunDay;
  const zeroIn = Math.ceil(momentum / MOM_DECAY_PER_REST_DAY);

  // ── strisce ──
  let streakDays = 0;
  for (let d = today; d >= firstDay; d--) {
    if (byDay.has(d)) streakDays++;
    else if (d < today || daysSince > 0) break;
  }
  let streakWeeks = 0;
  for (let w = 0; w < 60; w++) {
    const end = today - ((today + 3) % 7) - w * 7;      // lunedì della settimana -w
    let days = 0;
    for (let i = 0; i < 7; i++) if (byDay.has(end + i)) days++;
    if (days >= 3) streakWeeks++;
    else if (w > 0) break;
    else if (today - end >= 6) break;                    // settimana finita e insufficiente
  }

  // ── stagione ──
  const daysInSeason = Math.max(1, today - seasonStart + 1);
  const daysLeft = Math.max(0, seasonEnd - today);
  const spPerWeek = Math.round((sp / daysInSeason) * 7);
  const chapter = [...CHAPTERS].reverse().find((c) => sp >= c.sp) ?? null;
  const nextChapter = CHAPTERS.find((c) => sp < c.sp) ?? null;
  const toNext = nextChapter ? nextChapter.sp - sp : 0;
  const daysToNext = nextChapter && spPerWeek > 0 ? Math.ceil((toNext / spPerWeek) * 7) : null;
  const projectedSp = Math.round(sp + (spPerWeek / 7) * daysLeft);
  const projectedChapter = [...CHAPTERS].reverse().find((c) => projectedSp >= c.sp) ?? null;

  // ── la griglia dei prossimi 7 giorni ──
  const sessions = buildSessions(bestPace);
  const days: MomentumState["days"] = [];
  const grid: Slot[] = [];
  for (let off = 0; off <= 6; off++) {
    const d = today + off;
    const rest = daysSince + off;
    const mAt = Math.max(0, momentum - MOM_DECAY_PER_REST_DAY * off);
    days.push({
      offset: off, iso: dayToIso(d),
      label: off === 0 ? "oggi" : off === 1 ? "domani" : DOW[(d + 3) % 7],
      momentum: Math.round(mAt),
    });
    for (const s of sessions) {
      // `rest` a zero significa che oggi hai già corso: è una seconda seduta
      // nello stesso giorno, e la finestra lo dice invece di fingere un giorno pieno
      const win = windowFactor(rest, prevHard, s.hard);
      const mult = multiplierOf(mAt, win);
      grid.push({ dayOffset: off, sessionId: s.id, mult, sp: Math.round(chargeOf(s.minutes, s.zone.id) * mult), momentum: Math.round(mAt) });
    }
  }
  const best = grid.reduce<Slot | null>((b, s) => (!b || s.sp > b.sp ? s : b), null);

  return {
    ok: true,
    momentum: Math.round(momentum),
    // stessa lettura della casella "oggi" della griglia: se hai già corso, il
    // moltiplicatore in cima è quello di una seconda seduta, non di una prima
    multiplierNow: multiplierOf(momentum, windowFactor(daysSince, prevHard, false)),
    daysSinceLastRun: daysSince, lastWasHard: prevHard, zeroIn,
    streakDays, streakWeeks,
    seasonStart, seasonEnd, daysLeft,
    seasonPct: Math.round((daysInSeason / SEASON_DAYS) * 100),
    sp, spPerWeek, chapter, nextChapter, toNext,
    etaIso: daysToNext == null ? null : dayToIso(today + daysToNext),
    etaInSeason: daysToNext != null && daysToNext <= daysLeft,
    projectedSp, projectedChapter,
    history: history.filter((h) => h.day >= today - 90),
    banked: banked.slice(-14).reverse(),
    sessions, grid, best, days,
  };
}

function buildSessions(bestPace: number | null): SessionSpec[] {
  const easy = (bestPace ?? 300) * 1.3;
  return [
    { id: "reps", label: "Ripetute", detail: "5×1000 · ~55 min", zone: ZONES.vo2, minutes: 55, hard: true },
    { id: "thr", label: "Soglia", detail: "6 km continui · ~45 min", zone: ZONES.threshold, minutes: 45, hard: true },
    { id: "long", label: "Lungo", detail: `18 km · ~${Math.round((easy * 18) / 60)} min`, zone: ZONES.easy, minutes: (easy * 18) / 60, hard: false },
    { id: "easy", label: "Lento", detail: `10 km · ~${Math.round((easy * 10) / 60)} min`, zone: ZONES.easy, minutes: (easy * 10) / 60, hard: false },
    { id: "rec", label: "Recupero", detail: `6 km · ~${Math.round((easy * 1.12 * 6) / 60)} min`, zone: ZONES.recovery, minutes: (easy * 1.12 * 6) / 60, hard: false },
  ];
}

function timingWhy(gap: number, lastHard: boolean, hard: boolean, win: number): string {
  if (gap >= 7) return `${gap} giorni dall'ultima uscita: sei ripartito da fermo.`;
  if (lastHard && hard && gap === 1) return "Duro sul duro a 24 ore: il lavoro c'era, la finestra no.";
  if (lastHard && hard && gap === 2) return "48 ore dopo una seduta dura — la finestra migliore che c'è.";
  if (lastHard && !hard && gap === 1) return "Scarico il giorno dopo la qualità: esattamente quello che serviva.";
  if (!lastHard && hard && gap === 2) return "Qualità con due giorni di aerobico dietro: gambe pronte.";
  return win >= 1.05 ? "Spaziatura giusta rispetto all'ultima seduta."
    : win >= 0.95 ? "Spaziatura neutra." : "Un po' fuori finestra: la stessa seduta, spostata, valeva di più.";
}
