import { describe, it, expect } from "vitest";
import {
  baseCost, buildWorld, distanceKm, greatCircleArc, longRunFor, rangeKm, worldStats,
  CONTINENT_DISCOUNT, MIN_COST, WONDER_DISCOUNT,
} from "./worldEngine";
import { COUNTRIES, COUNTRY_BY_ISO, TERRITORY_OF, flagOf } from "./worldData";
import type { Run } from "../../types/api";

/**
 * La conquista promette tre regole — XP, gittata, passaporti — e che ognuna sia
 * legata a una cosa vera dell'allenamento. Qui si verifica che le regole
 * mordano davvero, e che i dati del mondo non abbiano buchi.
 */

let seq = 0;
const mk = (over: Partial<Run> & Record<string, unknown> = {}): Run =>
  ({
    id: `w${++seq}`, date: "2026-06-01", distance_km: 10, duration_minutes: 55, avg_pace: "5:30",
    avg_hr: null, max_hr: null, avg_hr_pct: null, max_hr_pct: null, run_type: "easy", notes: null,
    location: "Rome", strava_id: null, avg_cadence: null, elevation_gain: 0, splits: [], polyline: null,
    start_latlng: null, plan_feedback: null, avg_vertical_oscillation: null, avg_vertical_ratio: null,
    avg_ground_contact_time: null, avg_stride_length: null, is_treadmill: false, name: null, temperature: 15, ...over,
  }) as unknown as Run;

const world = (runs: Run[], owned: string[] = [], totalXp = 50000, vdot: number | null = null) =>
  buildWorld({ runs, totalXp, owned: new Set(owned), vdot, italyRegions: { done: 0, total: 20 }, todayIso: "2026-09-16" });

