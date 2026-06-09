import type { Session } from "../types/api";

/**
 * Piano 5K sub-20:00 (Piano_5K_sub20.pdf, Daniele Pascolini).
 *
 * Soglia-centrico. 9 settimane in 3 blocchi + taper, ritmo gara 4:00/km,
 * obiettivo 19:59. Renderizzato nello stesso calendario del piano generico
 * (TrainingGrid): ogni seduta è una Session datata.
 *
 * Ritmo settimanale fisso:
 *   Martedì  → Qualità   (VO2max / ritmo gara)  → type "intervals" (rosso)
 *   Giovedì  → Soglia     (il motore della 5K)   → type "tempo"     (arancio)
 *   Venerdì  → Facoltativa (lento, solo se fresco) → type "recovery" (grigio)
 *   Domenica → Lungo       (base aerobica)        → type "long"      (verde)
 */

export const SUB20_META = {
  weeks: 9,
  phase: "Sub-20",
  goalRace: "5K",
  goalTime: "19:59",
  startDate: "2026-06-09",
};

const SLOT_TYPE = { qual: "intervals", soglia: "tempo", facolt: "recovery", lungo: "long" } as const;
const SLOT_OFFSET = { qual: 0, soglia: 2, facolt: 3, lungo: 5 } as const; // giorni dal martedì
const SLOT_DAY = { qual: "Martedì", soglia: "Giovedì", facolt: "Venerdì", lungo: "Domenica" } as const;

type Slot = keyof typeof SLOT_TYPE;
type Cell = { title: string; dist: number; pace: string | null; desc: string };
type WeekDef = { tue: string } & Partial<Record<Slot, Cell>>;

const pad = (n: number) => String(n).padStart(2, "0");
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function mk(date: string, day: string, type: string, c: Cell): Session {
  return {
    day,
    date,
    type,
    title: c.title,
    description: c.desc,
    target_distance_km: c.dist,
    target_pace: c.pace,
    target_duration_min: null,
    completed: false,
    run_id: null,
  };
}

