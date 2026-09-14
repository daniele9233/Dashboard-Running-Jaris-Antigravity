import { useEffect, useRef } from "react";
import gsap from "gsap";
import { SparkGlyph } from "./HeroGlyphs";
import { HERO_MARQUEE } from "./heroContent";

/** px per second — slow enough to read, fast enough to feel alive. */
const SPEED = 64;

/**
 * Full-bleed ticker. The track holds two identical halves and slides by exactly
 * one half, so the wrap point is pixel-identical to the start: no jump.
 * Each half repeats the item list enough times to be wider than the screen.
 */
export function Marquee({ reduced }: { reduced: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || reduced) return;

    let tween: gsap.core.Tween | null = null;
    const build = () => {
      const progress = tween?.progress() ?? 0;
      tween?.kill();
      gsap.set(track, { xPercent: 0 });
      const half = track.scrollWidth / 2;
      tween = gsap.to(track, {
        xPercent: -50,
        duration: half / SPEED,
        ease: "none",
        repeat: -1,
      });
      tween.progress(progress);
    };

    build();
    const ro = new ResizeObserver(() => build());
    ro.observe(track);

    const root = track.parentElement!;
    const slow = () => tween && gsap.to(tween, { timeScale: 0.25, duration: 0.6, ease: "power2.out", overwrite: true });
    const resume = () => tween && gsap.to(tween, { timeScale: 1, duration: 0.9, ease: "power2.inOut", overwrite: true });
    root.addEventListener("pointerenter", slow);
    root.addEventListener("pointerleave", resume);

    return () => {
      ro.disconnect();
      root.removeEventListener("pointerenter", slow);
      root.removeEventListener("pointerleave", resume);
      tween?.kill();
    };
  }, [reduced]);

  const half = (key: string) => (
    <div className="hm-half" key={key}>
      {[0, 1].map((rep) =>
        HERO_MARQUEE.map((item, i) => (
          <span className="hm-item" key={`${rep}-${i}`}>
            <span className={`hm-text hm-${item.style}`}>{item.text}</span>
            <SparkGlyph className="hm-spark" />
          </span>
        )),
      )}
    </div>
  );

  return (
    <div className="hm-root" aria-hidden="true">
      <div className="hm-track" ref={trackRef}>
        {half("a")}
        {half("b")}
      </div>
    </div>
  );
}
