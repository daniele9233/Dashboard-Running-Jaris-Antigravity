import type { Run, Profile } from "../../types/api";

/**
 * RUNNING EVOLUTION ENGINE
 * ────────────────────────────────────────────────────────────────────────────
 * Trasforma lo storico Strava reale dell'atleta in un ecosistema di crescita
 * biologica, prestazionale e ludica. NON premia i chilometri: premia gli
 * ADATTAMENTI FISIOLOGICI prodotti dall'allenamento.
 *
 * Ogni formula è motivata dalla fisiologia dell'esercizio ed è tracciabile:
 *  · TRIMP di Banister (carico interno da HR reserve)            → carico
 *  · VDOT / VO2max stimato (Jack Daniels)                        → potenziale
 *  · Critical Speed (modello iperbolico distanza/tempo)          → soglia
 *  · CTL/ATL EWMA (Banister impulse-response, Coggan)            → forma
 *  · Monotonia & Strain (Foster)                                 → resilienza
 *  · Distribuzione polarizzata 80/20 (Seiler)                    → recupero
 *  · Detraining con emivite differenziate per sistema            → decadimento
 *  · GAP – Grade Adjusted Pace (Minetti)                         → confronto
 *
 * Tutto è calcolato client-side dai campi reali delle corse: niente valori
 * fissi, niente magia. baseline costruita su TUTTA la cronologia esistente.
 */

// ══ TIPI ══════════════════════════════════════════════════════════════════════

export type CatKey =
  | "neuromuscular" | "metabolic" | "structural" | "consistency" | "performance"
  | "endurance" | "efficiency" | "hill" | "speed" | "resilience"
  | "recovery" | "adaptation" | "race" | "explorer" | "mastery";

export interface CatMeta { key: CatKey; label: string; short: string; color: string; icon: string; what: string }

export const CATEGORIES: CatMeta[] = [
  { key: "neuromuscular", label: "Neuromuscolare", short: "Neuro", color: "#F43F5E", icon: "Zap",         what: "Velocità · economia · reclutamento fibre veloci · elasticità" },
  { key: "metabolic",     label: "Metabolico",     short: "Metab", color: "#C0FF00", icon: "Flame",       what: "VO₂max · soglia lattato · densità mitocondriale · resistenza" },
  { key: "structural",    label: "Strutturale",    short: "Strut", color: "#22D3EE", icon: "Shield",      what: "Tendini · articolazioni · tolleranza ai carichi meccanici" },
  { key: "consistency",   label: "Costanza",       short: "Cost",  color: "#A78BFA", icon: "CalendarCheck",what: "Continuità · disciplina · aderenza al piano" },
  { key: "performance",   label: "Performance",    short: "Perf",  color: "#FBBF24", icon: "Trophy",      what: "Personal best · risultati dimostrati" },
  { key: "endurance",     label: "Endurance",      short: "End",   color: "#34D399", icon: "Infinity",    what: "Volume · lungo · tempo totale in Z2" },
  { key: "efficiency",    label: "Efficienza",     short: "Effic", color: "#38BDF8", icon: "Gauge",       what: "Passo vs frequenza · running economy" },
  { key: "hill",          label: "Salita",         short: "Hill",  color: "#FB923C", icon: "Mountain",    what: "Dislivello · pendenza · vertical speed" },
  { key: "speed",         label: "Velocità",       short: "Speed", color: "#F472B6", icon: "Wind",        what: "Velocità pura · migliori 400m / 1km / 5km" },
  { key: "resilience",    label: "Resilienza",     short: "Resil", color: "#818CF8", icon: "ShieldCheck", what: "Carico cronico sostenuto · bassa monotonia" },
  { key: "recovery",      label: "Recupero",       short: "Recov", color: "#2DD4BF", icon: "HeartPulse",  what: "Distribuzione intensità · giorni facili rispettati" },
  { key: "adaptation",    label: "Adattamento",    short: "Adapt", color: "#A3E635", icon: "TrendingUp",  what: "Δ VO₂max · Δ Critical Speed · miglioramento reale" },
  { key: "race",          label: "Gara",           short: "Race",  color: "#EF4444", icon: "Flag",        what: "Esperienza agonistica · qualità delle gare" },
  { key: "explorer",      label: "Esploratore",    short: "Explo", color: "#60A5FA", icon: "Compass",     what: "Nuovi percorsi · nuovi luoghi" },
  { key: "mastery",       label: "Maestria",       short: "Mast",  color: "#E879F9", icon: "Crown",       what: "End-game · traguardi e obiettivi completati" },
];
const CAT_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<CatKey, CatMeta>;

export interface CatState { meta: CatMeta; xp: number; level: number; pct: number; share: number }

export interface Archetype { id: string; label: string; tagline: string; blend: string; color: string }

export interface GoalState {
  id: string; group: string; label: string; targetSec: number; distanceM: number;
  reqVdot: number; probability: number; gapSec: number; gapLabel: string; predictedLabel: string;
  recLevel: number; xpReq: number; achieved: boolean; w: { nm: number; met: number; str: number };
}

export interface FormPoint { day: number; date: string; ctl: number; atl: number }
export interface PeakRun { id: string; date: string; name: string; distanceKm: number; paceLabel: string; vdot: number }
export interface PeakWeek { label: string; km: number; load: number }
export interface PeakMonth { label: string; km: number; runs: number }

export interface Achievement { id: string; family: string; label: string; desc: string; tier: number; icon: string; color: string; unlocked: boolean; progress: number; target: number; unit: string }

export interface DetrainAxis { key: "nm" | "met" | "str"; label: string; halfLife: number; retention: number; lostPct: number }

export interface AnalystLine { kind: "impact" | "xp" | "goal" | "form" | "peak"; text: string }

