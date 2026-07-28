import type { Run, Profile } from "../../types/api";

/**
 * ATHLETE EVOLUTION — SISTEMA A LIVELLI
 * ────────────────────────────────────────────────────────────────────────────
 * 100 livelli divisi in 10 GRADI (Esordiente → Leggenda). Ogni livello ha un
 * titolo. Ogni grado è una tappa-ricompensa da sbloccare.
 *
 * Gli XP arrivano da OGNI corsa, in base a durata · intensità · qualità (con
 * bonus per personal best e gare). La logica resta fondata sull'allenamento
 * reale ma è nascosta: l'atleta vede solo il proprio livello salire.
 *
 * Curva super-lineare: i primi livelli sono rapidi, gli ultimi durissimi.
 */

export const MAX_LEVEL = 100;
const A = 9, P = 2.2;                                   // cum(L) = A·(L-1)^P
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** XP cumulati necessari per ESSERE al livello L (inizio del livello). */
export const cumXpForLevel = (l: number) => Math.round(A * Math.pow(Math.max(0, l - 1), P));
export const levelFromXp = (xp: number) => clamp(Math.floor(Math.pow(Math.max(0, xp) / A, 1 / P)) + 1, 1, MAX_LEVEL);

// ── 10 gradi × 10 livelli ─────────────────────────────────────────────────────
interface TierDef { name: string; color: string; icon: string; perk: string }
const TIER_DEFS: TierDef[] = [
  { name: "Esordiente",  color: "#94A3B8", icon: "Footprints", perk: "I primi passi nel mondo della corsa" },
  { name: "Principiante",color: "#22D3EE", icon: "Sparkles",   perk: "La costanza prende forma" },
  { name: "Amatore",     color: "#2DD4BF", icon: "Flame",      perk: "Il motore aerobico si accende" },
  { name: "Intermedio",  color: "#34D399", icon: "Zap",        perk: "Ritmo da runner vero" },
  { name: "Avanzato",    color: "#A3E635", icon: "Medal",      perk: "Nettamente sopra la media" },
  { name: "Competitivo", color: "#C0FF00", icon: "Award",      perk: "Pronto a misurarti in gara" },
  { name: "Agonista",    color: "#FBBF24", icon: "Target",     perk: "Mentalità da agonista" },
  { name: "Elite",       color: "#FB923C", icon: "Trophy",     perk: "Prestazioni d'élite" },
  { name: "Maestro",     color: "#F472B6", icon: "Gem",        perk: "Padronanza totale del gesto" },
  { name: "Leggenda",    color: "#E879F9", icon: "Crown",      perk: "Lo status leggendario" },
];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const tierIdxOf = (level: number) => clamp(Math.floor((level - 1) / 10), 0, 9);
export const levelTitle = (level: number) => `${TIER_DEFS[tierIdxOf(level)].name} ${ROMAN[(level - 1) % 10]}`;

// ── VDOT (Daniels) — usato SOLO per stimare la difficoltà degli obiettivi ──────
function vdotFrom(distM: number, timeSec: number): number {
  const t = timeSec / 60; const v = distM / t;
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v;
  const pct = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
  return vo2 / pct;
}
/** Tempo (sec) previsto su una distanza dato un VDOT. */
function predictSec(distM: number, vdot: number): number {
  let lo = 0.5, hi = 360;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (vdotFrom(distM, mid * 60) > vdot) lo = mid; else hi = mid; }
  return ((lo + hi) / 2) * 60;
}
// ── Modello caldo (identico al backend): temperatura apparente + heat slowdown ─
function apparentTempC(tempC: number, humidity: number | null): number {
  if (humidity == null || tempC <= 20) return tempC;
  return tempC + (Math.max(0, humidity - 50) / 100) * (tempC - 20) * 0.7;
}
/** Frazione di rallentamento vs un ottimo a ~12°C, scalata sulla distanza. */
function heatSlowdownFrac(tempC: number | null | undefined, humidity: number | null, distKm: number): number {
  if (tempC == null) return 0;
  const apparent = apparentTempC(tempC, humidity);
  const excess = Math.max(0, apparent - 12);
  const d = Math.max(5, Math.min(42.2, distKm));
  const coef = 0.0035 + ((d - 5) / (42.2 - 5)) * (0.008 - 0.0035);
  return excess * coef;
}

