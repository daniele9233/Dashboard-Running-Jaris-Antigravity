import { describe, it, expect } from "vitest";
import {
  REFERENCE, conditionFactors, currentPlan, fastEfforts, planGoal, solvePlan,
  successProbability, whatIf, type Conditions, type Effort,
} from "./raceLabEngine";
import { ECON_TO_PACE, SHOES, nitrateGainPct, rpeMaxGainPct, shoeGainPct, shoeById } from "./shoeLab";
import { buildPhysio } from "../gamification/physioEngine";
import { predictSec, vdotFrom } from "../gamification/gamiCore";
import type { Run, Split } from "../../types/api";

/**
 * Il banco di prova promette una cosa scomoda: dire all'atleta quanto avrebbe
 * corso in condizioni che non ha avuto. Se sbaglia di poco è un giocattolo, se
 * sbaglia di molto è una bugia che orienta acquisti e strategie di gara. Qui si
 * verifica che i conti tornino nei due versi e che le grandezze restino dentro
 * quello che la letteratura misura davvero.
 */

let seq = 0;
const mk = (over: Partial<Run> = {}): Run =>
  ({
    id: `r${++seq}`, date: "2026-06-04", distance_km: 10, duration_minutes: 50,
    avg_pace: "5:00", avg_hr: null, max_hr: null, avg_hr_pct: null, max_hr_pct: null,
    run_type: "easy", notes: null, location: "Rome", strava_id: null,
    avg_cadence: null, elevation_gain: 0, splits: [], polyline: null,
    start_latlng: null, plan_feedback: null, avg_vertical_oscillation: null,
    avg_vertical_ratio: null, avg_ground_contact_time: null, avg_stride_length: null,
    is_treadmill: false, name: null, temperature: 12, ...over,
  }) as unknown as Run;

const pace = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;
const run = (date: string, km: number, paceSec: number, over: Partial<Run> = {}) =>
  mk({ date, distance_km: km, duration_minutes: (km * paceSec) / 60, avg_pace: pace(paceSec), ...over });

/** Una prova già normalizzata, per i test del calcolatore. */
const effort = (over: Partial<Effort> = {}): Effort => {
  const refPace = 250;
  return {
    id: "e1", date: "2026-06-04", name: "5K", km: 5, paceSec: refPace, timeSec: refPace * 5,
    tempC: 12, humidity: 55, elevationGain: 0,
    shoeId: "flat", taper: "none", rpe: null,
    refPaceSec: refPace, refVdot: vdotFrom(5000, refPace * 5),
    ...over,
  };
};

const cond = (over: Partial<Conditions> = {}): Conditions => ({ ...REFERENCE, ...over });

describe("il catalogo delle scarpe regge alle proporzioni note", () => {
  it("le super scarpe stanno nella forbice misurata in laboratorio", () => {
    for (const s of SHOES.filter((x) => x.cls === "superRacer")) {
      expect(s.economyPct, s.name).toBeGreaterThan(3);
      expect(s.economyPct, s.name).toBeLessThan(5);
      expect(s.uncertaintyPct, s.name).toBeGreaterThan(0);
      expect(s.basis.length, s.name).toBeGreaterThan(40);
    }
  });

  it("il super trainer sta sotto le racer e sopra l'allenamento", () => {
    const sb = shoeById("superblast3")!;
    const racers = SHOES.filter((s) => s.cls === "superRacer");
    for (const r of racers) expect(sb.economyPct).toBeLessThan(r.economyPct);
    expect(sb.economyPct).toBeGreaterThan(shoeById("trainer")!.economyPct);
  });

  it("il risparmio metabolico non si spaccia per guadagno di tempo", () => {
    // il 4% del nome commerciale non vale il 4% di cronometro
    expect(ECON_TO_PACE).toBeLessThan(1);
    const g = shoeGainPct(shoeById("flat")!, shoeById("alphafly3")!, 240);
    expect(g).toBeLessThan(4);
    expect(g).toBeGreaterThan(2.5);
  });

  it("la piastra rende meno quando si corre piano", () => {
    const flat = shoeById("flat")!, af = shoeById("alphafly3")!;
    expect(shoeGainPct(flat, af, 380)).toBeLessThan(shoeGainPct(flat, af, 240));
  });

  it("i nitrati rendono meno a chi è già allenato", () => {
    expect(nitrateGainPct(45)).toBeGreaterThan(nitrateGainPct(55));
    expect(nitrateGainPct(70)).toBeLessThan(0.5);
  });
});

