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
/** VDOT corrente stimato dal miglior effort reale (corse ≥3 km). */
function estimateVdot(runs: Run[]): number {
  let best = 0;
  for (const r of runs) {
    if (r.is_treadmill) continue;
    const ps = paceToSec(r.avg_pace); const dist = r.distance_km || 0;
    if (!ps || dist < 3 || dist > 25) continue;
    best = Math.max(best, vdotFrom(dist * 1000, ps * dist));
  }
  return best ? clamp(best, 25, 80) : 38;
}
const fmtClock = (sec: number): string => {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};

// ── 20 obiettivi (distanza · tempo) ───────────────────────────────────────────
interface GoalDef { id: string; group: string; label: string; m: number; sec: number }
const GOAL_DEFS: GoalDef[] = [
  { id: "5k-30",  group: "5K", label: "5K Sub 30'", m: 5000, sec: 1800 },
  { id: "5k-25",  group: "5K", label: "5K Sub 25'", m: 5000, sec: 1500 },
  { id: "5k-22",  group: "5K", label: "5K Sub 22'", m: 5000, sec: 1320 },
  { id: "5k-20",  group: "5K", label: "5K Sub 20'", m: 5000, sec: 1200 },
  { id: "5k-18",  group: "5K", label: "5K Sub 18'", m: 5000, sec: 1080 },
  { id: "10k-55", group: "10K", label: "10K Sub 55'", m: 10000, sec: 3300 },
  { id: "10k-50", group: "10K", label: "10K Sub 50'", m: 10000, sec: 3000 },
  { id: "10k-45", group: "10K", label: "10K Sub 45'", m: 10000, sec: 2700 },
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
const GOAL_SLOPE = 3.5; // livelli stimati per punto di VDOT oltre la forma attuale

export interface GoalState {
  id: string; group: string; label: string; reqVdot: number; recLevel: number;
  xpReq: number; xpGap: number; achieved: boolean; predicted: string; gapLabel: string; progress: number;
}

function buildGoals(currentVdot: number, currentLevel: number, totalXp: number): GoalState[] {
  return GOAL_DEFS.map((g) => {
    const reqVdot = vdotFrom(g.m, g.sec);
    const achieved = currentVdot >= reqVdot;
    const recLevel = clamp(Math.round(currentLevel + (reqVdot - currentVdot) * GOAL_SLOPE), 1, MAX_LEVEL);
    const xpReq = cumXpForLevel(recLevel);
    const xpGap = Math.max(0, xpReq - totalXp);
    const predicted = predictSec(g.m, currentVdot);
    const gap = predicted - g.sec;
    return {
      id: g.id, group: g.group, label: g.label, reqVdot: Math.round(reqVdot * 10) / 10, recLevel, xpReq, xpGap,
      achieved, predicted: fmtClock(predicted), gapLabel: (gap <= 0 ? "−" : "+") + fmtClock(Math.abs(gap)),
      progress: achieved ? 100 : clamp(Math.round((totalXp / Math.max(1, xpReq)) * 100), 1, 99),
    };
  }).sort((a, b) => a.reqVdot - b.reqVdot);
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
  goals: GoalState[]; goalsAchieved: number; currentVdot: number;
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

function runXp(r: Run, isPB: boolean): number {
  const dur = r.duration_minutes || 0, dist = r.distance_km || 0;
  const intensity = r.avg_hr_pct ? clamp(r.avg_hr_pct / 100, 0.5, 1) : (TYPE_INT[(r.run_type ?? "easy").toLowerCase()] ?? 0.7);
  const isRace = (r.run_type ?? "").toLowerCase() === "race" || !!r.event;
  let xp = dur * (0.6 + intensity) + dist * 2.5;
  if (isRace) xp += 80; else if (isPB) xp += 60; else if (intensity >= 0.85 && dur >= 20) xp += 20;
  return Math.max(1, Math.round(xp));
}

// ══ ENGINE ════════════════════════════════════════════════════════════════════

const EMPTY: LevelSystem = {
  ok: false, totalXp: 0, level: 1, maxLevel: MAX_LEVEL, title: levelTitle(1), tierIdx: 0,
  tier: { idx: 0, ...TIER_DEFS[0], levelStart: 1, levelEnd: 10, xpStart: 0, state: "current", unlockedLevels: 0 },
  levelFloor: 0, levelCeil: cumXpForLevel(2), intoLevel: 0, spanLevel: cumXpForLevel(2), pct: 0, xpToNext: cumXpForLevel(2), maxed: false,
  tiers: [], levels: [], nextReward: null, goals: [], goalsAchieved: 0, currentVdot: 0, recent: [], stats: { totalKm: 0, totalRuns: 0, totalHours: 0 },
};

export function computeLevelSystem(runsIn: Run[], _profile: Profile | null): LevelSystem {
  const runs = (runsIn ?? []).filter((r) => (r.distance_km || 0) > 0.3);
  if (runs.length === 0) return EMPTY;

  const pb = pbIds(runs);
  let totalXp = 0, totalKm = 0, totalMin = 0;
  for (const r of runs) { totalXp += runXp(r, pb.has(r.id)); totalKm += r.distance_km || 0; totalMin += r.duration_minutes || 0; }
  totalXp = Math.round(totalXp);

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

  // obiettivi: mostra SOLO quelli ancora da raggiungere (esclude quelli già alla portata)
  const currentVdot = estimateVdot(runs);
  const allGoals = buildGoals(currentVdot, level, totalXp);
  const goalsAchieved = allGoals.filter((g) => g.achieved).length;
  const goals = allGoals.filter((g) => !g.achieved);

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
    return { date: r.date.slice(0, 10), name: r.name ?? "Corsa", type: (r.run_type ?? "easy").toLowerCase(), km: Math.round((r.distance_km || 0) * 10) / 10, xp: runXp(r, pb.has(r.id)), isPB: pb.has(r.id), isRace };
  });

  return {
    ok: true, totalXp, level, maxLevel: MAX_LEVEL, title: levelTitle(level), tierIdx, tier: tiers[tierIdx],
    levelFloor, levelCeil, intoLevel, spanLevel, pct, xpToNext, maxed,
    tiers, levels, nextReward, goals, goalsAchieved, currentVdot: Math.round(currentVdot * 10) / 10, recent,
    stats: { totalKm: Math.round(totalKm), totalRuns: runs.length, totalHours: Math.round(totalMin / 60) },
  };
}
