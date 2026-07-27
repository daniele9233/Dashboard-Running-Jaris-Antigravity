import type { Run } from "../../types/api";
import { computeDrift } from "../../utils/cardiacDrift";

/**
 * Valutatore badge (lato frontend).
 *
 * Due famiglie di criteri, valutate a ogni sync:
 *
 * - **Obiettivi** (soglie, conteggi, condizioni): guardano TUTTO lo storico.
 *   Se il traguardo è raggiunto il badge si sblocca, anche se il merito è di
 *   una corsa vecchia. È quello che ci si aspetta da un obiettivo: o l'hai
 *   fatto o no.
 * - **Record** (PB): confrontano le corse nuove con il meglio di prima. Per
 *   definizione scattano solo quando il primato cade, quindi restano
 *   forward-only.
 *
 * Ogni criterio usa solo dati realmente presenti nel payload delle corse
 * (best effort, laps, splits, meteo, biomeccanica). Niente regole appese a
 * campi che non esistono: un badge che non può scattare è un badge morto.
 */

// Campi extra presenti nel payload ma non nel tipo Run base.
type RunX = Run & {
  best_400m_sec?: number | null;
  best_600m_sec?: number | null;
  best_800m_sec?: number | null;
  best_1000m_sec?: number | null;
  best_2000m_sec?: number | null;
  best_3000m_sec?: number | null;
  humidity?: number | null;
  garmin_calories?: number | null;
};

export interface Metrics {
  // ── Best effort (pace sec/km sul tratto) ──
  best400: number | null;
  best600: number | null;
  best800: number | null;
  best1k: number | null;
  best2k: number | null;
  best3k: number | null;
  // ── Tempi equivalenti (sec) su corse della giusta distanza ──
  best5k: number | null;
  best10k: number | null;
  bestHalf: number | null;
  third5k: number | null;        // 3° miglior 5k: serve al "podio personale"
  vdot: number | null;
  // ── Giri dell'orologio ──
  bestLap200: number | null;     // tempo del miglior giro ~200 m
  bestLap1000: number | null;    // tempo del miglior giro ~1000 m
  bestMile: number | null;       // 4 giri consecutivi ≈ 1600 m
  maxLapSpeedKmh: number | null; // punta su un giro ≥200 m
  maxLaps400: number;            // ripetute da ~400 m nella stessa seduta
  maxReps800: number;            // ripetute ≥750 m nella stessa seduta
  intervalSessions: number;
  maxTempoMin: number | null;    // durata della tempo/soglia più lunga
  maxHrDrop: number | null;      // calo FC tra ripetuta e recupero
  // ── Splits ──
  hasNegativeSplit: boolean;
  hasEvenSplits: boolean;
  hasProgression: boolean;
  hasFastFinish: boolean;
  hasSteadyHeart: boolean;
  minDrift: number | null;       // deriva cardiaca minima (%)
  maxClimbKm: number;            // salita continua più lunga
  // ── Biomeccanica e cuore ──
  maxCadence: number | null;
  minGct: number | null;
  maxStride: number | null;
  minVo: number | null;
  maxHr: number | null;
  bestZ2Pace: number | null;     // passo più veloce con FC in Z2
  minLongHr: number | null;      // FC media più bassa su un lungo veloce
  maxEfficiency: number | null;  // m/min per bpm
  bestPace8k: number | null;     // miglior passo su corse ≥8 km
  top5Pace8k: number | null;     // 5° miglior passo su corse ≥8 km
  // ── Meteo ──
  maxTemp: number | null;
  minTemp: number | null;
  maxHumidity: number | null;
  hasWet: boolean;               // asfalto bagnato: ≥95% umidità, 8–16°C
  hasFog: boolean;               // nebbia: ≥95% umidità sotto gli 8°C
  // ── Volume ──
  totalKm: number;
  totalRuns: number;
  weeklyMaxKm: number;
  monthlyMaxKm: number;
  monthlyMaxMin: number;
  yearMaxKm: number;
  maxDayKm: number;
  longestRunKm: number;
  maxElev: number | null;
  maxElevPerKm: number | null;
  maxCalories: number | null;
  treadmillMaxKm: number;
  // ── Costanza ──
  maxStreak: number;             // giorni consecutivi
  maxWeekStreak: number;         // settimane consecutive con almeno una corsa
  maxWeeks30k: number;           // settimane consecutive da ≥30 km
  maxMonthDays: number;          // giorni corsi nel mese più pieno
  maxRuns30d: number;            // corse in 30 giorni
  maxDays365: number;            // giorni corsi in 365
  maxWeekendMonth: number;       // weekend coperti nel mese migliore
  maxWeekDays: number;           // giorni distinti nella settimana più piena
  hasDoubleDay: boolean;
  hasSundayLong: boolean;
  hasNewYearRun: boolean;
  hasChristmasRun: boolean;
  hasComeback: boolean;
  earlyRuns: number;             // partenze prima delle 7:00
  hasDawnRun: boolean;           // partenza prima delle 6:00
  hasNightRun: boolean;          // partenza dalle 20:00
  locations: number;
  // ── Prove cronometrate (≥5 km sotto 4:30/km) ──
  timeTrials: number;
  maxTimeTrialsMonth: number;
  // ── Storia dei record ──
  maxPbMonth: number;            // record caduti nel mese più prolifico
  hasTwoMonthPr: boolean;        // PB su 5k/10k in due mesi di fila
  hasPbThisYear: boolean;
}

