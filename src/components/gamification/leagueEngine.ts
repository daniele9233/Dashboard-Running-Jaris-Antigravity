import type { Run } from "../../types/api";
import {
  ZONES, type ZoneDef, type ZoneId, type DaySession, bestSustainedPaceSec, clamp, coolPaceSec,
  dayIndex, daySessions, fmtPace, intervalPaceSec, isQualityZone, median, predictSec,
  thresholdPaceSec, vdotFrom,
} from "./gamiCore";

/**
 * GAMIFICATION V2 — LA CLASSIFICA
 * ════════════════════════════════════════════════════════════════════════════
 * Logica opposta alla v1. Là gli XP si accumulano e basta: qualunque cosa tu
 * faccia, il numero sale, e una corsa vale quanto dura. Qui il punteggio SCENDE.
 *
 * Ogni corsa è una partita, e l'avversario sei tu di poche settimane fa:
 *
 *   • per soglia e ripetute l'avversario è il tuo VDOT tipico su quel tipo di
 *     seduta — batterlo di 2 punti vale il massimo, restare sotto costa;
 *   • per lento, medio e recupero l'avversario è la tua distanza tipica in
 *     quella zona, perché lì il lavoro è tempo sulle gambe, non velocità;
 *   • i giorni di stop erodono il punteggio: la forma non è un deposito.
 *
 * Conseguenza voluta: il tuo standard si alza da solo. Superi la mediana, la
 * mediana sale, e la settimana dopo la stessa seduta rende meno. Per salire di
 * divisione devi progredire davvero, non solo accumulare chilometri.
 */

export const RATING_START = 1000;
export const RATING_FLOOR = 600;

const K_BASE = 22;
const ZONE_W: Record<ZoneId, number> = { recovery: 0.45, easy: 0.8, medium: 1.0, threshold: 1.25, vo2: 1.4 };
const RACE_W = 1.4;
const PB_BONUS = 12;

/** VDOT: 2 punti sopra il proprio standard = punteggio pieno sulla seduta. */
const QUALITY_SPAN = 2.0;
/** Distanza: +50% sulla propria mediana di zona = punteggio pieno. */
const ENDURANCE_SPAN = 0.5;

export const DECAY_GRACE = 3;      // giorni di riposo concessi prima che il calo parta
const DECAY_PER_DAY = 6;    // e poi quanto costa il primo giorno in più
const DECAY_HALFLIFE = 14;  // ogni due settimane di stop il calo giornaliero si dimezza

/**
 * Quanto costa l'ennesimo giorno di riposo di fila.
 *
 * Non è lineare, e non per gentilezza: con un calo fisso di 6 al giorno una
 * pausa di due mesi costava 350 punti che nessun blocco di allenamento poteva
 * riprendere, perché i guadagni sono limitati dallo standard che si alza da
 * solo. Il detraining vero non funziona così — si perde in fretta all'inizio e
 * poi ci si stabilizza. Uno stop lungo ti costa una divisione, non la scala.
 */
export function decayOn(restDay: number): number {
  if (restDay <= DECAY_GRACE) return 0;
  return Math.max(0.5, DECAY_PER_DAY * Math.pow(0.5, (restDay - DECAY_GRACE - 1) / DECAY_HALFLIFE));
}
const BASELINE_WINDOW = 6;  // su quante sedute della stessa zona si misura lo standard
const BASELINE_MIN = 3;     // sotto, si usa il seme storico invece della finestra
const SIM_WINDOW = 365;     // la classifica racconta l'ultimo anno, non la carriera

