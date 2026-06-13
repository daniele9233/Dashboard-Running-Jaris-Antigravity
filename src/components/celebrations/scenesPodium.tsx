import { useRef } from "react";
import { gsap, useGSAP } from "./gsapSetup";
import { MONO, finish, type SceneProps } from "./sceneUtils";

/**
 * Scene GARE aggiuntive (10) — barriere di tempo, podio, progressi e milestone
 * di gara. Cancelli, archi, gantry, pettorali, gradini di classifica.
 */

/* 1 · CROWN-CLOCK — 10k PB sceso di oltre 1 min. Corona cala sul cronometro. */
export function CrownClockScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".cc-dial", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.8, ease: "power2.inOut" })
      .from(".cc-tick", { scale: 0, transformOrigin: "200px 134px", stagger: 0.03, duration: 0.2 }, "-=0.5")
      .from(".cc-crown", { y: -70, opacity: 0, duration: 0.55, ease: "bounce.out" }, "-=0.3")
      .fromTo(".cc-old", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.35, ease: "power2.in" }, "-=0.1")
      .from(".cc-delta", { scale: 0, transformOrigin: "center", duration: 0.45, ease: "back.out(2.2)" }, "-=0.1");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <circle className="cc-dial" cx="200" cy="134" r="58" stroke={accent} strokeWidth="3.5" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <line key={i} className="cc-tick" x1={200 + Math.cos(a) * 50} y1={134 + Math.sin(a) * 50} x2={200 + Math.cos(a) * 44} y2={134 + Math.sin(a) * 44} stroke="#52525B" strokeWidth="2" strokeLinecap="round" />;
        })}
        <text x="200" y="130" textAnchor="middle" fill="white" style={{ fontFamily: MONO, fontSize: 20, fontWeight: 800 }}>38:42</text>
        <g className="cc-old" transform="translate(200 150)">
          <text x="0" y="0" textAnchor="middle" fill="#52525B" style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700 }}>39:50</text>
          <line x1="-26" y1="-4" x2="26" y2="-4" stroke={accent2} strokeWidth="2" strokeLinecap="round" />
        </g>
        <path className="cc-crown" d="M 168 64 L 178 84 L 200 60 L 222 84 L 232 64 L 226 96 L 174 96 Z" fill={accent2} opacity="0.95" />
        <g className="cc-delta" transform="translate(312 80)">
          <rect x="-32" y="-15" width="64" height="30" rx="15" fill="#0D0D0D" stroke={accent} strokeWidth="1.5" />
          <text x="0" y="5" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800 }}>−1:08</text>
        </g>
      </svg>
    </div>
  );
}

/* 2 · HALF-RECORD — PB mezza maratona. Emblema 21.1 + nastro record. */
export function HalfRecordScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".hr-arc", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.0, ease: "power2.inOut" })
      .from(".hr-num", { scale: 0, transformOrigin: "center", duration: 0.5, ease: "back.out(1.8)" }, "-=0.4")
      .from(".hr-ribbon", { scaleY: 0, transformOrigin: "top center", stagger: 0.08, duration: 0.4, ease: "back.out(1.6)" }, "-=0.2")
      .fromTo(".hr-shine", { x: -70, opacity: 0 }, { x: 70, opacity: 0.7, duration: 0.6, ease: "power2.inOut" }, "-=0.2")
      .to(".hr-shine", { opacity: 0, duration: 0.2 });
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <path className="hr-arc" d="M 134 120 A 66 66 0 1 1 266 120" stroke={accent} strokeWidth="4" strokeLinecap="round" />
        <g className="hr-ribbon">
          <path d="M 182 150 L 182 196 L 200 182 L 218 196 L 218 150 Z" fill={accent2} opacity="0.9" />
        </g>
        <circle cx="200" cy="118" r="46" fill="#0D0D0D" stroke={accent} strokeWidth="1.5" />
        <g className="hr-num">
          <text x="200" y="114" textAnchor="middle" fill="white" style={{ fontFamily: MONO, fontSize: 30, fontWeight: 800 }}>21.1</text>
          <text x="200" y="134" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.2em" }}>RECORD</text>
        </g>
        <g clipPath="url(#hr-clip)">
          <rect className="hr-shine" x="180" y="68" width="20" height="100" fill="white" opacity="0" transform="skewX(-18)" />
        </g>
        <defs><clipPath id="hr-clip"><circle cx="200" cy="118" r="44" /></clipPath></defs>
      </svg>
    </div>
  );
}

