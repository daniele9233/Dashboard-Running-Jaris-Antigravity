import type { Run } from "../../types/api";
import { buildMetrics } from "../celebrations/badgeRules";

/**
 * Dati condivisi dei 3 sistemi di gamification (Giro del Mondo · Odissea
 * Spaziale · Atlante Stellare). Statistiche reali dalle corse + geografia
 * (matematica great-circle, rotta intorno al mondo, posizione sui km).
 */

export const EARTH_CIRCUMFERENCE = 40075; // km

export interface GamiStats {
  totalKm: number;
  totalRuns: number;
  weekKm: number;
  longestRunKm: number;
  bestPaceSecKm: number | null;
  maxStreak: number;
  pbCount: number;
  recent: { date: string; km: number }[];
}

const dayNum = (d: string) => Math.floor(new Date(d.slice(0, 10) + "T00:00:00Z").getTime() / 86400000);
const paceToSec = (p?: string | null): number | null => {
  if (!p || !p.includes(":")) return null;
  const [m, s] = p.split(":");
  const v = parseInt(m, 10) * 60 + parseInt(s, 10);
  return v > 0 ? v : null;
};

export function computeGamiStats(runs: Run[]): GamiStats {
  const m = buildMetrics(runs);
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const mondayNum = Math.floor(monday.getTime() / 86400000);

  let weekKm = 0;
  for (const r of runs) if (dayNum(r.date) >= mondayNum) weekKm += r.distance_km || 0;

  let bestPace: number | null = null;
  for (const r of runs) {
    const ps = paceToSec(r.avg_pace);
    if (ps && (r.distance_km || 0) >= 3) bestPace = bestPace == null ? ps : Math.min(bestPace, ps);
  }

  const pbCount = [
    m.best5k != null, m.best10k != null, m.bestHalf != null, m.longestRunKm >= 21,
    m.maxStreak >= 7, m.weeklyMaxKm >= 50, m.totalKm >= 1000,
  ].filter(Boolean).length;

  const recent = [...runs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)
    .map((r) => ({ date: r.date.slice(0, 10), km: r.distance_km || 0 }));

  return {
    totalKm: m.totalKm, totalRuns: m.totalRuns, weekKm,
    longestRunKm: m.longestRunKm, bestPaceSecKm: bestPace, maxStreak: m.maxStreak, pbCount, recent,
  };
}

// ─── Geografia: rotta giro del mondo ──────────────────────────────────────────

export interface City { name: string; country: string; lat: number; lng: number }

/** Tappe reali verso est, circumnavigazione emisfero nord, ritorno a Roma. */
const WAYPOINTS: City[] = [
  { name: "Roma", country: "Italia", lat: 41.9028, lng: 12.4964 },
  { name: "Atene", country: "Grecia", lat: 37.9838, lng: 23.7275 },
  { name: "Istanbul", country: "Turchia", lat: 41.0082, lng: 28.9784 },
  { name: "Tbilisi", country: "Georgia", lat: 41.7151, lng: 44.8271 },
  { name: "Teheran", country: "Iran", lat: 35.6892, lng: 51.389 },
  { name: "Tashkent", country: "Uzbekistan", lat: 41.2995, lng: 69.2401 },
  { name: "Almaty", country: "Kazakistan", lat: 43.222, lng: 76.8512 },
  { name: "Pechino", country: "Cina", lat: 39.9042, lng: 116.4074 },
  { name: "Seoul", country: "Corea", lat: 37.5665, lng: 126.978 },
  { name: "Tokyo", country: "Giappone", lat: 35.6762, lng: 139.6503 },
  { name: "Honolulu", country: "Hawaii", lat: 21.3069, lng: -157.8583 },
  { name: "San Francisco", country: "USA", lat: 37.7749, lng: -122.4194 },
  { name: "Denver", country: "USA", lat: 39.7392, lng: -104.9903 },
  { name: "Chicago", country: "USA", lat: 41.8781, lng: -87.6298 },
  { name: "New York", country: "USA", lat: 40.7128, lng: -74.006 },
  { name: "Lisbona", country: "Portogallo", lat: 38.7223, lng: -9.1393 },
  { name: "Madrid", country: "Spagna", lat: 40.4168, lng: -3.7038 },
  { name: "Roma", country: "Italia", lat: 41.9028, lng: 12.4964 },
];

