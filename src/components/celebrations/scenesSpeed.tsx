import { useRef } from "react";
import { gsap, useGSAP } from "./gsapSetup";
import { MONO, finish, type SceneProps } from "./sceneUtils";

/**
 * Scene VELOCITÀ & RIPETUTE — 10 celebrazioni su pace, sprint e interval
 * training. Pista, blocchi di partenza, tempi che cadono.
 */

/* 11 · TRACK LAP — 400 m sotto i 3:00/km: l'anello della pista si disegna, lampo sul rettilineo */
export function TrackLapScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".tk-lane-out", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.0, ease: "power2.inOut" })
      .fromTo(".tk-lane-in", { drawSVG: "100% 100%" }, { drawSVG: "0% 100%", duration: 1.0, ease: "power2.inOut" }, "-=0.85")
      .to(".tk-runner", {
        motionPath: { path: ".tk-lane-mid", align: ".tk-lane-mid", alignOrigin: [0.5, 0.5] },
        duration: 1.2, ease: "power2.inOut",
      }, "-=0.6")
      .fromTo(".tk-flash", { opacity: 0, scaleX: 0.2, transformOrigin: "left center" },
        { opacity: 0.9, scaleX: 1, duration: 0.25, ease: "power4.out" }, "-=0.25")
      .to(".tk-flash", { opacity: 0, duration: 0.3 })
      .from(".tk-400", { scale: 0, opacity: 0, transformOrigin: "center", duration: 0.4, ease: "back.out(2.4)" }, "-=0.35");
    finish(tl);
  }, { scope: ref });
  const lane = (r: number) => `M ${200 - r} ${70} A ${r * 0.62} ${r * 0.62} 0 0 0 ${200 - r} ${170} H ${200 + r} A ${r * 0.62} ${r * 0.62} 0 0 0 ${200 + r} ${70} Z`;
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <path className="tk-lane-out" d={lane(120)} stroke={accent} strokeWidth="3" />
        <path className="tk-lane-in" d={lane(86)} stroke={`${accent}66`} strokeWidth="2" />
        <path className="tk-lane-mid" d={lane(103)} stroke="transparent" strokeWidth="1" />
        <rect className="tk-flash" x="98" y="166" width="204" height="8" rx="4" fill={accent2} />
        <circle className="tk-runner" cx="80" cy="70" r="7" fill={accent2} />
        <text className="tk-400" x="200" y="128" textAnchor="middle" fill="white"
          style={{ fontFamily: MONO, fontSize: 30, fontWeight: 800 }}>400m</text>
      </svg>
    </div>
  );
}

/* 12 · REP LADDER — Record ripetute 1000 m: 5 barre-rep scendono a tempi decrescenti, l'ultima brilla */
export function RepLadderScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const REPS = [{ h: 96, t: "3:55" }, { h: 90, t: "3:52" }, { h: 86, t: "3:50" }, { h: 78, t: "3:46" }, { h: 66, t: "3:41" }];
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".rl-bar", { y: -160, opacity: 0, stagger: 0.14, duration: 0.5, ease: "power3.out" })
      .from(".rl-time", { opacity: 0, y: -8, stagger: 0.14, duration: 0.3 }, 0.25)
      .fromTo(".rl-best", { boxShadow: "0 0 0px transparent" }, {}, 0)
      .to(".rl-bar-last", { fill: accent2, duration: 0.3 }, "-=0.2")
      .fromTo(".rl-ring", { scale: 0.6, opacity: 0.9, transformOrigin: "318px 96px" },
        { scale: 1.7, opacity: 0, duration: 0.7, ease: "power2.out" }, "-=0.2")
      .fromTo(".rl-avg", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.6, ease: "power2.inOut" }, "-=0.5");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {REPS.map((r, i) => (
          <g key={i}>
            <rect className={`rl-bar ${i === 4 ? "rl-bar-last" : ""}`}
              x={84 + i * 52} y={64} width="26" height={r.h} rx="6"
              fill={i === 4 ? accent : `${accent}66`} />
            <text className="rl-time" x={97 + i * 52} y={64 + r.h + 18} textAnchor="middle"
              fill={i === 4 ? accent2 : "#71717A"} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>{r.t}</text>
          </g>
        ))}
        <circle className="rl-ring" cx="318" cy="96" r="26" stroke={accent2} strokeWidth="2.5" />
        <line className="rl-avg" x1="76" y1="148" x2="328" y2="148" stroke="white" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.5" />
      </svg>
    </div>
  );
}