describe("il conto delle condizioni", () => {
  it("le condizioni di riferimento non spostano niente", () => {
    const { factor } = conditionFactors(REFERENCE, 5, 250, 50);
    expect(factor).toBeCloseTo(1, 2);
  });

  it("il caldo rallenta, il fresco no", () => {
    const caldo = conditionFactors(cond({ tempC: 30, humidity: 70 }), 10, 250, 50);
    const fresco = conditionFactors(cond({ tempC: 10 }), 10, 250, 50);
    expect(caldo.factor).toBeGreaterThan(1);
    expect(fresco.factor).toBeCloseTo(1, 2);
  });

  it("ogni voce dichiara quanto vale in secondi al chilometro", () => {
    const { factors } = conditionFactors(
      cond({ shoeId: "alphafly3", tempC: 28, humidity: 60, taper: "full", nitrate: true }), 10, 250, 50);
    for (const f of factors) {
      expect(f.label.length).toBeGreaterThan(0);
      expect(f.detail.length).toBeGreaterThan(10);
      expect(Math.abs(f.secPerKm)).toBeCloseTo(Math.abs((250 * f.gainPct) / 100), 6);
    }
    expect(factors.find((f) => f.id === "temp")!.gainPct).toBeLessThan(0);
    expect(factors.find((f) => f.id === "shoe")!.gainPct).toBeGreaterThan(0);
  });

  it("i vantaggi si compongono, non si sommano", () => {
    const solo = conditionFactors(cond({ shoeId: "alphafly3" }), 10, 250, 50).factor;
    const taperSolo = conditionFactors(cond({ taper: "full" }), 10, 250, 50).factor;
    const insieme = conditionFactors(cond({ shoeId: "alphafly3", taper: "full" }), 10, 250, 50).factor;
    // il prodotto, non la somma dei guadagni
    expect(insieme).toBeCloseTo(solo * taperSolo, 4);
    expect(insieme).toBeGreaterThan(solo * taperSolo - 0.001);
  });

  it("l'incertezza cresce quando si impilano le ipotesi", () => {
    const una = conditionFactors(cond({ shoeId: "alphafly3" }), 10, 250, 50).uncertaintyPct;
    const tante = conditionFactors(
      cond({ shoeId: "alphafly3", taper: "full", nitrate: true, surface: "track" }), 10, 250, 50).uncertaintyPct;
    expect(tante).toBeGreaterThan(una);
  });
});

describe("e se invece…", () => {
  it("le stesse condizioni della prova restituiscono la prova", () => {
    const e = effort({ shoeId: "superblast3", tempC: 25, humidity: 60, elevationGain: 40 });
    const w = whatIf(e, cond({
      shoeId: e.shoeId, taper: e.taper, tempC: e.tempC!, humidity: e.humidity,
      elevationGain: e.elevationGain,
    }), 5000);
    expect(w.deltaSec).toBeCloseTo(0, 4);
  });

  it("l'abisso fra le due giornate è quello che l'atleta si aspetta", () => {
    // stessa forma: Superblast a 28 gradi senza taper, contro Alphafly a 10
    // gradi con taper pieno e nitrati
    const e = effort({ shoeId: "superblast3", tempC: 28, humidity: 60 });
    const peggio = whatIf(e, cond({ shoeId: "superblast3", tempC: 28, humidity: 60 }), 5000);
    const meglio = whatIf(e, cond({ shoeId: "alphafly3", tempC: 10, taper: "full", nitrate: true }), 5000);
    const secPerKm = (peggio.sec - meglio.sec) / 5;
    // il grosso del divario è la temperatura (il modello del caldo è quello già
    // usato dal resto dell'app), il resto sono scarpa, taper e nitrati messi
    // insieme: sopra i 35 s/km vorrebbe dire che qualcosa si sta sommando due volte
    expect(secPerKm).toBeGreaterThan(6);
    expect(secPerKm).toBeLessThan(35);
    expect(meglio.deltaSec).toBeGreaterThan(0);
  });

  it("impilare i vantaggi non li somma: il totale resta sotto la somma delle parti", () => {
    const e = effort({ shoeId: "superblast3", tempC: 12 });
    const base = whatIf(e, cond({ shoeId: "superblast3" }), 5000).sec;
    const only = (over: Partial<Conditions>) => base - whatIf(e, cond({ shoeId: "superblast3", ...over }), 5000).sec;
    const parts = only({ shoeId: "alphafly3" }) + only({ taper: "full" }) + only({ nitrate: true });
    const together = base - whatIf(e, cond({ shoeId: "alphafly3", taper: "full", nitrate: true }), 5000).sec;
    expect(together).toBeLessThan(parts);
    expect(together).toBeGreaterThan(parts * 0.9);
  });

  it("la previsione porta con sé la sua banda di errore", () => {
    const w = whatIf(effort(), cond({ shoeId: "feidian6", taper: "full", nitrate: true }), 10000);
    expect(w.bandSec).toBeGreaterThan(0);
    expect(w.bandSec).toBeLessThan(w.sec * 0.05);
  });

  it("cambiare distanza passa dal VDOT, non da una regola del tre", () => {
    const e = effort();
    const w5 = whatIf(e, REFERENCE, 5000);
    const w10 = whatIf(e, REFERENCE, 10000);
    expect(w10.sec).toBeGreaterThan(w5.sec * 2);        // i 10 non sono due 5
    expect(w10.paceSec).toBeGreaterThan(w5.paceSec);
    expect(w5.sec).toBeCloseTo(predictSec(5000, e.refVdot), 0);
  });

  it("il dislivello costa, e il conto lo dice", () => {
    const piano = whatIf(effort(), cond({ elevationGain: 0 }), 10000);
    const collina = whatIf(effort(), cond({ elevationGain: 200 }), 10000);
    expect(collina.sec).toBeGreaterThan(piano.sec);
  });
});

