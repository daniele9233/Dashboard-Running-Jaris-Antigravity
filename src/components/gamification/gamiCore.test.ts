import { describe, it, expect } from "vitest";
import { daySessions, zoneOf, median, weekStart, dayIndex } from "./gamiCore";
import type { Run } from "../../types/api";

/**
 * Strava consegna una seduta come TRE attività: riscaldamento, blocco di lavoro,
 * defaticamento. Prese una per una, sui dati veri di questa app producevano
 * righe come "1,1 km · 2 km sotto il tuo lento abituale, −7 in classifica": lo
 * standard dell'atleta veniva costruito su frammenti che sedute non sono.
 *
 * Qui si verifica la regola che le tre versioni condividono — volume = somma
 * del giorno, intensità = blocco più duro — perché se salta questa, saltano
 * insieme classifica, albero e momentum.
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
const part = (date: string, km: number, paceSec: number, over: Partial<Run> = {}) =>
  mkRun({ date, distance_km: km, duration_minutes: (km * paceSec) / 60, avg_pace: pace(paceSec), ...over });

describe("la seduta del giorno", () => {
  const spezzata = [
    part("2026-08-04", 1.1, 374, { name: "riscaldamento" }),   // 6:14/km
    part("2026-08-04", 4.5, 258, { name: "soglia", avg_hr_pct: 88 }),  // 4:18/km
    part("2026-08-04", 2.0, 338, { name: "defaticamento" }),   // 5:38/km
  ];

  it("somma il volume di tutte le attività del giorno", () => {
    const [s] = daySessions(spezzata);
    expect(s.km).toBeCloseTo(7.6, 1);
    expect(s.minutes).toBeCloseTo(1.1 * 374 / 60 + 4.5 * 258 / 60 + 2 * 338 / 60, 1);
  });

  it("prende l'intensità dal blocco più veloce, non dalla media annacquata", () => {
    const [s] = daySessions(spezzata);
    expect(s.hardest.name).toBe("soglia");
    expect(s.zone.id).toBe("threshold");
    // il passo medio dell'intera seduta è ben più lento del blocco di lavoro
    expect(s.paceSec!).toBeGreaterThan(258);
  });

  it("una sola attività resta se stessa", () => {
    const [s] = daySessions([part("2026-08-04", 10, 330)]);
    expect(s.km).toBe(10);
    expect(s.parts).toHaveLength(1);
  });

  it("un giorno per riga: tre attività non sono tre sedute", () => {
    expect(daySessions(spezzata)).toHaveLength(1);
  });

  it("ignora i blocchi troppo corti quando sceglie l'intensità", () => {
    // 300 m sprint velocissimi non trasformano un lento in una seduta di ripetute
    const s = daySessions([
      part("2026-08-04", 12, 330, { name: "lento" }),
      part("2026-08-04", 0.6, 180, { name: "allungo" }),
    ])[0];
    expect(s.hardest.name).toBe("lento");
  });

  it("scarta i giorni che non arrivano al chilometro: sono prove GPS", () => {
    expect(daySessions([part("2026-08-04", 0.6, 400)])).toHaveLength(0);
  });

  it("ordina dalla più vecchia alla più recente", () => {
    const out = daySessions([part("2026-08-04", 8, 330), part("2026-07-01", 8, 330)]);
    expect(out.map((s) => s.date)).toEqual(["2026-07-01", "2026-08-04"]);
  });

  it("una gara in una qualsiasi delle attività marca la seduta", () => {
    const out = daySessions([part("2026-08-04", 2, 380), part("2026-08-04", 10, 250, { event: "Corri Roma" })]);
    expect(out[0].isRace).toBe(true);
  });
});

describe("zone", () => {
  it("la FC% classifica quando il tipo non dice di più", () => {
    expect(zoneOf(mkRun({ run_type: "easy", avg_hr_pct: 65 }), 240).id).toBe("easy");
    expect(zoneOf(mkRun({ run_type: "recovery", avg_hr_pct: 65 }), 240).id).toBe("recovery");
    expect(zoneOf(mkRun({ run_type: "easy", avg_hr_pct: 93 }), 240).id).toBe("vo2");
  });

  it("senza FC il passo è relativo al proprio migliore", () => {
    expect(zoneOf(mkRun({ run_type: "", avg_pace: "4:05" }), 240).id).toBe("vo2");
    expect(zoneOf(mkRun({ run_type: "", avg_pace: "6:30" }), 240).id).toBe("recovery");
  });

  it("una gara è sempre trattata come massimale", () => {
    expect(zoneOf(mkRun({ run_type: "race", avg_hr_pct: 60 }), 240).id).toBe("vo2");
  });

  /**
   * Il caso reale che ha motivato la regola: le sedute di soglia di questo
   * atleta girano all'83% della massima. Con la sola FC finivano in "medio" e
   * il ramo qualità restava a zero per sempre.
   */
  it("una soglia all'83% resta una soglia, non diventa un medio", () => {
    expect(zoneOf(mkRun({ run_type: "threshold", avg_hr_pct: 83, avg_pace: "4:18" }), 240).id).toBe("threshold");
    expect(zoneOf(mkRun({ run_type: "intervals", avg_hr_pct: 83, avg_pace: "4:40" }), 240).id).toBe("vo2");
  });

  it("un lento col cardio alto per il caldo non viene declassato dal tipo", () => {
    expect(zoneOf(mkRun({ run_type: "easy", avg_hr_pct: 90 }), 240).id).toBe("threshold");
  });
});

describe("utilità", () => {
  it("la mediana regge un valore storto meglio della media", () => {
    expect(median([5, 5, 5, 5, 500])).toBe(5);
    expect(median([])).toBeNull();
  });

  it("la settimana comincia di lunedì", () => {
    // 2026-08-04 è un martedì → lunedì 2026-08-03
    expect(weekStart(dayIndex("2026-08-04"))).toBe(dayIndex("2026-08-03"));
    expect(weekStart(dayIndex("2026-08-09"))).toBe(dayIndex("2026-08-03")); // domenica
  });
});
