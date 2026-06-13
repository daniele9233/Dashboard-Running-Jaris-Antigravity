import { useRef } from "react";
import { gsap, useGSAP } from "./gsapSetup";
import { MONO, finish, type SceneProps } from "./sceneUtils";

/**
 * Scene VELOCITÀ aggiuntive (10) — record di passo, sprint, ripetute e barriere
 * di pace. Stesso linguaggio delle scene base: SVG 400×240, stroke-iconografia,
 * timeline GSAP dedicata, nessuna emoji.
 */

/* 1 · SUB-4 — 1000 m sotto i 4:00/km. Il marker cala oltre la barriera 4:00. */
export function SubFourScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.fromTo(".sf-barrier", { drawSVG: "50% 50%" }, { drawSVG: "0% 100%", duration: 0.55, ease: "power2.inOut" })
      .from(".sf-blabel", { opacity: 0, x: -8, duration: 0.3 }, "-=0.2")
      .fromTo(".sf-marker", { y: -92, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "power3.in" })
      .fromTo(".sf-flash", { scale: 0.4, opacity: 0.9, transformOrigin: "center" }, { scale: 2.5, opacity: 0, duration: 0.7, ease: "power2.out" }, "-=0.08")
      .from(".sf-tick", { scaleY: 0, transformOrigin: "center bottom", stagger: 0.035, duration: 0.25 }, "-=0.5")
      .fromTo(".sf-time", { scale: 1.7, opacity: 0, transformOrigin: "center" }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.6)" }, "-=0.3");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} className="sf-tick" x={120 + i * 20} y="196" width="6" height={8 + (i % 3) * 8} rx="3" fill={i % 2 ? accent : accent2} opacity="0.7" />
        ))}
        <line className="sf-barrier" x1="80" y1="118" x2="300" y2="118" stroke="#52525B" strokeWidth="2.5" strokeDasharray="6 6" strokeLinecap="round" />
        <text className="sf-blabel" x="306" y="122" fill="#52525B" style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>4:00</text>
        <circle className="sf-flash" cx="200" cy="118" r="20" stroke={accent} strokeWidth="2.5" />
        <g className="sf-marker">
          <line x1="200" y1="58" x2="200" y2="116" stroke={accent2} strokeWidth="2" strokeDasharray="3 4" />
          <circle cx="200" cy="118" r="8" fill={accent} />
        </g>
        <text className="sf-time" x="200" y="178" textAnchor="middle" fill="white" style={{ fontFamily: MONO, fontSize: 42, fontWeight: 800 }}>3:54</text>
        <text x="200" y="200" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: "0.32em" }}>/ KM</text>
      </svg>
    </div>
  );
}

/* 2 · URBAN LIMIT — 25 km/h. Cartello di velocità che si accende, scie. */
export function UrbanLimitScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".ul-streak", { xPercent: -160, opacity: 0 }, { xPercent: 160, opacity: 0.6, duration: 0.6, stagger: 0.07, ease: "power2.in" })
      .to(".ul-streak", { opacity: 0.12, duration: 0.4 }, "-=0.15")
      .fromTo(".ul-ring", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.8, ease: "power2.inOut" }, 0.2)
      .from(".ul-num", { scale: 0, transformOrigin: "center", duration: 0.45, ease: "back.out(2)" }, "-=0.35")
      .from(".ul-unit", { opacity: 0, y: 8, duration: 0.3 }, "-=0.15")
      .fromTo(".ul-glow", { opacity: 0 }, { opacity: 1, duration: 0.4, yoyo: true, repeat: 1, ease: "sine.inOut" }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="relative w-full h-full overflow-hidden flex items-center justify-center">
      {[40, 80, 160, 200].map((top, i) => (
        <div key={i} className="ul-streak absolute h-[3px] w-1/2 rounded-full" style={{ top, left: "8%", background: i % 2 ? accent2 : accent }} />
      ))}
      <svg viewBox="0 0 400 240" className="w-full h-full absolute inset-0" fill="none">
        <circle className="ul-glow" cx="200" cy="120" r="62" fill={accent} opacity="0" style={{ filter: "blur(14px)" }} />
        <circle cx="200" cy="120" r="58" fill="#0C0C0C" stroke="#1F1F1F" strokeWidth="2" />
        <circle className="ul-ring" cx="200" cy="120" r="58" stroke={accent} strokeWidth="7" strokeLinecap="round" />
        <text className="ul-num" x="200" y="132" textAnchor="middle" fill="white" style={{ fontFamily: MONO, fontSize: 50, fontWeight: 800 }}>25</text>
        <text className="ul-unit" x="200" y="186" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, letterSpacing: "0.28em" }}>KM / H</text>
      </svg>
    </div>
  );
}

