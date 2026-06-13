import { useRef } from "react";
import { gsap, useGSAP } from "./gsapSetup";
import { MONO, finish, type SceneProps } from "./sceneUtils";

/**
 * Scene FISIOLOGIA (10) — motore aerobico, cuore, biomeccanica, efficienza.
 * Linguaggio clinico/strumentale: tracciati, calibri, indicatori, ingranaggi.
 */

/* 1 · EFFICIENCY — Z2 più veloce del mese scorso. Due barre a stessa FC. */
export function EfficiencyScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.to(".ef-cog", { rotation: 360, transformOrigin: "center", duration: 1.6, ease: "power1.inOut" })
      .fromTo(".ef-old", { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: 0.6, ease: "power2.out" }, 0.1)
      .fromTo(".ef-new", { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: 0.9, ease: "power3.out" }, 0.4)
      .from(".ef-arrow", { y: 12, opacity: 0, duration: 0.4, ease: "back.out(2)" }, "-=0.3")
      .from(".ef-lbl", { opacity: 0, x: -8, stagger: 0.1, duration: 0.3 }, "-=0.4");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <g className="ef-cog" transform="translate(330 60)">
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return <rect key={i} x={Math.cos(a) * 18 - 3} y={Math.sin(a) * 18 - 3} width="6" height="6" fill={accent2} opacity="0.7" transform={`rotate(${(a * 180) / Math.PI} ${Math.cos(a) * 18} ${Math.sin(a) * 18})`} />;
          })}
          <circle r="13" fill="none" stroke={accent2} strokeWidth="3" />
        </g>
        <text className="ef-lbl" x="60" y="104" fill="#71717A" style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>PRIMA</text>
        <rect className="ef-old" x="110" y="94" width="150" height="16" rx="8" fill="#3F3F46" />
        <text className="ef-lbl" x="60" y="148" fill={accent} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>ORA</text>
        <rect className="ef-new" x="110" y="138" width="214" height="16" rx="8" fill={accent} />
        <g className="ef-arrow" transform="translate(332 146)">
          <path d="M 0 8 L 0 -8 M -6 -2 L 0 -8 L 6 -2" stroke={accent2} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
        <text x="110" y="186" fill="#52525B" style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em" }}>stessa FC · Zona 2</text>
      </svg>
    </div>
  );
}

/* 2 · STEADY-HEART — FC stabile ±3 bpm su lungo. Linea piatta tra due rail. */
export function SteadyHeartScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".sh-rail", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.6, ease: "power2.out", stagger: 0.1 })
      .fromTo(".sh-line", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.5, ease: "none" }, "-=0.3")
      .to(".sh-heart", { scale: 1.18, transformOrigin: "center", duration: 0.4, yoyo: true, repeat: 3, ease: "sine.inOut" }, "-=1.4")
      .from(".sh-check", { scale: 0, transformOrigin: "center", duration: 0.4, ease: "back.out(2.5)" }, "-=0.3")
      .from(".sh-band", { opacity: 0, duration: 0.4 }, "-=1.4");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <rect className="sh-band" x="40" y="104" width="300" height="32" fill={accent} opacity="0.1" />
        <line className="sh-rail" x1="40" y1="104" x2="340" y2="104" stroke={`${accent}66`} strokeWidth="1.5" strokeDasharray="4 5" />
        <line className="sh-rail" x1="40" y1="136" x2="340" y2="136" stroke={`${accent}66`} strokeWidth="1.5" strokeDasharray="4 5" />
        <path className="sh-line" d="M 44 120 L 90 118 L 120 122 L 160 119 L 210 121 L 260 118 L 310 121 L 336 120" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <g className="sh-heart" transform="translate(64 76)">
          <path d="M 0 6 C -10 -8, -26 2, 0 22 C 26 2, 10 -8, 0 6 Z" fill={accent2} />
        </g>
        <text x="86" y="82" fill={accent2} style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800 }}>± 3 bpm</text>
        <g className="sh-check" transform="translate(320 80)">
          <circle r="15" fill="#0D0D0D" stroke={accent} strokeWidth="2" />
          <path d="M -7 0 L -2 6 L 8 -7" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      </svg>
    </div>
  );
}