/* 3 · ARCH-UNDER — 5K sotto i 20:00. Arco luminoso, dot sprinta sotto. */
export function ArchUnderScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".au-arch", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.9, ease: "power2.inOut" })
      .from(".au-clock", { scale: 0, transformOrigin: "center", duration: 0.4, ease: "back.out(1.8)" }, "-=0.4")
      .fromTo(".au-dot", { x: -150, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.in" }, "-=0.2")
      .fromTo(".au-glow", { opacity: 0 }, { opacity: 1, duration: 0.3, yoyo: true, repeat: 1, ease: "sine.inOut" }, "-=0.3")
      .to(".au-dot", { x: 150, opacity: 0, duration: 0.5, ease: "power3.out" });
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <path className="au-glow" d="M 110 190 V 110 A 90 90 0 0 1 290 110 V 190" stroke={accent} strokeWidth="12" opacity="0" style={{ filter: "blur(8px)" }} fill="none" />
        <path className="au-arch" d="M 110 190 V 110 A 90 90 0 0 1 290 110 V 190" stroke={accent} strokeWidth="5" strokeLinecap="round" fill="none" />
        <g className="au-clock" transform="translate(200 78)">
          <rect x="-44" y="-18" width="88" height="36" rx="8" fill="#0D0D0D" stroke={accent2} strokeWidth="1.5" />
          <text x="0" y="7" textAnchor="middle" fill={accent2} style={{ fontFamily: MONO, fontSize: 18, fontWeight: 800 }}>20:00</text>
        </g>
        <circle className="au-dot" cx="200" cy="178" r="8" fill="white" style={{ filter: `drop-shadow(0 0 8px ${accent})` }} />
      </svg>
    </div>
  );
}

/* 4 · RING-GOAL — 5K sotto i 25:00. Anello obiettivo che si chiude + check. */
export function RingGoalScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".rg-track", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.6, ease: "power2.out" })
      .fromTo(".rg-fill", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.2, ease: "power3.inOut" }, "-=0.2")
      .from(".rg-num", { scale: 0, transformOrigin: "center", duration: 0.4, ease: "back.out(1.8)" }, "-=0.6")
      .from(".rg-check", { scale: 0, transformOrigin: "center", duration: 0.4, ease: "back.out(2.5)" }, "-=0.1")
      .fromTo(".rg-check-mark", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.3 }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <circle className="rg-track" cx="200" cy="120" r="66" stroke="#27272A" strokeWidth="9" />
        <circle className="rg-fill" cx="200" cy="120" r="66" stroke={accent} strokeWidth="9" strokeLinecap="round" transform="rotate(-90 200 120)" />
        <g className="rg-num">
          <text x="200" y="116" textAnchor="middle" fill="white" style={{ fontFamily: MONO, fontSize: 28, fontWeight: 800 }}>25:00</text>
          <text x="200" y="136" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.2em" }}>5K · SOTTO</text>
        </g>
        <g className="rg-check" transform="translate(258 64)">
          <circle r="16" fill="#0A0A0A" stroke={accent} strokeWidth="2" />
          <path className="rg-check-mark" d="M -7 0 L -2 6 L 8 -7" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      </svg>
    </div>
  );
}

/* 5 · GANTRY — 10K sotto i 40:00. Gantry d'arrivo, cronometro che si ferma. */
export function GantryScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".gn-post", { scaleY: 0, transformOrigin: "center bottom", stagger: 0.1, duration: 0.4, ease: "power3.out" })
      .fromTo(".gn-beam", { scaleX: 0, transformOrigin: "center" }, { scaleX: 1, duration: 0.5, ease: "power2.out" }, "-=0.2")
      .from(".gn-board", { y: -14, opacity: 0, duration: 0.4, ease: "back.out(1.6)" }, "-=0.1")
      .fromTo(".gn-tape", { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: 0.4 }, "-=0.2")
      .from(".gn-time", { scale: 1.5, opacity: 0, transformOrigin: "center", duration: 0.45, ease: "back.out(1.8)" }, "-=0.1");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <rect className="gn-post" x="96" y="80" width="9" height="120" rx="3" fill="#3F3F46" />
        <rect className="gn-post" x="295" y="80" width="9" height="120" rx="3" fill="#3F3F46" />
        <rect className="gn-beam" x="96" y="76" width="208" height="12" rx="4" fill={accent} opacity="0.85" />
        <g className="gn-board" transform="translate(200 60)">
          <rect x="-52" y="-22" width="104" height="40" rx="8" fill="#0D0D0D" stroke={accent} strokeWidth="2" />
          <text className="gn-time" x="0" y="6" textAnchor="middle" fill="white" style={{ fontFamily: MONO, fontSize: 20, fontWeight: 800 }}>39:31</text>
        </g>
        <rect className="gn-tape" x="100" y="186" width="200" height="6" rx="3" fill={accent2} opacity="0.8" />
        <text x="200" y="212" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: "0.2em" }}>10K · SOTTO 40:00</text>
      </svg>
    </div>
  );
}

