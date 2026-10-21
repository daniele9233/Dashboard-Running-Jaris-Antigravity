import { useId, type ComponentType, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import clsx from 'clsx';
import { ChartEmptyState, ChartErrorState, ChartLoadingState } from './ChartStates';

/**
 * Contratto del grafico Elite Analytics:
 *
 *   ChartCard → ChartHeader → (KPI) → ChartPlot → (Legenda) → (Nota)
 *
 * `AnalyticsChartCard` compone tutto per il caso comune; i pezzi sono esportati
 * singolarmente per chi ha una struttura particolare (heatmap, mappe) ma vuole
 * lo stesso guscio. Nessuna card dentro la card: i KPI sono tile, non card.
 */

export type ChartPlotSize = 'compact' | 'standard' | 'tall' | 'hero' | 'square' | 'auto';

/** Il guscio: superficie, bordo, raggio e padding unici per ogni grafico. */
export function ChartCard({
  as: Tag = 'section',
  flush,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'article'; flush?: boolean }) {
  return <Tag className={clsx('ea-card', flush && 'ea-card--flush', className)} {...props} />;
}

export interface ChartHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Icona decorativa a sinistra del titolo (aria-hidden). */
  icon?: ReactNode;
  /** Controlli a destra: selettore di intervallo, espandi, info. */
  actions?: ReactNode;
  /** Id del titolo, per `aria-labelledby` della card. */
  titleId?: string;
  /** Livello del titolo; di default h3 (la pagina ha già h1/h2). */
  as?: 'h2' | 'h3' | 'h4';
}

/** Titolo (18/24), descrizione opzionale (13/18), azioni a destra. */
export function ChartHeader({ title, description, icon, actions, titleId, as: Heading = 'h3' }: ChartHeaderProps) {
  return (
    <header className="ea-header">
      <div className="ea-header__text">
        <Heading id={titleId} className="ea-title">
          {icon && (
            <span className="ea-header__icon" aria-hidden="true">
              {icon}
            </span>
          )}
          {title}
        </Heading>
        {description && <p className="ea-desc">{description}</p>}
      </div>
      {actions && <div className="ea-header__actions">{actions}</div>}
    </header>
  );
}

export interface ChartPlotProps {
  /** Classe dimensionale della famiglia: compact 160 · standard 240 · tall 320 · hero 360. */
  size?: ChartPlotSize;
  /** Cosa mostra il grafico, per le tecnologie assistive. */
  label?: string;
  /** Riassunto testuale del andamento: alternativa a chi non vede il grafico. */
  summary?: string;
  className?: string;
  /** Per chi misura il contenitore (SVG disegnati a mano): vedi `useElementSize`. */
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}

/** L'area di plot: altezza per famiglia (mai globale), contesto accessibile. */
export function ChartPlot({ size = 'standard', label, summary, className, ref, children }: ChartPlotProps) {
  const summaryId = useId();
  return (
    <div
      ref={ref}
      className={clsx('ea-plot', `ea-plot--${size}`, className)}
      role={label ? 'group' : undefined}
      aria-label={label}
      aria-describedby={summary ? summaryId : undefined}
    >
      {summary && (
        <p id={summaryId} className="sr-only">
          {summary}
        </p>
      )}
      {children}
    </div>
  );
}

/** Nota di interpretazione: una riga che dice come si legge il grafico. */
export function ChartInsight({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx('ea-insight', className)}>{children}</p>;
}

export type ChartStatus = 'ready' | 'loading' | 'empty' | 'error';

export interface AnalyticsChartCardProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  /** Striscia di `ChartKpi` sopra il grafico. */
  kpis?: ReactNode;
  /** `ChartLegend` sotto il grafico. */
  legend?: ReactNode;
  /** Statistiche di sintesi sotto la legenda (`ChartStats`). */
  stats?: ReactNode;
  /** Nota di interpretazione in fondo (`ChartInsight`). */
  insight?: ReactNode;
  size?: ChartPlotSize;
  /** Stato del dato: `ready` mostra i figli, gli altri mostrano lo stato nello stesso rettangolo. */
  status?: ChartStatus;
  /** Messaggio per `empty` / `error`. */
  statusMessage?: ReactNode;
  plotLabel?: string;
  summary?: string;
  className?: string;
  plotClassName?: string;
  plotRef?: Ref<HTMLDivElement>;
  as?: 'section' | 'div' | 'article';
  /** Il grafico (di norma `<ResponsiveContainer>`), mai la card. */
  children: ReactNode;
}

/** La card standard di un grafico: testata, KPI, plot, legenda, statistiche, nota. */
export function AnalyticsChartCard({
  title,
  description,
  icon,
  actions,
  kpis,
  legend,
  stats,
  insight,
  size = 'standard',
  status = 'ready',
  statusMessage,
  plotLabel,
  summary,
  className,
  plotClassName,
  plotRef,
  as,
  children,
}: AnalyticsChartCardProps) {
  const titleId = useId();
  return (
    <ChartCard as={as} className={className} aria-labelledby={titleId}>
      <ChartHeader title={title} description={description} icon={icon} actions={actions} titleId={titleId} />
      {kpis}
      <ChartPlot ref={plotRef} size={size} label={plotLabel} summary={summary} className={plotClassName}>
        {status === 'loading' ? (
          <ChartLoadingState />
        ) : status === 'empty' ? (
          <ChartEmptyState hint={statusMessage} />
        ) : status === 'error' ? (
          <ChartErrorState message={statusMessage} />
        ) : (
          children
        )}
      </ChartPlot>
      {legend}
      {stats}
      {insight && <ChartInsight>{insight}</ChartInsight>}
    </ChartCard>
  );
}

/**
 * Pannello di sezione con icona: il guscio che le viste analitiche usavano
 * ciascuna per conto proprio (`Panel` ×6). Titolo con icona, suggerimento come
 * descrizione, contenuto libero (grafici, tile, testo).
 */
export function ChartPanel({
  icon: Icon,
  title,
  hint,
  actions,
  children,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  return (
    <ChartCard className={className} aria-labelledby={titleId}>
      <ChartHeader titleId={titleId} icon={Icon && <Icon className="w-4 h-4" />} title={title} description={hint} actions={actions} />
      {children}
    </ChartCard>
  );
}
