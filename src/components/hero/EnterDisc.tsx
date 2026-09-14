import { forwardRef } from "react";
import { Magnetic } from "./Magnetic";
import { ArrowGlyph } from "./HeroGlyphs";
import { HERO_ENTER_RING } from "./heroContent";

interface Props {
  onEnter: () => void;
  reduced: boolean;
}

/** The only call to action: a lime disc inside a slowly turning ring of text. */
export const EnterDisc = forwardRef<HTMLButtonElement, Props>(function EnterDisc({ onEnter, reduced }, ref) {
  return (
    <Magnetic className="he-magnet" strength={0.4} innerStrength={0.18} disabled={reduced}>
      <button ref={ref} type="button" className="he-disc" onClick={onEnter} aria-label="Entra in Metic Lab">
        <svg className="he-ring" viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            <path id="he-ring-path" d="M100 100m-84 0a84 84 0 1 1 168 0a84 84 0 1 1-168 0" />
          </defs>
          <text>
            <textPath href="#he-ring-path" textLength="527" lengthAdjust="spacing">
              {HERO_ENTER_RING}
            </textPath>
          </text>
        </svg>
        <span className="he-core">
          <ArrowGlyph className="he-arrow" />
        </span>
      </button>
    </Magnetic>
  );
});