const R = 6371; // km
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversine(a: City | { lat: number; lng: number }, b: City | { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Interpolazione sul great-circle (slerp) tra due punti, frazione f∈[0,1]. */
export function greatCircle(a: { lat: number; lng: number }, b: { lat: number; lng: number }, f: number): { lat: number; lng: number } {
  const φ1 = toRad(a.lat), λ1 = toRad(a.lng), φ2 = toRad(b.lat), λ2 = toRad(b.lng);
  const d = 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  if (d === 0) return { lat: a.lat, lng: a.lng };
  const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return { lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), lng: toDeg(Math.atan2(y, x)) };
}

export interface RouteStop extends City { cumKm: number; reached: boolean }

/** Costruisce la rotta con distanze cumulative reali e stato "raggiunta". */
export function buildRoute(traveledKm: number): { stops: RouteStop[]; totalKm: number } {
  const stops: RouteStop[] = [];
  let cum = 0;
  for (let i = 0; i < WAYPOINTS.length; i++) {
    if (i > 0) cum += haversine(WAYPOINTS[i - 1], WAYPOINTS[i]);
    stops.push({ ...WAYPOINTS[i], cumKm: Math.round(cum), reached: cum <= traveledKm });
  }
  return { stops, totalKm: cum };
}

/** Posizione lat/lng al chilometro cumulato `km`, lungo i great-circle. */
export function positionAtKm(km: number): { lat: number; lng: number; fromIdx: number } {
  const { stops, totalKm } = buildRoute(km);
  const k = Math.max(0, Math.min(km, totalKm));
  for (let i = 1; i < stops.length; i++) {
    if (k <= stops[i].cumKm) {
      const seg = stops[i].cumKm - stops[i - 1].cumKm || 1;
      const f = (k - stops[i - 1].cumKm) / seg;
      const p = greatCircle(stops[i - 1], stops[i], f);
      return { ...p, fromIdx: i - 1 };
    }
  }
  const last = stops[stops.length - 1];
  return { lat: last.lat, lng: last.lng, fromIdx: stops.length - 1 };
}

// ─── Modalità EQUATORE ────────────────────────────────────────────────────────

/** Viaggio lungo l'equatore: parte da lng 0 verso est. */
export function equatorJourney(totalKm: number) {
  const f = (totalKm % EARTH_CIRCUMFERENCE) / EARTH_CIRCUMFERENCE;
  const endLng = f * 360;
  const steps = Math.max(2, Math.round(endLng / 2));
  const lit: [number, number][] = [];
  for (let i = 0; i <= steps; i++) lit.push([(endLng * i) / steps, 0]);
  const full: [number, number][] = [];
  for (let l = -180; l <= 180; l += 3) full.push([l, 0]);
  const curLng = ((endLng + 180) % 360) - 180;
  return { lit, full, curLng, lat: 0, pct: f * 100, lap: Math.floor(totalKm / EARTH_CIRCUMFERENCE) };
}

// ─── Posizione su una polilinea con distanze cumulative ───────────────────────

export interface CumRoute { distance: number; coords: [number, number][]; cum: number[] }

/** Interpola lng/lat e l'indice raggiunto su una rotta `cum` al chilometro `km`. */
export function positionOnCum(route: CumRoute, km: number): { lng: number; lat: number; idx: number } {
  const k = Math.max(0, Math.min(km, route.distance));
  const { coords, cum } = route;
  let lo = 0, hi = cum.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < k) lo = mid + 1; else hi = mid; }
  const i = Math.max(1, lo);
  const seg = cum[i] - cum[i - 1] || 1;
  const f = (k - cum[i - 1]) / seg;
  const a = coords[i - 1], b = coords[i];
  return { lng: a[0] + (b[0] - a[0]) * f, lat: a[1] + (b[1] - a[1]) * f, idx: i };
}

/** Polilinea densificata (per il rendering) fino a `uptoKm` (o intera rotta). */
export function routeLine(uptoKm: number | null): [number, number][] {
  const { stops } = buildRoute(uptoKm ?? Infinity);
  const pts: [number, number][] = [];
  for (let i = 1; i < stops.length; i++) {
    const segKm = stops[i].cumKm - stops[i - 1].cumKm;
    const startCum = stops[i - 1].cumKm;
    const steps = Math.max(8, Math.round(segKm / 120));
    for (let s = 0; s <= steps; s++) {
      const cumHere = startCum + (segKm * s) / steps;
      if (uptoKm != null && cumHere > uptoKm) break;
      const p = greatCircle(stops[i - 1], stops[i], s / steps);
      pts.push([p.lng, p.lat]);
    }
    if (uptoKm != null && stops[i].cumKm > uptoKm) break;
  }
  return pts;
}
