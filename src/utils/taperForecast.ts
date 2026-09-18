import type { FitnessFreshnessPoint } from "../types/api";
import { PLAN_DAYS, PLAN_DAY_BY_DATE, PLAN_GOALS, type PlanDay } from "../data/mezzaOttobrePlan";

/**
 * FRESCHEZZA E TAPER — quanto sei fresco e se il piano ti porta fresco alla gara.
 *
 * Stessa matematica del backend (`_compute_fitness_freshness`): TRIMP di Lucia
 * sulle corse, CTL e ATL come medie esponenziali "a span" 42 e 7 giorni
 * (alpha 2/43 e 2/8), TSB = CTL − ATL. Così i numeri coincidono con quelli
 * della card Status di Forma.
 *
 * Tre curve:
 *   - prevista: dallo stato del backend al 16 settembre, il giorno prima della
 *     verifica del piano, più il carico stimato di ogni seduta del piano;
 *   - reale: i documenti del backend, giorno per giorno;
 *   - proiezione: dallo stato reale di oggi più il resto del piano.
 * Il confronto fra prevista e reale dice se il carico va come deve; la
 * proiezione dice dove arrivi alla vigilia con quello che hai fatto davvero.
 *
 * Il "fondo" usa invece la CTL classica a 42 giorni veri (alpha 1/42): la CTL
 * dell'app è una media di circa tre settimane e in un taper scende il doppio
 * più in fretta, ma la forma aerobica non se ne va così.
 */

export const ALPHA_CTL = 2 / 43;
export const ALPHA_ATL = 2 / 8;
const ALPHA_BASE = 1 / 42;

/** Stato del backend a fine 16 settembre (dopo il 5×1000): l'ancora della curva prevista. */
export const PLAN_ANCHOR = { date: "2026-09-16", ctl: 42.0, atl: 58.69 };

export const RACE_ISO = PLAN_GOALS[0].dateIso;
export const RACE_EVE_ISO = addDays(RACE_ISO, -1);
/** Primo giorno di scarico: da qui la TSB deve salire. */
export const TAPER_START_ISO = "2026-10-05";

/** Stesse soglie della card Status di Forma in dashboard. */
export function formOf(tsb: number): { label: string; color: string } {
  if (tsb > 10) return { label: "Fresco", color: "#C0FF00" };
  if (tsb > -5) return { label: "Neutro", color: "#14B8A6" };
  if (tsb > -20) return { label: "Affaticato", color: "#F59E0B" };
  return { label: "Sovraccarico", color: "#F43F5E" };
}

export interface LoadPoint { date: string; ctl: number; atl: number; tsb: number }

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * TRIMP stimato di una giornata del piano: km × TRIMP al km per tipo di
 * seduta, tarato sulle tue corse con la formula del backend (lento 8 km a FC
 * 132 ≈ 65, lungo 18 km con 5 a ritmo ≈ 178, 3×3000 ≈ 154, mezza ≈ 264).
 * Bici e forza restano a zero: il backend conta solo le corse.
 */
export function plannedTrimp(d: PlanDay | undefined): number {
  if (!d?.km) return 0;
  const perKm =
    d.kind === "easy" ? 8.1
      : d.kind === "long" ? (d.title.includes("ultimi") ? 9.8 : 9.0)
      : d.kind === "quality" ? 10.0
      : d.kind === "key" ? 9.8
      : d.kind === "race" ? 12.5
      : 0;
  return d.km * perKm;
}

function step(p: { ctl: number; atl: number }, load: number) {
  const ctl = p.ctl + ALPHA_CTL * (load - p.ctl);
  const atl = p.atl + ALPHA_ATL * (load - p.atl);
  return { ctl, atl };
}

/** Avanza uno stato fino a `untilIso` compreso, con il carico del piano. */
function walkPlan(from: LoadPoint, untilIso: string, loadOf: (iso: string) => number): LoadPoint[] {
  const out: LoadPoint[] = [];
  let s = { ctl: from.ctl, atl: from.atl };
  for (let iso = addDays(from.date, 1); iso <= untilIso; iso = addDays(iso, 1)) {
    s = step(s, loadOf(iso));
    out.push({ date: iso, ctl: s.ctl, atl: s.atl, tsb: s.ctl - s.atl });
  }
  return out;
}

/** La curva che il piano prevede, dal 17 settembre alla gara. */
export function plannedCurve(): LoadPoint[] {
  const anchor = { ...PLAN_ANCHOR, tsb: PLAN_ANCHOR.ctl - PLAN_ANCHOR.atl };
  return walkPlan(anchor, RACE_ISO, (iso) => plannedTrimp(PLAN_DAY_BY_DATE[iso]));
}

