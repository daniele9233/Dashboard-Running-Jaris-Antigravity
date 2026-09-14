import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import Lenis from "lenis";
import { HeroArtwork } from "./HeroArtwork";
import { HeroNav } from "./HeroNav";
import { Marquee } from "./Marquee";
import { EnterDisc } from "./EnterDisc";
import { HERO_BRAND, HERO_GOAL, HERO_PORTAL, HERO_QUOTE } from "./heroContent";
import {
  EASE_IN,
  EASE_IN_OUT,
  EASE_OUT,
  EASE_POP,
  hasFinePointer,
  prefersReducedMotion,
  seeded,
  waitForHeroFonts,
} from "./heroMotion";
import "./hero.css";

interface Props {
  /** Mount the app underneath (called once, before it can be seen). */
  onReveal: () => void;
  /** The hero is gone — unmount it. */
  onFinish: () => void;
  /** Enter the app at a specific route. */
  onRoute: (to: string) => void;
}

/** Loupe magnification. */
const MAG = 1.3;
/** The loupe reads the stage as a race: x is distance, y is pace. */
const RACE_KM = parseFloat(HERO_GOAL.race) || 5;
const formatPace = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}/KM`;

/** Letters inside this radius (px) stretch toward the pointer. */
const DISTORT_RADIUS = 240;

/** Position of an element among its siblings — identical in both twins. */
const sib = (el: Element) => Array.prototype.indexOf.call(el.parentElement?.children ?? [], el) as number;

export function IntroHero({ onReveal, onFinish, onRoute }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const enterApi = useRef<(to?: string) => void>(() => {});
  const [reduced] = useState(prefersReducedMotion);
  const [fine] = useState(hasFinePointer);

  // Callbacks change identity with parent renders; the choreography must not.
  const cb = useRef({ onReveal, onFinish, onRoute });
  cb.current = { onReveal, onFinish, onRoute };

  useLayoutEffect(() => {
    const root = rootRef.current!;
    const stage = stageRef.current!;
    const q = <T extends Element = HTMLElement>(sel: string) => Array.from(root.querySelectorAll<T>(sel));

    let disposed = false;
    let revealed = false;
    let committed = false;
    let finished = false;
    let lenis: Lenis | null = null;
    let exit: gsap.core.Timeline | null = null;
    let snapTimer = 0;
    const ctx = gsap.context(() => {}, root);
    const off: Array<() => void> = [];
    const listen = <K extends keyof WindowEventMap>(
      target: Window | HTMLElement,
      type: K,
      fn: (e: WindowEventMap[K]) => void,
      opts?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, fn as EventListener, opts);
      off.push(() => target.removeEventListener(type, fn as EventListener, opts));
    };

    const reveal = () => {
      if (revealed) return;
      revealed = true;
      cb.current.onReveal();
    };
    const finish = () => {
      if (finished || disposed) return;
      finished = true;
      cb.current.onFinish();
    };

    /* ── geometry ─────────────────────────────────────────────────────── */
    const lens = root.querySelector<HTMLElement>(".hl-lens")!;
    const inner = root.querySelector<HTMLElement>(".hl-inner")!;
    const readX = root.querySelector<HTMLElement>(".hl-readout-x")!;
    const readY = root.querySelector<HTMLElement>(".hl-readout-y")!;
    const bezel = root.querySelector<SVGSVGElement>(".hl-bezel")!;
    const typeLayers = q(".hs-art");
    const floats = q(".hw-float");
    const floatDepth = floats.map((f) => Number(f.dataset.depth ?? 1));
    const glows = q(".hb-glow");
    const solidGlyphs = q(".is-solid .hw-glyph");
    const xrayGlyphs = q(".is-xray .hw-glyph");

    const geo = { w: 1, h: 1, R: 100, restX: 0, restY: 0, box: { x: 0, y: 0, w: 1, h: 1 } };
    let centers: Array<{ x: number; y: number }> = [];

    const measure = () => {
      geo.w = stage.clientWidth;
      geo.h = stage.clientHeight;
      root.style.setProperty("--sw", `${geo.w}px`);
      root.style.setProperty("--sh", `${geo.h}px`);
      geo.R = lens.offsetWidth / 2 || 100;
      // Rest over the outlined word: shows the idea without hiding a drawn glyph.
      const target =
        root.querySelector(".is-solid .hw-row-2 > .hw-char:nth-child(4)") ?? root.querySelector(".is-solid .hw-row-2");
      const spec = root.querySelector(".is-solid")!.getBoundingClientRect();
      geo.box = { x: spec.left, y: spec.top, w: spec.width, h: spec.height };
      if (target) {
        const r = target.getBoundingClientRect();
        geo.restX = r.left + r.width * 0.5;
        geo.restY = r.top + r.height * 0.36;
      } else {
        geo.restX = geo.w * 0.5;
        geo.restY = geo.h * 0.5;
      }
      centers = solidGlyphs.map((g) => {
        const r = g.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
    };

    /* ── pointer / loop state (plain objects, never React state) ─────── */
    const P = { tx: 0, ty: 0, x: 0, y: 0, has: false, pinUntil: 0 };
    const L = { x: 0, y: 0, placed: false, spin: 0 };
    const pin = { v: 0 };
    const distort = solidGlyphs.map(() => ({ sy: 1, sk: 0 }));
    let lensHover = false;
    let lastReadout = 0;
    let distortOn = false;

    const setLensHover = (on: boolean) => {
      // Once leaving, the loupe is the portal — it must stay whole.
      if (committed) on = false;
      if (on === lensHover) return;
      lensHover = on;
      lens.classList.toggle("is-hover", on);
      gsap.to(".hl-hover", { scale: on ? 0.3 : 1, duration: on ? 0.45 : 0.7, ease: on ? "power3.out" : EASE_POP, overwrite: true });
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      P.tx = e.clientX;
      P.ty = e.clientY;
      if (!P.has) {
        P.x = P.tx;
        P.y = P.ty;
      }
      P.has = true;
      const t = e.target as Element | null;
      setLensHover(!!t?.closest("button, a, .hm-root"));
    };
    const onLeave = () => {
      P.has = false;
      setLensHover(false);
    };
    const onTouch = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      const t = e.target as Element | null;
      if (t?.closest("button, a")) return;
      P.tx = e.clientX;
      P.ty = e.clientY;
      P.pinUntil = performance.now() + 2600;
    };

    const tick = (time: number, deltaMs: number) => {
      const dt = Math.min(deltaMs, 64) / 16.667;
      const ease = (base: number) => 1 - Math.pow(1 - base, dt);
      const { w, h, R } = geo;

      // Pointer smoothing + parallax (fine pointers only).
      let nx = 0;
      let ny = 0;
      if (fine && !reduced) {
        const k = ease(0.075);
        const px = P.has ? P.tx : w / 2;
        const py = P.has ? P.ty : h / 2;
        P.x += (px - P.x) * k;
        P.y += (py - P.y) * k;
        nx = P.x / w - 0.5;
        ny = P.y / h - 0.5;
        const typeT = `translate3d(${(-nx * 14).toFixed(2)}px, ${(-ny * 10).toFixed(2)}px, 0)`;
        for (const el of typeLayers) el.style.transform = typeT;
        for (let i = 0; i < floats.length; i++) {
          const d = floatDepth[i];
          floats[i].style.transform = `translate3d(${(-nx * 9 * d).toFixed(2)}px, ${(-ny * 7 * d).toFixed(2)}px, 0)`;
        }
        // `translate` composes with the idle drift GSAP runs on `transform`.
        const glowT = `${(nx * 22).toFixed(2)}px ${(ny * 16).toFixed(2)}px`;
        for (const g of glows) g.style.translate = glowT;
      }

      // Loupe target: pointer, tap, autopilot or rest.
      let lx = geo.restX;
      let ly = geo.restY;
      if (!reduced) {
        if (fine && P.has) {
          lx = P.tx;
          ly = P.ty;
        } else if (!fine) {
          if (performance.now() < P.pinUntil) {
            lx = P.tx;
            ly = P.ty;
          } else {
            const b = geo.box;
            lx = b.x + b.w * (0.5 + 0.36 * Math.sin(time * 0.33));
            ly = b.y + b.h * (0.52 + 0.3 * Math.sin(time * 0.51 + 1.2));
          }
        }
      }
      if (!L.placed) {
        L.x = lx;
        L.y = ly;
        L.placed = true;
      }
      const lk = reduced ? 1 : ease(fine ? 0.2 : 0.05);
      const stepX = (lx - L.x) * lk;
      L.x += stepX;
      L.y += (ly - L.y) * lk;
      if (!reduced && Math.abs(stepX) > 0.01) {
        L.spin += stepX * 0.35;
        bezel.style.transform = `rotate(${L.spin.toFixed(2)}deg)`;
      }
      const cx = L.x + (w / 2 - L.x) * pin.v;
      const cy = L.y + (h / 2 - L.y) * pin.v;
      lens.style.transform = `translate3d(${(cx - R).toFixed(2)}px, ${(cy - R).toFixed(2)}px, 0)`;
      inner.style.transform = `translate3d(${(R - cx * MAG).toFixed(2)}px, ${(R - cy * MAG).toFixed(2)}px, 0) scale(${MAG})`;

      if (time - lastReadout > 0.09) {
        lastReadout = time;
        readX.textContent = `KM ${((cx / w) * RACE_KM).toFixed(2)}`;
        readY.textContent = formatPace(210 + (cy / h) * 150);
      }

      // Letters lean into the pointer.
      if (distortOn && fine && !reduced) {
        const dk = ease(0.14);
        for (let i = 0; i < centers.length; i++) {
          const c = centers[i];
          const dx = P.x - c.x;
          const dy = P.y - c.y;
          const d = Math.hypot(dx, dy);
          let f = P.has ? Math.max(0, 1 - d / DISTORT_RADIUS) : 0;
          f = f * f < 0.01 ? 0 : f * f;
          const tsy = 1 + 0.11 * f;
          const tsk = Math.max(-1, Math.min(1, dx / DISTORT_RADIUS)) * -7 * f;
          const s = distort[i];
          if (s.sy === tsy && s.sk === tsk) continue;
          s.sy += (tsy - s.sy) * dk;
          s.sk += (tsk - s.sk) * dk;
          // Snap the last hair of the way: a lingering scaleY(1.0004) keeps the
          // glyph resampled and visibly soft, so at rest the transform goes away.
          if (Math.abs(tsy - s.sy) < 0.001 && Math.abs(tsk - s.sk) < 0.03) {
            s.sy = tsy;
            s.sk = tsk;
          }
          const tf = f === 0 && s.sy === 1 ? "" : `scaleY(${s.sy.toFixed(4)}) skewX(${s.sk.toFixed(3)}deg)`;
          solidGlyphs[i].style.transform = tf;
          if (xrayGlyphs[i]) xrayGlyphs[i].style.transform = tf;
        }
      }
    };

    /* ── timelines ────────────────────────────────────────────────────── */
    const startIdle = () => {
      if (reduced) return;
      ctx.add(() => {
        gsap.to(".hg-orb", { yPercent: -11, duration: 1.5, ease: "sine.inOut", yoyo: true, repeat: -1 });
        gsap.to(".hg-watch-hand", { rotation: "+=360", svgOrigin: "50 50", duration: 9, ease: "none", repeat: -1 });
        gsap.to(".hw-bib", { rotation: 3.5, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1, transformOrigin: "50% 0%" });
        gsap.to(".hb-glow-lime", { xPercent: 6, yPercent: -5, duration: 9, ease: "sine.inOut", yoyo: true, repeat: -1 });
        gsap.to(".hb-glow-violet", { xPercent: -5, yPercent: 6, duration: 11, ease: "sine.inOut", yoyo: true, repeat: -1 });
        gsap.to(".he-ring", { rotation: 360, duration: 20, ease: "none", repeat: -1 });
      });
    };

    /**
     * The runner laps lane two counter-clockwise, from the finish line. Each
     * twin gets its own tween (a path can't be shared across SVGs), created in
     * the same tick so they stay in step.
     */
    const startLaps = () => {
      q<SVGSVGElement>(".hg-track-shape").forEach((svg) => {
        const path = svg.querySelector<SVGPathElement>(".hg-track-path")!;
        const runner = svg.querySelector(".hg-runner")!;
        if (reduced) {
          gsap.set(runner, { x: 46, y: 34.5 });
          return;
        }
        gsap.to(runner, { motionPath: { path, start: 1.453, end: 0.453 }, duration: 6.5, ease: "none", repeat: -1 });
      });
    };

    const buildExit = () =>
      ctx.add(() => {
        const coverScale = () => (Math.hypot(geo.w, geo.h) / 2 + 40) / geo.R;
        const tl = gsap.timeline({ paused: true, defaults: { ease: EASE_IN_OUT } });
        tl.to(".hn-item", { yPercent: -160, opacity: 0, duration: 0.5, stagger: 0.03 }, 0)
          .to(".hm-root", { yPercent: 105, duration: 0.6 }, 0)
          .to(".hs-hint, .hb-reg, .hr-route", { opacity: 0, duration: 0.35 }, 0)
          .to(".hp .hc-reveal", { yPercent: -115, duration: 0.5, stagger: 0.015, ease: EASE_IN }, 0)
          .to(".he-disc", { scale: 0, rotation: 120, duration: 0.55, ease: EASE_IN }, 0)
          .to(
            ".hw-row-1 > .hw-char",
            {
              yPercent: -170,
              rotation: (_i: number, el: Element) => (seeded(sib(el), 3) - 0.5) * 60,
              opacity: 0,
              duration: 0.85,
              stagger: (_i: number, el: Element) => sib(el) * 0.025,
            },
            0.05,
          )
          .to(
            ".hw-row-2 > .hw-char",
            { scaleY: 2.6, opacity: 0, duration: 0.75, stagger: (_i: number, el: Element) => sib(el) * 0.02 },
            0.1,
          )
          .to(".hw-bib-anchor", { yPercent: -220, rotation: -40, opacity: 0, duration: 0.6, ease: EASE_IN }, 0.08)
          .to(
            ".hw-row-3 > .hw-char",
            {
              yPercent: 130,
              rotation: (_i: number, el: Element) => (seeded(sib(el), 5) - 0.5) * 50,
              opacity: 0,
              duration: 0.9,
              stagger: (_i: number, el: Element) => sib(el) * 0.04,
            },
            0.12,
          )
          .to(pin, { v: 1, duration: 0.7 }, 0)
          .to(".hl-scale", { scale: coverScale, duration: 0.95, ease: EASE_IN }, 0.3)
          .to(".hl-fill", { opacity: 1, duration: 0.4, ease: "power1.in" }, 0.72)
          .to(".hs-portal", { opacity: 1, duration: 0.2, ease: "none" }, 1.0)
          .from(".hs-portal-kicker", { yPercent: 120, opacity: 0, duration: 0.45, ease: EASE_OUT }, 1.0)
          .from(
            ".hs-portal-word span",
            {
              yPercent: 90,
              rotation: (n: number) => (seeded(n, 7) - 0.5) * 18,
              opacity: 0,
              duration: 0.55,
              stagger: 0.05,
              ease: EASE_OUT,
            },
            1.02,
          )
          .to(stage, { yPercent: -100, duration: 1, ease: EASE_IN_OUT }, 1.6);
        exit = tl;
      });

    const introDone = () => {
      if (disposed) return;
      measure();
      distortOn = true;
      startIdle();
      if (!reduced) buildExit();
      lenis?.start();
      reveal();
    };

    const buildIntro = () => {
      let tl!: gsap.core.Timeline;
      ctx.add(() => {
        startLaps();
        if (reduced) {
          tl = gsap
            .timeline({ onComplete: introDone })
            .from(".hb-root, .hs-art", { opacity: 0, duration: 0.5, ease: "power1.out" })
            .from(".hn-root, .hm-root, .hs-hint, .hl-lens", { opacity: 0, duration: 0.5, ease: "power1.out" }, 0.2);
          return;
        }

        const byIndex = (step: number) => (_n: number, el: Element) => sib(el) * step;
        tl = gsap.timeline({ defaults: { ease: EASE_OUT }, onComplete: introDone });
        const phrase = (sel: string, at: number) => tl.from(sel, { yPercent: 115, duration: 1, stagger: 0.08 }, at);

        // 1 · ground
        tl.from(".hb-glow", { opacity: 0, duration: 1.8, ease: "sine.out" }, 0)
          .from(".hb-grain, .hb-vignette", { opacity: 0, duration: 1.2, ease: "sine.out" }, 0);

        // 2 · the sentence, in the order it is read
        phrase(".hp-lead .hc-reveal", 0.1);
        tl.from(
          ".hw-row-1 > .hw-char",
          {
            yPercent: 75,
            rotation: (_n: number, el: Element) => (seeded(sib(el)) - 0.5) * 26,
            scale: 0.7,
            opacity: 0,
            duration: 1.15,
            stagger: byIndex(0.055),
          },
          0.25,
        )
          .from(".hg-watch-shape", { scale: 0, rotation: -90, transformOrigin: "50% 50%", duration: 1.1, ease: EASE_POP }, 0.45)
          .from(".hg-watch-hand", { rotation: -720, svgOrigin: "50 50", duration: 1.9, ease: EASE_OUT }, 0.5);
        phrase(".hp-after-first .hc-reveal", 0.8);
        phrase(".hp-before-second .hc-reveal", 0.98);
        tl.from(
          ".hw-row-2 > .hw-char",
          { scaleY: 0, opacity: 0, transformOrigin: "50% 100%", duration: 1.05, stagger: byIndex(0.045) },
          1.05,
        );
        phrase(".hp-before-third .hc-reveal", 1.5);
        tl.from(
          ".hw-row-3 > .hw-char",
          {
            yPercent: 70,
            rotation: (_n: number, el: Element) => (seeded(sib(el), 2) - 0.5) * 22,
            scale: 0.75,
            opacity: 0,
            duration: 1.1,
            stagger: byIndex(0.05),
          },
          1.62,
        ).from(".hg-orb-bar", { scaleY: 0, transformOrigin: "50% 100%", duration: 0.7 }, 1.9);

        // 3 · objects, with overshoot
        tl.from(".hw-bib", { yPercent: -260, rotation: -60, opacity: 0, duration: 1.1, ease: EASE_POP }, 1.7)
          .from(".hg-runner", { scale: 0, duration: 0.7, ease: EASE_POP }, 1.85)
          .fromTo(".hg-orb", { yPercent: -560, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.52, ease: EASE_IN }, 2.1)
          .to(".hg-orb", { scaleX: 1.3, scaleY: 0.7, yPercent: 16, transformOrigin: "50% 100%", duration: 0.09, ease: "power1.out" })
          .to(".hg-orb", { scaleX: 1, scaleY: 1, yPercent: 0, duration: 1, ease: "elastic.out(1, 0.32)" })
          .from(".hr-done", { scaleX: 0, transformOrigin: "0% 50%", duration: 1.1, ease: EASE_IN_OUT }, 2.2)
          .from(".hr-dot", { scale: 0, duration: 0.7, stagger: 0.18, ease: EASE_POP }, 2.2)
          .from(".hr-todo, .hr-label", { opacity: 0, duration: 0.8, stagger: 0.06 }, 2.45)
          .from(".hb-reg", { scale: 0, rotation: -90, opacity: 0, duration: 0.9, stagger: 0.07, ease: EASE_POP }, 2.2);

        // 4 · interface last
        tl.from(".hm-root", { yPercent: 105, duration: 1.15 }, 2.35)
          .from(".hn-item", { yPercent: -150, opacity: 0, duration: 0.95, stagger: 0.06 }, 2.4)
          .from(".he-disc", { scale: 0, rotation: -140, duration: 1.25, ease: EASE_POP }, 2.55)
          .from(".hl-scale", { scale: 0, duration: 1.05, ease: EASE_POP }, 2.7)
          .from(".hs-hint", { opacity: 0, y: 12, duration: 0.8 }, 2.85);
      });
      return tl;
    };

    /* ── enter / skip ─────────────────────────────────────────────────── */
    let intro: gsap.core.Timeline | null = null;

    const enter = (to?: string) => {
      if (committed || disposed) return;
      committed = true;
      setLensHover(false);
      window.clearTimeout(snapTimer);
      if (to) cb.current.onRoute(to);
      reveal();
      if (intro && intro.progress() < 1) intro.progress(1);
      lenis?.stop();
      if (reduced || !exit) {
        gsap.to(stage, { opacity: 0, duration: 0.35, ease: "power1.out", onComplete: finish });
        return;
      }
      exit.eventCallback("onComplete", finish);
      exit.timeScale(1.35).play();
    };
    enterApi.current = enter;

    const skip = () => {
      if (finished) return;
      committed = true;
      reveal();
      lenis?.stop();
      gsap.to(stage, { opacity: 0, duration: 0.25, ease: "power1.out", onComplete: finish });
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        skip();
        return;
      }
      if (intro?.isActive()) gsap.to(intro, { timeScale: 3, duration: 0.3, overwrite: true });
      const onButton = (e.target as Element | null)?.closest?.("button");
      if ((e.key === "Enter" || e.key === " ") && !onButton) {
        e.preventDefault();
        enter();
      }
    };
    const hurry = () => {
      if (intro?.isActive()) gsap.to(intro, { timeScale: 3, duration: 0.3, overwrite: true });
    };

    /* ── boot ─────────────────────────────────────────────────────────── */
    root.focus({ preventScroll: true });
    measure();
    gsap.ticker.add(tick);
    off.push(() => gsap.ticker.remove(tick));

    listen(window, "pointermove", onMove, { passive: true });
    listen(window, "pointerdown", onTouch, { passive: true });
    listen(document.documentElement, "pointerleave", onLeave);
    listen(window, "keydown", onKey);
    listen(root, "wheel", hurry, { passive: true });
    listen(root, "touchstart", hurry, { passive: true });

    let resizeRaf = 0;
    listen(window, "resize", () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        measure();
        if (exit && !committed && exit.progress() === 0) exit.invalidate();
      });
    });

    if (reduced) {
      listen(root, "scroll", () => {
        if (root.scrollTop > 8) enter();
      });
    } else {
      lenis = new Lenis({
        wrapper: root,
        content: root.firstElementChild as HTMLElement,
        lerp: 0.085,
        wheelMultiplier: 0.85,
        autoRaf: false,
      });
      lenis.stop();
      const raf = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(raf);
      off.push(() => gsap.ticker.remove(raf));

      lenis.on("scroll", (l: Lenis) => {
        if (committed || !exit) return;
        const p = l.limit > 0 ? Math.min(1, l.scroll / l.limit) : 0;
        exit.progress(p);
        if (p > 0.002) {
          reveal();
          setLensHover(false);
        }
        if (p >= 0.995) {
          committed = true;
          finish();
          return;
        }
        // Released half-way: finish the move or fall back, never park in between.
        window.clearTimeout(snapTimer);
        snapTimer = window.setTimeout(() => {
          if (committed || !exit) return;
          const cur = exit.progress();
          if (cur > 0.3) {
            committed = true;
            lenis?.stop();
            gsap.to(exit, { progress: 1, duration: 1.7 * (1 - cur), ease: "power2.out", onComplete: finish });
          } else if (cur > 0) {
            lenis?.scrollTo(0, { duration: 0.9 });
          }
        }, 180);
      });
    }

    waitForHeroFonts().then(() => {
      if (disposed) return;
      measure();
      intro = buildIntro();
      root.classList.add("is-live");
    });

    return () => {
      disposed = true;
      window.clearTimeout(snapTimer);
      cancelAnimationFrame(resizeRaf);
      off.forEach((fn) => fn());
      lenis?.destroy();
      ctx.revert();
    };
  }, [reduced, fine]);

  return (
    <div
      ref={rootRef}
      className={`hero-root${reduced ? " is-reduced" : ""}${fine ? " has-fine" : ""}`}
      tabIndex={-1}
      role="region"
      aria-label={`${HERO_BRAND.name} — intro`}
    >
      <div className="hero-content">
        <section ref={stageRef} className="hs-stage">
          <h1 className="sr-only">{HERO_QUOTE.join(" ")}</h1>
          <HeroArtwork enter={<EnterDisc onEnter={() => enterApi.current()} reduced={reduced} />} />
          <HeroNav onNavigate={(to) => enterApi.current(to)} reduced={reduced} />
          <div className="hs-hint" aria-hidden="true">
            <span className="hs-hint-line" />
            <span>Scorri</span>
            <span className="hn-dim">o premi ↵</span>
          </div>
          <Marquee reduced={reduced} />
          <div className="hs-portal" aria-hidden="true">
            <span className="hs-portal-kicker">{HERO_PORTAL.kicker}</span>
            <span className="hs-portal-word">
              {[...HERO_PORTAL.word].map((ch, i) => (
                <span key={i}>{ch}</span>
              ))}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
