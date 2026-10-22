import { describe, it, expect } from "vitest";
import { defaultState, doneToday, localIso, parseState } from "./shinRehabState";

describe("lo stato salvato nel browser", () => {
  it("senza niente salvato parte dalla fase 1, vuoto", () => {
    expect(parseState(null)).toEqual(defaultState());
    expect(defaultState().phase).toBe("calma");
  });

  it("un valore rovinato non rompe la pagina", () => {
    expect(parseState("{non è json")).toEqual(defaultState());
    expect(parseState("42")).toEqual(defaultState());
    expect(parseState("null")).toEqual(defaultState());
  });

  it("tiene quello che è valido e scarta il resto", () => {
    const s = parseState(JSON.stringify({
      version: 1, phase: "rinforza",
      gates: { "calma-walk": true, "calma-raise": false, x: "sì" },
      done: { "2026-10-22": ["calf-raise-single", 7, "side-plank"], "domani": ["a"] },
      pain: [
        { date: "2026-10-21", morning: 4, walking: 2, effort: 3 },
        { date: "ieri", morning: 9, walking: 9, effort: 9 },
        { date: "2026-10-22", morning: 99, walking: -1, effort: "boh" },
      ],
      runStep: 3,
    }));
    expect(s.phase).toBe("rinforza");
    expect(s.gates).toEqual({ "calma-walk": true });
    expect(s.done).toEqual({ "2026-10-22": ["calf-raise-single", "side-plank"] });
    expect(s.pain.map((p) => p.date)).toEqual(["2026-10-21", "2026-10-22"]);
    expect(s.pain[1]).toEqual({ date: "2026-10-22", morning: 10, walking: 0, effort: 0 });
    expect(s.runStep).toBe(3);
  });

  it("una fase sconosciuta e un passo fuori tabella tornano ai valori di partenza", () => {
    const s = parseState(JSON.stringify({ phase: "guarito", runStep: 12 }));
    expect(s.phase).toBe("calma");
    expect(s.runStep).toBe(0);
  });

  it("la data è quella locale, non UTC", () => {
    // le 00:30 del 23 ottobre a Roma sono ancora il 22 in UTC
    expect(localIso(new Date(2026, 9, 23, 0, 30))).toBe("2026-10-23");
    expect(localIso(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("conta gli esercizi fatti oggi fra quelli della fase", () => {
    const s = { ...defaultState(), done: { "2026-10-22": ["a", "b", "z"], "2026-10-21": ["c"] } };
    expect(doneToday(s, ["a", "b", "c"], "2026-10-22")).toBe(2);
    expect(doneToday(s, ["a", "b", "c"], "2026-10-23")).toBe(0);
  });
});