/**
 * La serie reale giorno per giorno. Il backend salva un documento solo nei
 * giorni di corsa, il lunedì e oggi: fra un documento e l'altro il carico è
 * zero, quindi CTL e ATL decadono e basta.
 */
export function actualDaily(docs: FitnessFreshnessPoint[], fromIso: string, untilIso: string): LoadPoint[] {
  const sorted = [...docs].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map(sorted.map((d) => [d.date.slice(0, 10), d]));
  const last = [...sorted].reverse().find((d) => d.date.slice(0, 10) < fromIso);
  let s = last ? { ctl: last.ctl, atl: last.atl } : null;
  const out: LoadPoint[] = [];
  for (let iso = last ? addDays(last.date.slice(0, 10), 1) : fromIso; iso <= untilIso; iso = addDays(iso, 1)) {
    const doc = byDate.get(iso);
    if (doc) s = { ctl: doc.ctl, atl: doc.atl };
    else if (s) s = step(s, 0);
    if (s && iso >= fromIso) out.push({ date: iso, ctl: s.ctl, atl: s.atl, tsb: s.ctl - s.atl });
  }
  return out;
}

/** CTL classica a 42 giorni sulla storia dei TRIMP, più il piano da `fromIso` in poi. */
function baseCurve(docs: FitnessFreshnessPoint[], futureLoad: (iso: string) => number, fromIso: string): LoadPoint[] {
  const trimp = new Map(docs.map((d) => [d.date.slice(0, 10), d.trimp ?? 0]));
  const first = [...trimp.keys()].sort()[0];
  if (!first) return [];
  const out: LoadPoint[] = [];
  let ctl = 0;
  for (let iso = first; iso <= RACE_EVE_ISO; iso = addDays(iso, 1)) {
    const load = iso >= fromIso ? futureLoad(iso) : trimp.get(iso) ?? 0;
    ctl += ALPHA_BASE * (load - ctl);
    out.push({ date: iso, ctl, atl: 0, tsb: 0 });
  }
  return out;
}

export type TaperPhase = "prima" | "carico" | "scarico" | "gara" | "dopo";

export interface TaperReport {
  phase: TaperPhase;
  /** Lo stato reale di adesso, lo stesso della card Status di Forma. */
  today: LoadPoint | null;
  /**
   * Il giorno su cui si confronta reale e previsto: oggi se la seduta di oggi
   * è già nel backend (o se oggi non si corre), altrimenti ieri — al mattino
   * di un lungo la curva prevista lo conta già, quella reale non ancora.
   */
  compareIso: string;
  /** Reale − prevista sulla CTL del giorno di confronto: il carico va come deve? */
  ctlDelta: number | null;
  /** Reale − prevista sulla TSB del giorno di confronto (solo informativa: salta a ogni seduta). */
  tsbDelta: number | null;
  planned: LoadPoint[];
  actual: LoadPoint[];
  projection: LoadPoint[];
  /** Vigilia secondo quello che hai fatto finora più il resto del piano. */
  eve: LoadPoint | null;
  plannedEve: LoadPoint;
  /** Fondo (CTL a 42 giorni): quanto se ne perde dal picco alla vigilia. */
  baseLossPct: number | null;
  verdict: { tone: "ok" | "warn" | "bad"; title: string; text: string };
}

