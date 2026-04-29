/**
 * Telemetry / error reporting hook.
 *
 * Stub design — pronto per Sentry/Datadog/Rollbar/PostHog senza intaccare il
 * codice chiamante. Oggi: console.error + (opzionale) POST endpoint backend.
 * Domani: install `@sentry/react`, sostituisci `init()` e `reportError()` con
 * Sentry.init / Sentry.captureException.
 *
 * Nessuna dipendenza esterna installata: zero overhead bundle.
 */

interface TelemetryContext {
  scope?: string;
  componentStack?: string | null;
  [key: string]: unknown;
}

let _initialized = false;

/**
 * Inizializza il provider telemetry. Chiamare 1 volta in main.tsx (o equivalente).
 *
 * MIGRATION:
 *   import * as Sentry from '@sentry/react';
 *   Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, ...});
 */
export function initTelemetry(): void {
  if (_initialized) return;
  _initialized = true;

  // Hook globale: cattura errori non boundary-coperti.
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      reportError(event.error ?? new Error(event.message), { scope: 'window.error' });
    });
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      reportError(reason, { scope: 'unhandledrejection' });
    });
  }
}

/**
 * Riporta un errore al provider telemetry.
 *
 * MIGRATION:
 *   Sentry.captureException(err, { tags: { scope }, extra: { componentStack } });
 */
export function reportError(err: unknown, ctx: TelemetryContext = {}): void {
  const error = err instanceof Error ? err : new Error(String(err));

  // Console: sempre attivo in dev.
  console.error('[telemetry]', { message: error.message, stack: error.stack, ...ctx });

  // Production-only: invia al backend (best-effort, non aspettare).
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    try {
      const payload = JSON.stringify({
        message: error.message,
        stack: error.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        ...ctx,
      });
      // sendBeacon: best-effort, non blocca la pagina, non aspetta risposta.
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/telemetry/error', blob);
      }
    } catch {
      /* swallow — telemetry non deve mai rompere il chiamante */
    }
  }
}

/**
 * Riporta un evento informativo (analytics, breadcrumb).
 *
 * MIGRATION: Sentry.addBreadcrumb({ category, message, level, data });
 */
export function reportEvent(name: string, data: Record<string, unknown> = {}): void {
  if (typeof console !== 'undefined' && console.debug) {
    console.debug('[telemetry:event]', name, data);
  }
}