/** VDOT corrente stimato dal miglior effort reale (corse ≥3 km), NORMALIZZATO
 *  per il caldo: ogni prova è riportata all'equivalente a temperatura ideale,
 *  così il valore riflette il POTENZIALE (fresco) e non è schiacciato dall'estate. */
function estimateVdot(runs: Run[]): number {
  let best = 0;
  for (const r of runs) {
    if (r.is_treadmill) continue;
    const ps = paceToSec(r.avg_pace); const dist = r.distance_km || 0;
    if (!ps || dist < 3 || dist > 25) continue;
    const frac = heatSlowdownFrac(r.temperature, null, dist);
    const coolPaceSec = ps / (1 + frac); // prova riportata al fresco (più veloce)
    best = Math.max(best, vdotFrom(dist * 1000, coolPaceSec * dist));
  }
  return best ? clamp(best, 25, 80) : 38;
}
const fmtClock = (sec: number): string => {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};

// ── Traguardi di riferimento (distanza · tempo) ───────────────────────────────
interface GoalDef { id: string; group: string; label: string; m: number; sec: number }
const GOAL_DEFS: GoalDef[] = [
  { id: "5k-30",  group: "5K", label: "5K Sub 30'", m: 5000, sec: 1800 },
  { id: "5k-25",  group: "5K", label: "5K Sub 25'", m: 5000, sec: 1500 },
  { id: "5k-22",  group: "5K", label: "5K Sub 22'", m: 5000, sec: 1320 },
  { id: "5k-21",  group: "5K", label: "5K Sub 21'", m: 5000, sec: 1260 },
  { id: "5k-20",  group: "5K", label: "5K Sub 20'", m: 5000, sec: 1200 },
  { id: "5k-19",  group: "5K", label: "5K Sub 19'", m: 5000, sec: 1140 },
  { id: "5k-18",  group: "5K", label: "5K Sub 18'", m: 5000, sec: 1080 },
  { id: "10k-55", group: "10K", label: "10K Sub 55'", m: 10000, sec: 3300 },
  { id: "10k-50", group: "10K", label: "10K Sub 50'", m: 10000, sec: 3000 },
  { id: "10k-45", group: "10K", label: "10K Sub 45'", m: 10000, sec: 2700 },
  { id: "10k-43", group: "10K", label: "10K Sub 43'", m: 10000, sec: 2580 },
  { id: "10k-42", group: "10K", label: "10K Sub 42'", m: 10000, sec: 2520 },
  { id: "10k-40", group: "10K", label: "10K Sub 40'", m: 10000, sec: 2400 },
  { id: "10k-38", group: "10K", label: "10K Sub 38'", m: 10000, sec: 2280 },
  { id: "hm-200", group: "Mezza", label: "Mezza Sub 2:00", m: 21097, sec: 7200 },
  { id: "hm-150", group: "Mezza", label: "Mezza Sub 1:50", m: 21097, sec: 6600 },
  { id: "hm-145", group: "Mezza", label: "Mezza Sub 1:45", m: 21097, sec: 6300 },
  { id: "hm-140", group: "Mezza", label: "Mezza Sub 1:40", m: 21097, sec: 6000 },
  { id: "hm-135", group: "Mezza", label: "Mezza Sub 1:35", m: 21097, sec: 5700 },
  { id: "hm-130", group: "Mezza", label: "Mezza Sub 1:30", m: 21097, sec: 5400 },
  { id: "fm-400", group: "Maratona", label: "Maratona Sub 4:00", m: 42195, sec: 14400 },
  { id: "fm-330", group: "Maratona", label: "Maratona Sub 3:30", m: 42195, sec: 12600 },
  { id: "fm-300", group: "Maratona", label: "Maratona Sub 3:00", m: 42195, sec: 10800 },
];
// Condizioni estive tipiche di Roma (banda 20-30°C): ~27°C, 60% umidità.
const HOT_TEMP_C = 27, HOT_HUMIDITY = 60;

// ══ PROIEZIONE ════════════════════════════════════════════════════════════════
/**
 * "Con questi XP arrivi lì".
 *
 * Gli XP sono la moneta del lavoro svolto: la proiezione li usa come asse al
 * posto del calendario, così il traguardo ha un PREZZO invece che una data.
 * "Fra 30 giorni" non dipende da te; "fra 1.240 XP, cioè ~10 sedute" sì.
 *
 * Come si costruisce:
 * 1. il VDOT migliore di ogni finestra di 30 giorni (già normalizzato per il
 *    caldo) dà la serie storica della forma;
 * 2. una regressione ai minimi quadrati sugli ultimi 6 mesi dà la pendenza in
 *    VDOT/giorno, tappata a +1 al mese;
 * 3. gli XP guadagnati nello stesso periodo danno il ritmo XP/giorno, quindi il
 *    cambio: quanti XP costa un punto di VDOT;
 * 4. la curva in avanti NON è retta ma tende a un asintoto: più sei allenato,
 *    più XP servono per lo stesso guadagno.
 */
