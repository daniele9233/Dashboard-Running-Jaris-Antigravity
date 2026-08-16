import { describe, it, expect } from "vitest";
import {
  buildPhysio, gradeFactor, heatPenaltyFrac, humanDays, monthlyClimate, runZoneMinutes,
  zoneOfRatio, SYSTEMS,
} from "./physioEngine";
import type { Run, Split } from "../../types/api";

/**
 * Il motore promette tre cose: che una corsa venga letta per quello che è
 * davvero stata (split, pendenza, temperatura), che gli adattamenti abbiano
 * tempi diversi, e che la data di un traguardo sia una data e non un auspicio.
 * Qui si verifica che le tre cose reggano, incluso il caso scomodo — allenarsi
 * al caldo deve pagare quando rinfresca.
 */

let seq = 0;
const mk = (over: Partial<Run> = {}): Run =>
  ({
    id: `r${++seq}`, date: "2026-05-04", distance_km: 10, duration_minutes: 50,
    avg_pace: "5:00", avg_hr: null, max_hr: null, avg_hr_pct: null, max_hr_pct: null,
    run_type: "easy", notes: null, location: "Rome", strava_id: null,
    avg_cadence: null, elevation_gain: 0, splits: [], polyline: null,
    start_latlng: null, plan_feedback: null, avg_vertical_oscillation: null,
    avg_vertical_ratio: null, avg_ground_contact_time: null, avg_stride_length: null,
    is_treadmill: false, name: null, temperature: 12, ...over,
  }) as unknown as Run;

/** Uno split da un chilometro esatto al passo dato. */
const split = (km: number, paceSec: number, elev = 0): Split => ({
  km, pace: `${Math.floor(paceSec / 60)}:${String(paceSec % 60).padStart(2, "0")}`,
  hr: null, cadence: null, distance: 1000, elapsed_time: paceSec, elevation_difference: elev,
});

/** Corsa con un profilo: lista di passi al km. */
const structured = (paces: number[], over: Partial<Run> = {}): Run => {
  const total = paces.reduce((s, p) => s + p, 0);
  return mk({
    distance_km: paces.length, duration_minutes: total / 60,
    avg_pace: `${Math.floor(total / paces.length / 60)}:${String(Math.round(total / paces.length) % 60).padStart(2, "0")}`,
    splits: paces.map((p, i) => split(i + 1, p)),
    ...over,
  });
};

describe("pendenza e caldo: il passo grezzo non è lo sforzo", () => {
  it("la salita vale più di quanto dice il cronometro, la discesa meno", () => {
    expect(gradeFactor(0.05)).toBeGreaterThan(1);
    expect(gradeFactor(-0.03)).toBeLessThan(1);
    expect(gradeFactor(0)).toBe(1);
  });

  it("oltre il 5% in giù la discesa smette di regalare", () => {
    // a -5% si è al massimo del vantaggio: più ripido si frena e basta
    expect(gradeFactor(-0.12)).toBeGreaterThan(gradeFactor(-0.05));
  });

  it("il caldo pesa di più sulle distanze lunghe", () => {
    expect(heatPenaltyFrac(30, null, 42)).toBeGreaterThan(heatPenaltyFrac(30, null, 5));
    expect(heatPenaltyFrac(10, null, 10)).toBe(0);
    expect(heatPenaltyFrac(null, null, 10)).toBe(0);
  });

  it("l'umidità conta solo quando fa già caldo", () => {
    expect(heatPenaltyFrac(28, 90, 10)).toBeGreaterThan(heatPenaltyFrac(28, 40, 10));
    expect(heatPenaltyFrac(15, 90, 10)).toBe(heatPenaltyFrac(15, 40, 10));
  });
});

