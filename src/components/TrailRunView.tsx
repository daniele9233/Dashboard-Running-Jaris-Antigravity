/**
 * TrailRunView — Premium trail run visualization + Live Telemetry 3D
 * Route: Monte Cavo Loop, Castelli Romani (Roma)
 * Mapbox outdoors-v12 + 3D terrain + slope heatmap + Live Telemetry chase-cam
 */
import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Map, Marker, NavigationControl, Source, Layer } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import type { LayerProps } from 'react-map-gl/mapbox';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  X, Droplets, Mountain, Clock, Heart, TrendingUp, ChevronDown, ChevronUp,
  Info, MapPin, Zap, Play, Pause, RotateCcw, Gauge, Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

// ─── Trail waypoints [lng, lat, elevation_m] ─────────────────────────────────
const WP: [number, number, number][] = [
  [12.7136, 41.7619, 680], [12.7140, 41.7624, 690], [12.7144, 41.7629, 700],
  [12.7149, 41.7634, 712], [12.7154, 41.7639, 724], [12.7159, 41.7644, 737],
  [12.7163, 41.7650, 750], [12.7168, 41.7655, 762], [12.7173, 41.7659, 774],
  [12.7178, 41.7662, 782], // ~2.8km — FONTANA
  [12.7183, 41.7666, 796], [12.7188, 41.7670, 811], [12.7192, 41.7675, 825],
  [12.7196, 41.7679, 840], [12.7200, 41.7683, 853], [12.7204, 41.7686, 866],
  [12.7207, 41.7689, 879], [12.7210, 41.7692, 893], [12.7212, 41.7695, 907],
  [12.7213, 41.7699, 921], [12.7214, 41.7703, 934], [12.7215, 41.7707, 944],
  [12.7215, 41.7710, 949], // SUMMIT ★
  [12.7214, 41.7714, 938], [12.7212, 41.7718, 925], [12.7209, 41.7723, 910],
  [12.7205, 41.7728, 893], [12.7200, 41.7733, 875], [12.7194, 41.7737, 856],
  [12.7187, 41.7741, 836], [12.7179, 41.7744, 814], [12.7170, 41.7746, 790],
  [12.7160, 41.7748, 770], // Via Sacra
  [12.7150, 41.7749, 756], [12.7140, 41.7748, 745], [12.7131, 41.7747, 737],
  [12.7122, 41.7745, 730], [12.7113, 41.7742, 726], [12.7106, 41.7739, 738],
  [12.7100, 41.7736, 745], // ~9.2km — SORGENTE
  [12.7095, 41.7732, 748], [12.7091, 41.7726, 746], [12.7089, 41.7720, 740],
  [12.7088, 41.7713, 730], [12.7090, 41.7706, 720], [12.7094, 41.7699, 710],
  [12.7099, 41.7692, 700], [12.7105, 41.7685, 692], [12.7111, 41.7678, 686],
  [12.7117, 41.7670, 683], [12.7122, 41.7662, 681], [12.7127, 41.7651, 680],
  [12.7131, 41.7641, 680], [12.7134, 41.7630, 680], [12.7136, 41.7619, 680],
];

