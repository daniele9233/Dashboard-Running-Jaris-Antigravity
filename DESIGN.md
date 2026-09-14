# Intro Hero — Design Spec

The full-screen running hero that opens before METIC LAB. Lives in `src/components/hero/`.

## 1. Reference analysis — tigranz.com (art direction only, nothing reused)

Captured with Playwright (Edge) at 1440×900, 1920×1080, 390×844, plus entrance
frames at 0.3 / 0.8 / 1.4 / 2.2 / 3.2 / 5 s and hover states.

| Aspect | Observation |
|---|---|
| Build | Framer site. Hero wordmark, logo and nav labels are Rive canvases, not DOM text. |
| Composition | One centred lock-up (~1040×560 at 1440w). Two words: a top word where every letter is a different object/material, a bottom word in a single wide grotesk that tucks under it (overlap ~15px). Everything else is empty dark space. |
| Viewport | Stage 777px + ticker 88px = 865px at 900 tall: ~96vh, the next section peeks. Fixed nav 72px. |
| Background | Flat `rgb(9,10,12)`. No visible noise, no glow. Contrast comes from saturated letters, not the ground. |
| Type | Display: Neue Regrade (wide grotesk, geometric "ı" without a dot). Nav: lowercase ~20px. Scale gap is enormous — 200px display vs 20px UI, nothing in between. |
| Colour | Red, violet, yellow, pink, lime — each confined to exactly one letter. Off-white for the second word and all UI. |
| Entrance | Ticker is present first (~0.8s), nav at ~2s, then letters appear one by one, left→right, each ~150ms apart with scale/rotate overshoot (the O spins in as a small rotated square and grows). The bottom word comes last. Total ≈ 4s — sequential, slow, deliberate. |
| Idle | Letters keep micro-animating (character blinks, squiggle breathes). |
| Hover | Hovering the lock-up flips it into a "design tool" wireframe state: letters become outlines, bottom word gets a selection box with handles and a pointer. Nav: hovered label swaps a letter for a sparkle glyph and turns violet. |
| Cursor | No parallax detected; interaction is state-swap, not physics. |
| Ticker | Full-bleed, hairline top border, 88px tall. Translates ~60 px/s linearly. Items restyle themselves over time (plain → logo → script), separators are 4-point stars. |
| Scroll | Native scroll, ticker scrolls away with the hero; a sticky-feeling nav stays. Next block is a showreel with a cursor-follow "play" label. |
| Mobile | Not 100vh. Lock-up shrinks to full width (~315px tall block), nav collapses into three diamonds, ticker sits directly below. |

**What makes it work:** one idea (letters as characters), colour concentrated per
glyph, a huge scale gap between display and UI, long patient timing, and an
interaction that reveals *process* rather than adding decoration.

## 2. Our concept — "The line, read like a run"

The hero is a running quote, set as a typographic poster:

> non sono nemmeno vicino a dove voglio essere,
> ma sono lontano da dove ho iniziato
> e questo mi basta per farmi andare avanti.

Three words carry it — **VICINO / LONTANO / AVANTI** — set huge; the words that
join them are set small, in reading order, zig-zagging left and right like a
line on a track. The one memorable interaction is still **the lime loupe**: it
follows the cursor and X-rays the poster the way METIC LAB reads a run —
outlines, construction lines, and a readout that turns position into a race
(x = km of the goal race, y = pace per km). Entering means going *through* it:
the lens fills the screen, "Pronti · partenza · VIA!" fires, the stage slides up.

Original on purpose: no mascots, no material-per-letter, no hover state-swap.

### Words and objects (editable in `heroContent.ts`)

```
VICINO    solid · wide · the O is a stopwatch (crown, orange start button,
          lime hand sweeping, the goal time on the dial)
LONTANO   outlined · condensed · stretched up · the O is a 400 m track seen
          from above, lanes dashed, a lime runner lapping lane two
AVANTI    solid · wide · the i carries the lime orb, which drops in and squashes
bib       yellow race bib pinned to LONTANO, the goal distance on it
route     Km 0 ●━━━━━◉ sei qui ┄┄┄○ goal time — the quote as an infographic
```

Goal race and time come from `KIKKO_SUB20_META` (the training plan), so the
dial, bib, route and ticker never promise a stale target.

