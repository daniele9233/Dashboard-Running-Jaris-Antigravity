import { useRef, type ReactNode } from "react";
import { gsap, useGSAP, SplitText, prefersReducedMotion } from "./gsapSetup";
import type { CelebrationDef } from "./celebrationRegistry";
import { RiveLayer } from "./RiveLayer";

const MONO = "'JetBrains Mono', monospace";

/**
 * Contenuto di una celebrazione (chip categoria · scena GSAP · contatore ·
 * titolo kinetic), senza backdrop né portale. Estratto da CelebrationOverlay
 * così che sia l'overlay singolo sia il player sequenziale (sblocco multiplo)
 * mostrino esattamente la stessa cosa. L'entrata (pannello, chip, titolo via
 * SplitText, count-up) è qui dentro; il backdrop lo gestisce il contenitore.
 *
 * `footer` opzionale: azioni/hint sotto il titolo (animati come .cb-foot).
 */
export function CelebrationContent({
  def,
  runId,
  footer,
}: {
  def: CelebrationDef;
  runId: number;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(ref.current, { opacity: 0, y: 18, scale: 0.97, duration: 0.5, ease: "power3.out" }, 0)
      .from(".cb-chip", { opacity: 0, y: -14, duration: 0.4, ease: "power3.out" }, 0.2);

    const titleEl = ref.current?.querySelector(".cb-title");
    if (titleEl) {
      const split = SplitText.create(titleEl, { type: "chars", mask: "chars" });
      tl.from(split.chars, { yPercent: 120, opacity: 0, duration: 0.55, stagger: 0.03, ease: "power3.out" }, 0.45);
    }

    if (!def.hideValue && valueRef.current) {
      const el = valueRef.current;
      const proxy = { v: 0 };
      el.textContent = def.format(0);
      tl.to(proxy, {
        v: def.value,
        duration: 1.5,
        ease: "power2.out",
        onUpdate: () => { el.textContent = def.format(proxy.v); },
      }, 0.55)
        .from(el, { scale: 0.85, transformOrigin: "center", duration: 0.4, ease: "back.out(1.6)" }, 0.55);
    }

    if (footer) tl.from(".cb-foot", { opacity: 0, duration: 0.5 }, 1.7);

    if (prefersReducedMotion()) tl.progress(1);
  }, { scope: ref, dependencies: [runId, def.id] });

  return (
    <div ref={ref} className="cb-panel relative w-[min(94vw,560px)] px-6 pt-8 pb-7 text-center">
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

      {footer && <div className="cb-foot">{footer}</div>}
    </div>
  );
}