describe("le prove veloci si annotano e si normalizzano", () => {
  const runs = [
    run("2026-06-01", 5, 262, { temperature: 27, humidity: 65, name: "5K estivo" }),
    run("2026-06-10", 10, 268, { temperature: 14, name: "10K fresco" }),
    run("2026-06-15", 12, 330, { name: "lento" }),          // troppo lento: fuori
    run("2026-01-05", 5, 250, { name: "vecchio" }),          // fuori finestra
    run("2026-06-20", 2, 240, { name: "troppo corto" }),     // sotto la distanza minima
  ];
  const list = fastEfforts(runs, { todayIso: "2026-06-25", defaultShoe: "superblast3" });

  it("prende solo le corse veloci, lunghe abbastanza e recenti", () => {
    expect(list.map((e) => e.name).sort()).toEqual(["10K fresco", "5K estivo"]);
  });

  it("la scarpa abituale è quella di default finché non la cambi", () => {
    for (const e of list) expect(e.shoeId).toBe("superblast3");
  });

  it("una prova al caldo vale più di quanto dica il cronometro", () => {
    const estivo = list.find((e) => e.name === "5K estivo")!;
    expect(estivo.refPaceSec).toBeLessThan(estivo.paceSec);
  });

  it("l'ordine è per valore reale, non per passo grezzo", () => {
    for (let i = 1; i < list.length; i++) {
      expect(list[i].refPaceSec).toBeGreaterThanOrEqual(list[i - 1].refPaceSec);
    }
  });

  it("una prova non massimale vale di più di quanto sia stata corsa", () => {
    const conRpe = fastEfforts(
      [run("2026-06-01", 5, 262, { temperature: 12, race_lab: { rpe: 7 } } as Partial<Run>)],
      { todayIso: "2026-06-25", defaultShoe: "flat" },
    )[0];
    const senza = fastEfforts(
      [run("2026-06-01", 5, 262, { temperature: 12 })],
      { todayIso: "2026-06-25", defaultShoe: "flat" },
    )[0];
    expect(conRpe.refPaceSec).toBeLessThan(senza.refPaceSec);
    expect(rpeMaxGainPct(7)).toBeGreaterThan(0);
    expect(rpeMaxGainPct(10)).toBe(0);
  });
});

// ── il pianificatore ─────────────────────────────────────────────────────────
const sp = (paceSec: number): Split => ({
  km: 1, pace: pace(paceSec), hr: null, cadence: null,
  distance: 1000, elapsed_time: paceSec, elevation_difference: 0,
});
const structured = (date: string, paces: number[], over: Partial<Run> = {}) => {
  const tot = paces.reduce((s, p) => s + p, 0);
  return mk({
    date, distance_km: paces.length, duration_minutes: tot / 60,
    avg_pace: pace(Math.round(tot / paces.length)),
    splits: paces.map((p) => sp(p)),
    ...over,
  });
};
const season = (weeks: number, endIso: string) => {
  const end = Math.floor(new Date(endIso + "T00:00:00Z").getTime() / 86400000);
  const out: Run[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const monday = end - w * 7;
    const iso = (off: number) => new Date((monday + off) * 86400000).toISOString().slice(0, 10);
    out.push(structured(iso(-6), [330, 330, 240, 240, 240, 240, 340, 340]));
    out.push(structured(iso(-4), Array(10).fill(340)));
    out.push(structured(iso(-2), Array(8).fill(345)));
    out.push(structured(iso(0), Array(18).fill(350)));
  }
  return out;
};