describe("la corsa si legge chilometro per chilometro", () => {
  const THR = 250;   // passo di soglia di riferimento, sec/km

  it("le zone si contano sui rapporti col passo di soglia", () => {
    expect(zoneOfRatio(0.9)).toBe("vo2");
    expect(zoneOfRatio(1.0)).toBe("threshold");
    expect(zoneOfRatio(1.08)).toBe("medium");
    expect(zoneOfRatio(1.2)).toBe("easy");
    expect(zoneOfRatio(1.5)).toBe("recovery");
  });

  it("una seduta a intervalli non è il suo passo medio", () => {
    // 3 km scaldamento + 4 km a ritmo ripetute + 3 defaticamento: la media è
    // un lento qualsiasi, ma dentro ci sono quattro chilometri veri
    const run = structured([330, 330, 330, 235, 235, 235, 235, 340, 340, 340]);
    const zm = runZoneMinutes(run, THR);
    expect(zm.vo2).toBeGreaterThan(14);
    expect(zm.easy + zm.recovery).toBeGreaterThan(25);
    // la lettura col solo passo medio classificherebbe tutto come lento
    const flat = runZoneMinutes(mk({ ...run, splits: [] } as Partial<Run>), THR);
    expect(flat.vo2).toBe(0);
  });

  it("nessuna corsa sparisce: senza split conta comunque il passo medio", () => {
    const zm = runZoneMinutes(mk({ splits: [], distance_km: 10, duration_minutes: 55, avg_pace: "5:30" }), THR);
    const total = Object.values(zm).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(55, 5);
  });

  it("gli split-frammento di fine corsa non fingono una ripetuta", () => {
    const run = mk({
      distance_km: 5.08, duration_minutes: 27, avg_pace: "5:19",
      splits: [
        split(1, 320), split(2, 320), split(3, 320), split(4, 320), split(5, 320),
        { km: 6, pace: "3:00", hr: null, cadence: null, distance: 80, elapsed_time: 14, elevation_difference: 0 },
      ],
    });
    expect(runZoneMinutes(run, THR).vo2).toBe(0);
  });

  it("lo stesso passo in salita conta come lavoro più duro", () => {
    const piano = structured([280, 280, 280, 280]);
    const salita = mk({
      ...structured([280, 280, 280, 280]),
      splits: [split(1, 280, 40), split(2, 280, 40), split(3, 280, 40), split(4, 280, 40)],
    } as Partial<Run>);
    const zPiano = runZoneMinutes(piano, THR);
    const zSalita = runZoneMinutes(salita, THR);
    // il 4% di pendenza sposta gli stessi minuti in una zona più dura
    expect(zSalita.threshold + zSalita.vo2).toBeGreaterThan(zPiano.threshold + zPiano.vo2);
  });

  it("lo stesso passo a 30 °C conta più che a 10 °C", () => {
    const fresco = structured([270, 270, 270, 270, 270], { temperature: 10 });
    const caldo = structured([270, 270, 270, 270, 270], { temperature: 32, humidity: 70 });
    const zf = runZoneMinutes(fresco, THR);
    const zc = runZoneMinutes(caldo, THR);
    expect(zc.threshold + zc.vo2).toBeGreaterThan(zf.threshold + zf.vo2);
  });
});

// ── una stagione di allenamento, costruita a tavolino ────────────────────────
/**
 * `weeks` settimane fino a `endIso`, con una seduta di qualità, un lungo e due
 * lenti a settimana. `temp` decide il clima di tutto il blocco.
 */
const season = (weeks: number, endIso: string, opt: { temp?: number; quality?: boolean; humidity?: number } = {}) => {
  const end = Math.floor(new Date(endIso + "T00:00:00Z").getTime() / 86400000);
  const temp = opt.temp ?? 12;
  const runs: Run[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const monday = end - w * 7;
    const iso = (off: number) => new Date((monday + off) * 86400000).toISOString().slice(0, 10);
    if (opt.quality !== false) {
      runs.push(structured([330, 330, 240, 240, 240, 240, 340, 340], { date: iso(-6), temperature: temp, humidity: opt.humidity }));
    } else {
      runs.push(structured([330, 330, 330, 330, 330, 330, 330, 330], { date: iso(-6), temperature: temp, humidity: opt.humidity }));
    }
    runs.push(structured(Array(10).fill(340), { date: iso(-4), temperature: temp, humidity: opt.humidity }));
    runs.push(structured(Array(8).fill(345), { date: iso(-2), temperature: temp, humidity: opt.humidity }));
    runs.push(structured(Array(18).fill(350), { date: iso(0), temperature: temp, humidity: opt.humidity }));
  }
  return runs;
};