export interface BadgeCtx {
  base: Metrics;
  post: Metrics;
  all: Metrics;
}

/* ── helper ─────────────────────────────────────────────────────────────── */

const paceToSec = (p?: string | null): number | null => {
  if (!p) return null;
  const m = String(p).split(":");
  if (m.length < 2) return null;
  const s = parseInt(m[0], 10) * 60 + parseInt(m[1], 10);
  return Number.isFinite(s) && s > 0 ? s : null;
};
const minN = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : Math.min(a, b));
const maxN = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : Math.max(a, b));
const dayKey = (d: string) => d.slice(0, 10);
const monthKey = (d: string) => d.slice(0, 7);
const yearKey = (d: string) => d.slice(0, 4);
/** Chiave settimana ISO (lunedì) */
const weekKey = (d: string): string => {
  const dt = new Date(d.slice(0, 10) + "T00:00:00Z");
  const day = (dt.getUTCDay() + 6) % 7; // 0 = lunedì
  dt.setUTCDate(dt.getUTCDate() - day);
  return dt.toISOString().slice(0, 10);
};
const weekday = (d: string) => new Date(d.slice(0, 10) + "T00:00:00Z").getUTCDay(); // 0=Dom
const dayNum = (d: string) => new Date(d.slice(0, 10) + "T00:00:00Z").getTime() / 86400000;
const weekNum = (w: string) => new Date(w + "T00:00:00Z").getTime() / 604800000;
/** Ora locale di partenza; null se l'orologio non l'ha mandata. */
const startHour = (r: Run): number | null => {
  const s = r.start_date_local;
  if (!s || s.length < 13) return null;
  const h = parseInt(s.slice(11, 13), 10);
  return Number.isFinite(h) ? h : null;
};
const near = (v: number, target: number, tol: number) => Math.abs(v - target) <= tol;

/** VDOT di Daniels dal tempo su una distanza (formula standard). */
export function vdotFrom(distM: number, timeSec: number): number | null {
  if (!(distM > 0) || !(timeSec > 0)) return null;
  const t = timeSec / 60;
  const v = distM / t;
  const pct = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
  const out = vo2 / pct;
  return Number.isFinite(out) && out > 0 ? out : null;
}

/** Il più lungo blocco di settimane consecutive che supera il filtro. */
function longestWeekRun(weeks: string[], keep: (w: string) => boolean): number {
  const ks = weeks.filter(keep).sort();
  let cur = 0, best = 0, prev: number | null = null;
  for (const k of ks) {
    const n = weekNum(k);
    cur = prev != null && n - prev === 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = n;
  }
  return best;
}

/* ── metriche ───────────────────────────────────────────────────────────── */

