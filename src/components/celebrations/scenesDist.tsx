import { useRef } from "react";
import { gsap, useGSAP } from "./gsapSetup";
import { MONO, finish, type SceneProps } from "./sceneUtils";

/**
 * Scene VOLUME aggiuntive (10) — chilometraggi, ore, calorie e conteggi corse.
 * Diverse l'una dall'altra: colonne, anelli, griglie, contachilometri-strada.
 */

/* 1 · WEEK-80 — 80 km in una settimana. Colonna che si riempie oltre la tacca. */
export function Week80Scene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".w8-tube", { opacity: 0, scaleY: 0, transformOrigin: "center bottom", duration: 0.4, ease: "power2.out" })
      .from(".w8-day", { opacity: 0, x: -8, stagger: 0.05, duration: 0.25 }, "-=0.2")
      .fromTo(".w8-fill", { scaleY: 0, transformOrigin: "center bottom" }, { scaleY: 1, duration: 1.3, ease: "power2.inOut" }, "-=0.2")
      .fromTo(".w8-notch", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.4 }, "-=0.7")
      .fromTo(".w8-spark", { scale: 0.3, opacity: 0.9, transformOrigin: "center" }, { scale: 2.4, opacity: 0, duration: 0.7, ease: "power2.out" }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <rect className="w8-tube" x="178" y="40" width="44" height="160" rx="22" fill="#0D0D0D" stroke="#27272A" strokeWidth="2" />
        <rect className="w8-fill" x="182" y="44" width="36" height="152" rx="18" fill={accent} opacity="0.85" />
        <circle className="w8-spark" cx="200" cy="48" r="18" stroke={accent2} strokeWidth="2" />
        <line className="w8-notch" x1="226" y1="58" x2="252" y2="58" stroke={accent2} strokeWidth="2.5" strokeLinecap="round" />
        <text x="258" y="62" fill={accent2} style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800 }}>80</text>
        {["L", "M", "M", "G", "V", "S", "D"].map((d, i) => (
          <text key={i} className="w8-day" x="150" y={64 + i * 20} textAnchor="end" fill="#52525B" style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>{d}</text>
        ))}
      </svg>
    </div>
  );
}

/* 2 · MONTH-200 — 200 km in un mese. Anello di 28 segmenti che si accende. */
export function Month200Scene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".m2-seg", { scale: 0, opacity: 0, transformOrigin: "200px 120px", stagger: 0.025, duration: 0.3, ease: "back.out(2)" })
      .from(".m2-core", { scale: 0, transformOrigin: "center", duration: 0.45, ease: "back.out(1.8)" }, "-=0.3");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {Array.from({ length: 28 }, (_, i) => {
          const a = (i / 28) * Math.PI * 2 - Math.PI / 2;
          const x = 200 + Math.cos(a) * 80, y = 120 + Math.sin(a) * 80;
          return <rect key={i} className="m2-seg" x={x - 3} y={y - 7} width="6" height="14" rx="3" fill={i % 7 === 0 ? accent2 : accent} opacity={0.5 + (i % 7 === 0 ? 0.5 : 0.3)} transform={`rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`} />;
        })}
        <g className="m2-core">
          <circle cx="200" cy="120" r="40" fill="#0D0D0D" stroke={accent} strokeWidth="1.5" />
          <text x="200" y="118" textAnchor="middle" fill="white" style={{ fontFamily: MONO, fontSize: 26, fontWeight: 800 }}>200</text>
          <text x="200" y="138" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.2em" }}>KM · MESE</text>
        </g>
      </svg>
    </div>
  );
}

