import type { Run } from "../../types/api";

/**
 * Valutatore badge (lato frontend). Modello "forward-only / no storico":
 * - alla prima attivazione si congela la baseline (gli id di tutte le corse
 *   esistenti) → quelle corse non sbloccano nulla;
 * - a ogni sync si valutano SOLO le corse nuove (post-attivazione);
 * - i badge PB confrontano col record pre-attivazione; i cumulativi col totale
 *   reale (sbloccano solo se la soglia viene superata in avanti).
 *
 * I criteri esistono solo per i badge rilevabili con certezza dai dati. Gli
 * altri non hanno regola → non scattano in automatico (restano "da sbloccare").
 */

// Campi extra presenti nel payload ma non nel tipo Run base.
type RunX = Run & {
  best_400m_sec?: number | null;
  best_800m_sec?: number | null;
  best_1000m_sec?: number | null;
  best_2000m_sec?: number | null;
  best_3000m_sec?: number | null;
  humidity?: number | null;
  garmin_calories?: number | null;
};

export interface Metrics {
  best1k: number | null;   // sec (best_1000m_sec)
  best2k: number | null;
  best3k: number | null;
  best400: number | null;
  best800: number | null;
  best5k: number | null;   // sec (pace*5 su corse 4.5–5.5 km)
  best10k: number | null;  // sec (pace*10 su corse 9–11 km)
  bestHalf: number | null; // sec (pace*21.097 su corse 20.5–22 km)
  maxCadence: number | null;
  minGct: number | null;
  maxStride: number | null;
  maxTemp: number | null;
  minTemp: number | null;
  maxHumidity: number | null;
  maxElev: number | null;       // dislivello max in una corsa
  maxCalories: number | null;
  totalKm: number;
  totalRuns: number;
  weeklyMaxKm: number;
  monthlyMaxKm: number;
  monthlyMaxMin: number;        // minuti totali nel mese più carico
  maxDayKm: number;
  longestRunKm: number;
  maxStreak: number;            // giorni consecutivi
  hasDoubleDay: boolean;
  hasSundayLong: boolean;       // domenica ≥16 km
  hasNewYearRun: boolean;       // corsa il 01/01
  hasComeback: boolean;         // ritorno dopo >30 giorni di stop
}

export interface BadgeCtx {
  base: Metrics;
  post: Metrics;
  all: Metrics;
}

const paceToSec = (p?: string | null): number | null => {
  if (!p) return null;
  const m = p.split(":");
  if (m.length < 2) return null;
  const s = parseInt(m[0], 10) * 60 + parseInt(m[1], 10);
  return s > 0 ? s : null;
};
const minN = (a: number | null, b: number | null) =>
  a == null ? b : b == null ? a : Math.min(a, b);
const maxN = (a: number | null, b: number | null) =>
  a == null ? b : b == null ? a : Math.max(a, b);
const dayKey = (d: string) => d.slice(0, 10);
const monthKey = (d: string) => d.slice(0, 7);
/** Chiave settimana ISO (lunedì) */
const weekKey = (d: string): string => {
  const dt = new Date(d.slice(0, 10) + "T00:00:00Z");
  const day = (dt.getUTCDay() + 6) % 7; // 0 = lunedì
  dt.setUTCDate(dt.getUTCDate() - day);
  return dt.toISOString().slice(0, 10);
};
const weekday = (d: string) => new Date(d.slice(0, 10) + "T00:00:00Z").getUTCDay(); // 0=Dom

