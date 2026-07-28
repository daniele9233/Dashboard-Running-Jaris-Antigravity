import { describe, it, expect } from "vitest";
import { computeLevelSystem, buildProjection, buildXpLegend, XP_ZONES, XP_BONUS } from "./evolutionEngine";
import type { Run } from "../../types/api";

/**
 * Il pannello promette due cose all'atleta: che gli XP siano spiegabili e che
 * la proiezione non spari numeri. Qui si verificano entrambe — soprattutto che
 * la crescita futura resti dentro limiti fisiologici e non prometta traguardi
 * che la tendenza attuale non regge.
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

/** Corsa a un passo dato, con la durata coerente. */
const run = (km: number, paceSec: number, date = "2026-05-04") =>
  mkRun({
    date, distance_km: km, duration_minutes: (km * paceSec) / 60,
    avg_pace: `${Math.floor(paceSec / 60)}:${String(paceSec % 60).padStart(2, "0")}`,
  });

describe("XP: le zone pesano il minuto", () => {
  // riferimento a 4:00/km: tutto è relativo al miglior passo sostenuto
  const ref = () => run(5, 240, "2026-01-05");

  it("un'ora di lento vale meno di venti minuti forti più il bonus", () => {
    const easy = computeLevelSystem([ref(), run(12, 330)], null);
    const hard = computeLevelSystem([ref(), run(5, 245)], null);
    const xpEasy = easy.recent.find((r) => r.km === 12)!.xp;
    const xpHard = hard.recent.find((r) => r.km === 5)!.xp;
    expect(xpHard).toBeGreaterThan(0);
    expect(xpEasy).toBeGreaterThan(0);
    // la seduta corta e dura non è più una briciola rispetto al lento lungo
    expect(xpHard / xpEasy).toBeGreaterThan(0.7);
  });

  it("il bonus di qualità scatta solo sopra i 12 minuti", () => {
    const long = computeLevelSystem([ref(), run(4, 245)], null).recent.find((r) => r.km === 4)!.xp;
    const short = computeLevelSystem([ref(), run(1, 245)], null).recent.find((r) => r.km === 1)!.xp;
    expect(long - short).toBeGreaterThan(XP_ZONES[4].bonus);
  });

  it("una settimana da 35 km porta il bonus di costanza", () => {
    const week = [run(12, 330, "2026-03-02"), run(12, 330, "2026-03-04"), run(12, 330, "2026-03-06")];
    const light = [run(12, 330, "2026-03-02"), run(12, 330, "2026-03-04")];
    expect(computeLevelSystem(week, null).weekBonusXp).toBe(XP_BONUS.week35);
    expect(computeLevelSystem(light, null).weekBonusXp).toBe(0);
  });

  it("scarta i glitch GPS come i badge", () => {
    const junk = Array.from({ length: 20 }, () => mkRun({ distance_km: 0.01, duration_minutes: 0.07 }));
    expect(computeLevelSystem([...junk, run(10, 300)], null).stats.totalRuns).toBe(1);
  });
});

describe("leggenda XP", () => {
  const runs = [run(5, 240, "2026-01-05"), run(12, 330)];

  it("ha una riga per zona, tutte con XP positivi", () => {
    const rows = buildXpLegend(runs);
    expect(rows).toHaveLength(XP_ZONES.length);
    for (const r of rows) {
      expect(r.xp).toBeGreaterThan(0);
      expect(r.label).toMatch(/\d:\d{2}\/km/);
      expect(r.label, "passo mai arrotondato a :60").not.toMatch(/:60/);
    }
  });

  it("i passi degli esempi sono ordinati dal più veloce al più lento", () => {
    const paces = buildXpLegend(runs).map((r) => {
      const m = r.label.match(/(\d+):(\d{2})\/km/)!;
      return +m[1] * 60 + +m[2];
    });
    expect([...paces].sort((a, b) => a - b)).toEqual(paces);
  });
});

describe("proiezione", () => {
  /** Serie mensile con miglioramento costante di `gain` s/km al mese. */
  const series = (months: number, startPace: number, gain: number) =>
    Array.from({ length: months }, (_, i) => {
      const d = new Date(Date.UTC(2026, 6, 20));
      d.setUTCDate(d.getUTCDate() - (months - 1 - i) * 30);
      return run(5, Math.round(startPace - i * gain), d.toISOString().slice(0, 10));
    });

  it("serve abbastanza storia per azzardare una tendenza", () => {
    expect(buildProjection(series(2, 300, 5)).ok).toBe(false);
  });

  it("una crescita reale diventa tendenza in salita", () => {
    const p = buildProjection(series(6, 300, 5));
    expect(p.ok).toBe(true);
    expect(p.trend).toBe("up");
    expect(p.perMonth).toBeGreaterThan(0);
  });

  it("una forma piatta non promette miglioramenti", () => {
    const p = buildProjection(series(6, 280, 0));
    expect(p.trend).toBe("flat");
    expect(p.horizons[0].t5k).toBe(p.horizons[2].t5k);
    expect(p.milestones.every((m) => m.days == null || m.days === 0)).toBe(true);
  });

  it("un calo resta un calo: niente ottimismo d'ufficio", () => {
    const p = buildProjection(series(6, 250, -6));
    expect(p.trend).toBe("down");
    expect(p.milestones.every((m) => m.days == null)).toBe(true);
  });

  it("la pendenza è tappata a +1 VDOT al mese", () => {
    const p = buildProjection(series(6, 360, 20)); // progresso irreale
    expect(p.perMonth).toBeLessThanOrEqual(1.05);
  });

  it("i guadagni si appiattiscono: 90 giorni non valgono tre volte 30", () => {
    const p = buildProjection(series(6, 300, 5));
    const g30 = p.horizons[0].vdot - p.vdotNow;
    const g90 = p.horizons[2].vdot - p.vdotNow;
    expect(g90).toBeGreaterThan(g30);
    expect(g90).toBeLessThan(g30 * 3);
  });

  it("tempi e passi non finiscono mai a :60", () => {
    const p = buildProjection(series(8, 320, 4));
    for (const h of p.horizons) {
      expect(h.t5k).not.toMatch(/:60/);
      expect(h.t10k).not.toMatch(/:60/);
      expect(h.thrPace).not.toMatch(/:60/);
    }
  });

  it("i traguardi restano su 5 e 10 km", () => {
    const p = buildProjection(series(6, 300, 5));
    expect(p.milestones.length).toBeGreaterThan(0);
    for (const m of p.milestones) expect(["5K", "10K"]).toContain(m.group);
  });

  it("lo storico è ordinato dal più vecchio a oggi", () => {
    const p = buildProjection(series(6, 300, 5));
    const days = p.history.map((h) => h.day);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
    expect(days[days.length - 1]).toBeLessThanOrEqual(0);
  });
});
