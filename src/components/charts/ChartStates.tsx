import type { ReactNode } from 'react';

/**
 * Stati del grafico: vuoto, caricamento, errore. Occupano lo stesso rettangolo
 * del plot, così la card non cambia altezza quando arrivano i dati.
 * Il vuoto dice cosa manca; l'errore dice cosa è andato storto e come recuperare.
 */

export function ChartEmptyState({ title = 'Dati insufficienti', hint }: { title?: ReactNode; hint?: ReactNode }) {
  return (
    <div className="ea-state" role="status">
      <span className="ea-state__title">{title}</span>
      {hint && <span>{hint}</span>}
    </div>
  );
}

export function ChartLoadingState({ label = 'Caricamento del grafico' }: { label?: string }) {
  return <div className="ea-skeleton" role="status" aria-busy="true" aria-label={label} />;
}

export function ChartErrorState({
  title = 'Grafico non disponibile',
  message,
  onRetry,
}: {
  title?: ReactNode;
  message?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div className="ea-state ea-state--error" role="alert">
      <span className="ea-state__title">{title}</span>
      {message && <span>{message}</span>}
      {onRetry && (
        <button type="button" className="ea-range__btn" onClick={onRetry}>
          Riprova
        </button>
      )}
    </div>
  );
}
