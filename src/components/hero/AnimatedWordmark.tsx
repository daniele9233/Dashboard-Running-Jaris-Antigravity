import type { ReactNode } from "react";
import { BibObject, CustomGlyph } from "./HeroGlyphs";
import { HERO_PHRASES, HERO_ROUTE, HERO_WORDS } from "./heroContent";

export type WordmarkVariant = "solid" | "xray";

/**
 * Splitting a word into spans throws away the font's kerning, so the pairs that
 * visibly open up get it back by hand (em, applied after the first letter).
 */
const KERN: Record<string, number> = {
  AV: -0.035,
  VA: -0.035,
  TA: -0.03,
  AT: -0.03,
  TI: -0.01,
  LO: -0.03,
  VI: -0.01,
};

interface Props {
  variant: WordmarkVariant;
  /** Slot for the interactive ENTER disc (solid layer only). */
  enter?: ReactNode;
}

function Phrase({ className, children }: { className: string; children: ReactNode }) {
  return (
    <p className={`hp ${className}`}>
      <span className="hc-mask">
        <span className="hc-reveal">{children}</span>
      </span>
    </p>
  );
}

/**
 * The quote as a typographic lock-up: VICINO / LONTANO / AVANTI set huge, the
 * words that join them set small, all in reading order. Rendered twice — solid,
 * and as the X-ray twin seen through the loupe. Markup is identical on purpose:
 * GSAP targets both copies with the same selectors, so they never drift apart.
 */
export function AnimatedWordmark({ variant, enter }: Props) {
  let index = 0;

  const renderWord = (rowIdx: number) => {
    const row = HERO_WORDS[rowIdx];
    const used = new Set<string>();
    const letters = [...row.word];

    return letters.map((ch, i) => {
      const kind = !used.has(ch) ? row.glyphs[ch] : undefined;
      if (kind) used.add(ch);
      const next = letters[i + 1];
      const kern = next ? KERN[ch + next] ?? 0 : 0;
      const n = index++;
      return (
        <span
          key={`${rowIdx}-${i}`}
          className={`hw-char${kind ? " is-custom" : ""}`}
          data-i={n}
          style={kern ? { marginRight: `calc(var(--track) + ${kern}em)` } : undefined}
        >
          <span className="hw-glyph">{kind ? <CustomGlyph kind={kind} /> : ch}</span>
        </span>
      );
    });
  };

  return (
    <div className={`hw-specimen ${variant === "xray" ? "is-xray" : "is-solid"}`} aria-hidden="true">
      <div className="hp hp-lead">
        <p className="hp-kicker">
          <span className="hc-mask">
            <span className="hc-reveal">({HERO_PHRASES.kicker})</span>
          </span>
        </p>
        <p className="hp-text">
          <span className="hc-mask">
            <span className="hc-reveal">{HERO_PHRASES.beforeFirst}</span>
          </span>
        </p>
      </div>

      <div className="hw-cell hw-cell-1" data-spec={HERO_WORDS[0].spec}>
        <div className="hw-line hw-row-1">{renderWord(0)}</div>
      </div>

      <Phrase className="hp-after-first">{HERO_PHRASES.afterFirst}</Phrase>
      <Phrase className="hp-before-second">{HERO_PHRASES.beforeSecond}</Phrase>

      <div className="hw-cell hw-cell-2" data-spec={HERO_WORDS[1].spec}>
        <div className="hw-line hw-row-2">{renderWord(1)}</div>
        <span className="hw-bib-anchor">
          <span className="hw-float" data-depth="2.2">
            <span className="hw-obj hw-bib">
              <BibObject />
            </span>
          </span>
        </span>
      </div>

      <div className="he-slot">{variant === "solid" ? enter : <span className="he-ghost" />}</div>

      <Phrase className="hp-before-third">{HERO_PHRASES.beforeThird}</Phrase>

      <div className="hw-cell hw-cell-3" data-spec={HERO_WORDS[2].spec}>
        <div className="hw-line hw-row-3">{renderWord(2)}</div>
      </div>

      <div className="hr-route" style={{ ["--p" as string]: HERO_ROUTE.progress }}>
        <span className="hr-track">
          <span className="hr-done" />
          <span className="hr-todo" />
        </span>
        <span className="hr-dot hr-dot-start" />
        <span className="hr-dot hr-dot-here" />
        <span className="hr-dot hr-dot-goal" />
        <span className="hr-label hr-label-start">{HERO_ROUTE.start}</span>
        <span className="hr-label hr-label-here">{HERO_ROUTE.here}</span>
        <span className="hr-label hr-label-goal">{HERO_ROUTE.goal}</span>
      </div>
    </div>
  );
}
