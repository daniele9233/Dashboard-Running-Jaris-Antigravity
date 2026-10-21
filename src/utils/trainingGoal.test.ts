import { describe, it, expect } from "vitest";
import type { BestEffort, IntervalSession, Run } from "../types/api";
import { KIKKO_SUB20_PLAN, basesFor, kikkoWindow } from "../data/kikkoSub20Plan";
import {
  GOAL_DISTANCE_KM, MIN_PLAN_WEEKS, buildGoalPlan, equivalentSec, fmtClock, goalFromPace, nextMonday,
  parseClock, parseDistanceKm, parsePace, performancesFrom, vdotMatchesGoal,
} from "./trainingGoal";

// mercoledì 21 ottobre 2026
const TODAY = "2026-10-21";

describe("i tempi scritti a mano", () => {
  it("legge mm:ss e h:mm:ss", () => {
    expect(parseClock("19:59")).toBe(1199);
    expect(parseClock(" 1:34:35 ")).toBe(5675);
  });

  it("rifiuta quello che non è un tempo", () => {
    expect(parseClock("")).toBeNull();
    expect(parseClock("20")).toBeNull();
    expect(parseClock("19:75")).toBeNull();
    expect(parseClock("abc")).toBeNull();
  });

  it("scrive i tempi come li si legge", () => {
    expect(fmtClock(1200)).toBe("20:00");
    expect(fmtClock(5675)).toBe("1:34:35");
  });

});

describe("l'obiettivo scritto a mano: distanza e passo medio", () => {
  it("legge la distanza con virgola o punto", () => {
    expect(parseDistanceKm("5")).toBe(5);
    expect(parseDistanceKm("21,1")).toBe(21.1);
    expect(parseDistanceKm(" 21.0975 ")).toBe(21.0975);
  });

  it("rifiuta le distanze fuori scala o che non sono numeri", () => {
    expect(parseDistanceKm("")).toBeNull();
    expect(parseDistanceKm("2")).toBeNull();      // sotto i 3 km la formula non vale
    expect(parseDistanceKm("50")).toBeNull();     // oltre la maratona
    expect(parseDistanceKm("5 km")).toBeNull();
    expect(parseDistanceKm("-5")).toBeNull();
  });

  it("legge il passo al km come m:ss", () => {
    expect(parsePace("4:00")).toBe(240);
    expect(parsePace(" 3:56 ")).toBe(236);
  });

  it("rifiuta i passi fuori scala o scritti male", () => {
    expect(parsePace("")).toBeNull();
    expect(parsePace("4")).toBeNull();
    expect(parsePace("4:75")).toBeNull();
    expect(parsePace("2:00")).toBeNull();         // più veloce di un record del mondo
    expect(parsePace("12:00")).toBeNull();
  });

  it("il tempo è distanza × passo", () => {
    const g = goalFromPace(5, 240)!;
    expect(g.timeSec).toBe(1200);
    expect(g.distKm).toBe(5);
    expect(g.paceSec).toBe(240);
    expect(fmtClock(g.timeSec)).toBe("20:00");
  });

  it("sui 5 km il motore equivalente è il tempo stesso", () => {
    expect(goalFromPace(5, 236)!.fiveKSec).toBe(1180);
  });

  it("su un'altra distanza si traduce nel 5 km equivalente", () => {
    // mezza a 4:45/km = 1:40:13 → un motore da ~45 → un 5 km di ~21:30
    const half = goalFromPace(21.0975, 285)!;
    expect(half.timeSec).toBe(6013);
    expect(half.fiveKSec).toBeGreaterThan(20 * 60 + 40);
    expect(half.fiveKSec).toBeLessThan(22 * 60);
    // e a ritroso torna alla mezza
    expect(equivalentSec(GOAL_DISTANCE_KM * 1000, half.fiveKSec, 21097.5)).toBeCloseTo(half.timeSec, -1);
  });

  it("un passo più veloce sulla stessa distanza chiede un motore più grande", () => {
    expect(goalFromPace(10, 240)!.fiveKSec).toBeLessThan(goalFromPace(10, 255)!.fiveKSec);
  });

  it("fuori scala non c'è obiettivo", () => {
    expect(goalFromPace(2, 240)).toBeNull();
    expect(goalFromPace(5, 100)).toBeNull();
    expect(goalFromPace(60, 300)).toBeNull();
  });

  it("un obiettivo su un'altra distanza dà un piano coerente col suo 5 km equivalente", () => {
    const half = goalFromPace(21.0975, 285)!;
    const p = buildGoalPlan(45, half.fiveKSec, TODAY);
    expect(vdotMatchesGoal(p.vdot, half.fiveKSec)).toBe(true);
  });
});

describe("il lunedì di partenza", () => {
  it("da mercoledì parte il lunedì dopo", () => {
    expect(nextMonday("2026-10-21")).toBe("2026-10-26");
  });
  it("da domenica parte il giorno dopo", () => {
    expect(nextMonday("2026-10-25")).toBe("2026-10-26");
  });
  it("da lunedì parte oggi", () => {
    expect(nextMonday("2026-10-26")).toBe("2026-10-26");
  });
});

