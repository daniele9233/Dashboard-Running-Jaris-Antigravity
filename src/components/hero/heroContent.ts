/**
 * Everything the intro hero *says* lives here. Swap words freely: drawn glyphs
 * are matched by letter, so a word without an "O" simply loses its object.
 */

import { PLAN_BIBS } from "../../data/mezzaOttobrePlan";

export type GlyphKind = "orb" | "watch" | "track";

export interface HeroWord {
  word: string;
  /** First occurrence of each letter is replaced by a drawn glyph. */
  glyphs: Partial<Record<string, GlyphKind>>;
  /** Readout printed on the construction line inside the loupe. */
  spec: string;
}

/** Straight from the training plan, so the hero never promises a stale time. */
export const HERO_GOAL = {
  race: "5K",
  time: PLAN_BIBS[0].value,
};

/** The line as it should be read (screen readers get exactly this). */
export const HERO_QUOTE = [
  "non sono nemmeno vicino a dove voglio essere,",
  "ma sono lontano da dove ho iniziato",
  "e questo mi basta per farmi andare avanti.",
];

/**
 * The same line, cut for the lock-up: three words set huge, the connective
 * text set small between them, in reading order.
 */
export const HERO_WORDS: readonly [HeroWord, HeroWord, HeroWord] = [
  { word: "VICINO", glyphs: { O: "watch" }, spec: `OBIETTIVO · ${HERO_GOAL.race} IN ${HERO_GOAL.time}` },
  { word: "LONTANO", glyphs: { O: "track" }, spec: "KM 0 · PARTENZA · PISTA 400 M" },
  { word: "AVANTI", glyphs: { I: "orb" }, spec: "CADENZA 180 SPM · FC 168 BPM" },
];

export const HERO_PHRASES = {
  kicker: "Nota per i giorni duri",
  beforeFirst: "non sono nemmeno",
  afterFirst: "a dove voglio essere,",
  beforeSecond: "ma sono",
  beforeThird: "da dove ho iniziato e questo mi basta per farmi andare",
};

export const HERO_ROUTE = {
  start: "Km 0",
  here: "Sei qui",
  goal: HERO_GOAL.time,
  /** Where the marker sits between start and goal, 0–1. */
  progress: 0.64,
};

export const HERO_BIB = { top: "Metic Lab", number: HERO_GOAL.race };

export const HERO_BRAND = {
  name: "Metic Lab",
  sub: "Running Lab",
  clock: "Crono",
};

/** Nav entries enter the app straight at a route. */
export const HERO_NAV = [
  { label: "Dashboard", to: "/" },
  { label: "Allenamento", to: "/training" },
  { label: "Runner DNA", to: "/runner-dna" },
  { label: "Race Lab", to: "/race-lab" },
] as const;

export type MarqueeStyle = "solid" | "serif" | "outline" | "mono";

export const HERO_MARQUEE: ReadonlyArray<{ text: string; style: MarqueeStyle }> = [
  { text: "Metic Lab", style: "solid" },
  { text: "un chilometro alla volta", style: "serif" },
  { text: `Obiettivo ${HERO_GOAL.race} · ${HERO_GOAL.time}`, style: "mono" },
  { text: "Passo · Cuore · Testa", style: "outline" },
  { text: "Km 0 → ∞", style: "solid" },
  { text: "sempre avanti", style: "serif" },
  { text: "Roma · 41.90°N 12.49°E", style: "mono" },
  { text: "Corri. Misura. Ripeti.", style: "outline" },
];

export const HERO_ENTER_RING = "ENTRA NEL LAB — SCORRI O PREMI INVIO — ";

export const HERO_PORTAL = { kicker: "Pronti · partenza", word: "VIA!" };