### Layout — desktop

- Nav (88px): stopwatch monogram + "Metic Lab / Running Lab" · four routes into
  the app (Dashboard, Allenamento, Runner DNA, Race Lab) · a race clock started
  when the page opened.
- Grid of 25cqw + 1fr:
  `(kicker) non sono nemmeno` ← `VICINO` (right) · `a dove voglio essere,` (right) ·
  `ma sono` + ENTER disc ← `LONTANO` (right, bib on its end) ·
  `da dove ho iniziato e questo mi basta per farmi andare` (right) ·
  `AVANTI` (left) → route (right).
- Ticker (72px): Metic Lab · un chilometro alla volta · Obiettivo 5K · passo ·
  cuore · testa · Km 0 → ∞ · sempre avanti · Roma · Corri. Misura. Ripeti.

### Layout — phone & portrait tablet (poster, not scaled)

- Kicker + `non sono nemmeno`, then `VICINO` full width (wdth 75).
- `LONTANO` becomes a spine down the right edge, read top to bottom; the bib is
  pinned across its foot.
- Left of the spine, in order: `a dove voglio essere,` · `ma sono` · ENTER disc ·
  `da dove ho iniziato e questo mi basta per farmi andare` · route.
- `AVANTI` full width at the bottom. Loupe autopilots; a tap moves it.

### Palette

| Token | Value | Use |
|---|---|---|
| `--h-ink` | `#080908` | ground |
| `--h-paper` | `#F1EFE6` | type, UI |
| `--h-lime` | `#C0FF00` | orb, stopwatch hand, runner, "sei qui", loupe, ENTER, portal |
| `--h-violet` | `#7C5CFF` | distance already run on the route |
| `--h-orange` | `#FF5B1F` | stopwatch start button |
| `--h-yellow` | `#FFD23F` | race bib |

Background: `#080908` + static SVG grain + a lime radial glow low-left + a violet
one top-right. No blur filters.

### Typography

- Display: **Archivo** variable (wdth 62–125, wght 100–900). Wide black for
  VICINO/AVANTI, condensed outline for LONTANO.
