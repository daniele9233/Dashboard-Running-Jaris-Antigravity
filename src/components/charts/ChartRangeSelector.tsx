import clsx from 'clsx';

/**
 * Selettore di intervallo: controllo segmentato a due stati (`aria-pressed`).
 * Sostituisce le sette implementazioni locali di "1M 3M 6M" / "7D 30D 90D".
 * Non filtra nulla: comunica soltanto la scelta, il filtro resta del chiamante.
 */

export interface RangeOption<T extends string> {
  value: T;
  /** Testo del pulsante ("3M", "90D"). */
  label: string;
  /** Etichetta estesa per tecnologie assistive ("ultimi tre mesi"). */
  title?: string;
}

export function ChartRangeSelector<T extends string>({
  value,
  options,
  onChange,
  className,
  'aria-label': ariaLabel = 'Intervallo di tempo',
}: {
  value: T;
  options: ReadonlyArray<RangeOption<T> | T>;
  onChange: (next: T) => void;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div className={clsx('ea-range', className)} role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const opt: RangeOption<T> = typeof o === 'string' ? { value: o, label: o.toUpperCase() } : o;
        return (
          <button
            key={opt.value}
            type="button"
            className="ea-range__btn"
            aria-pressed={opt.value === value}
            title={opt.title}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
