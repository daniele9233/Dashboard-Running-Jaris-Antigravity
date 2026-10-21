import { useSyncExternalStore } from 'react';

/**
 * `matchMedia` come stato React, senza effetti né flash: serve ai grafici per
 * diradare i tick e ridurre i margini su telefono. In SSR/test (nessun DOM)
 * vale `false`.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener('change', notify);
      return () => mq.removeEventListener('change', notify);
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** Larghezza da telefono (< 640 px): meno tick, legende a capo, tooltip al tocco. */
export const useIsNarrow = () => useMediaQuery('(max-width: 639px)');

/** L'utente ha chiesto meno movimento: niente animazioni di Recharts né transizioni di stato. */
export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
