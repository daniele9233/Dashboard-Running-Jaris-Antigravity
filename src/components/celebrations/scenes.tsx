import { useRef } from "react";
import { gsap, useGSAP } from "./gsapSetup";
import { MONO, finish, type SceneProps } from "./sceneUtils";

/**
 * Le 10 scene di celebrazione "classiche" — una per tipo di traguardo.
 * Ogni scena è un SVG autonomo (viewBox 400×240) con timeline GSAP propria:
 * DrawSVG per i tratti, MotionPath per gli inseguimenti, easing dedicati.
 * Nessuna emoji: solo iconografia vettoriale disegnata a stroke.
 * Le altre 50 scene vivono nei file tematici scenes{Volume,Speed,Climb,Habit,Race}.tsx
 */

export type { SceneProps };

/* ────────────────────────────────────────────────────────────────────────────
 * 1 · STOPWATCH — Miglior 1 km
 * Pressione della corona, quadrante che si disegna, tacche in sequenza,
 * lancetta che spazza con easing power4 e si assesta elastica, flash finale.
 * ──────────────────────────────────────────────────────────────────────────── */
export function StopwatchScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from(".sw-crown", { y: -10, opacity: 0, duration: 0.3 })
      .to(".sw-crown", { y: 3, duration: 0.1, ease: "power2.in" })
      .to(".sw-crown", { y: 0, duration: 0.15 })
      .fromTo(".sw-ring", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.7, ease: "power2.inOut" }, "-=0.1")
      .from(".sw-tick", { scale: 0, transformOrigin: "center", stagger: 0.035, duration: 0.25 }, "-=0.35")
      .fromTo(".sw-hand",
        { rotation: -90, transformOrigin: "50% 100%" },
        { rotation: 252, duration: 1.15, ease: "power4.inOut" }, "-=0.2")
      .to(".sw-hand", { rotation: 244, duration: 0.5, ease: "elastic.out(1, 0.4)" })
      .fromTo(".sw-flash",
        { scale: 0.85, opacity: 0.7, transformOrigin: "center" },
        { scale: 1.45, opacity: 0, duration: 0.7, ease: "power2.out" }, "-=0.45")
      .from(".sw-core", { scale: 0, transformOrigin: "center", duration: 0.3, ease: "back.out(2.5)" }, "-=0.7");
    finish(tl);
  }, { scope: ref });

  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <g className="sw-crown">
          <rect x="194" y="22" width="12" height="14" rx="3" fill="#1F1F1F" stroke={accent} strokeWidth="1.5" />
          <rect x="190" y="34" width="20" height="6" rx="2" fill="#1F1F1F" stroke={accent} strokeWidth="1.5" />
        </g>
        <circle className="sw-flash" cx="200" cy="132" r="84" stroke={accent} strokeWidth="2" />
        <circle className="sw-ring" cx="200" cy="132" r="78" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const x1 = 200 + Math.cos(a) * 66, y1 = 132 + Math.sin(a) * 66;
          const x2 = 200 + Math.cos(a) * (i % 3 === 0 ? 54 : 60), y2 = 132 + Math.sin(a) * (i % 3 === 0 ? 54 : 60);
          return <line key={i} className="sw-tick" x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={i % 3 === 0 ? accent : "#3F3F46"} strokeWidth={i % 3 === 0 ? 3 : 2} strokeLinecap="round" />;
        })}
        <line className="sw-hand" x1="200" y1="132" x2="200" y2="78" stroke={accent2} strokeWidth="3.5" strokeLinecap="round" />
        <circle className="sw-core" cx="200" cy="132" r="6" fill={accent2} />
      </svg>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * 2 · ROUTE — Corsa più lunga
 * Il percorso si disegna sulla mappa, il runner-dot lo insegue (MotionPath),
 * il pin di arrivo cala con bounce. Anello di partenza che pulsa.
 * ──────────────────────────────────────────────────────────────────────────── */
