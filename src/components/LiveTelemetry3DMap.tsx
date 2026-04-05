import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Map, { Source, Layer, Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { MapRef } from 'react-map-gl/mapbox';
import * as turf from '@turf/turf';
import {
  Play, Pause, RotateCcw, Heart, Mountain,
  Timer, Activity, Navigation, Video, MapPin,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { Run, Split } from '../types/api';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

// ── Types ───────────────────────────────────────────────────────────────────

interface RunPoint {
  id: number;
  coordinates: [number, number];
  distance: number;
  elevation: number;
  heartRate: number;
  pace: number;
  cadence: number;
}

interface LiveTelemetry3DMapProps {
  routeCoords: [number, number][];
  streams: any[];
  splits: Split[];
  run: Run;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatPace(seconds: number): string {
  if (!seconds || seconds <= 0 || seconds > 1200) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function paceToSeconds(pace: string): number {
  const parts = pace.split(':');
  return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
}

// ── Component ───────────────────────────────────────────────────────────────

export function LiveTelemetry3DMap({ routeCoords, streams, splits, run }: LiveTelemetry3DMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [runData, setRunData] = useState<RunPoint[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentBearing, setCurrentBearing] = useState(0);
  const [cameraFollow, setCameraFollow] = useState(true);
  const lastTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const bearingRef = useRef<number>(0);

  // ── Generate equidistant run data ─────────────────────────────────────────

  useEffect(() => {
    if (routeCoords.length < 2) return;

    try {
      const line = turf.lineString(routeCoords);
      const totalLength = turf.length(line, { units: 'kilometers' });
      if (totalLength <= 0) return;

      const numPoints = Math.min(1000, Math.max(routeCoords.length * 2, 300));
      const points: RunPoint[] = [];

      for (let i = 0; i < numPoints; i++) {
        const dist = (i / (numPoints - 1)) * totalLength;
        const pt = turf.along(line, dist, { units: 'kilometers' });
        const coords = pt.geometry.coordinates as [number, number];

        let elevation = 0;
        let heartRate = 0;
        let pace = 0;
        let cadence = 0;

        if (streams.length > 0) {
          const streamIdx = Math.min(
            Math.round((i / (numPoints - 1)) * (streams.length - 1)),
            streams.length - 1
          );
          const s = streams[streamIdx];
          elevation = s.alt ?? 0;
          heartRate = s.hr ?? 0;
          pace = s.pace ?? 0;
          cadence = s.cad ? s.cad * 2 : 0;
        } else if (splits.length > 0) {
          const splitIdx = Math.min(Math.floor(dist), splits.length - 1);
          const split = splits[splitIdx];
          elevation = split.elevation_difference ?? 0;
          heartRate = split.hr ?? 0;
          pace = paceToSeconds(split.pace);
          cadence = split.cadence ? split.cadence * 2 : 0;
        }

        points.push({ id: i, coordinates: coords, distance: dist, elevation, heartRate, pace, cadence });
      }

      setRunData(points);
      setPlaybackIndex(0);
    } catch {
      // If turf fails, fallback to raw coords
      const points: RunPoint[] = routeCoords.map((c, i) => ({
        id: i,
        coordinates: c,
        distance: (i / Math.max(routeCoords.length - 1, 1)) * (run.distance_km ?? 1),
        elevation: 0,
        heartRate: run.avg_hr ?? 0,
        pace: paceToSeconds(run.avg_pace ?? '6:00'),
        cadence: run.avg_cadence ? run.avg_cadence * 2 : 0,
      }));
      setRunData(points);
    }
  }, [routeCoords, streams, splits, run]);

  // ── Animation loop (requestAnimationFrame) ────────────────────────────────

  useEffect(() => {
    if (!isPlaying || runData.length === 0) {
      lastTimeRef.current = 0;
      return;
    }

    const animate = (time: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = time;
      const deltaTime = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      const advancement = deltaTime * 3 * playbackSpeed;
      setPlaybackIndex(prev => Math.min(prev + advancement, runData.length - 1));
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, runData.length, playbackSpeed]);

  // ── End-of-route detection ────────────────────────────────────────────────

  useEffect(() => {
    if (runData.length > 0 && playbackIndex >= runData.length - 1) {
      setIsPlaying(false);
    }
  }, [playbackIndex, runData.length]);

  // ── Smooth interpolated playback point ────────────────────────────────────

  const playbackPoint = useMemo(() => {
    if (runData.length === 0) return null;
    const i = Math.floor(playbackIndex);
    const frac = playbackIndex - i;
    const p1 = runData[i];
    const p2 = runData[Math.min(i + 1, runData.length - 1)];
    if (!p1 || !p2) return null;

    return {
      coordinates: [
        p1.coordinates[0] + (p2.coordinates[0] - p1.coordinates[0]) * frac,
        p1.coordinates[1] + (p2.coordinates[1] - p1.coordinates[1]) * frac,
      ] as [number, number],
      distance: p1.distance + (p2.distance - p1.distance) * frac,
      elevation: p1.elevation + (p2.elevation - p1.elevation) * frac,
      heartRate: p1.heartRate + (p2.heartRate - p1.heartRate) * frac,
      pace: p1.pace + (p2.pace - p1.pace) * frac,
      cadence: p1.cadence + (p2.cadence - p1.cadence) * frac,
    };
  }, [playbackIndex, runData]);

  // ── 3D Chase Camera (separate effect) ─────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current || !playbackPoint || !cameraFollow || runData.length === 0) return;

    const idx = Math.floor(playbackIndex);
    const lookAhead = Math.min(idx + 15, runData.length - 1);
    if (idx === lookAhead) return;

    const from = turf.point(playbackPoint.coordinates);
    const to = turf.point(runData[lookAhead].coordinates);
    const targetBearing = turf.bearing(from, to);

    let delta = targetBearing - bearingRef.current;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    const newBearing = bearingRef.current + delta * 0.08;
    bearingRef.current = newBearing;

    setCurrentBearing(newBearing);

    mapRef.current.jumpTo({
      center: playbackPoint.coordinates,
      bearing: newBearing,
      pitch: 70,
      zoom: 17.5,
    });
  }, [playbackPoint, cameraFollow, runData, playbackIndex]);

  // ── GeoJSON layers ────────────────────────────────────────────────────────

  const fullRouteGeoJSON = useMemo(() => {
    if (routeCoords.length < 2) return null;
    return {
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: routeCoords },
      properties: {},
    };
  }, [routeCoords]);

  const completedRouteGeoJSON = useMemo(() => {
    if (runData.length === 0 || !playbackPoint) return null;
    const idx = Math.floor(playbackIndex);
    const coords = runData.slice(0, idx + 1).map(p => p.coordinates);
    coords.push(playbackPoint.coordinates);
    return {
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: coords },
      properties: {},
    };
  }, [playbackIndex, runData, playbackPoint]);

  const ghostPoint = useMemo(() => {
    if (runData.length === 0 || !isPlaying) return null;
    const ghostIdx = Math.min(playbackIndex * 1.02 + 15, runData.length - 1);
    const i = Math.floor(ghostIdx);
    const frac = ghostIdx - i;
    const p1 = runData[i];
    const p2 = runData[Math.min(i + 1, runData.length - 1)];
    if (!p1 || !p2) return null;
    return [
      p1.coordinates[0] + (p2.coordinates[0] - p1.coordinates[0]) * frac,
      p1.coordinates[1] + (p2.coordinates[1] - p1.coordinates[1]) * frac,
    ] as [number, number];
  }, [playbackIndex, runData, isPlaying]);

  // ── Controls ──────────────────────────────────────────────────────────────

  const resetPlayback = useCallback(() => {
    setIsPlaying(false);
    setPlaybackIndex(0);
    bearingRef.current = 0;
    setCurrentBearing(0);
    lastTimeRef.current = 0;
  }, []);

  const togglePlay = useCallback(() => {
    if (playbackIndex >= runData.length - 1) {
      resetPlayback();
      setTimeout(() => setIsPlaying(true), 50);
    } else {
      setIsPlaying(prev => !prev);
    }
  }, [playbackIndex, runData.length, resetPlayback]);

  const progress = runData.length > 0 ? (playbackIndex / (runData.length - 1)) * 100 : 0;

  const initialView = useMemo(() => {
    if (routeCoords.length === 0) return { longitude: 12.5, latitude: 41.9, zoom: 14 };
    const mid = routeCoords[Math.floor(routeCoords.length / 2)];
    return { longitude: mid[0], latitude: mid[1], zoom: 14 };
  }, [routeCoords]);

  const runTitle = run?.notes
    ? run.notes.replace('Importata da Strava: ', '').replace(/(\s*\[Strava:[^\]]*\])+/g, '').trim() || `Run ${run.distance_km?.toFixed(1)} km`
    : `Run ${run?.distance_km?.toFixed(1) ?? '—'} km`;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="absolute inset-0 flex">
      {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
      <div className="w-[380px] shrink-0 bg-[#070B14] border-r border-white/5 flex flex-col h-full overflow-hidden z-10">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <Navigation className="w-4 h-4 text-[#C0FF00]" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C0FF00]">Live Telemetry 3D</span>
          </div>
          <h2 className="text-xl font-black italic tracking-tight text-white uppercase">{runTitle}</h2>
        </div>

        {/* Live Metrics */}
        <div className="px-6 py-5 border-b border-white/5">
          <div className="grid grid-cols-2 gap-3">
            {/* Distance */}
            <div className="bg-white/5 rounded-2xl p-4 relative overflow-hidden">
              <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Distance</div>
              <div className="text-2xl font-black italic text-white tabular-nums">{playbackPoint?.distance.toFixed(2) ?? '0.00'}</div>
              <div className="text-[9px] font-black text-gray-600">KM</div>
              <Activity className="absolute top-3 right-3 w-4 h-4 text-white/10" />
            </div>
            {/* Pace */}
            <div className="bg-white/5 rounded-2xl p-4 relative overflow-hidden">
              <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Pace</div>
              <div className="text-2xl font-black italic text-[#C0FF00] tabular-nums">
                {playbackPoint ? formatPace(playbackPoint.pace) : '--:--'}
              </div>
              <div className="text-[9px] font-black text-gray-600">/KM</div>
              <Timer className="absolute top-3 right-3 w-4 h-4 text-[#C0FF00]/10" />
            </div>
            {/* Heart Rate */}
            <div className="bg-white/5 rounded-2xl p-4 relative overflow-hidden">
              <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Heart Rate</div>
              <div className="text-2xl font-black italic text-rose-500 tabular-nums">
                {playbackPoint && playbackPoint.heartRate > 0 ? Math.round(playbackPoint.heartRate) : '--'}
              </div>
              <div className="text-[9px] font-black text-gray-600">BPM</div>
              <Heart className="absolute top-3 right-3 w-4 h-4 text-rose-500/10" />
            </div>
            {/* Elevation */}
            <div className="bg-white/5 rounded-2xl p-4 relative overflow-hidden">
              <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Elevation</div>
              <div className="text-2xl font-black italic text-amber-400 tabular-nums">
                {playbackPoint ? Math.round(playbackPoint.elevation) : '0'}
              </div>
              <div className="text-[9px] font-black text-gray-600">M</div>
              <Mountain className="absolute top-3 right-3 w-4 h-4 text-amber-400/10" />
            </div>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="px-6 py-4 border-b border-white/5">
          {/* Progress bar */}
          <div
            className="relative h-2 bg-white/10 rounded-full mb-4 cursor-pointer group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = (e.clientX - rect.left) / rect.width;
              setPlaybackIndex(Math.max(0, Math.min(x * (runData.length - 1), runData.length - 1)));
            }}
          >
            <div
              className="absolute h-full bg-gradient-to-r from-[#C0FF00]/60 to-[#C0FF00] rounded-full"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-[#C0FF00] rounded-full shadow-[0_0_12px_rgba(192,255,0,0.5)] group-hover:scale-125 transition-transform"
              style={{ left: `calc(${progress}% - 7px)` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={resetPlayback} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                <RotateCcw className="w-4 h-4 text-gray-400" />
              </button>
              <button onClick={togglePlay} className="p-3 rounded-xl bg-[#C0FF00] hover:bg-[#D4FF33] transition-all shadow-[0_0_20px_rgba(192,255,0,0.3)]">
                {isPlaying ? <Pause className="w-5 h-5 text-black" /> : <Play className="w-5 h-5 text-black ml-0.5" />}
              </button>
            </div>

            {/* Speed selector */}
            <div className="flex bg-white/5 rounded-xl overflow-hidden">
              {[0.5, 1, 2, 4].map(speed => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={cn(
                    "px-3 py-2 text-[10px] font-black transition-all",
                    playbackSpeed === speed
                      ? "bg-[#C0FF00] text-black"
                      : "text-gray-500 hover:text-white"
                  )}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* Camera toggle */}
          <button
            onClick={() => setCameraFollow(prev => !prev)}
            className={cn(
              "mt-3 w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-2",
              cameraFollow
                ? "bg-[#C0FF00]/10 border-[#C0FF00]/30 text-[#C0FF00]"
                : "bg-white/5 border-white/10 text-gray-500"
            )}
          >
            {cameraFollow ? <><Video className="w-3.5 h-3.5" /> Chase Camera ON</> : <><MapPin className="w-3.5 h-3.5" /> Free Camera</>}
          </button>
        </div>

        {/* Km Splits */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 min-h-0">
          <div className="grid grid-cols-4 text-[8px] font-black uppercase tracking-[0.2em] text-gray-600 mb-3 px-2">
            <span>KM</span><span>PACE</span><span>HR</span><span className="text-right">ELEV</span>
          </div>
          <div className="space-y-1.5">
            {splits.map((split) => {
              const currentKm = playbackPoint ? Math.floor(playbackPoint.distance) + 1 : 0;
              const isActive = split.km === currentKm;
              const isPassed = split.km < currentKm;
              return (
                <div
                  key={split.km}
                  className={cn(
                    "grid grid-cols-4 items-center p-3 rounded-xl border transition-all",
                    isActive ? "bg-[#C0FF00]/10 border-[#C0FF00]/30 shadow-[0_0_15px_rgba(192,255,0,0.1)]"
                      : isPassed ? "bg-white/[0.03] border-transparent opacity-60"
                      : "bg-white/5 border-transparent"
                  )}
                >
                  <span className="text-[10px] font-black text-gray-500">{String(split.km).padStart(2, '0')}</span>
                  <span className="text-xs font-black italic text-white">{split.pace}</span>
                  <span className="text-xs font-black italic text-rose-400">{split.hr != null ? Math.round(split.hr) : '--'}</span>
                  <span className="text-xs font-black italic text-amber-400 text-right">
                    {split.elevation_difference != null
                      ? `${split.elevation_difference > 0 ? '+' : ''}${Math.round(split.elevation_difference)}m`
                      : '--'}
                  </span>
                </div>
              );
            })}
            {splits.length === 0 && (
              <div className="text-center text-gray-600 text-xs font-bold py-8">No split data</div>
            )}
          </div>
        </div>
      </div>

      {/* ── MAP ────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <Map
          ref={mapRef}
          initialViewState={{ ...initialView, pitch: 60, bearing: 0 }}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          style={{ width: '100%', height: '100%' }}
          onLoad={(e) => {
            const map = e.target;
            if (!map.getSource('mapbox-dem')) {
              map.addSource('mapbox-dem', {
                type: 'raster-dem',
                url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
                tileSize: 512,
                maxzoom: 14,
              });
            }
            map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
            map.setFog({
              range: [0.5, 10],
              color: '#0a0a1a',
              'high-color': '#0a0a1a',
              'horizon-blend': 0.1,
            });

            // Fit bounds initially
            if (routeCoords.length > 2) {
              let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
              for (const [lng, lat] of routeCoords) {
                if (lng < minLng) minLng = lng;
                if (lng > maxLng) maxLng = lng;
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
              }
              map.fitBounds(
                [[minLng - 0.002, minLat - 0.002], [maxLng + 0.002, maxLat + 0.002]],
                { padding: 80, pitch: 60, duration: 1500 }
              );
            }
          }}
        >
          {/* 3D Buildings */}
          <Layer
            id="3d-buildings"
            source="composite"
            source-layer="building"
            type="fill-extrusion"
            minzoom={15}
            filter={['==', 'extrude', 'true']}
            paint={{
              'fill-extrusion-color': '#1a1a2e',
              'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'height']],
              'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'min_height']],
              'fill-extrusion-opacity': 0.7,
            }}
          />

          {/* Full route (ghost path) */}
          {fullRouteGeoJSON && (
            <Source id="full-route" type="geojson" data={fullRouteGeoJSON}>
              <Layer
                id="full-route-line"
                type="line"
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                paint={{ 'line-color': '#ffffff', 'line-width': 2, 'line-opacity': 0.12, 'line-dasharray': [2, 4] }}
              />
            </Source>
          )}

          {/* Completed route with gradient */}
          {completedRouteGeoJSON && completedRouteGeoJSON.geometry.coordinates.length > 1 && (
            <Source id="completed-route" type="geojson" data={completedRouteGeoJSON} lineMetrics>
              <Layer
                id="completed-route-glow"
                type="line"
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                paint={{ 'line-color': '#C0FF00', 'line-width': 14, 'line-blur': 18, 'line-opacity': 0.25 }}
              />
              <Layer
                id="completed-route-line"
                type="line"
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                paint={{
                  'line-width': 4,
                  'line-opacity': 1,
                  'line-gradient': [
                    'interpolate', ['linear'], ['line-progress'],
                    0, 'rgba(192,255,0,0)',
                    0.4, 'rgba(192,255,0,0.4)',
                    1, 'rgba(192,255,0,1)',
                  ],
                }}
              />
            </Source>
          )}

          {/* Runner marker */}
          {playbackPoint && (
            <Marker longitude={playbackPoint.coordinates[0]} latitude={playbackPoint.coordinates[1]}>
              <div className="relative">
                <div className="absolute -inset-6 animate-ping bg-[#C0FF00]/20 rounded-full" />
                <div className="absolute -inset-4 bg-[#C0FF00]/10 rounded-full animate-pulse" />
                <div className="w-6 h-6 bg-[#C0FF00] rounded-full border-[3px] border-white shadow-[0_0_30px_rgba(192,255,0,0.8)] flex items-center justify-center">
                  <div className="w-2 h-2 bg-black rounded-full" />
                </div>
              </div>
            </Marker>
          )}

          {/* Ghost runner */}
          {ghostPoint && (
            <Marker longitude={ghostPoint[0]} latitude={ghostPoint[1]}>
              <div className="w-4 h-4 bg-white/20 rounded-full border border-white/30 backdrop-blur-sm" />
            </Marker>
          )}

          {/* Start marker */}
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

          {/* End marker */}
          {routeCoords.length > 1 && (
            <Marker longitude={routeCoords[routeCoords.length - 1][0]} latitude={routeCoords[routeCoords.length - 1][1]}>
              <div className="w-5 h-5 bg-rose-500 rounded-full border-2 border-white shadow-2xl flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full" />
              </div>
            </Marker>
          )}
        </Map>

        {/* Floating telemetry HUD */}
        {playbackPoint && isPlaying && (
          <div className="absolute top-6 right-6 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-3 flex items-center gap-6 shadow-2xl">
              <div className="text-center">
                <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Pace</div>
                <div className="text-lg font-black italic text-[#C0FF00] tabular-nums">{formatPace(playbackPoint.pace)}</div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest">HR</div>
                <div className="text-lg font-black italic text-rose-500 tabular-nums">
                  {playbackPoint.heartRate > 0 ? Math.round(playbackPoint.heartRate) : '--'}
                </div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Elev</div>
                <div className="text-lg font-black italic text-amber-400 tabular-nums">{Math.round(playbackPoint.elevation)}m</div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Dist</div>
                <div className="text-lg font-black italic text-white tabular-nums">{playbackPoint.distance.toFixed(2)} km</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
