# 03 · Contratto del grafico (Universal Chart Contract)

Valido per ogni grafico, di qualunque tipo. I grafici non sono tutti uguali, hanno la **stessa identità**: un radar resta un radar, una serie temporale resta temporale, uno scatter non diventa una linea.

```
ChartCard ─┬─ ChartHeader   titolo · descrizione · azioni (intervallo, espandi, info)
           ├─ KPI           ChartKpiStrip → ChartKpi (tile, non card)         [opzionale]
           ├─ ChartPlot     area del grafico: altezza per famiglia             [obbligatorio]
           ├─ ChartLegend   campione = tratto della serie                      [se serve]
           ├─ ChartStats    statistiche di sintesi                             [opzionale]
           └─ ChartInsight  una riga: come si legge il grafico                 [opzionale]
```

Tutto vive in `src/components/charts/`; il CSS in `src/design/charts.css` (classi `ea-*`).

## Componenti (e perché esistono)

Creati solo dove eliminano duplicazione reale (vedi `01-AUDIT.md` §3 e §7).

| Componente | File | Sostituisce | API essenziale |
|---|---|---|---|
| `AnalyticsChartCard` | `ChartCard.tsx` | 14 guschi locali (`V2Card`, `Panel`×6, `Card`+`CardHeader`×3, `LBPanel`…) | `title`, `description`, `icon`, `actions`, `kpis`, `legend`, `stats`, `insight`, `size`, `status`, `plotLabel`, `summary` |
| `ChartCard`, `ChartHeader`, `ChartPlot`, `ChartInsight` | `ChartCard.tsx` | stessi, per chi ha una struttura particolare | composizione libera |
| `ChartPanel` | `ChartCard.tsx` | `Panel({icon,title,hint})` di PotentialProgressV3, BiologyFutureV3… | `icon`, `title`, `hint`, `actions` |
| `ChartKpi`, `ChartKpiStrip`, `ChartStat`, `ChartStats` | `ChartKpi.tsx` | tile e `StatCell` locali | `label`, `value`, `unit`, `delta` + `trend`, `color`, `icon`, `note`, `onClick`/`active` |
| `ChartLegend` | `ChartLegend.tsx` | `div` locali a 9 px | `items: {key,label,color,kind,value}`; `kind`: line · dashed · dotted · area · bar · dot · band |
| `ChartRangeSelector` | `ChartRangeSelector.tsx` | 7 selettori 1M/3M, 7D/30D | `value`, `options`, `onChange` |
| `ChartTooltip`, `ChartTooltipContent`, `ChartTip` | `ChartTooltip.tsx` | 19 tooltip + 35 `contentStyle` | `ChartTip` accetta `formatter`/`labelFormatter` come `<Tooltip>` di Recharts |
| `ChartEmptyState`, `ChartLoadingState`, `ChartErrorState` | `ChartStates.tsx` | 8+ stati vuoti diversi | stesso rettangolo del plot |
| `useElementSize` | `useElementSize.ts` | `viewBox` fisso degli SVG disegnati a mano | `[ref, {width,height}]` |
| `useMediaQuery`, `useIsNarrow`, `usePrefersReducedMotion` | `useMediaQuery.ts` | — | |

Non creati perché non c'è duplicazione reale: `ChartAxis`/`ChartGrid` (sono preset, non componenti), `ChartTimeRangeSelector` (è `ChartRangeSelector`).

## Preset Recharts (`theme.ts`)

Un grafico Recharts standard:

```tsx
import {
  AnalyticsChartCard, ChartTip, ChartLegend, ChartRangeSelector,
  CHART_SERIES, chartGrid, chartXAxis, chartYAxis, chartMargin, seriesStroke,
} from '@/components/charts';

<AnalyticsChartCard
  title="VDOT nel tempo"
  description="Ultimi 12 mesi"
  size="tall"
  plotLabel="Andamento del VDOT negli ultimi dodici mesi"
  summary={`Oggi ${vdot.toFixed(1)}, ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} in tre mesi`}
  legend={<ChartLegend items={[{ key: 'v', label: 'VDOT misurato', color: CHART_SERIES.primary, kind: 'line' }]} />}
>
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data} margin={chartMargin}>
      <CartesianGrid {...chartGrid} />
      <XAxis {...chartXAxis} dataKey="date" />
      <YAxis {...chartYAxis} />
      <ChartTip formatter={(v) => [`${v}`, 'VDOT']} />
      <Line dataKey="vdot" {...seriesStroke(CHART_SERIES.primary, 'observed')} />
    </LineChart>
  </ResponsiveContainer>
</AnalyticsChartCard>
```

| Preset | Cosa fa |
|---|---|
| `chartGrid` / `chartGridBoth` | griglia tratteggiata `3 3`, colore `grid`; orizzontale per serie e barre, bidirezionale per dispersioni |
| `chartXAxis` / `chartYAxis` | niente linea d'asse né tacche; tick 12 px mono `#8A8A8A`; `minTickGap 24` sull'ascisse; `width 40` sull'ordinata (sovrascrivibile) |
| `chartMargin` | `{top 8, right 12, left 0, bottom 4}`. **Mai margini negativi**: tagliano i tick |
| `chartCursor` / `chartCursorBar` | cursore hover per linee e per barre |
| `chartReferenceLine` | media, soglia, "oggi": neutra, `4 4`, 1.5 px; il nome sta nella legenda, non sul grafico |
| `seriesStroke(color, kind)` | `observed` continuo 2.5 · `derived` continuo 2 · `projected` `6 4` · `scenario` `2 4`; terminali arrotondati, punti nascosti, punto attivo r 5 |
| `AREA_FILL` | velo dell'area: 0.24 → 0.02 |