export function RouteScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".rt-start", { scale: 0, transformOrigin: "center", duration: 0.35, ease: "back.out(2)" })
      .fromTo(".rt-path", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.7, ease: "power2.inOut" }, "-=0.05")
      .to(".rt-dot", {
        motionPath: { path: ".rt-path", align: ".rt-path", alignOrigin: [0.5, 0.5] },
        duration: 1.7, ease: "power2.inOut",
      }, "<")
      .fromTo(".rt-pulse",
        { scale: 0.6, opacity: 0.8, transformOrigin: "center" },
        { scale: 2.2, opacity: 0, duration: 1, repeat: 1, ease: "power1.out" }, 0.3)
      .from(".rt-pin", { y: -46, opacity: 0, duration: 0.55, ease: "bounce.out" }, "-=0.25")
      .from(".rt-pin-shadow", { scaleX: 0, transformOrigin: "center", duration: 0.3 }, "-=0.3")
      .to(".rt-dot", { opacity: 0, duration: 0.25 }, "<");
    finish(tl);
  }, { scope: ref });

  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {[60, 120, 180].map((y) => (
          <line key={y} x1="16" y1={y} x2="384" y2={y} stroke="#FFFFFF08" strokeWidth="1" />
        ))}
        <circle className="rt-pulse" cx="42" cy="196" r="10" stroke={accent} strokeWidth="2" />
        <circle className="rt-start" cx="42" cy="196" r="6" fill="#0A0A0A" stroke={accent} strokeWidth="3" />
        <path className="rt-path"
          d="M 42 196 C 90 110, 140 215, 192 138 S 270 52, 312 96 S 358 110, 364 78"
          stroke={accent} strokeWidth="3.5" strokeLinecap="round" strokeDasharray="0.1 7" />
        <circle className="rt-dot" cx="42" cy="196" r="7" fill={accent2} />
        <ellipse className="rt-pin-shadow" cx="364" cy="80" rx="9" ry="3" fill="#00000066" />
        <g className="rt-pin">
          <path d="M 364 78 C 354 64, 354 50, 364 44 C 374 50, 374 64, 364 78 Z" fill={accent2} />
          <circle cx="364" cy="53" r="4.5" fill="#0A0A0A" />
        </g>
      </svg>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * 3 · VELOCITY — Tratto più veloce
 * Linee di velocità che sfrecciano, chevron in battuta, pace che slamma
 * in scena con skew da kinetic-typography e doppio ghost cromatico.
 * ──────────────────────────────────────────────────────────────────────────── */