function emptyMetrics(): Metrics {
  return {
    best400: null, best600: null, best800: null, best1k: null, best2k: null, best3k: null,
    best5k: null, best10k: null, bestHalf: null, third5k: null, vdot: null,
    bestLap200: null, bestLap1000: null, bestMile: null, maxLapSpeedKmh: null,
    maxLaps400: 0, maxReps800: 0, intervalSessions: 0, maxTempoMin: null, maxHrDrop: null,
    hasNegativeSplit: false, hasEvenSplits: false, hasProgression: false,
    hasFastFinish: false, hasSteadyHeart: false, minDrift: null, maxClimbKm: 0,
    maxCadence: null, minGct: null, maxStride: null, minVo: null, maxHr: null,
    bestZ2Pace: null, minLongHr: null, maxEfficiency: null, bestPace8k: null, top5Pace8k: null,
    maxTemp: null, minTemp: null, maxHumidity: null, hasWet: false, hasFog: false,
    totalKm: 0, totalRuns: 0, weeklyMaxKm: 0, monthlyMaxKm: 0, monthlyMaxMin: 0,
    yearMaxKm: 0, maxDayKm: 0, longestRunKm: 0, maxElev: null, maxElevPerKm: null,
    maxCalories: null, treadmillMaxKm: 0,
    maxStreak: 0, maxWeekStreak: 0, maxWeeks30k: 0, maxMonthDays: 0, maxRuns30d: 0,
    maxDays365: 0, maxWeekendMonth: 0, maxWeekDays: 0,
    hasDoubleDay: false, hasSundayLong: false, hasNewYearRun: false,
    hasChristmasRun: false, hasComeback: false,
    earlyRuns: 0, hasDawnRun: false, hasNightRun: false, locations: 0,
    timeTrials: 0, maxTimeTrialsMonth: 0,
    maxPbMonth: 0, hasTwoMonthPr: false, hasPbThisYear: false,
  };
}

/**
 * Scarta le attività spazzatura: avvii per sbaglio e glitch GPS che Strava
 * salva comunque (0,01 km in 4 secondi). Sono ~130 sulle 540 dell'atleta e
 * falserebbero conteggi, streak e doppiette.
 */
const isRealRun = (r: Run) => (r.distance_km || 0) >= 0.5 && (r.duration_minutes || 0) >= 3;

