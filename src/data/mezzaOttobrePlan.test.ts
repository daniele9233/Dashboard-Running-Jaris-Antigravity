import { describe, it, expect } from "vitest";
import {
  PLAN_DAYS, PLAN_DAY_BY_DATE, PLAN_GOALS, PLAN_WEEKS, ROUTINES, nextPlanDay, planDateLabel, planRunSessions,
  planWeekOf, routineDays,
} from "./mezzaOttobrePlan";
import { parsePrescription } from "../utils/trainingAdherence";

/**
 * Il piano è trascritto a mano: qui si controlla che la trascrizione regga —
 * nessun giorno perso, i chilometri delle settimane tornano, le regole del
 * piano sono rispettate dal calendario, e le sedute chiave arrivano
 * all'esito automatico nella forma che sa leggere.
 */

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysToRace = (iso: string) => (Date.parse("2026-10-18") - Date.parse(iso)) / 86_400_000;
const isWork = (kind: string) => kind === "quality" || kind === "key";

describe("il calendario del piano", () => {
  it("14 giorni consecutivi, dal 5 al 18 ottobre", () => {
    expect(PLAN_DAYS).toHaveLength(14);
    PLAN_DAYS.forEach((d, i) => expect(d.date).toBe(addDays("2026-10-05", i)));
  });

  it("ogni settimana parte di lunedì", () => {
    for (const w of PLAN_WEEKS) expect(new Date(w.days[0].date + "T00:00:00Z").getUTCDay()).toBe(1);
  });

  it("i chilometri di ogni settimana tornano con quelli scritti in testa", () => {
    const km = PLAN_WEEKS.map((w) => w.days.filter((d) => d.kind !== "race").reduce((s, d) => s + (d.km ?? 0), 0));
    expect(km[0]).toBeCloseTo(43, 1);
    expect(km[1]).toBeCloseTo(15, 1);
  });

  it("la settimana di carico chiude fra 40 e 45 km", () => {
    const km = PLAN_WEEKS[0].days.reduce((s, d) => s + (d.km ?? 0), 0);
    expect(km).toBeGreaterThanOrEqual(40);
    expect(km).toBeLessThanOrEqual(45);
  });

  it("le date si leggono in italiano", () => {
    expect(planDateLabel("2026-10-18")).toBe("domenica 18 ottobre");
    expect(planWeekOf("2026-10-08")?.n).toBe(1);
    expect(planWeekOf("2026-10-04")).toBeNull();
    expect(planWeekOf("2026-11-01")).toBeNull();
  });

  it("l'obiettivo è solo la mezza, a 4:45 al km", () => {
    expect(PLAN_GOALS).toHaveLength(1);
    expect(PLAN_GOALS[0].targetSec / 21.0975).toBeCloseTo(285, 0);
  });
});

describe("le regole del piano", () => {
  it("il piano parte dal test: martedì 6, 18 km con 12 a ritmo gara", () => {
    const test = PLAN_DAY_BY_DATE["2026-10-06"];
    expect(test).toMatchObject({ kind: "key", km: 18 });
    expect(test.verify).toBeTruthy();
    expect(PLAN_DAYS.find((d) => d.km)!.date).toBe("2026-10-06");
  });

  it("nella settimana di carico due sedute che contano, con due giorni in mezzo", () => {
    const work = PLAN_WEEKS[0].days.filter((d) => isWork(d.kind));
    expect(work.map((d) => d.date)).toEqual(["2026-10-06", "2026-10-09"]);
  });

  it("l'ultima qualità cade 9–10 giorni prima della gara", () => {
    const last = PLAN_DAYS.filter((d) => d.kind === "quality").at(-1)!;
    expect(daysToRace(last.date)).toBeGreaterThanOrEqual(9);
    expect(daysToRace(last.date)).toBeLessThanOrEqual(10);
  });

  it("lo scarico è solo l'ultima settimana: niente ripetute e meno della metà dei km", () => {
    const [load, taper] = PLAN_WEEKS;
    expect(taper.days.filter((d) => d.kind === "quality")).toHaveLength(0);
    const km = (days: typeof load.days) => days.filter((d) => d.kind !== "race").reduce((s, d) => s + (d.km ?? 0), 0);
    expect(km(taper.days)).toBeLessThan(km(load.days) / 2);
  });

  it("la vigilia si passa fermi", () => {
    expect(PLAN_DAY_BY_DATE["2026-10-17"]).toMatchObject({ kind: "rest" });
    expect(PLAN_DAY_BY_DATE["2026-10-17"].km).toBeUndefined();
  });

  it("niente forza fino alla gara, solo mobilità", () => {
    expect(PLAN_DAYS.filter((d) => d.routine && d.routine !== "M")).toHaveLength(0);
    expect(PLAN_DAYS.filter((d) => d.kind === "strength" || d.kind === "bike")).toHaveLength(0);
    expect(routineDays("M").map((d) => d.date)).toEqual(["2026-10-05", "2026-10-07"]);
  });

  it("ogni seduta di forza ha i suoi esercizi, a 2 serie alla ripresa", () => {
    for (const r of Object.values(ROUTINES)) expect(r.exercises.length).toBeGreaterThanOrEqual(4);
    for (const e of [...ROUTINES.A.exercises, ...ROUTINES.B.exercises]) expect(e.dose).toMatch(/^2×/);
  });
});

describe("la prossima seduta", () => {
  it("prima che il piano parta mostra la prima giornata", () => {
    expect(nextPlanDay("2026-10-04")).toMatchObject({ isToday: false, day: { date: "2026-10-05" } });
  });

  it("dentro il piano mostra quella di oggi", () => {
    expect(nextPlanDay("2026-10-06")).toMatchObject({ isToday: true, day: { title: "Test: 18 km con 12 a 4:45" } });
  });

  it("dopo la mezza non c'è niente da mostrare", () => {
    expect(nextPlanDay("2026-10-19")).toBeNull();
  });
});

describe("le sedute per l'esito automatico", () => {
  const byDate = Object.fromEntries(planRunSessions().map((s) => [s.date, s]));
  const read = (iso: string) => parsePrescription(byDate[iso]);

  it("i giorni di riposo non vengono giudicati come corse", () => {
    expect(byDate["2026-10-05"]).toBeUndefined();
    expect(byDate["2026-10-12"]).toBeUndefined();
    expect(byDate["2026-10-17"]).toBeUndefined();
  });

  it("le ripetute si leggono con numero, distanza e passo", () => {
    expect(read("2026-10-09")).toMatchObject({ kind: "reps", reps: 3, repDistM: 2000, targetPaceSec: 257 });
    expect(read("2026-10-13")).toMatchObject({ kind: "reps", reps: 3, repDistM: 1000, targetPaceSec: 285 });
  });

  it("test e gara si leggono come tratti continui a 4:45", () => {
    expect(read("2026-10-06")).toMatchObject({ kind: "tempo", repDistM: 12000, targetPaceSec: 285 });
    expect(read("2026-10-18")).toMatchObject({ kind: "tempo", repDistM: 21100, targetPaceSec: 285 });
  });

  it("lenti e lungo restano lenti", () => {
    expect(read("2026-10-08").kind).toBe("easy");
    expect(read("2026-10-11").kind).toBe("easy");
    expect(read("2026-10-16").kind).toBe("easy");
  });
});
