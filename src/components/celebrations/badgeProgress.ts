import type { Run } from "../../types/api";
import { buildBadgeContext, type BadgeCtx } from "./badgeRules";

/**
 * QUANTO MANCA
 * ════════════════════════════════════════════════════════════════════════════
 * La bacheca sapeva dire soltanto "sbloccato" o "chiuso", che per un badge
 * come «1000 km totali» è un'informazione povera: a 940 km e a 12 km la card
 * era identica. Qui ogni criterio numerico diventa una percentuale e una riga
 * leggibile — 940 / 1000 km — così i traguardi vicini si vedono da lontano e
 * la bacheca smette di essere una lista di serrande abbassate.
 *
 * I badge-record (batti il tuo primato) non hanno una percentuale sensata: di
 * quelli si mostra il numero da battere, che è già tutto quello che serve.
 */
export interface BadgeProgress {
  /** 0-1, oppure null per i record (non è una corsa verso una soglia). */
  pct: number | null;
  /** "940 / 1000 km", "20:04 → 20:00", "batti 3:56". */
  label: string;
  /** Quanto manca, detto in una riga. Vuoto se è già preso. */
  remaining: string;
}

type Spec = {
  value: (c: BadgeCtx) => number | null;
  target: number;
  /** Il numero deve SCENDERE sotto il target: tempi, passi, temperature minime. */
  lower?: boolean;
  fmt: (v: number) => string;
  /** Unità appesa al confronto ("km", "corse", …). */
  unit?: string;
};

// ── formattatori ──────────────────────────────────────────────────────────────
const n0 = (v: number) => String(Math.round(v));
const n1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
const clock = (v: number) => {
  const s = Math.round(v);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
    : `${m}:${String(ss).padStart(2, "0")}`;
};
const pace = (v: number) => `${Math.floor(v / 60)}:${String(Math.round(v) % 60).padStart(2, "0")}`;
const hours = (v: number) => `${Math.floor(v / 60)}h${String(Math.round(v) % 60).padStart(2, "0")}`;
const deg = (v: number) => `${Math.round(v)}°`;

