import { describe, it, expect } from "vitest";
import {
  buildPlan, buildSkeleton, ceilingKm, pacesFor, projectVdot, qualityBudget,
  riegelExponent, sigmaPct, fmtClock,
  type PlanConfig, type RaceGoal,
} from "./planEngine";
import { ROME, bandForIndex, conditionsAt, dewPoint, humidityFromDewPoint } from "./climate";
import { vdotFrom } from "../gamification/gamiCore";

/**
 * Il piano è un oggetto che promette numeri a un atleta. I test qui sotto
 * proteggono le tre cose che, se si rompono, rendono quelle promesse false:
 * i vincoli di sicurezza sul volume, i tetti di qualità di Daniels e il fatto
 * che la probabilità sia una distribuzione e non un desiderio.
 */

const GOALS: RaceGoal[] = [
  { id: "a", label: "5K", distanceM: 5000, targetSec: 19 * 60 + 59, dateIso: "2026-09-25", startHour: 9, priority: "A" },
  { id: "b", label: "Mezza", distanceM: 21097.5, targetSec: 94 * 60 + 35, dateIso: "2026-10-18", startHour: 9, priority: "B" },
];

const CONFIG: PlanConfig = {
  todayIso: "2026-08-20",
  startIso: "2026-08-24",
  goals: GOALS,
  fitness: {
    vdot: 49.3, vdotSource: "5 km in 21:04 il 17/06 a 23 °C, riportati al fresco",
    weeklyKm: 35, peakWeeklyKm: 41, longestKm: 15, runsPerWeek: 4,
  },
  maxWeeklyKm: 50,
  runsPerWeek: 5,
  climate: ROME,
  strength: true,
};

describe("clima e indice T+DP", () => {
  it("il punto di rugiada e la sua inversa tornano al punto di partenza", () => {
    const dp = dewPoint(24, 65);
    expect(dp).toBeGreaterThan(16);
    expect(dp).toBeLessThan(18);
    expect(humidityFromDewPoint(24, dp)).toBeCloseTo(65, 0);
  });

  it("le fasce coprono tutto l'asse senza buchi né sovrapposizioni", () => {
    for (let i = 0; i < 80; i += 0.5) {
      const b = bandForIndex(i);
      expect(b).toBeDefined();
      expect(i).toBeGreaterThanOrEqual(b.min);
      if (b.max !== null) expect(i).toBeLessThan(b.max);
    }
  });

  it("l'ora conta più del mese: alle 7 di settembre fa meno caldo che alle 18", () => {
    const dawn = conditionsAt("2026-09-25", 7, ROME);
    const evening = conditionsAt("2026-09-25", 18, ROME);
    expect(evening.tempC - dawn.tempC).toBeGreaterThan(4);
    expect(evening.index).toBeGreaterThan(dawn.index);
  });

  it("il 25 settembre è più fresco del 5 settembre: i mesi si interpolano", () => {
    const early = conditionsAt("2026-09-05", 9, ROME);
    const late = conditionsAt("2026-09-25", 9, ROME);
    expect(late.tempC).toBeLessThan(early.tempC);
  });

  it("il punto di rugiada non supera mai la temperatura", () => {
    for (const iso of ["2026-01-15", "2026-07-15", "2026-10-18"]) {
      for (const h of [5, 9, 15, 21]) {
        const c = conditionsAt(iso, h, ROME);
        expect(c.dpC).toBeLessThan(c.tempC);
      }
    }
  });
});

describe("tenuta — esponente di Riegel", () => {
  it("più km e lunghi più lunghi abbassano l'esponente", () => {
    expect(riegelExponent(35, 15)).toBeGreaterThan(riegelExponent(45, 21));
    expect(riegelExponent(50, 24)).toBeCloseTo(1.055, 3);
  });

  it("resta nel dominio misurato in letteratura", () => {
    for (const km of [10, 25, 40, 60, 100]) {
      for (const l of [8, 15, 22, 32]) {
        const e = riegelExponent(km, l);
        expect(e).toBeGreaterThanOrEqual(1.055);
        expect(e).toBeLessThanOrEqual(1.14);
      }
    }
  });

  it("a 40 km/settimana e lungo 19 il 5K 19:59 vale una mezza intorno a 1:34-1:35", () => {
    const e = riegelExponent(40, 19);
    const hm = (19 * 60 + 59) * Math.pow(21097.5 / 5000, e);
    expect(hm).toBeGreaterThan(94 * 60);
    expect(hm).toBeLessThan(96 * 60);
  });
});