// ── Le 9 settimane (martedì come riferimento di settimana) ───────────────────
const WEEKS: WeekDef[] = [
  // ── BLOCCO 1 · struttura e base soglia · soglia 4:32 → 4:28 → 4:25 ──
  {
    tue: "2026-06-09",
    qual: { title: "Ripetute 3×1000 @ 3:56", dist: 8, pace: "3:56", desc: "2 km riscaldamento, poi 3×1000 a 3:56/km (GAP) con recupero, 3 km defaticamento. VO2max e ritmo gara, all'alba." },
    soglia: { title: "Soglia 3×1500 @ 4:31", dist: 8, pace: "4:31", desc: "2 km facili + 3-4 allunghi (80-100 m), poi 3×1500 a 4:30-4:32 con recupero 90″ jog, 1,5 km defaticamento. Comodo-duro: sotto 4:25 è VO2max, rallenta." },
    facolt: { title: "Facoltativa 3-4 km", dist: 4, pace: "5:50", desc: "3-4 km molto lenti sul tapis (5:40-6:00). Solo se arrivi fresco; nel dubbio salta, non perdi nulla." },
    lungo: { title: "Lungo 11-12 km", dist: 11.5, pace: "5:35", desc: "11-12 km facili (5:25-5:50), tutto in conversazione. 4-5 allunghi rilassati a fine corsa." },
  },
  {
    tue: "2026-06-16",
    qual: { title: "Ripetute 4×1000 @ 4:00", dist: 8.5, pace: "4:00", desc: "Riscaldamento 2 km, poi 4×1000 a 4:00/km (ritmo gara) con recupero 2′, defaticamento." },
    soglia: { title: "Soglia 4×1500 @ 4:28", dist: 9, pace: "4:28", desc: "Soglia 4×1500 a 4:28/km, recupero 90″ jog. Volume soglia ~24′." },
    facolt: { title: "Facoltativa 3-4 km", dist: 4, pace: "5:50", desc: "3-4 km molto lenti. Salta se stanco." },
    lungo: { title: "Lungo 12 km", dist: 12, pace: "5:35", desc: "12 km facili in conversazione, allunghi rilassati a fine corsa." },
  },
  {
    tue: "2026-06-23",
    qual: { title: "Ripetute 6×800 @ 3:55", dist: 8, pace: "3:55", desc: "Riscaldamento, 6×800 a 3:55/km recupero 90″, defaticamento. Velocità VO2max." },
    soglia: { title: "Soglia 2×12′ @ 4:25", dist: 9, pace: "4:25", desc: "Soglia 2×12′ a 4:25/km, recupero 2-3′. Blocchi lunghi sostenuti." },
    facolt: { title: "Facoltativa 3-4 km", dist: 4, pace: "5:50", desc: "3-4 km molto lenti. Solo se fresco." },
    lungo: { title: "Lungo 13 km", dist: 13, pace: "5:30", desc: "13 km facili, costruzione della base aerobica." },
  },

  // ── BLOCCO 2 · affilare la soglia e specificità · soglia 4:22 → 4:18 → 4:15 ──
  {
    tue: "2026-06-30",
    qual: { title: "Ripetute 6×800 @ 3:52", dist: 8, pace: "3:52", desc: "6×800 a 3:52/km recupero 90″. Affilare la velocità." },
    soglia: { title: "Soglia 4×1500 @ 4:22", dist: 9, pace: "4:22", desc: "Soglia 4×1500 a 4:22/km recupero 90″. La soglia si abbassa." },
    facolt: { title: "Facoltativa 3-4 km", dist: 4, pace: "5:50", desc: "3-4 km molto lenti. Salta se stanco." },
    lungo: { title: "Lungo 13 km", dist: 13, pace: "5:30", desc: "13 km facili in conversazione." },
  },
  {
    tue: "2026-07-07",
    qual: { title: "Ripetute 5×1000 @ 3:58", dist: 9, pace: "3:58", desc: "5×1000 a 3:58/km recupero 2′. Resistenza al ritmo gara." },
    soglia: { title: "Soglia 2×13′ @ 4:18", dist: 9, pace: "4:18", desc: "Soglia 2×13′ a 4:18/km recupero 2-3′. Fino a 26-28′ totali." },
    facolt: { title: "Facoltativa 3-4 km", dist: 4, pace: "5:50", desc: "3-4 km molto lenti. Solo se fresco." },
    lungo: { title: "Lungo 14 km · finale steady", dist: 14, pace: "5:25", desc: "14 km facili: gli ultimi 3 km steady a ~4:55/km." },
  },
  {
    tue: "2026-07-14",
    qual: { title: "Ritmo gara 2×2000 @ 4:00", dist: 9, pace: "4:00", desc: "Primo ritmo gara lungo: 2×2000 a 4:00/km recupero 3′. Reggere il passo su tratti lunghi." },
    soglia: { title: "Soglia 28′ continui @ 4:15", dist: 9, pace: "4:15", desc: "Soglia continua 28′ a 4:15/km. Il motore al massimo del blocco." },
    facolt: { title: "Facoltativa 3-4 km", dist: 4, pace: "5:50", desc: "3-4 km molto lenti. Salta se stanco." },
    lungo: { title: "Lungo 14 km", dist: 14, pace: "5:25", desc: "14 km facili in conversazione." },
  },

  // ── BLOCCO 3 · specifico 5K · soglia mantenimento ~4:15 ──
  {
    tue: "2026-07-21",
    qual: { title: "Ritmo gara 5×1000 @ 3:58", dist: 9, pace: "3:58", desc: "Ritmo gara protagonista: 5×1000 a 3:58/km recupero 2′." },
    soglia: { title: "Soglia 25′ @ 4:15", dist: 8, pace: "4:15", desc: "Soglia di mantenimento 25′ a 4:15/km. Non si spinge all'infinito." },
    facolt: { title: "Facoltativa 3-4 km", dist: 4, pace: "5:50", desc: "3-4 km molto lenti. Solo se fresco." },
    lungo: { title: "Lungo 12 km", dist: 12, pace: "5:30", desc: "12 km facili." },
  },
  {
    tue: "2026-07-28",
    qual: { title: "TEST 3 km a tutta", dist: 3, pace: "3:48", desc: "Test a metà blocco: 3 km a tutta (o 5K vera) per tarare la forma. Riscaldamento 2 km + defaticamento. Dà il VDOT reale." },
    soglia: { title: "Soglia 20′ @ 4:15", dist: 7, pace: "4:15", desc: "Soglia leggera 20′ a 4:15/km (settimana del test)." },
    facolt: { title: "Facoltativa 3-4 km", dist: 4, pace: "5:50", desc: "3-4 km molto lenti. Salta se stanco." },
    lungo: { title: "Lungo 13 km", dist: 13, pace: "5:30", desc: "13 km facili in conversazione." },
  },
  {
    tue: "2026-08-04",
    qual: { title: "5K spezzata 3000+2000 @ 4:00", dist: 9, pace: "4:00", desc: "5K spezzata: 3000 + 2000 a 4:00/km con recupero 3′. Quasi la gara, divisa in due." },
    soglia: { title: "Soglia 25′ @ 4:15", dist: 8, pace: "4:15", desc: "Soglia di mantenimento 25′ a 4:15/km." },
    facolt: { title: "Facoltativa 3-4 km", dist: 4, pace: "5:50", desc: "3-4 km molto lenti. Solo se fresco." },
    lungo: { title: "Lungo 12 km", dist: 12, pace: "5:30", desc: "12 km facili." },
  },
];

