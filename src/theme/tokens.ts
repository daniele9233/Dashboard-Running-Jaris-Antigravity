/**
 * I token del sistema, lato JavaScript.
 *
 * Rispecchiano il blocco `@theme` di `src/index.css`: le classi Tailwind
 * (`text-brand`, `bg-surface`, `border-line`…) coprono il markup, questi
 * valori coprono ciò che le classi non raggiungono — stili inline, SVG, grafici,
 * stringhe con canale alfa accodato (`${BRAND}33`).
 *
 * Il lime stava scritto a mano 473 volte. Un colore di marchio che si cambia con
 * un trova-e-sostituisci non è un colore di marchio: è una coincidenza ripetuta.
 */

/** L'accento: azione primaria, selezione, stato. Mai decorazione. */
export const BRAND = "#C0FF00";
/** Testo sopra il lime. */
export const BRAND_INK = "#0A0A0A";

export const CANVAS = "#050505";
export const SURFACE = "#0E0E0E";
export const SURFACE_2 = "#141414";

/** Testo, dal più forte al minimo leggibile (contrasti su #0A0A0A). */
export const INK = "#FFFFFF";
export const INK_MUTED = "#9E9E9E";   // 7:1
export const INK_DIM = "#878787";     // 5,4:1 — il minimo per il testo

export const MONO = "'JetBrains Mono', monospace";