/* 3 · LOCOMOTIVE — 18 km/h tenuti 2 min. Ruota motrice + vapore + piastra. */
export function LocomotiveScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".lo-rail", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.6, ease: "power2.out", stagger: 0.1 })
      .fromTo(".lo-wheel", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.7, ease: "power2.inOut" }, "-=0.3")
      .to(".lo-spokes", { rotation: 540, transformOrigin: "center", duration: 2.2, ease: "power1.inOut" }, "-=0.3")
      .fromTo(".lo-steam", { y: 0, scale: 0.5, opacity: 0, transformOrigin: "center bottom" }, { y: -52, scale: 1.2, opacity: 0.7, duration: 1.2, stagger: 0.16, ease: "power1.out" }, "-=2")
      .to(".lo-steam", { opacity: 0, duration: 0.5, stagger: 0.16 }, "-=1")
      .fromTo(".lo-bar", { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: 1.4, ease: "none" }, "-=2")
      .from(".lo-plate", { opacity: 0, y: 10, duration: 0.4 }, "-=1.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {[2, -1].map((d, i) => (
          <circle key={i} className="lo-steam" cx={150 + i * 10} cy="86" r={6 + i * 2} fill={i % 2 ? accent : accent2} opacity="0" transform={`translate(${d} 0)`} />
        ))}
        <line className="lo-rail" x1="40" y1="178" x2="360" y2="178" stroke="#3F3F46" strokeWidth="3" strokeLinecap="round" />
        <line className="lo-rail" x1="40" y1="190" x2="360" y2="190" stroke="#27272A" strokeWidth="2" strokeLinecap="round" />
        <circle className="lo-wheel" cx="170" cy="150" r="30" stroke={accent} strokeWidth="4" />
        <g className="lo-spokes">
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return <line key={i} x1="170" y1="150" x2={170 + Math.cos(a) * 26} y2={150 + Math.sin(a) * 26} stroke={accent2} strokeWidth="2.5" strokeLinecap="round" />;
          })}
        </g>
        <circle cx="170" cy="150" r="5" fill={accent2} />
        <rect className="lo-bar" x="214" y="120" width="150" height="10" rx="5" fill={accent} opacity="0.85" />
        <text className="lo-plate" x="214" y="150" fill={accent} style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, letterSpacing: "0.1em" }}>18 km/h · 2:00</text>
      </svg>
    </div>
  );
}

/* 4 · DOUBLE-K — PB 2000 m. Due "1K" collidono in "2K". */
export function DoubleKScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.fromTo(".dk-tileL", { x: -150, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: "power3.in" })
      .fromTo(".dk-tileR", { x: 150, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: "power3.in" }, "<")
      .to(".dk-tileL, .dk-tileR", { opacity: 0, duration: 0.2 })
      .fromTo(".dk-flash", { scale: 0.3, opacity: 0.9, transformOrigin: "center" }, { scale: 2.6, opacity: 0, duration: 0.7, ease: "power2.out" }, "-=0.1")
      .from(".dk-merge", { scale: 0, transformOrigin: "center", duration: 0.5, ease: "back.out(2.2)" }, "-=0.55")
      .fromTo(".dk-bar", { scaleX: 0, transformOrigin: "center" }, { scaleX: 1, duration: 0.5, ease: "power2.inOut" }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  const tile = { fontFamily: MONO, fontSize: 44, fontWeight: 800 } as const;
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <circle className="dk-flash" cx="200" cy="112" r="22" stroke={accent} strokeWidth="2.5" />
        <text className="dk-tileL" x="160" y="126" textAnchor="middle" fill={accent2} style={tile}>1K</text>
        <text className="dk-tileR" x="240" y="126" textAnchor="middle" fill={accent2} style={tile}>1K</text>
        <text className="dk-merge" x="200" y="128" textAnchor="middle" fill="white" style={{ fontFamily: MONO, fontSize: 70, fontWeight: 800 }}>2K</text>
        <rect className="dk-bar" x="120" y="168" width="160" height="6" rx="3" fill={accent} />
      </svg>
    </div>
  );
}

