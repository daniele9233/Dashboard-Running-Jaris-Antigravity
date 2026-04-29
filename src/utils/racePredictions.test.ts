import { describe, it, expect } from 'vitest';
import { buildRacePredictions } from './racePredictions';
import type { Run } from '../types/api';

const makeRun = (overrides: Partial<Run>): Run =>
  ({
    id: 'r1',
    date: '2026-04-01',
    distance_km: 10,
    duration_minutes: 50,
    avg_pace: '5:00',
    avg_hr: null,
    avg_hr_pct: null,
    is_treadmill: false,
    has_gps: true,
    elevation_gain: null,
    polyline: null,
    start_latlng: null,
    name: 'Test run',
    ...overrides,
  }) as Run;

describe('buildRacePredictions', () => {
  it('returns 4 targets (5K/10K/21K/42K) anche con input vuoto', () => {
    const out = buildRacePredictions({ predictions: {}, runs: [], thresholdPace: null });
    expect(out).toHaveLength(4);
    expect(out.map((p) => p.short)).toEqual(['5K', '10K', '21K', '42K']);
  });

  it('matches predictions backend a target con pattern', () => {
    const out = buildRacePredictions({
      predictions: { '5K': '0:25:42', '10K': '0:53:11', 'half-marathon': '2:01:00' },
      runs: [],
      thresholdPace: null,
    });
    const five = out.find((p) => p.short === '5K')!;
    expect(five.timeStr).toBe('0:25:42');
    expect(five.secs).toBe(25 * 60 + 42);

    const half = out.find((p) => p.short === '21K')!;
    expect(half.timeStr).toBe('2:01:00');
  });

  it('deltaSec è null senza runs validi', () => {
    const out = buildRacePredictions({ predictions: {}, runs: [], thresholdPace: '4:00' });
    out.forEach((p) => expect(p.deltaSec).toBeNull());
  });

  it('classifica tempo ad alta intensità → delta negativo (improvement)', () => {
    // Run 10km al passo soglia (= 4:00/km) → stim "tempo"
    const runs = [makeRun({ distance_km: 10, avg_pace: '4:00', date: '2026-04-15' })];
    const out = buildRacePredictions({
      predictions: {},
      runs,
      thresholdPace: '4:00',
    });
    const tenK = out.find((p) => p.short === '10K')!;
    expect(tenK.deltaSec).not.toBeNull();
    expect(tenK.deltaSec!).toBeLessThan(0); // improvement = negativo
  });

  it('skippa treadmill runs nel classifier', () => {
    const runs = [
      makeRun({ distance_km: 10, avg_pace: '4:00', is_treadmill: true, date: '2026-04-15' }),
    ];
    const out = buildRacePredictions({
      predictions: {},
      runs,
      thresholdPace: '4:00',
    });
    out.forEach((p) => expect(p.deltaSec).toBeNull());
  });
});
