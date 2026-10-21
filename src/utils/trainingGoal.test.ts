import { describe, it, expect } from "vitest";
import type { BestEffort, Run } from "../types/api";
import { KIKKO_SUB20_PLAN, basesFor, kikkoWindow } from "../data/kikkoSub20Plan";
import {
  GOAL_PRESETS, MIN_PLAN_WEEKS, buildGoalPlan, fmtClock, nextMonday, parseClock, parseFiveKGoal,
  performancesFrom, vdotMatchesGoal,
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

  it("un obiettivo sui 5 km sta fra 13:00 e 45:00", () => {
    expect(parseFiveKGoal("19:45")).toBe(1185);
    expect(parseFiveKGoal("12:30")).toBeNull();
    expect(parseFiveKGoal("1:00:00")).toBeNull();
  });

  it("scrive i tempi come li si legge", () => {
    expect(fmtClock(1200)).toBe("20:00");
    expect(fmtClock(5675)).toBe("1:34:35");
  });

  it("i tempi pronti sono tutti validi e in ordine dal più lento", () => {
    const secs = GOAL_PRESETS.map((p) => p.sec);
    expect(secs.every((s) => parseFiveKGoal(fmtClock(s)) === s)).toBe(true);
    expect([...secs].sort((a, b) => b - a)).toEqual(secs);
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

describe("le prestazioni da cui partire", () => {
  it("i record: solo dai 5 km alla mezza, in ordine di distanza", () => {
    const { pbs } = performancesFrom(
      [effort("Mezza Maratona", "1:36:00"), effort("400m", "1:10"), effort("5 km", "20:07"), effort("10 km", "42:30")],
      [], TODAY,
    );
    expect(pbs.map((p) => p.label)).toEqual(["5 km", "10 km", "Mezza Maratona"]);
  });

  it("il VDOT di un 5 km a 20:07 sta intorno a 49,5 sulla scala del piano", () => {
    const { pbs } = performancesFrom([effort("5 km", "20:07")], [], TODAY);
    expect(pbs[0].vdot).toBeGreaterThan(49.2);
    expect(pbs[0].vdot).toBeLessThan(49.9);
  });

  it("un tempo da GPS impazzito non è una prestazione", () => {
    const { pbs } = performancesFrom([effort("5 km", "10:00")], [], TODAY);
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
    ], TODAY);
    expect(runs.map((r) => r.id)).toEqual(["run-b", "run-a"]);
    expect(runs[0].vdot).toBeGreaterThan(runs[1].vdot);
  });

  it("una corsa già record non si ripete fra le corse", () => {
    const { pbs, runs } = performancesFrom(
      [effort("5 km", "20:00", { run_id: "b" })],
      [run({ id: "b" }), run({ id: "a", duration_minutes: 21, avg_pace: "4:12" })],
      TODAY,
    );
    expect(pbs).toHaveLength(1);
    expect(runs.map((r) => r.id)).toEqual(["run-a"]);
  });

  it("dà al più il numero di corse chiesto", () => {
    const many = Array.from({ length: 12 }, (_, i) => run({ id: `x${i}`, duration_minutes: 20 + i * 0.1 }));
    expect(performancesFrom([], many, TODAY, 5).runs).toHaveLength(5);
  });
});
