import { describe, expect, it } from "vitest";
import type { BikeSession, Profile, Run } from "../types/api";
import {
  bikeEfficacy,
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
    out.push(run(new Date(Date.UTC(2026, 8, 24 - d)).toISOString().slice(0, 10)));
  }
  return out;
}

/** Il giorno n dopo l'ultima corsa. */
const day = (n: number) => new Date(Date.UTC(2026, 8, 24 + n)).toISOString().slice(0, 10);

const runs = sixWeeksOfRuns();
const inputs = buildDetrainingInputs(profile, runs, 50);
const full = computeDetrainingCurve(inputs, 60, "fullStop");
const taper = computeDetrainingCurve(inputs, 60, "taper");

describe("curva del fermo totale", () => {
  it("nella prima settimana il VO2max non cala (Cullinane 1986)", () => {
    for (let d = 0; d <= 7; d += 1) expect(full.curve[d].vo2Pct).toBe(1);
    expect(full.curve[5].performancePct).toBe(1);
  });

  it("a tre settimane il calo è nell'ordine di Coyle 1984 (-7%)", () => {
    const loss = 1 - full.curve[21].vo2Pct;
    expect(loss).toBeGreaterThan(0.05);
    expect(loss).toBeLessThan(0.1);
  });

  it("il taper non sta mai sotto il fermo totale", () => {
    for (let d = 0; d <= 60; d += 1) {
      expect(taper.curve[d].vo2Pct).toBeGreaterThanOrEqual(full.curve[d].vo2Pct);
      expect(taper.curve[d].performancePct).toBeGreaterThanOrEqual(full.curve[d].performancePct);
    }
  });
});

