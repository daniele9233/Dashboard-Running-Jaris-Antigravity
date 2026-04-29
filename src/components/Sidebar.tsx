import { Zap, Wifi, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Sidebar — logo + sensor status.
 *
 * Desktop ≥ 768px: sempre visibile, w=220px.
 * Mobile < 768px: drawer pattern (#22 round 6) — hamburger button top-left,
 * overlay che apre/chiude la sidebar. Click su backdrop o link la chiude.
 *
 * Navigation tra view sta nella TopBar (App.tsx) — TopBar è single source of
 * truth per nav.
 */
export function Sidebar() {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false,
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Auto-close drawer on route change (rough heuristic — chiudere al click backdrop)
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open]);

  const sidebarBody = (
    <>
      {/* Logo */}
      <div className="px-5 py-6 border-b flex items-center justify-between" style={{ borderColor: "var(--app-border)" }}>
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
        {isMobile && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Chiudi menu"
            className="p-2 rounded-lg hover:bg-white/5"
          >
            <X className="w-4 h-4" style={{ color: "var(--app-text)" }} />
          </button>
        )}
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
    </>
  );

  // Mobile: hamburger + drawer overlay
  if (isMobile) {
    return (
      <>
        {/* Hamburger (mostrato quando drawer chiuso) */}
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Apri menu"
            className="fixed top-3 left-3 z-50 p-2 rounded-lg backdrop-blur"
            style={{
              backgroundColor: "var(--app-bg-alt)",
              border: "1px solid var(--app-border)",
              color: "var(--app-text)",
            }}
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Backdrop */}
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Drawer */}
        <aside
          className={`fixed top-0 left-0 bottom-0 z-50 w-[260px] border-r flex flex-col transform transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"}`}
          style={{
            backgroundColor: "var(--app-bg-alt)",
            borderColor: "var(--app-border)",
          }}
          role="dialog"
          aria-label="Menu laterale"
          aria-hidden={!open}
        >
          {sidebarBody}
        </aside>
      </>
    );
  }

  // Desktop: sidebar fissa
  return (
    <aside
      className="w-[220px] border-r flex flex-col h-full z-50 shrink-0"
      style={{
        backgroundColor: "var(--app-bg-alt)",
        borderColor: "var(--app-border)",
      }}
    >
      {sidebarBody}
    </aside>
  );
}
