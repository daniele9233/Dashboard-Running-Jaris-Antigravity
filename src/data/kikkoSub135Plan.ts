import type { Session } from "../types/api";
import {
  addDays, basesFor, easy, fmtNum, heatPace, kikkoSub20NormalizeStart,
  buildKikkoPlanSessions, kikkoHeatInfo, longReps, longRun, pacesFor, reps, secToPace, soglia, trimZero,
  type CellFn, type KikkoPlanDef, type WeekDef,
} from "./kikkoSub20Plan";

/**
 * kikkoSub1:34:35 — mezza maratona su 9 settimane.
 *
 * ── PERCHÉ ESISTE ACCANTO A kikkoSub20 ──────────────────────────────────────
 * Non è lo stesso piano allungato. I 5000 si vincono col tetto aerobico: si
 * alza con le ripetute e si perde in tre settimane. La mezza si vince con la
 * TENUTA: il ritmo gara sta appena sotto la soglia, quindi il lavoro che conta
 * è la soglia lunga e i chilometri sotto le gambe, non le ripetute brevi.
 *
 * Da qui le tre differenze che si vedono nel calendario:
 *
 *  · IL LUNGO CRESCE FINO A 20 km. In kikkoSub20 si ferma a 14, e va bene: sui
 *    5000 non serve. Qui è la seduta che decide la gara.
 *  · IL RITMO GARA SI CORRE DA STANCHI. Dalla quinta settimana il lungo finisce
 *    a 4:29 — prima 6 km, poi 10. Correre 4:29 a gambe fresche non dimostra
 *    niente: il 18 ottobre arrivano al quindicesimo chilometro.
 *  · LA SOGLIA È PIÙ LUNGA E CRESCE DI UN CHILOMETRO, non di mezzo. 6 → 7 → 8:
 *    è il motore del ritmo gara, e su 21 km va allenato in blocchi lunghi.
 *
 * ── COSA CONDIVIDE CON kikkoSub20 ───────────────────────────────────────────
 * Tutto il resto, e di proposito: gli stessi ritmi dal VDOT, la stessa tabella
 * T + DP, lo stesso calendario a quattro uscite (martedì qualità, giovedì e
 * sabato lente, domenica lungo). Sono importati, non ricopiati — due modelli
 * del caldo darebbero due target diversi per la stessa mattina.
 *
 * ── LA PARTENZA ─────────────────────────────────────────────────────────────
 * Lunedì 17 agosto, in continuità con quello che è già stato corso: quella
 * settimana vale 36 km in tutti e due i piani, quindi si può passare dall'uno
 * all'altro senza buchi né doppioni.
 */

export const KIKKO_SUB135_META = {
  weeks: 9,
  phase: "kikkoSub1:34:35",
  goalRace: "Mezza",
  goalTime: "1:34:35",
  runsPerWeek: 4,
  startDate: "2026-08-17",
};

/** Il tempo obiettivo in secondi: 1:34:35. */
export const KIKKO_SUB135_GOAL_SEC = 1 * 3600 + 34 * 60 + 35;

/**
 * Il ritmo gara, ricavato dall'obiettivo e non scritto a mano.
 *
 * 5675 secondi su 21,0975 km fanno 268,99 s/km, cioè 4:29. Derivarlo invece di
 * inchiodarlo evita che i due numeri si separino il giorno in cui l'obiettivo
 * cambia di mezzo minuto.
 */
export const KIKKO_SUB135_RACE_PACE_SEC = KIKKO_SUB135_GOAL_SEC / 21.0975;

/**
 * VDOT atteso settimana per settimana.
 *
 * Riprende da 49,4 — il valore che kikkoSub20 aveva raggiunto alla quarta
 * settimana — perché il piano non parte da fermo: parte da dove si è arrivati.
 * Nelle settimane di scarico non sale: l'adattamento arriva dopo il carico,
 * non durante.
 */
export const KIKKO_SUB135_WEEK_VDOT: number[] = [
  49.4, 49.6, 49.8, 49.8,   // avvio + prima crescita + scarico
  50.1, 50.3, 50.6,         // blocco centrale, il più pesante
  50.6, 51.0,               // taper e gara
];