describe("i sistemi hanno tempi diversi", () => {
  const TODAY = "2026-11-15";

  it("serve un minimo di storia prima di dire qualcosa", () => {
    expect(buildPhysio([mk(), mk(), mk()], TODAY, 50).ok).toBe(false);
  });

  it("un blocco di allenamento riempie tutti i serbatoi", () => {
    const p = buildPhysio(season(16, TODAY), TODAY, 50);
    expect(p.ok).toBe(true);
    for (const s of p.systems) {
      if (s.def.id === "caldo") continue;    // blocco al fresco: giusto che resti basso
      expect(s.pct, s.def.name).toBeGreaterThan(0);
    }
  });

  it("la potenza aerobica sale prima del motore aerobico", () => {
    // stesso allenamento, ma letto dopo 4 settimane invece che dopo 16:
    // il sistema veloce è già quasi a regime, quello lento è indietro
    const short = buildPhysio(season(5, TODAY), TODAY, 50);
    const long = buildPhysio(season(20, TODAY), TODAY, 50);
    const gapVo2 = long.byId.vo2.pct - short.byId.vo2.pct;
    const gapMito = long.byId.mito.pct - short.byId.mito.pct;
    expect(gapMito).toBeGreaterThan(gapVo2);
  });

  it("smettere svuota prima le ripetute e poi il fondo", () => {
    const trained = buildPhysio(season(20, "2026-08-01"), "2026-08-01", 50);
    const rusty = buildPhysio(season(20, "2026-08-01"), "2026-09-20", 50);
    const lostVo2 = trained.byId.vo2.pct - rusty.byId.vo2.pct;
    const lostMito = trained.byId.mito.pct - rusty.byId.mito.pct;
    expect(lostVo2).toBeGreaterThan(lostMito);
  });

  it("senza qualità la soglia resta indietro e il motore no", () => {
    const solo = buildPhysio(season(16, TODAY, { quality: false }), TODAY, 50);
    const misto = buildPhysio(season(16, TODAY), TODAY, 50);
    expect(solo.byId.soglia.pct).toBeLessThan(misto.byId.soglia.pct);
    expect(solo.byId.mito.pct).toBeGreaterThan(0);
  });

  it("chi corre solo piano ha i sistemi di qualità a terra", () => {
    const p = buildPhysio(season(16, TODAY, { quality: false }), TODAY, 50);
    expect(p.byId.vo2.pct).toBe(0);
    expect(p.byId.mito.pct).toBeGreaterThan(p.byId.soglia.pct);
    expect(p.strongest!.def.id).toBe("mito");
  });

  it("il sistema che frena è sempre uno con margine vero", () => {
    for (const runs of [season(16, TODAY), season(16, TODAY, { quality: false })]) {
      const p = buildPhysio(runs, TODAY, 50);
      expect(p.limiter).not.toBeNull();
      expect(p.limiter!.pct).toBeLessThan(100);
    }
  });
});

describe("il caldo: penalità oggi, credito quando rinfresca", () => {
  const TODAY = "2026-09-10";

  it("allenarsi al caldo costruisce l'adattamento, al fresco no", () => {
    const estate = buildPhysio(season(14, TODAY, { temp: 31, humidity: 65 }), TODAY, 50);
    const fresco = buildPhysio(season(14, TODAY, { temp: 10 }), TODAY, 50);
    expect(estate.byId.caldo.pct).toBeGreaterThan(fresco.byId.caldo.pct + 20);
  });

  it("l'adattamento costruito d'estate si spende in inverno", () => {
    const estate = buildPhysio(season(14, TODAY, { temp: 31, humidity: 65 }), TODAY, 50);
    const fresco = buildPhysio(season(14, TODAY, { temp: 10 }), TODAY, 50);
    expect(estate.heatCreditCool).toBeGreaterThan(fresco.heatCreditCool);
  });

  it("d'estate il cronometro è più lento del motore", () => {
    const p = buildPhysio(season(14, "2026-07-25", { temp: 30, humidity: 60 }), "2026-07-25", 50);
    expect(p.vdotToday).toBeLessThan(p.vdot);
    expect(p.heatCost5kNow).toBeGreaterThan(0);
  });

  it("il clima si legge dalle sue corse, non da una tabella", () => {
    const runs = [
      ...season(4, "2026-01-25", { temp: 4 }),
      ...season(4, "2026-07-25", { temp: 29 }),
    ];
    const c = monthlyClimate(runs);
    expect(c[0]).toBeLessThan(8);      // il suo gennaio è più freddo della media
    expect(c[6]).toBeGreaterThan(27);  // e il suo luglio più caldo
    expect(c[3]).toBe(14);             // aprile: nessuna corsa, resta la normale
  });
});

