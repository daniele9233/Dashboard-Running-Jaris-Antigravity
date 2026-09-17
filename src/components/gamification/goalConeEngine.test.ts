import { describe, it, expect } from "vitest";
import { buildPhysio, climateAt } from "./physioEngine";
import { buildGoalCone, coneGoals, type ConeGoal } from "./goalConeEngine";
import type { Run, Split } from "../../types/api";

/**
 * Il cono promette una cosa sola: che le tre date — possibile, alla pari,
 * probabile — vengano nell'ordine giusto e dicano la stessa cosa del resto
 * della pagina. E che non esistano scalini inventati dal calendario.
 */

let seq = 0;
const split = (km: number, paceSec: number): Split => ({
  km, pace: `${Math.floor(paceSec / 60)}:${String(paceSec % 60).padStart(2, "0")}`,
  hr: null, cadence: null, distance: 1000, elapsed_time: paceSec, elevation_difference: 0,
});
const structured = (paces: number[], date: string): Run => {
  const total = paces.reduce((s, p) => s + p, 0);
  return {
    id: `c${++seq}`, date, distance_km: paces.length, duration_minutes: total / 60,
    avg_pace: `${Math.floor(total / paces.length / 60)}:${String(Math.round(total / paces.length) % 60).padStart(2, "0")}`,
    avg_hr: null, max_hr: null, avg_hr_pct: null, max_hr_pct: null, run_type: "easy", notes: null,
    location: "Rome", strava_id: null, avg_cadence: null, elevation_gain: 0,
    splits: paces.map((p, i) => split(i + 1, p)), polyline: null, start_latlng: null, plan_feedback: null,
    avg_vertical_oscillation: null, avg_vertical_ratio: null, avg_ground_contact_time: null,
    avg_stride_length: null, is_treadmill: false, name: null, temperature: 12,
  } as unknown as Run;
};

/** Venti settimane con una qualità, due lenti e un lungo. */
const season = (weeks: number, endIso: string) => {
  const end = Math.floor(new Date(endIso + "T00:00:00Z").getTime() / 86400000);
  const runs: Run[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const iso = (off: number) => new Date((end - w * 7 + off) * 86400000).toISOString().slice(0, 10);
    runs.push(structured([330, 330, 240, 240, 240, 240, 340, 340], iso(-6)));
    runs.push(structured(Array(10).fill(340), iso(-4)));
    runs.push(structured(Array(8).fill(345), iso(-2)));
    runs.push(structured(Array(18).fill(350), iso(0)));
  }
  return runs;
};

const TODAY = "2026-09-16";
const physio = buildPhysio(season(20, TODAY), TODAY, 48);
const goal = (targetSec: number, raceIso: string | null = null): ConeGoal =>
  ({ id: "t", label: "5K", distM: 5000, targetSec, raceIso, mine: true });

describe("il clima non ha gradini", () => {
  const climate = [8, 9, 11, 14, 18, 22, 25, 25, 21, 17, 12, 9];
  const day = (iso: string) => Math.floor(new Date(iso + "T00:00:00Z").getTime() / 86400000);

  it("fra il 30 settembre e il 1° ottobre la temperatura si muove di un soffio", () => {
    expect(Math.abs(climateAt(climate, day("2026-10-01")) - climateAt(climate, day("2026-09-30")))).toBeLessThan(0.3);
  });

  it("a metà mese vale la media del mese", () => {
    expect(climateAt(climate, day("2026-07-16"))).toBeCloseTo(25, 0);
    expect(climateAt(climate, day("2026-01-16"))).toBeCloseTo(8, 0);
  });

  it("dicembre passa a gennaio senza saltare l'anno", () => {
    const a = climateAt(climate, day("2026-12-31")), b = climateAt(climate, day("2027-01-01"));
    expect(Math.abs(a - b)).toBeLessThan(0.3);
    expect(a).toBeGreaterThan(8);
    expect(a).toBeLessThan(9);
  });
});

