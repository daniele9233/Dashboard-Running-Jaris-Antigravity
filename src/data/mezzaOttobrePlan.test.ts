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

describe("il calendario del piano", () => {
  it("35 giorni consecutivi, dal 14 settembre al 18 ottobre", () => {
    expect(PLAN_DAYS).toHaveLength(35);
    PLAN_DAYS.forEach((d, i) => expect(d.date).toBe(addDays("2026-09-14", i)));
  });

  it("ogni settimana parte di lunedì", () => {
    for (const w of PLAN_WEEKS) expect(new Date(w.days[0].date + "T00:00:00Z").getUTCDay()).toBe(1);
  });

  it("i chilometri di ogni settimana tornano con quelli scritti in testa", () => {
    const km = PLAN_WEEKS.map((w) => w.days.filter((d) => d.kind !== "race").reduce((s, d) => s + (d.km ?? 0), 0));
    expect(km[0]).toBeCloseTo(42.4, 1);
    expect(km[1]).toBeCloseTo(47, 1);
    expect(km[2]).toBeCloseTo(43, 1);
    expect(km[3]).toBeCloseTo(30, 1);
    expect(km[4]).toBeCloseTo(15, 1);
  });

  it("le date si leggono in italiano", () => {
    expect(planDateLabel("2026-10-18")).toBe("domenica 18 ottobre");
    expect(planWeekOf("2026-10-01")?.n).toBe(3);
    expect(planWeekOf("2026-11-01")).toBeNull();
  });

  it("l'obiettivo è solo la mezza, a 4:47 al km", () => {
    expect(PLAN_GOALS).toHaveLength(1);
    expect(PLAN_GOALS[0].targetSec / 21.0975).toBeCloseTo(287, 0);
  });
});

describe("le regole del piano", () => {
  it("una sola qualità a settimana", () => {
    for (const w of PLAN_WEEKS) {
      expect(w.days.filter((d) => d.kind === "quality" || d.kind === "key").length).toBeLessThanOrEqual(1);
    }
  });

  it("l'ultima qualità cade 10–12 giorni prima della gara", () => {
    const last = PLAN_DAYS.filter((d) => d.kind === "quality").at(-1)!;
    const days = (Date.parse("2026-10-18") - Date.parse(last.date)) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(10);
    expect(days).toBeLessThanOrEqual(12);
  });

  it("la forza non cade mai il giorno prima di ripetute, medio o lungo", () => {
    for (const d of PLAN_DAYS.filter((x) => x.routine && x.routine !== "M")) {
      const next = PLAN_DAY_BY_DATE[addDays(d.date, 1)];
      expect(["quality", "key", "long", "race"]).not.toContain(next.kind);
    }
  });

  it("forza fino al 28 settembre, poi solo mobilità", () => {
    const strength = PLAN_DAYS.filter((d) => d.routine && d.routine !== "M");
    expect(strength.at(-1)!.date).toBe("2026-09-28");
    // la B, che indolenzisce meno, prima della qualità; la A il giorno dopo
    expect(routineDays("B").map((d) => d.date)).toEqual(["2026-09-21"]);
    expect(routineDays("A").map((d) => d.date)).toEqual(["2026-09-24"]);
    expect(PLAN_DAYS.filter((d) => d.date >= "2026-10-12" && d.routine)).toHaveLength(0);
  });

  it("ogni seduta di forza ha i suoi esercizi, a 2 serie fino alla gara", () => {
    for (const r of Object.values(ROUTINES)) expect(r.exercises.length).toBeGreaterThanOrEqual(4);
    for (const e of [...ROUTINES.A.exercises, ...ROUTINES.B.exercises]) expect(e.dose).toMatch(/^2×/);
  });

  it("sabato 19 niente corsa: gli 8 km sono stati corsi venerdì 18", () => {
    expect(PLAN_DAY_BY_DATE["2026-09-18"].km).toBe(8);
    expect(PLAN_DAY_BY_DATE["2026-09-19"].km).toBeUndefined();
  });
});

describe("la prossima seduta", () => {
  it("se la seduta di oggi è già fatta, mostra la successiva", () => {
    expect(nextPlanDay("2026-09-16")).toMatchObject({ isToday: false, day: { date: "2026-09-17" } });
  });

  it("altrimenti mostra quella di oggi", () => {
    expect(nextPlanDay("2026-09-23")).toMatchObject({ isToday: true, day: { title: "Cruise intervals: 3×3000 a 4:18–4:20" } });
  });

  it("dopo la mezza non c'è niente da mostrare", () => {
    expect(nextPlanDay("2026-10-19")).toBeNull();
  });
});

describe("le sedute per l'esito automatico", () => {
  const byDate = Object.fromEntries(planRunSessions().map((s) => [s.date, s]));
  const read = (iso: string) => parsePrescription(byDate[iso]);

  it("bici, forza e riposo non vengono giudicati come corse", () => {
    expect(byDate["2026-09-14"]).toBeUndefined();
    expect(byDate["2026-09-21"]).toBeUndefined();
    expect(byDate["2026-10-12"]).toBeUndefined();
  });

  it("le ripetute si leggono con numero, distanza e passo", () => {
    expect(read("2026-09-16")).toMatchObject({ kind: "reps", reps: 5, repDistM: 1000, targetPaceSec: 238 });
    expect(read("2026-09-23")).toMatchObject({ kind: "reps", reps: 3, repDistM: 3000, targetPaceSec: 259 });
    expect(read("2026-10-07")).toMatchObject({ kind: "reps", reps: 3, repDistM: 2000, targetPaceSec: 257 });
  });

  it("medio e gara si leggono come tratti continui", () => {
    expect(read("2026-09-30")).toMatchObject({ kind: "tempo", repDistM: 8000, targetPaceSec: 266 });
    expect(read("2026-10-18")).toMatchObject({ kind: "tempo", repDistM: 21100, targetPaceSec: 287 });
  });

  it("i lunghi restano lenti: il finale a ritmo non deve farli bocciare", () => {
    expect(read("2026-09-20").kind).toBe("easy");
    expect(read("2026-09-27").kind).toBe("easy");
  });
});