// ── DIVISIONI ─────────────────────────────────────────────────────────────────
export interface DivisionDef {
  id: string; name: string; color: string; floor: number; ceil: number;
  /** Cosa vuol dire, in termini di corsa, stare qui. */
  meaning: string;
  /** Cosa si sblocca entrandoci. */
  unlock: string;
}
export const DIVISIONS: DivisionDef[] = [
  { id: "bronzo",   name: "Bronzo",   color: "#B08D57", floor: RATING_FLOOR, ceil: 950,
    meaning: "Corri con continuità ma lo standard è ancora in costruzione.",
    unlock: "Traccia base: da qui in poi ogni seduta ha un peso misurato." },
  { id: "argento",  name: "Argento",  color: "#C0C6CE", floor: 950, ceil: 1100,
    meaning: "Reggi le sedute di qualità senza pagarle nei giorni dopo.",
    unlock: "Sblocca il confronto per zona: vedi quale tipo di lavoro ti sta rendendo." },
  { id: "oro",      name: "Oro",      color: "#FBBF24", floor: 1100, ceil: 1250,
    meaning: "Tieni il ritmo soglia per mezz'ora piena.",
    unlock: "Sblocca la proiezione di gara sui 10K: la distanza diventa prevedibile." },
  { id: "platino",  name: "Platino",  color: "#67E8F9", floor: 1250, ceil: 1400,
    meaning: "Le ripetute alzano il VDOT invece di limitarsi a confermarlo.",
    unlock: "Sblocca il grado agonista: i tuoi tempi entrano nella fascia da gara." },
  { id: "diamante", name: "Diamante", color: "#A78BFA", floor: 1400, ceil: 1550,
    meaning: "Progredisci mentre lo standard si alza sotto di te — la parte difficile.",
    unlock: "Sblocca l'obiettivo sub-20 sui 5K come traguardo realistico, non come sogno." },
  { id: "campione", name: "Campione", color: "#C0FF00", floor: 1550, ceil: 1800,
    meaning: "Il tuo standard tipico è quello che per gli altri è il giorno buono.",
    unlock: "Vertice della classifica. Da qui si difende, non si sale." },
];
const ROMAN3 = ["III", "II", "I"];

export function divisionOf(rating: number): { def: DivisionDef; idx: number; sub: number; subLabel: string } {
  let idx = DIVISIONS.findIndex((d) => rating < d.ceil);
  if (idx < 0) idx = DIVISIONS.length - 1;
  const def = DIVISIONS[idx];
  const third = (def.ceil - def.floor) / 3;
  const sub = clamp(Math.floor((rating - def.floor) / third), 0, 2);
  return { def, idx, sub, subLabel: `${def.name} ${ROMAN3[sub]}` };
}

// ── UNA PARTITA ───────────────────────────────────────────────────────────────
export interface LeagueMatch {
  id: string; date: string; day: number; name: string;
  km: number; minutes: number; pace: string;
  zone: ZoneDef;
  /** Metrica confrontata: VDOT sulle sedute di qualità, km sulle aerobiche. */
  metric: "vdot" | "km";
  actual: number; baseline: number;
  /** Peso della partita: durata × zona × (gara). Il massimo che può muovere. */
  weight: number;
  /** 0 = disastro, 0.5 = pari col proprio standard, 1 = pieno. */
  score: number;
  delta: number;
  ratingAfter: number;
  isRace: boolean; isPB: boolean;
  /** Frase pronta: perché ha fruttato (o è costata) tanto. */
  why: string;
}

export interface IdleDrop { day: number; delta: number; ratingAfter: number }

/** Cosa varrebbe una certa seduta, fatta ORA, con gli standard attuali. */
export interface SessionOdds {
  id: string; label: string; detail: string; zone: ZoneDef;
  delta: number; weight: number;
  /** Il massimo teorico di quella seduta se la chiudi al meglio. */
  deltaMax: number;
}