/* 3 · GROUND-CONTACT — GCT < 200 ms. Piede + barra contatto che si accorcia. */
export function GroundContactScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".gc-foot", { y: -40, opacity: 0, duration: 0.45, ease: "power3.in" })
      .fromTo(".gc-ripple", { scale: 0.3, opacity: 0.8, transformOrigin: "center" }, { scale: 2.4, opacity: 0, duration: 0.6, ease: "power2.out" }, "-=0.05")
      .fromTo(".gc-bar", { scaleX: 1, transformOrigin: "left center" }, { scaleX: 0.42, duration: 0.7, ease: "power3.inOut" }, "-=0.2")
      .fromTo(".gc-notch", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.3 }, "-=0.5")
      .from(".gc-val", { scale: 0, transformOrigin: "center", duration: 0.4, ease: "back.out(2)" }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <circle className="gc-ripple" cx="160" cy="120" r="20" stroke={accent} strokeWidth="2" />
        <g className="gc-foot" transform="translate(160 96)">
          <ellipse cx="0" cy="0" rx="13" ry="22" fill={accent2} opacity="0.9" />
          <ellipse cx="0" cy="26" rx="9" ry="8" fill={accent2} opacity="0.6" />
        </g>
        <line x1="120" y1="150" x2="320" y2="150" stroke="#27272A" strokeWidth="2" />
        <rect className="gc-bar" x="120" y="160" width="200" height="12" rx="6" fill={accent} opacity="0.85" />
        <line className="gc-notch" x1="204" y1="154" x2="204" y2="178" stroke={accent2} strokeWidth="2.5" strokeLinecap="round" />
        <text x="208" y="196" fill="#52525B" style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>200 ms</text>
        <text className="gc-val" x="120" y="210" fill={accent} style={{ fontFamily: MONO, fontSize: 18, fontWeight: 800 }}>184 ms</text>
      </svg>
    </div>
  );
}

/* 4 · OSCILLATION — oscillazione verticale minima. Dot quasi piatto. */
export function OscillationScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".os-path", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.6, ease: "none" })
      .to(".os-dot", { motionPath: { path: ".os-path", align: ".os-path", alignOrigin: [0.5, 0.5] }, duration: 1.6, ease: "none" }, "<")
      .from(".os-brk", { scaleY: 0, transformOrigin: "center", duration: 0.4, ease: "back.out(2)" }, "-=1.2")
      .from(".os-lbl", { opacity: 0, x: -8, duration: 0.4 }, "-=0.3")
      .to(".os-dot", { opacity: 0, duration: 0.2 });
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <line x1="40" y1="100" x2="360" y2="100" stroke="#27272A" strokeWidth="1" strokeDasharray="3 5" />
        <line x1="40" y1="140" x2="360" y2="140" stroke="#27272A" strokeWidth="1" strokeDasharray="3 5" />
        <path className="os-path" d="M 44 120 Q 84 110 124 120 T 204 120 T 284 120 T 356 120" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        <circle className="os-dot" cx="44" cy="120" r="6.5" fill="white" style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />
        <g className="os-brk" transform="translate(372 120)">
          <line x1="0" y1="-12" x2="0" y2="12" stroke={accent2} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="-5" y1="-12" x2="5" y2="-12" stroke={accent2} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="-5" y1="12" x2="5" y2="12" stroke={accent2} strokeWidth="2.5" strokeLinecap="round" />
        </g>
        <text className="os-lbl" x="60" y="78" fill={accent2} style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800 }}>RIMBALZO MIN</text>
      </svg>
    </div>
  );
}

/* 5 · POWER-BOLT — record di potenza (W). Fulmine + ago al fondo scala. */
export function PowerBoltScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".pw-gauge", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.8, ease: "power2.inOut" })
      .from(".pw-tick", { scale: 0, transformOrigin: "200px 150px", stagger: 0.04, duration: 0.2 }, "-=0.5")
      .fromTo(".pw-needle", { rotation: -84, transformOrigin: "200px 150px" }, { rotation: 70, duration: 0.9, ease: "back.out(1.4)" }, "-=0.3")
      .fromTo(".pw-bolt", { drawSVG: "0%", opacity: 1 }, { drawSVG: "100%", duration: 0.5, ease: "power2.out" }, "-=0.4")
      .fromTo(".pw-bolt-fill", { opacity: 0, scale: 0.6, transformOrigin: "center" }, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, "-=0.1");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <path className="pw-gauge" d="M 124 150 A 76 76 0 0 1 276 150" stroke={accent} strokeWidth="6" strokeLinecap="round" />
        {Array.from({ length: 7 }, (_, i) => {
          const a = Math.PI + (i / 6) * Math.PI;
          return <line key={i} className="pw-tick" x1={200 + Math.cos(a) * 64} y1={150 + Math.sin(a) * 64} x2={200 + Math.cos(a) * 56} y2={150 + Math.sin(a) * 56} stroke="#52525B" strokeWidth="2" strokeLinecap="round" />;
        })}
        <line className="pw-needle" x1="200" y1="150" x2="200" y2="92" stroke={accent2} strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="200" cy="150" r="5" fill={accent2} />
        <path className="pw-bolt" d="M 206 168 L 188 196 L 200 196 L 192 220" stroke={accent2} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0" />
        <path className="pw-bolt-fill" d="M 206 168 L 188 196 L 200 196 L 192 220" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0" />
      </svg>
    </div>
  );
}

