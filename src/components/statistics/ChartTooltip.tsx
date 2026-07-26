import { CHART_SURFACE, CHART_TEXT, CHART_TYPE } from './chartTheme';

/**
 * ChartTooltip — un solo tooltip per tutti i grafici della sezione Statistiche.
 *
 * Prima ogni file disegnava il proprio: bordi, raggi, corpi del testo e
 * spaziature diversi da grafico a grafico. Passare il mouse su due grafici
 * affiancati mostrava due prodotti diversi.
 *
 * Struttura fissa: titolo (contesto: km, data, mese) + righe valore, ognuna con
 * il pallino del colore della propria serie. I numeri sono in mono tabulare,
 * così le cifre non ballano mentre il cursore si muove.
 */

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

export function ChartTooltip({ title, rows }: { title?: string; rows: TooltipRow[] }) {
  if (!rows.length) return null;
  return (
    <div
      className="rounded-xl px-3.5 py-2.5 shadow-2xl"
      style={{
        background: CHART_SURFACE.panelSoft,
        border: `1px solid ${CHART_SURFACE.borderStrong}`,
      }}
    >
      {title && (
        <p
          className="text-[10px] font-black uppercase tracking-widest mb-2"
          style={{ color: CHART_TEXT.muted }}
        >
          {title}
        </p>
      )}
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {r.color && (
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: r.color }}
                aria-hidden="true"
              />
            )}
            <span style={{ color: CHART_TEXT.muted }}>{r.label}</span>
            <span
              className="font-bold tabular-nums ml-auto"
              style={{ color: CHART_TEXT.primary, fontFamily: CHART_TYPE.mono }}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
