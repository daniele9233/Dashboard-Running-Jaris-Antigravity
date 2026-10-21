import type { CSSProperties, ReactNode } from 'react';
import clsx from 'clsx';
import type { Trend } from './utils';

/**
 * KPI e statistiche di sintesi.
 *
 * `ChartKpi` è un tile (surface-2, senza bordo proprio): vive dentro la card,
 * non è una card annidata. Con `onClick` diventa un pulsante a due stati
 * (`aria-pressed`) che filtra le serie.
 * Il delta porta sempre il segno nel testo: rischio e miglioramento non si
 * leggono dal solo colore.
 */

export interface ChartKpiProps {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  /** Icona decorativa prima dell'etichetta (aria-hidden). */
  icon?: ReactNode;
  /** Riga di contesto sotto l'etichetta (12 px, attenuata). */
  note?: ReactNode;
  /** Variazione già formattata con il suo segno ("+1.4", "-0.3"). */
  delta?: ReactNode;
  /** Direzione della variazione: decide solo il colore, il segno sta nel testo. */
  trend?: Trend;
  /** Colore della serie a cui il KPI appartiene (valore e bordo attivo). */
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Se presente il tile è un pulsante. */
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

export function ChartKpi({ label, value, unit, icon, note, delta, trend, color, size = 'md', onClick, active, className }: ChartKpiProps) {
  const style = color ? ({ '--ea-kpi-accent': color } as CSSProperties) : undefined;
  const cls = clsx('ea-kpi', size === 'lg' && 'ea-kpi--lg', size === 'sm' && 'ea-kpi--sm', className);
  const body = (
    <>
      <span className="ea-kpi__row">
        <span className="ea-kpi__value">{value}</span>
        {unit && <span className="ea-kpi__unit">{unit}</span>}
        {delta != null && (
          <span className="ea-kpi__delta" data-trend={trend ?? 'flat'}>
            {delta}
          </span>
        )}
      </span>
      <span className="ea-kpi__label">
        {icon && (
          <span className="ea-kpi__icon" aria-hidden="true">
            {icon}
          </span>
        )}
        {label}
      </span>
      {note && <span className="ea-kpi__note">{note}</span>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={cls} style={style} onClick={onClick} aria-pressed={!!active}>
        {body}
      </button>
    );
  }
  return (
    <div className={cls} style={style} data-active={active || undefined}>
      {body}
    </div>
  );
}

/** Striscia di KPI: colonne che si adattano alla larghezza (1 su telefono, fino a 4+ su desktop). */
export function ChartKpiStrip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('ea-kpis', className)}>{children}</div>;
}

/** Una statistica di sintesi sotto il grafico (valore mono, etichetta label). */
export function ChartStat({ label, value, unit, color }: { label: ReactNode; value: ReactNode; unit?: ReactNode; color?: string }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="ea-kpi__label">{label}</span>
      <span className="ea-kpi__row">
        <span className="ea-kpi__value" style={{ fontSize: 20, lineHeight: '24px', color: color ?? 'var(--color-ea-text)' }}>
          {value}
        </span>
        {unit && <span className="ea-kpi__unit">{unit}</span>}
      </span>
    </div>
  );
}

/** Riga di `ChartStat` sotto il grafico, separata da un filo. */
export function ChartStats({ children }: { children: ReactNode }) {
  return <div className="ea-stats">{children}</div>;
}
