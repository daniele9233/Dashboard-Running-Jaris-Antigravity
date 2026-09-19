import { clamp, gradeFactor, predictSec } from "../gamification/gamiCore";

/**
 * IL PREZZO DEL PASSO — il motore
 * ════════════════════════════════════════════════════════════════════════════
 * Una sola idea regge tutta la pagina: il SERBATOIO.
 *
 * Ogni intensità ha una durata massima — la curva di Daniels, la stessa che
 * nell'app trasforma un VDOT in un tempo gara. Correre un minuto a
 * un'intensità che reggeresti per 40 minuti consuma 1/40 del serbatoio. Il
 * serbatoio parte da 1 e, se corri al tuo limite a passo costante, arriva a 0
 * esattamente sul traguardo: per costruzione, quindi, il modello dà gli stessi
 * tempi del resto dell'app.
 *
 * Tutto il resto viene da lì, senza parametri inventati:
 *   - il prezzo di ogni secondo al km (quanto serbatoio costa, dove finisce);
 *   - il conto di una partenza veloce, e il km in cui lo paghi;
 *   - la strategia migliore: su un percorso piatto il passo costante, su uno
 *     con le salite lo SFORZO costante. Non è un'opinione: con un costo che
 *     cresce più che in proporzione alla velocità è il minimo matematico, e
 *     ogni altra distribuzione spende di più per fare lo stesso tempo;
 *   - quanto conviene partire un filo più piano quando non sai con certezza
 *     quanto vali quel giorno (l'unico motivo serio per il negative split).
 *
 * Oltre le due ore e mezza la curva di Daniels si appiattisce su un asintoto
 * (l'80% del VO2max) sotto il quale correre non costerebbe nulla: falso, e
 * soprattutto pericoloso qui, perché un costo che si annulla rende "gratis"
 * crollare a fine gara. Oltre i 150 minuti la curva continua quindi a
 * scendere col logaritmo del tempo, con la stessa pendenza che ha in quel
 * punto — il raccordo è liscio e sotto le due ore e mezza non cambia nulla.
 */

// ── 1. Quanto a lungo reggi un'intensità ─────────────────────────────────────

/** Costo in ml/kg/min di una velocità in m/min (Daniels & Gilbert). */
const vo2At = (vMin: number) => -4.6 + 0.182258 * vMin + 0.000104 * vMin * vMin;

const danielsPct = (t: number) =>
  0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
const danielsSlope = (t: number) =>
  -0.1894393 * 0.012778 * Math.exp(-0.012778 * t) - 0.2989558 * 0.1932605 * Math.exp(-0.1932605 * t);

const TAIL_T = 150;
const TAIL_F = danielsPct(TAIL_T);
/** Pendenza per unità di ln(t): negativa. */
const TAIL_S = TAIL_T * danielsSlope(TAIL_T);

/** Frazione del VO2max che reggi per `tMin` minuti. */
export function sustainablePct(tMin: number): number {
  return tMin <= TAIL_T ? danielsPct(tMin) : TAIL_F + TAIL_S * Math.log(tMin / TAIL_T);
}

// La curva di Daniels non si inverte a mano: una tabella in scala logaritmica
// fra 18 secondi e 150 minuti, poi ricerca binaria e interpolazione.
const LUT_N = 4096;
const LUT_T: number[] = [];
const LUT_F: number[] = [];
for (let k = 0; k < LUT_N; k++) {
  const t = 0.3 * Math.pow(TAIL_T / 0.3, k / (LUT_N - 1));
  LUT_T.push(Math.log(t));
  LUT_F.push(danielsPct(t));
}

/** Per quanti minuti reggi una frazione `f` del VO2max. */
export function tlimMin(f: number): number {
  if (f <= TAIL_F) return TAIL_T * Math.exp((f - TAIL_F) / TAIL_S);
  if (f >= LUT_F[0]) return Math.exp(LUT_T[0]) * Math.exp(-(f - LUT_F[0]) * 25);
  let lo = 0, hi = LUT_N - 1;          // LUT_F è decrescente
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (LUT_F[mid] >= f) lo = mid; else hi = mid;
  }
  const w = (LUT_F[lo] - f) / (LUT_F[lo] - LUT_F[hi]);
  return Math.exp(LUT_T[lo] + w * (LUT_T[hi] - LUT_T[lo]));
}

/** Serbatoio consumato al minuto a un passo "in piano" (s/km). */
export function ratePerMin(flatPaceSec: number, vdot: number): number {
  return 1 / tlimMin(vo2At(60000 / flatPaceSec) / vdot);
}

/** Serbatoio consumato da un chilometro in piano a quel passo. */
export function kmCost(paceSec: number, vdot: number): number {
  return (paceSec / 60) * ratePerMin(paceSec, vdot);
}