describe("budget di qualità — i tetti di Daniels", () => {
  it("I ≤ 8%, T ≤ 10%, R ≤ 5% dei km settimanali", () => {
    const b = qualityBudget(40, "carico");
    expect(b.interval).toBeCloseTo(3.2, 5);
    expect(b.threshold).toBeCloseTo(4.0, 5);
    expect(b.rep).toBeCloseTo(2.0, 5);
  });

  it("l'I-pace non supera mai i 10 km, anche a volumi altissimi", () => {
    expect(qualityBudget(200, "carico").interval).toBe(10);
    expect(qualityBudget(200, "carico").rep).toBe(8);
  });

  it("nel blocco specifico mezza il tetto della soglia sale al 12%", () => {
    expect(qualityBudget(50, "specificoHM").threshold).toBeCloseTo(6.0, 5);
    expect(qualityBudget(50, "carico").threshold).toBeCloseTo(5.0, 5);
  });
});

describe("volume — i freni di sicurezza", () => {
  it("il tetto non supera mai +12 km assoluti sulla media recente", () => {
    expect(ceilingKm({ ...CONFIG.fitness, weeklyKm: 35, peakWeeklyKm: 60 }, 200)).toBe(47);
    expect(ceilingKm({ ...CONFIG.fitness, weeklyKm: 100, peakWeeklyKm: 140 }, 500)).toBe(112);
  });

  it("nessuna settimana del piano cresce oltre il 10% sulla precedente", () => {
    const plan = buildPlan(CONFIG);
    for (let i = 1; i < plan.weeks.length; i++) {
      const prev = plan.weeks[i - 1].targetKm;
      const cur = plan.weeks[i].targetKm;
      // dopo un taper si può tornare a un volume GIÀ retto: non è un salto
      const familiar = Math.max(...plan.weeks.slice(0, i).map((w) => w.targetKm));
      expect(cur).toBeLessThanOrEqual(Math.max(prev * 1.101, familiar) + 0.5);
    }
  });

  it("la prima settimana non fa un salto sul volume attuale", () => {
    const plan = buildPlan(CONFIG);
    expect(plan.weeks[0].targetKm).toBeLessThanOrEqual(CONFIG.fitness.weeklyKm * 1.101 + 0.5);
  });
});

describe("scheletro — periodizzazione su due gare", () => {
  const skeleton = buildSkeleton(CONFIG);

  it("copre da lunedì di partenza alla settimana dell'ultima gara", () => {
    expect(skeleton[0].startIso).toBe("2026-08-24");
    expect(skeleton[skeleton.length - 1].startIso).toBe("2026-10-12");
    expect(skeleton).toHaveLength(8);
  });

  it("ogni gara cade dentro una settimana marcata come gara", () => {
    for (const g of GOALS) {
      const w = skeleton.find((s) => s.race?.id === g.id);
      expect(w?.block).toBe("gara");
      expect(g.dateIso >= w!.startIso && g.dateIso <= w!.endIso).toBe(true);
    }
  });

  it("prima della gara A c'è un taper, e il carico che lo precede resta pieno", () => {
    const i = skeleton.findIndex((s) => s.race?.id === "a");
    expect(skeleton[i - 1].block).toBe("taper");
    // con cinque settimane in tutto non c'è spazio per un'affilatura: sarebbero
    // tre settimane scariche su cinque
    expect(skeleton[i - 2].block).toBe("specifico");
  });

  it("un'affilatura compare solo quando la rincorsa è abbastanza lunga", () => {
    const lungo = buildSkeleton({ ...CONFIG, startIso: "2026-06-01" });
    const i = lungo.findIndex((s) => s.race?.id === "a");
    expect(lungo[i - 1].block).toBe("taper");
    expect(lungo[i - 2].block).toBe("affilatura");
  });

  it("le settimane fra le due gare sono rigenerazione poi specifico mezza", () => {
    const a = skeleton.findIndex((s) => s.race?.id === "a");
    const b = skeleton.findIndex((s) => s.race?.id === "b");
    expect(skeleton[a + 1].block).toBe("rigenerazione");
    expect(skeleton.slice(a + 2, b).some((s) => s.block === "specificoHM")).toBe(true);
    // con tre settimane fra le due gare la settimana di gara È il taper
    expect(skeleton[b - 1].block).not.toBe("taper");
  });
});

