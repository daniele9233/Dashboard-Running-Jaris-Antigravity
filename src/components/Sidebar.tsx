import {
  LayoutGrid,
  Gauge,
  BarChart3,
  Box,
  User,
  HelpCircle,
  LogOut,
  Zap,
  Dna,
} from "lucide-react";
import { cn } from "../lib/utils";

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const menuItems = [
  { id: "dashboard",  icon: LayoutGrid, label: "Dashboard"  },
  { id: "activities", icon: Gauge,      label: "Activities" },
  { id: "statistics", icon: BarChart3,  label: "Statistics" },
  { id: "training",   icon: Box,        label: "Training"   },
  { id: "runner-dna", icon: Dna,        label: "Runner DNA" },
  { id: "profile",    icon: User,       label: "Profile"    },
];

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  return (
    <aside className="w-[72px] bg-[#0A0A0A] border-r border-white/5 flex flex-col items-center py-6 h-full z-50">
      {/* Logo Icon */}
      <div className="mb-10">
        <div className="w-10 h-10 bg-[#C0FF00] rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(192,255,0,0.3)]">
          <Zap className="w-6 h-6 text-black fill-current" />
        </div>
      </div>

      {/* Main Menu */}
      <nav className="flex-1 flex flex-col gap-6" aria-label="Main navigation">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            aria-label={item.label}
            title={item.label}
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group relative",
              activeView === item.id
                ? "bg-[#C0FF00]/10 text-[#C0FF00]"
                : "text-gray-500 hover:text-white hover:bg-white/5"
            )}
          >
            <item.icon className={cn(
              "w-5 h-5 transition-transform duration-300",
              activeView === item.id ? "scale-110" : "group-hover:scale-110"
            )} />

            {activeView === item.id && (
              <div className="absolute left-0 w-1 h-6 bg-[#C0FF00] rounded-r-full" />
            )}
          </button>
        ))}
      </nav>

      {/* Bottom Menu */}
      <div className="mt-auto flex flex-col gap-6">
        <button
          aria-label="Help"
          title="Help"
          className="w-12 h-12 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-all"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
        <button
          aria-label="Logout"
          title="Logout"
          className="w-12 h-12 rounded-xl flex items-center justify-center text-gray-500 hover:text-rose-500 hover:bg-rose-500/5 transition-all"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
}