describe("quando arrivo all'obiettivo, e cosa devo fare", () => {
  const TODAY = "2026-11-15";
  const physio = buildPhysio(season(20, TODAY), TODAY, 48);
  const now = currentPlan(physio.weeklyKm, physio.weeklyZone.threshold + physio.weeklyZone.vo2, 105, 12);

  it("la probabilità è una probabilità, non una promessa", () => {
    expect(successProbability(1200, 1200, 90)).toBeCloseTo(0.5, 1);
    expect(successProbability(1150, 1200, 90)).toBeGreaterThan(0.7);
    expect(successProbability(1300, 1200, 90)).toBeLessThan(0.2);
    for (const v of [0, 1, 100, 5000]) {
      const p = successProbability(v || 1, 1200, 30);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("più lontana è la previsione, meno è certa", () => {
    expect(successProbability(1150, 1200, 400)).toBeLessThan(successProbability(1150, 1200, 30));
  });

  it("allenarsi di più anticipa la data", () => {
    const heavier = { ...now, km: now.km + 35, qualitySessions: 2, qualityMinutes: 28, longRunMinutes: 110 };
    const r = planGoal(physio.model, 10000, 2520, {
      deadlineDays: null, easyPaceSec: 340, current: now, plan: heavier,
    });
    if (r.etaNow && r.etaPlan) expect(r.etaPlan.days).toBeLessThanOrEqual(r.etaNow.days);
  });

  it("il piano suggerito è il più leggero che basta, non il più pesante possibile", () => {
    const easy = solvePlan(physio.model, 10000, 3000, 240, 340, now);   // 10K in 50', comodo
    const hard = solvePlan(physio.model, 10000, 2400, 240, 340, now);   // 10K in 40', duro
    if (easy && hard) {
      expect(hard.km + hard.qualitySessions * 10).toBeGreaterThanOrEqual(easy.km + easy.qualitySessions * 10);
    }
    if (easy) {
      expect(easy.km).toBeGreaterThanOrEqual(20);
      expect(easy.km).toBeLessThanOrEqual(140);
      expect(easy.qualitySessions).toBeGreaterThanOrEqual(1);
    }
  });

  it("la data possibile e quella affidabile sono due date diverse", () => {
    // la prima è il giorno in cui la previsione tocca il tempo: metà delle volte
    // basta. La seconda è quella su cui ha senso prenotare un pettorale
    const r = planGoal(physio.model, 5000, 1200, {
      deadlineDays: null, easyPaceSec: 340, current: now,
      plan: { ...now, km: now.km + 25, qualitySessions: 2, qualityMinutes: 26, longRunMinutes: 110 },
    });
    if (r.etaPlan && r.etaSafe) {
      expect(r.etaSafe.days).toBeGreaterThan(r.etaPlan.days);
      expect(r.probability).toBeGreaterThanOrEqual(0.79);
    }
  });

  it("senza scadenza il piano suggerito non si contraddice col verdetto", () => {
    // la prima versione diceva "arrivi il 16 settembre" e sotto "nessun carico
    // ragionevole ci arriva": chiedeva l'80% alla data che per costruzione è al 50%
    for (const target of [1200, 1260, 1320]) {
      const r = planGoal(physio.model, 5000, target, {
        deadlineDays: null, easyPaceSec: 340, current: now, plan: now,
      });
      if (r.etaSafe) expect(r.suggested, `obiettivo ${target}s`).not.toBeNull();
    }
  });

  it("un obiettivo fuori portata viene detto, non addolcito", () => {
    const r = planGoal(physio.model, 10000, 1500, {     // 10K in 25 minuti
      deadlineDays: 60, easyPaceSec: 340, current: now, plan: now,
    });
    expect(r.etaPlan).toBeNull();
    expect(r.blocker).not.toBeNull();
    expect(r.probability).toBeLessThan(0.05);
    expect(solvePlan(physio.model, 10000, 1500, 60, 340, now)).toBeNull();
  });

  it("con una data si dice anche che tempo faresti quel giorno", () => {
    const r = planGoal(physio.model, 5000, 1200, {
      deadlineDays: 120, easyPaceSec: 340, current: now, plan: now,
    });
    expect(r.atTarget).not.toBeNull();
    expect(r.atTarget!.sec).toBeGreaterThan(0);
    expect(r.gapSec).toBe(Math.round(r.atTarget!.sec - 1200));
  });
});