export function VelocityScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".vl-line",
      { xPercent: -130, opacity: 0 },
      { xPercent: 130, opacity: 1, duration: 0.55, stagger: 0.07, ease: "power2.in" })
      .from(".vl-chev", { x: -44, opacity: 0, skewX: -20, stagger: 0.08, duration: 0.4, ease: "power3.out" }, "-=0.35")
      .fromTo(".vl-ghost-a",
        { x: -34, opacity: 0 },
        { x: -7, opacity: 0.45, duration: 0.45, ease: "expo.out" }, "-=0.18")
      .fromTo(".vl-ghost-b",
        { x: 34, opacity: 0 },
        { x: 7, opacity: 0.45, duration: 0.45, ease: "expo.out" }, "<")
      .fromTo(".vl-pace",
        { scale: 1.8, opacity: 0, skewX: -16 },
        { scale: 1, opacity: 1, skewX: -8, duration: 0.5, ease: "expo.out" }, "<0.05")
      .to(".vl-ghost-a, .vl-ghost-b", { opacity: 0.18, duration: 0.6 })
      .fromTo(".vl-under",
        { scaleX: 0, transformOrigin: "left center" },
        { scaleX: 1, duration: 0.45, ease: "power3.inOut" }, "-=0.55");
    finish(tl);
  }, { scope: ref });

  const paceStyle = { fontFamily: MONO, fontSize: 64, fontWeight: 800, fontStyle: "italic" as const, letterSpacing: "-0.03em" };

  return (
    <div ref={ref} className="relative w-full h-full overflow-hidden flex items-center justify-center">
      {[34, 64, 104, 158, 196].map((top, i) => (
        <div key={i} className="vl-line absolute left-0 right-0 h-[2px] rounded-full"
          style={{ top, background: `linear-gradient(90deg, transparent, ${i % 2 ? accent2 : accent}, transparent)` }} />
      ))}
      <svg className="absolute left-6 top-1/2 -translate-y-1/2" width="84" height="56" viewBox="0 0 84 56" fill="none">
        {[0, 26, 52].map((x, i) => (
          <polyline key={i} className="vl-chev" points={`${x},6 ${x + 20},28 ${x},50`}
            stroke={accent} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity={0.35 + i * 0.3} />
        ))}
      </svg>
      <div className="relative">
        <div className="vl-ghost-a absolute inset-0 select-none" style={{ ...paceStyle, color: accent }}>3:38</div>
        <div className="vl-ghost-b absolute inset-0 select-none" style={{ ...paceStyle, color: accent2 }}>3:38</div>
        <div className="vl-pace relative text-white select-none" style={paceStyle}>3:38</div>
        <div className="vl-under h-[3px] mt-1 rounded-full" style={{ background: `linear-gradient(90deg, ${accent}, ${accent2})` }} />
        <div className="text-center text-[10px] font-black tracking-[0.4em] uppercase mt-2" style={{ color: accent }}>min / km</div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * 4 · CADENCE — Miglior cadenza
 * Equalizzatore che batte il ritmo (stagger yoyo), impronte sx/dx che
 * compaiono alternate sulla baseline a tempo di passo.
 * ──────────────────────────────────────────────────────────────────────────── */
export function CadenceScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const BAR_H = [22, 38, 56, 44, 68, 52, 76, 52, 68, 44, 56, 38, 22];

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".cd-bar",
      { scaleY: 0.12, transformOrigin: "center bottom" },
      {
        scaleY: 1, duration: 0.32, ease: "sine.inOut",
        stagger: { each: 0.05, repeat: 5, yoyo: true, from: "center" },
      })
      .to(".cd-bar", { scaleY: 1, duration: 0.4, ease: "power2.out", stagger: { each: 0.02, from: "center" } })
      .from(".cd-foot", { opacity: 0, y: 8, scale: 0.6, transformOrigin: "center", stagger: 0.16, duration: 0.3, ease: "back.out(2)" }, 0.4)
      .fromTo(".cd-base",
        { scaleX: 0, transformOrigin: "left center" },
        { scaleX: 1, duration: 0.8, ease: "power2.inOut" }, 0.2);
    finish(tl);
  }, { scope: ref });

  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {BAR_H.map((h, i) => (
          <rect key={i} className="cd-bar" x={88 + i * 18} y={150 - h} width="9" height={h} rx="4.5"
            fill={i % 2 ? accent : accent2} opacity={0.55 + (h / 76) * 0.45} />
        ))}
        <line className="cd-base" x1="80" y1="168" x2="320" y2="168" stroke="#3F3F46" strokeWidth="2" strokeLinecap="round" />
        {Array.from({ length: 6 }, (_, i) => {
          const x = 104 + i * 38;
          const up = i % 2 === 0;
          return (
            <g key={i} className="cd-foot" transform={`translate(${x} ${up ? 186 : 198}) rotate(${up ? -8 : 8})`}>
              <ellipse cx="0" cy="0" rx="7" ry="11" fill={up ? accent : accent2} opacity="0.9" />
              <ellipse cx="0" cy="15" rx="4.5" ry="4" fill={up ? accent : accent2} opacity="0.65" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * 5 · LAUREL — Miglior 5 km
 * Rami d'alloro che si disegnano simmetrici, foglie in stagger, medaglione
 * con anello DrawSVG e sweep di luce. Stile podio, sobrio.
 * ──────────────────────────────────────────────────────────────────────────── */
export function LaurelScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const LEAVES = [
    { x: -2, y: -8, r: -38 }, { x: 7, y: -34, r: -22 }, { x: 22, y: -57, r: -4 },
    { x: 44, y: -74, r: 16 }, { x: 70, y: -83, r: 38 },
  ];

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".lr-branch", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.0, ease: "power2.inOut" })
      .from(".lr-leaf", { scale: 0, transformOrigin: "center", stagger: 0.06, duration: 0.3, ease: "back.out(2.2)" }, "-=0.55")
      .fromTo(".lr-ring", { drawSVG: "50% 50%" }, { drawSVG: "0% 100%", duration: 0.7, ease: "power2.inOut" }, "-=0.5")
      .from(".lr-disc", { scale: 0, transformOrigin: "center", duration: 0.45, ease: "back.out(1.8)" }, "-=0.35")
      .from(".lr-label", { opacity: 0, y: 8, duration: 0.35 }, "-=0.15")
      .fromTo(".lr-shine",
        { x: -90, opacity: 0 },
        { x: 90, opacity: 0.8, duration: 0.65, ease: "power2.inOut" }, "+=0.1")
      .to(".lr-shine", { opacity: 0, duration: 0.2 }, "-=0.1");
    finish(tl);
  }, { scope: ref });

  const branch = "M 0 0 C -8 -34, 4 -66, 38 -88";

  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <g transform="translate(148 188)">
          <path className="lr-branch" d={branch} stroke={accent2} strokeWidth="3" strokeLinecap="round" />
          {LEAVES.map((l, i) => (
            <ellipse key={i} className="lr-leaf" cx={l.x} cy={l.y} rx="5" ry="11" fill={accent2}
              opacity="0.85" transform={`rotate(${l.r} ${l.x} ${l.y})`} />
          ))}
        </g>
        <g transform="translate(252 188) scale(-1 1)">
          <path className="lr-branch" d={branch} stroke={accent2} strokeWidth="3" strokeLinecap="round" />
          {LEAVES.map((l, i) => (
            <ellipse key={i} className="lr-leaf" cx={l.x} cy={l.y} rx="5" ry="11" fill={accent2}
              opacity="0.85" transform={`rotate(${l.r} ${l.x} ${l.y})`} />
          ))}
        </g>
        <circle className="lr-ring" cx="200" cy="106" r="46" stroke={accent} strokeWidth="3.5" strokeLinecap="round" />
        <g className="lr-disc">
          <circle cx="200" cy="106" r="37" fill="#101005" stroke={accent} strokeWidth="1" opacity="0.95" />
        </g>
        <text className="lr-label" x="200" y="117" textAnchor="middle" fill={accent}
          style={{ fontFamily: MONO, fontSize: 30, fontWeight: 800 }}>5K</text>
        <g clipPath="url(#lr-clip)">
          <rect className="lr-shine" x="168" y="56" width="22" height="100" fill="white" opacity="0"
            transform="skewX(-18)" />
        </g>
        <defs>
          <clipPath id="lr-clip"><circle cx="200" cy="106" r="44" /></clipPath>
        </defs>
      </svg>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * 6 · ORBIT — Miglior 10 km
 * Tre anelli concentrici che si disegnano a velocità diverse, satellite che
 * percorre l'orbita esterna (MotionPath), nucleo 10K che emerge.
 * ──────────────────────────────────────────────────────────────────────────── */