export function buildMetrics(runsIn: Run[]): Metrics {
  const runs = runsIn as RunX[];
  const m: Metrics = {
    best1k: null, best2k: null, best3k: null, best400: null, best800: null,
    best5k: null, best10k: null, bestHalf: null,
    maxCadence: null, minGct: null, maxStride: null,
    maxTemp: null, minTemp: null, maxHumidity: null, maxElev: null, maxCalories: null,
    totalKm: 0, totalRuns: runs.length, weeklyMaxKm: 0, monthlyMaxKm: 0, monthlyMaxMin: 0,
    maxDayKm: 0, longestRunKm: 0, maxStreak: 0,
    hasDoubleDay: false, hasSundayLong: false, hasNewYearRun: false, hasComeback: false,
  };

  const byWeek: Record<string, number> = {};
  const byMonthKm: Record<string, number> = {};
  const byMonthMin: Record<string, number> = {};
  const byDayKm: Record<string, number> = {};
  const byDayCount: Record<string, number> = {};

  for (const r of runs) {
    const dist = r.distance_km || 0;
    m.totalKm += dist;
    m.longestRunKm = Math.max(m.longestRunKm, dist);
    m.best1k = minN(m.best1k, r.best_1000m_sec ?? null);
    m.best2k = minN(m.best2k, r.best_2000m_sec ?? null);
    m.best3k = minN(m.best3k, r.best_3000m_sec ?? null);
    m.best400 = minN(m.best400, r.best_400m_sec ?? null);
    m.best800 = minN(m.best800, r.best_800m_sec ?? null);
    m.maxCadence = maxN(m.maxCadence, r.avg_cadence ?? r.avg_cadence_spm ?? null);
    m.minGct = minN(m.minGct, r.avg_ground_contact_time ?? null);
    m.maxStride = maxN(m.maxStride, r.avg_stride_length ?? null);
    m.maxTemp = maxN(m.maxTemp, r.temperature ?? null);
    m.minTemp = minN(m.minTemp, r.temperature ?? null);
    m.maxHumidity = maxN(m.maxHumidity, r.humidity ?? null);
    m.maxElev = maxN(m.maxElev, r.elevation_gain ?? null);
    m.maxCalories = maxN(m.maxCalories, r.garmin_calories ?? null);

    const ps = paceToSec(r.avg_pace);
    if (ps) {
      if (dist >= 4.5 && dist <= 5.5) m.best5k = minN(m.best5k, ps * 5);
      if (dist >= 9 && dist <= 11) m.best10k = minN(m.best10k, ps * 10);
      if (dist >= 20.5 && dist <= 22) m.bestHalf = minN(m.bestHalf, ps * 21.097);
    }
    if (dist >= 16 && weekday(r.date) === 0) m.hasSundayLong = true;
    if (r.date.slice(5, 10) === "01-01") m.hasNewYearRun = true;

    const wk = weekKey(r.date); byWeek[wk] = (byWeek[wk] || 0) + dist;
    const mo = monthKey(r.date);
    byMonthKm[mo] = (byMonthKm[mo] || 0) + dist;
    byMonthMin[mo] = (byMonthMin[mo] || 0) + (r.duration_minutes || 0);
    const dk = dayKey(r.date);
    byDayKm[dk] = (byDayKm[dk] || 0) + dist;
    byDayCount[dk] = (byDayCount[dk] || 0) + 1;
  }

  m.weeklyMaxKm = Math.max(0, ...Object.values(byWeek));
  m.monthlyMaxKm = Math.max(0, ...Object.values(byMonthKm));
  m.monthlyMaxMin = Math.max(0, ...Object.values(byMonthMin));
  m.maxDayKm = Math.max(0, ...Object.values(byDayKm));
  m.hasDoubleDay = Object.values(byDayCount).some((c) => c >= 2);

  // Streak: giorni consecutivi
  const days = Object.keys(byDayCount).sort();
  let streak = 0, best = 0, prev: number | null = null;
  for (const d of days) {
    const t = new Date(d + "T00:00:00Z").getTime() / 86400000;
    streak = prev != null && t - prev === 1 ? streak + 1 : 1;
    best = Math.max(best, streak);
    prev = t;
  }
  m.maxStreak = best;

  // Comeback: ritorno dopo >30 giorni di stop
  for (let i = 1; i < days.length; i++) {
    const a = new Date(days[i - 1] + "T00:00:00Z").getTime();
    const b = new Date(days[i] + "T00:00:00Z").getTime();
    if ((b - a) / 86400000 > 30) { m.hasComeback = true; break; }
  }

  return m;
}

