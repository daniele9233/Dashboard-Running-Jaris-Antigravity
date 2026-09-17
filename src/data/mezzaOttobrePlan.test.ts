import { describe, it, expect } from "vitest";
import { PLAN_DAYS, PLAN_GOALS, PLAN_WEEKS, nextPlanDay, planDateLabel, planRunSessions, planWeekOf } from "./mezzaOttobrePlan";
import { parsePrescription } from "../utils/trainingAdherence";

/**
 * Il piano è trascritto a mano: qui si controlla che la trascrizione regga —
 * nessun giorno perso, i chilometri delle settimane tornano, e le sedute
 * chiave arrivano all'esito automatico nella forma che sa leggere.
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
    expect(km[1]).toBeCloseTo(49.5, 1);
    expect(km[2]).toBeCloseTo(49, 1);
    expect(km[3]).toBeCloseTo(41, 1);
    expect(km[4]).toBeCloseTo(17, 1);
  });

  it("le date si leggono in italiano", () => {
    expect(planDateLabel("2026-10-10")).toBe("sabato 10 ottobre");
    expect(planWeekOf("2026-10-01")?.n).toBe(3);
    expect(planWeekOf("2026-11-01")).toBeNull();
  });

  it("gli obiettivi sono 19:59 sui 5 km e 4:47 al km sulla mezza", () => {
    expect(PLAN_GOALS[0].targetSec).toBe(1199);
    expect(PLAN_GOALS[1].targetSec / 21.0975).toBeCloseTo(287, 0);
  });
});

describe("la prossima seduta", () => {
  it("se la seduta di oggi è già fatta, mostra la successiva", () => {
    expect(nextPlanDay("2026-09-16")).toMatchObject({ isToday: false, day: { date: "2026-09-17" } });
  });

  it("altrimenti mostra quella di oggi", () => {
    expect(nextPlanDay("2026-09-24")).toMatchObject({ isToday: true, day: { title: "6×800 a 3:55–3:58" } });
  });

  it("dopo la mezza non c'è niente da mostrare", () => {
    expect(nextPlanDay("2026-10-19")).toBeNull();
  });
});

describe("le sedute per l'esito automatico", () => {
  const byDate = Object.fromEntries(planRunSessions().map((s) => [s.date, s]));
  const read = (iso: string) => parsePrescription(byDate[iso]);

  it("bici e riposo non vengono giudicati come corse", () => {
    expect(byDate["2026-09-14"]).toBeUndefined();
    expect(byDate["2026-10-12"]).toBeUndefined();
  });

  it("le ripetute si leggono con numero, distanza e passo", () => {
    expect(read("2026-09-16")).toMatchObject({ kind: "reps", reps: 5, repDistM: 1000, targetPaceSec: 238 });
    expect(read("2026-09-24")).toMatchObject({ kind: "reps", reps: 6, repDistM: 800, targetPaceSec: 237 });
    expect(read("2026-10-07")).toMatchObject({ kind: "reps", reps: 3, repDistM: 1000, targetPaceSec: 240 });
  });

  it("ritmo mezza, test e gara si leggono come tratti continui", () => {
    expect(read("2026-10-01")).toMatchObject({ kind: "tempo", repDistM: 8000, targetPaceSec: 287 });
    expect(read("2026-10-10")).toMatchObject({ kind: "tempo", repDistM: 5000, targetPaceSec: 240 });
    expect(read("2026-10-18")).toMatchObject({ kind: "tempo", repDistM: 21100, targetPaceSec: 287 });
  });

  it("i lunghi restano lenti: il finale a ritmo non deve farli bocciare", () => {
    expect(read("2026-09-27").kind).toBe("easy");
    expect(read("2026-10-04").kind).toBe("easy");
  });
});
