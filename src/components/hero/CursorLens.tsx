import type { ReactNode } from "react";

/**
 * The loupe. Positioned by the hero's ticker loop (translate only): the lens
 * moves one way, `.hl-inner` moves the opposite way and magnifies, so the X-ray
 * twin inside lines up with the solid type underneath. No clip-path, no repaint.
 *
 * Transform ownership, outside in: `.hl-lens` ← ticker loop (position),
 * `.hl-scale` ← intro / exit timelines, `.hl-hover` ← hover shrink.
 */
export function CursorLens({ children }: { children: ReactNode }) {
  return (
    <div className="hl-lens" aria-hidden="true">
      <div className="hl-scale">
        <div className="hl-hover">
          <div className="hl-window">
            <div className="hl-inner">
              <div className="hl-grid" />
              {children}
            </div>
            <div className="hl-fill" />
          </div>
          <svg className="hl-bezel" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="55" pathLength="120" />
          </svg>
          <svg className="hl-ring" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="49.5" />
            <path d="M50 0V7M50 93V100M0 50H7M93 50H100" />
            <path className="hl-cross" d="M50 45V55M45 50H55" />
          </svg>
          <span className="hl-readout">
            <span className="hl-readout-x">KM 0.00</span>
            <span className="hl-readout-y">0:00/KM</span>
            <span className="hl-readout-m">×1.3</span>
          </span>
        </div>
      </div>
    </div>
  );
}
