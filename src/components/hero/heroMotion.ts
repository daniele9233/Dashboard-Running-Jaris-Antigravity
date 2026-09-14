import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(CustomEase, MotionPathPlugin);

/** Long, decisive settle — most things arrive on this. */
export const EASE_OUT = CustomEase.create("hero.out", "M0,0 C0.12,0.9 0.2,1 1,1");
/** Overshoot for drawn objects. */
export const EASE_POP = CustomEase.create("hero.pop", "M0,0 C0.3,1.6 0.55,1 1,1");
/** Symmetric, heavy in the middle — exits and curtains. */
export const EASE_IN_OUT = CustomEase.create("hero.inOut", "M0,0 C0.7,0 0.2,1 1,1");
/** Accelerating fall. */
export const EASE_IN = CustomEase.create("hero.in", "M0,0 C0.5,0 0.9,0.5 1,1");

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const hasFinePointer = () =>
  typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/**
 * Deterministic "random" per letter index. Both the solid wordmark and its
 * X-ray twin read the same value, so the twin stays glued under the loupe.
 */
export const seeded = (i: number, salt = 1) => {
  const x = Math.sin((i + 1) * 12.9898 * salt) * 43758.5453;
  return x - Math.floor(x);
};

/** Resolve when the display faces are ready, or give up after `timeout`. */
export function waitForHeroFonts(timeout = 1200): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  const load = Promise.all([
    document.fonts.load('900 1em "Archivo"'),
    document.fonts.load('italic 400 1em "Instrument Serif"'),
    document.fonts.load('500 1em "JetBrains Mono"'),
  ]).then(() => undefined);
  const cap = new Promise<void>((resolve) => window.setTimeout(resolve, timeout));
  return Promise.race([load, cap]).catch(() => undefined);
}
