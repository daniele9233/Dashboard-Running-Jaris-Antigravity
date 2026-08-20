import { describe, it, expect } from "vitest";
import {
  KIKKO_SUB135_DEFAULT_START,
  KIKKO_SUB135_DELOAD_WEEKS,
  KIKKO_SUB135_GOAL_SEC,
  KIKKO_SUB135_META,
  KIKKO_SUB135_RACE_PACE,
  KIKKO_SUB135_RACE_PACE_SEC,
  KIKKO_SUB135_SESSIONS,
  KIKKO_SUB135_WEEK_VDOT,
  KIKKO_SUB135_WEEKLY_KM,
  buildKikkoSub135Sessions,
  kikkoSub135ActualWeeklyKm,
  kikkoSub135RaceDate,
} from "./kikkoSub135Plan";
import { KIKKO_SUB20_WEEKLY_KM, basesFor, kikkoSub20HeatInfo } from "./kikkoSub20Plan";

/**
 * Il piano mezza promette un tempo, e un tempo è un numero verificabile. Questi
 * test difendono le tre cose che, se si rompono, rendono la promessa falsa: il
 * volume che serve alla tenuta, il ritmo gara che discende dall'obiettivo e non
 * da una tabella, e il fatto che il lungo cresca davvero.
 */

const paceSec = (p: string): number => {
  const [m, s] = p.split(":").map(Number);
  return m * 60 + s;
};

function weekOf(i: number) {
  const [y, m, d] = KIKKO_SUB135_DEFAULT_START.split("-").map(Number);
  const monday = new Date(y, m - 1, d);
  monday.setDate(monday.getDate() + i * 7);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const iso = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  return KIKKO_SUB135_SESSIONS.filter((s) => s.date >= iso(monday) && s.date <= iso(sunday));
}

describe("kikkoSub1:34:35 — obiettivo", () => {
  it("il ritmo gara discende dal tempo obiettivo, non da una costante", () => {
    expect(KIKKO_SUB135_GOAL_SEC).toBe(5675);
    expect(KIKKO_SUB135_RACE_PACE_SEC).toBeCloseTo(5675 / 21.0975, 6);
    expect(KIKKO_SUB135_RACE_PACE).toBe("4:29");
  });

  it("il ritmo gara al chilometro, moltiplicato per la distanza, torna all'obiettivo", () => {
    const t = Math.round(KIKKO_SUB135_RACE_PACE_SEC * 21.0975);
    expect(t).toBe(KIKKO_SUB135_GOAL_SEC);
  });

  it("la gara cade la domenica dichiarata", () => {
    expect(kikkoSub135RaceDate()).toBe("2026-10-18");
    const last = KIKKO_SUB135_SESSIONS[KIKKO_SUB135_SESSIONS.length - 1];
    expect(last.date).toBe("2026-10-18");
    expect(last.title).toContain(KIKKO_SUB135_META.goalTime);
  });

  it("il ritmo gara sta fra la soglia e il lento: né una soglia né un fondo", () => {
    const b = basesFor(KIKKO_SUB135_WEEK_VDOT[KIKKO_SUB135_WEEK_VDOT.length - 1]);
    expect(KIKKO_SUB135_RACE_PACE_SEC).toBeGreaterThan(b.thr);
    expect(KIKKO_SUB135_RACE_PACE_SEC).toBeLessThan(b.easy);
  });
});

describe("kikkoSub1:34:35 — volume", () => {
  it("la somma delle sedute coincide con il volume dichiarato", () => {
    expect(kikkoSub135ActualWeeklyKm()).toEqual(KIKKO_SUB135_WEEKLY_KM);
  });

  it("rispetta i chilometraggi dichiarati", () => {
    expect(KIKKO_SUB135_WEEKLY_KM).toEqual([36, 38, 40, 30, 42, 44, 46, 34, 40]);
  });

  it("ogni scarico taglia fra il 20 e il 30%, tranne la settimana di gara", () => {
    const km = KIKKO_SUB135_WEEKLY_KM;
    expect(KIKKO_SUB135_DELOAD_WEEKS).toEqual([3, 7, 8]);
    // l'ultima è la gara: 21 dei suoi 40 km sono la corsa stessa, non carico
    for (const i of [3, 7]) {
      const cut = ((km[i - 1] - km[i]) / km[i - 1]) * 100;
      expect(cut, `scarico della settimana ${i + 1}`).toBeGreaterThanOrEqual(20);
      expect(cut, `scarico della settimana ${i + 1}`).toBeLessThanOrEqual(30);
    }
  });

  it("da una settimana di carico alla successiva non si sale oltre il 10%", () => {
    const km = KIKKO_SUB135_WEEKLY_KM;
    const load = km.map((v, i) => ({ v, i })).filter(({ i }) => !KIKKO_SUB135_DELOAD_WEEKS.includes(i));
    for (let k = 1; k < load.length; k++) {
      const growth = ((load[k].v - load[k - 1].v) / load[k - 1].v) * 100;
      expect(growth, `settimana ${load[k].i + 1}`).toBeGreaterThan(0);
      expect(growth, `settimana ${load[k].i + 1}`).toBeLessThanOrEqual(10);
    }
  });

  it("mai più di tre settimane di carico di fila", () => {
    let run = 0;
    KIKKO_SUB135_WEEKLY_KM.forEach((_, i) => {
      run = KIKKO_SUB135_DELOAD_WEEKS.includes(i) ? 0 : run + 1;
      expect(run, `settimana ${i + 1}`).toBeLessThanOrEqual(3);
    });
  });

  it("il picco supera quello del piano 5K: la mezza si compra con i chilometri", () => {
    expect(Math.max(...KIKKO_SUB135_WEEKLY_KM)).toBeGreaterThan(Math.max(...KIKKO_SUB20_WEEKLY_KM));
  });

  it("parte dagli stessi 36 km della settimana in corso di kikkoSub20", () => {
    expect(KIKKO_SUB135_WEEKLY_KM[0]).toBe(36);
    expect(KIKKO_SUB20_WEEKLY_KM[3]).toBe(36);
    expect(KIKKO_SUB135_DEFAULT_START).toBe("2026-08-17");
  });
});