/* 3 · TWO-THOUSAND — 2000 km totali. Strada con cippi, "2000" si pianta. */
export function TwoThousandScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".tt-road", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.3, ease: "power2.inOut" })
      .from(".tt-post", { scaleY: 0, opacity: 0, transformOrigin: "center bottom", stagger: 0.12, duration: 0.3, ease: "back.out(2)" }, "-=1")
      .from(".tt-num", { y: -40, opacity: 0, duration: 0.55, ease: "bounce.out" }, "-=0.2")
      .fromTo(".tt-flash", { scale: 0.4, opacity: 0.8, transformOrigin: "center" }, { scale: 2, opacity: 0, duration: 0.6, ease: "power2.out" }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <path className="tt-road" d="M 30 196 Q 200 176 370 196" stroke={accent} strokeWidth="3.5" strokeLinecap="round" strokeDasharray="0.1 8" />
        {[80, 160, 240, 320].map((x, i) => (
          <g key={i} className="tt-post">
            <line x1={x} y1="190" x2={x} y2="166" stroke="#3F3F46" strokeWidth="2.5" strokeLinecap="round" />
            <rect x={x - 10} y="156" width="20" height="12" rx="2" fill={i % 2 ? accent2 : accent} opacity="0.8" />
          </g>
        ))}
        <circle className="tt-flash" cx="200" cy="92" r="26" stroke={accent} strokeWidth="2.5" />
        <text className="tt-num" x="200" y="104" textAnchor="middle" fill="white" style={{ fontFamily: MONO, fontSize: 52, fontWeight: 800 }}>2000</text>
        <text x="200" y="128" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: "0.4em" }}>KM TOTALI</text>
      </svg>
    </div>
  );
}

/* 4 · YEAR-RING — 1000 km in un anno. Anello di 12 mesi che si chiude. */
export function YearRingScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".yr-arc", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.32, ease: "none", stagger: 0.08 })
      .from(".yr-core", { scale: 0, transformOrigin: "center", duration: 0.5, ease: "back.out(1.8)" }, "-=0.4")
      .fromTo(".yr-glow", { opacity: 0 }, { opacity: 1, duration: 0.4, yoyo: true, repeat: 1, ease: "sine.inOut" }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  const arcs = Array.from({ length: 12 }, (_, i) => {
    const a0 = (i / 12) * Math.PI * 2 - Math.PI / 2 + 0.05;
    const a1 = ((i + 1) / 12) * Math.PI * 2 - Math.PI / 2 - 0.05;
    const r = 78;
    const x0 = 200 + Math.cos(a0) * r, y0 = 120 + Math.sin(a0) * r;
    const x1 = 200 + Math.cos(a1) * r, y1 = 120 + Math.sin(a1) * r;
    return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
  });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <circle className="yr-glow" cx="200" cy="120" r="78" stroke={accent} strokeWidth="10" opacity="0" style={{ filter: "blur(8px)" }} />
        {arcs.map((d, i) => (
          <path key={i} className="yr-arc" d={d} stroke={i % 3 === 0 ? accent2 : accent} strokeWidth="7" strokeLinecap="round" />
        ))}
        <g className="yr-core">
          <circle cx="200" cy="120" r="48" fill="#0D0D0D" stroke={accent} strokeWidth="1.5" />
          <text x="200" y="116" textAnchor="middle" fill="white" style={{ fontFamily: MONO, fontSize: 30, fontWeight: 800 }}>1000</text>
          <text x="200" y="138" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.18em" }}>KM · 365 g</text>
        </g>
      </svg>
    </div>
  );
}

/* 5 · HUNDRED-RUNS — 100 corse. Griglia 10×10 che si riempie. */
export function HundredRunsScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".h1-dot", { scale: 0, opacity: 0, transformOrigin: "center", stagger: { each: 0.012, grid: [10, 10], from: "start" }, duration: 0.3, ease: "back.out(2)" })
      .from(".h1-tag", { scale: 0, transformOrigin: "center", duration: 0.4, ease: "back.out(2)" }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {Array.from({ length: 100 }, (_, i) => {
          const r = Math.floor(i / 10), c = i % 10;
          return <circle key={i} className="h1-dot" cx={128 + c * 16} cy={50 + r * 16} r="4.5" fill={(r + c) % 3 === 0 ? accent2 : accent} opacity={0.7} />;
        })}
        <g className="h1-tag" transform="translate(200 216)">
          <rect x="-46" y="-14" width="92" height="26" rx="13" fill="#0D0D0D" stroke={accent} strokeWidth="1.5" />
          <text x="0" y="4" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, letterSpacing: "0.1em" }}>100 RUN</text>
        </g>
      </svg>
    </div>
  );
}