/* 6 · RECOVERY-DIP — recupero FC rapido. Picco poi caduta ripida + freccia. */
export function RecoveryDipScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".rd-line", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.5, ease: "power2.inOut" })
      .to(".rd-head", { motionPath: { path: ".rd-line", align: ".rd-line", alignOrigin: [0.5, 0.5] }, duration: 1.5, ease: "power2.inOut" }, "<")
      .from(".rd-arrow", { y: -16, opacity: 0, duration: 0.4, ease: "back.out(2)" }, "-=0.4")
      .from(".rd-delta", { scale: 0, transformOrigin: "center", duration: 0.4, ease: "back.out(2)" }, "-=0.2")
      .to(".rd-head", { opacity: 0, duration: 0.2 });
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {[80, 120, 160].map((y) => <line key={y} x1="40" y1={y} x2="360" y2={y} stroke="#FFFFFF08" strokeWidth="1" />)}
        <path className="rd-line" d="M 44 150 L 110 150 L 150 64 L 190 150 L 250 184 L 320 192 L 356 194" stroke={accent} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle className="rd-head" cx="44" cy="150" r="6" fill="white" style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />
        <g className="rd-arrow" transform="translate(258 110)">
          <path d="M 0 -16 L 0 28 M -8 18 L 0 28 L 8 18" stroke={accent2} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
        <g className="rd-delta" transform="translate(300 96)">
          <rect x="-30" y="-15" width="60" height="28" rx="14" fill="#0D0D0D" stroke={accent2} strokeWidth="1.5" />
          <text x="0" y="5" textAnchor="middle" fill={accent2} style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800 }}>−42</text>
        </g>
      </svg>
    </div>
  );
}

/* 7 · FLATLINE — deriva cardiaca < 2%. Due metà sovrapposte, FC piatta. */
export function FlatlineScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".fl-h1", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.9, ease: "power1.inOut" })
      .fromTo(".fl-h2", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.9, ease: "power1.inOut" }, "-=0.4")
      .from(".fl-mid", { scaleY: 0, transformOrigin: "center", duration: 0.4 }, "-=0.5")
      .from(".fl-tag", { opacity: 0, scale: 0.6, transformOrigin: "center", duration: 0.4, ease: "back.out(2)" }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <line className="fl-mid" x1="200" y1="60" x2="200" y2="180" stroke="#3F3F46" strokeWidth="1.5" strokeDasharray="4 5" />
        <text x="120" y="72" textAnchor="middle" fill="#52525B" style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700 }}>1ª METÀ</text>
        <text x="280" y="72" textAnchor="middle" fill="#52525B" style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700 }}>2ª METÀ</text>
        <path className="fl-h1" d="M 44 128 L 80 124 L 110 130 L 150 126 L 196 128" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path className="fl-h2" d="M 204 128 L 244 125 L 286 129 L 322 126 L 356 128" stroke={accent2} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <g className="fl-tag" transform="translate(200 168)">
          <rect x="-54" y="-15" width="108" height="30" rx="15" fill="#0D0D0D" stroke={accent} strokeWidth="1.5" />
          <text x="0" y="5" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800 }}>Pa:HR 1,4%</text>
        </g>
      </svg>
    </div>
  );
}

