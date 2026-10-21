import type { TooltipContentProps } from 'recharts';

/** Direzione di una variazione: decide solo il colore, il segno sta sempre nel testo. */
export type Trend = 'up' | 'down' | 'flat';

/** Variazione con il segno nel testo: "+1.4", "-0.3", "0.0". Non altera il dato. */
export function formatDelta(value: number, digits = 1): { text: string; trend: Trend } {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return { text: (0).toFixed(digits), trend: 'flat' };
  return { text: `${rounded > 0 ? '+' : ''}${rounded.toFixed(digits)}`, trend: rounded > 0 ? 'up' : 'down' };
}

type Entry = NonNullable<TooltipContentProps['payload']>[number];

const isPaint = (c: unknown): c is string => typeof c === 'string' && c !== 'none' && !c.startsWith('url(');

/** Il colore della serie dal payload Recharts: stroke > color > fill, mai un `url(#gradiente)`. */
export const entryColor = (e: Entry): string | undefined =>
  [e.stroke, e.color, e.fill].find(isPaint) as string | undefined;