/** Ogni badge a soglia, con il numero che lo apre. */
const SPECS: Record<string, Spec> = {
  // ── VOLUME ──
  "week-60k": { value: (c) => c.all.weeklyMaxKm, target: 60, fmt: n0, unit: "km in una settimana" },
  "week-80k": { value: (c) => c.all.weeklyMaxKm, target: 80, fmt: n0, unit: "km in una settimana" },
  "first-30k": { value: (c) => c.all.longestRunKm, target: 30, fmt: n1, unit: "km di lungo" },
  "first-half": { value: (c) => c.all.longestRunKm, target: 21, fmt: n1, unit: "km di lungo" },
  "first-marathon": { value: (c) => c.all.longestRunKm, target: 42, fmt: n1, unit: "km di lungo" },
  "month-100k": { value: (c) => c.all.monthlyMaxKm, target: 100, fmt: n0, unit: "km nel mese" },
  "month-200k": { value: (c) => c.all.monthlyMaxKm, target: 200, fmt: n0, unit: "km nel mese" },
  "total-1000k": { value: (c) => c.all.totalKm, target: 1000, fmt: n0, unit: "km totali" },
  "total-2000k": { value: (c) => c.all.totalKm, target: 2000, fmt: n0, unit: "km totali" },
  "year-1000k": { value: (c) => c.all.yearMaxKm, target: 1000, fmt: n0, unit: "km in un anno" },
  "runs-50": { value: (c) => c.all.totalRuns, target: 50, fmt: n0, unit: "corse" },
  "runs-100": { value: (c) => c.all.totalRuns, target: 100, fmt: n0, unit: "corse" },
  "runs-250": { value: (c) => c.all.totalRuns, target: 250, fmt: n0, unit: "corse" },
  "month-10h": { value: (c) => c.all.monthlyMaxMin, target: 600, fmt: hours, unit: "nel mese" },
  "month-20h": { value: (c) => c.all.monthlyMaxMin, target: 1200, fmt: hours, unit: "nel mese" },
  "cal-1000": { value: (c) => c.all.maxCalories, target: 1000, fmt: n0, unit: "kcal in una corsa" },
  "four-weeks": { value: (c) => c.all.maxWeeks30k, target: 4, fmt: n0, unit: "settimane da 30 km di fila" },

  // ── VELOCITÀ ──
  "400-sub3": { value: (c) => c.all.best400, target: 180, lower: true, fmt: pace, unit: "sul passo dei 400" },
  "sub-4": { value: (c) => c.all.best1k, target: 240, lower: true, fmt: pace, unit: "sul miglior km" },
  "urban-limit": { value: (c) => c.all.best3k, target: 225, lower: true, fmt: pace, unit: "sul passo dei 3000" },
  "sustained-18": { value: (c) => c.all.best600, target: 200, lower: true, fmt: pace, unit: "sul passo dei 600" },
  "speed-20": { value: (c) => c.all.maxLapSpeedKmh, target: 20, fmt: n1, unit: "km/h di punta" },
  "rep-400x8": { value: (c) => c.all.maxLaps400, target: 8, fmt: n0, unit: "ripetute da 400 in una seduta" },
  "yasso": { value: (c) => c.all.maxReps800, target: 10, fmt: n0, unit: "ripetute da 800" },
  "first-intervals": { value: (c) => c.all.intervalSessions, target: 1, fmt: n0, unit: "seduta di ripetute" },

  // ── SALITE ──
  "first-trail": { value: (c) => c.all.maxElevPerKm, target: 15, fmt: n0, unit: "m di dislivello per km" },

  // ── COSTANZA ──
  "streak-7": { value: (c) => c.all.maxStreak, target: 7, fmt: n0, unit: "giorni di fila" },
  "streak-30": { value: (c) => c.all.maxRuns30d, target: 20, fmt: n0, unit: "corse in 30 giorni" },
  "streak-100": { value: (c) => c.all.maxDays365, target: 100, fmt: n0, unit: "giorni corsi in un anno" },
  "streak-365": { value: (c) => c.all.maxWeekStreak, target: 52, fmt: n0, unit: "settimane di fila" },
  "perfect-month": { value: (c) => c.all.maxMonthDays, target: 20, fmt: n0, unit: "giorni nel mese migliore" },
  "week-coverage": { value: (c) => c.all.maxWeekDays, target: 7, fmt: n0, unit: "giorni nella stessa settimana" },
  "weekend-warrior": { value: (c) => c.all.maxWeekendMonth, target: 4, fmt: n0, unit: "weekend nel mese" },
  "dawn-ten": { value: (c) => c.all.earlyRuns, target: 10, fmt: n0, unit: "partenze prima delle 7" },
  "track-session": { value: (c) => c.all.maxLaps400, target: 6, fmt: n0, unit: "giri da 400" },
  "windy-run": { value: (c) => c.all.locations, target: 5, fmt: n0, unit: "località diverse" },
  "heat-run": { value: (c) => c.all.maxTemp, target: 30, fmt: deg, unit: "di massima corsa" },
  "heat-record-32": { value: (c) => c.all.maxTemp, target: 32, fmt: deg, unit: "di massima corsa" },
  "humid-run": { value: (c) => c.all.maxHumidity, target: 90, fmt: n0, unit: "% di umidità" },
  "freezing-run": { value: (c) => c.all.minTemp, target: 2, lower: true, fmt: deg, unit: "di minima corsa" },

  // ── FISIOLOGIA ──
  "gct-200": { value: (c) => c.all.minGct, target: 200, lower: true, fmt: n0, unit: "ms di contatto a terra" },
  "hr-recovery": { value: (c) => c.all.maxHrDrop, target: 30, fmt: n0, unit: "bpm di calo nel recupero" },
  "low-drift": { value: (c) => c.all.minDrift, target: 3, lower: true, fmt: n1, unit: "% di deriva cardiaca" },

  // ── GARE / PROVE ──
  "sub25-5k": { value: (c) => c.all.best5k, target: 1500, lower: true, fmt: clock, unit: "sui 5 km" },
  "sub20-5k": { value: (c) => c.all.best5k, target: 1200, lower: true, fmt: clock, unit: "sui 5 km" },
  "podium": { value: (c) => c.all.third5k, target: 1260, lower: true, fmt: clock, unit: "col terzo miglior 5 km" },
  "sub50-10k": { value: (c) => c.all.best10k, target: 3000, lower: true, fmt: clock, unit: "sui 10 km" },
  "sub40-10k": { value: (c) => c.all.best10k, target: 2400, lower: true, fmt: clock, unit: "sui 10 km" },
  "sub2-half": { value: (c) => c.all.bestHalf, target: 7200, lower: true, fmt: clock, unit: "sulla mezza" },
  "sub90-half": { value: (c) => c.all.bestHalf, target: 5400, lower: true, fmt: clock, unit: "sulla mezza" },
  "first-race": { value: (c) => c.all.timeTrials, target: 1, fmt: n0, unit: "prova cronometrata" },
  "races-10": { value: (c) => c.all.timeTrials, target: 10, fmt: n0, unit: "prove cronometrate" },
  "races-3-month": { value: (c) => c.all.maxTimeTrialsMonth, target: 3, fmt: n0, unit: "prove nello stesso mese" },
  "triple-pb": { value: (c) => c.all.maxPbMonth, target: 3, fmt: n0, unit: "record nello stesso mese" },
};

