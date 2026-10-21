# 02 · Token — Elite Analytics

Fonte unica dei valori: [`src/design/tokens.css`](../../src/design/tokens.css) (blocco `@theme static`, quindi disponibile sia come variabile CSS `var(--color-ea-…)` sia come utility Tailwind `bg-ea-surface-1`, `text-ea-text-muted`, `rounded-ea-card`…).
Specchio TypeScript: [`src/components/charts/theme.ts`](../../src/components/charts/theme.ts). Il test [`theme.test.ts`](../../src/components/charts/theme.test.ts) verifica che i due coincidano valore per valore: cambiare un colore in un solo posto fa fallire `npm run test`.

La descrizione di carattere (perché questi valori) sta in [`DESIGN.md`](../../DESIGN.md).

## Decisione sulla palette proposta dal master prompt

La palette di partenza proposta (`#B9F500`, `#090B0C`, `#101214`, `#15191C`, `#292E32`, `#F5F7F8`, `#A3ABB2`, `#77828C`, `#20C9E8`, `#F3AD12`, `#F04465`, `#9381F5`) è stata **verificata contro il codice reale e non adottata**:

- il lime del prodotto è `#C0FF00` ed è usato 401 volte, nella hero, in `PRODUCT.md`, nelle memorie dell'utente; `#B9F500` ne è una variante a 2% di distanza che costringerebbe a toccare ovunque senza guadagno;
- i neutri attuali (`#050505`, `#0E0E0E`, `#1E1E1E`) sono già una scala coerente e coincidono con la hero (`#080908`); i neutri proposti sono più freddi e cambierebbero il fondo di tutta l'app, non solo dei grafici;
- le quattro tinte di metrica proposte (ciano, ambra, rosso, viola) differiscono da quelle già in uso (`#22D3EE`, `#F59E0B`, `#F43F5E`, `#A78BFA`) di meno di una soglia percepibile: nessun guadagno cromatico, 179 riferimenti da toccare.

Si adotta invece la **struttura** proposta: scala di superfici a livelli, tre livelli di testo, colori semantici di metrica, colore dedicato per previsione e per stato.
Unica modifica a un valore esistente: `projected` da `#6366F1` (4.3:1, sotto 4.5 come testo) a `#818CF8` (6.5:1).

## Colori

### Superfici (nero stratificato)

| Token CSS | Token TS | Valore | Uso |
|---|---|---|---|
| `--color-ea-ink` | `CHART_SURFACE.ink` | `#050505` | fondo dell'app |
| `--color-ea-surface-1` | `CHART_SURFACE.panel` | `#0E0E0E` | card di grafico e di sezione |
| `--color-ea-surface-2` | `CHART_SURFACE.panelSoft` | `#141414` | tile KPI, tooltip, controlli segmentati, binari delle barre |
| `--color-ea-surface-3` | `CHART_SURFACE.raised` | `#1A1A1A` | hover, popover |
| `--color-ea-hairline` | `CHART_SURFACE.border` | `#1E1E1E` | bordo di card, separatori |
| `--color-ea-hairline-strong` | `CHART_SURFACE.borderStrong` | `#2A2A2A` | bordo di tooltip, cursore, asse delle ascisse |
| `--color-ea-grid` | `CHART_SURFACE.grid` | `#222222` | griglia dei grafici (1.2:1: sullo sfondo, mai informazione) |

### Testo (contrasto su surface-1)

| Token CSS | Token TS | Valore | Contrasto | Uso |
|---|---|---|---|---|
| `--color-ea-text` | `CHART_TEXT.primary` | `#FFFFFF` | 19.3:1 | valori, titoli |
| `--color-ea-text-muted` | `CHART_TEXT.muted` | `#A0A0A0` | 7.4:1 | descrizioni, etichette, legende |
| `--color-ea-text-axis` | `CHART_TEXT.axis` | `#8A8A8A` | 5.6:1 | tick degli assi, testo terziario |
| `--color-ea-text-faint` | `CHART_TEXT.faint` | `#666666` | 3.4:1 | **solo decorativo**; mai per testo informativo |

### Metriche (un colore, un significato)

| Token CSS | Token TS (`CHART_SERIES.`) | Valore | Contrasto | Significato |
|---|---|---|---|---|
| `--color-ea-lime` | `primary` | `#C0FF00` | 16.1 | marchio; metrica primaria, valore attuale, selezione |
| `--color-ea-cyan` | `compare` | `#22D3EE` | 10.7 | aerobico, confronto, seconda serie |
| `--color-ea-violet` | `tertiary` | `#A78BFA` | 7.1 | biomeccanica e struttura, terza serie |
| `--color-ea-amber` | `load` | `#F59E0B` | 9.0 | carico, soglia, attenzione |
| `--color-ea-rose` | `risk` | `#F43F5E` | 5.3 | rischio, fatica, deriva, frequenza cardiaca |
| `--color-ea-green` | `positive` | `#22C55E` | 8.5 | recupero, progresso positivo, forma fresca |
| `--color-ea-indigo` | `projected` | `#818CF8` | 6.5 | modello, previsione, scenario |

