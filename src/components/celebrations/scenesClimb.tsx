import { useRef } from "react";
import { gsap, useGSAP } from "./gsapSetup";
import { MONO, finish, type SceneProps } from "./sceneUtils";

/**
 * Scene SALITE & TERRENO — 8 celebrazioni su dislivello, trail e pendenze.
 */

/* 21 · STRATA — 1000 m D+ in una settimana: gli strati di montagna si impilano dal basso */
export function StrataScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const LAYERS = [
    { d: "M 60 200 L 200 196 L 340 200 L 340 208 L 60 208 Z", o: 0.25 },
    { d: "M 80 168 L 200 150 L 320 168 L 332 200 L 68 200 Z", o: 0.4 },
    { d: "M 104 132 L 200 108 L 296 132 L 314 166 L 86 166 Z", o: 0.6 },
    { d: "M 136 96 L 200 70 L 264 96 L 288 130 L 112 130 Z", o: 0.85 },
  ];
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".sa-layer", { y: 70, opacity: 0, stagger: 0.18, duration: 0.55, ease: "power3.out" })
      .fromTo(".sa-peak", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.5, ease: "power2.inOut" }, "-=0.2")
      .from(".sa-dplus", { scale: 0, opacity: 0, transformOrigin: "center", duration: 0.4, ease: "back.out(2.2)" }, "-=0.15")
      .to(".sa-layer", { y: -3, duration: 0.25, stagger: 0.05, yoyo: true, repeat: 1, ease: "sine.inOut" }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {LAYERS.map((l, i) => (
          <path key={i} className="sa-layer" d={l.d} fill={`${accent}${Math.round(l.o * 99).toString(16).padStart(2, "0")}`}
            stroke={accent} strokeWidth="1.5" strokeLinejoin="round" />
        ))}
        <path className="sa-peak" d="M 168 70 L 200 44 L 232 70" stroke={accent2} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <text className="sa-dplus" x="200" y="34" textAnchor="middle" fill={accent2}
          style={{ fontFamily: MONO, fontSize: 16, fontWeight: 800 }}>D+</text>
      </svg>
    </div>
  );
}

/* 22 · TRAIL — Prima corsa in trail: sentiero zigzag che si disegna, alberi che spuntano */
export function TrailScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const TREES = [[96, 170], [150, 120], [256, 148], [310, 96], [218, 76]] as const;
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".tr-trail", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.5, ease: "power1.inOut" })
      .from(".tr-tree", { scaleY: 0, transformOrigin: "center bottom", stagger: 0.14, duration: 0.4, ease: "back.out(1.8)" }, 0.3)
      .to(".tr-hiker", {
        motionPath: { path: ".tr-trail-path", align: ".tr-trail-path", alignOrigin: [0.5, 0.5] },
        duration: 1.5, ease: "power1.inOut",
      }, 0)
      .fromTo(".tr-flag", { scale: 0, transformOrigin: "center bottom" }, { scale: 1, duration: 0.35, ease: "back.out(2.4)" }, "-=0.1");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <path className="tr-trail tr-trail-path"
          d="M 56 200 L 132 186 L 108 150 L 196 136 L 168 102 L 268 92 L 240 64 L 330 56"
          stroke={accent} strokeWidth="3" strokeDasharray="8 8" strokeLinecap="round" strokeLinejoin="round" />
        {TREES.map(([x, y], i) => (
          <g key={i} className="tr-tree">
            <path d={`M ${x} ${y} L ${x - 9} ${y + 16} H ${x + 9} Z`} fill={`${accent2}AA`} />
            <path d={`M ${x} ${y - 12} L ${x - 7} ${y + 2} H ${x + 7} Z`} fill={accent2} />
            <line x1={x} y1={y + 16} x2={x} y2={y + 22} stroke="#52525B" strokeWidth="2.5" />
          </g>
        ))}
        <circle className="tr-hiker" cx="56" cy="200" r="7" fill="white" />
        <g className="tr-flag">
          <line x1="330" y1="56" x2="330" y2="32" stroke={accent2} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 330 32 L 348 38 L 330 44 Z" fill={accent2} />
        </g>
      </svg>
    </div>
  );
}