describe("il piano per un obiettivo", () => {
  it("un obiettivo vicino sta in un blocco corto e dentro il tetto", () => {
    const p = buildGoalPlan(49.5, 20 * 60, TODAY);
    expect(p.goalVdot).toBeGreaterThan(49.5);
    expect(p.gain).toBeGreaterThan(0);
    expect(p.weeks).toBe(MIN_PLAN_WEEKS);
    expect(p.realistic).toBe(true);
    expect(p.clipped).toBe(false);
    expect(p.reachSec).toBe(20 * 60);
    expect(p.vdot.start).toBe(49.5);
    expect(p.vdot.target).toBeCloseTo(p.goalVdot, 1);
  });

  it("la finestra salvata dà esattamente le settimane calcolate, partendo di lunedì", () => {
    const p = buildGoalPlan(49.5, 19 * 60 + 40, TODAY);
    expect(p.startIso).toBe("2026-10-26");
    const w = kikkoWindow(KIKKO_SUB20_PLAN, p.startIso, p.raceMondayIso);
    expect(w.weeksUsed).toBe(p.weeks);
    expect(w.weeksSkipped).toBe(KIKKO_SUB20_PLAN.weeks.length - p.weeks);
    expect(w.raceIso).toBe(p.raceIso);
    expect(new Date(`${p.raceIso}T00:00:00`).getDay()).toBe(0); // domenica
  });

  it("più l'obiettivo è lontano, più il blocco è lungo", () => {
    const a = buildGoalPlan(49.5, 20 * 60, TODAY);
    const b = buildGoalPlan(49.5, 19 * 60 + 30, TODAY);
    expect(b.weeks).toBeGreaterThanOrEqual(a.weeks);
    expect(b.gain).toBeGreaterThan(a.gain);
  });

  it("se il motore c'è già non chiede guadagno e il piano porta alla gara", () => {
    const p = buildGoalPlan(53, 20 * 60, TODAY);
    expect(p.gain).toBe(0);
    expect(p.vdot).toEqual({ start: 53, target: 53 });
    expect(p.realistic).toBe(true);
    expect(p.weeks).toBe(MIN_PLAN_WEEKS);
  });

  it("un obiettivo oltre il blocco pieno lo dice, e dice dove il piano arriva", () => {
    const goal = 19 * 60;
    const p = buildGoalPlan(49.5, goal, TODAY);
    expect(p.gain).toBeGreaterThan(p.capGain);
    expect(p.weeks).toBe(KIKKO_SUB20_PLAN.weeks.length);
    expect(p.realistic).toBe(false);
    // il tempo raggiungibile sta fra la forma di oggi e l'obiettivo
    expect(p.reachSec).toBeGreaterThan(goal);
    expect(p.reachSec).toBeLessThan(basesFor(49.5).race * 5);
  });

  it("il VDOT di arrivo non supera la partenza di più di due punti", () => {
    const p = buildGoalPlan(45, 19 * 60, TODAY);
    expect(p.clipped).toBe(true);
    expect(p.vdot.target).toBe(47);
    expect(p.realistic).toBe(false);
  });

  it("la progressione non scende mai sotto la partenza", () => {
    const p = buildGoalPlan(55, 21 * 60, TODAY);
    expect(p.vdot.target).toBeGreaterThanOrEqual(p.vdot.start);
  });
});

describe("il VDOT salvato sul server", () => {
  it("un piano generato è sempre coerente con il proprio obiettivo", () => {
    for (const goal of [20 * 60, 19 * 60 + 40, 19 * 60 + 30, 19 * 60]) {
      for (const base of [45, 49.3, 49.5, 53]) {
        const p = buildGoalPlan(base, goal, TODAY);
        expect(vdotMatchesGoal(p.vdot, goal)).toBe(true);
      }
    }
  });

  it("una scelta vecchia, scollegata dall'obiettivo, non vale", () => {
    // 50,0 → 51,5 era il valore dell'input VDOT; l'obiettivo di oggi è 19:40 (50,8)
    expect(vdotMatchesGoal({ start: 50, target: 51.5 }, 19 * 60 + 40)).toBe(false);
  });
});

// ── le prestazioni ──────────────────────────────────────────────────────────

const run = (over: Partial<Run>): Run => ({
  id: "r1", date: "2026-10-06", distance_km: 5, duration_minutes: 20, avg_pace: "4:00",
  is_treadmill: false, name: "Corsa", temperature: null, ...over,
} as Run);

const effort = (distance: string, time: string, over: Partial<BestEffort> = {}): BestEffort => ({
  distance, time, pace: "", date: "2026-09-05", run_id: `e-${distance}`, ...over,
});