/* 8 · COOL-HEART — FC media più bassa. Cuore + freccia di raffreddamento. */
export function CoolHeartScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".ch-heart-stroke", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.9, ease: "power2.inOut" })
      .from(".ch-heart-fill", { scale: 0, transformOrigin: "center", duration: 0.4, ease: "back.out(1.6)" }, "-=0.3")
      .to(".ch-heart-fill", { scale: 1.12, transformOrigin: "center", duration: 0.45, yoyo: true, repeat: 2, ease: "sine.inOut" })
      .from(".ch-flake", { y: -10, opacity: 0, stagger: 0.1, duration: 0.4, ease: "power2.out" }, "-=0.9")
      .from(".ch-arrow", { y: -14, opacity: 0, duration: 0.4, ease: "back.out(2)" }, "-=0.4")
      .from(".ch-bpm", { opacity: 0, x: 8, duration: 0.3 }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  const heart = "M 200 110 C 176 80, 132 96, 144 138 C 152 168, 184 186, 200 198 C 216 186, 248 168, 256 138 C 268 96, 224 80, 200 110 Z";
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {[150, 200, 250].map((x, i) => (
          <g key={i} className="ch-flake" transform={`translate(${x} 56)`}>
            <path d="M 0 -7 L 0 7 M -6 -3.5 L 6 3.5 M 6 -3.5 L -6 3.5" stroke={accent2} strokeWidth="1.5" strokeLinecap="round" />
          </g>
        ))}
        <path className="ch-heart-stroke" d={heart} stroke={accent} strokeWidth="3" strokeLinecap="round" />
        <path className="ch-heart-fill" d={heart} fill={accent} opacity="0.22" style={{ transformOrigin: "200px 150px" }} />
        <g className="ch-arrow" transform="translate(286 130)">
          <path d="M 0 -16 L 0 22 M -7 12 L 0 22 L 7 12" stroke={accent2} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
        <text className="ch-bpm" x="300" y="120" fill={accent2} style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800 }}>−6 bpm</text>
      </svg>
    </div>
  );
}

/* 9 · STRIDE — falcata record. Due impronte + calibro che si estende. */
export function StrideScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".sd-footL", { scale: 0, opacity: 0, transformOrigin: "center", duration: 0.35, ease: "back.out(2)" })
      .fromTo(".sd-footR", { x: -120, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: "power3.out" }, "-=0.1")
      .fromTo(".sd-cal", { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: 0.6, ease: "power2.inOut" }, "-=0.2")
      .from(".sd-len", { scale: 0, transformOrigin: "center", duration: 0.4, ease: "back.out(2)" }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <g className="sd-footL" transform="translate(96 150) rotate(-6)">
          <ellipse cx="0" cy="0" rx="11" ry="20" fill={accent} opacity="0.9" />
          <ellipse cx="0" cy="23" rx="7" ry="7" fill={accent} opacity="0.6" />
        </g>
        <g className="sd-footR" transform="translate(300 150) rotate(6)">
          <ellipse cx="0" cy="0" rx="11" ry="20" fill={accent2} opacity="0.9" />
          <ellipse cx="0" cy="23" rx="7" ry="7" fill={accent2} opacity="0.6" />
        </g>
        <g className="sd-cal">
          <line x1="96" y1="116" x2="300" y2="116" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <line x1="96" y1="108" x2="96" y2="124" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <line x1="300" y1="108" x2="300" y2="124" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </g>
        <g className="sd-len" transform="translate(198 116)">
          <rect x="-34" y="-15" width="68" height="28" rx="14" fill="#0D0D0D" stroke={accent} strokeWidth="1.5" />
          <text x="0" y="5" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 14, fontWeight: 800 }}>1,52 m</text>
        </g>
      </svg>
    </div>
  );
}

/* 10 · GOLD-INDEX — miglior indice di efficienza. Quadrante radiale che sale. */
export function GoldIndexScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".gi-ring", { drawSVG: "0%", duration: 0.7, ease: "power2.inOut" })
      .fromTo(".gi-arc", { drawSVG: "0%" }, { drawSVG: "82%", duration: 1.3, ease: "power3.out" }, "-=0.3")
      .from(".gi-core", { scale: 0, transformOrigin: "center", duration: 0.45, ease: "back.out(1.8)" }, "-=0.6")
      .fromTo(".gi-glow", { opacity: 0 }, { opacity: 1, duration: 0.4, yoyo: true, repeat: 1, ease: "sine.inOut" }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <circle className="gi-glow" cx="200" cy="120" r="74" stroke={accent} strokeWidth="10" opacity="0" style={{ filter: "blur(10px)" }} />
        <circle className="gi-ring" cx="200" cy="120" r="74" stroke="#27272A" strokeWidth="10" />
        <path className="gi-arc" d="M 200 46 A 74 74 0 1 1 199 46" stroke={accent} strokeWidth="10" strokeLinecap="round" />
        <g className="gi-core">
          <circle cx="200" cy="120" r="46" fill="#0D0D0D" stroke={accent} strokeWidth="1.5" />
          <text x="200" y="116" textAnchor="middle" fill="white" style={{ fontFamily: MONO, fontSize: 28, fontWeight: 800 }}>1,92</text>
          <text x="200" y="136" textAnchor="middle" fill={accent} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.2em" }}>INDICE EF</text>
        </g>
      </svg>
    </div>
  );
}
