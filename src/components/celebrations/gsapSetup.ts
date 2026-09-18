import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";

// Registrazione unica: ogni modulo celebrations importa gsap da qui.
// I plugin "club" (DrawSVG, SplitText, ...) sono gratuiti e inclusi nel
// pacchetto npm dal 3.13 (acquisizione Webflow).
gsap.registerPlugin(useGSAP, DrawSVGPlugin, MotionPathPlugin, SplitText, CustomEase);

/** Skip-to-end per chi ha richiesto meno animazioni a livello OS. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export { gsap, useGSAP, SplitText };
