import type { Run } from "../../types/api";
import { buildMetrics, type Metrics } from "../celebrations/badgeRules";

/**
 * Motore statistiche condiviso dai 3 sistemi di gamification.
 * Deriva livello/XP, 5 attributi (0–100), streak corrente, volumi settimana/mese
 * e quest dai dati reali delle corse. Riusa buildMetrics (stesso del valutatore
 * badge) così le tre viste parlano degli stessi numeri.
 */

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const paceToSec = (p?: string | null): number | null => {
  if (!p || !p.includes(":")) return null;
  const [m, s] = p.split(":");
  const v = parseInt(m, 10) * 60 + parseInt(s, 10);
  return v > 0 ? v : null;
};
const dayNum = (d: string) => Math.floor(new Date(d.slice(0, 10) + "T00:00:00Z").getTime() / 86400000);

const RANKS = [
  "Novizio", "Apprendista", "Corridore", "Atleta", "Battistrada",
  "Veterano", "Specialista", "Campione", "Élite", "Maestro", "Leggenda",
];

export interface GamiAttrs {
  resistenza: number; velocita: number; costanza: number; potenza: number; cuore: number;
}
export interface RecentXp { date: string; km: number; pace: string; xp: number }

export interface GamiStats {
  m: Metrics;
  totalXp: number;
  level: number;
  xpInLevel: number;
  xpToNext: number;
  rank: string;
  attrs: GamiAttrs;
  overall: number;
  currentStreak: number;
  activeDays30: number;
  weekKm: number;
  weekRuns: number;
  weekLong: number;     // corsa più lunga della settimana
  monthKm: number;
  recent: RecentXp[];
  bestPaceSecKm: number | null;
}

/** XP cumulativi per RAGGIUNGERE un livello (livello parte da 1 a 0 XP). */
function xpThreshold(level: number): number {
  let c = 0;
  for (let l = 1; l < level; l++) c += 250 * l;
  return c;
}
function levelFromXp(xp: number): number {
  let l = 1;
  while (xpThreshold(l + 1) <= xp) l++;
  return l;
}
/** XP di una singola corsa (per il feed "ultimi guadagni"). */
export const runXp = (km: number) => Math.round(km * 10 + 40);

export function computeStats(runs: Run[]): GamiStats {
  const m = buildMetrics(runs);
  const totalXp = Math.round(m.totalKm * 10 + m.totalRuns * 40);
  const level = levelFromXp(totalXp);
  const cur = xpThreshold(level);
  const next = xpThreshold(level + 1);

  // Passo migliore (sec/km) dalla distanza disponibile
  const bestPaceSecKm = m.best5k != null ? m.best5k / 5 : m.best10k != null ? m.best10k / 10 : null;

  // Attributi 0–100
  const velocita = bestPaceSecKm == null ? 25 : clamp(((360 - bestPaceSecKm) / (360 - 180)) * 100);
  const resistenza = clamp((m.longestRunKm / 42) * 100);
  const costanza = clamp((m.maxStreak / 30) * 65 + Math.min(35, (m.totalRuns / 200) * 35));
  const potenza = clamp((((m.maxCadence ?? 150) - 150) / 40) * 60 + Math.min(40, ((m.maxElev ?? 0) / 600) * 40));
  const cuore = clamp(((resistenza + velocita) / 2) * 0.9 + Math.min(12, (m.weeklyMaxKm / 80) * 12));
  const attrs: GamiAttrs = {
    resistenza: Math.round(resistenza), velocita: Math.round(velocita),
    costanza: Math.round(costanza), potenza: Math.round(potenza), cuore: Math.round(cuore),
  };
  const overall = Math.round((attrs.resistenza + attrs.velocita + attrs.costanza + attrs.potenza + attrs.cuore) / 5);

  // Giorni attivi, streak corrente, settimana/mese correnti
  const today = dayNum(new Date().toISOString());
  const days = [...new Set(runs.map((r) => dayNum(r.date)))].sort((a, b) => b - a);
  let currentStreak = 0;
  if (days.length && today - days[0] <= 1) {
    currentStreak = 1;
    for (let i = 1; i < days.length; i++) {
      if (days[i - 1] - days[i] === 1) currentStreak++;
      else break;
    }
  }
  const activeDays30 = days.filter((d) => today - d < 30).length;

  // Settimana ISO corrente (lunedì) e mese corrente
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const mondayNum = Math.floor(monday.getTime() / 86400000);
  const monthKey = now.toISOString().slice(0, 7);

  let weekKm = 0, weekRuns = 0, weekLong = 0, monthKm = 0;
  for (const r of runs) {
    const dn = dayNum(r.date);
    const dist = r.distance_km || 0;
    if (dn >= mondayNum) { weekKm += dist; weekRuns++; weekLong = Math.max(weekLong, dist); }
    if (r.date.slice(0, 7) === monthKey) monthKm += dist;
  }

  const recent: RecentXp[] = [...runs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6)
    .map((r) => ({ date: r.date.slice(0, 10), km: r.distance_km || 0, pace: r.avg_pace || "—", xp: runXp(r.distance_km || 0) }));

  return {
    m, totalXp, level, xpInLevel: totalXp - cur, xpToNext: next - cur, rank: RANKS[clamp(Math.floor((level - 1) / 2), 0, RANKS.length - 1)],
    attrs, overall, currentStreak, activeDays30, weekKm, weekRuns, weekLong, monthKm, recent, bestPaceSecKm,
  };
}

export const fmtPace = (secKm: number | null) =>
  secKm == null ? "—" : `${Math.floor(secKm / 60)}:${String(Math.round(secKm % 60)).padStart(2, "0")}`;
