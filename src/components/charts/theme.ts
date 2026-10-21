/**
 * Elite Analytics — tema dei grafici (fonte TypeScript).
 *
 * Specchio di `src/design/tokens.css`: i valori sono identici e `theme.test.ts`
 * lo verifica. Ogni grafico, in qualunque rotta, prende da qui colori, misure,
 * tratti e preset Recharts. Un esadecimale scritto dentro un componente di
 * grafico è un difetto, non una scelta.
 *
 * `src/components/statistics/chartTheme.ts` ri-esporta questo modulo: i vecchi
 * import (`CHART_SERIES`, `CHART_SURFACE`, …) continuano a funzionare.
 *
 * Contrasto (WCAG 2.1) su surface-1 (#0E0E0E):
 *   #FFFFFF 19.3 · #A0A0A0 7.4 · #8A8A8A 5.6 · #666666 3.4 (solo decorativo)
 *   lime 16.1 · cyan 10.7 · amber 9.0 · green 8.5 · violet 7.1 · rose 5.3 · indigo 6.5
 */

// Nota sui tipi: niente `as const` sulle palette. I valori devono essere `string`,
// non letterali, altrimenti assegnare un colore del tema dove ne è già stato
// inferito un altro diventa un errore di tipo.

// ─── Superfici: nero stratificato, nessun vetro ─────────────────────────────
export const CHART_SURFACE: Record<
  'ink' | 'panel' | 'panelSoft' | 'raised' | 'border' | 'borderStrong' | 'grid',
  string
> = {
  /** Fondo dell'app. */
  ink: '#050505',
  /** Card di grafico e di sezione (surface-1). */
  panel: '#0E0E0E',
  /** Un livello sopra la card: tile KPI, tooltip, controlli (surface-2). */
  panelSoft: '#141414',
  /** Due livelli sopra la card: hover, popover (surface-3). */
  raised: '#1A1A1A',
  border: '#1E1E1E',
  borderStrong: '#2A2A2A',
  grid: '#222222',
};

// ─── Testo (valori verificati ≥4.5:1 sul pannello, salvo `faint`) ───────────
export const CHART_TEXT: Record<'primary' | 'muted' | 'axis' | 'faint', string> = {
  primary: '#FFFFFF',
  muted: '#A0A0A0',
  axis: '#8A8A8A',
  faint: '#666666', // solo decorativo / non informativo (3.4:1)
};

// ─── Serie dati: il colore indica il RUOLO, non il capriccio del file ───────
export const CHART_SERIES: Record<
  'primary' | 'compare' | 'tertiary' | 'load' | 'risk' | 'positive' | 'projected',
  string
> = {
  /** Metrica primaria, valore attuale, selezione. L'identità del prodotto. */
  primary: '#C0FF00',
  /** Confronto / seconda serie sullo stesso asse; lavoro aerobico. */
  compare: '#22D3EE',
  /** Terza serie categorica; biomeccanica e struttura. */
  tertiary: '#A78BFA',
  /** Carico, soglia, attenzione. */
  load: '#F59E0B',
  /** Rischio, fatica, deriva, frequenza cardiaca. */
  risk: '#F43F5E',
  /** Recupero, progresso positivo, taper, obiettivo raggiunto. */
  positive: '#22C55E',
  /** Dato modellato, previsione, scenario. Tono 400: 6.5:1 anche come testo. */
  projected: '#818CF8',
};

/**
 * Ordine canonico per serie categoriche senza semantica propria.
 * Le prime quattro restano distinguibili anche per daltonici (verificato in
 * `theme.test.ts`); dalla quinta in poi il colore non basta e `seriesDash`
 * aggiunge il tratteggio.
 */
export const CHART_SERIES_ORDER: string[] = [
  CHART_SERIES.primary,
  CHART_SERIES.compare,
  CHART_SERIES.tertiary,
  CHART_SERIES.risk,
  CHART_SERIES.load,
  CHART_SERIES.positive,
];

