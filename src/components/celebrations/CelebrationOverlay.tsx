import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { gsap, useGSAP, SplitText, prefersReducedMotion } from "./gsapSetup";
import type { CelebrationDef } from "./celebrationRegistry";
import { RiveLayer } from "./RiveLayer";

const MONO = "'JetBrains Mono', monospace";

/**
 * Overlay di celebrazione full-screen (portal su body).
 *
 * Chrome comune orchestrato con GSAP: backdrop con vignetta, chip categoria,
 * counter del valore con count-up snappato al formato, titolo kinetic via
 * SplitText (mask chars), hint di chiusura. La scena specifica del traguardo
 * gira nel riquadro centrale con la sua timeline. Chiusura: click ovunque o
 * ESC, con timeline di uscita. Replay: pulsante dedicato (rimonta la scena).
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
  const valueRef = useRef<HTMLDivElement>(null);
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
    const tl = gsap.timeline();

    tl.from(".cb-backdrop", { opacity: 0, duration: 0.35, ease: "power1.out" }, 0)
      .from(".cb-panel", { opacity: 0, y: 18, scale: 0.97, duration: 0.5, ease: "power3.out" }, 0.08)
      .from(".cb-chip", { opacity: 0, y: -14, duration: 0.4, ease: "power3.out" }, 0.25);

    // Titolo: SplitText con mask per char — reveal dal basso
    const titleEl = rootRef.current?.querySelector(".cb-title");
    if (titleEl) {
      const split = SplitText.create(titleEl, { type: "chars", mask: "chars" });
      tl.from(split.chars, {
        yPercent: 120, opacity: 0, duration: 0.55, stagger: 0.03, ease: "power3.out",
      }, 0.5);
    }

    // Counter: count-up con formato del traguardo
    if (!def.hideValue && valueRef.current) {
      const el = valueRef.current;
      const proxy = { v: 0 };
      el.textContent = def.format(0);
      tl.to(proxy, {
        v: def.value,
        duration: 1.5,
        ease: "power2.out",
        onUpdate: () => { el.textContent = def.format(proxy.v); },
      }, 0.6)
        .from(el, { scale: 0.85, transformOrigin: "center", duration: 0.4, ease: "back.out(1.6)" }, 0.6);
    }

    tl.from(".cb-hint", { opacity: 0, duration: 0.6 }, 2.2);

    if (prefersReducedMotion()) tl.progress(1);
  }, { scope: rootRef, dependencies: [runId, def.id] });

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

      <div
        className="cb-panel relative w-[min(94vw,560px)] px-6 pt-8 pb-7 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Chip categoria */}
        <div className="cb-chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-5"
          style={{ borderColor: `${def.accent}44`, background: `${def.accent}12` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: def.accent }} />
          <span className="text-[10px] font-black tracking-[0.3em] uppercase" style={{ color: def.accent }}>
            {def.category}
          </span>
        </div>

        {/* Scena — eventuale layer Rive dietro, scena GSAP davanti */}
        <div key={`${def.id}-${runId}`} className="relative h-[250px] mb-4">
          {def.riv && (
            <RiveLayer src={def.riv.src} stateMachine={def.riv.stateMachine}
              className="absolute inset-0 w-full h-full" />
          )}
          <def.Scene accent={def.accent} accent2={def.accent2} />
        </div>

        {/* Valore */}
        {!def.hideValue && (
          <div ref={valueRef} className="text-white mb-1 tabular-nums"
            style={{ fontFamily: MONO, fontSize: 52, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 }} />
        )}

        {/* Titolo kinetic */}
        <h2 className="cb-title text-white text-2xl md:text-[28px] font-black tracking-tight uppercase italic">
          {def.title}
        </h2>

        {/* Azioni */}
        <div className="cb-hint mt-6 flex items-center justify-center gap-4">
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
      </div>
    </div>,
    document.body,
  );
}
