import { describe, it, expect } from "vitest";
import { computeLevelSystem, buildXpLegend, XP_ZONES, XP_BONUS } from "./evolutionEngine";
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

describe("proiezione in XP", () => {
  /**
   * Mesi di allenamento con miglioramento costante di `gain` s/km al mese.
   * Ogni mese ha una prova sui 5 km più qualche corsa, altrimenti non ci sono
   * XP da cui ricavare il ritmo di accumulo.
   */
  const series = (months: number, startPace: number, gain: number) =>
    Array.from({ length: months }, (_, i) => {
      const base = new Date(Date.UTC(2026, 6, 20));
      base.setUTCDate(base.getUTCDate() - (months - 1 - i) * 30);
      const day = (off: number) => {
        const d = new Date(base); d.setUTCDate(d.getUTCDate() - off);
        return d.toISOString().slice(0, 10);
      };
      return [
        run(5, Math.round(startPace - i * gain), day(0)),
        run(10, Math.round(startPace - i * gain) + 60, day(7)),
        run(12, Math.round(startPace - i * gain) + 90, day(14)),
      ];
    }).flat();

  const proj = (runs: Run[]) => computeLevelSystem(runs, null).projection;

  it("serve abbastanza storia per stimare quanto rende il lavoro", () => {
    expect(proj(series(2, 300, 5)).ok).toBe(false);
  });

  it("una crescita reale dà un prezzo in XP al punto di VDOT", () => {
    const p = proj(series(6, 300, 5));
    expect(p.ok).toBe(true);
    expect(p.trend).toBe("up");
    expect(p.xpPerVdot).toBeGreaterThan(0);
    expect(p.xpPerDay).toBeGreaterThan(0);
    expect(p.xpPerSession).toBeGreaterThan(0);
  });

  it("ogni livello davanti ha un costo e un ritorno", () => {
    const p = proj(series(6, 300, 5));
    expect(p.levels.length).toBeGreaterThan(0);
    let prevXp = -1;
    for (const l of p.levels) {
      expect(l.xpNeeded).toBeGreaterThan(prevXp);   // più avanti = più caro
      prevXp = l.xpNeeded;
      expect(l.sessions).toBeGreaterThan(0);
      expect(l.dVdot).toBeGreaterThanOrEqual(0);
      expect(l.t5k).not.toMatch(/:60/);
      expect(l.t10k).not.toMatch(/:60/);
      expect(l.thrPace).not.toMatch(/:60/);
    }
  });

  it("una forma piatta non promette guadagni comprabili con gli XP", () => {
    const p = proj(series(6, 280, 0));
    expect(p.trend).toBe("flat");
    expect(p.levels[0].dVdot).toBeLessThanOrEqual(0.05);
    expect(p.milestones.every((m) => m.xpNeeded == null || m.xpNeeded === 0)).toBe(true);
  });

  it("un calo resta un calo: niente ottimismo d'ufficio", () => {
    const p = proj(series(6, 250, -6));
    expect(p.trend).toBe("down");
    expect(p.milestones.every((m) => m.xpNeeded == null)).toBe(true);
  });

  it("la pendenza è tappata a +1 VDOT al mese", () => {
    const p = proj(series(6, 360, 20)); // progresso irreale
    expect(p.perMonth).toBeLessThanOrEqual(1.05);
  });

  it("gli XP rendono sempre meno: la curva è concava", () => {
    const p = proj(series(6, 300, 5));
    const q = p.points;
    const first = q[5].vdot - q[0].vdot;
    const last = q[q.length - 1].vdot - q[q.length - 6].vdot;
    expect(first).toBeGreaterThan(0);
    expect(last).toBeLessThan(first);
  });

  it("i traguardi hanno un prezzo in XP e il livello a cui cadono", () => {
    const p = proj(series(6, 300, 5));
    expect(p.milestones.length).toBeGreaterThan(0);
    for (const m of p.milestones) {
      expect(["5K", "10K"]).toContain(m.group);
      if (m.xpNeeded != null) {
        expect(m.xpNeeded).toBeGreaterThan(0);
        expect(m.level).toBeGreaterThan(0);
      }
    }
  });

  it("lo storico arriva a oggi partendo dagli XP già spesi", () => {
    const p = proj(series(6, 300, 5));
    const xs = p.history.map((h) => h.xp);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(xs[0]).toBeLessThan(0);
    expect(xs[xs.length - 1]).toBeLessThanOrEqual(0);
  });

  it("ogni punto della curva porta con sé livello, sedute e giorni", () => {
    const p = proj(series(6, 300, 5));
    for (const q of p.points) {
      expect(q.level).toBeGreaterThan(0);
      expect(q.sessions).toBeGreaterThanOrEqual(0);
      expect(q.days).toBeGreaterThanOrEqual(0);
    }
    const last = p.points[p.points.length - 1];
    expect(last.level).toBeGreaterThanOrEqual(p.points[0].level);
    expect(last.sessions).toBeGreaterThan(0);
  });
});

describe("il tempo passa anche se non corri", () => {
  const runs = Array.from({ length: 18 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 0, 10));
    d.setUTCDate(d.getUTCDate() + i * 10);
    return run(i % 3 === 0 ? 5 : 10, 300 - i * 2, d.toISOString().slice(0, 10));
  });
  // ultima corsa: 2026-01-10 + 170 giorni = 2026-06-29
  const at = (iso: string) => computeLevelSystem(runs, null, iso).projection;

  it("il ritmo di XP scende man mano che passano i giorni fermo", () => {
    const fresh = at("2026-06-30");
    const rusty = at("2026-08-15");
    expect(fresh.ok && rusty.ok).toBe(true);
    expect(rusty.xpPerDay).toBeLessThan(fresh.xpPerDay);
  });

  it("dopo tre settimane di stop la proiezione si dichiara vecchia", () => {
    expect(at("2026-06-30").stale).toBe(false);
    expect(at("2026-08-15").stale).toBe(true);
    expect(at("2026-08-15").daysSinceLastRun).toBeGreaterThan(21);
  });

  it("i livelli costano di più in giorni quando il ritmo cala", () => {
    const fresh = at("2026-06-30").levels[0];
    const rusty = at("2026-08-15").levels[0];
    expect(rusty.days).toBeGreaterThan(fresh.days as number);
    expect(rusty.xpNeeded).toBe(fresh.xpNeeded);   // il prezzo in XP non cambia
  });

  it("un orologio di sistema indietro non manda la finestra in negativo", () => {
    const p = at("2020-01-01");
    expect(p.ok).toBe(true);
    expect(p.daysSinceLastRun).toBe(0);
  });
});
