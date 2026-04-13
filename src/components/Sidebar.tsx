import {
  LayoutGrid, Gauge, BarChart3, Box,
  Zap, HelpCircle, LogOut, Wifi, Play,
} from "lucide-react";
import { cn } from "../lib/utils";

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

export function Sidebar({ activeView, onViewChange }: SidebarProps) {

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
