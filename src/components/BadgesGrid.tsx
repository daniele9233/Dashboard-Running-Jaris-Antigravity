import { useMemo } from "react";
import { Trophy, Flame, TrendingUp, Dumbbell, Target, Brain, Zap, PartyPopper, Bird, Lock } from "lucide-react";
import type { Run } from "../types/api";

// ─── Badge Definitions ───────────────────────────────────────────────────────

interface BadgeDef {
  id: string;
  category: string;
  name: string;
  desc: string;
  icon: string;
  check: (ctx: BadgeContext) => boolean;
  progress?: (ctx: BadgeContext) => number;
  target?: number;
}

interface BadgeContext {
  totalKm: number;
  totalRuns: number;
  vdot: number;
  vdotPeak: number;
  vdotDelta: number;
  best5k: number | null; // seconds
  best10k: number | null;
  bestHalf: number | null;
  bestMarathon: number | null;
  longestRun: number;
  maxWeeklyKm: number;
  maxStreak: number;
  currentStreak: number;
  runsWithHr: number;
  polarizedPct: number; // % in Z1+Z2
  avgCadence: number;
  injuryRisk: number;
  runs: Run[];
  weeksActive: number;
  firstRunDate: string;
  lastRunDate: string;
  hasIntervals: boolean;
  hasHills: boolean;
  hasProgressive: boolean;
  hasNegativeSplit: boolean;
  hasBackToBack: boolean;
  hasDoubleDay: boolean;
  hasEarlyMorning: boolean; // before 7am
  hasNightRun: boolean; // after 9pm
  hasWeekendWarrior: boolean; // only Sat/Sun
  monthlyKm: Record<string, number>; // "2025-04" => km
  weeklyRuns: Record<string, number>; // "2025-W15" => count
}

// ─── Category Config ─────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "distance", name: "Milestone Distanza", icon: "🏃‍♂️", color: "#3B82F6" },
  { id: "consistency", name: "Costanza", icon: "📅", color: "#10B981" },
  { id: "improvements", name: "Miglioramenti", icon: "📈", color: "#F59E0B" },
  { id: "training", name: "Allenamento", icon: "🏋️", color: "#8B5CF6" },
  { id: "halfmarathon", name: "Mezza Maratona", icon: "🎯", color: "#EF4444" },
  { id: "science", name: "Scienza", icon: "🧠", color: "#06B6D4" },
  { id: "speed", name: "Velocità Lampo", icon: "💨", color: "#F97316" },
  { id: "fun", name: "Fun & Speciali", icon: "🎉", color: "#EC4899" },
];

// ─── Badge List ──────────────────────────────────────────────────────────────