/* 5 · MILE — PB miglio (1609 m ≈ 4 giri). Ovale + 4 lap-pip che si accendono. */
export function MileScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".mi-oval", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.1, ease: "power2.inOut" })
      .to(".mi-dot", { motionPath: { path: ".mi-oval", align: ".mi-oval", alignOrigin: [0.5, 0.5] }, duration: 1.4, ease: "power1.inOut" }, "-=0.9")
      .from(".mi-pip", { scale: 0, transformOrigin: "center", stagger: 0.12, duration: 0.3, ease: "back.out(2.5)" }, "-=1")
      .from(".mi-core", { scale: 0, transformOrigin: "center", duration: 0.45, ease: "back.out(1.8)" }, "-=0.4");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <path className="mi-oval" d="M 132 70 H 268 A 50 50 0 0 1 268 170 H 132 A 50 50 0 0 1 132 70 Z" stroke={accent} strokeWidth="3.5" strokeLinecap="round" />
        {[[132, 70], [268, 70], [268, 170], [132, 170]].map(([x, y], i) => (
          <circle key={i} className="mi-pip" cx={x} cy={y} r="6" fill={accent2} />
        ))}
        <circle className="mi-dot" cx="132" cy="70" r="7" fill="white" style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />
        <g className="mi-core">
          <circle cx="200" cy="120" r="30" fill="#0D0D0D" stroke={accent} strokeWidth="1.5" />
          <text x="200" y="116" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800 }}>MI</text>
          <text x="200" y="134" textAnchor="middle" fill="#71717A" style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700 }}>1609 m</text>
        </g>
      </svg>
    </div>
  );
}

/* 6 · EIGHT-HUNDRED — PB 800 m (2 giri). Due semi-archi + dot veloce. */
export function EightHundredScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".eh-lap", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.7, ease: "power2.inOut", stagger: 0.2 })
      .to(".eh-dot", { motionPath: { path: ".eh-track", align: ".eh-track", alignOrigin: [0.5, 0.5], start: 0, end: 2 }, duration: 1.6, ease: "power1.in" }, "-=0.6")
      .from(".eh-num", { scale: 0, transformOrigin: "center", duration: 0.45, ease: "back.out(2)" }, "-=0.5")
      .fromTo(".eh-spark", { scale: 0.4, opacity: 0.9, transformOrigin: "center" }, { scale: 2.2, opacity: 0, duration: 0.6, ease: "power2.out" }, "-=0.3");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <path className="eh-lap eh-track" d="M 200 56 A 64 64 0 0 1 200 184 A 64 64 0 0 1 200 56 Z" stroke={accent} strokeWidth="3.5" strokeLinecap="round" />
        <path className="eh-lap" d="M 200 84 A 36 36 0 0 1 200 156 A 36 36 0 0 1 200 84 Z" stroke={accent2} strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
        <circle className="eh-spark" cx="200" cy="56" r="14" stroke={accent2} strokeWidth="2" />
        <circle className="eh-dot" cx="200" cy="56" r="6.5" fill="white" style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />
        <text className="eh-num" x="200" y="130" textAnchor="middle" fill="white" style={{ fontFamily: MONO, fontSize: 36, fontWeight: 800 }}>800</text>
      </svg>
    </div>
  );
}

/* 7 · THREE-K — PB 3000 m. Tre colonne-lap che salgono, core 3K. */
export function ThreeKScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".tk-col", { scaleY: 0, transformOrigin: "center bottom", stagger: 0.14, duration: 0.5, ease: "power3.out" })
      .from(".tk-cap", { scale: 0, transformOrigin: "center", stagger: 0.14, duration: 0.3, ease: "back.out(2.5)" }, "-=0.7")
      .from(".tk-core", { scale: 0, transformOrigin: "center", duration: 0.45, ease: "back.out(1.8)" }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  const H = [60, 90, 124];
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <line x1="92" y1="186" x2="308" y2="186" stroke="#3F3F46" strokeWidth="2" />
        {H.map((h, i) => (
          <g key={i}>
            <rect className="tk-col" x={108 + i * 64} y={186 - h} width="34" height={h} rx="6" fill={i % 2 ? accent2 : accent} opacity={0.55 + i * 0.15} />
            <circle className="tk-cap" cx={125 + i * 64} cy={186 - h} r="5" fill="white" />
          </g>
        ))}
        <g className="tk-core">
          <circle cx="200" cy="96" r="26" fill="#0D0D0D" stroke={accent} strokeWidth="1.5" />
          <text x="200" y="104" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 20, fontWeight: 800 }}>3K</text>
        </g>
      </svg>
    </div>
  );
}

