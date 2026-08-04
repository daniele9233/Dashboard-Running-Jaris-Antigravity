import { describe, it, expect } from "vitest";
import { buildTree, runYield, RESOURCES, RES_ORDER, TREE } from "./skillTreeEngine";
import { ZONES } from "./gamiCore";
import type { Run } from "../../types/api";

/**
 * La promessa della v3 è che il TIPO di seduta determini cosa sblocchi. Se una
 * montagna di lenti aprisse anche il ramo Potenza, l'albero sarebbe solo un
 * contatore di chilometri travestito. Qui si verifica che i rami restino
 * separati e che il nodo si apra sul materiale più indietro, non sulla media.
 */

let seq = 0;
const mkRun = (over: Partial<Run> & Record<string, unknown> = {}): Run =>
  ({
    id: `r${++seq}`, date: "2026-05-04", distance_km: 10, duration_minutes: 50,
    avg_pace: "5:00", avg_hr: null, max_hr: null, avg_hr_pct: null, max_hr_pct: null,
    run_type: "easy", notes: null, location: "Rome", strava_id: null,
    avg_cadence: null, elevation_gain: 0, splits: [], polyline: null,
    start_latlng: null, plan_feedback: null, avg_vertical_oscillation: null,
    avg_vertical_ratio: null, avg_ground_contact_time: null, avg_stride_length: null,
    is_treadmill: false, name: null, temperature: 12, ...over,
  }) as unknown as Run;

const pace = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
/**
 * Le corse di prova portano sempre la FC%: senza, la zona si deduce dal passo
 * RELATIVO al proprio migliore, e una serie di corse tutte uguali finirebbe
 * classificata come sforzo massimale. Sui dati veri la FC c'è.
 */
const series = (n: number, startIso: string, km: number, paceSec: number, over: Partial<Run> = {}) => {
  const out: Run[] = [];
  const d0 = new Date(startIso + "T00:00:00Z").getTime();
  for (let i = 0; i < n; i++) {
    out.push(mkRun({
      date: new Date(d0 + i * 2 * 86400000).toISOString().slice(0, 10),
      distance_km: km, duration_minutes: (km * paceSec) / 60, avg_pace: pace(paceSec),
      avg_hr_pct: 74, ...over,
    }));
  }
  return out;
};

describe("una corsa produce materiali diversi a seconda di cos'era", () => {
  it("il lento dà Fondo e non dà Potenza", () => {
    const y = runYield(12, 66, ZONES.easy);
    expect(y.fondo).toBeGreaterThan(0);
    expect(y.potenza ?? 0).toBe(0);
    expect(y.soglia ?? 0).toBe(0);
  });

  it("le ripetute sono l'unica fonte di Potenza", () => {
    const y = runYield(11, 55, ZONES.vo2);
    expect(y.potenza).toBeGreaterThan(0);
    // producono anche km, ma molto meno di un lento della stessa distanza
    const easy = runYield(11, 60, ZONES.easy);
    expect(y.fondo!).toBeLessThan(easy.fondo!);
  });

  it("la Tenuta la dà la durata, non l'intensità", () => {
    const short = runYield(8, 40, ZONES.easy);
    const long = runYield(20, 110, ZONES.easy);
    expect(short.tenuta ?? 0).toBe(0);
    expect(long.tenuta).toBeGreaterThan(0);
  });

  it("un medio lungo lavora anche sulla soglia", () => {
    const y = runYield(12, 55, ZONES.medium);
    expect(y.soglia).toBeGreaterThan(0);
    expect(y.fondo).toBeGreaterThan(0);
  });
});