/* 6 · RUNS-250 — 250 corse. Mattoni che si impilano fino alla tacca 250. */
export function Runs250Scene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".r2-brick", { y: -26, opacity: 0, stagger: 0.06, duration: 0.32, ease: "back.out(1.4)" })
      .fromTo(".r2-mark", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.4 }, "-=0.3")
      .from(".r2-num", { opacity: 0, x: 10, duration: 0.35 }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} className="r2-brick" x={i % 2 ? 168 : 156} y={184 - i * 17} width="76" height="13" rx="3" fill={i % 2 ? accent2 : accent} opacity={0.55 + i * 0.05} />
        ))}
        <line className="r2-mark" x1="150" y1="40" x2="262" y2="40" stroke="white" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round" />
        <text className="r2-num" x="270" y="44" fill="white" style={{ fontFamily: MONO, fontSize: 18, fontWeight: 800 }}>250</text>
      </svg>
    </div>
  );
}

/* 7 · SUNDAY-LONG — lungo domenicale ≥16 km. Striscia settimana + strada da D. */
export function SundayLongScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".sl-cell", { scale: 0, transformOrigin: "center", stagger: 0.05, duration: 0.25, ease: "back.out(2)" })
      .to(".sl-sun", { y: -16, duration: 0.7, ease: "power2.out" }, "-=0.3")
      .from(".sl-sun", { opacity: 0, duration: 0.4 }, "<")
      .fromTo(".sl-road", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.2, ease: "power2.inOut" }, "-=0.4")
      .to(".sl-dot", { motionPath: { path: ".sl-road", align: ".sl-road", alignOrigin: [0.5, 0.5] }, duration: 1.2, ease: "power1.inOut" }, "<")
      .to(".sl-dot", { opacity: 0, duration: 0.2 });
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <circle className="sl-sun" cx="330" cy="80" r="18" fill={accent2} opacity="0.9" />
        {["L", "M", "M", "G", "V", "S", "D"].map((d, i) => {
          const sun = i === 6;
          return (
            <g key={i} className="sl-cell">
              <rect x={60 + i * 30} y="44" width="24" height="24" rx="6" fill={sun ? accent : "#161616"} stroke={sun ? accent : "#27272A"} strokeWidth="1.5" opacity={sun ? 1 : 0.7} />
              <text x={72 + i * 30} y="60" textAnchor="middle" fill={sun ? "#0A0A0A" : "#71717A"} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800 }}>{d}</text>
            </g>
          );
        })}
        <path className="sl-road" d="M 72 78 C 90 140, 200 120, 230 150 S 330 180, 350 196" stroke={accent} strokeWidth="3.5" strokeLinecap="round" strokeDasharray="0.1 8" />
        <circle className="sl-dot" cx="72" cy="78" r="6.5" fill="white" style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />
      </svg>
    </div>
  );
}

/* 8 · TWENTY-HOURS — 20 ore in un mese. Quadrante con arco che si riempie. */
export function TwentyHoursScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".th-tick", { scale: 0, transformOrigin: "200px 120px", stagger: 0.03, duration: 0.25, ease: "back.out(2)" })
      .fromTo(".th-arc", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.4, ease: "power2.inOut" }, "-=0.4")
      .fromTo(".th-hand", { rotation: -90, transformOrigin: "200px 120px" }, { rotation: 198, duration: 1.4, ease: "power2.inOut" }, "<")
      .from(".th-core", { scale: 0, transformOrigin: "center", duration: 0.4, ease: "back.out(1.8)" }, "-=0.3");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          return <line key={i} className="th-tick" x1={200 + Math.cos(a) * 78} y1={120 + Math.sin(a) * 78} x2={200 + Math.cos(a) * (i % 3 === 0 ? 66 : 71)} y2={120 + Math.sin(a) * (i % 3 === 0 ? 66 : 71)} stroke={i % 3 === 0 ? accent : "#3F3F46"} strokeWidth={i % 3 === 0 ? 3 : 2} strokeLinecap="round" />;
        })}
        <path className="th-arc" d="M 200 38 A 82 82 0 1 1 134 152" stroke={accent} strokeWidth="6" strokeLinecap="round" opacity="0.85" />
        <line className="th-hand" x1="200" y1="120" x2="200" y2="58" stroke={accent2} strokeWidth="3.5" strokeLinecap="round" />
        <g className="th-core">
          <circle cx="200" cy="120" r="22" fill="#0D0D0D" stroke={accent} strokeWidth="1.5" />
          <text x="200" y="126" textAnchor="middle" fill="white" style={{ fontFamily: MONO, fontSize: 16, fontWeight: 800 }}>20h</text>
        </g>
      </svg>
    </div>
  );
}

