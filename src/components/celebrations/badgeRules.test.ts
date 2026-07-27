import { describe, it, expect } from "vitest";
import { buildMetrics, evaluateMet, vdotFrom } from "./badgeRules";
import type { Run, Lap, Split } from "../../types/api";

/**
 * I criteri dei badge girano su dati veri (best effort, giri, split, meteo):
 * qui si verifica che ogni famiglia di metriche legga quello che deve e che
 * la distinzione obiettivo/record regga — un obiettivo guarda tutto lo
 * storico, un record scatta solo se il primato cade davvero.
 */

let seq = 0;
const mkRun = (over: Partial<Run> & Record<string, unknown> = {}): Run =>
  ({
    id: `r${++seq}`, date: "2026-05-04", distance_km: 10, duration_minutes: 50,
    avg_pace: "5:00", avg_hr: 150, max_hr: 170, avg_hr_pct: null, max_hr_pct: null,
    run_type: "easy", notes: null, location: "Rome", strava_id: null,
    avg_cadence: 170, elevation_gain: 40, splits: [], polyline: null,
    start_latlng: null, plan_feedback: null, avg_vertical_oscillation: null,
    avg_vertical_ratio: null, avg_ground_contact_time: null, avg_stride_length: null,
    is_treadmill: false, name: null, ...over,
  }) as unknown as Run;

const lap = (distance: number, moving_time: number, hr: number | null = null): Lap =>
  ({ lap_index: 0, distance, moving_time, elapsed_time: moving_time,
     average_speed: distance / moving_time, average_heartrate: hr });

const split = (km: number, pace: string, hr: number | null = null, elev = 0): Split =>
  ({ km, pace, hr, cadence: null, distance: 1000, elapsed_time: 300, elevation_difference: elev });

/** Valuta con tutto lo storico in baseline: restano solo gli obiettivi. */
const goals = (runs: Run[]) => new Set(evaluateMet(runs, runs.map((r) => r.id)));
/** Valuta con `fresh` fuori baseline: entrano anche i record. */
const withNew = (base: Run[], fresh: Run[]) =>
  new Set(evaluateMet([...base, ...fresh], base.map((r) => r.id)));

describe("igiene dei dati", () => {
  it("scarta le attività spazzatura (glitch GPS)", () => {
    const junk = Array.from({ length: 40 }, () => mkRun({ distance_km: 0.01, duration_minutes: 0.07 }));
    const real = Array.from({ length: 3 }, (_, i) =>
      mkRun({ distance_km: 8, date: `2026-05-0${i + 1}` }));
    const m = buildMetrics([...junk, ...real]);
    expect(m.totalRuns).toBe(3);
    expect(m.hasDoubleDay).toBe(false);
  });
});

describe("obiettivi: contano anche le corse vecchie", () => {
  it("i km totali sbloccano pur essendo tutti in baseline", () => {
    const runs = Array.from({ length: 100 }, (_, i) =>
      mkRun({ distance_km: 11, date: `2025-0${(i % 9) + 1}-0${(i % 9) + 1}` }));
    expect(goals(runs).has("total-1000k")).toBe(true);
    expect(goals(runs).has("total-2000k")).toBe(false);
  });

  it("il lungo più lungo sblocca mezza e 30 km alle rispettive soglie", () => {
    expect(goals([mkRun({ distance_km: 21.4 })]).has("first-half")).toBe(true);
    expect(goals([mkRun({ distance_km: 21.4 })]).has("first-30k")).toBe(false);
    expect(goals([mkRun({ distance_km: 30.2 })]).has("first-30k")).toBe(true);
  });
});

describe("record: servono corse nuove che battono il meglio di prima", () => {
  const base = [mkRun({ best_1000m_sec: 220, date: "2026-01-10" })];

  it("non scatta se il primato non cade", () => {
    expect(withNew(base, [mkRun({ best_1000m_sec: 230 })]).has("best-1k")).toBe(false);
  });

  it("scatta quando la corsa nuova va più forte", () => {
    expect(withNew(base, [mkRun({ best_1000m_sec: 210 })]).has("best-1k")).toBe(true);
  });

  it("un obiettivo già raggiunto in passato resta sbloccato", () => {
    // 3:40/km sui 1000 → sotto i 4:00: obiettivo raggiunto, niente record nuovo
    expect(goals([mkRun({ best_1000m_sec: 220 })]).has("sub-4")).toBe(true);
  });
});

