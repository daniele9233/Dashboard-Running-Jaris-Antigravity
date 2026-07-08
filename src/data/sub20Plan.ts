import type { Session } from "../types/api";

/**
 * Piano 5K sub-20:00 — riscrittura da zero (luglio 2026).
 *
 * Atleta: uomo, 40-49 anni, ~62-68 kg, 5K attuale 21:00 (VDOT ~48), volume di
 * partenza ~26 km/sett altalenante, 4 giorni/sett, forza 2x, nessun infortunio.
 * Obiettivo: 5K in 19:58 (VDOT ~50, ritmo gara 4:00/km) a TEMPERATURA IDEALE.
 *
 * Filosofia (fonti 2025-2026):
 *  · Soglia-centrico stile "norvegese singles / sub-soglia" (LT1-LT2, 2-4 mmol):
 *    tanto lavoro controllato, poche ripetute massacranti. Ideale per un master
 *    perché richiede meno recupero e regge un volume più alto in sicurezza.
 *  · Il vero limite non è la velocità ma il VOLUME: si costruisce da ~26 a
 *    ~44 km/sett con progressione ~10%/sett e settimane di scarico.
 *  · Periodizzazione sul CLIMA. Si parte a luglio con 25-35°C e umidità alta:
 *    in estate qualità a SENSAZIONE e ritmi adattati al caldo (+10-20 sec/km),
 *    quantità di soglia. L'acclimatazione estiva (volume plasmatico) paga in
 *    autunno. Il picco/gara è a INIZIO OTTOBRE, quando torna il fresco che
 *    regala 3-5 sec/km "gratis" — la temperatura ideale dell'obiettivo.
 *  · Niente salite (tutto pianeggiante o tapis con +1%). Qualità all'alba.
 *
 * 3 blocchi (11 settimane) + taper/gara (settimana 12). Ritmo settimanale:
 *   Martedì  → Qualità (soglia/fartlek → VO2/ritmo gara) → type "intervals" (rosso)
 *   Giovedì  → Soglia   (il motore della 5K)             → type "tempo"     (arancio)
 *   Sabato   → Facile + allunghi (volume aerobico)       → type "recovery"  (grigio)
 *   Domenica → Lungo    (base aerobica)                  → type "long"      (verde)
 * Forza 2x: martedì (dopo la qualità) + venerdì (giorno senza corsa).
 */

export const SUB20_META = {
  weeks: 12,
  phase: "Sub-20",
  goalRace: "5K",
  goalTime: "19:58",
  startDate: "2026-07-14",
};

const SLOT_TYPE = { qual: "intervals", soglia: "tempo", facolt: "recovery", lungo: "long" } as const;
const SLOT_OFFSET = { qual: 0, soglia: 2, facolt: 4, lungo: 5 } as const; // giorni dal martedì
const SLOT_DAY = { qual: "Martedì", soglia: "Giovedì", facolt: "Sabato", lungo: "Domenica" } as const;

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