export function buildBadgeContext(runs: Run[], baselineRunIds: string[]): BadgeCtx {
  const baseSet = new Set(baselineRunIds);
  const baseRuns = runs.filter((r) => baseSet.has(r.id));
  const postRuns = runs.filter((r) => !baseSet.has(r.id));
  return { base: buildMetrics(baseRuns), post: buildMetrics(postRuns), all: buildMetrics(runs) };
}

// PB: la corsa nuova batte il record pre-attivazione (o non c'era record prima)
const beats = (post: number | null, base: number | null) =>
  post != null && (base == null || post < base);
const exceeds = (post: number | null, base: number | null) =>
  post != null && (base == null || post > base);
// Cumulativo: soglia superata in avanti (non già passata in baseline)
const crossed = (all: number, base: number, t: number) => all >= t && base < t;

// Soglie "nuove": raggiunte nelle corse nuove E non già raggiunte in baseline.
const underT = (v: number | null, t: number) => v != null && v < t;
const overT = (v: number | null, t: number) => v != null && v >= t;
const newUnder = (post: number | null, base: number | null, t: number) => underT(post, t) && !underT(base, t);
const newOver = (post: number | null, base: number | null, t: number) => overT(post, t) && !overT(base, t);
const newFlag = (p: boolean, b: boolean) => p && !b;
const newStreak = (post: number, base: number, n: number) => post >= n && base < n;

export type BadgeRule = (c: BadgeCtx) => boolean;

/**
 * Criteri di sblocco. Solo i badge presenti qui scattano in automatico.
 * I PB confrontano post↔base; le soglie usano newUnder/newOver (non ri-scattano
 * se già padroneggiate in baseline). Nota: best_Xm_sec è PACE (sec/km).
 */