describe("il VDOT resta ancorato al resto dell'app", () => {
  const TODAY = "2026-11-15";

  it("quando c'è l'ancora del backend, è quello il numero", () => {
    expect(buildPhysio(season(16, TODAY), TODAY, 52.4).vdot).toBeCloseTo(52.4, 1);
    expect(buildPhysio(season(16, TODAY), TODAY, 45).vdot).toBeCloseTo(45, 1);
  });

  it("senza ancora si stima dalle sue corse e non spara numeri", () => {
    const p = buildPhysio(season(16, TODAY), TODAY, null);
    expect(p.anchored).toBe(false);
    expect(p.vdot).toBeGreaterThan(25);
    expect(p.vdot).toBeLessThan(80);
  });
});

describe("quando arrivo lì", () => {
  const TODAY = "2026-11-15";
  const p = buildPhysio(season(20, TODAY), TODAY, 48);

  it("ogni traguardo ha una data o un motivo per non averla", () => {
    expect(p.goals.length).toBeGreaterThan(0);
    for (const g of p.goals) {
      expect(g.done || g.iso != null || g.blocker != null).toBe(true);
      if (g.iso) {
        expect(g.days).toBeGreaterThan(0);
        expect(g.human).toMatch(/giorni|settimane|mesi|anni|domani/);
        expect(g.iso >= TODAY).toBe(true);
      }
    }
  });

  it("i traguardi più duri cadono dopo quelli facili", () => {
    const dated = p.goals.filter((g) => g.days != null && g.group === "5K");
    for (let i = 1; i < dated.length; i++) {
      expect(dated[i].days!).toBeGreaterThanOrEqual(dated[i - 1].days!);
    }
  });

  it("un traguardo già alla portata non promette il futuro", () => {
    const done = p.goals.filter((g) => g.done);
    for (const g of done) expect(g.iso).toBeNull();
  });

  it("la data tiene conto del mese in cui cade", () => {
    const dated = p.goals.find((g) => g.iso != null && !g.done);
    if (dated) expect(dated.etaTempC).not.toBeNull();
  });

  it("allenarsi di più avvicina la data", () => {
    const poco = buildPhysio(season(20, TODAY, { quality: false }), TODAY, 48);
    const tanto = buildPhysio(season(20, TODAY), TODAY, 48);
    const id = "10k-45";
    const a = poco.goals.find((g) => g.id === id);
    const b = tanto.goals.find((g) => g.id === id);
    if (a && b && a.days != null && b.days != null) expect(b.days).toBeLessThanOrEqual(a.days);
  });

  it("la previsione rallenta invece di salire per sempre", () => {
    const f = p.forecast;
    expect(f.in30).toBeGreaterThanOrEqual(p.vdot - 0.2);
    expect(f.in90 - f.in30).toBeGreaterThanOrEqual(0);
    // secondo trimestre meno redditizio del primo: la curva è concava
    expect(f.in180 - f.in90).toBeLessThanOrEqual(f.in90 - f.in30 + 0.01);
    expect(f.perMonth).toBeLessThanOrEqual(1.01);
  });

  it("i tempi previsti ondeggiano con le stagioni, non solo con la forma", () => {
    const secs = p.forecast.points.map((q) => q.sec5k);
    expect(secs.length).toBeGreaterThan(10);
    // se contasse solo la forma la serie sarebbe monotona: il clima la increspa
    expect(secs.some((s, i) => i > 0 && s > secs[i - 1])).toBe(true);
  });

  it("le frasi di durata parlano italiano", () => {
    expect(humanDays(1)).toBe("domani");
    expect(humanDays(9)).toBe("fra 9 giorni");
    expect(humanDays(21)).toBe("fra 3 settimane");
    expect(humanDays(120)).toBe("fra 4 mesi");
    expect(humanDays(760)).toMatch(/anni/);
  });
});