describe("il piano completo", () => {
  const plan = buildPlan(CONFIG);

  it("assegna sette giorni a ogni settimana, senza buchi né doppioni", () => {
    for (const w of plan.weeks) {
      expect(w.sessions).toHaveLength(7);
      expect(new Set(w.sessions.map((s) => s.date)).size).toBe(7);
      expect(w.sessions[0].date).toBe(w.startIso);
      expect(w.sessions[6].date).toBe(w.endIso);
    }
  });

  it("le due gare compaiono come sedute nel giorno giusto", () => {
    const races = plan.weeks.flatMap((w) => w.sessions).filter((s) => s.kind === "race");
    expect(races.map((r) => r.date)).toEqual(["2026-09-25", "2026-10-18"]);
  });

  it("il volume programmato di ogni settimana è vicino al bersaglio", () => {
    for (const w of plan.weeks) {
      const km = w.sessions.reduce((s, x) => s + x.target_distance_km, 0);
      expect(Math.abs(km - w.targetKm)).toBeLessThanOrEqual(w.targetKm * 0.12 + 3);
    }
  });

  it("mai più di due sedute di qualità a settimana", () => {
    for (const w of plan.weeks) expect(w.qualityCount).toBeLessThanOrEqual(2);
  });

  it("il taper taglia il volume ma non i giorni di corsa", () => {
    const taper = plan.weeks.filter((w) => w.block === "taper");
    const carico = plan.weeks.filter((w) => w.block === "carico" || w.block === "specifico");
    expect(taper.length).toBeGreaterThan(0);
    const maxCarico = Math.max(...carico.map((w) => w.targetKm));
    for (const t of taper) {
      expect(t.targetKm).toBeLessThan(maxCarico * 0.75);
      const running = t.sessions.filter((s) => s.target_distance_km > 0).length;
      expect(running).toBeGreaterThanOrEqual(4);
    }
  });

  it("i tre test ci sono, in ordine e prima delle gare che verificano", () => {
    const ids = plan.tests.map((t) => t.session.test!.id);
    expect(ids).toContain("test-baseline");
    expect(ids).toContain("test-goalpace");
    expect(ids).toContain("test-durability");
    const baseline = plan.tests.find((t) => t.session.test!.id === "test-baseline")!;
    const goalpace = plan.tests.find((t) => t.session.test!.id === "test-goalpace")!;
    expect(baseline.dateIso < goalpace.dateIso).toBe(true);
    expect(goalpace.dateIso < "2026-09-25").toBe(true);
    const dur = plan.tests.find((t) => t.session.test!.id === "test-durability")!;
    expect(dur.dateIso < "2026-10-18").toBe(true);
  });

  it("ogni seduta porta con sé il perché e almeno una fonte", () => {
    for (const w of plan.weeks) {
      for (const s of w.sessions) {
        expect(s.why.length).toBeGreaterThan(10);
        expect(s.studies.length).toBeGreaterThan(0);
      }
    }
  });

  it("i ritmi prescritti sono corretti per l'aria del giorno", () => {
    const withHeat = plan.weeks.flatMap((w) => w.sessions).filter((s) => s.heat);
    expect(withHeat.length).toBeGreaterThan(10);
    for (const s of withHeat) {
      expect(s.heat!.adjustedFrom).toBeGreaterThanOrEqual(s.heat!.baseSec - 1);
      expect(s.heat!.adjustedTo).toBeGreaterThanOrEqual(s.heat!.adjustedFrom);
    }
    // agosto costa più di ottobre, sulla stessa base
    const aug = plan.weeks[0].sessions.find((s) => s.heat)!;
    const oct = plan.weeks[plan.weeks.length - 1].sessions.find((s) => s.heat)!;
    const penAug = aug.heat!.adjustedTo / aug.heat!.baseSec;
    const penOct = oct.heat!.adjustedTo / oct.heat!.baseSec;
    expect(penAug).toBeGreaterThan(penOct);
  });
});