const session = (over: Partial<IntervalSession> = {}): IntervalSession => ({
  run_id: "s1", date: "2026-09-16", name: "5x1000", n_reps: 5, avg_rep_m: 1000, work_pace_sec: 238,
  fastest_rep_m: 1000, fastest_pace_sec: 235, rest_avg_sec: 150, temp_c: 17.1, vdot: 48.0, ...over,
});

describe("le prestazioni da cui partire", () => {
  it("i record: solo dai 5 km alla mezza, in ordine di distanza", () => {
    const { pbs } = performancesFrom(
      [effort("Mezza Maratona", "1:36:00"), effort("400m", "1:10"), effort("5 km", "20:07"), effort("10 km", "42:30")],
      [], [], TODAY,
    );
    expect(pbs.map((p) => p.label)).toEqual(["5 km", "10 km", "Mezza Maratona"]);
  });

  it("il VDOT di un 5 km a 20:07 sta intorno a 49,5 sulla scala del piano", () => {
    const { pbs } = performancesFrom([effort("5 km", "20:07")], [], [], TODAY);
    expect(pbs[0].vdot).toBeGreaterThan(49.2);
    expect(pbs[0].vdot).toBeLessThan(49.9);
  });

  it("un tempo da GPS impazzito non è una prestazione", () => {
    const { pbs } = performancesFrom([effort("5 km", "10:00")], [], [], TODAY);
    expect(pbs).toHaveLength(0);
  });

  it("le corse: da 5 km in su, ultimo anno, non tapis, dalla più forte", () => {
    const { runs } = performancesFrom([], [
      run({ id: "a", duration_minutes: 21, avg_pace: "4:12" }),
      run({ id: "b", duration_minutes: 20, avg_pace: "4:00" }),
      run({ id: "corta", distance_km: 4, duration_minutes: 15, avg_pace: "3:45" }),
      run({ id: "tapis", is_treadmill: true }),
      run({ id: "vecchia", date: "2025-06-01" }),
      run({ id: "futura", date: "2026-12-01" }),
    ], [], TODAY);
    expect(runs.map((r) => r.id)).toEqual(["run-b", "run-a"]);
    expect(runs[0].vdot).toBeGreaterThan(runs[1].vdot);
  });

  it("una corsa già record non si ripete fra le corse", () => {
    const { pbs, runs } = performancesFrom(
      [effort("5 km", "20:00", { run_id: "b" })],
      [run({ id: "b" }), run({ id: "a", duration_minutes: 21, avg_pace: "4:12" })],
      [], TODAY,
    );
    expect(pbs).toHaveLength(1);
    expect(runs.map((r) => r.id)).toEqual(["run-a"]);
  });

  it("le ripetute: dalla seduta più forte, con la ripetuta più veloce", () => {
    const { reps } = performancesFrom([], [], [
      session({ run_id: "a", vdot: 48.0 }),
      session({ run_id: "b", vdot: 50.1, fastest_pace_sec: 230 }),
    ], TODAY);
    expect(reps.map((r) => r.id)).toEqual(["reps-b", "reps-a"]);
    expect(reps[0].kind).toBe("reps");
    expect(reps[0].reps).toMatchObject({ n: 5, avgM: 1000, fastestPaceSec: 230, fastestM: 1000, restSec: 150 });
    expect(reps[0].distKm).toBe(5);
    expect(reps[0].timeSec).toBe(1190);   // 5 km di lavoro a 3:58
  });

  it("il VDOT delle ripetute è quello del server, portato sulla scala del piano", () => {
    const { reps } = performancesFrom([], [], [session({ vdot: 49.5 })], TODAY);
    expect(reps[0].vdot).toBeGreaterThan(49.2);
    expect(reps[0].vdot).toBeLessThan(49.9);
  });

  it("una seduta a ripetute non compare anche fra le corse", () => {
    const { reps, runs } = performancesFrom(
      [], [run({ id: "x", duration_minutes: 22, avg_pace: "4:24" }), run({ id: "y", duration_minutes: 21, avg_pace: "4:12" })],
      [session({ run_id: "x" })], TODAY,
    );
    expect(reps.map((r) => r.id)).toEqual(["reps-x"]);
    expect(runs.map((r) => r.id)).toEqual(["run-y"]);
  });

  it("senza ripetute il gruppo è vuoto", () => {
    expect(performancesFrom([], [], [], TODAY).reps).toEqual([]);
  });

  it("dà al più il numero di ripetute chiesto", () => {
    const many = Array.from({ length: 10 }, (_, i) => session({ run_id: `s${i}`, vdot: 45 + i * 0.1 }));
    expect(performancesFrom([], [], many, TODAY, { maxReps: 4 }).reps).toHaveLength(4);
  });

  it("dà al più il numero di corse chiesto", () => {
    const many = Array.from({ length: 12 }, (_, i) => run({ id: `x${i}`, duration_minutes: 20 + i * 0.1 }));
    expect(performancesFrom([], many, [], TODAY, { maxRuns: 5 }).runs).toHaveLength(5);
  });
});