/** Il passo al quale un chilometro costa esattamente `cost` di serbatoio. */
export function paceForKmCost(cost: number, vdot: number): number {
  if (cost <= 0) return MAX_PACE;
  let lo = 110, hi = MAX_PACE;
  if (kmCost(hi, vdot) > cost) return MAX_PACE;
  for (let i = 0; i < 56; i++) {
    const mid = (lo + hi) / 2;
    if (kmCost(mid, vdot) > cost) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
/** Oltre questo non si corre più: 20′/km. */
const MAX_PACE = 1200;
/** Sotto questo resto il serbatoio è "vuoto sul traguardo", non "vuoto prima". */
const TANK_EPS = 1e-4;

// ── 2. Il livello ────────────────────────────────────────────────────────────

/**
 * Il VDOT per cui quel passo, costante su quella distanza in piano, è
 * esattamente il limite: il serbatoio arriva a 0 sul traguardo. Sotto le due
 * ore e mezza coincide con la formula di Daniels di tutta l'app.
 */
export function levelFromEven(distKm: number, paceSec: number): number {
  return vo2At(60000 / paceSec) / sustainablePct((distKm * paceSec) / 60);
}

/** Il passo costante che a quel livello svuota il serbatoio sul traguardo. */
export function limitPace(distKm: number, vdot: number): number {
  let lo = 120, hi = 900;
  for (let i = 0; i < 56; i++) {
    const mid = (lo + hi) / 2;
    if (levelFromEven(distKm, mid) > vdot) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface DistanceDef {
  id: DistanceId; km: number; label: string; short: string;
  /** "sui 10 km", "sulla mezza": la preposizione giusta, per le frasi. */
  on: string;
  /** "i 10 km", "la mezza". */
  the: string;
}
export type DistanceId = "3k" | "5k" | "10k" | "15k" | "21k";
export const DISTANCES: DistanceDef[] = [
  { id: "3k", km: 3, label: "3 km", short: "3K", on: "sui 3 km", the: "i 3 km" },
  { id: "5k", km: 5, label: "5 km", short: "5K", on: "sui 5 km", the: "i 5 km" },
  { id: "10k", km: 10, label: "10 km", short: "10K", on: "sui 10 km", the: "i 10 km" },
  { id: "15k", km: 15, label: "15 km", short: "15K", on: "sui 15 km", the: "i 15 km" },
  { id: "21k", km: 21.0975, label: "Mezza", short: "21K", on: "sulla mezza", the: "la mezza" },
];
export const distanceById = (id: DistanceId) => DISTANCES.find((d) => d.id === id)!;

/** Lo stesso motore, letto come un tempo che l'atleta riconosce. */
export function equivalentOf(distKm: number, vdot: number): { label: string; sec: number } {
  const ref = distKm === 5 ? DISTANCES[2] : DISTANCES[1];
  return { label: ref.short, sec: predictSec(ref.km * 1000, vdot) };
}

// ── 3. Il listino: quanto pesa ogni secondo al km ────────────────────────────

export interface LadderRow {
  offsetSec: number;
  paceSec: number;
  timeSec: number;
  /** Rispetto al passo al centro della scala (l'obiettivo). */
  vsCenterSec: number;
  /** Il motore che serve per reggerlo fino in fondo. */
  vdot: number;
  eq: { label: string; sec: number };
  /** Serbatoio che resta all'arrivo, al tuo livello (negativo = non ci arrivi). */
  tankEnd: number;
  /** Dove si svuota, se si svuota prima del traguardo. */
  wallKm: number | null;
  /**
   * Il tempo vero se a metà gara ti accorgi e correggi: rallenti quanto serve
   * per non crollare, o allunghi se ti è avanzato serbatoio. null = il
   * serbatoio finisce prima di metà gara.
   */
  realSec: number | null;
}

export function correctedAtHalf(distKm: number, paceSec: number, vdot: number): number | null {
  const half = distKm / 2;
  const used = half * kmCost(paceSec, vdot);
  if (used >= 1) return null;
  return half * paceSec + half * paceForKmCost((1 - used) / half, vdot);
}

export function paceLadder(distKm: number, centerPace: number, vdot: number, span = 10): LadderRow[] {
  const rows: LadderRow[] = [];
  for (let o = -span; o <= span; o++) {
    const p = centerPace + o;
    const c = kmCost(p, vdot);
    const tankEnd = 1 - distKm * c;
    const v = levelFromEven(distKm, p);
    rows.push({
      offsetSec: o,
      paceSec: p,
      timeSec: p * distKm,
      vsCenterSec: o * distKm,
      vdot: v,
      eq: equivalentOf(distKm, v),
      tankEnd,
      wallKm: tankEnd < -TANK_EPS ? 1 / c : null,
      realSec: correctedAtHalf(distKm, p, vdot),
    });
  }
  return rows;
}

/** Quanto serbatoio costa un secondo al km su tutta la gara, attorno a quel passo. */
export function tankPerSecond(distKm: number, paceSec: number, vdot: number): number {
  return distKm * (kmCost(paceSec - 0.5, vdot) - kmCost(paceSec + 0.5, vdot));
}

// ── 4. Partire forte: quanto costa e dove lo paghi ───────────────────────────

export interface FastStartInput {
  distKm: number;
  targetPace: number;
  vdot: number;
  firstKm: number;
  fastPace: number;
}

export interface Correction {
  /** Il km in cui te ne accorgi e cambi passo. */
  atKm: number;
  /** Il passo del resto della gara. */
  restPace: number;
  finalSec: number;
  /** Rispetto al passo costante all'obiettivo: + = più lento. */
  deltaSec: number;
  /** Il km in cui il vantaggio accumulato è restituito tutto. null = mai. */
  paybackKm: number | null;
}

export interface FastStartResult {
  distKm: number;
  targetPace: number;
  firstKm: number;
  fastPace: number;
  bankSec: number;
  /** Serbatoio in più speso nel tratto veloce, rispetto al passo obiettivo. */
  extraTank: number;
  /** Lo stesso, in chilometri di gara al passo obiettivo. */
  extraKm: number;
  /** Serbatoio all'arrivo col passo costante (0 se l'obiettivo è il tuo limite). */
  evenTankEnd: number;
  /** Serbatoio all'arrivo se dopo il tratto veloce torni al passo obiettivo. */
  holdTankEnd: number;
  /** Dove si svuota se torni al passo obiettivo e non correggi. */
  wallKm: number | null;
  /** Il passo obiettivo regge anche dopo la partenza veloce. */
  holdOk: boolean;
  /** Correggi subito, alla fine del tratto veloce: il prezzo minimo. */
  smart: Correction;
  /** Il prezzo di accorgersene tardi, km per km fino al muro. */
  late: Correction[];
}

/**
 * Dal km `atKm` in poi, il passo del resto della gara. L'obiettivo è chiudere
 * sul tempo: dopo uno strappo si torna al passo obiettivo (e il vantaggio, se
 * il serbatoio lo regge, resta in tasca); dopo una partenza lenta si accelera
 * quanto serve per rientrare. In entrambi i casi mai più forte di quanto il
 * serbatoio rimasto permetta fino al traguardo.
 */
export function correctAt(inp: FastStartInput, atKm: number): Correction | null {
  const { distKm: D, targetPace: P, vdot, firstKm: N, fastPace: F } = inp;
  const c = clamp(atKm, N, D);
  const used = N * kmCost(F, vdot) + (c - N) * kmCost(P, vdot);
  const left = 1 - used;
  if (left <= 1e-9 && D - c > 1e-6) return null;
  const onTime = D - c > 1e-6 ? (D * P - (N * F + (c - N) * P)) / (D - c) : P;
  const rest = D - c > 1e-6 ? Math.max(paceForKmCost(left / (D - c), vdot), Math.min(P, onTime)) : P;
  const finalSec = N * F + (c - N) * P + (D - c) * rest;
  const bank = N * (P - F);
  const paybackKm = rest > P + 1e-6 && bank > 0 ? c + bank / (rest - P) : null;
  return {
    atKm: c, restPace: rest, finalSec, deltaSec: finalSec - D * P,
    paybackKm: paybackKm != null && paybackKm <= D + 1e-6 ? paybackKm : null,
  };
}

export function fastStart(inp: FastStartInput): FastStartResult {
  const { distKm: D, targetPace: P, vdot, firstKm: N, fastPace: F } = inp;
  const cP = kmCost(P, vdot), cF = kmCost(F, vdot);
  const extraTank = N * (cF - cP);
  const evenTankEnd = 1 - D * cP;
  const holdTankEnd = 1 - N * cF - (D - N) * cP;
  const wallKm = N * cF >= 1 ? 1 / cF : holdTankEnd < -TANK_EPS ? N + (1 - N * cF) / cP : null;
  const smart = correctAt(inp, N) ?? {
    atKm: N, restPace: MAX_PACE, finalSec: Infinity, deltaSec: Infinity, paybackKm: null,
  };

  // il prezzo del ritardo: un punto a ogni km intero fino al muro
  const late: Correction[] = [];
  const stop = wallKm ?? D;
  for (let k = Math.ceil(N + 1e-6); k < stop - 0.05; k++) {
    const r = correctAt(inp, k);
    if (r) late.push(r);
  }
  return {
    distKm: D, targetPace: P, firstKm: N, fastPace: F, bankSec: N * (P - F),
    extraTank, extraKm: cP > 0 ? extraTank / cP : 0,
    evenTankEnd, holdTankEnd, wallKm, holdOk: wallKm == null, smart, late,
  };
}

export interface TracePoint { km: number; bank: number; tank: number }

/**
 * Il tracciato di uno scenario, un punto ogni 100 m: vantaggio sul passo
 * costante all'obiettivo (secondi) e serbatoio rimasto. `correctKm` null =
 * tieni l'obiettivo finché regge: il tracciato si ferma al muro.
 */
export function fastStartTrace(inp: FastStartInput, correctKm: number | null): TracePoint[] {
  const { distKm: D, targetPace: P, vdot, firstKm: N, fastPace: F } = inp;
  const corr = correctKm != null ? correctAt(inp, correctKm) : null;
  const pts: TracePoint[] = [];
  let t = 0, tank = 1, x = 0;
  pts.push({ km: 0, bank: 0, tank: 1 });
  const step = 0.1;
  while (x < D - 1e-9) {
    const dx = Math.min(step, D - x);
    const mid = x + dx / 2;
    const pace = mid < N ? F : corr && mid >= corr.atKm ? corr.restPace : P;
    const cost = dx * kmCost(pace, vdot);
    if (correctKm == null && tank - cost < 0) {
      // il muro: il tracciato arriva fino al punto esatto e lì si ferma
      const frac = tank / cost;
      const xw = x + dx * frac;
      pts.push({ km: xw, bank: xw * P - (t + dx * frac * pace), tank: 0 });
      break;
    }
    t += dx * pace; tank -= cost; x += dx;
    pts.push({ km: x, bank: x * P - t, tank });
  }
  return pts;
}

// ── 5. Tutte le distanze ─────────────────────────────────────────────────────

export interface MatrixCell {
  offsetSec: number;
  /** Negativo = si svuota prima del traguardo. */
  tankEnd: number;
  wallKm: number | null;
  /** Secondi lasciati sul tavolo, se più lento del limite. */
  leftSec: number;
  /** Solo nella modalità "partenza": il prezzo se correggi subito. */
  priceSec?: number;
}

export interface MatrixRow {
  dist: DistanceDef;
  limitPace: number;
  limitSec: number;
  /** Serbatoio che costa 1″/km su tutta la gara. */
  tankPerSec: number;
  cells: MatrixCell[];
}

/** Il primo quinto della gara: la partenza. */
export const START_FRACTION = 0.2;

export function distanceMatrix(vdot: number, offsets: number[], mode: "race" | "start"): MatrixRow[] {
  return DISTANCES.map((dist) => {
    const P = limitPace(dist.km, vdot);
    const cells: MatrixCell[] = offsets.map((o) => {
      if (mode === "race") {
        const c = kmCost(P + o, vdot);
        const tankEnd = 1 - dist.km * c;
        return {
          offsetSec: o, tankEnd, wallKm: tankEnd < -TANK_EPS ? 1 / c : null,
          leftSec: o > 0 ? o * dist.km : 0,
        };
      }
      const N = dist.km * START_FRACTION;
      const r = fastStart({ distKm: dist.km, targetPace: P, vdot, firstKm: N, fastPace: P + o });
      return {
        offsetSec: o, tankEnd: r.holdTankEnd, wallKm: o < 0 ? r.wallKm : null,
        leftSec: 0, priceSec: r.smart.deltaSec,
      };
    });
    return { dist, limitPace: P, limitSec: P * dist.km, tankPerSec: tankPerSecond(dist.km, P, vdot), cells };
  });
}

// ── 6. Il percorso ───────────────────────────────────────────────────────────

export const SEG_KM = 0.1;

export interface Course {
  id: string;
  label: string;
  distKm: number;
  /** Lunghezza di ogni tratto da 100 m (l'ultimo può essere più corto). */
  seg: number[];
  grade: number[];
  /** Quota ai bordi dei tratti: seg.length + 1 valori. */
  elev: number[];
  note?: string;
  flat: boolean;
}

export interface ProfilePoint { km: number; ele: number }

/** Divide la distanza in tratti da 100 m e ci appoggia sopra un profilo. */
export function makeCourse(id: string, label: string, distKm: number, profile?: ProfilePoint[], note?: string): Course {
  const n = Math.max(1, Math.ceil(distKm / SEG_KM - 1e-9));
  const seg: number[] = [];
  for (let i = 0; i < n; i++) seg.push(Math.min(SEG_KM, distKm - i * SEG_KM));
  const pts = profile && profile.length >= 2 ? scaleProfile(profile, distKm) : null;
  const eAt = (x: number) => (pts ? interpolate(pts, x) : 0);
  const elev: number[] = [eAt(0)];
  let x = 0;
  for (const s of seg) { x += s; elev.push(eAt(x)); }
  const grade = seg.map((s, i) => clamp((elev[i + 1] - elev[i]) / (s * 1000), -0.15, 0.15));
  return { id, label, distKm, seg, grade, elev, note, flat: !pts || grade.every((g) => Math.abs(g) < 1e-4) };
}

/** Un profilo di 21,24 km su una gara di 21,10: si stira sulla distanza vera. */
function scaleProfile(profile: ProfilePoint[], distKm: number): ProfilePoint[] {
  const sorted = [...profile].sort((a, b) => a.km - b.km);
  const k0 = sorted[0].km, k1 = sorted[sorted.length - 1].km;
  const span = k1 - k0 || 1;
  return sorted.map((p) => ({ km: ((p.km - k0) / span) * distKm, ele: p.ele }));
}

function interpolate(pts: ProfilePoint[], x: number): number {
  if (x <= pts[0].km) return pts[0].ele;
  let lo = 0, hi = pts.length - 1;
  if (x >= pts[hi].km) return pts[hi].ele;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].km <= x) lo = mid; else hi = mid;
  }
  const a = pts[lo], b = pts[hi];
  return a.ele + ((b.ele - a.ele) * (x - a.km)) / (b.km - a.km || 1);
}

export const flatCourse = (distKm: number) => makeCourse("flat", "Piatto", distKm);

/**
 * Un profilo più lungo della gara (un GPX col riscaldamento, un lungo da 12 km
 * per un 10K) si taglia alla distanza; uno più corto lo stira `makeCourse`.
 */
export function fitProfile(profile: ProfilePoint[], distKm: number): ProfilePoint[] {
  if (profile.length < 2) return profile;
  const k0 = profile[0].km;
  const last = profile[profile.length - 1].km - k0;
  if (last <= distKm) return profile;
  const cut = profile.filter((p) => p.km - k0 < distKm);
  return [...cut, { km: k0 + distKm, ele: interpolate(profile, k0 + distKm) }];
}

/** Salita e discesa totali, in metri. */
export function courseClimb(c: Course): { up: number; down: number } {
  let up = 0, down = 0;
  for (let i = 1; i < c.elev.length; i++) {
    const d = c.elev[i] - c.elev[i - 1];
    if (d > 0) up += d; else down -= d;
  }
  return { up, down };
}

/**
 * La Rome Half Marathon del 18 ottobre, ricostruita dall'altimetria
 * ufficiale: discesa da Porta Ardeatina nei primi 2,5 km, gli strappi di
 * Aventino e Circo Massimo fino al km 5, dodici km piatti lungo il Tevere,
 * e il centro con la salita finale al 3% verso il Colosseo. Circa +63 m.
 * Col modello di pendenza dell'app costa mezzo minuto: 4:47 a Roma valgono
 * 4:45 in piano, lo stesso conto del piano di gara.
 */
export const ROME_HM_PROFILE: ProfilePoint[] = [
  [0, 36], [0.5, 33], [1, 29], [1.5, 25], [2, 21], [2.5, 17], [3, 23], [3.5, 31], [4, 38], [4.4, 41],
  [4.8, 28], [5.1, 19], [5.6, 16], [7, 15], [8, 17], [8.6, 21], [9.1, 23], [9.6, 20], [10.2, 16],
  [11.2, 15], [12.2, 16], [13, 18], [13.5, 21], [14, 19], [15, 16], [16, 15], [17, 16], [17.6, 18],
  [18.2, 22], [18.8, 26], [19.3, 28], [19.8, 25], [20.3, 23], [20.7, 25], [21.0975, 37],
].map(([km, ele]) => ({ km, ele }));

/**
 * Un GPX in punti (km, quota). La quota GPS balla di qualche metro a ogni
 * punto: senza lisciarla un percorso piatto sembra una sega. Media mobile su
 * ±100 m.
 */
export function parseGpx(text: string): ProfilePoint[] {
  const raw: { lat: number; lon: number; ele: number }[] = [];
  const re = /<(trkpt|rtept)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const lat = Number(/lat\s*=\s*["']([^"']+)["']/.exec(m[2])?.[1]);
    const lon = Number(/lon\s*=\s*["']([^"']+)["']/.exec(m[2])?.[1]);
    const ele = Number(/<ele>\s*([^<]+?)\s*<\/ele>/.exec(m[3])?.[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(ele)) raw.push({ lat, lon, ele });
  }
  if (raw.length < 2) return [];
  const pts: ProfilePoint[] = [{ km: 0, ele: raw[0].ele }];
  let km = 0;
  for (let i = 1; i < raw.length; i++) {
    km += haversineKm(raw[i - 1].lat, raw[i - 1].lon, raw[i].lat, raw[i].lon);
    pts.push({ km, ele: raw[i].ele });
  }
  return smoothProfile(pts, 0.1);
}

function haversineKm(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371, r = Math.PI / 180;
  const dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function smoothProfile(pts: ProfilePoint[], halfKm: number): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  let a = 0, b = 0, sum = 0;
  for (const p of pts) {
    while (b < pts.length && pts[b].km <= p.km + halfKm) sum += pts[b++].ele;
    while (pts[a].km < p.km - halfKm) sum -= pts[a++].ele;
    out.push({ km: p.km, ele: sum / (b - a) });
  }
  return out;
}

/** Il profilo di una tua corsa, dagli split per km (quota di ogni km). */
export function profileFromSplits(splits: { distance: number; elevation_difference: number }[]): ProfilePoint[] {
  const pts: ProfilePoint[] = [{ km: 0, ele: 0 }];
  let km = 0, ele = 0;
  for (const s of splits) {
    const d = (s.distance ?? 0) / 1000;
    if (d <= 0) continue;
    km += d; ele += s.elevation_difference ?? 0;
    pts.push({ km, ele });
  }
  return pts.length >= 2 ? pts : [];
}

// ── 7. PacePro: il piano km per km ───────────────────────────────────────────

export type StrategyId = "consigliata" | "sforzo" | "passo" | "custom";

export interface StrategyInput {
  id: StrategyId;
  /** Solo per "custom": −0,06…+0,06; positivo = chiudi forte (negative split). */
  split?: number;
  /** Solo per "custom": 0 = stesso passo in salita, 1 = stesso sforzo. */
  hills?: number;
}

export interface PlanSeg {
  km0: number;
  km1: number;
  grade: number;
  elev0: number;
  elev1: number;
  paceSec: number;
  timeSec: number;
  cumSec: number;
  /** Serbatoio rimasto alla fine del tratto. */
  tankLeft: number;
  locked: boolean;
}

export interface Plan {
  segs: PlanSeg[];
  totalSec: number;
  tankEnd: number;
  wallKm: number | null;
  /** "obiettivo": i tempi sono quelli chiesti, e reggono. "limite": non reggono,
   *  quindi il piano è riportato al tempo che vale davvero col tuo serbatoio. */
  fit: "obiettivo" | "limite";
}

/** Split bloccati a mano: indice dello split → passo reale in s/km. */
export type SplitLocks = Record<number, number>;

/** Il costo in serbatoio di un piano, dati i passi reali di ogni tratto. */
function planTank(course: Course, paces: number[], vdot: number): number {
  let used = 0;
  for (let i = 0; i < paces.length; i++) {
    const k = gradeFactor(course.grade[i]);
    used += ((course.seg[i] * paces[i]) / 60) * ratePerMin(paces[i] / k, vdot);
  }
  return used;
}

/**
 * Il livello per cui il tempo obiettivo, su quel percorso, è esattamente il
 * limite: con lo sforzo costante (l'ottimo) il serbatoio finisce sul traguardo.
 * Allo sforzo costante il consumo al minuto è lo stesso ovunque, quindi il
 * conto si chiude a mano: il passo "in piano" è il tempo diviso per la
 * distanza equivalente, e il VDOT è quello che regge quel passo per quel tempo.
 */
export function levelForCourse(course: Course, targetSec: number): number {
  const deq = equivalentFlatKm(course);
  const flatPace = targetSec / deq;
  return vo2At(60000 / flatPace) / sustainablePct(targetSec / 60);
}

/** La distanza che il percorso vale in piano, allo stesso sforzo. */
export function equivalentFlatKm(course: Course): number {
  return course.seg.reduce((s, d, i) => s + d * gradeFactor(course.grade[i]), 0);
}

/** Il miglior tempo possibile su quel percorso, a quel livello. */
export function bestTime(course: Course, vdot: number): number {
  const deq = equivalentFlatKm(course);
  // a sforzo costante: (tempo in min) × consumo al minuto = 1
  let lo = 110, hi = 1200;
  for (let i = 0; i < 56; i++) {
    const mid = (lo + hi) / 2;
    if (((mid * deq) / 60) * ratePerMin(mid, vdot) > 1) lo = mid; else hi = mid;
  }
  return ((lo + hi) / 2) * deq;
}

export interface RobustResult {
  /** Secondi al km più lenti nella prima metà. */
  deltaSec: number;
  /** Quanto costa se la giornata è esattamente quella prevista. */
  premiumSec: number;
  firstPace: number;
  secondPace: number;
  /** Il costo medio, sull'incertezza, del passo pari e della consigliata. */
  expectedEvenSec: number;
  expectedRobustSec: number;
  /** Giornata storta (1 σ peggio): passo pari vs consigliata, correggendo a metà. */
  badEvenSec: number;
  badRobustSec: number;
  sigmaPct: number;
}

/**
 * Perché partire un filo più piano: non per il cronometro, ma perché non sai
 * con esattezza quanto vali quel giorno.
 *
 * Il tuo limite vero oscilla attorno a quello previsto (σ). Corri la prima
 * metà a `limite + δ`; a metà gara le sensazioni ti dicono quanto vali
 * davvero e corri la seconda metà al passo che svuota il serbatoio sul
 * traguardo. Si cerca il δ che minimizza il tempo medio. L'asimmetria fa il
 * resto: partire troppo forte costa molto più che partire troppo piano.
 */
export function robustStart(distKm: number, vdot: number, sigmaPct: number): RobustResult {
  const P0 = limitPace(distKm, vdot);
  const half = distKm / 2;
  const nodes: { z: number; w: number }[] = [];
  for (let i = 0; i <= 24; i++) {
    const z = -3 + (6 * i) / 24;
    nodes.push({ z, w: Math.exp((-z * z) / 2) });
  }
  const wSum = nodes.reduce((s, n) => s + n.w, 0);
  // il VDOT di ogni giornata possibile, calcolato una volta sola
  const days = nodes.map((n) => {
    const L = P0 * (1 + (n.z * sigmaPct) / 100);
    return { ...n, L, v: levelFromEven(distKm, L) };
  });

  const timeWith = (delta: number, v: number): number => {
    const p1 = P0 + delta;
    const used = half * kmCost(p1, v);
    if (used >= 1) {
      // crollo prima di metà gara: fino al muro, poi il 25% più piano
      const w = 1 / kmCost(p1, v);
      return w * p1 + (distKm - w) * limitPace(distKm, v) * 1.25;
    }
    return half * p1 + half * paceForKmCost((1 - used) / half, v);
  };
  const expected = (delta: number) =>
    days.reduce((s, d) => s + d.w * (timeWith(delta, d.v) - distKm * d.L), 0) / wSum;

  let best = { delta: 0, e: expected(0) };
  for (let d = 0.5; d <= 15; d += 0.5) {
    const e = expected(d);
    if (e < best.e) best = { delta: d, e };
  }
  // rifinitura a un decimo di secondo
  for (let d = Math.max(0, best.delta - 0.4); d <= best.delta + 0.4; d += 0.1) {
    const e = expected(d);
    if (e < best.e) best = { delta: d, e };
  }
  const delta = Math.round(best.delta * 10) / 10;
  const firstUsed = half * kmCost(P0 + delta, vdot);
  const secondPace = paceForKmCost((1 - firstUsed) / half, vdot);
  const bad = levelFromEven(distKm, P0 * (1 + sigmaPct / 100));
  const Lbad = P0 * (1 + sigmaPct / 100);
  return {
    deltaSec: delta,
    premiumSec: half * (P0 + delta) + half * secondPace - distKm * P0,
    firstPace: P0 + delta,
    secondPace,
    expectedEvenSec: expected(0),
    expectedRobustSec: best.e,
    badEvenSec: timeWith(0, bad) - distKm * Lbad,
    badRobustSec: timeWith(delta, bad) - distKm * Lbad,
    sigmaPct,
  };
}

/**
 * La forma di una strategia: il moltiplicatore del passo reale di ogni tratto.
 * Il piano vero è la forma per un passo base, scelto dopo.
 */
function strategyShape(course: Course, s: StrategyInput, vdot: number, robust: RobustResult | null): number[] {
  const n = course.seg.length;
  const k = course.grade.map(gradeFactor);
  const mids: number[] = [];
  let x = 0;
  for (const d of course.seg) { mids.push(x + d / 2); x += d; }
  if (s.id === "passo") return new Array(n).fill(1);
  if (s.id === "sforzo") return k;
  if (s.id === "custom") {
    const split = clamp(s.split ?? 0, -0.1, 0.1);
    const h = clamp(s.hills ?? 1, 0, 1);
    return mids.map((m, i) => (1 + split * (0.5 - m / course.distKm)) * Math.pow(k[i], h));
  }
  // consigliata: sforzo costante, con la prima metà più prudente di δ e la
  // seconda al passo che al tuo livello svuota il serbatoio sul traguardo
  const r = robust ?? robustStart(course.distKm, vdot, 1.5);
  const E = bestTime(course, vdot) / equivalentFlatKm(course);
  const P0 = limitPace(course.distKm, vdot);
  const E1 = E * (1 + r.deltaSec / P0);
  const half = course.distKm / 2;
  const firstIdx = mids.map((m) => m < half);
  const deq1 = course.seg.reduce((acc, d, i) => acc + (firstIdx[i] ? d * k[i] : 0), 0);
  const deq2 = equivalentFlatKm(course) - deq1;
  const left = 1 - ((E1 * deq1) / 60) * ratePerMin(E1, vdot);
  let lo = 110, hi = 1200;
  for (let i = 0; i < 56; i++) {
    const mid = (lo + hi) / 2;
    if (((mid * deq2) / 60) * ratePerMin(mid, vdot) > left) lo = mid; else hi = mid;
  }
  const E2 = (lo + hi) / 2;
  return mids.map((_, i) => ((firstIdx[i] ? E1 : E2) / E) * k[i]);
}

/** L'indice dello split a cui appartiene ogni tratto da 100 m. */
export function splitIndexOf(course: Course, splitKm: number): number[] {
  let x = 0;
  return course.seg.map((d) => {
    const i = Math.floor((x + d / 2) / splitKm + 1e-9);
    x += d;
    return i;
  });
}

/**
 * Il piano: la forma della strategia, portata al tempo obiettivo se il
 * serbatoio lo regge, altrimenti al tempo che vale davvero (serbatoio a 0 sul
 * traguardo). Gli split bloccati a mano restano dove sono, il resto si adatta.
 */
export function buildPlan(
  course: Course, strategy: StrategyInput, targetSec: number, vdot: number,
  opts: { robust?: RobustResult | null; locks?: SplitLocks; splitKm?: number } = {},
): Plan {
  const shape = strategyShape(course, strategy, vdot, opts.robust ?? null);
  const locks = opts.locks ?? {};
  const splitOf = splitIndexOf(course, opts.splitKm ?? 1);
  const locked = splitOf.map((si) => locks[si] != null);
  const lockedTime = course.seg.reduce((s, d, i) => s + (locked[i] ? d * locks[splitOf[i]] : 0), 0);
  const shapeTime = course.seg.reduce((s, d, i) => s + (locked[i] ? 0 : d * shape[i]), 0);
  const pacesAt = (base: number) => shape.map((m, i) => (locked[i] ? locks[splitOf[i]] : base * m));

  let base = shapeTime > 0 ? (targetSec - lockedTime) / shapeTime : 0;
  let fit: Plan["fit"] = "obiettivo";
  const minBase = 110 / Math.max(...shape);
  if (!(base > minBase) || planTank(course, pacesAt(base), vdot) > 1 + 1e-7) {
    // non regge: il passo base più veloce che non svuota il serbatoio prima
    fit = "limite";
    let lo = Math.max(minBase, base > 0 ? base : minBase), hi = 1200 / Math.min(...shape);
    if (shapeTime <= 0 || planTank(course, pacesAt(hi), vdot) > 1) {
      base = hi;                          // non basta nemmeno camminare: resta il muro
    } else {
      for (let i = 0; i < 56; i++) {
        const mid = (lo + hi) / 2;
        if (planTank(course, pacesAt(mid), vdot) > 1) lo = mid; else hi = mid;
      }
      base = hi;
    }
  }

  const paces = pacesAt(base);
  const segs: PlanSeg[] = [];
  let cum = 0, tank = 1, x = 0, wallKm: number | null = null;
  paces.forEach((p, i) => {
    const d = course.seg[i];
    const k = gradeFactor(course.grade[i]);
    const cost = ((d * p) / 60) * ratePerMin(p / k, vdot);
    if (wallKm == null && tank - cost < -TANK_EPS) wallKm = x + d * Math.max(0, tank / cost);
    tank -= cost; cum += d * p;
    segs.push({
      km0: x, km1: x + d, grade: course.grade[i], elev0: course.elev[i], elev1: course.elev[i + 1],
      paceSec: p, timeSec: d * p, cumSec: cum, tankLeft: tank, locked: locked[i],
    });
    x += d;
  });
  return { segs, totalSec: cum, tankEnd: tank, wallKm, fit };
}

/** Il serbatoio km per km, per chi segue il piano alla lettera a quel livello. */
export function tankTrace(plan: Plan, vdot: number): { km: number; tank: number }[] {
  const out = [{ km: 0, tank: 1 }];
  let tank = 1;
  for (const s of plan.segs) {
    const k = gradeFactor(s.grade);
    const cost = (((s.km1 - s.km0) * s.paceSec) / 60) * ratePerMin(s.paceSec / k, vdot);
    if (tank - cost < 0) {
      out.push({ km: s.km0 + (s.km1 - s.km0) * Math.max(0, tank / cost), tank: 0 });
      break;
    }
    tank -= cost;
    out.push({ km: s.km1, tank });
  }
  return out;
}

/** Il livello di una giornata storta: il limite più lento di `sigmaPct` per cento. */
export function badDayVdot(distKm: number, vdot: number, sigmaPct: number): number {
  return levelFromEven(distKm, limitPace(distKm, vdot) * (1 + sigmaPct / 100));
}

/** Il piano seguito alla lettera da un atleta di un altro livello: dove si svuota. */
export function wallUnder(course: Course, plan: Plan, vdot: number): number | null {
  let tank = 1;
  for (let i = 0; i < plan.segs.length; i++) {
    const s = plan.segs[i];
    const k = gradeFactor(s.grade);
    const cost = (((s.km1 - s.km0) * s.paceSec) / 60) * ratePerMin(s.paceSec / k, vdot);
    if (tank - cost < -TANK_EPS) return s.km0 + (s.km1 - s.km0) * Math.max(0, tank / cost);
    tank -= cost;
  }
  return null;
}

/**
 * Una giornata storta, giocata da chi ragiona: il piano alla lettera fino a
 * metà gara, poi — ormai si sente come stanno le gambe — il meglio che resta,
 * a sforzo costante fino a svuotare il serbatoio. Quanto costa rispetto al
 * meglio possibile di quel giorno. Se il serbatoio finisce prima di metà gara
 * non c'è niente da correggere: resta il km del muro.
 */
export function halfwayPrice(course: Course, plan: Plan, vdot: number): { priceSec: number | null; wallKm: number | null } {
  const half = course.distKm / 2;
  let used = 0, t1 = 0, deq2 = 0;
  for (const s of plan.segs) {
    const d = s.km1 - s.km0;
    const k = gradeFactor(s.grade);
    if ((s.km0 + s.km1) / 2 < half) {
      const cost = ((d * s.paceSec) / 60) * ratePerMin(s.paceSec / k, vdot);
      if (used + cost > 1) return { priceSec: null, wallKm: s.km0 + d * Math.max(0, (1 - used) / cost) };
      used += cost; t1 += d * s.paceSec;
    } else {
      deq2 += d * k;
    }
  }
  const left = 1 - used;
  let lo = 110, hi = MAX_PACE;
  for (let i = 0; i < 56; i++) {
    const mid = (lo + hi) / 2;
    if (((mid * deq2) / 60) * ratePerMin(mid, vdot) > left) lo = mid; else hi = mid;
  }
  return { priceSec: t1 + hi * deq2 - bestTime(course, vdot), wallKm: null };
}

export interface Split {
  index: number;
  km0: number;
  km1: number;
  distKm: number;
  paceSec: number;
  timeSec: number;
  cumSec: number;
  /** Pendenza media, e metri su e giù. */
  grade: number;
  up: number;
  down: number;
  tankLeft: number;
  locked: boolean;
}

export function splitsOf(plan: Plan, course: Course, splitKm: number): Split[] {
  const idx = splitIndexOf(course, splitKm);
  const out: Split[] = [];
  plan.segs.forEach((s, i) => {
    const si = idx[i];
    let sp = out[out.length - 1];
    if (!sp || sp.index !== si) {
      sp = {
        index: si, km0: s.km0, km1: s.km0, distKm: 0, paceSec: 0, timeSec: 0, cumSec: 0,
        grade: 0, up: 0, down: 0, tankLeft: 1, locked: s.locked,
      };
      out.push(sp);
    }
    const d = s.km1 - s.km0;
    sp.km1 = s.km1; sp.distKm += d; sp.timeSec += s.timeSec; sp.cumSec = s.cumSec;
    sp.tankLeft = s.tankLeft; sp.locked = sp.locked || s.locked;
    const de = s.elev1 - s.elev0;
    if (de > 0) sp.up += de; else sp.down -= de;
    sp.grade += (s.elev1 - s.elev0);
  });
  for (const sp of out) {
    sp.paceSec = sp.timeSec / sp.distKm;
    sp.grade = sp.grade / (sp.distKm * 1000);
  }
  return out;
}

// ── 8. Formati ───────────────────────────────────────────────────────────────

/** "+7″", "−24″", "+1′05″": la differenza, col segno. */
export function fmtDelta(sec: number, plus = "+"): string {
  const s = Math.round(Math.abs(sec));
  const sign = sec > 0.5 ? plus : sec < -0.5 ? "−" : "±";
  if (s < 60) return `${sign}${s}″`;
  return `${sign}${Math.floor(s / 60)}′${String(s % 60).padStart(2, "0")}″`;
}

/** "19,6" — i km con la virgola. */
export const fmtKm = (km: number, digits = 1) => km.toFixed(digits).replace(".", ",");
export const fmtPct = (f: number) => `${Math.round(f * 100)}%`;