export function buildMetrics(runsIn: Run[]): Metrics {
  const runs = runsIn.filter(isRealRun) as RunX[];
  const m = emptyMetrics();
  m.totalRuns = runs.length;
  if (!runs.length) return m;

  const byWeek: Record<string, number> = {};
  const byMonthKm: Record<string, number> = {};
  const byMonthMin: Record<string, number> = {};
  const byYearKm: Record<string, number> = {};
  const byDayKm: Record<string, number> = {};
  const byDayCount: Record<string, number> = {};
  const daysByMonth: Record<string, Set<string>> = {};
  const daysByWeek: Record<string, Set<string>> = {};
  const weekendWeeksByMonth: Record<string, Set<string>> = {};
  const ttByMonth: Record<string, number> = {};
  const locations = new Set<string>();
  const fiveKTimes: number[] = [];
  const pace8k: number[] = [];

  for (const r of runs) {
    const dist = r.distance_km || 0;
    const ps = paceToSec(r.avg_pace);
    m.totalKm += dist;
    m.longestRunKm = Math.max(m.longestRunKm, dist);

    // best effort (pace sec/km)
    m.best400 = minN(m.best400, r.best_400m_sec ?? null);
    m.best600 = minN(m.best600, r.best_600m_sec ?? null);
    m.best800 = minN(m.best800, r.best_800m_sec ?? null);
    m.best1k = minN(m.best1k, r.best_1000m_sec ?? null);
    m.best2k = minN(m.best2k, r.best_2000m_sec ?? null);
    m.best3k = minN(m.best3k, r.best_3000m_sec ?? null);

    // biomeccanica / cuore
    m.maxCadence = maxN(m.maxCadence, r.avg_cadence ?? r.avg_cadence_spm ?? null);
    m.minGct = minN(m.minGct, r.avg_ground_contact_time ?? null);
    m.maxStride = maxN(m.maxStride, r.avg_stride_length ?? null);
    m.minVo = minN(m.minVo, r.avg_vertical_oscillation ?? null);
    m.maxHr = maxN(m.maxHr, r.max_hr ?? null);

    // meteo
    m.maxTemp = maxN(m.maxTemp, r.temperature ?? null);
    m.minTemp = minN(m.minTemp, r.temperature ?? null);
    m.maxHumidity = maxN(m.maxHumidity, r.humidity ?? null);
    if (r.temperature != null && r.humidity != null && r.humidity >= 95) {
      if (r.temperature <= 8) m.hasFog = true;
      else if (r.temperature <= 16) m.hasWet = true;
    }

    // volume
    m.maxElev = maxN(m.maxElev, r.elevation_gain ?? null);
    if (dist >= 5 && r.elevation_gain != null) {
      m.maxElevPerKm = maxN(m.maxElevPerKm, r.elevation_gain / dist);
    }
    m.maxCalories = maxN(m.maxCalories, r.garmin_calories ?? null);
    if (r.is_treadmill) m.treadmillMaxKm = Math.max(m.treadmillMaxKm, dist);
    if (r.location) locations.add(r.location);

    // tempi equivalenti sulle distanze classiche
    if (ps) {
      if (dist >= 4.5 && dist <= 5.5) { m.best5k = minN(m.best5k, ps * 5); fiveKTimes.push(ps * 5); }
      if (dist >= 9 && dist <= 11) m.best10k = minN(m.best10k, ps * 10);
      if (dist >= 20.5 && dist <= 22) m.bestHalf = minN(m.bestHalf, ps * 21.097);
      if (dist >= 8) pace8k.push(ps);
      // efficienza: metri al minuto per battito
      if (r.avg_hr && r.avg_hr > 100 && dist >= 5) {
        m.maxEfficiency = maxN(m.maxEfficiency, (1000 / ps) * 60 / r.avg_hr);
      }
      // passo più veloce tenendo la FC in Z2 (≤75% di 180 bpm)
      if (r.avg_hr && r.avg_hr >= 110 && r.avg_hr <= 135 && dist >= 5) {
        m.bestZ2Pace = minN(m.bestZ2Pace, ps);
      }
      // FC più bassa su un lungo già veloce
      if (dist >= 8 && ps <= 330 && r.avg_hr) m.minLongHr = minN(m.minLongHr, r.avg_hr);
      // prova cronometrata
      if (dist >= 5 && ps < 270 && !r.is_treadmill) {
        m.timeTrials++;
        const mk = monthKey(r.date);
        ttByMonth[mk] = (ttByMonth[mk] || 0) + 1;
      }
    }

    // sedute
    if (r.run_type === "intervals") m.intervalSessions++;
    if (r.run_type === "tempo" || r.run_type === "threshold") {
      m.maxTempoMin = maxN(m.maxTempoMin, r.duration_minutes ?? null);
    }

    // giri dell'orologio
    const laps = r.laps ?? [];
    if (laps.length) {
      let n400 = 0, n800 = 0;
      for (const l of laps) {
        const d = l.distance || 0;
        if (near(d, 400, 60)) n400++;
        if (d >= 750) n800++;
        if (d >= 180 && d <= 260) m.bestLap200 = minN(m.bestLap200, l.moving_time);
        if (near(d, 1000, 80)) m.bestLap1000 = minN(m.bestLap1000, l.moving_time);
        if (d >= 200 && l.average_speed) m.maxLapSpeedKmh = maxN(m.maxLapSpeedKmh, l.average_speed * 3.6);
      }
      m.maxLaps400 = Math.max(m.maxLaps400, n400);
      m.maxReps800 = Math.max(m.maxReps800, n800);
      // miglio = i 4 giri consecutivi più veloci che stanno tra 1500 e 1700 m
      for (let i = 0; i + 3 < laps.length; i++) {
        const seg = laps.slice(i, i + 4);
        const d = seg.reduce((a, l) => a + (l.distance || 0), 0);
        if (d >= 1500 && d <= 1700) {
          m.bestMile = minN(m.bestMile, seg.reduce((a, l) => a + l.moving_time, 0));
        }
      }
      // recupero: quanto scende la FC dalla ripetuta al giro lento dopo
      for (let i = 0; i + 1 < laps.length; i++) {
        const a = laps[i], b = laps[i + 1];
        if (a.average_heartrate && b.average_heartrate && a.average_speed > b.average_speed * 1.2) {
          m.maxHrDrop = maxN(m.maxHrDrop, a.average_heartrate - b.average_heartrate);
        }
      }
    }

    // splits al km
    const sp = (r.splits ?? []).filter((s) => paceToSec(s.pace));
    if (sp.length >= 4) {
      const paces = sp.map((s) => paceToSec(s.pace) as number);
      const mid = Math.floor(paces.length / 2);
      const h1 = paces.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
      const h2 = paces.slice(mid).reduce((a, b) => a + b, 0) / (paces.length - mid);
      if (dist >= 6 && h1 - h2 >= 10) m.hasNegativeSplit = true;
      if (dist >= 8 && sp.length >= 6 && Math.max(...paces) - Math.min(...paces) <= 15) m.hasEvenSplits = true;
      let seq = 1;
      for (let i = 1; i < paces.length; i++) {
        seq = paces[i] < paces[i - 1] ? seq + 1 : 1;
        if (seq >= 4) m.hasProgression = true;
      }
      const avg = paces.reduce((a, b) => a + b, 0) / paces.length;
      if (dist >= 5 && avg - paces[paces.length - 1] >= 15) m.hasFastFinish = true;
      // cuore piatto: metà contro metà entro 5 bpm
      const hrs = sp.map((s) => s.hr).filter((h): h is number => !!h);
      if (dist >= 8 && hrs.length >= 6) {
        const hm = Math.floor(hrs.length / 2);
        const a1 = hrs.slice(0, hm).reduce((a, b) => a + b, 0) / hm;
        const a2 = hrs.slice(hm).reduce((a, b) => a + b, 0) / (hrs.length - hm);
        if (Math.abs(a2 - a1) <= 5) m.hasSteadyHeart = true;
      }
      // salita continua: km consecutivi con dislivello positivo
      let climb = 0;
      for (const s of sp) {
        if ((s.elevation_difference || 0) > 5) { climb++; m.maxClimbKm = Math.max(m.maxClimbKm, climb); }
        else climb = 0;
      }
      if (dist >= 8) {
        const d = computeDrift(r);
        if (d) m.minDrift = minN(m.minDrift, d.drift);
      }
    }

    // orari
    const h = startHour(r);
    if (h != null) {
      if (h < 7) m.earlyRuns++;
      if (h < 6) m.hasDawnRun = true;
      if (h >= 20) m.hasNightRun = true;
    }

    // calendario
    if (dist >= 16 && weekday(r.date) === 0) m.hasSundayLong = true;
    if (r.date.slice(5, 10) === "01-01") m.hasNewYearRun = true;
    if (r.date.slice(5, 10) === "12-25") m.hasChristmasRun = true;

    const wk = weekKey(r.date), mo = monthKey(r.date), yr = yearKey(r.date), dk = dayKey(r.date);
    byWeek[wk] = (byWeek[wk] || 0) + dist;
    byMonthKm[mo] = (byMonthKm[mo] || 0) + dist;
    byMonthMin[mo] = (byMonthMin[mo] || 0) + (r.duration_minutes || 0);
    byYearKm[yr] = (byYearKm[yr] || 0) + dist;
    byDayKm[dk] = (byDayKm[dk] || 0) + dist;
    byDayCount[dk] = (byDayCount[dk] || 0) + 1;
    (daysByMonth[mo] = daysByMonth[mo] || new Set()).add(dk);
    (daysByWeek[wk] = daysByWeek[wk] || new Set()).add(dk);
    if (weekday(r.date) === 0 || weekday(r.date) === 6) {
      (weekendWeeksByMonth[mo] = weekendWeeksByMonth[mo] || new Set()).add(wk);
    }
  }

  m.weeklyMaxKm = Math.max(0, ...Object.values(byWeek));
  m.monthlyMaxKm = Math.max(0, ...Object.values(byMonthKm));
  m.monthlyMaxMin = Math.max(0, ...Object.values(byMonthMin));
  m.yearMaxKm = Math.max(0, ...Object.values(byYearKm));
  m.maxDayKm = Math.max(0, ...Object.values(byDayKm));
  m.hasDoubleDay = Object.values(byDayCount).some((c) => c >= 2);
  m.maxMonthDays = Math.max(0, ...Object.values(daysByMonth).map((s) => s.size));
  m.maxWeekDays = Math.max(0, ...Object.values(daysByWeek).map((s) => s.size));
  m.maxWeekendMonth = Math.max(0, ...Object.values(weekendWeeksByMonth).map((s) => s.size));
  m.maxTimeTrialsMonth = Math.max(0, ...Object.values(ttByMonth), 0);
  m.locations = locations.size;

  const weeks = Object.keys(byWeek);
  m.maxWeekStreak = longestWeekRun(weeks, () => true);
  m.maxWeeks30k = longestWeekRun(weeks, (w) => byWeek[w] >= 30);

  // podio personale: il 3° miglior 5k
  fiveKTimes.sort((a, b) => a - b);
  m.third5k = fiveKTimes.length >= 3 ? fiveKTimes[2] : null;
  pace8k.sort((a, b) => a - b);
  m.bestPace8k = pace8k[0] ?? null;
  m.top5Pace8k = pace8k.length >= 5 ? pace8k[4] : null;

  // VDOT dal miglior 5k, in mancanza dal miglior 10k
  m.vdot = m.best5k != null ? vdotFrom(5000, m.best5k)
    : m.best10k != null ? vdotFrom(10000, m.best10k) : null;

  // streak in giorni
  const days = Object.keys(byDayCount).sort();
  let streak = 0, best = 0, prev: number | null = null;
  for (const d of days) {
    const t = dayNum(d);
    streak = prev != null && t - prev === 1 ? streak + 1 : 1;
    best = Math.max(best, streak);
    prev = t;
  }
  m.maxStreak = best;

  // comeback: ritorno dopo più di 30 giorni di stop
  for (let i = 1; i < days.length; i++) {
    if (dayNum(days[i]) - dayNum(days[i - 1]) > 30) { m.hasComeback = true; break; }
  }

  // finestre mobili: corse in 30 giorni, giorni corsi in 365
  const runDays = runs.map((r) => dayNum(r.date)).sort((a, b) => a - b);
  for (let i = 0, j = 0; i < runDays.length; i++) {
    while (runDays[i] - runDays[j] >= 30) j++;
    m.maxRuns30d = Math.max(m.maxRuns30d, i - j + 1);
  }
  const dayNums = days.map(dayNum);
  for (let i = 0, j = 0; i < dayNums.length; i++) {
    while (dayNums[i] - dayNums[j] >= 365) j++;
    m.maxDays365 = Math.max(m.maxDays365, i - j + 1);
  }

  // storia dei record: quando è caduto ogni primato
  const chrono = [...runs].sort((a, b) => a.date.localeCompare(b.date));
  const bests: Record<string, number> = {};
  const pbMonths: Record<string, number> = {};
  const pb510Months = new Set<string>();
  const pbYears = new Set<string>();
  for (const r of chrono) {
    const ps = paceToSec(r.avg_pace);
    const dist = r.distance_km || 0;
    const marks: Array<[string, number | null | undefined]> = [
      ["400", r.best_400m_sec], ["600", r.best_600m_sec], ["800", r.best_800m_sec],
      ["1000", r.best_1000m_sec], ["2000", r.best_2000m_sec], ["3000", r.best_3000m_sec],
      ["5k", ps && dist >= 4.5 && dist <= 5.5 ? ps * 5 : null],
      ["10k", ps && dist >= 9 && dist <= 11 ? ps * 10 : null],
    ];
    for (const [k, v] of marks) {
      if (v == null || !(v > 0)) continue;
      if (bests[k] == null) { bests[k] = v; continue; }   // il primo dato non è un record
      if (v < bests[k]) {
        bests[k] = v;
        const mk = monthKey(r.date);
        pbMonths[mk] = (pbMonths[mk] || 0) + 1;
        pbYears.add(yearKey(r.date));
        if (k === "5k" || k === "10k") pb510Months.add(mk);
      }
    }
  }
  m.maxPbMonth = Math.max(0, ...Object.values(pbMonths), 0);
  const sortedPbMonths = [...pb510Months].sort();
  for (let i = 1; i < sortedPbMonths.length; i++) {
    const a = new Date(sortedPbMonths[i - 1] + "-01T00:00:00Z");
    const b = new Date(sortedPbMonths[i] + "-01T00:00:00Z");
    const diff = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
    if (diff === 1) { m.hasTwoMonthPr = true; break; }
  }
  const lastYear = yearKey(chrono[chrono.length - 1].date);
  m.hasPbThisYear = pbYears.has(lastYear);

  return m;
}