export interface LeagueState {
  ok: boolean;
  rating: number;
  peak: number;
  division: ReturnType<typeof divisionOf>;
  next: DivisionDef | null;
  /** Punti che mancano alla divisione successiva. */
  toNext: number;
  /** Posizione dentro la banda della divisione, 0-100. */
  bandPct: number;
  /** Andamento su 28 giorni: quanto sale (o scende) alla settimana. */
  perWeek: number;
  /** Settimane alla promozione al ritmo attuale — null se fermo o in calo. */
  weeksToNext: number | null;
  /** Giorni dall'ultima corsa e quanto costa OGGI restare fermo. */
  idleDays: number; decayToday: number;
  /** Se scendi sotto, retrocedi. */
  relegationAt: number; safeBy: number;
  matches: LeagueMatch[];              // le ultime partite, dalla più recente
  curve: { day: number; rating: number }[];
  odds: SessionOdds[];
  baselines: { zone: ZoneDef; metric: "vdot" | "km"; value: number; samples: number }[];
  /** Tempo 5K equivalente allo standard di qualità attuale — il "cosa vuol dire". */
  qualityVdot: number | null;
  best5k: string | null;
}

const EMPTY: LeagueState = {
  ok: false, rating: RATING_START, peak: RATING_START, division: divisionOf(RATING_START),
  next: DIVISIONS[1], toNext: 0, bandPct: 0, perWeek: 0, weeksToNext: null,
  idleDays: 0, decayToday: 0, relegationAt: RATING_FLOOR, safeBy: 0,
  matches: [], curve: [], odds: [], baselines: [], qualityVdot: null, best5k: null,
};

type Family = { samples: number[]; seed: number | null };

const scoreFrom = (actual: number, baseline: number, span: number) =>
  0.5 + clamp((actual - baseline) / span, -0.5, 0.5);

/** Peso della partita: quanto quella seduta può muovere la classifica. */
function weightOf(minutes: number, zone: ZoneId, race: boolean): number {
  const durW = clamp(minutes / 45, 0.4, 1.5);
  return K_BASE * ZONE_W[zone] * durW * (race ? RACE_W : 1);
}

