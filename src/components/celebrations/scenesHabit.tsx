import { useRef } from "react";
import { gsap, useGSAP } from "./gsapSetup";
import { MONO, finish, type SceneProps } from "./sceneUtils";

/**
 * Scene COSTANZA & CONDIZIONI — 10 celebrazioni su streak, abitudini e
 * corse in condizioni estreme (alba, notte, pioggia, gelo, caldo).
 */

/* 29 · CHAIN — 7 giorni di fila: gli anelli della catena si agganciano uno a uno */
export function ChainScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".ch-link", { drawSVG: "0%" }, {
      drawSVG: "100%", duration: 0.38, stagger: 0.16, ease: "power2.inOut",
    })
      .to(".ch-link", { scale: 1.06, transformOrigin: "center", duration: 0.16, stagger: 0.16, yoyo: true, repeat: 1 }, 0.3)
      .fromTo(".ch-glow", { opacity: 0 }, { opacity: 1, duration: 0.4, yoyo: true, repeat: 1 }, "-=0.4")
      .from(".ch-seven", { scale: 0, opacity: 0, transformOrigin: "center", duration: 0.45, ease: "back.out(2.2)" }, "-=0.35");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {Array.from({ length: 7 }, (_, i) => (
          <ellipse key={i} className="ch-link" cx={86 + i * 38} cy="110" rx="22" ry="14"
            stroke={i % 2 ? accent2 : accent} strokeWidth="3.5"
            transform={`rotate(${i % 2 ? 90 : 0} ${86 + i * 38} 110)`} />
        ))}
        <rect className="ch-glow" x="56" y="86" width="296" height="48" rx="24" fill="none"
          stroke={accent} strokeWidth="1" opacity="0.3" />
        <text className="ch-seven" x="200" y="186" textAnchor="middle" fill="white"
          style={{ fontFamily: MONO, fontSize: 26, fontWeight: 800 }}>7 / 7</text>
      </svg>
    </div>
  );
}

/* 30 · TRIPLE FLAME — 30 giorni di streak: la fiamma cresce in tre stadi */
export function TripleFlameScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const flame = (s: number) =>
    `M 0 ${-34 * s} C ${14 * s} ${-16 * s}, ${20 * s} ${-4 * s}, ${20 * s} ${10 * s} C ${20 * s} ${26 * s}, ${9 * s} ${34 * s}, 0 ${34 * s} C ${-9 * s} ${34 * s}, ${-20 * s} ${26 * s}, ${-20 * s} ${10 * s} C ${-20 * s} ${-2 * s}, ${-12 * s} ${-12 * s}, ${-7 * s} ${-18 * s} C ${-7 * s} ${-8 * s}, ${-2 * s} ${-5 * s}, ${2 * s} ${-4 * s} C ${-2 * s} ${-16 * s}, ${-2 * s} ${-26 * s}, 0 ${-34 * s} Z`;
  useGSAP(() => {
    const tl = gsap.timeline();
    [0, 1, 2].forEach((i) => {
      tl.from(`.tf-f${i}`, { scale: 0, opacity: 0, transformOrigin: "center bottom", duration: 0.45, ease: "back.out(1.7)" }, i * 0.42)
        .from(`.tf-n${i}`, { opacity: 0, y: 6, duration: 0.25 }, i * 0.42 + 0.2);
    });
    tl.to(".tf-f2", { scaleX: 1.05, scaleY: 0.97, transformOrigin: "center bottom", duration: 0.4, yoyo: true, repeat: 3, ease: "sine.inOut" })
      .fromTo(".tf-ring", { scale: 0.5, opacity: 0.9, transformOrigin: "302px 110px" },
        { scale: 1.8, opacity: 0, duration: 0.7, ease: "power2.out" }, "-=1.2");
    finish(tl);
  }, { scope: ref });
  const X = [96, 198, 302];
  const SCALES = [0.62, 0.85, 1.18];
  const N = ["7", "14", "30"];
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {X.map((x, i) => (
          <g key={i}>
            <g className={`tf-f${i}`} transform={`translate(${x} 110)`}>
              <path d={flame(SCALES[i])} fill={i === 2 ? accent : `${accent}${["44", "77"][i]}`}
                stroke={i === 2 ? accent2 : "none"} strokeWidth="2" />
            </g>
            <text className={`tf-n${i}`} x={x} y="186" textAnchor="middle"
              fill={i === 2 ? accent2 : "#71717A"} style={{ fontFamily: MONO, fontSize: i === 2 ? 18 : 13, fontWeight: 800 }}>{N[i]}</text>
          </g>
        ))}
        <circle className="tf-ring" cx="302" cy="110" r="40" stroke={accent2} strokeWidth="2" />
      </svg>
    </div>
  );
}