const PROJ_TAU = 90;            // giorni: oltre, i guadagni si appiattiscono
const PROJ_MAX_SLOPE = 0.035;   // VDOT/giorno ≈ +1 al mese: tetto fisiologico
const PROJ_WINDOW = 180;        // la tendenza è quella del blocco in corso, non
                                // della stagione scorsa: uno stop di due mesi un
                                // anno fa non deve schiacciare la crescita di oggi
const PROJ_RATE_WINDOW = 90;    // su quanti giorni si misura il ritmo di XP

/** Un punto della curva: XP spesi da oggi → forma che ne esce. */
export interface ProjPoint { xp: number; vdot: number; sec5k: number; sec10k: number }
/** Un livello davanti a te: quanto costa e cosa ti restituisce. */
export interface LevelGain {
  level: number; xpNeeded: number; vdot: number; dVdot: number;
  t5k: string; t10k: string; thrPace: string; gain5k: number;
  days: number | null; sessions: number;
}
/** Un traguardo cronometrico, col suo prezzo in XP. */
export interface MilestoneCost {
  id: string; group: string; label: string; reqVdot: number;
  xpNeeded: number | null; level: number | null; days: number | null;
}
export interface Projection {
  ok: boolean;
  vdotNow: number;
  perMonth: number;                       // pendenza stimata, VDOT al mese
  trend: "up" | "flat" | "down";
  samples: number;                        // finestre usate dalla regressione
  xpPerDay: number;                       // ritmo attuale
  xpPerSession: number;                   // XP medi per seduta
  xpPerVdot: number | null;               // prezzo di un punto di VDOT, ora
  /** Misure reali: XP relativi a oggi (negativi) e tempo 5K di allora. */
  history: { xp: number; vdot: number; sec5k: number }[];
  points: ProjPoint[];
  levels: LevelGain[];
  milestones: MilestoneCost[];
  hotDelta5k: number;                     // secondi persi sui 5K con 20-30°C
}

const dayIndex = (d: string) => Math.floor(new Date(d.slice(0, 10) + "T00:00:00Z").getTime() / 86400000);

/**
 * Passo di soglia = velocità che regge un'ora di gara (critical speed a 60′),
 * lo stesso criterio usato nel resto dell'app. Si cerca la distanza che a quel
 * VDOT si copre in 3600 s e se ne ricava il passo al km.
 */
function thresholdPaceSec(vdot: number): number {
  let lo = 5000, hi = 25000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (predictSec(mid, vdot) < 3600) lo = mid; else hi = mid;
  }
  return 3600 / ((lo + hi) / 2 / 1000);
}

/** VDOT di una singola corsa, riportato a temperatura ideale. */
function runVdot(r: Run): number | null {
  if (r.is_treadmill) return null;
  const ps = paceToSec(r.avg_pace), dist = r.distance_km || 0;
  if (!ps || dist < 3 || dist > 25) return null;
  const coolPace = ps / (1 + heatSlowdownFrac(r.temperature, null, dist));
  return vdotFrom(dist * 1000, coolPace * dist);
}

/**
 * @param xpByDay XP guadagnati per giorno (chiave = indice giorno)
 * @param totalXp XP totali dell'atleta, livello compreso di bonus
 */