/** Tratteggio di rinforzo per la serie `i` quando il colore da solo non basta. */
export const seriesDash = (i: number): string | undefined =>
  i < 4 ? undefined : (['6 3', '2 3', '8 3 2 3'][(i - 4) % 3]);

// ─── Zone di intensità Z1→Z5: rampa propria, fredda → calda ─────────────────
export const CHART_ZONES: string[] = ['#22D3EE', '#22C55E', '#C0FF00', '#F59E0B', '#F43F5E'];

// ─── Tipi di seduta: categoria, non metrica ─────────────────────────────────
export const CHART_WORKOUT: Record<
  'recovery' | 'easy' | 'long' | 'tempo' | 'intervals' | 'race' | 'strength',
  string
> = {
  recovery: '#8A8A8A',
  easy: '#22C55E',
  long: '#22D3EE',
  tempo: '#F59E0B',
  intervals: '#F43F5E',
  race: '#C0FF00',
  strength: '#A78BFA',
};

// ─── Stati di sistema: separati dalla palette delle metriche ────────────────
export const CHART_STATUS: Record<'success' | 'warning' | 'danger' | 'info', string> = {
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#F43F5E',
  info: '#22D3EE',
};

// ─── Geometria: una sola forma per tutti i grafici ──────────────────────────
export const CHART_SHAPE = {
  /** Raggio delle card (16), dei tile e dei tooltip (12), dei controlli (8). */
  radius: 16,
  radiusTile: 12,
  radiusControl: 8,
  /** Serie misurata. */
  strokeWidth: 2.5,
  /** Serie derivata (CTL, ATL, medie mobili…). */
  strokeWidthDerived: 2,
  /** Linee di riferimento e soglie. */
  strokeWidthReference: 1.5,
  /** Barre: raggio superiore unico. */
  barRadius: [4, 4, 0, 0] as [number, number, number, number],
  barMaxSize: 28,
  /** Punto attivo su hover. I dot fissi restano nascosti: sono rumore. */
  activeDotRadius: 5,
  /** Simbolo dei grafici a dispersione. */
  scatterRadius: 5,
  scatterOpacity: 0.78,
  /** Griglia: tratteggio unico. */
  gridDash: '3 3',
  /** Margini interni al plot, identici per ogni grafico. Mai negativi: tagliano i tick. */
  margin: { top: 8, right: 12, left: 0, bottom: 4 },
  /** Previsione e scenario: il tratto dice che non è misura. */
  dashProjected: '6 4',
  dashScenario: '2 4',
} as const;

// ─── Tipografia dei grafici ─────────────────────────────────────────────────
export const CHART_TYPE = {
  /** Un solo corpo per tick, legende, tooltip: il minimo informativo. */
  axisSize: 12,
  tooltipSize: 12,
  labelSize: 12,
  mono: "'JetBrains Mono', ui-monospace, monospace",
  sans: "'Inter', ui-sans-serif, system-ui, sans-serif",
} as const;

// ─── Altezze dell'area di plot per famiglia (px, desktop) ───────────────────
export const PLOT_HEIGHT = { compact: 160, standard: 240, tall: 320, hero: 360 } as const;
export type PlotSize = keyof typeof PLOT_HEIGHT;

// ─── Motion (product register: 150–250 ms, la motion comunica stato) ────────
export const CHART_MOTION = { duration: 200, ease: 'cubic-bezier(0.22, 1, 0.36, 1)' } as const;

// ─── Props pronti da spargere sui componenti Recharts ───────────────────────

/** `<CartesianGrid {...chartGrid} />` — solo orizzontali, tratteggio unico. */
export const chartGrid = {
  strokeDasharray: CHART_SHAPE.gridDash,
  stroke: CHART_SURFACE.grid,
  vertical: false,
} as const;

/** `<CartesianGrid {...chartGridBoth} />` — per dispersioni, dove contano entrambi gli assi. */
export const chartGridBoth = { ...chartGrid, vertical: true } as const;

