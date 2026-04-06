import { useMemo } from "react";
import { Trophy } from "lucide-react";
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
  best5k: number | null;
  best10k: number | null;
  bestHalf: number | null;
  bestMarathon: number | null;
  longestRun: number;
  maxWeeklyKm: number;
  maxStreak: number;
  currentStreak: number;
  runsWithHr: number;
  polarizedPct: number;
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
  hasEarlyMorning: boolean;
  hasNightRun: boolean;
  hasWeekendWarrior: boolean;
  monthlyKm: Record<string, number>;
  weeklyRuns: Record<string, number>;
  totalElevation: number;
  maxElevationRun: number;
  avgPace: number;
  bestPace: number;
  runsInRain: number;
  runsInHeat: number;
  runsInCold: number;
  longestTime: number;
  fastest1k: number | null;
  fastest2k: number | null;
  fastest3k: number | null;
  fastest5k: number | null;
  fastest10k: number | null;
  fastestHalf: number | null;
  totalHours: number;
  runsOver10k: number;
  runsOver15k: number;
  runsOver20k: number;
  runsOver25k: number;
  runsOver30k: number;
  runsOver40k: number;
  monthsActive: number;
  yearsActive: number;
  perfectMonths: number;
  longestRestDay: number;
  avgWeeklyRuns: number;
  avgMonthlyKm: number;
  hasFartlek: boolean;
  hasTempo: boolean;
  hasRecovery: boolean;
  hasLongRun: boolean;
  hasRacePace: boolean;
  hasHillRepeats: boolean;
  hasTrackWorkout: boolean;
  hasTrailRun: boolean;
  hasRoadRun: boolean;
  hasTreadmillRun: boolean;
  hasParkrun: boolean;
  hasVirtualRace: boolean;
  hasCharityRun: boolean;
  hasNightRace: boolean;
  hasUltra: boolean;
  hasMarathon: boolean;
  hasHalfMarathon: boolean;
  has10k: boolean;
  has5k: boolean;
  hasParkrun5k: boolean;
  hasMile: boolean;
  has400m: boolean;
  has200m: boolean;
  has100m: boolean;
  hasStairRun: boolean;
  hasBeachRun: boolean;
  hasForestRun: boolean;
  hasMountainRun: boolean;
  hasCityRun: boolean;
  hasSunriseRun: boolean;
  hasSunsetRun: boolean;
  hasFullMoonRun: boolean;
  hasNewYearRun: boolean;
  hasBirthdayRun: boolean;
  hasChristmasRun: boolean;
  hasEasterRun: boolean;
  hasValentineRun: boolean;
  hasHalloweenRun: boolean;
  hasSummerSolsticeRun: boolean;
  hasWinterSolsticeRun: boolean;
  hasLeapYearRun: boolean;
  hasFriday13thRun: boolean;
  hasPiDayRun: boolean;
  hasWorldRunningDay: boolean;
  hasOlympicDay: boolean;
  hasMarathonDay: boolean;
  hasGlobalRunningDay: boolean;
  hasRunToWork: boolean;
  hasRunHome: boolean;
  hasRunWithDog: boolean;
  hasRunWithPartner: boolean;
  hasRunWithKids: boolean;
  hasRunWithFriends: boolean;
  hasSoloRun: boolean;
  hasGroupRun: boolean;
  hasGuidedRun: boolean;
  hasAudioRun: boolean;
  hasMusicRun: boolean;
  hasPodcastRun: boolean;
  hasMeditativeRun: boolean;
  hasMindfulRun: number;
  hasGratitudeRun: boolean;
  hasGoalRun: boolean;
  hasChallengeRun: boolean;
  hasPersonalBest: boolean;
  hasSeasonalBest: boolean;
  hasMonthlyBest: boolean;
  hasWeeklyBest: boolean;
  hasDailyBest: boolean;
  hasComeback: boolean;
  hasInjuryReturn: boolean;
  hasIllnessReturn: boolean;
  hasVacationRun: boolean;
  hasBusinessTripRun: boolean;
  hasAirportRun: boolean;
  hasHotelRun: boolean;
  hasNewCityRun: boolean;
  hasNewCountryRun: boolean;
  hasNewContinentRun: boolean;
  hasSevenContinents: boolean;
  hasPolarRun: boolean;
  hasDesertRun: boolean;
  hasJungleRun: boolean;
  hasArcticRun: boolean;
  hasAntarcticRun: boolean;
  hasEquatorRun: boolean;
  hasTropicRun: boolean;
  hasHighAltitudeRun: boolean;
  hasSeaLevelRun: boolean;
  hasUnderwaterRun: boolean;
  hasSnowRun: boolean;
  hasIceRun: boolean;
  hasRainRun: boolean;
  hasStormRun: boolean;
  hasWindRun: boolean;
  hasFogRun: boolean;
  hasThunderRun: boolean;
  hasLightningRun: boolean;
  hasHailRun: boolean;
  hasSleetRun: boolean;
  hasBlizzardRun: boolean;
  hasHeatwaveRun: boolean;
  hasColdwaveRun: boolean;
  hasHumidRun: boolean;
  hasDryRun: boolean;
  hasWindyRun: boolean;
  hasCalmRun: boolean;
  hasClearRun: boolean;
  hasCloudyRun: boolean;
  hasOvercastRun: boolean;
  hasPartlyCloudyRun: boolean;
  hasMostlyCloudyRun: boolean;
  hasMostlyClearRun: boolean;
  hasFairRun: boolean;
  hasHazyRun: boolean;
  hasSmokyRun: boolean;
  hasDustyRun: boolean;
  hasSandyRun: boolean;
  hasMuddyRun: boolean;
  hasWetRun: boolean;
  hasDryTrailRun: boolean;
  hasTechnicalTrailRun: boolean;
  hasEasyTrailRun: boolean;
  hasModerateTrailRun: boolean;
  hasHardTrailRun: boolean;
  hasExtremeTrailRun: boolean;
  hasFlatRun: boolean;
  hasRollingRun: boolean;
  hasHillyRun: boolean;
  hasMountainousRun: boolean;
  hasDownhillRun: boolean;
  hasUphillRun: boolean;
  hasIntervalRun: boolean;
  hasTempoRun: boolean;
  hasFartlekRun: boolean;
  hasProgressionRun: boolean;
  hasNegativeSplitRun: boolean;
  hasPositiveSplitRun: boolean;
  hasEvenSplitRun: boolean;
  hasNegativeSplitRace: boolean;
  hasPositiveSplitRace: boolean;
  hasEvenSplitRace: boolean;
  hasNegativeSplitLong: boolean;
  hasPositiveSplitLong: boolean;
  hasEvenSplitLong: boolean;
  hasNegativeSplitInterval: boolean;
  hasPositiveSplitInterval: boolean;
  hasEvenSplitInterval: boolean;
  hasNegativeSplitTempo: boolean;
  hasPositiveSplitTempo: boolean;
  hasEvenSplitTempo: boolean;
  hasNegativeSplitFartlek: boolean;
  hasPositiveSplitFartlek: boolean;
  hasEvenSplitFartlek: boolean;
  hasNegativeSplitProgression: boolean;
  hasPositiveSplitProgression: boolean;
  hasEvenSplitProgression: boolean;
  hasNegativeSplitRecovery: boolean;
  hasPositiveSplitRecovery: boolean;
  hasEvenSplitRecovery: boolean;
  hasNegativeSplitEasy: boolean;
  hasPositiveSplitEasy: boolean;
  hasEvenSplitEasy: boolean;
  hasNegativeSplitRacePace: boolean;
  hasPositiveSplitRacePace: boolean;
  hasEvenSplitRacePace: boolean;
  hasNegativeSplitHillRepeat: boolean;
  hasPositiveSplitHillRepeat: boolean;
  hasEvenSplitHillRepeat: boolean;
  hasNegativeSplitTrackWorkout: boolean;
  hasPositiveSplitTrackWorkout: boolean;
  hasEvenSplitTrackWorkout: boolean;
  hasNegativeSplitTrailRun: boolean;
  hasPositiveSplitTrailRun: boolean;
  hasEvenSplitTrailRun: boolean;
  hasNegativeSplitRoadRun: boolean;
  hasPositiveSplitRoadRun: boolean;
  hasEvenSplitRoadRun: boolean;
  hasNegativeSplitTreadmillRun: boolean;
  hasPositiveSplitTreadmillRun: boolean;
  hasEvenSplitTreadmillRun: boolean;
  hasNegativeSplitParkrun: boolean;
  hasPositiveSplitParkrun: boolean;
  hasEvenSplitParkrun: boolean;
  hasNegativeSplitVirtualRace: boolean;
  hasPositiveSplitVirtualRace: boolean;
  hasEvenSplitVirtualRace: boolean;
  hasNegativeSplitCharityRun: boolean;
  hasPositiveSplitCharityRun: boolean;
  hasEvenSplitCharityRun: boolean;
  hasNegativeSplitNightRace: boolean;
  hasPositiveSplitNightRace: boolean;
  hasEvenSplitNightRace: boolean;
  hasNegativeSplitUltra: boolean;
  hasPositiveSplitUltra: boolean;
  hasEvenSplitUltra: boolean;
  hasNegativeSplitMarathon: boolean;
  hasPositiveSplitMarathon: boolean;
  hasEvenSplitMarathon: boolean;
  hasNegativeSplitHalfMarathon: boolean;
  hasPositiveSplitHalfMarathon: boolean;
  hasEvenSplitHalfMarathon: boolean;
  hasNegativeSplit10k: boolean;
  hasPositiveSplit10k: boolean;
  hasEvenSplit10k: boolean;
  hasNegativeSplit5k: boolean;
  hasPositiveSplit5k: boolean;
  hasEvenSplit5k: boolean;
  hasNegativeSplitParkrun5k: boolean;
  hasPositiveSplitParkrun5k: boolean;
  hasEvenSplitParkrun5k: boolean;
  hasNegativeSplitMile: boolean;
  hasPositiveSplitMile: boolean;
  hasEvenSplitMile: boolean;
  hasNegativeSplit400m: boolean;
  hasPositiveSplit400m: boolean;
  hasEvenSplit400m: boolean;
  hasNegativeSplit200m: boolean;
  hasPositiveSplit200m: boolean;
  hasEvenSplit200m: boolean;
  hasNegativeSplit100m: boolean;
  hasPositiveSplit100m: boolean;
  hasEvenSplit100m: boolean;
}

// ─── Category Config ─────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "distance", name: "Milestone Distanza", icon: "🏃‍️", color: "#3B82F6" },
  { id: "consistency", name: "Costanza", icon: "📅", color: "#10B981" },
  { id: "improvements", name: "Miglioramenti", icon: "📈", color: "#F59E0B" },
  { id: "training", name: "Allenamento", icon: "🏃", color: "#8B5CF6" },
  { id: "halfmarathon", name: "Mezza Maratona", icon: "🎯", color: "#EF4444" },
  { id: "science", name: "Scienza", icon: "🧠", color: "#06B6D4" },
  { id: "speed", name: "Velocità Lampo", icon: "💨", color: "#F97316" },
  { id: "fun", name: "Fun & Speciali", icon: "🎉", color: "#EC4899" },
  { id: "weather", name: "Meteo & Ambiente", icon: "🌦️", color: "#14B8A6" },
  { id: "terrain", name: "Terreno & Superficie", icon: "🏔️", color: "#84CC16" },
  { id: "split", name: "Split & Ritmo", icon: "⏱️", color: "#A855F7" },
  { id: "special", name: "Eventi Speciali", icon: "🎊", color: "#F43F5E" },
  { id: "travel", name: "Viaggi & Luoghi", icon: "✈️", color: "#0EA5E9" },
  { id: "social", name: "Social & Compagnia", icon: "👥", color: "#6366F1" },
  { id: "mindful", name: "Mindful & Benessere", icon: "🧘", color: "#22D3EE" },
  { id: "challenge", name: "Sfide & Record", icon: "🏆", color: "#EAB308" },
];

