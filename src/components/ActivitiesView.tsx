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
  Upload,
  X,
  Database,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useApi, invalidateCache } from '../hooks/useApi';
import { API_CACHE } from '../hooks/apiCacheKeys';
import { getRuns, importGarminCsv } from '../api';
import type { Run, RunsResponse } from '../types/api';
import { useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { computeDrift, driftLabel } from '../utils/cardiacDrift';
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
  const { t } = useTranslation();
  const { data, loading, error } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const [hoveredRunId, setHoveredRunId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>('all-zoomed');
  const [mapReady, setMapReady] = useState(false);
  const [showGarminImport, setShowGarminImport] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvParsing, setCsvParsing] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ success: boolean; message: string; imported: number; skipped: number } | null>(null);
  const [parsedRuns, setParsedRuns] = useState<Array<Record<string, string>>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mapRef = useRef<MapRef>(null);
  const rafRef = useRef<number | null>(null);
  const rotationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runs: Run[] = data?.runs ?? [];
  const allRuns: Run[] = runs;
  const runsWithCoords = allRuns.filter(r => r.start_latlng && r.start_latlng.length === 2);

  // Pre-compute cardiac drift for all runs (only steady-pace runs qualify)
  const driftMap = useMemo(() => {
    const record: Record<string, ReturnType<typeof computeDrift>> = {};
    for (const run of allRuns) {
      // Escludi tapis roulant dal drift (nessun GPS, splits non affidabili)
      if (!run.is_treadmill && run.distance_km >= 4 && (run.splits ?? []).length >= 4) {
        const d = computeDrift(run);
        if (d) record[run.id] = d;
      }
    }
    return record;
  }, [allRuns]);
  const lastRunWithCoords = runsWithCoords[0] ?? null; // runs are newest-first

  // Center fallback
  const initialLng = lastRunWithCoords ? lastRunWithCoords.start_latlng![1] : 12.49;
  const initialLat = lastRunWithCoords ? lastRunWithCoords.start_latlng![0] : 41.89;

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
    if (!mapReady || allRuns.length === 0) return;
    // Usa setTimeout per assicurarsi che la mappa sia pronta
    const timer = setTimeout(() => {
      try {
        applyViewMode(mapViewMode, allRuns);
      } catch (err) {
        console.warn('Error applying view mode:', err);
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, allRuns.length]);

  // ── Switch view mode ───────────────────────────────────────────────────────
  const switchViewMode = useCallback((mode: MapViewMode) => {
    setMapViewMode(mode);
    setSelectedRunId(null);
    applyViewMode(mode, allRuns);
  }, [applyViewMode, allRuns]);

  // ── Click on run card / marker ────────────────────────────────────────────
  const handleRunClick = useCallback((run: Run) => {
    if (!run.start_latlng || run.start_latlng.length < 2) return;
    setSelectedRunId(run.id);
    stopRotation();
    const [lat, lng] = run.start_latlng;
    const map = mapRef.current?.getMap();
    if (!map) return;
    (map as any).flyTo({ center: [lng, lat], zoom: 16.5, pitch: 65, duration: 2000, essential: true });
    rotationTimeoutRef.current = setTimeout(() => {
      if (map.isStyleLoaded()) startRotation();
    }, 2200);
  }, [stopRotation, startRotation]);

  // ── Map interaction stops rotation ────────────────────────────────────────
  const handleMapInteraction = useCallback(() => stopRotation(), [stopRotation]);

  // ── Which markers to show ─────────────────────────────────────────────────
  const visibleMarkers = mapViewMode === 'last-run' && lastRunWithCoords
    ? [lastRunWithCoords]
    : runsWithCoords;

  // ── Garmin CSV Import ─────────────────────────────────────────────────────
  function parseGarminCsv(text: string): Array<Record<string, string>> {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    const countDelimiter = (line: string, delimiter: string) => {
      let count = 0;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];
        if (char === '"' && next === '"') {
          i++;
          continue;
        }
        if (char === '"') inQuotes = !inQuotes;
        if (char === delimiter && !inQuotes) count++;
      }
      return count;
    };
    const delimiter = [',', ';', '\t']
      .map((candidate) => ({ candidate, count: countDelimiter(lines[0], candidate) }))
      .sort((a, b) => b.count - a.count)[0]?.candidate ?? ',';
    const parseLine = (line: string) => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];
        if (char === '"' && next === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          values.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^"|"$/g, ''));
      return values;
    };

    const header = parseLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());
    const runs: Array<Record<string, string>> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      const row: Record<string, string> = {};
      header.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      runs.push(row);
    }
    return runs;
  }

  async function handleCsvFile(file: File) {
    setCsvParsing(true);
    setCsvResult(null);
    try {
      const text = await file.text();
      const runs = parseGarminCsv(text);
      
      if (runs.length === 0) {
        setCsvResult({ success: false, message: 'Nessuna corsa trovata nel file CSV.', imported: 0, skipped: 0 });
        return;
      }
      
      setParsedRuns(runs);
      setCsvFile(file);
      setCsvResult({ success: true, message: `${runs.length} corse trovate nel file "${file.name}". Pronto per l'import.`, imported: 0, skipped: 0 });
    } catch (e: any) {
      setCsvResult({ success: false, message: `Errore parsing CSV: ${e?.message ?? 'Errore sconosciuto'}`, imported: 0, skipped: 0 });
    } finally {
      setCsvParsing(false);
    }
  }

  async function handleImportToDatabase() {
    if (parsedRuns.length === 0) return;
    setCsvImporting(true);
    setCsvResult(null);
    try {
      const result = await importGarminCsv(parsedRuns);
      // New runs imported → invalidate everything that depends on runs
      invalidateCache(API_CACHE.RUNS);
      invalidateCache(API_CACHE.DASHBOARD);
      invalidateCache(API_CACHE.ANALYTICS);
      invalidateCache(API_CACHE.BEST_EFFORTS);
      invalidateCache(API_CACHE.HEATMAP);
      invalidateCache(API_CACHE.SUPERCOMPENSATION);
      setCsvResult({
        success: true,
        message: `Importazione completata: ${result.imported} righe salvate, ${result.duplicates ?? 0} duplicate, ${result.matched ?? 0} match Strava, ${result.enriched ?? 0} corse arricchite.`,
        imported: result.imported,
        skipped: result.skipped,
      });
      setParsedRuns([]);
      setCsvFile(null);
    } catch (e: any) {
      setCsvResult({
        success: false,
        message: `Errore durante l'importazione: ${e?.message ?? 'Errore sconosciuto'}`,
        imported: 0,
        skipped: 0,
      });
    }
    setCsvImporting(false);
  }

  function resetCsvImport() {
    setCsvFile(null);
    setCsvResult(null);
    setParsedRuns([]);
    setShowGarminImport(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-[#050505]" style={{ height: '100%' }}>

      {/* ── LEFT: List ───────────────────────────────────────────────────── */}
      <div className="w-1/2 flex flex-col overflow-hidden border-r border-white/5">

        {/* Header */}
        <header className="px-6 py-6 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase">{t("activities.title").toUpperCase()}</h1>

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

          {/* Counts + Garmin Import */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#C0FF00]" />
              <span className="text-xs font-bold text-gray-400">
                {loading ? '...' : `${allRuns.length} corse`}
              </span>
            </div>

            {/* Garmin Import button */}
            <button
              onClick={() => setShowGarminImport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-[#8B5CF6]/30 text-[#8B5CF6] bg-[#8B5CF6]/5 hover:bg-[#8B5CF6]/10 transition-all"
              title="Importa manualmente il file CSV Garmin"
            >
              <Database className="w-3.5 h-3.5" />
              Garmin Import
            </button>
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

          {!loading && allRuns.map((run, index) => {
            // ── Regular run card ────────────────────────────────────────────
            const typeLabel = getRunTypeLabel(run.run_type);
            const { bg, text, icon } = getTypeStyle(typeLabel);
            const isHovered = hoveredRunId === run.id;
            const isSelected = selectedRunId === run.id;
            const hasCoords = !!(run.start_latlng && run.start_latlng.length === 2);

            const runTitle = run.notes
              ? run.notes.replace('Importata da Strava: ', '').replace(/(\s*\[Strava:[^\]]*\])+/g, '').trim()
                || `${typeLabel} ${run.distance_km.toFixed(1)} km`
              : `${typeLabel} ${run.distance_km.toFixed(1)} km`;

            const drift = driftMap[run.id] ?? null;
            const driftCfg = drift ? driftLabel(drift.drift) : null;

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
                    {run.is_treadmill && (
                      <span className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest flex-shrink-0 bg-slate-700/60 text-slate-400" title="Tapis roulant — escluso dalle statistiche">
                        🏃 tapis
                      </span>
                    )}
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

                  {/* Cardiac drift — only for steady-pace runs */}
                  {drift && driftCfg && (
                    <>
                      <div className="w-px h-8 self-center bg-white/5" />
                      <div className="flex flex-col items-center" title={`Deriva cardiaca: Prima metà ${drift.hr1} bpm → Seconda metà ${drift.hr2} bpm`}>
                        <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-0.5">drift</span>
                        <span className="text-sm font-black italic" style={{ color: driftCfg.color }}>
                          {drift.drift >= 0 ? "+" : ""}{drift.drift.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-0.5">1ª→2ª</span>
                        <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">
                          {drift.hr1}<span className="text-gray-600">→</span><span style={{ color: driftCfg.color }}>{drift.hr2}</span>
                        </span>
                      </div>
                    </>
                  )}
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
          const run = allRuns.find(r => r.id === selectedRunId);
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

      {/* ── Garmin CSV Import Modal ──────────────────────────────────────── */}
      {showGarminImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-lg mx-4 bg-[#0A0F1A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/15 flex items-center justify-center">
                  <Database className="w-4 h-4 text-[#8B5CF6]" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white uppercase tracking-tight">Garmin CSV Import</h2>
                  <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Upload manuale → collezione separata</p>
                </div>
              </div>
              <button
                onClick={resetCsvImport}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Info box */}
              <div className="bg-[#8B5CF6]/5 border border-[#8B5CF6]/20 rounded-xl px-4 py-3">
                <p className="text-[11px] text-gray-300 leading-relaxed">
                  <span className="text-[#8B5CF6] font-bold">ℹ️ Come funziona:</span> Carica il file CSV esportato da Garmin Connect. 
                  I dati verranno salvati nella collezione <code className="text-[#8B5CF6] font-mono">garmin_csv_data</code> senza modificare le tue corse Strava.
                  Include: Running Dynamics, HR, Cadenza, Potenza, ecc.
                </p>
              </div>

              {/* Drop zone / File input */}
              {!csvFile && (
                <label
                  htmlFor="garmin-csv-upload"
                  className={cn(
                    'flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-10 px-4 cursor-pointer transition-all',
                    csvParsing
                      ? 'border-[#8B5CF6]/30 bg-[#8B5CF6]/5'
                      : 'border-white/10 hover:border-[#8B5CF6]/30 hover:bg-white/[0.02]'
                  )}
                >
                  {csvParsing ? (
                    <>
                      <Loader2 className="w-8 h-8 text-[#8B5CF6] animate-spin mb-3" />
                      <span className="text-sm font-bold text-gray-300">Parsing CSV...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-500 mb-3" />
                      <span className="text-sm font-bold text-gray-300">Trascina il file CSV qui</span>
                      <span className="text-[10px] text-gray-500 mt-1">oppure clicca per selezionare</span>
                      <span className="text-[9px] text-gray-600 mt-2">File Garmin Connect export (.csv)</span>
                    </>
                  )}
                  <input
                    id="garmin-csv-upload"
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleCsvFile(f);
                    }}
                    disabled={csvParsing}
                  />
                </label>
              )}

              {/* File selected */}
              {csvFile && !csvParsing && (
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#8B5CF6]/15 flex items-center justify-center flex-shrink-0">
                    <Database className="w-4 h-4 text-[#8B5CF6]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{csvFile.name}</p>
                    <p className="text-[10px] text-gray-500">{(csvFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    onClick={() => { setCsvFile(null); setParsedRuns([]); setCsvResult(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Result message */}
              {csvResult && (
                <div className={cn(
                  'rounded-xl px-4 py-3 border',
                  csvResult.success
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-rose-500/5 border-rose-500/20'
                )}>
                  <p className={cn(
                    'text-sm font-bold',
                    csvResult.success ? 'text-emerald-400' : 'text-rose-400'
                  )}>
                    {csvResult.message}
                  </p>
                </div>
              )}

              {/* Import button */}
              {parsedRuns.length > 0 && (
                <button
                  onClick={handleImportToDatabase}
                  disabled={csvImporting}
                  className="w-full py-3 rounded-xl bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 text-[#8B5CF6] text-sm font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {csvImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importazione in corso...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Importa {parsedRuns.length} corse nel database
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between">
              <p className="text-[9px] text-gray-600 font-medium uppercase tracking-wider">
                Collezione: garmin_csv_data · Nessuna modifica alle corse Strava
              </p>
              <button
                onClick={resetCsvImport}
                className="text-[10px] text-gray-500 hover:text-white font-bold uppercase tracking-wider transition-colors"
              >
                Chiudi
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
