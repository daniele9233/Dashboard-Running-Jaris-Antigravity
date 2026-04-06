import {
  Activity,
  Calendar,
  ChevronRight,
  MapPin,
  TrendingUp,
  Zap,
  Heart,
  Watch,
  Loader2,
  CheckCircle2,
  Globe,
  Navigation,
  Layers,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useApi } from '../hooks/useApi';
import { getRuns, syncGarminAll } from '../api';
import type { GarminSyncResult } from '../api';
import type { Run, RunsResponse } from '../types/api';
import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { Map, Marker, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { MapRef } from 'react-map-gl/mapbox';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

type RunType = 'Easy' | 'Tempo' | 'Intervals' | 'Long' | 'Recovery' | string;
type MapViewMode = 'world' | 'last-run' | 'all-zoomed';

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.round((minutes % 1) * 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getRunTypeLabel(type: string): RunType {
  const map: Record<string, RunType> = {
    easy: 'Easy', tempo: 'Tempo', intervals: 'Intervals', interval: 'Intervals',
    long: 'Long', recovery: 'Recovery', riposo: 'Recovery', soglia: 'Tempo',
    ripetute: 'Intervals', lungo: 'Long',
  };
  return map[type.toLowerCase()] ?? type;
}

function getTypeStyle(type: RunType) {
  switch (type) {
    case 'Tempo':     return { bg: 'bg-blue-500/20',    text: 'text-blue-400',    markerColor: '#3B82F6', icon: <Zap className="w-7 h-7" /> };
    case 'Intervals': return { bg: 'bg-rose-500/20',    text: 'text-rose-400',    markerColor: '#F43F5E', icon: <TrendingUp className="w-7 h-7" /> };
    case 'Long':      return { bg: 'bg-amber-500/20',   text: 'text-amber-400',   markerColor: '#F59E0B', icon: <Activity className="w-7 h-7" /> };
    case 'Recovery':  return { bg: 'bg-purple-500/20',  text: 'text-purple-400',  markerColor: '#A855F7', icon: <Heart className="w-7 h-7" /> };
    default:          return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', markerColor: '#10B981', icon: <Activity className="w-7 h-7" /> };
  }
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function RunSkeleton() {
  return (
    <div className="w-full bg-[#0F172A]/40 border border-white/5 p-4 rounded-2xl animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-white/10 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-white/10 rounded w-36" />
          <div className="h-3 bg-white/5 rounded w-24" />
        </div>
        <div className="flex gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-2 bg-white/5 rounded w-8" />
              <div className="h-4 bg-white/10 rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── View Mode Button ──────────────────────────────────────────────────────────

interface ViewModeButtonProps {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

function ViewModeButton({ active, icon, label, onClick }: ViewModeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all duration-200',
        active
          ? 'bg-[#C0FF00]/15 border-[#C0FF00]/40 text-[#C0FF00] shadow-[0_0_12px_rgba(192,255,0,0.15)]'
          : 'bg-white/5 border-white/8 text-gray-500 hover:text-gray-300 hover:border-white/20'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface ActivitiesViewProps {
  onSelectRun: (runId: string) => void;
}

export function ActivitiesView({ onSelectRun }: ActivitiesViewProps) {
  const { data, loading, error } = useApi<RunsResponse>(getRuns);
  const [garminState, setGarminState] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [garminResult, setGarminResult] = useState<GarminSyncResult | null>(null);
  const [garminForce, setGarminForce] = useState(false);
  const [hoveredRunId, setHoveredRunId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>('all-zoomed');
  const [mapReady, setMapReady] = useState(false);

  const mapRef = useRef<MapRef>(null);
  const rafRef = useRef<number | null>(null);
  const rotationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runs: Run[] = data?.runs ?? [];
  const runsWithCoords = runs.filter(r => r.start_latlng && r.start_latlng.length === 2);
  const lastRunWithCoords = runsWithCoords[0] ?? null; // runs are newest-first

  // Center fallback
  const initialLng = lastRunWithCoords ? lastRunWithCoords.start_latlng![1] : 12.49;
  const initialLat = lastRunWithCoords ? lastRunWithCoords.start_latlng![0] : 41.89;

  // ── Garmin sync (login diretto, niente popup) ───────────────────────────────
  async function handleGarminSync(force = false) {
    setGarminState('syncing');
    setGarminResult(null);
    try {
      const res = await syncGarminAll(force);
      setGarminResult(res);
      setGarminState('done');
    } catch (e: any) {
      let msg = e?.message ?? 'Unknown error';
      try { const parsed = JSON.parse(msg); msg = parsed.detail ?? parsed.error ?? msg; } catch {}
      setGarminResult({ ok: false, hr_updated: 0, dynamics_updated: 0, updated: 0, skipped: 0, skipped_no_match: 0, skipped_complete: 0, total_garmin_runs: 0, errors: [msg] });
      setGarminState('error');
    }
  }

  // ── Rotation helpers ───────────────────────────────────────────────────────
  const stopRotation = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (rotationTimeoutRef.current !== null) { clearTimeout(rotationTimeoutRef.current); rotationTimeoutRef.current = null; }
  }, []);

  useEffect(() => () => stopRotation(), [stopRotation]);

  const startRotation = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    let bearing = map.getBearing();
    const rotate = () => {
      bearing = (bearing + 0.15) % 360;
      map.setBearing(bearing);
      rafRef.current = requestAnimationFrame(rotate);
    };
    rafRef.current = requestAnimationFrame(rotate);
  }, []);

  // ── Map load – enable ALL labels + dusk ────────────────────────────────────
  const handleMapLoad = useCallback((e: any) => {
    const map = e.target;
    map.setConfigProperty('basemap', 'lightPreset', 'dusk');
    map.setConfigProperty('basemap', 'showPointOfInterestLabels', true);
    map.setConfigProperty('basemap', 'showPlaceLabels', true);
    map.setConfigProperty('basemap', 'showRoadLabels', true);
    map.setConfigProperty('basemap', 'showTransitLabels', true);
    setMapReady(true);
  }, []);

  // ── Apply view mode (called after data loads OR on button click) ──────────
  const applyViewMode = useCallback((mode: MapViewMode, runsData: Run[]) => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const withCoords = runsData.filter(r => r.start_latlng && r.start_latlng.length === 2);

    stopRotation();

    if (mode === 'world') {
      // Switch to globe projection for the spherical world look
      (map as any).setProjection('globe');
      // Center on centroid of all runs, zoom out to see the globe
      const lngs = withCoords.map(r => r.start_latlng![1]);
      const lats = withCoords.map(r => r.start_latlng![0]);
      const cx = lngs.length ? lngs.reduce((a, b) => a + b, 0) / lngs.length : 12.49;
      const cy = lats.length ? lats.reduce((a, b) => a + b, 0) / lats.length : 41.89;
      (map as any).flyTo({ center: [cx, cy], zoom: 3, pitch: 0, bearing: 0, duration: 1800, essential: true });

    } else if (mode === 'last-run') {
      // Back to flat mercator for street-level views
      (map as any).setProjection('mercator');
      const last = withCoords[0];
      if (!last?.start_latlng) return;
      const [lat, lng] = last.start_latlng;
      (map as any).flyTo({ center: [lng, lat], zoom: 15.5, pitch: 62, bearing: -20, duration: 2000, essential: true });
      setSelectedRunId(last.id);

    } else {
      // all-zoomed: mercator, zoom into the densest area from the last 6 months
      (map as any).setProjection('mercator');
      if (withCoords.length === 0) return;
      
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const recentRuns = withCoords.filter(r => new Date(r.date) >= sixMonthsAgo);
      const targetRuns = recentRuns.length > 0 ? recentRuns : withCoords;

      // Group runs into ~1km clusters
      const clusters: Record<string, { lat: number, lng: number, count: number }> = {};
      let maxCluster = '';
      let maxCount = 0;

      targetRuns.forEach(r => {
        const lat = r.start_latlng![0];
        const lng = r.start_latlng![1];
        const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
        if (!clusters[key]) {
          clusters[key] = { lat: 0, lng: 0, count: 0 };
        }
        clusters[key].lat += lat;
        clusters[key].lng += lng;
        clusters[key].count += 1;
        
        if (clusters[key].count > maxCount) {
          maxCount = clusters[key].count;
          maxCluster = key;
        }
      });

      const bestCluster = clusters[maxCluster];
      const centLat = bestCluster.lat / bestCluster.count;
      const centLng = bestCluster.lng / bestCluster.count;

      (map as any).flyTo({
        center: [centLng, centLat],
        zoom: 15.5,
        pitch: 62,
        bearing: -20,
        duration: 2000,
        essential: true,
      });
    }
  }, [stopRotation]);

  // Auto-apply view when map becomes ready and data arrives
  useEffect(() => {
    if (mapReady && runs.length > 0) {
      applyViewMode(mapViewMode, runs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, runs.length]);

  // ── Switch view mode ───────────────────────────────────────────────────────
  const switchViewMode = useCallback((mode: MapViewMode) => {
    setMapViewMode(mode);
    setSelectedRunId(null);
    applyViewMode(mode, runs);
  }, [applyViewMode, runs]);

  // ── Click on run card / marker ────────────────────────────────────────────
  const handleRunClick = useCallback((run: Run) => {
    if (!run.start_latlng || run.start_latlng.length < 2) return;
    setSelectedRunId(run.id);
    stopRotation();
    const [lat, lng] = run.start_latlng;
    const map = mapRef.current?.getMap();
    if (!map) return;
    (map as any).flyTo({ center: [lng, lat], zoom: 16.5, pitch: 65, duration: 2000, essential: true });
    rotationTimeoutRef.current = setTimeout(() => startRotation(), 2200);
  }, [stopRotation, startRotation]);

  // ── Map interaction stops rotation ────────────────────────────────────────
  const handleMapInteraction = useCallback(() => stopRotation(), [stopRotation]);

  // ── Which markers to show ─────────────────────────────────────────────────
  const visibleMarkers = mapViewMode === 'last-run' && lastRunWithCoords
    ? [lastRunWithCoords]
    : runsWithCoords;

  return (
    <div className="flex-1 flex overflow-hidden bg-[#050505]" style={{ height: '100%' }}>

      {/* ── LEFT: List ───────────────────────────────────────────────────── */}
      <div className="w-1/2 flex flex-col overflow-hidden border-r border-white/5">

        {/* Header */}
        <header className="px-6 py-6 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase">Activities</h1>

            {/* ── 3 view-mode buttons ── */}
            <div className="flex items-center gap-2">
              <ViewModeButton
                active={mapViewMode === 'world'}
                icon={<Globe className="w-3 h-3" />}
                label="World"
                onClick={() => switchViewMode('world')}
              />
              <ViewModeButton
                active={mapViewMode === 'last-run'}
                icon={<Navigation className="w-3 h-3" />}
                label="Last Run"
                onClick={() => switchViewMode('last-run')}
              />
              <ViewModeButton
                active={mapViewMode === 'all-zoomed'}
                icon={<Layers className="w-3 h-3" />}
                label="All Runs"
                onClick={() => switchViewMode('all-zoomed')}
              />
            </div>
          </div>

          {/* Counts + Garmin */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#C0FF00]" />
              <span className="text-xs font-bold text-gray-400">
                {loading ? '...' : `${runs.length} corse`}
              </span>
            </div>

            {/* Sync button */}
            <button
              onClick={() => handleGarminSync(false)}
              disabled={garminState === 'syncing'}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all',
                garminState === 'done'   ? 'bg-[#00FFAA]/10 border-[#00FFAA]/30 text-[#00FFAA]'
                : garminState === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-[#0A0A0A] border-white/10 text-gray-400 hover:border-[#00FFAA]/30 hover:text-[#00FFAA]'
              )}
            >
              {garminState === 'syncing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : garminState === 'done'  ? <CheckCircle2 className="w-3.5 h-3.5" />
                : <Watch className="w-3.5 h-3.5" />}
              {garminState === 'syncing' ? 'Sync...' : 'Garmin'}
            </button>

            {/* Force re-sync button */}
            {(garminState === 'idle' || garminState === 'done' || garminState === 'error') && (
              <button
                onClick={() => handleGarminSync(true)}
                disabled={garminState === 'syncing'}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-[#F59E0B]/30 text-[#F59E0B] bg-[#F59E0B]/5 hover:bg-[#F59E0B]/10 transition-all"
                title="Forza ri-sincronizzazione di tutti i dati (ignora quelli già presenti)"
              >
                <Watch className="w-3 h-3" />
                Forza
              </button>
            )}

            {/* Result feedback */}
            {garminState === 'done' && garminResult && (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 text-[10px]">
                  {garminResult.hr_updated > 0 && (
                    <span className="text-[#00FFAA] font-bold">♥ {garminResult.hr_updated} HR</span>
                  )}
                  {garminResult.dynamics_updated > 0 && (
                    <span className="text-[#3B82F6] font-bold">⚡ {garminResult.dynamics_updated} dynamics</span>
                  )}
                  {garminResult.hr_updated === 0 && garminResult.dynamics_updated === 0 && (
                    <span className="text-gray-500">Nessun dato nuovo</span>
                  )}
                  {garminResult.skipped_no_match > 0 && (
                    <span className="text-[#F59E0B]">{garminResult.skipped_no_match} no-match</span>
                  )}
                </div>
                {garminResult.errors.length > 0 && (
                  <span
                    className="text-[9px] text-rose-400 cursor-help"
                    title={garminResult.errors.join('\n')}
                  >
                    {garminResult.errors.length} errore/i (hover per dettagli)
                  </span>
                )}
              </div>
            )}
            {garminState === 'error' && garminResult && garminResult.errors.length > 0 && (
              <span className="text-[10px] text-rose-400 font-medium" title={garminResult.errors.join('\n')}>
                {garminResult.errors[0].slice(0, 50)}
              </span>
            )}
          </div>
          <p className="text-gray-600 text-[10px] font-medium mt-2 uppercase tracking-widest">
            Corse Strava · Clicca card per volare · Freccia per dettaglio
          </p>
        </header>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2.5">

          {error && (
            <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-2xl px-4 py-3">
              Errore: {error}
            </div>
          )}
          {loading && [...Array(7)].map((_, i) => <RunSkeleton key={i} />)}
          {!loading && !error && runs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <Activity className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-black uppercase tracking-widest">Nessuna corsa trovata</p>
            </div>
          )}

          {!loading && runs.map((run, index) => {
            const typeLabel = getRunTypeLabel(run.run_type);
            const { bg, text, icon } = getTypeStyle(typeLabel);
            const isHovered = hoveredRunId === run.id;
            const isSelected = selectedRunId === run.id;
            const hasCoords = !!(run.start_latlng && run.start_latlng.length === 2);

            const runTitle = run.notes
              ? run.notes.replace('Importata da Strava: ', '').replace(/(\s*\[Strava:[^\]]*\])+/g, '').trim()
                || `${typeLabel} ${run.distance_km.toFixed(1)} km`
              : `${typeLabel} ${run.distance_km.toFixed(1)} km`;

            return (
              <motion.div
                key={run.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.32) }}
                onMouseEnter={() => setHoveredRunId(run.id)}
                onMouseLeave={() => setHoveredRunId(null)}
                onClick={() => hasCoords && handleRunClick(run)}
                className={cn(
                  'w-full bg-[#0F172A]/40 backdrop-blur-xl border p-4 rounded-2xl flex items-center gap-4 transition-all group relative',
                  hasCoords ? 'cursor-pointer' : 'cursor-default',
                  isSelected
                    ? 'border-[#C0FF00]/50 bg-[#C0FF00]/[0.04] shadow-[0_0_24px_rgba(192,255,0,0.07)]'
                    : isHovered
                    ? 'border-white/12 bg-white/[0.025]'
                    : 'border-white/5'
                )}
              >
                {/* selected pulse ring */}
                {isSelected && (
                  <div className="absolute inset-0 rounded-2xl pointer-events-none border border-[#C0FF00]/20 animate-pulse" />
                )}

                {/* Type icon */}
                <div className={cn(
                  'w-11 h-11 rounded-xl flex items-center justify-center shadow-xl transition-transform flex-shrink-0',
                  bg, text,
                  (isHovered || isSelected) && 'scale-110',
                )}>
                  {icon}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className={cn(
                      'text-sm font-black italic tracking-tight truncate transition-colors',
                      isSelected ? 'text-[#C0FF00]' : 'text-white/90',
                    )}>
                      {runTitle}
                    </h3>
                    <span className={cn('px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest flex-shrink-0', bg, text)}>
                      {typeLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />{formatDate(run.date)}
                    </span>
                    {run.location && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                        <span className="truncate">{run.location}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-4 border-x border-white/5 px-4 flex-shrink-0">
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-0.5">km</span>
                    <span className="text-sm font-black italic text-white">{run.distance_km.toFixed(1)}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-0.5">pace</span>
                    <span className="text-sm font-black italic text-emerald-400">{run.avg_pace}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-0.5">hr</span>
                    <span className="text-sm font-black italic text-rose-400">{run.avg_hr ?? '—'}</span>
                  </div>
                </div>

                {/* Arrow → opens detail */}
                <button
                  id={`run-detail-btn-${run.id}`}
                  onClick={(e) => { e.stopPropagation(); onSelectRun(run.id); }}
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
                    isSelected
                      ? 'bg-[#C0FF00] text-black'
                      : 'bg-white/5 text-gray-500 hover:bg-[#C0FF00] hover:text-black',
                  )}
                  title="Vedi dettaglio corsa"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT: Mapbox 3D ─────────────────────────────────────────────── */}
      <div className="w-1/2 relative flex-shrink-0">
        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/standard"
          initialViewState={{
            longitude: initialLng,
            latitude: initialLat,
            zoom: 12,
            pitch: 60,
            bearing: -20,
          }}
          style={{ width: '100%', height: '100%' }}
          onLoad={handleMapLoad}
          onMouseDown={handleMapInteraction}
          onTouchStart={handleMapInteraction}
          onWheel={handleMapInteraction}
        >
          <NavigationControl position="top-right" />

          {/* Markers */}
          {visibleMarkers.map((run) => {
            const [lat, lng] = run.start_latlng!;
            const typeLabel = getRunTypeLabel(run.run_type);
            const { markerColor } = getTypeStyle(typeLabel);
            const isHovered = hoveredRunId === run.id;
            const isSelected = selectedRunId === run.id;
            const isLastRun = run.id === lastRunWithCoords?.id;

            return (
              <Marker
                key={run.id}
                longitude={lng}
                latitude={lat}
                anchor="center"
                onClick={(e) => { e.originalEvent.stopPropagation(); handleRunClick(run); }}
              >
                <div
                  className="transition-all duration-300 cursor-pointer relative"
                  style={{ transform: (isHovered || isSelected) ? 'scale(1.45)' : 'scale(1)', opacity: (isHovered || isSelected) ? 1 : 0.7 }}
                >
                  {/* Ping ring for selected/hovered */}
                  {(isSelected || isHovered) && (
                    <div
                      className="absolute rounded-full animate-ping"
                      style={{
                        inset: '-4px',
                        backgroundColor: isSelected ? '#C0FF00' : markerColor,
                        opacity: 0.25,
                      }}
                    />
                  )}
                  {/* Dot */}
                  <div
                    className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-xl relative z-10"
                    style={{
                      backgroundColor: isSelected ? '#C0FF00' : markerColor,
                      boxShadow: `0 0 ${isSelected ? '18px' : '6px'} ${isSelected ? '#C0FF00' : markerColor}99`,
                    }}
                  />
                  {/* Distance bubble on selected */}
                  {isSelected && (
                    <div
                      className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-lg text-[9px] font-black text-black whitespace-nowrap shadow-xl z-20"
                      style={{ backgroundColor: '#C0FF00' }}
                    >
                      {run.distance_km.toFixed(1)} km
                    </div>
                  )}
                  {/* "LAST" badge in last-run mode */}
                  {mapViewMode === 'last-run' && isLastRun && !isSelected && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-lg text-[8px] font-black text-black whitespace-nowrap z-20" style={{ backgroundColor: markerColor }}>
                      LAST
                    </div>
                  )}
                </div>
              </Marker>
            );
          })}
        </Map>

        {/* ── View mode badge overlay (top-left) ───────────────────────── */}
        <div className="absolute top-4 left-4 pointer-events-none">
          <div className="bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2">
            {mapViewMode === 'world'      && <><Globe className="w-3 h-3 text-[#C0FF00]" /><span className="text-[9px] font-black uppercase tracking-widest text-gray-300">Vista Mondiale</span></>}
            {mapViewMode === 'last-run'   && <><Navigation className="w-3 h-3 text-[#C0FF00]" /><span className="text-[9px] font-black uppercase tracking-widest text-gray-300">Ultima Corsa</span></>}
            {mapViewMode === 'all-zoomed' && <><Layers className="w-3 h-3 text-[#C0FF00]" /><span className="text-[9px] font-black uppercase tracking-widest text-gray-300">Tutte le Corse</span></>}
          </div>
        </div>

        {/* ── Bottom info panel (selected run) ─────────────────────────── */}
        {selectedRunId && (() => {
          const run = runs.find(r => r.id === selectedRunId);
          if (!run) return null;
          const typeLabel = getRunTypeLabel(run.run_type);
          const { bg, text } = getTypeStyle(typeLabel);
          return (
            <motion.div
              key={selectedRunId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-5 left-4 right-4 pointer-events-none"
            >
              <div className="bg-[#080D18]/90 backdrop-blur-2xl border border-white/10 rounded-2xl px-5 py-3 flex items-center justify-between shadow-2xl">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn('text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded', bg, text)}>{typeLabel}</span>
                    <span className="text-xs font-black italic text-white truncate max-w-[180px]">
                      {run.notes
                        ? run.notes.replace('Importata da Strava: ', '').replace(/(\s*\[Strava:[^\]]*\])+/g, '').trim() || `${typeLabel} Run`
                        : `${typeLabel} Run`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-gray-500">
                    <span>{run.distance_km.toFixed(2)} km</span>
                    <span>{run.avg_pace}/km</span>
                    <span>{formatDuration(run.duration_minutes)}</span>
                    {run.location && <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{run.location}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <div className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Rotazione</div>
                  <div className="text-[8px] font-black text-[#C0FF00]/70 uppercase tracking-widest">Attiva</div>
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* ── Hint when nothing selected ────────────────────────────────── */}
        {!selectedRunId && !loading && runsWithCoords.length > 0 && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
              className="bg-black/55 backdrop-blur-md border border-white/8 px-4 py-2 rounded-full"
            >
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 whitespace-nowrap">
                ↑ Clicca una corsa per volare sulla mappa
              </p>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
