import type { Run } from "../../types/api";
import { dayIndex, paceToSec } from "./gamiCore";
import {
  COUNTRIES, COUNTRY_BY_ISO, CONTINENT_ORDER, CONTINENTS, HOME_ISO,
  type BiomeId, type ContinentId, type Country,
} from "./worldData";

/**
 * CONQUISTA DEL MONDO — le regole.
 *
 * In Italia si marcia coi chilometri. Il mondo è un'altra guerra, e ha tre
 * vincoli, ognuno legato a una cosa vera del tuo allenamento:
 *
 *   GLI XP     sono l'esercito. Una nazione costa quanto è grande (la radice
 *              della superficie: attraversarla di corsa), e il bioma la rende
 *              più cara. Le sedute di qualità rendono più XP: è la qualità che
 *              conquista, non il chilometraggio a vuoto.
 *
 *   LA GITTATA dice fin dove arrivi. Si attacca solo una capitale abbastanza
 *              vicina a una tua, e la distanza che reggi la decide il tuo lungo
 *              più lungo. Il Mediterraneo si attraversa sempre; l'Atlantico no.
 *
 *   I PASSAPORTI aprono i biomi. Il deserto lo apre chi ha corso al caldo vero,
 *              il gelo chi è uscito sotto i 4 gradi, l'alta quota chi ha messo
 *              un Everest di dislivello nelle gambe in un anno. Non si comprano:
 *              si corrono.
 *
 * Sopra tutto questo ci sono le MERAVIGLIE — le città delle grandi maratone,
 * più Roma — che si prendono solo tenendo la nazione E facendo l'impresa.
 * Ognuna, come ogni continente completato, rende più forte l'impero: le
 * conquiste costano meno, anche quelle già fatte.
 */

// ── la geografia ──────────────────────────────────────────────────────────────
const R_EARTH = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(s));
}

/**
 * L'arco di cerchio massimo fra due punti, pronto per la mappa. Le longitudini
 * sono "srotolate" — possono passare 180 — così una rotta che attraversa il
 * Pacifico non fa il giro del mondo al contrario.
 */