const BADGES: BadgeDef[] = [
  // ── Milestone Distanza (11) ─────────────────────────────────────────────
  { id: "km_100", category: "distance", name: "Primi 100 km", desc: "Completa 100 km totali", icon: "🥉", check: c => c.totalKm >= 100, progress: c => Math.min(c.totalKm, 100), target: 100 },
  { id: "km_500", category: "distance", name: "Mezzo Millennio", desc: "Completa 500 km totali", icon: "🥈", check: c => c.totalKm >= 500, progress: c => Math.min(c.totalKm, 500), target: 500 },
  { id: "km_1000", category: "distance", name: "Mille Miglia", desc: "Completa 1.000 km totali", icon: "🥇", check: c => c.totalKm >= 1000, progress: c => Math.min(c.totalKm, 1000), target: 1000 },
  { id: "km_2500", category: "distance", name: "Maratoneta", desc: "Completa 2.500 km totali", icon: "🏅", check: c => c.totalKm >= 2500, progress: c => Math.min(c.totalKm, 2500), target: 2500 },
  { id: "km_5000", category: "distance", name: "Ultra Runner", desc: "Completa 5.000 km totali", icon: "🏆", check: c => c.totalKm >= 5000, progress: c => Math.min(c.totalKm, 5000), target: 5000 },
  { id: "km_7500", category: "distance", name: "Leggenda", desc: "Completa 7.500 km totali", icon: "👑", check: c => c.totalKm >= 7500, progress: c => Math.min(c.totalKm, 7500), target: 7500 },
  { id: "km_10000", category: "distance", name: "Deca-Maratoneta", desc: "Completa 10.000 km totali", icon: "💎", check: c => c.totalKm >= 10000, progress: c => Math.min(c.totalKm, 10000), target: 10000 },
  { id: "long_10", category: "distance", name: "Primo 10K", desc: "Corri almeno 10 km in una volta", icon: "🔟", check: c => c.longestRun >= 10 },
  { id: "long_15", category: "distance", name: "Mezza Distanza", desc: "Corri almeno 15 km in una volta", icon: "🔢", check: c => c.longestRun >= 15 },
  { id: "long_21", category: "distance", name: "Mezza Maratona", desc: "Corri almeno 21 km in una volta", icon: "🏃", check: c => c.longestRun >= 21 },
  { id: "world_tour", category: "distance", name: "Giro del Mondo", desc: "Completa 40.075 km totali (circonferenza terrestre)", icon: "🌍", check: c => c.totalKm >= 40075, progress: c => Math.min(c.totalKm, 40075), target: 40075 },

  // ── Costanza (16) ───────────────────────────────────────────────────────
  { id: "runs_10", category: "consistency", name: "Primi 10", desc: "Completa 10 corse", icon: "🏁", check: c => c.totalRuns >= 10, progress: c => Math.min(c.totalRuns, 10), target: 10 },
  { id: "runs_25", category: "consistency", name: "Venticinque", desc: "Completa 25 corse", icon: "🎯", check: c => c.totalRuns >= 25, progress: c => Math.min(c.totalRuns, 25), target: 25 },
  { id: "runs_50", category: "consistency", name: "Cinquanta", desc: "Completa 50 corse", icon: "🔥", check: c => c.totalRuns >= 50, progress: c => Math.min(c.totalRuns, 50), target: 50 },
  { id: "runs_100", category: "consistency", name: "Centurione", desc: "Completa 100 corse", icon: "💯", check: c => c.totalRuns >= 100, progress: c => Math.min(c.totalRuns, 100), target: 100 },
  { id: "runs_200", category: "consistency", name: "Doppio Centurione", desc: "Completa 200 corse", icon: "🏅", check: c => c.totalRuns >= 200, progress: c => Math.min(c.totalRuns, 200), target: 200 },
  { id: "perfect_week", category: "consistency", name: "Settimana Perfetta", desc: "Corri 7 giorni consecutivi", icon: "⭐", check: c => c.maxStreak >= 7 },
  { id: "streak_3", category: "consistency", name: "Streak 3 Settimane", desc: "Corri almeno 3 volte/settimana per 3 settimane consecutive", icon: "🔗", check: c => c.currentStreak >= 3 },
  { id: "streak_5", category: "consistency", name: "Streak 5 Settimane", desc: "Corri almeno 3 volte/settimana per 5 settimane consecutive", icon: "⛓️", check: c => c.currentStreak >= 5 },
  { id: "golden_month", category: "consistency", name: "Mese d'Oro", desc: "Corri almeno 20 volte in un mese", icon: "🌟", check: c => Object.values(c.monthlyKm).some((_, i) => { const weeks = Object.values(c.weeklyRuns).slice(i * 4, i * 4 + 4); return weeks.reduce((a, b) => a + b, 0) >= 20; }) },
  { id: "loyalty", category: "consistency", name: "Fedeltà", desc: "Corri per 3 mesi consecutivi", icon: "💪", check: c => c.weeksActive >= 12 },
  { id: "tireless", category: "consistency", name: "Runner Instancabile", desc: "Corri per 6 mesi consecutivi", icon: "🦾", check: c => c.weeksActive >= 24 },
  { id: "year_365", category: "consistency", name: "365 Giorni", desc: "Corri almeno una volta ogni settimana per un anno", icon: "📆", check: c => c.weeksActive >= 52 },
  { id: "early_bird", category: "consistency", name: "Sveglia Presto", desc: "Completa 10 corse prima delle 7:00", icon: "🌅", check: c => c.hasEarlyMorning },
  { id: "night_owl", category: "consistency", name: "Notturno", desc: "Completa 10 corse dopo le 21:00", icon: "🌙", check: c => c.hasNightRun },
  { id: "weekend_warrior", category: "consistency", name: "Guerriero Weekend", desc: "Completa 20 corse solo nel weekend", icon: "🏖️", check: c => c.hasWeekendWarrior },
  { id: "comeback", category: "consistency", name: "Il Ritorno", desc: "Torna a correre dopo una pausa di 30+ giorni", icon: "🔄", check: () => false }, // needs gap detection

  // ── Miglioramenti (21) ──────────────────────────────────────────────────
  { id: "vdot_plus1", category: "improvements", name: "VDOT +1", desc: "Migliora il VDOT di 1 punto", icon: "📊", check: c => c.vdotDelta >= 1 },
  { id: "vdot_plus2", category: "improvements", name: "VDOT +2", desc: "Migliora il VDOT di 2 punti", icon: "📈", check: c => c.vdotDelta >= 2 },
  { id: "vdot_plus3", category: "improvements", name: "VDOT +3", desc: "Migliora il VDOT di 3 punti", icon: "🚀", check: c => c.vdotDelta >= 3 },
  { id: "vdot_plus5", category: "improvements", name: "VDOT +5", desc: "Migliora il VDOT di 5 punti", icon: "⚡", check: c => c.vdotDelta >= 5 },
  { id: "vdot_plus8", category: "improvements", name: "VDOT +8", desc: "Migliora il VDOT di 8 punti", icon: "🔥", check: c => c.vdotDelta >= 8 },
  { id: "vdot_plus10", category: "improvements", name: "VDOT +10", desc: "Migliora il VDOT di 10 punti", icon: "💥", check: c => c.vdotDelta >= 10 },
  { id: "vdot_45", category: "improvements", name: "VDOT 45", desc: "Raggiungi VDOT 45", icon: "🎖️", check: c => c.vdotPeak >= 45 },
  { id: "vdot_50", category: "improvements", name: "VDOT 50", desc: "Raggiungi VDOT 50", icon: "🏆", check: c => c.vdotPeak >= 50 },
  { id: "vdot_55", category: "improvements", name: "VDOT 55", desc: "Raggiungi VDOT 55", icon: "👑", check: c => c.vdotPeak >= 55 },
  { id: "pb_5k", category: "improvements", name: "PB 5K", desc: "Stabilisci un nuovo record sui 5K", icon: "", check: c => c.best5k !== null },
  { id: "pb_10k", category: "improvements", name: "PB 10K", desc: "Stabilisci un nuovo record sui 10K", icon: "🥇", check: c => c.best10k !== null },
  { id: "pb_half", category: "improvements", name: "PB Mezza", desc: "Stabilisci un nuovo record sulla Mezza Maratona", icon: "🥇", check: c => c.bestHalf !== null },
  { id: "sub25_5k", category: "improvements", name: "Sub 25:00 5K", desc: "Corri 5K sotto i 25 minuti", icon: "⏱️", check: c => c.best5k !== null && c.best5k < 1500 },
  { id: "sub22_5k", category: "improvements", name: "Sub 22:00 5K", desc: "Corri 5K sotto i 22 minuti", icon: "⏱️", check: c => c.best5k !== null && c.best5k < 1320 },
  { id: "sub20_5k", category: "improvements", name: "Sub 20:00 5K", desc: "Corri 5K sotto i 20 minuti", icon: "⚡", check: c => c.best5k !== null && c.best5k < 1200 },
  { id: "sub50_10k", category: "improvements", name: "Sub 50:00 10K", desc: "Corri 10K sotto i 50 minuti", icon: "⏱️", check: c => c.best10k !== null && c.best10k < 3000 },
  { id: "sub45_10k", category: "improvements", name: "Sub 45:00 10K", desc: "Corri 10K sotto i 45 minuti", icon: "⚡", check: c => c.best10k !== null && c.best10k < 2700 },
  { id: "sub145_half", category: "improvements", name: "Sub 1:45 Mezza", desc: "Corri la Mezza sotto 1:45", icon: "⏱️", check: c => c.bestHalf !== null && c.bestHalf < 6300 },
  { id: "sub140_half", category: "improvements", name: "Sub 1:40 Mezza", desc: "Corri la Mezza sotto 1:40", icon: "⚡", check: c => c.bestHalf !== null && c.bestHalf < 6000 },
  { id: "double_pb", category: "improvements", name: "Doppio Record", desc: "Migliora PB su 5K e 10K nello stesso mese", icon: "🎯", check: () => false }, // needs month comparison
  { id: "pace_improved", category: "improvements", name: "Passo Migliorato", desc: "Migliora il passo medio di 10s/km", icon: "📉", check: () => false }, // needs pace history

  // ── Allenamento (16) ────────────────────────────────────────────────────
  { id: "intervals_10", category: "training", name: "Re delle Ripetute", desc: "Completa 10 sessioni di ripetute", icon: "🔁", check: c => c.hasIntervals },
  { id: "intervals_50", category: "training", name: "Maestro Ripetute", desc: "Completa 50 sessioni di ripetute", icon: "🎓", check: () => false }, // needs interval count
  { id: "long_20", category: "training", name: "Lungo 20+", desc: "Corri un lungo di 20+ km", icon: "🛣️", check: c => c.longestRun >= 20 },
  { id: "long_25", category: "training", name: "Lungo 25+", desc: "Corri un lungo di 25+ km", icon: "🛤️", check: c => c.longestRun >= 25 },
  { id: "long_30", category: "training", name: "Lungo 30+", desc: "Corri un lungo di 30+ km", icon: "🏔️", check: c => c.longestRun >= 30 },
  { id: "hill_runner", category: "training", name: "Scalatore", desc: "Completa 10 corse in salita", icon: "⛰️", check: c => c.hasHills },
  { id: "progressive", category: "training", name: "Progressivo", desc: "Completa 5 corse progressive", icon: "📊", check: c => c.hasProgressive },
  { id: "negative_split", category: "training", name: "Negative Split", desc: "Completa 5 corse con negative split", icon: "🔻", check: c => c.hasNegativeSplit },
  { id: "vol_40", category: "training", name: "Volume 40km", desc: "Raggiungi 40 km in una settimana", icon: "📏", check: c => c.maxWeeklyKm >= 40 },
  { id: "vol_60", category: "training", name: "Volume 60km", desc: "Raggiungi 60 km in una settimana", icon: "📐", check: c => c.maxWeeklyKm >= 60 },
  { id: "vol_80", category: "training", name: "Volume 80km", desc: "Raggiungi 80 km in una settimana", icon: "📏", check: c => c.maxWeeklyKm >= 80 },
  { id: "back_to_back", category: "training", name: "Back to Back", desc: "Corri 2 giorni consecutivi con 10+ km ciascuno", icon: "🔗", check: c => c.hasBackToBack },
  { id: "double_day", category: "training", name: "Doppia Giornata", desc: "Corri 2 volte nello stesso giorno", icon: "🌗", check: c => c.hasDoubleDay },
  { id: "strength", category: "training", name: "Forza", desc: "Completa 10 sessioni di forza", icon: "💪", check: () => false }, // needs strength data
  { id: "cross_training", category: "training", name: "Cross-Training", desc: "Completa 10 sessioni di cross-training", icon: "🚴", check: () => false }, // needs cross-training data
  { id: "recovery_master", category: "training", name: "Maestro Recupero", desc: "Completa 20 corse di recupero (Z1)", icon: "🧘", check: c => c.runsWithHr >= 20 },

  // ── Mezza Maratona (10) ─────────────────────────────────────────────────
  { id: "hm_15k", category: "halfmarathon", name: "15K", desc: "Corri almeno 15 km", icon: "", check: c => c.longestRun >= 15 },
  { id: "hm_18k", category: "halfmarathon", name: "18K", desc: "Corri almeno 18 km", icon: "🏃‍️", check: c => c.longestRun >= 18 },
  { id: "hm_20k", category: "halfmarathon", name: "20K", desc: "Corri almeno 20 km", icon: "🏃‍♀️", check: c => c.longestRun >= 20 },
  { id: "hm_race_pace", category: "halfmarathon", name: "Ritmo Gara", desc: "Corri 10 km al ritmo gara mezza", icon: "🎯", check: () => false }, // needs race pace data
  { id: "hm_plan_respected", category: "halfmarathon", name: "Piano Rispettato", desc: "Completa l'80% delle sessioni del piano", icon: "✅", check: () => false }, // needs plan data
  { id: "hm_tapering", category: "halfmarathon", name: "Tapering", desc: "Completa la settimana di scarico pre-gara", icon: "📉", check: () => false }, // needs plan data
  { id: "hm_sub2h", category: "halfmarathon", name: "Sub 2h Mezza", desc: "Corri la Mezza sotto le 2 ore", icon: "⏱️", check: c => c.bestHalf !== null && c.bestHalf < 7200 },
  { id: "hm_race_day", category: "halfmarathon", name: "Giorno Gara", desc: "Completa una Mezza Maratona", icon: "🏁", check: c => c.bestHalf !== null },
  { id: "hm_goal_achieved", category: "halfmarathon", name: "Obiettivo Centrato", desc: "Raggiungi il tempo obiettivo sulla Mezza", icon: "🎯", check: () => false }, // needs goal data
  { id: "hm_corralejo", category: "halfmarathon", name: "Corralejo Finisher", desc: "Completa la Mezza di Corralejo", icon: "🏝️", check: () => false }, // needs race data

  // ── Scienza (11) ────────────────────────────────────────────────────────
  { id: "zone_ideal", category: "science", name: "Zona Ideale 80/20", desc: "Mantieni l'80% del tempo in Z1-Z2 per un mese", icon: "🎯", check: c => c.polarizedPct >= 80 },
  { id: "efficient_heart", category: "science", name: "Cuore Efficiente", desc: "Abbassa la FC a riposo di 5 bpm", icon: "❤️", check: () => false }, // needs resting HR history
  { id: "polarized_month", category: "science", name: "Mese Polarizzato", desc: "Completa un mese con distribuzione 80/20", icon: "🌓", check: c => c.polarizedPct >= 80 },
  { id: "perfect_variety", category: "science", name: "Varietà Perfetta", desc: "Completa sessioni di tutti i tipi in una settimana", icon: "🎨", check: () => false }, // needs session types
  { id: "recovery_master", category: "science", name: "Maestro Recupero", desc: "Mantieni TSB > 0 per 2 settimane consecutive", icon: "🧘", check: () => false }, // needs TSB data
  { id: "max_hr_found", category: "science", name: "FC Max Trovata", desc: "Raggiungi il 95% della FC max in una corsa", icon: "💓", check: c => c.runsWithHr >= 1 },
  { id: "data_nerd", category: "science", name: "Data Nerd", desc: "Analizza 50 corse con dati HR", icon: "🤓", check: c => c.runsWithHr >= 50 },
  { id: "interval_detector", category: "science", name: "Rilevatore Ripetute", desc: "Completa 20 sessioni di intervalli", icon: "🔍", check: c => c.hasIntervals },
  { id: "injury_risk_low", category: "science", name: "Injury Risk Low", desc: "Mantieni ACWR < 1.3 per 4 settimane", icon: "🛡️", check: c => c.injuryRisk < 30 },
  { id: "cadence_180", category: "science", name: "Cadenza 180", desc: "Mantieni cadenza media 180 spm per 10 corse", icon: "🥁", check: c => c.avgCadence >= 175 },
  { id: "stride_optimized", category: "science", name: "Falcata Ottimizzata", desc: "Migliora la lunghezza del passo del 5%", icon: "📏", check: () => false }, // needs stride data

  // ── Velocità Lampo (10) ─────────────────────────────────────────────────
  { id: "speed_200m", category: "speed", name: "200m Sprint", desc: "Corri 200m sotto i 40 secondi", icon: "⚡", check: () => false }, // needs split data
  { id: "speed_400m", category: "speed", name: "400m", desc: "Corri 400m sotto i 90 secondi", icon: "⚡", check: () => false },
  { id: "speed_800m", category: "speed", name: "800m", desc: "Corri 800m sotto i 3:30", icon: "⚡", check: () => false },
  { id: "speed_1k", category: "speed", name: "1K", desc: "Corri 1K sotto i 4:00", icon: "⚡", check: () => false },
  { id: "speed_2k", category: "speed", name: "2K", desc: "Corri 2K sotto i 8:30", icon: "⚡", check: () => false },
  { id: "speed_3k", category: "speed", name: "3K", desc: "Corri 3K sotto i 13:00", icon: "⚡", check: () => false },
  { id: "speed_5k", category: "speed", name: "5K Velocista", desc: "Corri 5K sotto i 22:00", icon: "💨", check: c => c.best5k !== null && c.best5k < 1320 },
  { id: "speed_10k", category: "speed", name: "10K Velocista", desc: "Corri 10K sotto i 45:00", icon: "💨", check: c => c.best10k !== null && c.best10k < 2700 },
  { id: "speed_half", category: "speed", name: "Mezza Velocista", desc: "Corri la Mezza sotto 1:35", icon: "💨", check: c => c.bestHalf !== null && c.bestHalf < 5700 },
  { id: "speed_marathon", category: "speed", name: "Maratona Velocista", desc: "Corri la Maratona sotto 3:30", icon: "💨", check: c => c.bestMarathon !== null && c.bestMarathon < 12600 },

  // ── Fun & Speciali (7) ──────────────────────────────────────────────────
  { id: "first_step", category: "fun", name: "Primo Passo", desc: "Completa la tua prima corsa", icon: "👶", check: c => c.totalRuns >= 1 },
  { id: "first_week", category: "fun", name: "Prima Settimana", desc: "Completa la tua prima settimana di allenamento", icon: "📅", check: c => c.totalRuns >= 3 },
  { id: "the_return", category: "fun", name: "Il Ritorno", desc: "Torna a correre dopo una pausa", icon: "🔄", check: () => false },
  { id: "monthly_marathon", category: "fun", name: "Maratona Mensile", desc: "Corri 42 km in un mese", icon: "🗓️", check: c => Object.values(c.monthlyKm).some(km => km >= 42) },
  { id: "century_month", category: "fun", name: "Mese da 100km", desc: "Corri 100 km in un mese", icon: "💯", check: c => Object.values(c.monthlyKm).some(km => km >= 100) },
  { id: "run_1h", category: "fun", name: "Corsa 1 Ora", desc: "Corri per almeno 1 ora consecutiva", icon: "⏰", check: c => c.longestRun >= 10 }, // approx 10km in 1h
  { id: "run_2h", category: "fun", name: "Corsa 2 Ore", desc: "Corri per almeno 2 ore consecutive", icon: "⏰", check: c => c.longestRun >= 20 }, // approx 20km in 2h
];