export function buildProjection(
  runs: Run[], xpByDay: Map<number, number>, totalXp: number, level: number,
): Projection {
  const empty: Projection = {
    ok: false, vdotNow: 0, perMonth: 0, trend: "flat", samples: 0,
    xpPerDay: 0, xpPerSession: 0, xpPerVdot: null,
    history: [], points: [], levels: [], milestones: [], hotDelta5k: 0,
  };
  const efforts = runs
    .map((r) => ({ day: dayIndex(r.date), vdot: runVdot(r) }))
    .filter((e): e is { day: number; vdot: number } => e.vdot != null);
  if (efforts.length < 3) return empty;

  const today = Math.max(...efforts.map((e) => e.day));
  // finestre di 30 giorni, ognuna col suo miglior effort
  const buckets = new Map<number, number>();
  for (const e of efforts) {
    const age = today - e.day;
    if (age > PROJ_WINDOW) continue;
    const b = Math.floor(age / 30);
    buckets.set(b, Math.max(buckets.get(b) ?? 0, e.vdot));
  }
  const history = [...buckets.entries()]
    .map(([b, vdot]) => ({ day: -(b * 30 + 15), vdot }))
    .sort((a, b) => a.day - b.day);
  if (history.length < 3) return empty;

  // regressione ai minimi quadrati: pendenza in VDOT/giorno
  const n = history.length;
  const mx = history.reduce((s, p) => s + p.day, 0) / n;
  const my = history.reduce((s, p) => s + p.vdot, 0) / n;
  const den = history.reduce((s, p) => s + (p.day - mx) ** 2, 0);
  const raw = den > 0 ? history.reduce((s, p) => s + (p.day - mx) * (p.vdot - my), 0) / den : 0;
  const slope = clamp(raw, -PROJ_MAX_SLOPE, PROJ_MAX_SLOPE);

  // Si parte dalla FORMA ATTUALE (miglior prova degli ultimi 90 giorni), non dal
  // primato di sempre: un 5000 corso un anno fa non è la base da cui proiettare.
  const recent = [0, 1, 2].map((b) => buckets.get(b) ?? 0).filter(Boolean);
  const vdotNow = recent.length ? Math.max(...recent) : estimateVdot(runs);
  // ── il cambio: quanti XP costa un punto di VDOT ──
  const xpIn = (fromDay: number) => {
    let s = 0;
    for (const [d, xp] of xpByDay) if (d > fromDay && d <= today) s += xp;
    return s;
  };
  const xpRecent = xpIn(today - PROJ_RATE_WINDOW);
  const xpPerDay = Math.max(1, xpRecent / PROJ_RATE_WINDOW);
  const sessions90 = [...xpByDay.keys()].filter((d) => d > today - PROJ_RATE_WINDOW && d <= today).length;
  const xpPerSession = sessions90 > 0 ? Math.round(xpRecent / sessions90) : Math.round(xpPerDay * 2);

  const gainCap = slope * PROJ_TAU;        // guadagno massimo di questo blocco
  const tauXp = xpPerDay * PROJ_TAU;       // XP che valgono una costante di tempo
  const at = (xp: number) => vdotNow + gainCap * (1 - Math.exp(-xp / tauXp));
  /** XP necessari per arrivare a un certo VDOT (null se fuori dall'asintoto). */
  const xpFor = (reqVdot: number): number | null => {
    if (reqVdot <= vdotNow) return 0;
    if (gainCap <= 0) return null;
    const k = (reqVdot - vdotNow) / gainCap;
    if (k >= 0.98) return null;            // l'asintoto non si tocca
    return Math.round(-tauXp * Math.log(1 - k));
  };

  // ── i prossimi 4 livelli: prezzo in XP e cosa restituiscono ──
  const levels: LevelGain[] = [];
  for (let l = level + 1; l <= Math.min(MAX_LEVEL, level + 4); l++) {
    const xpNeeded = Math.max(0, cumXpForLevel(l) - totalXp);
    const v = at(xpNeeded);
    levels.push({
      level: l, xpNeeded, vdot: Math.round(v * 10) / 10,
      dVdot: Math.round((v - vdotNow) * 100) / 100,
      t5k: fmtClock(predictSec(5000, v)), t10k: fmtClock(predictSec(10000, v)),
      thrPace: fmtClock(thresholdPaceSec(v)),
      gain5k: Math.round(predictSec(5000, vdotNow) - predictSec(5000, v)),
      days: xpPerDay > 0 ? Math.round(xpNeeded / xpPerDay) : null,
      sessions: Math.max(1, Math.round(xpNeeded / Math.max(1, xpPerSession))),
    });
  }

  // ── i traguardi cronometrici, col loro prezzo ──
  // solo 5K e 10K: sono le distanze che corre davvero a ritmo. Promettere una
  // maratona partendo da un VDOT stimato su prove corte sarebbe fuffa.
  const milestones: MilestoneCost[] = GOAL_DEFS
    .filter((g) => g.group === "5K" || g.group === "10K")
    .map((g) => ({ id: g.id, group: g.group, label: g.label, reqVdot: vdotFrom(g.m, g.sec) }))
    .filter((g) => g.reqVdot > vdotNow)
    .sort((a, b) => a.reqVdot - b.reqVdot)
    .slice(0, 4)
    .map((g) => {
      const xpNeeded = xpFor(g.reqVdot);
      return {
        ...g, reqVdot: Math.round(g.reqVdot * 10) / 10, xpNeeded,
        level: xpNeeded == null ? null : levelFromXp(totalXp + xpNeeded),
        days: xpNeeded == null ? null : Math.round(xpNeeded / xpPerDay),
      };
    });

  // ── curva: da oggi fino al 4° livello davanti (o al traguardo più caro) ──
  const xpMax = Math.max(
    levels[levels.length - 1]?.xpNeeded ?? 0,
    ...milestones.map((m) => m.xpNeeded ?? 0),
    Math.round(tauXp / 2),
  );
  const points: ProjPoint[] = [];
  for (let i = 0; i <= 30; i++) {
    const xp = (xpMax * i) / 30;
    const v = at(xp);
    points.push({ xp, vdot: v, sec5k: predictSec(5000, v), sec10k: predictSec(10000, v) });
  }

  // ── storico: quanti XP erano stati spesi quando la forma era quella ──
  const cumBefore = (day: number) => {
    let s = 0;
    for (const [d, xp] of xpByDay) if (d <= day) s += xp;
    return s;
  };
  const base5k = predictSec(5000, vdotNow);
  return {
    ok: true,
    vdotNow: Math.round(vdotNow * 10) / 10,
    perMonth: Math.round(slope * 30 * 100) / 100,
    trend: slope > 0.003 ? "up" : slope < -0.003 ? "down" : "flat",
    samples: n,
    xpPerDay: Math.round(xpPerDay),
    xpPerSession,
    xpPerVdot: slope > 0 ? Math.round(xpPerDay / slope) : null,
    history: history.map((h) => ({
      xp: cumBefore(today + h.day) - totalXp,   // negativo: XP spesi prima di oggi
      vdot: h.vdot, sec5k: predictSec(5000, h.vdot),
    })),
    points, levels, milestones,
    hotDelta5k: Math.round(base5k * heatSlowdownFrac(HOT_TEMP_C, HOT_HUMIDITY, 5)),
  };
}

