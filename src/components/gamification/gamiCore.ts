import type { Run } from "../../types/api";

/**
 * NUCLEO CONDIVISO delle gamification v2 · v3 · v4.
 *
 * Le tre versioni hanno logiche diverse di proposito — classifica a divisioni,
 * albero delle abilità, momento — ma la lettura di una corsa deve essere una
 * sola: stesso filtro anti-spazzatura, stessa zona, stessa correzione del caldo.
 * Se ognuna se la calcolasse per conto suo, la stessa seduta varrebbe tre cose
 * diverse e il confronto fra le versioni non direbbe niente.
 *
 * La v1 (`evolutionEngine.ts`) resta intoccata: ha le sue copie di queste
 * funzioni ed è la versione già approvata.
 */

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const dayIndex = (d: string) =>
  Math.floor(new Date(d.slice(0, 10) + "T00:00:00Z").getTime() / 86400000);

export const dayToIso = (idx: number) => new Date(idx * 86400000).toISOString().slice(0, 10);

export const paceToSec = (p?: string | null): number | null => {
  if (!p || !p.includes(":")) return null;
  const [m, s] = p.split(":");
  const v = +m * 60 + +s;
  return Number.isFinite(v) && v > 0 ? v : null;
};

export const fmtPace = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec) % 60).padStart(2, "0")}`;

export const fmtClock = (sec: number): string => {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};

/** Avvii per sbaglio, glitch GPS e camminate non sono allenamenti. */
export const isRealRun = (r: Run) => (r.distance_km || 0) >= 0.5 && (r.duration_minutes || 0) >= 3;

// ── Daniels ───────────────────────────────────────────────────────────────────
export function vdotFrom(distM: number, timeSec: number): number {
  const t = timeSec / 60, v = distM / t;
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v;
  const pct = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
  return vo2 / pct;
}
/** Tempo (sec) previsto su una distanza dato un VDOT — inversione per bisezione. */
export function predictSec(distM: number, vdot: number): number {
  let lo = 0.5, hi = 360;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (vdotFrom(distM, mid * 60) > vdot) lo = mid; else hi = mid;
  }
  return ((lo + hi) / 2) * 60;
}

/** Distanza (m) coperta in `sec` secondi a quel VDOT. */
function distanceIn(vdot: number, sec: number): number {
  let lo = 400, hi = 45000;
  for (let i = 0; i < 44; i++) {
    const mid = (lo + hi) / 2;
    if (predictSec(mid, vdot) < sec) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
/** Passo di soglia: la velocità che regge un'ora di gara. Stesso criterio del resto dell'app. */
export const thresholdPaceSec = (vdot: number) => 3600 / (distanceIn(vdot, 3600) / 1000);
/** Passo delle ripetute (I-pace): quello che reggi ~12 minuti. */
export const intervalPaceSec = (vdot: number) => 720 / (distanceIn(vdot, 720) / 1000);

// ── Caldo ─────────────────────────────────────────────────────────────────────
function apparentTempC(tempC: number, humidity: number | null): number {
  if (humidity == null || tempC <= 20) return tempC;
  return tempC + (Math.max(0, humidity - 50) / 100) * (tempC - 20) * 0.7;
}
/** Frazione di rallentamento rispetto a un ottimo a ~12 °C, scalata sulla distanza. */
export function heatSlowdownFrac(tempC: number | null | undefined, humidity: number | null, distKm: number): number {
  if (tempC == null) return 0;
  const excess = Math.max(0, apparentTempC(tempC, humidity) - 12);
  const d = clamp(distKm, 5, 42.2);
  const coef = 0.0035 + ((d - 5) / (42.2 - 5)) * (0.008 - 0.0035);
  return excess * coef;
}

/** Passo della corsa riportato a temperatura ideale (più veloce del reale). */
export function coolPaceSec(r: Run): number | null {
  const ps = paceToSec(r.avg_pace);
  if (!ps) return null;
  return ps / (1 + heatSlowdownFrac(r.temperature, null, r.distance_km || 0));
}

/** VDOT equivalente della corsa, al fresco. Solo prove ≥3 km: sotto, la formula
 *  di Daniels lavora fuori dal suo dominio e restituisce numeri fantasiosi. */
export function runVdot(r: Run): number | null {
  if (r.is_treadmill) return null;
  const cp = coolPaceSec(r), dist = r.distance_km || 0;
  if (!cp || dist < 3 || dist > 25) return null;
  return vdotFrom(dist * 1000, cp * dist);
}

// ── Zone ──────────────────────────────────────────────────────────────────────
export type ZoneId = "recovery" | "easy" | "medium" | "threshold" | "vo2";

export interface ZoneDef { id: ZoneId; name: string; color: string; short: string }
export const ZONES: Record<ZoneId, ZoneDef> = {
  recovery:  { id: "recovery",  name: "Recupero", color: "#A78BFA", short: "REC" },
  easy:      { id: "easy",      name: "Lento",    color: "#22D3EE", short: "LEN" },
  medium:    { id: "medium",    name: "Medio",    color: "#A3E635", short: "MED" },
  threshold: { id: "threshold", name: "Soglia",   color: "#FBBF24", short: "SOG" },
  vo2:       { id: "vo2",       name: "Ripetute", color: "#F43F5E", short: "RIP" },
};
const ZONE_ORDER: ZoneId[] = ["recovery", "easy", "medium", "threshold", "vo2"];

/** Passo migliore sostenuto su ≥3 km — il riferimento quando manca la FC. */
export function bestSustainedPaceSec(runs: Run[]): number | null {
  let best: number | null = null;
  for (const r of runs) {
    if (r.is_treadmill) continue;
    const ps = paceToSec(r.avg_pace);
    if (ps && (r.distance_km || 0) >= 3) best = best == null ? ps : Math.min(best, ps);
  }
  return best;
}

const ZONE_BY_TYPE: Record<string, ZoneId> = {
  recovery: "recovery", easy: "easy", long: "easy", progression: "medium", fartlek: "medium",
  workout: "medium", tempo: "threshold", threshold: "threshold",
  intervals: "vo2", repetition: "vo2", vo2max: "vo2", race: "vo2",
};

/**
 * Zona della corsa. Tre segnali, e vince il più duro fra quelli disponibili:
 *
 *   tipo    l'etichetta che il backend ha già assegnato alla seduta
 *   FC%     la misura diretta dello sforzo
 *   passo   relativo al proprio migliore, quando la FC manca
 *
 * Il "più duro vince" non è pigrizia: la FC da sola sbagliava. Le sedute di
 * soglia di questo atleta girano all'83% della massima — sotto la soglia dei
 * modelli standard — e finivano classificate come medi, cancellando l'intero
 * ramo qualità. Al contrario un lento corso a 35 °C può schizzare al 90% senza
 * essere una seduta dura: lì è il tipo a tenere il punto. Prendendo il massimo,
 * un segnale che sbaglia per difetto non può cancellare gli altri.
 */
export function zoneOf(r: Run, bestPaceSec: number | null): ZoneDef {
  const idx: number[] = [];

  const typed = ZONE_BY_TYPE[(r.run_type ?? "").toLowerCase()];
  if (typed) idx.push(ZONE_ORDER.indexOf(typed));

  if (r.avg_hr_pct) {
    const h = r.avg_hr_pct;
    idx.push(h < 70 ? 0 : h < 79 ? 1 : h < 85 ? 2 : h < 91 ? 3 : 4);
  } else {
    const ps = paceToSec(r.avg_pace);
    if (ps && bestPaceSec) {
      const q = bestPaceSec / ps;
      idx.push(q < 0.68 ? 0 : q < 0.78 ? 1 : q < 0.86 ? 2 : q < 0.93 ? 3 : 4);
    }
  }

  return ZONES[ZONE_ORDER[idx.length ? Math.max(...idx) : 1]];
}

export const isQualityZone = (z: ZoneId) => z === "threshold" || z === "vo2";
export const isRace = (r: Run) => (r.run_type ?? "").toLowerCase() === "race" || !!r.event;

/** Lunedì (indice giorno) della settimana che contiene `idx`. */
export const weekStart = (idx: number) => idx - ((idx + 3) % 7);

/** Mediana — robusta a una singola prova storta, a differenza della media. */
export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Corse valide, ordinate dalla più vecchia alla più recente. */
export function cleanRuns(runs: Run[]): Run[] {
  return (runs ?? []).filter(isRealRun).slice().sort((a, b) => a.date.localeCompare(b.date));
}

// ── LA SEDUTA DEL GIORNO ──────────────────────────────────────────────────────
/**
 * Strava spezza una seduta in più attività: riscaldamento, blocco di lavoro,
 * defaticamento arrivano come tre corse separate dello stesso giorno. Lette una
 * per una diventano "1,1 km di recupero" e "2 km sotto il tuo lento abituale" —
 * e lo standard dell'atleta crolla su frammenti che seduta non sono.
 *
 * Una SEDUTA è quindi tutto quello che hai corso in un giorno, con due letture
 * diverse a seconda della domanda:
 *
 *   volume    → la somma. Hai corso 7,6 km, non 4,5.
 *   intensità → il blocco più veloce. Se dentro c'è un tratto in soglia, quella
 *               è una seduta di soglia, e il riscaldamento non deve annacquarla.
 *
 * È lo stesso principio per cui il backend, sulle ripetute, legge i GIRI invece
 * degli split al chilometro.
 */
export interface DaySession {
  id: string; day: number; date: string; name: string;
  /** Somma del giorno. */
  km: number; minutes: number;
  /** Passo medio dell'intera seduta, secondi/km. */
  paceSec: number | null;
  /** Il blocco più veloce ≥1,5 km: da qui zona e VDOT. */
  hardest: Run;
  parts: Run[];
  zone: ZoneDef;
  /** VDOT del blocco di lavoro, al fresco. Null se troppo corto per Daniels. */
  vdot: number | null;
  isRace: boolean;
  temperature: number | null;
}

const HARD_BLOCK_MIN_KM = 1.5;

/**
 * Le sedute, una per giorno, dalla più vecchia alla più recente.
 * @param minKm giorni sotto questo totale restano fuori: sono prove GPS, non allenamenti
 */
export function daySessions(runs: Run[], minKm = 1.0): DaySession[] {
  const byDay = new Map<number, Run[]>();
  for (const r of cleanRuns(runs)) {
    const d = dayIndex(r.date);
    const l = byDay.get(d);
    if (l) l.push(r); else byDay.set(d, [r]);
  }
  const bestPace = bestSustainedPaceSec(runs);
  const out: DaySession[] = [];

  for (const [day, parts] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    const km = parts.reduce((s, r) => s + (r.distance_km || 0), 0);
    const minutes = parts.reduce((s, r) => s + (r.duration_minutes || 0), 0);
    if (km < minKm || minutes <= 0) continue;

    // il blocco che comanda l'intensità: il più veloce fra quelli abbastanza
    // lunghi da essere un lavoro, altrimenti semplicemente il più lungo
    const significant = parts.filter((r) => (r.distance_km || 0) >= HARD_BLOCK_MIN_KM);
    const pool = significant.length ? significant : parts;
    const hardest = pool.reduce((best, r) => {
      const a = coolPaceSec(r), b = coolPaceSec(best);
      if (a == null) return best;
      if (b == null) return r;
      return a < b ? r : best;
    }, pool[0]);
    const longest = parts.reduce((best, r) => ((r.distance_km || 0) > (best.distance_km || 0) ? r : best), parts[0]);

    out.push({
      id: longest.id, day, date: longest.date.slice(0, 10), name: longest.name ?? "Corsa",
      km, minutes, paceSec: minutes > 0 && km > 0 ? (minutes * 60) / km : null,
      hardest, parts, zone: zoneOf(hardest, bestPace), vdot: runVdot(hardest),
      isRace: parts.some(isRace),
      temperature: longest.temperature ?? hardest.temperature ?? null,
    });
  }
  return out;
}
