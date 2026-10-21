import type { ReactNode } from 'react';
import clsx from 'clsx';

/**
 * Legenda unica. Il campione riproduce il tratto della serie (linea piena,
 * tratteggio, puntinato, quadrato per le barre, pallino per la dispersione,
 * fascia per le aree): così misurato, derivato e previsto si distinguono senza
 * bisogno del colore. Con `onToggle` le voci diventano pulsanti a due stati.
 */

export type LegendKind = 'line' | 'dashed' | 'dotted' | 'area' | 'bar' | 'dot' | 'band';

export interface LegendItem {
  key: string;
  label: ReactNode;
  color: string;
  kind?: LegendKind;
  /** Valore corrente, mono tabulare, a destra del nome. */
  value?: ReactNode;
  /** Falso = serie nascosta (voce attenuata). Solo con `onToggle`. */
  active?: boolean;
}

function Swatch({ kind = 'line', color }: { kind?: LegendKind; color: string }) {
  switch (kind) {
    case 'bar':
      return <span className="ea-legend__swatch" style={{ width: 10, height: 10, borderRadius: 2, background: color }} aria-hidden="true" />;
    case 'dot':
      return <span className="ea-legend__swatch" style={{ width: 8, height: 8, borderRadius: 999, background: color }} aria-hidden="true" />;
    case 'band':
      return <span className="ea-legend__swatch" style={{ width: 16, height: 8, borderRadius: 2, background: color, opacity: 0.45 }} aria-hidden="true" />;
    case 'area':
      return (
        <svg className="ea-legend__swatch" width="16" height="10" viewBox="0 0 16 10" aria-hidden="true">
          <rect x="0" y="4" width="16" height="6" fill={color} opacity="0.3" />
          <line x1="0" y1="3" x2="16" y2="3" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    default: {
      const dash = kind === 'dashed' ? '5 3' : kind === 'dotted' ? '1.5 3' : undefined;
      return (
        <svg className="ea-legend__swatch" width="16" height="8" viewBox="0 0 16 8" aria-hidden="true">
          <line x1="1" y1="4" x2="15" y2="4" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={dash} />
        </svg>
      );
    }
  }
}

export function ChartLegend({
  items,
  onToggle,
  className,
  'aria-label': ariaLabel = 'Legenda',
}: {
  items: LegendItem[];
  onToggle?: (key: string) => void;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <ul className={clsx('ea-legend', className)} aria-label={ariaLabel}>
      {items.map((it) => {
        const inner = (
          <>
            <Swatch kind={it.kind} color={it.color} />
            <span>{it.label}</span>
            {it.value != null && <span className="ea-legend__value">{it.value}</span>}
          </>
        );
        return (
          <li key={it.key}>
            {onToggle ? (
              <button
                type="button"
                className="ea-legend__item ea-legend__item--button"
                aria-pressed={it.active !== false}
                onClick={() => onToggle(it.key)}
              >
                {inner}
              </button>
            ) : (
              <span className="ea-legend__item">{inner}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