export function buildLeague(
  runsIn: Run[],
  todayIso: string = new Date().toISOString(),
  vdotAnchor?: number | null,
): LeagueState {
  // una SEDUTA per giorno: i frammenti Strava dello stesso allenamento non sono
  // partite separate, altrimenti il riscaldamento gioca (e perde) da solo
  const sessions = daySessions(runsIn);
  if (sessions.length < 4) return EMPTY;

  const pbSet = pbIds(sessions);

  /**
   * Il VDOT di seduta, riportato sul metro del cruscotto — una traslazione PER
   * ZONA, non una sola per tutte.
   *
   * Il passo che si legge qui è la media del blocco di lavoro, recuperi
   * compresi. Su una soglia continua è quasi il valore vero; su un 4×1000 con
   * tre minuti di camminata esce 4:40/km, cioè VDOT 43, mentre il backend — che
   * legge i GIRI e separa lavoro e recupero — dice 49,8. Sono due distorsioni
   * di entità diversa, quindi vanno corrette separatamente: per ogni zona di
   * qualità si prende la prova migliore recente e la si porta sull'ancora.
   *
   * I confronti non cambiano (dentro una zona lo scarto è invariante), ma i due
   * numeri scritti in pagina — standard di soglia e standard di ripetute —
   * finalmente si leggono sulla stessa scala, e su quella del resto dell'app.
   */
  const RECENT_FOR_SHIFT = 150;
  const lastDay = sessions[sessions.length - 1].day;
  const shiftByZone = new Map<ZoneId, number>();
  if (vdotAnchor && vdotAnchor > 0) {
    for (const z of ["threshold", "vo2"] as ZoneId[]) {
      const best = sessions
        .filter((s) => s.zone.id === z && s.vdot != null && s.day > lastDay - RECENT_FOR_SHIFT)
        .reduce((m, s) => Math.max(m, s.vdot!), 0);
      if (best > 0) shiftByZone.set(z, vdotAnchor - best);
    }
  }

  // ── semi: la mediana delle prime prove di ogni zona, così anche le corse più
  //    vecchie hanno un avversario invece di essere buttate via ──
  const fams = new Map<ZoneId, Family>();
  const firstOf = new Map<ZoneId, number[]>();
  const readOf = (s: DaySession): { zone: ZoneDef; metric: "vdot" | "km"; actual: number } | null => {
    if (isQualityZone(s.zone.id)) {
      return s.vdot == null ? null
        : { zone: s.zone, metric: "vdot", actual: s.vdot + (shiftByZone.get(s.zone.id) ?? 0) };
    }
    return s.km > 0 ? { zone: s.zone, metric: "km", actual: s.km } : null;
  };

  // ── la simulazione giorno per giorno ──
  const todayIdx = dayIndex(todayIso);
  const today = Math.max(todayIdx, lastDay);
  /**
   * La classifica misura l'ULTIMO ANNO, non la carriera.
   *
   * Simulando dalla prima corsa in assoluto, ogni pausa invernale di tre anni fa
   * resterebbe scritta nel punteggio di oggi: il calo dei mesi fermi si somma
   * per sempre, mentre i guadagni sono limitati dallo standard che si alza da
   * solo. Il risultato era un atleta in forma piazzato in fondo alla classifica
   * per colpa di stagioni che non c'entrano più niente.
   */
  const firstDay = Math.max(sessions[0].day, today - SIM_WINDOW);
  const inWindow = sessions.filter((s) => s.day >= firstDay);
  if (inWindow.length < 4) return EMPTY;

  for (const s of inWindow) {
    const read = readOf(s);
    if (!read) continue;
    const arr = firstOf.get(read.zone.id) ?? [];
    if (arr.length < 5) { arr.push(read.actual); firstOf.set(read.zone.id, arr); }
  }
  for (const [z, arr] of firstOf) fams.set(z, { samples: [], seed: median(arr) });

  const byDay = new Map<number, DaySession>();
  for (const s of inWindow) byDay.set(s.day, s);

  let rating = RATING_START;
  let peak = RATING_START;
  const matches: LeagueMatch[] = [];
  const curve: { day: number; rating: number }[] = [{ day: firstDay - 1, rating }];
  let lastRun = firstDay - 1;

  for (let d = firstDay; d <= today; d++) {
    const s = byDay.get(d);
    if (s) {
      const read = readOf(s);
      if (read) {
        const fam = fams.get(read.zone.id) ?? { samples: [], seed: null };
        const baseline = fam.samples.length >= BASELINE_MIN
          ? median(fam.samples.slice(-BASELINE_WINDOW))!
          : fam.seed ?? read.actual;

        const weight = weightOf(s.minutes, read.zone.id, s.isRace);
        const span = read.metric === "vdot" ? QUALITY_SPAN : Math.max(1, baseline * ENDURANCE_SPAN);
        const score = scoreFrom(read.actual, baseline, span);
        const isPB = pbSet.has(s.id);
        const delta = Math.round(weight * (score - 0.5) * 2) + (isPB ? PB_BONUS : 0);

        rating = Math.max(RATING_FLOOR, rating + delta);
        peak = Math.max(peak, rating);
        fam.samples.push(read.actual);
        fams.set(read.zone.id, fam);

        matches.push({
          id: s.id, date: s.date, day: d, name: s.name,
          km: round1(s.km), minutes: Math.round(s.minutes),
          pace: s.paceSec ? fmtPace(s.paceSec) : "—", zone: read.zone, metric: read.metric,
          actual: round1(read.actual), baseline: round1(baseline),
          weight: Math.round(weight), score: Math.round(score * 100) / 100,
          delta, ratingAfter: rating, isRace: s.isRace, isPB,
          why: explain(read.metric, read.actual, baseline, read.zone, delta, isPB, s.isRace),
        });
      }
      lastRun = d;
      curve.push({ day: d, rating });
    } else {
      const drop = Math.min(decayOn(d - lastRun), Math.max(0, rating - RATING_FLOOR));
      if (drop > 0) {
        rating -= drop;
        curve.push({ day: d, rating: Math.round(rating) });
      }
    }
  }

  rating = Math.round(rating);
  const division = divisionOf(rating);
  const next = DIVISIONS[division.idx + 1] ?? null;
  const band = division.def.ceil - division.def.floor;

  // ritmo delle ultime 4 settimane, letto sulla curva vera (cali inclusi)
  const ago28 = curve.filter((p) => p.day <= today - 28).pop()?.rating ?? RATING_START;
  const perWeek = Math.round(((rating - ago28) / 28) * 7);
  const toNext = next ? Math.max(0, division.def.ceil - rating) : 0;
  const weeksToNext = next && perWeek > 0 ? Math.round((toNext / perWeek) * 10) / 10 : null;

  const idleDays = today - lastRun;
  // stessa funzione del ciclo sopra: il badge non deve dire un numero diverso
  const decayToday = Math.round(Math.min(decayOn(idleDays), Math.max(0, rating - RATING_FLOOR)));

  // standard attuali per zona — il "chi devi battere"
  const baselines = (Object.keys(ZONES) as ZoneId[])
    .map((z) => {
      const fam = fams.get(z);
      if (!fam) return null;
      const v = fam.samples.length >= BASELINE_MIN ? median(fam.samples.slice(-BASELINE_WINDOW)) : fam.seed;
      if (v == null) return null;
      return { zone: ZONES[z], metric: (isQualityZone(z) ? "vdot" : "km") as "vdot" | "km", value: round1(v), samples: fam.samples.length };
    })
    .filter((b): b is NonNullable<typeof b> => b != null);

  const qBase = baselines.find((b) => b.zone.id === "vo2") ?? baselines.find((b) => b.zone.id === "threshold");
  const qualityVdot = qBase ? qBase.value : null;
  const anchorV = vdotAnchor && vdotAnchor > 0 ? vdotAnchor : qualityVdot;

  return {
    ok: true, rating: Math.round(rating), peak: Math.round(peak), division, next, toNext,
    bandPct: clamp(Math.round(((rating - division.def.floor) / band) * 100), 0, 100),
    perWeek, weeksToNext, idleDays, decayToday,
    relegationAt: division.def.floor, safeBy: Math.max(0, rating - division.def.floor),
    matches: matches.slice(-24).reverse(),
    curve: curve.filter((p) => p.day >= today - 180),
    odds: buildOdds(baselines, bestSustainedPaceSec(runsIn)),
    baselines, qualityVdot,
    best5k: anchorV ? fmtMMSS(predictSec(5000, anchorV)) : null,
  };
}