describe("ogni corsa ha un peso", () => {
  const TODAY = "2026-11-15";
  const p = buildPhysio(season(12, TODAY), TODAY, 48);

  it("nessuna seduta produce il vuoto", () => {
    expect(p.impacts.length).toBeGreaterThan(0);
    for (const i of p.impacts) {
      const tot = Object.values(i.gain).reduce((s, v) => s + v, 0);
      expect(tot, i.date).toBeGreaterThan(0);
      expect(i.what.length).toBeGreaterThan(10);
    }
  });

  it("una seduta di qualità e un lungo costruiscono cose diverse", () => {
    const q = p.impacts.find((i) => i.zm.vo2 > 5);
    const l = p.impacts.find((i) => i.minutes >= 90);
    expect(q).toBeDefined();
    expect(l).toBeDefined();
    expect(q!.gain.vo2).toBeGreaterThan(l!.gain.vo2);
    expect(l!.gain.tenuta).toBeGreaterThan(q!.gain.tenuta);
  });

  it("il contributo è in punti di VDOT, la stessa unità su ogni riga", () => {
    for (const i of p.impacts) {
      expect(i.vdotGain).toBeGreaterThan(0);
      // una seduta di ripetute è quasi tutto lo stimolo settimanale del suo
      // sistema, quindi può valere parecchio quando il serbatoio è basso — ma
      // oltre il punto pieno il modello avrebbe perso il senso delle proporzioni
      expect(i.vdotGain).toBeLessThan(1);
    }
  });

  it("un lento lungo lo mette in conto al motore, non alla tenuta", () => {
    // la Tenuta ha il serbatoio più piccolo e si muove di più in percentuale:
    // ordinare per punti percentuali attribuiva a lei ogni corsa aerobica
    const easy = p.impacts.find((i) => i.zm.vo2 + i.zm.threshold < 3 && i.minutes >= 55);
    expect(easy).toBeDefined();
    expect(easy!.mainSystem!.id).toBe("mito");
    expect(easy!.what).toMatch(/motore/i);
  });

  it("il carico settimanale è quello vero, diviso per zone", () => {
    expect(p.weeklyKm).toBeGreaterThan(20);
    expect(p.weeklyMinutes).toBeGreaterThan(100);
    expect(p.weeklyZone.easy + p.weeklyZone.recovery).toBeGreaterThan(p.weeklyZone.vo2);
  });

  it("le ricette sono ordinate per quanto avvicinano il traguardo", () => {
    expect(p.prescriptions.length).toBeGreaterThan(0);
    for (const r of p.prescriptions) {
      expect(r.title).toMatch(/\d:\d{2}\/km/);
      expect(r.in8w).toBeGreaterThanOrEqual(r.nowPct);
      expect(r.detail.length).toBeGreaterThan(20);
    }
    const key = p.prescriptions.map((r) => (r.daysSaved ?? 0) * 1000 + r.vdotGain);
    expect([...key].sort((a, b) => b - a)).toEqual(key);
  });

  it("il consiglio in cima non contraddice il sistema che frena", () => {
    // la pagina diceva "ti frena il motore aerobico" e sotto "fai una soglia",
    // perché ottimizzava su un traguardo a due settimane: troppo vicino perché
    // un sistema da sei settimane di costante di tempo potesse contare
    for (const runs of [season(20, TODAY), season(20, TODAY, { quality: false })]) {
      const q = buildPhysio(runs, TODAY, 48);
      const top = q.prescriptions[0];
      const lim = q.limiter!;
      const alt = q.prescriptions.find((r) => r.system.id === lim.def.id);
      if (alt) expect(top.vdotGain).toBeGreaterThanOrEqual(alt.vdotGain - 0.01);
    }
  });

  it("aggiungere lavoro non allontana mai la data", () => {
    for (const r of p.prescriptions) {
      if (r.daysSaved != null) expect(r.daysSaved).toBeGreaterThanOrEqual(0);
    }
  });

  it("chi non fa qualità si sente dire di farne", () => {
    const solo = buildPhysio(season(16, TODAY, { quality: false }), TODAY, 48);
    const top = solo.prescriptions[0];
    expect(["soglia", "ripetute"]).toContain(top.id);
  });

  it("il livello mostrato non rimbalza a seconda di quando è caduta l'ultima seduta", () => {
    // stesso blocco letto a due giorni di distanza: la forma non cambia in 48
    // ore, e nemmeno il numero deve farlo
    const a = buildPhysio(season(16, "2026-11-15"), "2026-11-15", 48);
    const b = buildPhysio(season(16, "2026-11-15"), "2026-11-17", 48);
    for (const s of a.systems) {
      expect(Math.abs(s.pct - b.byId[s.def.id].pct), s.def.name).toBeLessThan(12);
    }
  });

  it("i sistemi dicono a che dose si stabilizzano", () => {
    for (const s of p.systems) {
      expect(s.settlesAt).toBeGreaterThanOrEqual(0);
      expect(s.settlesAt).toBeLessThanOrEqual(100);
      expect(s.weeklyFull).toBe(Math.round(SYSTEMS[s.def.id].fullDose * 7));
    }
  });
});