Ordine canonico per serie senza semantica propria (`CHART_SERIES_ORDER`): lime, ciano, viola, rosso, ambra, verde. Le prime quattro restano distinguibili (ΔE ≥ 25) anche in deuteranopia, protanopia e tritanopia (verificato nel test con le matrici di Machado et al.); dalla quinta in poi `seriesDash(i)` aggiunge un tratteggio.
**Vincolo noto:** rosso e verde hanno ΔE 8 in deuteranopia. Per questo rischio/miglioramento portano sempre segno o etichetta di testo, mai solo colore.

### Zone di intensità (rampa propria, fredda → calda)

`CHART_ZONES` · `--color-ea-zone-1…5`: `#22D3EE` · `#22C55E` · `#C0FF00` · `#F59E0B` · `#F43F5E`.

### Tipi di seduta (categoria, non metrica)

`CHART_WORKOUT` · `--color-ea-workout-*`: recovery `#8A8A8A` · easy `#22C55E` · long `#22D3EE` · tempo `#F59E0B` · intervals `#F43F5E` · race `#C0FF00` · strength `#A78BFA`.
**Eccezione dichiarata:** la barra colorata di `TrainingGrid` e la heatmap di `ProfileView` usano ancora le loro palette (vedi `04-MIGRATION-LOG.md`, decisione aperta).

### Stati di sistema (separati dalle metriche)

`CHART_STATUS` · `--color-ea-status-*`: success `#22C55E` · warning `#F59E0B` · danger `#F43F5E` · info `#22D3EE`.

## Tipografia

| Ruolo | Famiglia | Dimensione / interlinea | Peso | Note |
|---|---|---|---|---|
| KPI grande | JetBrains Mono | 40 / 44 | 700 | `--text-ea-kpi-lg` · tabular-nums |
| KPI | JetBrains Mono | 32 / 36 | 700 | `--text-ea-kpi` |
| KPI piccolo | JetBrains Mono | 24 / 28 | 700 | `--text-ea-kpi-sm` |
| Statistica di sintesi | JetBrains Mono | 20 / 24 | 700 | `ChartStat` |
| Titolo di card | Inter | 18 / 24 | 700 | `--text-ea-title` · `.ea-title` · -0.01em |
| Corpo | Inter | 14 / 20 | 400 | `--text-ea-body` |
| Descrizione | Inter | 13 / 18 | 400 | `.ea-desc` |
| Etichetta | Inter | 12 / 16 | 600 | `--text-ea-label` · maiuscolo, 0.06em |
| Tick, legenda, tooltip, didascalia | JetBrains Mono / Inter | 12 / 16 | 400–700 | `CHART_TYPE.axisSize = 12` |

**Regola dei dodici:** nessun testo informativo sotto 12 px. **Regola del tabulare:** ogni numero che cambia è `font-variant-numeric: tabular-nums`.
Il peso 800/900 non è caricato (Inter e JetBrains Mono arrivano da Google Fonts a 400–700): `font-black` rende come 700. Il font `Outfit`, importato e mai usato, è stato rimosso.

## Spaziatura (griglia a 4 px, ritmo a 8)

| Valore | Uso |
|---|---|
| 4 | micro: icona–etichetta, riga di tooltip |
| 8 | minimo: gap fra controlli, voci di legenda |
| 12 | compatto: gap fra KPI, header → azioni |
| 16 | standard: gap fra i blocchi dentro una card (`--ea-card-gap`), padding di card sotto 768 px |
| 20 | padding di card da 768 px (`--ea-card-pad`) |
| 24 | fra card e fra sezioni |
| 32 | separazione maggiore |

## Forme

| Token | Valore | Uso |
|---|---|---|
| `--radius-ea-card` | 16 px | card |
| `--radius-ea-tile` | 12 px | tile KPI, tooltip, pannelli interni |
| `--radius-ea-control` | 8 px | controlli segmentati, chip |
| barre | `[4,4,0,0]` | `CHART_SHAPE.barRadius`, `barMaxSize` 28 |
| linee | 2.5 / 2 / 1.5 px | misurata / derivata / riferimento |
| punto attivo | r 5 | solo su hover; i punti fissi restano nascosti |
| dispersione | r 5, opacità 0.78 | `CHART_SHAPE.scatterRadius/Opacity` |

## Altezze dell'area di plot (per famiglia, mai globali)

| Classe | Desktop | < 768 px | Uso tipico |
|---|---|---|---|
| `compact` | 160 | 136 | sparkline, mini-trend |
| `standard` | 240 | 208 | distribuzioni, barre, radar, previsioni a coppie |
| `tall` | 320 | 264 | serie temporali, dispersioni |
| `hero` | 360 | 296 | grafico guida di una sezione |
| `square` | quadrato fino a `tall` | | radar, anelli |
| `auto` | del contenuto | | liste a barre HTML, SVG con proprio viewBox |

## Movimento

- Durata unica dei cambi di stato: 200 ms (`--ea-motion`, `CHART_MOTION.duration`), curva `cubic-bezier(0.22, 1, 0.36, 1)`.
- `prefers-reduced-motion: reduce` spegne transizioni di tile, selettori, barre e lo scheletro di caricamento (`charts.css`).
- Il tooltip di Recharts non anima (`isAnimationActive={false}` in `ChartTip`).
- Nessuna animazione decorativa: l'unico movimento è lo stato (selezione, intervallo, hover).
