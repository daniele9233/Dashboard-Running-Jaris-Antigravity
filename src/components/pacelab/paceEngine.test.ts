import { describe, expect, it } from "vitest";
import { predictSec, vdotFrom } from "../gamification/gamiCore";
import {
  DISTANCES, ROME_HM_PROFILE, bestTime, buildPlan, correctedAtHalf, courseClimb, distanceMatrix,
  equivalentFlatKm, fastStart, fastStartTrace, flatCourse, fmtDelta, kmCost, levelForCourse,
  levelFromEven, limitPace, makeCourse, paceLadder, parseGpx, profileFromSplits, robustStart,
  splitsOf, sustainablePct, tlimMin, wallUnder,
} from "./paceEngine";

const HM = 21.0975;

describe("la curva e il serbatoio", () => {
  it("coincide con Daniels sotto le due ore e mezza", () => {
    for (const [d, sec] of [[5, 1200], [10, 2500], [HM, 6055]] as const) {
      expect(levelFromEven(d, sec / d)).toBeCloseTo(vdotFrom(d * 1000, sec), 6);
    }
    // e il passo limite torna il tempo di Daniels
    expect(limitPace(10, 49.5) * 10).toBeCloseTo(predictSec(10000, 49.5), 0);
  });

  it("inverte la curva: reggi f per tlim(f) minuti", () => {
    for (const t of [3, 12, 40, 100, 149, 200, 400]) expect(tlimMin(sustainablePct(t))).toBeCloseTo(t, 1);
  });

  it("al limite il passo costante svuota il serbatoio esattamente sul traguardo", () => {
    for (const d of DISTANCES) {
      const v = levelFromEven(d.km, 250);
      expect(d.km * kmCost(250, v)).toBeCloseTo(1, 5);
    }
  });

  it("il costo per metro è convesso: il passo costante è l'ottimo in piano", () => {
    const g = (p: number) => kmCost(p, 45);
    for (let p = 200; p < 420; p += 3) expect(g(p - 3) + g(p + 3) - 2 * g(p)).toBeGreaterThan(0);
  });
});

describe("il listino", () => {
  it("1″/km più veloce del limite fa finire il serbatoio prima del traguardo", () => {
    const v = levelFromEven(10, 250);
    const rows = paceLadder(10, 250, v, 5);
    const at = (o: number) => rows.find((r) => r.offsetSec === o)!;
    expect(at(0).wallKm).toBeNull();
    expect(at(0).tankEnd).toBeCloseTo(0, 5);
    expect(at(-1).wallKm!).toBeGreaterThan(9);
    expect(at(-1).wallKm!).toBeLessThan(10);
    expect(at(-5).wallKm!).toBeLessThan(at(-3).wallKm!);
    expect(at(2).tankEnd).toBeGreaterThan(0);
    expect(at(2).vsCenterSec).toBe(20);
  });

  it("chi prova un passo che non ha, a metà gara ci rimette più di quanto sperava", () => {
    const v = levelFromEven(10, 250);
    const real = correctedAtHalf(10, 245, v)!;
    expect(real).toBeGreaterThan(2500);          // peggio del passo costante al limite
    expect(correctedAtHalf(10, 250, v)!).toBeCloseTo(2500, 0);
    // più piano del limite: a metà allunghi e recuperi una parte
    const slow = correctedAtHalf(10, 255, v)!;
    expect(slow).toBeLessThan(2550);
    expect(slow).toBeGreaterThan(2500);
  });
});