/* 6 · GROWTH — PB battuto due mesi di fila. Due barre in salita + freccia. */
export function GrowthScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".gw-bar", { scaleY: 0, transformOrigin: "center bottom", stagger: 0.2, duration: 0.5, ease: "power3.out" })
      .from(".gw-cap", { scale: 0, transformOrigin: "center", stagger: 0.2, duration: 0.3, ease: "back.out(2.5)" }, "-=0.7")
      .fromTo(".gw-trend", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.6, ease: "power2.out" }, "-=0.3")
      .from(".gw-arrow", { scale: 0, transformOrigin: "center", duration: 0.35, ease: "back.out(2)" }, "-=0.1");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <line x1="110" y1="186" x2="300" y2="186" stroke="#3F3F46" strokeWidth="2" />
        {[[150, 84], [250, 130]].map(([x, h], i) => (
          <g key={i}>
            <rect className="gw-bar" x={x - 22} y={186 - h} width="44" height={h} rx="6" fill={i ? accent : accent2} opacity={0.55 + i * 0.3} />
            <circle className="gw-cap" cx={x} cy={186 - h} r="6" fill="white" />
          </g>
        ))}
        <path className="gw-trend" d="M 150 102 L 250 56" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 4" />
        <g className="gw-arrow" transform="translate(250 56)">
          <path d="M 0 0 L 16 0 L 16 16" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" transform="rotate(-45)" />
        </g>
        <text x="150" y="206" textAnchor="middle" fill="#52525B" style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>mese 1</text>
        <text x="250" y="206" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>mese 2</text>
      </svg>
    </div>
  );
}

/* 7 · PODIUM — sul podio di categoria. I tre gradini salgono, medaglia in 1°. */
export function PodiumScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".po-step2", { scaleY: 0, transformOrigin: "center bottom", duration: 0.4, ease: "power3.out" })
      .from(".po-step3", { scaleY: 0, transformOrigin: "center bottom", duration: 0.4, ease: "power3.out" }, "-=0.25")
      .from(".po-step1", { scaleY: 0, transformOrigin: "center bottom", duration: 0.5, ease: "back.out(1.4)" }, "-=0.2")
      .from(".po-medal", { y: -50, opacity: 0, duration: 0.55, ease: "bounce.out" }, "-=0.1")
      .fromTo(".po-light", { scaleY: 0, opacity: 0.6, transformOrigin: "top center" }, { scaleY: 1, opacity: 0.18, duration: 0.6, ease: "power2.out" }, "-=0.4")
      .from(".po-num", { opacity: 0, y: 6, stagger: 0.08, duration: 0.3 }, "-=0.4");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <path className="po-light" d="M 200 40 L 250 196 L 150 196 Z" fill={accent} opacity="0.18" />
        <rect className="po-step2" x="118" y="150" width="56" height="50" rx="4" fill="#27272A" stroke={accent2} strokeWidth="1.5" />
        <rect className="po-step3" x="226" y="164" width="56" height="36" rx="4" fill="#27272A" stroke="#3F3F46" strokeWidth="1.5" />
        <rect className="po-step1" x="172" y="124" width="56" height="76" rx="4" fill="#0D0D0D" stroke={accent} strokeWidth="2" />
        <text className="po-num" x="146" y="180" textAnchor="middle" fill={accent2} style={{ fontFamily: MONO, fontSize: 18, fontWeight: 800 }}>2</text>
        <text className="po-num" x="254" y="188" textAnchor="middle" fill="#71717A" style={{ fontFamily: MONO, fontSize: 16, fontWeight: 800 }}>3</text>
        <g className="po-medal" transform="translate(200 96)">
          <circle r="20" fill="#0D0D0D" stroke={accent} strokeWidth="3" />
          <text x="0" y="6" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 18, fontWeight: 800 }}>1</text>
        </g>
      </svg>
    </div>
  );
}