/* 13 · SPLIT WATCH — Prima sessione di ripetute: tre lancette frazionate partono sfalsate */
export function SplitWatchScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".sp-ring", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.7, stagger: 0.18, ease: "power2.inOut" })
      .fromTo(".sp-hand",
        { rotation: 0, transformOrigin: "50% 100%" },
        { rotation: 360, duration: 1.0, stagger: 0.22, ease: "power2.inOut" }, "-=0.8")
      .from(".sp-lap", { opacity: 0, x: -10, stagger: 0.22, duration: 0.3 }, "-=1.0")
      .to(".sp-dot", { scale: 1.6, transformOrigin: "center", duration: 0.2, yoyo: true, repeat: 1, stagger: 0.22 }, "-=0.9");
    finish(tl);
  }, { scope: ref });
  const CX = [120, 200, 280];
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {CX.map((cx, i) => (
          <g key={i}>
            <circle className="sp-ring" cx={cx} cy="110" r={34 - i * 2} stroke={i === 1 ? accent : `${accent}77`} strokeWidth="2.5" />
            <line className="sp-hand" x1={cx} y1="110" x2={cx} y2={110 - (30 - i * 2)} stroke={accent2} strokeWidth="2.5" strokeLinecap="round" />
            <circle className="sp-dot" cx={cx} cy="110" r="3.5" fill={accent2} />
            <text className="sp-lap" x={cx} y="172" textAnchor="middle" fill="#A1A1AA"
              style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>{`LAP ${i + 1}`}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* 14 · LAUNCH — Record 200 m: blocchi di partenza, scatto esplosivo con scie */
export function LaunchScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".ln-block", { opacity: 0, x: -16, duration: 0.4, ease: "power2.out" })
      .from(".ln-ready", { scale: 0, transformOrigin: "center", duration: 0.3, ease: "back.out(2)" })
      .to(".ln-ready", { scale: 0.82, transformOrigin: "center", duration: 0.4, ease: "power2.in" })
      .to(".ln-ready", { x: 250, scaleX: 1.5, opacity: 0, duration: 0.45, ease: "power4.in" })
      .fromTo(".ln-trail",
        { scaleX: 0, opacity: 1, transformOrigin: "left center" },
        { scaleX: 1, opacity: 0, duration: 0.55, stagger: 0.05, ease: "power2.out" }, "-=0.3")
      .fromTo(".ln-shock", { scale: 0.3, opacity: 0.9, transformOrigin: "96px 140px" },
        { scale: 2, opacity: 0, duration: 0.6, ease: "power2.out" }, "-=0.5")
      .from(".ln-200", { x: 40, opacity: 0, skewX: -14, duration: 0.45, ease: "expo.out" }, "-=0.35");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <g className="ln-block">
          <path d="M 70 156 L 100 140 L 100 156 Z" fill="#27272A" stroke={accent} strokeWidth="2" />
          <line x1="62" y1="156" x2="116" y2="156" stroke="#3F3F46" strokeWidth="3" strokeLinecap="round" />
        </g>
        <circle className="ln-ready" cx="96" cy="132" r="10" fill={accent2} />
        <circle className="ln-shock" cx="96" cy="140" r="18" stroke={accent2} strokeWidth="2.5" />
        {[120, 132, 144].map((y, i) => (
          <line key={i} className="ln-trail" x1="96" y1={y} x2={300 - i * 24} y2={y}
            stroke={i === 1 ? accent : `${accent}88`} strokeWidth={4 - i} strokeLinecap="round" />
        ))}
        <text className="ln-200" x="290" y="142" textAnchor="middle" fill="white"
          style={{ fontFamily: MONO, fontSize: 34, fontWeight: 800, fontStyle: "italic" }}>200m</text>
      </svg>
    </div>
  );
}