/* 8 · TEMPO — corsa a soglia più lunga. Banda T + plateau che si disegna. */
export function TempoWaveScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".tw-band", { scaleY: 0, transformOrigin: "center" }, { scaleY: 1, duration: 0.5, ease: "power2.out" })
      .fromTo(".tw-line", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.6, ease: "power1.inOut" }, "-=0.2")
      .to(".tw-head", { motionPath: { path: ".tw-line", align: ".tw-line", alignOrigin: [0.5, 0.5] }, duration: 1.6, ease: "power1.inOut" }, "<")
      .from(".tw-tag", { opacity: 0, x: -10, duration: 0.4 }, "-=0.5")
      .to(".tw-head", { opacity: 0, scale: 0.5, duration: 0.3 }, "-=0.1");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <rect className="tw-band" x="24" y="100" width="352" height="40" fill={accent} opacity="0.12" />
        <line x1="24" y1="100" x2="376" y2="100" stroke={`${accent}55`} strokeWidth="1" strokeDasharray="4 5" />
        <line x1="24" y1="140" x2="376" y2="140" stroke={`${accent}55`} strokeWidth="1" strokeDasharray="4 5" />
        <path className="tw-line" d="M 28 180 C 64 178, 80 122, 120 120 C 200 116, 280 122, 372 118" stroke={accent} strokeWidth="3.5" strokeLinecap="round" />
        <circle className="tw-head" cx="28" cy="180" r="6" fill="white" style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />
        <text className="tw-tag" x="30" y="92" fill={accent2} style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, letterSpacing: "0.2em" }}>ZONA T</text>
      </svg>
    </div>
  );
}

/* 9 · EVEN-SPLIT — gara a split costanti. Barre tutte pari + riga di livello. */
export function EvenSplitScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".ev-bar", { scaleY: 0, transformOrigin: "center bottom", stagger: 0.08, duration: 0.4, ease: "power3.out" })
      .fromTo(".ev-rule", { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: 0.7, ease: "power2.inOut" }, "-=0.2")
      .from(".ev-check", { scale: 0, transformOrigin: "center", duration: 0.4, ease: "back.out(2.5)" }, "-=0.1")
      .fromTo(".ev-check-mark", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.3, ease: "power2.out" }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} className="ev-bar" x={70 + i * 30} y="96" width="18" height="80" rx="4" fill={i % 2 ? accent : accent2} opacity="0.8" />
        ))}
        <line className="ev-rule" x1="62" y1="92" x2="320" y2="92" stroke="white" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round" />
        <g className="ev-check" transform="translate(330 92)">
          <circle r="16" fill="#0D0D0D" stroke={accent} strokeWidth="2" />
          <path className="ev-check-mark" d="M -7 0 L -2 6 L 8 -6" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      </svg>
    </div>
  );
}

/* 10 · YASSO — Yasso 800. Dieci blocchi identici che marciano in sequenza. */
export function YassoScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".ya-block", { scaleY: 0, opacity: 0, transformOrigin: "center bottom", stagger: 0.07, duration: 0.3, ease: "back.out(1.6)" })
      .from(".ya-tag", { scale: 0, transformOrigin: "center", duration: 0.4, ease: "back.out(2)" }, "-=0.2")
      .fromTo(".ya-base", { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: 0.6, ease: "power2.inOut" }, 0.2);
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} className="ya-block" x={56 + i * 30} y="88" width="20" height="74" rx="4" fill={accent} opacity={0.5 + (i % 2) * 0.4} />
        ))}
        <line className="ya-base" x1="50" y1="166" x2="356" y2="166" stroke="#3F3F46" strokeWidth="2" strokeLinecap="round" />
        <g className="ya-tag" transform="translate(200 196)">
          <rect x="-52" y="-13" width="104" height="26" rx="13" fill="#0D0D0D" stroke={accent2} strokeWidth="1.5" />
          <text x="0" y="5" textAnchor="middle" fill={accent2} style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800 }}>800 × 10</text>
        </g>
      </svg>
    </div>
  );
}
