import { describe, it, expect } from "vitest";
import {
  KIKKO_SUB20_SESSIONS,
  KIKKO_SUB20_WEEKLY_KM,
  KIKKO_SUB20_META,
  kikkoSub20ActualWeeklyKm,
  kikkoSub20RaceDate,
  buildKikkoSub20Sessions,
  KIKKO_SUB20_DEFAULT_START,
  heatBandForDate,
  heatBandForIndex,
  heatPace,
  heatTable,
  romeHeatIndexForDate,
  kikkoSub20HeatInfo,
  basesFor,
  repPaceForRecovery,
  dewPoint,
  KIKKO_WEEK_VDOT,
  KIKKO_VDOT_START,
  KIKKO_VDOT_GOAL,
} from "./kikkoSub20Plan";

/**
 * Il piano è scritto a mano seduta per seduta: senza questi controlli una
 * modifica a una singola cella può sfasare il volume settimanale o introdurre
 * una terza seduta intensa senza che nessuno se ne accorga.
 */

const paceSec = (p: string) => {
  const [m, s] = p.split(":").map(Number);
  return m * 60 + s;
};

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

  it("rispetta i chilometraggi dei tre blocchi", () => {
    expect(KIKKO_SUB20_WEEKLY_KM).toEqual([34, 35, 36, 27, 38, 40, 41, 30, 43, 44, 45, 33]);
  });

  it("dentro ogni blocco il volume sale, la quarta settimana scarica", () => {
    const km = KIKKO_SUB20_WEEKLY_KM;
    for (const b of [0, 4, 8]) {
      expect(km[b + 1], `blocco ${b / 4 + 1}, seconda settimana`).toBeGreaterThan(km[b]);
      expect(km[b + 2], `blocco ${b / 4 + 1}, terza settimana`).toBeGreaterThan(km[b + 1]);
      const cut = ((km[b + 2] - km[b + 3]) / km[b + 2]) * 100;
      expect(cut, `blocco ${b / 4 + 1}, scarico`).toBeGreaterThanOrEqual(20);
      expect(cut, `blocco ${b / 4 + 1}, scarico`).toBeLessThanOrEqual(30);
    }
  });

  it("gli incrementi di carico restano piccoli, blocco per blocco", () => {
    const km = KIKKO_SUB20_WEEKLY_KM;
    for (const b of [0, 4, 8]) {
      for (const i of [b + 1, b + 2]) {
        const growth = ((km[i] - km[i - 1]) / km[i - 1]) * 100;
        expect(growth, `settimana ${i + 1}`).toBeGreaterThan(0);
        expect(growth, `settimana ${i + 1}`).toBeLessThanOrEqual(10);
      }
    }
  });

  it("ogni blocco riparte sopra il precedente senza strappi", () => {
    const km = KIKKO_SUB20_WEEKLY_KM;
    for (const [prevPeak, nextPeak] of [[km[2], km[6]], [km[6], km[10]]]) {
      const growth = ((nextPeak - prevPeak) / prevPeak) * 100;
      expect(growth).toBeGreaterThan(0);
      expect(growth).toBeLessThanOrEqual(15);
    }
  });
});

