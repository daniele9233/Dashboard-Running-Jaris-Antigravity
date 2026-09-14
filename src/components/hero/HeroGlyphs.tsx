/**
 * Drawn letterforms and small objects. Every glyph is sized in `em` so it sits
 * on the Archivo baseline of the word it lives in (cap height = 0.69em).
 * The same markup renders solid or as X-ray; `hero.css` decides which.
 */

import type { GlyphKind } from "./heroContent";
import { HERO_BIB, HERO_GOAL } from "./heroContent";

/** Lowercase-i gesture inside an uppercase word: short bar + balanced lime orb. */
function OrbGlyph() {
  return (
    <span className="hg hg-orb-i" data-custom="I · RUNNER">
      <span className="hg-bar hg-orb-bar" />
      <span className="hw-float" data-depth="1.4">
        <span className="hw-obj hg-orb" />
      </span>
    </span>
  );
}

const TICKS = Array.from({ length: 12 }, (_, i) => {
  const a = (Math.PI / 6) * i;
  const r1 = i % 3 === 0 ? 20.5 : 23;
  return {
    x1: 50 + r1 * Math.sin(a),
    y1: 50 - r1 * Math.cos(a),
    x2: 50 + 26 * Math.sin(a),
    y2: 50 - 26 * Math.cos(a),
  };
});

/**
 * O as a stopwatch: a ring as heavy as the letter's stroke, crown on top, an
 * orange start button, a lime hand and the goal time on the dial.
 */
function WatchGlyph() {
  return (
    <span className="hg hg-watch" data-custom="O · CRONO">
      <svg className="hg-svg hw-obj hg-watch-shape" viewBox="0 0 100 100" aria-hidden="true">
        <rect className="hg-watch-crown" x="41" y="-13" width="18" height="9" rx="1.5" />
        <rect className="hg-watch-crown" x="46" y="-5" width="8" height="6" />
        <rect className="hg-watch-button" x="-6" y="-4" width="12" height="8" rx="1.5" transform="translate(88 10) rotate(45)" />
        <path className="hg-watch-ring" d="M50 0a50 50 0 1 0 0.001 0ZM50 21a29 29 0 1 1-0.001 0Z" fillRule="evenodd" />
        <g className="hg-watch-ticks">
          {TICKS.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
          ))}
        </g>
        <text className="hg-watch-time" x="50" y="70" textAnchor="middle">
          {HERO_GOAL.time}
        </text>
        <g className="hg-watch-hand">
          <line x1="50" y1="56" x2="50" y2="27" />
          <circle cx="50" cy="50" r="3.4" />
        </g>
        <g className="hg-construct">
          <circle cx="50" cy="50" r="50" />
          <line x1="50" y1="-16" x2="50" y2="116" />
          <line x1="-16" y1="50" x2="116" y2="50" />
        </g>
      </svg>
    </span>
  );
}

/**
 * O as a 400 m track seen from above: outer and inner contour of a condensed O,
 * two lane lines between them, a finish line, and a runner lapping lane two.
 * The runner is an ellipse so the word's vertical stretch turns it round again.
 */
const TRACK_LANE_PATH = "M10 28A18 18 0 0 1 46 28L46 41A18 18 0 0 1 10 41Z";

function TrackGlyph() {
  return (
    <span className="hg hg-track" data-custom="O · PISTA 400 M">
      <svg className="hg-svg hg-track-shape" viewBox="0 0 56 69" aria-hidden="true">
        <rect className="hg-track-edge" x="1" y="1" width="54" height="67" rx="27" />
        <rect className="hg-track-lane" x="6.5" y="6.5" width="43" height="56" rx="21.5" />
        <rect className="hg-track-lane" x="13" y="13" width="30" height="43" rx="15" />
        <rect className="hg-track-edge" x="19" y="19" width="18" height="31" rx="9" />
        <line className="hg-track-finish" x1="43" y1="34.5" x2="55" y2="34.5" />
        <path className="hg-track-path" d={TRACK_LANE_PATH} />
        <g className="hg-runner">
          <ellipse rx="3.3" ry="2.5" />
        </g>
      </svg>
    </span>
  );
}

export function CustomGlyph({ kind }: { kind: GlyphKind }) {
  if (kind === "orb") return <OrbGlyph />;
  if (kind === "watch") return <WatchGlyph />;
  return <TrackGlyph />;
}

/** Race bib, pinned at four corners. */
export function BibObject() {
  return (
    <span className="hb-bib" data-custom="PETTORALE">
      <span className="hb-bib-pins" />
      <span className="hb-bib-top">{HERO_BIB.top}</span>
      <span className="hb-bib-number">{HERO_BIB.number}</span>
    </span>
  );
}

/** Four-point spark used between ticker items. */
export function SparkGlyph({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 0C10.9 6.2 13.8 9.1 20 10C13.8 10.9 10.9 13.8 10 20C9.1 13.8 6.2 10.9 0 10C6.2 9.1 9.1 6.2 10 0Z" />
    </svg>
  );
}

export function RegMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 0V24M0 12H24" />
    </svg>
  );
}

/** Mini stopwatch, in the same language as the O of VICINO. */
export function Monogram({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 30 34" aria-hidden="true">
      <rect x="11" y="0" width="8" height="4" fill="var(--h-paper)" />
      <path d="M15 5a14.5 14.5 0 1 0 0.001 0ZM15 11a8.5 8.5 0 1 1-0.001 0Z" fillRule="evenodd" fill="var(--h-paper)" />
      <path d="M15 19.5V13.5" stroke="var(--h-lime)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowGlyph({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M9 9L31 31M31 13V31H13" fill="none" strokeWidth="4.2" strokeLinecap="square" />
    </svg>
  );
}
