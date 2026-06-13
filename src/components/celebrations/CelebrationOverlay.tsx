import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { gsap, useGSAP, prefersReducedMotion } from "./gsapSetup";
import type { CelebrationDef } from "./celebrationRegistry";
import { CelebrationContent } from "./CelebrationContent";

/**
 * Overlay di celebrazione full-screen (portal su body) per UN traguardo.
 *
 * Backdrop con vignetta + CelebrationContent (chip · scena · counter · titolo).
 * Chiusura: click ovunque o ESC, con timeline di uscita. Replay: pulsante
 * dedicato (rimonta la scena via runId).
 */
export function CelebrationOverlay({
  def,
  runId,
  onReplay,
  onClose,
}: {
  def: CelebrationDef;
  runId: number;
  onReplay: () => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);

  const close = useCallback(() => {
    if (closingRef.current || !rootRef.current) return;
    closingRef.current = true;
    gsap.to(rootRef.current, {
      opacity: 0,
      scale: 0.985,
      duration: prefersReducedMotion() ? 0 : 0.3,
      ease: "power2.in",
      onComplete: onClose,
    });
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useGSAP(() => {
    gsap.from(".cb-backdrop", { opacity: 0, duration: 0.35, ease: "power1.out" });
  }, { scope: rootRef, dependencies: [runId] });

  return createPortal(
    <div
      ref={rootRef}
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={`Celebrazione: ${def.title}`}
    >
      {/* niente backdrop-filter: un blur full-screen durante l'animazione
          costa un compositing layer enorme e fa scattare la timeline */}
      <div className="cb-backdrop absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, rgba(8,8,8,0.93) 0%, rgba(0,0,0,0.985) 75%)" }} />

      <div onClick={(e) => e.stopPropagation()}>
        <CelebrationContent
          def={def}
          runId={runId}
          footer={
            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={onReplay}
                className="px-4 py-2 rounded-xl border text-[10px] font-black tracking-[0.25em] uppercase transition-colors"
                style={{ borderColor: `${def.accent}55`, color: def.accent }}
              >
                ↻ Rivedi
              </button>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-600">
                clicca fuori o ESC per chiudere
              </span>
            </div>
          }
        />
      </div>
    </div>,
    document.body,
  );
}
