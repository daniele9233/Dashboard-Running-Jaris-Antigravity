import { useRef } from "react";
import { gsap, useGSAP } from "./gsapSetup";
import { MONO, finish, type SceneProps } from "./sceneUtils";

/**
 * Scene VOLUME & DISTANZA — 10 celebrazioni su chilometraggio e milestone
 * di distanza. Stesso linguaggio delle classiche: SVG 400×240, stroke-first,
 * una meccanica distintiva per scena.
 */

/* 1 · WEEK BARS — 60 km in una settimana: 7 colonne crescono, l'ultima sfonda la linea obiettivo */
export function WeekBarsScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const H = [26, 44, 12, 58, 38, 72, 96];
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".wb-goal", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.6, ease: "power2.inOut" })
      .from(".wb-bar", { scaleY: 0, transformOrigin: "center bottom", stagger: 0.12, duration: 0.5, ease: "power3.out" }, "-=0.2")
      .to(".wb-last", { scaleY: 1.06, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.inOut" }, "-=0.05")
      .fromTo(".wb-burst", { scale: 0.3, opacity: 0.9, transformOrigin: "330px 64px" },
        { scale: 1.8, opacity: 0, duration: 0.7, ease: "power2.out" }, "-=0.25")
      .from(".wb-day", { opacity: 0, y: 6, stagger: 0.05, duration: 0.25 }, 0.5);
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <line className="wb-goal" x1="56" y1="84" x2="344" y2="84" stroke={accent2} strokeWidth="2" strokeDasharray="6 6" />
        <text x="348" y="88" fill={accent2} style={{ fontFamily: MONO, fontSize: 10 }}>60</text>
        {H.map((h, i) => (
          <rect key={i} className={`wb-bar ${i === 6 ? "wb-last" : ""}`}
            x={64 + i * 40} y={180 - h} width="22" height={h} rx="5"
            fill={i === 6 ? accent : `${accent}55`} stroke={i === 6 ? accent : "none"} strokeWidth="1.5" />
        ))}
        <circle className="wb-burst" cx="330" cy="64" r="20" stroke={accent} strokeWidth="2.5" />
        {["L", "M", "M", "G", "V", "S", "D"].map((d, i) => (
          <text key={i} className="wb-day" x={75 + i * 40} y="200" textAnchor="middle" fill="#52525B"
            style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>{d}</text>
        ))}
      </svg>
    </div>
  );
}

/* 2 · MILESTONE — Prima corsa da 30 km: strada prospettica + cippo chilometrico che si pianta */
export function MilestoneScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".ms-road", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.9, ease: "power2.inOut", stagger: 0.12 })
      .fromTo(".ms-dash", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.8, ease: "power2.inOut" }, "-=0.5")
      .from(".ms-stone", { y: 70, opacity: 0, duration: 0.55, ease: "back.out(1.4)" }, "-=0.2")
      .from(".ms-stone-txt", { opacity: 0, scale: 0.6, transformOrigin: "center", duration: 0.35, ease: "back.out(2)" }, "-=0.15")
      .fromTo(".ms-dust", { scaleX: 0, opacity: 0.8, transformOrigin: "center" }, { scaleX: 1.6, opacity: 0, duration: 0.5 }, "-=0.35");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <path className="ms-road" d="M 140 210 L 196 60" stroke="#3F3F46" strokeWidth="3" />
        <path className="ms-road" d="M 320 210 L 240 60" stroke="#3F3F46" strokeWidth="3" />
        <path className="ms-dash" d="M 230 208 L 218 64" stroke={`${accent}88`} strokeWidth="3" strokeDasharray="14 12" strokeLinecap="round" />
        <ellipse className="ms-dust" cx="96" cy="196" rx="34" ry="5" fill={`${accent}44`} />
        <g className="ms-stone">
          <path d="M 74 196 L 74 152 Q 74 136 96 136 Q 118 136 118 152 L 118 196 Z" fill="#141414" stroke={accent} strokeWidth="2.5" />
          <g className="ms-stone-txt">
            <text x="96" y="162" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 17, fontWeight: 800 }}>30</text>
            <text x="96" y="178" textAnchor="middle" fill="#71717A" style={{ fontFamily: MONO, fontSize: 9 }}>KM</text>
          </g>
        </g>
      </svg>
    </div>
  );
}

