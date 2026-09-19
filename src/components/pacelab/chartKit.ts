import { useLayoutEffect, useRef, useState } from "react";

/** Gli attrezzi dei grafici del Pace Lab: misure, tacche, tracciati, colori. */

/** La larghezza vera del contenitore: i grafici disegnano in pixel veri. */
export function useWidth<T extends HTMLElement>(fallback = 900) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.clientWidth) setW(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => { if (e.contentRect.width) setW(Math.round(e.contentRect.width)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Tacche leggibili: 1, 2, 5, 10… mai 7. */
export function niceTicks(lo: number, hi: number, maxTicks: number, steps: number[]): number[] {
  const step = steps.find((s) => (hi - lo) / s <= maxTicks) ?? steps[steps.length - 1];
  const out: number[] = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

export const pathOf = (pts: [number, number][]) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");

/** Il colore di una frazione: lo scarto dal passo medio, divergente col neutro al centro. */
export const PACE_BINS = [
  { max: -0.015, color: "#F43F5E", label: "molto più veloce" },
  { max: -0.005, color: "#FB923C", label: "più veloce" },
  { max: 0.005, color: "#E5E7EB", label: "in media" },
  { max: 0.015, color: "#60A5FA", label: "più lento" },
  { max: Infinity, color: "#3B82F6", label: "molto più lento" },
];
export const paceColor = (dev: number) => PACE_BINS.find((b) => dev < b.max)!.color;
