// ─────────────────────────────────────────────────────────────────────────────
// DETRAINING MODEL — Coyle 1984 + Mujika & Padilla 2000 + literature update.
//
// Physiologically corrected curve with TAPER WINDOW: the first 5-7 days of
// reduced training do NOT cause measurable VO2max or threshold loss in trained
// runners. Plasma volume drops fast but is largely compensated by haematocrit
// rise, while glycogen super-compensation and fatigue dissipation can produce a
// small performance BOOST (the taper effect, basis of pre-race rest).
//
// References (consolidated up to Apr 2026):
//   - Coyle EF et al. 1984 — Time course of loss of adaptations after stopping
//     prolonged intense endurance training. J Appl Physiol.
//   - Mujika I, Padilla S. 2000 — Detraining: loss of training-induced
//     physiological & performance adaptations (parts I-II). Sports Med.
//   - Bosquet L et al. 2007 — Effects of tapering on performance: meta-analysis.
//     Med Sci Sports Exerc. (avg +1.96% performance after 8-14d taper).
//   - Bosquet L et al. 2013 — Effect of training cessation on muscular performance:
//     meta-analysis. Scand J Med Sci Sports.
//   - Mujika I. 2018 — Tapering: Sciences & Practice. Hum Kinet.
//   - Bruusgaard JC et al. 2010 — Myonuclei acquired by overload exercise
//     precede hypertrophy and are not lost on detraining. PNAS.
//   - Seaborne RA et al. 2018 — Human skeletal muscle possesses an epigenetic
//     memory of hypertrophy. Sci Rep.
//   - Murach KA et al. 2020 — Myonuclear accretion is a determinant of exercise-
//     induced remodeling in skeletal muscle. eLife.
//   - Sousa AC et al. 2019/2024 — Detraining in endurance & retraining velocity.
//
// Pace impact assumes steady-state aerobic running where speed scales with
// VO2max at a given relative effort: pace(t) = pace(0) / (VO2(t)/VO2(0)).
// Back-to-fit ratio (Mujika): ~2-3 days easy retraining per day off; for
// long-trained athletes the satellite-cell / myonuclei reserve shortens this.
// ─────────────────────────────────────────────────────────────────────────────

import type { BikeSession, Profile, Run } from '../types/api';

export interface DetrainingProfileInputs {
  age: number;
  sex: 'M' | 'F' | string;
  weightKg: number;
  yearsRunning: number;
  weeklyKmAvg: number;
  vdot: number | null;
}

export interface DetrainingPoint {
  day: number;
  vo2Pct: number;
  ltPct: number;
  plasmaPct: number;
  mitochondriaPct: number;
  capillaryPct: number;
  strokeVolumePct: number;
  restingHrDelta: number;
  performancePct: number;   // overall performance index, may > 1 in taper window
  phase: 'taper' | 'plateau' | 'detraining' | 'plateau-low';
}

export interface DetrainingSummary {
  inputs: DetrainingProfileInputs;
  trainingFactor: number;
  ageFactor: number;
  protective: number;
  taperDays: number;
  vo2MaxLossCap: number;
  ltLossCap: number;
  plasmaLossCap: number;
  mitochondriaLossCap: number;
  capillaryLossCap: number;
  baselineVo2: number | null;
  curve: DetrainingPoint[];
  snapshots: DetrainingPoint[];
  paceProjection: PaceProjection[];
  backToFit: BackToFitEntry[];
  taperPeakDay: number;
  taperPeakBoost: number;
}

export interface PaceProjection {
  basePaceLabel: string;
  basePaceSecPerKm: number;
  level: 'beginner' | 'intermediate' | 'advanced' | 'elite';
  rows: { day: number; paceSecPerKm: number; paceLabel: string; lossPct: number }[];
}

