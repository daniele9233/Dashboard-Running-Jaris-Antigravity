import { describe, it, expect } from "vitest";
import { buildLeague, decayOn, divisionOf, DIVISIONS, RATING_START, RATING_FLOOR } from "./leagueEngine";
import type { Run } from "../../types/api";

/**
 * La v2 promette una cosa sola, ma pesante: il punteggio può SCENDERE. Se una
 * seduta storta o due settimane di stop non lo abbassano, la pagina sta
 * mentendo e vale meno della v1. Qui si verifica esattamente quello.
 */

let seq = 0;
const mkRun = (over: Partial<Run> & Record<string, unknown> = {}): Run =>
  ({
    id: `r${++seq}`, date: "2026-05-04", distance_km: 10, duration_minutes: 50,
    avg_pace: "5:00", avg_hr: null, max_hr: null, avg_hr_pct: null, max_hr_pct: null,
    run_type: "easy", notes: null, location: "Rome", strava_id: null,
    avg_cadence: null, elevation_gain: 0, splits: [], polyline: null,
    start_latlng: null, plan_feedback: null, avg_vertical_oscillation: null,
    avg_vertical_ratio: null, avg_ground_contact_time: null, avg_stride_length: null,
    is_treadmill: false, name: null, temperature: 12, ...over,
  }) as unknown as Run;

const pace = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const run = (date: string, km: number, paceSec: number, over: Partial<Run> = {}) =>
  mkRun({ date, distance_km: km, duration_minutes: (km * paceSec) / 60, avg_pace: pace(paceSec), ...over });

/** N corse identiche a cadenza di 2 giorni, per costruire uno standard. */
const series = (n: number, startIso: string, km: number, paceSec: number, over: Partial<Run> = {}) => {
  const out: Run[] = [];
  const d0 = new Date(startIso + "T00:00:00Z").getTime();
  for (let i = 0; i < n; i++) {
    const d = new Date(d0 + i * 2 * 86400000).toISOString().slice(0, 10);
    out.push(run(d, km, paceSec, over));
  }
  return out;
};

describe("divisioni", () => {
  it("le bande coprono la scala senza buchi e senza sovrapposizioni", () => {
    for (let i = 1; i < DIVISIONS.length; i++) {
      expect(DIVISIONS[i].floor).toBe(DIVISIONS[i - 1].ceil);
    }
    expect(DIVISIONS[0].floor).toBe(RATING_FLOOR);
  });

  it("il sotto-grado va da III a I salendo dentro la banda", () => {
    const d = DIVISIONS[1];
    expect(divisionOf(d.floor + 1).subLabel).toContain("III");
    expect(divisionOf(d.ceil - 1).subLabel).toContain("I");
    expect(divisionOf(d.ceil - 1).subLabel).not.toContain("III");
  });

  it("un punteggio oltre l'ultima banda resta Campione, non esce dall'array", () => {
    expect(divisionOf(99999).def.id).toBe("campione");
  });
});

describe("il punteggio segue la prestazione, in entrambi i versi", () => {
  it("battere il proprio standard di soglia fa salire il rating", () => {
    // otto sedute di soglia allo stesso passo, poi una nettamente più veloce
    const base = series(8, "2026-03-02", 6, 260, { run_type: "tempo", avg_hr_pct: 88 });
    const better = run("2026-03-20", 6, 240, { run_type: "tempo", avg_hr_pct: 88 });
    const st = buildLeague([...base, better], "2026-03-20T12:00:00Z");
    const m = st.matches.find((x) => x.date === "2026-03-20")!;
    expect(m.metric).toBe("vdot");
    expect(m.delta).toBeGreaterThan(0);
    expect(st.rating).toBeGreaterThan(RATING_START);
  });

  it("una seduta sotto il proprio standard COSTA punti", () => {
    const base = series(8, "2026-03-02", 6, 240, { run_type: "tempo", avg_hr_pct: 88 });
    const worse = run("2026-03-20", 6, 275, { run_type: "tempo", avg_hr_pct: 88 });
    const st = buildLeague([...base, worse], "2026-03-20T12:00:00Z");
    const m = st.matches.find((x) => x.date === "2026-03-20")!;
    expect(m.delta).toBeLessThan(0);
    expect(m.why).toMatch(/sotto/i);
  });

  it("sulle zone aerobiche il confronto è sulla distanza, non sul VDOT", () => {
    const base = series(8, "2026-03-02", 8, 330, { avg_hr_pct: 74 });
    const longer = run("2026-03-20", 14, 330, { avg_hr_pct: 74 });
    const st = buildLeague([...base, longer], "2026-03-20T12:00:00Z");
    const m = st.matches.find((x) => x.date === "2026-03-20")!;
    expect(m.metric).toBe("km");
    expect(m.delta).toBeGreaterThan(0);
    expect(m.why).toMatch(/km/);
  });
});