export function taperReport(docs: FitnessFreshnessPoint[] | undefined, todayIso: string): TaperReport {
  const planned = plannedCurve();
  const plannedByDate = new Map(planned.map((p) => [p.date, p]));
  const plannedEve = plannedByDate.get(RACE_EVE_ISO)!;
  const start = PLAN_DAYS[0].date;

  const phase: TaperPhase =
    todayIso < start ? "prima"
      : todayIso < TAPER_START_ISO ? "carico"
      : todayIso < RACE_ISO ? "scarico"
      : todayIso === RACE_ISO ? "gara"
      : "dopo";

  const haveDocs = !!docs && docs.length > 0;
  const actualUntil = todayIso < RACE_ISO ? todayIso : RACE_ISO;
  const actual = haveDocs ? actualDaily(docs!, start, actualUntil) : [];
  const today = actual.find((p) => p.date === todayIso) ?? null;

  // la seduta di oggi conta già se il backend ha un carico per oggi
  const todayDoc = haveDocs ? docs!.find((d) => d.date.slice(0, 10) === todayIso) : undefined;
  const todayDone = !!todayDoc && (todayDoc.trimp ?? 0) > 0;
  const futureLoad = (iso: string) => plannedTrimp(PLAN_DAY_BY_DATE[iso]);
  const compareIso = todayDone || futureLoad(todayIso) === 0 ? todayIso : addDays(todayIso, -1);
  const actualCmp = actual.find((p) => p.date === compareIso);
  const plannedCmp = plannedByDate.get(compareIso);

  let projection: LoadPoint[] = [];
  if (today && todayIso < RACE_ISO) {
    const from = todayDone ? today : actual.find((p) => p.date === addDays(todayIso, -1)) ?? today;
    projection = [from, ...walkPlan(from, RACE_ISO, futureLoad)];
  }
  const eve = todayIso <= RACE_EVE_ISO
    ? projection.find((p) => p.date === RACE_EVE_ISO) ?? null
    : actual.find((p) => p.date === RACE_EVE_ISO) ?? null;

  let baseLossPct: number | null = null;
  if (haveDocs) {
    const firstFuture = todayDone ? addDays(todayIso, 1) : todayIso;
    const base = baseCurve(docs!, futureLoad, firstFuture).filter((p) => p.date >= start);
    const peak = Math.max(...base.map((p) => p.ctl));
    const atEve = base.find((p) => p.date === RACE_EVE_ISO)?.ctl;
    if (atEve && peak > 0) baseLossPct = (1 - atEve / peak) * 100;
  }

  const ctlDelta = actualCmp && plannedCmp ? actualCmp.ctl - plannedCmp.ctl : null;
  const tsbDelta = actualCmp && plannedCmp ? actualCmp.tsb - plannedCmp.tsb : null;
  return {
    phase, today, compareIso, ctlDelta, tsbDelta, planned, actual, projection, eve, plannedEve, baseLossPct,
    verdict: verdictOf(phase, ctlDelta, eve, actual),
  };
}

function signed(n: number): string {
  const r = Math.round(n);
  return r > 0 ? `+${r}` : r < 0 ? `−${-r}` : "0";
}

function verdictOf(phase: TaperPhase, ctlDelta: number | null, eve: LoadPoint | null, actual: LoadPoint[]): TaperReport["verdict"] {
  if (phase === "prima") return { tone: "ok", title: "Il piano non è ancora partito", text: "La curva prevista parte il 14 settembre." };
  if (phase === "dopo") return { tone: "ok", title: "Gara fatta", text: "Da qui in poi la curva racconta il recupero." };
  if (phase === "gara") return { tone: "ok", title: "Oggi si corre", text: "Il lavoro è fatto: parti a 4:48–4:50 in discesa e non guadagnare tempo." };
  if (!eve || ctlDelta === null) return { tone: "warn", title: "Dati in arrivo", text: "Serve lo storico di Fitness & Freschezza del backend." };

  const eveTxt = `alla vigilia arrivi a TSB ${signed(eve.tsb)}`;
  if (phase === "carico") {
    if (eve.tsb <= 10) {
      return { tone: "bad", title: "Rischi di arrivare stanco",
        text: `Con quello che hai fatto e il resto del piano ${eveTxt}, sotto +10. Non aggiungere km: se serve, togline dalle corse lente.` };
    }
    if (ctlDelta > 5) {
      return { tone: "warn", title: "Stai caricando più del piano",
        text: `La fitness è ${Math.round(ctlDelta)} punti sopra la curva prevista: più km o più ritmo del previsto. Per ora ${eveTxt}, ma non aggiungere altro.` };
    }
    if (ctlDelta < -5) {
      return { tone: "warn", title: "Stai caricando meno del piano",
        text: `La fitness è ${Math.round(-ctlDelta)} punti sotto la curva prevista: arrivi fresco (${eveTxt}) ma con meno fondo. Non recuperare i km persi tutti insieme.` };
    }
    return { tone: "ok", title: "In linea con il piano",
      text: `Il carico va come previsto: ${eveTxt}, sopra la soglia di "Fresco".` };
  }

  // scarico: il taper funziona se la TSB sale e la vigilia supera +10
  const last = actual.slice(-4);
  const rising = last.length >= 2 && last[last.length - 1].tsb > last[0].tsb;
  if (eve.tsb > 10) {
    return { tone: "ok", title: rising ? "Il taper sta funzionando" : "Il taper regge",
      text: `${rising ? "La TSB sale" : "La TSB oscilla dopo le ultime sedute"}: ${eveTxt}, sopra la soglia di "Fresco".` };
  }
  return { tone: "bad", title: "Troppa fatica per la gara",
    text: `Con il resto del piano ${eveTxt}, sotto +10. Togli km nei prossimi giorni, non intensità.` };
}
