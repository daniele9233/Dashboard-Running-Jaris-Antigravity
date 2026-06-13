import { useRef } from "react";
import { gsap, useGSAP } from "./gsapSetup";
import { MONO, finish, type SceneProps } from "./sceneUtils";

/**
 * Scene GARE & MILESTONE — 12 celebrazioni su PB, gare, classifiche e ritorni.
 */

/* 39 · TROPHY BUILD — Primo PB stagionale: la coppa si assembla pezzo per pezzo */
export function TrophyBuildScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".tb-base", { y: 36, opacity: 0, duration: 0.4, ease: "power3.out" })
      .from(".tb-stem", { scaleY: 0, transformOrigin: "center bottom", duration: 0.35, ease: "power3.out" }, "-=0.1")
      .from(".tb-cup", { y: -42, opacity: 0, duration: 0.5, ease: "bounce.out" }, "-=0.05")
      .fromTo(".tb-handle", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.45, stagger: 0.12, ease: "power2.out" }, "-=0.15")
      .from(".tb-star", { scale: 0, rotation: -120, transformOrigin: "center", duration: 0.45, ease: "back.out(2.4)" }, "-=0.1")
      .fromTo(".tb-shine", { x: -46, opacity: 0 }, { x: 46, opacity: 0.8, duration: 0.5, ease: "power2.inOut" }, "-=0.1")
      .to(".tb-shine", { opacity: 0, duration: 0.2 });
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <rect className="tb-base" x="168" y="186" width="64" height="10" rx="4" fill="#27272A" stroke={accent} strokeWidth="2" />
        <rect className="tb-stem" x="194" y="158" width="12" height="30" rx="4" fill="#1F1F1F" stroke={accent} strokeWidth="2" />
        <path className="tb-cup" d="M 162 76 H 238 L 232 124 C 228 146, 216 158, 200 158 C 184 158, 172 146, 168 124 Z"
          fill="#141408" stroke={accent} strokeWidth="3" strokeLinejoin="round" />
        <path className="tb-handle" d="M 162 84 C 138 86, 138 116, 166 120" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        <path className="tb-handle" d="M 238 84 C 262 86, 262 116, 234 120" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        <path className="tb-star" d="M 200 92 L 205 104 L 218 105 L 208 113 L 211 126 L 200 119 L 189 126 L 192 113 L 182 105 L 195 104 Z"
          fill={accent2} />
        <defs><clipPath id="tb-clip"><path d="M 162 76 H 238 L 232 124 C 228 146, 216 158, 200 158 C 184 158, 172 146, 168 124 Z" /></clipPath></defs>
        <g clipPath="url(#tb-clip)">
          <rect className="tb-shine" x="186" y="70" width="14" height="95" fill="white" opacity="0" transform="skewX(-16)" />
        </g>
      </svg>
    </div>
  );
}