export function buildBadgeContext(runs: Run[], baselineRunIds: string[]): BadgeCtx {
  const baseSet = new Set(baselineRunIds);
  const baseRuns = runs.filter((r) => baseSet.has(r.id));
  const postRuns = runs.filter((r) => !baseSet.has(r.id));
  return { base: buildMetrics(baseRuns), post: buildMetrics(postRuns), all: buildMetrics(runs) };
}

/* ── criteri ────────────────────────────────────────────────────────────── */

// Record: la corsa nuova batte il meglio di prima (o prima non c'era niente).
const beats = (post: number | null, base: number | null) =>
  post != null && (base == null || post < base);
const exceeds = (post: number | null, base: number | null) =>
  post != null && (base == null || post > base);
const grew = (post: number, base: number) => post > base && post > 0;

export type BadgeRule = (c: BadgeCtx) => boolean;

/**
 * Un criterio per ognuna delle 100 celebrazioni.
 * `c.all` = obiettivo sullo storico completo · `c.post/base` = record da battere.
 */
export const BADGE_RULES: Record<string, BadgeRule> = {
  /* ── CLASSICI · tutti record ── */
  "best-1k": (c) => beats(c.post.best1k, c.base.best1k),
  "longest-run": (c) => grew(c.post.longestRunKm, c.base.longestRunKm),
  "fastest-segment": (c) => beats(c.post.best400, c.base.best400),
  "best-cadence": (c) => exceeds(c.post.maxCadence, c.base.maxCadence),
  "best-5k": (c) => beats(c.post.best5k, c.base.best5k),
  "best-10k": (c) => beats(c.post.best10k, c.base.best10k),
  "elevation-record": (c) => exceeds(c.post.maxElev, c.base.maxElev) && (c.post.maxElev ?? 0) > 0,
  "streak": (c) => grew(c.post.maxStreak, c.base.maxStreak),
  "weekly-volume": (c) => grew(c.post.weeklyMaxKm, c.base.weeklyMaxKm),
  "vdot-record": (c) => exceeds(c.post.vdot, c.base.vdot),

  /* ── VOLUME ── */
  "week-60k": (c) => c.all.weeklyMaxKm >= 60,
  "first-30k": (c) => c.all.longestRunKm >= 30,
  "month-100k": (c) => c.all.monthlyMaxKm >= 100,
  "total-1000k": (c) => c.all.totalKm >= 1000,
  "first-half": (c) => c.all.longestRunKm >= 21,
  "first-marathon": (c) => c.all.longestRunKm >= 42,
  "runs-50": (c) => c.all.totalRuns >= 50,
  "double-day": (c) => c.all.hasDoubleDay,
  "month-10h": (c) => c.all.monthlyMaxMin >= 600,
  "day-record": (c) => grew(c.post.maxDayKm, c.base.maxDayKm),
  "week-80k": (c) => c.all.weeklyMaxKm >= 80,
  "month-200k": (c) => c.all.monthlyMaxKm >= 200,
  "total-2000k": (c) => c.all.totalKm >= 2000,
  "year-1000k": (c) => c.all.yearMaxKm >= 1000,
  "runs-100": (c) => c.all.totalRuns >= 100,
  "runs-250": (c) => c.all.totalRuns >= 250,
  "sunday-long": (c) => c.all.hasSundayLong,
  "month-20h": (c) => c.all.monthlyMaxMin >= 1200,
  "cal-1000": (c) => (c.all.maxCalories ?? 0) >= 1000,
  "four-weeks": (c) => c.all.maxWeeks30k >= 4,

  /* ── VELOCITÀ ── */
  "400-sub3": (c) => (c.all.best400 ?? Infinity) < 180,
  "rep-1000": (c) => beats(c.post.bestLap1000, c.base.bestLap1000),
  "first-intervals": (c) => c.all.intervalSessions >= 1,
  "200-record": (c) => beats(c.post.bestLap200, c.base.bestLap200),
  "negative-split": (c) => c.all.hasNegativeSplit,
  "barrier-break": (c) =>
    c.post.best5k != null && c.base.best5k != null && c.base.best5k - c.post.best5k >= 30,
  "speed-20": (c) => (c.all.maxLapSpeedKmh ?? 0) >= 20,
  "final-sprint": (c) => c.all.hasFastFinish,
  "rep-400x8": (c) => c.all.maxLaps400 >= 8,
  "progression": (c) => c.all.hasProgression,
  "sub-4": (c) => (c.all.best1k ?? Infinity) < 240,
  "urban-limit": (c) => (c.all.best3k ?? Infinity) <= 225,
  "sustained-18": (c) => (c.all.best600 ?? Infinity) <= 200,
  "pb-2k": (c) => beats(c.post.best2k, c.base.best2k),
  "pb-mile": (c) => beats(c.post.bestMile, c.base.bestMile),
  "pb-800": (c) => beats(c.post.best800, c.base.best800),
  "pb-3k": (c) => beats(c.post.best3k, c.base.best3k),
  "tempo-record": (c) => exceeds(c.post.maxTempoMin, c.base.maxTempoMin),
  "even-splits": (c) => c.all.hasEvenSplits,
  "yasso": (c) => c.all.maxReps800 >= 10,

  /* ── SALITE ── */
  "first-trail": (c) => (c.all.maxElevPerKm ?? 0) >= 15,
  "longest-climb": (c) => grew(c.post.maxClimbKm, c.base.maxClimbKm),

  /* ── COSTANZA ── */
  "streak-7": (c) => c.all.maxStreak >= 7,
  "streak-30": (c) => c.all.maxRuns30d >= 20,
  "streak-100": (c) => c.all.maxDays365 >= 100,
  "streak-365": (c) => c.all.maxWeekStreak >= 52,
  "dawn-run": (c) => c.all.hasDawnRun,
  "night-run": (c) => c.all.hasNightRun,
  "rain-run": (c) => c.all.hasWet,
  "freezing-run": (c) => (c.all.minTemp ?? Infinity) <= 2,
  "heat-run": (c) => (c.all.maxTemp ?? -Infinity) >= 30,
  "heat-record-32": (c) => (c.all.maxTemp ?? -Infinity) >= 32,
  "humid-run": (c) => (c.all.maxHumidity ?? 0) >= 90,
  "foggy-run": (c) => c.all.hasFog,
  "perfect-month": (c) => c.all.maxMonthDays >= 20,
  "week-coverage": (c) => c.all.maxWeekDays >= 7,
  "weekend-warrior": (c) => c.all.maxWeekendMonth >= 4,
  "dawn-ten": (c) => c.all.earlyRuns >= 10,
  "track-session": (c) => c.all.maxLaps400 >= 6,
  "windy-run": (c) => c.all.locations >= 5,
  "birthday-run": (c) => c.all.hasChristmasRun,
  "new-year-run": (c) => c.all.hasNewYearRun,

  /* ── FISIOLOGIA ── */
  "z2-faster": (c) => beats(c.post.bestZ2Pace, c.base.bestZ2Pace),
  "hr-stable": (c) => c.all.hasSteadyHeart,
  "gct-200": (c) => (c.all.minGct ?? Infinity) < 200,
  "low-vo": (c) => beats(c.post.minVo, c.base.minVo),
  "power-record": (c) => exceeds(c.post.maxHr, c.base.maxHr),
  "hr-recovery": (c) => (c.all.maxHrDrop ?? 0) >= 30,
  "low-drift": (c) => (c.all.minDrift ?? Infinity) < 3,
  "cool-heart": (c) => beats(c.post.minLongHr, c.base.minLongHr),
  "stride-record": (c) => exceeds(c.post.maxStride, c.base.maxStride),
  "efficiency-index": (c) => exceeds(c.post.maxEfficiency, c.base.maxEfficiency),

  /* ── GARE / PROVE ── */
  "first-pb-season": (c) => c.all.hasPbThisYear,
  "triple-pb": (c) => c.all.maxPbMonth >= 3,
  "first-race": (c) => c.all.timeTrials >= 1,
  "sub50-10k": (c) => (c.all.best10k ?? Infinity) < 3000,
  "sub2-half": (c) => (c.all.bestHalf ?? Infinity) < 7200,
  "rank-up": (c) => beats(c.post.bestPace8k, c.base.top5Pace8k),
  "tier-up": (c) =>
    c.post.vdot != null && c.base.vdot != null &&
    Math.floor(c.post.vdot / 5) > Math.floor(c.base.vdot / 5),
  "comeback": (c) => c.all.hasComeback,
  "10k-minus1": (c) =>
    c.post.best10k != null && c.base.best10k != null && c.base.best10k - c.post.best10k > 60,
  "pb-half": (c) => beats(c.post.bestHalf, c.base.bestHalf),
  "sub20-5k": (c) => (c.all.best5k ?? Infinity) < 1200,
  "sub25-5k": (c) => (c.all.best5k ?? Infinity) < 1500,
  "sub40-10k": (c) => (c.all.best10k ?? Infinity) < 2400,
  "two-month-pr": (c) => c.all.hasTwoMonthPr,
  "podium": (c) => (c.all.third5k ?? Infinity) <= 1260,
  "sub90-half": (c) => (c.all.bestHalf ?? Infinity) < 5400,
  "races-3-month": (c) => c.all.maxTimeTrialsMonth >= 3,
  "races-10": (c) => c.all.timeTrials >= 10,
};

/** Id dei badge attualmente soddisfatti. */
export function evaluateMet(runs: Run[], baselineRunIds: string[]): string[] {
  const c = buildBadgeContext(runs, baselineRunIds);
  return Object.entries(BADGE_RULES)
    .filter(([, rule]) => {
      try { return rule(c); } catch { return false; }
    })
    .map(([id]) => id);
}

/** True se il badge ha un criterio automatico (ora: tutti). */
export const isAutoDetectable = (id: string) => id in BADGE_RULES;
