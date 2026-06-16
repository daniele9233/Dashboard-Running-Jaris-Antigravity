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
  tiers: [], levels: [], nextReward: null, recent: [], stats: { totalKm: 0, totalRuns: 0, totalHours: 0 },
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
    tiers, levels, nextReward, recent,
    stats: { totalKm: Math.round(totalKm), totalRuns: runs.length, totalHours: Math.round(totalMin / 60) },
  };
}