export function OrbitScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".ob-r1", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.8, ease: "power2.inOut" })
      .fromTo(".ob-r2", { drawSVG: "100% 100%" }, { drawSVG: "0% 100%", duration: 1.05, ease: "power2.inOut" }, "-=0.65")
      .fromTo(".ob-r3", { drawSVG: "50% 50%" }, { drawSVG: "0% 100%", duration: 1.3, ease: "power2.inOut" }, "-=0.85")
      .to(".ob-sat", {
        motionPath: { path: ".ob-orbit", align: ".ob-orbit", alignOrigin: [0.5, 0.5], start: 0.25, end: 1.25 },
        duration: 1.9, ease: "power1.inOut",
      }, "-=1.1")
      .from(".ob-core", { scale: 0, transformOrigin: "center", duration: 0.5, ease: "back.out(2)" }, "-=0.9")
      .from(".ob-label", { opacity: 0, scale: 0.7, transformOrigin: "center", duration: 0.4, ease: "back.out(1.8)" }, "-=0.45")
      .to(".ob-sat", { scale: 1.7, transformOrigin: "center", duration: 0.25, yoyo: true, repeat: 1, ease: "power2.inOut" }, "-=0.3");
    finish(tl);
  }, { scope: ref });

  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <circle className="ob-r1" cx="200" cy="120" r="44" stroke={accent} strokeWidth="2.5" opacity="0.9" />
        <circle className="ob-r2" cx="200" cy="120" r="66" stroke={accent2} strokeWidth="2" opacity="0.6" />
        {/* path (non circle): MotionPath accetta solo <path> come traiettoria */}
        <path className="ob-r3 ob-orbit" d="M 200 32 A 88 88 0 1 1 200 208 A 88 88 0 1 1 200 32"
          stroke={accent} strokeWidth="1.5" opacity="0.4" strokeDasharray="1 6" strokeLinecap="round" />
        <circle className="ob-sat" cx="200" cy="32" r="6" fill={accent2} />
        <circle className="ob-core" cx="200" cy="120" r="30" fill="#0D1110" stroke={accent} strokeWidth="1.5" />
        <text className="ob-label" x="200" y="129" textAnchor="middle" fill={accent}
          style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800 }}>10K</text>
      </svg>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * 7 · SUMMIT — Record dislivello
 * La cresta si disegna da sinistra, l'area sotto si riempie, la bandierina
 * si pianta in vetta e sventola. Quote che salgono sul lato.
 * ──────────────────────────────────────────────────────────────────────────── */