/* 3 · CALENDAR WAVE — 100 km in un mese: celle calendario che si riempiono a ondata diagonale */
export function CalendarWaveScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".cw-cell", {
      scale: 0, opacity: 0, transformOrigin: "center", duration: 0.32, ease: "back.out(2.2)",
      stagger: { grid: [4, 7], from: "start", axis: null, each: 0.035 },
    })
      .to(".cw-run", { fill: accent, stagger: 0.06, duration: 0.18 }, "-=0.5")
      .fromTo(".cw-sweep", { x: -180, opacity: 0 }, { x: 180, opacity: 0.5, duration: 0.7, ease: "power2.inOut" }, "-=0.3")
      .to(".cw-sweep", { opacity: 0, duration: 0.2 });
    finish(tl);
  }, { scope: ref });
  const RUN_DAYS = new Set([1, 3, 5, 8, 10, 12, 15, 17, 19, 22, 24, 26]);
  return (
    <div ref={ref} className="relative w-full h-full overflow-hidden flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {Array.from({ length: 28 }, (_, i) => {
          const r = Math.floor(i / 7), c = i % 7;
          return (
            <rect key={i} className={`cw-cell ${RUN_DAYS.has(i) ? "cw-run" : ""}`}
              x={88 + c * 34} y={44 + r * 38} width="26" height="30" rx="6"
              fill={RUN_DAYS.has(i) ? `${accent}33` : "#161616"}
              stroke={RUN_DAYS.has(i) ? accent : "#27272A"} strokeWidth="1.5" />
          );
        })}
      </svg>
      <div className="cw-sweep absolute top-0 bottom-0 w-20 pointer-events-none"
        style={{ background: `linear-gradient(105deg, transparent, ${accent2}33, transparent)`, transform: "skewX(-16deg)" }} />
    </div>
  );
}

/* 4 · THOUSAND — 1000 km totali: le quattro cifre cadono una a una con bounce e schiacciamento */
export function ThousandScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".th-digit", {
      y: -150, opacity: 0, duration: 0.55, ease: "bounce.out", stagger: 0.18,
    })
      .to(".th-digit", { scaleY: 0.92, scaleX: 1.06, transformOrigin: "center bottom", duration: 0.1, stagger: 0.18, ease: "power2.in" }, "<0.5")
      .to(".th-digit", { scaleY: 1, scaleX: 1, duration: 0.2, stagger: 0.18, ease: "back.out(3)" }, "<0.1")
      .fromTo(".th-line", { drawSVG: "50% 50%" }, { drawSVG: "0% 100%", duration: 0.6, ease: "power2.inOut" }, "-=0.3")
      .from(".th-sub", { opacity: 0, y: 8, duration: 0.4 }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex flex-col items-center justify-center gap-2">
      <div className="flex items-baseline gap-1.5">
        {["1", "0", "0", "0"].map((d, i) => (
          <span key={i} className="th-digit inline-block text-white"
            style={{ fontFamily: MONO, fontSize: 78, fontWeight: 800, lineHeight: 1, color: i === 0 ? accent : "white" }}>
            {d}
          </span>
        ))}
      </div>
      <svg width="240" height="10" viewBox="0 0 240 10" fill="none">
        <line className="th-line" x1="4" y1="5" x2="236" y2="5" stroke={accent2} strokeWidth="3" strokeLinecap="round" />
      </svg>
      <div className="th-sub text-[10px] font-black tracking-[0.5em] uppercase" style={{ color: accent }}>chilometri totali</div>
    </div>
  );
}

