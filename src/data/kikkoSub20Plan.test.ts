import { describe, it, expect } from "vitest";
import {
  KIKKO_SUB20_SESSIONS,
  KIKKO_SUB20_WEEKLY_KM,
  KIKKO_SUB20_DELOAD_WEEKS,
  KIKKO_SUB20_TARGETS,
  kikkoGoalOdds,
  kikkoWindow,
  KIKKO_SUB20_PLAN,
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

  it("rispetta i chilometraggi dichiarati", () => {
    expect(KIKKO_SUB20_WEEKLY_KM).toEqual([34, 35, 36, 36, 28, 39, 41, 30, 43, 44, 45, 33]);
  });

  it("ogni scarico taglia fra il 20 e il 30% della settimana precedente", () => {
    const km = KIKKO_SUB20_WEEKLY_KM;
    expect(KIKKO_SUB20_DELOAD_WEEKS).toEqual([4, 7, 11]);
    for (const i of KIKKO_SUB20_DELOAD_WEEKS) {
      const cut = ((km[i - 1] - km[i]) / km[i - 1]) * 100;
      expect(cut, `scarico della settimana ${i + 1}`).toBeGreaterThanOrEqual(20);
      expect(cut, `scarico della settimana ${i + 1}`).toBeLessThanOrEqual(30);
    }
  });

  it("mai più di quattro settimane di carico di fila", () => {
    let run = 0;
    KIKKO_SUB20_WEEKLY_KM.forEach((_, i) => {
      run = KIKKO_SUB20_DELOAD_WEEKS.includes(i) ? 0 : run + 1;
      expect(run, `settimana ${i + 1}`).toBeLessThanOrEqual(4);
    });
  });

  it("da una settimana di carico alla successiva non si sale oltre il 10%", () => {
    // Il confronto salta gli scarichi: dopo un taglio del 25% risalire al
    // volume di prima non è un aumento, è tornare dove si era già stati.
    const km = KIKKO_SUB20_WEEKLY_KM;
    const load = km.map((v, i) => ({ v, i })).filter(({ i }) => !KIKKO_SUB20_DELOAD_WEEKS.includes(i));
    for (let k = 1; k < load.length; k++) {
      const growth = ((load[k].v - load[k - 1].v) / load[k - 1].v) * 100;
      expect(growth, `settimana ${load[k].i + 1}`).toBeGreaterThanOrEqual(0);
      expect(growth, `settimana ${load[k].i + 1}`).toBeLessThanOrEqual(10);
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

  it("la qualità alterna soglia e ripetute fra le settimane di carico", () => {
    const quality = KIKKO_SUB20_SESSIONS.filter((s) => s.type === "intervals" || s.type === "tempo");
    expect(quality).toHaveLength(KIKKO_SUB20_META.weeks);

    // Sugli scarichi la qualità è sempre ripetute: poche, a ritmo pieno,
    // recupero lungo. È la seduta che costa meno da assorbire.
    for (const i of KIKKO_SUB20_DELOAD_WEEKS) {
      expect(quality[i].type, `scarico ${i + 1} · ${quality[i].title}`).toBe("intervals");
    }

    // Fra le settimane di carico l'alternanza è stretta, e si apre con la
    // soglia: è lei a reggere il ritmo gara, le ripetute ci mettono sopra la
    // velocità.
    const load = quality.filter((_, i) => !KIKKO_SUB20_DELOAD_WEEKS.includes(i));
    load.forEach((s, i) => {
      expect(s.type, `carico ${i + 1} · ${s.title}`).toBe(i % 2 === 0 ? "tempo" : "intervals");
    });
  });

  it("la soglia cresce di mezzo chilometro alla volta", () => {
    const km = KIKKO_SUB20_SESSIONS
      .filter((s) => s.type === "tempo")
      .map((s) => Number(s.title.match(/Soglia ([\d,]+) km/)![1].replace(",", ".")));
    expect(km).toEqual([5.5, 6, 6.5, 7, 7.5]);
  });

  it("le ripetute crescono e passano dai 600 agli 800", () => {
    const titles = KIKKO_SUB20_SESSIONS.filter((s) => s.type === "intervals").map((s) => s.title);
    expect(titles[0]).toContain("6×600");
    expect(titles[titles.length - 2]).toContain("8×800");
    expect(titles[titles.length - 1]).toContain("5×800");   // taper
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
    // Solo le sedute di CARICO, e solo a parità di distanza della ripetuta:
    // lo scarico e il taper allungano il recupero di proposito, e il passaggio
    // dai 600 agli 800 lo riazzera (distanza nuova, si riparte pieni).
    const carico = titles.filter((t) => !/^5×/.test(t));
    const blocks = [carico.filter((t) => t.includes("×600")), carico.filter((t) => t.includes("×800"))];
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

  it("l'ultima soglia è la più lunga e sta a ridosso della gara", () => {
    const soglie = KIKKO_SUB20_SESSIONS.filter((s) => s.type === "tempo");
    const ultima = soglie[soglie.length - 1];
    const race = KIKKO_SUB20_SESSIONS.length - 1;
    expect(ultima.title).toContain("Soglia 7,5 km");
    // ed è davvero la più lunga: la progressione non torna mai indietro
    const km = soglie.map((x) => Number(x.title.match(/Soglia ([\d,]+) km/)![1].replace(",", ".")));
    expect(Math.max(...km)).toBe(km[km.length - 1]);
    expect(race - KIKKO_SUB20_SESSIONS.indexOf(ultima), "una settimana prima della gara")
      .toBeLessThanOrEqual(8);
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

describe("kikkoSub20 — probabilità dell'obiettivo", () => {
  const race = "2026-10-18";
  const odds = (vdot: number, sessionIso: string, targetSec = 19 * 60 + 59) =>
    kikkoGoalOdds({ vdot, distanceKm: 5, targetSec, raceIso: race, sessionIso });

  it("resta una probabilità, mai una certezza", () => {
    for (const v of [40, 49, 51, 60]) {
      const p = odds(v, "2026-08-25").p;
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    }
  });

  it("un motore più forte alza la probabilità", () => {
    expect(odds(51, "2026-09-01").p).toBeGreaterThan(odds(49, "2026-09-01").p);
  });

  it("a parità di motore la probabilità sale avvicinandosi alla gara", () => {
    // non perché il motore cresca: perché resta meno ignoto davanti
    const lontano = odds(50.8, "2026-08-04");
    const vicino = odds(50.8, "2026-10-13");
    expect(vicino.weeksLeft).toBeLessThan(lontano.weeksLeft);
    expect(vicino.sigmaPct).toBeLessThan(lontano.sigmaPct);
    expect(vicino.p).toBeGreaterThan(lontano.p);
  });

  it("l'incertezza non scende mai sotto la variabilità misurata fra gare", () => {
    // Hopkins & Hewson 2001: 1,4% di CV fra gare simili dello stesso fondista
    expect(odds(51, race).sigmaPct).toBeGreaterThanOrEqual(1.4);
  });

  it("un obiettivo più ambizioso è sempre meno probabile", () => {
    const sub20 = odds(50.5, "2026-09-15", KIKKO_SUB20_TARGETS[0].sec);
    const stretch = odds(50.5, "2026-09-15", KIKKO_SUB20_TARGETS[1].sec);
    expect(KIKKO_SUB20_TARGETS[1].sec).toBeLessThan(KIKKO_SUB20_TARGETS[0].sec);
    expect(stretch.p).toBeLessThan(sub20.p);
  });

  it("il tempo previsto tiene conto dell'aria del giorno di gara", () => {
    const ottobre = kikkoGoalOdds({ vdot: 50, distanceKm: 5, targetSec: 1199, raceIso: "2026-10-18", sessionIso: "2026-09-01" });
    const agosto = kikkoGoalOdds({ vdot: 50, distanceKm: 5, targetSec: 1199, raceIso: "2026-08-16", sessionIso: "2026-07-01" });
    expect(agosto.predictedSec).toBeGreaterThan(ottobre.predictedSec);
  });

  it("lungo il piano, chiudendo sempre a target, la percentuale sale", () => {
    const p = KIKKO_WEEK_VDOT.map((v, i) =>
      odds(v, `2026-${String(7 + Math.floor((i * 7 + 1) / 30)).padStart(2, "0")}-01`).p,
    );
    expect(p[p.length - 1]).toBeGreaterThan(p[0]);
    expect(p[0]).toBeLessThan(0.5);
    expect(p[p.length - 1]).toBeGreaterThan(0.75);
  });

  it("la mezza usa il ritmo sostenibile, non la tabella di Daniels", () => {
    const b = basesFor(50);
    // Daniels a VDOT 50 promette 4:20/km sulla mezza; qui si resta più prudenti
    expect(b.hm).toBeGreaterThan(b.thr);
    expect(b.hm).toBeCloseTo(b.thr + 14, 6);
    expect(b.hm).toBeGreaterThan(265);
  });
});

describe("kikkoSub20 — la finestra fra inizio e gara", () => {
  const total = KIKKO_SUB20_PLAN.weeks.length;

  it("con lo spazio giusto il piano ci sta intero", () => {
    const w = kikkoWindow(KIKKO_SUB20_PLAN, "2026-07-27", "2026-10-12");
    expect(w.weeksUsed).toBe(total);
    expect(w.weeksSkipped).toBe(0);
    expect(w.firstMonday).toBe("2026-07-27");
    expect(w.raceIso).toBe("2026-10-18");
  });

  it("con sei settimane si corrono le ULTIME sei, non le prime", () => {
    const w = kikkoWindow(KIKKO_SUB20_PLAN, "2026-09-07", "2026-10-18");
    expect(w.weeksUsed).toBe(6);
    expect(w.weeksSkipped).toBe(total - 6);
    expect(w.firstMonday).toBe("2026-09-07");

    const sessions = buildKikkoSub20Sessions("2026-09-07", "2026-10-18");
    expect(sessions).toHaveLength(6 * 4);
    // la prima seduta è quella della settimana 7 del piano, non della 1
    expect(sessions[0].date).toBe("2026-09-08");
    // e si chiude sempre con la gara
    expect(sessions[sessions.length - 1].title).toContain("GARA");
    expect(sessions[sessions.length - 1].date).toBe("2026-10-18");
  });

  it("tre settimane bastano per taper e gara, e finiscono lì", () => {
    const sessions = buildKikkoSub20Sessions("2026-09-28", "2026-10-18");
    expect(sessions).toHaveLength(3 * 4);
    expect(sessions[sessions.length - 1].date).toBe("2026-10-18");
    // le tre settimane sono le ultime del piano: volume in discesa verso la gara
    const km = [0, 1, 2].map((i) =>
      sessions.slice(i * 4, i * 4 + 4).reduce((sum, x) => sum + x.target_distance_km, 0));
    expect(km[2]).toBeLessThan(km[0]);
  });

  it("una finestra più larga del piano non allunga il piano: lo fa cominciare dopo", () => {
    const w = kikkoWindow(KIKKO_SUB20_PLAN, "2026-06-01", "2026-10-18");
    expect(w.weeksUsed).toBe(total);
    expect(w.weeksIdle).toBeGreaterThan(0);
    expect(w.firstMonday).toBe("2026-07-27");
    expect(buildKikkoSub20Sessions("2026-06-01", "2026-10-18")).toHaveLength(total * 4);
  });

  it("la gara si sposta senza trascinarsi dietro la partenza", () => {
    const prima = buildKikkoSub20Sessions("2026-09-07", "2026-10-18");
    const dopo = buildKikkoSub20Sessions("2026-09-07", "2026-11-08");
    // stessa partenza, più settimane in mezzo → più piano
    expect(dopo.length).toBeGreaterThan(prima.length);
    expect(dopo[dopo.length - 1].date).toBe("2026-11-08");
  });

  it("i ritmi seguono la finestra: la settimana giusta, non quella di default", () => {
    // il 2026-09-08 in una finestra da sei settimane è la settimana 7 del piano
    const sessions = buildKikkoSub20Sessions("2026-09-07", "2026-10-18");
    const info = kikkoSub20HeatInfo("2026-09-08", "2026-09-07", "2026-10-18");
    expect(info.vdot).toBe(KIKKO_WEEK_VDOT[KIKKO_WEEK_VDOT.length - 6]);
    expect(sessions[0].target_pace).toBe(info.pace!.mid);
  });

  it("date non lunedì vengono riportate alla loro settimana", () => {
    const a = kikkoWindow(KIKKO_SUB20_PLAN, "2026-09-10", "2026-10-14");
    const b = kikkoWindow(KIKKO_SUB20_PLAN, "2026-09-07", "2026-10-12");
    expect(a).toEqual(b);
  });
});
