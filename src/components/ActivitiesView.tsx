import {
  Activity,
  Calendar,
  ChevronRight,
  MapPin,
  TrendingUp,
  Zap,
  Heart,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useApi } from '../hooks/useApi';
import { getRuns } from '../api';
import type { Run, RunsResponse } from '../types/api';

type RunType = 'Easy' | 'Tempo' | 'Intervals' | 'Long' | 'Recovery' | string;

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
    easy: 'Easy',
    tempo: 'Tempo',
    intervals: 'Intervals',
    interval: 'Intervals',
    long: 'Long',
    recovery: 'Recovery',
    riposo: 'Recovery',
    soglia: 'Tempo',
    ripetute: 'Intervals',
    lungo: 'Long',
  };
  return map[type.toLowerCase()] ?? type;
}

function getTypeStyle(type: RunType) {
  switch (type) {
    case 'Tempo':     return { bg: 'bg-blue-500/20',   text: 'text-blue-400',   icon: <Zap className="w-8 h-8" /> };
    case 'Intervals': return { bg: 'bg-rose-500/20',   text: 'text-rose-400',   icon: <TrendingUp className="w-8 h-8" /> };
    case 'Long':      return { bg: 'bg-amber-500/20',  text: 'text-amber-400',  icon: <Activity className="w-8 h-8" /> };
    case 'Recovery':  return { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: <Heart className="w-8 h-8" /> };
    default:          return { bg: 'bg-emerald-500/20',text: 'text-emerald-400',icon: <Activity className="w-8 h-8" /> };
  }
}

function RunSkeleton() {
  return (
    <div className="w-full bg-[#0F172A]/40 border border-white/5 p-6 rounded-3xl animate-pulse">
      <div className="flex items-center gap-8">
        <div className="w-16 h-16 rounded-2xl bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-white/10 rounded w-48" />
          <div className="h-3 bg-white/5 rounded w-32" />
        </div>
        <div className="grid grid-cols-4 gap-8 px-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-2 bg-white/5 rounded w-12" />
              <div className="h-5 bg-white/10 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ActivitiesViewProps {
  onSelectRun: (runId: string) => void;
}

export function ActivitiesView({ onSelectRun }: ActivitiesViewProps) {
  const { data, loading, error } = useApi<RunsResponse>(getRuns);

  const runs: Run[] = data?.runs ?? [];

  return (
    <div className="flex-1 flex flex-col bg-[#050505] overflow-hidden">
      {/* Header */}
      <header className="px-8 py-10 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase">Activities</h1>
          <div className="flex items-center gap-4">
            <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl flex items-center gap-3">
              <Calendar className="w-4 h-4 text-[#C0FF00]" />
              <span className="text-xs font-bold text-gray-400">
                {loading ? '...' : `${runs.length} corse`}
              </span>
            </div>
          </div>
        </div>
        <p className="text-gray-500 text-sm font-medium">
          Le tue corse sincronizzate da Strava.
        </p>
      </header>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-4">

          {/* Error state */}
          {error && (
            <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-2xl px-6 py-4">
              Errore nel caricamento delle corse: {error}
            </div>
          )}

          {/* Loading skeletons */}
          {loading && [...Array(5)].map((_, i) => <RunSkeleton key={i} />)}

          {/* Empty state */}
          {!loading && !error && runs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-gray-500">
              <Activity className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-sm font-black uppercase tracking-widest">Nessuna corsa trovata</p>
              <p className="text-xs mt-2 text-gray-600">Sincronizza Strava per importare le tue corse</p>
            </div>
          )}

          {/* Run cards */}
          {!loading && runs.map((run, index) => {
            const typeLabel = getRunTypeLabel(run.run_type);
            const { bg, text, icon } = getTypeStyle(typeLabel);

            return (
              <motion.button
                key={run.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.04, 0.4) }}
                onClick={() => onSelectRun(run.id)}
                className="w-full bg-[#0F172A]/40 backdrop-blur-xl border border-white/5 hover:border-[#C0FF00]/30 p-6 rounded-3xl flex items-center gap-8 transition-all group text-left"
              >
                {/* Type Icon */}
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110",
                  bg, text
                )}>
                  {icon}
                </div>

                {/* Main Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-xl font-black italic tracking-tight text-white group-hover:text-[#C0FF00] transition-colors">
                      {run.notes
                        ? run.notes.replace('Importata da Strava: ', '').replace(/(\s*\[Strava:[^\]]*\])+/g, '').trim() || `${typeLabel} ${run.distance_km.toFixed(1)} km`
                        : `${typeLabel} ${run.distance_km.toFixed(1)} km`}
                    </h3>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                      bg, text
                    )}>
                      {typeLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-gray-500 text-xs font-bold uppercase tracking-widest">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {formatDate(run.date)}
                    </div>
                    {run.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" />
                        {run.location}
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-8 px-8 border-x border-white/5">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Distance</span>
                    <span className="text-lg font-black italic text-white">{run.distance_km.toFixed(2)} km</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Time</span>
                    <span className="text-lg font-black italic text-white">{formatDuration(run.duration_minutes)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Avg Pace</span>
                    <span className="text-lg font-black italic text-emerald-400">{run.avg_pace}/km</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Avg HR</span>
                    <span className="text-lg font-black italic text-rose-500">
                      {run.avg_hr ? `${run.avg_hr} bpm` : '—'}
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#C0FF00] group-hover:text-black transition-all">
                  <ChevronRight className="w-6 h-6" />
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