describe("partire forte", () => {
  const v = levelFromEven(HM, 287);
  const inp = { distKm: HM, targetPace: 287, vdot: v, firstKm: 3, fastPace: 279 };

  it("mezza a 4:47, primi 3 km a 4:39: 24″ in banca, pagati con gli interessi", () => {
    const r = fastStart(inp);
    expect(r.bankSec).toBe(24);
    expect(r.extraTank).toBeGreaterThan(0.05);
    expect(r.wallKm!).toBeGreaterThan(18);
    expect(r.wallKm!).toBeLessThan(HM);
    // correggere subito costa poco ma costa
    expect(r.smart.deltaSec).toBeGreaterThan(2);
    expect(r.smart.deltaSec).toBeLessThan(15);
    expect(r.smart.restPace).toBeGreaterThan(287);
    expect(r.smart.paybackKm!).toBeGreaterThan(3);
    // più tardi te ne accorgi, più paghi
    const prices = r.late.map((c) => c.deltaSec);
    for (let i = 1; i < prices.length; i++) expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1] - 1e-6);
    expect(prices[prices.length - 1]).toBeGreaterThan(r.smart.deltaSec * 2);
  });

  it("con margine il vantaggio resta tuo", () => {
    const r = fastStart({ ...inp, vdot: v + 1.5 });
    expect(r.holdOk).toBe(true);
    expect(r.smart.deltaSec).toBeCloseTo(-24, 6);
    expect(r.holdTankEnd).toBeLessThan(r.evenTankEnd);
  });

  it("il tracciato di chi tiene il passo si ferma al muro", () => {
    const r = fastStart(inp);
    const hold = fastStartTrace(inp, null);
    const last = hold[hold.length - 1];
    expect(last.km).toBeCloseTo(r.wallKm!, 1);
    expect(last.tank).toBe(0);
    const smart = fastStartTrace(inp, 3);
    expect(smart[smart.length - 1].km).toBeCloseTo(HM, 6);
    expect(smart[smart.length - 1].tank).toBeCloseTo(0, 4);
    expect(smart[smart.length - 1].bank).toBeCloseTo(-r.smart.deltaSec, 1);
  });
});

describe("tutte le distanze", () => {
  it("un secondo al km non pesa uguale ovunque: più in una gara di 40′ che in una di 12′", () => {
    const rows = distanceMatrix(49, [-3, -1, 1, 3], "race");
    const byId = Object.fromEntries(rows.map((r) => [r.dist.id, r]));
    expect(byId["10k"].tankPerSec).toBeGreaterThan(byId["3k"].tankPerSec);
    for (const r of rows) {
      expect(r.cells[0].wallKm!).toBeLessThan(r.dist.km);
      expect(r.cells[3].leftSec).toBeCloseTo(3 * r.dist.km, 6);
    }
  });

  it("la partenza: il prezzo di correggere subito cresce con lo strappo", () => {
    const rows = distanceMatrix(49, [-10, -5, -2], "start");
    for (const r of rows) {
      const [a, b, c] = r.cells.map((x) => x.priceSec!);
      expect(a).toBeGreaterThan(b);
      expect(b).toBeGreaterThan(c);
      expect(c).toBeGreaterThan(0);
    }
  });
});

