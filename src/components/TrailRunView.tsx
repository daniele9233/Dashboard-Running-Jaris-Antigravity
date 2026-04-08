/**
 * TrailRunView — Premium trail run visualization
 * Route: Monte Cavo Loop, Castelli Romani (Roma)
 * Mapbox outdoors-v12 + 3D terrain + slope heatmap + water sources
 */
import { useRef, useMemo, useEffect, useState } from 'react';
import { Map, Marker, NavigationControl, Source, Layer } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import type { LayerProps } from 'react-map-gl/mapbox';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import 'mapbox-gl/dist/mapbox-gl.css';
import { X, Droplets, Mountain, Clock, Heart, TrendingUp, ChevronDown, ChevronUp, Info, MapPin, Zap } from 'lucide-react';
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
  const prev = acc[i - 1];
  return [...acc, prev + haverDist(WP[i - 1], pt) / 1000];
}, []);

const TOTAL_KM = CUM_DIST[CUM_DIST.length - 1]; // ~12.4km

// ─── Slope segments GeoJSON (for color-coded trail line) ─────────────────────
function gradeColor(g: number): string {
  if (g > 14) return '#ef4444';
  if (g > 9)  return '#f97316';
  if (g > 5)  return '#eab308';
  if (g > 1)  return '#22c55e';
  if (g > -5) return '#94a3b8';
  if (g > -9) return '#60a5fa';
  return '#3b82f6';
}

const slopeGeoJSON = useMemo
  ? undefined  // will compute inside component
  : undefined;

// ─── Elevation profile data ───────────────────────────────────────────────────
const ELEV_PROFILE = WP.map((pt, i) => ({
  km: parseFloat(CUM_DIST[i].toFixed(2)),
  elev: pt[2],
}));

// ─── Trail segments ───────────────────────────────────────────────────────────
const SEGMENTS = [
  { id: 1, name: 'Partenza → Fontana',       from: 0.0,  to: 2.8,  gain: 220, loss: 15,  grade: 7.3,  time: '24:12', diff: 'moderata',    color: '#eab308' },
  { id: 2, name: 'Fontana → Eremo',           from: 2.8,  to: 4.5,  gain: 183, loss: 10,  grade: 10.2, time: '20:34', diff: 'impegnativa', color: '#f97316' },
  { id: 3, name: 'Eremo → Vetta ★',           from: 4.5,  to: 5.4,  gain: 115, loss: 2,   grade: 12.8, time: '13:45', diff: 'molto dura',   color: '#ef4444' },
  { id: 4, name: 'Vetta → Via Sacra',          from: 5.4,  to: 7.8,  gain: 28,  loss: 238, grade: -8.7, time: '19:20', diff: 'discesa',      color: '#60a5fa' },
  { id: 5, name: 'Via Sacra → Sorgente',       from: 7.8,  to: 9.2,  gain: 79,  loss: 123, grade: -3.1, time: '14:15', diff: 'rolling',      color: '#94a3b8' },
  { id: 6, name: 'Sorgente → Arrivo',          from: 9.2,  to: 12.4, gain: 0,   loss: 205, grade: -4.5, time: '20:02', diff: 'discesa',      color: '#60a5fa' },
];

// ─── Water sources ────────────────────────────────────────────────────────────
const WATER_SOURCES = [
  {
    id: 'w1', lng: 12.7178, lat: 41.7662, km: 2.8,
    name: 'Fontana Rocca di Papa',
    note: 'Acqua potabile municipale — attiva tutto l\'anno',
    reliable: true,
  },
  {
    id: 'w2', lng: 12.7100, lat: 41.7736, km: 9.2,
    name: 'Sorgente Via Sacra',
    note: 'Sorgente naturale testata — presente da aprile a ottobre',
    reliable: true,
  },
];

// ─── Component ───────────────────────────────────────────────────────────────
interface TrailRunViewProps {
  onClose: () => void;
}