export function SummitScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".sm-ridge", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.35, ease: "power2.inOut" })
      .fromTo(".sm-fill",
        { opacity: 0, scaleY: 0, transformOrigin: "center bottom" },
        { opacity: 0.22, scaleY: 1, duration: 0.7, ease: "power2.out" }, "-=0.4")
      .from(".sm-quota", { x: -14, opacity: 0, stagger: 0.1, duration: 0.35, ease: "power2.out" }, "-=0.8")
      .fromTo(".sm-pole", { scaleY: 0, transformOrigin: "center bottom" }, { scaleY: 1, duration: 0.3, ease: "power3.out" }, "-=0.25")
      .from(".sm-flag", { scaleX: 0, transformOrigin: "left center", duration: 0.3, ease: "power2.out" })
      .to(".sm-flag", { skewY: -8, duration: 0.18, yoyo: true, repeat: 3, ease: "sine.inOut", transformOrigin: "left center" })
      .fromTo(".sm-halo",
        { scale: 0.4, opacity: 0.8, transformOrigin: "290px 56px" },
        { scale: 2, opacity: 0, duration: 0.8, ease: "power2.out" }, "-=0.6");
    finish(tl);
  }, { scope: ref });

  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {[
          { y: 190, t: "200 m" }, { y: 140, t: "400 m" }, { y: 90, t: "600 m" },
        ].map((q) => (
          <g key={q.y} className="sm-quota">
            <line x1="34" y1={q.y} x2="56" y2={q.y} stroke="#3F3F46" strokeWidth="1.5" />
            <text x="34" y={q.y - 5} fill="#52525B" style={{ fontFamily: MONO, fontSize: 9 }}>{q.t}</text>
          </g>
        ))}
        <polygon className="sm-fill"
          points="60,206 122,148 158,172 222,96 256,128 290,62 330,118 362,98 362,206"
          fill={accent} />
        <polyline className="sm-ridge"
          points="60,206 122,148 158,172 222,96 256,128 290,62 330,118 362,98"
          stroke={accent} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle className="sm-halo" cx="290" cy="56" r="16" stroke={accent2} strokeWidth="2" />
        <line className="sm-pole" x1="290" y1="62" x2="290" y2="34" stroke={accent2} strokeWidth="2.5" strokeLinecap="round" />
        <path className="sm-flag" d="M 290 34 L 312 40 L 290 47 Z" fill={accent2} />
      </svg>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * 8 · IGNITION — Streak allenamenti
 * La fiamma si disegna e si accende, i giorni della settimana si infiammano
 * in sequenza, braci che salgono e svaniscono.
 * ──────────────────────────────────────────────────────────────────────────── */