/* 40 · TRIPLE STARS — 3 PB nello stesso mese: tre stelle atterrano sul podio in sequenza */
export function TripleStarsScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const star = (cx: number, cy: number, s: number) => {
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 14 * s : 6 * s;
      pts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`);
    }
    return pts.join(" ");
  };
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".ts-step", { scaleY: 0, transformOrigin: "center bottom", stagger: 0.1, duration: 0.4, ease: "power3.out" });
    [0, 1, 2].forEach((i) => {
      tl.from(`.ts-star${i}`, { y: -120, opacity: 0, rotation: 200, transformOrigin: "center", duration: 0.55, ease: "back.out(1.4)" }, 0.5 + i * 0.3)
        .fromTo(`.ts-ring${i}`, { scale: 0.4, opacity: 0.9, transformOrigin: "center" },
          { scale: 1.7, opacity: 0, duration: 0.5, ease: "power2.out" }, 0.85 + i * 0.3);
    });
    tl.from(".ts-x3", { opacity: 0, scale: 0.6, transformOrigin: "center", duration: 0.4, ease: "back.out(2.2)" });
    finish(tl);
  }, { scope: ref });
  const X = [136, 200, 264], STEP_H = [54, 74, 42], STAR_Y = [104, 84, 116];
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {X.map((x, i) => (
          <g key={i}>
            <rect className="ts-step" x={x - 28} y={188 - STEP_H[i]} width="56" height={STEP_H[i]} rx="6"
              fill="#141414" stroke={i === 1 ? accent : "#3F3F46"} strokeWidth="2" />
            <polygon className={`ts-star${i}`} points={star(x, STAR_Y[i], i === 1 ? 1.25 : 1)}
              fill={i === 1 ? accent : accent2} />
            <circle className={`ts-ring${i}`} cx={x} cy={STAR_Y[i]} r="20" stroke={i === 1 ? accent : accent2} strokeWidth="2" />
          </g>
        ))}
        <text className="ts-x3" x="200" y="218" textAnchor="middle" fill="white"
          style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, letterSpacing: "0.2em" }}>3 PB / MESE</text>
      </svg>
    </div>
  );
}

/* 41 · PHOTO FINISH — Sorpasso al fotofinish: due dot corrono, il tuo sorpassa sulla linea */
export function PhotoFinishScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".pf-lane", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.45, stagger: 0.1, ease: "power2.out" })
      .fromTo(".pf-finish", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.35 }, "-=0.2")
      .fromTo(".pf-rival", { x: 0 }, { x: 236, duration: 1.5, ease: "power1.inOut" }, 0.5)
      .fromTo(".pf-you", { x: 0 }, { x: 132, duration: 0.9, ease: "power1.in" }, 0.5)
      .to(".pf-you", { x: 252, duration: 0.62, ease: "power3.out" }, 1.4)
      .fromTo(".pf-flash-rect", { opacity: 0 }, { opacity: 0.85, duration: 0.08, yoyo: true, repeat: 3 }, 1.92)
      .from(".pf-win", { opacity: 0, y: 10, duration: 0.4, ease: "power3.out" }, 2.1);
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <line className="pf-lane" x1="48" y1="96" x2="352" y2="96" stroke="#27272A" strokeWidth="2" />
        <line className="pf-lane" x1="48" y1="136" x2="352" y2="136" stroke="#27272A" strokeWidth="2" />
        <g className="pf-finish">
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x={318 + (i % 2) * 7} y={78 + i * 14} width="7" height="14"
              fill={i % 2 ? "white" : "#3F3F46"} />
          ))}
        </g>
        <circle className="pf-rival" cx="62" cy="96" r="8" fill="#52525B" />
        <circle className="pf-you" cx="62" cy="136" r="8" fill={accent} style={{ filter: `drop-shadow(0 0 8px ${accent})` }} />
        <rect className="pf-flash-rect" x="300" y="60" width="60" height="120" fill="white" opacity="0" />
        <text className="pf-win" x="200" y="196" textAnchor="middle" fill={accent2}
          style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, letterSpacing: "0.25em" }}>SORPASSO ALL'ULTIMO</text>
      </svg>
    </div>
  );
}

/* 42 · LASER CROWN — Top 10% segmento: la corona si disegna e spara un raggio verticale */
export function LaserCrownScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".lc-crown", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.9, ease: "power2.inOut" })
      .from(".lc-jewel", { scale: 0, transformOrigin: "center", stagger: 0.08, duration: 0.3, ease: "back.out(2.6)" }, "-=0.3")
      .fromTo(".lc-beam",
        { scaleY: 0, opacity: 0.95, transformOrigin: "center bottom" },
        { scaleY: 1, duration: 0.4, ease: "power4.out" }, "-=0.1")
      .to(".lc-beam", { opacity: 0, duration: 0.5, ease: "power2.in" }, "+=0.2")
      .from(".lc-pct", { opacity: 0, scale: 0.7, transformOrigin: "center", duration: 0.4, ease: "back.out(2)" }, "-=0.5");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <rect className="lc-beam" x="194" y="0" width="12" height="118" fill={accent2} opacity="0.9" />
        <path className="lc-crown"
          d="M 148 162 L 140 112 L 172 134 L 200 100 L 228 134 L 260 112 L 252 162 Z"
          stroke={accent} strokeWidth="3.5" strokeLinejoin="round" fill="#14140A" />
        {[[148, 156], [200, 152], [252, 156]].map(([x, y], i) => (
          <circle key={i} className="lc-jewel" cx={x} cy={y - 8} r="4" fill={i === 1 ? accent2 : accent} />
        ))}
        <text className="lc-pct" x="200" y="206" textAnchor="middle" fill={accent}
          style={{ fontFamily: MONO, fontSize: 16, fontWeight: 800, letterSpacing: "0.2em" }}>TOP 10%</text>
      </svg>
    </div>
  );
}

/* 43 · BIB PIN — Prima gara ufficiale: il pettorale si appunta con due spille e il numero flippa */
export function BibPinScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".bp-bib", { y: 40, opacity: 0, rotation: -6, transformOrigin: "center", duration: 0.55, ease: "power3.out" })
      .from(".bp-pin", { y: -30, opacity: 0, stagger: 0.14, duration: 0.3, ease: "power3.in" })
      .to(".bp-bib", { rotation: 1.5, duration: 0.15, ease: "power2.out" }, "-=0.1")
      .to(".bp-bib", { rotation: 0, duration: 0.3, ease: "elastic.out(1.4, 0.4)" })
      .fromTo(".bp-num", { rotateX: -90, opacity: 0, transformOrigin: "center top" },
        { rotateX: 0, opacity: 1, duration: 0.55, ease: "back.out(1.6)" }, "-=0.25")
      .from(".bp-race", { opacity: 0, duration: 0.35 }, "-=0.15");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center" style={{ perspective: 700 }}>
      <div className="bp-bib relative rounded-xl border-2 px-10 py-5 text-center"
        style={{ borderColor: accent, background: "#F8F8F4", width: 230 }}>
        {[18, 196].map((left, i) => (
          <svg key={i} className="bp-pin absolute -top-2" style={{ left }} width="16" height="18" viewBox="0 0 16 18" fill="none">
            <circle cx="8" cy="5" r="4" fill="none" stroke="#52525B" strokeWidth="2" />
            <line x1="8" y1="9" x2="8" y2="16" stroke="#52525B" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ))}
        <div className="bp-race text-[9px] font-black tracking-[0.3em] uppercase mb-1" style={{ color: "#52525B" }}>
          METIC RUN · 10K
        </div>
        <div className="bp-num" style={{ fontFamily: MONO, fontSize: 52, fontWeight: 800, color: "#0A0A0A", lineHeight: 1 }}>
          1247
        </div>
        <div className="bp-race mt-1 h-[4px] rounded-full" style={{ background: `linear-gradient(90deg, ${accent}, ${accent2})` }} />
      </div>
    </div>
  );
}

/* 44 · GATE OPEN — Sub-50 10K: il cancello "50:00" si apre a battenti e fa passare il nuovo tempo */
export function GateOpenScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".go-gate-l", { x: 60, opacity: 0, duration: 0.45, ease: "power3.out" })
      .from(".go-gate-r", { x: -60, opacity: 0, duration: 0.45, ease: "power3.out" }, "<")
      .to(".go-gate-l", { rotateY: -76, duration: 0.8, ease: "power2.inOut", transformOrigin: "left center" }, "+=0.4")
      .to(".go-gate-r", { rotateY: 76, duration: 0.8, ease: "power2.inOut", transformOrigin: "right center" }, "<")
      .fromTo(".go-new", { scale: 0.5, opacity: 0, z: -100 }, { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.5)" }, "-=0.45")
      .fromTo(".go-rays", { opacity: 0 }, { opacity: 0.5, duration: 0.4, yoyo: true, repeat: 1 }, "-=0.4");
    finish(tl);
  }, { scope: ref });
  const gateStyle = {
    fontFamily: MONO, fontSize: 34, fontWeight: 800, color: "#52525B",
    background: "#141414", border: "2px solid #3F3F46", padding: "14px 10px",
  } as const;
  return (
    <div ref={ref} className="relative w-full h-full flex items-center justify-center" style={{ perspective: 800 }}>
      <div className="go-rays absolute inset-x-0 top-8 bottom-8 rounded-full"
        style={{ background: `radial-gradient(ellipse at center, ${accent}26, transparent 65%)` }} />
      <div className="flex" style={{ transformStyle: "preserve-3d" }}>
        <div className="go-gate-l rounded-l-xl" style={{ ...gateStyle, borderRight: "none", textDecoration: "line-through" }}>50:</div>
        <div className="go-gate-r rounded-r-xl" style={{ ...gateStyle, borderLeft: "none", textDecoration: "line-through" }}>00</div>
      </div>
      <div className="go-new absolute text-white" style={{ fontFamily: MONO, fontSize: 56, fontWeight: 800 }}>
        49:12
      </div>
    </div>
  );
}

/* 45 · STOP CLOCK — Sub-2h mezza: il cronometro da gara si ferma esattamente sul tempo */
export function StopClockScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".sk-board", { y: -26, opacity: 0, duration: 0.45, ease: "power3.out" });
    // tabellone che scorre tempi e si ferma
    const proxy = { v: 11400 }; // 1:54:00 in s di partenza visiva
    const el = () => ref.current?.querySelector(".sk-time") as HTMLElement | null;
    tl.to(proxy, {
      v: 7148, // 1:59:08 → conta a scendere? no: tempo finale 1:59:08 = 7148s
      duration: 1.6, ease: "power3.out",
      onUpdate: () => {
        const e = el(); if (!e) return;
        const s = Math.round(proxy.v);
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
        e.textContent = `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
      },
    }, 0.35)
      .fromTo(".sk-freeze", { opacity: 0, scale: 1.25, transformOrigin: "center" },
        { opacity: 1, scale: 1, duration: 0.3, ease: "power4.out" }, "-=0.1")
      .to(".sk-freeze", { opacity: 0, duration: 0.4 }, "+=0.25")
      .from(".sk-sub2", { opacity: 0, y: 10, duration: 0.4 }, "-=0.3");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex flex-col items-center justify-center gap-3">
      <div className="sk-board relative rounded-2xl border px-9 py-5"
        style={{ borderColor: `#3F3F46`, background: "#0D0D0D" }}>
        <div className="sk-time text-white tabular-nums" style={{ fontFamily: MONO, fontSize: 50, fontWeight: 800 }}>
          1:54:00
        </div>
        <div className="sk-freeze absolute inset-0 rounded-2xl border-2 pointer-events-none"
          style={{ borderColor: accent, boxShadow: `0 0 40px ${accent}55` }} />
      </div>
      <div className="sk-sub2 text-[11px] font-black tracking-[0.4em] uppercase" style={{ color: accent2 }}>
        sotto le due ore
      </div>
    </div>
  );
}