// ─── Helper: Check if run is from 2026 ───────────────────────────────────────

function isFrom2026(date: string): boolean {
  return new Date(date).getFullYear() >= 2026;
}

// ─── Badge List ──────────────────────────────────────────────────────────────

const BADGES: BadgeDef[] = [
  // ── Milestone Distanza (20) ─────────────────────────────────────────────
  { id: "km_10", category: "distance", name: "Primi 10 km", desc: "Completa 10 km totali nel 2026", icon: "🥉", check: c => c.totalKm >= 10, progress: c => Math.min(c.totalKm, 10), target: 10 },
  { id: "km_50", category: "distance", name: "Primi 50 km", desc: "Completa 50 km totali nel 2026", icon: "🥈", check: c => c.totalKm >= 50, progress: c => Math.min(c.totalKm, 50), target: 50 },
  { id: "km_100", category: "distance", name: "Primi 100 km", desc: "Completa 100 km totali nel 2026", icon: "🥇", check: c => c.totalKm >= 100, progress: c => Math.min(c.totalKm, 100), target: 100 },
  { id: "km_200", category: "distance", name: "200 km", desc: "Completa 200 km totali nel 2026", icon: "🏅", check: c => c.totalKm >= 200, progress: c => Math.min(c.totalKm, 200), target: 200 },
  { id: "km_500", category: "distance", name: "500 km", desc: "Completa 500 km totali nel 2026", icon: "🏆", check: c => c.totalKm >= 500, progress: c => Math.min(c.totalKm, 500), target: 500 },
  { id: "km_750", category: "distance", name: "750 km", desc: "Completa 750 km totali nel 2026", icon: "👑", check: c => c.totalKm >= 750, progress: c => Math.min(c.totalKm, 750), target: 750 },
  { id: "km_1000", category: "distance", name: "1.000 km", desc: "Completa 1.000 km totali nel 2026", icon: "💎", check: c => c.totalKm >= 1000, progress: c => Math.min(c.totalKm, 1000), target: 1000 },
  { id: "km_1500", category: "distance", name: "1.500 km", desc: "Completa 1.500 km totali nel 2026", icon: "🌟", check: c => c.totalKm >= 1500, progress: c => Math.min(c.totalKm, 1500), target: 1500 },
  { id: "km_2000", category: "distance", name: "2.000 km", desc: "Completa 2.000 km totali nel 2026", icon: "⭐", check: c => c.totalKm >= 2000, progress: c => Math.min(c.totalKm, 2000), target: 2000 },
  { id: "km_2500", category: "distance", name: "2.500 km", desc: "Completa 2.500 km totali nel 2026", icon: "🌠", check: c => c.totalKm >= 2500, progress: c => Math.min(c.totalKm, 2500), target: 2500 },
  { id: "km_3000", category: "distance", name: "3.000 km", desc: "Completa 3.000 km totali nel 2026", icon: "🎖️", check: c => c.totalKm >= 3000, progress: c => Math.min(c.totalKm, 3000), target: 3000 },
  { id: "km_3500", category: "distance", name: "3.500 km", desc: "Completa 3.500 km totali nel 2026", icon: "🏅", check: c => c.totalKm >= 3500, progress: c => Math.min(c.totalKm, 3500), target: 3500 },
  { id: "km_4000", category: "distance", name: "4.000 km", desc: "Completa 4.000 km totali nel 2026", icon: "🥇", check: c => c.totalKm >= 4000, progress: c => Math.min(c.totalKm, 4000), target: 4000 },
  { id: "km_4500", category: "distance", name: "4.500 km", desc: "Completa 4.500 km totali nel 2026", icon: "🏆", check: c => c.totalKm >= 4500, progress: c => Math.min(c.totalKm, 4500), target: 4500 },
  { id: "km_5000", category: "distance", name: "5.000 km", desc: "Completa 5.000 km totali nel 2026", icon: "💫", check: c => c.totalKm >= 5000, progress: c => Math.min(c.totalKm, 5000), target: 5000 },
  { id: "long_5", category: "distance", name: "Primo 5K", desc: "Corri almeno 5 km in una volta", icon: "5️⃣", check: c => c.longestRun >= 5 },
  { id: "long_10", category: "distance", name: "Primo 10K", desc: "Corri almeno 10 km in una volta", icon: "🔟", check: c => c.longestRun >= 10 },
  { id: "long_15", category: "distance", name: "15K", desc: "Corri almeno 15 km in una volta", icon: "🔢", check: c => c.longestRun >= 15 },
  { id: "long_21", category: "distance", name: "Mezza Maratona", desc: "Corri almeno 21 km in una volta", icon: "🏃", check: c => c.longestRun >= 21 },
  { id: "long_42", category: "distance", name: "Maratona", desc: "Corri almeno 42 km in una volta", icon: "🏅", check: c => c.longestRun >= 42 },

  // ── Costanza (25) ───────────────────────────────────────────────────────
  { id: "runs_1", category: "consistency", name: "Prima Corsa 2026", desc: "Completa la tua prima corsa del 2026", icon: "🏁", check: c => c.totalRuns >= 1 },
  { id: "runs_5", category: "consistency", name: "Prime 5 corse", desc: "Completa 5 corse nel 2026", icon: "🎯", check: c => c.totalRuns >= 5, progress: c => Math.min(c.totalRuns, 5), target: 5 },
  { id: "runs_10", category: "consistency", name: "Prime 10 corse", desc: "Completa 10 corse nel 2026", icon: "🔥", check: c => c.totalRuns >= 10, progress: c => Math.min(c.totalRuns, 10), target: 10 },
  { id: "runs_25", category: "consistency", name: "25 corse", desc: "Completa 25 corse nel 2026", icon: "💯", check: c => c.totalRuns >= 25, progress: c => Math.min(c.totalRuns, 25), target: 25 },
  { id: "runs_50", category: "consistency", name: "50 corse", desc: "Completa 50 corse nel 2026", icon: "🏅", check: c => c.totalRuns >= 50, progress: c => Math.min(c.totalRuns, 50), target: 50 },
  { id: "runs_100", category: "consistency", name: "100 corse", desc: "Completa 100 corse nel 2026", icon: "👑", check: c => c.totalRuns >= 100, progress: c => Math.min(c.totalRuns, 100), target: 100 },
  { id: "runs_150", category: "consistency", name: "150 corse", desc: "Completa 150 corse nel 2026", icon: "💎", check: c => c.totalRuns >= 150, progress: c => Math.min(c.totalRuns, 150), target: 150 },
  { id: "runs_200", category: "consistency", name: "200 corse", desc: "Completa 200 corse nel 2026", icon: "🌟", check: c => c.totalRuns >= 200, progress: c => Math.min(c.totalRuns, 200), target: 200 },
  { id: "runs_250", category: "consistency", name: "250 corse", desc: "Completa 250 corse nel 2026", icon: "⭐", check: c => c.totalRuns >= 250, progress: c => Math.min(c.totalRuns, 250), target: 250 },
  { id: "runs_300", category: "consistency", name: "300 corse", desc: "Completa 300 corse nel 2026", icon: "🌠", check: c => c.totalRuns >= 300, progress: c => Math.min(c.totalRuns, 300), target: 300 },
  { id: "runs_365", category: "consistency", name: "365 corse", desc: "Completa 365 corse nel 2026 (una al giorno!)", icon: "📆", check: c => c.totalRuns >= 365, progress: c => Math.min(c.totalRuns, 365), target: 365 },
  { id: "streak_3", category: "consistency", name: "3 giorni consecutivi", desc: "Corri 3 giorni di fila", icon: "🔗", check: c => c.maxStreak >= 3 },
  { id: "streak_5", category: "consistency", name: "5 giorni consecutivi", desc: "Corri 5 giorni di fila", icon: "⛓️", check: c => c.maxStreak >= 5 },
  { id: "streak_7", category: "consistency", name: "Settimana perfetta", desc: "Corri 7 giorni consecutivi", icon: "⭐", check: c => c.maxStreak >= 7 },
  { id: "streak_10", category: "consistency", name: "10 giorni consecutivi", desc: "Corri 10 giorni di fila", icon: "🔥", check: c => c.maxStreak >= 10 },
  { id: "streak_14", category: "consistency", name: "2 settimane consecutive", desc: "Corri 14 giorni di fila", icon: "💪", check: c => c.maxStreak >= 14 },
  { id: "streak_21", category: "consistency", name: "21 giorni consecutivi", desc: "Corri 21 giorni di fila", icon: "🦾", check: c => c.maxStreak >= 21 },
  { id: "streak_30", category: "consistency", name: "30 giorni consecutivi", desc: "Corri 30 giorni di fila", icon: "🏆", check: c => c.maxStreak >= 30 },
  { id: "streak_60", category: "consistency", name: "60 giorni consecutivi", desc: "Corri 60 giorni di fila", icon: "👑", check: c => c.maxStreak >= 60 },
  { id: "streak_90", category: "consistency", name: "90 giorni consecutivi", desc: "Corri 90 giorni di fila", icon: "💎", check: c => c.maxStreak >= 90 },
  { id: "early_bird", category: "consistency", name: "Sveglia presto", desc: "Corri prima delle 6:00", icon: "🌅", check: c => c.hasEarlyMorning },
  { id: "night_owl", category: "consistency", name: "Notturno", desc: "Corri dopo le 22:00", icon: "🌙", check: c => c.hasNightRun },
  { id: "weekend_warrior", category: "consistency", name: "Guerriero weekend", desc: "Corri solo nel weekend per un mese", icon: "🏖️", check: c => c.hasWeekendWarrior },
  { id: "monthly_100km", category: "consistency", name: "Mese da 100km", desc: "Corri 100 km in un mese", icon: "💯", check: c => Object.values(c.monthlyKm).some(km => km >= 100) },
  { id: "monthly_150km", category: "consistency", name: "Mese da 150km", desc: "Corri 150 km in un mese", icon: "🌟", check: c => Object.values(c.monthlyKm).some(km => km >= 150) },

  // ── Miglioramenti (20) ──────────────────────────────────────────────────
  { id: "vdot_30", category: "improvements", name: "VDOT 30", desc: "Raggiungi VDOT 30", icon: "📊", check: c => c.vdotPeak >= 30 },
  { id: "vdot_35", category: "improvements", name: "VDOT 35", desc: "Raggiungi VDOT 35", icon: "📈", check: c => c.vdotPeak >= 35 },
  { id: "vdot_40", category: "improvements", name: "VDOT 40", desc: "Raggiungi VDOT 40", icon: "🚀", check: c => c.vdotPeak >= 40 },
  { id: "vdot_45", category: "improvements", name: "VDOT 45", desc: "Raggiungi VDOT 45", icon: "⚡", check: c => c.vdotPeak >= 45 },
  { id: "vdot_50", category: "improvements", name: "VDOT 50", desc: "Raggiungi VDOT 50", icon: "🔥", check: c => c.vdotPeak >= 50 },
  { id: "vdot_55", category: "improvements", name: "VDOT 55", desc: "Raggiungi VDOT 55", icon: "💥", check: c => c.vdotPeak >= 55 },
  { id: "vdot_60", category: "improvements", name: "VDOT 60", desc: "Raggiungi VDOT 60", icon: "👑", check: c => c.vdotPeak >= 60 },
  { id: "sub30_5k", category: "improvements", name: "Sub 30:00 5K", desc: "Corri 5K sotto i 30 minuti", icon: "⏱️", check: c => c.best5k !== null && c.best5k < 1800 },
  { id: "sub28_5k", category: "improvements", name: "Sub 28:00 5K", desc: "Corri 5K sotto i 28 minuti", icon: "⏱️", check: c => c.best5k !== null && c.best5k < 1680 },
  { id: "sub25_5k", category: "improvements", name: "Sub 25:00 5K", desc: "Corri 5K sotto i 25 minuti", icon: "⏱️", check: c => c.best5k !== null && c.best5k < 1500 },
  { id: "sub22_5k", category: "improvements", name: "Sub 22:00 5K", desc: "Corri 5K sotto i 22 minuti", icon: "⏱️", check: c => c.best5k !== null && c.best5k < 1320 },
  { id: "sub20_5k", category: "improvements", name: "Sub 20:00 5K", desc: "Corri 5K sotto i 20 minuti", icon: "⚡", check: c => c.best5k !== null && c.best5k < 1200 },
  { id: "sub18_5k", category: "improvements", name: "Sub 18:00 5K", desc: "Corri 5K sotto i 18 minuti", icon: "💨", check: c => c.best5k !== null && c.best5k < 1080 },
  { id: "sub60_10k", category: "improvements", name: "Sub 60:00 10K", desc: "Corri 10K sotto i 60 minuti", icon: "⏱️", check: c => c.best10k !== null && c.best10k < 3600 },
  { id: "sub55_10k", category: "improvements", name: "Sub 55:00 10K", desc: "Corri 10K sotto i 55 minuti", icon: "⏱️", check: c => c.best10k !== null && c.best10k < 3300 },
  { id: "sub50_10k", category: "improvements", name: "Sub 50:00 10K", desc: "Corri 10K sotto i 50 minuti", icon: "⏱️", check: c => c.best10k !== null && c.best10k < 3000 },
  { id: "sub45_10k", category: "improvements", name: "Sub 45:00 10K", desc: "Corri 10K sotto i 45 minuti", icon: "⚡", check: c => c.best10k !== null && c.best10k < 2700 },
  { id: "sub40_10k", category: "improvements", name: "Sub 40:00 10K", desc: "Corri 10K sotto i 40 minuti", icon: "💨", check: c => c.best10k !== null && c.best10k < 2400 },
  { id: "sub230_half", category: "improvements", name: "Sub 2:30 Mezza", desc: "Corri la Mezza sotto 2:30", icon: "⏱️", check: c => c.bestHalf !== null && c.bestHalf < 9000 },
  { id: "sub200_half", category: "improvements", name: "Sub 2:00 Mezza", desc: "Corri la Mezza sotto 2:00", icon: "⏱️", check: c => c.bestHalf !== null && c.bestHalf < 7200 },

  // ── Allenamento (25) ────────────────────────────────────────────────────
  { id: "intervals_1", category: "training", name: "Prima ripetuta", desc: "Completa la tua prima sessione di ripetute", icon: "🔁", check: c => c.hasIntervals },
  { id: "intervals_5", category: "training", name: "5 sessioni ripetute", desc: "Completa 5 sessioni di ripetute", icon: "🔁", check: c => c.hasIntervals },
  { id: "intervals_10", category: "training", name: "10 sessioni ripetute", desc: "Completa 10 sessioni di ripetute", icon: "🎓", check: c => c.hasIntervals },
  { id: "intervals_25", category: "training", name: "25 sessioni ripetute", desc: "Completa 25 sessioni di ripetute", icon: "🏆", check: c => c.hasIntervals },
  { id: "intervals_50", category: "training", name: "50 sessioni ripetute", desc: "Completa 50 sessioni di ripetute", icon: "👑", check: c => c.hasIntervals },
  { id: "tempo_1", category: "training", name: "Primo tempo run", desc: "Completa il tuo primo tempo run", icon: "⏱️", check: c => c.hasTempo },
  { id: "tempo_5", category: "training", name: "5 tempo run", desc: "Completa 5 tempo run", icon: "⏱️", check: c => c.hasTempo },
  { id: "tempo_10", category: "training", name: "10 tempo run", desc: "Completa 10 tempo run", icon: "🎯", check: c => c.hasTempo },
  { id: "fartlek_1", category: "training", name: "Primo fartlek", desc: "Completa il tuo primo fartlek", icon: "🎲", check: c => c.hasFartlek },
  { id: "fartlek_5", category: "training", name: "5 fartlek", desc: "Completa 5 fartlek", icon: "🎲", check: c => c.hasFartlek },
  { id: "fartlek_10", category: "training", name: "10 fartlek", desc: "Completa 10 fartlek", icon: "🎯", check: c => c.hasFartlek },
  { id: "long_20", category: "training", name: "Lungo 20+", desc: "Corri un lungo di 20+ km", icon: "🛣️", check: c => c.longestRun >= 20 },
  { id: "long_25", category: "training", name: "Lungo 25+", desc: "Corri un lungo di 25+ km", icon: "🛤️", check: c => c.longestRun >= 25 },
  { id: "long_30", category: "training", name: "Lungo 30+", desc: "Corri un lungo di 30+ km", icon: "🏔️", check: c => c.longestRun >= 30 },
  { id: "long_35", category: "training", name: "Lungo 35+", desc: "Corri un lungo di 35+ km", icon: "⛰️", check: c => c.longestRun >= 35 },
  { id: "hill_runner", category: "training", name: "Scalatore", desc: "Completa una corsa in salita", icon: "⛰️", check: c => c.hasHills },
  { id: "hill_5", category: "training", name: "5 corse in salita", desc: "Completa 5 corse in salita", icon: "⛰️", check: c => c.hasHills },
  { id: "hill_10", category: "training", name: "10 corse in salita", desc: "Completa 10 corse in salita", icon: "🏔️", check: c => c.hasHills },
  { id: "vol_30", category: "training", name: "Volume 30km", desc: "Raggiungi 30 km in una settimana", icon: "📏", check: c => c.maxWeeklyKm >= 30 },
  { id: "vol_40", category: "training", name: "Volume 40km", desc: "Raggiungi 40 km in una settimana", icon: "📏", check: c => c.maxWeeklyKm >= 40 },
  { id: "vol_50", category: "training", name: "Volume 50km", desc: "Raggiungi 50 km in una settimana", icon: "📐", check: c => c.maxWeeklyKm >= 50 },
  { id: "vol_60", category: "training", name: "Volume 60km", desc: "Raggiungi 60 km in una settimana", icon: "📐", check: c => c.maxWeeklyKm >= 60 },
  { id: "vol_70", category: "training", name: "Volume 70km", desc: "Raggiungi 70 km in una settimana", icon: "📏", check: c => c.maxWeeklyKm >= 70 },
  { id: "vol_80", category: "training", name: "Volume 80km", desc: "Raggiungi 80 km in una settimana", icon: "📏", check: c => c.maxWeeklyKm >= 80 },
  { id: "recovery_5", category: "training", name: "5 corse recupero", desc: "Completa 5 corse di recupero", icon: "🧘", check: c => c.runsWithHr >= 5 },

  // ── Mezza Maratona (10) ─────────────────────────────────────────────────
  { id: "hm_15k", category: "halfmarathon", name: "15K", desc: "Corri almeno 15 km", icon: "", check: c => c.longestRun >= 15 },
  { id: "hm_18k", category: "halfmarathon", name: "18K", desc: "Corri almeno 18 km", icon: "🏃‍️", check: c => c.longestRun >= 18 },
  { id: "hm_20k", category: "halfmarathon", name: "20K", desc: "Corri almeno 20 km", icon: "🏃‍♀️", check: c => c.longestRun >= 20 },
  { id: "hm_21k", category: "halfmarathon", name: "Mezza Maratona", desc: "Completa una Mezza Maratona", icon: "🏁", check: c => c.bestHalf !== null },
  { id: "hm_sub230", category: "halfmarathon", name: "Sub 2:30 Mezza", desc: "Corri la Mezza sotto 2:30", icon: "⏱️", check: c => c.bestHalf !== null && c.bestHalf < 9000 },
  { id: "hm_sub215", category: "halfmarathon", name: "Sub 2:15 Mezza", desc: "Corri la Mezza sotto 2:15", icon: "⏱️", check: c => c.bestHalf !== null && c.bestHalf < 8100 },
  { id: "hm_sub200", category: "halfmarathon", name: "Sub 2:00 Mezza", desc: "Corri la Mezza sotto 2:00", icon: "⏱️", check: c => c.bestHalf !== null && c.bestHalf < 7200 },
  { id: "hm_sub150", category: "halfmarathon", name: "Sub 1:50 Mezza", desc: "Corri la Mezza sotto 1:50", icon: "⏱️", check: c => c.bestHalf !== null && c.bestHalf < 6600 },
  { id: "hm_sub145", category: "halfmarathon", name: "Sub 1:45 Mezza", desc: "Corri la Mezza sotto 1:45", icon: "⏱️", check: c => c.bestHalf !== null && c.bestHalf < 6300 },
  { id: "hm_sub140", category: "halfmarathon", name: "Sub 1:40 Mezza", desc: "Corri la Mezza sotto 1:40", icon: "⚡", check: c => c.bestHalf !== null && c.bestHalf < 6000 },

  // ── Scienza (15) ────────────────────────────────────────────────────────
  { id: "zone_ideal", category: "science", name: "Zona Ideale 80/20", desc: "Mantieni l'80% del tempo in Z1-Z2", icon: "🎯", check: c => c.polarizedPct >= 80 },
  { id: "polarized_month", category: "science", name: "Mese Polarizzato", desc: "Completa un mese con distribuzione 80/20", icon: "🌓", check: c => c.polarizedPct >= 80 },
  { id: "max_hr_found", category: "science", name: "FC Max Trovata", desc: "Raggiungi il 95% della FC max", icon: "💓", check: c => c.runsWithHr >= 1 },
  { id: "data_nerd_10", category: "science", name: "Data Nerd 10", desc: "Analizza 10 corse con dati HR", icon: "🤓", check: c => c.runsWithHr >= 10 },
  { id: "data_nerd_50", category: "science", name: "Data Nerd 50", desc: "Analizza 50 corse con dati HR", icon: "🤓", check: c => c.runsWithHr >= 50 },
  { id: "data_nerd_100", category: "science", name: "Data Nerd 100", desc: "Analizza 100 corse con dati HR", icon: "🧠", check: c => c.runsWithHr >= 100 },
  { id: "cadence_170", category: "science", name: "Cadenza 170", desc: "Mantieni cadenza media 170 spm", icon: "🥁", check: c => c.avgCadence >= 170 },
  { id: "cadence_175", category: "science", name: "Cadenza 175", desc: "Mantieni cadenza media 175 spm", icon: "🥁", check: c => c.avgCadence >= 175 },
  { id: "cadence_180", category: "science", name: "Cadenza 180", desc: "Mantieni cadenza media 180 spm", icon: "🥁", check: c => c.avgCadence >= 180 },
  { id: "cadence_185", category: "science", name: "Cadenza 185", desc: "Mantieni cadenza media 185 spm", icon: "🥁", check: c => c.avgCadence >= 185 },
  { id: "cadence_190", category: "science", name: "Cadenza 190", desc: "Mantieni cadenza media 190 spm", icon: "🥁", check: c => c.avgCadence >= 190 },
  { id: "injury_risk_low", category: "science", name: "Injury Risk Low", desc: "Mantieni ACWR < 1.3", icon: "🛡️", check: c => c.injuryRisk < 30 },
  { id: "vdot_calculated", category: "science", name: "VDOT Calcolato", desc: "Calcola il tuo VDOT", icon: "📊", check: c => c.vdot > 0 },
  { id: "paces_calculated", category: "science", name: "Paces Calcolati", desc: "Calcola i tuoi passi di allenamento", icon: "📐", check: c => c.vdot > 0 },
  { id: "predictions_calculated", category: "science", name: "Previsioni Gara", desc: "Calcola le previsioni gara", icon: "🔮", check: c => c.vdot > 0 },

  // ── Velocità Lampo (15) ─────────────────────────────────────────────────
  { id: "speed_100m", category: "speed", name: "100m Sprint", desc: "Corri 100m sotto i 20 secondi", icon: "⚡", check: c => c.fastest100m !== null && c.fastest100m < 20 },
  { id: "speed_200m", category: "speed", name: "200m Sprint", desc: "Corri 200m sotto i 40 secondi", icon: "⚡", check: c => c.fastest200m !== null && c.fastest200m < 40 },
  { id: "speed_400m", category: "speed", name: "400m", desc: "Corri 400m sotto i 90 secondi", icon: "⚡", check: c => c.fastest400m !== null && c.fastest400m < 90 },
  { id: "speed_800m", category: "speed", name: "800m", desc: "Corri 800m sotto i 3:30", icon: "⚡", check: c => c.fastest800m !== null && c.fastest800m < 210 },
  { id: "speed_1k", category: "speed", name: "1K", desc: "Corri 1K sotto i 4:00", icon: "⚡", check: c => c.fastest1k !== null && c.fastest1k < 240 },
  { id: "speed_1k_sub330", category: "speed", name: "1K Sub 3:30", desc: "Corri 1K sotto i 3:30", icon: "💨", check: c => c.fastest1k !== null && c.fastest1k < 210 },
  { id: "speed_1k_sub300", category: "speed", name: "1K Sub 3:00", desc: "Corri 1K sotto i 3:00", icon: "💨", check: c => c.fastest1k !== null && c.fastest1k < 180 },
  { id: "speed_2k", category: "speed", name: "2K", desc: "Corri 2K sotto i 8:30", icon: "⚡", check: c => c.fastest2k !== null && c.fastest2k < 510 },
  { id: "speed_2k_sub730", category: "speed", name: "2K Sub 7:30", desc: "Corri 2K sotto i 7:30", icon: "💨", check: c => c.fastest2k !== null && c.fastest2k < 450 },
  { id: "speed_3k", category: "speed", name: "3K", desc: "Corri 3K sotto i 13:00", icon: "⚡", check: c => c.fastest3k !== null && c.fastest3k < 780 },
  { id: "speed_3k_sub1200", category: "speed", name: "3K Sub 12:00", desc: "Corri 3K sotto i 12:00", icon: "💨", check: c => c.fastest3k !== null && c.fastest3k < 720 },
  { id: "speed_5k", category: "speed", name: "5K Velocista", desc: "Corri 5K sotto i 22:00", icon: "💨", check: c => c.best5k !== null && c.best5k < 1320 },
  { id: "speed_5k_sub20", category: "speed", name: "5K Sub 20:00", desc: "Corri 5K sotto i 20:00", icon: "💨", check: c => c.best5k !== null && c.best5k < 1200 },
  { id: "speed_10k", category: "speed", name: "10K Velocista", desc: "Corri 10K sotto i 45:00", icon: "💨", check: c => c.best10k !== null && c.best10k < 2700 },
  { id: "speed_10k_sub40", category: "speed", name: "10K Sub 40:00", desc: "Corri 10K sotto i 40:00", icon: "💨", check: c => c.best10k !== null && c.best10k < 2400 },

  // ── Fun & Speciali (20) ──────────────────────────────────────────────────
  { id: "first_step", category: "fun", name: "Primo Passo 2026", desc: "Completa la tua prima corsa del 2026", icon: "👶", check: c => c.totalRuns >= 1 },
  { id: "first_week", category: "fun", name: "Prima Settimana 2026", desc: "Completa la tua prima settimana del 2026", icon: "📅", check: c => c.totalRuns >= 3 },
  { id: "first_month", category: "fun", name: "Primo Mese 2026", desc: "Completa il tuo primo mese del 2026", icon: "🗓️", check: c => c.monthsActive >= 1 },
  { id: "run_30min", category: "fun", name: "Corsa 30 min", desc: "Corri per almeno 30 minuti", icon: "⏰", check: c => c.longestTime >= 30 },
  { id: "run_1h", category: "fun", name: "Corsa 1 Ora", desc: "Corri per almeno 1 ora", icon: "⏰", check: c => c.longestTime >= 60 },
  { id: "run_1h30", category: "fun", name: "Corsa 1h30", desc: "Corri per almeno 1 ora e 30 minuti", icon: "⏰", check: c => c.longestTime >= 90 },
  { id: "run_2h", category: "fun", name: "Corsa 2 Ore", desc: "Corri per almeno 2 ore", icon: "⏰", check: c => c.longestTime >= 120 },
  { id: "run_2h30", category: "fun", name: "Corsa 2h30", desc: "Corri per almeno 2 ore e 30 minuti", icon: "⏰", check: c => c.longestTime >= 150 },
  { id: "run_3h", category: "fun", name: "Corsa 3 Ore", desc: "Corri per almeno 3 ore", icon: "⏰", check: c => c.longestTime >= 180 },
  { id: "hours_10", category: "fun", name: "10 Ore totali", desc: "Corri per 10 ore totali nel 2026", icon: "⏱️", check: c => c.totalHours >= 10 },
  { id: "hours_50", category: "fun", name: "50 Ore totali", desc: "Corri per 50 ore totali nel 2026", icon: "⏱️", check: c => c.totalHours >= 50 },
  { id: "hours_100", category: "fun", name: "100 Ore totali", desc: "Corri per 100 ore totali nel 2026", icon: "⏱️", check: c => c.totalHours >= 100 },
  { id: "hours_200", category: "fun", name: "200 Ore totali", desc: "Corri per 200 ore totali nel 2026", icon: "⏱️", check: c => c.totalHours >= 200 },
  { id: "hours_500", category: "fun", name: "500 Ore totali", desc: "Corri per 500 ore totali nel 2026", icon: "⏱️", check: c => c.totalHours >= 500 },
  { id: "elevation_1000", category: "fun", name: "1.000m dislivello", desc: "Completa 1.000m di dislivello totale", icon: "⛰️", check: c => c.totalElevation >= 1000 },
  { id: "elevation_5000", category: "fun", name: "5.000m dislivello", desc: "Completa 5.000m di dislivello totale", icon: "🏔️", check: c => c.totalElevation >= 5000 },
  { id: "elevation_10000", category: "fun", name: "10.000m dislivello", desc: "Completa 10.000m di dislivello totale", icon: "", check: c => c.totalElevation >= 10000 },
  { id: "pace_600", category: "fun", name: "Passo 6:00/km", desc: "Corri a un passo di 6:00/km o più veloce", icon: "🏃", check: c => c.bestPace <= 360 },
  { id: "pace_530", category: "fun", name: "Passo 5:30/km", desc: "Corri a un passo di 5:30/km o più veloce", icon: "🏃", check: c => c.bestPace <= 330 },
  { id: "pace_500", category: "fun", name: "Passo 5:00/km", desc: "Corri a un passo di 5:00/km o più veloce", icon: "🏃", check: c => c.bestPace <= 300 },

  // ── Meteo & Ambiente (15) ───────────────────────────────────────────────
  { id: "rain_run", category: "weather", name: "Corsa sotto la pioggia", desc: "Corri sotto la pioggia", icon: "🌧️", check: c => c.runsInRain >= 1 },
  { id: "rain_5", category: "weather", name: "5 corse sotto la pioggia", desc: "Corri 5 volte sotto la pioggia", icon: "🌧️", check: c => c.runsInRain >= 5 },
  { id: "rain_10", category: "weather", name: "10 corse sotto la pioggia", desc: "Corri 10 volte sotto la pioggia", icon: "🌧️", check: c => c.runsInRain >= 10 },
  { id: "heat_run", category: "weather", name: "Corsa nel caldo", desc: "Corri con temperature sopra i 30°C", icon: "☀️", check: c => c.runsInHeat >= 1 },
  { id: "heat_5", category: "weather", name: "5 corse nel caldo", desc: "Corri 5 volte con caldo", icon: "☀️", check: c => c.runsInHeat >= 5 },
  { id: "cold_run", category: "weather", name: "Corsa nel freddo", desc: "Corri con temperature sotto i 5°C", icon: "❄️", check: c => c.runsInCold >= 1 },
  { id: "cold_5", category: "weather", name: "5 corse nel freddo", desc: "Corri 5 volte con freddo", icon: "❄️", check: c => c.runsInCold >= 5 },
  { id: "snow_run", category: "weather", name: "Corsa nella neve", desc: "Corri nella neve", icon: "🌨️", check: c => c.runsInCold >= 1 },
  { id: "wind_run", category: "weather", name: "Corsa nel vento", desc: "Corri con vento forte", icon: "💨", check: c => c.runsInRain >= 1 },
  { id: "fog_run", category: "weather", name: "Corsa nella nebbia", desc: "Corri nella nebbia", icon: "🌫️", check: c => c.runsInRain >= 1 },
  { id: "sunrise_run", category: "weather", name: "Corsa all'alba", desc: "Corri all'alba", icon: "🌅", check: c => c.hasSunriseRun },
  { id: "sunset_run", category: "weather", name: "Corsa al tramonto", desc: "Corri al tramonto", icon: "🌇", check: c => c.hasSunsetRun },
  { id: "night_run", category: "weather", name: "Corsa notturna", desc: "Corri di notte", icon: "🌙", check: c => c.hasNightRun },
  { id: "full_moon_run", category: "weather", name: "Corsa con luna piena", desc: "Corri con la luna piena", icon: "🌕", check: c => c.hasFullMoonRun },
  { id: "clear_sky_run", category: "weather", name: "Cielo sereno", desc: "Corri con cielo sereno", icon: "☀️", check: c => c.runsInHeat >= 1 },

  // ── Terreno & Superficie (15) ───────────────────────────────────────────
  { id: "road_run", category: "terrain", name: "Corsa su strada", desc: "Corri su strada asfaltata", icon: "🛣️", check: c => c.hasRoadRun },
  { id: "road_10", category: "terrain", name: "10 corse su strada", desc: "Corri 10 volte su strada", icon: "🛣️", check: c => c.hasRoadRun },
  { id: "trail_run", category: "terrain", name: "Corsa su trail", desc: "Corri su sentiero", icon: "🌲", check: c => c.hasTrailRun },
  { id: "trail_5", category: "terrain", name: "5 corse su trail", desc: "Corri 5 volte su trail", icon: "🌲", check: c => c.hasTrailRun },
  { id: "trail_10", category: "terrain", name: "10 corse su trail", desc: "Corri 10 volte su trail", icon: "🌲", check: c => c.hasTrailRun },
  { id: "treadmill_run", category: "terrain", name: "Corsa sul tapis roulant", desc: "Corri sul tapis roulant", icon: "🏃‍♂️", check: c => c.hasTreadmillRun },
  { id: "treadmill_5", category: "terrain", name: "5 corse sul tapis roulant", desc: "Corri 5 volte sul tapis roulant", icon: "🏃‍♂️", check: c => c.hasTreadmillRun },
  { id: "beach_run", category: "terrain", name: "Corsa in spiaggia", desc: "Corri sulla spiaggia", icon: "🏖️", check: c => c.hasBeachRun },
  { id: "forest_run", category: "terrain", name: "Corsa nel bosco", desc: "Corri nel bosco", icon: "🌲", check: c => c.hasForestRun },
  { id: "mountain_run", category: "terrain", name: "Corsa in montagna", desc: "Corri in montagna", icon: "🏔️", check: c => c.hasMountainRun },
  { id: "city_run", category: "terrain", name: "Corsa in città", desc: "Corri in città", icon: "🏙️", check: c => c.hasCityRun },
  { id: "park_run", category: "terrain", name: "Corsa al parco", desc: "Corri al parco", icon: "🌳", check: c => c.hasParkrun },
  { id: "stair_run", category: "terrain", name: "Corsa sulle scale", desc: "Corri sulle scale", icon: "🪜", check: c => c.hasStairRun },
  { id: "flat_run", category: "terrain", name: "Corsa in piano", desc: "Corri su percorso pianeggiante", icon: "📏", check: c => c.hasFlatRun },
  { id: "hilly_run", category: "terrain", name: "Corsa collinare", desc: "Corri su percorso collinare", icon: "⛰️", check: c => c.hasHillyRun },

  // ── Split & Ritmo (20) ──────────────────────────────────────────────────
  { id: "negative_split_5k", category: "split", name: "Negative Split 5K", desc: "Corri la seconda metà del 5K più veloce", icon: "📉", check: c => c.hasNegativeSplit5k },
  { id: "negative_split_10k", category: "split", name: "Negative Split 10K", desc: "Corri la seconda metà del 10K più veloce", icon: "📉", check: c => c.hasNegativeSplit10k },
  { id: "negative_split_half", category: "split", name: "Negative Split Mezza", desc: "Corri la seconda metà della Mezza più veloce", icon: "📉", check: c => c.hasNegativeSplitHalfMarathon },
  { id: "negative_split_marathon", category: "split", name: "Negative Split Maratona", desc: "Corri la seconda metà della Maratona più veloce", icon: "📉", check: c => c.hasNegativeSplitMarathon },
  { id: "even_split_5k", category: "split", name: "Even Split 5K", desc: "Corri il 5K a ritmo costante", icon: "➡️", check: c => c.hasEvenSplit5k },
  { id: "even_split_10k", category: "split", name: "Even Split 10K", desc: "Corri il 10K a ritmo costante", icon: "➡️", check: c => c.hasEvenSplit10k },
  { id: "even_split_half", category: "split", name: "Even Split Mezza", desc: "Corri la Mezza a ritmo costante", icon: "➡️", check: c => c.hasEvenSplitHalfMarathon },
  { id: "even_split_marathon", category: "split", name: "Even Split Maratona", desc: "Corri la Maratona a ritmo costante", icon: "➡️", check: c => c.hasEvenSplitMarathon },
  { id: "progression_run", category: "split", name: "Corsa progressiva", desc: "Corri una corsa con ritmo crescente", icon: "📈", check: c => c.hasProgressionRun },
  { id: "progression_5", category: "split", name: "5 corse progressive", desc: "Completa 5 corse progressive", icon: "📈", check: c => c.hasProgressionRun },
  { id: "progression_10", category: "split", name: "10 corse progressive", desc: "Completa 10 corse progressive", icon: "📈", check: c => c.hasProgressionRun },
  { id: "race_pace_run", category: "split", name: "Ritmo gara", desc: "Corri al ritmo gara target", icon: "🎯", check: c => c.hasRacePaceRun },
  { id: "race_pace_5", category: "split", name: "5 corse ritmo gara", desc: "Corri 5 volte al ritmo gara", icon: "🎯", check: c => c.hasRacePaceRun },
  { id: "race_pace_10", category: "split", name: "10 corse ritmo gara", desc: "Corri 10 volte al ritmo gara", icon: "🎯", check: c => c.hasRacePaceRun },
  { id: "recovery_run", category: "split", name: "Corsa di recupero", desc: "Completa una corsa di recupero", icon: "🧘", check: c => c.hasRecoveryRun },
  { id: "recovery_5", category: "split", name: "5 corse recupero", desc: "Completa 5 corse di recupero", icon: "🧘", check: c => c.hasRecoveryRun },
  { id: "recovery_10", category: "split", name: "10 corse recupero", desc: "Completa 10 corse di recupero", icon: "🧘", check: c => c.hasRecoveryRun },
  { id: "easy_run", category: "split", name: "Corsa facile", desc: "Completa una corsa facile", icon: "😊", check: c => c.hasNegativeSplitEasy },
  { id: "easy_10", category: "split", name: "10 corse facili", desc: "Completa 10 corse facili", icon: "😊", check: c => c.hasNegativeSplitEasy },
  { id: "easy_50", category: "split", name: "50 corse facili", desc: "Completa 50 corse facili", icon: "😊", check: c => c.hasNegativeSplitEasy },

  // ── Eventi Speciali (15) ────────────────────────────────────────────────
  { id: "new_year_run", category: "special", name: "Corsa di Capodanno", desc: "Corri il 1° Gennaio", icon: "🎆", check: c => c.hasNewYearRun },
  { id: "valentine_run", category: "special", name: "Corsa di San Valentino", desc: "Corri il 14 Febbraio", icon: "❤️", check: c => c.hasValentineRun },
  { id: "easter_run", category: "special", name: "Corsa di Pasqua", desc: "Corri a Pasqua", icon: "🐰", check: c => c.hasEasterRun },
  { id: "birthday_run", category: "special", name: "Corsa di compleanno", desc: "Corri il tuo compleanno", icon: "🎂", check: c => c.hasBirthdayRun },
  { id: "christmas_run", category: "special", name: "Corsa di Natale", desc: "Corri il 25 Dicembre", icon: "🎄", check: c => c.hasChristmasRun },
  { id: "halloween_run", category: "special", name: "Corsa di Halloween", desc: "Corri il 31 Ottobre", icon: "🎃", check: c => c.hasHalloweenRun },
  { id: "summer_solstice", category: "special", name: "Solstizio d'estate", desc: "Corri al solstizio d'estate", icon: "☀️", check: c => c.hasSummerSolsticeRun },
  { id: "winter_solstice", category: "special", name: "Solstizio d'inverno", desc: "Corri al solstizio d'inverno", icon: "❄️", check: c => c.hasWinterSolsticeRun },
  { id: "leap_year_run", category: "special", name: "Anno bisestile", desc: "Corri il 29 Febbraio", icon: "📅", check: c => c.hasLeapYearRun },
  { id: "friday_13th", category: "special", name: "Venerdì 13", desc: "Corri un Venerdì 13", icon: "🖤", check: c => c.hasFriday13thRun },
  { id: "pi_day_run", category: "special", name: "Pi Day", desc: "Corri il 14 Marzo (3.14)", icon: "🥧", check: c => c.hasPiDayRun },
  { id: "world_running_day", category: "special", name: "World Running Day", desc: "Corri il World Running Day", icon: "🌍", check: c => c.hasWorldRunningDay },
  { id: "olympic_day", category: "special", name: "Giorno Olimpico", desc: "Corri il Giorno Olimpico", icon: "🏅", check: c => c.hasOlympicDay },
  { id: "marathon_day", category: "special", name: "Marathon Day", desc: "Corri il Marathon Day", icon: "🏃", check: c => c.hasMarathonDay },
  { id: "global_running_day", category: "special", name: "Global Running Day", desc: "Corri il Global Running Day", icon: "🌐", check: c => c.hasGlobalRunningDay },

  // ── Viaggi & Luoghi (15) ────────────────────────────────────────────────
  { id: "vacation_run", category: "travel", name: "Corsa in vacanza", desc: "Corri durante una vacanza", icon: "🏖️", check: c => c.hasVacationRun },
  { id: "business_run", category: "travel", name: "Corsa in trasferta", desc: "Corri durante un viaggio di lavoro", icon: "💼", check: c => c.hasBusinessTripRun },
  { id: "airport_run", category: "travel", name: "Corsa in aeroporto", desc: "Corri vicino a un aeroporto", icon: "✈️", check: c => c.hasAirportRun },
  { id: "hotel_run", category: "travel", name: "Corsa dall'hotel", desc: "Corri partendo da un hotel", icon: "🏨", check: c => c.hasHotelRun },
  { id: "new_city_run", category: "travel", name: "Nuova città", desc: "Corri in una città nuova", icon: "🏙️", check: c => c.hasNewCityRun },
  { id: "new_city_5", category: "travel", name: "5 città nuove", desc: "Corri in 5 città diverse", icon: "🏙️", check: c => c.hasNewCityRun },
  { id: "new_city_10", category: "travel", name: "10 città nuove", desc: "Corri in 10 città diverse", icon: "🏙️", check: c => c.hasNewCityRun },
  { id: "new_country_run", category: "travel", name: "Nuovo paese", desc: "Corri in un paese nuovo", icon: "🌍", check: c => c.hasNewCountryRun },
  { id: "new_country_3", category: "travel", name: "3 paesi nuovi", desc: "Corri in 3 paesi diversi", icon: "🌍", check: c => c.hasNewCountryRun },
  { id: "new_country_5", category: "travel", name: "5 paesi nuovi", desc: "Corri in 5 paesi diversi", icon: "🌍", check: c => c.hasNewCountryRun },
  { id: "new_continent_run", category: "travel", name: "Nuovo continente", desc: "Corri in un continente nuovo", icon: "🌎", check: c => c.hasNewContinentRun },
  { id: "seven_continents", category: "travel", name: "7 Continenti", desc: "Corri in tutti e 7 i continenti", icon: "🌏", check: c => c.hasSevenContinents },
  { id: "high_altitude_run", category: "travel", name: "Alta quota", desc: "Corri sopra i 1.500m", icon: "🏔️", check: c => c.hasHighAltitudeRun },
  { id: "sea_level_run", category: "travel", name: "Livello del mare", desc: "Corri a livello del mare", icon: "🌊", check: c => c.hasSeaLevelRun },
  { id: "desert_run", category: "travel", name: "Corsa nel deserto", desc: "Corri nel deserto", icon: "🏜️", check: c => c.hasDesertRun },

  // ── Social & Compagnia (15) ─────────────────────────────────────────────
  { id: "solo_run", category: "social", name: "Corsa in solitaria", desc: "Corri da solo", icon: "🏃", check: c => c.hasSoloRun },
  { id: "solo_10", category: "social", name: "10 corse in solitaria", desc: "Corri 10 volte da solo", icon: "🏃", check: c => c.hasSoloRun },
  { id: "group_run", category: "social", name: "Corsa di gruppo", desc: "Corri in gruppo", icon: "👥", check: c => c.hasGroupRun },
  { id: "group_5", category: "social", name: "5 corse di gruppo", desc: "Corri 5 volte in gruppo", icon: "👥", check: c => c.hasGroupRun },
  { id: "group_10", category: "social", name: "10 corse di gruppo", desc: "Corri 10 volte in gruppo", icon: "👥", check: c => c.hasGroupRun },
  { id: "run_with_dog", category: "social", name: "Corsa con il cane", desc: "Corri con il tuo cane", icon: "🐕", check: c => c.hasRunWithDog },
  { id: "run_with_partner", category: "social", name: "Corsa con il partner", desc: "Corri con il tuo partner", icon: "💑", check: c => c.hasRunWithPartner },
  { id: "run_with_kids", category: "social", name: "Corsa con i figli", desc: "Corri con i tuoi figli", icon: "👨‍👩‍‍👦", check: c => c.hasRunWithKids },
  { id: "run_with_friends", category: "social", name: "Corsa con amici", desc: "Corri con gli amici", icon: "🤝", check: c => c.hasRunWithFriends },
  { id: "guided_run", category: "social", name: "Corsa guidata", desc: "Segui una corsa guidata", icon: "🎧", check: c => c.hasGuidedRun },
  { id: "audio_run", category: "social", name: "Corsa con audio", desc: "Corri con un audio guida", icon: "🎧", check: c => c.hasAudioRun },
  { id: "music_run", category: "social", name: "Corsa con musica", desc: "Corri ascoltando musica", icon: "🎵", check: c => c.hasMusicRun },
  { id: "podcast_run", category: "social", name: "Corsa con podcast", desc: "Corri ascoltando un podcast", icon: "🎙️", check: c => c.hasPodcastRun },
  { id: "parkrun_1", category: "social", name: "Primo Parkrun", desc: "Completa il tuo primo Parkrun", icon: "🌳", check: c => c.hasParkrun },
  { id: "parkrun_10", category: "social", name: "10 Parkrun", desc: "Completa 10 Parkrun", icon: "🌳", check: c => c.hasParkrun },

  // ── Mindful & Benessere (10) ────────────────────────────────────────────
  { id: "meditative_run", category: "mindful", name: "Corsa meditativa", desc: "Corri in meditazione", icon: "🧘", check: c => c.hasMeditativeRun },
  { id: "meditative_5", category: "mindful", name: "5 corse meditative", desc: "Completa 5 corse meditative", icon: "🧘", check: c => c.hasMeditativeRun },
  { id: "mindful_run", category: "mindful", name: "Corsa consapevole", desc: "Corri con consapevolezza", icon: "🧠", check: c => c.hasMindfulRun >= 1 },
  { id: "mindful_5", category: "mindful", name: "5 corse consapevoli", desc: "Completa 5 corse consapevoli", icon: "🧠", check: c => c.hasMindfulRun >= 5 },
  { id: "gratitude_run", category: "mindful", name: "Corsa di gratitudine", desc: "Corri con gratitudine", icon: "🙏", check: c => c.hasGratitudeRun },
  { id: "gratitude_5", category: "mindful", name: "5 corse di gratitudine", desc: "Completa 5 corse di gratitudine", icon: "🙏", check: c => c.hasGratitudeRun },
  { id: "nature_run", category: "mindful", name: "Corsa nella natura", desc: "Corri immerso nella natura", icon: "🌿", check: c => c.hasForestRun },
  { id: "nature_5", category: "mindful", name: "5 corse nella natura", desc: "Corri 5 volte nella natura", icon: "🌿", check: c => c.hasForestRun },
  { id: "sunrise_meditation", category: "mindful", name: "Meditazione all'alba", desc: "Corri e medita all'alba", icon: "🌅", check: c => c.hasSunriseRun },
  { id: "sunset_meditation", category: "mindful", name: "Meditazione al tramonto", desc: "Corri e medita al tramonto", icon: "🌇", check: c => c.hasSunsetRun },

  // ── Sfide & Record (20) ─────────────────────────────────────────────────
  { id: "pb_100m", category: "challenge", name: "PB 100m", desc: "Stabilisci un record sui 100m", icon: "🏆", check: c => c.fastest100m !== null },
  { id: "pb_200m", category: "challenge", name: "PB 200m", desc: "Stabilisci un record sui 200m", icon: "🏆", check: c => c.fastest200m !== null },
  { id: "pb_400m", category: "challenge", name: "PB 400m", desc: "Stabilisci un record sui 400m", icon: "🏆", check: c => c.fastest400m !== null },
  { id: "pb_800m", category: "challenge", name: "PB 800m", desc: "Stabilisci un record sugli 800m", icon: "🏆", check: c => c.fastest800m !== null },
  { id: "pb_1k", category: "challenge", name: "PB 1K", desc: "Stabilisci un record sul chilometro", icon: "🏆", check: c => c.fastest1k !== null },
  { id: "pb_2k", category: "challenge", name: "PB 2K", desc: "Stabilisci un record sui 2K", icon: "🏆", check: c => c.fastest2k !== null },
  { id: "pb_3k", category: "challenge", name: "PB 3K", desc: "Stabilisci un record sui 3K", icon: "🏆", check: c => c.fastest3k !== null },
  { id: "pb_5k", category: "challenge", name: "PB 5K", desc: "Stabilisci un record sui 5K", icon: "🏆", check: c => c.best5k !== null },
  { id: "pb_10k", category: "challenge", name: "PB 10K", desc: "Stabilisci un record sui 10K", icon: "🏆", check: c => c.best10k !== null },
  { id: "pb_half", category: "challenge", name: "PB Mezza", desc: "Stabilisci un record sulla Mezza", icon: "🏆", check: c => c.bestHalf !== null },
  { id: "pb_marathon", category: "challenge", name: "PB Maratona", desc: "Stabilisci un record sulla Maratona", icon: "🏆", check: c => c.bestMarathon !== null },
  { id: "seasonal_best", category: "challenge", name: "Record stagionale", desc: "Stabilisci un record stagionale", icon: "🌟", check: c => c.hasSeasonalBest },
  { id: "monthly_best", category: "challenge", name: "Record mensile", desc: "Stabilisci un record mensile", icon: "📅", check: c => c.hasMonthlyBest },
  { id: "weekly_best", category: "challenge", name: "Record settimanale", desc: "Stabilisci un record settimanale", icon: "📆", check: c => c.hasWeeklyBest },
  { id: "daily_best", category: "challenge", name: "Record giornaliero", desc: "Stabilisci un record giornaliero", icon: "📅", check: c => c.hasDailyBest },
  { id: "comeback", category: "challenge", name: "Il Ritorno", desc: "Torna a correre dopo una pausa", icon: "🔄", check: c => c.hasComeback },
  { id: "injury_return", category: "challenge", name: "Ritorno dall'infortunio", desc: "Torna a correre dopo un infortunio", icon: "💪", check: c => c.hasInjuryReturn },
  { id: "illness_return", category: "challenge", name: "Ritorno dalla malattia", desc: "Torna a correre dopo una malattia", icon: "💪", check: c => c.hasIllnessReturn },
  { id: "double_pb", category: "challenge", name: "Doppio Record", desc: "Migliora PB su 5K e 10K nello stesso mese", icon: "🎯", check: c => c.hasPersonalBest },
  { id: "triple_pb", category: "challenge", name: "Triplo Record", desc: "Migliora PB su 5K, 10K e Mezza nello stesso mese", icon: "🎯", check: c => c.hasPersonalBest },
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

// ─── Helper: Build Context from Runs (2026 only) ─────────────────────────────

function buildContext(runs: Run[], vdot: number, vdotPeak: number, vdotDelta: number): BadgeContext {
  // Filter runs from 2026 onwards
  const runs2026 = runs.filter(r => isFrom2026(r.date));

  const totalKm = runs2026.reduce((s, r) => s + (r.distance_km || 0), 0);
  const totalRuns = runs2026.length;
  const longestRun = Math.max(...runs2026.map(r => r.distance_km || 0), 0);
  const totalElevation = runs2026.reduce((s, r) => s + (r.elevation_gain || 0), 0);
  const maxElevationRun = Math.max(...runs2026.map(r => r.elevation_gain || 0), 0);
  const totalHours = runs2026.reduce((s, r) => s + (r.elapsed_time || 0) / 3600, 0);
  const longestTime = Math.max(...runs2026.map(r => (r.elapsed_time || 0) / 60), 0);

  // Best times from runs
  let best5k: number | null = null;
  let best10k: number | null = null;
  let bestHalf: number | null = null;
  let bestMarathon: number | null = null;
  let fastest1k: number | null = null;
  let fastest2k: number | null = null;
  let fastest3k: number | null = null;
  let fastest5k: number | null = null;
  let fastest10k: number | null = null;
  let fastestHalf: number | null = null;
  let fastest400m: number | null = null;
  let fastest200m: number | null = null;
  let fastest100m: number | null = null;
  let fastest800m: number | null = null;
  let bestPace = Infinity;

  for (const r of runs2026) {
    const paceSec = parsePaceSec(r.avg_pace);
    if (!paceSec) continue;
    if (paceSec < bestPace) bestPace = paceSec;

    if (r.distance_km >= 0.09 && r.distance_km <= 0.11) {
      const t = paceSec * 0.1;
      if (fastest100m === null || t < fastest100m) fastest100m = t;
    }
    if (r.distance_km >= 0.19 && r.distance_km <= 0.21) {
      const t = paceSec * 0.2;
      if (fastest200m === null || t < fastest200m) fastest200m = t;
    }
    if (r.distance_km >= 0.39 && r.distance_km <= 0.41) {
      const t = paceSec * 0.4;
      if (fastest400m === null || t < fastest400m) fastest400m = t;
    }
    if (r.distance_km >= 0.79 && r.distance_km <= 0.81) {
      const t = paceSec * 0.8;
      if (fastest800m === null || t < fastest800m) fastest800m = t;
    }
    if (r.distance_km >= 0.9 && r.distance_km <= 1.1) {
      const t = paceSec * 1;
      if (fastest1k === null || t < fastest1k) fastest1k = t;
    }
    if (r.distance_km >= 1.9 && r.distance_km <= 2.1) {
      const t = paceSec * 2;
      if (fastest2k === null || t < fastest2k) fastest2k = t;
    }
    if (r.distance_km >= 2.9 && r.distance_km <= 3.1) {
      const t = paceSec * 3;
      if (fastest3k === null || t < fastest3k) fastest3k = t;
    }
    if (r.distance_km >= 4.5 && r.distance_km <= 5.5) {
      const t5k = paceSec * 5;
      if (best5k === null || t5k < best5k) best5k = t5k;
      if (fastest5k === null || t5k < fastest5k) fastest5k = t5k;
    }
    if (r.distance_km >= 9 && r.distance_km <= 11) {
      const t10k = paceSec * 10;
      if (best10k === null || t10k < best10k) best10k = t10k;
      if (fastest10k === null || t10k < fastest10k) fastest10k = t10k;
    }
    if (r.distance_km >= 20 && r.distance_km <= 22) {
      const tHalf = paceSec * 21.0975;
      if (bestHalf === null || tHalf < bestHalf) bestHalf = tHalf;
      if (fastestHalf === null || tHalf < fastestHalf) fastestHalf = tHalf;
    }
    if (r.distance_km >= 40) {
      const tMar = paceSec * 42.195;
      if (bestMarathon === null || tMar < bestMarathon) bestMarathon = tMar;
    }
  }

  // Weekly km
  const weeklyKm: Record<string, number> = {};
  for (const r of runs2026) {
    const d = new Date(r.date);
    const weekKey = `${d.getFullYear()}-W${getWeekNumber(d)}`;
    weeklyKm[weekKey] = (weeklyKm[weekKey] || 0) + r.distance_km;
  }
  const maxWeeklyKm = Math.max(...Object.values(weeklyKm), 0);

  // Monthly km
  const monthlyKm: Record<string, number> = {};
  for (const r of runs2026) {
    const d = new Date(r.date);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyKm[monthKey] = (monthlyKm[monthKey] || 0) + r.distance_km;
  }

  // Weekly runs count
  const weeklyRuns: Record<string, number> = {};
  for (const r of runs2026) {
    const d = new Date(r.date);
    const weekKey = `${d.getFullYear()}-W${getWeekNumber(d)}`;
    weeklyRuns[weekKey] = (weeklyRuns[weekKey] || 0) + 1;
  }

  // Streak calculation
  const sortedDates = [...new Set(runs2026.map(r => r.date))].sort();
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
  const hrRuns = runs2026.filter(r => r.avg_hr && r.avg_hr > 0);
  const z1z2Runs = hrRuns.filter(r => {
    const pct = (r.avg_hr! / 190) * 100;
    return pct < 77;
  });
  const polarizedPct = hrRuns.length > 0 ? (z1z2Runs.length / hrRuns.length) * 100 : 0;

  // Avg cadence
  const cadRuns = runs2026.filter(r => r.avg_cadence && r.avg_cadence > 0);
  const avgCadence = cadRuns.length > 0
    ? cadRuns.reduce((s, r) => s + (r.avg_cadence! * 2), 0) / cadRuns.length
    : 0;

  // Has intervals, hills, etc.
  const hasIntervals = runs2026.some(r => r.run_type === "intervals");
  const hasHills = runs2026.some(r => (r.elevation_gain || 0) > 100);
  const hasProgressive = false;
  const hasNegativeSplit = false;
  const hasBackToBack = false;
  const hasDoubleDay = false;
  const hasEarlyMorning = runs2026.some(r => {
    const h = new Date(r.date).getHours();
    return h < 6;
  });
  const hasNightRun = runs2026.some(r => {
    const h = new Date(r.date).getHours();
    return h >= 22;
  });
  const hasWeekendWarrior = runs2026.filter(r => {
    const day = new Date(r.date).getDay();
    return day === 0 || day === 6;
  }).length >= 20;

  // Weeks active
  const weeksActive = Object.keys(weeklyRuns).length;
  const monthsActive = Object.keys(monthlyKm).length;
  const yearsActive = new Set(runs2026.map(r => new Date(r.date).getFullYear())).size;

  // First/last run
  const dates = runs2026.map(r => r.date).sort();
  const firstRunDate = dates[0] || "";
  const lastRunDate = dates[dates.length - 1] || "";

  // Injury risk
  const injuryRisk = maxWeeklyKm > 60 ? 50 : maxWeeklyKm > 40 ? 30 : 10;

  // Runs count by distance
  const runsOver10k = runs2026.filter(r => r.distance_km >= 10).length;
  const runsOver15k = runs2026.filter(r => r.distance_km >= 15).length;
  const runsOver20k = runs2026.filter(r => r.distance_km >= 20).length;
  const runsOver25k = runs2026.filter(r => r.distance_km >= 25).length;
  const runsOver30k = runs2026.filter(r => r.distance_km >= 30).length;
  const runsOver40k = runs2026.filter(r => r.distance_km >= 40).length;

  // Weather conditions (simplified)
  const runsInRain = runs2026.filter(r => r.weather?.includes("rain") || r.weather?.includes("pioggia")).length;
  const runsInHeat = runs2026.filter(r => (r.temperature || 0) > 30).length;
  const runsInCold = runs2026.filter(r => (r.temperature || 0) < 5).length;

  // Perfect months (30+ runs)
  const perfectMonths = Object.values(monthlyKm).filter((_, i) => {
    const weeks = Object.values(weeklyRuns).slice(i * 4, i * 4 + 4);
    return weeks.reduce((a, b) => a + b, 0) >= 30;
  }).length;

  // Avg weekly runs
  const avgWeeklyRuns = weeksActive > 0 ? totalRuns / weeksActive : 0;
  const avgMonthlyKm = monthsActive > 0 ? totalKm / monthsActive : 0;

  // Training types
  const hasFartlek = runs2026.some(r => r.run_type === "fartlek");
  const hasTempo = runs2026.some(r => r.run_type === "tempo");
  const hasRecovery = runs2026.some(r => r.run_type === "recovery");
  const hasLongRun = runs2026.some(r => r.distance_km >= 15);
  const hasRacePace = runs2026.some(r => r.run_type === "race_pace");
  const hasHillRepeats = runs2026.some(r => r.run_type === "hill_repeats");
  const hasTrackWorkout = runs2026.some(r => r.run_type === "track");
  const hasTrailRun = runs2026.some(r => r.surface === "trail");
  const hasRoadRun = runs2026.some(r => r.surface === "road");
  const hasTreadmillRun = runs2026.some(r => r.surface === "treadmill");
  const hasParkrun = runs2026.some(r => r.event?.includes("parkrun"));
  const hasVirtualRace = runs2026.some(r => r.event?.includes("virtual"));
  const hasCharityRun = runs2026.some(r => r.event?.includes("charity"));
  const hasNightRace = runs2026.some(r => r.event?.includes("night"));
  const hasUltra = runs2026.some(r => r.distance_km >= 50);
  const hasMarathon = runs2026.some(r => r.distance_km >= 42);
  const hasHalfMarathon = runs2026.some(r => r.distance_km >= 21);
  const has10k = runs2026.some(r => r.distance_km >= 10);
  const has5k = runs2026.some(r => r.distance_km >= 5);
  const hasParkrun5k = runs2026.some(r => r.event?.includes("parkrun") && r.distance_km >= 5);
  const hasMile = runs2026.some(r => r.distance_km >= 1.6);
  const has400m = runs2026.some(r => r.distance_km >= 0.4);
  const has200m = runs2026.some(r => r.distance_km >= 0.2);
  const has100m = runs2026.some(r => r.distance_km >= 0.1);
  const hasStairRun = runs2026.some(r => r.surface === "stairs");
  const hasBeachRun = runs2026.some(r => r.surface === "beach");
  const hasForestRun = runs2026.some(r => r.surface === "forest");
  const hasMountainRun = runs2026.some(r => r.surface === "mountain");
  const hasCityRun = runs2026.some(r => r.surface === "city");
  const hasSunriseRun = runs2026.some(r => {
    const h = new Date(r.date).getHours();
    return h >= 5 && h < 7;
  });
  const hasSunsetRun = runs2026.some(r => {
    const h = new Date(r.date).getHours();
    return h >= 18 && h < 20;
  });
  const hasFullMoonRun = runs2026.some(r => r.event?.includes("full moon"));
  const hasNewYearRun = runs2026.some(r => {
    const d = new Date(r.date);
    return d.getMonth() === 0 && d.getDate() === 1;
  });
  const hasBirthdayRun = runs2026.some(r => r.event?.includes("birthday"));
  const hasChristmasRun = runs2026.some(r => {
    const d = new Date(r.date);
    return d.getMonth() === 11 && d.getDate() === 25;
  });
  const hasEasterRun = runs2026.some(r => r.event?.includes("easter"));
  const hasValentineRun = runs2026.some(r => {
    const d = new Date(r.date);
    return d.getMonth() === 1 && d.getDate() === 14;
  });
  const hasHalloweenRun = runs2026.some(r => {
    const d = new Date(r.date);
    return d.getMonth() === 9 && d.getDate() === 31;
  });
  const hasSummerSolsticeRun = runs2026.some(r => r.event?.includes("solstice"));
  const hasWinterSolsticeRun = runs2026.some(r => r.event?.includes("solstice"));
  const hasLeapYearRun = runs2026.some(r => {
    const d = new Date(r.date);
    return d.getMonth() === 1 && d.getDate() === 29;
  });
  const hasFriday13thRun = runs2026.some(r => {
    const d = new Date(r.date);
    return d.getDate() === 13 && d.getDay() === 5;
  });
  const hasPiDayRun = runs2026.some(r => {
    const d = new Date(r.date);
    return d.getMonth() === 2 && d.getDate() === 14;
  });
  const hasWorldRunningDay = runs2026.some(r => r.event?.includes("world running"));
  const hasOlympicDay = runs2026.some(r => r.event?.includes("olympic"));
  const hasMarathonDay = runs2026.some(r => r.event?.includes("marathon day"));
  const hasGlobalRunningDay = runs2026.some(r => r.event?.includes("global running"));
  const hasRunToWork = runs2026.some(r => r.event?.includes("commute"));
  const hasRunHome = runs2026.some(r => r.event?.includes("commute"));
  const hasRunWithDog = runs2026.some(r => r.event?.includes("dog"));
  const hasRunWithPartner = runs2026.some(r => r.event?.includes("partner"));
  const hasRunWithKids = runs2026.some(r => r.event?.includes("kids"));
  const hasRunWithFriends = runs2026.some(r => r.event?.includes("friends"));
  const hasSoloRun = runs2026.some(r => !r.event || r.event === "solo");
  const hasGroupRun = runs2026.some(r => r.event?.includes("group"));
  const hasGuidedRun = runs2026.some(r => r.event?.includes("guided"));
  const hasAudioRun = runs2026.some(r => r.event?.includes("audio"));
  const hasMusicRun = runs2026.some(r => r.event?.includes("music"));
  const hasPodcastRun = runs2026.some(r => r.event?.includes("podcast"));
  const hasMeditativeRun = runs2026.some(r => r.event?.includes("meditative"));
  const hasMindfulRun = runs2026.filter(r => r.event?.includes("mindful")).length;
  const hasGratitudeRun = runs2026.some(r => r.event?.includes("gratitude"));
  const hasGoalRun = runs2026.some(r => r.event?.includes("goal"));
  const hasChallengeRun = runs2026.some(r => r.event?.includes("challenge"));
  const hasPersonalBest = runs2026.some(r => r.event?.includes("pb"));
  const hasSeasonalBest = runs2026.some(r => r.event?.includes("seasonal best"));
  const hasMonthlyBest = runs2026.some(r => r.event?.includes("monthly best"));
  const hasWeeklyBest = runs2026.some(r => r.event?.includes("weekly best"));
  const hasDailyBest = runs2026.some(r => r.event?.includes("daily best"));
  const hasComeback = runs2026.some(r => r.event?.includes("comeback"));
  const hasInjuryReturn = runs2026.some(r => r.event?.includes("injury return"));
  const hasIllnessReturn = runs2026.some(r => r.event?.includes("illness return"));
  const hasVacationRun = runs2026.some(r => r.event?.includes("vacation"));
  const hasBusinessTripRun = runs2026.some(r => r.event?.includes("business"));
  const hasAirportRun = runs2026.some(r => r.event?.includes("airport"));
  const hasHotelRun = runs2026.some(r => r.event?.includes("hotel"));
  const hasNewCityRun = runs2026.some(r => r.event?.includes("new city"));
  const hasNewCountryRun = runs2026.some(r => r.event?.includes("new country"));
  const hasNewContinentRun = runs2026.some(r => r.event?.includes("new continent"));
  const hasSevenContinents = false;
  const hasPolarRun = runs2026.some(r => r.event?.includes("polar"));
  const hasDesertRun = runs2026.some(r => r.event?.includes("desert"));
  const hasJungleRun = runs2026.some(r => r.event?.includes("jungle"));
  const hasArcticRun = runs2026.some(r => r.event?.includes("arctic"));
  const hasAntarcticRun = runs2026.some(r => r.event?.includes("antarctic"));
  const hasEquatorRun = runs2026.some(r => r.event?.includes("equator"));
  const hasTropicRun = runs2026.some(r => r.event?.includes("tropic"));
  const hasHighAltitudeRun = runs2026.some(r => (r.elevation_gain || 0) > 1500);
  const hasSeaLevelRun = runs2026.some(r => (r.elevation_gain || 0) < 100);
  const hasUnderwaterRun = false;
  const hasSnowRun = runs2026.some(r => r.weather?.includes("snow"));
  const hasIceRun = runs2026.some(r => r.weather?.includes("ice"));
  const hasRainRun = runsInRain > 0;
  const hasStormRun = runs2026.some(r => r.weather?.includes("storm"));
  const hasWindRun = runs2026.some(r => r.weather?.includes("wind"));
  const hasFogRun = runs2026.some(r => r.weather?.includes("fog"));
  const hasThunderRun = runs2026.some(r => r.weather?.includes("thunder"));
  const hasLightningRun = runs2026.some(r => r.weather?.includes("lightning"));
  const hasHailRun = runs2026.some(r => r.weather?.includes("hail"));
  const hasSleetRun = runs2026.some(r => r.weather?.includes("sleet"));
  const hasBlizzardRun = runs2026.some(r => r.weather?.includes("blizzard"));
  const hasHeatwaveRun = runsInHeat > 0;
  const hasColdwaveRun = runsInCold > 0;
  const hasHumidRun = runs2026.some(r => r.weather?.includes("humid"));
  const hasDryRun = runs2026.some(r => r.weather?.includes("dry"));
  const hasWindyRun = runs2026.some(r => r.weather?.includes("windy"));
  const hasCalmRun = runs2026.some(r => r.weather?.includes("calm"));
  const hasClearRun = runs2026.some(r => r.weather?.includes("clear"));
  const hasCloudyRun = runs2026.some(r => r.weather?.includes("cloudy"));
  const hasOvercastRun = runs2026.some(r => r.weather?.includes("overcast"));
  const hasPartlyCloudyRun = runs2026.some(r => r.weather?.includes("partly cloudy"));
  const hasMostlyCloudyRun = runs2026.some(r => r.weather?.includes("mostly cloudy"));
  const hasMostlyClearRun = runs2026.some(r => r.weather?.includes("mostly clear"));
  const hasFairRun = runs2026.some(r => r.weather?.includes("fair"));
  const hasHazyRun = runs2026.some(r => r.weather?.includes("hazy"));
  const hasSmokyRun = runs2026.some(r => r.weather?.includes("smoky"));
  const hasDustyRun = runs2026.some(r => r.weather?.includes("dusty"));
  const hasSandyRun = runs2026.some(r => r.weather?.includes("sandy"));
  const hasMuddyRun = runs2026.some(r => r.weather?.includes("muddy"));
  const hasWetRun = runs2026.some(r => r.weather?.includes("wet"));
  const hasDryTrailRun = runs2026.some(r => r.surface === "dry_trail");
  const hasTechnicalTrailRun = runs2026.some(r => r.surface === "technical_trail");
  const hasEasyTrailRun = runs2026.some(r => r.surface === "easy_trail");
  const hasModerateTrailRun = runs2026.some(r => r.surface === "moderate_trail");
  const hasHardTrailRun = runs2026.some(r => r.surface === "hard_trail");
  const hasExtremeTrailRun = runs2026.some(r => r.surface === "extreme_trail");
  const hasFlatRun = runs2026.some(r => r.terrain === "flat");
  const hasRollingRun = runs2026.some(r => r.terrain === "rolling");
  const hasHillyRun = runs2026.some(r => r.terrain === "hilly");
  const hasMountainousRun = runs2026.some(r => r.terrain === "mountainous");
  const hasDownhillRun = runs2026.some(r => r.terrain === "downhill");
  const hasUphillRun = runs2026.some(r => r.terrain === "uphill");
  const hasIntervalRun = hasIntervals;
  const hasTempoRun = hasTempo;
  const hasFartlekRun = hasFartlek;
  const hasProgressionRun = hasProgressive;
  const hasNegativeSplitRun = hasNegativeSplit;
  const hasPositiveSplitRun = false;
  const hasEvenSplitRun = false;
  const hasNegativeSplitRace = false;
  const hasPositiveSplitRace = false;
  const hasEvenSplitRace = false;
  const hasNegativeSplitLong = false;
  const hasPositiveSplitLong = false;
  const hasEvenSplitLong = false;
  const hasNegativeSplitInterval = false;
  const hasPositiveSplitInterval = false;
  const hasEvenSplitInterval = false;
  const hasNegativeSplitTempo = false;
  const hasPositiveSplitTempo = false;
  const hasEvenSplitTempo = false;
  const hasNegativeSplitFartlek = false;
  const hasPositiveSplitFartlek = false;
  const hasEvenSplitFartlek = false;
  const hasNegativeSplitProgression = false;
  const hasPositiveSplitProgression = false;
  const hasEvenSplitProgression = false;
  const hasNegativeSplitRecovery = false;
  const hasPositiveSplitRecovery = false;
  const hasEvenSplitRecovery = false;
  const hasNegativeSplitEasy = false;
  const hasPositiveSplitEasy = false;
  const hasEvenSplitEasy = false;
  const hasRacePaceRun = hasRacePace;
  const hasNegativeSplitRacePace = false;
  const hasPositiveSplitRacePace = false;
  const hasEvenSplitRacePace = false;
  const hasNegativeSplitHillRepeat = false;
  const hasPositiveSplitHillRepeat = false;
  const hasEvenSplitHillRepeat = false;
  const hasNegativeSplitTrackWorkout = false;
  const hasPositiveSplitTrackWorkout = false;
  const hasEvenSplitTrackWorkout = false;
  const hasNegativeSplitTrailRun = false;
  const hasPositiveSplitTrailRun = false;
  const hasEvenSplitTrailRun = false;
  const hasNegativeSplitRoadRun = false;
  const hasPositiveSplitRoadRun = false;
  const hasEvenSplitRoadRun = false;
  const hasNegativeSplitTreadmillRun = false;
  const hasPositiveSplitTreadmillRun = false;
  const hasEvenSplitTreadmillRun = false;
  const hasNegativeSplitParkrun = false;
  const hasPositiveSplitParkrun = false;
  const hasEvenSplitParkrun = false;
  const hasNegativeSplitVirtualRace = false;
  const hasPositiveSplitVirtualRace = false;
  const hasEvenSplitVirtualRace = false;
  const hasNegativeSplitCharityRun = false;
  const hasPositiveSplitCharityRun = false;
  const hasEvenSplitCharityRun = false;
  const hasNegativeSplitNightRace = false;
  const hasPositiveSplitNightRace = false;
  const hasEvenSplitNightRace = false;
  const hasNegativeSplitUltra = false;
  const hasPositiveSplitUltra = false;
  const hasEvenSplitUltra = false;
  const hasNegativeSplitMarathon = false;
  const hasPositiveSplitMarathon = false;
  const hasEvenSplitMarathon = false;
  const hasNegativeSplitHalfMarathon = false;
  const hasPositiveSplitHalfMarathon = false;
  const hasEvenSplitHalfMarathon = false;
  const hasNegativeSplit10k = false;
  const hasPositiveSplit10k = false;
  const hasEvenSplit10k = false;
  const hasNegativeSplit5k = false;
  const hasPositiveSplit5k = false;
  const hasEvenSplit5k = false;
  const hasNegativeSplitParkrun5k = false;
  const hasPositiveSplitParkrun5k = false;
  const hasEvenSplitParkrun5k = false;
  const hasNegativeSplitMile = false;
  const hasPositiveSplitMile = false;
  const hasEvenSplitMile = false;
  const hasNegativeSplit400m = false;
  const hasPositiveSplit400m = false;
  const hasEvenSplit400m = false;
  const hasNegativeSplit200m = false;
  const hasPositiveSplit200m = false;
  const hasEvenSplit200m = false;
  const hasNegativeSplit100m = false;
  const hasPositiveSplit100m = false;
  const hasEvenSplit100m = false;

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
    runs: runs2026,
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
    totalElevation,
    maxElevationRun,
    avgPace: bestPace === Infinity ? 0 : bestPace,
    bestPace: bestPace === Infinity ? 0 : bestPace,
    runsInRain,
    runsInHeat,
    runsInCold,
    longestTime,
    fastest1k,
    fastest2k,
    fastest3k,
    fastest5k,
    fastest10k,
    fastestHalf,
    totalHours,
    runsOver10k,
    runsOver15k,
    runsOver20k,
    runsOver25k,
    runsOver30k,
    runsOver40k,
    monthsActive,
    yearsActive,
    perfectMonths,
    longestRestDay: 0,
    avgWeeklyRuns,
    avgMonthlyKm,
    hasFartlek,
    hasTempo,
    hasRecovery,
    hasLongRun,
    hasRacePace,
    hasHillRepeats,
    hasTrackWorkout,
    hasTrailRun,
    hasRoadRun,
    hasTreadmillRun,
    hasParkrun,
    hasVirtualRace,
    hasCharityRun,
    hasNightRace,
    hasUltra,
    hasMarathon,
    hasHalfMarathon,
    has10k,
    has5k,
    hasParkrun5k,
    hasMile,
    has400m,
    has200m,
    has100m,
    hasStairRun,
    hasBeachRun,
    hasForestRun,
    hasMountainRun,
    hasCityRun,
    hasSunriseRun,
    hasSunsetRun,
    hasFullMoonRun,
    hasNewYearRun,
    hasBirthdayRun,
    hasChristmasRun,
    hasEasterRun,
    hasValentineRun,
    hasHalloweenRun,
    hasSummerSolsticeRun,
    hasWinterSolsticeRun,
    hasLeapYearRun,
    hasFriday13thRun,
    hasPiDayRun,
    hasWorldRunningDay,
    hasOlympicDay,
    hasMarathonDay,
    hasGlobalRunningDay,
    hasRunToWork,
    hasRunHome,
    hasRunWithDog,
    hasRunWithPartner,
    hasRunWithKids,
    hasRunWithFriends,
    hasSoloRun,
    hasGroupRun,
    hasGuidedRun,
    hasAudioRun,
    hasMusicRun,
    hasPodcastRun,
    hasMeditativeRun,
    hasMindfulRun,
    hasGratitudeRun,
    hasGoalRun,
    hasChallengeRun,
    hasPersonalBest,
    hasSeasonalBest,
    hasMonthlyBest,
    hasWeeklyBest,
    hasDailyBest,
    hasComeback,
    hasInjuryReturn,
    hasIllnessReturn,
    hasVacationRun,
    hasBusinessTripRun,
    hasAirportRun,
    hasHotelRun,
    hasNewCityRun,
    hasNewCountryRun,
    hasNewContinentRun,
    hasSevenContinents,
    hasPolarRun,
    hasDesertRun,
    hasJungleRun,
    hasArcticRun,
    hasAntarcticRun,
    hasEquatorRun,
    hasTropicRun,
    hasHighAltitudeRun,
    hasSeaLevelRun,
    hasUnderwaterRun,
    hasSnowRun,
    hasIceRun,
    hasRainRun,
    hasStormRun,
    hasWindRun,
    hasFogRun,
    hasThunderRun,
    hasLightningRun,
    hasHailRun,
    hasSleetRun,
    hasBlizzardRun,
    hasHeatwaveRun,
    hasColdwaveRun,
    hasHumidRun,
    hasDryRun,
    hasWindyRun,
    hasCalmRun,
    hasClearRun,
    hasCloudyRun,
    hasOvercastRun,
    hasPartlyCloudyRun,
    hasMostlyCloudyRun,
    hasMostlyClearRun,
    hasFairRun,
    hasHazyRun,
    hasSmokyRun,
    hasDustyRun,
    hasSandyRun,
    hasMuddyRun,
    hasWetRun,
    hasDryTrailRun,
    hasTechnicalTrailRun,
    hasEasyTrailRun,
    hasModerateTrailRun,
    hasHardTrailRun,
    hasExtremeTrailRun,
    hasFlatRun,
    hasRollingRun,
    hasHillyRun,
    hasMountainousRun,
    hasDownhillRun,
    hasUphillRun,
    hasIntervalRun,
    hasTempoRun,
    hasFartlekRun,
    hasProgressionRun,
    hasNegativeSplitRun,
    hasPositiveSplitRun,
    hasEvenSplitRun,
    hasNegativeSplitRace,
    hasPositiveSplitRace,
    hasEvenSplitRace,
    hasNegativeSplitLong,
    hasPositiveSplitLong,
    hasEvenSplitLong,
    hasNegativeSplitInterval,
    hasPositiveSplitInterval,
    hasEvenSplitInterval,
    hasNegativeSplitTempo,
    hasPositiveSplitTempo,
    hasEvenSplitTempo,
    hasNegativeSplitFartlek,
    hasPositiveSplitFartlek,
    hasEvenSplitFartlek,
    hasNegativeSplitProgression,
    hasPositiveSplitProgression,
    hasEvenSplitProgression,
    hasNegativeSplitRecovery,
    hasPositiveSplitRecovery,
    hasEvenSplitRecovery,
    hasNegativeSplitEasy,
    hasPositiveSplitEasy,
    hasEvenSplitEasy,
    hasRacePaceRun,
    hasNegativeSplitRacePace,
    hasPositiveSplitRacePace,
    hasEvenSplitRacePace,
    hasNegativeSplitHillRepeat,
    hasPositiveSplitHillRepeat,
    hasEvenSplitHillRepeat,
    hasNegativeSplitTrackWorkout,
    hasPositiveSplitTrackWorkout,
    hasEvenSplitTrackWorkout,
    hasNegativeSplitTrailRun,
    hasPositiveSplitTrailRun,
    hasEvenSplitTrailRun,
    hasNegativeSplitRoadRun,
    hasPositiveSplitRoadRun,
    hasEvenSplitRoadRun,
    hasNegativeSplitTreadmillRun,
    hasPositiveSplitTreadmillRun,
    hasEvenSplitTreadmillRun,
    hasNegativeSplitParkrun,
    hasPositiveSplitParkrun,
    hasEvenSplitParkrun,
    hasNegativeSplitVirtualRace,
    hasPositiveSplitVirtualRace,
    hasEvenSplitVirtualRace,
    hasNegativeSplitCharityRun,
    hasPositiveSplitCharityRun,
    hasEvenSplitCharityRun,
    hasNegativeSplitNightRace,
    hasPositiveSplitNightRace,
    hasEvenSplitNightRace,
    hasNegativeSplitUltra,
    hasPositiveSplitUltra,
    hasEvenSplitUltra,
    hasNegativeSplitMarathon,
    hasPositiveSplitMarathon,
    hasEvenSplitMarathon,
    hasNegativeSplitHalfMarathon,
    hasPositiveSplitHalfMarathon,
    hasEvenSplitHalfMarathon,
    hasNegativeSplit10k,
    hasPositiveSplit10k,
    hasEvenSplit10k,
    hasNegativeSplit5k,
    hasPositiveSplit5k,
    hasEvenSplit5k,
    hasNegativeSplitParkrun5k,
    hasPositiveSplitParkrun5k,
    hasEvenSplitParkrun5k,
    hasNegativeSplitMile,
    hasPositiveSplitMile,
    hasEvenSplitMile,
    hasNegativeSplit400m,
    hasPositiveSplit400m,
    hasEvenSplit400m,
    hasNegativeSplit200m,
    hasPositiveSplit200m,
    hasEvenSplit200m,
    hasNegativeSplit100m,
    hasPositiveSplit100m,
    hasEvenSplit100m,
    fastest400m,
    fastest200m,
    fastest100m,
    fastest800m,
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