import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Larghezza e altezza reali di un contenitore, aggiornate da ResizeObserver.
 *
 * Gli SVG disegnati a mano (non Recharts) usavano un `viewBox` fisso: su
 * telefono l'intero disegno si rimpiccioliva e i tick da 10 px diventavano 3.
 * Con le misure vere il disegno si ricalcola alla larghezza disponibile e il
 * testo resta a 12 px reali, a qualsiasi viewport.
 */
export function useElementSize<T extends HTMLElement>(fallback = { width: 640, height: 320 }) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const width = Math.round(el.clientWidth);
      const height = Math.round(el.clientHeight);
      if (width && height) setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}