// ─── Legendary Badge ─────────────────────────────────────────────────────────

const LEGENDARY_BADGE = {
  id: "passerotto",
  name: "Passerotto 🐦",
  desc: "5K sotto i 20 minuti E 10K sotto i 4:15/km",
  icon: "🐦",
  check: (c: BadgeContext) => c.best5k !== null && c.best5k < 1200 && c.best10k !== null && c.best10k < 2550,
  message: "Sei un Passerotto! Velocità e resistenza combinate alla perfezione! 🎉",
};

// ─── Helper: Build Context from Runs ─────────────────────────────────────────

function buildContext(runs: Run[], vdot: number, vdotPeak: number, vdotDelta: number): BadgeContext {
  const totalKm = runs.reduce((s, r) => s + (r.distance_km || 0), 0);
  const totalRuns = runs.length;
  const longestRun = Math.max(...runs.map(r => r.distance_km || 0), 0);

  // Best times from runs (approximate from pace * distance)
  let best5k: number | null = null;
  let best10k: number | null = null;
  let bestHalf: number | null = null;
  let bestMarathon: number | null = null;

  for (const r of runs) {
    const paceSec = parsePaceSec(r.avg_pace);
    if (!paceSec) continue;
    const timeSec = paceSec * r.distance_km;

    if (r.distance_km >= 4.5 && r.distance_km <= 5.5) {
      const t5k = paceSec * 5;
      if (best5k === null || t5k < best5k) best5k = t5k;
    }
    if (r.distance_km >= 9 && r.distance_km <= 11) {
      const t10k = paceSec * 10;
      if (best10k === null || t10k < best10k) best10k = t10k;
    }
    if (r.distance_km >= 20 && r.distance_km <= 22) {
      const tHalf = paceSec * 21.0975;
      if (bestHalf === null || tHalf < bestHalf) bestHalf = tHalf;
    }
    if (r.distance_km >= 40) {
      const tMar = paceSec * 42.195;
      if (bestMarathon === null || tMar < bestMarathon) bestMarathon = tMar;
    }
  }

  // Weekly km
  const weeklyKm: Record<string, number> = {};
  for (const r of runs) {
    const d = new Date(r.date);
    const weekKey = `${d.getFullYear()}-W${getWeekNumber(d)}`;
    weeklyKm[weekKey] = (weeklyKm[weekKey] || 0) + r.distance_km;
  }
  const maxWeeklyKm = Math.max(...Object.values(weeklyKm), 0);

  // Monthly km
  const monthlyKm: Record<string, number> = {};
  for (const r of runs) {
    const d = new Date(r.date);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyKm[monthKey] = (monthlyKm[monthKey] || 0) + r.distance_km;
  }

  // Weekly runs count
  const weeklyRuns: Record<string, number> = {};
  for (const r of runs) {
    const d = new Date(r.date);
    const weekKey = `${d.getFullYear()}-W${getWeekNumber(d)}`;
    weeklyRuns[weekKey] = (weeklyRuns[weekKey] || 0) + 1;
  }

  // Streak calculation
  const sortedDates = [...new Set(runs.map(r => r.date))].sort();
  let maxStreak = 0;
  let currentStreak = 0;
  let lastDate: Date | null = null;

  for (const dateStr of sortedDates) {
    const d = new Date(dateStr);
    if (lastDate) {
      const diff = Math.round((d.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        currentStreak++;
      } else if (diff > 1) {
        currentStreak = 1;
      }
    } else {
      currentStreak = 1;
    }
    maxStreak = Math.max(maxStreak, currentStreak);
    lastDate = d;
  }

  // Polarized % (Z1+Z2)
  const hrRuns = runs.filter(r => r.avg_hr && r.avg_hr > 0);
  const z1z2Runs = hrRuns.filter(r => {
    const pct = (r.avg_hr! / 190) * 100; // approximate max HR
    return pct < 77;
  });
  const polarizedPct = hrRuns.length > 0 ? (z1z2Runs.length / hrRuns.length) * 100 : 0;

  // Avg cadence
  const cadRuns = runs.filter(r => r.avg_cadence && r.avg_cadence > 0);
  const avgCadence = cadRuns.length > 0
    ? cadRuns.reduce((s, r) => s + (r.avg_cadence! * 2), 0) / cadRuns.length // spm
    : 0;

  // Has intervals, hills, etc.
  const hasIntervals = runs.some(r => r.run_type === "intervals");
  const hasHills = runs.some(r => (r.elevation_gain || 0) > 100);
  const hasProgressive = false; // needs split analysis
  const hasNegativeSplit = false; // needs split analysis
  const hasBackToBack = false; // needs consecutive day analysis
  const hasDoubleDay = false; // needs same-day analysis
  const hasEarlyMorning = runs.some(r => {
    const h = new Date(r.date).getHours();
    return h < 7;
  });
  const hasNightRun = runs.some(r => {
    const h = new Date(r.date).getHours();
    return h >= 21;
  });
  const hasWeekendWarrior = runs.filter(r => {
    const day = new Date(r.date).getDay();
    return day === 0 || day === 6;
  }).length >= 20;

  // Weeks active
  const weeksActive = Object.keys(weeklyRuns).length;

  // First/last run
  const dates = runs.map(r => r.date).sort();
  const firstRunDate = dates[0] || "";
  const lastRunDate = dates[dates.length - 1] || "";

  // Injury risk (simplified ACWR)
  const injuryRisk = maxWeeklyKm > 60 ? 50 : maxWeeklyKm > 40 ? 30 : 10;

  return {
    totalKm,
    totalRuns,
    vdot,
    vdotPeak,
    vdotDelta,
    best5k,
    best10k,
    bestHalf,
    bestMarathon,
    longestRun,
    maxWeeklyKm,
    maxStreak,
    currentStreak,
    runsWithHr: hrRuns.length,
    polarizedPct,
    avgCadence,
    injuryRisk,
    runs,
    weeksActive,
    firstRunDate,
    lastRunDate,
    hasIntervals,
    hasHills,
    hasProgressive,
    hasNegativeSplit,
    hasBackToBack,
    hasDoubleDay,
    hasEarlyMorning,
    hasNightRun,
    hasWeekendWarrior,
    monthlyKm,
    weeklyRuns,
  };
}

function parsePaceSec(pace: string): number | null {
  if (!pace) return null;
  const parts = pace.split(":");
  if (parts.length < 2) return null;
  const v = parseInt(parts[0]) * 60 + parseInt(parts[1]);
  return v > 0 ? v : null;
}

function getWeekNumber(d: Date): number {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
}

// ─── Badge Card Component ────────────────────────────────────────────────────

function BadgeCard({ badge, unlocked, progress, target }: {
  badge: BadgeDef;
  unlocked: boolean;
  progress: number;
  target: number;
}) {
  const pct = target > 0 ? Math.min(100, (progress / target) * 100) : (unlocked ? 100 : 0);

  return (
    <div className={`relative rounded-xl border p-3 transition-all ${
      unlocked
        ? "bg-[#1E1E1E] border-[#2A2A2A] hover:border-[#3B82F6]/50"
        : "bg-[#121212] border-[#1E1E1E] opacity-50"
    }`}>
      <div className="flex items-start gap-3">
        <div className={`text-2xl ${unlocked ? "" : "grayscale"}`}>
          {badge.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${unlocked ? "text-white" : "text-gray-500"}`}>
              {badge.name}
            </span>
            {unlocked && (
              <span className="text-[10px] text-[#10B981]">✓</span>
            )}
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{badge.desc}</p>
          {!unlocked && target > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[9px] text-gray-600 mb-1">
                <span>{Math.round(progress)} / {target}</span>
                <span>{Math.round(pct)}%</span>
              </div>
              <div className="w-full h-1 bg-[#2A2A2A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#3B82F6] rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Legendary Badge Card ────────────────────────────────────────────────────

function LegendaryBadgeCard({ unlocked }: { unlocked: boolean }) {
  return (
    <div className={`relative rounded-2xl border-2 p-6 transition-all ${
      unlocked
        ? "bg-gradient-to-br from-[#1E1E1E] to-[#2A1E00] border-[#F59E0B] shadow-lg shadow-[#F59E0B]/20"
        : "bg-[#121212] border-[#2A2A2A] opacity-50"
    }`}>
      {unlocked && (
        <div className="absolute -top-2 -right-2 bg-[#F59E0B] text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
          LEGGENDARIO
        </div>
      )}
      <div className="flex items-center gap-4">
        <div className={`text-5xl ${unlocked ? "" : "grayscale"}`}>
          🐦
        </div>
        <div className="flex-1">
          <h3 className={`text-lg font-black ${unlocked ? "text-[#F59E0B]" : "text-gray-500"}`}>
            Passerotto
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            5K sotto i 20 minuti E 10K sotto i 4:15/km
          </p>
          {unlocked && (
            <p className="text-sm text-[#F59E0B] mt-2 font-bold">
              🎉 Sei un Passerotto! Velocità e resistenza combinate alla perfezione!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface Props {
  runs: Run[];
  vdot: number;
  vdotPeak: number;
  vdotDelta: number;
}

export function BadgesGrid({ runs, vdot, vdotPeak, vdotDelta }: Props) {
  const ctx = useMemo(() => buildContext(runs, vdot, vdotPeak, vdotDelta), [runs, vdot, vdotPeak, vdotDelta]);

  const unlockedCount = BADGES.filter(b => b.check(ctx)).length;
  const totalCount = BADGES.length;
  const legendaryUnlocked = LEGENDARY_BADGE.check(ctx);

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="flex items-center justify-between bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-4">
        <div className="flex items-center gap-4">
          <Trophy className="w-6 h-6 text-[#F59E0B]" />
          <div>
            <div className="text-sm font-bold text-white">{unlockedCount} / {totalCount} Badge</div>
            <div className="text-xs text-gray-500">{Math.round((unlockedCount / totalCount) * 100)}% completato</div>
          </div>
        </div>
        <div className="w-32 h-2 bg-[#2A2A2A] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#F59E0B] to-[#10B981] rounded-full transition-all"
            style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {/* Legendary Badge */}
      <LegendaryBadgeCard unlocked={legendaryUnlocked} />

      {/* Categories */}
      {CATEGORIES.map(cat => {
        const catBadges = BADGES.filter(b => b.category === cat.id);
        const catUnlocked = catBadges.filter(b => b.check(ctx)).length;

        return (
          <div key={cat.id}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{cat.icon}</span>
              <h3 className="text-sm font-bold text-white">{cat.name}</h3>
              <span className="text-xs text-gray-500">({catUnlocked}/{catBadges.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {catBadges.map(badge => {
                const unlocked = badge.check(ctx);
                const progress = badge.progress ? badge.progress(ctx) : 0;
                const target = badge.target || 0;
                return (
                  <BadgeCard
                    key={badge.id}
                    badge={badge}
                    unlocked={unlocked}
                    progress={progress}
                    target={target}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}