// ── Le 11 settimane di costruzione (martedì = riferimento di settimana) ───────
const WEEKS: WeekDef[] = [
  // ═══ BLOCCO 1 · BASE + SOGLIA IN SICUREZZA (pieno caldo) ═══════════════════
  // Volume in salita dolce, qualità a sensazione. Soglia = ritmo tenibile ~1h.
  {
    tue: "2026-07-14",
    qual: { title: "Fartlek soglia 5×4′", dist: 8, pace: "4:40", desc: "2 km riscaldamento, poi 5×4′ comodo-duro (al fresco ~4:40/km) con 90″ jog di recupero, 2 km defaticamento. All'alba con 25°C+ e umido vai a SENSAZIONE: devi poter dire mezze frasi, non intere. Se il ritmo scappa a 4:55, va benissimo — conta lo stimolo, non il numero." },
    soglia: { title: "Soglia 2×10′ @ 4:42", dist: 8, pace: "4:42", desc: "2 km facili + 3 allunghi da 80 m, poi 2×10′ di soglia con 2′ jog, 2 km defaticamento. Spezzata in due per gestire il caldo; se ti svegli con una mattina fresca uniscili in 20′ continui. Porta acqua." },
    facolt: { title: "Facile 6 km + 4 allunghi", dist: 6, pace: "5:45", desc: "6 km molto facili (5:40-6:00) + 4 allunghi da 80 m rilassati e brillanti. Volume aerobico puro, zero fatica. Oggi o venerdì: forza in palestra (squat, affondi, core)." },
    lungo: { title: "Lungo 10 km", dist: 10, pace: "5:35", desc: "10 km facili in conversazione (5:25-5:50). Corri all'alba per il fresco, idratati bene. È il mattone della cilindrata aerobica: la base che ti mancava." },
  },
  {
    tue: "2026-07-21",
    qual: { title: "Fartlek soglia 6×4′", dist: 9, pace: "4:38", desc: "2 km riscaldamento, 6×4′ comodo-duro (~4:38/km al fresco) rec 75″ jog, 2 km defaticamento. Sempre a sensazione: soglia è uno sforzo che potresti quasi tenere per un'ora, mai affanno." },
    soglia: { title: "Soglia 2×12′ @ 4:40", dist: 9, pace: "4:40", desc: "2 km facili + allunghi, poi 2×12′ di soglia rec 2′ jog, defaticamento. 24′ totali di soglia: il cuore del metodo. Con caldo/umido rallenta di 10-15 sec/km e non sentirti in colpa." },
    facolt: { title: "Facile 7 km + allunghi", dist: 7, pace: "5:45", desc: "7 km facili + 4 allunghi. Costruzione aerobica. Forza il giorno prima o dopo." },
    lungo: { title: "Lungo 11 km", dist: 11, pace: "5:35", desc: "11 km facili in conversazione, all'alba. Aumenta di 1 km sul lungo della scorsa settimana." },
  },
  {
    tue: "2026-07-28",
    qual: { title: "Soglia lunga 3×8′ @ 4:38", dist: 9, pace: "4:38", desc: "2 km riscaldamento, 3×8′ di soglia rec 90″ jog, 2 km defaticamento. Blocchi più lunghi: alziamo il volume di qualità restando controllati. Se supera i 4:30 stai spingendo troppo, rallenta." },
    soglia: { title: "Soglia 25′ @ 4:38 (o 2×13′)", dist: 9, pace: "4:38", desc: "2 km facili + allunghi, 25′ di soglia continui (spezzabili in 2×13′ se umido), defaticamento. Il volume di soglia sale: è ciò che sposta la 5K." },
    facolt: { title: "Facile 8 km", dist: 8, pace: "5:40", desc: "8 km facili (5:35-5:55). Semplice volume aerobico, corri sciolto." },
    lungo: { title: "Lungo 12 km", dist: 12, pace: "5:30", desc: "12 km facili, all'alba. Picco di volume del primo blocco: da qui si scarica." },
  },
  {
    tue: "2026-08-04",
    qual: { title: "Fartlek breve 8×2′ brillanti", dist: 7, pace: "4:20", desc: "SETTIMANA DI SCARICO (-25%): 8×2′ a passo brillante ma controllato (~4:20/km) rec 2′ jog, riscaldamento e defaticamento. Riattiva le gambe senza svuotarti: serve ad ASSORBIRE il blocco, non ad aggiungere fatica." },
    soglia: { title: "Soglia leggera 2×8′ @ 4:40", dist: 7, pace: "4:40", desc: "2×8′ di soglia rec 2′, corti e puliti. Settimana di recupero: esci sentendoti fresco, non provato." },
    facolt: { title: "Facile 5 km", dist: 5, pace: "5:50", desc: "5 km molto lenti e sciolti. Recupero attivo." },
    lungo: { title: "Lungo corto 10 km", dist: 10, pace: "5:35", desc: "10 km facili. Lungo ridotto per la settimana di scarico: assorbi e ricarica." },
  },

  // ═══ BLOCCO 2 · SOGLIA SPECIFICA + INTRODUZIONE VO2 (clima che si addolcisce) ═
  // L'aria inizia a rinfrescare: rientrano le ripetute a ritmo gara/VO2.
  {
    tue: "2026-08-11",
    qual: { title: "Ripetute 5×1000 @ 4:08", dist: 9, pace: "4:08", desc: "Prima seduta VO2/critica del piano: 2 km riscaldamento, 5×1000 a 4:08/km rec 2′ jog, defaticamento. Con l'aria più fresca puoi avvicinarti al passo; se resta caldo/umido tieni 4:12-4:15, conta lo stimolo. Mai partire troppo forte al primo." },
    soglia: { title: "Soglia 3×10′ @ 4:32", dist: 9, pace: "4:32", desc: "3×10′ di soglia rec 90″ jog, 30′ totali di qualità aerobica. La soglia si abbassa verso i valori reali man mano che il clima aiuta." },
    facolt: { title: "Facile 8 km + allunghi", dist: 8, pace: "5:40", desc: "8 km facili + 4 allunghi. Volume aerobico + richiamo neuromuscolare." },
    lungo: { title: "Lungo 13 km", dist: 13, pace: "5:30", desc: "13 km facili in conversazione. Il lungo cresce: resistenza aerobica di fondo." },
  },
  {
    tue: "2026-08-18",
    qual: { title: "Ripetute 6×1000 @ 4:06", dist: 10, pace: "4:06", desc: "6×1000 a 4:06/km rec 2′ jog, con riscaldamento e defaticamento. Volume a ritmo critico in crescita. Resta 'controllato-duro': l'ultimo 1000 deve essere il migliore, non un'agonia." },
    soglia: { title: "Soglia 2×15′ @ 4:30", dist: 10, pace: "4:30", desc: "2×15′ di soglia rec 3′ jog. Blocchi lunghi sostenuti a 4:30: il motore che regge i 4:00 in gara si costruisce qui." },
    facolt: { title: "Facile 9 km", dist: 9, pace: "5:40", desc: "9 km facili. Semplice, sciolto, aerobico." },
    lungo: { title: "Lungo 14 km", dist: 14, pace: "5:28", desc: "14 km facili in conversazione. Massimo lungo finora." },
  },
  {
    tue: "2026-08-25",
    qual: { title: "VO2 8×800 @ 4:00", dist: 10, pace: "4:00", desc: "8×800 a 4:00/km (ritmo ~5K) rec 90″ jog, riscaldamento e defaticamento. Il ritmo gara che diventa familiare a piccole dosi. Passo costante su tutte le ripetute." },
    soglia: { title: "Soglia 30′ continui @ 4:30", dist: 10, pace: "4:30", desc: "30′ di soglia continui a 4:30/km: il picco del volume di soglia del piano. Se preferisci, 2×16′ rec 2′. Mentalmente ti prepara a reggere il ritmo a lungo." },
    facolt: { title: "Facile 9 km + allunghi", dist: 9, pace: "5:38", desc: "9 km facili + 4 allunghi brillanti." },
    lungo: { title: "Lungo 15 km · finale steady", dist: 15, pace: "5:25", desc: "15 km facili: gli ultimi 3 km a ~5:00/km (steady). Picco di volume del secondo blocco." },
  },
  {
    tue: "2026-09-01",
    qual: { title: "TEST 3 km a tutta", dist: 6, pace: "3:52", desc: "SETTIMANA DI SCARICO + TEST. 2 km riscaldamento + 3 km a tutta + defaticamento. Cerca una mattina fresca e un tratto piatto. Dà il VDOT reale e taratura i ritmi del blocco finale: 3 km attorno a 11:30-11:45 (3:50-3:55/km) = sei in linea per sub-20. Segna il tempo." },
    soglia: { title: "Soglia leggera 20′ @ 4:30", dist: 7, pace: "4:30", desc: "20′ di soglia leggeri, settimana del test: niente eroismi, gambe fresche per il 3 km." },
    facolt: { title: "Facile 6 km", dist: 6, pace: "5:45", desc: "6 km molto facili. Recupero attivo in settimana di scarico." },
    lungo: { title: "Lungo 12 km", dist: 12, pace: "5:30", desc: "12 km facili. Lungo ridotto per assorbire e arrivare freschi al blocco specifico." },
  },

  // ═══ BLOCCO 3 · SPECIFICO 5K · RITMO GARA + VO2 (fresco: si pretende il passo) ═
  {
    tue: "2026-09-08",
    qual: { title: "Ritmo gara 5×1000 @ 4:00", dist: 10, pace: "4:00", desc: "Il ritmo gara diventa protagonista: 5×1000 a 4:00/km rec 2′ jog. Ormai fa fresco, pretendi il passo. Deve sembrare 'controllato-duro', non massimale: se l'ultimo 1000 crolla, il recupero era troppo corto o sei partito forte." },
    soglia: { title: "Soglia 3×10′ @ 4:26", dist: 10, pace: "4:26", desc: "3×10′ di soglia a 4:26/km rec 90″: soglia affilata sui valori da sub-20. Mantieni il motore mentre la specificità sale." },
    facolt: { title: "Facile 9 km + allunghi", dist: 9, pace: "5:35", desc: "9 km facili + 4 allunghi. Gambe brillanti tra le sedute dure." },
    lungo: { title: "Lungo 14 km", dist: 14, pace: "5:25", desc: "14 km facili in conversazione. Il lungo resta alto: la base non si tocca fino al taper." },
  },
  {
    tue: "2026-09-15",
    qual: { title: "Simulazione 2×2000 @ 4:00", dist: 10, pace: "4:00", desc: "2×2000 a ritmo gara (4:00/km) rec 3′ jog, con riscaldamento e defaticamento. Reggere il 4:00 su tratti lunghi è LA competenza della sub-20. Il pezzo forte del blocco: se tieni due 2000 a 4:00, i 5000 sono a portata." },
    soglia: { title: "Soglia 25′ @ 4:24 + 4×200", dist: 10, pace: "4:24", desc: "25′ di soglia a 4:24/km, poi 4×200 brillanti (~3:40/km) rec 200 m camminando. Soglia + affondi finali per la brillantezza. Chiudi svuotando la benzina, non le energie." },
    facolt: { title: "Facile 8 km", dist: 8, pace: "5:35", desc: "8 km facili, sciolti. Recupero tra le due sedute chiave." },
    lungo: { title: "Lungo 13 km", dist: 13, pace: "5:25", desc: "13 km facili. Si inizia a limare leggermente il volume verso il picco di forma." },
  },
  {
    tue: "2026-09-22",
    qual: { title: "5K spezzata 3000+2000 @ 4:00", dist: 10, pace: "4:00", desc: "Quasi la gara: 3000 + 2000 a 4:00/km con 3′ di recupero. Ultima grande botta di specificità prima del taper. Se la chiudi bene, il sub-20 è dentro le gambe: fidati e inizia a scaricare." },
    soglia: { title: "Soglia 20′ @ 4:24", dist: 8, pace: "4:24", desc: "20′ di soglia a 4:24/km: mantenimento, non si spinge oltre. Da qui il volume cala per far emergere la freschezza." },
    facolt: { title: "Facile 7 km + allunghi", dist: 7, pace: "5:35", desc: "7 km facili + 4 allunghi. Pre-taper: gambe leggere." },
    lungo: { title: "Lungo 12 km", dist: 12, pace: "5:28", desc: "12 km facili. Ultimo lungo pieno prima della gara." },
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

// ═══ SETTIMANA 12 · TAPER + GARA (volume −45%, si tiene la brillantezza) ══════
const TAPER_AND_RACE: Session[] = [
  mk("2026-09-29", "Martedì", "intervals", { title: "Taper · 6×400 @ 3:52", dist: 6, pace: "3:52", desc: "TAPER. 2 km riscaldamento, 6×400 brillanti (~3:52/km) rec 200 m jog, defaticamento. Tiene il tono neuromuscolare senza affaticare: esci sentendoti veloce e riposato, non stanco." }),
  mk("2026-10-01", "Giovedì", "tempo", { title: "Sblocco 3×1000 @ 4:00", dist: 7, pace: "4:00", desc: "3×1000 a ritmo gara rec 2′ jog. Ultimo richiamo del passo con gambe fresche. Deve sembrare facile: è il segno che il taper sta funzionando. Poi solo riposo, idratazione e sonno." }),
  mk("2026-10-03", "Sabato", "recovery", { title: "Sciolto 20′ + 4 allunghi", dist: 5, pace: "5:40", desc: "20′ sciolti + 4 allunghi progressivi. Rifinitura pre-gara: scarica le gambe. Da oggi cura idratazione, carboidrati e sonno. Controlla il meteo: punta alla mattina più fresca." }),
  mk("2026-10-04", "Domenica", "intervals", { title: "🏁 GARA 5K · sub 20:00", dist: 5, pace: "4:00", desc: "GIORNO GARA. Riscaldamento 15′ + 4 allunghi. Strategia negativa: 4:01-4:02 il 1° km (MAI più veloce), 4:00 nei km centrali, dal 4° km svuota tutto. Split ideale 4:02/4:00/4:00/3:59/a tutta = 19:5x. Con 12-16°C il tuo motore vale sub-20. Se la giornata è calda/umida (>22°C) sposta di qualche giorno: il fresco vale 3-5 sec/km, non regalarli." }),
];

export const SUB20_SESSIONS: Session[] = [...buildWeeks(), ...TAPER_AND_RACE];

// Legenda del calendario in modalità Sub-20
export const SUB20_LEGEND: { color: string; label: string; opacity?: number }[] = [
  { color: "#EF4444", label: "Qualità · VO2 / ritmo gara" },
  { color: "#F97316", label: "Soglia" },
  { color: "#6B7280", label: "Facile · aerobico" },
  { color: "#10B981", label: "Lungo" },
  { color: "#2A2A2A", label: "Riposo", opacity: 0.3 },
];
