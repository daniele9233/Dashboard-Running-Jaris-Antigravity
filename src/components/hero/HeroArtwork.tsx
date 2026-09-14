import type { ReactNode } from "react";
import { AnimatedWordmark } from "./AnimatedWordmark";
import { CursorLens } from "./CursorLens";
import { RegMark } from "./HeroGlyphs";

/**
 * Everything drawn on the stage, back to front:
 * ground (grain + glows + marks) → solid specimen → loupe with its X-ray twin.
 */
export function HeroArtwork({ enter }: { enter: ReactNode }) {
  return (
    <>
      <div className="hb-root" aria-hidden="true">
        <div className="hb-glow hb-glow-lime" />
        <div className="hb-glow hb-glow-violet" />
        <div className="hb-grain" />
        <div className="hb-vignette" />
        <RegMark className="hb-reg hb-reg-tl" />
        <RegMark className="hb-reg hb-reg-tr" />
        <RegMark className="hb-reg hb-reg-bl" />
        <RegMark className="hb-reg hb-reg-br" />
      </div>

      <div className="hs-art" data-layer="type">
        <AnimatedWordmark variant="solid" enter={enter} />
      </div>

      <CursorLens>
        <div className="hs-art" data-layer="type">
          <AnimatedWordmark variant="xray" />
        </div>
      </CursorLens>
    </>
  );
}