export function TrailRunView({ onClose }: TrailRunViewProps) {
  const mapRef = useRef<MapRef>(null);
  const [activeSegment, setActiveSegment] = useState<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredWater, setHoveredWater] = useState<string | null>(null);
  const [activeChart, setActiveChart] = useState<{ km: number; elev: number } | null>(null);

  // Compute slope GeoJSON
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
        geometry: {
          type: 'LineString' as const,
          coordinates: [[pt[0], pt[1]], [next[0], next[1]]],
        },
      };
    }),
  }), []);

  // Map bounds
  const bounds = useMemo(() => {
    const lngs = WP.map(p => p[0]);
    const lats = WP.map(p => p[1]);
    return {
      minLng: Math.min(...lngs) - 0.005,
      maxLng: Math.max(...lngs) + 0.005,
      minLat: Math.min(...lats) - 0.005,
      maxLat: Math.max(...lats) + 0.005,
    };
  }, []);

  // Add 3D terrain on map load
  const handleMapLoad = () => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (!map.getSource('mapbox-dem')) {
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });
    }
    map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.8 });
    setMapLoaded(true);
    // Fly to fit bounds with 3D pitch
    map.fitBounds(
      [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
      { padding: 60, pitch: 55, bearing: -25, duration: 2000 }
    );
  };

  const trailLineLayer: LayerProps = {
    id: 'trail-slope',
    type: 'line',
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 4.5,
      'line-opacity': 0.95,
    },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  };

  // Stats
  const totalGain = SEGMENTS.reduce((s, seg) => s + seg.gain, 0);
  const totalLoss = SEGMENTS.reduce((s, seg) => s + seg.loss, 0);
  const maxElev = Math.max(...WP.map(p => p[2]));
  const minElev = Math.min(...WP.map(p => p[2]));

  const activeSegData = activeSegment !== null ? SEGMENTS.find(s => s.id === activeSegment) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#04080F] flex flex-col overflow-hidden"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/8 bg-[#060B14]/80 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏔️</span>
            <div>
              <h1 className="text-sm font-black text-white tracking-tight">Monte Cavo Loop</h1>
              <p className="text-[10px] text-gray-500 font-semibold">Castelli Romani · Roma · 5 Apr 2026</p>
            </div>
          </div>
          {/* Quick stats inline */}
          <div className="hidden md:flex items-center gap-5 ml-6 pl-6 border-l border-white/8">
            {[
              { label: 'DISTANZA', value: '12.4 km' },
              { label: 'D+', value: `${totalGain}m`, color: '#f97316' },
              { label: 'D−', value: `${totalLoss}m`, color: '#60a5fa' },
              { label: 'TEMPO', value: '1:52:08' },
              { label: 'PACE', value: '9:03/km' },
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

        {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
        <div className="w-[340px] flex-shrink-0 flex flex-col border-r border-white/8 overflow-y-auto bg-[#060B14]">

          {/* ── Segments ─────────────────────────────────────────────────── */}
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
                      {/* Color dot */}
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: seg.color }} />
                      {/* Name + distance */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-black text-white/90 truncate">{seg.name}</div>
                        <div className="text-[9px] text-gray-600 font-semibold">{seg.from.toFixed(1)}→{seg.to.toFixed(1)} km</div>
                      </div>
                      {/* Grade */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isUp
                          ? <ChevronUp className="w-3 h-3 text-orange-400" />
                          : <ChevronDown className="w-3 h-3 text-blue-400" />}
                        <span className="text-[11px] font-black" style={{ color: seg.color }}>
                          {isUp ? '+' : ''}{seg.grade.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
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

          {/* ── Water Sources ─────────────────────────────────────────────── */}
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <Droplets className="w-3.5 h-3.5 text-[#60a5fa]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Fonti d'Acqua</span>
            </div>
            <div className="space-y-2">
              {WATER_SOURCES.map(w => (
                <div
                  key={w.id}
                  className={`rounded-xl border p-3 transition-all ${hoveredWater === w.id ? 'border-blue-400/40 bg-blue-400/5' : 'border-white/5 bg-white/[0.02]'}`}
                  onMouseEnter={() => setHoveredWater(w.id)}
                  onMouseLeave={() => setHoveredWater(null)}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Droplets className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-black text-white">{w.name}</span>
                        {w.reliable && (
                          <span className="text-[7px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-black uppercase">affidabile</span>
                        )}
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

          {/* ── Trail Info ────────────────────────────────────────────────── */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Info Percorso</span>
            </div>
            <div className="space-y-2 text-[10px] text-gray-400 leading-relaxed">
              <div className="flex items-start gap-2">
                <Mountain className="w-3 h-3 text-orange-400 mt-0.5 flex-shrink-0" />
                <span>Quota max: <strong className="text-white">949m</strong> (Vetta Monte Cavo) · Quota min: <strong className="text-white">680m</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <Zap className="w-3 h-3 text-[#C0FF00] mt-0.5 flex-shrink-0" />
                <span>Terreno misto: sentiero forestale, strada acciottolata (Via Sacra), tracce ripide</span>
              </div>
              <div className="flex items-start gap-2">
                <Heart className="w-3 h-3 text-rose-400 mt-0.5 flex-shrink-0" />
                <span>FC media <strong className="text-white">158 bpm</strong> (83% FCmax) · picco <strong className="text-white">178 bpm</strong> in vetta</span>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-3 h-3 text-purple-400 mt-0.5 flex-shrink-0" />
                <span>Partenza ore 06:30 · Arrivo 08:22 · Condizioni: sereno 8°C</span>
              </div>
            </div>

            {/* Slope legend */}
            <div className="mt-4 pt-3 border-t border-white/5">
              <div className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-2">Legenda Pendenze</div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { color: '#22c55e', label: '1–5%' },
                  { color: '#eab308', label: '5–9%' },
                  { color: '#f97316', label: '9–14%' },
                  { color: '#ef4444', label: '>14%' },
                  { color: '#94a3b8', label: 'piano' },
                  { color: '#60a5fa', label: 'discesa' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-1">
                    <div className="w-3 h-1.5 rounded-full" style={{ background: item.color }} />
                    <span className="text-[8px] text-gray-500">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Map + Elevation ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 relative">

          {/* ── Mapbox outdoors with 3D terrain ── */}
          <div className="flex-1 relative min-h-0">
            <Map
              ref={mapRef}
              mapboxAccessToken={MAPBOX_TOKEN}
              mapStyle="mapbox://styles/mapbox/outdoors-v12"
              initialViewState={{
                longitude: 12.7175,
                latitude: 12.768,
                zoom: 13,
                pitch: 55,
                bearing: -25,
              }}
              style={{ width: '100%', height: '100%' }}
              onLoad={handleMapLoad}
            >
              <NavigationControl position="top-right" />

              {/* Trail line colored by slope */}
              <Source id="trail-slope" type="geojson" data={slopeFeatures}>
                <Layer {...trailLineLayer} />
              </Source>

              {/* Trail outline (shadow) */}
              <Source id="trail-bg" type="geojson" data={{
                type: 'FeatureCollection',
                features: [{
                  type: 'Feature',
                  properties: {},
                  geometry: { type: 'LineString', coordinates: WP.map(p => [p[0], p[1]]) }
                }]
              }}>
                <Layer
                  id="trail-shadow"
                  type="line"
                  paint={{ 'line-color': '#000', 'line-width': 7, 'line-opacity': 0.4 }}
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                  beforeId="trail-slope"
                />
              </Source>

              {/* START marker */}
              <Marker longitude={WP[0][0]} latitude={WP[0][1]} anchor="center">
                <div className="w-8 h-8 rounded-full bg-[#C0FF00] border-2 border-white shadow-lg flex items-center justify-center text-xs font-black text-black">
                  S
                </div>
              </Marker>

              {/* FINISH marker */}
              <Marker longitude={WP[WP.length - 1][0]} latitude={WP[WP.length - 1][1] - 0.0003} anchor="center">
                <div className="w-8 h-8 rounded-full bg-white border-2 border-[#C0FF00] shadow-lg flex items-center justify-center text-xs font-black text-black">
                  F
                </div>
              </Marker>

              {/* SUMMIT marker */}
              <Marker longitude={WP[22][0]} latitude={WP[22][1]} anchor="bottom">
                <div className="flex flex-col items-center">
                  <div className="bg-[#1a0a00] border border-orange-400/60 rounded-xl px-2.5 py-1.5 shadow-2xl">
                    <div className="text-[10px] font-black text-orange-400 flex items-center gap-1">
                      <Mountain className="w-3 h-3" />
                      Monte Cavo
                    </div>
                    <div className="text-[9px] text-white font-black">949m · km 5.4</div>
                  </div>
                  <div className="w-0.5 h-3 bg-orange-400/60" />
                  <div className="w-2 h-2 rounded-full bg-orange-400" />
                </div>
              </Marker>

              {/* Water source markers */}
              {WATER_SOURCES.map(w => (
                <Marker key={w.id} longitude={w.lng} latitude={w.lat} anchor="bottom">
                  <div
                    className={`flex flex-col items-center transition-transform ${hoveredWater === w.id ? 'scale-125' : ''}`}
                    onMouseEnter={() => setHoveredWater(w.id)}
                    onMouseLeave={() => setHoveredWater(null)}
                  >
                    <div className={`bg-[#00081a] border rounded-xl px-2 py-1 shadow-xl transition-all ${hoveredWater === w.id ? 'border-blue-400/80 bg-blue-950/80' : 'border-blue-500/40'}`}>
                      <div className="text-[9px] font-black text-blue-400 flex items-center gap-1">
                        <Droplets className="w-2.5 h-2.5" />
                        {hoveredWater === w.id ? w.name : `H₂O km ${w.km}`}
                      </div>
                    </div>
                    <div className="w-0.5 h-2 bg-blue-400/60" />
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                  </div>
                </Marker>
              ))}

              {/* Active chart position marker */}
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
            </Map>

            {/* Map overlay: top-left km/elev badge */}
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 pointer-events-none">
              <div className="text-[8px] text-gray-500 uppercase tracking-widest font-black mb-0.5">Dislivello</div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-orange-400">↑ {totalGain}m</span>
                <span className="text-[11px] font-black text-blue-400">↓ {totalLoss}m</span>
              </div>
            </div>
          </div>

          {/* ── Elevation Profile ─────────────────────────────────────────── */}
          <div className="h-[150px] flex-shrink-0 bg-[#060B14] border-t border-white/8 px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Profilo Altimetrico</span>
              {activeChart && (
                <span className="text-[8px] text-[#C0FF00] font-black">
                  km {activeChart.km.toFixed(1)} · {activeChart.elev}m slm
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={ELEV_PROFILE}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                onMouseMove={(e: any) => {
                  if (e.activePayload?.[0]) {
                    setActiveChart(e.activePayload[0].payload);
                  }
                }}
                onMouseLeave={() => setActiveChart(null)}
              >
                <defs>
                  <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#1E293B" />
                <XAxis
                  dataKey="km"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#334155', fontSize: 8 }}
                  tickFormatter={(v: number) => `${v.toFixed(0)}km`}
                  interval={Math.floor(ELEV_PROFILE.length / 8)}
                />
                <YAxis
                  domain={[minElev - 30, maxElev + 30]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#334155', fontSize: 8 }}
                  tickFormatter={(v: number) => `${v}m`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-[#0F172A] border border-white/10 rounded-lg px-2 py-1.5 text-xs shadow-xl">
                        <div className="text-[#C0FF00] font-black">km {d.km.toFixed(2)}</div>
                        <div className="text-white font-black">{d.elev}m slm</div>
                      </div>
                    );
                  }}
                />
                {/* Summit reference */}
                <ReferenceLine x={5.4} stroke="#f97316" strokeDasharray="3 3" strokeWidth={1.5}
                  label={{ value: '★ 949m', fill: '#f97316', fontSize: 8, position: 'top' }} />
                {/* Water sources */}
                {WATER_SOURCES.map(w => (
                  <ReferenceLine key={w.id} x={w.km} stroke="#60a5fa" strokeDasharray="2 3" strokeWidth={1.2}
                    label={{ value: '💧', fill: '#60a5fa', fontSize: 9, position: 'top' }} />
                ))}
                <Area
                  type="monotone"
                  dataKey="elev"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#elevGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#C0FF00', stroke: '#fff', strokeWidth: 1.5 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