/* 31 · HUNDRED — 100 giorni di streak: gli zeri del 100 prendono fuoco */
export function HundredScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".hu-char", { yPercent: 120, opacity: 0, stagger: 0.12, duration: 0.5, ease: "back.out(1.6)" })
      .fromTo(".hu-fire", { scale: 0, opacity: 0, transformOrigin: "center bottom" },
        { scale: 1, opacity: 1, duration: 0.4, stagger: 0.14, ease: "back.out(2)" }, "-=0.1")
      .to(".hu-fire", { scaleY: 1.12, transformOrigin: "center bottom", duration: 0.35, yoyo: true, repeat: 3, stagger: 0.1, ease: "sine.inOut" })
      .from(".hu-days", { opacity: 0, letterSpacing: "0.9em", duration: 0.5, ease: "power3.out" }, "-=0.8");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex flex-col items-center justify-center">
      <div className="relative flex items-end" style={{ fontFamily: MONO, fontSize: 92, fontWeight: 800, lineHeight: 1 }}>
        <span className="hu-char inline-block text-white">1</span>
        {[0, 1].map((i) => (
          <span key={i} className="hu-char relative inline-block" style={{ color: accent }}>
            0
            <svg className="hu-fire absolute left-1/2 -translate-x-1/2" style={{ top: -22 }} width="34" height="30" viewBox="0 0 34 30" fill="none">
              <path d="M 17 0 C 24 8, 28 14, 28 20 C 28 26 23 30 17 30 C 11 30 6 26 6 20 C 6 15 9 11 12 8 C 12 13 14 15 16 16 C 14 10 15 5 17 0 Z"
                fill={accent2} opacity="0.95" />
            </svg>
          </span>
        ))}
      </div>
      <div className="hu-days mt-3 text-[11px] font-black tracking-[0.45em] uppercase" style={{ color: accent2 }}>
        giorni di fuoco
      </div>
    </div>
  );
}

/* 32 · SUNRISE — Corsa all'alba: il sole sorge dall'orizzonte coi raggi che si estendono */
export function SunriseScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".sr-horizon", { drawSVG: "50% 50%" }, { drawSVG: "0% 100%", duration: 0.7, ease: "power2.inOut" })
      .fromTo(".sr-sun", { y: 60 }, { y: 0, duration: 1.4, ease: "power2.out" }, "-=0.2")
      .fromTo(".sr-ray",
        { drawSVG: "0% 0%", opacity: 0 },
        { drawSVG: "0% 100%", opacity: 1, duration: 0.4, stagger: 0.07, ease: "power2.out" }, "-=0.7")
      .from(".sr-bird", { opacity: 0, x: -30, stagger: 0.15, duration: 0.6, ease: "power1.out" }, "-=0.5")
      .from(".sr-time", { opacity: 0, y: 8, duration: 0.4 }, "-=0.3");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <defs>
          <clipPath id="sr-clip"><rect x="0" y="0" width="400" height="156" /></clipPath>
        </defs>
        <g clipPath="url(#sr-clip)">
          <g className="sr-sun">
            <circle cx="200" cy="150" r="34" fill={accent} opacity="0.92" />
            {Array.from({ length: 7 }, (_, i) => {
              const a = Math.PI + (i / 6) * Math.PI;
              const x1 = 200 + Math.cos(a) * 46, y1 = 150 + Math.sin(a) * 46;
              const x2 = 200 + Math.cos(a) * 64, y2 = 150 + Math.sin(a) * 64;
              return <line key={i} className="sr-ray" x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={accent} strokeWidth="3" strokeLinecap="round" />;
            })}
          </g>
        </g>
        <line className="sr-horizon" x1="48" y1="156" x2="352" y2="156" stroke={accent2} strokeWidth="3" strokeLinecap="round" />
        {[[110, 70], [150, 54]].map(([x, y], i) => (
          <path key={i} className="sr-bird" d={`M ${x - 8} ${y} Q ${x} ${y - 7} ${x + 8} ${y} M ${x + 8} ${y} Q ${x + 16} ${y - 7} ${x + 24} ${y}`}
            stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" />
        ))}
        <text className="sr-time" x="200" y="196" textAnchor="middle" fill={accent}
          style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, letterSpacing: "0.2em" }}>05:48 AM</text>
      </svg>
    </div>
  );
}

