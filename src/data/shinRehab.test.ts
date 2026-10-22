import { describe, it, expect } from "vitest";
import {
  CAUSES, EQUIPMENT, EXERCISES, PAIN_BANDS, PHASES, RED_FLAGS, RETURN_TO_RUN,
  exercisesFor, painBand, painPeak, painTrend, phaseById, upsertPain, type PainEntry,
} from "./shinRehab";

const day = (n: number) => `2026-10-${String(n).padStart(2, "0")}`;
const e = (d: number, morning: number, walking = morning, effort = morning): PainEntry =>
  ({ date: day(d), morning, walking, effort });

describe("il programma per le shin splints è completo e coerente", () => {
  it("ogni esercizio ha tutto quello che serve per farlo", () => {
    for (const ex of EXERCISES) {
      expect(ex.name.length, ex.id).toBeGreaterThan(3);
      expect(ex.steps.length, ex.id).toBeGreaterThanOrEqual(2);
      expect(ex.prescription.length, ex.id).toBeGreaterThan(3);
      expect(ex.cue.length, ex.id).toBeGreaterThan(10);
      expect(ex.phases.length, ex.id).toBeGreaterThan(0);
      expect(ex.equipment.length, ex.id).toBeGreaterThan(0);
    }
  });

  it("gli id sono unici: servono a ricordare cosa è stato fatto", () => {
    const ids = EXERCISES.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    const gates = PHASES.flatMap((p) => p.gates.map((g) => g.id));
    expect(new Set(gates).size).toBe(gates.length);
  });

  it("ogni fase ha esercizi e criteri, e ogni attrezzo ne ha almeno due", () => {
    for (const p of PHASES) {
      expect(exercisesFor(p.id).length, p.id).toBeGreaterThanOrEqual(5);
      expect(p.gates.length, p.id).toBeGreaterThanOrEqual(3);
    }
    for (const q of EQUIPMENT) {
      expect(EXERCISES.filter((x) => x.equipment.includes(q.id)).length, q.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("il filtro per attrezzo restituisce solo esercizi che lo usano", () => {
    const tutti = exercisesFor("rinforza");
    const bande = exercisesFor("rinforza", "elastico");
    expect(bande.length).toBeGreaterThan(0);
    expect(bande.length).toBeLessThan(tutti.length);
    expect(bande.every((x) => x.equipment.includes("elastico"))).toBe(true);
    expect(exercisesFor("rinforza", "tutti")).toEqual(tutti);
  });

  it("il soleo e il tibiale posteriore ci sono: sono i muscoli del bordo mediale", () => {
    const names = EXERCISES.map((x) => `${x.name} ${x.target}`.toLowerCase()).join(" | ");
    expect(names).toContain("soleo");
    expect(names).toContain("tibiale posteriore");
    expect(names).toContain("gluteo medio");
  });

  it("il ritorno alla corsa sale piano: mai meno minuti di corsa del passo prima", () => {
    expect(RETURN_TO_RUN.map((r) => r.step)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const run = RETURN_TO_RUN.map((r) => r.rounds * r.runMin);
    for (let i = 1; i < run.length; i++) expect(run[i], `passo ${i + 1}`).toBeGreaterThanOrEqual(run[i - 1]);
    // e nessun salto di più di 10 minuti totali di corsa fra un passo e l'altro
    for (let i = 1; i < run.length; i++) expect(run[i] - run[i - 1], `passo ${i + 1}`).toBeLessThanOrEqual(10);
  });

  it("gli allarmi, le cause e il semaforo ci sono tutti", () => {
    expect(RED_FLAGS.length).toBeGreaterThanOrEqual(5);
    expect(RED_FLAGS.some((f) => /frattura da stress/i.test(f.text))).toBe(true);
    expect(CAUSES.length).toBe(4);
    expect(PAIN_BANDS.map((b) => b.id)).toEqual(["verde", "giallo", "rosso"]);
    expect(phaseById("corsa").id).toBe("corsa");
  });
});

describe("il registro del dolore", () => {
  it("il semaforo taglia a 3 e a 5", () => {
    expect(painBand(0)).toBe("verde");
    expect(painBand(2)).toBe("verde");
    expect(painBand(3)).toBe("giallo");
    expect(painBand(4)).toBe("giallo");
    expect(painBand(5)).toBe("rosso");
    expect(painBand(10)).toBe("rosso");
  });

  it("un giorno si sostituisce, non si duplica, e il registro resta ordinato", () => {
    let log: PainEntry[] = [];
    log = upsertPain(log, e(3, 5));
    log = upsertPain(log, e(1, 2));
    log = upsertPain(log, e(3, 4));
    expect(log.map((x) => x.date)).toEqual([day(1), day(3)]);
    expect(log[1].morning).toBe(4);
  });

  it("i valori fuori scala o rotti vengono riportati a 0–10", () => {
    const log = upsertPain([], { date: day(1), morning: 14, walking: -3, effort: Number.NaN });
    expect(log[0]).toEqual({ date: day(1), morning: 10, walking: 0, effort: 0 });
  });

  it("il picco è il valore più alto del giorno", () => {
    expect(painPeak({ date: day(1), morning: 2, walking: 6, effort: 4 })).toBe(6);
  });

  it("la tendenza serve almeno 4 giorni e dice scende, sale o stabile", () => {
    expect(painTrend([e(1, 5), e(2, 5), e(3, 5)])).toBe("dati-pochi");
    expect(painTrend([e(1, 7), e(2, 7), e(3, 7), e(4, 3), e(5, 3), e(6, 3)])).toBe("scende");
    expect(painTrend([e(1, 2), e(2, 2), e(3, 2), e(4, 5), e(5, 5), e(6, 5)])).toBe("sale");
    expect(painTrend([e(1, 4), e(2, 4), e(3, 4), e(4, 4), e(5, 4), e(6, 4)])).toBe("stabile");
  });
});
