import { describe, it, expect } from "vitest";
import type { FitnessFreshnessPoint } from "../types/api";
import { PLAN_DAY_BY_DATE } from "../data/mezzaOttobrePlan";
import {
  ALPHA_ATL, ALPHA_CTL, PLAN_ANCHOR, RACE_EVE_ISO, actualDaily, addDays, formOf, plannedCurve, plannedTrimp, taperReport,
} from "./taperForecast";

/** Documenti come li salva il backend, generati seguendo il piano alla lettera fino a `untilIso`. */
function docsFollowingPlan(untilIso: string, extra: Record<string, number> = {}): FitnessFreshnessPoint[] {
  const out: FitnessFreshnessPoint[] = [{ ...PLAN_ANCHOR, tsb: PLAN_ANCHOR.ctl - PLAN_ANCHOR.atl, trimp: 92 }];
  let ctl = PLAN_ANCHOR.ctl, atl = PLAN_ANCHOR.atl;
  for (let iso = addDays(PLAN_ANCHOR.date, 1); iso <= untilIso; iso = addDays(iso, 1)) {
    const load = plannedTrimp(PLAN_DAY_BY_DATE[iso]) + (extra[iso] ?? 0);
    ctl += ALPHA_CTL * (load - ctl);
    atl += ALPHA_ATL * (load - atl);
    // il backend salva solo i giorni con carico, i lunedì e oggi
    const monday = new Date(iso + "T00:00:00Z").getUTCDay() === 1;
    if (load > 0 || monday || iso === untilIso) out.push({ date: iso, ctl, atl, tsb: ctl - atl, trimp: load });
  }
  return out;
}

describe("la curva prevista dal piano", () => {
  const curve = plannedCurve();
  const at = (iso: string) => curve.find((p) => p.date === iso)!;

  it("va dal 17 settembre alla gara", () => {
    expect(curve[0].date).toBe("2026-09-17");
    expect(curve.at(-1)!.date).toBe("2026-10-18");
  });

  it("nelle settimane di carico va in rosso, alla vigilia arriva fresca", () => {
    const loading = curve.filter((p) => p.date <= "2026-10-04");
    expect(Math.min(...loading.map((p) => p.tsb))).toBeLessThan(-20);
    expect(at(RACE_EVE_ISO).tsb).toBeGreaterThan(10);
    expect(at(RACE_EVE_ISO).tsb).toBeLessThan(25);
  });

  it("nello scarico la TSB sale", () => {
    expect(at(RACE_EVE_ISO).tsb).toBeGreaterThan(at("2026-10-11").tsb);
    expect(at("2026-10-11").tsb).toBeGreaterThan(at("2026-10-04").tsb);
  });

  it("bici e forza non pesano: il backend conta solo le corse", () => {
    expect(plannedTrimp(PLAN_DAY_BY_DATE["2026-09-21"])).toBe(0);
    expect(plannedTrimp(PLAN_DAY_BY_DATE["2026-09-22"])).toBeCloseTo(64.8, 1);
  });
});

describe("la serie reale", () => {
  it("fra un documento e l'altro CTL e ATL decadono come nel backend", () => {
    const docs = [
      { date: "2026-09-13", ctl: 40, atl: 57, tsb: -17, trimp: 167 },
      { date: "2026-09-16", ctl: 42, atl: 58.7, tsb: -16.7, trimp: 92 },
    ];
    const s = actualDaily(docs, "2026-09-14", "2026-09-16");
    expect(s.map((p) => p.date)).toEqual(["2026-09-14", "2026-09-15", "2026-09-16"]);
    expect(s[0].ctl).toBeCloseTo(40 * (1 - ALPHA_CTL), 6);
    expect(s[1].atl).toBeCloseTo(57 * (1 - ALPHA_ATL) ** 2, 6);
    expect(s[2].tsb).toBeCloseTo(-16.7, 6);
  });
});

describe("il resoconto", () => {
  it("chi segue il piano è in linea e arriva fresco", () => {
    const r = taperReport(docsFollowingPlan("2026-09-24"), "2026-09-24");
    expect(r.phase).toBe("carico");
    expect(r.ctlDelta).toBeCloseTo(0, 1);
    expect(r.eve!.tsb).toBeCloseTo(r.plannedEve.tsb, 1);
    expect(r.verdict).toMatchObject({ tone: "ok", title: "In linea con il piano" });
    expect(r.baseLossPct).not.toBeNull();
  });

  it("al mattino di un lungo non ancora corso si confronta con ieri", () => {
    const r = taperReport(docsFollowingPlan("2026-09-26"), "2026-09-27");
    expect(r.compareIso).toBe("2026-09-26");
    expect(r.ctlDelta).toBeCloseTo(0, 1);
    // la proiezione conta il lungo di oggi
    expect(r.eve!.tsb).toBeCloseTo(r.plannedEve.tsb, 1);
  });

  it("chi aggiunge corse viene avvisato", () => {
    const extra = { "2026-09-19": 65, "2026-09-25": 65, "2026-09-28": 65, "2026-10-01": 65, "2026-10-02": 80 };
    const r = taperReport(docsFollowingPlan("2026-10-02", extra), "2026-10-02");
    expect(r.ctlDelta!).toBeGreaterThan(5);
    expect(r.verdict.tone).not.toBe("ok");
  });

  it("nello scarico dice se il taper funziona", () => {
    const r = taperReport(docsFollowingPlan("2026-10-14"), "2026-10-14");
    expect(r.phase).toBe("scarico");
    expect(r.verdict.tone).toBe("ok");
  });

  it("senza dati non inventa niente", () => {
    const r = taperReport(undefined, "2026-09-24");
    expect(r.today).toBeNull();
    expect(r.eve).toBeNull();
    expect(r.verdict.title).toBe("Dati in arrivo");
  });

  it("stesse soglie della card Status di Forma", () => {
    expect(formOf(15).label).toBe("Fresco");
    expect(formOf(0).label).toBe("Neutro");
    expect(formOf(-10).label).toBe("Affaticato");
    expect(formOf(-30).label).toBe("Sovraccarico");
  });
});