describe("il percorso", () => {
  it("Roma costa circa mezzo minuto: 4:47 a Roma valgono 4:45 in piano", () => {
    const rome = makeCourse("rome", "Roma", HM, ROME_HM_PROFILE);
    const { up } = courseClimb(rome);
    expect(up).toBeGreaterThan(55);
    expect(up).toBeLessThan(75);
    const target = 287 * HM;
    const flatPace = target / equivalentFlatKm(rome);
    expect(flatPace).toBeGreaterThan(284.5);
    expect(flatPace).toBeLessThan(286.2);
  });

  it("al livello tarato sul percorso, lo sforzo costante chiude esattamente all'obiettivo", () => {
    const rome = makeCourse("rome", "Roma", HM, ROME_HM_PROFILE);
    const target = 6055;
    const v = levelForCourse(rome, target);
    expect(bestTime(rome, v)).toBeCloseTo(target, 0);
    const plan = buildPlan(rome, { id: "sforzo" }, target, v);
    expect(plan.fit).toBe("obiettivo");
    expect(plan.totalSec).toBeCloseTo(target, 3);
    expect(plan.tankEnd).toBeCloseTo(0, 4);
  });

  it("il passo costante su un percorso mosso vale di meno dello sforzo costante", () => {
    const rome = makeCourse("rome", "Roma", HM, ROME_HM_PROFILE);
    const v = levelForCourse(rome, 6055);
    const even = buildPlan(rome, { id: "passo" }, 6055, v);
    expect(even.fit).toBe("limite");
    expect(even.totalSec).toBeGreaterThan(6055);
    expect(even.tankEnd).toBeCloseTo(0, 4);
    // passo uguale su ogni split
    const sp = splitsOf(even, rome, 1);
    expect(Math.abs(sp[0].paceSec - sp[10].paceSec)).toBeLessThan(0.01);
  });

  it("in piano: sforzo e passo costante sono la stessa cosa, la consigliata parte più piano", () => {
    const flat = flatCourse(10);
    const v = levelFromEven(10, 250);
    const a = buildPlan(flat, { id: "sforzo" }, 2500, v);
    const b = buildPlan(flat, { id: "passo" }, 2500, v);
    expect(a.totalSec).toBeCloseTo(b.totalSec, 6);
    const robust = robustStart(10, v, 1.5);
    const c = buildPlan(flat, { id: "consigliata" }, 2500, v, { robust });
    const sp = splitsOf(c, flat, 1);
    expect(sp[0].paceSec).toBeGreaterThan(250);
    expect(sp[9].paceSec).toBeLessThan(250);
    expect(c.totalSec - 2500).toBeCloseTo(robust.premiumSec, 0);
  });

  it("gli split bloccati restano, il resto si adatta", () => {
    const flat = flatCourse(10);
    const v = levelFromEven(10, 250) + 1;       // con margine: il tempo obiettivo regge
    const plan = buildPlan(flat, { id: "passo" }, 2500, v, { locks: { 0: 260 } });
    const sp = splitsOf(plan, flat, 1);
    expect(sp[0].paceSec).toBeCloseTo(260, 6);
    expect(sp[0].locked).toBe(true);
    expect(plan.totalSec).toBeCloseTo(2500, 3);
    expect(sp[5].paceSec).toBeCloseTo((2500 - 260) / 9, 3);
  });

  it("una giornata storta fa trovare il muro a chi segue il piano alla lettera", () => {
    const flat = flatCourse(10);
    const v = levelFromEven(10, 250);
    const plan = buildPlan(flat, { id: "passo" }, 2500, v);
    expect(wallUnder(flat, plan, v)).toBeNull();
    const bad = levelFromEven(10, 250 * 1.015);
    const w = wallUnder(flat, plan, bad)!;
    expect(w).toBeGreaterThan(5);
    expect(w).toBeLessThan(10);
  });
});

describe("partire un filo più piano", () => {
  it("sotto incertezza conviene una prima metà prudente, e conviene di più se sei meno sicuro", () => {
    const v = levelFromEven(10, 250);
    const sure = robustStart(10, v, 1);
    const normal = robustStart(10, v, 1.5);
    const unsure = robustStart(10, v, 2.5);
    expect(normal.deltaSec).toBeGreaterThan(0);
    expect(unsure.deltaSec).toBeGreaterThan(sure.deltaSec);
    expect(normal.expectedRobustSec).toBeLessThan(normal.expectedEvenSec);
    expect(normal.premiumSec).toBeGreaterThan(0);
    expect(normal.premiumSec).toBeLessThan(6);
    expect(normal.badRobustSec).toBeLessThan(normal.badEvenSec);
    expect(normal.secondPace).toBeLessThan(250);
  });
});

describe("i profili", () => {
  it("legge un GPX e ne ricava distanza e quota", () => {
    const pts: string[] = [];
    for (let i = 0; i <= 100; i++) {
      pts.push(`<trkpt lat="${41.9 + i * 0.0009}" lon="12.5"><ele>${10 + i * 0.2}</ele></trkpt>`);
    }
    const prof = parseGpx(`<gpx><trk><trkseg>${pts.join("")}</trkseg></trk></gpx>`);
    expect(prof.length).toBe(101);
    expect(prof[100].km).toBeCloseTo(10.0, 0);
    const course = makeCourse("gpx", "gpx", 10, prof);
    expect(courseClimb(course).up).toBeGreaterThan(15);
  });

  it("ricostruisce il profilo dagli split di una corsa", () => {
    const prof = profileFromSplits([
      { distance: 1000, elevation_difference: 10 },
      { distance: 1000, elevation_difference: -4 },
    ]);
    expect(prof.map((p) => p.ele)).toEqual([0, 10, 6]);
  });
});

describe("formati", () => {
  it("scrive le differenze col segno giusto", () => {
    expect(fmtDelta(7.4)).toBe("+7″");
    expect(fmtDelta(-24)).toBe("−24″");
    expect(fmtDelta(65)).toBe("+1′05″");
    expect(fmtDelta(0.2)).toBe("±0″");
  });
});
