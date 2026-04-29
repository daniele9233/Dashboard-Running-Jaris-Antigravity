import { Zap, Wifi } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Sidebar — logo + sensor status.
 *
 * Navigation between views lives in the TopBar (App.tsx) only — TopBar è
 * single source of truth per il nav.
 *
 * I bottoni "Support / Sign Out / Start Session" sono stati rimossi (round 4):
 * erano disabled coming-soon; senza auth "Sign Out" non ha senso, e "Start
 * Session" non ha funzionalità reale. Quando arriverà l'auth, mettere user
 * menu + sign out nell'avatar dropdown della TopBar.
 */
export function Sidebar() {
  const { t } = useTranslation();

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
              style={{ color: "var(--app-text-muted)", backgroundColor: "var(--app-input-bg)" }}
            >
              N/A
            </span>
          </div>
        </div>
      </div>

      {/* Spacer to push any future content to the bottom */}
      <div className="flex-1" />
    </aside>
  );
}
