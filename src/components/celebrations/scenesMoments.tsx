import { useRef } from "react";
import { gsap, useGSAP } from "./gsapSetup";
import { MONO, finish, type SceneProps } from "./sceneUtils";

/**
 * Scene COSTANZA aggiuntive (10) — condizioni estreme e momenti speciali.
 * Sole, vento, nebbia, alba, capodanno, compleanno, pista: ognuna un mondo.
 */

/* 1 · HEAT-PEAK — caldo record > 32°C. Sole con corona + colonna al picco. */
export function HeatPeakScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".hp-sun", { scale: 0, transformOrigin: "center", duration: 0.5, ease: "back.out(1.8)" })
      .from(".hp-ray", { scaleY: 0, opacity: 0, transformOrigin: "center bottom", stagger: 0.04, duration: 0.4, ease: "back.out(2)" }, "-=0.2")
      .to(".hp-ray", { scaleY: 1.15, transformOrigin: "center bottom", duration: 0.6, yoyo: true, repeat: 2, ease: "sine.inOut", stagger: { each: 0.02, from: "center" } }, "-=0.2")
      .fromTo(".hp-col", { scaleY: 0, transformOrigin: "center bottom" }, { scaleY: 1, duration: 0.9, ease: "power2.out" }, "-=1.4")
      .fromTo(".hp-peak", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.3 }, "-=0.5");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const x = 150 + Math.cos(a) * 50, y = 110 + Math.sin(a) * 50;
          return <line key={i} className="hp-ray" x1={x} y1={y} x2={150 + Math.cos(a) * 66} y2={110 + Math.sin(a) * 66} stroke={i % 2 ? accent2 : accent} strokeWidth="3.5" strokeLinecap="round" />;
        })}
        <circle className="hp-sun" cx="150" cy="110" r="34" fill={accent} opacity="0.9" />
        <rect x="300" y="60" width="20" height="120" rx="10" fill="#0D0D0D" stroke="#27272A" strokeWidth="2" />
        <rect className="hp-col" x="304" y="64" width="12" height="112" rx="6" fill={accent2} />
        <line className="hp-peak" x1="324" y1="76" x2="346" y2="76" stroke={accent2} strokeWidth="2.5" strokeLinecap="round" />
        <text x="350" y="80" fill={accent2} style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800 }}>32°</text>
      </svg>
    </div>
  );
}

/* 2 · BIRTHDAY — corsa nel giorno del compleanno. Candela + coriandoli. */
export function BirthdayScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".bd-base", { scaleX: 0, transformOrigin: "center", duration: 0.4, ease: "power3.out" })
      .from(".bd-candle", { scaleY: 0, transformOrigin: "center bottom", duration: 0.4, ease: "back.out(1.6)" }, "-=0.1")
      .fromTo(".bd-flame", { scale: 0, transformOrigin: "center bottom", opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(2)" })
      .to(".bd-flame", { scaleY: 1.18, scaleX: 0.92, transformOrigin: "center bottom", duration: 0.4, yoyo: true, repeat: 3, ease: "sine.inOut" })
      .fromTo(".bd-confetti", { y: 0, opacity: 0, scale: 0 }, { y: () => -30 - Math.random() * 40, opacity: 1, scale: 1, duration: 0.7, stagger: 0.03, ease: "power2.out" }, "-=1.2")
      .to(".bd-confetti", { y: "+=60", opacity: 0, duration: 0.9, stagger: 0.03, ease: "power1.in" }, "-=0.5");
    finish(tl);
  }, { scope: ref });
  const cols = ["#C0FF00", "#22D3EE", "#F472B6", "#F59E0B", "#A78BFA"];
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {Array.from({ length: 14 }, (_, i) => (
          <rect key={i} className="bd-confetti" x={130 + (i * 11) % 140} y="120" width="6" height="6" rx="1.5" fill={cols[i % cols.length]} transform={`rotate(${i * 24} ${133 + (i * 11) % 140} 123)`} />
        ))}
        <rect className="bd-base" x="150" y="172" width="100" height="22" rx="6" fill="#0D0D0D" stroke={accent} strokeWidth="2" />
        <rect className="bd-candle" x="194" y="120" width="12" height="52" rx="3" fill={accent2} />
        <path className="bd-flame" d="M 200 100 C 208 110, 210 118, 200 124 C 190 118, 192 110, 200 100 Z" fill={accent} />
        <text x="200" y="214" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: "0.2em" }}>BUON COMPLEANNO</text>
      </svg>
    </div>
  );
}