/* 23 · INCLINE — Record pendenza media: il piano si inclina con goniometro che misura l'angolo */
export function InclineScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".ic-base", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.5, ease: "power2.out" })
      .fromTo(".ic-slope",
        { rotation: 0, transformOrigin: "80px 180px" },
        { rotation: -16, duration: 1.1, ease: "power3.inOut" }, "+=0.15")
      .fromTo(".ic-arc", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.7, ease: "power2.inOut" }, "-=0.6")
      // sale lungo il piano inclinato: endpoint = (330,180) ruotato -16° attorno a (80,180)
      .to(".ic-dot", { x: 240.3, y: -68.9, duration: 0.8, ease: "power2.in" }, "-=0.45")
      .from(".ic-pct", { opacity: 0, scale: 0.6, transformOrigin: "center", duration: 0.4, ease: "back.out(2.4)" }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <line className="ic-base" x1="80" y1="180" x2="330" y2="180" stroke="#3F3F46" strokeWidth="2.5" strokeLinecap="round" />
        <g className="ic-slope">
          <line className="ic-slope-line" x1="80" y1="180" x2="330" y2="180" stroke={accent} strokeWidth="3.5" strokeLinecap="round" />
        </g>
        <path className="ic-arc" d="M 160 180 A 80 80 0 0 0 157 158" stroke={accent2} strokeWidth="2.5" strokeLinecap="round" />
        <circle className="ic-dot" cx="80" cy="180" r="6.5" fill={accent2} />
        <text className="ic-pct" x="196" y="148" textAnchor="middle" fill="white"
          style={{ fontFamily: MONO, fontSize: 24, fontWeight: 800 }}>12%</text>
      </svg>
    </div>
  );
}

/* 24 · CABLEWAY — Salita non-stop più lunga: la cabinovia sale lungo il cavo senza fermarsi */
export function CablewayScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".cb-pylon", { scaleY: 0, transformOrigin: "center bottom", stagger: 0.15, duration: 0.4, ease: "power3.out" })
      .fromTo(".cb-cable", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.8, ease: "power2.inOut" }, "-=0.2")
      .to(".cb-cabin", {
        motionPath: { path: ".cb-cable-path", align: ".cb-cable-path", alignOrigin: [0.5, 0] },
        duration: 1.7, ease: "none",
      }, "-=0.2")
      .fromTo(".cb-top-ring", { scale: 0.4, opacity: 0.9, transformOrigin: "338px 58px" },
        { scale: 1.8, opacity: 0, duration: 0.6, ease: "power2.out" }, "-=0.25")
      .from(".cb-nonstop", { opacity: 0, letterSpacing: "0.8em", duration: 0.5, ease: "power3.out" }, "-=0.3");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <line className="cb-pylon" x1="120" y1="200" x2="120" y2="138" stroke="#52525B" strokeWidth="4" strokeLinecap="round" />
        <line className="cb-pylon" x1="240" y1="200" x2="240" y2="96" stroke="#52525B" strokeWidth="4" strokeLinecap="round" />
        <path className="cb-cable cb-cable-path" d="M 56 178 Q 120 130 240 88 T 338 58" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
        <g className="cb-cabin">
          <line x1="0" y1="0" x2="0" y2="10" stroke={accent2} strokeWidth="2" />
          <rect x="-9" y="10" width="18" height="14" rx="4" fill="#141414" stroke={accent2} strokeWidth="2" />
        </g>
        <circle className="cb-top-ring" cx="338" cy="58" r="14" stroke={accent2} strokeWidth="2.5" />
        <text className="cb-nonstop" x="200" y="222" textAnchor="middle" fill={accent}
          style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: "0.35em" }}>SALITA NON-STOP</text>
      </svg>
    </div>
  );
}