describe("il tempo erode", () => {
  it("dopo il periodo di grazia ogni giorno fermo toglie punti", () => {
    const runs = series(10, "2026-03-02", 8, 330, { avg_hr_pct: 74 });
    const active = buildLeague(runs, "2026-03-21T12:00:00Z");   // ultimo run 2026-03-20
    const stale = buildLeague(runs, "2026-04-20T12:00:00Z");    // un mese dopo
    expect(stale.rating).toBeLessThan(active.rating);
    expect(stale.idleDays).toBeGreaterThan(20);
    expect(stale.decayToday).toBeGreaterThan(0);
  });

  it("il calo rallenta: uno stop lungo costa una divisione, non la scala", () => {
    expect(decayOn(3)).toBe(0);
    expect(decayOn(4)).toBe(6);
    expect(decayOn(18)).toBeCloseTo(3, 1);         // due settimane dopo, metà
    expect(decayOn(60)).toBeLessThan(1);
    // il costo totale di una pausa di due mesi resta sotto una banda di divisione
    let tot = 0;
    for (let d = 1; d <= 60; d++) tot += decayOn(d);
    expect(tot).toBeLessThan(150);
  });

  it("il calo non sfonda il pavimento della classifica", () => {
    const runs = series(6, "2026-01-05", 6, 340, { avg_hr_pct: 72 });
    const st = buildLeague(runs, "2029-01-01T12:00:00Z");
    expect(st.rating).toBeGreaterThanOrEqual(RATING_FLOOR);
  });

  it("entro i primi giorni di riposo non succede niente", () => {
    const runs = series(10, "2026-03-02", 8, 330, { avg_hr_pct: 74 });
    const d0 = buildLeague(runs, "2026-03-20T12:00:00Z");
    const d3 = buildLeague(runs, "2026-03-23T12:00:00Z");
    expect(d3.rating).toBe(d0.rating);
    expect(d3.decayToday).toBe(0);
  });
});

describe("lo standard si alza sotto di te", () => {
  it("la stessa seduta ripetuta rende sempre meno", () => {
    // dodici sedute identiche: la mediana le raggiunge e il guadagno si spegne
    const runs = series(12, "2026-03-02", 6, 250, { run_type: "tempo", avg_hr_pct: 88 });
    const st = buildLeague(runs, "2026-03-24T12:00:00Z");
    const ordered = [...st.matches].reverse();               // dalla più vecchia
    const first = ordered[2].delta, last = ordered[ordered.length - 1].delta;
    expect(Math.abs(last)).toBeLessThanOrEqual(Math.abs(first) + 1);
    expect(Math.abs(last)).toBeLessThan(6);
  });
});

describe("il peso della partita", () => {
  it("un recupero muove molto meno di una seduta di ripetute pari durata", () => {
    const runs = [
      ...series(6, "2026-03-02", 6, 250, { run_type: "tempo", avg_hr_pct: 88 }),
      ...series(6, "2026-03-03", 9, 400, { run_type: "recovery", avg_hr_pct: 65 }),
    ];
    const st = buildLeague(runs, "2026-03-16T12:00:00Z");
    const rec = st.matches.find((m) => m.zone.id === "recovery")!;
    const thr = st.matches.find((m) => m.zone.id === "threshold")!;
    expect(rec.weight).toBeLessThan(thr.weight);
  });
});

describe("le quote della prossima corsa", () => {
  it("una seduta al proprio standard non muove nulla, una sopra sì", () => {
    const runs = [
      ...series(8, "2026-03-02", 6, 250, { run_type: "tempo", avg_hr_pct: 88 }),
      ...series(8, "2026-03-03", 10, 330, { avg_hr_pct: 74 }),
    ];
    const st = buildLeague(runs, "2026-03-20T12:00:00Z");
    const par = st.odds.find((o) => o.id === "easy-par");
    const plus = st.odds.find((o) => o.id === "thr-plus");
    expect(par?.delta).toBe(0);
    expect(plus!.delta).toBeGreaterThan(0);
    // il massimo teorico non è mai inferiore a quello che la riga promette
    for (const o of st.odds) expect(Math.abs(o.delta)).toBeLessThanOrEqual(o.deltaMax);
  });
});

describe("robustezza", () => {
  it("con meno di quattro corse non entra in classifica invece di inventare", () => {
    expect(buildLeague([run("2026-03-02", 8, 330)]).ok).toBe(false);
  });

  it("i tapis roulant non sporcano lo standard di qualità", () => {
    const runs = [
      ...series(8, "2026-03-02", 6, 250, { run_type: "tempo", avg_hr_pct: 88 }),
      run("2026-03-19", 6, 200, { run_type: "tempo", avg_hr_pct: 88, is_treadmill: true }),
    ];
    const st = buildLeague(runs, "2026-03-20T12:00:00Z");
    expect(st.matches.some((m) => m.date === "2026-03-19")).toBe(false);
  });

  it("la promozione ha una stima solo se il ritmo è positivo", () => {
    const runs = series(10, "2026-03-02", 8, 330, { avg_hr_pct: 74 });
    const stale = buildLeague(runs, "2026-06-01T12:00:00Z");
    expect(stale.perWeek).toBeLessThanOrEqual(0);
    expect(stale.weeksToNext).toBeNull();
  });
});