/* 33 · NIGHT OWL — Corsa notturna: stelle che si accendono, luna e lucciola che traccia il giro */
export function NightOwlScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const STARS = [[80, 50], [130, 36], [186, 58], [250, 32], [300, 52], [340, 78], [110, 86], [270, 84]] as const;
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".no-moon", { opacity: 0, scale: 0.6, transformOrigin: "center", duration: 0.6, ease: "power2.out" })
      .from(".no-star", { opacity: 0, scale: 0, transformOrigin: "center", stagger: 0.07, duration: 0.3, ease: "back.out(3)" }, "-=0.3")
      .fromTo(".no-loop", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.4, ease: "power1.inOut" }, "-=0.3")
      .to(".no-firefly", {
        motionPath: { path: ".no-loop-path", align: ".no-loop-path", alignOrigin: [0.5, 0.5] },
        duration: 1.4, ease: "power1.inOut",
      }, "<")
      .to(".no-firefly", { opacity: 0.3, duration: 0.18, yoyo: true, repeat: 5, ease: "sine.inOut" }, "<")
      .from(".no-pm", { opacity: 0, y: 8, duration: 0.4 }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <path className="no-moon" d="M 322 44 A 22 22 0 1 0 344 72 A 17 17 0 0 1 322 44 Z" fill={accent2} opacity="0.95" />
        {STARS.map(([x, y], i) => (
          <g key={i} className="no-star">
            <line x1={x - 4} y1={y} x2={x + 4} y2={y} stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
            <line x1={x} y1={y - 4} x2={x} y2={y + 4} stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
          </g>
        ))}
        <path className="no-loop no-loop-path"
          d="M 70 178 C 120 140, 180 200, 230 168 S 320 130, 330 166"
          stroke={accent} strokeWidth="2.5" strokeDasharray="1 8" strokeLinecap="round" />
        <circle className="no-firefly" cx="70" cy="178" r="5.5" fill={accent}
          style={{ filter: `drop-shadow(0 0 8px ${accent})` }} />
        <text className="no-pm" x="200" y="222" textAnchor="middle" fill={accent2}
          style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, letterSpacing: "0.25em" }}>22:30 PM</text>
      </svg>
    </div>
  );
}

/* 34 · RAIN RUNNER — Corsa sotto la pioggia: gocce che cadono, il dot avanza impavido con scia */
export function RainRunnerScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const DROPS = Array.from({ length: 16 }, (_, i) => ({ x: 50 + (i * 67) % 300, d: (i % 5) * 0.12 }));
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".rr-drop",
      { y: -36, opacity: 0 },
      { y: 150, opacity: 0.85, duration: 0.7, stagger: { each: 0.06, repeat: 1 }, ease: "power1.in" })
      .fromTo(".rr-splash", { scale: 0, opacity: 0.8, transformOrigin: "center" },
        { scale: 1, opacity: 0, duration: 0.4, stagger: 0.1, ease: "power2.out" }, 0.6)
      .fromTo(".rr-ground", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.6, ease: "power2.inOut" }, 0.1)
      .fromTo(".rr-runner", { x: -40 }, { x: 320, duration: 1.8, ease: "power1.inOut" }, 0.3)
      .fromTo(".rr-wake", { x: -70, opacity: 0 }, { x: 290, opacity: 0.7, duration: 1.8, ease: "power1.inOut" }, 0.32)
      .from(".rr-label", { opacity: 0, duration: 0.4 }, "-=0.4");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {DROPS.map((d, i) => (
          <line key={i} className="rr-drop" x1={d.x} y1="30" x2={d.x - 5} y2="44"
            stroke={accent2} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        ))}
        {[100, 190, 290].map((x, i) => (
          <ellipse key={i} className="rr-splash" cx={x} cy="178" rx="10" ry="2.5" stroke={accent2} strokeWidth="1.5" />
        ))}
        <line className="rr-ground" x1="40" y1="180" x2="360" y2="180" stroke="#3F3F46" strokeWidth="2.5" strokeLinecap="round" />
        <g className="rr-runner">
          <circle cx="40" cy="166" r="8" fill={accent} />
        </g>
        <line className="rr-wake" x1="6" y1="166" x2="40" y2="166" stroke={accent} strokeWidth="3" strokeLinecap="round" opacity="0.5" />
        <text className="rr-label" x="200" y="216" textAnchor="middle" fill={accent}
          style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: "0.3em" }}>NIENTE SCUSE</text>
      </svg>
    </div>
  );
}