/** Il tempo finale che quel ritmo produce sulla mezza: "1:34:35". */
const hmClock = (paceSec: number): string => {
  const t = Math.round(paceSec * 21.0975);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

/* ── SEDUTE SPECIFICHE DELLA MEZZA ──────────────────────────────────────────*/

/**
 * Il lungo che finisce a ritmo gara.
 *
 * La parte veloce sta in fondo e non in mezzo: serve a chiedere il ritmo
 * quando il glicogeno facile è già andato, che è esattamente la condizione dei
 * chilometri 15-21 della gara.
 */
const longWithRace = (dist: number, fastKm: number, note = ""): CellFn => (p) => {
  const hp = heatPace("long", p.band, KIKKO_SUB135_RACE_PACE_SEC);
  return {
    title: `Lungo ${dist} km · ultimi ${trimZero(fmtNum(fastKm, 1))} a ${hp.mid}`,
    dist,
    pace: p.slow,
    kind: "long",
    baseSec: KIKKO_SUB135_RACE_PACE_SEC,
    desc:
      `${trimZero(fmtNum(dist - fastKm, 1))} km a ${p.slow}, poi ${trimZero(fmtNum(fastKm, 1))} km ` +
      `a ${hp.mid} fino alla fine. Il passo non deve scivolare negli ultimi due.` +
      `${note ? " " + note : ""}`,
  };
};

/** Ripetute lunghe a ritmo gara: la mezza si prova a pezzi prima di provarla intera. */
const ritmoGara = (n: number, meters: number, dist: number, rec: string, note = ""): CellFn => (p) => {
  const hp = heatPace("reps", p.band, KIKKO_SUB135_RACE_PACE_SEC);
  const workSec = (meters / 1000) * hp.midSec;
  return {
    title: `${n}×${meters} m @ ${hp.mid} · rec ${rec}`,
    dist,
    pace: hp.mid,
    kind: "reps",
    baseSec: KIKKO_SUB135_RACE_PACE_SEC,
    desc:
      `Risc. 2 km + 3 allunghi, def. 1,5 km. Ripetuta ~${secToPace(workSec)} al ritmo del 18 ottobre, ` +
      `rec ${rec} di jog. Non più veloce: serve a riconoscerlo, non a batterlo.${note ? " " + note : ""}`,
  };
};

/* ── LE NOVE SETTIMANE ──────────────────────────────────────────────────────
 *
 *   blocco 1 · 36 → 38 → 40 → 30
 *   blocco 2 · 42 → 44 → 46
 *   taper    · 34 → 40 (di cui 21,1 di gara)
 *
 * Il picco è 46 km, dieci più della settimana di partenza. Non è un numero
 * scelto per bellezza: sotto i 45 km settimanali l'esponente di tenuta resta
 * dove non serve, e un 5000 buono continua a non tradursi in una mezza buona.
 */
const WEEKS: WeekDef[] = [
  // ═══ BLOCCO 1 · 36 → 38 → 40 → 30 ═════════════════════════════════════════
  {
    // Già corsa: 5×1000 con 32 gradi il martedì, lenta da 8 il giovedì.
    mon: "2026-08-17", totalKm: 36,
    cells: [
      reps(5, 1000, 8, "2:30", "Da 600 a 1000: stesso ritmo, il doppio da reggere."),
      easy(8), easy(8), longRun(12),
    ],
  },
  {
    mon: "2026-08-24", totalKm: 38,
    cells: [soglia(6, 10, "Da qui la soglia comanda: è il ritmo che sta appena sopra la gara."), easy(7), easy(7), longRun(14)],
  },
  {
    mon: "2026-08-31", totalKm: 40,
    cells: [longReps("2:30", 11), easy(7), easy(7), longRun(15)],
  },
  {
    mon: "2026-09-07", totalKm: 30, deload: true,
    cells: [soglia(5, 8, "Scarico: soglia corta, stesso ritmo."), easy(6), easy(6), longRun(10)],
  },

  // ═══ BLOCCO 2 · 42 → 44 → 46 ══════════════════════════════════════════════
  {
    mon: "2026-09-14", totalKm: 42,
    cells: [soglia(7, 11), easy(8), easy(8), longWithRace(15, 6, "Primo assaggio: sei chilometri, non di più.")],
  },
  {
    mon: "2026-09-21", totalKm: 44,
    cells: [longReps("3:00", 13), easy(8), easy(6), longRun(17)],
  },
  {
    mon: "2026-09-28", totalKm: 46,
    cells: [
      soglia(8, 12, "L'ultima soglia lunga: da qui si scarica verso la gara."),
      easy(7), easy(7),
      longWithRace(20, 10, "La seduta che decide la gara: se il ritmo tiene qui, tiene il 18."),
    ],
  },

  // ═══ TAPER E GARA · 34 → 40 ═══════════════════════════════════════════════
  {
    mon: "2026-10-05", totalKm: 34, deload: true,
    cells: [
      ritmoGara(5, 1000, 9, "2:00", "Taper: volume a metà, ritmo intatto."),
      easy(7), easy(6),
      longWithRace(12, 5),
    ],
  },
  {
    mon: "2026-10-12", totalKm: 40, deload: true,
    cells: [
      ritmoGara(4, 1000, 8, "2:00", "Ultimo richiamo: quattro, e si smette."),
      easy(6),
      (p) => ({
        title: "Sciolto 5 km + 4 allunghi",
        dist: 5,
        pace: p.easy,
        desc: "5 km sciolti + 4 allunghi da 80 m. Controlla temperatura e DP di domani.",
      }),
      (p) => {
        const hp = heatPace("long", p.band, KIKKO_SUB135_RACE_PACE_SEC);
        return {
          title: `🏁 GARA MEZZA · ${KIKKO_SUB135_META.goalTime}`,
          dist: 21,
          pace: hp.mid,
          kind: "long" as const,
          baseSec: KIKKO_SUB135_RACE_PACE_SEC,
          desc:
            `Risc. 10′ + 3 allunghi. Primi 3 km ${secToPace(hp.midSec + 4)}, poi ${hp.mid} fino al 16°, ` +
            `da lì quello che resta. Con l'aria attesa: ${hmClock(hp.midSec)}.`,
        };
      },
    ],
  },
];

/* ── COSTRUZIONE ────────────────────────────────────────────────────────────*/

export const KIKKO_SUB135_DEFAULT_START = KIKKO_SUB135_META.startDate;

/** Volume dichiarato di ogni settimana. */
export const KIKKO_SUB135_WEEKLY_KM: number[] = WEEKS.map((w) => w.totalKm);

/** Indici (base 0) delle settimane di scarico, taper e gara compresi. */
export const KIKKO_SUB135_DELOAD_WEEKS: number[] = WEEKS
  .map((w, i) => (w.deload ? i : -1))
  .filter((i) => i >= 0);

/** Somma reale dei km per settimana, ricavata dalle sedute. */
export function kikkoSub135ActualWeeklyKm(): number[] {
  const ref = pacesFor(WEEKS[0].mon, KIKKO_SUB135_WEEK_VDOT[0]);
  return WEEKS.map((w) => w.cells.reduce((sum, c) => sum + c(ref).dist, 0));
}

/** Le settimane del piano, per chi deve interrogarne il calendario. */
export const KIKKO_SUB135_PLAN: KikkoPlanDef = {
  get weeks() { return WEEKS; },
  defaultStart: KIKKO_SUB135_DEFAULT_START,
  get defaultRace() { return kikkoSub135RaceDate(KIKKO_SUB135_DEFAULT_START); },
  weekVdot: KIKKO_SUB135_WEEK_VDOT,
};

/** Giorni fra il lunedì della settimana 1 e la gara. */
const KIKKO_SUB135_RACE_OFFSET_DAYS = (KIKKO_SUB135_META.weeks - 1) * 7 + 6;

/** Ricostruisce il piano dentro la finestra scelta. */
export function buildKikkoSub135Sessions(startDate?: string | null, raceDate?: string | null): Session[] {
  const start = kikkoSub20NormalizeStart(startDate ?? KIKKO_SUB135_DEFAULT_START);
  return buildKikkoPlanSessions(KIKKO_SUB135_PLAN, start, raceDate ?? kikkoSub135RaceDate(start));
}

/** Piano ancorato alla partenza di default. */
export const KIKKO_SUB135_SESSIONS: Session[] = buildKikkoSub135Sessions();

/** Data della gara (ultima seduta) per una data partenza. */
export function kikkoSub135RaceDate(startDate?: string | null): string {
  return addDays(kikkoSub20NormalizeStart(startDate ?? KIKKO_SUB135_DEFAULT_START), KIKKO_SUB135_RACE_OFFSET_DAYS);
}

/** L'aria attesa e il ritmo del giorno — stesso termometro di kikkoSub20. */
export function kikkoSub135HeatInfo(iso: string, startDate?: string | null, raceDate?: string | null) {
  return kikkoHeatInfo(KIKKO_SUB135_PLAN, iso, startDate, raceDate);
}

/** La legenda dei colori: sulla mezza il lungo è la seduta chiave, non le ripetute. */
export const KIKKO_SUB135_LEGEND: { color: string; label: string; opacity?: number }[] = [
  { color: "#F97316", label: "Qualità · soglia lunga" },
  { color: "#EF4444", label: "Qualità · ritmo gara o 2-3 km" },
  { color: "#6B7280", label: "Lenta" },
  { color: "#10B981", label: "Lungo · negli ultimi finisce a ritmo gara" },
  { color: "#2A2A2A", label: "Riposo", opacity: 0.3 },
];

/** L'obiettivo del piano: uno solo, ed è nel nome. */
export const KIKKO_SUB135_TARGETS = [
  { label: KIKKO_SUB135_META.goalTime, sec: KIKKO_SUB135_GOAL_SEC },
];

/** Il ritmo gara che serve per l'obiettivo, già formattato. */
export const KIKKO_SUB135_RACE_PACE = secToPace(KIKKO_SUB135_RACE_PACE_SEC);

/** Ritmo soglia della settimana, per la legenda. */
export const kikkoSub135ThresholdPace = (week: number): string =>
  secToPace(basesFor(KIKKO_SUB135_WEEK_VDOT[Math.min(week, KIKKO_SUB135_WEEK_VDOT.length - 1)]).thr);