/* 46 · LOAD RING — WAVA 70%: l'anello percentuale si carica con tacche e stella finale */
export function LoadRingScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    const proxy = { v: 0 };
    const el = () => ref.current?.querySelector(".lr2-num") as HTMLElement | null;
    tl.fromTo(".lr2-track", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.5, ease: "power2.out" })
      .fromTo(".lr2-fill", { drawSVG: "0%" }, { drawSVG: "70%", duration: 1.5, ease: "power2.inOut" }, "-=0.1")
      .to(proxy, {
        v: 70, duration: 1.5, ease: "power2.inOut",
        onUpdate: () => { const e = el(); if (e) e.textContent = `${Math.round(proxy.v)}`; },
      }, "<")
      .from(".lr2-star", { scale: 0, rotation: -160, transformOrigin: "center", duration: 0.5, ease: "back.out(2.2)" }, "-=0.15")
      .from(".lr2-wava", { opacity: 0, duration: 0.35 }, "-=0.2");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="relative w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <circle className="lr2-track" cx="200" cy="116" r="64" stroke="#27272A" strokeWidth="9" />
        <circle className="lr2-fill" cx="200" cy="116" r="64" stroke={accent} strokeWidth="9" strokeLinecap="round"
          transform="rotate(-90 200 116)" />
        <path className="lr2-star" d="M 258 56 L 262 66 L 273 67 L 265 74 L 267 85 L 258 79 L 249 85 L 251 74 L 243 67 L 254 66 Z" fill={accent2} />
      </svg>
      <div className="absolute flex flex-col items-center" style={{ top: "38%" }}>
        <div className="flex items-baseline">
          <span className="lr2-num text-white tabular-nums" style={{ fontFamily: MONO, fontSize: 44, fontWeight: 800 }}>0</span>
          <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 800, color: accent }}>%</span>
        </div>
        <div className="lr2-wava text-[9px] font-black tracking-[0.35em] uppercase text-gray-500">wava age-graded</div>
      </div>
    </div>
  );
}