/* 35 · SNOWFLAKE — Corsa sotto zero: il fiocco esagonale si disegna braccio per braccio */
export function SnowflakeScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".sf-arm", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.5, stagger: 0.1, ease: "power2.out" })
      .fromTo(".sf-hex", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.6, ease: "power2.inOut" }, "-=0.4")
      .to(".sf-all", { rotation: 28, transformOrigin: "center", duration: 1.0, ease: "power1.inOut" }, "-=0.3")
      .from(".sf-temp", { opacity: 0, scale: 0.7, transformOrigin: "center", duration: 0.4, ease: "back.out(2)" }, "-=0.5")
      .fromTo(".sf-shiver", { x: -1.5 }, { x: 1.5, duration: 0.06, yoyo: true, repeat: 7 }, "-=0.3");
    finish(tl);
  }, { scope: ref });
  const arm = "M 0 0 L 0 -52 M 0 -20 L -9 -30 M 0 -20 L 9 -30 M 0 -38 L -7 -46 M 0 -38 L 7 -46";
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <g className="sf-all">
          {Array.from({ length: 6 }, (_, i) => (
            <path key={i} className="sf-arm" d={arm} stroke={accent2} strokeWidth="2.5" strokeLinecap="round"
              transform={`translate(200 112) rotate(${i * 60})`} />
          ))}
          <path className="sf-hex" d="M 200 96 L 214 104 L 214 120 L 200 128 L 186 120 L 186 104 Z"
            stroke={accent2} strokeWidth="2" transform="rotate(0 200 112)" />
        </g>
        <g className="sf-temp sf-shiver">
          <text x="200" y="206" textAnchor="middle" fill="white"
            style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800 }}>−2°C</text>
        </g>
      </svg>
    </div>
  );
}

/* 36 · HEAT — Corsa oltre i 30°C: il termometro sale e sfora, onde di calore */
export function HeatScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".ht-tube", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.6, ease: "power2.inOut" })
      .from(".ht-bulb", { scale: 0, transformOrigin: "center", duration: 0.3, ease: "back.out(2)" }, "-=0.2")
      .fromTo(".ht-mercury", { scaleY: 0.1, transformOrigin: "center bottom" }, { scaleY: 1, duration: 1.1, ease: "power2.inOut" })
      .to(".ht-bulb-fill", { fill: accent2, duration: 0.3 }, "-=0.3")
      .fromTo(".ht-wave",
        { opacity: 0, y: 10 },
        { opacity: 0.7, y: -16, duration: 0.8, stagger: 0.15, repeat: 1, ease: "power1.out" }, "-=0.6")
      .to(".ht-wave", { opacity: 0, duration: 0.3 })
      .from(".ht-deg", { scale: 0.6, opacity: 0, transformOrigin: "center", duration: 0.4, ease: "back.out(2.4)" }, "-=0.5");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <path className="ht-tube" d="M 188 44 a 12 12 0 0 1 24 0 V 150 a 20 20 0 1 1 -24 0 Z"
          stroke={accent} strokeWidth="2.5" strokeLinejoin="round" />
        <rect className="ht-mercury" x="195" y="58" width="10" height="104" rx="5" fill={accent2} />
        <circle className="ht-bulb" cx="200" cy="168" r="13" stroke={accent} strokeWidth="2.5" />
        <circle className="ht-bulb-fill ht-bulb" cx="200" cy="168" r="9" fill={accent} />
        {[252, 272, 292].map((x, i) => (
          <path key={i} className="ht-wave" d={`M ${x} 130 q 5 -9 0 -18 q -5 -9 0 -18`}
            stroke={accent} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
        ))}
        <text className="ht-deg" x="130" y="120" textAnchor="middle" fill="white"
          style={{ fontFamily: MONO, fontSize: 24, fontWeight: 800 }}>33°C</text>
      </svg>
    </div>
  );
}

