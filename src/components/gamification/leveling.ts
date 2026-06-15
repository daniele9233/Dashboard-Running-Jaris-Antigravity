import type { Run } from "../../types/api";

/**
 * Sistema di livelli scientifico per la modalità ASCESA.
 *
 * Ogni corsa genera XP in base allo sforzo e a TRE assi di adattamento
 * fisiologico — Neuromuscolare, Metabolico, Strutturale. Gli XP di una corsa
 * sono moltiplicati da un "fattore di prossimità": più la corsa costruisce gli
 * adattamenti richiesti dall'obiettivo scelto, più XP rende (picco di forma).
 *
 * Detraining: dopo una finestra di tolleranza di 2 giorni, gli XP decadono
 * giorno per giorno per simulare la perdita di condizione.
 */

export type Axis = "nm" | "met" | "str";

interface RunProfile { base: number; nm: number; met: number; str: number; label: string }

// Profilo per tipo di corsa (run_type del backend) — sforzo + impatto sui 3 assi.
// nm=neuromuscolare (reclutamento fibre/efficienza), met=metabolico (soglia,
// mitocondri), str=strutturale (tendini, capillarizzazione).
const RUN_PROFILE: Record<string, RunProfile> = {
  intervals: { base: 110, nm: 0.95, met: 0.70, str: 0.30, label: "Ripetute" },
  tempo:     { base: 80,  nm: 0.45, met: 0.95, str: 0.40, label: "Tempo / Soglia" },
  long:      { base: 70,  nm: 0.20, met: 0.60, str: 0.95, label: "Lungo" },
  easy:      { base: 38,  nm: 0.25, met: 0.45, str: 0.65, label: "Fondo facile" },
  recovery:  { base: 20,  nm: 0.10, met: 0.25, str: 0.45, label: "Rigenerante" },
};
const profileOf = (t?: string): RunProfile => RUN_PROFILE[t ?? "easy"] ?? RUN_PROFILE.easy;
export const RUN_LABELS = RUN_PROFILE;

export interface Goal { id: string; label: string; xp: number; w: Record<Axis, number>; hint: string }

// Obiettivi: ogni traguardo richiede un MIX di adattamenti diverso. La soglia
// XP cresce con la difficoltà: ci si avvicina ma il picco di forma va meritato.
export const GOALS: Goal[] = [
  { id: "5k-sub20", label: "5K Sub 20′", xp: 46000, w: { nm: 0.35, met: 0.45, str: 0.20 }, hint: "Velocità di soglia + brillantezza neuromuscolare" },
  { id: "10k-sub45", label: "10K Sub 45′", xp: 62000, w: { nm: 0.25, met: 0.50, str: 0.25 }, hint: "Soglia anaerobica solida + resistenza" },
  { id: "half-sub145", label: "Mezza Sub 1:45", xp: 95000, w: { nm: 0.15, met: 0.45, str: 0.40 }, hint: "Resistenza alla soglia + tenuta strutturale" },
  { id: "marathon", label: "Maratona", xp: 150000, w: { nm: 0.10, met: 0.40, str: 0.50 }, hint: "Capillarizzazione, efficienza, volume" },
];

// ── PB: quali run detengono i record (bonus XP) ───────────────────────────────
type RunX = Run & { best_1000m_sec?: number | null; best_2000m_sec?: number | null; best_3000m_sec?: number | null; best_5000m_sec?: number | null };
const paceSec = (p?: string | null) => { if (!p || !p.includes(":")) return null; const [m, s] = p.split(":"); const v = +m * 60 + +s; return v > 0 ? v : null; };

function pbBonusMap(runs: Run[]): Record<string, number> {
  const rx = runs as RunX[];
  const bonus: Record<string, number> = {};
  const holders: { metric: (r: RunX) => number | null; xp: number }[] = [
    { metric: (r) => r.best_1000m_sec ?? null, xp: 150 },           // PB sul 1 km
    { metric: (r) => r.best_3000m_sec ?? null, xp: 130 },
    { metric: (r) => { const ps = paceSec(r.avg_pace); return ps && r.distance_km >= 4.5 && r.distance_km <= 5.5 ? ps * 5 : null; }, xp: 180 }, // PB 5K
    { metric: (r) => { const ps = paceSec(r.avg_pace); return ps && r.distance_km >= 9 && r.distance_km <= 11 ? ps * 10 : null; }, xp: 200 },  // PB 10K
    { metric: (r) => r.distance_km || null, xp: 120 },              // corsa più lunga
  ];
  for (const h of holders) {
    let bestVal: number | null = null; let bestId: string | null = null;
    for (const r of rx) {
      const v = h.metric(r);
      if (v == null) continue;
      const better = h.xp === 120 ? (bestVal == null || v > bestVal) : (bestVal == null || v < bestVal); // longest = max, tempi = min
      if (better) { bestVal = v; bestId = r.id; }
    }
    if (bestId) bonus[bestId] = (bonus[bestId] ?? 0) + h.xp;
  }
  return bonus;
}

