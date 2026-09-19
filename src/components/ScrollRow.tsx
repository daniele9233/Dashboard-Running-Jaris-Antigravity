import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * ScrollRow — una riga che scorre in orizzontale e lo fa vedere.
 *
 * La barra di scorrimento è nascosta per pulizia (`scrollbar-hide`), ma senza
 * di lei, con un mouse normale, una riga più larga dello schermo non si scorre:
 * la rotella va in verticale e le voci oltre il bordo semplicemente non
 * esistono. Qui ci sono due frecce ai lati, che compaiono solo quando da quella
 * parte c'è davvero altro, e una sfumatura che fa capire che la riga continua.
 *
 * Gli elementi figli che portano `data-scroll-key` possono essere tenuti in
 * vista: passando `activeKey`, la voce attiva viene riportata dentro la riga
 * quando cambia (anche se l'hai scelta da un'altra parte della pagina).
 */
export function ScrollRow({
  children,
  className = "",
  innerClassName = "",
  fade = "#0D0D0D",
  activeKey,
  label,
}: {
  children: ReactNode;
  /** Classi del contenitore esterno: sfondo, bordo, arrotondamento. */
  className?: string;
  /** Classi della riga che scorre: flex, gap, padding. */
  innerClassName?: string;
  /** Colore dello sfondo, per la sfumatura ai bordi. */
  fade?: string;
  /** La voce da tenere in vista (confrontata con `data-scroll-key` dei figli). */
  activeKey?: string;
  /** Nome della riga per chi usa un lettore di schermo. */
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const count = Children.count(children);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    // la larghezza delle voci cambia anche senza che cambi la riga: font che
    // arrivano tardi, etichette tradotte
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    Array.from(el.children).forEach((c) => ro?.observe(c));
    document.fonts?.ready.then(measure).catch(() => {});
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [measure, count]);

  // la voce attiva sempre dentro la riga, con un po' d'aria per la freccia
  useEffect(() => {
    const el = ref.current;
    if (!el || activeKey == null) return;
    const item = Array.from(el.querySelectorAll<HTMLElement>("[data-scroll-key]"))
      .find((n) => n.dataset.scrollKey === activeKey);
    if (!item) return;
    const pad = 52;
    const start = item.offsetLeft - pad;
    const end = item.offsetLeft + item.offsetWidth + pad;
    if (start < el.scrollLeft) el.scrollTo({ left: Math.max(0, start), behavior: "smooth" });
    else if (end > el.scrollLeft + el.clientWidth) el.scrollTo({ left: end - el.clientWidth, behavior: "smooth" });
  }, [activeKey]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(140, el.clientWidth * 0.7), behavior: "smooth" });
  };

  const arrow = (side: "left" | "right") => {
    const on = edges[side];
    const Icon = side === "left" ? ChevronLeft : ChevronRight;
    return (
      <>
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 ${side === "left" ? "left-0" : "right-0"} w-16 z-10 transition-opacity duration-200`}
          style={{
            opacity: on ? 1 : 0,
            background: `linear-gradient(${side === "left" ? "90deg" : "270deg"}, ${fade} 40%, transparent)`,
          }}
        />
        <button
          type="button"
          onClick={() => page(side === "left" ? -1 : 1)}
          tabIndex={on ? 0 : -1}
          aria-hidden={!on}
          aria-label={side === "left" ? "Scorri a sinistra" : "Scorri a destra"}
          title={side === "left" ? "Scorri a sinistra" : "Scorri a destra"}
          className={`absolute top-1/2 -translate-y-1/2 ${side === "left" ? "left-1.5" : "right-1.5"} z-20 w-9 h-9 rounded-xl
            flex items-center justify-center bg-[#1A1A1A] border border-[#2A2A2A] text-[#C0FF00] shadow-lg
            hover:bg-[#222] hover:border-[#C0FF00]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C0FF00]/60
            transition-[opacity,background-color,border-color] duration-200 ${on ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <Icon className="w-4 h-4" />
        </button>
      </>
    );
  };

  return (
    <div className={`relative min-w-0 overflow-hidden ${className}`}>
      <div ref={ref} role="group" aria-label={label} className={`relative overflow-x-auto scrollbar-hide ${innerClassName}`}>
        {children}
      </div>
      {arrow("left")}
      {arrow("right")}
    </div>
  );
}