export interface BackToFitEntry {
  daysOff: number;
  daysToRecover: number;
  ratio: number;
  note: string;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

export function paceLabel(secPerKm: number): string {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return '—';
  const total = Math.round(secPerKm);
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

export function parsePace(label: string): number {
  const m = /^(\d+):(\d+)/.exec(String(label).trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function buildDetrainingInputs(
  profile: Profile | null | undefined,
  runs: Run[],
  vdot: number | null
): DetrainingProfileInputs {
  const age = Number(profile?.age) || 35;
  const sex = (profile?.sex || 'M').toUpperCase();
  const weightKg = Number(profile?.weight_kg) || 70;

  let yearsRunning = 0;
  if (profile?.started_running) {
    const d = new Date(profile.started_running);
    if (!Number.isNaN(d.getTime())) {
      yearsRunning = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
    }
  }
  if (yearsRunning <= 0 && runs.length) {
    const dates = runs.map((r) => new Date(r.date).getTime()).filter(Number.isFinite);
    if (dates.length) {
      const oldest = Math.min(...dates);
      yearsRunning = (Date.now() - oldest) / (365.25 * 24 * 3600 * 1000);
    }
  }
  yearsRunning = Math.max(0, yearsRunning);

  const cutoff = Date.now() - 12 * 7 * 24 * 3600 * 1000;
  const recent = runs.filter((r) => new Date(r.date).getTime() >= cutoff);
  const totalKm = recent.reduce((s, r) => s + Number(r.distance_km || 0), 0);
  const weeklyKmAvg = totalKm / 12;

  return { age, sex, weightKg, yearsRunning, weeklyKmAvg, vdot };
}

// ─── DECAY MATH ──────────────────────────────────────────────────────────────
//
// Core formula per system: pct(t) = 1 - L_max · (1 - exp(-effDay/τ))
// where effDay = max(0, day - lag). The lag implements the taper window for
// each system (different physiological inertia).

// VO2max and threshold: same timing in both modes (see TAPER vs FULL STOP).
// Shared with the bike scenario, which replays the full stop day by day.
const LAG_VO2 = 7;
const TAU_VO2 = 18;
const LAG_LT = 5;
const TAU_LT = 14;

export type DetrainingMode = 'taper' | 'fullStop';

export function computeDetrainingCurve(
  inputs: DetrainingProfileInputs,
  daysMax = 90,
  mode: DetrainingMode = 'taper'
): DetrainingSummary {
  const { age, yearsRunning, weeklyKmAvg, vdot } = inputs;

  const vdotScore = vdot ? clamp((vdot - 30) / 30) : clamp(weeklyKmAvg / 80);
  const volScore = clamp(weeklyKmAvg / 80);
  const histScore = clamp(yearsRunning / 10);
  const trainingFactor = clamp(0.4 * vdotScore + 0.4 * volScore + 0.2 * histScore);

  const ageFactor = 1 + Math.max(0, (age - 35)) / 100;
  const protective = clamp(1 - 0.04 * yearsRunning, 0.7, 1);

  // Plateau loss caps (literature consensus, scaled by training/age/protective).
  const vo2MaxLossCap = clamp((0.10 + 0.07 * trainingFactor) * ageFactor * protective, 0, 0.22);
  const tauVo2 = TAU_VO2;

  const ltLossCap = clamp(vo2MaxLossCap * 1.45, 0, 0.30);
  const tauLt = TAU_LT;

  const plasmaLossCap = 0.10;
  const tauPlasma = 2.2;

  const mitochondriaLossCap = clamp((0.30 + 0.20 * trainingFactor) * ageFactor, 0.25, 0.55);
  const tauMito = 28;

  const capillaryLossCap = clamp(0.20 * trainingFactor + 0.05, 0.05, 0.25);
  const tauCap = 45;

  const strokeLossCap = clamp(0.10 + 0.10 * trainingFactor, 0.10, 0.20);
  const tauStroke = 12;

  const restingHrMax = 5 + 5 * trainingFactor;
  const tauHr = 14;

  // ── TAPER vs FULL STOP ────────────────────────────────────────────────────
  //
  // taper:    reduced low-volume easy running maintained (Bosquet's meta).
  //           Lags long, taper-bell ON. Performance can rise +1-3% (Bosquet 2007).
  // fullStop: zero training, sedentary (Coyle 1984's actual experiment).
  //           Shorter lags for plasma, stroke volume and mitochondria, no taper
  //           boost, plateau caps slightly higher for capillary/mito.
  //
  // VO2max and threshold start at the same day in both modes: a week without
  // running does not lower VO2max in trained runners (Cullinane 1986: unchanged
  // after 10 days of complete rest), the measurable drop comes in weeks 2-3
  // (Coyle 1984: -7% at 21 days). Threshold goes a little earlier. What
  // separates the modes there is the size of the loss and the taper boost, so
  // the taper curve never sits below the full stop.
  const isFullStop = mode === 'fullStop';

  const taperDays = isFullStop ? 2 : 5;
  const lagVo2 = LAG_VO2;
  const lagLt = LAG_LT;
  const lagMito = isFullStop ? 1 : 3;
  const lagCap = isFullStop ? 7 : 14;
  const lagStroke = isFullStop ? 1 : 4;
  const lagHr = isFullStop ? 2 : 5;
  // Plasma always drops early — same lag in both modes.

  // Full stop pushes plateau caps higher (more disuse atrophy long-term).
  if (isFullStop) {
    // Re-bind via closure: bump the caps used below by ~15-20%.
  }
  const fullStopMul = isFullStop ? 1.18 : 1.0;
  const vo2Cap = clamp(vo2MaxLossCap * fullStopMul, 0, 0.25);
  const ltCap = clamp(ltLossCap * fullStopMul, 0, 0.32);
  const mitoCap = clamp(mitochondriaLossCap * fullStopMul, 0.25, 0.6);
  const capCap = clamp(capillaryLossCap * fullStopMul, 0.05, 0.30);

  // Taper boost only when mode = 'taper'. In full stop there is small fatigue
  // dissipation but no glycogen super-comp from continued training, so boost ≈ 0.
  const taperPeakBoost = isFullStop ? 0 : (0.005 + 0.025 * trainingFactor);
  const taperPeakDay = isFullStop ? 0 : 8;

  const curve: DetrainingPoint[] = [];
  for (let d = 0; d <= daysMax; d += 1) {
    const eff = (lag: number) => Math.max(0, d - lag);

    const decayVo2 = vo2Cap * (1 - Math.exp(-eff(lagVo2) / tauVo2));
    const decayLt = ltCap * (1 - Math.exp(-eff(lagLt) / tauLt));
    const decayPlasma = plasmaLossCap * (1 - Math.exp(-d / tauPlasma));
    const decayMito = mitoCap * (1 - Math.exp(-eff(lagMito) / tauMito));
    const decayCap = capCap * (1 - Math.exp(-eff(lagCap) / tauCap));
    const decayStroke = strokeLossCap * (1 - Math.exp(-eff(lagStroke) / tauStroke));
    const decayHr = restingHrMax * (1 - Math.exp(-eff(lagHr) / tauHr));

    // Performance index combines VO2 (60%), LT (30%), neuromuscular taper boost (10%).
    // Taper bell: positive in days 1-12, peaks around day 8.
    const taperBell = d >= 1 && d <= 14
      ? Math.exp(-Math.pow(d - taperPeakDay, 2) / 12)
      : 0;
    const taperGain = taperPeakBoost * taperBell;
    const performancePct = clamp(
      1 + taperGain - 0.6 * decayVo2 - 0.4 * decayLt,
      0.5,
      1.05
    );

    let phase: DetrainingPoint['phase'];
    if (d <= taperDays) phase = 'taper';
    else if (d <= 14) phase = 'plateau';
    else if (d <= 45) phase = 'detraining';
    else phase = 'plateau-low';

    curve.push({
      day: d,
      vo2Pct: 1 - decayVo2,
      ltPct: 1 - decayLt,
      plasmaPct: 1 - decayPlasma,
      mitochondriaPct: 1 - decayMito,
      capillaryPct: 1 - decayCap,
      strokeVolumePct: 1 - decayStroke,
      restingHrDelta: decayHr,
      performancePct,
      phase,
    });
  }

  const snapshotDays = [3, 7, 14, 30, 60];
  const snapshots = snapshotDays.map((d) => curve[d]);

  const baselineVo2 = vdot ? Number(vdot) : null;

  // Pace projection driven by performance index (so taper window shows BOOST).
  const pacePresets: { label: string; sec: number; level: PaceProjection['level'] }[] = [
    { label: '5:00/km', sec: 300, level: 'intermediate' },
    { label: '4:00/km', sec: 240, level: 'advanced' },
    { label: '3:30/km', sec: 210, level: 'elite' },
  ];

  const paceProjection: PaceProjection[] = pacePresets.map((preset) => {
    const rows = snapshotDays.map((d) => {
      const perf = curve[d].performancePct;
      const newSec = preset.sec / perf;
      return {
        day: d,
        paceSecPerKm: newSec,
        paceLabel: paceLabel(newSec),
        lossPct: (1 - perf) * 100, // negative = boost
      };
    });
    return {
      basePaceLabel: preset.label,
      basePaceSecPerKm: preset.sec,
      level: preset.level,
      rows,
    };
  });

  // Back-to-fit ratio (Mujika): ~2-3d retraining per day off; less if long-trained.
  const ratio = 2 + 0.5 * (1 - protective) * 4 + Math.max(0, (age - 35) / 50);
  const backToFit: BackToFitEntry[] = [
    { daysOff: 7, daysToRecover: Math.max(2, Math.round(7 * ratio * 0.4)), ratio,
      note: 'Stop ≤ taper: spesso bastano 2-4 corse leggere per recuperare PV e ritmo.' },
    { daysOff: 14, daysToRecover: Math.round(14 * ratio * 0.7), ratio,
      note: 'Soglia leggera + lunghi controllati riportano enzimi ossidativi a target.' },
    { daysOff: 30, daysToRecover: Math.round(30 * ratio), ratio,
      note: 'Mitocondri e capillari risalgono in 4-6 settimane di volume costante.' },
    { daysOff: 60, daysToRecover: Math.round(60 * ratio), ratio,
      note: 'Servono 4-5 mesi: prima base aerobica, poi soglia, poi VO2.' },
  ];

  return {
    inputs,
    trainingFactor,
    ageFactor,
    protective,
    taperDays,
    vo2MaxLossCap: vo2Cap,
    ltLossCap: ltCap,
    plasmaLossCap,
    mitochondriaLossCap: mitoCap,
    capillaryLossCap: capCap,
    baselineVo2,
    curve,
    snapshots,
    paceProjection,
    backToFit,
    taperPeakDay,
    taperPeakBoost,
  };
}

// ─── DAYS SINCE LAST RUN ─────────────────────────────────────────────────────

export function daysSinceLastRun(runs: Run[]): number {
  if (!runs.length) return 0;
  const lastTs = Math.max(...runs.map((r) => new Date(r.date).getTime()).filter(Number.isFinite));
  if (!Number.isFinite(lastTs)) return 0;
  const ms = Date.now() - lastTs;
  return Math.max(0, Math.floor(ms / (24 * 3600 * 1000)));
}

// ─── 5K PROJECTION FROM VDOT ─────────────────────────────────────────────────

export function predict5kFromVdot(vdot: number): number {
  // Empirical Daniels fit (sec).
  // VDOT 30 -> 30:40 (1840) | 40 -> 23:38 (1418) | 50 -> 19:17 (1157) | 60 -> 16:00 (960).
  if (vdot >= 60) return 960 - (vdot - 60) * 18;
  if (vdot >= 50) return 1157 - (vdot - 50) * 19.7;
  if (vdot >= 40) return 1418 - (vdot - 40) * 26.1;
  if (vdot >= 30) return 1840 - (vdot - 30) * 42.2;
  return 2300;
}

// ─── WHAT-IF: race time after N days off, using performance index ────────────

export function projectRaceTime(
  baseTimeSec: number,
  curve: DetrainingPoint[],
  day: number
): { sec: number; label: string; deltaSec: number } {
  const point = curve[Math.max(0, Math.min(curve.length - 1, day))];
  const newSec = baseTimeSec / point.performancePct;
  const delta = newSec - baseTimeSec;
  const total = Math.round(newSec);
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return { sec: newSec, label: `${m}:${String(s).padStart(2, '0')}`, deltaSec: delta };
}

export function formatLossLine(point: DetrainingPoint): string {
  const vo2 = ((1 - point.vo2Pct) * 100).toFixed(1);
  const lt = ((1 - point.ltPct) * 100).toFixed(1);
  const pv = ((1 - point.plasmaPct) * 100).toFixed(1);
  return `D${point.day}: VO2 -${vo2}% · LT -${lt}% · PV -${pv}%`;
}

// ─── BICI NEI GIORNI SENZA CORSA ─────────────────────────────────────────────
//
// Quanto la bici tiene il motore aerobico quando non corri. Salire in sella
// non basta: conta la dose, e una seduta entra nella dose solo se allena.
//
// SEDUTA — sotto i 10 minuti non conta (ACSM, Garber 2011: il lavoro aerobico
// si somma a blocchi di almeno 10'; Hickson 1982: 13' al giorno tengono il
// VO2max, ma a intensità quasi massimale). Sotto il 30% della riserva non
// conta, dal 45% conta tutta, in mezzo in proporzione: sono le intensità
// minime che allenano il VO2max sotto e sopra i 40 ml/kg/min (Swain &
// Franklin 2002).
//
// DOSE — TRIMP delle sedute che contano (formula del backend: minuti · x ·
// 0.64·e^(1.92x), x = frazione della riserva) negli ultimi 7 giorni, contro
// il TRIMP settimanale delle corse nelle 6 settimane prima dello stop.
// Hickson 1981/1982: a parità di intensità il VO2max regge con un terzo del
// volume, mentre togliendone due terzi cala già la resistenza lunga. Dose
// piena: 1/3 del carico di corsa per la parte centrale, 2/3 per la periferica.
//
// TRASFERIMENTO — quanto di quella dose vale per la corsa (Tanaka 1994;
// Millet 2009). La parte centrale (volume plasmatico, gittata, VO2max) la
// allena qualsiasi lavoro aerobico: 0.8. Della periferica (mitocondri,
// capillari, soglia) la bici ha in comune i quadricipiti, non polpacci e
// femorali: 0.5.
//
// SCENARIO — lo stop si rigioca giorno per giorno: ogni giorno le perdite del
// fermo totale tendono a un tetto ridotto dalla protezione di quel giorno,
// con le stesse costanti di tempo della curva. Con la dose piena e costante
// resta un quinto del calo del VO2max e metà di quello della soglia; la bici
// fatta solo a inizio stop smette di proteggere, quella iniziata dopo
// settimane ferme recupera coi suoi tempi.
//
// INTENSITÀ di ogni seduta, dal dato più affidabile:
//   - FC, se credibile: in bici la FC max è ~5% più bassa (Millet 2009); sotto
//     un quarto della riserva su un'ora di pedalata è il sensore che non legge
//     (Kinomap passa spesso 60–75 bpm);
//   - potenza misurata: VO2 = 10.8·W/kg + 7 ml/kg/min (ACSM), in % della
//     riserva di VO2 (≈ % riserva FC, Swain & Leutholtz 1997) sul VO2max in
//     bici, ~8% sotto quello di corsa nei runner (Basset & Boulay 2000);
//   - nessuno dei due: la mediana delle altre sedute, o 0.45 (cyclette facile).

const BIKE_BASELINE_DAYS = 42;
const BIKE_DOSE_DAYS = 7;
const BIKE_MIN_MINUTES = 10;
const BIKE_EFFECTIVE_FROM = 0.3;
const BIKE_EFFECTIVE_FULL = 0.45;
const BIKE_HRMAX_RATIO = 0.95;
const BIKE_VO2MAX_RATIO = 0.92;
const BIKE_MIN_HRR = 0.25;
const BIKE_DEFAULT_HRR = 0.45;
const TRANSFER_CENTRAL = 0.8;
const TRANSFER_PERIPHERAL = 0.5;

const trimp = (minutes: number, x: number) => minutes * x * 0.64 * Math.exp(1.92 * x);

const isoDay = (date: string | null | undefined) => String(date ?? '').slice(0, 10);

function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Quanto conta una seduta per il VO2max, 0–1: niente sotto i 10' o sotto il 30% della riserva, tutta dal 45%. */
export function bikeEfficacy(minutes: number, x: number): number {
  if (minutes < BIKE_MIN_MINUTES) return 0;
  return clamp((x - BIKE_EFFECTIVE_FROM) / (BIKE_EFFECTIVE_FULL - BIKE_EFFECTIVE_FROM));
}

export interface BikeAthlete {
  maxHr: number;
  restingHr: number;
  weightKg: number;
  vo2max: number;
}

export type BikeIntensitySource = 'hr' | 'power' | 'estimate';

/** Intensità di una seduta come frazione della riserva; null senza un dato credibile. */
export function bikeIntensity(
  s: BikeSession,
  a: BikeAthlete,
): { x: number; source: 'hr' | 'power' } | null {
  const bikeMax = a.maxHr * BIKE_HRMAX_RATIO;
  if (s.avg_hr && bikeMax > a.restingHr) {
    const x = (s.avg_hr - a.restingHr) / (bikeMax - a.restingHr);
    const flat = s.max_hr != null && s.max_hr <= s.avg_hr; // un solo campione
    if (x >= BIKE_MIN_HRR && !flat) return { x: clamp(x), source: 'hr' };
  }
  if (s.avg_watts && a.weightKg > 0) {
    const vo2 = (10.8 * s.avg_watts) / a.weightKg + 7;
    return { x: clamp((vo2 - 3.5) / (a.vo2max * BIKE_VO2MAX_RATIO - 3.5)), source: 'power' };
  }
  return null;
}

export interface BikeSessionCredit {
  date: string;
  minutes: number;
  /** Frazione della riserva, e da dove viene. */
  x: number;
  source: BikeIntensitySource;
  /** 0–1: quanto conta per il VO2max. */
  efficacy: number;
}

/** 0–1: quanto la bici toglie alle perdite del fermo totale. */
export interface BikeProtection {
  vo2: number;
  lt: number;
}

export interface BikeCoverage {
  /** Sedute dopo l'ultima corsa, ognuna con quanto conta. */
  sessions: BikeSessionCredit[];
  minutes: number;
  /** Quante contano almeno in parte. */
  counted: number;
  /** TRIMP utile della bici negli ultimi 7 giorni; settimanale di corsa nelle 6 settimane prima dello stop. */
  bikeWeeklyTrimp: number;
  runWeeklyTrimp: number;
  /** 0–1: quanta della dose che tiene il VO2max (1/3 del carico di corsa), negli ultimi 7 giorni. */
  coverage: number;
  /** Protezione di ogni giorno dall'ultima corsa (indice = giorni di stop). */
  daily: BikeProtection[];
  /** Minuti a settimana per tenere il VO2max, all'intensità delle tue uscite (almeno il 45% della riserva). */
  maintenanceMinPerWeek: number;
}

export function computeBikeCoverage(
  profile: Profile | null | undefined,
  runs: Run[],
  bikes: BikeSession[],
  vdot: number | null,
  daysOff: number,
): BikeCoverage | null {
  const lastRun = runs.reduce((max, r) => (isoDay(r.date) > max ? isoDay(r.date) : max), '');
  if (!lastRun) return null;

  const maxHr = Number(profile?.max_hr) || 190;
  const restingHr = Number(profile?.resting_hr) || 50;
  const athlete: BikeAthlete = {
    maxHr,
    restingHr,
    weightKg: Number(profile?.weight_kg) || 70,
    vo2max: Number(vdot) || 45,
  };

  // Carico di corsa prima dello stop: stessa formula e stesso ripiego (0.55) del backend.
  const from = shiftIso(lastRun, 1 - BIKE_BASELINE_DAYS);
  let runTrimp = 0;
  for (const r of runs) {
    const d = isoDay(r.date);
    if (d < from || d > lastRun) continue;
    const x = r.avg_hr && maxHr > restingHr ? clamp((r.avg_hr - restingHr) / (maxHr - restingHr)) : 0.55;
    runTrimp += trimp(Number(r.duration_minutes) || 0, x);
  }
  const runWeeklyTrimp = runTrimp / (BIKE_BASELINE_DAYS / 7);
  if (runWeeklyTrimp <= 0) return null;

  // Intensità di riferimento dalle uscite vere (dai 10'): 5' a tutta non
  // dicono come pedali.
  const measured = bikes.map((s) => bikeIntensity(s, athlete));
  const known = measured
    .flatMap((m, i) => (m && Number(bikes[i].duration_minutes) >= BIKE_MIN_MINUTES ? [m.x] : []))
    .sort((a, b) => a - b);
  const fallback = known.length ? median(known) : BIKE_DEFAULT_HRR;

  const sessions: BikeSessionCredit[] = [];
  const doseByDay = new Array<number>(daysOff + 1).fill(0);
  bikes.forEach((s, i) => {
    const date = isoDay(s.date);
    const gap = daysBetween(lastRun, date);
    if (gap < 1) return;
    const m = measured[i];
    const x = m?.x ?? fallback;
    const minutes = Number(s.duration_minutes) || 0;
    const efficacy = bikeEfficacy(minutes, x);
    doseByDay[Math.min(gap, daysOff)] += trimp(minutes, x) * efficacy;
    sessions.push({ date, minutes, x, source: m?.source ?? 'estimate', efficacy });
  });

  // La dose di ogni giorno è la bici utile degli ultimi 7 giorni.
  const doseAt = (day: number) => {
    let dose = 0;
    for (let k = Math.max(1, day - BIKE_DOSE_DAYS + 1); k <= day; k += 1) dose += doseByDay[k];
    return dose;
  };
  const daily = doseByDay.map((_, day): BikeProtection => {
    const ratio = doseAt(day) / runWeeklyTrimp;
    return { vo2: TRANSFER_CENTRAL * clamp(ratio * 3), lt: TRANSFER_PERIPHERAL * clamp(ratio * 1.5) };
  });
  const bikeWeeklyTrimp = doseAt(daysOff);

  // Intensità delle uscite vere, per dire quanta bici serve.
  const real = sessions.filter((s) => s.minutes >= BIKE_MIN_MINUTES);
  const realMinutes = real.reduce((sum, s) => sum + s.minutes, 0);
  const typicalX = realMinutes > 0 ? real.reduce((sum, s) => sum + s.x * s.minutes, 0) / realMinutes : fallback;

  return {
    sessions,
    minutes: sessions.reduce((sum, s) => sum + s.minutes, 0),
    counted: sessions.filter((s) => s.efficacy > 0).length,
    bikeWeeklyTrimp,
    runWeeklyTrimp,
    coverage: clamp((bikeWeeklyTrimp / runWeeklyTrimp) * 3),
    daily,
    maintenanceMinPerWeek: runWeeklyTrimp / 3 / trimp(1, Math.max(typicalX, BIKE_EFFECTIVE_FULL)),
  };
}

/**
 * Scenario reale con la bici: il fermo totale (`fullStop`, la sua curva)
 * rigiocato giorno per giorno. Ogni giorno le perdite tendono al tetto del
 * fermo totale ridotto dalla protezione di quel giorno, con le costanti di
 * tempo della curva: senza bici coincide col fermo totale.
 */
export function bikeScenarioPoint(
  fullStop: DetrainingSummary,
  daily: BikeProtection[],
  day: number,
): Pick<DetrainingPoint, 'vo2Pct' | 'ltPct' | 'performancePct'> {
  const kVo2 = 1 - Math.exp(-1 / TAU_VO2);
  const kLt = 1 - Math.exp(-1 / TAU_LT);
  let vo2Loss = 0;
  let ltLoss = 0;
  for (let d = 1; d <= day; d += 1) {
    const p = daily[Math.min(d, daily.length - 1)] ?? { vo2: 0, lt: 0 };
    if (d > LAG_VO2) vo2Loss += (fullStop.vo2MaxLossCap * (1 - p.vo2) - vo2Loss) * kVo2;
    if (d > LAG_LT) ltLoss += (fullStop.ltLossCap * (1 - p.lt) - ltLoss) * kLt;
  }
  return {
    vo2Pct: 1 - vo2Loss,
    ltPct: 1 - ltLoss,
    // stessa combinazione del modello (60% VO2max, 40% soglia), senza bonus taper
    performancePct: clamp(1 - 0.6 * vo2Loss - 0.4 * ltLoss, 0.5, 1.05),
  };
}