/* 8 · METRONOME-GATE — mezza sotto 1:30. Pendolo che si ferma sul tempo. */
export function MetronomeGateScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".mg-body", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.8, ease: "power2.inOut" })
      .fromTo(".mg-arm", { rotation: -26, transformOrigin: "200px 188px" }, { rotation: 26, duration: 0.5, yoyo: true, repeat: 3, ease: "sine.inOut" }, "-=0.3")
      .to(".mg-arm", { rotation: 0, transformOrigin: "200px 188px", duration: 0.4, ease: "power2.out" })
      .from(".mg-board", { scale: 0, transformOrigin: "center", duration: 0.45, ease: "back.out(1.8)" }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <path className="mg-body" d="M 168 188 L 188 78 L 212 78 L 232 188 Z" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <g className="mg-arm">
          <line x1="200" y1="188" x2="200" y2="92" stroke={accent2} strokeWidth="3" strokeLinecap="round" />
          <rect x="194" y="118" width="12" height="10" rx="2" fill={accent2} />
        </g>
        <circle cx="200" cy="188" r="4" fill={accent} />
        <g className="mg-board" transform="translate(200 56)">
          <rect x="-50" y="-18" width="100" height="34" rx="8" fill="#0D0D0D" stroke={accent} strokeWidth="1.5" />
          <text x="0" y="7" textAnchor="middle" fill="white" style={{ fontFamily: MONO, fontSize: 17, fontWeight: 800 }}>1:30:00</text>
        </g>
      </svg>
    </div>
  );
}

/* 9 · TRIPLE-BIB — 3 gare in un mese. Tre pettorali che si appuntano. */
export function TripleBibScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".tb-bib", { y: -50, opacity: 0, rotation: () => -12 + Math.random() * 24, transformOrigin: "center top", stagger: 0.18, duration: 0.5, ease: "back.out(1.5)" })
      .from(".tb-pin", { scale: 0, transformOrigin: "center", stagger: 0.18, duration: 0.25, ease: "back.out(2.5)" }, 0.2)
      .from(".tb-tag", { opacity: 0, scale: 0.6, transformOrigin: "center", duration: 0.4, ease: "back.out(2)" }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {[[110, -8], [200, 4], [290, -5]].map(([x, rot], i) => (
          <g key={i} transform={`translate(${x} 108) rotate(${rot})`}>
            <g className="tb-bib">
              <rect x="-38" y="-30" width="76" height="62" rx="6" fill="#0D0D0D" stroke={i === 1 ? accent : accent2} strokeWidth="2" />
              <text x="0" y="2" textAnchor="middle" fill={i === 1 ? accent : accent2} style={{ fontFamily: MONO, fontSize: 20, fontWeight: 800 }}>{i + 1}</text>
              <text x="0" y="22" textAnchor="middle" fill="#52525B" style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700 }}>GARA</text>
            </g>
            <circle className="tb-pin" cx="0" cy="-30" r="4" fill="white" />
          </g>
        ))}
        <g className="tb-tag" transform="translate(200 188)">
          <rect x="-56" y="-14" width="112" height="26" rx="13" fill="#0D0D0D" stroke={accent} strokeWidth="1.5" />
          <text x="0" y="4" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800 }}>3 IN UN MESE</text>
        </g>
      </svg>
    </div>
  );
}

/* 10 · BIB-STACK — 10 gare completate. I pettorali si impilano fino a 10. */
export function BibStackScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".bs-bib", { x: -130, opacity: 0, stagger: 0.07, duration: 0.32, ease: "power3.out" })
      .from(".bs-medal", { scale: 0, transformOrigin: "center", duration: 0.45, ease: "back.out(1.8)" }, "-=0.2")
      .fromTo(".bs-glow", { opacity: 0 }, { opacity: 1, duration: 0.4, yoyo: true, repeat: 1, ease: "sine.inOut" }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} className="bs-bib" x={i % 2 ? 132 : 120} y={188 - i * 16} width="120" height="13" rx="3" fill={i % 2 ? accent2 : accent} opacity={0.5 + i * 0.045} />
        ))}
        <circle className="bs-glow" cx="288" cy="92" r="30" fill={accent} opacity="0" style={{ filter: "blur(12px)" }} />
        <g className="bs-medal" transform="translate(288 92)">
          <circle r="26" fill="#0D0D0D" stroke={accent} strokeWidth="3" />
          <text x="0" y="7" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800 }}>10</text>
        </g>
      </svg>
    </div>
  );
}