/* 9 · CALORIE-BURN — >1000 kcal. Barra di fuoco che brucia + braci. */
export function CalorieBurnScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".cb-frame", { opacity: 0, scaleX: 0.7, transformOrigin: "left center", duration: 0.4 })
      .fromTo(".cb-fill", { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: 1.4, ease: "power2.in" }, "-=0.1")
      .to(".cb-tip", { x: 232, duration: 1.4, ease: "power2.in" }, "<")
      .fromTo(".cb-ember", { y: 0, opacity: 0 }, { y: -40, opacity: 1, stagger: 0.12, duration: 1, ease: "power1.out" }, "-=1.2")
      .to(".cb-ember", { opacity: 0, duration: 0.5, stagger: 0.12 }, "-=0.6")
      .from(".cb-tag", { opacity: 0, scale: 0.6, transformOrigin: "center", duration: 0.4, ease: "back.out(2)" }, "-=0.8");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {[90, 150, 210].map((x, i) => (
          <circle key={i} className="cb-ember" cx={x} cy="124" r={3 + (i % 2)} fill={i % 2 ? accent : accent2} opacity="0" />
        ))}
        <rect className="cb-frame" x="84" y="132" width="232" height="24" rx="12" fill="#0D0D0D" stroke="#27272A" strokeWidth="2" />
        <rect className="cb-fill" x="88" y="136" width="224" height="16" rx="8" fill={accent} opacity="0.9" />
        <g className="cb-tip" transform="translate(88 144)">
          <path d="M 0 -10 C 8 -2, 10 4, 4 10 C 1 6, -2 6, -4 2 C -2 -2, -2 -6, 0 -10 Z" fill={accent2} />
        </g>
        <g className="cb-tag" transform="translate(200 188)">
          <text x="0" y="0" textAnchor="middle" fill="white" style={{ fontFamily: MONO, fontSize: 26, fontWeight: 800 }}>1000</text>
          <text x="0" y="20" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: "0.3em" }}>KCAL</text>
        </g>
      </svg>
    </div>
  );
}

/* 10 · FOUR-WEEKS — 4 settimane piene. Blocchi-settimana timbrati in sequenza. */
export function FourWeeksScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".fw-week", { scale: 0, transformOrigin: "center", stagger: 0.18, duration: 0.35, ease: "back.out(1.8)" })
      .from(".fw-check", { scale: 0, transformOrigin: "center", stagger: 0.18, duration: 0.3, ease: "back.out(2.5)" }, 0.25)
      .fromTo(".fw-link", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.3, stagger: 0.18 }, 0.4);
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {Array.from({ length: 3 }, (_, i) => (
          <line key={i} className="fw-link" x1={106 + i * 64} y1="120" x2={138 + i * 64} y2="120" stroke={accent2} strokeWidth="3" strokeLinecap="round" />
        ))}
        {Array.from({ length: 4 }, (_, i) => (
          <g key={i} transform={`translate(${82 + i * 64} 120)`}>
            <rect className="fw-week" x="-22" y="-22" width="44" height="44" rx="11" fill="#0D0D0D" stroke={accent} strokeWidth="2" />
            <path className="fw-check" d="M -9 0 L -3 7 L 10 -8" stroke={accent} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </g>
        ))}
        <text x="200" y="186" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: "0.3em" }}>4 SETTIMANE</text>
      </svg>
    </div>
  );
}
