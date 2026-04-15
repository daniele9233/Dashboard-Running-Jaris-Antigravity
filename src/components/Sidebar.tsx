import {
  LayoutGrid, Gauge, BarChart3, Box,
  Zap, HelpCircle, LogOut, Wifi, Play,
} from "lucide-react";
import { useTranslation } from "react-i18next";

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const { t } = useTranslation();

  const menuItems = [
    { id: "dashboard",  icon: LayoutGrid, label: t("nav.performance") },
    { id: "statistics", icon: BarChart3,  label: "Biometrics" },
    { id: "training",   icon: Box,        label: t("nav.training") },
    { id: "statistics", icon: Gauge,      label: "Analytics" },
  ];

  return (
    <aside
      className="w-[220px] border-r flex flex-col h-full z-50 shrink-0"
      style={{
        backgroundColor: "var(--app-bg-alt)",
        borderColor: "var(--app-border)",
      }}
    >
      {/* Logo */}
      <div className="px-5 py-6 border-b" style={{ borderColor: "var(--app-border)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{
              backgroundColor: "var(--app-accent)",
              boxShadow: "0 0 20px var(--app-accent-soft)",
            }}
          >
            <Zap className="w-5 h-5 text-black fill-current" />
          </div>
          <div>
            <div className="font-black tracking-tighter text-sm" style={{ color: "var(--app-text)" }}>METIC LAB</div>
            <div className="text-[9px] font-black tracking-widest" style={{ color: "var(--app-text-muted)" }}>ELITE PERFORMANCE</div>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="px-3 py-4 flex flex-col gap-1">
        {menuItems.map((item, idx) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={`${item.id}-${idx}`}
              onClick={() => onViewChange(item.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all relative"
              style={{
                backgroundColor: isActive ? "var(--app-accent-soft)" : "transparent",
                color: isActive ? "var(--app-accent)" : "var(--app-text-dim)",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "var(--app-text)";
                  e.currentTarget.style.backgroundColor = "var(--app-input-bg)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "var(--app-text-dim)";
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              {isActive && (
                <div
                  className="absolute left-0 w-1 h-5 rounded-r-full"
                  style={{ backgroundColor: "var(--app-accent)" }}
                />
              )}
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="text-xs font-black tracking-wider">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Sensors */}
      <div className="px-5 py-4 border-t" style={{ borderColor: "var(--app-border)" }}>
        <div
          className="text-[9px] font-black tracking-widest mb-3 flex items-center gap-2"
          style={{ color: "var(--app-text-muted)" }}
        >
          <Wifi className="w-3 h-3" />
          {t("sidebar.serverWatch").toUpperCase()}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: "var(--app-text)" }}>Garmin Watch</span>
            <span
              className="text-[9px] font-black px-2 py-0.5 rounded-full"
              style={{
                color: "var(--app-accent)",
                backgroundColor: "var(--app-accent-soft)",
              }}
            >
              {t("sidebar.connected").toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="px-3 pb-4 border-t pt-4 space-y-1" style={{ borderColor: "var(--app-border)" }}>
        <button
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all"
          style={{ color: "var(--app-text-dim)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--app-text)";
            e.currentTarget.style.backgroundColor = "var(--app-input-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--app-text-dim)";
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <HelpCircle className="w-4 h-4 shrink-0" />
          <span className="text-xs font-black tracking-wider">{t("nav.support").toUpperCase()}</span>
        </button>
        <button
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all"
          style={{ color: "var(--app-text-dim)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#F43F5E";
            e.currentTarget.style.backgroundColor = "rgba(244,63,94,0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--app-text-dim)";
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="text-xs font-black tracking-wider">SIGN OUT</span>
        </button>
        <button
          className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs tracking-widest transition-all"
          style={{
            backgroundColor: "var(--app-accent)",
            color: "#000",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.1)")}
          onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          {t("sidebar.startSession").toUpperCase()}
        </button>
      </div>
    </aside>
  );
}
