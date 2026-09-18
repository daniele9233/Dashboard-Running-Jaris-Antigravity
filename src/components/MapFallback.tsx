import { MapPin, Zap, Clock, TrendingUp } from "lucide-react";
import type { Run } from "../types/api";

interface MapFallbackProps {
  run: Run | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("it", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function MapFallback({ run }: MapFallbackProps) {
  if (!run) {
    return (
      <div className="rounded-3xl overflow-hidden h-full bg-[#0F172A] border border-white/[0.04] flex items-center justify-center">
        <div className="text-center text-gray-600">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p className="text-xs">Nessuna corsa</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl overflow-hidden h-full bg-[#0F172A] border border-white/[0.04] flex items-center justify-center">
      <div className="text-center p-6">
        <MapPin className="w-8 h-8 mx-auto mb-2 text-[#C0FF00] opacity-50" />
        <div className="text-[#C0FF00] text-3xl font-black mb-2">{run.distance_km.toFixed(1)} <span className="text-sm text-gray-500">km</span></div>
        <div className="flex justify-center gap-4 mb-2">
          <span className="text-[#14B8A6] text-xs font-bold">{run.avg_pace}/km</span>
          <span className="text-gray-500 text-xs">{formatDuration(run.duration_minutes)}</span>
        </div>
        <span className="text-[#94A3B8] text-[9px]">{formatDate(run.date)}</span>
      </div>
    </div>
  );
}