**Non si toccano mai** da un preset: `domain`, `reversed`, `tickFormatter`, `dataKey`, `type`, `scale`, `interval` esplicito, `connectNulls`, `stackId`. Il passo in min/km resta invertito e formattato come il dato impone.

## Le famiglie

| Famiglia | Grafici | Plot | Grammatica condivisa | Varianti esplicite |
|---|---|---|---|---|
| **A · Temporal Performance** | CTL/ATL/TSB, VDOT, VO₂max, ritmo, deriva cardiaca, GCT, carico settimanale | `tall` (hero 360 per il grafico guida) | `chartGrid` orizzontale, `chartXAxis` date a 3–6 tick, `chartYAxis`, tooltip `ChartTip`, linea 2.5/2 px, area ≤ 0.24, riferimenti neutri | `observed` / `derived` / `projected`; due assi Y solo con unità diverse |
| **B · Distribution** | zone di passo, distribuzione passo, minuti per zona, km per tipo di seduta | `standard` | barre con `barRadius [4,4,0,0]`, `barMaxSize 28`, cursore `chartCursorBar`, tre livelli di enfasi (pieno / attenuato / neutro) | orizzontali (`layout="vertical"`, `horizontal={false}`), impilate (`stackId`), liste a barre HTML (`ul` + binario `surface-2`) |
| **C · Relationship** | passo/FC, GCT/cadenza, carico/prestazione, sedute che pesano | `tall` / `standard` | `chartGridBoth`, simbolo r 5 opacità 0.78, dimensione = terza variabile (`ZAxis`), media come riferimento neutro e voce di legenda | colore per sistema (ogni punto un `Cell`) |
| **D · Performance Composition** | radar (prontezza, profilo atletico), anelli, gauge, treemap | `square` / `standard` | stessi colori, etichette 12 px, legenda con `value`, riga di lettura | restano radar, anelli, treemap: cambia solo la grammatica |
| **E · Prediction & Scenario** | taper vs fermo, ritorno al futuro, previsione VO₂max, race predictions, ricette | `tall` | un grafico che **mescola** misurato e previsto tratteggia il previsto (`6 4`) e lo dichiara in legenda; un grafico **interamente** modellato resta continuo e lo dice nella descrizione ("scenario", "modello") | l'intervallo di incertezza si disegna **solo se il dato lo fornisce**, mai inventato |

## Regole per gli SVG proprietari (Fase 5)

Race Lab, GAMI, curve del Pace Lab, FitnessMultiChart, gauge e anelli:

1. Si conservano coordinate, algoritmi, geometria funzionale, interazioni e semantica; cambiano solo le proprietà visuali (colore, font, spessore, opacità).
2. Colori, font e opacità dal tema (`CHART_*`); nessun esadecimale locale.
3. Nessuna regola CSS globale su `svg`; id di `clipPath`, `linearGradient`, `filter` generati con `useId()` (card montabili più volte).
4. Gli SVG disegnati a mano si ricalcolano alla larghezza reale (`useElementSize`) invece di scalare un `viewBox`: il testo resta a 12 px reali.
5. Niente `filter` blur/glow decorativi.
6. Se reagiscono al puntatore reagiscono anche alla tastiera (frecce/Home/Fine/Esc) e dichiarano `role`/`aria-label`.

## Accessibilità

- Contrasto: testo ≥ 4.5:1, grafica ≥ 3:1 (token verificati in `theme.test.ts`).
- Il colore non è l'unico segnale: delta con segno, voci di legenda con tratto/forma, tratteggio dalla quinta serie, etichetta di testo su rischio/miglioramento.
- Ogni plot ha `role="group"` + `aria-label`; `summary` è un riassunto testuale raggiungibile (`aria-describedby`, `aria-live="polite"`).
- Recharts 3 espone già la tastiera (`accessibilityLayer`); gli SVG custom la implementano a mano.
- Focus visibile: anello lime 2 px, offset 2 px (`.ea-card :focus-visible`).
- Bersagli al tocco: selettori di intervallo e legende attive a 44 px su `pointer: coarse`.

## Responsive

| Viewport | Regola |
|---|---|
| ≥ 1280 | colonne a coppie o a tre; plot `tall`/`hero` |
| 768–1279 | una colonna per card di grafico (`lg:grid-cols-2` solo da 1024); legende a capo |
| < 768 | altezze di plot ridotte (variabili CSS), padding 16 px, tick diradati (`minTickGap`, `useIsNarrow`), KPI su due colonne, nessuno scroll orizzontale di pagina |
| 360 | nessun grafico sotto 240 px di larghezza utile; la barra delle schede scorre con frecce |

## Anti-pattern (verificabili)

| Divieto | Come si verifica |
|---|---|
| esadecimale scritto in un componente di grafico | `npm run design:check` |
| `margin` negativo in un `*Chart` | `npm run design:check` |
| tick o testo informativo sotto 12 px | `npm run design:check` (classi `text-[<12px]`, `fontSize` < 12) |
| tooltip o legenda locale per differenze estetiche | revisione + `design:check` (`contentStyle`) |
| card dentro card, blur, gradiente decorativo, bordo laterale colorato | `design:check` (`backdrop-blur`, `borderLeft: 3px`) |
| dominio, unità, formatter, scala o formula modificati per "allineare" | revisione del diff, test di dominio esistenti (422) |
| titolo di card in corsivo / maiuscolo spaziato | `design:check` |

## Test dei componenti condivisi

`src/components/charts/theme.test.ts` (14 test: parità CSS↔TS, contrasto WCAG, daltonismo, preset) e `charts.test.tsx` (18 test: contratto della card, KPI, legenda, selettore, tooltip, stati). Si eseguono con `npm run test`; renderizzano in Node con `react-dom/server`, senza aggiungere dipendenze.