/* 5 · FINISH TAPE — Prima mezza maratona: il nastro del traguardo si tende e si spezza */
export function FinishTapeScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".ft-post", { scaleY: 0, transformOrigin: "center bottom", stagger: 0.12, duration: 0.4, ease: "power3.out" })
      .fromTo(".ft-tape-full", { drawSVG: "50% 50%" }, { drawSVG: "0% 100%", duration: 0.5, ease: "power2.out" }, "-=0.1")
      .to(".ft-tape-full", { attr: { d: "M 80 130 Q 200 150 320 130" }, duration: 0.35, ease: "power2.in" }, "+=0.3")
      .set(".ft-tape-full", { opacity: 0 })
      .set(".ft-half", { opacity: 1 })
      .to(".ft-half-l", { rotation: -34, x: -26, y: 14, transformOrigin: "left center", duration: 0.7, ease: "power2.out" })
      .to(".ft-half-r", { rotation: 34, x: 26, y: 14, transformOrigin: "right center", duration: 0.7, ease: "power2.out" }, "<")
      .from(".ft-runner", { x: -90, opacity: 0, duration: 0.6, ease: "power2.out" }, "-=0.85")
      .to(".ft-runner", { x: 60, opacity: 0, duration: 0.5, ease: "power2.in" }, "-=0.2")
      .from(".ft-label", { opacity: 0, scale: 0.8, transformOrigin: "center", duration: 0.4, ease: "back.out(2)" }, "-=0.3");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <rect className="ft-post" x="72" y="74" width="8" height="120" rx="3" fill="#27272A" stroke={accent} strokeWidth="1.5" />
        <rect className="ft-post" x="320" y="74" width="8" height="120" rx="3" fill="#27272A" stroke={accent} strokeWidth="1.5" />
        <path className="ft-tape-full" d="M 80 130 Q 200 134 320 130" stroke={accent2} strokeWidth="6" strokeLinecap="round" />
        <g className="ft-half" opacity="0">
          <path className="ft-half-l" d="M 80 130 Q 140 140 196 146" stroke={accent2} strokeWidth="6" strokeLinecap="round" />
          <path className="ft-half-r" d="M 204 146 Q 260 140 320 130" stroke={accent2} strokeWidth="6" strokeLinecap="round" />
        </g>
        <circle className="ft-runner" cx="196" cy="160" r="9" fill={accent} />
        <text className="ft-label" x="200" y="52" textAnchor="middle" fill={accent}
          style={{ fontFamily: MONO, fontSize: 20, fontWeight: 800 }}>21,097</text>
      </svg>
    </div>
  );
}

/* 6 · ARCH — Prima maratona: l'arco del traguardo si costruisce a conci + coriandoli sottili */
export function ArchScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const CONFETTI = Array.from({ length: 14 }, (_, i) => ({
    x: 110 + (i * 53) % 180, delay: (i % 7) * 0.06, color: i % 2 ? "#fff" : undefined,
  }));
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".ar-pillar", { scaleY: 0, transformOrigin: "center bottom", stagger: 0.15, duration: 0.5, ease: "power3.out" })
      .fromTo(".ar-arc", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.9, ease: "power2.inOut" }, "-=0.15")
      .from(".ar-text", { opacity: 0, letterSpacing: "1.2em", duration: 0.6, ease: "power3.out" }, "-=0.3")
      .fromTo(".ar-conf", { y: -10, opacity: 0 }, { y: 150, opacity: 1, duration: 1.3, stagger: 0.05, ease: "power1.in" }, "-=0.5")
      .to(".ar-conf", { opacity: 0, duration: 0.4 }, "-=0.3");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {CONFETTI.map((c, i) => (
          <rect key={i} className="ar-conf" x={c.x} y="40" width="4" height="7" rx="1"
            fill={c.color ?? (i % 3 ? accent : accent2)} transform={`rotate(${(i * 41) % 80 - 40} ${c.x} 40)`} />
        ))}
        <rect className="ar-pillar" x="92" y="110" width="14" height="86" rx="4" fill="#141414" stroke={accent} strokeWidth="2" />
        <rect className="ar-pillar" x="294" y="110" width="14" height="86" rx="4" fill="#141414" stroke={accent} strokeWidth="2" />
        <path className="ar-arc" d="M 92 116 C 110 56, 290 56, 308 116" stroke={accent} strokeWidth="10" strokeLinecap="round" />
        <text className="ar-text" x="200" y="92" textAnchor="middle" fill="white"
          style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, letterSpacing: "0.35em" }}>FINISH</text>
      </svg>
    </div>
  );
}