// ─── Compute cumulative distance (km) per waypoint ───────────────────────────
function haverDist(a: [number, number, number], b: [number, number, number]): number {
  const R = 6371000;
  const dLat = (b[1] - a[1]) * Math.PI / 180;
  const dLon = (b[0] - a[0]) * Math.PI / 180;
  const lat1 = a[1] * Math.PI / 180;
  const lat2 = b[1] * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

const CUM_DIST: number[] = WP.reduce<number[]>((acc, pt, i) => {
  if (i === 0) return [0];
  return [...acc, acc[i - 1] + haverDist(WP[i - 1], pt) / 1000];
}, []);

const TOTAL_KM = CUM_DIST[CUM_DIST.length - 1];

// ─── Bearing between two waypoints ───────────────────────────────────────────
function computeBearing(a: [number, number, number], b: [number, number, number]): number {
  const toRad = (d: number) => d * Math.PI / 180;
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x = Math.cos(toRad(a[1])) * Math.sin(toRad(b[1]))
    - Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// ─── Smooth angle interpolation (shortest arc, frame-rate independent) ────────
function lerpAngle(from: number, to: number, t: number): number {
  let diff = ((to - from) % 360 + 360) % 360;
  if (diff > 180) diff -= 360; // shortest arc
  return from + diff * t;
}

// ─── Slope color ─────────────────────────────────────────────────────────────
function gradeColor(g: number): string {
  if (g > 14) return '#ef4444';
  if (g > 9)  return '#f97316';
  if (g > 5)  return '#eab308';
  if (g > 1)  return '#22c55e';
  if (g > -5) return '#94a3b8';
  if (g > -9) return '#60a5fa';
  return '#3b82f6';
}

// ─── HR zone color ────────────────────────────────────────────────────────────
function hrColor(hr: number): string {
  if (hr >= 165) return '#ef4444';
  if (hr >= 155) return '#f97316';
  if (hr >= 142) return '#eab308';
  return '#22c55e';
}

// ─── Format helpers ───────────────────────────────────────────────────────────
function fmtTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Elevation profile data ───────────────────────────────────────────────────
const ELEV_PROFILE = WP.map((pt, i) => ({
  km: parseFloat(CUM_DIST[i].toFixed(2)),
  elev: pt[2],
}));

// ─── Trail segments ───────────────────────────────────────────────────────────
const SEGMENTS = [
  { id: 1, name: 'Partenza → Fontana',  from: 0.0,  to: 2.8,  gain: 220, loss: 15,  grade: 7.3,  time: '24:12', diff: 'moderata',    color: '#eab308' },
  { id: 2, name: 'Fontana → Eremo',     from: 2.8,  to: 4.5,  gain: 183, loss: 10,  grade: 10.2, time: '20:34', diff: 'impegnativa', color: '#f97316' },
  { id: 3, name: 'Eremo → Vetta ★',    from: 4.5,  to: 5.4,  gain: 115, loss: 2,   grade: 12.8, time: '13:45', diff: 'molto dura',   color: '#ef4444' },
  { id: 4, name: 'Vetta → Via Sacra',   from: 5.4,  to: 7.8,  gain: 28,  loss: 238, grade: -8.7, time: '19:20', diff: 'discesa',      color: '#60a5fa' },
  { id: 5, name: 'Via Sacra → Sorgente',from: 7.8,  to: 9.2,  gain: 79,  loss: 123, grade: -3.1, time: '14:15', diff: 'rolling',      color: '#94a3b8' },
  { id: 6, name: 'Sorgente → Arrivo',   from: 9.2,  to: 12.4, gain: 0,   loss: 205, grade: -4.5, time: '20:02', diff: 'discesa',      color: '#60a5fa' },
];

// ─── Water sources ────────────────────────────────────────────────────────────
const WATER_SOURCES = [
  { id: 'w1', lng: 12.7178, lat: 41.7662, km: 2.8, name: 'Fontana Rocca di Papa', note: "Acqua potabile municipale — attiva tutto l'anno", reliable: true },
  { id: 'w2', lng: 12.7100, lat: 41.7736, km: 9.2, name: 'Sorgente Via Sacra', note: 'Sorgente naturale testata — presente da aprile a ottobre', reliable: true },
];

// ─── Simulation data per segment ─────────────────────────────────────────────
interface SimSeg {
  grade: number;
  paceSec: number;
  durationSec: number;
  hr: number;
  bearing: number;
  horizDist: number;
  dElev: number;
}

const SIM_DATA: SimSeg[] = WP.slice(0, -1).map((pt, i) => {
  const next = WP[i + 1];
  const horizDist = haverDist(pt, next);
  const dElev = next[2] - pt[2];
  const grade = horizDist > 0 ? (dElev / horizDist) * 100 : 0;
  const BASE = 420; // 7:00/km base pace in sec/km
  const paceSec = grade > 1
    ? BASE * (1 + Math.min(grade / 100 * 7, 1.9))
    : grade < -2
    ? BASE * Math.max(1 - Math.abs(grade) / 100 * 3, 0.52)
    : BASE * 1.05;
  const durationSec = (horizDist / 1000) * paceSec;
  const hr = Math.min(178, Math.max(128, Math.round(144 + Math.max(grade, 0) * 2.7)));
  const bearing = computeBearing(pt, next);
  return { grade, paceSec, durationSec, hr, bearing, horizDist, dElev };
});

// Total simulated time (real seconds)
const TOTAL_SIM_SEC = SIM_DATA.reduce((s, d) => s + d.durationSec, 0);

// Cumulative D+ at each waypoint index
const CUM_GAIN: number[] = SIM_DATA.reduce<number[]>((acc, seg, i) => {
  const prev = i === 0 ? 0 : acc[i - 1];
  return [...acc, prev + Math.max(seg.dElev, 0)];
}, []);

// ─── Component ───────────────────────────────────────────────────────────────
type ViewMode = 'map' | 'telemetry';

interface TrailRunViewProps {
  onClose: () => void;
}

export function TrailRunView({ onClose }: TrailRunViewProps) {
  const mapRef = useRef<MapRef>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [mapLoaded, setMapLoaded] = useState(false);

  // ── Map view state ──────────────────────────────────────────────────────────
  const [activeSegment, setActiveSegment] = useState<number | null>(null);
  const [hoveredWater, setHoveredWater] = useState<string | null>(null);
  const [activeChart, setActiveChart] = useState<{ km: number; elev: number } | null>(null);

  // ── Telemetry state ─────────────────────────────────────────────────────────
  const [playing, setPlaying] = useState(false);
  const [simSpeed, setSimSpeed] = useState(50);
  const [runnerPos, setRunnerPos] = useState<{ lng: number; lat: number; elev: number }>({
    lng: WP[0][0], lat: WP[0][1], elev: WP[0][2],
  });
  const [currentTelemetry, setCurrentTelemetry] = useState({
    wpIdx: 0, pct: 0, elapsedSec: 0, hr: 145, grade: 0, paceSec: 420,
    kmDone: 0, dPlusSoFar: 0, finished: false,
  });

  // Use refs for RAF loop to avoid stale closures
  const simRef = useRef({ wpIdx: 0, pct: 0, elapsedSec: 0 });
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const playingRef = useRef(false);
  const simSpeedRef = useRef(simSpeed);
  const smoothBearingRef = useRef(SIM_DATA[0].bearing);
  // Lerped HUD values — avoid instant jumps at segment boundaries
  const displayHrRef = useRef(145);
  const displayGradeRef = useRef(0);
  const displayPaceRef = useRef(420);
  // Frame counter — throttle React setState to ~30fps, map runs at 60fps
  const frameCountRef = useRef(0);

  useEffect(() => { simSpeedRef.current = simSpeed; }, [simSpeed]);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  // ── Reset telemetry ─────────────────────────────────────────────────────────
  const resetSim = useCallback(() => {
    setPlaying(false);
    playingRef.current = false;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    lastTsRef.current = null;
    simRef.current = { wpIdx: 0, pct: 0, elapsedSec: 0 };
    smoothBearingRef.current = SIM_DATA[0].bearing;
    displayHrRef.current = 145;
    displayGradeRef.current = 0;
    displayPaceRef.current = 420;
    frameCountRef.current = 0;
    // Clear covered trail source
    const m = mapRef.current?.getMap();
    (m?.getSource('trail-covered') as any)?.setData?.({ type: 'FeatureCollection', features: [] });
    setRunnerPos({ lng: WP[0][0], lat: WP[0][1], elev: WP[0][2] });
    setCurrentTelemetry({ wpIdx: 0, pct: 0, elapsedSec: 0, hr: 145, grade: 0, paceSec: 420, kmDone: 0, dPlusSoFar: 0, finished: false });
    // Fly to start
    const map = mapRef.current?.getMap();
    if (map) {
      map.flyTo({ center: [WP[0][0], WP[0][1]], zoom: 15.5, pitch: 65, bearing: SIM_DATA[0].bearing, duration: 1200 });
    }
  }, []);

  // ── Animation loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      lastTsRef.current = null;
      return;
    }

    const tick = (timestamp: number) => {
      if (!playingRef.current) return;
      if (lastTsRef.current === null) lastTsRef.current = timestamp;
      const dt = Math.min((timestamp - lastTsRef.current) / 1000, 0.1); // cap at 100ms
      lastTsRef.current = timestamp;

      const simDt = dt * simSpeedRef.current;
      let { wpIdx, pct, elapsedSec } = simRef.current;

      elapsedSec += simDt;

      // Advance through segments
      let remaining = simDt;
      while (remaining > 0 && wpIdx < SIM_DATA.length) {
        const seg = SIM_DATA[wpIdx];
        const segRemaining = (1 - pct) * seg.durationSec;
        if (remaining >= segRemaining) {
          remaining -= segRemaining;
          wpIdx++;
          pct = 0;
          if (wpIdx >= SIM_DATA.length) { wpIdx = SIM_DATA.length - 1; pct = 1; break; }
        } else {
          pct += remaining / seg.durationSec;
          remaining = 0;
        }
      }

      simRef.current = { wpIdx, pct, elapsedSec };

      // Interpolate position
      const isFinished = wpIdx >= SIM_DATA.length;
      const safeIdx = Math.min(wpIdx, SIM_DATA.length - 1);
      const ptA = WP[safeIdx];
      const ptB = wpIdx < SIM_DATA.length ? WP[safeIdx + 1] : WP[WP.length - 1];
      const safePct = isFinished ? 1 : pct;
      const lng = ptA[0] + (ptB[0] - ptA[0]) * safePct;
      const lat = ptA[1] + (ptB[1] - ptA[1]) * safePct;
      const elev = Math.round(ptA[2] + (ptB[2] - ptA[2]) * safePct);

      const seg = SIM_DATA[safeIdx];
      const nextDist = CUM_DIST[Math.min(safeIdx + 1, WP.length - 1)] ?? CUM_DIST[safeIdx];
      const rawKm = CUM_DIST[safeIdx] + (nextDist - CUM_DIST[safeIdx]) * safePct;
      const kmDone = parseFloat(Math.min(rawKm, TOTAL_KM).toFixed(2));
      const dPlusSoFar = Math.round((CUM_GAIN[safeIdx] ?? 0) + Math.max(seg.dElev * safePct, 0));

      // ── Lerp HUD values (smooth transitions at segment boundaries) ─────────
      const lerpK = 1 - Math.exp(-5 * dt); // ~0.077 per frame at 60fps
      displayHrRef.current += (seg.hr - displayHrRef.current) * lerpK;
      displayGradeRef.current += (seg.grade - displayGradeRef.current) * lerpK;
      displayPaceRef.current += (seg.paceSec - displayPaceRef.current) * lerpK;

      // ── Chase-cam: jumpTo with lerped bearing (no easeTo conflicts) ──────────
      const map = mapRef.current?.getMap();
      if (map) {
        const targetBearing = isFinished ? smoothBearingRef.current : seg.bearing;
        smoothBearingRef.current = lerpAngle(smoothBearingRef.current, targetBearing,
          1 - Math.exp(-6 * dt));
        map.jumpTo({ center: [lng, lat], zoom: 15.5, pitch: 65, bearing: smoothBearingRef.current });
      }

      // ── Update covered trail GeoJSON directly — bypass React to avoid flicker ─
      if (map) {
        const src = map.getSource('trail-covered') as any;
        if (src?.setData) {
          const coords: [number, number][] = [];
          for (let i = 0; i <= safeIdx && i < WP.length; i++) coords.push([WP[i][0], WP[i][1]]);
          if (!isFinished && safePct > 0) coords.push([lng, lat]);
          src.setData({
            type: 'FeatureCollection',
            features: coords.length > 1
              ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }]
              : [],
          });
        }
      }

      // ── Throttle React state to every 2 frames (~30fps) ─────────────────────
      frameCountRef.current++;
      if (frameCountRef.current % 2 === 0) {
        setRunnerPos({ lng, lat, elev });
        setCurrentTelemetry({
          wpIdx: safeIdx, pct: safePct, elapsedSec,
          hr: Math.round(displayHrRef.current),
          grade: parseFloat(displayGradeRef.current.toFixed(1)),
          paceSec: Math.round(displayPaceRef.current),
          kmDone: parseFloat(kmDone.toString()),
          dPlusSoFar, finished: isFinished,
        });
      }

      if (isFinished) {
        setPlaying(false);
        playingRef.current = false;
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  // ── Switch to telemetry mode ────────────────────────────────────────────────
  const enterTelemetry = useCallback(() => {
    setViewMode('telemetry');
    resetSim();
    // After map loads/reloads, fly to start in first-person
    setTimeout(() => {
      const map = mapRef.current?.getMap();
      if (map) {
        map.flyTo({ center: [WP[0][0], WP[0][1]], zoom: 15.5, pitch: 65, bearing: SIM_DATA[0].bearing, duration: 1500 });
      }
    }, 300);
  }, [resetSim]);

  // ── Slope GeoJSON ───────────────────────────────────────────────────────────
  const slopeFeatures = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: WP.slice(0, -1).map((pt, i) => {
      const next = WP[i + 1];
      const horizDist = haverDist(pt, next);
      const dElev = next[2] - pt[2];
      const grade = horizDist > 0 ? (dElev / horizDist) * 100 : 0;
      return {
        type: 'Feature' as const,
        properties: { grade, color: gradeColor(grade) },
        geometry: { type: 'LineString' as const, coordinates: [[pt[0], pt[1]], [next[0], next[1]]] },
      };
    }),
  }), []);

  // NOTE: covered trail GeoJSON is updated directly via map.getSource().setData()
  // in the RAF loop — no useMemo or React state to avoid per-frame re-renders

  // ── Map bounds ──────────────────────────────────────────────────────────────
  const bounds = useMemo(() => {
    const lngs = WP.map(p => p[0]);
    const lats = WP.map(p => p[1]);
    return { minLng: Math.min(...lngs) - 0.005, maxLng: Math.max(...lngs) + 0.005, minLat: Math.min(...lats) - 0.005, maxLat: Math.max(...lats) + 0.005 };
  }, []);

  // ── Map load ────────────────────────────────────────────────────────────────
  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (!map.getSource('mapbox-dem')) {
      map.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
    }
    map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.8 });

    // Add covered trail source/layer imperatively — never touched by React
    if (!map.getSource('trail-covered')) {
      map.addSource('trail-covered', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'trail-covered-glow',
        type: 'line',
        source: 'trail-covered',
        paint: { 'line-color': '#C0FF00', 'line-width': 5, 'line-opacity': 0.88 },
        layout: { 'line-cap': 'round', 'line-join': 'round', 'visibility': 'visible' },
      });
    }

    setMapLoaded(true);
    if (viewMode === 'map') {
      map.fitBounds([[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]], { padding: 60, pitch: 55, bearing: -25, duration: 2000 });
    } else {
      map.flyTo({ center: [WP[0][0], WP[0][1]], zoom: 15.5, pitch: 65, bearing: SIM_DATA[0].bearing, duration: 1500 });
    }
  }, [bounds, viewMode]);

  const trailLineLayer: LayerProps = {
    id: 'trail-slope',
    type: 'line',
    paint: { 'line-color': ['get', 'color'], 'line-width': 6, 'line-opacity': 1 },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  };

  const totalGain = SEGMENTS.reduce((s, seg) => s + seg.gain, 0);
  const totalLoss = SEGMENTS.reduce((s, seg) => s + seg.loss, 0);
  const maxElev = Math.max(...WP.map(p => p[2]));
  const minElev = Math.min(...WP.map(p => p[2]));

  // ── Current segment for telemetry ───────────────────────────────────────────
  const currentSegmentName = useMemo(() => {
    const km = currentTelemetry.kmDone;
    return SEGMENTS.find(s => km >= s.from && km < s.to)?.name ?? SEGMENTS[SEGMENTS.length - 1].name;
  }, [currentTelemetry.kmDone]);

  // ── Progress pct ────────────────────────────────────────────────────────────
  const progressPct = Math.min((currentTelemetry.kmDone / TOTAL_KM) * 100, 100);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#04080F] flex flex-col overflow-hidden"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/8 bg-[#060B14]/90 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏔️</span>
            <div>
              <h1 className="text-sm font-black text-white tracking-tight">Monte Cavo Loop</h1>
              <p className="text-[10px] text-gray-500 font-semibold">Castelli Romani · Roma · 6 Apr 2026</p>
            </div>
          </div>
          {/* Quick stats inline */}
          <div className="hidden md:flex items-center gap-5 ml-6 pl-6 border-l border-white/8">
            {[
              { label: 'DISTANZA', value: '12.4 km' },
              { label: 'D+', value: `${totalGain}m`, color: '#f97316' },
              { label: 'D−', value: `${totalLoss}m`, color: '#60a5fa' },
              { label: 'TEMPO', value: '2:28:00' },
              { label: 'PACE', value: '11:56/km' },
              { label: 'HR MED', value: '158 bpm' },
            ].map(s => (
              <div key={s.label} className="flex flex-col">
                <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">{s.label}</span>
                <span className="text-xs font-black" style={{ color: s.color || 'white' }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode toggle */}
          <div className="flex bg-[#0A1020] border border-white/10 rounded-xl p-1 gap-1">
            <button
              onClick={() => { setViewMode('map'); if (playing) { setPlaying(false); } }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'map' ? 'bg-[#1E293B] text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <MapPin className="w-3 h-3" /> Mappa
            </button>
            <button
              onClick={enterTelemetry}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'telemetry' ? 'bg-[#C0FF00]/20 text-[#C0FF00] shadow border border-[#C0FF00]/30' : 'text-gray-500 hover:text-[#C0FF00]/70'}`}
            >
              <Gauge className="w-3 h-3" /> Live Telemetry 3D
            </button>
          </div>
          <span className="px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[9px] font-black uppercase tracking-widest border border-emerald-500/30">
            TRAIL PREMIUM
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/12 border border-white/8 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── LEFT PANEL (map mode only) ──────────────────────────────────── */}
        <AnimatePresence>
          {viewMode === 'map' && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex-shrink-0 flex flex-col border-r border-white/8 overflow-y-auto bg-[#060B14] overflow-hidden"
              style={{ width: 340 }}
            >
              {/* Segments */}
              <div className="p-4 border-b border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-3.5 h-3.5 text-[#C0FF00]" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Analisi Segmenti</span>
                </div>
                <div className="space-y-1.5">
                  {SEGMENTS.map(seg => {
                    const isActive = activeSegment === seg.id;
                    const isUp = seg.grade > 0;
                    return (
                      <div
                        key={seg.id}
                        className={`rounded-xl border transition-all cursor-pointer overflow-hidden ${isActive ? 'border-white/20 bg-white/5' : 'border-white/5 bg-white/[0.02] hover:border-white/10'}`}
                        onClick={() => setActiveSegment(isActive ? null : seg.id)}
                      >
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: seg.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-black text-white/90 truncate">{seg.name}</div>
                            <div className="text-[9px] text-gray-600 font-semibold">{seg.from.toFixed(1)}→{seg.to.toFixed(1)} km</div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {isUp ? <ChevronUp className="w-3 h-3 text-orange-400" /> : <ChevronDown className="w-3 h-3 text-blue-400" />}
                            <span className="text-[11px] font-black" style={{ color: seg.color }}>{isUp ? '+' : ''}{seg.grade.toFixed(1)}%</span>
                          </div>
                        </div>
                        <AnimatePresence>
                          {isActive && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="px-3 pb-3 grid grid-cols-3 gap-2">
                                {[
                                  { label: 'D+', value: `${seg.gain}m`, color: '#f97316' },
                                  { label: 'D−', value: `${seg.loss}m`, color: '#60a5fa' },
                                  { label: 'TEMPO', value: seg.time, color: '#C0FF00' },
                                  { label: 'DIFFICOLTÀ', value: seg.diff, color: seg.color },
                                  { label: 'LUNGHEZZA', value: `${(seg.to - seg.from).toFixed(1)}km`, color: 'white' },
                                  { label: 'PENDENZA', value: `${Math.abs(seg.grade).toFixed(1)}%`, color: seg.color },
                                ].map(item => (
                                  <div key={item.label} className="bg-white/5 rounded-lg p-2">
                                    <div className="text-[8px] font-black text-gray-600 uppercase tracking-wider mb-0.5">{item.label}</div>
                                    <div className="text-[10px] font-black" style={{ color: item.color }}>{item.value}</div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Water Sources */}
              <div className="p-4 border-b border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <Droplets className="w-3.5 h-3.5 text-[#60a5fa]" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Fonti d'Acqua</span>
                </div>
                <div className="space-y-2">
                  {WATER_SOURCES.map(w => (
                    <div key={w.id} className={`rounded-xl border p-3 transition-all ${hoveredWater === w.id ? 'border-blue-400/40 bg-blue-400/5' : 'border-white/5 bg-white/[0.02]'}`}
                      onMouseEnter={() => setHoveredWater(w.id)} onMouseLeave={() => setHoveredWater(null)}>
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Droplets className="w-3.5 h-3.5 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-black text-white">{w.name}</span>
                            {w.reliable && <span className="text-[7px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-black uppercase">affidabile</span>}
                          </div>
                          <div className="text-[9px] text-gray-500 leading-relaxed">{w.note}</div>
                          <div className="mt-1.5 flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 text-blue-400" />
                            <span className="text-[9px] font-black text-blue-400">Km {w.km.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trail Info */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Info Percorso</span>
                </div>
                <div className="space-y-2 text-[10px] text-gray-400 leading-relaxed">
                  {[
                    { icon: <Mountain className="w-3 h-3 text-orange-400 mt-0.5 flex-shrink-0" />, text: <>Quota max: <strong className="text-white">949m</strong> (Vetta Monte Cavo) · Quota min: <strong className="text-white">680m</strong></> },
                    { icon: <Zap className="w-3 h-3 text-[#C0FF00] mt-0.5 flex-shrink-0" />, text: 'Terreno misto: sentiero forestale, strada acciottolata (Via Sacra), tracce ripide' },
                    { icon: <Heart className="w-3 h-3 text-rose-400 mt-0.5 flex-shrink-0" />, text: <>FC media <strong className="text-white">158 bpm</strong> (83% FCmax) · picco <strong className="text-white">178 bpm</strong> in vetta</> },
                    { icon: <Clock className="w-3 h-3 text-purple-400 mt-0.5 flex-shrink-0" />, text: 'Partenza ore 06:30 · Arrivo 08:58 · Condizioni: sereno 8°C' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">{item.icon}<span>{item.text}</span></div>
                  ))}
                </div>
                {/* Slope legend */}
                <div className="mt-4 pt-3 border-t border-white/5">
                  <div className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-2">Legenda Pendenze</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { color: '#22c55e', label: '1–5%' }, { color: '#eab308', label: '5–9%' },
                      { color: '#f97316', label: '9–14%' }, { color: '#ef4444', label: '>14%' },
                      { color: '#94a3b8', label: 'piano' }, { color: '#60a5fa', label: 'discesa' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-1">
                        <div className="w-3 h-1.5 rounded-full" style={{ background: item.color }} />
                        <span className="text-[8px] text-gray-500">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── RIGHT: Map + Elevation ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 relative">

          {/* ── Mapbox ─────────────────────────────────────────────────────── */}
          <div className="flex-1 relative min-h-0">
            <Map
              ref={mapRef}
              mapboxAccessToken={MAPBOX_TOKEN}
              mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
              initialViewState={{ longitude: 12.7175, latitude: 41.769, zoom: 13, pitch: 55, bearing: -25 }}
              style={{ width: '100%', height: '100%' }}
              onLoad={handleMapLoad}
              // Disable interactions when telemetry is playing
              dragPan={!playing}
              scrollZoom={!playing}
              dragRotate={!playing}
            >
              {viewMode === 'map' && <NavigationControl position="top-right" />}

              {/* Trail shadow/halo — thick black outline for contrast on satellite */}
              <Source id="trail-bg" type="geojson" data={{ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: WP.map(p => [p[0], p[1]]) } }] }}>
                <Layer id="trail-shadow" type="line" paint={{ 'line-color': '#000', 'line-width': 10, 'line-opacity': 0.55 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} beforeId="trail-slope" />
              </Source>

              {/* Slope-colored trail */}
              <Source id="trail-slope" type="geojson" data={slopeFeatures}>
                <Layer {...trailLineLayer} />
              </Source>

              {/* covered trail is managed imperatively via handleMapLoad + RAF setData — no JSX Source needed */}

              {/* Markers (map mode only) */}
              {viewMode === 'map' && (
                <>
                  <Marker longitude={WP[0][0]} latitude={WP[0][1]} anchor="center">
                    <div className="w-8 h-8 rounded-full bg-[#C0FF00] border-2 border-white shadow-lg flex items-center justify-center text-xs font-black text-black">S</div>
                  </Marker>
                  <Marker longitude={WP[WP.length - 1][0]} latitude={WP[WP.length - 1][1] - 0.0003} anchor="center">
                    <div className="w-8 h-8 rounded-full bg-white border-2 border-[#C0FF00] shadow-lg flex items-center justify-center text-xs font-black text-black">F</div>
                  </Marker>
                  <Marker longitude={WP[22][0]} latitude={WP[22][1]} anchor="bottom">
                    <div className="flex flex-col items-center">
                      <div className="bg-[#1a0a00] border border-orange-400/60 rounded-xl px-2.5 py-1.5 shadow-2xl">
                        <div className="text-[10px] font-black text-orange-400 flex items-center gap-1"><Mountain className="w-3 h-3" />Monte Cavo</div>
                        <div className="text-[9px] text-white font-black">949m · km 5.4</div>
                      </div>
                      <div className="w-0.5 h-3 bg-orange-400/60" />
                      <div className="w-2 h-2 rounded-full bg-orange-400" />
                    </div>
                  </Marker>
                  {WATER_SOURCES.map(w => (
                    <Marker key={w.id} longitude={w.lng} latitude={w.lat} anchor="bottom">
                      <div className={`flex flex-col items-center transition-transform ${hoveredWater === w.id ? 'scale-125' : ''}`}
                        onMouseEnter={() => setHoveredWater(w.id)} onMouseLeave={() => setHoveredWater(null)}>
                        <div className={`bg-[#00081a] border rounded-xl px-2 py-1 shadow-xl transition-all ${hoveredWater === w.id ? 'border-blue-400/80 bg-blue-950/80' : 'border-blue-500/40'}`}>
                          <div className="text-[9px] font-black text-blue-400 flex items-center gap-1">
                            <Droplets className="w-2.5 h-2.5" />{hoveredWater === w.id ? w.name : `H₂O km ${w.km}`}
                          </div>
                        </div>
                        <div className="w-0.5 h-2 bg-blue-400/60" />
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                      </div>
                    </Marker>
                  ))}
                  {activeChart && (() => {
                    const idx = ELEV_PROFILE.findIndex(p => Math.abs(p.km - activeChart.km) < 0.15);
                    if (idx < 0 || idx >= WP.length) return null;
                    const pt = WP[idx];
                    return (
                      <Marker longitude={pt[0]} latitude={pt[1]} anchor="center">
                        <div className="w-3 h-3 rounded-full bg-white border-2 border-[#C0FF00] animate-pulse shadow-lg" />
                      </Marker>
                    );
                  })()}
                </>
              )}

              {/* Runner marker (telemetry mode) */}
              {viewMode === 'telemetry' && (
                <Marker longitude={runnerPos.lng} latitude={runnerPos.lat} anchor="center">
                  <div className="relative flex items-center justify-center">
                    {/* Outer pulse ring */}
                    <div className="absolute w-10 h-10 rounded-full bg-[#C0FF00] opacity-20 animate-ping" />
                    <div className="absolute w-7 h-7 rounded-full bg-[#C0FF00] opacity-30 animate-ping" style={{ animationDelay: '0.15s' }} />
                    {/* Core dot */}
                    <div className="w-5 h-5 rounded-full bg-[#C0FF00] border-2 border-white shadow-[0_0_20px_#C0FF00] relative z-10" />
                    {/* HR bubble above */}
                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/85 border border-[#C0FF00]/40 rounded-lg px-2 py-1 shadow-xl z-20">
                      <span className="text-[10px] font-black" style={{ color: hrColor(currentTelemetry.hr) }}>{currentTelemetry.hr} bpm</span>
                    </div>
                  </div>
                </Marker>
              )}
            </Map>

            {/* ── Map overlay: dislivello badge (map mode) ───────────────── */}
            {viewMode === 'map' && (
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 pointer-events-none">
                <div className="text-[8px] text-gray-500 uppercase tracking-widest font-black mb-0.5">Dislivello</div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-orange-400">↑ {totalGain}m</span>
                  <span className="text-[11px] font-black text-blue-400">↓ {totalLoss}m</span>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* ── LIVE TELEMETRY 3D HUD (telemetry mode overlay) ─────────── */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {viewMode === 'telemetry' && (
              <>
                {/* Top progress bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-white/5 z-20 pointer-events-none">
                  <motion.div
                    className="h-full bg-[#C0FF00] shadow-[0_0_8px_#C0FF00]"
                    style={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>

                {/* Top-left: LIVE badge + segment name */}
                <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5 pointer-events-none">
                  <div className="flex items-center gap-2">
                    {playing && (
                      <span className="flex items-center gap-1 bg-red-500/20 border border-red-500/50 rounded-full px-2 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[8px] font-black text-red-400 uppercase tracking-widest">REC</span>
                      </span>
                    )}
                    <span className="bg-black/70 backdrop-blur border border-[#C0FF00]/20 rounded-full px-2 py-0.5">
                      <span className="text-[8px] font-black text-[#C0FF00] uppercase tracking-widest">TELEMETRIA 3D</span>
                    </span>
                  </div>
                  {(playing || currentTelemetry.kmDone > 0) && (
                    <div className="bg-black/70 backdrop-blur border border-white/10 rounded-xl px-3 py-1.5 max-w-[220px]">
                      <div className="text-[7px] text-gray-500 uppercase tracking-widest font-black mb-0.5">Segmento corrente</div>
                      <div className="text-[10px] font-black text-white truncate">{currentSegmentName}</div>
                    </div>
                  )}
                </div>

                {/* Top-right: speed selector */}
                <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
                  {[10, 20, 50, 100].map(s => (
                    <button
                      key={s}
                      onClick={() => setSimSpeed(s)}
                      className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${simSpeed === s ? 'bg-[#C0FF00]/20 text-[#C0FF00] border border-[#C0FF00]/40' : 'bg-black/60 text-gray-500 border border-white/10 hover:text-gray-300'}`}
                    >
                      {s}×
                    </button>
                  ))}
                </div>

                {/* Bottom HUD: metrics + controls */}
                <div className="absolute bottom-0 left-0 right-0 z-20">
                  {/* Gradient fade */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

                  <div className="relative px-4 pb-3 pt-6 flex items-end justify-between gap-3">
                    {/* ── Metric tiles ── */}
                    <div className="flex gap-2 flex-wrap">
                      {[
                        {
                          label: 'HEART RATE',
                          value: currentTelemetry.finished ? '—' : String(currentTelemetry.hr),
                          unit: 'bpm',
                          color: hrColor(currentTelemetry.hr),
                          icon: <Heart className="w-3 h-3" />,
                        },
                        {
                          label: 'PASSO',
                          value: currentTelemetry.finished ? '—' : fmtPace(currentTelemetry.paceSec),
                          unit: '/km',
                          color: currentTelemetry.paceSec < 480 ? '#C0FF00' : currentTelemetry.paceSec < 720 ? '#eab308' : '#f97316',
                          icon: <Activity className="w-3 h-3" />,
                        },
                        {
                          label: 'PENDENZA',
                          value: currentTelemetry.finished ? '—' : `${currentTelemetry.grade > 0 ? '+' : ''}${currentTelemetry.grade.toFixed(1)}`,
                          unit: '%',
                          color: gradeColor(currentTelemetry.grade),
                          icon: <TrendingUp className="w-3 h-3" />,
                        },
                        {
                          label: 'ELEVAZIONE',
                          value: String(currentTelemetry.finished ? WP[WP.length - 1][2] : runnerPos.elev),
                          unit: 'm slm',
                          color: '#f97316',
                          icon: <Mountain className="w-3 h-3" />,
                        },
                        {
                          label: 'DISTANZA',
                          value: currentTelemetry.finished ? TOTAL_KM.toFixed(1) : currentTelemetry.kmDone.toFixed(2),
                          unit: `/ ${TOTAL_KM.toFixed(1)} km`,
                          color: 'white',
                          icon: <MapPin className="w-3 h-3" />,
                        },
                        {
                          label: 'D+ EFFETTIVO',
                          value: String(currentTelemetry.finished ? totalGain : currentTelemetry.dPlusSoFar),
                          unit: `/ ${totalGain}m`,
                          color: '#f97316',
                          icon: <Zap className="w-3 h-3" />,
                        },
                        {
                          label: 'TEMPO',
                          value: fmtTime(currentTelemetry.elapsedSec),
                          unit: '',
                          color: '#a78bfa',
                          icon: <Clock className="w-3 h-3" />,
                        },
                      ].map(tile => (
                        <div key={tile.label} className="bg-black/70 backdrop-blur border border-white/10 rounded-xl px-3 py-2 min-w-[80px]">
                          <div className="flex items-center gap-1 mb-1" style={{ color: tile.color }}>
                            {tile.icon}
                            <span className="text-[7px] font-black uppercase tracking-widest text-gray-500">{tile.label}</span>
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black leading-none font-mono" style={{ color: tile.color }}>{tile.value}</span>
                            {tile.unit && <span className="text-[8px] text-gray-500 font-bold">{tile.unit}</span>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* ── Controls ── */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {currentTelemetry.finished && (
                        <div className="bg-[#C0FF00]/10 border border-[#C0FF00]/40 rounded-xl px-4 py-2 text-center">
                          <div className="text-[10px] font-black text-[#C0FF00] uppercase tracking-widest">🏁 Arrivo!</div>
                          <div className="text-[9px] text-gray-400">{fmtTime(currentTelemetry.elapsedSec)} · {currentTelemetry.dPlusSoFar}m D+</div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {/* Reset */}
                        <button
                          onClick={resetSim}
                          className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/12 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
                          title="Reset"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        {/* Play/Pause */}
                        <button
                          onClick={() => {
                            if (currentTelemetry.finished) { resetSim(); return; }
                            setPlaying(p => !p);
                          }}
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black transition-all shadow-xl ${playing ? 'bg-white/10 border border-white/20 text-white hover:bg-white/20' : 'bg-[#C0FF00] text-black hover:bg-[#d4ff33] shadow-[0_0_20px_#C0FF00]/50'}`}
                          title={playing ? 'Pausa' : 'Play'}
                        >
                          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                        </button>
                      </div>
                      {!playing && !currentTelemetry.finished && currentTelemetry.kmDone === 0 && (
                        <div className="text-[8px] text-gray-500 text-right uppercase tracking-widest">
                          Premi ▶ per iniziare
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Elevation Profile ─────────────────────────────────────────── */}
          <div className="h-[150px] flex-shrink-0 bg-[#060B14] border-t border-white/8 px-4 pt-3 pb-2">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Profilo Altimetrico</span>
              {viewMode === 'map' && activeChart && (
                <span className="text-[8px] text-[#C0FF00] font-black">km {activeChart.km.toFixed(1)} · {activeChart.elev}m slm</span>
              )}
              {viewMode === 'telemetry' && (
                <span className="text-[8px] text-[#C0FF00] font-black">
                  ▶ km {currentTelemetry.kmDone.toFixed(2)} · {runnerPos.elev}m slm
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={ELEV_PROFILE}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                onMouseMove={(e: any) => { if (viewMode === 'map' && e.activePayload?.[0]) setActiveChart(e.activePayload[0].payload); }}
                onMouseLeave={() => viewMode === 'map' && setActiveChart(null)}
              >
                <defs>
                  <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#1E293B" />
                <XAxis dataKey="km" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 8 }}
                  tickFormatter={(v: number) => `${v.toFixed(0)}km`} interval={Math.floor(ELEV_PROFILE.length / 8)} />
                <YAxis domain={[minElev - 30, maxElev + 30]} axisLine={false} tickLine={false}
                  tick={{ fill: '#334155', fontSize: 8 }} tickFormatter={(v: number) => `${v}m`} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-[#0F172A] border border-white/10 rounded-lg px-2 py-1.5 text-xs shadow-xl">
                      <div className="text-[#C0FF00] font-black">km {d.km.toFixed(2)}</div>
                      <div className="text-white font-black">{d.elev}m slm</div>
                    </div>
                  );
                }} />
                <ReferenceLine x={5.4} stroke="#f97316" strokeDasharray="3 3" strokeWidth={1.5}
                  label={{ value: '★ 949m', fill: '#f97316', fontSize: 8, position: 'top' }} />
                {WATER_SOURCES.map(w => (
                  <ReferenceLine key={w.id} x={w.km} stroke="#60a5fa" strokeDasharray="2 3" strokeWidth={1.2}
                    label={{ value: '💧', fill: '#60a5fa', fontSize: 9, position: 'top' }} />
                ))}
                {/* Runner position cursor (telemetry mode) */}
                {viewMode === 'telemetry' && currentTelemetry.kmDone > 0 && (
                  <ReferenceLine x={currentTelemetry.kmDone} stroke="#C0FF00" strokeWidth={2}
                    label={{ value: '▲', fill: '#C0FF00', fontSize: 10, position: 'insideBottomLeft' }} />
                )}
                <Area type="monotone" dataKey="elev" stroke="#f97316" strokeWidth={2} fill="url(#elevGrad)"
                  dot={false} activeDot={{ r: 4, fill: '#C0FF00', stroke: '#fff', strokeWidth: 1.5 }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