// ── XP "base" di una corsa (indipendente dall'obiettivo) → alimenta il livello ─
export function baseRunXp(r: Run, pbBonus = 0): number {
  const p = profileOf(r.run_type);
  let base = p.base + (r.distance_km || 0) * 4;
  if ((r.run_type === "long" || r.run_type === "easy") && (r.duration_minutes || 0) > 60) base += (r.duration_minutes - 60) * 0.8;
  return base + pbBonus;
}

// Fattore di prossimità: quanto la corsa costruisce gli adattamenti dell'obiettivo.
export function proximity(r: Run, goal: Goal): number {
  const p = profileOf(r.run_type);
  const match = p.nm * goal.w.nm + p.met * goal.w.met + p.str * goal.w.str; // ~0.2..0.7
  return 0.65 + match * 0.8; // ~0.8..1.25
}

// ── Livelli: alta granularità (level = 0.25·√xp) ──────────────────────────────
export const levelFromXp = (xp: number) => Math.floor(0.25 * Math.sqrt(Math.max(0, xp))) + 1;
export const xpForLevel = (l: number) => 16 * (l - 1) ** 2;

const dayNum = (d: string) => Math.floor(new Date(d.slice(0, 10) + "T00:00:00Z").getTime() / 86400000);

export interface Leveling {
  rawXp: number;
  xp: number;            // dopo detraining
  level: number;
  levelFloor: number;
  levelCeil: number;
  levelPct: number;
  goal: Goal;
  goalPct: number;
  xpToGoal: number;
  nearGoal: boolean;
  balance: Record<Axis, number>;   // % composizione stimolo (somma 100)
  goalMatch: number;               // 0..100 quanto il tuo mix combacia con l'obiettivo
  daysInactive: number;
  retention: number;               // 0..1
  dailyDecay: number;              // XP persi al giorno se resti fermo
  recent: { date: string; type: string; label: string; xp: number; km: number }[];
}

export function computeLeveling(runs: Run[], goalId: string): Leveling {
  const goal = GOALS.find((g) => g.id === goalId) ?? GOALS[0];
  const pb = pbBonusMap(runs);

  let baseXp = 0, goalXp = 0;
  const acc = { nm: 0, met: 0, str: 0 };
  for (const r of runs) {
    const b = baseRunXp(r, pb[r.id] ?? 0);
    baseXp += b;
    goalXp += b * proximity(r, goal);
    const p = profileOf(r.run_type);
    const eff = p.base + (r.distance_km || 0) * 4;
    acc.nm += eff * p.nm; acc.met += eff * p.met; acc.str += eff * p.str;
  }

  const tot = acc.nm + acc.met + acc.str || 1;
  const balance: Record<Axis, number> = { nm: Math.round((acc.nm / tot) * 100), met: Math.round((acc.met / tot) * 100), str: Math.round((acc.str / tot) * 100) };
  const gd = Math.abs(balance.nm / 100 - goal.w.nm) + Math.abs(balance.met / 100 - goal.w.met) + Math.abs(balance.str / 100 - goal.w.str);
  const goalMatch = Math.round(Math.max(0, 1 - gd / 2) * 100);

  // Detraining
  const today = dayNum(new Date().toISOString());
  const lastDay = runs.length ? Math.max(...runs.map((r) => dayNum(r.date))) : today;
  const daysInactive = Math.max(0, today - lastDay);
  const retention = daysInactive <= 2 ? 1 : Math.pow(0.985, daysInactive - 2);

  const xp = Math.round(baseXp * retention);            // livello (indipendente dall'obiettivo)
  const goalXpEff = Math.round(goalXp * retention);     // forma verso l'obiettivo
  const rawXp = Math.round(baseXp);
  const dailyDecay = daysInactive >= 2 ? Math.round(xp * 0.015) : 0;

  const level = levelFromXp(xp);
  const levelFloor = xpForLevel(level);
  const levelCeil = xpForLevel(level + 1);
  const levelPct = Math.round(((xp - levelFloor) / (levelCeil - levelFloor || 1)) * 100);

  const goalPct = Math.min(100, Math.round((goalXpEff / goal.xp) * 100));
  const xpToGoal = Math.max(0, goal.xp - goalXpEff);
  const nearGoal = goalPct >= 80 && goalPct < 100;

  const recent = [...runs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map((r) => ({
    date: r.date.slice(0, 10), type: r.run_type, label: profileOf(r.run_type).label,
    xp: Math.round(baseRunXp(r, pb[r.id] ?? 0)), km: r.distance_km || 0,
  }));

  return { rawXp, xp, level, levelFloor, levelCeil, levelPct, goal, goalPct, xpToGoal, nearGoal, balance, goalMatch, daysInactive, retention, dailyDecay, recent };
}