/* 25 · DOWNHILL — Record velocità in discesa: dot che accelera giù con linee d'aria */
export function DownhillScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".dh-slope", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.7, ease: "power2.inOut" })
      .to(".dh-rider", {
        motionPath: { path: ".dh-slope-path", align: ".dh-slope-path", alignOrigin: [0.5, 0.8] },
        duration: 1.0, ease: "power3.in",
      }, "-=0.15")
      .fromTo(".dh-wind",
        { opacity: 0, x: 26 },
        { opacity: 0.85, x: -36, duration: 0.5, stagger: 0.07, ease: "power2.out" }, "-=0.45")
      .to(".dh-wind", { opacity: 0, duration: 0.3 })
      .fromTo(".dh-skid", { scaleX: 0, opacity: 0.9, transformOrigin: "left center" },
        { scaleX: 1, opacity: 0, duration: 0.6, ease: "power2.out" }, "-=0.5")
      .from(".dh-kmh", { scale: 0.5, opacity: 0, transformOrigin: "center", duration: 0.4, ease: "back.out(2.2)" }, "-=0.4");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <path className="dh-slope dh-slope-path" d="M 60 64 C 130 78, 200 120, 332 188" stroke={accent} strokeWidth="3.5" strokeLinecap="round" />
        <circle className="dh-rider" cx="60" cy="60" r="8" fill={accent2} />
        {[0, 1, 2].map((i) => (
          <line key={i} className="dh-wind" x1={210 + i * 22} y1={96 + i * 26} x2={258 + i * 22} y2={88 + i * 26}
            stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        ))}
        <line className="dh-skid" x1="296" y1="192" x2="344" y2="192" stroke={accent2} strokeWidth="3" strokeLinecap="round" />
        <text className="dh-kmh" x="140" y="180" textAnchor="middle" fill="white"
          style={{ fontFamily: MONO, fontSize: 26, fontWeight: 800, fontStyle: "italic" }}>22,4</text>
        <text x="140" y="198" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.2em" }}
          className="dh-kmh">KM/H ↓</text>
      </svg>
    </div>
  );
}

/* 26 · ALTIMETER — Vetta più alta: il rullo delle quote sale, le nuvole passano sotto */
export function AltimeterScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".al-frame", { opacity: 0, scale: 0.94, transformOrigin: "center", duration: 0.4, ease: "power3.out" })
      .fromTo(".al-roll", { yPercent: 0 }, { yPercent: -75, duration: 1.6, ease: "power3.inOut" }, 0.25)
      .from(".al-cloud", { x: 90, opacity: 0, stagger: 0.2, duration: 0.9, ease: "power1.out" }, 0.4)
      .to(".al-cloud", { x: -60, opacity: 0, stagger: 0.2, duration: 0.9, ease: "power1.in" }, 1.2)
      .fromTo(".al-needle", { scaleX: 0.4, opacity: 0, transformOrigin: "left center" },
        { scaleX: 1, opacity: 1, duration: 0.35, ease: "power3.out" }, 1.5)
      .from(".al-unit", { opacity: 0, duration: 0.3 }, "-=0.15");
    finish(tl);
  }, { scope: ref });
  const QUOTE = ["400", "800", "1200", "1650"];
  return (
    <div ref={ref} className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {[58, 150].map((top, i) => (
        <svg key={i} className="al-cloud absolute" style={{ top, left: 60 + i * 200 }} width="64" height="22" viewBox="0 0 64 22" fill="none">
          <path d="M 8 18 Q 2 18 2 12 Q 2 6 9 6 Q 12 0 20 2 Q 28 -2 33 5 Q 42 3 44 10 Q 50 10 50 14 Q 50 18 44 18 Z"
            fill="#27272A" opacity="0.8" transform="scale(1.2)" />
        </svg>
      ))}
      <div className="al-frame relative rounded-2xl border px-8 py-3 overflow-hidden"
        style={{ borderColor: `${accent}55`, background: "#0D0D0D", height: 84 }}>
        <div className="al-roll flex flex-col items-center">
          {QUOTE.map((q, i) => (
            <div key={i} className="flex items-center justify-center"
              style={{ fontFamily: MONO, fontSize: 40, fontWeight: 800, height: 60, lineHeight: 1, color: i === 3 ? accent : "#3F3F46" }}>
              {q}
            </div>
          ))}
        </div>
        <div className="al-needle absolute left-1 top-1/2 -translate-y-1/2 w-4 h-[3px] rounded-full" style={{ background: accent2 }} />
        <div className="al-needle absolute right-1 top-1/2 -translate-y-1/2 w-4 h-[3px] rounded-full" style={{ background: accent2 }} />
      </div>
      <div className="al-unit absolute bottom-8 text-[11px] font-black tracking-[0.4em] uppercase" style={{ color: accent }}>
        metri s.l.m.
      </div>
    </div>
  );
}