/* 15 · NEGATIVE SPLIT — la seconda metà sorpassa la prima: due barre testa a testa */
export function NegativeSplitScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".ns-label", { opacity: 0, x: -12, stagger: 0.1, duration: 0.35 })
      .fromTo(".ns-bar1", { scaleX: 0, transformOrigin: "left center" }, { scaleX: 0.86, duration: 1.0, ease: "power1.inOut" }, 0.2)
      .fromTo(".ns-bar2", { scaleX: 0, transformOrigin: "left center" }, { scaleX: 0.66, duration: 0.62, ease: "power1.in" }, 0.58)
      .to(".ns-bar2", { scaleX: 1, duration: 0.5, ease: "power3.out" })
      .fromTo(".ns-zoom", { opacity: 0, scale: 0.5, transformOrigin: "330px 142px" },
        { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, "-=0.2")
      .to(".ns-bar2-rect", { fill: accent2, duration: 0.25 }, "<")
      .from(".ns-delta", { opacity: 0, y: 8, duration: 0.35 }, "-=0.1");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <text className="ns-label" x="56" y="92" fill="#71717A" style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>1ª METÀ</text>
        <rect className="ns-bar1" x="56" y="100" width="290" height="18" rx="9" fill={`${accent}55`} />
        <text className="ns-label" x="56" y="142" fill="#71717A" style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>2ª METÀ</text>
        <g className="ns-bar2">
          <rect className="ns-bar2-rect" x="56" y="150" width="290" height="18" rx="9" fill={accent} />
        </g>
        <path className="ns-zoom" d="M 330 134 L 338 142 L 330 150" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <text className="ns-delta" x="200" y="206" textAnchor="middle" fill={accent2}
          style={{ fontFamily: MONO, fontSize: 14, fontWeight: 800 }}>−0:38</text>
      </svg>
    </div>
  );
}

/* 16 · BARRIER BREAK — Sub-20 simbolico: il vecchio tempo si frantuma, il nuovo emerge da sotto */
export function BarrierBreakScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".bb-old", { opacity: 0, y: -16, duration: 0.45, ease: "power3.out" })
      .fromTo(".bb-crack", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.35, ease: "power4.in" }, "+=0.35")
      .to(".bb-old-char", {
        y: () => gsap.utils.random(60, 130),
        x: () => gsap.utils.random(-46, 46),
        rotation: () => gsap.utils.random(-70, 70),
        opacity: 0, duration: 0.8, stagger: 0.025, ease: "power2.in",
      })
      .fromTo(".bb-new", { y: 46, opacity: 0, scale: 0.85 }, { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.6)" }, "-=0.55")
      .fromTo(".bb-glow", { opacity: 0 }, { opacity: 1, duration: 0.4, yoyo: true, repeat: 1 }, "-=0.3");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="relative w-full h-full flex flex-col items-center justify-center">
      <div className="bb-old relative" style={{ fontFamily: MONO, fontSize: 44, fontWeight: 800, color: "#52525B" }}>
        {"20:00".split("").map((c, i) => (
          <span key={i} className="bb-old-char inline-block" style={{ textDecoration: "line-through" }}>{c}</span>
        ))}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 140 56" fill="none">
          <path className="bb-crack" d="M 8 28 L 38 18 L 60 34 L 88 14 L 112 30 L 132 22"
            stroke={accent2} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="bb-new relative mt-1" style={{ fontFamily: MONO, fontSize: 58, fontWeight: 800, color: "white" }}>
        19:48
        <div className="bb-glow absolute inset-0 -z-10 rounded-2xl" style={{ boxShadow: `0 0 60px ${accent}66` }} />
      </div>
      <div className="text-[10px] font-black tracking-[0.4em] uppercase mt-2" style={{ color: accent }}>barriera infranta</div>
    </div>
  );
}