/* 37 · PERFECT CHECK — Mese perfetto: cerchio + check DrawSVG + raggiera */
export function PerfectCheckScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".pc-circle", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.8, ease: "power2.inOut" })
      .fromTo(".pc-check", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.45, ease: "power3.out" }, "-=0.15")
      .to(".pc-core", { scale: 1.06, transformOrigin: "center", duration: 0.16, yoyo: true, repeat: 1, ease: "power2.inOut" })
      .fromTo(".pc-burst",
        { drawSVG: "0% 0%", opacity: 1 },
        { drawSVG: "60% 100%", opacity: 0, duration: 0.65, stagger: 0.03, ease: "power2.out" }, "-=0.25")
      .from(".pc-pct", { opacity: 0, y: 10, duration: 0.4 }, "-=0.3");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <g className="pc-core">
          <circle className="pc-circle" cx="200" cy="106" r="52" stroke={accent} strokeWidth="4" strokeLinecap="round" />
          <path className="pc-check" d="M 176 106 L 194 124 L 228 88" stroke={accent2} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const x1 = 200 + Math.cos(a) * 62, y1 = 106 + Math.sin(a) * 62;
          const x2 = 200 + Math.cos(a) * 88, y2 = 106 + Math.sin(a) * 88;
          return <line key={i} className="pc-burst" x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={i % 2 ? accent : accent2} strokeWidth="2.5" strokeLinecap="round" />;
        })}
        <text className="pc-pct" x="200" y="196" textAnchor="middle" fill={accent}
          style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, letterSpacing: "0.25em" }}>PIANO 100%</text>
      </svg>
    </div>
  );
}

/* 38 · PIE WHEEL — Tutti i giorni della settimana coperti: la ruota a 7 spicchi si colora */
export function PieWheelScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".pw-slice", {
      scale: 0, opacity: 0, transformOrigin: "200px 110px", stagger: 0.13, duration: 0.4, ease: "back.out(1.6)",
    })
      .to(".pw-wheel", { rotation: 360 / 14, transformOrigin: "200px 110px", duration: 0.6, ease: "back.out(1.4)" }, "-=0.1")
      .fromTo(".pw-hub", { scale: 0, transformOrigin: "center" }, { scale: 1, duration: 0.35, ease: "back.out(2.4)" }, "-=0.3")
      .from(".pw-sub", { opacity: 0, y: 8, duration: 0.35 }, "-=0.15");
    finish(tl);
  }, { scope: ref });
  const slice = (i: number) => {
    const a0 = (i / 7) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / 7) * Math.PI * 2 - Math.PI / 2;
    const r = 62;
    return `M 200 110 L ${200 + Math.cos(a0) * r} ${110 + Math.sin(a0) * r} A ${r} ${r} 0 0 1 ${200 + Math.cos(a1) * r} ${110 + Math.sin(a1) * r} Z`;
  };
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <g className="pw-wheel">
          {Array.from({ length: 7 }, (_, i) => (
            <path key={i} className="pw-slice" d={slice(i)}
              fill={i % 2 ? `${accent}66` : `${accent2}55`} stroke="#0A0A0A" strokeWidth="2" />
          ))}
        </g>
        <circle className="pw-hub" cx="200" cy="110" r="17" fill="#0A0A0A" stroke="white" strokeWidth="2.5" />
        <text className="pw-hub" x="200" y="115" textAnchor="middle" fill="white"
          style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800 }}>7</text>
        <text className="pw-sub" x="200" y="206" textAnchor="middle" fill={accent}
          style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: "0.3em" }}>OGNI GIORNO COPERTO</text>
      </svg>
    </div>
  );
}