/** Tick degli assi: 12 px mono, 5.6:1. */
export const chartTick = {
  fill: CHART_TEXT.axis,
  fontSize: CHART_TYPE.axisSize,
  fontFamily: CHART_TYPE.mono,
} as const;

/** `<XAxis {...chartAxis} />` — asse senza linea, tick leggibili. */
export const chartAxis = {
  stroke: CHART_TEXT.axis,
  fontSize: CHART_TYPE.axisSize,
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  tick: chartTick,
} as const;

/** Asse X temporale/categorico: tick che si diradano da soli invece di sovrapporsi. */
export const chartXAxis = { ...chartAxis, minTickGap: 24 } as const;

/** Asse Y: larghezza esplicita (mai margini negativi) e tick vicini al plot. */
export const chartYAxis = { ...chartAxis, width: 40, tickMargin: 4 } as const;

/** Cursore hover coerente: verticale sui grafici a linee/aree. */
export const chartCursor = {
  stroke: CHART_SURFACE.borderStrong,
  strokeWidth: 1,
} as const;

/** Cursore hover per i grafici a barre. */
export const chartCursorBar = { fill: 'rgba(255,255,255,0.04)' } as const;

/** Margini del plot: `<LineChart margin={chartMargin}>`. */
export const chartMargin = CHART_SHAPE.margin;

/** Linea di riferimento (media, soglia, oggi): neutra, tratteggiata, sottile. */
export const chartReferenceLine = {
  stroke: CHART_TEXT.axis,
  strokeDasharray: '4 4',
  strokeWidth: CHART_SHAPE.strokeWidthReference,
} as const;

// ─── Tratti per natura del dato: misurato / derivato / previsto / scenario ──

export type SeriesKind = 'observed' | 'derived' | 'projected' | 'scenario';

/**
 * Props `<Line>`/`<Area>` per natura del dato.
 *  - observed:  continuo, 2.5 px — quello che è stato misurato
 *  - derived:   continuo, 2 px — calcolato dalle misure (CTL, medie mobili)
 *  - projected: tratteggio 6 4, 2 px — previsione del modello
 *  - scenario:  puntinato 2 4, 2 px — ipotesi "e se…"
 * Nessun intervallo di incertezza è disegnato da qui: va mostrato solo se il
 * dato lo fornisce.
 */
export function seriesStroke(color: string, kind: SeriesKind = 'observed') {
  const base = {
    stroke: color,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    dot: false as const,
    activeDot: { r: CHART_SHAPE.activeDotRadius, fill: color, stroke: CHART_SURFACE.panel, strokeWidth: 2 },
  };
  switch (kind) {
    case 'observed':
      return { ...base, strokeWidth: CHART_SHAPE.strokeWidth };
    case 'derived':
      return { ...base, strokeWidth: CHART_SHAPE.strokeWidthDerived };
    case 'projected':
      return { ...base, strokeWidth: CHART_SHAPE.strokeWidthDerived, strokeDasharray: CHART_SHAPE.dashProjected };
    case 'scenario':
      return { ...base, strokeWidth: CHART_SHAPE.strokeWidthDerived, strokeDasharray: CHART_SHAPE.dashScenario };
  }
}

/** Stop del gradiente d'area: velo leggero, mai decorativo (≈20% in alto, nullo in basso). */
export const AREA_FILL = { top: 0.24, bottom: 0.02 } as const;

/** Opacità della fascia per intervalli o aree di contesto. */
export const BAND_OPACITY = 0.12;

// ─── Classi Tailwind condivise ──────────────────────────────────────────────

/**
 * Classe della chart card. Una sola forma, un solo bordo, un solo padding.
 * Niente nested card: la card È il contenitore del grafico.
 * Preferire il componente `AnalyticsChartCard`; questa resta per chi non può.
 */
export const chartCardClass = 'ea-card';

// ─── Utilità di contrasto (usate dai test e dagli strumenti di audit) ───────

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

/** Rapporto di contrasto WCAG fra due colori esadecimali a 6 cifre. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