export interface EvolutionState {
  ok: boolean;
  totalXp: number; level: number; levelFloor: number; levelCeil: number; levelPct: number; rankTitle: string;
  cats: CatState[];
  vdot: number; vo2max: number; csKmh: number; thresholdPaceSec: number;
  fitnessScore: number; fitnessBand: string;
  archetype: Archetype; archetypeAlt: Archetype | null;
  goals: GoalState[]; focusGoalId: string;
  detrain: { daysInactive: number; band: string; axes: DetrainAxis[] };
  form: { currentCtl: number; peakCtl: number; peakLabel: string; equivalencePct: number; surpassed: boolean; message: string; series: FormPoint[] };
  peaks: { runs: PeakRun[]; weeks: PeakWeek[]; months: PeakMonth[]; bestPeriod: string };
  achievements: Achievement[]; achievementsUnlocked: number;
  prestige: number;
  analyst: { runName: string; date: string; lines: AnalystLine[] } | null;
  stats: { totalKm: number; totalRuns: number; totalHours: number; totalElev: number; activeWeeks: number; monotony: number; easyPct: number };
}

// ══ HELPERS FISIOLOGICI ═══════════════════════════════════════════════════════

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dayNum = (d: string) => Math.floor(new Date(d.slice(0, 10) + "T00:00:00Z").getTime() / 86400000);
const paceToSec = (p?: string | null): number | null => {
  if (!p || !p.includes(":")) return null;
  const [m, s] = p.split(":"); const v = parseInt(m, 10) * 60 + parseInt(s, 10);
  return v > 0 ? v : null;
};
const fmtTime = (sec: number): string => {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};