/* 47 · RANK CLIMB — Migliore posizione in classifica: la freccia sale i gradini del ranking */
export function RankClimbScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const ROWS = [{ y: 60, n: "12°" }, { y: 96, n: "27°" }, { y: 132, n: "41°" }, { y: 168, n: "68°" }];
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".rc-row", { x: -28, opacity: 0, stagger: 0.1, duration: 0.4, ease: "power3.out" })
      .fromTo(".rc-arrow",
        { y: 108, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.1, ease: "power3.inOut" }, "-=0.1")
      .to(".rc-top-row", { backgroundColor: "transparent" }, 0)
      .to(".rc-hl", { opacity: 1, scaleX: 1, duration: 0.35, ease: "power3.out" }, "-=0.25")
      .to(".rc-arrow", { y: -6, duration: 0.22, yoyo: true, repeat: 1, ease: "power2.inOut" })
      .from(".rc-new", { scale: 0, opacity: 0, transformOrigin: "center", duration: 0.4, ease: "back.out(2.4)" }, "-=0.3");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {ROWS.map((r, i) => (
          <g key={i} className="rc-row">
            <rect x="96" y={r.y - 16} width="180" height="26" rx="7" fill={i === 0 ? "transparent" : "#141414"}
              stroke={i === 0 ? "transparent" : "#27272A"} strokeWidth="1.5" />
            <text x="114" y={r.y + 2} fill={i === 0 ? accent : "#71717A"}
              style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700 }}>{r.n}</text>
          </g>
        ))}
        <rect className="rc-hl" x="96" y="28" width="180" height="26" rx="7" fill={`${accent}1E`}
          stroke={accent} strokeWidth="2" opacity="0" style={{ transformOrigin: "96px 41px", transform: "scaleX(0.4)" }} />
        <text className="rc-new" x="114" y="46" fill={accent} style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800 }}>4°  TU</text>
        <g className="rc-arrow">
          <line x1="312" y1="160" x2="312" y2="52" stroke={accent2} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M 302 64 L 312 48 L 322 64" stroke={accent2} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      </svg>
    </div>
  );
}