describe("giri dell'orologio", () => {
  it("conta le ripetute da 400 m per pista e serie da otto", () => {
    const six = mkRun({ laps: Array.from({ length: 6 }, () => lap(400, 84)) });
    const eight = mkRun({ laps: Array.from({ length: 8 }, () => lap(400, 84)) });
    expect(goals([six]).has("track-session")).toBe(true);
    expect(goals([six]).has("rep-400x8")).toBe(false);
    expect(goals([eight]).has("rep-400x8")).toBe(true);
  });

  it("dieci ripetute lunghe sbloccano la serie da dieci", () => {
    const run = mkRun({ laps: Array.from({ length: 10 }, () => lap(1000, 220)) });
    expect(goals([run]).has("yasso")).toBe(true);
  });

  it("legge il miglior 200, il miglior 1000 e il miglio da 4 giri", () => {
    const m = buildMetrics([mkRun({
      laps: [lap(200, 32), lap(1000, 214), lap(400, 84), lap(400, 86), lap(400, 85), lap(400, 88)],
    })]);
    expect(m.bestLap200).toBe(32);
    expect(m.bestLap1000).toBe(214);
    expect(m.bestMile).toBe(84 + 86 + 85 + 88);
  });

  it("misura il crollo di FC tra ripetuta e recupero", () => {
    const run = mkRun({ laps: [lap(1000, 200, 175), lap(400, 200, 140)] });
    expect(buildMetrics([run]).maxHrDrop).toBe(35);
    expect(goals([run]).has("hr-recovery")).toBe(true);
  });

  it("la punta di velocità ignora i giri troppo corti", () => {
    const short = mkRun({ laps: [lap(100, 15)] });          // 24 km/h ma solo 100 m
    const real = mkRun({ laps: [lap(400, 70)] });           // 20,6 km/h su 400 m
    expect(goals([short]).has("speed-20")).toBe(false);
    expect(goals([real]).has("speed-20")).toBe(true);
  });
});

describe("split al km", () => {
  const mk = (paces: string[], over: Partial<Run> = {}) =>
    mkRun({ distance_km: paces.length, splits: paces.map((p, i) => split(i + 1, p)), ...over });

  it("riconosce la negativa e la progressione", () => {
    const g = goals([mk(["5:20", "5:18", "5:10", "5:02", "4:55", "4:50"])]);
    expect(g.has("negative-split")).toBe(true);
    expect(g.has("progression")).toBe(true);
  });

  it("gli split pari richiedono un lungo davvero regolare", () => {
    expect(goals([mk(["5:00", "5:05", "4:58", "5:02", "5:01", "5:04", "4:59", "5:03"])])
      .has("even-splits")).toBe(true);
    expect(goals([mk(["5:00", "5:40", "4:58", "5:02", "5:01", "5:04", "4:59", "5:03"])])
      .has("even-splits")).toBe(false);
  });

  it("il finale lanciato conta solo se stacca la media", () => {
    expect(goals([mk(["5:20", "5:18", "5:20", "5:19", "4:40"])]).has("final-sprint")).toBe(true);
    expect(goals([mk(["5:20", "5:18", "5:20", "5:19", "5:15"])]).has("final-sprint")).toBe(false);
  });

  it("il cuore piatto guarda metà contro metà su un lungo", () => {
    const steady = mkRun({ distance_km: 10, splits: [140, 141, 142, 141, 143, 142]
      .map((h, i) => split(i + 1, "5:10", h)) });
    const drifting = mkRun({ distance_km: 10, splits: [130, 132, 134, 145, 148, 150]
      .map((h, i) => split(i + 1, "5:10", h)) });
    expect(goals([steady]).has("hr-stable")).toBe(true);
    expect(goals([drifting]).has("hr-stable")).toBe(false);
  });

  it("misura la salita continua più lunga", () => {
    const run = mkRun({ distance_km: 6, splits: [
      split(1, "5:30", null, 2), split(2, "5:40", null, 20), split(3, "5:45", null, 25),
      split(4, "5:50", null, 30), split(5, "5:20", null, -10), split(6, "5:10", null, 8),
    ] });
    expect(buildMetrics([run]).maxClimbKm).toBe(3);
  });
});

describe("meteo e orari", () => {
  it("separa asfalto bagnato e nebbia con la temperatura", () => {
    expect(goals([mkRun({ temperature: 12, humidity: 97 })]).has("rain-run")).toBe(true);
    expect(goals([mkRun({ temperature: 12, humidity: 97 })]).has("foggy-run")).toBe(false);
    expect(goals([mkRun({ temperature: 5, humidity: 97 })]).has("foggy-run")).toBe(true);
  });

  it("gelo, caldo e afa hanno soglie distinte", () => {
    expect(goals([mkRun({ temperature: 1.1 })]).has("freezing-run")).toBe(true);
    expect(goals([mkRun({ temperature: 31 })]).has("heat-run")).toBe(true);
    expect(goals([mkRun({ temperature: 31 })]).has("heat-record-32")).toBe(false);
    expect(goals([mkRun({ humidity: 94 })]).has("humid-run")).toBe(true);
  });

  it("alba e notte leggono l'ora locale di partenza", () => {
    expect(goals([mkRun({ start_date_local: "2026-05-04T05:40:00Z" })]).has("dawn-run")).toBe(true);
    expect(goals([mkRun({ start_date_local: "2026-05-04T08:40:00Z" })]).has("dawn-run")).toBe(false);
    expect(goals([mkRun({ start_date_local: "2026-05-04T20:30:00Z" })]).has("night-run")).toBe(true);
  });
});

