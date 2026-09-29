import { describe, expect, it } from "vitest";
import type { BikeSession, Profile, Run } from "../types/api";
import {
  bikeIntensity,
  bikeScenarioPoint,
  buildDetrainingInputs,
  computeBikeCoverage,
  computeDetrainingCurve,
  type BikeAthlete,
} from "./detrainingModel";

const athlete: BikeAthlete = { maxHr: 180, restingHr: 50, weightKg: 68, vo2max: 50 };
const profile = { max_hr: 180, weight_kg: 68, age: 40, sex: "M" } as Profile;

const bike = (date: string, extra: Partial<BikeSession> = {}): BikeSession => ({
  id: date,
  date,
  name: null,
  sport_type: "VirtualRide",
  duration_minutes: 60,
  avg_hr: null,
  max_hr: null,
  avg_watts: null,
  ...extra,
});

const run = (date: string, minutes = 45, hr = 150): Run =>
  ({ id: date, date, duration_minutes: minutes, avg_hr: hr, distance_km: 9 }) as Run;

/** Quattro corse a settimana per sei settimane, l'ultima il 24 settembre. */
function sixWeeksOfRuns(): Run[] {
  const out: Run[] = [];
  for (let d = 0; d < 42; d += 1) {
    if (d % 7 > 3) continue;
    const day = new Date(Date.UTC(2026, 8, 24 - d)).toISOString().slice(0, 10);
    out.push(run(day));
  }
  return out;
}

describe("bikeIntensity", () => {
  it("scarta la FC di Kinomap che non legge e passa alla potenza", () => {
    const flat = bikeIntensity(bike("2026-09-26", { avg_hr: 61, max_hr: 61, avg_watts: 111 }), athlete);
    expect(flat?.source).toBe("power");
    // 111 W a 68 kg ≈ 24.6 ml/kg/min su un VO2max in bici di 46 → metà riserva
    expect(flat?.x).toBeCloseTo(0.5, 1);

    const low = bikeIntensity(bike("2026-09-17", { avg_hr: 76, max_hr: 88, avg_watts: 102 }), athlete);
    expect(low?.source).toBe("power");
  });

  it("usa la FC quando è credibile, sulla FC max ridotta della bici", () => {
    const garmin = bikeIntensity(bike("2026-09-07", { avg_hr: 104, max_hr: 118 }), athlete);
    expect(garmin?.source).toBe("hr");
    expect(garmin?.x).toBeCloseTo((104 - 50) / (171 - 50), 5);
  });

  it("senza FC né potenza non inventa nulla", () => {
    expect(bikeIntensity(bike("2026-09-14"), athlete)).toBeNull();
  });
});

describe("computeBikeCoverage", () => {
  const runs = sixWeeksOfRuns();

  it("conta solo le sedute dopo l'ultima corsa", () => {
    const c = computeBikeCoverage(profile, runs, [bike("2026-09-24", { avg_watts: 110 })], 50, 5)!;
    expect(c.sessions).toBe(0);
    expect(c.coverage).toBe(0);
    expect(c.protection).toEqual({ vo2: 0, lt: 0, perf: 0 });
    expect(c.maintenanceMinPerWeek).toBeGreaterThan(0);
  });

  it("una cyclette facile in cinque giorni copre poco", () => {
    const c = computeBikeCoverage(profile, runs, [bike("2026-09-26", { duration_minutes: 42, avg_watts: 111 })], 50, 5)!;
    expect(c.sessions).toBe(1);
    expect(c.sources).toEqual({ hr: 0, power: 1, estimate: 0 });
    expect(c.coverage).toBeGreaterThan(0);
    expect(c.coverage).toBeLessThan(0.5);
  });

  it("la dose piena tiene la parte centrale, la periferica solo in parte", () => {
    const heavy = ["2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29"].map((d) =>
      bike(d, { duration_minutes: 90, avg_hr: 140, max_hr: 160 }),
    );
    const c = computeBikeCoverage(profile, runs, heavy, 50, 7)!;
    expect(c.coverage).toBe(1);
    expect(c.protection.vo2).toBeCloseTo(0.8, 5);
    expect(c.protection.lt).toBeLessThanOrEqual(0.5);
  });

  it("le sedute senza dati prendono l'intensità mediana delle altre", () => {
    const c = computeBikeCoverage(
      profile,
      runs,
      [bike("2026-09-25"), bike("2026-09-20", { avg_watts: 100 }), bike("2026-09-10", { avg_hr: 110, max_hr: 125 })],
      50,
      5,
    )!;
    expect(c.sources).toEqual({ hr: 0, power: 0, estimate: 1 });
    expect(c.coverage).toBeGreaterThan(0);
  });

  it("senza corse non c'è un carico di riferimento", () => {
    expect(computeBikeCoverage(profile, [], [bike("2026-09-26")], 50, 5)).toBeNull();
  });
});

describe("bikeScenarioPoint", () => {
  it("sta fra fermo totale e taper, e coincide col fermo senza bici", () => {
    const inputs = buildDetrainingInputs(profile, sixWeeksOfRuns(), 50);
    const taper = computeDetrainingCurve(inputs, 60, "taper").curve[30];
    const full = computeDetrainingCurve(inputs, 60, "fullStop").curve[30];

    const none = bikeScenarioPoint(taper, full, { vo2: 0, lt: 0, perf: 0 });
    expect(none.vo2Pct).toBe(full.vo2Pct);
    expect(none.performancePct).toBe(full.performancePct);

    const some = bikeScenarioPoint(taper, full, { vo2: 0.8, lt: 0.5, perf: 0.68 });
    expect(some.vo2Pct).toBeGreaterThan(full.vo2Pct);
    expect(some.vo2Pct).toBeLessThan(taper.vo2Pct);
    expect(some.performancePct).toBeGreaterThan(full.performancePct);
    expect(some.performancePct).toBeLessThan(taper.performancePct);
  });
});
