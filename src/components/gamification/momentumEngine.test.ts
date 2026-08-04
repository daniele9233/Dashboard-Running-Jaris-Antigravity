import { describe, it, expect } from "vitest";
import {
  buildMomentum, chargeOf, windowFactor, multiplierOf, CHAPTERS, MOM_MAX, SEASON_WEEKS,
} from "./momentumEngine";
import type { Run } from "../../types/api";

/**
 * La v4 vive di una sola affermazione: la STESSA seduta vale diversamente a
 * seconda di quando la fai. Se la griglia dei sette giorni fosse piatta, la
 * pagina non direbbe niente che le altre non dicano già. Qui si verifica che la
 * finestra abbia un massimo dove deve averlo e che il momentum si scarichi.
 */

let seq = 0;
const mkRun = (over: Partial<Run> & Record<string, unknown> = {}): Run =>
  ({
    id: `r${++seq}`, date: "2026-05-04", distance_km: 10, duration_minutes: 50,
    avg_pace: "5:00", avg_hr: null, max_hr: null, avg_hr_pct: 74, max_hr_pct: null,
    run_type: "easy", notes: null, location: "Rome", strava_id: null,
    avg_cadence: null, elevation_gain: 0, splits: [], polyline: null,
    start_latlng: null, plan_feedback: null, avg_vertical_oscillation: null,
    avg_vertical_ratio: null, avg_ground_contact_time: null, avg_stride_length: null,
    is_treadmill: false, name: null, temperature: 12, ...over,
  }) as unknown as Run;

const pace = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const run = (date: string, km: number, paceSec: number, over: Partial<Run> = {}) =>
  mkRun({ date, distance_km: km, duration_minutes: (km * paceSec) / 60, avg_pace: pace(paceSec), ...over });

/** Blocco realistico: 4 uscite a settimana per `weeks` settimane. */
const block = (weeks: number, startIso: string) => {
  const out: Run[] = [];
  const d0 = new Date(startIso + "T00:00:00Z").getTime();
  for (let w = 0; w < weeks; w++) {
    for (const [off, km, ps, extra] of [
      [0, 10, 330, {}], [2, 8, 250, { run_type: "tempo", avg_hr_pct: 88 }],
      [4, 9, 340, {}], [6, 16, 350, {}],
    ] as [number, number, number, Partial<Run>][]) {
      out.push(run(new Date(d0 + (w * 7 + off) * 86400000).toISOString().slice(0, 10), km, ps, extra));
    }
  }
  return out;
};

describe("la finestra", () => {
  it("il picco per una seduta dura è a 48 ore dalla precedente dura", () => {
    const at = (gap: number) => windowFactor(gap, true, true);
    expect(at(2)).toBeGreaterThan(at(1));
    expect(at(2)).toBeGreaterThan(at(3));
    expect(at(2)).toBeGreaterThan(at(7));
    expect(at(1)).toBeLessThan(1);       // duro sul duro a 24 ore penalizza
  });

  it("una seduta facile il giorno dopo una dura è premiata: è scarico", () => {
    expect(windowFactor(1, true, false)).toBeGreaterThan(1);
    expect(windowFactor(1, true, false)).toBeGreaterThan(windowFactor(1, true, true));
  });

  it("due sedute nello stesso giorno valgono poco", () => {
    expect(windowFactor(0, false, false)).toBeLessThan(0.8);
  });

  it("dopo una settimana ferma la finestra non premia più", () => {
    expect(windowFactor(9, false, true)).toBeLessThan(1);
  });
});

describe("carica e moltiplicatore", () => {
  it("le ripetute caricano più del recupero a parità di durata", () => {
    expect(chargeOf(50, "vo2")).toBeGreaterThan(chargeOf(50, "recovery"));
    expect(chargeOf(50, "threshold")).toBeGreaterThan(chargeOf(50, "easy"));
  });

  it("la durata conta ma satura: due ore non valgono il doppio di un'ora", () => {
    const r = chargeOf(120, "easy") / chargeOf(60, "easy");
    expect(r).toBeLessThan(1.7);
    expect(r).toBeGreaterThan(1.3);
  });

  it("un lungo vale più di un lento: la saturazione non li appiattisce", () => {
    // il difetto trovato sui dati veri: col tetto secco 18 km e 10 km pareggiavano
    expect(chargeOf(94, "easy")).toBeGreaterThan(chargeOf(52, "easy") * 1.25);
  });

  it("il moltiplicatore va da 1 a 2,5 prima della finestra", () => {
    expect(multiplierOf(0, 1)).toBe(1);
    expect(multiplierOf(MOM_MAX, 1)).toBe(2.5);
  });
});