// ══ TIPI ESPORTATI ════════════════════════════════════════════════════════════

export interface TierState {
  idx: number; name: string; color: string; icon: string; perk: string;
  levelStart: number; levelEnd: number; xpStart: number;
  state: "done" | "current" | "locked"; unlockedLevels: number;
}
export interface LevelNode { n: number; title: string; tierIdx: number; color: string; cumXp: number; reqXp: number; unlocked: boolean; current: boolean }
export interface RecentRun { date: string; name: string; type: string; km: number; xp: number; isPB: boolean; isRace: boolean }

export interface LevelSystem {
  ok: boolean;
  totalXp: number; level: number; maxLevel: number; title: string; tierIdx: number; tier: TierState;
  levelFloor: number; levelCeil: number; intoLevel: number; spanLevel: number; pct: number; xpToNext: number; maxed: boolean;
  tiers: TierState[]; levels: LevelNode[]; nextReward: TierState | null;
  currentVdot: number; projection: Projection; legend: XpExample[]; weekBonusXp: number;
  recent: RecentRun[];
  stats: { totalKm: number; totalRuns: number; totalHours: number };
}

// ── XP per corsa: durata · intensità · qualità ────────────────────────────────
const TYPE_INT: Record<string, number> = {
  intervals: 0.92, repetition: 0.95, vo2max: 0.93, tempo: 0.88, threshold: 0.88,
  fartlek: 0.82, progression: 0.80, long: 0.72, easy: 0.66, recovery: 0.55, race: 0.96, trail: 0.75, workout: 0.82,
};
const paceToSec = (p?: string | null): number | null => {
  if (!p || !p.includes(":")) return null;
  const [m, s] = p.split(":"); const v = +m * 60 + +s; return v > 0 ? v : null;
};

