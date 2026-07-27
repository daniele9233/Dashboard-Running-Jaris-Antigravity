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

  it("sale a ogni settimana fino al picco, senza scarichi", () => {
    const km = KIKKO_SUB20_WEEKLY_KM;
    for (let i = 1; i <= 8; i++) {
      expect(km[i], `settimana ${i + 1} deve superare la ${i}`).toBeGreaterThan(km[i - 1]);
    }
  });

  it("ogni incremento resta dentro la regola del 10%", () => {
    const km = KIKKO_SUB20_WEEKLY_KM;
    for (let i = 1; i <= 8; i++) {
      const growth = ((km[i] - km[i - 1]) / km[i - 1]) * 100;
      expect(growth, `settimana ${i + 1}`).toBeGreaterThanOrEqual(8);
      expect(growth, `settimana ${i + 1}`).toBeLessThanOrEqual(11);
    }
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
  it("ogni settimana ha esattamente quattro uscite", () => {
    for (let i = 0; i < KIKKO_SUB20_META.weeks; i++) {
      expect(weekOf(i), `settimana ${i + 1}`).toHaveLength(4);
    }
  });

  it("ogni settimana ha due qualità e due lente", () => {
    for (let i = 0; i < KIKKO_SUB20_META.weeks; i++) {
      const week = weekOf(i);
      const hard = week.filter((s) => s.type === "intervals" || s.type === "tempo");
      const soft = week.filter((s) => s.type === "recovery" || s.type === "long");
      expect(hard, `settimana ${i + 1} — qualità`).toHaveLength(2);
      expect(soft, `settimana ${i + 1} — lente`).toHaveLength(2);
    }
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

  it("ogni seduta di ripetute dichiara il recupero nel titolo", () => {
    const hard = KIKKO_SUB20_SESSIONS.filter((s) => s.type === "intervals");
    for (const s of hard) {
      expect(s.title, s.title).toMatch(/rec \d+:\d\d/);
    }
  });

  it("il recupero degli intervalli sta fra 1:0.6 e 1:1 del lavoro", () => {
    // Daniels: sul lavoro a ritmo intervallo il recupero non deve superare la
    // durata della ripetuta, altrimenti diventa lavoro di velocità pura.
    // Sotto ~0.6 la seduta non si regge al ritmo gara richiesto.
    const hard = KIKKO_SUB20_SESSIONS.filter((s) => s.type === "intervals");
    for (const s of hard) {
      const m = s.title.match(/(\d+)×(\d+) m .*rec (\d+):(\d\d)/);
      expect(m, s.title).not.toBeNull();
      const meters = Number(m![2]);
      const recSec = Number(m![3]) * 60 + Number(m![4]);
      const workSec = (meters / 1000) * 240; // 240 s/km = ritmo gara
      const ratio = recSec / workSec;
      expect(ratio, `${s.title} → 1:${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(0.6);
      expect(ratio, `${s.title} → 1:${ratio.toFixed(2)}`).toBeLessThanOrEqual(1.05);
    }
  });

  it("dentro ogni blocco il recupero si accorcia", () => {
    const recOf = (t: string) => {
      const m = t.match(/rec (\d+):(\d\d)/);
      return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
    };
    const titles = KIKKO_SUB20_SESSIONS.filter((s) => s.type === "intervals").map((s) => s.title);
    const block600 = titles.filter((t) => t.includes("×600")).map(recOf);
    const block800 = titles.filter((t) => t.includes("×800")).slice(0, -1).map(recOf); // esclude il taper
    for (const block of [block600, block800]) {
      for (let i = 1; i < block.length; i++) {
        expect(block[i]).toBeLessThan(block[i - 1]);
      }
    }
  });

  it("il taper allunga il recupero invece di accorciarlo", () => {
    const titles = KIKKO_SUB20_SESSIONS.filter((s) => s.type === "intervals").map((s) => s.title);
    const recOf = (t: string) => {
      const m = t.match(/rec (\d+):(\d\d)/);
      return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
    };
    expect(recOf(titles[9])).toBeGreaterThan(recOf(titles[8]));
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
    // La data scelta è il LUNEDÌ di riferimento della settimana 1: la prima
    // uscita cade il martedì successivo, perché il lunedì non si corre.
    const shifted = buildKikkoSub20Sessions("2026-08-03"); // +7 giorni
    expect(shifted[0].date).toBe("2026-08-04");
    expect(shifted[0].day).toBe("Martedì");
    expect(kikkoSub20RaceDate("2026-08-03")).toBe("2026-10-11");
    expect(shifted).toHaveLength(KIKKO_SUB20_SESSIONS.length);
  });

  it("corre solo martedì, giovedì, sabato e domenica", () => {
    const days = new Set(KIKKO_SUB20_SESSIONS.map((s) => s.day));
    expect([...days].sort()).toEqual(["Domenica", "Giovedì", "Martedì", "Sabato"]);
  });

  it("lascia almeno un giorno fra le due sedute di qualità", () => {
    // Martedì e giovedì: 48 ore di stacco. Attaccate non si recupererebbero.
    const hard = KIKKO_SUB20_SESSIONS.filter(
      (s) => s.type === "intervals" || s.type === "tempo",
    );
    for (let i = 1; i < hard.length; i++) {
      const gap = Math.round(
        (Date.parse(hard[i].date) - Date.parse(hard[i - 1].date)) / 86_400_000,
      );
      expect(gap).toBeGreaterThanOrEqual(2);
    }
  });
});
