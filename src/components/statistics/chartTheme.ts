/**
 * chartTheme — fonte di verità unica per TUTTI i grafici della sezione Statistiche.
 *
 * Prima di questo modulo ogni file ridefiniva la propria palette: sei arancioni
 * diversi (#F97316, #F59E0B, #FF5B00, #ff5b00…), il lime dichiarato cinque volte
 * sotto tre nomi (NEON / ACCENT / PRO_ACCENT), il rosso quattro volte sotto
 * quattro nomi. Risultato: due grafici affiancati non sembravano dello stesso
 * prodotto. Qui i colori hanno un RUOLO, non un nome cromatico, così una serie
 * "carico" resta identica ovunque compaia.
 *
 * Contrasto (WCAG 2.1 su surface #0E0E0E, L = 0.0044):
 *   #8A8A8A → 5.2:1   tick degli assi        (prima #555 = 2.5:1, sotto soglia)
 *   #A0A0A0 → 7.0:1   label e testo muted
 *   #FFFFFF → 19.1:1  valori primari
 */

// Nota sui tipi: niente `as const` sulle palette. Serve che i valori siano
// `string`, non letterali, altrimenti assegnare un colore del tema dove ne è
// già stato inferito un altro diventa un errore di tipo.

// ─── Superfici e struttura ──────────────────────────────────────────────────
export const CHART_SURFACE: Record<
  'panel' | 'panelSoft' | 'border' | 'borderStrong' | 'grid', string
> = {
  panel: '#0E0E0E',
  panelSoft: '#111111',
  border: '#1E1E1E',
  borderStrong: '#2A2A2A',
  grid: '#1E1E1E',
};

// ─── Testo (valori verificati ≥4.5:1 sul pannello) ──────────────────────────
export const CHART_TEXT: Record<'primary' | 'muted' | 'axis' | 'faint', string> = {
  primary: '#FFFFFF',
  muted: '#A0A0A0',
  axis: '#8A8A8A',
  faint: '#666666', // solo decorativo / non informativo
};

// ─── Serie dati: il colore indica il RUOLO, non il capriccio del file ───────
export const CHART_SERIES: Record<
  'primary' | 'compare' | 'tertiary' | 'load' | 'risk' | 'positive' | 'projected',
  string
> = {
  /** Metrica primaria, valore attuale, selezione. L'identità del prodotto. */
  primary: '#C0FF00',
  /** Confronto / seconda serie sullo stesso asse. */
  compare: '#22D3EE',
  /** Terza serie categorica. */
  tertiary: '#A78BFA',
  /** Carico, fatica, attenzione. (Consolida i sei arancioni precedenti.) */
  load: '#F59E0B',
  /** Rischio, deriva, frequenza cardiaca. */
  risk: '#F43F5E',
  /** Recupero, progresso positivo, taper, obiettivo raggiunto. (8.3:1) */
  positive: '#22C55E',
  /** Proiezione, scenario, dato modellato (non misurato). */
  projected: '#6366F1',
};

/** Ordine canonico per serie categoriche senza semantica propria. */
export const CHART_SERIES_ORDER: string[] = [
  CHART_SERIES.primary,
  CHART_SERIES.compare,
  CHART_SERIES.tertiary,
  CHART_SERIES.load,
  CHART_SERIES.risk,
  CHART_SERIES.positive,
];

// ─── Geometria: una sola forma per tutti i grafici ──────────────────────────
export const CHART_SHAPE = {
  /** Raggio delle chart card. */
  radius: 20,
  /** Spessore linea serie: unico, prima oscillava fra 2 e 3. */
  strokeWidth: 2.5,
  /** Barre: stesso raggio superiore ovunque. */
  barRadius: [6, 6, 0, 0] as [number, number, number, number],
  /** Punto attivo su hover. I dot fissi restano nascosti: sono rumore. */
  activeDotRadius: 5,
  gridDash: '3 3',
  /** Margini interni al plot, identici per ogni grafico. */
  margin: { top: 8, right: 12, left: 4, bottom: 4 },
} as const;

// ─── Tipografia dei grafici ─────────────────────────────────────────────────
export const CHART_TYPE = {
  /** Un solo corpo per i tick: prima variava fra 9, 11 e 12 px. */
  axisSize: 11,
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

// ─── Motion (product register: 150–250 ms, la motion comunica stato) ────────
export const CHART_MOTION = { duration: 200 } as const;

// ─── Props pronti da spargere sui componenti Recharts ───────────────────────

/** `<CartesianGrid {...chartGrid} />` */
export const chartGrid = {
  strokeDasharray: CHART_SHAPE.gridDash,
  stroke: CHART_SURFACE.grid,
  vertical: false,
} as const;

/** `<XAxis {...chartAxis} />` — asse senza linea, tick leggibili. */
export const chartAxis = {
  stroke: CHART_TEXT.axis,
  fontSize: CHART_TYPE.axisSize,
  tickLine: false,
  axisLine: false,
  tick: { fill: CHART_TEXT.axis, fontFamily: CHART_TYPE.mono },
} as const;

/** Cursore hover coerente: verticale sui grafici a linee/aree. */
export const chartCursor = {
  stroke: CHART_SURFACE.borderStrong,
  strokeWidth: 1,
} as const;

/** Cursore hover per i grafici a barre. */
export const chartCursorBar = { fill: 'rgba(255,255,255,0.04)' } as const;

/**
 * Classe della chart card. Una sola forma, un solo bordo, un solo padding.
 * Niente nested card: la card È il contenitore del grafico.
 */
export const chartCardClass =
  'rounded-[20px] border border-[#1E1E1E] bg-[#0E0E0E] p-5';