/** VO2max effettivo per una performance distanza/tempo (Daniels VDOT). */
function vdotFrom(distM: number, timeSec: number): number {
  const t = timeSec / 60;                 // minuti
  const v = distM / t;                    // m/min
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v;
  const pct = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
  return vo2 / pct;
}
/** Tempo previsto su una distanza dato un VDOT (inversa per bisezione). */
function predictSec(distM: number, vdot: number): number {
  let lo = 0.5, hi = 360;                  // minuti
  for (let i = 0; i < 70; i++) { const mid = (lo + hi) / 2; if (vdotFrom(distM, mid * 60) > vdot) lo = mid; else hi = mid; }
  return ((lo + hi) / 2) * 60;
}
/** Distanza (m) percorribile in `targetSec` a un dato VDOT (definisce soglia/CS). */
function distInTime(vdot: number, targetSec: number): number {
  let lo = 800, hi = 30000;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (predictSec(mid, vdot) < targetSec) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

// Profili per tipo di corsa: frazioni di stimolo sui sistemi + tempo "duro" e Z2.
interface TypeProfile { nm: number; met: number; str: number; hard: number; z2: number }
const TYPE_PROFILE: Record<string, TypeProfile> = {
  intervals:   { nm: 0.55, met: 0.32, str: 0.13, hard: 0.55, z2: 0.18 },
  repetition:  { nm: 0.62, met: 0.24, str: 0.14, hard: 0.50, z2: 0.15 },
  vo2max:      { nm: 0.50, met: 0.40, str: 0.10, hard: 0.60, z2: 0.18 },
  fartlek:     { nm: 0.45, met: 0.40, str: 0.15, hard: 0.45, z2: 0.30 },
  tempo:       { nm: 0.16, met: 0.64, str: 0.20, hard: 0.70, z2: 0.25 },
  threshold:   { nm: 0.16, met: 0.64, str: 0.20, hard: 0.72, z2: 0.25 },
  progression: { nm: 0.25, met: 0.45, str: 0.30, hard: 0.42, z2: 0.45 },
  long:        { nm: 0.06, met: 0.30, str: 0.64, hard: 0.10, z2: 0.70 },
  easy:        { nm: 0.12, met: 0.34, str: 0.54, hard: 0.06, z2: 0.74 },
  recovery:    { nm: 0.06, met: 0.24, str: 0.70, hard: 0.00, z2: 0.55 },
  race:        { nm: 0.34, met: 0.51, str: 0.15, hard: 0.88, z2: 0.10 },
  trail:       { nm: 0.20, met: 0.30, str: 0.50, hard: 0.30, z2: 0.45 },
  workout:     { nm: 0.40, met: 0.40, str: 0.20, hard: 0.50, z2: 0.25 },
};
const profOf = (t?: string): TypeProfile => TYPE_PROFILE[(t ?? "easy").toLowerCase()] ?? TYPE_PROFILE.easy;

// ══ BEST EFFORTS (finestra più veloce sugli split) ════════════════════════════

const STD_DISTS = [1000, 1500, 3000, 5000, 10000, 21097];
interface Effort { sec: number; date: string; runId: string }

function collectEfforts(runs: Run[]): Record<number, Effort> {
  const best: Record<number, Effort> = {};
  const consider = (d: number, sec: number, date: string, runId: string) => {
    if (sec <= 0) return;
    if (!best[d] || sec < best[d].sec) best[d] = { sec, date, runId };
  };
  for (const r of runs) {
    if (r.is_treadmill) continue;
    const sp = r.splits;
    if (sp && sp.length >= 1) {
      // distanze/tempi cumulati per finestra scorrevole
      const cumD: number[] = [0], cumT: number[] = [0];
      for (const s of sp) {
        const dm = s.distance && s.distance > 0 ? s.distance : 1000;
        const tt = s.elapsed_time && s.elapsed_time > 0 ? s.elapsed_time : (paceToSec(s.pace) ?? 0);
        cumD.push(cumD[cumD.length - 1] + dm); cumT.push(cumT[cumT.length - 1] + tt);
      }
      const total = cumD[cumD.length - 1];
      for (const D of STD_DISTS) {
        if (total < D * 0.97) break;
        let bestW = Infinity;
        for (let i = 0; i < cumD.length; i++) {
          for (let j = i + 1; j < cumD.length; j++) {
            const dd = cumD[j] - cumD[i];
            if (dd < D * 0.97) continue;
            if (dd > D * 1.15) break;
            const tt = cumT[j] - cumT[i];
            if (tt > 0) bestW = Math.min(bestW, tt * (D / dd)); // normalizza alla distanza
            break;
          }
        }
        if (isFinite(bestW)) consider(D, bestW, r.date, r.id);
      }
    } else {
      // fallback: corsa intera come effort alla distanza standard più vicina
      const ps = paceToSec(r.avg_pace); const m = (r.distance_km || 0) * 1000;
      if (ps && m >= 950) {
        for (const D of STD_DISTS) if (m >= D * 0.93 && m <= D * 1.2) consider(D, ps * (D / 1000), r.date, r.id);
      }
    }
  }
  return best;
}

function vdotFromEfforts(efforts: Record<number, Effort>): number {
  let v = 0;
  for (const d of [1500, 3000, 5000, 10000, 21097]) if (efforts[d]) v = Math.max(v, vdotFrom(d, efforts[d].sec));
  if (!v && efforts[1000]) v = vdotFrom(1000, efforts[1000].sec) * 0.96;
  return v;
}

// ══ OBIETTIVI ═════════════════════════════════════════════════════════════════

interface GoalDef { id: string; group: string; label: string; sec: number; m: number; w: { nm: number; met: number; str: number } }
const GOAL_DEFS: GoalDef[] = [
  // 5K
  { id: "5k-30", group: "5K", label: "5K Sub 30′", sec: 1800, m: 5000, w: { nm: 0.30, met: 0.45, str: 0.25 } },
  { id: "5k-25", group: "5K", label: "5K Sub 25′", sec: 1500, m: 5000, w: { nm: 0.32, met: 0.46, str: 0.22 } },
  { id: "5k-22", group: "5K", label: "5K Sub 22′", sec: 1320, m: 5000, w: { nm: 0.35, met: 0.45, str: 0.20 } },
  { id: "5k-20", group: "5K", label: "5K Sub 20′", sec: 1200, m: 5000, w: { nm: 0.38, met: 0.44, str: 0.18 } },
  { id: "5k-18", group: "5K", label: "5K Sub 18′", sec: 1080, m: 5000, w: { nm: 0.42, met: 0.43, str: 0.15 } },
  // 10K
  { id: "10k-60", group: "10K", label: "10K Sub 60′", sec: 3600, m: 10000, w: { nm: 0.22, met: 0.50, str: 0.28 } },
  { id: "10k-50", group: "10K", label: "10K Sub 50′", sec: 3000, m: 10000, w: { nm: 0.24, met: 0.51, str: 0.25 } },
  { id: "10k-45", group: "10K", label: "10K Sub 45′", sec: 2700, m: 10000, w: { nm: 0.26, met: 0.51, str: 0.23 } },
  { id: "10k-40", group: "10K", label: "10K Sub 40′", sec: 2400, m: 10000, w: { nm: 0.30, met: 0.50, str: 0.20 } },
  // Mezza
  { id: "hm-200", group: "Mezza", label: "Mezza Sub 2:00", sec: 7200, m: 21097, w: { nm: 0.14, met: 0.46, str: 0.40 } },
  { id: "hm-145", group: "Mezza", label: "Mezza Sub 1:45", sec: 6300, m: 21097, w: { nm: 0.16, met: 0.47, str: 0.37 } },
  { id: "hm-140", group: "Mezza", label: "Mezza Sub 1:40", sec: 6000, m: 21097, w: { nm: 0.18, met: 0.48, str: 0.34 } },
  { id: "hm-135", group: "Mezza", label: "Mezza Sub 1:35", sec: 5700, m: 21097, w: { nm: 0.20, met: 0.49, str: 0.31 } },
  // Maratona
  { id: "fm-430", group: "Maratona", label: "Maratona Sub 4:30", sec: 16200, m: 42195, w: { nm: 0.08, met: 0.42, str: 0.50 } },
  { id: "fm-400", group: "Maratona", label: "Maratona Sub 4:00", sec: 14400, m: 42195, w: { nm: 0.10, met: 0.44, str: 0.46 } },
  { id: "fm-330", group: "Maratona", label: "Maratona Sub 3:30", sec: 12600, m: 42195, w: { nm: 0.12, met: 0.46, str: 0.42 } },
  { id: "fm-300", group: "Maratona", label: "Maratona Sub 3:00", sec: 10800, m: 42195, w: { nm: 0.14, met: 0.48, str: 0.38 } },
];

// ══ LIVELLI (1000, curva super-lineare: primi rapidi, avanzati durissimi) ══════
// Costo cumulato per raggiungere il livello L:  cum(L) = B · (L-1)^p
const LV_B = 16, LV_P = 2.05, LV_MAX = 1000;
export const xpForLevel = (l: number) => Math.round(LV_B * Math.pow(Math.max(0, l - 1), LV_P));
export const levelFromXp = (xp: number) => clamp(Math.floor(Math.pow(Math.max(0, xp) / LV_B, 1 / LV_P)) + 1, 1, LV_MAX);
const catLevelFromXp = (xp: number) => clamp(Math.floor(Math.pow(Math.max(0, xp) / 7, 1 / 2.0)) + 1, 1, 999);

const RANKS: [number, string][] = [
  [1, "Esordiente"], [10, "Principiante"], [25, "Amatore"], [45, "Intermedio"], [70, "Avanzato"],
  [100, "Competitivo"], [140, "Agonista"], [190, "Elite Locale"], [250, "Elite Regionale"],
  [330, "Elite Nazionale"], [430, "Semi-Pro"], [560, "Professionista"], [720, "Campione"], [900, "Leggenda"],
];
const rankFor = (lv: number) => { let r = RANKS[0][1]; for (const [t, n] of RANKS) if (lv >= t) r = n; return r; };

const ARCHETYPES: Record<string, Archetype> = {
  speed:     { id: "speed",     label: "Speed Specialist",     tagline: "Esplosività e brillantezza neuromuscolare", blend: "", color: "#F43F5E" },
  endurance: { id: "endurance", label: "Endurance Specialist", tagline: "Motore aerobico instancabile",            blend: "", color: "#34D399" },
  mountain:  { id: "mountain",  label: "Mountain Runner",      tagline: "Dominio del dislivello",                  blend: "", color: "#FB923C" },
  k5:        { id: "k5",        label: "5K Specialist",        tagline: "Potenza alla soglia sui 5 km",            blend: "", color: "#C0FF00" },
  k10:       { id: "k10",       label: "10K Specialist",       tagline: "Soglia anaerobica solida sui 10 km",      blend: "", color: "#22D3EE" },
  half:      { id: "half",      label: "Half Marathon Specialist", tagline: "Resistenza alla soglia",             blend: "", color: "#38BDF8" },
  marathon:  { id: "marathon",  label: "Marathon Specialist",  tagline: "Efficienza e capillarizzazione",          blend: "", color: "#A78BFA" },
  hybrid:    { id: "hybrid",    label: "Hybrid Runner",        tagline: "Versatile su ogni distanza",              blend: "", color: "#E879F9" },
};

// ══ ACHIEVEMENTS (generati a famiglie e tier) ═════════════════════════════════

function buildAchievements(agg: {
  totalKm: number; totalRuns: number; totalHours: number; totalElev: number;
  longestKm: number; maxWeekKm: number; longestStreak: number; bestPaceSec: number | null;
  earlyRuns: number; nightRuns: number; races: number; level: number; distinctPlaces: number;
}): Achievement[] {
  const out: Achievement[] = [];
  const mk = (family: string, icon: string, color: string, unit: string, label: (v: number) => string, desc: (v: number) => string, current: number, tiers: number[]) => {
    tiers.forEach((t, i) => out.push({
      id: `${family}-${t}`, family, label: label(t), desc: desc(t), tier: i + 1, icon, color,
      unlocked: current >= t, progress: Math.min(current, t), target: t, unit,
    }));
  };
  mk("dist-total", "Route", "#C0FF00", "km", (v) => `${v.toLocaleString("it-IT")} km totali`, (v) => `Percorri ${v.toLocaleString("it-IT")} km in totale`, agg.totalKm, [100, 250, 500, 1000, 2500, 5000, 10000]);
  mk("single", "Flag", "#F472B6", "km", (v) => v >= 42 ? "Maratoneta" : v >= 21 ? "Mezza in singola" : `Corsa da ${v} km`, (v) => `Completa una corsa di ${v} km`, agg.longestKm, [5, 10, 15, 21, 30, 42, 50]);
  mk("elev", "Mountain", "#FB923C", "m", (v) => `${v.toLocaleString("it-IT")} m D+`, (v) => `Accumula ${v.toLocaleString("it-IT")} m di dislivello`, agg.totalElev, [1000, 5000, 10000, 25000, 50000, 100000]);
  mk("streak", "Flame", "#EF4444", "gg", (v) => `Streak ${v} giorni`, (v) => `Corri ${v} giorni di fila`, agg.longestStreak, [3, 7, 14, 30, 60, 100]);
  mk("week", "CalendarCheck", "#A78BFA", "km", (v) => `Settimana da ${v} km`, (v) => `Corri ${v} km in una settimana`, agg.maxWeekKm, [30, 50, 70, 100, 130]);
  mk("count", "Activity", "#34D399", "corse", (v) => `${v} corse`, (v) => `Registra ${v} corse`, agg.totalRuns, [50, 100, 250, 500, 1000, 2000]);
  mk("hours", "Clock", "#38BDF8", "h", (v) => `${v} ore in corsa`, (v) => `Accumula ${v} ore di corsa`, agg.totalHours, [50, 100, 250, 500, 1000]);
  mk("level", "Crown", "#FBBF24", "lvl", (v) => `Livello ${v}`, (v) => `Raggiungi il livello ${v}`, agg.level, [10, 25, 50, 100, 200, 400]);
  mk("explore", "Compass", "#60A5FA", "luoghi", (v) => `${v} luoghi esplorati`, (v) => `Corri da ${v} punti di partenza diversi`, agg.distinctPlaces, [5, 15, 30, 60, 120]);
  mk("dawn", "Sunrise", "#FBBF24", "albe", (v) => `${v} corse all'alba`, (v) => `${v} corse iniziate prima delle 7:00`, agg.earlyRuns, [5, 20, 50, 100]);
  mk("night", "Moon", "#818CF8", "notti", (v) => `${v} corse notturne`, (v) => `${v} corse iniziate dopo le 21:00`, agg.nightRuns, [5, 20, 50, 100]);
  mk("race", "Trophy", "#EF4444", "gare", (v) => `${v} gare`, (v) => `Completa ${v} gare`, agg.races, [1, 5, 10, 25, 50]);
  if (agg.bestPaceSec) {
    const paceTiers = [330, 300, 270, 240, 210];
    paceTiers.forEach((sec, i) => out.push({
      id: `pace-${sec}`, family: "pace", label: `Passo ${fmtTime(sec)}/km`, desc: `Corri ≥3 km a ${fmtTime(sec)}/km o più veloce`,
      tier: i + 1, icon: "Wind", color: "#F43F5E", unlocked: agg.bestPaceSec <= sec, progress: agg.bestPaceSec <= sec ? 1 : 0, target: 1, unit: "",
    }));
  }
  return out;
}

// ══ ENGINE ════════════════════════════════════════════════════════════════════

const EMPTY: EvolutionState = {
  ok: false, totalXp: 0, level: 1, levelFloor: 0, levelCeil: 1, levelPct: 0, rankTitle: "Esordiente",
  cats: [], vdot: 0, vo2max: 0, csKmh: 0, thresholdPaceSec: 0, fitnessScore: 0, fitnessBand: "—",
  archetype: ARCHETYPES.hybrid, archetypeAlt: null, goals: [], focusGoalId: "5k-20",
  detrain: { daysInactive: 0, band: "—", axes: [] },
  form: { currentCtl: 0, peakCtl: 0, peakLabel: "—", equivalencePct: 0, surpassed: false, message: "", series: [] },
  peaks: { runs: [], weeks: [], months: [], bestPeriod: "—" },
  achievements: [], achievementsUnlocked: 0, prestige: 0, analyst: null,
  stats: { totalKm: 0, totalRuns: 0, totalHours: 0, totalElev: 0, activeWeeks: 0, monotony: 0, easyPct: 0 },
};

export function computeEvolution(runsIn: Run[], profile: Profile | null, focusGoalId = "5k-20", prestige = 0): EvolutionState {
  const runs = (runsIn ?? []).filter((r) => (r.distance_km || 0) > 0.3).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (runs.length === 0) return EMPTY;

  const sex = (profile?.sex ?? "M").toUpperCase().startsWith("F") ? "F" : "M";
  const hrMax = profile?.max_hr && profile.max_hr > 120 ? profile.max_hr : 190;
  const hrRest = 52;
  const trimpK = sex === "F" ? 0.86 : 0.64, trimpE = sex === "F" ? 1.67 : 1.92;

  const efforts = collectEfforts(runs);
  const vdot = vdotFromEfforts(efforts) || 38;
  const vo2max = vdot;                                   // VDOT ≈ VO2max
  // Soglia del lattato ≈ velocità sostenibile ~60′ (MLSS); Critical Speed ≈ ~30′.
  // Derivate dal VDOT (coerenti con il miglior effort) anziché da regressione su
  // effort potenzialmente non massimali.
  const thrSpeedMs = distInTime(vdot, 3600) / 3600;
  const thresholdPaceSec = thrSpeedMs > 0 ? 1000 / thrSpeedMs : 360;
  const csMs = distInTime(vdot, 1800) / 1800;
  const csKmh = csMs * 3.6;

  // ── accumulatori ──
  const acc: Record<CatKey, number> = Object.fromEntries(CATEGORIES.map((c) => [c.key, 0])) as Record<CatKey, number>;
  const dailyLoad: Record<number, number> = {};
  const places = new Set<string>();
  let totalKm = 0, totalElev = 0, totalMin = 0, hardCount = 0, easyCount = 0, races = 0;
  let earlyRuns = 0, nightRuns = 0;
  const runScores: PeakRun[] = [];
  const weekKm: Record<string, number> = {}, weekLoad: Record<string, number> = {};
  const monthKm: Record<string, { km: number; runs: number }> = {};

  const firstDay = dayNum(runs[0].date);
  const today = Math.floor(Date.now() / 86400000);

  for (const r of runs) {
    const prof = profOf(r.run_type);
    const dist = r.distance_km || 0, dur = r.duration_minutes || 0, elev = Math.max(0, r.elevation_gain || 0);
    const ps = paceToSec(r.avg_pace);
    const runSpeed = ps ? 1000 / ps : 0;
    const grade = dist > 0 ? elev / (dist * 1000) : 0;

    // intensità interna (HR reserve) o proxy passo/soglia
    let hrr: number;
    if (r.avg_hr && r.avg_hr > hrRest) hrr = clamp((r.avg_hr - hrRest) / (hrMax - hrRest), 0.2, 1);
    else if (r.avg_hr_pct) hrr = clamp((r.avg_hr_pct / 100 - 0.27) / 0.73, 0.2, 1);
    else hrr = clamp((runSpeed / thrSpeedMs) * 0.92, 0.3, 1.05);
    const trimp = dur * hrr * trimpK * Math.exp(trimpE * hrr);

    totalKm += dist; totalElev += elev; totalMin += dur;
    const d = dayNum(r.date); dailyLoad[d] = (dailyLoad[d] ?? 0) + trimp;

    const isRace = (r.run_type ?? "").toLowerCase() === "race" || !!r.event;
    if (isRace) races++;
    const hard = prof.hard >= 0.4 || isRace;
    if (hard) hardCount++; else easyCount++;

    // ── XP per sistema (per-corsa) ──
    acc.neuromuscular += trimp * prof.nm + (runSpeed > thrSpeedMs ? dur * prof.hard * (runSpeed / thrSpeedMs - 1) * 14 : 0)
      + (r.avg_cadence && r.avg_cadence > 178 ? Math.min(20, (r.avg_cadence - 178) * 1.5) : 0);
    acc.metabolic += trimp * prof.met + (hard ? dur * prof.hard * 1.6 : 0);
    acc.structural += dist * 1.1 + elev * 0.012 + (dur > 90 ? (dur - 90) * 0.25 : 0);
    acc.endurance += dur * prof.z2 * 0.45 + (dist > 15 ? (dist - 15) * 3.2 : 0);
    acc.hill += elev * 0.05 * (1 + grade * 9) + (grade > 0.04 ? dist * grade * 60 : 0);

    // efficienza: running economy (velocità per battito) + biomeccanica
    if (r.avg_hr && r.avg_hr > hrRest && runSpeed > 0) {
      const econ = (runSpeed / (r.avg_hr - hrRest)) * 1000;   // m/min per battito di riserva
      acc.efficiency += clamp(econ, 0, 60) * 0.9;
    }
    const bio = r.biomechanics;
    const vr = bio?.avg_vertical_ratio_pct ?? r.avg_vertical_ratio;
    const gct = bio?.avg_ground_contact_time_ms ?? r.avg_ground_contact_time;
    if (vr && vr > 0) acc.efficiency += clamp((10 - vr) * 6, 0, 40);
    if (gct && gct > 0) acc.efficiency += clamp((280 - gct) * 0.15, 0, 30);

    // recupero: bonus per corse facili ben condotte (Z2 dominante)
    if (!hard && prof.z2 > 0.5 && hrr < 0.78) acc.recovery += dur * 0.4;

    // gara
    if (isRace && ps) acc.race += 120 + Math.max(0, (vdotFrom(dist * 1000, ps * dist) - 30)) * 6;

    // peak: punteggio prestazione GAP-adjusted della corsa
    if (ps && dist >= 1.5) {
      const gapSpeed = runSpeed * (1 + grade * 3.3);          // GAP ~ Minetti (semplificato)
      const rv = vdotFrom(dist * 1000, (1000 / gapSpeed) * dist);
      runScores.push({ id: r.id, date: r.date.slice(0, 10), name: r.name ?? CAT_BY_KEY.performance.label, distanceKm: dist, paceLabel: r.avg_pace ?? "—", vdot: rv });
    }

    // luoghi / orari
    const ll = r.start_latlng;
    if (ll && typeof ll[0] === "number" && typeof ll[1] === "number") places.add(`${ll[0].toFixed(2)},${ll[1].toFixed(2)}`);
    else if (r.location) places.add(r.location.toLowerCase().trim());
    const local = r.start_date_local ?? r.date;
    const hour = new Date(local).getHours();
    if (hour < 7) earlyRuns++; else if (hour >= 21) nightRuns++;

    // settimane / mesi
    const wk = isoWeek(r.date); weekKm[wk] = (weekKm[wk] ?? 0) + dist; weekLoad[wk] = (weekLoad[wk] ?? 0) + trimp;
    const mo = r.date.slice(0, 7); monthKm[mo] = monthKm[mo] ?? { km: 0, runs: 0 }; monthKm[mo].km += dist; monthKm[mo].runs++;
  }

  // ── SPEED & PERFORMANCE da best efforts ──
  for (const D of STD_DISTS) {
    if (!efforts[D]) continue;
    const ev = vdotFrom(D, efforts[D].sec);
    if (D <= 3000) acc.speed += Math.max(0, ev - 28) * 22;
    acc.performance += Math.max(0, ev - 28) * 14;
  }

  // ── CONSISTENCY: streak + aderenza settimanale ──
  const activeDays = Object.keys(dailyLoad).map(Number).sort((a, b) => a - b);
  let longestStreak = activeDays.length ? 1 : 0, cur = 1;
  for (let i = 1; i < activeDays.length; i++) { if (activeDays[i] === activeDays[i - 1] + 1) { cur++; longestStreak = Math.max(longestStreak, cur); } else cur = 1; }
  const spanWeeks = Math.max(1, Math.round((today - firstDay) / 7));
  const activeWeeks = Object.keys(weekLoad).length;
  acc.consistency = activeWeeks * 70 + longestStreak * 30 + runs.length * 4;

  // ── RESILIENCE: CTL picco + monotonia (Foster) ──
  const loadVals: number[] = [];
  for (let dd = firstDay; dd <= today; dd++) loadVals.push(dailyLoad[dd] ?? 0);
  const meanLoad = loadVals.reduce((a, v) => a + v, 0) / (loadVals.length || 1);
  const sd = Math.sqrt(loadVals.reduce((a, v) => a + (v - meanLoad) ** 2, 0) / (loadVals.length || 1)) || 1;
  const monotony = meanLoad / sd;

  // CTL / ATL (impulse-response, EWMA)
  const series: FormPoint[] = [];
  let ctl = 0, atl = 0;
  for (let dd = firstDay; dd <= today; dd++) {
    const l = dailyLoad[dd] ?? 0;
    ctl += (l - ctl) / 42; atl += (l - atl) / 7;
    if (dd % 1 === 0) series.push({ day: dd, date: new Date(dd * 86400000).toISOString().slice(0, 10), ctl, atl });
  }
  const peakCtl = series.reduce((m, p) => Math.max(m, p.ctl), 0);
  const currentCtl = series.length ? series[series.length - 1].ctl : 0;
  acc.resilience = peakCtl * 12 + activeWeeks * 18 + clamp((2.2 - monotony), 0, 2) * 200;

  // ── RECOVERY: polarizzazione 80/20 (Seiler) ──
  const easyPct = runs.length ? easyCount / runs.length : 0;
  const polar = 1 - Math.min(1, Math.abs(easyPct - 0.8) / 0.8);
  acc.recovery += polar * runs.length * 9;

  // ── ADAPTATION: trend VDOT recente vs precedente ──
  const recent = runs.filter((r) => today - dayNum(r.date) <= 90);
  const prior = runs.filter((r) => { const a = today - dayNum(r.date); return a > 90 && a <= 270; });
  const vdotRecent = vdotFromEfforts(collectEfforts(recent));
  const vdotPrior = vdotFromEfforts(collectEfforts(prior));
  const vdotDelta = vdotRecent && vdotPrior ? vdotRecent - vdotPrior : 0;
  acc.adaptation = Math.max(0, vdotDelta) * 600 + (vdotRecent ? 200 : 0) + recent.length * 6;

  // ── EXPLORER ──
  const distinctPlaces = places.size;
  acc.explorer = distinctPlaces * 45;

  // ── detraining per sistema (emivite differenziate) ──
  const lastDay = activeDays[activeDays.length - 1] ?? today;
  const daysInactive = Math.max(0, today - lastDay);
  const axisDef: { key: "nm" | "met" | "str"; label: string; hl: number }[] = [
    { key: "nm", label: "Neuromuscolare", hl: 12 }, { key: "met", label: "Metabolico", hl: 18 }, { key: "str", label: "Strutturale", hl: 42 },
  ];
  const axes: DetrainAxis[] = axisDef.map((a) => {
    const ret = daysInactive <= 2 ? 1 : Math.pow(0.5, (daysInactive - 2) / a.hl);
    return { key: a.key, label: a.label, halfLife: a.hl, retention: ret, lostPct: Math.round((1 - ret) * 100) };
  });
  const detrainBand = daysInactive <= 2 ? "Nessuna perdita" : daysInactive <= 7 ? "Perdita minima" : daysInactive <= 14 ? "Perdita moderata" : daysInactive <= 30 ? "Perdita significativa" : "Perdita elevata";

  // ── MASTERY (calcolata dopo gli obiettivi) provvisoria ──
  // ── totale & livello globale ──
  let totalXp = 0;
  for (const c of CATEGORIES) totalXp += acc[c.key];
  totalXp = Math.round(totalXp * (1 + prestige * 0.5));     // prestige amplifica il valore guadagnato

  const level = levelFromXp(totalXp);
  const levelFloor = xpForLevel(level), levelCeil = xpForLevel(level + 1);
  const levelPct = clamp(Math.round(((totalXp - levelFloor) / (levelCeil - levelFloor || 1)) * 100), 0, 100);

  // ── obiettivi ──
  const trend90 = vdotDelta;
  const goals: GoalState[] = GOAL_DEFS.map((g) => {
    const reqV = vdotFrom(g.m, g.sec);
    const predicted = vdot ? predictSec(g.m, vdot) : g.sec * 1.3;
    const gap = predicted - g.sec;
    const prob = clamp(Math.round(100 / (1 + Math.exp(-(vdot - reqV + trend90 * 0.6) / 1.4))), 1, 99);
    return {
      id: g.id, group: g.group, label: g.label, targetSec: g.sec, distanceM: g.m, reqVdot: Math.round(reqV * 10) / 10,
      probability: prob, gapSec: gap, gapLabel: (gap <= 0 ? "−" : "+") + fmtTime(Math.abs(gap)),
      predictedLabel: fmtTime(predicted), recLevel: Math.max(1, Math.round((reqV - 28) * 6)),
      xpReq: Math.round(xpForLevel(Math.max(1, Math.round((reqV - 28) * 6)))), achieved: gap <= 0, w: g.w,
    };
  });
  const goalsCompleted = goals.filter((g) => g.achieved).length;
  acc.mastery = goalsCompleted * 400 + level * 12 + prestige * 1500;
  // ricalcolo totale includendo mastery
  totalXp += Math.round(acc.mastery * (1 + prestige * 0.5));
  const level2 = levelFromXp(totalXp);
  const lf2 = xpForLevel(level2), lc2 = xpForLevel(level2 + 1);
  const lp2 = clamp(Math.round(((totalXp - lf2) / (lc2 - lf2 || 1)) * 100), 0, 100);

  // ── stati categoria ──
  const cats: CatState[] = CATEGORIES.map((meta) => {
    const xp = Math.round(acc[meta.key]);
    return { meta, xp, level: catLevelFromXp(xp), pct: 0, share: xp / (totalXp || 1) };
  });
  const maxCat = Math.max(...cats.map((c) => c.xp), 1);
  cats.forEach((c) => { c.pct = Math.round((c.xp / maxCat) * 100); });

  // ── archetipo ──
  const arche = pickArchetype(acc, efforts, vdot);

  // ── fitness score 0-1000 ──
  const vdotNorm = clamp((vdot - 30) / 40, 0, 1);
  const ctlNorm = clamp(currentCtl / 110, 0, 1);
  const trendNorm = clamp(0.5 + vdotDelta / 6, 0, 1);
  const retAvg = (axes[0].retention + axes[1].retention + axes[2].retention) / 3;
  const fitnessScore = Math.round(1000 * clamp((0.5 * vdotNorm + 0.35 * ctlNorm + 0.15 * trendNorm) * retAvg, 0, 1));
  const fitnessBand = fitnessScore >= 850 ? "Elite" : fitnessScore >= 680 ? "Competitivo" : fitnessScore >= 500 ? "Avanzato" : fitnessScore >= 320 ? "Intermedio" : fitnessScore >= 150 ? "In sviluppo" : "Base";

  // ── form equivalence ──
  let peakLabel = "—";
  if (series.length) { const pp = series.reduce((m, p) => (p.ctl > m.ctl ? p : m), series[0]); peakLabel = monthLabel(pp.date); }
  const equivalencePct = peakCtl > 0 ? Math.round((currentCtl / peakCtl) * 100) : 0;
  const surpassed = equivalencePct >= 100;
  const formMessage = surpassed
    ? `Hai superato il tuo picco storico (${peakLabel}) del ${equivalencePct - 100}%`
    : `Sei al ${equivalencePct}% della forma del tuo picco (${peakLabel})`;

  // ── peaks ──
  const topRuns = runScores.sort((a, b) => b.vdot - a.vdot).slice(0, 10);
  const topWeeks: PeakWeek[] = Object.entries(weekKm).map(([w, km]) => ({ label: weekLabel(w), km: Math.round(km), load: Math.round(weekLoad[w] ?? 0) }))
    .sort((a, b) => b.load - a.load).slice(0, 10);
  const topMonths: PeakMonth[] = Object.entries(monthKm).map(([m, v]) => ({ label: monthLabel(m + "-01"), km: Math.round(v.km), runs: v.runs }))
    .sort((a, b) => b.km - a.km).slice(0, 10);
  const bestPeriod = peakLabel;

  // ── achievements ──
  let bestPaceSec: number | null = null;
  for (const r of runs) { const ps = paceToSec(r.avg_pace); if (ps && (r.distance_km || 0) >= 3) bestPaceSec = bestPaceSec == null ? ps : Math.min(bestPaceSec, ps); }
  const achievements = buildAchievements({
    totalKm: Math.round(totalKm), totalRuns: runs.length, totalHours: Math.round(totalMin / 60), totalElev: Math.round(totalElev),
    longestKm: Math.round(Math.max(...runs.map((r) => r.distance_km || 0))), maxWeekKm: Math.round(Math.max(...Object.values(weekKm), 0)),
    longestStreak, bestPaceSec, earlyRuns, nightRuns, races, level: level2, distinctPlaces,
  });
  const achievementsUnlocked = achievements.filter((a) => a.unlocked).length;

  // ── analyst sull'ultima corsa ──
  const last = runs[runs.length - 1];
  const analyst = buildAnalyst(last, { profOf, thrSpeedMs, vdot, focusGoal: goals.find((g) => g.id === focusGoalId) ?? goals[0], currentCtl, peakCtl, equivalencePct, peakLabel, hrRest, hrMax });

  return {
    ok: true, totalXp, level: level2, levelFloor: lf2, levelCeil: lc2, levelPct: lp2, rankTitle: rankFor(level2),
    cats, vdot: Math.round(vdot * 10) / 10, vo2max: Math.round(vo2max * 10) / 10, csKmh: Math.round(csKmh * 100) / 100, thresholdPaceSec,
    fitnessScore, fitnessBand, archetype: arche.main, archetypeAlt: arche.alt,
    goals, focusGoalId,
    detrain: { daysInactive, band: detrainBand, axes },
    form: { currentCtl: Math.round(currentCtl), peakCtl: Math.round(peakCtl), peakLabel, equivalencePct, surpassed, message: formMessage, series },
    peaks: { runs: topRuns, weeks: topWeeks, months: topMonths, bestPeriod },
    achievements, achievementsUnlocked, prestige,
    analyst,
    stats: { totalKm: Math.round(totalKm), totalRuns: runs.length, totalHours: Math.round(totalMin / 60), totalElev: Math.round(totalElev), activeWeeks, monotony: Math.round(monotony * 100) / 100, easyPct: Math.round(easyPct * 100) },
  };
}

// ── archetipo ──
function pickArchetype(acc: Record<CatKey, number>, efforts: Record<number, Effort>, vdot: number): { main: Archetype; alt: Archetype | null } {
  // assi sintetici
  const speedAxis = acc.neuromuscular + acc.speed;
  const endAxis = acc.endurance + acc.structural;
  const hillAxis = acc.hill;
  // specializzazione di distanza: dove il VDOT relativo è più alto
  const distVdot: { id: string; v: number }[] = [];
  if (efforts[5000]) distVdot.push({ id: "k5", v: vdotFrom(5000, efforts[5000].sec) });
  if (efforts[10000]) distVdot.push({ id: "k10", v: vdotFrom(10000, efforts[10000].sec) });
  if (efforts[21097]) distVdot.push({ id: "half", v: vdotFrom(21097, efforts[21097].sec) });
  const total = speedAxis + endAxis + hillAxis || 1;
  const order: { id: string; w: number }[] = [
    { id: "speed", w: speedAxis / total }, { id: "endurance", w: endAxis / total }, { id: "mountain", w: hillAxis / total },
  ].sort((a, b) => b.w - a.w);
  let mainId = order[0].id;
  // se molto bilanciato → ibrido o specialista di distanza
  if (order[0].w - order[1].w < 0.12) {
    const dv = distVdot.sort((a, b) => b.v - a.v)[0];
    mainId = dv ? dv.id : "hybrid";
  } else if (mainId === "endurance" && distVdot.length) {
    const dv = distVdot.sort((a, b) => b.v - a.v)[0];
    if (dv && (dv.id === "half")) mainId = "half";
  }
  const main = ARCHETYPES[mainId] ?? ARCHETYPES.hybrid;
  const altId = order[1].id;
  const alt = altId !== mainId ? (ARCHETYPES[altId] ?? null) : null;
  return { main: { ...main, blend: alt ? `${main.label} · ${alt.label}` : main.label }, alt };
}

// ── analyst (rule-based, prosa italiana) ──
function buildAnalyst(r: Run, ctx: { profOf: (t?: string) => TypeProfile; thrSpeedMs: number; vdot: number; focusGoal: GoalState; currentCtl: number; peakCtl: number; equivalencePct: number; peakLabel: string; hrRest: number; hrMax: number }): EvolutionState["analyst"] {
  if (!r) return null;
  const prof = ctx.profOf(r.run_type);
  const dist = r.distance_km || 0, dur = r.duration_minutes || 0, elev = Math.max(0, r.elevation_gain || 0);
  const ps = paceToSec(r.avg_pace); const runSpeed = ps ? 1000 / ps : 0;
  const dom = prof.nm >= prof.met && prof.nm >= prof.str ? "neuromuscolare" : prof.met >= prof.str ? "metabolico" : "strutturale";
  const lines: AnalystLine[] = [];
  lines.push({ kind: "impact", text: `Stimolo prevalentemente ${dom}. ${dist.toFixed(1)} km in ${Math.round(dur)}′${elev > 30 ? ` · ${Math.round(elev)} m D+` : ""}.` });
  const xpHint = Math.round((dur * (prof.nm + prof.met + prof.str)) + dist * 1.1);
  lines.push({ kind: "xp", text: `≈ ${xpHint} XP distribuiti su ${dom === "neuromuscolare" ? "velocità ed economia di corsa" : dom === "metabolico" ? "VO₂max e soglia lattato" : "tendini, robustezza e base aerobica"}.` });
  if (ctx.focusGoal) {
    const closer = runSpeed > ctx.thrSpeedMs ? "ti avvicina" : "consolida la base verso";
    lines.push({ kind: "goal", text: `Questa corsa ${closer} l'obiettivo ${ctx.focusGoal.label} (probabilità attuale ${ctx.focusGoal.probability}%).` });
  }
  const formArrow = ctx.currentCtl >= ctx.peakCtl * 0.97 ? "in crescita verso il picco" : ctx.currentCtl >= ctx.peakCtl * 0.8 ? "in costruzione" : "da rilanciare";
  lines.push({ kind: "form", text: `Forma ${formArrow}: sei al ${ctx.equivalencePct}% del tuo miglior periodo (${ctx.peakLabel}).` });
  if (runSpeed > ctx.thrSpeedMs * 1.02) lines.push({ kind: "peak", text: `Passo sopra soglia: sessione di qualità che spinge il tetto del VO₂max (stima ${ctx.vdot.toFixed(1)} VDOT).` });
  return { runName: r.name ?? "Ultima corsa", date: r.date.slice(0, 10), lines };
}

// ── util date ──
function isoWeek(date: string): string {
  const d = new Date(date.slice(0, 10) + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
const MONTHS_IT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
function monthLabel(date: string): string { const d = new Date(date.slice(0, 10) + "T00:00:00Z"); return `${MONTHS_IT[d.getUTCMonth()]} ${d.getUTCFullYear()}`; }
function weekLabel(w: string): string { const [y, wk] = w.split("-W"); return `Sett. ${wk} '${y.slice(2)}`; }