// ── "quanto vale la prossima corsa" ───────────────────────────────────────────
/**
 * Il pannello che risponde alla domanda vera: se domani esco e faccio X, cosa
 * succede alla classifica? Ogni riga è calcolata con la stessa formula delle
 * partite già giocate — non è una stima a occhio, è il motore che gira in avanti.
 */
function buildOdds(
  baselines: { zone: ZoneDef; metric: "vdot" | "km"; value: number; samples: number }[],
  bestPace: number | null,
): SessionOdds[] {
  const get = (z: ZoneId) => baselines.find((b) => b.zone.id === z);
  const out: SessionOdds[] = [];
  const push = (id: string, label: string, detail: string, zone: ZoneDef, minutes: number, actual: number, baseline: number, metric: "vdot" | "km") => {
    const w = weightOf(minutes, zone.id, false);
    const span = metric === "vdot" ? QUALITY_SPAN : Math.max(1, baseline * ENDURANCE_SPAN);
    out.push({
      id, label, detail, zone,
      delta: Math.round(w * (scoreFrom(actual, baseline, span) - 0.5) * 2),
      weight: Math.round(w), deltaMax: Math.round(w),
    });
  };

  const vo2 = get("vo2");
  if (vo2) {
    // ritmo che vale il proprio standard, e quello che vale un punto in più
    const pace = intervalPaceSec(vo2.value);
    push("vo2-plus", "Ripetute 5×1000 forte", `ripetute a ${fmtPace(intervalPaceSec(vo2.value + 1))}/km · 1 punto VDOT sopra il tuo standard`, ZONES.vo2, 45, vo2.value + 1, vo2.value, "vdot");
    push("vo2-par", "Ripetute 5×1000 normali", `ripetute a ${fmtPace(pace)}/km · esattamente il tuo standard`, ZONES.vo2, 45, vo2.value, vo2.value, "vdot");
  }
  const thr = get("threshold");
  if (thr) {
    push("thr-plus", "Soglia 6 km tirata", `a ${fmtPace(thresholdPaceSec(thr.value + 0.5))}/km · mezzo punto sopra il tuo standard`, ZONES.threshold, 40, thr.value + 0.5, thr.value, "vdot");
  }
  const easy = get("easy");
  if (easy) {
    const long = Math.round(easy.value * 1.4);
    push("easy-long", `Lungo ${long} km`, `+40% sulla tua distanza tipica (${easy.value} km)`, ZONES.easy, long * ((bestPace ?? 300) * 1.3) / 60, long, easy.value, "km");
    push("easy-par", `Lento ${Math.round(easy.value)} km`, "la tua distanza abituale: conferma, non guadagna", ZONES.easy, easy.value * ((bestPace ?? 300) * 1.3) / 60, easy.value, easy.value, "km");
  }
  const rec = get("recovery");
  if (rec) push("rec", `Recupero ${Math.round(rec.value)} km`, "zona a peso basso: serve alle gambe, non alla classifica", ZONES.recovery, rec.value * ((bestPace ?? 300) * 1.45) / 60, rec.value, rec.value, "km");

  return out.sort((a, b) => b.delta - a.delta);
}