describe("il momentum si carica e si scarica", () => {
  it("un blocco di allenamento lo porta in alto", () => {
    const st = buildMomentum(block(6, "2026-01-05"), "2026-02-16T12:00:00Z");
    expect(st.ok).toBe(true);
    expect(st.momentum).toBeGreaterThan(60);
  });

  it("tre settimane ferme lo azzerano", () => {
    const runs = block(6, "2026-01-05");
    const hot = buildMomentum(runs, "2026-02-16T12:00:00Z");
    const cold = buildMomentum(runs, "2026-03-16T12:00:00Z");
    expect(cold.momentum).toBeLessThan(hot.momentum);
    expect(cold.momentum).toBe(0);
    expect(cold.daysSinceLastRun).toBeGreaterThan(20);
  });

  it("dice fra quanti giorni si azzera, e il conto torna", () => {
    const st = buildMomentum(block(6, "2026-01-05"), "2026-02-16T12:00:00Z");
    expect(st.zeroIn).toBe(Math.ceil(st.momentum / 5.5));
  });
});

describe("la griglia dei sette giorni", () => {
  it("non è piatta: la stessa seduta vale diversamente giorno per giorno", () => {
    const st = buildMomentum(block(6, "2026-01-05"), "2026-02-16T12:00:00Z");
    const reps = st.grid.filter((g) => g.sessionId === "reps").map((g) => g.sp);
    expect(new Set(reps).size).toBeGreaterThan(1);
    expect(Math.max(...reps)).toBeGreaterThan(Math.min(...reps));
  });

  it("il momentum previsto cala di giorno in giorno se non esci", () => {
    const st = buildMomentum(block(6, "2026-01-05"), "2026-02-16T12:00:00Z");
    for (let i = 1; i < st.days.length; i++) {
      expect(st.days[i].momentum).toBeLessThanOrEqual(st.days[i - 1].momentum);
    }
  });

  it("la casella migliore è davvero il massimo della griglia", () => {
    const st = buildMomentum(block(6, "2026-01-05"), "2026-02-16T12:00:00Z");
    expect(st.best!.sp).toBe(Math.max(...st.grid.map((g) => g.sp)));
  });

  it("il moltiplicatore in cima coincide con la casella 'oggi' della griglia", () => {
    for (const iso of ["2026-02-16T12:00:00Z", "2026-02-18T12:00:00Z", "2026-02-23T12:00:00Z"]) {
      const st = buildMomentum(block(6, "2026-01-05"), iso);
      const todayEasy = st.grid.find((g) => g.dayOffset === 0 && g.sessionId === "easy")!;
      expect(st.multiplierNow).toBe(todayEasy.mult);
    }
  });

  it("copre sette giorni per ognuna delle sedute proposte", () => {
    const st = buildMomentum(block(6, "2026-01-05"), "2026-02-16T12:00:00Z");
    expect(st.days).toHaveLength(7);
    expect(st.grid).toHaveLength(7 * st.sessions.length);
  });
});

describe("la stagione", () => {
  it("dura tredici settimane e si chiude", () => {
    const st = buildMomentum(block(6, "2026-01-05"), "2026-02-16T12:00:00Z");
    expect(st.seasonEnd - st.seasonStart + 1).toBe(SEASON_WEEKS * 7);
    expect(st.daysLeft).toBeGreaterThan(0);
    expect(st.daysLeft).toBeLessThan(SEASON_WEEKS * 7);
  });

  it("conta solo gli SP guadagnati dentro la stagione in corso", () => {
    // due blocchi, uno in una stagione precedente: il primo non deve contare
    const runs = [...block(4, "2025-09-01"), ...block(4, "2026-01-05")];
    const st = buildMomentum(runs, "2026-02-16T12:00:00Z");
    const onlyNew = buildMomentum(block(4, "2026-01-05"), "2026-02-16T12:00:00Z");
    expect(st.sp).toBe(onlyNew.sp);
  });

  it("i capitoli salgono e il capitolo raggiunto è coerente con gli SP", () => {
    for (let i = 1; i < CHAPTERS.length; i++) expect(CHAPTERS[i].sp).toBeGreaterThan(CHAPTERS[i - 1].sp);
    const st = buildMomentum(block(6, "2026-01-05"), "2026-02-16T12:00:00Z");
    if (st.chapter) expect(st.sp).toBeGreaterThanOrEqual(st.chapter.sp);
    if (st.nextChapter) expect(st.sp).toBeLessThan(st.nextChapter.sp);
  });

  it("la proiezione di fine stagione non è mai sotto il già fatto", () => {
    const st = buildMomentum(block(6, "2026-01-05"), "2026-02-16T12:00:00Z");
    expect(st.projectedSp).toBeGreaterThanOrEqual(st.sp);
  });

  it("da fermo non promette un capitolo che non arriverà", () => {
    const st = buildMomentum(block(4, "2025-09-01"), "2026-02-16T12:00:00Z");
    expect(st.sp).toBe(0);
    expect(st.etaIso).toBeNull();
  });
});

describe("il giudizio è sul quando", () => {
  it("ogni corsa banchettata porta la sua spiegazione di timing", () => {
    const st = buildMomentum(block(6, "2026-01-05"), "2026-02-16T12:00:00Z");
    expect(st.banked.length).toBeGreaterThan(0);
    for (const b of st.banked) {
      expect(b.timing.length).toBeGreaterThan(10);
      expect(b.sp).toBeGreaterThan(0);
      expect(b.mult).toBeGreaterThan(0);
    }
  });

  it("con meno di tre corse non finge uno stato", () => {
    expect(buildMomentum([run("2026-01-05", 10, 330)]).ok).toBe(false);
  });
});
