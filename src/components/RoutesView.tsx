import React, { useState, useMemo, useRef, useEffect } from 'react';
import Map, { Source, Layer, NavigationControl, Marker, Popup, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Activity, Mountain, Timer, Zap, Heart, Wind, AlertTriangle,
  Play, Pause, RotateCcw, Layers, ChevronRight, ChevronLeft,
  Info, Target, Gauge, TrendingUp, Map as MapIcon, Search, Calendar,
  Navigation, Globe,
} from 'lucide-react';
import { LiveTelemetry3DMap } from './LiveTelemetry3DMap';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ComposedChart, Line
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useApi } from '../hooks/useApi';
import { getRun, getRunSplits } from '../api';
import type { Run, Split } from '../types/api';

// ── Polyline decoder (Google algorithm) ──────────────────────────────────────
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push([lng / 1e5, lat / 1e5]); // [lng, lat] for maplibre
  }
  return points;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).toUpperCase();
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.round((minutes % 1) * 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function paceToSeconds(pace: string): number {
  const parts = pace.split(':');
  return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
}

// ── Components ───────────────────────────────────────────────────────────────

const GlassPanel = ({ children, className, title, icon: Icon }: any) => (
  <div className={cn(
    "bg-[#0F172A]/80 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl",
    className
  )}>
    {title && (
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-4 h-4 text-[#C0FF00]" />}
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{title}</h3>
        </div>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#C0FF00]/50" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#C0FF00]/20" />
        </div>
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

// ── Main View ────────────────────────────────────────────────────────────────

export function RoutesView({ runId }: { runId?: string | null }) {
  const mapRef = useRef<MapRef>(null);
  const [activeSplit, setActiveSplit] = useState<number | null>(null);
  const [mapMode, setMapMode] = useState<'pace' | 'hr' | 'elevation'>('pace');
  const [mapView, setMapView] = useState<'standard' | '3d-telemetry'>('standard');
  const [drawProgress, setDrawProgress] = useState(0);
  const [chartMetrics, setChartMetrics] = useState<Set<string>>(new Set(['pace']));
  const [hoveredStreamIdx, setHoveredStreamIdx] = useState<number | null>(null);

  const toggleChartMetric = (metric: string) => {
    setChartMetrics(prev => {
      const next = new Set(prev);
      if (next.has(metric)) {
        if (next.size > 1) next.delete(metric);
      } else {
        next.add(metric);
      }
      return next;
    });
  };

  // Fetch real run data
  const { data: run, loading, error } = useApi<Run>(() => getRun(runId ?? ''));

  // Per-point streams data
  const streams: any[] = (run as any)?.streams ?? [];

  // Decode polyline
  const routeCoords = useMemo(() => {
    if (!run) return [];
    const poly = (run as any).polyline;
    if (poly) return decodePolyline(poly);
    return [];
  }, [run]);

  const splits: Split[] = run?.splits ?? [];

  // Chart data from streams (detailed) or fallback to splits
  const chartData = useMemo(() => {
    if (streams.length > 0) {
      return streams.map((pt: any, i: number) => ({
        idx: i,
        dist: pt.d ? (pt.d / 1000).toFixed(1) : '',
        pace: pt.pace ?? null,
        hr: pt.hr ?? null,
        cadence: pt.cad ?? null,
        alt: pt.alt ?? null,
        ll: pt.ll ?? null,
      }));
    }
    // Fallback to splits
    return splits.map((s) => ({
      idx: s.km,
      dist: `${s.km}`,
      pace: paceToSeconds(s.pace),
      hr: s.hr != null ? Math.round(s.hr) : null,
      cadence: s.cadence ?? null,
      alt: s.elevation_difference ?? null,
      ll: null,
    }));
  }, [streams, splits]);

  // Hovered point for map marker
  const hoveredPoint = useMemo(() => {
    if (hoveredStreamIdx == null || !chartData[hoveredStreamIdx]) return null;
    const pt = chartData[hoveredStreamIdx];
    if (pt.ll) return { lat: pt.ll[0], lng: pt.ll[1] };
    // Fallback: interpolate from route coords
    if (routeCoords.length > 0) {
      const ratio = hoveredStreamIdx / Math.max(chartData.length - 1, 1);
      const coordIdx = Math.min(Math.floor(ratio * routeCoords.length), routeCoords.length - 1);
      const c = routeCoords[coordIdx];
      return { lat: c[1], lng: c[0] };
    }
    return null;
  }, [hoveredStreamIdx, chartData, routeCoords]);

  // Calculate map center from route
  const center = useMemo(() => {
    if (routeCoords.length === 0) {
      const sl = (run as any)?.start_latlng;
      if (sl && sl.length === 2) return { lng: sl[1], lat: sl[0] };
      return { lng: 9.19, lat: 45.46 };
    }
    const mid = routeCoords[Math.floor(routeCoords.length / 2)];
    return { lng: mid[0], lat: mid[1] };
  }, [routeCoords, run]);

  // Calculate bounds
  const bounds = useMemo(() => {
    if (routeCoords.length < 2) return null;
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lng, lat] of routeCoords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    return { minLng, maxLng, minLat, maxLat };
  }, [routeCoords]);

  // Animate route drawing
  useEffect(() => {
    const duration = 2000;
    const start = performance.now();
    const animate = (time: number) => {
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      setDrawProgress(progress);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [runId, routeCoords]);

  // Fit map to route bounds
  useEffect(() => {
    if (bounds && mapRef.current && routeCoords.length > 0) {
      const pad = 0.002;
      mapRef.current.fitBounds(
        [[bounds.minLng - pad, bounds.minLat - pad], [bounds.maxLng + pad, bounds.maxLat + pad]],
        { padding: { top: 80, bottom: 120, left: 380, right: 280 }, pitch: 45, duration: 1500 }
      );
    }
  }, [bounds, routeCoords]);

  // Build GeoJSON for the route
  const visibleCoords = routeCoords.slice(0, Math.floor(routeCoords.length * drawProgress));

  const segmentedLines: any = useMemo(() => {
    if (visibleCoords.length < 2) return { type: 'FeatureCollection', features: [] };

    // Distribute splits across route points
    const totalSplits = splits.length || 1;

    return {
      type: 'FeatureCollection',
      features: visibleCoords.slice(0, -1).map((coord, i) => {
        const next = visibleCoords[i + 1];
        const splitIdx = Math.min(Math.floor((i / visibleCoords.length) * totalSplits), totalSplits - 1);
        const split = splits[splitIdx];

        let color = '#3B82F6';
        if (split) {
          const paceSec = paceToSeconds(split.pace);
          if (mapMode === 'pace') {
            color = paceSec < 270 ? '#10B981' : paceSec < 330 ? '#3B82F6' : '#F59E0B';
          } else if (mapMode === 'hr') {
            const hr = split.hr ?? 150;
            color = hr > 170 ? '#EF4444' : hr > 155 ? '#F59E0B' : '#10B981';
          } else if (mapMode === 'elevation') {
            const elDiff = split.elevation_difference ?? 0;
            color = elDiff > 0 ? '#EF4444' : '#10B981';
          }
        }

        return {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [coord, next] },
          properties: { color, width: 4, id: i },
        };
      }),
    };
  }, [visibleCoords, splits, mapMode]);

  // Run title from notes
  const runTitle = run?.notes
    ? run.notes.replace('Importata da Strava: ', '').replace(/(\s*\[Strava:[^\]]*\])+/g, '').trim() || `Run ${run.distance_km?.toFixed(1)} km`
    : `Run ${run?.distance_km?.toFixed(1) ?? '—'} km`;

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center bg-[#020202]">
        <div className="text-gray-500 text-sm font-black uppercase tracking-widest animate-pulse">Loading run data...</div>
      </main>
    );
  }

  if (error || !run) {
    return (
      <main className="flex-1 flex items-center justify-center bg-[#020202]">
        <div className="text-rose-400 text-sm font-bold">Errore nel caricamento della corsa</div>
      </main>
    );
  }

  return (
    <main className="flex-1 relative h-full overflow-hidden bg-[#020202] font-sans">

      {/* ── MAP VIEW TOGGLE ────────────────────────────────────────────── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
        <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-1 flex shadow-2xl">
          <button
            onClick={() => setMapView('standard')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              mapView === 'standard'
                ? "bg-white/10 text-white shadow-lg"
                : "text-gray-500 hover:text-gray-300"
            )}
          >
            <Globe className="w-3.5 h-3.5" />
            Standard
          </button>
          <button
            onClick={() => setMapView('3d-telemetry')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              mapView === '3d-telemetry'
                ? "bg-[#C0FF00]/20 text-[#C0FF00] shadow-lg"
                : "text-gray-500 hover:text-gray-300"
            )}
          >
            <Navigation className="w-3.5 h-3.5" />
            3D Telemetry
          </button>
        </div>
      </div>

      {/* ── 3D TELEMETRY VIEW ──────────────────────────────────────────── */}
      {mapView === '3d-telemetry' && (
        <LiveTelemetry3DMap
          routeCoords={routeCoords}
          streams={streams}
          splits={splits}
          run={run}
        />
      )}

      {/* ── STANDARD VIEW ──────────────────────────────────────────────── */}
      {mapView === 'standard' && (
        <>
          {/* PRIMARY UI LAYER: THE MAP */}
          <div className="absolute inset-0 z-0">
            <Map
              ref={mapRef}
              initialViewState={{
                longitude: center.lng,
                latitude: center.lat,
                zoom: 14,
                pitch: 45,
              }}
              mapStyle="https://tiles.openfreemap.org/styles/dark"
              style={{ width: '100%', height: '100%' }}
            >
              {/* Route segments */}
              <Source id="route-segments" type="geojson" data={segmentedLines}>
                <Layer
                  id="route-lines"
                  type="line"
                  layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                  paint={{
                    'line-color': ['get', 'color'],
                    'line-width': ['get', 'width'],
                    'line-opacity': 0.9,
                  }}
                />
                <Layer
                  id="route-glow"
                  type="line"
                  layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                  paint={{
                    'line-color': ['get', 'color'],
                    'line-width': ['*', ['get', 'width'], 4],
                    'line-blur': 15,
                    'line-opacity': 0.3,
                  }}
                />
              </Source>

              {/* KM Markers */}
              {splits.length > 0 && routeCoords.length > 0 && splits.map((split) => {
                const ptIdx = Math.min(
                  Math.floor((split.km / (run.distance_km || 1)) * routeCoords.length),
                  routeCoords.length - 1
                );
                const pt = routeCoords[ptIdx];
                if (!pt) return null;
                return (
                  <Marker key={split.km} longitude={pt[0]} latitude={pt[1]}>
                    <div className={cn(
                      "flex flex-col items-center transition-all duration-500",
                      activeSplit === split.km ? "scale-125" : "scale-100 opacity-60"
                    )}>
                      <div className="bg-white/10 backdrop-blur-md border border-white/20 px-2 py-1 rounded-md text-[8px] font-black text-white mb-1 shadow-xl">
                        {split.km} KM
                      </div>
                      <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                    </div>
                  </Marker>
                );
              })}

              {/* Start Marker */}
              {routeCoords.length > 0 && (
                <Marker longitude={routeCoords[0][0]} latitude={routeCoords[0][1]}>
                  <div className="relative group">
                    <div className="absolute inset-0 animate-ping bg-emerald-500 rounded-full opacity-20" />
                    <div className="w-5 h-5 bg-emerald-500 rounded-full border-2 border-white shadow-2xl flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    </div>
                  </div>
                </Marker>
              )}

              {/* End Marker */}
              {routeCoords.length > 1 && (
                <Marker longitude={routeCoords[routeCoords.length - 1][0]} latitude={routeCoords[routeCoords.length - 1][1]}>
                  <div className="w-5 h-5 bg-rose-500 rounded-full border-2 border-white shadow-2xl flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  </div>
                </Marker>
              )}

              {/* Chart cursor marker on map */}
              {hoveredPoint && (
                <Marker longitude={hoveredPoint.lng} latitude={hoveredPoint.lat}>
                  <div className="relative">
                    <div className="absolute -inset-4 animate-pulse bg-[#C0FF00]/20 rounded-full" />
                    <div className="w-4 h-4 bg-[#C0FF00] rounded-full border-2 border-white shadow-[0_0_20px_rgba(192,255,0,0.6)]" />
                  </div>
                </Marker>
              )}

              {/* Active split highlight */}
              {activeSplit !== null && routeCoords.length > 0 && (
                <Source id="active-split" type="geojson" data={{
                  type: 'Feature',
                  geometry: {
                    type: 'LineString',
                    coordinates: routeCoords.slice(
                      Math.floor(((activeSplit - 1) / (run.distance_km || 1)) * routeCoords.length),
                      Math.floor((activeSplit / (run.distance_km || 1)) * routeCoords.length)
                    ),
                  },
                  properties: {},
                }}>
                  <Layer id="split-highlight" type="line" paint={{
                    'line-color': '#FFF', 'line-width': 12, 'line-blur': 5, 'line-opacity': 0.4,
                  }} />
                </Source>
              )}

              <NavigationControl position="top-right" />
            </Map>
          </div>

          {/* OVERLAY: LEFT PANEL (SESSION ANALYTICS) */}
          <div className="absolute top-8 left-8 bottom-8 w-[340px] pointer-events-none flex flex-col gap-4">
            <GlassPanel title="SESSION ANALYTICS" icon={Gauge} className="pointer-events-auto flex-1 flex flex-col">
              <div className="mb-6">
                <h2 className="text-2xl font-black italic tracking-tighter text-white mb-1 uppercase">{runTitle}</h2>
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  <Calendar className="w-3 h-3" />
                  <span>{run.date ? formatDate(run.date) : '—'}</span>
                  {run.location && <><span>•</span><span>{run.location}</span></>}
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Distance</div>
                  <div className="text-lg font-black italic text-white">{run.distance_km?.toFixed(2)}</div>
                  <div className="text-[8px] font-black text-gray-600">KM</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Time</div>
                  <div className="text-lg font-black italic text-white">{formatDuration(run.duration_minutes)}</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Avg Pace</div>
                  <div className="text-lg font-black italic text-emerald-400">{run.avg_pace}</div>
                  <div className="text-[8px] font-black text-gray-600">/KM</div>
                </div>
              </div>

              {/* Extra stats row */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Avg HR</div>
                  <div className="text-lg font-black italic text-rose-500">{run.avg_hr ?? '—'}</div>
                  <div className="text-[8px] font-black text-gray-600">BPM</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Max HR</div>
                  <div className="text-lg font-black italic text-rose-400">{run.max_hr ?? '—'}</div>
                  <div className="text-[8px] font-black text-gray-600">BPM</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Elevation</div>
                  <div className="text-lg font-black italic text-amber-400">{run.elevation_gain?.toFixed(0) ?? '—'}</div>
                  <div className="text-[8px] font-black text-gray-600">M</div>
                </div>
              </div>

              {/* Splits table */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="grid grid-cols-4 text-[8px] font-black uppercase tracking-[0.2em] text-gray-600 mb-4 px-2">
                  <span>KM</span>
                  <span>PACE</span>
                  <span>HR</span>
                  <span className="text-right">ELEV</span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-1">
                  {splits.map((split) => (
                    <button
                      key={split.km}
                      onMouseEnter={() => setActiveSplit(split.km)}
                      onMouseLeave={() => setActiveSplit(null)}
                      className={cn(
                        "w-full grid grid-cols-4 items-center p-3 rounded-xl border transition-all group relative overflow-hidden",
                        activeSplit === split.km
                          ? "bg-[#C0FF00]/10 border-[#C0FF00]/30"
                          : "bg-white/5 border-transparent hover:border-white/10"
                      )}
                    >
                      <span className="text-[10px] font-black text-gray-500">{String(split.km).padStart(2, '0')}</span>
                      <span className="text-xs font-black italic text-white">{split.pace}</span>
                      <span className="text-xs font-black italic text-rose-400">{split.hr != null ? Math.round(split.hr) : '—'}</span>
                      <span className="text-xs font-black italic text-amber-400 text-right">
                        {split.elevation_difference != null ? `${split.elevation_difference > 0 ? '+' : ''}${Math.round(split.elevation_difference)}m` : '—'}
                      </span>
                    </button>
                  ))}
                  {splits.length === 0 && (
                    <div className="text-center text-gray-600 text-xs font-bold py-8">No split data</div>
                  )}
                </div>
              </div>
            </GlassPanel>
          </div>

          {/* OVERLAY: RIGHT PANEL */}
          <div className="absolute top-8 right-8 w-[240px] pointer-events-none flex flex-col gap-4">
            {/* Map mode selector */}
            <GlassPanel title="ROUTE COLOR" icon={Layers} className="pointer-events-auto">
              <div className="space-y-3">
                {([['pace', 'PACE', '#3B82F6'], ['hr', 'HEART RATE', '#EF4444'], ['elevation', 'ELEVATION', '#F59E0B']] as const).map(([mode, label, clr]) => (
                  <button
                    key={mode}
                    onClick={() => setMapMode(mode as any)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest",
                      mapMode === mode ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                    )}
                  >
                    <span>{label}</span>
                    <div className={cn("w-3 h-3 rounded-full", mapMode === mode ? "opacity-100" : "opacity-30")} style={{ backgroundColor: clr }} />
                  </button>
                ))}
              </div>
            </GlassPanel>

            {/* Run info card */}
            <div className="bg-[#0F172A]/90 backdrop-blur-2xl border border-white/10 p-5 rounded-3xl flex flex-col gap-3 shadow-2xl pointer-events-auto">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Run Info</span>
                <Activity className="w-3 h-3 text-[#C0FF00]" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[8px] font-bold text-gray-500 uppercase">Type</span>
                  <span className="text-[10px] font-black text-[#C0FF00] uppercase">{run.run_type}</span>
                </div>
                {run.avg_cadence && (
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-bold text-gray-500 uppercase">Cadence</span>
                    <span className="text-[10px] font-black text-amber-400">{Math.round(run.avg_cadence * 2)} spm</span>
                  </div>
                )}
                {run.avg_hr_pct && (
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-bold text-gray-500 uppercase">Avg HR %</span>
                    <span className="text-[10px] font-black text-rose-400">{run.avg_hr_pct}%</span>
                  </div>
                )}
              </div>

              {/* ── Garmin Running Dynamics ─────────────────────────────── */}
              {(run.avg_vertical_oscillation || run.avg_vertical_ratio || run.avg_ground_contact_time || run.avg_stride_length) && (
                <>
                  <div className="flex justify-between items-center border-b border-white/5 pb-2 mt-3">
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Running Dynamics</span>
                    <Zap className="w-3 h-3 text-[#3B82F6]" />
                  </div>
                  <div className="space-y-2">
                    {run.avg_vertical_oscillation != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-[8px] font-bold text-gray-500 uppercase">Osc. Verticale</span>
                        <span className="text-[10px] font-black text-[#3B82F6]">{run.avg_vertical_oscillation} cm</span>
                      </div>
                    )}
                    {run.avg_vertical_ratio != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-[8px] font-bold text-gray-500 uppercase">Rapporto Vert.</span>
                        <span className="text-[10px] font-black text-[#3B82F6]">{run.avg_vertical_ratio}%</span>
                      </div>
                    )}
                    {run.avg_ground_contact_time != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-[8px] font-bold text-gray-500 uppercase">GCT</span>
                        <span className="text-[10px] font-black text-[#3B82F6]">{run.avg_ground_contact_time} ms</span>
                      </div>
                    )}
                    {run.avg_stride_length != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-[8px] font-bold text-gray-500 uppercase">Lunghezza Falcata</span>
                        <span className="text-[10px] font-black text-[#3B82F6]">{run.avg_stride_length} m</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* OVERLAY: BOTTOM — Detailed chart with cursor sync to map */}
          {chartData.length > 0 && (
            <div className="absolute bottom-6 left-[380px] right-8 pointer-events-none">
              <div className="bg-[#0A0F1A]/90 backdrop-blur-2xl border border-white/[0.06] rounded-2xl shadow-2xl pointer-events-auto">
                {/* Chart header */}
                <div className="px-6 pt-5 pb-3 flex items-center justify-between">
                  {/* Metric selector pills */}
                  <div className="flex items-center gap-2">
                    {([
                      { key: 'pace', label: 'Pace', color: '#C0FF00', value: run.avg_pace + '/km' },
                      { key: 'hr', label: 'Heart Rate', color: '#F43F5E', value: run.avg_hr ? `${Math.round(run.avg_hr)} bpm` : '—' },
                      { key: 'cadence', label: 'Cadence', color: '#8B5CF6', value: run.avg_cadence ? `${Math.round(run.avg_cadence * 2)} spm` : '—' },
                    ] as const).map(({ key, label, color, value }) => (
                      <button
                        key={key}
                        onClick={() => toggleChartMetric(key)}
                        className={cn(
                          "flex items-center gap-2.5 px-4 py-2 rounded-xl border transition-all duration-200",
                          chartMetrics.has(key)
                            ? "border-white/10 bg-white/[0.06]"
                            : "border-transparent bg-transparent opacity-40 hover:opacity-70"
                        )}
                      >
                        <div
                          className={cn("w-2.5 h-2.5 rounded-full transition-all", chartMetrics.has(key) ? "scale-100" : "scale-75")}
                          style={{ backgroundColor: color, boxShadow: chartMetrics.has(key) ? `0 0 8px ${color}50` : 'none' }}
                        />
                        <div className="flex flex-col items-start">
                          <span className="text-[8px] font-black uppercase tracking-[0.15em] text-gray-500">{label}</span>
                          <span className="text-xs font-black italic" style={{ color: chartMetrics.has(key) ? color : '#6B7280' }}>{value}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Hovered point values or elevation badge */}
                  {hoveredStreamIdx != null && chartData[hoveredStreamIdx] ? (
                    <div className="flex gap-5 items-center">
                      {chartMetrics.has('pace') && chartData[hoveredStreamIdx].pace && (
                        <div className="text-right">
                          <div className="text-[7px] font-black text-gray-600 uppercase tracking-widest">Pace</div>
                          <div className="text-sm font-black italic text-[#C0FF00]">
                            {Math.floor(chartData[hoveredStreamIdx].pace / 60)}:{String(Math.round(chartData[hoveredStreamIdx].pace % 60)).padStart(2, '0')}/km
                          </div>
                        </div>
                      )}
                      {chartMetrics.has('hr') && chartData[hoveredStreamIdx].hr && (
                        <div className="text-right">
                          <div className="text-[7px] font-black text-gray-600 uppercase tracking-widest">HR</div>
                          <div className="text-sm font-black italic text-[#F43F5E]">{Math.round(chartData[hoveredStreamIdx].hr)} bpm</div>
                        </div>
                      )}
                      {chartMetrics.has('cadence') && chartData[hoveredStreamIdx].cadence && (
                        <div className="text-right">
                          <div className="text-[7px] font-black text-gray-600 uppercase tracking-widest">Cadence</div>
                          <div className="text-sm font-black italic text-[#8B5CF6]">{Math.round(chartData[hoveredStreamIdx].cadence)} spm</div>
                        </div>
                      )}
                      <div className="text-right">
                        <div className="text-[7px] font-black text-gray-600 uppercase tracking-widest">Dist</div>
                        <div className="text-sm font-black italic text-white">{chartData[hoveredStreamIdx].dist} km</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] rounded-lg">
                      <Mountain className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-black italic text-amber-400">{run.elevation_gain?.toFixed(0) ?? '—'}m</span>
                    </div>
                  )}
                </div>

                {/* Chart */}
                <div className="h-36 px-4 pb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={chartData}
                      margin={{ top: 8, right: 12, bottom: 0, left: 12 }}
                      onMouseMove={(e: any) => {
                        if (e && e.activeTooltipIndex != null) setHoveredStreamIdx(e.activeTooltipIndex);
                      }}
                      onMouseLeave={() => setHoveredStreamIdx(null)}
                    >
                      <defs>
                        <linearGradient id="paceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#C0FF00" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#C0FF00" stopOpacity={0.01} />
                        </linearGradient>
                        <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.12} />
                          <stop offset="100%" stopColor="#F43F5E" stopOpacity={0.01} />
                        </linearGradient>
                        <linearGradient id="cadenceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.12} />
                          <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="none" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis
                        dataKey="dist"
                        tick={{ fontSize: 9, fill: '#374151', fontWeight: 800 }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                        tickLine={false}
                        interval={streams.length > 0 ? Math.floor(chartData.length / 12) : 0}
                        tickFormatter={(v) => v ? `${v}` : ''}
                      />
                      <YAxis yAxisId="pace" orientation="left" hide reversed />
                      <YAxis yAxisId="hr" orientation="right" hide />
                      <YAxis yAxisId="cadence" hide />
                      <Tooltip content={() => null} cursor={{ stroke: 'rgba(192,255,0,0.25)', strokeWidth: 1 }} />

                      {chartMetrics.has('pace') && (
                        <Area yAxisId="pace" type="monotone" dataKey="pace" stroke="#C0FF00" strokeWidth={1.5} fill="url(#paceGrad)" dot={false} isAnimationActive={false} />
                      )}
                      {chartMetrics.has('hr') && (
                        <Area yAxisId="hr" type="monotone" dataKey="hr" stroke="#F43F5E" strokeWidth={1.5} fill="url(#hrGrad)" dot={false} isAnimationActive={false} connectNulls />
                      )}
                      {chartMetrics.has('cadence') && (
                        <Area yAxisId="cadence" type="monotone" dataKey="cadence" stroke="#8B5CF6" strokeWidth={1.5} fill="url(#cadenceGrad)" dot={false} isAnimationActive={false} connectNulls />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