// ── utilità ───────────────────────────────────────────────────────────────────
const round1 = (v: number) => Math.round(v * 10) / 10;
const fmtMMSS = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec) % 60).padStart(2, "0")}`;

function explain(metric: "vdot" | "km", actual: number, baseline: number, zone: ZoneDef, delta: number, isPB: boolean, race: boolean): string {
  const diff = actual - baseline;
  const head = race ? "Gara. " : isPB ? "Primato personale. " : "";
  if (metric === "vdot") {
    if (Math.abs(diff) < 0.15) return `${head}In linea col tuo standard di ${zone.name.toLowerCase()} (${round1(baseline)} VDOT).`;
    return diff > 0
      ? `${head}${round1(diff)} punti VDOT sopra il tuo standard di ${zone.name.toLowerCase()}.`
      : `${head}${round1(-diff)} punti sotto il tuo standard di ${zone.name.toLowerCase()}: ${delta} in classifica.`;
  }
  if (Math.abs(diff) < 0.4) return `${head}Distanza tipica per il tuo ${zone.name.toLowerCase()} (${round1(baseline)} km).`;
  return diff > 0
    ? `${head}${round1(diff)} km oltre il tuo ${zone.name.toLowerCase()} abituale.`
    : `${head}${round1(-diff)} km sotto il tuo ${zone.name.toLowerCase()} abituale.`;
}

/**
 * Le sedute che detengono un primato — bonus fisso, indipendente dalla zona.
 * Il passo si legge sul blocco di lavoro (non sulla seduta intera) e corretto
 * per il caldo: un 5K d'agosto non deve perdere contro uno di gennaio.
 */
function pbIds(sessions: DaySession[]): Set<string> {
  const ids = new Set<string>();
  const hold = (metric: (s: DaySession) => number | null, mode: "min" | "max") => {
    let best: number | null = null, id: string | null = null;
    for (const s of sessions) {
      const v = metric(s); if (v == null) continue;
      if (best == null || (mode === "min" ? v < best : v > best)) { best = v; id = s.id; }
    }
    if (id) ids.add(id);
  };
  const km = (s: DaySession) => s.hardest.distance_km || 0;
  hold((s) => { const p = coolPaceSec(s.hardest); return p && km(s) >= 4.5 && km(s) <= 5.5 ? p : null; }, "min");
  hold((s) => { const p = coolPaceSec(s.hardest); return p && km(s) >= 9 && km(s) <= 11 ? p : null; }, "min");
  hold((s) => s.km || null, "max");
  return ids;
}

// riesportata per i test: la formula del VDOT è la stessa del resto dell'app
export { vdotFrom };
