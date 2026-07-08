import type { Session } from "../types/api";

/**
 * Piano 5K sub-20:00 — riscrittura da zero (luglio 2026), versione 10 settimane.
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
 *    autunno. Il picco/gara è a FINE SETTEMBRE, quando torna il fresco che
 *    regala 3-5 sec/km "gratis" — la temperatura ideale dell'obiettivo.
 *  · Niente salite (tutto pianeggiante o tapis con +1%). Qualità all'alba.
 *
 * 10 settimane: 9 di costruzione (3 blocchi) + taper/gara (settimana 10).
 * Ritmo settimanale:
 *   Martedì  → Qualità (soglia/fartlek → VO2/ritmo gara) → type "intervals" (rosso)
 *   Giovedì  → Soglia   (il motore della 5K)             → type "tempo"     (arancio)
 *   Sabato   → Facile + allunghi (volume aerobico)       → type "recovery"  (grigio)
 *   Domenica → Lungo    (base aerobica)                  → type "long"      (verde)
 * Forza 2x: martedì (dopo la qualità) + venerdì (giorno senza corsa).
 */

export const SUB20_META = {
  weeks: 10,
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

// ── Le 9 settimane di costruzione (martedì = riferimento di settimana) ────────
const WEEKS: WeekDef[] = [
  // ═══ BLOCCO 1 · BASE + SOGLIA IN SICUREZZA (pieno caldo) ═══════════════════
  {
    tue: "2026-07-14",
    qual: { title: "Fartlek soglia 5×4′", dist: 8, pace: "4:40", desc: "2 km riscaldamento, poi 5×4′ comodo-duro (al fresco ~4:40/km) con 90″ jog di recupero, 2 km defaticamento. All'alba con 25°C+ e umido vai a SENSAZIONE: devi poter dire mezze frasi, non intere. Se il ritmo scappa a 4:55, va benissimo — conta lo stimolo, non il numero." },
    soglia: { title: "Soglia 2×10′ @ 4:42", dist: 8, pace: "4:42", desc: "2 km facili + 3 allunghi da 80 m, poi 2×10′ di soglia con 2′ jog, 2 km defaticamento. Soglia = ritmo che potresti quasi tenere ~1 ora. Spezzata in due per il caldo; se ti svegli con una mattina fresca uniscili in 20′ continui. Porta acqua." },
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

  // ═══ BLOCCO 2 · SOGLIA SPECIFICA + VO2 (clima che si addolcisce) ═══════════
  {
    tue: "2026-08-11",
    qual: { title: "Ripetute 5×1000 @ 4:08", dist: 9, pace: "4:08", desc: "Prima seduta VO2/critica del piano: 2 km riscaldamento, 5×1000 a 4:08/km rec 2′ jog, defaticamento. Con l'aria più fresca puoi avvicinarti al passo; se resta caldo/umido tieni 4:12-4:15, conta lo stimolo. Mai partire troppo forte al primo." },
    soglia: { title: "Soglia 3×10′ @ 4:32", dist: 9, pace: "4:32", desc: "3×10′ di soglia rec 90″ jog, 30′ totali di qualità aerobica. La soglia si abbassa verso i valori reali man mano che il clima aiuta." },
    facolt: { title: "Facile 8 km + allunghi", dist: 8, pace: "5:40", desc: "8 km facili + 4 allunghi. Volume aerobico + richiamo neuromuscolare." },
    lungo: { title: "Lungo 13 km", dist: 13, pace: "5:30", desc: "13 km facili in conversazione. Il lungo cresce: resistenza aerobica di fondo." },
  },
  {
    tue: "2026-08-18",
    qual: { title: "Ripetute 6×1000 @ 4:05", dist: 10, pace: "4:05", desc: "6×1000 a 4:05/km rec 2′ jog, con riscaldamento e defaticamento. Volume a ritmo critico in crescita. Resta 'controllato-duro': l'ultimo 1000 deve essere il migliore, non un'agonia." },
    soglia: { title: "Soglia 2×15′ @ 4:30", dist: 10, pace: "4:30", desc: "2×15′ di soglia rec 3′ jog. Blocchi lunghi sostenuti a 4:30: il motore che regge i 4:00 in gara si costruisce qui." },
    facolt: { title: "Facile 9 km", dist: 9, pace: "5:40", desc: "9 km facili. Semplice, sciolto, aerobico." },
    lungo: { title: "Lungo 14 km", dist: 14, pace: "5:28", desc: "14 km facili in conversazione. Massimo lungo finora." },
  },
  {
    tue: "2026-08-25",
    qual: { title: "VO2 8×800 @ 4:00", dist: 10, pace: "4:00", desc: "8×800 a 4:00/km (ritmo ~5K) rec 90″ jog, riscaldamento e defaticamento. Il ritmo gara che diventa familiare a piccole dosi. Passo costante su tutte le ripetute: se l'ultima è la più veloce, hai fatto centro." },
    soglia: { title: "Soglia 30′ continui @ 4:28", dist: 10, pace: "4:28", desc: "30′ di soglia continui a 4:28/km: il picco del volume di soglia del piano. Se preferisci, 2×16′ rec 2′. Mentalmente ti prepara a reggere il ritmo a lungo." },
    facolt: { title: "Facile 9 km + allunghi", dist: 9, pace: "5:38", desc: "9 km facili + 4 allunghi brillanti." },
    lungo: { title: "Lungo 15 km · finale steady", dist: 15, pace: "5:25", desc: "15 km facili: gli ultimi 3 km a ~5:00/km (steady). Picco di volume del piano." },
  },
  {
    tue: "2026-09-01",
    qual: { title: "TEST 3 km a tutta", dist: 6, pace: "3:52", desc: "SETTIMANA DI SCARICO + TEST. 2 km riscaldamento + 3 km a tutta + defaticamento. Cerca una mattina fresca e un tratto piatto. Dà il VDOT reale e taratura i ritmi del finale: 3 km attorno a 11:30-11:45 (3:50-3:55/km) = sei in linea per sub-20. Segna il tempo." },
    soglia: { title: "Soglia leggera 20′ @ 4:28", dist: 7, pace: "4:28", desc: "20′ di soglia leggeri, settimana del test: niente eroismi, gambe fresche per il 3 km." },
    facolt: { title: "Facile 6 km", dist: 6, pace: "5:45", desc: "6 km molto facili. Recupero attivo in settimana di scarico." },
    lungo: { title: "Lungo 12 km", dist: 12, pace: "5:30", desc: "12 km facili. Lungo ridotto per assorbire e arrivare freschi al blocco specifico." },
  },

  // ═══ BLOCCO 3 · SPECIFICO 5K · RITMO GARA (fresco: si pretende il passo) ════
  {
    tue: "2026-09-08",
    qual: { title: "Simulazione 2×2000 @ 4:00", dist: 10, pace: "4:00", desc: "La seduta della fiducia: 2 km riscaldamento, 2×2000 a ritmo gara (4:00/km) rec 3′ jog, defaticamento. Reggere il 4:00 su tratti lunghi è LA competenza della sub-20. Ormai fa fresco: pretendi il passo, 'controllato-duro' non massimale. Se chiudi bene, i 5000 sono nelle gambe." },
    soglia: { title: "Soglia 3×8′ @ 4:24 + 4×200", dist: 10, pace: "4:24", desc: "3×8′ di soglia a 4:24/km rec 90″, poi 4×200 brillanti (~3:40/km) rec 200 m camminando. Soglia affilata sui valori da sub-20 + affondi finali per la brillantezza." },
    facolt: { title: "Facile 8 km + allunghi", dist: 8, pace: "5:35", desc: "8 km facili + 4 allunghi. Gambe leggere tra le sedute chiave." },
    lungo: { title: "Lungo 13 km", dist: 13, pace: "5:25", desc: "13 km facili. Ultimo lungo pieno: da qui si scarica verso la gara." },
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

// ═══ SETTIMANA 10 · TAPER + GARA (volume −45%, si tiene la brillantezza) ══════
const TAPER_AND_RACE: Session[] = [
  mk("2026-09-15", "Martedì", "intervals", { title: "Taper · 6×400 @ 3:52", dist: 6, pace: "3:52", desc: "TAPER. 2 km riscaldamento, 6×400 brillanti (~3:52/km) rec 200 m jog, defaticamento. Tiene il tono neuromuscolare senza affaticare: esci sentendoti veloce e riposato, non stanco." }),
  mk("2026-09-17", "Giovedì", "tempo", { title: "Sblocco 3×1000 @ 4:00", dist: 7, pace: "4:00", desc: "3×1000 a ritmo gara rec 2′ jog. Ultimo richiamo del passo con gambe fresche. Deve sembrare facile: è il segno che il taper sta funzionando. Poi solo riposo, idratazione e sonno." }),
  mk("2026-09-19", "Sabato", "recovery", { title: "Sciolto 20′ + 4 allunghi", dist: 5, pace: "5:40", desc: "20′ sciolti + 4 allunghi progressivi. Rifinitura pre-gara: scarica le gambe. Da oggi cura idratazione, carboidrati e sonno. Controlla il meteo: punta alla mattina più fresca." }),
  mk("2026-09-20", "Domenica", "intervals", { title: "🏁 GARA 5K · sub 20:00", dist: 5, pace: "4:00", desc: "GIORNO GARA. Riscaldamento 15′ + 4 allunghi. Strategia a negativo: 4:01-4:02 il 1° km (MAI più veloce), 4:00 nei km centrali, dal 4° km svuota tutto. Split ideale 4:02/4:00/4:00/3:59/a tutta = 19:5x. Con 12-16°C il tuo motore vale sub-20. Se la giornata è calda/umida (>22°C) sposta di qualche giorno: il fresco vale 3-5 sec/km, non regalarli." }),
];

// Piano "base", ancorato alla partenza di default (Martedì della settimana 1).
export const SUB20_SESSIONS: Session[] = [...buildWeeks(), ...TAPER_AND_RACE];

// ── Partenza scelta dall'utente ──────────────────────────────────────────────
// Il piano è agganciato al MARTEDÌ della settimana 1. L'utente può spostare la
// partenza: si trasla l'intero calendario di un multiplo di 7 giorni, così i
// giorni Mar/Gio/Sab/Dom (e i nomi) restano coerenti e la gara resta di domenica.

export const SUB20_DEFAULT_START = SUB20_META.startDate; // "2026-07-14" (un martedì)

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Primo Martedì ≥ della data passata (per agganciare la partenza a un martedì). */
export function snapToStartTuesday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0=Dom … 2=Mar
  return addDays(iso, (2 - dow + 7) % 7);
}

/** Ricostruisce il piano spostato a una nuova partenza (deve essere un martedì). */
export function buildSub20Sessions(startTuesday?: string | null): Session[] {
  const start = startTuesday || SUB20_DEFAULT_START;
  const delta = daysBetween(SUB20_DEFAULT_START, start);
  if (delta === 0) return SUB20_SESSIONS;
  return SUB20_SESSIONS.map((s) => ({ ...s, date: addDays(s.date, delta) }));
}

/** Data della gara (domenica dell'ultima settimana) per una data partenza. */
export function sub20RaceDate(startTuesday?: string | null): string {
  return addDays(startTuesday || SUB20_DEFAULT_START, (SUB20_META.weeks - 1) * 7 + 5);
}

// Legenda del calendario in modalità Sub-20
export const SUB20_LEGEND: { color: string; label: string; opacity?: number }[] = [
  { color: "#EF4444", label: "Qualità · VO2 / ritmo gara" },
  { color: "#F97316", label: "Soglia" },
  { color: "#6B7280", label: "Facile · aerobico" },
  { color: "#10B981", label: "Lungo" },
  { color: "#2A2A2A", label: "Riposo", opacity: 0.3 },
];

// ═══════════════════════════════════════════════════════════════════════════════
//  MOTORE DI AUTO-ADATTAMENTO DA RPE (Rate of Perceived Exertion, 3 livelli)
// ═══════════════════════════════════════════════════════════════════════════════
// Dopo ogni seduta l'atleta segna com'è andata: facile / giusto / duro (o la
// segna "fallita"). Il motore riadatta il RITMO delle sedute di qualità FUTURE:
//   · Solo intensità qualità: tocca ripetute (intervals) e soglia (tempo).
//     Lunghi e facili restano fissi come base aerobica.
//   · Per tipo di seduta: lo storico delle ripetute adatta le ripetute, quello
//     della soglia adatta la soglia (sistemi fisiologici separati).
//   · Graduale: serve la CONFERMA su 2 sedute consecutive dello stesso tipo con
//     lo stesso segnale prima di spostare il ritmo di uno step. Un "giusto"
//     (o un segnale contrario) azzera l'attesa: una giornata storta non
//     stravolge il piano.
//   · Step = 3 sec/km, tetto = ±6 sec/km (2 step). "facile" → più veloce
//     (piano più duro); "duro"/"fallito" → più lento (piano alleggerito).

export type Sub20Rpe = "facile" | "giusto" | "duro";
export type Sub20Status = "done" | "failed";

const ADAPTABLE_TYPES = new Set(["intervals", "tempo"]);
const RPE_STEP_SEC = 3;
const RPE_MAX_SEC = 6;

/** Le sedute di test e la gara non vengono adattate (sono riferimenti fissi). */
function isAdaptable(s: Session): boolean {
  if (!ADAPTABLE_TYPES.has(s.type)) return false;
  const t = s.title.toUpperCase();
  return !(t.includes("TEST") || t.includes("GARA") || s.title.includes("🏁"));
}

function paceToSec(p: string | null): number | null {
  if (!p) return null;
  const m = /^(\d+):(\d{1,2})$/.exec(p.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
function secToPace(s: number): string {
  const mm = Math.floor(s / 60);
  const ss = Math.round(s % 60);
  return `${mm}:${pad(ss)}`;
}

export interface Sub20AdaptInfo {
  /** Ritmo mostrato: adattato se offset ≠ 0, altrimenti quello base. */
  pace: string | null;
  basePace: string | null;
  /** sec/km applicati: <0 = più veloce (più duro), >0 = più lento (alleggerito). */
  offsetSec: number;
  /** Testo che spiega perché il ritmo è stato spostato (null se offset 0). */
  reason: string | null;
}

/**
 * Calcola, per ogni data di seduta adattabile, il ritmo adattato in base allo
 * storico di RPE/esiti. Ritorna una mappa { 'YYYY-MM-DD': Sub20AdaptInfo }.
 */
export function computeSub20Adaptations(
  sessions: Session[],
  rpe: Record<string, Sub20Rpe>,
  statuses: Record<string, Sub20Status>,
): Record<string, Sub20AdaptInfo> {
  const out: Record<string, Sub20AdaptInfo> = {};
  const byType: Record<string, Session[]> = {};
  for (const s of sessions) {
    if (!isAdaptable(s)) continue;
    (byType[s.type] ||= []).push(s);
  }
  for (const type of Object.keys(byType)) {
    const list = byType[type].slice().sort((a, b) => a.date.localeCompare(b.date));
    let offset = 0; // sec/km accumulato, applicato alle sedute successive
    let pending = 0; // -1 = "più duro" in attesa di conferma, +1 = "alleggerisci"
    let reason: string | null = null;
    for (const s of list) {
      // Il ritmo mostrato usa l'offset accumulato dai segnali PRECEDENTI.
      const base = paceToSec(s.target_pace);
      const pace = base != null && offset !== 0 ? secToPace(base + offset) : s.target_pace;
      out[s.date] = { pace, basePace: s.target_pace, offsetSec: offset, reason };

      // Poi si incorpora il segnale di QUESTA seduta per le sedute successive.
      const failed = statuses[s.date] === "failed";
      const r = rpe[s.date];
      let dir = 0;
      if (failed || r === "duro") dir = 1; // alleggerire → ritmo più lento
      else if (r === "facile") dir = -1; // rendere più duro → ritmo più veloce
      else if (r === "giusto") dir = 0;
      else continue; // nessun segnale: non tocca l'attesa

      if (dir === 0) {
        pending = 0;
        continue;
      }
      if (pending === dir) {
        const next = Math.max(-RPE_MAX_SEC, Math.min(RPE_MAX_SEC, offset + dir * RPE_STEP_SEC));
        if (next !== offset) {
          offset = next;
          reason =
            offset === 0
              ? null
              : dir < 0
                ? "2 qualità troppo facili → ritmo più veloce"
                : "2 sedute dure/fallite → ritmo alleggerito";
        }
        pending = 0;
      } else {
        pending = dir;
      }
    }
  }
  return out;
}