describe("bikeEfficacy", () => {
  it("sotto i 10 minuti non conta, a qualunque intensità", () => {
    expect(bikeEfficacy(5, 0.9)).toBe(0);
    expect(bikeEfficacy(9.9, 0.6)).toBe(0);
  });

  it("sotto il 30% della riserva non conta, dal 45% conta tutta", () => {
    expect(bikeEfficacy(60, 0.25)).toBe(0);
    expect(bikeEfficacy(60, 0.3)).toBe(0);
    expect(bikeEfficacy(60, 0.375)).toBeCloseTo(0.5, 5);
    expect(bikeEfficacy(60, 0.45)).toBe(1);
    expect(bikeEfficacy(60, 0.8)).toBe(1);
  });
});

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
  const cov = (bikes: BikeSession[], daysOff = 5) => computeBikeCoverage(profile, runs, bikes, 50, daysOff)!;

  const unprotected = (c: ReturnType<typeof cov>) => c.daily.every((p) => p.vo2 === 0 && p.lt === 0);
  const perMinuteAt45 = 0.45 * 0.64 * Math.exp(1.92 * 0.45);

  it("conta solo le sedute dopo l'ultima corsa", () => {
    const c = cov([bike("2026-09-24", { avg_watts: 110 })]);
    expect(c.sessions).toHaveLength(0);
    expect(c.coverage).toBe(0);
    expect(unprotected(c)).toBe(true);
  });

  it("cinque minuti di cyclette non tengono niente, anche forti", () => {
    const c = cov([bike(day(2), { duration_minutes: 5, avg_watts: 200 })]);
    expect(c.sessions).toHaveLength(1);
    expect(c.counted).toBe(0);
    expect(c.coverage).toBe(0);
    expect(unprotected(c)).toBe(true);
    // e non decidono nemmeno l'intensità con cui si contano i minuti che servono
    expect(c.maintenanceMinPerWeek).toBeCloseTo(c.runWeeklyTrimp / 3 / perMinuteAt45, 6);
  });

  it("un'ora a passeggio non tiene il VO2max", () => {
    // FC 86 su una FC max in bici di 171: 30% della riserva
    const c = cov([bike(day(2), { avg_hr: 86, max_hr: 95 })]);
    expect(c.sessions[0].source).toBe("hr");
    expect(c.counted).toBe(0);
    expect(c.coverage).toBe(0);
  });

  it("la cyclette del 26 settembre conta tutta ma copre solo una parte della dose", () => {
    const c = cov([bike(day(2), { duration_minutes: 42.1, avg_hr: 61, max_hr: 61, avg_watts: 111 })]);
    expect(c.sessions[0]).toMatchObject({ source: "power", efficacy: 1 });
    expect(c.coverage).toBeGreaterThan(0.2);
    expect(c.coverage).toBeLessThan(0.5);
  });

  const hard = { duration_minutes: 60, avg_hr: 135, max_hr: 150 };
  const lossAt = (bikes: BikeSession[], d: number) => 1 - bikeScenarioPoint(full, cov(bikes, d).daily, d).vo2Pct;
  const fullLossAt = (d: number) => 1 - full.curve[d].vo2Pct;

  it("la dose piena e costante tiene il VO2max: resta un quinto del calo", () => {
    const everyDay = Array.from({ length: 30 }, (_, i) => bike(day(i + 1), { ...hard, duration_minutes: 45 }));
    const c = cov(everyDay, 30);
    expect(c.coverage).toBe(1);
    expect(c.daily[30]).toEqual({ vo2: 0.8, lt: 0.5 });
    expect(lossAt(everyDay, 30)).toBeCloseTo(fullLossAt(30) * 0.2, 6);
    expect(bikeScenarioPoint(full, c.daily, 30).performancePct).toBeGreaterThan(full.curve[30].performancePct);
  });

  it("la bici fatta solo a inizio stop, a quattro settimane, non tiene più", () => {
    const early = [1, 3, 5].map((n) => bike(day(n), hard));
    expect(cov(early, 28).coverage).toBe(0);
    expect(lossAt(early, 28)).toBeGreaterThan(fullLossAt(28) * 0.85);
  });

  it("iniziata dopo tre settimane ferme non cancella il calo", () => {
    const late = [22, 24, 26].map((n) => bike(day(n), hard));
    expect(cov(late, 28).coverage).toBeGreaterThan(0.9);
    expect(lossAt(late, 28)).toBeGreaterThan(fullLossAt(28) * 0.5);
    // ma la stessa bici fatta per tutto lo stop sì
    const steady = [1, 3, 5, 8, 10, 12, 15, 17, 19, 22, 24, 26].map((n) => bike(day(n), hard));
    expect(lossAt(steady, 28)).toBeLessThan(fullLossAt(28) * 0.35);
  });

  it("le sedute senza dati prendono l'intensità mediana delle altre", () => {
    const c = cov([bike(day(1)), bike("2026-09-20", { avg_watts: 100 }), bike("2026-09-10", { avg_hr: 110, max_hr: 125 })]);
    expect(c.sessions).toHaveLength(1);
    expect(c.sessions[0].source).toBe("estimate");
    expect(c.counted).toBe(1);
  });

  it("quanta bici serve: più forte, meno minuti; troppo piano, il conto si fa al 45%", () => {
    const easy = cov([bike(day(2), { avg_hr: 110, max_hr: 120 })]);
    const hard = cov([bike(day(2), { avg_hr: 135, max_hr: 150 })]);
    expect(hard.maintenanceMinPerWeek).toBeLessThan(easy.maintenanceMinPerWeek);
    // FC 84 = 28% della riserva: la seduta non conta, e i minuti si contano al 45%
    const tooEasy = cov([bike(day(2), { avg_hr: 84, max_hr: 92 })]);
    expect(tooEasy.maintenanceMinPerWeek).toBeCloseTo(tooEasy.runWeeklyTrimp / 3 / perMinuteAt45, 6);
    expect(tooEasy.maintenanceMinPerWeek).toBeGreaterThan(easy.maintenanceMinPerWeek);
  });

  it("senza corse non c'è un carico di riferimento", () => {
    expect(computeBikeCoverage(profile, [], [bike(day(2))], 50, 5)).toBeNull();
  });
});

describe("bikeScenarioPoint", () => {
  it("senza bici è il fermo totale, giorno per giorno", () => {
    const none = Array.from({ length: 61 }, () => ({ vo2: 0, lt: 0 }));
    for (let d = 0; d <= 60; d += 1) {
      const p = bikeScenarioPoint(full, none, d);
      expect(p.vo2Pct).toBeCloseTo(full.curve[d].vo2Pct, 10);
      expect(p.ltPct).toBeCloseTo(full.curve[d].ltPct, 10);
      expect(p.performancePct).toBeCloseTo(full.curve[d].performancePct, 10);
    }
  });

  it("a cinque giorni dall'ultima corsa non hai perso niente, bici o no", () => {
    const c = computeBikeCoverage(profile, runs, [bike(day(2), { duration_minutes: 42.1, avg_watts: 111 })], 50, 5)!;
    const p = bikeScenarioPoint(full, c.daily, 5);
    expect(p.vo2Pct).toBe(1);
    expect(p.performancePct).toBe(1);
  });
});
