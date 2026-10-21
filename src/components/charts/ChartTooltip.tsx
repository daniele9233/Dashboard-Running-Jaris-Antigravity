import type { ReactNode } from 'react';
import { Tooltip, type TooltipContentProps, type TooltipProps } from 'recharts';
import { chartCursor } from './theme';
import { entryColor } from './utils';

/**
 * Un solo tooltip per tutti i grafici.
 *
 * Struttura fissa: titolo (il contesto: km, data, mese) + righe valore, ognuna
 * con il pallino del colore della propria serie. I numeri sono in mono
 * tabulare, così le cifre non ballano mentre il cursore si muove.
 *
 * Due modi d'uso:
 *   <ChartTooltip title="21 ott" rows={[…]} />                      — SVG custom, Recharts con `content` a funzione
 *   <Tooltip content={<ChartTooltipContent … />} cursor={chartCursor} /> — Recharts
 */

export interface TooltipRow {
  label: ReactNode;
  value: ReactNode;
  /** Colore della serie: pallino a sinistra. Assente = nessun pallino. */
  color?: string;
}

export function ChartTooltip({ title, rows }: { title?: ReactNode; rows: TooltipRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="ea-tooltip" role="tooltip">
      {title != null && title !== '' && <p className="ea-tooltip__title">{title}</p>}
      <div className="ea-tooltip__rows">
        {rows.map((r, i) => (
          <div key={i} className="ea-tooltip__row">
            {r.color && <span className="ea-tooltip__dot" style={{ background: r.color }} aria-hidden="true" />}
            <span className="ea-tooltip__name">{r.label}</span>
            <span className="ea-tooltip__value">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type Entry = NonNullable<TooltipContentProps['payload']>[number];

export interface ChartTooltipContentProps {
  /** Iniettate da Recharts. */
  active?: boolean;
  payload?: TooltipContentProps['payload'];
  label?: TooltipContentProps['label'];
  /** Titolo dal valore di `label` e dal payload (di norma data o categoria). */
  title?: (label: TooltipContentProps['label'], payload: NonNullable<TooltipContentProps['payload']>) => ReactNode;
  /** Formatta il valore di ogni riga. Non cambia il dato: solo come si scrive. */
  valueFormatter?: (value: Entry['value'], name: Entry['name'], entry: Entry) => ReactNode;
  /** Riscrive del tutto una riga; `null` la nasconde. Ha la precedenza su `valueFormatter`. */
  row?: (entry: Entry, index: number) => TooltipRow | null;
  /** Stessa firma di `<Tooltip formatter>` di Recharts: `[valore, nome]`, un nodo, o `null` per nascondere. */
  formatter?: (
    value: any,
    name: any,
    entry: Entry,
    index: number,
    payload: NonNullable<TooltipContentProps['payload']>,
  ) => ReactNode | [ReactNode, ReactNode] | null | undefined;
  /** Stessa firma di `<Tooltip labelFormatter>` di Recharts. */
  labelFormatter?: (label: any, payload: NonNullable<TooltipContentProps['payload']>) => ReactNode;
}

/** Adattatore Recharts → `ChartTooltip`. */
export function ChartTooltipContent({
  active,
  payload,
  label,
  title,
  valueFormatter,
  row,
  formatter,
  labelFormatter,
}: ChartTooltipContentProps) {
  if (!active || !payload?.length) return null;
  const rows: TooltipRow[] = [];
  payload.forEach((e, i) => {
    if (row) {
      const r = row(e, i);
      if (r) rows.push(r);
      return;
    }
    if (e.value == null) return;
    if (formatter) {
      const out = formatter(e.value, e.name, e, i, payload);
      if (out == null) return;
      if (Array.isArray(out)) rows.push({ label: out[1], value: out[0], color: entryColor(e) });
      else rows.push({ label: String(e.name ?? e.dataKey ?? ''), value: out, color: entryColor(e) });
      return;
    }
    rows.push({
      label: String(e.name ?? e.dataKey ?? ''),
      value: valueFormatter ? valueFormatter(e.value, e.name, e) : String(e.value),
      color: entryColor(e),
    });
  });
  const heading = title ? title(label, payload) : labelFormatter ? labelFormatter(label, payload) : label != null ? String(label) : undefined;
  return <ChartTooltip title={heading} rows={rows} />;
}

/**
 * `<Tooltip>` di Recharts con il contenuto e il cursore del sistema già
 * impostati. Accetta le stesse `formatter` / `labelFormatter` del Tooltip
 * originale, quindi sostituisce `<Tooltip contentStyle=… formatter=…>`
 * cambiando solo il nome del tag.
 *
 *   <ChartTip formatter={(v) => [`${v} km`, 'Distanza']} />
 *   <ChartTip cursor={chartCursorBar} row={…} />
 */
export function ChartTip({
  formatter,
  labelFormatter,
  title,
  valueFormatter,
  row,
  content,
  cursor = chartCursor,
  ...rest
}: Omit<TooltipProps, 'formatter' | 'labelFormatter' | 'content'> &
  Pick<ChartTooltipContentProps, 'formatter' | 'labelFormatter' | 'title' | 'valueFormatter' | 'row'> & {
    /** Contenuto proprio (es. `<ChartTooltipContent …/>` con altre opzioni, o una funzione). */
    content?: TooltipProps['content'];
  }) {
  return (
    <Tooltip
      cursor={cursor}
      isAnimationActive={false}
      wrapperStyle={{ outline: 'none', zIndex: 30 }}
      content={
        content ?? (
          <ChartTooltipContent
            formatter={formatter}
            labelFormatter={labelFormatter}
            title={title}
            valueFormatter={valueFormatter}
            row={row}
          />
        )
      }
      {...rest}
    />
  );
}
