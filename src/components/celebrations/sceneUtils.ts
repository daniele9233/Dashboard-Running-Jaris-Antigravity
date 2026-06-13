import { gsap, prefersReducedMotion } from "./gsapSetup";

/** Props comuni a tutte le scene di celebrazione. */
export interface SceneProps {
  accent: string;
  accent2: string;
}

export const MONO = "'JetBrains Mono', monospace";

/** Applica reduced-motion: timeline costruita ma saltata alla fine. */
export function finish(tl: gsap.core.Timeline) {
  if (prefersReducedMotion()) tl.progress(1);
}