/* 48 · TIER UP — Salto di tier nel Ranking: lo scudo cambia livello con wipe cromatico */
export function TierUpScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const shield = "M 200 56 L 248 72 V 118 C 248 150, 228 170, 200 182 C 172 170, 152 150, 152 118 V 72 Z";
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".tu-outline", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.8, ease: "power2.inOut" })
      .from(".tu-old-label", { opacity: 0, y: 6, duration: 0.3 }, "-=0.3")
      .fromTo(".tu-wipe", { attr: { y: 182, height: 0 } }, { attr: { y: 56, height: 126 }, duration: 0.75, ease: "power3.inOut" }, "+=0.3")
      .to(".tu-old-label", { opacity: 0, y: -8, duration: 0.25 }, "-=0.6")
      .from(".tu-new-label", { opacity: 0, y: 10, duration: 0.35, ease: "power3.out" }, "-=0.25")
      .fromTo(".tu-spark",
        { scale: 0, opacity: 1, transformOrigin: "center" },
        { scale: 1, opacity: 0, duration: 0.55, stagger: 0.05, ease: "power2.out" }, "-=0.3")
      .to(".tu-shield-g", { scale: 1.04, transformOrigin: "center", duration: 0.2, yoyo: true, repeat: 1, ease: "power2.inOut" }, "-=0.3");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <defs><clipPath id="tu-clip"><path d={shield} /></clipPath></defs>
        <g className="tu-shield-g">
          <path d={shield} fill="#101010" />
          <rect className="tu-wipe" x="152" y="182" width="96" height="0" fill={`${accent}2E`} clipPath="url(#tu-clip)" />
          <path className="tu-outline" d={shield} stroke={accent} strokeWidth="3.5" strokeLinejoin="round" />
          <text className="tu-old-label" x="200" y="128" textAnchor="middle" fill="#52525B"
            style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800 }}>TIER 6</text>
          <text className="tu-new-label" x="200" y="128" textAnchor="middle" fill={accent2}
            style={{ fontFamily: MONO, fontSize: 17, fontWeight: 800 }}>TIER 5</text>
        </g>
        {[[160, 64], [240, 64], [148, 130], [252, 130], [200, 196]].map(([x, y], i) => (
          <g key={i} className="tu-spark">
            <line x1={x - 6} y1={y} x2={x + 6} y2={y} stroke={accent2} strokeWidth="2" strokeLinecap="round" />
            <line x1={x} y1={y - 6} x2={x} y2={y + 6} stroke={accent2} strokeWidth="2" strokeLinecap="round" />
          </g>
        ))}
      </svg>
    </div>
  );
}