describe("i dati del mondo", () => {
  it("ogni nazione ha codice unico, coordinate valide e superficie positiva", () => {
    expect(new Set(COUNTRIES.map((c) => c.iso)).size).toBe(COUNTRIES.length);
    for (const c of COUNTRIES) {
      expect(c.iso).toMatch(/^[A-Z]{2}$/);
      expect(Math.abs(c.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(c.lng)).toBeLessThanOrEqual(180);
      expect(c.areaKm2).toBeGreaterThan(0);
    }
    expect(COUNTRIES.length).toBeGreaterThan(190);
  });

  it("i territori puntano a nazioni che esistono", () => {
    for (const owner of Object.values(TERRITORY_OF)) expect(COUNTRY_BY_ISO[owner]).toBeDefined();
  });

  it("le bandiere sono lettere-regione", () => {
    expect(flagOf("IT")).toBe("🇮🇹");
    expect(flagOf("FR")).toBe("🇫🇷");
  });
});

describe("la geografia", () => {
  it("Roma-Parigi è circa 1.100 km", () => {
    expect(distanceKm(COUNTRY_BY_ISO.IT, COUNTRY_BY_ISO.FR)).toBeGreaterThan(1050);
    expect(distanceKm(COUNTRY_BY_ISO.IT, COUNTRY_BY_ISO.FR)).toBeLessThan(1150);
  });

  it("una rotta sul Pacifico non fa il giro del mondo al contrario", () => {
    const arc = greatCircleArc(COUNTRY_BY_ISO.JP, COUNTRY_BY_ISO.US);
    for (let i = 1; i < arc.length; i++) expect(Math.abs(arc[i][0] - arc[i - 1][0])).toBeLessThan(30);
  });
});

describe("la gittata la decide il lungo", () => {
  it("più lungo è il lungo, più lontano arrivi", () => {
    expect(rangeKm(30)).toBeGreaterThan(rangeKm(20));
    expect(rangeKm(longRunFor(3000))).toBeGreaterThanOrEqual(3000);
  });

  it("da Roma con un lungo da 10 km il Giappone è fuori portata, la Francia no", () => {
    const w = world([mk({ distance_km: 10 })]);
    expect(w.byIso.FR.status).not.toBe("range");
    expect(w.byIso.JP.status).toBe("range");
    expect(w.byIso.JP.longRunNeeded).toBeGreaterThan(10);
  });
});

describe("i passaporti si corrono", () => {
  it("senza corse al freddo la Russia resta chiusa, anche se c'è la gittata", () => {
    const long = mk({ distance_km: 30, duration_minutes: 170 });
    const w = world([long], ["PL", "BY", "UA", "LT", "LV", "EE"]);
    expect(w.passports.g.unlocked).toBe(false);
    expect(w.byIso.RU.status).toBe("passport");
  });

  it("cinque uscite sotto i 4 gradi aprono il gelo", () => {
    const cold = Array.from({ length: 5 }, (_, i) => mk({ date: `2026-01-1${i}`, temperature: 2 }));
    const w = world([mk({ distance_km: 30, duration_minutes: 170 }), ...cold], ["PL", "BY", "UA", "LT", "LV", "EE"]);
    expect(w.passports.g.unlocked).toBe(true);
    expect(w.byIso.RU.status).not.toBe("passport");
  });

  it("il tapis roulant non vale per il caldo e il freddo", () => {
    const indoor = Array.from({ length: 12 }, (_, i) => mk({ date: `2026-07-1${i % 10}`, temperature: 33, is_treadmill: true }));
    expect(worldStats(indoor, "2026-09-16").hotRuns).toBe(0);
  });

  it("l'Everest di dislivello si conta sugli ultimi dodici mesi", () => {
    const old = mk({ date: "2025-01-10", elevation_gain: 9000 });
    const recent = mk({ date: "2026-08-10", elevation_gain: 500 });
    expect(worldStats([old, recent], "2026-09-16").climb365).toBe(500);
  });
});

describe("gli XP sono l'esercito", () => {
  it("una nazione grande costa più di una piccola, e nessuna costa meno del minimo", () => {
    expect(baseCost(COUNTRY_BY_ISO.FR)).toBeGreaterThan(baseCost(COUNTRY_BY_ISO.SI));
    expect(baseCost(COUNTRY_BY_ISO.VA)).toBeGreaterThanOrEqual(MIN_COST);
  });

  it("un atollo lontano non costa come San Marino: la spedizione si paga", () => {
    expect(baseCost(COUNTRY_BY_ISO.TV)).toBeGreaterThan(baseCost(COUNTRY_BY_ISO.SM) * 10);
  });

  it("senza XP abbastanza la nazione è in vista ma non si prende", () => {
    const w = world([mk()], [], 100);
    expect(w.byIso.FR.status).toBe("poor");
    expect(w.byIso.FR.missingXp).toBe(w.byIso.FR.cost - 100);
  });

  it("gli XP spesi escono dal saldo, casa esclusa", () => {
    const w = world([mk()], ["FR"], 5000);
    expect(w.spentXp).toBe(w.byIso.FR.cost);
    expect(w.availableXp).toBe(5000 - w.byIso.FR.cost);
    expect(w.byIso.IT.status).toBe("home");
    expect(w.byIso.FR.status).toBe("owned");
  });

  it("il saldo non va mai sotto zero", () => {
    expect(world([mk()], ["FR", "DE", "ES"], 10).availableXp).toBe(0);
  });

  it("un codice sconosciuto nel database non rompe niente", () => {
    expect(world([mk()], ["ZZ", "umbria"], 5000).owned).toBe(1);
  });
});

describe("meraviglie e continenti rendono l'impero più forte", () => {
  it("una meraviglia vale solo con la nazione in mano e l'impresa fatta", () => {
    const longRun = mk({ distance_km: 21.2, duration_minutes: 115 });
    const without = world([longRun], [], 50000);
    const nyc = without.wonders.find((w) => w.def.id === "newyork")!;
    expect(nyc.met).toBe(true);
    expect(nyc.claimed).toBe(false);
    const withUs = world([longRun], ["US"], 50000);
    expect(withUs.wonders.find((w) => w.def.id === "newyork")!.claimed).toBe(true);
    expect(withUs.discount).toBeGreaterThanOrEqual(WONDER_DISCOUNT);
  });

  it("completare un continente abbassa tutti i prezzi, anche delle conquiste fatte", () => {
    const oceania = COUNTRIES.filter((c) => c.continent === "OC").map((c) => c.iso);
    const partial = world([mk()], oceania.slice(1), 500000);
    const full = world([mk()], oceania, 500000);
    expect(full.continents.find((c) => c.id === "OC")!.done).toBe(true);
    expect(full.discount).toBeCloseTo(partial.discount + CONTINENT_DISCOUNT, 5);
    expect(full.byIso.FR.cost).toBeLessThan(partial.byIso.FR.cost);
  });

  it("le rotte collegano ogni conquista all'impero", () => {
    const w = world([mk()], ["FR", "ES", "PT"], 50000);
    expect(w.arcs).toHaveLength(3);
  });
});