describe("il cono del traguardo", () => {
  it("le tre date arrivano in ordine: possibile, alla pari, probabile", () => {
    // l'obiettivo sta un secondo sopra il meglio previsto: la data alla pari
    // esiste per costruzione, e deve venire dopo quella possibile
    const probe = buildGoalCone(physio, goal(99999))!;
    const best = Math.min(...probe.points.slice(1).map((p) => p.sec));
    const c = buildGoalCone(physio, goal(Math.ceil(best) + 1))!;
    expect(c.even).not.toBeNull();
    expect(c.possible).not.toBeNull();
    expect(c.possible!.days).toBeLessThanOrEqual(c.even!.days);
    if (c.likely) expect(c.even!.days).toBeLessThanOrEqual(c.likely.days);
  });

  it("con un obiettivo largo tutte e tre le date esistono e sono ordinate", () => {
    const today = buildGoalCone(physio, goal(99999))!.todaySec;
    const c = buildGoalCone(physio, goal(Math.round(today + 45)))!;
    expect(c.possible && c.even && c.likely).toBeTruthy();
    expect(c.possible!.days).toBeLessThanOrEqual(c.even!.days);
    expect(c.even!.days).toBeLessThanOrEqual(c.likely!.days);
  });

  it("la forchetta contiene la previsione e si allarga col tempo", () => {
    const c = buildGoalCone(physio, goal(1200))!;
    for (const p of c.points) {
      expect(p.lo).toBeLessThan(p.sec);
      expect(p.hi).toBeGreaterThan(p.sec);
    }
    const first = c.points[1], last = c.points[c.points.length - 1];
    expect((last.hi - last.lo) / last.sec).toBeGreaterThan((first.hi - first.lo) / first.sec);
  });

  it("un obiettivo già battuto oggi non aspetta nessuna data", () => {
    const c = buildGoalCone(physio, goal(99999))!;
    expect(c.gapSec).toBeLessThan(0);
    expect(c.todayP).toBeGreaterThan(0.5);
  });

  it("un obiettivo fuori portata non ha data alla pari, e non ne inventa una", () => {
    const c = buildGoalCone(physio, goal(900))!;
    expect(c.even).toBeNull();
    expect(c.likely).toBeNull();
  });

  it("il giorno di gara porta tempo e probabilità, e sta dentro il grafico", () => {
    const c = buildGoalCone(physio, goal(1200, "2026-12-20"))!;
    expect(c.race).not.toBeNull();
    expect(c.race!.iso).toBe("2026-12-20");
    expect(c.race!.p).toBeGreaterThanOrEqual(0);
    expect(c.race!.p).toBeLessThanOrEqual(1);
    expect(c.horizon).toBeGreaterThanOrEqual(c.race!.days);
  });

  it("una gara già passata non si disegna", () => {
    expect(buildGoalCone(physio, goal(1200, "2026-08-01"))!.race).toBeNull();
  });

  it("la ricetta proposta anticipa davvero la data, altrimenti non compare", () => {
    const today = buildGoalCone(physio, goal(99999))!.todaySec;
    const c = buildGoalCone(physio, goal(Math.round(today - 20)))!;
    if (c.boost && c.even && c.boost.even) expect(c.boost.even.days).toBeLessThan(c.even.days);
    if (c.boost) expect(c.boost.points).toHaveLength(c.points.length);
  });

  it("gli obiettivi del piano vengono per primi e non si ripetono fra quelli della lista", () => {
    const list = coneGoals(physio, [
      { label: "Test 5 km in 20:00", distM: 5000, targetSec: 1200, raceIso: "2026-10-10" },
      { label: "Mezza a 4:47/km", distM: 21097.5, targetSec: 6055, raceIso: "2026-10-18" },
    ]);
    expect(list[0].mine && list[1].mine).toBe(true);
    expect(list[1].distM).toBe(21097.5);
    expect(list.filter((g) => g.distM === 5000 && g.targetSec === 1200)).toHaveLength(1);
  });
});