/* 27 · EVEREST — Dislivello cumulato = Everest: la sagoma si disegna e l'8848 si compone */
export function EverestScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".ev-outline", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.3, ease: "power2.inOut" })
      .fromTo(".ev-snow", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.5, ease: "power2.out" }, "-=0.35")
      .from(".ev-digit", { yPercent: 110, opacity: 0, stagger: 0.09, duration: 0.45, ease: "back.out(1.8)" }, "-=0.3")
      .fromTo(".ev-flag-pole", { scaleY: 0, transformOrigin: "center bottom" }, { scaleY: 1, duration: 0.25, ease: "power3.out" }, "-=0.2")
      .from(".ev-flag", { scaleX: 0, transformOrigin: "left center", duration: 0.25, ease: "power2.out" })
      .to(".ev-flag", { skewY: -10, duration: 0.16, yoyo: true, repeat: 3, ease: "sine.inOut", transformOrigin: "left center" });
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <path className="ev-outline" d="M 48 196 L 130 120 L 158 142 L 216 58 L 262 118 L 296 96 L 354 196"
          stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path className="ev-snow" d="M 196 86 L 216 58 L 236 84 L 224 78 L 214 88 L 204 78 Z"
          stroke={accent2} strokeWidth="2" fill={`${accent2}22`} strokeLinejoin="round" />
        <line className="ev-flag-pole" x1="216" y1="58" x2="216" y2="38" stroke={accent2} strokeWidth="2.5" strokeLinecap="round" />
        <path className="ev-flag" d="M 216 38 L 234 44 L 216 50 Z" fill={accent2} />
        <g style={{ overflow: "hidden" }}>
          {"8848".split("").map((d, i) => (
            <text key={i} className="ev-digit" x={156 + i * 26} y="178" fill="white"
              style={{ fontFamily: MONO, fontSize: 34, fontWeight: 800 }}>{d}</text>
          ))}
        </g>
        <text x="262" y="178" fill={accent} className="ev-digit" style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700 }}>m D+</text>
      </svg>
    </div>
  );
}

/* 28 · SINE WAVE — Collinare perfetta: l'onda si disegna e il dot la surfa */
export function SineWaveScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".sw2-wave", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.6, ease: "power1.inOut" })
      .to(".sw2-surfer", {
        motionPath: { path: ".sw2-wave-path", align: ".sw2-wave-path", alignOrigin: [0.5, 0.5], autoRotate: true },
        duration: 1.6, ease: "power1.inOut",
      }, "<")
      .from(".sw2-marker", { scaleY: 0, transformOrigin: "center bottom", stagger: 0.1, duration: 0.3, ease: "power2.out" }, 0.5)
      .to(".sw2-surfer", { scale: 1.6, transformOrigin: "center", duration: 0.22, yoyo: true, repeat: 1 }, "-=0.2")
      .from(".sw2-updown", { opacity: 0, y: 8, duration: 0.4 }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <path className="sw2-wave sw2-wave-path"
          d="M 40 130 Q 75 60 110 130 T 180 130 T 250 130 T 320 130 T 390 130"
          stroke={accent} strokeWidth="3.5" strokeLinecap="round" />
        {[75, 145, 215, 285].map((x, i) => (
          <line key={i} className="sw2-marker" x1={x} y1="184" x2={x} y2={i % 2 ? 196 : 176}
            stroke={accent2} strokeWidth="3" strokeLinecap="round" />
        ))}
        <path className="sw2-surfer" d="M -8 4 L 0 -8 L 8 4 Z" fill={accent2} transform="translate(40 130)" />
        <text className="sw2-updown" x="200" y="220" textAnchor="middle" fill={accent}
          style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: "0.3em" }}>SU · GIÙ · RIPETI</text>
      </svg>
    </div>
  );
}