describe("kikkoSub20 — intensità", () => {
  it("ogni settimana ha esattamente quattro uscite", () => {
    for (let i = 0; i < KIKKO_SUB20_META.weeks; i++) {
      expect(weekOf(i), `settimana ${i + 1}`).toHaveLength(4);
    }
  });

  it("una sola seduta di qualità a settimana, il resto in scioltezza", () => {
    for (let i = 0; i < KIKKO_SUB20_META.weeks; i++) {
      const week = weekOf(i);
      const hard = week.filter((s) => s.type === "intervals" || s.type === "tempo");
      const soft = week.filter((s) => s.type === "recovery" || s.type === "long");
      expect(hard, `settimana ${i + 1} — qualità`).toHaveLength(1);
      expect(soft, `settimana ${i + 1} — lente`).toHaveLength(3);
    }
  });

  it("gli intervalli vanno a ritmo gara del VDOT della settimana, corretto per l'aria", () => {
    for (const s of KIKKO_SUB20_SESSIONS.filter((x) => x.type === "intervals")) {
      const info = kikkoSub20HeatInfo(s.date);
      expect(info.pace, `${s.date} · ${s.title}`).not.toBeNull();
      expect(s.target_pace, `${s.date} · ${s.title}`).toBe(info.pace!.mid);
      // la base esce dal VDOT della settimana: ritmo gara sulle ripetute brevi,
      // fra 10K e soglia sui 2 km (dipende da quanto recupero c'è in mezzo)
      const b = basesFor(info.vdot!);
      expect(info.baseSec!, `${s.date} · ${s.title}`).toBeGreaterThanOrEqual(b.race - 0.01);
      expect(info.baseSec!, `${s.date} · ${s.title}`).toBeLessThanOrEqual(b.thr + 0.01);
      // il target sta sempre dentro la forbice della fascia
      expect(paceSec(s.target_pace!)).toBeGreaterThanOrEqual(Math.floor(info.pace!.fastSec));
      expect(paceSec(s.target_pace!)).toBeLessThanOrEqual(Math.ceil(info.pace!.slowSec));
    }
  });

  it("il piano accelera lungo il blocco: aria che scende e VDOT che sale", () => {
    const hard = KIKKO_SUB20_SESSIONS.filter((s) => s.type === "intervals");
    const summer = paceSec(hard[0].target_pace!);              // fine luglio
    const autumn = paceSec(hard[hard.length - 1].target_pace!); // fine settembre
    const race = paceSec(KIKKO_SUB20_SESSIONS[KIKKO_SUB20_SESSIONS.length - 1].target_pace!);
    expect(autumn, "a settembre l'aria scende e il motore è cresciuto").toBeLessThan(summer);
    expect(race, "il giorno di gara è il target più stretto del piano").toBeLessThanOrEqual(autumn);
  });

  it("nessuna seduta chiede più di quanto il VDOT della settimana consenta", () => {
    // Il ritmo gara non può mai finire sotto il ritmo gara dell'obiettivo:
    // se succede, la base è tarata su un VDOT che non esiste ancora.
    const goalRace = basesFor(KIKKO_VDOT_GOAL).race;
    for (const s of KIKKO_SUB20_SESSIONS.filter((x) => x.type === "intervals")) {
      expect(paceSec(s.target_pace!), `${s.date} · ${s.title}`).toBeGreaterThanOrEqual(
        Math.floor(goalRace * 0.99),
      );
    }
  });

  it("la seduta di qualità progredisce da 6×600 a 10×800", () => {
    const titles = KIKKO_SUB20_SESSIONS.filter((s) => s.type === "intervals").map((s) => s.title);
    expect(titles[0]).toContain("6×600");
    expect(titles[9]).toContain("10×800");   // settimana 10 = picco
    expect(titles[10]).toContain("3×2 km");  // settimana 11 = specifica gara
  });

  it("il taper tiene il ritmo gara ma dimezza le ripetute", () => {
    const hard = KIKKO_SUB20_SESSIONS.filter((s) => s.type === "intervals");
    const taper = hard[hard.length - 1];
    expect(taper.title).toContain("5×800");
    expect(taper.target_pace).toBe(kikkoSub20HeatInfo(taper.date).pace!.mid);
  });

  it("ogni seduta di ripetute dichiara il recupero nel titolo", () => {
    const hard = KIKKO_SUB20_SESSIONS.filter((s) => s.type === "intervals");
    for (const s of hard) {
      expect(s.title, s.title).toMatch(/rec \d+:\d\d/);
    }
  });

  it("il recupero degli intervalli resta proporzionato al lavoro", () => {
    // Daniels: sul lavoro a ritmo intervallo il recupero non deve superare di
    // molto la durata della ripetuta, altrimenti diventa velocità pura; sotto
    // ~0.6 la seduta non si regge al ritmo richiesto. Il taper è l'eccezione
    // voluta: lì il recupero è LUNGO di proposito, perché serve la freschezza
    // e non lo stimolo.
    const all = KIKKO_SUB20_SESSIONS.filter((x) => x.type === "intervals");
    all.forEach((s, i) => {
      const m = s.title.match(/(\d+)×(\d+) m .*rec (\d+):(\d\d)/);
      if (!m) return;   // i 3×2 km hanno una loro logica di recupero
      const meters = Number(m![2]);
      const recSec = Number(m![3]) * 60 + Number(m![4]);
      const workSec = (meters / 1000) * paceSec(s.target_pace!);
      const ratio = recSec / workSec;
      const ceiling = i === all.length - 1 ? 1.15 : 1.05;   // ultima = taper
      expect(ratio, `${s.title} → 1:${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(0.6);
      expect(ratio, `${s.title} → 1:${ratio.toFixed(2)}`).toBeLessThanOrEqual(ceiling);
    });
  });

  it("la descrizione resta corta: struttura e numeri, non un tema", () => {
    for (const s of KIKKO_SUB20_SESSIONS) {
      expect(s.description.length, `${s.date} · ${s.title}`).toBeLessThanOrEqual(180);
    }
  });

  it("dentro ogni blocco di carico il recupero si accorcia", () => {
    const recOf = (t: string) => {
      const m = t.match(/rec (\d+):(\d\d)/);
      return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
    };
    const titles = KIKKO_SUB20_SESSIONS.filter((s) => s.type === "intervals").map((s) => s.title);
    // Solo le tre settimane di carico di ogni blocco: nello scarico e nel taper
    // il recupero si allunga di proposito.
    const blocks = [titles.slice(0, 3), titles.slice(4, 7), titles.slice(8, 10)];
    for (const block of blocks) {
      const rec = block.map(recOf);
      for (let i = 1; i < rec.length; i++) {
        expect(rec[i], `${block[i]} dopo ${block[i - 1]}`).toBeLessThan(rec[i - 1]);
      }
    }
  });

  it("il taper allunga il recupero invece di accorciarlo", () => {
    const titles = KIKKO_SUB20_SESSIONS.filter((s) => s.type === "intervals").map((s) => s.title);
    const recOf = (t: string) => {
      const m = t.match(/rec (\d+):(\d\d)/);
      return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
    };
    // il taper è l'ultima seduta di ripetute; prima c'è il picco da 10×800
    const reps800 = titles.filter((t) => t.includes("×800 m"));
    expect(recOf(reps800[reps800.length - 1])).toBeGreaterThan(recOf(reps800[reps800.length - 2]));
  });

  it("i 3×2 km arrivano una volta sola, a ridosso della gara", () => {
    // Con una sola qualità a settimana il lavoro specifico non si alterna più:
    // si spende dove serve, nella settimana di picco prima del taper.
    const specific = KIKKO_SUB20_SESSIONS.filter((s) => s.title.includes("3×2 km"));
    expect(specific).toHaveLength(1);
    const idx = KIKKO_SUB20_SESSIONS.indexOf(specific[0]);
    const race = KIKKO_SUB20_SESSIONS.length - 1;
    expect(race - idx, "sta nelle due settimane prima della gara").toBeLessThanOrEqual(8);
  });
});

describe("kikkoSub20 — indice T + DP", () => {
  /**
   * Le tre tabelle sono la specifica, non un effetto collaterale del codice:
   * qui sono trascritte riga per riga come le ha scritte l'atleta. Se un
   * ritocco alle penalità sposta anche un solo secondo, questo test lo dice.
   */
  // Le basi storiche su cui le tabelle sono state scritte (VDOT 48-49):
  // il modello delle penalità va verificato su quelle, indipendentemente dal
  // VDOT con cui il piano gira oggi.
  const LEGACY = { reps: 240, long: 255, tempo: 262 };
  const row = (kind: "reps" | "long" | "tempo", id: string) =>
    heatTable(kind, LEGACY[kind]).find((r) => r.band.id === id)!;

  it("tabella intervalli, base 4:00/km", () => {
    expect([row("reps", "b0").penLabel, row("reps", "b0").pace, row("reps", "b0").reference]).toEqual(["0%", "3:58-4:00", "2:23-2:24"]);
    expect([row("reps", "b1").penLabel, row("reps", "b1").pace, row("reps", "b1").reference]).toEqual(["0,5-1,5%", "4:01-4:04", "2:25-2:26"]);
    expect([row("reps", "b2").penLabel, row("reps", "b2").pace, row("reps", "b2").reference]).toEqual(["2-3%", "4:05-4:07", "2:27-2:28"]);
    expect([row("reps", "b3").penLabel, row("reps", "b3").pace, row("reps", "b3").reference]).toEqual(["3-4,5%", "4:07-4:11", "2:28-2:31"]);
    expect([row("reps", "b4").penLabel, row("reps", "b4").pace, row("reps", "b4").reference]).toEqual(["4,5-6%", "4:11-4:14", "2:31-2:32"]);
    expect([row("reps", "b5").penLabel, row("reps", "b5").pace, row("reps", "b5").reference]).toEqual(["6-8%", "4:14-4:19", "2:32-2:35"]);
    expect([row("reps", "b6").pace, row("reps", "b6").reference]).toEqual(["—", "seduta da spostare"]);
  });

  it("tabella 3×2 km rec 3:30, base 4:15/km", () => {
    expect([row("long", "b0").penLabel, row("long", "b0").pace, row("long", "b0").reference]).toEqual(["0%", "4:15", "8:30"]);
    expect([row("long", "b1").penLabel, row("long", "b1").pace, row("long", "b1").reference]).toEqual(["0,5-2%", "4:16-4:20", "8:32-8:40"]);
    expect([row("long", "b2").penLabel, row("long", "b2").pace, row("long", "b2").reference]).toEqual(["2,5-3,5%", "4:21-4:24", "8:42-8:48"]);
    expect([row("long", "b3").penLabel, row("long", "b3").pace, row("long", "b3").reference]).toEqual(["3,5-5%", "4:24-4:28", "8:48-8:56"]);
    expect([row("long", "b4").penLabel, row("long", "b4").pace, row("long", "b4").reference]).toEqual(["5-7%", "4:28-4:33", "8:56-9:06"]);
    expect([row("long", "b5").penLabel, row("long", "b5").pace, row("long", "b5").reference]).toEqual(["7-9%", "4:33-4:38", "9:06-9:16"]);
    expect(row("long", "b6").reference).toBe("seduta da spostare");
  });

  it("tabella soglia 20′, base 4:22/km", () => {
    expect([row("tempo", "b0").penLabel, row("tempo", "b0").pace, row("tempo", "b0").reference]).toEqual(["0%", "4:22", "4,58"]);
    expect([row("tempo", "b1").penLabel, row("tempo", "b1").pace, row("tempo", "b1").reference]).toEqual(["0,5-2%", "4:23-4:27", "4,49-4,56"]);
    expect([row("tempo", "b2").penLabel, row("tempo", "b2").pace, row("tempo", "b2").reference]).toEqual(["2,5-4%", "4:29-4:32", "4,40-4,47"]);
    expect([row("tempo", "b3").penLabel, row("tempo", "b3").pace, row("tempo", "b3").reference]).toEqual(["4-6%", "4:32-4:38", "4,32-4,40"]);
    expect([row("tempo", "b4").penLabel, row("tempo", "b4").pace, row("tempo", "b4").reference]).toEqual(["6-8%", "4:38-4:43", "4,24-4,32"]);
    expect([row("tempo", "b5").penLabel, row("tempo", "b5").pace, row("tempo", "b5").reference]).toEqual(["8-10%", "4:43-4:48", "4,16-4,24"]);
    expect(row("tempo", "b6").reference).toBe("seduta da spostare");
  });

  it("le fasce si leggono sull'indice, non sui gradi", () => {
    expect(heatBandForIndex(25).label).toBe("< 26");   // 15° + DP 10°
    expect(heatBandForIndex(34).label).toBe("26-37");  // 20° + DP 14°
    expect(heatBandForIndex(41).label).toBe("37-42");  // 24° + DP 17°
    expect(heatBandForIndex(46).label).toBe("42-48");  // 28° + DP 18°
    expect(heatBandForIndex(50).label).toBe("48-53");  // 31° + DP 19°
    expect(heatBandForIndex(54).label).toBe("53-59");  // 34° + DP 20°
    expect(heatBandForIndex(59).skip, "oltre 59 la seduta si sposta").toBe(true);
  });

  it("l'indice segue il calendario di Roma", () => {
    expect(romeHeatIndexForDate("2026-08-04"), "agosto").toBe(40);
    expect(romeHeatIndexForDate("2026-10-04"), "gara di ottobre").toBe(24);
    expect(heatBandForDate("2026-01-15").label, "gennaio").toBe("< 26");
  });
});

describe("kikkoSub20 — taratura sul 4×1000 reale", () => {
  /**
   * La seduta di riferimento: 4×1000 rec 3:00, 25°C e UR 68%, massimale.
   * Se questi controlli cadono, il piano non è più agganciato al dato vero.
   */
  it("da 25°C e 68% di umidità esce un punto di rugiada di ~18,7°", () => {
    expect(dewPoint(25, 68)).toBeCloseTo(18.7, 1);
  });

  it("quella seduta cadeva in fascia 42-48, più dura di ogni giorno del piano", () => {
    const index = 25 + dewPoint(25, 68);
    expect(heatBandForIndex(index).label).toBe("42-48");
    const worst = Math.max(...KIKKO_SUB20_SESSIONS.map((s) => romeHeatIndexForDate(s.date)));
    expect(worst, "il piano non programma nulla in quella fascia").toBeLessThan(42);
  });

  it("il VDOT parte dal misurato e arriva all'obiettivo", () => {
    expect(KIKKO_WEEK_VDOT).toHaveLength(KIKKO_SUB20_META.weeks);
    expect(KIKKO_WEEK_VDOT[0]).toBe(KIKKO_VDOT_START);
    expect(KIKKO_WEEK_VDOT[KIKKO_WEEK_VDOT.length - 1]).toBe(KIKKO_VDOT_GOAL);
    for (let i = 1; i < KIKKO_WEEK_VDOT.length; i++) {
      expect(KIKKO_WEEK_VDOT[i], `settimana ${i + 1}`).toBeGreaterThanOrEqual(KIKKO_WEEK_VDOT[i - 1]);
    }
  });

  it("il VDOT obiettivo vale davvero il tempo dichiarato", () => {
    const race5k = basesFor(KIKKO_VDOT_GOAL).race * 5;
    const [m, s] = KIKKO_SUB20_META.goalTime.split(":").map(Number);
    expect(race5k, "5K al ritmo gara del VDOT obiettivo").toBeCloseTo(m * 60 + s, -0.5);
  });

  it("le basi Daniels tornano sui valori che l'atleta conosce", () => {
    expect(Math.round(basesFor(50).thr)).toBe(255);        // soglia 4:15
    expect(Math.round(basesFor(50).race * 5)).toBe(1195);  // 5K 19:55 ≈ 19:57
    expect(Math.round(basesFor(48.5).thr)).toBe(262);      // soglia 4:22
  });

  it("il ritmo dei 2 km segue il recupero: 10K col pieno, T-pace col corto", () => {
    const b = basesFor(51);
    const work = 2 * b.thr;
    expect(repPaceForRecovery(0.41 * work, b), "rec 3:30 → ritmo 10K").toBeCloseTo(b.k10, 1);
    expect(repPaceForRecovery(0.21 * work, b), "rec 1:45 → T-pace").toBeCloseTo(b.thr, 1);
    // e in mezzo si interpola, mai fuori dai due estremi
    const mid = repPaceForRecovery(0.30 * work, b);
    expect(mid).toBeGreaterThan(b.k10);
    expect(mid).toBeLessThan(b.thr);
  });

  it("i 3×2 km rallentano quando il recupero si accorcia, a parità di settimana", () => {
    // Confronto a VDOT fisso: isola l'effetto del solo recupero.
    const b = basesFor(51);
    const paces = ["3:00", "2:30", "2:15", "2:00", "1:45"].map((r) => {
      const [m, s] = r.split(":").map(Number);
      return repPaceForRecovery(m * 60 + s, b);
    });
    for (let i = 1; i < paces.length; i++) {
      expect(paces[i], `recupero ${i}`).toBeGreaterThan(paces[i - 1]);
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
    expect(kikkoSub20RaceDate("2026-08-03")).toBe("2026-10-25");
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