describe("previsione e probabilità", () => {
  const plan = buildPlan(CONFIG);

  it("una previsione per gara, con banda e probabilità nel dominio", () => {
    expect(plan.outlook).toHaveLength(2);
    for (const o of plan.outlook) {
      expect(o.probability).toBeGreaterThan(0);
      expect(o.probability).toBeLessThan(1);
      expect(o.p10Sec).toBeLessThan(o.predictedSec);
      expect(o.p90Sec).toBeGreaterThan(o.predictedSec);
    }
  });

  it("il VDOT richiesto è quello che il tempo obiettivo implica", () => {
    const five = plan.outlook[0];
    expect(five.vdotRequired).toBeCloseTo(vdotFrom(5000, 19 * 60 + 59), 1);
  });

  it("il caldo peggiora la previsione e abbassa la probabilità", () => {
    const cool = buildPlan({
      ...CONFIG,
      goals: [{ ...GOALS[0], startHour: 7 }, GOALS[1]],
    }).outlook[0];
    const hot = buildPlan({
      ...CONFIG,
      goals: [{ ...GOALS[0], startHour: 18 }, GOALS[1]],
    }).outlook[0];
    expect(hot.predictedSec).toBeGreaterThan(cool.predictedSec);
    expect(hot.probability).toBeLessThan(cool.probability);
  });

  it("più volume alza la probabilità su entrambe le gare", () => {
    const low = buildPlan({ ...CONFIG, maxWeeklyKm: 38 }).outlook;
    const high = buildPlan({ ...CONFIG, maxWeeklyKm: 55 }).outlook;
    expect(high[0].probability).toBeGreaterThan(low[0].probability);
    expect(high[1].probability).toBeGreaterThan(low[1].probability);
  });

  it("l'incertezza cresce con la distanza temporale e con la distanza di gara", () => {
    expect(sigmaPct(8, 5000)).toBeGreaterThan(sigmaPct(2, 5000));
    expect(sigmaPct(4, 21097.5)).toBeGreaterThan(sigmaPct(4, 5000));
    expect(sigmaPct(0.5, 5000)).toBeGreaterThan(1.4);
  });

  it("ogni gara elenca almeno una leva e i suoi limiti", () => {
    for (const o of plan.outlook) {
      expect(o.levers.length).toBeGreaterThan(0);
      expect(o.limiters.length).toBeGreaterThan(0);
      // le leve sono ordinate dalla più utile alla meno utile
      for (let i = 1; i < o.levers.length; i++) {
        expect(o.levers[i].deltaSec).toBeGreaterThanOrEqual(o.levers[i - 1].deltaSec);
      }
    }
  });

  it("una forma già oltre l'obiettivo dà una probabilità alta, non certa", () => {
    const strong = buildPlan({
      ...CONFIG,
      fitness: { ...CONFIG.fitness, vdot: 56, weeklyKm: 60, peakWeeklyKm: 70, longestKm: 24 },
      maxWeeklyKm: 75,
    });
    expect(strong.outlook[0].probability).toBeGreaterThan(0.9);
    expect(strong.outlook[0].probability).toBeLessThan(1);
  });

  it("una forma molto lontana dà una probabilità bassa e un avviso", () => {
    const weak = buildPlan({
      ...CONFIG,
      fitness: { ...CONFIG.fitness, vdot: 42, weeklyKm: 20, peakWeeklyKm: 24, longestKm: 10 },
    });
    expect(weak.outlook[0].probability).toBeLessThan(0.1);
    expect(weak.warnings.some((w) => w.includes("5K"))).toBe(true);
  });
});