export const BADGE_RULES: Record<string, BadgeRule> = {
  // ── CLASSICI ──
  "best-1k": (c) => beats(c.post.best1k, c.base.best1k),
  "longest-run": (c) => c.post.longestRunKm > c.base.longestRunKm && c.post.longestRunKm > 0,
  "best-cadence": (c) => exceeds(c.post.maxCadence, c.base.maxCadence),
  "best-5k": (c) => beats(c.post.best5k, c.base.best5k),
  "best-10k": (c) => beats(c.post.best10k, c.base.best10k),
  "elevation-record": (c) => exceeds(c.post.maxElev, c.base.maxElev) && (c.post.maxElev ?? 0) > 0,
  "streak": (c) => newStreak(c.post.maxStreak, c.base.maxStreak, 14),
  "weekly-volume": (c) => c.post.weeklyMaxKm > c.base.weeklyMaxKm && c.post.weeklyMaxKm > 0,

  // ── VOLUME ──
  "week-60k": (c) => c.post.weeklyMaxKm >= 60 && c.base.weeklyMaxKm < 60,
  "first-30k": (c) => c.post.longestRunKm >= 30 && c.base.longestRunKm < 30,
  "month-100k": (c) => c.post.monthlyMaxKm >= 100 && c.base.monthlyMaxKm < 100,
  "total-1000k": (c) => crossed(c.all.totalKm, c.base.totalKm, 1000),
  "first-half": (c) => c.post.longestRunKm >= 21 && c.base.longestRunKm < 21,
  "first-marathon": (c) => c.post.longestRunKm >= 42 && c.base.longestRunKm < 42,
  "runs-50": (c) => crossed(c.all.totalRuns, c.base.totalRuns, 50),
  "double-day": (c) => newFlag(c.post.hasDoubleDay, c.base.hasDoubleDay),
  "month-10h": (c) => c.post.monthlyMaxMin >= 600 && c.base.monthlyMaxMin < 600,
  "day-record": (c) => c.post.maxDayKm > c.base.maxDayKm && c.post.maxDayKm > 0,
  "week-80k": (c) => c.post.weeklyMaxKm >= 80 && c.base.weeklyMaxKm < 80,
  "month-200k": (c) => c.post.monthlyMaxKm >= 200 && c.base.monthlyMaxKm < 200,
  "total-2000k": (c) => crossed(c.all.totalKm, c.base.totalKm, 2000),
  "runs-100": (c) => crossed(c.all.totalRuns, c.base.totalRuns, 100),
  "runs-250": (c) => crossed(c.all.totalRuns, c.base.totalRuns, 250),
  "sunday-long": (c) => newFlag(c.post.hasSundayLong, c.base.hasSundayLong),
  "month-20h": (c) => c.post.monthlyMaxMin >= 1200 && c.base.monthlyMaxMin < 1200,
  "cal-1000": (c) => newOver(c.post.maxCalories, c.base.maxCalories, 1000),

  // ── VELOCITÀ ── (best_Xm_sec = pace sec/km)
  "400-sub3": (c) => newUnder(c.post.best400, c.base.best400, 180),       // 3:00/km su 400 m
  "sub-4": (c) => newUnder(c.post.best1k, c.base.best1k, 240),            // 4:00/km sul 1000 m
  "pb-2k": (c) => beats(c.post.best2k, c.base.best2k),
  "pb-800": (c) => beats(c.post.best800, c.base.best800),
  "pb-3k": (c) => beats(c.post.best3k, c.base.best3k),

  // ── FISIOLOGIA ──
  "gct-200": (c) => newUnder(c.post.minGct, c.base.minGct, 200),
  "stride-record": (c) => exceeds(c.post.maxStride, c.base.maxStride),

  // ── COSTANZA ──
  "streak-7": (c) => newStreak(c.post.maxStreak, c.base.maxStreak, 7),
  "streak-30": (c) => newStreak(c.post.maxStreak, c.base.maxStreak, 30),
  "streak-100": (c) => newStreak(c.post.maxStreak, c.base.maxStreak, 100),
  "streak-365": (c) => newStreak(c.post.maxStreak, c.base.maxStreak, 365),
  "freezing-run": (c) => (c.post.minTemp != null && c.post.minTemp <= 0) && !(c.base.minTemp != null && c.base.minTemp <= 0),
  "heat-run": (c) => newOver(c.post.maxTemp, c.base.maxTemp, 30),
  "heat-record-32": (c) => newOver(c.post.maxTemp, c.base.maxTemp, 32),
  "humid-run": (c) => newOver(c.post.maxHumidity, c.base.maxHumidity, 90),
  "new-year-run": (c) => newFlag(c.post.hasNewYearRun, c.base.hasNewYearRun),

  // ── GARE ──
  "sub50-10k": (c) => newUnder(c.post.best10k, c.base.best10k, 3000),
  "sub2-half": (c) => newUnder(c.post.bestHalf, c.base.bestHalf, 7200),
  "pb-half": (c) => beats(c.post.bestHalf, c.base.bestHalf),
  "sub20-5k": (c) => newUnder(c.post.best5k, c.base.best5k, 1200),
  "sub25-5k": (c) => newUnder(c.post.best5k, c.base.best5k, 1500),
  "sub40-10k": (c) => newUnder(c.post.best10k, c.base.best10k, 2400),
  "10k-minus1": (c) => c.post.best10k != null && c.base.best10k != null && c.base.best10k - c.post.best10k > 60,
  "comeback": (c) => newFlag(c.post.hasComeback, c.base.hasComeback),
};

/** Id dei badge attualmente soddisfatti (solo quelli con regola). */
export function evaluateMet(runs: Run[], baselineRunIds: string[]): string[] {
  const c = buildBadgeContext(runs, baselineRunIds);
  return Object.entries(BADGE_RULES)
    .filter(([, rule]) => {
      try { return rule(c); } catch { return false; }
    })
    .map(([id]) => id);
}

/** True se il badge ha un criterio automatico. */
export const isAutoDetectable = (id: string) => id in BADGE_RULES;
