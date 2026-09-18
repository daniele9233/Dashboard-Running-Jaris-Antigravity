import { Zap, Wifi, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useNavItems, isNavActive } from "../navigation";

/**
 * Sidebar — logo, destinazioni (nel drawer) e stato dei sensori.
 *
 * Desktop ≥ 1024px: colonna fissa da 220px; la navigazione sta nella barra in
 * alto, dove c'è spazio per tutte e dieci le voci.
 *
 * Sotto i 1024px: drawer. Prima scattava solo sotto i 768px, così sul tablet la
 * colonna fissa si mangiava 220px, i widget della dashboard finivano tagliati a
 * metà numero e sei voci di navigazione uscivano dal bordo. E il drawer stesso
 * non conteneva la navigazione: si apriva su un logo. Adesso è il primo posto
 * dove cercarla, ed è lì.
 */
const DRAWER_QUERY = "(max-width: 1023px)";

export function Sidebar() {
  const { t } = useTranslation();
  const navItems = useNavItems();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDrawer, setIsDrawer] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(DRAWER_QUERY).matches : false,
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(DRAWER_QUERY);
    const onChange = () => setIsDrawer(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open]);

  // cambiare pagina chiude il drawer: è quello che ci si aspetta da un menu
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const brand = (
    <div className="px-5 py-6 border-b flex items-center justify-between" style={{ borderColor: "var(--app-border)" }}>
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-brand"
          style={{ boxShadow: "0 0 20px var(--app-accent-soft)" }}
        >
          <Zap className="w-5 h-5 text-black fill-current" />
        </div>
        <div>
          <div className="font-black tracking-tighter text-sm" style={{ color: "var(--app-text)" }}>METIC LAB</div>
          <div className="text-[10px] font-black tracking-widest" style={{ color: "var(--app-text-muted)" }}>ELITE PERFORMANCE</div>
        </div>
      </div>
      {isDrawer && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Chiudi menu"
          className="p-2 rounded-lg hover:bg-white/5 min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <X className="w-4 h-4" style={{ color: "var(--app-text)" }} />
        </button>
      )}
    </div>
  );

  const sensors = (
    <div className="px-5 py-4 border-t" style={{ borderColor: "var(--app-border)" }}>
      <div
        className="text-[10px] font-black tracking-widest mb-3 flex items-center gap-2"
        style={{ color: "var(--app-text-muted)" }}
      >
        <Wifi className="w-3 h-3" />
        {t("sidebar.serverWatch").toUpperCase()}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: "var(--app-text)" }}>Garmin Watch</span>
        <span
          className="text-[10px] font-black px-2 py-0.5 rounded-full"
          style={{ color: "var(--app-text-muted)", backgroundColor: "var(--app-input-bg)" }}
        >
          N/A
        </span>
      </div>
    </div>
  );

  // Drawer: hamburger + pannello con le destinazioni
  if (isDrawer) {
    return (
      <>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Apri menu"
            aria-expanded={false}
            className="fixed top-3 left-3 z-50 p-3 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
            style={{
              backgroundColor: "var(--app-bg-alt)",
              border: "1px solid var(--app-border)",
              color: "var(--app-text)",
            }}
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/70"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside
          className={`fixed top-0 left-0 bottom-0 z-50 w-[280px] border-r flex flex-col transform transition-transform duration-200 ease-out ${open ? "translate-x-0" : "-translate-x-full"}`}
          style={{ backgroundColor: "var(--app-bg-alt)", borderColor: "var(--app-border)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          aria-hidden={!open}
          inert={!open}
        >
          {brand}
          <nav className="flex-1 overflow-y-auto py-3" aria-label="Navigazione principale">
            {navItems.map((item) => {
              const active = isNavActive(location.pathname, item.path);
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  aria-current={active ? "page" : undefined}
                  className={`w-full text-left px-5 min-h-[46px] flex items-center gap-3 text-[12px] font-black tracking-[0.14em] transition-colors ${
                    active ? "text-brand bg-white/[0.04]" : "text-gray-400 hover:text-white hover:bg-white/[0.03]"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "bg-brand" : "bg-gray-700"}`}
                    aria-hidden
                  />
                  {item.label}
                </button>
              );
            })}
          </nav>
          {sensors}
        </aside>
      </>
    );
  }

  // Desktop: colonna fissa
  return (
    <aside
      className="w-[220px] border-r flex flex-col h-full z-50 shrink-0"
      style={{ backgroundColor: "var(--app-bg-alt)", borderColor: "var(--app-border)" }}
    >
      {brand}
      {sensors}
      <div className="flex-1" />
    </aside>
  );
}
