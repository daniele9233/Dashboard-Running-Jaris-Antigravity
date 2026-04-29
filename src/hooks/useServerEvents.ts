import { useEffect, useRef } from 'react';
import { invalidateCache } from './useApi';
import { API_CACHE } from './apiCacheKeys';

/**
 * Server-Sent Events client.
 *
 * Si connette a `/api/events/stream` (FastAPI) e ascolta eventi pushati dal
 * backend. Su `sync_complete` invalida le cache rilevanti → UI si aggiorna
 * automaticamente senza F5.
 *
 * Reconnect strategy: nativa di EventSource (auto-retry con backoff). Se la
 * connessione cade per timeout proxy/network, il browser ritenta da solo.
 *
 * Estensione futura (#1 auth): passare ?token=... o usare cookie auth.
 */

export type ServerEvent =
  | { type: 'connected'; ts: string }
  | { type: 'sync_started'; source: 'strava' | 'garmin'; ts: string }
  | { type: 'sync_complete'; source: 'strava' | 'garmin'; count: number; ts: string }
  | { type: 'sync_error'; source: 'strava' | 'garmin'; error: string; ts: string }
  | { type: 'training_adapted'; triggered: number; weeks: number; ts: string };

export interface UseServerEventsOptions {
  /** URL endpoint SSE. Default = `${VITE_BACKEND_URL}/api/events/stream`. */
  url?: string;
  /** Callback opzionale invocato su ogni evento. */
  onEvent?: (event: ServerEvent) => void;
  /** Disabilita auto-cache-invalidation (default: true). */
  autoInvalidate?: boolean;
}

const BACKEND_URL = (typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_BACKEND_URL ?? '')
  : '') as string;

/**
 * Hook globale: monta UNA volta in App.tsx. Se chiamato più volte,
 * ogni instance apre una sua connessione (idempotency a carico del chiamante).
 */
export function useServerEvents(options: UseServerEventsOptions = {}): void {
  const { url, onEvent, autoInvalidate = true } = options;
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    const fullUrl = url ?? `${BACKEND_URL}/api/events/stream`;
    let es: EventSource | null = null;
    let cancelled = false;

    try {
      es = new EventSource(fullUrl);
    } catch (err) {
      console.error('[useServerEvents] EventSource creation failed:', err);
      return;
    }

    es.onmessage = (e) => {
      if (cancelled) return;
      let payload: ServerEvent;
      try {
        payload = JSON.parse(e.data);
      } catch {
        return;
      }
      onEventRef.current?.(payload);

      if (autoInvalidate) {
        switch (payload.type) {
          case 'sync_complete':
            invalidateCache(API_CACHE.RUNS);
            invalidateCache(API_CACHE.DASHBOARD);
            invalidateCache(API_CACHE.ANALYTICS);
            invalidateCache(API_CACHE.BEST_EFFORTS);
            invalidateCache(API_CACHE.HEATMAP);
            invalidateCache(API_CACHE.SUPERCOMPENSATION);
            invalidateCache(API_CACHE.VDOT_PACES);
            break;
          case 'training_adapted':
            invalidateCache(API_CACHE.TRAINING_PLAN);
            invalidateCache(API_CACHE.TRAINING_CURRENT_WEEK);
            break;
          default:
            break;
        }
      }
    };

    es.onerror = () => {
      // EventSource ha auto-reconnect built-in con backoff; logga e basta.
      // Non chiudere: lasciare che il browser gestisca il retry.
      if (!cancelled) {
        console.debug('[useServerEvents] connection error, browser will retry');
      }
    };

    return () => {
      cancelled = true;
      es?.close();
    };
  }, [url, autoInvalidate]);
}