/** I badge-record: si mostra il numero da battere, non una percentuale. */
const RECORDS: Record<string, { value: (c: BadgeCtx) => number | null; fmt: (v: number) => string; what: string }> = {
  "best-1k": { value: (c) => c.base.best1k, fmt: pace, what: "il miglior km" },
  "best-5k": { value: (c) => c.base.best5k, fmt: clock, what: "il 5 km" },
  "best-10k": { value: (c) => c.base.best10k, fmt: clock, what: "il 10 km" },
  "pb-half": { value: (c) => c.base.bestHalf, fmt: clock, what: "la mezza" },
  "pb-800": { value: (c) => c.base.best800, fmt: pace, what: "il passo sugli 800" },
  "pb-2k": { value: (c) => c.base.best2k, fmt: pace, what: "il passo sui 2000" },
  "pb-3k": { value: (c) => c.base.best3k, fmt: pace, what: "il passo sui 3000" },
  "pb-mile": { value: (c) => c.base.bestMile, fmt: clock, what: "il miglio" },
  "rep-1000": { value: (c) => c.base.bestLap1000, fmt: clock, what: "il giro da 1000" },
  "200-record": { value: (c) => c.base.bestLap200, fmt: clock, what: "il giro da 200" },
  "fastest-segment": { value: (c) => c.base.best400, fmt: pace, what: "il passo sui 400" },
  "longest-run": { value: (c) => c.base.longestRunKm, fmt: n1, what: "il lungo più lungo (km)" },
  "day-record": { value: (c) => c.base.maxDayKm, fmt: n1, what: "i km in un giorno" },
  "weekly-volume": { value: (c) => c.base.weeklyMaxKm, fmt: n0, what: "la settimana più piena (km)" },
  "elevation-record": { value: (c) => c.base.maxElev, fmt: n0, what: "il dislivello (m)" },
  "longest-climb": { value: (c) => c.base.maxClimbKm, fmt: n1, what: "la salita continua (km)" },
  "streak": { value: (c) => c.base.maxStreak, fmt: n0, what: "i giorni di fila" },
  "best-cadence": { value: (c) => c.base.maxCadence, fmt: n0, what: "la cadenza (spm)" },
  "vdot-record": { value: (c) => c.base.vdot, fmt: n1, what: "il VDOT" },
  "power-record": { value: (c) => c.base.maxHr, fmt: n0, what: "la FC massima" },
  "stride-record": { value: (c) => c.base.maxStride, fmt: n1, what: "la falcata (m)" },
  "low-vo": { value: (c) => c.base.minVo, fmt: n1, what: "l'oscillazione verticale (cm)" },
  "z2-faster": { value: (c) => c.base.bestZ2Pace, fmt: pace, what: "il passo in Z2" },
  "cool-heart": { value: (c) => c.base.minLongHr, fmt: n0, what: "la FC media sul lungo" },
  "tempo-record": { value: (c) => c.base.maxTempoMin, fmt: n0, what: "la soglia più lunga (min)" },
  "efficiency-index": { value: (c) => c.base.maxEfficiency, fmt: n1, what: "l'efficienza (m/min per bpm)" },
};

function remainingText(spec: Spec, cur: number): string {
  const diff = spec.lower ? cur - spec.target : spec.target - cur;
  if (diff <= 0) return "";
  const f = spec.fmt(spec.lower ? diff : diff);
  if (spec.lower) return `${f} da limare`;
  return `${f} ${spec.unit?.split(" ")[0] ?? ""} da fare`.trim();
}

/**
 * Progressi di tutti i badge a soglia, sulle corse passate.
 * Chi non ha una soglia (o un record noto) semplicemente non compare.
 */
export function badgeProgressMap(runs: Run[], baselineRunIds: string[]): Record<string, BadgeProgress> {
  const c = buildBadgeContext(runs, baselineRunIds);
  const out: Record<string, BadgeProgress> = {};

  for (const [id, spec] of Object.entries(SPECS)) {
    let cur: number | null = null;
    try { cur = spec.value(c); } catch { cur = null; }
    if (cur == null || !Number.isFinite(cur)) continue;
    const pct = spec.lower
      ? Math.min(1, spec.target / Math.max(cur, 0.001))
      : Math.min(1, cur / spec.target);
    out[id] = {
      pct: Math.max(0, pct),
      label: spec.lower
        ? `${spec.fmt(cur)} → ${spec.fmt(spec.target)}${spec.unit ? ` ${spec.unit}` : ""}`
        : `${spec.fmt(cur)} / ${spec.fmt(spec.target)}${spec.unit ? ` ${spec.unit}` : ""}`,
      remaining: remainingText(spec, cur),
    };
  }

  for (const [id, rec] of Object.entries(RECORDS)) {
    if (out[id]) continue;
    let cur: number | null = null;
    try { cur = rec.value(c); } catch { cur = null; }
    out[id] = {
      pct: null,
      label: cur == null || !Number.isFinite(cur)
        ? `Nessun primato ancora: ${rec.what}`
        : `Da battere: ${rec.fmt(cur)} — ${rec.what}`,
      remaining: "",
    };
  }

  return out;
}
