/**
 * Race prediction delta estimator.
 *
 * Given the user's last qualifying run and the backend race-prediction map
 * (analytics.race_predictions), estimate the time gain (negative seconds)
 * that the next predictions snapshot is likely to show on each target.
 *
 * This is a *client-side projection layer* on top of authoritative backend
 * predictions — it does NOT replace them. The backend remains the source of
 * truth for the absolute predicted time; this util only computes a small
 * "expected delta from today's effort" hint shown next to each target.
 *
 * MIGRATION NOTE: ideally this whole projection lives in FastAPI alongside
 * the backend's race_predictions builder so the client never has to classify
 * stimuli or weight benefit tables. See REPORT-TECNICO.md → CHANGELOG FIX.
 */
import type { Run } from '../types/api';
import { parsePaceToSecs, hmsToSecs } from './paceFormat';

export type RaceTarget = '5K' | '10K' | '21K' | '42K';
type Stim = 'intervals' | 'tempo' | 'medium_long' | 'long_endurance' | 'easy';

export interface RacePrediction {
  label: string;
  short: RaceTarget;
  km: number;
  /** Backend key matched in race_predictions, or null if no match. */
  key: string | null;
  /** Predicted time string from backend (e.g. "0:25:42"), or null. */
  timeStr: string | null;
  /** Predicted time as seconds, or null. */
  secs: number | null;
  /** Estimated delta in seconds (negative = improvement). null if unknown. */
  deltaSec: number | null;
}

const TARGETS: { label: string; short: RaceTarget; km: number; patterns: string[] }[] = [
  { label: '5K', short: '5K', km: 5, patterns: ['5k'] },
  { label: '10K', short: '10K', km: 10, patterns: ['10k'] },
  { label: 'Mezza', short: '21K', km: 21.0975, patterns: ['half', 'mezza', '21'] },
  { label: 'Maratona', short: '42K', km: 42.195, patterns: ['marathon', 'maratona', '42'] },
];

// Benefit table: estimated seconds gain per stimulus (magnitude=1.0) per target.
// Calibrated against the canonical example: tempo 10km @ threshold → -5/-13/-40/-62.
const BENEFIT: Record<Stim, Record<RaceTarget, number>> = {
  intervals: { '5K': 8, '10K': 6, '21K': 3, '42K': 2 },
  tempo: { '5K': 5, '10K': 13, '21K': 40, '42K': 62 },
  medium_long: { '5K': 2, '10K': 8, '21K': 45, '42K': 95 },
  long_endurance: { '5K': 1, '10K': 4, '21K': 30, '42K': 130 },
  easy: { '5K': 1, '10K': 2, '21K': 6, '42K': 12 },
};

const TYPICAL_KM: Record<Stim, number> = {
  intervals: 6,
  tempo: 10,
  medium_long: 18,
  long_endurance: 30,
  easy: 8,
};

function normaliseKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '').replace('kilometre', 'k').replace('km', 'k');
}

function findPredictionKey(keys: string[], patterns: string[]): string | null {
  return keys.find((k) => patterns.some((p) => normaliseKey(k).includes(p))) ?? null;
}

interface ClassifyResult {
  stim: Stim | null;
  magnitude: number;
}

/**
 * Classify a single run into a stimulus type and compute its volume/intensity
 * magnitude relative to a "typical" session of that stimulus.
 */
function classifyStimulus(last: Run, thresholdPace: string | null): ClassifyResult {
  const distKm = last.distance_km;
  const paceSec = parsePaceToSecs(last.avg_pace ?? '');
  const hrPctRaw = last.avg_hr_pct;
  const hrPct = hrPctRaw != null ? (hrPctRaw > 1 ? hrPctRaw / 100 : hrPctRaw) : null;

  // paceRatio: 1.0 = at threshold, >1 faster (harder), <1 slower (easier)
  const tPaceSec = thresholdPace ? parsePaceToSecs(thresholdPace) : null;
  const paceRatio =
    tPaceSec && paceSec > 0
      ? tPaceSec / paceSec
      : hrPct !== null
        ? hrPct / 0.87 // 87% HR ≈ threshold
        : 1.0;

  let stim: Stim;
  if (distKm >= 25) stim = 'long_endurance';
  else if (distKm >= 15 && paceRatio < 1.03) stim = 'medium_long';
  else if (paceRatio >= 1.05 && distKm < 8) stim = 'intervals';
  else if (paceRatio >= 0.92) stim = 'tempo';
  else if (hrPct !== null && hrPct < 0.72) stim = 'easy';
  else stim = 'tempo';

  // Magnitude = volume relative to typical session for that stimulus, clamped.
  let magnitude = Math.max(0.2, Math.min(2.0, distKm / TYPICAL_KM[stim]));
  if (paceRatio > 1.0) magnitude *= 1 + (paceRatio - 1) * 0.8;
  magnitude = Math.min(2.5, magnitude);

  return { stim, magnitude };
}

export interface RacePredictionInputs {
  /** Backend race_predictions map: { "5K": "0:25:42", "10K": "0:53:11", ... } */
  predictions: Record<string, string>;
  /** All runs (most-recent-first ideally; util re-sorts the qualifying subset). */
  runs: Run[];
  /** Threshold pace (mm:ss) — Daniels T-pace. Used to classify the stimulus. */
  thresholdPace: string | null;
}

/**
 * Build the four race-prediction cards. Pure: no React, no fetch.
 * Returns one entry per target (5K, 10K, 21K, 42K).
 */
export function buildRacePredictions(input: RacePredictionInputs): RacePrediction[] {
  const { predictions, runs, thresholdPace } = input;
  const keys = Object.keys(predictions);

  // Last valid outdoor run (paceSec > 180 ⇒ slower than 3:00/km, filters obvious noise)
  const valid = runs.filter(
    (r) => !r.is_treadmill && r.avg_pace && parsePaceToSecs(r.avg_pace) > 180 && r.distance_km >= 3,
  );
  const last = valid[0] ?? null;

  const { stim, magnitude } = last
    ? classifyStimulus(last, thresholdPace)
    : { stim: null as Stim | null, magnitude: 0 };

  return TARGETS.map((t) => {
    const key = findPredictionKey(keys, t.patterns);
    const timeStr = key ? predictions[key] : null;
    const secs = timeStr ? hmsToSecs(timeStr) : null;
    let deltaSec: number | null = null;
    if (stim) {
      const base = BENEFIT[stim][t.short];
      const d = Math.round(base * magnitude);
      // Improvement = negative; ignore deltas below 1s.
      deltaSec = d >= 1 ? -d : null;
    }
    return { label: t.label, short: t.short, km: t.km, key, timeStr, secs, deltaSec };
  });
}