/** Run-id che detengono un personal best (bonus qualità). */
function pbIds(runs: Run[]): Set<string> {
  const ids = new Set<string>();
  const holder = (metric: (r: Run) => number | null, mode: "min" | "max") => {
    let best: number | null = null, id: string | null = null;
    for (const r of runs) {
      const v = metric(r); if (v == null) continue;
      if (best == null || (mode === "min" ? v < best : v > best)) { best = v; id = r.id; }
    }
    if (id) ids.add(id);
  };
  holder((r) => { const ps = paceToSec(r.avg_pace); return ps && r.distance_km >= 4.5 && r.distance_km <= 5.5 ? ps : null; }, "min"); // 5K
  holder((r) => { const ps = paceToSec(r.avg_pace); return ps && r.distance_km >= 9 && r.distance_km <= 11 ? ps : null; }, "min");    // 10K
  holder((r) => r.distance_km || null, "max");                                                                                        // più lunga
  holder((r) => { const ps = paceToSec(r.avg_pace); return ps && r.distance_km >= 3 ? ps : null; }, "min");                           // più veloce
  return ids;
}

/** Passo migliore sostenuto (sec/km, corse ≥3 km) — riferimento per stimare
 *  l'intensità quando manca la frequenza cardiaca. */
function bestSustainedPaceSec(runs: Run[]): number | null {
  let best: number | null = null;
  for (const r of runs) {
    if (r.is_treadmill) continue;
    const ps = paceToSec(r.avg_pace);
    if (ps && (r.distance_km || 0) >= 3) best = best == null ? ps : Math.min(best, ps);
  }
  return best;
}

/** Intensità ∈ [0.5, 1]: FC% se disponibile (gold standard); altrimenti stima
 *  dal passo relativo al proprio migliore; altrimenti fallback sul tipo seduta. */
function intensityOf(r: Run, bestPaceSec: number | null): number {
  if (r.avg_hr_pct) return clamp(r.avg_hr_pct / 100, 0.5, 1);
  const ps = paceToSec(r.avg_pace);
  if (ps && bestPaceSec && ps > 0) {
    const ratio = bestPaceSec / ps; // 1 = al proprio meglio, <1 = più lento
    return clamp(0.65 + (ratio - 0.75) * 1.2, 0.5, 1);
  }
  return TYPE_INT[(r.run_type ?? "easy").toLowerCase()] ?? 0.7;
}

/**
 * Le cinque zone di lavoro. Il moltiplicatore è per MINUTO: un'ora di lento e
 * dieci minuti di ripetute non possono valere uguale, ma il bonus di seduta fa
 * sì che una prova corta e dura resti una seduta importante e non una briciola.
 */
export interface XpZone { id: string; name: string; color: string; perMin: number; bonus: number; hint: string }
export const XP_ZONES: XpZone[] = [
  { id: "recovery", name: "Recupero", color: "#A78BFA", perMin: 0.35, bonus: 0, hint: "corsa rigenerante, sotto il lento" },
  { id: "easy", name: "Lento", color: "#22D3EE", perMin: 0.6, bonus: 0, hint: "il fondo aerobico, la base di tutto" },
  { id: "medium", name: "Medio", color: "#A3E635", perMin: 1.1, bonus: 0, hint: "andatura controllata, sotto soglia" },
  { id: "threshold", name: "Soglia", color: "#FBBF24", perMin: 1.7, bonus: 35, hint: "tempo run e ritmo gara lunga" },
  { id: "vo2", name: "Ripetute", color: "#F43F5E", perMin: 2.4, bonus: 70, hint: "VO2max, ripetute, prove a tutta" },
];
export const XP_BONUS = { pb: 70, race: 100, week35: 110, week50: 160 };

/** Confini di zona: FC% quando c'è, altrimenti passo relativo al proprio meglio. */
function zoneOf(r: Run, bestPaceSec: number | null): XpZone {
  if (r.avg_hr_pct) {
    const h = r.avg_hr_pct;
    return XP_ZONES[h < 70 ? 0 : h < 79 ? 1 : h < 85 ? 2 : h < 91 ? 3 : 4];
  }
  const ps = paceToSec(r.avg_pace);
  if (ps && bestPaceSec) {
    const q = bestPaceSec / ps; // 1 = al proprio massimo sostenuto
    return XP_ZONES[q < 0.68 ? 0 : q < 0.78 ? 1 : q < 0.86 ? 2 : q < 0.93 ? 3 : 4];
  }
  const i = intensityOf(r, bestPaceSec);
  return XP_ZONES[i < 0.62 ? 0 : i < 0.72 ? 1 : i < 0.8 ? 2 : i < 0.88 ? 3 : 4];
}