describe("costanza", () => {
  const days = (n: number, from = 1) =>
    Array.from({ length: n }, (_, i) =>
      mkRun({ date: `2026-03-${String(from + i).padStart(2, "0")}`, distance_km: 8 }));

  it("sette giorni di fila sbloccano la streak", () => {
    expect(goals(days(6)).has("streak-7")).toBe(false);
    expect(goals(days(7)).has("streak-7")).toBe(true);
  });

  it("la settimana piena vuole tutti e sette i giorni", () => {
    // 2026-03-02 è un lunedì: sette giorni = settimana ISO completa
    expect(goals(days(7, 2)).has("week-coverage")).toBe(true);
    expect(goals(days(6, 2)).has("week-coverage")).toBe(false);
  });

  it("venti corse in trenta giorni valgono il mese di fuoco", () => {
    expect(goals(days(20)).has("streak-30")).toBe(true);
    expect(goals(days(19)).has("streak-30")).toBe(false);
  });
});

describe("prove cronometrate", () => {
  const tt = (date: string) => mkRun({ date, distance_km: 6, avg_pace: "4:20" });

  it("una corsa lunga e veloce conta come prova", () => {
    expect(goals([tt("2026-05-04")]).has("first-race")).toBe(true);
    // stessa velocità ma troppo corta
    expect(goals([mkRun({ distance_km: 3, avg_pace: "4:20" })]).has("first-race")).toBe(false);
    // stessa distanza ma lenta
    expect(goals([mkRun({ distance_km: 6, avg_pace: "5:10" })]).has("first-race")).toBe(false);
  });

  it("tre nello stesso mese e dieci in totale", () => {
    const three = [tt("2026-05-04"), tt("2026-05-11"), tt("2026-05-18")];
    expect(goals(three).has("races-3-month")).toBe(true);
    expect(goals(three).has("races-10")).toBe(false);
    const ten = Array.from({ length: 10 }, (_, i) => tt(`2026-0${(i % 9) + 1}-1${i % 9}`));
    expect(goals(ten).has("races-10")).toBe(true);
  });

  it("il tapis roulant non vale come prova", () => {
    expect(goals([mkRun({ distance_km: 6, avg_pace: "4:20", is_treadmill: true })])
      .has("first-race")).toBe(false);
  });
});

describe("VDOT", () => {
  it("stima il VDOT dal 5000", () => {
    const v = vdotFrom(5000, 1235);
    expect(v).not.toBeNull();
    expect(v as number).toBeGreaterThan(46);
    expect(v as number).toBeLessThan(50);
  });

  it("il salto di tier scatta attraversando un multiplo di 5", () => {
    const slow = [mkRun({ distance_km: 5, avg_pace: "4:20" })];   // 5k in 21:40 → VDOT ~45,7
    const fast = [mkRun({ distance_km: 5, avg_pace: "4:00" })];   // 5k in 20:00 → VDOT ~49,8
    const faster = [mkRun({ distance_km: 5, avg_pace: "3:50" })]; // → oltre 50
    expect(withNew(slow, fast).has("tier-up")).toBe(false);
    expect(withNew(slow, faster).has("tier-up")).toBe(true);
  });
});

describe("storia dei record", () => {
  it("tre primati nello stesso mese valgono il tris", () => {
    const runs = [
      mkRun({ date: "2026-01-05", best_400m_sec: 220, best_800m_sec: 230, best_1000m_sec: 240 }),
      mkRun({ date: "2026-03-05", best_400m_sec: 210, best_800m_sec: 225, best_1000m_sec: 235 }),
    ];
    expect(goals(runs).has("triple-pb")).toBe(true);
    expect(goals([runs[0]]).has("triple-pb")).toBe(false);  // il primo dato non è un record
  });

  it("PB su 5k in due mesi consecutivi", () => {
    const runs = [
      mkRun({ date: "2026-01-05", distance_km: 5, avg_pace: "4:30" }),
      mkRun({ date: "2026-02-05", distance_km: 5, avg_pace: "4:20" }),
      mkRun({ date: "2026-03-05", distance_km: 5, avg_pace: "4:10" }),
    ];
    expect(goals(runs).has("two-month-pr")).toBe(true);
  });

  it("il podio personale vuole tre 5K sotto i 21:00", () => {
    const fast = ["4:10", "4:12", "4:11"].map((p) => mkRun({ distance_km: 5, avg_pace: p }));
    const mixed = ["4:10", "4:12", "4:40"].map((p) => mkRun({ distance_km: 5, avg_pace: p }));
    expect(goals(fast).has("podium")).toBe(true);
    expect(goals(mixed).has("podium")).toBe(false);
  });

  it("la top-5 personale scatta con una corsa lunga più veloce delle prime cinque", () => {
    const base = ["4:40", "4:45", "4:50", "4:55", "5:00"]
      .map((p) => mkRun({ distance_km: 10, avg_pace: p }));
    expect(withNew(base, [mkRun({ distance_km: 10, avg_pace: "4:58" })]).has("rank-up")).toBe(true);
    expect(withNew(base, [mkRun({ distance_km: 10, avg_pace: "5:10" })]).has("rank-up")).toBe(false);
  });
});