export function StreakScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const DAYS = ["L", "M", "M", "G", "V", "S", "D"];

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".st-flame-stroke", { drawSVG: "50% 50%" }, { drawSVG: "0% 100%", duration: 0.8, ease: "power2.inOut" })
      .fromTo(".st-flame-fill", { opacity: 0, scale: 0.7, transformOrigin: "center bottom" },
        { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.6)" }, "-=0.2")
      .fromTo(".st-flame-inner", { opacity: 0, scale: 0.4, transformOrigin: "center bottom" },
        { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.8)" }, "-=0.2")
      .to(".st-flame-fill", { scaleX: 1.04, scaleY: 0.97, transformOrigin: "center bottom", duration: 0.5, yoyo: true, repeat: 3, ease: "sine.inOut" }, "-=0.1")
      .from(".st-day", { scale: 0.6, opacity: 0, stagger: 0.09, duration: 0.3, ease: "back.out(2.5)", transformOrigin: "center" }, 0.55)
      .fromTo(".st-ember",
        { y: 0, opacity: 0 },
        { y: -64, opacity: 1, duration: 1.1, stagger: 0.12, ease: "power1.out" }, 0.8)
      .to(".st-ember", { opacity: 0, duration: 0.5, stagger: 0.12 }, 1.35);
    finish(tl);
  }, { scope: ref });

  const flame = "M 200 48 C 222 76, 238 96, 238 122 C 238 148, 221 164, 200 164 C 179 164, 162 148, 162 122 C 162 104, 170 92, 178 82 C 178 96, 184 102, 190 104 C 186 88, 190 64, 200 48 Z";

  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        {[178, 192, 206, 220].map((x, i) => (
          <circle key={i} className="st-ember" cx={x + (i % 2) * 6} cy="120" r={2 + (i % 2)} fill={i % 2 ? accent : accent2} />
        ))}
        <path className="st-flame-stroke" d={flame} stroke={accent} strokeWidth="3" strokeLinecap="round" />
        <path className="st-flame-fill" d={flame} fill={accent} opacity="0.25" />
        <path className="st-flame-inner"
          d="M 200 96 C 212 112, 218 122, 218 134 C 218 148, 210 156, 200 156 C 190 156, 182 148, 182 134 C 182 122, 188 112, 200 96 Z"
          fill={accent2} opacity="0.85" />
        {DAYS.map((d, i) => (
          <g key={i} className="st-day">
            <rect x={102 + i * 30} y="190" width="24" height="24" rx="7"
              fill={accent} opacity={0.14 + i * 0.1} stroke={accent} strokeWidth="1.5" />
            <text x={114 + i * 30} y="206" textAnchor="middle" fill="white"
              style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>{d}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * 9 · ODOMETER — Record km settimanali
 * Contachilometri: le cifre rotolano in colonna con expo.out sfalsato,
 * strisce diagonali di velocità sullo sfondo, cornice che si accende.
 * ──────────────────────────────────────────────────────────────────────────── */
export function OdometerScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const DIGITS = ["5", "2", ",", "4"]; // 52,4 km

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(".od-stripe",
      { xPercent: -160, opacity: 0 },
      { xPercent: 160, opacity: 0.5, duration: 0.8, stagger: 0.09, ease: "power2.inOut" })
      .to(".od-stripe", { opacity: 0.12, duration: 0.4 }, "-=0.2")
      .from(".od-frame", { opacity: 0, scale: 0.92, transformOrigin: "center", duration: 0.4, ease: "power3.out" }, 0.25);

    // Rollo cifre: ogni colonna scorre fino alla cifra target
    gsap.utils.toArray<HTMLElement>(".od-col").forEach((col, i) => {
      const d = DIGITS[i];
      if (d === ",") return;
      const target = parseInt(d, 10);
      tl.fromTo(col,
        { yPercent: 0 },
        { yPercent: -target * 10, duration: 1.1 + i * 0.18, ease: "expo.out" },
        0.45 + i * 0.08);
    });
    tl.from(".od-unit", { opacity: 0, x: -10, duration: 0.4, ease: "power2.out" }, "-=0.4")
      .fromTo(".od-glow",
        { opacity: 0 },
        { opacity: 1, duration: 0.45, yoyo: true, repeat: 1, ease: "sine.inOut" }, "-=0.35");
    finish(tl);
  }, { scope: ref });

  const DIGIT_H = 68;

  return (
    <div ref={ref} className="relative w-full h-full overflow-hidden flex items-center justify-center">
      {[24, 72, 130, 186, 218].map((top, i) => (
        <div key={i} className="od-stripe absolute h-[3px] w-2/3 rounded-full"
          style={{ top, left: "16%", background: i % 2 ? accent : accent2, transform: "rotate(-14deg)" }} />
      ))}
      <div className="od-frame relative rounded-2xl border px-7 py-4 flex items-end gap-1.5"
        style={{ borderColor: `${accent}55`, background: "#0D0D0D", boxShadow: `0 12px 50px #00000088` }}>
        <div className="od-glow absolute inset-0 rounded-2xl pointer-events-none"
          style={{ boxShadow: `0 0 38px ${accent}55, inset 0 0 22px ${accent}22` }} />
        {DIGITS.map((d, i) =>
          d === "," ? (
            <div key={i} className="text-white pb-1" style={{ fontFamily: MONO, fontSize: 44, fontWeight: 800 }}>,</div>
          ) : (
            <div key={i} className="overflow-hidden rounded-md" style={{ height: DIGIT_H, background: "#161616" }}>
              <div className="od-col flex flex-col items-center px-1.5">
                {Array.from({ length: 10 }, (_, n) => (
                  <div key={n} className="flex items-center justify-center text-white"
                    style={{ fontFamily: MONO, fontSize: 46, fontWeight: 800, height: DIGIT_H, lineHeight: 1 }}>
                    {n}
                  </div>
                ))}
              </div>
            </div>
          ),
        )}
        <div className="od-unit pb-1.5 pl-2 text-[13px] font-black uppercase tracking-[0.2em]" style={{ color: accent }}>
          km
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * 10 · PULSE — Nuovo VDOT
 * Tracciato ECG che si disegna con testa luminosa (MotionPath sincrono),
 * onda d'urto sul picco, griglia clinica sullo sfondo.
 * ──────────────────────────────────────────────────────────────────────────── */
export function PulseScene({ accent, accent2 }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const EKG = "M 24 130 H 116 L 132 130 L 144 112 L 156 148 L 170 58 L 186 188 L 200 120 L 212 130 H 376";

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".pl-grid", { opacity: 0, duration: 0.5 })
      .fromTo(".pl-ekg", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.7, ease: "power1.inOut" }, 0.15)
      .to(".pl-head", {
        motionPath: { path: ".pl-ekg-path", align: ".pl-ekg-path", alignOrigin: [0.5, 0.5] },
        duration: 1.7, ease: "power1.inOut",
      }, 0.15)
      .fromTo(".pl-shock",
        { scale: 0.3, opacity: 0.9, transformOrigin: "170px 58px" },
        { scale: 2.4, opacity: 0, duration: 0.8, ease: "power2.out" }, 0.95)
      .to(".pl-head", { opacity: 0, scale: 0.4, duration: 0.3 }, "-=0.15")
      .fromTo(".pl-ekg", { opacity: 1 }, { opacity: 0.85, duration: 0.4 }, "-=0.2");
    finish(tl);
  }, { scope: ref });

  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 400 240" className="w-full h-full" fill="none">
        <g className="pl-grid">
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`v${i}`} x1={40 + i * 40} y1="28" x2={40 + i * 40} y2="212" stroke="#FFFFFF0A" strokeWidth="1" />
          ))}
          {Array.from({ length: 5 }, (_, i) => (
            <line key={`h${i}`} x1="24" y1={40 + i * 40} x2="376" y2={40 + i * 40} stroke="#FFFFFF0A" strokeWidth="1" />
          ))}
        </g>
        <circle className="pl-shock" cx="170" cy="58" r="20" stroke={accent2} strokeWidth="2.5" />
        <path className="pl-ekg pl-ekg-path" d={EKG} stroke={accent} strokeWidth="3"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 6px ${accent}AA)` }} />
        <circle className="pl-head" cx="24" cy="130" r="6" fill="white"
          style={{ filter: `drop-shadow(0 0 10px ${accent})` }} />
      </svg>
    </div>
  );
}