/* 3 · TRACK-OVAL — allenamento in pista. Ovale a corsie + dot che gira. */
export function TrackOvalScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".to-lane", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.9, ease: "power2.inOut", stagger: 0.12 })
      .to(".to-dot", { motionPath: { path: ".to-inner", align: ".to-inner", alignOrigin: [0.5, 0.5] }, duration: 1.5, ease: "power1.inOut" }, "-=0.7")
      .from(".to-num", { opacity: 0, scale: 0.5, transformOrigin: "center", stagger: 0.06, duration: 0.3, ease: "back.out(2)" }, "-=1.2")
      .to(".to-dot", { opacity: 0, duration: 0.2 });
    finish(tl);
  }, { scope: ref });
  const lane = (r: number) => `M 140 ${120 - r} H 260 A ${r} ${r} 0 0 1 260 ${120 + r} H 140 A ${r} ${r} 0 0 1 140 ${120 - r} Z`;
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {[58, 46, 34].map((r, i) => (
          <path key={i} className={`to-lane ${i === 2 ? "to-inner" : ""}`} d={lane(r)} stroke={i === 2 ? accent : "#3F3F46"} strokeWidth={i === 2 ? 3 : 2} strokeLinecap="round" opacity={i === 2 ? 1 : 0.6} />
        ))}
        {[1, 2, 3].map((n, i) => (
          <text key={n} className="to-num" x="200" y={84 + i * 14} textAnchor="middle" fill="#52525B" style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700 }}>{n}</text>
        ))}
        <circle className="to-dot" cx="140" cy="62" r="6.5" fill="white" style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />
      </svg>
    </div>
  );
}

/* 4 · WIND — vento forte. Raffiche che sfrecciano + bandiera che frusta. */
export function WindScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".wd-gust", { drawSVG: "0% 0%", opacity: 0 }, { drawSVG: "0% 100%", opacity: 0.8, duration: 0.6, stagger: 0.1, ease: "power2.out" })
      .to(".wd-gust", { x: 40, opacity: 0, duration: 0.5, stagger: 0.08 }, "-=0.3")
      .from(".wd-pole", { scaleY: 0, transformOrigin: "center bottom", duration: 0.4 }, "-=0.6")
      .from(".wd-flag", { scaleX: 0, transformOrigin: "left center", duration: 0.35 }, "-=0.2")
      .to(".wd-flag", { skewY: 6, scaleX: 0.94, duration: 0.25, yoyo: true, repeat: 5, ease: "sine.inOut", transformOrigin: "left center" });
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {[70, 104, 138, 172].map((y, i) => (
          <path key={i} className="wd-gust" d={`M 50 ${y} q 60 -10 130 0 q 40 6 90 -2`} stroke={i % 2 ? accent2 : accent} strokeWidth="2.5" strokeLinecap="round" opacity="0" />
        ))}
        <line className="wd-pole" x1="300" y1="180" x2="300" y2="80" stroke={accent2} strokeWidth="3" strokeLinecap="round" />
        <path className="wd-flag" d="M 300 84 L 348 92 Q 332 100 348 108 L 300 116 Z" fill={accent} opacity="0.9" />
      </svg>
    </div>
  );
}

/* 5 · HUMIDITY — umidità > 90%. Goccia che si riempie + condensa. */
export function HumidityScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".hu-drop", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.0, ease: "power2.inOut" })
      .fromTo(".hu-fill", { scaleY: 0, transformOrigin: "center bottom" }, { scaleY: 0.92, duration: 1.1, ease: "power2.out" }, "-=0.4")
      .from(".hu-cond", { scale: 0, opacity: 0, transformOrigin: "center", stagger: 0.05, duration: 0.3, ease: "back.out(2)" }, "-=0.8")
      .from(".hu-pct", { scale: 0, transformOrigin: "center", duration: 0.4, ease: "back.out(2)" }, "-=0.3");
    finish(tl);
  }, { scope: ref });
  const drop = "M 200 60 C 230 102, 250 128, 250 152 A 50 50 0 1 1 150 152 C 150 128, 170 102, 200 60 Z";
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {[120, 270, 140, 250].map((x, i) => (
          <circle key={i} className="hu-cond" cx={x} cy={70 + (i % 2) * 110} r={3 + (i % 2)} fill={accent2} opacity="0.7" />
        ))}
        <clipPath id="hu-clip"><path d={drop} /></clipPath>
        <rect className="hu-fill" x="150" y="100" width="100" height="110" fill={accent} opacity="0.55" clipPath="url(#hu-clip)" />
        <path className="hu-drop" d={drop} stroke={accent} strokeWidth="3.5" strokeLinecap="round" />
        <g className="hu-pct">
          <text x="200" y="168" textAnchor="middle" fill="white" style={{ fontFamily: MONO, fontSize: 28, fontWeight: 800 }}>92%</text>
        </g>
      </svg>
    </div>
  );
}