/* 7 · TALLY — 50 corse completate: griglia di tacche che si timbrano a serpentina */
export function TallyScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".tl-mark", { drawSVG: "0%" }, {
      drawSVG: "100%", duration: 0.14, ease: "power1.out",
      stagger: { each: 0.045 },
    })
      .fromTo(".tl-cross", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.3, stagger: 0.08, ease: "power2.inOut" }, "-=0.4")
      .to(".tl-cross", { stroke: accent2, duration: 0.3 }, "-=0.1");
    finish(tl);
  }, { scope: ref });
  // 10 gruppi da 5 (4 aste + sbarra): 50
  const groups = Array.from({ length: 10 }, (_, g) => ({ gx: 70 + (g % 5) * 58, gy: 70 + Math.floor(g / 5) * 76 }));
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {groups.map((g, gi) => (
          <g key={gi}>
            {Array.from({ length: 4 }, (_, i) => (
              <line key={i} className="tl-mark" x1={g.gx + i * 9} y1={g.gy} x2={g.gx + i * 9} y2={g.gy + 34}
                stroke={accent} strokeWidth="3.5" strokeLinecap="round" opacity="0.85" />
            ))}
            <line className="tl-cross" x1={g.gx - 6} y1={g.gy + 28} x2={g.gx + 33} y2={g.gy + 4}
              stroke="white" strokeWidth="3.5" strokeLinecap="round" />
          </g>
        ))}
      </svg>
    </div>
  );
}

/* 8 · DOUBLE DAY — Doppietta giornaliera: sole e luna si scambiano sull'arco del giorno */
export function DoubleDayScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".dd-arc", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.8, ease: "power2.inOut" })
      .to(".dd-sun", {
        motionPath: { path: ".dd-arc-path", align: ".dd-arc-path", alignOrigin: [0.5, 0.5], end: 0.5 },
        duration: 1.0, ease: "power1.inOut",
      }, "-=0.3")
      .from(".dd-ray", { scale: 0, transformOrigin: "center", stagger: 0.04, duration: 0.2 }, "-=0.4")
      .to(".dd-moon", {
        motionPath: { path: ".dd-arc-path", align: ".dd-arc-path", alignOrigin: [0.5, 0.5], start: 0.5, end: 1 },
        duration: 1.0, ease: "power1.inOut",
      }, "-=0.5")
      .from(".dd-star", { opacity: 0, scale: 0, transformOrigin: "center", stagger: 0.07, duration: 0.25, ease: "back.out(2)" }, "-=0.6")
      .from(".dd-x2", { scale: 0, opacity: 0, transformOrigin: "center", duration: 0.45, ease: "back.out(2.2)" }, "-=0.3");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <path className="dd-arc dd-arc-path" d="M 60 190 C 110 60, 290 60, 340 190" stroke="#3F3F46" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
        <g className="dd-sun">
          <circle cx="60" cy="190" r="13" fill={accent} />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return <line key={i} className="dd-ray" x1={60 + Math.cos(a) * 18} y1={190 + Math.sin(a) * 18}
              x2={60 + Math.cos(a) * 24} y2={190 + Math.sin(a) * 24} stroke={accent} strokeWidth="2.5" strokeLinecap="round" />;
          })}
        </g>
        <path className="dd-moon" d="M 60 178 A 12 12 0 1 0 72 192 A 9.5 9.5 0 0 1 60 178 Z" fill={accent2} transform="translate(0 0)" />
        {[[120, 70], [168, 48], [250, 52], [300, 80]].map(([x, y], i) => (
          <circle key={i} className="dd-star" cx={x} cy={y} r="2" fill="white" opacity="0.8" />
        ))}
        <text className="dd-x2" x="200" y="170" textAnchor="middle" fill="white"
          style={{ fontFamily: MONO, fontSize: 40, fontWeight: 800 }}>×2</text>
      </svg>
    </div>
  );
}

