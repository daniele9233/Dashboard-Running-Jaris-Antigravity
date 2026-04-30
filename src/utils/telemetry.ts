/**
 * Telemetry / error reporting — Sentry-backed (round 7).
 *
 * Wire-up minimo:
 *   1. `npm i @sentry/react` (già fatto)
 *   2. Crea progetto Sentry (free tier 5k err/mese) → ottieni DSN
 *   3. Aggiungi env var `VITE_SENTRY_DSN` su Render frontend dashboard
 *   4. Build & deploy
 *
 * Senza DSN configurato: degrada graceful a console.error (dev/local mode).
 * Tutti i call site (ErrorBoundary, WidgetBoundary, main.tsx) restano invariati.
 */
import * as Sentry from '@sentry/react';

interface TelemetryContext {
  scope?: string;
  componentStack?: string | null;
  [key: string]: unknown;
}

let _initialized = false;

/**
 * Inizializza Sentry. Chiamato 1 volta in main.tsx.
 *
 * Se `VITE_SENTRY_DSN` non è configurata → no-op + listener fallback per
 * window.error / unhandledrejection (telemetry locale via console).
 */
export function initTelemetry(): void {
  if (_initialized) return;
  _initialized = true;

  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  const env = (import.meta.env.MODE as string) ?? 'production';

  if (dsn) {
    Sentry.init({
      dsn,
      environment: env,
      // Performance + session replay disabilitati per stare nel free tier
      // (5k events/mese). Abilitare quando si decide di pagare.
      tracesSampleRate: 0,
      // Ignora errori benigni
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        'Non-Error promise rejection captured',
      ],
      // Filter PII basico
      beforeSend(event) {
        if (event.request?.url) {
          // Strip query string per evitare token/code in URL
          event.request.url = event.request.url.split('?')[0];
        }
        return event;
      },
    });
  }

  // Listeners globali sempre attivi (anche senza DSN per dev locale).
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
 * Riporta un errore. Sentry se DSN configurato, sennò console.
 */
export function reportError(err: unknown, ctx: TelemetryContext = {}): void {
  const error = err instanceof Error ? err : new Error(String(err));

  // Console: sempre attivo in dev (Sentry suppress automaticamente in dev se vuoi).
  console.error('[telemetry]', { message: error.message, stack: error.stack, ...ctx });

  // Sentry capture (se inizializzato e DSN settato)
  if (_initialized && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.captureException(error, {
      tags: { scope: String(ctx.scope ?? 'unknown') },
      extra: {
        componentStack: ctx.componentStack ?? undefined,
        ...Object.fromEntries(Object.entries(ctx).filter(([k]) => k !== 'scope' && k !== 'componentStack')),
      },
    });
  }
}

/**
 * Breadcrumb / evento informativo.
 */
export function reportEvent(name: string, data: Record<string, unknown> = {}): void {
  if (typeof console !== 'undefined' && console.debug) {
    console.debug('[telemetry:event]', name, data);
  }
  if (_initialized && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.addBreadcrumb({
      category: 'app',
      message: name,
      level: 'info',
      data,
    });
  }
}

/**
 * Identifica l'utente attivo (per Sentry user context). Chiamare dopo profile fetch.
 * Quando arriva auth (#1 deferred): chiamare con user.id reale.
 */
export function identifyUser(user: { id?: string; email?: string; name?: string } | null): void {
  if (!_initialized || !import.meta.env.VITE_SENTRY_DSN) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
  });
}