/* 49 · ENGINE WINGS — VO2max +5 in 3 mesi: le ali del motore si aprono con flusso d'aria */
export function EngineWingsScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".ew-core", { scale: 0, transformOrigin: "center", duration: 0.45, ease: "back.out(2)" })
      .fromTo(".ew-wing-l", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.7, stagger: 0.09, ease: "power2.out" }, "-=0.15")
      .fromTo(".ew-wing-r", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.7, stagger: 0.09, ease: "power2.out" }, "<")
      .fromTo(".ew-air",
        { x: 0, opacity: 0 },
        { x: -34, opacity: 0.8, duration: 0.55, stagger: 0.08, ease: "power2.out" }, "-=0.4")
      .to(".ew-air", { opacity: 0, duration: 0.3 })
      .to(".ew-core-dot", { scale: 1.25, transformOrigin: "center", duration: 0.4, yoyo: true, repeat: 3, ease: "sine.inOut" }, "-=0.7")
      .from(".ew-plus", { y: 14, opacity: 0, duration: 0.45, ease: "back.out(1.8)" }, "-=0.8");
    finish(tl);
  }, { scope: ref });
  const wingL = (i: number) => `M 182 ${112 + i * 10} C ${150 - i * 8} ${96 + i * 12}, ${120 - i * 10} ${100 + i * 14}, ${92 - i * 10} ${118 + i * 14}`;
  const wingR = (i: number) => `M 218 ${112 + i * 10} C ${250 + i * 8} ${96 + i * 12}, ${280 + i * 10} ${100 + i * 14}, ${308 + i * 10} ${118 + i * 14}`;
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {[0, 1, 2].map((i) => (
          <path key={`l${i}`} className="ew-wing-l" d={wingL(i)} stroke={accent} strokeWidth={3 - i * 0.6} strokeLinecap="round" opacity={1 - i * 0.25} />
        ))}
        {[0, 1, 2].map((i) => (
          <path key={`r${i}`} className="ew-wing-r" d={wingR(i)} stroke={accent} strokeWidth={3 - i * 0.6} strokeLinecap="round" opacity={1 - i * 0.25} />
        ))}
        {[88, 100, 112].map((y, i) => (
          <line key={i} className="ew-air" x1={320} y1={y - 30} x2={352} y2={y - 30} stroke={accent2} strokeWidth="2" strokeLinecap="round" />
        ))}
        <g className="ew-core">
          <circle cx="200" cy="116" r="24" fill="#0D0F0A" stroke={accent} strokeWidth="3" />
          <circle className="ew-core-dot" cx="200" cy="116" r="9" fill={accent2} />
        </g>
        <text className="ew-plus" x="200" y="186" textAnchor="middle" fill="white"
          style={{ fontFamily: MONO, fontSize: 24, fontWeight: 800 }}>+5 <tspan fill={accent} style={{ fontSize: 13 }}>VO2MAX</tspan></text>
      </svg>
    </div>
  );
}

