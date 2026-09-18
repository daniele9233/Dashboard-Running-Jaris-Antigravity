import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap, useGSAP, prefersReducedMotion } from "./gsapSetup";
import type { CelebrationDef } from "./celebrationRegistry";
import { CelebrationContent } from "./CelebrationContent";

const MONO = "'JetBrains Mono', monospace";
const AUTO_MS = 4500; // tempo a schermo di ogni celebrazione prima dell'auto-avanzamento

/**
 * Player SEQUENZIALE per lo sblocco simultaneo: quando una corsa fa scattare
 * più traguardi, ognuno prende tutto lo schermo come una celebrazione singola,
 * poi si passa AUTOMATICAMENTE al successivo (tante quante sono i badge).
 *
 * - Backdrop persistente (niente flicker tra una e l'altra).
 * - Indicatore "i / n" + puntini di avanzamento.
 * - Auto-avanzamento dopo AUTO_MS; sull'ultimo resta fermo.
 * - Tap/click ovunque = salta alla prossima (sull'ultimo: chiude). ESC = chiude.
 * - Crossfade: il pannello corrente sfuma in uscita, il successivo entra con la
 *   sua animazione completa (riuso di CelebrationContent).
 * - prefers-reduced-motion: nessuna animazione di transizione, swap immediato.
 *
 * I `defs` vanno passati già ordinati (dalla più importante alla meno).
 */
export function MultiCelebrationOverlay({
  defs,
  runId,
  onClose,
}: {
  defs: CelebrationDef[];
  runId: number;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const advancingRef = useRef(false);
  const [index, setIndex] = useState(0);

  const n = defs.length;
  const isLast = index >= n - 1;

  // Reset all'avvio di una nuova sequenza
  useEffect(() => {
    setIndex(0);
    closingRef.current = false;
    advancingRef.current = false;
  }, [runId]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const rm = prefersReducedMotion();
    // Dissolvenza cosmetica; la chiusura è garantita dal timer (no dipendenza rAF).
    if (rootRef.current && !rm) {
      gsap.to(rootRef.current, { opacity: 0, scale: 0.985, duration: 0.3, ease: "power2.in" });
    }
    window.setTimeout(onClose, rm ? 0 : 300);
  }, [onClose]);

  const advance = useCallback(() => {
    if (closingRef.current || advancingRef.current) return;
    if (index >= n - 1) { close(); return; }
    advancingRef.current = true;
    const rm = prefersReducedMotion();
    // Dissolvenza in uscita: solo cosmetica (non guida lo stato).
    const panel = rootRef.current?.querySelector(".cb-panel");
    if (panel && !rm) {
      gsap.to(panel, { opacity: 0, y: -14, duration: 0.28, ease: "power2.in" });
    }
    // L'avanzamento è garantito da un timer, indipendente da rAF/GSAP.
    window.setTimeout(() => {
      setIndex((i) => Math.min(i + 1, n - 1));
      advancingRef.current = false;
    }, rm ? 0 : 280);
  }, [index, n, close]);

  // ESC chiude tutto
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // Auto-avanzamento per ciascun traguardo; sull'ultimo resta fermo
  useEffect(() => {
    if (isLast) return;
    const t = window.setTimeout(advance, AUTO_MS);
    return () => clearTimeout(t);
  }, [index, runId, isLast, advance]);

  // Backdrop fade-in una volta sola per sequenza
  useGSAP(() => {
    gsap.from(".sq-backdrop", { opacity: 0, duration: 0.35, ease: "power1.out" });
  }, { scope: rootRef, dependencies: [runId] });

  // Pop del puntino attivo a ogni cambio
  useGSAP(() => {
    gsap.fromTo(".sq-dot-active", { scale: 0.5 }, { scale: 1, duration: 0.3, ease: "back.out(2.2)" });
  }, { scope: rootRef, dependencies: [index] });

  const cur = defs[index];
  if (!cur) return null;

  return createPortal(
    <div
      ref={rootRef}
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      onClick={advance}
      role="dialog"
      aria-modal="true"
      aria-label={`Traguardo ${index + 1} di ${n}: ${cur.title}`}
    >
      <div className="sq-backdrop absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, rgba(8,8,8,0.93) 0%, rgba(0,0,0,0.985) 75%)" }} />

      {/* Avanzamento: contatore + puntini */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2.5 pointer-events-none z-10">
        <div className="text-[10px] font-black tracking-[0.42em] uppercase text-gray-500"
          style={{ fontFamily: MONO }}>
          {index + 1} / {n}
        </div>
        <div className="flex items-center gap-1.5">
          {defs.map((d, i) => (
            <span
              key={d.id}
              className={i === index ? "sq-dot-active" : ""}
              style={{
                width: i === index ? 22 : 8,
                height: 8,
                borderRadius: 99,
                background: i <= index ? d.accent : "#3F3F46",
                transition: "width .3s ease, background .3s ease",
              }}
            />
          ))}
        </div>
      </div>

      {/* Celebrazione corrente a schermo intero (stessa chrome delle singole) */}
      <CelebrationContent
        key={index}
        def={cur}
        runId={index}
        footer={
          <div className="mt-6 text-[10px] font-bold tracking-[0.2em] uppercase text-gray-600">
            {isLast ? "tocca o ESC per chiudere" : "tocca per la prossima · ESC per chiudere"}
          </div>
        }
      />
    </div>,
    document.body,
  );
}
