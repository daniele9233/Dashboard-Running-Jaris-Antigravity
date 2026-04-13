import { useNavigate } from "react-router-dom";
import {
  LayoutGrid, Gauge, BarChart3, Box, User, Dna,
  Zap, HelpCircle, LogOut, Wifi, Heart, Play, Trophy,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useApi } from "../hooks/useApi";
import { getRuns } from "../api";
import type { RunsResponse } from "../types/api";

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const menuItems = [
  { id: "dashboard",  icon: LayoutGrid, label: "Performance"  },
  { id: "statistics", icon: BarChart3,  label: "Biometrics"   },
  { id: "training",   icon: Box,        label: "Training"     },
  { id: "statistics", icon: Gauge,      label: "Analytics"    },
];

function fmtTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.round((minutes * 60) % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  return `${m}:${String(s).padStart(2,"0")}`;
}

function bestTimeForDistance(runs: any[], minKm: number, maxKm: number): string {
  const candidates = runs.filter(
    r => !r.is_treadmill && r.distance_km >= minKm && r.distance_km <= maxKm && r.duration_minutes > 0
  );
  if (!candidates.length) return "—";
  // Normalize to exact target distance using avg pace
  const target = (minKm + maxKm) / 2;
  const best = candidates.reduce((best, r) => {
    const paceSecPerKm = (r.duration_minutes * 60) / r.distance_km;
    const normalizedMin = (paceSecPerKm * target) / 60;
    const bestPaceSecPerKm = (best.duration_minutes * 60) / best.distance_km;
    const bestNormalizedMin = (bestPaceSecPerKm * target) / 60;
    return normalizedMin < bestNormalizedMin ? r : best;
  });
  const paceSecPerKm = (best.duration_minutes * 60) / best.distance_km;
  return fmtTime((paceSecPerKm * target) / 60);
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const { data: runsData } = useApi<RunsResponse>(getRuns);
  const runs = runsData?.runs ?? [];

  const pb5k  = bestTimeForDistance(runs, 4.5, 5.5);
  const pb10k = bestTimeForDistance(runs, 9.0, 11.0);
  const pbHm  = bestTimeForDistance(runs, 19.0, 22.5);

  return (
    <aside className="w-[220px] bg-[#0A0A0A] border-r border-white/5 flex flex-col h-full z-50 shrink-0">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#C0FF00] rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(192,255,0,0.3)] shrink-0">
            <Zap className="w-5 h-5 text-black fill-current" />
          </div>
          <div>
            <div className="text-white font-black tracking-tighter text-sm">METIC LAB</div>
            <div className="text-[#A0A0A0] text-[9px] font-black tracking-widest">ELITE PERFORMANCE</div>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="px-3 py-4 flex flex-col gap-1">
        {menuItems.map((item, idx) => {
          const isActive = activeView === item.id && idx === 0 ? true : activeView === item.id;
          return (
            <button
              key={`${item.id}-${idx}`}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all relative",
                activeView === item.id
                  ? "bg-[#C0FF00]/10 text-[#C0FF00]"
                  : "text-gray-500 hover:text-white hover:bg-white/5"
              )}
            >
              {activeView === item.id && (
                <div className="absolute left-0 w-1 h-5 bg-[#C0FF00] rounded-r-full" />
              )}
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="text-xs font-black tracking-wider">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Sensors */}
      <div className="px-5 py-4 border-t border-white/5">
        <div className="text-[#A0A0A0] text-[9px] font-black tracking-widest mb-3 flex items-center gap-2">
          <Wifi className="w-3 h-3" />
          SENSORS
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-white text-xs font-semibold">Garmin Watch</span>
            <span className="text-[9px] font-black text-[#C0FF00] bg-[#C0FF00]/10 px-2 py-0.5 rounded-full">CONNECTED</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Heart className="w-3 h-3 text-rose-400" />
              <span className="text-white text-xs font-semibold">HRM-Pro</span>
            </div>
            <span className="text-[#A0A0A0] text-[9px]">⬛ 84%</span>
          </div>
        </div>
      </div>

      {/* Hall of Fame */}
      <div className="px-5 py-4 border-t border-white/5 flex-1">
        <div className="text-[#A0A0A0] text-[9px] font-black tracking-widest mb-3 flex items-center gap-2">
          <Trophy className="w-3 h-3" />
          HALL OF FAME
        </div>
        <div className="space-y-3">
          {[
            { label: "5K",  time: pb5k  },
            { label: "10K", time: pb10k },
            { label: "HM",  time: pbHm  },
          ].map(({ label, time }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[#A0A0A0] text-xs">{label}</span>
              <span className="text-white text-xs font-black">{time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom */}
      <div className="px-3 pb-4 border-t border-white/5 pt-4 space-y-1">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition-all">
          <HelpCircle className="w-4 h-4 shrink-0" />
          <span className="text-xs font-black tracking-wider">SUPPORT</span>
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-gray-500 hover:text-rose-500 hover:bg-rose-500/5 transition-all">
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="text-xs font-black tracking-wider">SIGN OUT</span>
        </button>
        <button className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-[#C0FF00] hover:bg-[#d4ff33] text-black rounded-xl font-black text-xs tracking-widest transition-all">
          <Play className="w-3.5 h-3.5 fill-current" />
          START SESSION
        </button>
      </div>
    </aside>
  );
}