describe("i rami restano separati", () => {
  it("mille chilometri di lento non aprono un solo nodo di Potenza", () => {
    const st = buildTree(series(100, "2025-01-06", 12, 330), "2026-01-06T12:00:00Z");
    expect(st.res.fondo).toBeGreaterThan(200);
    expect(st.res.potenza).toBe(0);
    const potenzaNodes = st.nodes.filter((n) => n.branch === "potenza");
    expect(potenzaNodes.every((n) => !n.unlocked)).toBe(true);
    // e la pagina lo dice chiaramente invece di dare una stima finta
    expect(potenzaNodes[0].weeks).toBeNull();
    expect(potenzaNodes[0].blockedBy?.id).toBe("potenza");
  });

  it("il ramo più indietro è quello che il pannello segnala", () => {
    // lenti lunghi più qualche soglia: l'unico ramo mai alimentato è la Potenza
    const st = buildTree([
      ...series(60, "2025-06-02", 12, 330),
      ...series(20, "2025-08-01", 8, 250, { run_type: "tempo", avg_hr_pct: 88 }),
    ], "2026-01-06T12:00:00Z");
    expect(st.res.potenza).toBe(0);
    expect(st.res.soglia).toBeGreaterThan(0);
    expect(st.weakest?.id).toBe("potenza");
    expect(st.strongest?.id).not.toBe("potenza");
  });
});

describe("un nodo si apre sul materiale più indietro, non sulla media", () => {
  it("un capstone con un solo materiale mancante resta chiuso", () => {
    // tanto fondo e tanta soglia, zero potenza: cap-5k22 chiede tutti e tre
    const runs = [
      ...series(60, "2025-06-02", 14, 330),
      ...series(40, "2025-06-03", 8, 250, { run_type: "tempo", avg_hr_pct: 88 }),
    ];
    const st = buildTree(runs, "2026-01-06T12:00:00Z");
    const cap = st.nodes.find((n) => n.id === "cap-5k22")!;
    expect(cap.unlocked).toBe(false);
    expect(cap.blockedBy?.id).toBe("potenza");
    // la percentuale riflette il ramo bloccato, non la media dei tre
    expect(cap.pct).toBe(0);
  });

  it("quando i materiali bastano il nodo è aperto e al 100%", () => {
    const st = buildTree(series(40, "2025-09-01", 10, 330), "2026-01-06T12:00:00Z");
    const n = st.nodes.find((x) => x.id === "fondo-1")!;
    expect(n.unlocked).toBe(true);
    expect(n.pct).toBe(100);
    expect(n.missing).toHaveLength(0);
  });
});

describe("le stime", () => {
  it("le settimane mancanti scendono man mano che il materiale arriva", () => {
    const few = buildTree(series(8, "2025-11-03", 10, 330), "2026-01-06T12:00:00Z");
    const many = buildTree(series(24, "2025-11-03", 10, 330), "2026-01-06T12:00:00Z");
    const a = few.nodes.find((n) => n.id === "fondo-2")!;
    const b = many.nodes.find((n) => n.id === "fondo-2")!;
    expect(a.weeks).not.toBeNull();
    expect(b.weeks!).toBeLessThan(a.weeks!);
  });

  it("le sedute simulate producono gli stessi materiali dello storico", () => {
    const st = buildTree(series(20, "2025-11-03", 10, 330), "2026-01-06T12:00:00Z");
    const reps = st.plays.find((p) => p.id === "reps")!;
    const easy = st.plays.find((p) => p.id === "easy")!;
    expect(reps.yields.some((y) => y.res.id === "potenza")).toBe(true);
    expect(easy.yields.some((y) => y.res.id === "potenza")).toBe(false);
    expect(easy.yields.some((y) => y.res.id === "fondo")).toBe(true);
  });
});

describe("struttura dell'albero", () => {
  it("ogni nodo ha un costo, un effetto e una via per arrivarci", () => {
    for (const n of TREE) {
      expect(RES_ORDER.some((k) => (n.cost[k] ?? 0) > 0)).toBe(true);
      expect(n.effect.length).toBeGreaterThan(20);
      expect(n.howTo.length).toBeGreaterThan(10);
    }
  });

  it("dentro un ramo i costi salgono di tier", () => {
    for (const k of RES_ORDER) {
      const tiers = TREE.filter((n) => n.branch === k).sort((a, b) => a.tier - b.tier);
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].cost[k]!).toBeGreaterThan(tiers[i - 1].cost[k]!);
      }
    }
  });

  it("gli id dei materiali usati nei costi esistono davvero", () => {
    for (const n of TREE) {
      for (const k of Object.keys(n.cost)) expect(RESOURCES[k as keyof typeof RESOURCES]).toBeDefined();
    }
  });

  it("senza corse non finge un albero vuoto ma valido", () => {
    expect(buildTree([]).ok).toBe(false);
  });
});