/* 6 · FOG — corsa nella nebbia. Bande che derivano + dot che emerge. */
export function FogScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".fo-path", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.2, ease: "power2.inOut" })
      .to(".fo-dot", { motionPath: { path: ".fo-path", align: ".fo-path", alignOrigin: [0.5, 0.5] }, duration: 1.2, ease: "power1.inOut" }, "<")
      .fromTo(".fo-band", { x: -60, opacity: 0 }, { x: 0, opacity: 0.5, duration: 0.8, stagger: 0.12, ease: "power1.out" }, "-=1")
      .to(".fo-band", { x: 30, duration: 1.4, ease: "sine.inOut", stagger: 0.1 }, "-=0.5")
      .to(".fo-dot", { opacity: 0, duration: 0.3 }, "-=1");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <path className="fo-path" d="M 50 170 C 120 150, 180 178, 250 150 S 350 140, 360 150" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeDasharray="0.1 8" opacity="0.7" />
        <circle className="fo-dot" cx="50" cy="170" r="7" fill="white" style={{ filter: `drop-shadow(0 0 8px ${accent})` }} />
        {[70, 96, 122, 148].map((y, i) => (
          <rect key={i} className="fo-band" x="40" y={y} width="320" height="10" rx="5" fill={i % 2 ? accent2 : "#FFFFFF"} opacity="0" />
        ))}
      </svg>
    </div>
  );
}

/* 7 · DAWN-TEN — 10 albe (corse pre-6:00). Orizzonte + sole sliver + stelle. */
export function DawnTenScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".dt-star", { scale: 0, opacity: 0, transformOrigin: "center", stagger: 0.05, duration: 0.3, ease: "back.out(2)" })
      .fromTo(".dt-horizon", { drawSVG: "50% 50%" }, { drawSVG: "0% 100%", duration: 0.6, ease: "power2.out" }, "-=0.4")
      .fromTo(".dt-sun", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power2.out" }, "-=0.2")
      .from(".dt-ray", { scaleX: 0, transformOrigin: "center", stagger: 0.05, duration: 0.4, ease: "power2.out" }, "-=0.5")
      .from(".dt-tag", { opacity: 0, scale: 0.6, transformOrigin: "center", duration: 0.4, ease: "back.out(2)" }, "-=0.3");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {Array.from({ length: 10 }, (_, i) => (
          <circle key={i} className="dt-star" cx={70 + (i * 31) % 270} cy={40 + (i % 3) * 18} r="2.5" fill={accent2} opacity="0.8" />
        ))}
        {[-40, -20, 0, 20, 40].map((dx, i) => (
          <line key={i} className="dt-ray" x1={200 + dx * 1.4} y1="118" x2={200 + dx * 2} y2="96" stroke={accent} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
        ))}
        <path className="dt-sun" d="M 168 150 A 32 32 0 0 1 232 150 Z" fill={accent} opacity="0.9" />
        <line className="dt-horizon" x1="40" y1="150" x2="360" y2="150" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
        <g className="dt-tag" transform="translate(200 188)">
          <rect x="-40" y="-14" width="80" height="26" rx="13" fill="#0D0D0D" stroke={accent2} strokeWidth="1.5" />
          <text x="0" y="4" textAnchor="middle" fill={accent2} style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800 }}>10 ALBE</text>
        </g>
      </svg>
    </div>
  );
}

/* 8 · YEAR-STREAK — 365 giorni di fila. Anello di tacche che si chiude. */
export function YearStreakScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".yz-tick", { scale: 0, transformOrigin: "200px 120px", stagger: 0.012, duration: 0.2, ease: "power2.out" })
      .from(".yz-core", { scale: 0, transformOrigin: "center", duration: 0.5, ease: "back.out(1.8)" }, "-=0.3")
      .fromTo(".yz-glow", { opacity: 0 }, { opacity: 1, duration: 0.4, yoyo: true, repeat: 1, ease: "sine.inOut" }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <circle className="yz-glow" cx="200" cy="120" r="82" stroke={accent} strokeWidth="8" opacity="0" style={{ filter: "blur(8px)" }} />
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
          const x = 200 + Math.cos(a) * 82, y = 120 + Math.sin(a) * 82;
          return <rect key={i} className="yz-tick" x={x - 1.6} y={y - 6} width="3.2" height="12" rx="1.6" fill={i % 5 === 0 ? accent2 : accent} opacity={0.5 + (i % 5 === 0 ? 0.5 : 0.3)} transform={`rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`} />;
        })}
        <g className="yz-core">
          <circle cx="200" cy="120" r="50" fill="#0D0D0D" stroke={accent} strokeWidth="1.5" />
          <text x="200" y="116" textAnchor="middle" fill="white" style={{ fontFamily: MONO, fontSize: 34, fontWeight: 800 }}>365</text>
          <text x="200" y="138" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.2em" }}>GIORNI</text>
        </g>
      </svg>
    </div>
  );
}