/** XP di una corsa: minuti nella sua zona + km, più i bonus di seduta. */
function runXp(r: Run, isPB: boolean, bestPaceSec: number | null): number {
  const dur = r.duration_minutes || 0, dist = r.distance_km || 0;
  const z = zoneOf(r, bestPaceSec);
  const isRace = (r.run_type ?? "").toLowerCase() === "race" || !!r.event;
  let xp = dur * z.perMin + dist * 3;
  if (dur >= 12) xp += z.bonus;
  if (isRace) xp += XP_BONUS.race;
  else if (isPB) xp += XP_BONUS.pb;
  return Math.max(1, Math.round(xp));
}

/**
 * Bonus di costanza: una settimana piena vale più della somma delle sue corse.
 * Restituisce anche a che giorno accreditarlo (l'ultima corsa della settimana),
 * così la linea del tempo degli XP resta coerente con il totale.
 */
function weeklyBonuses(runs: Run[]): { total: number; byDay: Map<number, number> } {
  const km: Record<string, number> = {};
  const lastDay: Record<string, number> = {};
  for (const r of runs) {
    const dt = new Date(r.date.slice(0, 10) + "T00:00:00Z");
    dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
    const k = dt.toISOString().slice(0, 10);
    km[k] = (km[k] || 0) + (r.distance_km || 0);
    lastDay[k] = Math.max(lastDay[k] ?? -Infinity, dayIndex(r.date));
  }
  const byDay = new Map<number, number>();
  let total = 0;
  for (const [k, v] of Object.entries(km)) {
    const bonus = v >= 50 ? XP_BONUS.week50 : v >= 35 ? XP_BONUS.week35 : 0;
    if (!bonus) continue;
    total += bonus;
    byDay.set(lastDay[k], (byDay.get(lastDay[k]) ?? 0) + bonus);
  }
  return { total, byDay };
}