function buildWeeks(): Session[] {
  const out: Session[] = [];
  for (const w of WEEKS) {
    (Object.keys(SLOT_TYPE) as Slot[]).forEach((slot) => {
      const cell = w[slot];
      if (!cell) return;
      out.push(mk(addDays(w.tue, SLOT_OFFSET[slot]), SLOT_DAY[slot], SLOT_TYPE[slot], cell));
    });
  }
  return out;
}

// ── Taper + gara (volume −30/40%, una spruzzata di intensità, poi gara) ──────
const TAPER_AND_RACE: Session[] = [
  mk("2026-08-11", "Martedì", "intervals", { title: "Taper · 4×400 @ 4:00", dist: 5, pace: "4:00", desc: "Taper: 3-4×400 a ritmo gara con recupero ampio. Solo per tenere il tono, niente fatica." }),
  mk("2026-08-14", "Venerdì", "recovery", { title: "Facoltativa 4 km", dist: 4, pace: "5:50", desc: "4 km molto lenti, sciolti. Gambe fresche." }),
  mk("2026-08-18", "Martedì", "intervals", { title: "Rifinitura 3×300 @ 4:00", dist: 4, pace: "4:00", desc: "Ultima rifinitura: 3×300 a ritmo gara, recupero pieno. Affilare senza svuotare." }),
  mk("2026-08-21", "Venerdì", "recovery", { title: "Sciolto 20′ + allunghi", dist: 4, pace: "5:45", desc: "20′ sciolti + 3 allunghi brillanti. Pre-gara." }),
  mk("2026-08-23", "Domenica", "intervals", { title: "🏁 GARA 5K · sub 20:00", dist: 5, pace: "4:00", desc: "Giorno gara. Parti a 4:02-4:03 i primi 1-2 km, poi tieni e chiudi. A Roma fine agosto c'è caldo: se le condizioni sono proibitive, sposta a inizio settembre quando l'aria fresca ti ridà 3-5 sec/km." }),
];

export const SUB20_SESSIONS: Session[] = [...buildWeeks(), ...TAPER_AND_RACE];

// Legenda del calendario in modalità Sub-20
export const SUB20_LEGEND: { color: string; label: string; opacity?: number }[] = [
  { color: "#EF4444", label: "Qualità · VO2max" },
  { color: "#F97316", label: "Soglia" },
  { color: "#6B7280", label: "Facoltativa" },
  { color: "#10B981", label: "Lungo" },
  { color: "#2A2A2A", label: "Riposo", opacity: 0.3 },
];
