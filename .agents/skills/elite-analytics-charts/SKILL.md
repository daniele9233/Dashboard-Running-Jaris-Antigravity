---
name: elite-analytics-charts
description: Da usare quando si crea, modifica o corregge qualsiasi grafico, card analitica, tooltip, legenda o SVG di dati in METIC LAB / Elite Analytics (Recharts, SVG proprietari, KPI, selettori di intervallo). Impone token, contratto del grafico e componenti condivisi; non usare per mappe, 3D, icone o scene decorative.
---

# Elite Analytics · grafici

Un grafico qui non si disegna da zero: si compone dal kit. Il sistema ha un'identità sola ("The Instrument Panel": nero stratificato piatto, un accento lime, colore = significato, numeri in mono tabulare) e tutto ciò che la definisce è già in file reali. Questa skill indica dove guardare e cosa non fare; non ripete la documentazione.

## Prima di toccare codice

1. Leggi `DESIGN.md` (carattere e regole) e `docs/design-system/03-CHART-CONTRACT.md` (contratto, famiglie, preset).
2. Token: `src/design/tokens.css` ⇄ `src/components/charts/theme.ts` (stessi valori, test di parità). Tabella in `docs/design-system/02-TOKENS.md`.
3. Se il grafico esiste già, controlla in `docs/design-system/04-MIGRATION-LOG.md` se è migrato e quali eccezioni ha.

## Come si costruisce

```tsx
import { AnalyticsChartCard, ChartTip, ChartLegend, ChartRangeSelector,
         CHART_SERIES, chartGrid, chartXAxis, chartYAxis, chartMargin, seriesStroke } from '@/components/charts';
```

- **Guscio**: `AnalyticsChartCard` (titolo, descrizione, azioni, KPI, plot, legenda, statistiche, nota). Struttura diversa → `ChartCard` + `ChartHeader` + `ChartPlot`. Pannello con icona → `ChartPanel`.
- **Plot**: altezza per famiglia (`compact` 160 · `standard` 240 · `tall` 320 · `hero` 360 · `square` · `auto`), mai `h-[Npx]` locale. Sempre `plotLabel` e, se utile, `summary`.
- **Assi/griglia**: `<CartesianGrid {...chartGrid}/>` (`chartGridBoth` per scatter), `<XAxis {...chartXAxis}/>`, `<YAxis {...chartYAxis}/>`, `margin={chartMargin}` — mai margini negativi. Tick 12 px.
- **Tooltip**: `<ChartTip formatter={…} labelFormatter={…}/>`; per righe custom `row={…}` o `ChartTooltip` con `rows`. Mai `contentStyle`, mai un tooltip nuovo.
- **Tratti**: `seriesStroke(colore, 'observed' | 'derived' | 'projected' | 'scenario')`. Misurato continuo, previsto `6 4`, scenario `2 4`. Un grafico interamente modellato resta continuo e lo dichiara nella descrizione. L'intervallo di incertezza solo se il dato lo fornisce.
- **Colori**: da `CHART_SERIES` (ruolo), `CHART_ZONES` (Z1→Z5), `CHART_WORKOUT` (tipo di seduta), `CHART_STATUS` (stato di sistema). Mai un esadecimale. Rosso/verde mai da soli: segno o etichetta.
- **Legenda**: `ChartLegend` con `kind` che riproduce il tratto. **Intervalli**: `ChartRangeSelector`. **KPI**: `ChartKpi` + `ChartKpiStrip` (tile, non card). **Vuoto/caricamento/errore**: `status` della card.
- **SVG proprietari**: solo proprietà visuali dal tema; `useElementSize` invece di `viewBox` fisso; id con `useId()`; nessun glow/blur; tastiera + `role`/`aria-label` se interattivi; mai CSS globale su `svg`.

## Non si cambia mai (vincoli di prodotto)

Formule, unità, domini, scale, direzione degli assi (passo in min/km invertito), interpolazioni, aggregazioni, filtri temporali, contratti API. Bici/cyclette solo nel widget DETRAINING. Previsioni: VDOT solo da corse ≥ 5 K, sempre con pendenza/tenuta. Se il design "richiede" di toccare un numero, ferma e chiedi.

## Verifica (obbligatoria prima di dichiarare finito)

```bash
npm run lint            # tsc
npm run test            # incluso src/components/charts/*.test.*
npm run design:check    # cricchetto: nessuna nuova violazione (esadecimali, testo < 12 px, vetro, margini negativi…)
npm run build
```

Poi nel browser (`frontend-5173`, o la porta assegnata; `?intro=0` salta la hero): 1440×900, 768×1024, 390×844; tooltip al passaggio e da tastiera; cambio di intervallo; nessuna scrittura sul DB di produzione (intercetta `window.fetch`). Un grafico non è "verificato" senza uno screenshot.

## Anti-pattern

card dentro card · vetro/blur/gradiente decorativo · filo laterale colorato · titolo in corsivo o in maiuscolo spaziato · testo informativo < 12 px · asse con colore < 4.5:1 · un tooltip/legenda/selettore locale "perché sta meglio così" · colore come unico segnale · altezza fissa globale · dominio o formatter toccato per allineare due grafici.
