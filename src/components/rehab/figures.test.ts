import { describe, it, expect } from "vitest";
import { EXERCISES } from "../../data/shinRehab";
import {
  EXERCISE_FIGURES, FRAME_H, FRAME_W, GROUND, framePoints, person, vec, zoomFrame,
} from "./figures";

describe("le figure degli esercizi", () => {
  it("ogni esercizio del programma ha la sua figura, e nessuna figura è orfana", () => {
    const ids = EXERCISES.map((e) => e.id).sort();
    expect(Object.keys(EXERCISE_FIGURES).sort()).toEqual(ids);
  });

  it("una o due pose per esercizio, ognuna con la sua didascalia", () => {
    for (const [id, build] of Object.entries(EXERCISE_FIGURES)) {
      const frames = build();
      expect(frames.length, id).toBeGreaterThanOrEqual(1);
      expect(frames.length, id).toBeLessThanOrEqual(2);
      for (const f of frames) {
        expect(f.caption.length, id).toBeGreaterThan(3);
        expect(f.chains.length, id).toBeGreaterThan(0);
      }
    }
  });

  it("tutto ciò che si disegna sta nel riquadro: niente teste tagliate", () => {
    const pad = 1;
    for (const [id, build] of Object.entries(EXERCISE_FIGURES)) {
      build().forEach((f, i) => {
        for (const [x, y] of framePoints(f)) {
          expect(x, `${id} #${i} x=${x.toFixed(1)}`).toBeGreaterThanOrEqual(-pad);
          expect(x, `${id} #${i} x=${x.toFixed(1)}`).toBeLessThanOrEqual(FRAME_W + pad);
          expect(y, `${id} #${i} y=${y.toFixed(1)}`).toBeGreaterThanOrEqual(-pad);
          expect(y, `${id} #${i} y=${y.toFixed(1)}`).toBeLessThanOrEqual(FRAME_H + pad);
        }
      });
    }
  });

  it("le pose a due fotogrammi cambiano davvero: partenza e arrivo non coincidono", () => {
    for (const [id, build] of Object.entries(EXERCISE_FIGURES)) {
      const frames = build();
      if (frames.length < 2) continue;
      const sig = (i: number) => JSON.stringify(frames[i].chains.map((c) => c.pts.map((p) => p.map((n) => Math.round(n)))));
      expect(sig(0), id).not.toBe(sig(1));
    }
  });

  it("gli angoli sono assoluti: 0 in alto, 90 a destra, 180 in basso", () => {
    const up = vec(0, 10), right = vec(90, 10), down = vec(180, 10), left = vec(270, 10);
    expect(up[0]).toBeCloseTo(0); expect(up[1]).toBeCloseTo(-10);
    expect(right[0]).toBeCloseTo(10); expect(right[1]).toBeCloseTo(0);
    expect(down[0]).toBeCloseTo(0); expect(down[1]).toBeCloseTo(10);
    expect(left[0]).toBeCloseTo(-10); expect(left[1]).toBeCloseTo(0);
  });

  it("la gamba ancorata alla punta tiene la punta dove la si mette", () => {
    const f = person("t", {
      anchor: { kind: "toe", at: [80, 106] }, torso: 0, near: { thigh: 180, shin: 180, foot: 130 },
    });
    expect(f.j.toe[0]).toBeCloseTo(80);
    expect(f.j.toe[1]).toBeCloseTo(106);
    // con il tallone alzato la caviglia sta sopra la punta
    expect(f.j.ankle[1]).toBeLessThan(f.j.toe[1]);
  });

  it("ingrandire attorno a un punto del suolo non stacca la figura da terra", () => {
    const f = person("t", { anchor: { kind: "ankle", at: [60, 105] }, torso: 0, near: { thigh: 180, shin: 180, foot: 90 } }).frame;
    const z = zoomFrame(f, 1.5, [60, GROUND]);
    const low = (fr: typeof f) => Math.max(...framePoints(fr).map((p) => p[1]));
    expect(low(z) - GROUND).toBeCloseTo((low(f) - GROUND) * 1.5, 5);
  });
});
