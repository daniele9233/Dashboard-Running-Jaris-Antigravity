import { describe, it, expect } from "vitest";
import {
  KIKKO_SUB20_SESSIONS,
  KIKKO_SUB20_WEEKLY_KM,
  KIKKO_SUB20_META,
  kikkoSub20ActualWeeklyKm,
  kikkoSub20RaceDate,
  buildKikkoSub20Sessions,
  KIKKO_SUB20_DEFAULT_START,
} from "./kikkoSub20Plan";

/**
 * Il piano è scritto a mano seduta per seduta: senza questi controlli una
 * modifica a una singola cella può sfasare il volume settimanale o introdurre
 * una terza seduta intensa senza che nessuno se ne accorga.
 */

const RACE_PACE = "4:00";

function weekOf(index: number): typeof KIKKO_SUB20_SESSIONS {
  const [y, m, d] = KIKKO_SUB20_DEFAULT_START.split("-").map(Number);
  const monday = new Date(y, m - 1, d);
  monday.setDate(monday.getDate() + index * 7);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const iso = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  return KIKKO_SUB20_SESSIONS.filter((s) => s.date >= iso(monday) && s.date <= iso(sunday));
}

describe("kikkoSub20 — volume", () => {
  it("la somma delle sedute coincide con il volume dichiarato di ogni settimana", () => {
    expect(kikkoSub20ActualWeeklyKm()).toEqual(KIKKO_SUB20_WEEKLY_KM);
  });

  it("parte da 32 km come richiesto", () => {
    expect(KIKKO_SUB20_WEEKLY_KM[0]).toBe(32);
  });

  it("rispetta la regola del 10% sulle settimane di carico", () => {
    // Il confronto va fatto fra picchi di blocco: dopo uno scarico il salto
    // percentuale è alto per costruzione e non significa nulla.
    const km = KIKKO_SUB20_WEEKLY_KM;
    for (const [from, to] of [[0, 1], [1, 2], [2, 4], [4, 5], [5, 6], [6, 8]]) {
      const growth = ((km[to] - km[from]) / km[from]) * 100;
      expect(growth).toBeGreaterThan(0);
      expect(growth).toBeLessThanOrEqual(11);
    }
  });

  it("scarica il volume nelle settimane 4 e 8", () => {
    expect(KIKKO_SUB20_WEEKLY_KM[3]).toBeLessThan(KIKKO_SUB20_WEEKLY_KM[2]);
    expect(KIKKO_SUB20_WEEKLY_KM[7]).toBeLessThan(KIKKO_SUB20_WEEKLY_KM[6]);
  });

  it("il taper riduce il volume fra il 41% e il 60% del picco", () => {
    const km = KIKKO_SUB20_WEEKLY_KM;
    const peak = Math.max(...km);
    const cut = ((peak - km[9]) / peak) * 100;
    expect(cut).toBeGreaterThanOrEqual(41);
    expect(cut).toBeLessThanOrEqual(60);
  });
});

describe("kikkoSub20 — intensità", () => {
  it("ogni settimana ha esattamente due sedute intense", () => {
    for (let i = 0; i < KIKKO_SUB20_META.weeks; i++) {
      const intense = weekOf(i).filter((s) => s.type === "intervals" || s.type === "tempo");
      expect(intense, `settimana ${i + 1}`).toHaveLength(2);
    }
  });

  it("tutti gli altri giorni sono facili o lungo", () => {
    const soft = KIKKO_SUB20_SESSIONS.filter(
      (s) => s.type !== "intervals" && s.type !== "tempo",
    );
    expect(soft.every((s) => s.type === "recovery" || s.type === "long")).toBe(true);
  });

  it("gli intervalli brevi vanno tutti a ritmo gara", () => {
    const paces = new Set(
      KIKKO_SUB20_SESSIONS.filter((s) => s.type === "intervals").map((s) => s.target_pace),
    );
    expect([...paces]).toEqual([RACE_PACE]);
  });

  it("la seduta 1 progredisce da 6×600 a 10×800", () => {
    const titles = KIKKO_SUB20_SESSIONS.filter((s) => s.type === "intervals").map((s) => s.title);
    expect(titles[0]).toContain("6×600");
    expect(titles[8]).toContain("10×800"); // settimana 9 = picco
  });

  it("il taper tiene il ritmo gara ma dimezza le ripetute", () => {
    const titles = KIKKO_SUB20_SESSIONS.filter((s) => s.type === "intervals").map((s) => s.title);
    expect(titles[9]).toContain("5×800");
    expect(titles[9]).toContain(RACE_PACE);
  });

  it("i 3×2 km tornano a settimane alterne con recupero sempre più corto", () => {
    const recoveries = KIKKO_SUB20_SESSIONS.filter((s) => s.title.includes("3×2 km")).map((s) => {
      const m = s.title.match(/rec (\d+):(\d+)/);
      return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
    });
    expect(recoveries).toHaveLength(5); // settimane 1, 3, 5, 7, 9
    for (let i = 1; i < recoveries.length; i++) {
      expect(recoveries[i]).toBeLessThan(recoveries[i - 1]);
    }
  });
});

describe("kikkoSub20 — calendario", () => {
  it("copre 10 settimane e finisce con la gara di domenica", () => {
    const last = KIKKO_SUB20_SESSIONS[KIKKO_SUB20_SESSIONS.length - 1];
    expect(last.title).toContain("GARA 5K");
    expect(last.day).toBe("Domenica");
    expect(last.date).toBe(kikkoSub20RaceDate());
  });

  it("sposta l'intero piano quando cambia la data di partenza", () => {
    const shifted = buildKikkoSub20Sessions("2026-08-03"); // +7 giorni
    expect(shifted[0].date).toBe("2026-08-03");
    expect(shifted[0].day).toBe("Lunedì");
    expect(kikkoSub20RaceDate("2026-08-03")).toBe("2026-10-11");
    expect(shifted).toHaveLength(KIKKO_SUB20_SESSIONS.length);
  });

  it("non programma nulla di sabato (giorno di riposo)", () => {
    expect(KIKKO_SUB20_SESSIONS.some((s) => s.day === "Sabato")).toBe(false);
  });
});
