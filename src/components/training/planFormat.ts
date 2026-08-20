/**
 * Le due funzioni che la pagina e la board si scambiano.
 *
 * Stanno in un file loro e non accanto ai componenti perché un modulo che
 * esporta sia componenti sia funzioni rompe il fast refresh di Vite: si
 * modifica un colore e si perde tutto lo stato del form.
 */

/** "19:59" o "1:34:35" → secondi. */
export function parseTime(s: string): number | null {
  const parts = s.trim().split(":").map((x) => Number(x));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

/**
 * Il colore di una probabilità.
 *
 * Le soglie non sono arbitrarie: sopra il 65% l'obiettivo è la previsione più
 * probabile, sotto il 25% è un tempo che richiede una giornata eccezionale. In
 * mezzo sta la fascia in cui le leve — l'ora di partenza, le scarpe, i km —
 * decidono davvero il risultato.
 */
export function probColor(p: number): string {
  if (p >= 0.65) return "#22C55E";
  if (p >= 0.45) return "#C0FF00";
  if (p >= 0.25) return "#F59E0B";
  return "#F43F5E";
}