describe("onestà del numero", () => {
  it("il clima di gara è separato da quello degli allenamenti", () => {
    // un atleta che si allena solo all'alba ha un clima personale mite; la gara
    // non gliene tiene conto, e la previsione non deve fingere il contrario
    const mite: typeof ROME = {
      monthTempC: ROME.monthTempC.map((t) => t - 6),
      monthDpC: ROME.monthDpC.map((d) => d - 4),
    };
    const conMite = buildPlan({ ...CONFIG, climate: mite }).outlook[0];
    const conNormali = buildPlan({ ...CONFIG, climate: ROME }).outlook[0];
    // stesso clima di gara (le normali) → stessa previsione
    expect(conMite.predictedSec).toBe(conNormali.predictedSec);
    expect(conMite.conditions.tempC).toBe(conNormali.conditions.tempC);

    // ma se glielo si passa esplicitamente come clima di gara, cambia
    const mitissimo = buildPlan({ ...CONFIG, raceClimate: mite }).outlook[0];
    expect(mitissimo.predictedSec).toBeLessThan(conNormali.predictedSec);
  });

  it("un'ancora sopra la prestazione dimostrata allarga la banda e avvisa", () => {
    const gonfio = buildPlan({
      ...CONFIG,
      fitness: { ...CONFIG.fitness, vdot: 52, vdotDemonstrated: 48.9, vdotDemonstratedFrom: "5 km del 17/06" },
    });
    const onesto = buildPlan({
      ...CONFIG,
      fitness: { ...CONFIG.fitness, vdot: 52, vdotDemonstrated: 51.8 },
    });
    expect(gonfio.outlook[0].sigmaPct).toBeGreaterThan(onesto.outlook[0].sigmaPct);
    expect(gonfio.warnings.some((w) => w.includes("48.9"))).toBe(true);
    expect(onesto.warnings.some((w) => w.includes("ancora dice"))).toBe(false);
  });

  it("senza prestazione dimostrata l'incertezza resta quella di base", () => {
    expect(sigmaPct(4, 5000, 0)).toBeCloseTo(sigmaPct(4, 5000), 6);
    expect(sigmaPct(4, 5000, 3)).toBeGreaterThan(sigmaPct(4, 5000, 0));
  });
});

describe("proiezione del VDOT", () => {
  it("il guadagno rallenta man mano che il livello sale", () => {
    const low = projectVdot(42, 8, 40, 40) - 42;
    const high = projectVdot(56, 8, 40, 40) - 56;
    expect(low).toBeGreaterThan(high);
  });

  it("otto settimane a volume invariato valgono circa un punto, non tre", () => {
    const gain = projectVdot(49.3, 8, 35, 35) - 49.3;
    expect(gain).toBeGreaterThan(0.5);
    expect(gain).toBeLessThan(1.2);
  });

  it("il volume in più aggiunge, ma con un tetto", () => {
    const g1 = projectVdot(49.3, 8, 44, 35);
    const g2 = projectVdot(49.3, 8, 90, 35);
    expect(g2).toBeGreaterThan(g1);
    expect(g2 - 49.3).toBeLessThan(2.0);
  });
});

describe("ritmi", () => {
  it("l'ordine dei ritmi è quello che deve essere", () => {
    const p = pacesFor(50, 1.08);
    // R più veloce di I, I più veloce del ritmo gara 5K: per un 5000 da 20
    // minuti l'I-pace (≈12′ di sforzo) sta sotto il ritmo di gara, non sopra
    expect(p.rep).toBeLessThan(p.interval);
    expect(p.interval).toBeLessThan(p.race5k);
    expect(p.race5k).toBeLessThan(p.threshold);
    expect(p.threshold).toBeLessThan(p.halfPace);
    expect(p.halfPace).toBeLessThan(p.marathon + 25);
    expect(p.marathon).toBeLessThan(p.easy);
    expect(p.easy).toBeLessThan(p.slow);
  });

  it("il ritmo mezza peggiora quando la tenuta peggiora, il 5K no", () => {
    const good = pacesFor(50, 1.06);
    const bad = pacesFor(50, 1.10);
    expect(bad.halfPace).toBeGreaterThan(good.halfPace + 5);
    expect(bad.race5k).toBeCloseTo(good.race5k, 5);
  });

  it("VDOT 50 dà i ritmi della tabella di Daniels", () => {
    const p = pacesFor(50, 1.07);
    expect(fmtClock(p.race5k * 5)).toBe("19:56");
    expect(p.threshold).toBeGreaterThan(250);
    expect(p.threshold).toBeLessThan(262);
  });
});
