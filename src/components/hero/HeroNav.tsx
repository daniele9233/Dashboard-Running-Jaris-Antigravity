import { useEffect, useRef } from "react";
import { Magnetic } from "./Magnetic";
import { Monogram } from "./HeroGlyphs";
import { HERO_BRAND, HERO_NAV } from "./heroContent";

interface Props {
  onNavigate: (to: string) => void;
  reduced: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** mm:ss.t — a race clock started the moment the page opened. */
const formatElapsed = (ms: number) => {
  const tenths = Math.floor(ms / 100);
  const s = Math.floor(tenths / 10);
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}.${tenths % 10}`;
};

export function HeroNav({ onNavigate, reduced }: Props) {
  const clockRef = useRef<HTMLSpanElement>(null);

  // Ticks straight into the DOM: a running clock is not a reason to re-render.
  useEffect(() => {
    const start = performance.now();
    const tick = () => {
      if (clockRef.current) clockRef.current.textContent = formatElapsed(performance.now() - start);
    };
    tick();
    const id = window.setInterval(tick, reduced ? 1000 : 100);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <header className="hn-root">
      <div className="hn-item hn-brand">
        <Monogram className="hn-mono" />
        <span className="hn-brand-text">
          <span>{HERO_BRAND.name}</span>
          <span className="hn-dim">{HERO_BRAND.sub}</span>
        </span>
      </div>

      <nav className="hn-links" aria-label="Entra nel lab da">
        {HERO_NAV.map((item, i) => (
          <div className="hn-item" key={item.to}>
            <Magnetic strength={0.28} innerStrength={0.12} disabled={reduced}>
              <button type="button" className="hn-link" onClick={() => onNavigate(item.to)}>
                <span className="hn-num">0{i + 1}</span>
                <span className="hn-roll" data-text={item.label}>
                  <span>{item.label}</span>
                </span>
              </button>
            </Magnetic>
          </div>
        ))}
      </nav>

      <div className="hn-item hn-clock" aria-hidden="true">
        <span className="hn-dot" />
        <span className="hn-dim">{HERO_BRAND.clock}</span>
        <span ref={clockRef} className="hn-time" />
      </div>
    </header>
  );
}