- Connective words: **Instrument Serif** italic, clamp(15px, 2.35cqw, 40px).
- Micro UI: **JetBrains Mono** (the app's mono), 9–11px, tracked out.

## 3. Motion

Custom eases (GSAP CustomEase):

- `hero.out` — `M0,0 C0.12,0.9 0.2,1 1,1` (long decisive settle)
- `hero.pop` — `M0,0 C0.3,1.6 0.55,1 1,1` (overshoot for objects)
- `hero.inOut` — `M0,0 C0.7,0 0.2,1 1,1` (exit)

Entrance — one timeline that reads the sentence (≈ 3.6s):

| t (s) | Beat |
|---|---|
| 0.00 | grain + glows |
| 0.10 | kicker, "non sono nemmeno" |
| 0.25 | VICINO letters rise, rotate ±13° → 0; stopwatch pops, its hand spins two turns and lands |
| 0.80 | "a dove voglio essere," · 0.98 "ma sono" |
| 1.05 | LONTANO letters grow up from the baseline |
| 1.50 | "da dove ho iniziato e questo mi basta per farmi andare" |
| 1.62 | AVANTI letters rise |
| 1.70 | bib drops and swings · runner appears on the track · orb falls onto the i and squashes · route draws |
| 2.35 | ticker, nav, ENTER, loupe, hint — interface last |

Idle: stopwatch hand 9s per turn, runner laps in 6.5s (MotionPath, counter-clockwise
from the finish line), bib sways, orb bobs, glows drift, ENTER ring turns.
Pointer: parallax on three depths, letters within 240px lean in (scaleY ≤ 1.11,
skew ≤ 7°), the loupe's bezel turns with pointer velocity.

Exit (scrubbed by Lenis, or played by ENTER / ↵, ≈ 1.9s): small words slide out,
letters disperse by row, bib flies off → loupe centres and covers → lime →
"Pronti · partenza / VIA!" → the stage slides up off the dashboard.

Reduced motion: no stagger/parallax/idle/loupe tracking; fades only; runner parked
on the finish line; ticker static.

## 4. Implementation notes

- Stack: the site is a Vite + React 19 SPA, so the hero lives inside it (not a
  separate Next.js app): TypeScript, Tailwind 4, GSAP 3.15 (+ CustomEase, MotionPath), Motion
  (magnetic springs), Lenis (scroll-scrubbed exit on the hero's own scroller).
- `IntroGate` (in `main.tsx`) renders the hero over the app. `App` is a lazy
  chunk, requested only when the entrance ends; until the hero leaves, the app
  wrapper is `inert`. Skips: `?strava_code` (OAuth return), `?intro=0`.
- Inputs: scroll/swipe scrubs the exit (released past 30% it completes, below it
  springs back) · ENTER disc or ↵ plays it · nav items enter at a route · Esc skips.
- Quote cut, words, ticker, nav routes, portal: `src/components/hero/heroContent.ts`.

| File | Role |
|---|---|
| `IntroGate.tsx` | when to show, mounts app underneath |
| `IntroHero.tsx` | choreography, Lenis, the single ticker loop (parallax, loupe, letter lean) |
| `HeroArtwork.tsx` | ground + solid specimen + loupe with X-ray twin |
| `AnimatedWordmark.tsx` | the quote lock-up, rendered twice with identical markup |
| `HeroGlyphs.tsx` | orb-i, stopwatch-O, track-O, bib, spark, marks, monogram |
| `CursorLens.tsx` · `Marquee.tsx` · `HeroNav.tsx` · `EnterDisc.tsx` · `Magnetic.tsx` | UI pieces |

## 5. Refinement log

1. **Pass 1** — CREATIVE's outline crossed DANIELE's white letters → row 1 now
   sits above row 2, so CREATIVE tucks *behind*. Loupe's drop shadow smudged the
   white Δ → replaced by a 3px ink ring. Ring text was stretched letter-by-letter
   → larger mono, longer copy. Caption swash touched the L → caption raised.
   Hairline seam between B stem and bowls → bowls overlap the stem by 0.01em.
   Ticker outline items were muddy at 30px → light condensed, dimmed.
2. **Pass 2** — Loupe resting on Δ hid the orange ball → rests on CREATIVE.
   Bowl sway read as misalignment in stills → ±1.5°. Phone: readout clipped at
   the edge → hidden; spine pulled inside the gutter. Tap-to-move compared two
   different clocks → fixed.
3. **Pass 3** — Exit felt empty mid-way → lime portal with "Entering / Metic Lab"
   before the curtain. Loupe bezel now turns with pointer velocity. Over controls
   the loupe shrinks to a ring with `difference` blending (it vanished on lime).
   The X-ray twin's CTA slot was catching clicks above the real button → every
   node in the loupe is `pointer-events: none`.
4. **Pass 4** — Clicking ENTER while hovering it left the loupe in hover state, so
   the lime fill never showed → hover is cleared the moment the exit commits.
   Portrait tablets got the desktop layout with a huge empty band → they use the
   poster composition. Nav labels wrapped at 768 → `nowrap`. ENTER disc aligned to
   LAB's baseline (it grazed CREATIVE at 1366×660).

5. **Running version** — the lock-up became the quote. Measured every word
   first (VICINO 4.68em wide, LONTANO 3.49em condensed, AVANTI 4.99em wide) and
   built the zig-zag grid from those numbers. Fixes after the first render:
   the ENTER disc overlapped "ma sono" at 1366×660 → it spans two grid rows;
   the bib touched "a dove voglio essere," → pinned lower; the loupe's readout
   covered a phrase at rest → rest point raised; letters left with a residual
   `scaleY(1.0004)` looked soft → the transform is removed once they settle.

Measured (Playwright, Edge headless, 1440×900): idle worst frame 7.2 ms. Initial
JS chunk 315 kB (gzip 106 kB) with `App` lazy, vs 648 kB before the hero.
The build's >600 kB warning is `vendor-mapbox` (2.9 MB, pre-existing, lazy).

## 6. Performance rules

- Only `transform` and `opacity` animate. Loupe uses translate + counter-translate, no clip-path.
- Pointer moves write to a plain object; one `gsap.ticker` callback applies transforms. No React state per frame.
- Dashboard mounts after the entrance ends (or on exit start), so its data/render work never competes with the choreography.
- Fonts awaited (max 1.2s) before the timeline starts, so glyph sizes don't jump.