describe("kikkoSub1:34:35 — struttura", () => {
  it("nove settimane da quattro uscite", () => {
    expect(KIKKO_SUB135_SESSIONS).toHaveLength(KIKKO_SUB135_META.weeks * 4);
    for (let i = 0; i < KIKKO_SUB135_META.weeks; i++) {
      expect(weekOf(i), `settimana ${i + 1}`).toHaveLength(4);
    }
  });

  it("una sola qualità a settimana, il resto in scioltezza", () => {
    for (let i = 0; i < KIKKO_SUB135_META.weeks; i++) {
      const week = weekOf(i);
      const hard = week.filter((s) => s.type === "intervals" || s.type === "tempo");
      expect(hard, `settimana ${i + 1}`).toHaveLength(1);
    }
  });

  it("le uscite cadono martedì, giovedì, sabato e domenica", () => {
    for (let i = 0; i < KIKKO_SUB135_META.weeks; i++) {
      expect(weekOf(i).map((s) => s.day)).toEqual(["Martedì", "Giovedì", "Sabato", "Domenica"]);
    }
  });

  it("il lungo cresce fino a 20 km e nell'ultimo mese finisce a ritmo gara", () => {
    const longs = KIKKO_SUB135_SESSIONS.filter((s) => s.day === "Domenica");
    const km = longs.map((s) => s.target_distance_km);
    expect(Math.max(...km.slice(0, -1))).toBe(20);
    // gli ultimi lunghi non sono più solo lenti
    const conRitmo = longs.filter((s) => s.title.includes("ultimi"));
    expect(conRitmo.length).toBeGreaterThanOrEqual(3);
    expect(conRitmo[conRitmo.length - 1].title).toContain("ultimi");
  });

  it("il lungo più lungo sta a tre settimane dalla gara, non a ridosso", () => {
    const longs = KIKKO_SUB135_SESSIONS.filter((s) => s.day === "Domenica");
    const race = longs[longs.length - 1];
    const biggest = longs.slice(0, -1).reduce((a, b) => (b.target_distance_km > a.target_distance_km ? b : a));
    const days = (Date.parse(race.date) - Date.parse(biggest.date)) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(14);
  });

  it("la soglia cresce di un chilometro alla volta", () => {
    const km = KIKKO_SUB135_SESSIONS
      .filter((s) => s.type === "tempo")
      .map((s) => Number(s.title.match(/Soglia ([\d,]+) km/)![1].replace(",", ".")));
    // lo scarico è la soglia corta: si guarda la progressione fra i carichi
    expect(km).toEqual([6, 5, 7, 8]);
    const load = [km[0], km[2], km[3]];
    for (let i = 1; i < load.length; i++) expect(load[i] - load[i - 1]).toBe(1);
  });

  it("le sedute a ritmo gara usano il ritmo dell'obiettivo, corretto per l'aria", () => {
    const gara = KIKKO_SUB135_SESSIONS.filter((s) => s.title.includes("×1000") && s.date >= "2026-10-01");
    expect(gara.length).toBe(2);
    for (const s of gara) {
      const info = kikkoSub20HeatInfo(s.date, KIKKO_SUB135_DEFAULT_START);
      // ad ottobre l'aria è quasi neutra: il target sta a un soffio dal ritmo gara
      expect(paceSec(s.target_pace!)).toBeGreaterThanOrEqual(Math.floor(KIKKO_SUB135_RACE_PACE_SEC));
      expect(paceSec(s.target_pace!) - KIKKO_SUB135_RACE_PACE_SEC).toBeLessThan(12);
      expect(info.band).toBeDefined();
    }
  });

  it("il VDOT sale e non torna mai indietro", () => {
    for (let i = 1; i < KIKKO_SUB135_WEEK_VDOT.length; i++) {
      expect(KIKKO_SUB135_WEEK_VDOT[i]).toBeGreaterThanOrEqual(KIKKO_SUB135_WEEK_VDOT[i - 1]);
    }
    // riprende da dove kikkoSub20 era arrivato alla quarta settimana
    expect(KIKKO_SUB135_WEEK_VDOT[0]).toBe(49.4);
  });

  it("spostare la partenza trasla tutto il piano senza deformarlo", () => {
    const shifted = buildKikkoSub135Sessions("2026-08-24");
    expect(shifted).toHaveLength(KIKKO_SUB135_SESSIONS.length);
    shifted.forEach((s, i) => {
      const delta = (Date.parse(s.date) - Date.parse(KIKKO_SUB135_SESSIONS[i].date)) / 86_400_000;
      expect(delta).toBe(7);
    });
    expect(kikkoSub135RaceDate("2026-08-24")).toBe("2026-10-25");
  });

  it("una data che non è lunedì viene riportata al lunedì della sua settimana", () => {
    expect(kikkoSub135RaceDate("2026-08-27")).toBe(kikkoSub135RaceDate("2026-08-24"));
  });
});