/* 9 · HOURGLASS — 10 ore di corsa in un mese: la sabbia scorre, poi flip della clessidra */
export function HourglassScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".hg-frame", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.8, ease: "power2.inOut" })
      .fromTo(".hg-top", { scaleY: 1, transformOrigin: "center bottom" }, { scaleY: 0.06, duration: 1.5, ease: "power1.inOut" }, "-=0.1")
      .fromTo(".hg-bottom", { scaleY: 0.06, transformOrigin: "center bottom" }, { scaleY: 1, duration: 1.5, ease: "power1.inOut" }, "<")
      .fromTo(".hg-stream", { opacity: 0 }, { opacity: 1, duration: 0.2 }, "<")
      .to(".hg-stream", { opacity: 0, duration: 0.2 }, "<1.2")
      .to(".hg-all", { rotation: 180, transformOrigin: "center center", duration: 0.6, ease: "back.inOut(1.4)" }, "+=0.15")
      .from(".hg-label", { opacity: 0, y: 10, duration: 0.4 }, "-=0.25");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <g className="hg-all">
          <path className="hg-frame" d="M 168 52 H 232 L 204 116 L 232 180 H 168 L 196 116 Z"
            stroke={accent} strokeWidth="3" strokeLinejoin="round" />
          <path className="hg-top" d="M 176 60 H 224 L 201 112 L 199 112 Z" fill={accent2} opacity="0.8" />
          <path className="hg-bottom" d="M 176 172 H 224 L 201 124 L 199 124 Z" fill={accent2} opacity="0.8" transform="rotate(180 200 148)" />
          <line className="hg-stream" x1="200" y1="116" x2="200" y2="166" stroke={accent2} strokeWidth="2" strokeDasharray="3 4" />
        </g>
        <text className="hg-label" x="200" y="216" textAnchor="middle" fill={accent}
          style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, letterSpacing: "0.3em" }}>10 ORE</text>
      </svg>
    </div>
  );
}

/* 10 · OVERFLOW — Record km in un giorno: la barra sfonda il fondo scala e prosegue oltre il frame */
export function OverflowScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".of-scale", { opacity: 0, duration: 0.4 })
      .fromTo(".of-bar", { scaleX: 0, transformOrigin: "left center" }, { scaleX: 0.78, duration: 0.9, ease: "power2.out" })
      .to(".of-bar", { scaleX: 0.8, duration: 0.3, ease: "power1.inOut" })
      .to(".of-bar", { scaleX: 1.18, duration: 0.45, ease: "power4.in" })
      .fromTo(".of-shatter", { opacity: 0, x: 0 }, { opacity: 1, x: 26, duration: 0.35, stagger: 0.04, ease: "power3.out" }, "-=0.1")
      .to(".of-shatter", { opacity: 0, duration: 0.4 }, "+=0.1")
      .to(".of-cap", { x: 30, rotation: 24, opacity: 0.4, duration: 0.5, ease: "power2.out" }, "-=0.8")
      .from(".of-max", { opacity: 0, scale: 0.7, transformOrigin: "center", duration: 0.35, ease: "back.out(2.5)" }, "-=0.4");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center overflow-hidden">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <g className="of-scale">
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line x1={60 + i * 60} y1="100" x2={60 + i * 60} y2="140" stroke="#3F3F46" strokeWidth="1.5" />
              <text x={60 + i * 60} y="158" textAnchor="middle" fill="#52525B" style={{ fontFamily: MONO, fontSize: 9 }}>{i * 10}</text>
            </g>
          ))}
        </g>
        <rect className="of-bar" x="60" y="108" width="280" height="24" rx="12" fill={accent} opacity="0.9" />
        <line className="of-cap" x1="300" y1="96" x2="300" y2="144" stroke={accent2} strokeWidth="3" strokeLinecap="round" />
        {[104, 116, 130].map((y, i) => (
          <line key={i} className="of-shatter" x1="344" y1={y} x2={368 + i * 6} y2={y - 8 + i * 8}
            stroke={accent2} strokeWidth="2.5" strokeLinecap="round" />
        ))}
        <text className="of-max" x="200" y="80" textAnchor="middle" fill="white"
          style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800 }}>MAX</text>
      </svg>
    </div>
  );
}