/* 50 · PHOENIX — Comeback dopo 30+ giorni: le ali si rialzano dalle ceneri, a tratto */
export function PhoenixScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".px-ash", { scaleX: 0, transformOrigin: "center", duration: 0.5, ease: "power2.out" })
      .fromTo(".px-body", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.7, ease: "power2.inOut" }, "-=0.1")
      .fromTo(".px-wing", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.9, stagger: 0.12, ease: "power2.out" }, "-=0.3")
      .fromTo(".px-rise", { y: 16 }, { y: 0, duration: 0.9, ease: "power2.out" }, "-=0.8")
      .fromTo(".px-spark", { y: 0, opacity: 0 },
        { y: -44, opacity: 1, duration: 0.9, stagger: 0.09, ease: "power1.out" }, "-=0.6")
      .to(".px-spark", { opacity: 0, duration: 0.4 }, "-=0.2")
      .from(".px-back", { opacity: 0, letterSpacing: "0.7em", duration: 0.5, ease: "power3.out" }, "-=0.4");
    finish(tl);
  }, { scope: ref });
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <line className="px-ash" x1="130" y1="186" x2="270" y2="186" stroke="#3F3F46" strokeWidth="4" strokeLinecap="round" />
        {[166, 188, 214, 236].map((x, i) => (
          <circle key={i} className="px-spark" cx={x} cy="178" r={2 + (i % 2)} fill={i % 2 ? accent2 : accent} />
        ))}
        <g className="px-rise">
          <path className="px-body" d="M 200 168 C 194 148, 194 130, 200 112 C 206 130, 206 148, 200 168 Z"
            stroke={accent2} strokeWidth="2.5" strokeLinejoin="round" />
          <path className="px-wing" d="M 196 132 C 168 124, 148 104, 142 76 C 162 92, 182 98, 198 100"
            stroke={accent} strokeWidth="3" strokeLinecap="round" />
          <path className="px-wing" d="M 204 132 C 232 124, 252 104, 258 76 C 238 92, 218 98, 202 100"
            stroke={accent} strokeWidth="3" strokeLinecap="round" />
          <path className="px-wing" d="M 200 112 C 196 100, 197 90, 200 82 C 203 90, 204 100, 200 112"
            stroke={accent2} strokeWidth="2" strokeLinecap="round" />
        </g>
        <text className="px-back" x="200" y="216" textAnchor="middle" fill={accent}
          style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, letterSpacing: "0.3em" }}>DI NUOVO IN PISTA</text>
      </svg>
    </div>
  );
}