/* 9 · WEEKEND — ogni weekend del mese. 4 coppie Sab+Dom che si accendono. */
export function WeekendScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".we-cell", { scale: 0, transformOrigin: "center", stagger: 0.07, duration: 0.3, ease: "back.out(2)" })
      .from(".we-shield", { scale: 0, transformOrigin: "center", duration: 0.45, ease: "back.out(1.8)" }, "-=0.2")
      .fromTo(".we-check", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.3, ease: "power2.out" }, "-=0.1");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {Array.from({ length: 4 }, (_, w) => (
          <g key={w}>
            {["S", "D"].map((d, j) => (
              <g key={j} className="we-cell">
                <rect x={70 + w * 66 + j * 26} y="52" width="22" height="22" rx="6" fill={accent} opacity={0.85} />
                <text x={81 + w * 66 + j * 26} y="68" textAnchor="middle" fill="#0A0A0A" style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800 }}>{d}</text>
              </g>
            ))}
          </g>
        ))}
        <g className="we-shield" transform="translate(200 150)">
          <path d="M 0 -30 L 30 -18 V 6 C 30 24, 16 34, 0 42 C -16 34, -30 24, -30 6 V -18 Z" fill="#0D0D0D" stroke={accent2} strokeWidth="2.5" />
          <path className="we-check" d="M -12 2 L -3 12 L 14 -10" stroke={accent2} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      </svg>
    </div>
  );
}

/* 10 · NEW-YEAR — corsa di Capodanno. Countdown 3·2·1 → GO + fuoco d'artificio. */
export function NewYearScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".ny-3", { scale: 1.6, opacity: 0, transformOrigin: "center" }, { scale: 1, opacity: 1, duration: 0.3, ease: "power2.out" })
      .to(".ny-3", { opacity: 0, scale: 0.7, duration: 0.2 }, "+=0.15")
      .fromTo(".ny-2", { scale: 1.6, opacity: 0, transformOrigin: "center" }, { scale: 1, opacity: 1, duration: 0.3, ease: "power2.out" }, "-=0.05")
      .to(".ny-2", { opacity: 0, scale: 0.7, duration: 0.2 }, "+=0.15")
      .fromTo(".ny-1", { scale: 1.6, opacity: 0, transformOrigin: "center" }, { scale: 1, opacity: 1, duration: 0.3, ease: "power2.out" }, "-=0.05")
      .to(".ny-1", { opacity: 0, scale: 0.7, duration: 0.2 }, "+=0.15")
      .from(".ny-go", { scale: 0, transformOrigin: "center", duration: 0.45, ease: "back.out(2.2)" }, "-=0.05")
      .fromTo(".ny-burst", { drawSVG: "50% 50%", opacity: 1 }, { drawSVG: "0% 100%", duration: 0.5, stagger: 0.02, ease: "power2.out" }, "-=0.3")
      .to(".ny-burst", { opacity: 0, duration: 0.5 }, "-=0.1")
      .from(".ny-date", { opacity: 0, y: 8, duration: 0.4 }, "-=0.5");
    finish(tl);
  }, { scope: ref });
  const cd = { fontFamily: MONO, fontSize: 64, fontWeight: 800 } as const;
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <line key={i} className="ny-burst" x1={200 + Math.cos(a) * 24} y1={104 + Math.sin(a) * 24} x2={200 + Math.cos(a) * 70} y2={104 + Math.sin(a) * 70} stroke={i % 2 ? accent2 : accent} strokeWidth="3" strokeLinecap="round" opacity="0" />;
        })}
        <text className="ny-3" x="200" y="126" textAnchor="middle" fill="#52525B" style={cd}>3</text>
        <text className="ny-2" x="200" y="126" textAnchor="middle" fill="#71717A" style={cd}>2</text>
        <text className="ny-1" x="200" y="126" textAnchor="middle" fill={accent2} style={cd}>1</text>
        <text className="ny-go" x="200" y="120" textAnchor="middle" fill="white" style={{ fontFamily: MONO, fontSize: 52, fontWeight: 800 }}>GO!</text>
        <text className="ny-date" x="200" y="184" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 14, fontWeight: 800, letterSpacing: "0.3em" }}>01 · 01</text>
      </svg>
    </div>
  );
}