/* 17 · GAUGE — Velocità max oltre 20 km/h: tachimetro ad ago che spara in zona rossa */
export function GaugeScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".gg-arc", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.8, ease: "power2.inOut" })
      .fromTo(".gg-red", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.35, ease: "power2.out" }, "-=0.2")
      .from(".gg-tick", { opacity: 0, stagger: 0.045, duration: 0.15 }, "-=0.7")
      .fromTo(".gg-needle",
        { rotation: -108, transformOrigin: "50% 86%" },
        { rotation: 96, duration: 1.0, ease: "power3.inOut" }, "-=0.3")
      .to(".gg-needle", { rotation: 88, duration: 0.5, ease: "elastic.out(1.2, 0.35)" })
      .to(".gg-kmh", { color: accent2, duration: 0.25 }, "-=0.5")
      .fromTo(".gg-pulse", { scale: 0.7, opacity: 0.8, transformOrigin: "center" },
        { scale: 1.5, opacity: 0, duration: 0.6, ease: "power2.out" }, "-=0.45");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="relative w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <path className="gg-arc" d="M 92 178 A 116 116 0 1 1 308 178" stroke={`${accent}88`} strokeWidth="5" strokeLinecap="round" />
        <path className="gg-red" d="M 268 96 A 116 116 0 0 1 308 178" stroke={accent2} strokeWidth="7" strokeLinecap="round" />
        {Array.from({ length: 11 }, (_, i) => {
          const a = (-198 + i * 21.6) * (Math.PI / 180);
          const x1 = 200 + Math.cos(a) * 100, y1 = 158 + Math.sin(a) * 100;
          const x2 = 200 + Math.cos(a) * 88, y2 = 158 + Math.sin(a) * 88;
          return <line key={i} className="gg-tick" x1={x1} y1={y1} x2={x2} y2={y2} stroke="#52525B" strokeWidth="2" strokeLinecap="round" />;
        })}
        <circle className="gg-pulse" cx="200" cy="158" r="26" stroke={accent2} strokeWidth="2" />
        <line className="gg-needle" x1="200" y1="158" x2="200" y2="74" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="200" cy="158" r="8" fill="#18181B" stroke={accent} strokeWidth="2.5" />
      </svg>
      <div className="gg-kmh absolute bottom-7 text-[15px] font-black tracking-[0.25em]" style={{ fontFamily: MONO, color: "#71717A" }}>
        20+ KM/H
      </div>
    </div>
  );
}

/* 18 · ROCKET FINISH — Sprint finale: la freccia accelera e la scia si allunga fino a uscire */
export function RocketFinishScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".rf-path", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.7, ease: "power1.in" })
      .to(".rf-arrow", {
        motionPath: { path: ".rf-path-d", align: ".rf-path-d", alignOrigin: [0.5, 0.5], autoRotate: true },
        duration: 0.7, ease: "power1.in",
      }, "<")
      .to(".rf-arrow", { x: "+=170", duration: 0.45, ease: "power4.in" })
      .fromTo(".rf-stream",
        { scaleX: 0, transformOrigin: "left center", opacity: 1 },
        { scaleX: 1, duration: 0.4, stagger: 0.04, ease: "power3.out" }, "-=0.4")
      .to(".rf-stream", { opacity: 0, duration: 0.45, stagger: 0.04 })
      .from(".rf-label", { opacity: 0, x: -16, skewX: -12, duration: 0.4, ease: "expo.out" }, "-=0.5");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center overflow-hidden">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <path className="rf-path rf-path-d" d="M 40 170 C 110 168, 160 150, 212 116" stroke={`${accent}55`} strokeWidth="2.5" strokeDasharray="2 7" strokeLinecap="round" />
        {[108, 118, 128].map((y, i) => (
          <line key={i} className="rf-stream" x1={196 - i * 26} y1={y + i * 2} x2={400} y2={y + i * 2}
            stroke={i === 1 ? accent2 : `${accent}99`} strokeWidth={3.5 - i * 0.8} strokeLinecap="round" />
        ))}
        <path className="rf-arrow" d="M -12 -8 L 14 0 L -12 8 L -5 0 Z" fill={accent2} transform="translate(40 170)" />
        <text className="rf-label" x="116" y="64" fill="white"
          style={{ fontFamily: MONO, fontSize: 17, fontWeight: 800, fontStyle: "italic", letterSpacing: "0.15em" }}>ULTIMO KM</text>
      </svg>
    </div>
  );
}