export function greatCircleArc(a: { lat: number; lng: number }, b: { lat: number; lng: number }, steps = 48): [number, number][] {
  const φ1 = rad(a.lat), λ1 = rad(a.lng), φ2 = rad(b.lat), λ2 = rad(b.lng);
  const d = 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  if (d === 0) return [[a.lng, a.lat], [b.lng, b.lat]];
  const out: [number, number][] = [];
  let prevLng: number | null = null;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    let lng = deg(Math.atan2(y, x));
    if (prevLng != null) {
      while (lng - prevLng > 180) lng -= 360;
      while (lng - prevLng < -180) lng += 360;
    }
    prevLng = lng;
    out.push([lng, deg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  return out;
}

// ── i numeri della corsa che il gioco legge ───────────────────────────────────
export interface WorldStats {
  longestKm: number;
  /** Corse all'aperto a 28 °C o più. */
  hotRuns: number;
  /** Corse all'aperto con almeno 22 °C e l'80% di umidità. */
  humidRuns: number;
  /** Corse all'aperto a 4 °C o meno. */
  coldRuns: number;
  /** Dislivello positivo degli ultimi 365 giorni, in metri. */
  climb365: number;
  maxWeekKm: number;
  maxMonthKm: number;
  /** Il miglior 5000 che il passo medio di una corsa da 5 km in su permette. */
  best5kSec: number | null;
  /** C'è almeno una corsa da 10 km in su con la seconda metà più veloce. */
  negativeSplit: boolean;
  /** Uscite partite prima delle 7. */
  dawnRuns: number;
  /** La serie più lunga di settimane consecutive con almeno tre uscite. */
  steadyWeeks: number;
}

const isRun = (r: Run) => (r.distance_km || 0) >= 0.5 && (r.duration_minutes || 0) >= 3;

export function worldStats(runsIn: Run[], todayIso: string = new Date().toISOString()): WorldStats {
  const runs = (runsIn ?? []).filter(isRun);
  const today = dayIndex(todayIso);
  const s: WorldStats = {
    longestKm: 0, hotRuns: 0, humidRuns: 0, coldRuns: 0, climb365: 0, maxWeekKm: 0, maxMonthKm: 0,
    best5kSec: null, negativeSplit: false, dawnRuns: 0, steadyWeeks: 0,
  };
  const weekKm = new Map<number, number>(), weekRuns = new Map<number, number>(), monthKm = new Map<string, number>();
  for (const r of runs) {
    const km = r.distance_km || 0, day = dayIndex(r.date);
    s.longestKm = Math.max(s.longestKm, km);
    const outdoor = !r.is_treadmill;
    const t = r.temperature;
    if (outdoor && t != null) {
      if (t >= 28) s.hotRuns++;
      if (t <= 4) s.coldRuns++;
      if (t >= 22 && (r.humidity ?? 0) >= 80) s.humidRuns++;
    }
    if (today - day <= 365 && day <= today) s.climb365 += r.elevation_gain || 0;
    const monday = day - ((day + 3) % 7);
    weekKm.set(monday, (weekKm.get(monday) ?? 0) + km);
    weekRuns.set(monday, (weekRuns.get(monday) ?? 0) + 1);
    const month = r.date.slice(0, 7);
    monthKm.set(month, (monthKm.get(month) ?? 0) + km);

    const pace = paceToSec(r.avg_pace);
    if (outdoor && pace && km >= 5) s.best5kSec = Math.min(s.best5kSec ?? Infinity, pace * 5);

    const splits = (r.splits ?? []).filter((x) => (x.distance || 0) >= 900 && (x.elapsed_time || 0) > 0);
    if (!s.negativeSplit && km >= 10 && splits.length >= 10) {
      const half = Math.floor(splits.length / 2);
      const pace = (xs: typeof splits) => xs.reduce((a, x) => a + x.elapsed_time, 0) / xs.reduce((a, x) => a + x.distance, 0);
      // almeno l'1% più veloce: un pareggio non è un negative split
      if (pace(splits.slice(half)) < pace(splits.slice(0, half)) * 0.99) s.negativeSplit = true;
    }
    const start = r.start_date_local;
    if (start && start.length >= 13 && +start.slice(11, 13) < 7) s.dawnRuns++;
  }
  s.maxWeekKm = Math.max(0, ...weekKm.values());
  s.maxMonthKm = Math.max(0, ...monthKm.values());
  let streak = 0;
  for (const monday of [...weekRuns.keys()].sort((a, b) => a - b)) {
    const full = (weekRuns.get(monday) ?? 0) >= 3;
    // una settimana senza uscite non compare fra le chiavi: la serie si spezza lì
    const prevFull = (weekRuns.get(monday - 7) ?? 0) >= 3;
    streak = full ? (prevFull ? streak + 1 : 1) : 0;
    s.steadyWeeks = Math.max(s.steadyWeeks, streak);
  }
  return s;
}

// ── la gittata ────────────────────────────────────────────────────────────────
/**
 * Fin dove arriva l'impero: mille chilometri di base, più ottanta per ogni
 * chilometro del tuo lungo più lungo. Con 22 km si passa dalla Groenlandia al
 * Canada; per l'Atlantico da Capo Verde servono 33 km, per l'Antartide 29.
 */
export const RANGE_BASE_KM = 1000;
export const RANGE_PER_LONG_KM = 80;
export const rangeKm = (longestKm: number) => Math.round(RANGE_BASE_KM + RANGE_PER_LONG_KM * longestKm);
/** Il lungo che serve per coprire una distanza. */
export const longRunFor = (km: number) => Math.max(0, Math.ceil((km - RANGE_BASE_KM) / RANGE_PER_LONG_KM));

// ── i passaporti ──────────────────────────────────────────────────────────────
export interface Passport {
  biome: BiomeId;
  name: string;
  emoji: string;
  /** Cosa serve, detto in una riga. */
  requirement: string;
  value: number;
  target: number;
  unit: string;
  progress: number;
  unlocked: boolean;
  color: string;
}

export function passports(s: WorldStats): Record<BiomeId, Passport> {
  const mk = (biome: BiomeId, name: string, emoji: string, requirement: string, value: number, target: number, unit: string, color: string): Passport =>
    ({ biome, name, emoji, requirement, value, target, unit, color, progress: target > 0 ? Math.min(1, value / target) : 1, unlocked: value >= target });
  return {
    t: mk("t", "Temperato", "🌿", "libero: è casa", 1, 0, "", "#A3E635"),
    d: mk("d", "Deserto", "🏜️", "10 corse a 28° o più", s.hotRuns, 10, "corse", "#F59E0B"),
    j: mk("j", "Tropici", "🌴", "15 corse con 22° e umidità all'80%", s.humidRuns, 15, "corse", "#22C55E"),
    m: mk("m", "Alta quota", "🏔️", "8.849 m di dislivello in 12 mesi: un Everest", Math.round(s.climb365), 8849, "m", "#A78BFA"),
    g: mk("g", "Gelo", "❄️", "5 corse a 4° o meno", s.coldRuns, 5, "corse", "#22D3EE"),
  };
}

// ── le meraviglie ─────────────────────────────────────────────────────────────
export interface WonderDef {
  id: string; city: string; iso: string; lat: number; lng: number;
  title: string; challenge: string; emoji: string;
}
export const WONDERS: WonderDef[] = [
  { id: "roma", city: "Roma", iso: "IT", lat: 41.903, lng: 12.496, emoji: "🏛️", title: "Unità d'Italia", challenge: "conquista tutte le 20 regioni" },
  { id: "atene", city: "Atene", iso: "GR", lat: 37.984, lng: 23.728, emoji: "🏺", title: "Maratona", challenge: "42,2 km in una settimana" },
  { id: "berlino", city: "Berlino", iso: "DE", lat: 52.520, lng: 13.405, emoji: "⚡", title: "Il percorso veloce", challenge: "un 5K sotto i 20′" },
  { id: "londra", city: "Londra", iso: "GB", lat: 51.507, lng: -0.128, emoji: "☔", title: "Costanza inglese", challenge: "12 settimane di fila con 3 uscite" },
  { id: "boston", city: "Boston", iso: "US", lat: 42.360, lng: -71.059, emoji: "🦄", title: "La qualificazione", challenge: "VDOT 50" },
  { id: "newyork", city: "New York", iso: "US", lat: 40.713, lng: -74.006, emoji: "🗽", title: "Cinque distretti", challenge: "un lungo da 21,1 km" },
  { id: "chicago", city: "Chicago", iso: "US", lat: 41.878, lng: -87.630, emoji: "🌬️", title: "Negative split", challenge: "10 km+ chiusi più forte di come sei partito" },
  { id: "tokyo", city: "Tokyo", iso: "JP", lat: 35.676, lng: 139.650, emoji: "🌅", title: "Il sol levante", challenge: "10 uscite partite prima delle 7" },
  { id: "sydney", city: "Sydney", iso: "AU", lat: -33.869, lng: 151.209, emoji: "🌊", title: "Mese australe", challenge: "200 km in un mese" },
];

export interface Wonder {
  def: WonderDef;
  /** L'impresa è fatta. */
  met: boolean;
  /** La nazione è nell'impero. */
  owned: boolean;
  /** Tutte e due: la meraviglia è tua e conta nello sconto. */
  claimed: boolean;
  progress: number;
  /** "38/42,2 km". */
  status: string;
}

const fmtNum = (v: number, digits = 0) => v.toLocaleString("it-IT", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
const fmtMin = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

export function wonders(s: WorldStats, owned: Set<string>, vdot: number | null, italyRegions: { done: number; total: number }): Wonder[] {
  const read: Record<string, { value: number; target: number; status: string; lowerIsBetter?: boolean }> = {
    roma: { value: italyRegions.done, target: italyRegions.total, status: `${italyRegions.done}/${italyRegions.total} regioni` },
    atene: { value: s.maxWeekKm, target: 42.195, status: `${fmtNum(s.maxWeekKm, 1)}/42,2 km` },
    berlino: { value: s.best5kSec ?? Infinity, target: 1200, lowerIsBetter: true, status: s.best5kSec ? `migliore ${fmtMin(s.best5kSec)}` : "nessun 5K" },
    londra: { value: s.steadyWeeks, target: 12, status: `${s.steadyWeeks}/12 settimane` },
    boston: { value: vdot ?? 0, target: 50, status: vdot ? `VDOT ${fmtNum(vdot, 1)}` : "VDOT in arrivo" },
    newyork: { value: s.longestKm, target: 21.0975, status: `${fmtNum(s.longestKm, 1)}/21,1 km` },
    chicago: { value: s.negativeSplit ? 1 : 0, target: 1, status: s.negativeSplit ? "fatto" : "non ancora" },
    tokyo: { value: s.dawnRuns, target: 10, status: `${s.dawnRuns}/10 uscite` },
    sydney: { value: s.maxMonthKm, target: 200, status: `${fmtNum(s.maxMonthKm)}/200 km` },
  };
  return WONDERS.map((def) => {
    const r = read[def.id];
    const met = r.lowerIsBetter ? r.value <= r.target : r.value >= r.target;
    const progress = r.lowerIsBetter
      ? (Number.isFinite(r.value) ? Math.min(1, r.target / r.value) : 0)
      : Math.min(1, r.target > 0 ? r.value / r.target : 0);
    const isOwned = def.iso === HOME_ISO || owned.has(def.iso);
    return { def, met, owned: isOwned, claimed: met && isOwned, progress, status: r.status };
  });
}

// ── i prezzi ──────────────────────────────────────────────────────────────────
/** XP per chilometro di "attraversamento" (radice della superficie). */
export const XP_PER_CROSSING_KM = 2;
/**
 * XP per chilometro di spedizione da Roma. Senza, un atollo del Pacifico
 * costava quanto San Marino e gli arcipelaghi diventavano ponti gratuiti verso
 * l'altra parte del mondo. Si misura da casa, non dal fronte: così il prezzo di
 * una nazione non cambia a seconda di cosa hai conquistato prima.
 */
export const XP_PER_EXPEDITION_KM = 0.05;
export const BIOME_COST: Record<BiomeId, number> = { t: 1, d: 1.2, j: 1.2, m: 1.3, g: 1.3 };
export const MIN_COST = 20;
/** Sconto per continente completato e per meraviglia presa, e il tetto. */
export const CONTINENT_DISCOUNT = 0.1;
export const WONDER_DISCOUNT = 0.03;
export const MAX_DISCOUNT = 0.5;

export const baseCost = (c: Country) => Math.max(MIN_COST, Math.round(
  Math.sqrt(c.areaKm2) * XP_PER_CROSSING_KM * BIOME_COST[c.biome]
  + distanceKm(COUNTRY_BY_ISO[HOME_ISO], c) * XP_PER_EXPEDITION_KM,
));
const priced = (c: Country, discount: number) => Math.max(MIN_COST, Math.round(baseCost(c) * (1 - discount)));

// ── lo stato del mondo ────────────────────────────────────────────────────────
export type CountryStatus = "home" | "owned" | "attackable" | "poor" | "passport" | "range";

export interface CountryState {
  country: Country;
  status: CountryStatus;
  cost: number;
  /** Distanza dalla capitale tua più vicina. */
  distanceKm: number;
  nearest: Country | null;
  /** XP che mancano, se lo stato è "poor". */
  missingXp: number;
  /** Il lungo che servirebbe per arrivarci, se lo stato è "range". */
  longRunNeeded: number;
}

export interface ContinentState { id: ContinentId; name: string; owned: number; total: number; done: boolean }

export interface WorldState {
  totalXp: number;
  spentXp: number;
  availableXp: number;
  discount: number;
  range: number;
  stats: WorldStats;
  passports: Record<BiomeId, Passport>;
  wonders: Wonder[];
  continents: ContinentState[];
  countries: CountryState[];
  byIso: Record<string, CountryState>;
  owned: number;
  total: number;
  /** Le rotte dell'impero: da ogni conquista alla capitale che l'ha raggiunta. */
  arcs: [number, number][][];
}

export function buildWorld(input: {
  runs: Run[]; totalXp: number; owned: Set<string>; vdot: number | null;
  italyRegions: { done: number; total: number }; todayIso?: string;
}): WorldState {
  const stats = worldStats(input.runs, input.todayIso);
  const pass = passports(stats);
  const range = rangeKm(stats.longestKm);
  const owned = new Set([...input.owned].filter((iso) => COUNTRY_BY_ISO[iso]));
  owned.add(HOME_ISO);

  const continents: ContinentState[] = CONTINENT_ORDER.map((id) => {
    const all = COUNTRIES.filter((c) => c.continent === id);
    const n = all.filter((c) => owned.has(c.iso)).length;
    return { id, name: CONTINENTS[id].name, owned: n, total: all.length, done: n === all.length };
  });
  const wonderList = wonders(stats, owned, input.vdot, input.italyRegions);
  const discount = Math.min(
    MAX_DISCOUNT,
    continents.filter((c) => c.done && c.id !== "AN").length * CONTINENT_DISCOUNT
      + wonderList.filter((w) => w.claimed).length * WONDER_DISCOUNT,
  );

  const ownedList = COUNTRIES.filter((c) => owned.has(c.iso));
  const spentXp = ownedList.filter((c) => c.iso !== HOME_ISO).reduce((s, c) => s + priced(c, discount), 0);
  const availableXp = Math.max(0, input.totalXp - spentXp);

  const countries: CountryState[] = COUNTRIES.map((c) => {
    let nearest: Country | null = null, dist = Infinity;
    for (const o of ownedList) {
      if (o.iso === c.iso) continue;
      const d = distanceKm(o, c);
      if (d < dist) { dist = d; nearest = o; }
    }
    const cost = c.iso === HOME_ISO ? 0 : priced(c, discount);
    let status: CountryStatus;
    if (c.iso === HOME_ISO) status = "home";
    else if (owned.has(c.iso)) status = "owned";
    else if (dist > range) status = "range";
    else if (!pass[c.biome].unlocked) status = "passport";
    else if (cost > availableXp) status = "poor";
    else status = "attackable";
    return {
      country: c, status, cost, distanceKm: Math.round(dist === Infinity ? 0 : dist), nearest,
      missingXp: status === "poor" ? cost - availableXp : 0,
      longRunNeeded: status === "range" ? longRunFor(dist) : 0,
    };
  });

  return {
    totalXp: input.totalXp, spentXp, availableXp, discount, range, stats,
    passports: pass, wonders: wonderList, continents,
    countries, byIso: Object.fromEntries(countries.map((s) => [s.country.iso, s])),
    owned: ownedList.length, total: COUNTRIES.length,
    arcs: empireArcs(ownedList),
  };
}

/**
 * Le rotte: l'albero che collega le conquiste partendo da casa, ogni nazione
 * attaccata alla capitale più vicina già dentro l'impero (Prim). Non è la
 * storia vera delle conquiste — il database ne conserva l'elenco, non l'ordine —
 * ma è la rete più corta che le tiene insieme, ed è così che un impero si legge.
 */
function empireArcs(owned: Country[]): [number, number][][] {
  const home = owned.find((c) => c.iso === HOME_ISO);
  if (!home) return [];
  const rest = owned.filter((c) => c.iso !== HOME_ISO);
  // Prim in O(n²): per ogni nazione fuori dall'albero, il suo aggancio migliore
  const link = rest.map((c) => ({ c, from: home, d: distanceKm(home, c) }));
  const arcs: [number, number][][] = [];
  while (link.length) {
    let bi = 0;
    for (let i = 1; i < link.length; i++) if (link[i].d < link[bi].d) bi = i;
    const [next] = link.splice(bi, 1);
    arcs.push(greatCircleArc(next.from, next.c, Math.max(8, Math.min(64, Math.round(next.d / 150)))));
    for (const l of link) {
      const d = distanceKm(next.c, l.c);
      if (d < l.d) { l.d = d; l.from = next.c; }
    }
  }
  return arcs;
}