/** Righe della leggenda: esempi calcolati con la formula vera, sui suoi ritmi. */
export interface XpExample { zone: XpZone; label: string; detail: string; xp: number }
export function buildXpLegend(runs: Run[]): XpExample[] {
  const best = bestSustainedPaceSec(runs) ?? 240;
  const fmtPace = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec) % 60).padStart(2, "0")}`;
  // un esempio per zona, al passo che quella zona vale PER LUI
  const specs: { zi: number; q: number; km: number; label: (p: string) => string }[] = [
    { zi: 4, q: 0.99, km: 3, label: (p) => `3 km di ripetute a ${p}/km` },
    { zi: 3, q: 0.90, km: 8, label: (p) => `8 km in soglia a ${p}/km` },
    { zi: 2, q: 0.82, km: 10, label: (p) => `10 km in medio a ${p}/km` },
    { zi: 1, q: 0.73, km: 15, label: (p) => `15 km lenti a ${p}/km` },
    { zi: 0, q: 0.63, km: 8, label: (p) => `8 km di recupero a ${p}/km` },
  ];
  return specs.map(({ zi, q, km, label }) => {
    const zone = XP_ZONES[zi];
    const paceSec = best / q;
    const min = (paceSec * km) / 60;
    const xp = Math.round(min * zone.perMin + km * 3 + (min >= 12 ? zone.bonus : 0));
    return { zone, label: label(fmtPace(paceSec)), detail: `${Math.round(min)} min · ${zone.perMin} XP/min`, xp };
  });
}

// ══ ENGINE ════════════════════════════════════════════════════════════════════

const EMPTY: LevelSystem = {
  ok: false, totalXp: 0, level: 1, maxLevel: MAX_LEVEL, title: levelTitle(1), tierIdx: 0,
  tier: { idx: 0, ...TIER_DEFS[0], levelStart: 1, levelEnd: 10, xpStart: 0, state: "current", unlockedLevels: 0 },
  levelFloor: 0, levelCeil: cumXpForLevel(2), intoLevel: 0, spanLevel: cumXpForLevel(2), pct: 0, xpToNext: cumXpForLevel(2), maxed: false,
  tiers: [], levels: [], nextReward: null, currentVdot: 0,
  projection: {
    ok: false, vdotNow: 0, perMonth: 0, trend: "flat", samples: 0,
    xpPerDay: 0, xpPerSession: 0, xpPerVdot: null,
    history: [], points: [], levels: [], milestones: [], hotDelta5k: 0,
  },
  legend: [], weekBonusXp: 0, recent: [], stats: { totalKm: 0, totalRuns: 0, totalHours: 0 },
};

export function computeLevelSystem(runsIn: Run[], _profile: Profile | null): LevelSystem {
  // stessa igiene dei badge: avvii per sbaglio e glitch GPS non sono allenamenti
  const runs = (runsIn ?? []).filter((r) => (r.distance_km || 0) >= 0.5 && (r.duration_minutes || 0) >= 3);
  if (runs.length === 0) return EMPTY;

  const pb = pbIds(runs);
  const bestPaceSec = bestSustainedPaceSec(runs);
  let totalXp = 0, totalKm = 0, totalMin = 0;
  // linea del tempo degli XP: serve alla proiezione per sapere a che ritmo
  // l'atleta accumula e quanto gli è costato arrivare alla forma di oggi
  const xpByDay = new Map<number, number>();
  for (const r of runs) {
    const xp = runXp(r, pb.has(r.id), bestPaceSec);
    totalXp += xp;
    const d = dayIndex(r.date);
    xpByDay.set(d, (xpByDay.get(d) ?? 0) + xp);
    totalKm += r.distance_km || 0;
    totalMin += r.duration_minutes || 0;
  }
  const week = weeklyBonuses(runs);
  for (const [d, xp] of week.byDay) xpByDay.set(d, (xpByDay.get(d) ?? 0) + xp);
  const weekBonusXp = week.total;
  totalXp = Math.round(totalXp + weekBonusXp);

  const level = levelFromXp(totalXp);
  const maxed = level >= MAX_LEVEL;
  const levelFloor = cumXpForLevel(level);
  const levelCeil = maxed ? levelFloor : cumXpForLevel(level + 1);
  const intoLevel = Math.max(0, totalXp - levelFloor);
  const spanLevel = Math.max(1, levelCeil - levelFloor);
  const pct = maxed ? 100 : clamp(Math.round((intoLevel / spanLevel) * 100), 0, 100);
  const xpToNext = maxed ? 0 : Math.max(0, levelCeil - totalXp);

  // gradi
  const tierIdx = tierIdxOf(level);
  const tiers: TierState[] = TIER_DEFS.map((t, i) => {
    const levelStart = i * 10 + 1, levelEnd = i * 10 + 10;
    const state: TierState["state"] = level > levelEnd ? "done" : level >= levelStart ? "current" : "locked";
    const unlockedLevels = clamp(level - levelStart + 1, 0, 10);
    return { idx: i, name: t.name, color: t.color, icon: t.icon, perk: t.perk, levelStart, levelEnd, xpStart: cumXpForLevel(levelStart), state, unlockedLevels };
  });
  const nextReward = tiers.find((t) => t.state === "locked") ?? null;

  // forma attuale + proiezione ("se continui così, fra 30 giorni…").
  // Il VDOT mostrato è quello della proiezione (forma recente): un solo numero
  // in pagina, altrimenti il chip in alto e il grafico raccontano storie diverse.
  const projection = buildProjection(runs, xpByDay, totalXp, level);
  const currentVdot = projection.ok ? projection.vdotNow : estimateVdot(runs);
  const legend = buildXpLegend(runs);

  // 100 livelli
  const levels: LevelNode[] = [];
  for (let n = 1; n <= MAX_LEVEL; n++) {
    const cum = cumXpForLevel(n);
    const req = n < MAX_LEVEL ? cumXpForLevel(n + 1) - cum : 0;
    levels.push({ n, title: levelTitle(n), tierIdx: tierIdxOf(n), color: TIER_DEFS[tierIdxOf(n)].color, cumXp: cum, reqXp: req, unlocked: n <= level, current: n === level });
  }

  // ultime corse → XP guadagnati (gratificazione post-sync)
  const recent: RecentRun[] = [...runs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((r) => {
    const isRace = (r.run_type ?? "").toLowerCase() === "race" || !!r.event;
    return { date: r.date.slice(0, 10), name: r.name ?? "Corsa", type: (r.run_type ?? "easy").toLowerCase(), km: Math.round((r.distance_km || 0) * 10) / 10, xp: runXp(r, pb.has(r.id), bestPaceSec), isPB: pb.has(r.id), isRace };
  });

  return {
    ok: true, totalXp, level, maxLevel: MAX_LEVEL, title: levelTitle(level), tierIdx, tier: tiers[tierIdx],
    levelFloor, levelCeil, intoLevel, spanLevel, pct, xpToNext, maxed,
    tiers, levels, nextReward, currentVdot: Math.round(currentVdot * 10) / 10,
    projection, legend, weekBonusXp, recent,
    stats: { totalKm: Math.round(totalKm), totalRuns: runs.length, totalHours: Math.round(totalMin / 60) },
  };
}