/* 19 · STAMP LAPS — Record ripetute 400 m: 8 medaglioni-giro timbrati in sequenza */
export function StampLapsScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".st4-oval", {
      scale: 1.8, opacity: 0, transformOrigin: "center", duration: 0.32,
      stagger: 0.13, ease: "power4.in",
    })
      .to(".st4-oval", { scale: 0.94, duration: 0.08, stagger: 0.13, ease: "power2.out" }, 0.32)
      .to(".st4-oval", { scale: 1, duration: 0.12, stagger: 0.13 }, 0.4)
      .fromTo(".st4-best-ring", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.5, ease: "power2.inOut" }, "-=0.3")
      .from(".st4-sub", { opacity: 0, y: 8, duration: 0.35 }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {Array.from({ length: 8 }, (_, i) => {
          const x = 76 + (i % 4) * 66, y = 76 + Math.floor(i / 4) * 66;
          const best = i === 6;
          return (
            <g key={i}>
              <g className="st4-oval">
                <ellipse cx={x} cy={y} rx="24" ry="16" stroke={best ? accent2 : accent} strokeWidth="2.5"
                  fill={best ? `${accent2}22` : "transparent"} transform={`rotate(-18 ${x} ${y})`} />
                <text x={x} y={y + 4} textAnchor="middle" fill={best ? accent2 : "#A1A1AA"}
                  style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800 }}>{i + 1}</text>
              </g>
              {best && <ellipse className="st4-best-ring" cx={x} cy={y} rx="31" ry="22" stroke={accent2} strokeWidth="1.5" transform={`rotate(-18 ${x} ${y})`} />}
            </g>
          );
        })}
        <text className="st4-sub" x="200" y="206" textAnchor="middle" fill={accent}
          style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, letterSpacing: "0.3em" }}>8 × 400M</text>
      </svg>
    </div>
  );
}

/* 20 · STAIRCASE — Progressione perfetta: scala discendente di pace con pallina che la scende */
export function StaircaseScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const STEPS = [62, 86, 110, 134, 158];
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".sc-step", { scaleX: 0, transformOrigin: "left center", stagger: 0.12, duration: 0.4, ease: "power3.out" });
    STEPS.forEach((y, i) => {
      tl.to(".sc-ball", { x: 64 + i * 56 - 60, duration: 0.22, ease: "power1.in" }, 0.55 + i * 0.34)
        .to(".sc-ball", { y: y - 70, duration: 0.18, ease: "bounce.out" }, 0.65 + i * 0.34);
    });
    tl.to(".sc-ball", { scale: 1.5, transformOrigin: "center", duration: 0.25, yoyo: true, repeat: 1, ease: "power2.inOut" })
      .from(".sc-pace", { opacity: 0, stagger: 0.08, duration: 0.25 }, 0.8);
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {STEPS.map((y, i) => (
          <g key={i}>
            <line className="sc-step" x1={64 + i * 56} y1={y} x2={64 + i * 56 + 52} y2={y}
              stroke={i === 4 ? accent2 : accent} strokeWidth="4" strokeLinecap="round" />
            <text className="sc-pace" x={64 + i * 56 + 26} y={y + 18} textAnchor="middle"
              fill={i === 4 ? accent2 : "#71717A"} style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700 }}>
              {["5:10", "4:55", "4:40", "4:24", "4:05"][i]}
            </text>
          </g>
        ))}
        <circle className="sc-ball" cx="90" cy="48" r="8" fill="white" />
      </svg>
    </div>
  );
}
